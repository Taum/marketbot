import { GenericIndexer } from "./generic-indexer.js";
import { AlteredggCard } from "@common/models/cards.js";
import prisma from "@common/utils/prisma.server.js";
import { delay } from "@common/utils/promise.js";
import { processAndWriteOneUnique } from "./post-process.js";
import { ThrottlingConfig, throttlingConfig } from "./config.js";
import { getEnv } from "./helpers.js";
import { PrismaClient, UniqueInfo } from "@prisma/client";

export interface UniqueRequest {
  id: string;
}

export interface UniqueData {
  card: AlteredggCard;
}

const debugCrawler = getEnv("DEBUG_CRAWLER") == "true";

export const recordOneUnique = async (cardData: AlteredggCard, prisma: PrismaClient) => {
  const blob = {
    ref: cardData.reference,
    faction: cardData.mainFaction.reference,
    mainCost: parseInt(cardData!.elements.MAIN_COST || "0", 10),
    recallCost: parseInt(cardData!.elements.RECALL_COST || "0", 10),
    oceanPower: parseInt(cardData!.elements.OCEAN_POWER || "0", 10),
    mountainPower: parseInt(cardData!.elements.MOUNTAIN_POWER || "0", 10),
    forestPower: parseInt(cardData!.elements.FOREST_POWER || "0", 10),
    nameEn: cardData!.name,
    imageUrlEn: cardData!.imagePath,
    mainEffectEn: cardData!.elements.MAIN_EFFECT,
    echoEffectEn: cardData!.elements.ECHO_EFFECT,
    cardSet: cardData!.cardSet.reference,
    fetchedDetails: true,
    fetchedDetailsAt: new Date(),
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

export class UniquesCrawler extends GenericIndexer<UniqueRequest, UniqueData> {

  constructor(config: ThrottlingConfig = throttlingConfig["uniques"]) {
    // Call super with the fetch and persist functions, plus any options
    super(null, config);
  }

  // Create fetch and persist functions
  public async fetch(request: UniqueRequest) {
    const response = await fetch(`https://api.altered.gg/cards/${request.id}`);
    const card = await response.json();
    return { card };
  };

  public async persist(data: UniqueData, _request: UniqueRequest) {
    const cardData = data.card;
    await recordOneUnique(cardData, prisma);
  };


  public async enqueueUniquesWithId(ids: string[]) {
    console.log(`Enqueuing by ID ${ids.length} uniques...`)
    for (const id of ids) {
      await this.addRequests([{ id }], false, "id");
    }
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
      await this.addRequests([{ id: unique.ref }], false, "id");
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
