
export type CardRef = string
export enum Faction {
  Axiom = "AX",
  Bravos = "BR",
  Lyra = "LY",
  Muna = "MU",
  Ordis = "OR",
  Yzmir = "YZ",
  Neutral = "NE",
}
export enum Rarity {
  COMMON = "COMMON",
  RARE = "RARE",
  UNIQUE = "UNIQUE",
}
export enum CardType {
  SPELL = "SPELL",
  CHARACTER = "CHARACTER",
  EXPEDITION_PERMANENT = "EXPEDITION_PERMANENT",
  LANDMARK_PERMANENT = "LANDMARK_PERMANENT",
  HERO = "HERO",
  TOKEN = "TOKEN",
}
export interface LocalizedString {
  en: string
  fr?: string
}
export interface CardElements {
  MAIN_COST: string | null
  RECALL_COST: string | null
  OCEAN_POWER: string | null
  MOUNTAIN_POWER: string | null
  FOREST_POWER: string | null
  MAIN_EFFECT: string | null
  ECHO_EFFECT: string | null
}
export interface CardAssets {
  WEB: Array<string>
  HERO_THUMB?: Array<string>
}
// This explicitly excludes "COREKS" because we want to merge it with "CORE".
export enum CardSet {
  CORE = "CORE",
  COREKS = "COREKS",
  ALIZE = "ALIZE",
  BISE = "BISE",
}
export interface CardMeta {
  set: CardSet
}

// Raw data from the altered.gg API
export interface AlteredggCard {
  reference: string;
  rarity: {
    reference: Rarity;
  };
  cardType: {
    reference: CardType;
  };
  cardSubTypes: {
    reference: string;
  }[];
  imagePath: string;
  allImagePath: { [key: string]: string };
  name: string;
  mainFaction: {
    reference: Faction,
  }
  cardSet: {
    reference: CardSet,
  }
  elements: {
    MAIN_COST: string;
    RECALL_COST: string;
    OCEAN_POWER: string;
    MOUNTAIN_POWER: string;
    FOREST_POWER: string;
    MAIN_EFFECT: string;
    ECHO_EFFECT: string;
  };
  assets: {
    WEB: string[];
    HERO_WIDE?: string[];
    HERO_THUMB?: string[];
  }
};

export interface CardDbEntry {
  id: string
  name: LocalizedString
  imagePath: LocalizedString
  mainFaction: Faction
  elements: CardElements
  assets: CardAssets
  rarity: Rarity
  type: CardType
  subTypes: string[]
  _meta: CardMeta
}
