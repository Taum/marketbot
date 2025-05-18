export interface DisplayUniqueCard {
  ref: string;
  name: string;
  imageUrl: string;
  mainEffect: string;
  echoEffect: string;
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