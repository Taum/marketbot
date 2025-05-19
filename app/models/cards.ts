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