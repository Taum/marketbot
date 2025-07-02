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
  echoAbilities?: DisplayAbilityOnCard[];
}
export interface DisplayAbilityOnCard {
  lineNumber: number;
  isSupport: boolean;
  text: string;
  parts: DisplayPartOnCard[];
}

export interface DisplayPartOnCard {
  partId: number;
  partType: AbilityPartType;
  // isSupport: boolean;
  startIndex: number;
  endIndex: number;
  substituteText?: string;
}

export enum AbilityPartType {
  Trigger = "Trigger",
  Condition = "Condition",
  Effect = "Effect",
  ExtraEffect = "ExtraEffect",
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

export const titleForCardSet = (set: CardSet, locale: string) => {
  if (locale === "en") {
    switch (set) {
      case CardSet.Core: return "Beyond the Gates";
      case CardSet.Alize: return "Trial by Frost";
      case CardSet.Bise: return "Whispers from the Maze";
    }
  } else if (locale === "fr") {
    switch (set) {
      case CardSet.Core: return "Au-delà des portes";
      case CardSet.Alize: return "L'Épreuve du froid";
      case CardSet.Bise: return "Murmures du Labyrinthe";
    }
  }
}

export enum CardSubType {
  Adventurer = "ADVENTURER",
  Animal = "ANIMAL",
  Apprentice = "APPRENTICE",
  Artist = "ARTIST",
  Bureaucrat = "BUREAUCRAT",
  Citizen = "CITIZEN",
  Deity = "DEITY",
  Dragon = "DRAGON",
  Druid = "DRUID",
  Elemental = "ELEMENTAL",
  Engineer = "ENGINEER",
  Fairy = "FAIRY",
  Leviathan = "LEVIATHAN",
  Mage = "MAGE",
  Messenger = "MESSENGER",
  Noble = "NOBLE",
  Plant = "PLANT",
  Robot = "ROBOT",
  Scholar = "SCHOLAR",
  Soldier = "SOLDIER",
  Spirit = "SPIRIT",
  Titan = "TITAN",
  Trainer = "TRAINER",
}

export const allCardSubTypes = Object.values(CardSubType).map(subType => ({
  label: subType.charAt(0).toUpperCase() + subType.slice(1).toLowerCase(),
  value: subType,
}))