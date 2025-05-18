import { GenericIndexer } from "./generic-indexer.js";
import { AlteredggCard } from "@common/models/cards.js";
import prisma from "@common/utils/prisma.server.js";

export interface UniqueRequest {
  id: string;
}

export interface UniqueData {
  card: AlteredggCard;
}

export class UniquesCrawler extends GenericIndexer<UniqueRequest, UniqueData> {
  constructor() {
    // Create fetch and persist functions
    const fetchUnique = async (request: UniqueRequest) => {
      const response = await fetch(`https://api.altered.gg/cards/${request.id}`);
      const card = await response.json();
      return { card };
    };

    const persistUnique = async (data: UniqueData, _request: UniqueRequest) => {
      const cardData = data.card;
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
      }

      try {
        await prisma.uniqueInfo.upsert({
          where: { ref: blob.ref },
          update: blob,
          create: blob,
        });
        console.debug(`Recorded unique ${blob.ref} (${blob.nameEn})`);
      } catch (error) {
        console.error(`Error recording unique ${blob.ref} (${blob.nameEn}): ${error}`);
      }
    };

    // Call super with the fetch and persist functions, plus any options
    super(fetchUnique, persistUnique, { maxOperationsPerWindow: 10, windowMs: 5000 });
  }


  public async enqueueUniquesWithMissingEffects() {
    const uniques = await prisma.uniqueInfo.findMany({
      where: {
        fetchedDetails: false,
      },
      orderBy: {
        lastSeenInSaleAt: 'desc', 
      },
      take: 1000,
    });

    for (const unique of uniques) {
      await this.addRequests([{ id: unique.ref }]);
    }
  }
}
