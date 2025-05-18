import { CardSet, CardType, Faction, Rarity } from "@common/models/cards.js";
import { CardDbEntry } from "@common/models/cards.js";
import { GenericIndexer } from "./generic-indexer.js";
import prisma from "@common/utils/prisma.server.js";
import { unique } from 'radash';

import cardsJson from "@data/cards_min.json" assert { type: "json" };
import { UniqueInfo } from "@generated/prisma/client/index.js";


export interface CardFamilyRequest {
  name: string;
  faction: string;
  nextPage?: string;
}

export interface CardFamilyStatsData {
  "hydra:totalItems": number;
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
  "hydra:view": {
    "@id": string;
    "hydra:next": string;
  };
}

const bannedWords = [
  'Lyra', 'Ordis', 'Yzmir', 'Muna', 'Axiom', 'Bravos',
  'The', 'of',
  'Haven', 'Foundry'
]

export class CardFamilyStatsCrawler extends GenericIndexer<CardFamilyRequest, CardFamilyStatsData> {
  constructor(authToken: string) {
    // Create fetch and persist functions
    const fetchFunc = async (request: CardFamilyRequest) => {
      const url = this.buildUrl(request)

      const headers = {
        'Authorization': `Bearer ${authToken}`
      }
      const response = await fetch(url, {
        headers
      });
      const json = await response.json() as CardFamilyStatsData;
      return json;
    };

    const persistFunc = async (data: CardFamilyStatsData, request: CardFamilyRequest) => {
      console.log(" ==> ", request)
      console.log("Total Items: ", data["hydra:totalItems"]);
      if (data["hydra:totalItems"] >= 1000) {
        console.warn("$$$$$$$ Total items is greater than 1000 $$$$$$$")
      }

      const blob = {
        name: request.name,
        faction: request.faction,
        totalItems: data["hydra:totalItems"],
      }

      const previous = await prisma.cardFamilyStats.findFirst({
        where: {
          name: request.name,
          faction: request.faction,
        }
      })
      if (previous) {
        await prisma.cardFamilyStats.update({
          where: { id: previous.id },
          data: blob,
        })
      } else {
        await prisma.cardFamilyStats.create({
          data: blob,
        })
      }
    };

    // Call super with the fetch and persist functions, plus any options
    super(fetchFunc, persistFunc, { maxOperationsPerWindow: 1, windowMs: 2000 });
  }

  public async addAllNotInDatabase() {
    const cardsDb = cardsJson as unknown as Record<string, CardDbEntry>

    let requests = []
    for (const cardKey in cardsDb) {
      // if (requests.size > 3) break;
      const card = cardsDb[cardKey];
      if (card.type == CardType.CHARACTER && card.rarity == Rarity.RARE) {
        const inDb = await prisma.cardFamilyStats.findFirst({
          where: {
            name: card.name.en,
            faction: card.mainFaction,
          }
        })
        if (!inDb || inDb.totalItems >= 1000 || inDb.totalItems <= 0) {
          requests.push({
            name: card.name.en,
            faction: card.mainFaction,
          })
        }
      }
    }
    const requestsArray = unique(requests, (r) => `${r.name}-${r.faction}`);
    this.addRequests(requestsArray)
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

    return `https://api.altered.gg/cards?factions%5B%5D=${request.faction}&inSale=true&translations.name=${urlSafeName}&rarity%5B%5D=UNIQUE&itemsPerPage=5&locale=en-us`;
  }
}


export class ExhaustiveInSaleCrawler extends GenericIndexer<CardFamilyRequest, CardFamilyStatsData> {
  constructor(authToken: string) {
    // Create fetch and persist functions
    const fetchPage = async (request: CardFamilyRequest) => {
      let url: string;
      if (request.nextPage) {
        url = "https://api.altered.gg" + request.nextPage;
      } else {
        url = this.buildUrl(request);
      }

      const headers = {
        'Authorization': `Bearer ${authToken}`
      }
      const response = await fetch(url, {
        headers
      });
      const json = await response.json() as CardFamilyStatsData;
      return json;
    };

    const persistPage = async (data: CardFamilyStatsData, request: CardFamilyRequest) => {
      const pageNumber = data["hydra:view"]["@id"].match(/page=\d+$/)?.[0];

      console.log(`Family: ${request.name} Page: ${pageNumber} -> ${data["hydra:member"].length} items`)

      await prisma.$transaction(async (tx) => {
        for (const member of data["hydra:member"]) {
          let cardBlob = buildCardBlob(member);
          cardBlob.lastSeenInSaleAt = new Date();
          console.log(`Recording ${cardBlob.ref} (${cardBlob.nameEn})`)
          await tx.uniqueInfo.upsert({
            where: {
              ref: cardBlob.ref,
            },
            update: cardBlob,
            create: cardBlob,
          })
        }
      })

      const nextPath = data["hydra:view"]["hydra:next"];
      if (nextPath) {
        await this.addRequests([
          {
            name: request.name,
            faction: request.faction,
            nextPage: nextPath,
          }
        ])
      }
    }

    // Call super with the fetch and persist functions, plus any options
    super(fetchPage, persistPage, { maxOperationsPerWindow: 1, windowMs: 1000 });
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

    return `https://api.altered.gg/cards?factions%5B%5D=${request.faction}&inSale=true&translations.name=${urlSafeName}&rarity%5B%5D=UNIQUE&itemsPerPage=36&locale=en-us`;
  }
}


function buildCardBlob(member: CardFamilyStatsData["hydra:member"][0]): Partial<UniqueInfo> {
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
