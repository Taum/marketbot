import fs from 'fs';
import { CardDbEntry, CardElements, LocalizedString, Rarity, CardType, Faction, CardSet } from '../common/models/cards';

const inputPaths = [
  {path: 'data/raw/raw_card_details_en_ALIZE.json', set: CardSet.ALIZE},
  {path: 'data/raw/raw_card_details_en_BISE.json', set: CardSet.BISE},
  {path: 'data/raw/raw_card_details_en_CORE.json', set: CardSet.CORE},
  {path: 'data/raw/raw_card_details_en_COREKS.json', set: CardSet.CORE},
  {path: 'data/raw/raw_card_details_en_TCS3.json', set: CardSet.BISE},
  {path: 'data/raw/raw_card_details_en_WCQ25.json', set: CardSet.CORE},
  {path: 'data/raw/raw_card_details_en_WCS25.json', set: CardSet.CORE},
  {path: 'data/raw/raw_card_details_en_CYCLONE.json', set: CardSet.CYCLONE},
];
const outputPath = 'data/cards_min.json';

// Read the input file

interface RawCard {
  reference: string;
  name: string;
  imagePath: string;
  elements: CardElements;
  assets: { WEB: string[], HERO_THUMB?: string[] };
  allImagePath: {
    "en-us": string;
    "fr-fr": string;
  };
  mainFaction: {
    reference: Faction;
  };
  rarity: {
    reference: Rarity;
  };
  cardType: {
    reference: CardType;
  }
  cardSubTypes: {
    reference: string;
  }[];
}

const minimalCardTransform = (card: RawCard): Omit<CardDbEntry, '_meta'> => {
  return {
    id: card.reference,
    name: { en: card.name },
    imagePath: { en: card.allImagePath["en-us"], fr: card.allImagePath["fr-fr"] },
    elements: minElements(card.elements),
    assets: card.assets,
    mainFaction: card.mainFaction.reference,
    rarity: card.rarity.reference,
    type: fixType(card.cardType.reference),
    subTypes: card.cardSubTypes.map((subType) => subType.reference),
  };
}

const minElements = (elements: CardElements) => {
  return {
    MAIN_COST: elements.MAIN_COST,
    RECALL_COST: elements.RECALL_COST,
    OCEAN_POWER: elements.OCEAN_POWER,
    MOUNTAIN_POWER: elements.MOUNTAIN_POWER,
    FOREST_POWER: elements.FOREST_POWER,
    MAIN_EFFECT: null,
    ECHO_EFFECT: null,
  };
};

const fixType = (type: CardType) => {
  if ((type as string) == "PERMANENT") {
    return CardType.LANDMARK_PERMANENT;
  }
  return type;
}

let outputData: Record<string, CardDbEntry> = {};

const biseCardIds: string[] = [];

for (const inputPath of inputPaths) {
  const rawData = fs.readFileSync(inputPath.path, 'utf8');
  const cardsData = JSON.parse(rawData) as RawCard[];

  for (const card of cardsData) {
    const typedCard = minimalCardTransform(card);
    if (inputPath.set == CardSet.BISE) {
      biseCardIds.push(card.reference);
    }
    outputData[typedCard.id] = {
      ...typedCard,
      _meta: { set: inputPath.set }
    };
  }
}

biseCardIds.sort();
for (const cardId of biseCardIds) {
  console.log(cardId);
}


// Write the output file
fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

console.log('Minimized card data has been written to cards_min.json');
