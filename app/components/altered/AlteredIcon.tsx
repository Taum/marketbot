import { CardSet, Faction as ModelFaction, titleForCardSet } from "~/models/cards";
import { FC } from "react";
import { cn } from "~/lib/utils";
import "./altered-icons.css"


export enum AlteredIconType {
  Cost0 = "cost-0",
  Cost1 = "cost-1",
  Cost2 = "cost-2",
  Cost3 = "cost-3",
  Cost4 = "cost-4",
  Cost5 = "cost-5",
  Cost6 = "cost-6",
  Cost7 = "cost-7",
  Cost8 = "cost-8",
  Cost9 = "cost-9",
  Support = "support",
  Reserve = "reserve",
  Exhaust = "exhaust",
  X = "x",
  Sleeping = "sleeping",
  BGA = "bga",
  Fleeting = "fleeting",
  Hand = "hand",
  Anchored = "anchored",
  Infinite = "infinite",
  Forest = "forest",
  Mountain = "mountain",
  Ocean = "ocean",
  Axiom = "ax",
  Bravos = "br",
  Lyra = "ly",
  Muna = "mu",
  Ordis = "or",
  Yzmir = "yz",

  Brush = "brush",
  Tumult = "tumult",
  BTG = "btg",
  ETB = "etb",
  Separator = "separator",
  Card = "card",
  Swirl = "swirl",
  BGG = "bgg",
  BoosterPack = "booster-pack",
  Collection = "collection",
  DisplayBox = "display-box",
  BTG2 = "btg-2",
  Kickstarter = "kickstarter",
  Gamegenic = "gamegenic",
  KSSet = "ks-set",
  Mobile = "mobile",
  Deck = "deck",
}

export interface AlteredIconProps {
  icon: AlteredIconType;
  className?: string;
}
export type FactionIconProps = {
  faction: ModelFaction,
  className?: string
};

export const AlteredIcon: FC<AlteredIconProps> = ({ icon, className }: AlteredIconProps) => {
  return <i className={cn("altered-icon", icon, className)} />;
}

export const FactionIcon: FC<FactionIconProps> = ({ faction, className }: { faction: ModelFaction, className?: string }) => {
  let f = faction
  return <i className={cn("altered-icon", f.toLowerCase(), `--color-${f.toLowerCase()}`, className)} />;
}


export interface CardSetSymbolProps {
  set: CardSet,
  className?: string
  size?: "sm" | "md" | "lg"
  style?: React.CSSProperties
}

export const CardSetSymbol: FC<CardSetSymbolProps> = ({ set, className, size = "md", style }: CardSetSymbolProps) => {
  const lcase = set.toLowerCase()
  const baseStyles = "inline"
  let sizeClass = ""
  const title = titleForCardSet(set, "en")

  switch (size) {
    case "sm": sizeClass = "w-4 h-4"; break;
    case "md": sizeClass = "w-6 h-6"; break;
    case "lg": sizeClass = "w-8 h-8"; break;
  }
  // return <img src={`/assets/set-icons/${lcase}.svg`} alt={set} className={cn(baseStyles, sizeClass, className)} style={style} />;
  return <svg className={cn(baseStyles, sizeClass, className)} style={style}>
    <title>{title}</title>
    <use href={`/assets/set-icons/group_v3.svg#${lcase}`} />
  </svg>
}

