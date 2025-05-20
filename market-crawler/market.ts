import { CardSet, CardType, Faction, Rarity } from "@common/models/cards.js";
import { CardDbEntry } from "@common/models/cards.js";
import { GenericIndexer } from "./generic-indexer.js";
import { Prisma } from '@prisma/client';
import prisma from "@common/utils/prisma.server.js";

import { unique } from 'radash';

import cardsJson from "@data/cards_min.json" assert { type: "json" };
import Decimal from "decimal.js";
import { AuthTokenService } from "./refresh-token.js";
import { getFamilyIdFromRef } from "@common/utils/altered.js";
import { throttlingConfig } from "./config.js";


// Add the type from Prisma namespace
type UniqueInfoCreateInput = Prisma.UniqueInfoCreateInput;
export interface CardFamilyRequest {
  fetchGenerationId: number;
  name: string;
  faction: string;
  cardFamilyId: string;
  nextPage?: string;
}

export interface HydraResponse {
  "hydra:totalItems": number;
  "hydra:view": {
    "@id": string;
    "hydra:next": string;
  };
}

// interface for the `/cards` endpoint -- not used currently
export interface CardFamilyCardsData extends HydraResponse {
  "hydra:member": {
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
    name: string;
    elements: {
      MAIN_COST: string;
      RECALL_COST: string;
      MOUNTAIN_POWER: string;
      OCEAN_POWER: string;
      FOREST_POWER: string;
    }
  }[];
}

// interface for the `/cards/stats` endpoint
export interface CardFamilyStatsData extends HydraResponse {
  "hydra:member": {
    "@id": string,
    lowerPrice: number,
    lowerOfferId: string,
  }[];
}

export interface MarketUpdateCrawlerStats {
  totalOffersUpdated: number;
  newCardsAdded: number;
}

const bannedWords = [
  'Lyra', 'Ordis', 'Yzmir', 'Muna', 'Axiom', 'Bravos',
  'The', 'of',
  'Haven', 'Foundry'
]

export async function getNextFetchGenerationId(): Promise<number> {
  const marketUpdateStats = await prisma.marketUpdateStats.findFirst({
    orderBy: {
      generationId: 'desc',
    },
  })
  if (!marketUpdateStats) {
    return 1;
  }
  return marketUpdateStats.generationId + 1;
}

export async function marketUpdateStatsStart(generationId: number): Promise<void> {
  await prisma.marketUpdateStats.create({
    data: {
      generationId: generationId,
      updateStartedAt: new Date(),
    },
  })
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


export class ExhaustiveInSaleCrawler extends GenericIndexer<CardFamilyRequest, CardFamilyStatsData, Response, MarketUpdateCrawlerStats> {

  constructor(authTokenService: AuthTokenService) {
    // Create fetch and persist functions
    const fetchPage = async (request: CardFamilyRequest) => {
      let url: string;
      if (request.nextPage) {
        url = "https://api.altered.gg" + request.nextPage;
      } else {
        url = this.buildUrl(request);
        this.cardFamilyStatsRecordFetchStart(request);
      }

      const headers = await authTokenService.getAuthorizationHeaders()
      const response = await fetch(url, { headers });
      return response;
    };

    const persistPage = async (response: Response, request: CardFamilyRequest) => {
      const data = await response.json() as CardFamilyStatsData;
      try {
        const pageNumber = data["hydra:view"]["@id"].match(/page=\d+$/)?.[0];
        // const pageNumber = data["hydra:view"]["@id"].match(/page=\d+$/)?.[0];
        console.log(`Family=${request.name} Faction=${request.faction} : ${pageNumber} -> ${data["hydra:member"].length} items`)
      } catch (e) {
        console.error(`Error parsing hydra:view for Family=${request.name} Faction=${request.faction}`, e)
        console.log("Raw response:", data)
        throw e;
      }

      await prisma.$transaction(async (tx) => {
        let i = 0
        for (const member of data["hydra:member"]) {
          let cardBlob = buildCardBlobWithStats(member, request);
          cardBlob.lastSeenInSaleAt = new Date();
          cardBlob.lastSeenGenerationId = request.fetchGenerationId
          const updatedOrCreated = await tx.uniqueInfo.upsert({
            where: {
              ref: cardBlob.ref,
            },
            update: cardBlob,
            create: {
              ...cardBlob,
              firstSeenGenerationId: request.fetchGenerationId,
            },
          })
          if (updatedOrCreated.firstSeenGenerationId == request.fetchGenerationId) {
            this.statsCardAddedIncrement();
          }
          i += 1
        }

        this.statsOffersUpdatedIncrement(i);
      })


      const nextPath = data["hydra:view"]["hydra:next"];
      if (nextPath) {
        await this.addRequests([
          {
            fetchGenerationId: request.fetchGenerationId,
            name: request.name,
            faction: request.faction,
            cardFamilyId: request.cardFamilyId,
            nextPage: nextPath,
          }
        ], true)
      } else {
        const totalItems = data["hydra:totalItems"]
        await this.cardFamilyStatsRecordFetchComplete(request, totalItems)
      }
    }

    const initialCrawlerStats: MarketUpdateCrawlerStats = {
      totalOffersUpdated: 0,
      newCardsAdded: 0,
    }

    // Call super with the fetch and persist functions, plus any options
    super(fetchPage, persistPage, initialCrawlerStats, throttlingConfig["market"]);
  }

  public async addAllWithFilter(fetchGenerationId: number, filter: ((card: CardDbEntry) => boolean) | null = null) {
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
        })
      }
    }
    const requestsArray = unique(requests, (r) => `${r.cardFamilyId}-${r.faction}`);
    this.addRequests(requestsArray)
  }

  private statsCardAddedIncrement() {
    this.completionValue = {
      ...this.completionValue,
      newCardsAdded: this.completionValue.newCardsAdded + 1,
    }
  }
  private statsOffersUpdatedIncrement(by: number) {
    this.completionValue = {
      ...this.completionValue,
      totalOffersUpdated: this.completionValue.totalOffersUpdated + by,
    }
  }

  private buildUrl(request: CardFamilyRequest) {
    let strippedName = request.name.toLowerCase();
    for (const word of bannedWords) {
      strippedName = strippedName.replace(new RegExp(`\\b${word}\\b`, "i"), '');
    }
    if (strippedName != request.name.toLowerCase()) {
      console.debug(`Stripped name from ${request.name} -> ${strippedName}`)
    }
    const urlSafeName = encodeURIComponent(strippedName.trim());

    return `https://api.altered.gg/cards/stats?factions%5B%5D=${request.faction}&inSale=true&translations.name=${urlSafeName}&rarity%5B%5D=UNIQUE&itemsPerPage=36&locale=en-us`;
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

// This builds a partial card blob from the `/cards` endpoint.
// (not used currently)
function buildCardBlob(member: CardFamilyCardsData["hydra:member"][0]): UniqueInfoCreateInput {
  return {
    ref: member.reference,
    faction: member.mainFaction.reference,
    nameEn: member.name,
    imageUrlEn: member.imagePath,
    cardSet: member.cardSet.reference,
    mainCost: parseInt(member.elements.MAIN_COST),
    recallCost: parseInt(member.elements.RECALL_COST),
    oceanPower: parseInt(member.elements.OCEAN_POWER),
    mountainPower: parseInt(member.elements.MOUNTAIN_POWER),
    forestPower: parseInt(member.elements.FOREST_POWER),
  }
}

// This builds a partial card blob from the `/cards/stats` endpoint, which includes the lowest price
// but not other card details such as cost, terrain power, etc.
function buildCardBlobWithStats(member: CardFamilyStatsData["hydra:member"][0], request: CardFamilyRequest): UniqueInfoCreateInput {
  return {
    ref: member["@id"].replace("/cards/", ""),
    lastSeenInSalePrice: new Decimal(member.lowerPrice).toFixed(2),
    lastSeenInSaleAt: new Date(),
    faction: request.faction,
    cardFamilyId: request.cardFamilyId,
  }
}

