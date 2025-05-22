export interface DisplayUniqueCard {
  ref: string;
  name: string;
  faction: Faction;
  cardSet: string;
  imageUrl: string;
  mainEffect: string | null;
  echoEffect: string | null;
  lastSeenInSaleAt?: string;
  lastSeenInSalePrice?: string;
  mainAbilities?: DisplayAbilityOnCard[];
}
export interface DisplayAbilityOnCard {
  index: number;
  text: string;
  parts: DisplayAbilityPartOnCard[];
}

export interface DisplayAbilityPartOnCard {
  id: number;
  partType: string;
  isSupport: boolean;
  startIndex: number;
  endIndex: number;
}

export enum AbilityPartType {
  Trigger = "Trigger",
  Condition = "Condition",
  Effect = "Effect",
}

export enum Faction {
  Axiom = "AX",
  Bravos = "BR",
  Lyra = "LY",
  Muna = "MU",
  Ordis = "OR",
  Yzmir = "YZ",
  Neutral = "NE",
}

export enum CardSet {
  Core = "CORE",
  Alize = "ALIZE",
  Bise = "BISE",
}
