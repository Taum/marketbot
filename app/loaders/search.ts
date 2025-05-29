import prisma from "@common/utils/prisma.server.js";
import { CardSet, DisplayAbilityOnCard, DisplayAbilityPartOnCard, DisplayUniqueCard, Faction } from "~/models/cards";
import { AbilityPartType, MainUniqueAbility, Prisma, UniqueInfo } from '@prisma/client';
import { AbilityCharacterDataV1 } from "@common/models/postprocess";

// Add the type from Prisma namespace
type UniqueInfoWhereInput = Prisma.UniqueInfoWhereInput;
type MainUniqueAbilityWhereInput = Prisma.MainUniqueAbilityWhereInput;
type MainUniqueAbilityPartWhereInput = Prisma.MainUniqueAbilityPartWhereInput;

export interface SearchQuery {
  faction?: string;
  set?: string;
  characterName?: string;
  mainEffect?: string;
  triggerPart?: string;
  conditionPart?: string;
  effectPart?: string;
  mainCosts?: number[];
  recallCosts?: number[];
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
    case AbilityPartType.Condition:
      partTypeKey = "condition"
      break
    case AbilityPartType.Effect:
      const andGroup: MainUniqueAbilityPartWhereInput = {
        AND:
          tokens.map((token) => (
            token.negated ?
              {
                NOT: { textEn: { contains: token.text, mode: "insensitive" } }
              } :
              {
                textEn: { contains: token.text, mode: "insensitive" }
              }
          ))
      }
      return [{
        OR: [
          {
            effect: andGroup
          },
          {
            extraEffectParts: {
              some: andGroup
            }
          }]
      }]
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
  const {
    faction,
    set,
    characterName,
    mainEffect,
    triggerPart,
    conditionPart,
    effectPart,
    mainCosts,
    recallCosts,
  } = searchQuery
  const {
    page,
    includePagination,
  } = pageParams

  if (
    faction == null &&
    set == null &&
    characterName == null &&
    mainEffect == null &&
    triggerPart == null &&
    conditionPart == null &&
    effectPart == null
  ) {
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
    const tokens = tokenize(characterName);
    // Character name should default to a OR, not AND
    // but negation of OR is NAND, so we need to handle that
    const [negatedTokens, normalTokens] = tokens.reduce<[typeof tokens, typeof tokens]>(
      ([neg, norm], token) => {
        return token.negated 
          ? [[...neg, token], norm]
          : [neg, [...norm, token]];
      },
      [[], []]
    );

    // Add negated tokens (AND)
    searchParams = searchParams.concat(
      negatedTokens.map(token => ({
        NOT: { nameEn: { contains: token.text, mode: "insensitive" } }
      }))
    );

    // Add normal tokens (OR)
    if (normalTokens.length > 0) {
      searchParams.push({
        OR: normalTokens.map(token => ({
          nameEn: { contains: token.text, mode: "insensitive" }
        }))
      });
    }
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

  if (mainCosts) {
    if (mainCosts.length == 1) {
      searchParams.push({
        mainCost: {
          equals: mainCosts[0]
        }
      })
    } else {
      searchParams.push({
        mainCost: {
          in: mainCosts
        }
      })
    }
  }

  if (recallCosts) {
    if (recallCosts.length == 1) {
      searchParams.push({
        recallCost: {
          equals: recallCosts[0]
        }
      })
    } else {
      searchParams.push({
        recallCost: {
          in: recallCosts
        }
      })
    }
  }

  if (set != null) {
    if (set == CardSet.Core) {
      searchParams.push({
        cardSet: {
          in: [CardSet.Core, "COREKS"]
        }
      })
    } else {
      searchParams.push({
        cardSet: {
          equals: set
        }
      })
    }
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
    include: {
      mainAbilities: {
        include: {
          trigger: true,
          condition: true,
          effect: true,
          extraEffectParts: true,
        }
      }
    },
    skip: PAGE_SIZE * (page - 1), // Page is 1-indexed
    take: PAGE_SIZE,
  });

  let pagination: { totalCount: number, pageCount: number } | undefined = undefined
  if (includePagination) {
    const totalCount = await prisma.uniqueInfo.count({
      where: whereClause,
    })

    console.log('Total count: ' + totalCount)

    pagination = {
      totalCount: totalCount,
      pageCount: Math.ceil(totalCount / PAGE_SIZE)
    }
  }

  const outResults: DisplayUniqueCard[] = results.map((result) => {
    if (!result.nameEn || !result.faction || !result.mainEffectEn) {
      return null;
    }

    
    let displayAbilities: DisplayAbilityOnCard[] = result.mainAbilities.map((ability) => {
      if (ability.isSupport) {
        return null;
      }
      if (ability.characterData == null) {
        return null;
      }
      const charData = ability.characterData as unknown as AbilityCharacterDataV1;
      const line = ability.textEn
      const displayParts = charData.parts.map((part) => {
        const matchingPart = [ability.trigger, ability.condition, ability.effect, ...ability.extraEffectParts]
          .find((p) => p?.id == part.partId)
        if (matchingPart == null) {
          return null;
        }
        return {
          id: part.partId,
          startIndex: part.startIndex,
          endIndex: part.endIndex,
          partType: matchingPart.partType,
        }
      }).filter((x) => x != null)
      return {
        index: ability.lineNumber,
        text: line,
        parts: displayParts.sort((a, b) => a.startIndex - b.startIndex)
      }
    }).filter((x) => x != null)

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
      mainAbilities: displayAbilities.sort((a, b) => a.index - b.index),
    }
  }).filter((result) => result !== null);

  return { results: outResults, pagination };
}

