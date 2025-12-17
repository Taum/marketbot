import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export const AbilityPartType = {
    Trigger: "Trigger",
    Condition: "Condition",
    Effect: "Effect",
    ExtraEffect: "ExtraEffect"
} as const;
export type AbilityPartType = (typeof AbilityPartType)[keyof typeof AbilityPartType];
export type AbilityPartLink = {
    id: Generated<number>;
    partId: number;
    abilityId: number;
    partType: AbilityPartType;
};
export type AltggSession = {
    id: Generated<number>;
    name: string;
    accessToken: string | null;
    expiresAt: Timestamp | null;
    userId: string | null;
    refreshCookies: unknown | null;
};
export type CardFamilyStats = {
    id: Generated<number>;
    name: string;
    cardFamilyId: string;
    faction: string;
    fetchStartedAt: Timestamp | null;
    fetchCompletedAt: Timestamp | null;
    fetchStartGeneration: number;
    fetchCompletedGeneration: number | null;
    totalItems: number | null;
};
export type MarketUpdateStats = {
    generationId: Generated<number>;
    updateStartedAt: Timestamp;
    updateCompletedAt: Timestamp | null;
    newCardsAdded: number | null;
    totalOffersUpdated: number | null;
    totalPagesLoaded: number | null;
};
export type UniqueAbilityLine = {
    id: Generated<number>;
    uniqueInfoId: number;
    lineNumber: number;
    isSupport: boolean;
    /**
     * @kyselyType(JsonValue)
     */
    characterData: JsonValue | null;
    textEn: Generated<string>;
    textFr: Generated<string>;
};
export type UniqueAbilityPart = {
    id: Generated<number>;
    textEn: Generated<string>;
    textFr: Generated<string>;
    partType: AbilityPartType;
    isSupport: boolean;
};
export type UniqueInfo = {
    id: Generated<number>;
    ref: string;
    faction: string | null;
    cardSet: string | null;
    mainCost: number | null;
    recallCost: number | null;
    oceanPower: number | null;
    mountainPower: number | null;
    forestPower: number | null;
    nameEn: string | null;
    nameFr: string | null;
    imageUrlEn: string | null;
    imageUrlDe: string | null;
    imageUrlEs: string | null;
    imageUrlFr: string | null;
    imageUrlIt: string | null;
    mainEffectEn: string | null;
    echoEffectEn: string | null;
    mainEffectFr: string | null;
    echoEffectFr: string | null;
    cardSubTypes: string[];
    fetchedDetails: Generated<boolean>;
    fetchedDetailsAt: Timestamp | null;
    firstSeenGenerationId: number | null;
    lastSeenGenerationId: number | null;
    lastSeenInSaleAt: Timestamp | null;
    /**
     * @kyselyType(number)
     */
    lastSeenInSalePrice: number | null;
    seenInLastGeneration: Generated<boolean>;
    cardFamilyId: string | null;
};
export type DB = {
    AbilityPartLink: AbilityPartLink;
    AltggSession: AltggSession;
    CardFamilyStats: CardFamilyStats;
    MarketUpdateStats: MarketUpdateStats;
    UniqueAbilityLine: UniqueAbilityLine;
    UniqueAbilityPart: UniqueAbilityPart;
    UniqueInfo: UniqueInfo;
};
