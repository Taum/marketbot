import { GenericIndexer, TooManyRequestsError } from "./generic-indexer.js";
import { AlteredggCard } from "@common/models/cards.js";
import prisma from "@common/utils/prisma.server.js";
import { delay } from "@common/utils/promise.js";
import { processAndWriteOneUnique } from "./post-process.js";
import { ThrottlingConfig, throttlingConfig } from "./config.js";
import { getEnv } from "./helpers.js";
import { PrismaClient } from "@prisma/client";

export interface UniqueRequest {
  requestId: string;
  familyId: string;
  locale?: string;
  nextPage?: string;
}

export interface UniqueData {
  card: AlteredggCard;
}

const debugCrawler = getEnv("DEBUG_CRAWLER") == "true";

export const recordOneUnique = async (cardData: AlteredggCard, prisma: PrismaClient, locale?: string) => {
  let blob: any = {
    ref: cardData.reference,
    faction: cardData.mainFaction.reference,
    cardSubTypes: cardData.cardSubTypes.map(subtype => subtype.reference),
    mainCost: parseInt(cardData!.elements.MAIN_COST || "0", 10),
    recallCost: parseInt(cardData!.elements.RECALL_COST || "0", 10),
    oceanPower: parseInt(cardData!.elements.OCEAN_POWER || "0", 10),
    mountainPower: parseInt(cardData!.elements.MOUNTAIN_POWER || "0", 10),
    forestPower: parseInt(cardData!.elements.FOREST_POWER || "0", 10),
    cardSet: cardData!.cardSet.reference,
    fetchedDetails: true,
    fetchedDetailsAt: new Date(),
  }
  if(!locale || locale === "en-us") {
    blob = {
      ...blob,
      imageUrlEn: cardData!.imagePath,
      nameEn: cardData!.name,
      mainEffectEn: cardData!.mainEffect,
      echoEffectEn: cardData!.echoEffect,
    }
  } else if(locale === "fr-fr") { 
    blob = {
      ...blob,
      imageUrlFr: cardData!.imagePath,
      nameFr: cardData!.name,
      mainEffectFr: cardData!.mainEffect,
      echoEffectFr: cardData!.echoEffect,
    }
  }

  try {
    const uniqueInfo = await prisma.uniqueInfo.upsert({
      where: { ref: blob.ref },
      update: blob,
      create: blob,
    });
    console.debug(`Recorded unique ${blob.ref} (${blob.nameEn})`);

    // Post-process the unique -- breakdown abilities and upsert them
    await processAndWriteOneUnique(uniqueInfo, prisma);

  } catch (error) {
    console.error(`Error recording unique ${blob.ref} (${blob.nameEn}): ${error}`);
  }
}

export class UniquesPublicApiCrawler extends GenericIndexer<UniqueRequest, UniqueData> {

  constructor(config: ThrottlingConfig = throttlingConfig["uniques"]) {
    // Call super with the fetch and persist functions, plus any options
    super(null, config);
  }

  // Create fetch and persist functions
  public async fetch(request: UniqueRequest) {    
    let url = ""
    if (request.nextPage) {
      url = "https://api.altered.gg" + request.nextPage;
    } else {
      const newUrl = new URL("https://api.altered.gg/public/cards")
      newUrl.searchParams.set("locale", request.locale ?? "en-us")
      newUrl.searchParams.set("page", "1")
      newUrl.searchParams.set("itemsPerPage", "30")
      newUrl.searchParams.set("rarity", "UNIQUE")
      newUrl.searchParams.set("inSale", "True")
      newUrl.searchParams.set("query", request.familyId)
      url = newUrl.toString()
    }

    const response = await fetch(url);
    if (!response.ok) {
      if (response.status == 429) {
        console.error(`Rate limit exceeded for ${request.familyId}`)
        throw new TooManyRequestsError(`Rate limit exceeded for ${request.familyId}`)
      }
      console.error(`Error fetching ${request.familyId}: ${response.status} ${response.statusText}`)
      throw new Error(`Error fetching ${request.familyId}: ${response.status} ${response.statusText}`)
    }
    return await response.json();
  };

  public async persist(data: UniqueData, request: UniqueRequest) {
    if (!data) {
      return;
    }
    
    const nextPath = data["hydra:view"]["hydra:next"];
    if (nextPath) {
      await this.addRequests([
        {
          ...request,
          nextPage: nextPath,
        }
      ], true)
    }
    
    const cardsData = data["hydra:member"] as AlteredggCard[];
    for (const cardData of cardsData) {
      await recordOneUnique(cardData, prisma, request.locale);
    }

    if (this.queueSize % 20 == 0) {
      console.debug(`UniquesCrawler queue size: ${this.queueSize}`)
    };
  };

  public async enqueueUniquesWithId(_ids: string[]) {
    console.log(`No enqueuing by ID in public api crawler`)
  }

  public async enqueueUniquesWithMissingEffects({ limit = 1000 }: { limit?: number } = {}) {
    const uniques = await prisma.uniqueInfo.findMany({
      where: {
        fetchedDetails: false,
      },
      orderBy: {
        lastSeenInSaleAt: 'desc',
      },
      take: limit,
    });

    console.log(`Uniques task enqueueing ${uniques.length} uniques...`)
    for (const unique of uniques) {
      if(unique.cardFamilyId == null) {
        console.warn(`Unique ${unique.ref} has no family ID, skipping...`)
        continue;
      }
      // create one request per locale, as both can't be requested at once
      await this.addRequests([{ familyId: unique.cardFamilyId, locale: "en-us", requestId: `${unique.cardFamilyId}-en-us` }], false, "requestId");
      await this.addRequests([{ familyId: unique.cardFamilyId, locale: "fr-fr", requestId: `${unique.cardFamilyId}-fr-fr` }], false, "requestId");
    }
  }

  public async enqueueUntil(otherPromise: Promise<void>) {
    let otherDone = false
    otherPromise.finally(() => otherDone = true)
    while (!otherDone) {
      await this.enqueueUniquesWithMissingEffects()
      await this.waitForCompletion()
      if (debugCrawler) {
        console.log("Uniques task pausing for 10s...")
        await delay(10_000)
      } else {
        await delay(60_000)
      }
    }
  }
}
