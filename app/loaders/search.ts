import prisma from "@common/utils/prisma.server.js";
import { DisplayUniqueCard, Faction } from "~/models/cards";
import { AbilityPartType, Prisma } from '@prisma/client';

// Add the type from Prisma namespace
type UniqueInfoWhereInput = Prisma.UniqueInfoWhereInput;
type MainUniqueAbilityWhereInput = Prisma.MainUniqueAbilityWhereInput;

export interface SearchQuery {
  faction?: string;
  characterName?: string;
  mainEffect?: string;
  triggerPart?: string;
  conditionPart?: string;
  effectPart?: string;
}

export interface PageParams {
  page: number;
  includePagination: boolean;
}

interface Token {
  text: string
  negated: boolean
}


function tokenize(text: string): Token[] {
  const quotedRegex = /(-?)(?:"([^"]+)"|(\S+))/g;
  let match;
  const tokens: Token[] = [];

  while ((match = quotedRegex.exec(text)) !== null) {
    // match[1] contains text inside quotes, match[2] contains unquoted text
    tokens.push({ text: match[2] || match[3], negated: match[1] === "-" });
  }
  return tokens;
}

function searchInPart(partType: AbilityPartType, query?: string): MainUniqueAbilityWhereInput[] {
  if (!query) {
    return []
  }

  const tokens = tokenize(query);
  console.log(`Tokens for ${partType}`)
  console.dir(tokens);

  let partTypeKey: keyof MainUniqueAbilityWhereInput
  switch (partType) {
    case AbilityPartType.Trigger:
      partTypeKey = "trigger"
      break
    case AbilityPartType.TriggerCondition:
      partTypeKey = "triggerCondition"
      break
    case AbilityPartType.Condition:
      partTypeKey = "condition"
      break
    case AbilityPartType.Effect:
      partTypeKey = "effect"
      break
    default:
      throw new Error(`Unknown part type: ${partType}`)
  }

  return [{
    [partTypeKey]: {
      AND: tokens.map((token) => (
        token.negated ?
          {
            NOT: { textEn: { contains: token.text, mode: "insensitive" } }
          } :
          {
            textEn: { contains: token.text, mode: "insensitive" }
          }
      ))
    }
  }]
}

const PAGE_SIZE = 100

export interface SearchResults {
  results: DisplayUniqueCard[],
  pagination?: {
    totalCount: number,
    pageCount: number
  }
}

export async function search(searchQuery: SearchQuery, pageParams: PageParams): Promise<SearchResults> {
  const { faction, characterName, mainEffect, triggerPart, conditionPart, effectPart } = searchQuery
  const { page, includePagination } = pageParams

  if (faction == null && characterName == null && mainEffect == null && triggerPart == null && conditionPart == null && effectPart == null) {
    return { results: [], pagination: undefined }
  }

  let searchParams: UniqueInfoWhereInput[] = []

  if (faction != null) {
    searchParams.push({
      faction: {
        equals: faction
      }
    })
  }

  if (characterName != null) {
    searchParams.push({
      nameEn: {
        contains: characterName,
        mode: "insensitive"
      }
    })
  }

  if (mainEffect != null) {
    const tokens = tokenize(mainEffect);
    console.log("Main effect Tokens: ", tokens);
    searchParams = searchParams.concat(tokens.map((token) => {
      if (token.negated) {
        return {
          NOT: { mainEffectEn: { contains: token.text, mode: "insensitive" } }
        }
      }
      return {
        mainEffectEn: { contains: token.text, mode: "insensitive" },
      }
    }))
  }

  const mainAbilitySearchParams = [
    ...searchInPart(AbilityPartType.Trigger, triggerPart),
    ...searchInPart(AbilityPartType.Condition, conditionPart),
    ...searchInPart(AbilityPartType.Effect, effectPart),
  ]
  if (mainAbilitySearchParams.length > 0) {
    searchParams.push({
      mainAbilities: {
        some: {
          AND: mainAbilitySearchParams
        }
      }
    })
  }

  const whereClause: UniqueInfoWhereInput = {
    AND: [
      { fetchedDetails: true },
      ...searchParams,
    ]
  }

  console.dir(whereClause, { depth: null });

  const results = await prisma.uniqueInfo.findMany({
    where: whereClause,
    orderBy: {
      lastSeenInSalePrice: 'asc'
    },
    skip: PAGE_SIZE * (page - 1), // Page is 1-indexed
    take: PAGE_SIZE,
  });

  let pagination: { totalCount: number, pageCount: number } | undefined = undefined
  if (includePagination) {
    const totalCount = await prisma.uniqueInfo.count({
      where: whereClause,
    })
    pagination = {
      totalCount: totalCount,
      pageCount: Math.ceil(totalCount / PAGE_SIZE)
    }
  }

  const outResults: DisplayUniqueCard[] = results.map((result) => {
    if (!result.nameEn || !result.faction || !result.mainEffectEn) {
      return null;
    }
    return {
      ref: result.ref,
      name: result.nameEn,
      faction: result.faction as Faction,
      cardSet: result.cardSet!,
      imageUrl: result.imageUrlEn!,
      mainEffect: result.mainEffectEn,
      echoEffect: result.echoEffectEn,
      lastSeenInSaleAt: result.lastSeenInSaleAt?.toISOString(),
      lastSeenInSalePrice: result.lastSeenInSalePrice?.toString(),
    }
  }).filter((result) => result !== null);

  return { results: outResults, pagination };
}

