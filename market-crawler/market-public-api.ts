import { CardSet, CardType, Faction, Rarity } from "@common/models/cards.js";
import { CardDbEntry } from "@common/models/cards.js";
import { GenericIndexer, TooManyRequestsError } from "./generic-indexer.js";
import { Prisma } from '@prisma/client';
import prisma from "@common/utils/prisma.server.js";

import { unique } from 'radash';

import cardsJson from "@data/cards_min.json" assert { type: "json" };
import Decimal from "decimal.js";
import { getFamilyIdFromRef } from "@common/utils/altered.js";
import { throttlingConfig } from "./config.js";
import { getEnv } from "./helpers.js";
import { recordOneUnique } from "./uniques.js";


// Add the type from Prisma namespace
type UniqueInfoCreateInput = Prisma.UniqueInfoCreateInput;

export type CardFamilyRequest = {
  fetchGenerationId: number;
  name: string;
  faction: string;
  cardFamilyId: string;
  pageNumber: number;
}

export interface HydraResponse {
  "hydra:totalItems": number;
}

export interface PublicApiCardData {
  reference: string;
  imagePath: string;
  rarity: {
    reference: Rarity;
  }
  mainFaction: {
    reference: Faction;
  }
  cardSet: {
    reference: CardSet;
  }
  cardSubTypes: {
    reference: string;
    name: string;
  }[];
  name: string;
  mainEffect: string;
  echoEffect: string;
  elements: {
    MAIN_COST: string;
    RECALL_COST: string;
    MOUNTAIN_POWER: string;
    OCEAN_POWER: string;
    FOREST_POWER: string;
  }
  lowerPrice: number;
  inSale: number;
  lowerOfferId: string;
}

// interface for the `/cards` endpoint
export interface CardFamilyCardsData extends HydraResponse {
  "hydra:member": PublicApiCardData[];
}

export interface MarketUpdateCrawlerStats {
  newCardsAdded: number;
  totalOffersUpdated: number;
  totalPagesLoaded: number;
}

const verboseLevel = parseInt(getEnv("VERBOSE_LEVEL") ?? "0")
const debugCrawler = getEnv("DEBUG_CRAWLER") == "true";

export async function marketUpdateStatsStartAndGetGenerationId(): Promise<number> {
  const stats = await prisma.marketUpdateStats.create({
    data: {
      updateStartedAt: new Date(),
    },
  })
  return stats.generationId;
}

export async function marketUpdateStatsComplete(
  generationId: number,
  crawlerStats: MarketUpdateCrawlerStats | null): Promise<void> {
  await prisma.marketUpdateStats.update({
    where: { generationId: generationId },
    data: {
      ...crawlerStats,
      updateCompletedAt: new Date(),
    },
  })
}

export async function marketUpdateUniqueTableIsCurrent(fetchGenerationId: number) {

  await prisma.uniqueInfo.updateMany({
    where: {
      lastSeenGenerationId: {
        lt: fetchGenerationId,
      },
    },
    data: {
      seenInLastGeneration: false,
    }
  })

  /*
  Maybe we could be more fancy and use a custom SQL query here. Leaving this here for future improvements.
  e.g. this could be useful if we didn't do a whole market update but updated in family batches instead, maybe

  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "UniqueInfo" ui
      SET "seenInLastGeneration" = COALESCE(
        ui."lastSeenGenerationId" >= (
          SELECT cfs."fetchCompletedGeneration"
          FROM "CardFamilyStats" cfs
          WHERE cfs."cardFamilyId" = ui."cardFamilyId"
          AND cfs."faction" = ui."faction"
          FOR SHARE
        ),
        -- Default to true if we didn't get this from a family -- currently because it's a card from BISE
        true
      );
      `
  )
  */
}


export class ExhaustiveInSaleCrawler extends GenericIndexer<CardFamilyRequest, CardFamilyCardsData, MarketUpdateCrawlerStats> {
  constructor(private _options: {
    pageSize: number,
    userAgent?: string,
  } = { pageSize: 30 }) {

    const initialCrawlerStats: MarketUpdateCrawlerStats = {
      newCardsAdded: 0,
      totalPagesLoaded: 0,
      totalOffersUpdated: 0,
    }

    super(initialCrawlerStats, throttlingConfig["market"]);
  }

  private get userAgent(): string | undefined {
    return this._options.userAgent;
  }
  private get pageSize(): number {
    return this._options.pageSize;
  }

  public override async fetch(request: CardFamilyRequest): Promise<CardFamilyCardsData> {
    if (request.pageNumber == 1) {
      this.cardFamilyStatsRecordFetchStart(request);
    }
    let url = this.buildUrl(request)
    
    const headers = {
      accept: "application/ld+json",
    }
    if (this.userAgent) {
      headers["User-Agent"] = this.userAgent;
    }
    const response = await fetch(url, { method: "GET", headers });
    if (!response.ok) {
      if (response.status == 429) {
        console.error(`Rate limit exceeded for ${url}`)
        throw new TooManyRequestsError(`Rate limit exceeded for ${url}`)
      }
      console.error(`Error fetching ${url}: ${response.status} ${response.statusText}`)
      throw new Error(`Error fetching ${url}: ${response.status} ${response.statusText}`)
    }
    return response.json() as Promise<CardFamilyCardsData>;
  };

  public override async persist(response: CardFamilyCardsData, request: CardFamilyRequest) {
    try {
      const itemsCount = response["hydra:member"].length;
      const totalItems = response["hydra:totalItems"];
      const totalLoaded = (request.pageNumber - 1) * this.pageSize + itemsCount;
      console.log(`Family=${request.name} (${request.cardFamilyId}) Faction=${request.faction} : ${request.pageNumber} -> ${itemsCount} (${totalLoaded}/${totalItems}) items`)
    } catch (e) {
      console.error(`Error parsing hydra:view for Family=${request.name} Faction=${request.faction} Page=${request.pageNumber}`, e)

      console.log("Raw response:", response)
      throw e;
    }

    // Upsert the card blobs into the database
    let addedCount = 0;
    for (const cardBlob of response["hydra:member"]) {
      try {
        const wasCreated = await recordOneUnique(cardBlob, request.fetchGenerationId, prisma);
        if (wasCreated) {
          addedCount += 1;
        }
      } catch (e) {
        // If there was an error recording the unique, we skip it and continue with the others
        continue;
      }
    }
    this.statsPagesLoadedIncrement(1);
    this.statsCardAddedIncrement(addedCount);
    this.statsOffersUpdatedIncrement(response["hydra:member"].length);

    if (request.pageNumber < (response["hydra:totalItems"] / this.pageSize)) {
      await this.addRequests([
        {
          ...request,
          pageNumber: request.pageNumber + 1,
        }
      ], true)
    } else {
      const totalItems = response["hydra:totalItems"]
      await this.cardFamilyStatsRecordFetchComplete(request, totalItems)
    }
  }

  public async addAllWithFilter(fetchGenerationId: number, filter: ((card: CardDbEntry) => boolean) | undefined = undefined) {
    const cardsDb = cardsJson as unknown as Record<string, CardDbEntry>

    let requests: CardFamilyRequest[] = []
    for (const cardKey in cardsDb) {
      const card = cardsDb[cardKey];
      if (card.type == CardType.CHARACTER && card.rarity == Rarity.RARE) {
        if (filter && !filter(card)) { continue }
        requests.push({
          fetchGenerationId: fetchGenerationId,
          name: card.name.en,
          faction: card.mainFaction,
          cardFamilyId: getFamilyIdFromRef(card.id),
          pageNumber: 1
        })
      }
    }

    // Remove duplicates
    const requestsArray = unique(requests, (r) => `${r.cardFamilyId}-${r.faction}`);
    this.addRequests(requestsArray)
  }

  private statsCardAddedIncrement(by: number) {
    this.completionValue = {
      ...this.completionValue,
      newCardsAdded: this.completionValue.newCardsAdded + by,
    }
  }
  private statsOffersUpdatedIncrement(by: number) {
    this.completionValue = {
      ...this.completionValue,
      totalOffersUpdated: this.completionValue.totalOffersUpdated + by,
    }
  }
  private statsPagesLoadedIncrement(by: number) {
    this.completionValue = {
      ...this.completionValue,
      totalPagesLoaded: this.completionValue.totalPagesLoaded + by,
    }
  }

  private buildUrl(request: CardFamilyRequest) {
    const url = new URL("https://api.altered.gg/public/cards")
    url.searchParams.set("factions[]", request.faction)
    url.searchParams.set("query", `"${request.name}"`)
    url.searchParams.set("inSale", "true")
    url.searchParams.set("rarity[]", "UNIQUE")
    url.searchParams.set("itemsPerPage", this.pageSize.toString())
    url.searchParams.set("locale", "en-us")
    url.searchParams.set("page", request.pageNumber.toString())

    const urlString = url.toString()
    if (verboseLevel >= 3) {
      console.log("Next URL=", urlString)
    }

    return urlString
  }

  private async cardFamilyStatsRecordFetchStart(request: CardFamilyRequest) {
    const blob = {
      fetchStartedAt: new Date(),
      fetchStartGeneration: request.fetchGenerationId,
    }
    await prisma.cardFamilyStats.upsert({
      where: {
        cardFamilyId_faction: {
          cardFamilyId: request.cardFamilyId,
          faction: request.faction,
        },
      },
      update: blob,
      create: {
        name: request.name,
        cardFamilyId: request.cardFamilyId,
        faction: request.faction,
        ...blob,
      },
    })
  }

  private async cardFamilyStatsRecordFetchComplete(request: CardFamilyRequest, totalItems: number) {
    try {
      // This throw is caught within this method, so we don't interrupt the crawler for stats errors
      const cardFamilyStats = await prisma.cardFamilyStats.findUniqueOrThrow({
        where: {
          cardFamilyId_faction: {
            cardFamilyId: request.cardFamilyId,
            faction: request.faction,
          },
        }
      })
      const blob = {
        fetchCompletedAt: new Date(),
        fetchCompletedGeneration: request.fetchGenerationId,
        totalItems: totalItems,
      }
      await prisma.cardFamilyStats.update({
        where: { id: cardFamilyStats.id },
        data: blob,
      })
    } catch (err) {
      console.error("Error in cardFamilyStatsRecordFetchComplete: ", err)
    }
  }
}

// This builds a card blob from the `/cards` endpoint
function buildCardBlobWithStats(member: CardFamilyCardsData["hydra:member"][0], request: CardFamilyRequest): UniqueInfoCreateInput {
  return {
    ref: member.reference,
    faction: member.mainFaction.reference,
    nameEn: member.name,
    imageUrlEn: member.imagePath,
    cardSet: member.cardSet.reference,
    cardSubTypes: member.cardSubTypes.map(subtype => subtype.reference),
    mainEffectEn: member.mainEffect,
    echoEffectEn: member.echoEffect,
    mainCost: parseInt(member.elements.MAIN_COST),
    recallCost: parseInt(member.elements.RECALL_COST),
    oceanPower: parseInt(member.elements.OCEAN_POWER),
    mountainPower: parseInt(member.elements.MOUNTAIN_POWER),
    forestPower: parseInt(member.elements.FOREST_POWER),
  }
}

