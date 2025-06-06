import prisma from "@common/utils/prisma.server.js";
import { CardSet, DisplayAbilityOnCard, DisplayPartOnCard, DisplayUniqueCard, AbilityPartType, Faction } from "~/models/cards";
import { UniqueAbilityLine, Prisma, UniqueInfo, UniqueAbilityPart, AbilityPartType as DbAbilityPartType, AbilityPartLink } from '@prisma/client';
import { AbilityCharacterDataV1 } from "@common/models/postprocess";
import { db } from "@common/utils/kysely.server";
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres'
import { Decimal } from "decimal.js";
import { Expression, sql } from "kysely";

// Add the type from Prisma namespace
type UniqueInfoWhereInput = Prisma.UniqueInfoWhereInput;

const debug = process.env.DEBUG_WEB == "true"

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
  includeExpiredCards?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export interface PageParams {
  page: number;
  includePagination: boolean;
}

interface Token {
  text: string
  negated: boolean
}

function to_tsvector(expr: Expression<string | null> | string) {
  return sql`to_tsvector('english', COALESCE(${expr}, ''))`
}
function to_tsvector2(expr1: Expression<string | null> | string, expr2: Expression<string | null> | string) {
  return sql`to_tsvector('english', COALESCE(${expr1}, '') || ' ' || COALESCE(${expr2}, ''))`
}
function plainto_tsquery(expr: Expression<string> | string) {
  return sql`plainto_tsquery('english', ${expr})`
}
function phraseto_tsquery(expr: Expression<string> | string) {
  return sql`phraseto_tsquery('english', ${expr})`
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

function searchInPart(partType: DbAbilityPartType, query?: string): Prisma.AbilityPartLinkWhereInput[] {
  if (!query) {
    return []
  }

  const tokens = tokenize(query)
  if (debug) {
    console.log(`Tokens for ${partType}`)
    console.dir(tokens);
  }
  if (tokens.length == 0) {
    return []
  }

  return [{
    part: {
      partType: partType,
      AND: tokens.map((token) => {
        if (token.negated) {
          return {
            NOT: {
              textEn: {
                contains: token.text, mode: "insensitive"
              }
            }
          }
        }
        return {
          textEn: {
            contains: token.text, mode: "insensitive"
          }
        }
      })
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
    includeExpiredCards,
    minPrice,
    maxPrice,
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


  const queryWithLimit = db
    .with('uniques_with_abilities', (db) => {

      let query = db.selectFrom('UniqueAbilityPart')
        .innerJoin('AbilityPartLink', 'UniqueAbilityPart.id', 'AbilityPartLink.partId')
        .innerJoin('UniqueAbilityLine', 'AbilityPartLink.abilityId', 'UniqueAbilityLine.id')
        .innerJoin('UniqueInfo', 'UniqueAbilityLine.uniqueInfoId', 'UniqueInfo.id')

      if (faction != null) {
        query = query.where('faction', '=', faction)
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

        if (normalTokens.length > 0) {
          query = query.where((eb) => eb.or(
            normalTokens.map(token => eb('nameEn', 'ilike', `%${token.text}%`))
          ))
        }
        if (negatedTokens.length > 0) {
          query = query.where((eb) => eb.and(
            negatedTokens.map(token => eb('nameEn', 'not ilike', `%${token.text}%`))
          ))
        }
      }

      if (!includeExpiredCards) {
        query = query.where('seenInLastGeneration', '=', true)
      }

      if (mainCosts && mainCosts.length > 0) {
        query = query.where('mainCost', 'in', mainCosts)
      }
      if (recallCosts && recallCosts.length > 0) {
        query = query.where('recallCost', 'in', recallCosts)
      }

      if (set != null) {
        if (set == CardSet.Core) {
          query = query.where('cardSet', 'in', [CardSet.Core, "COREKS"])
        } else {
          query = query.where('cardSet', '=', set)
        }
      }

      if (mainEffect != null) {
        // const tokens = tokenize(mainEffect);
        // searchParams = searchParams.concat(tokens.map((token) => {
        //   if (token.negated) {
        //     return {
        //       NOT: { mainEffectEn: { contains: token.text, mode: "insensitive" } }
        //     }
        //   }
        //   return {
        //     mainEffectEn: { contains: token.text, mode: "insensitive" },
        //   }
        // }))

        // TODO: Use actual search terms to create plainto/phraseto tsquery
        query = query
          .where(eb => eb(
            to_tsvector2(eb.ref('mainEffectEn'), eb.ref('echoEffectEn')),
            '@@',
            plainto_tsquery("when you play a permanent"),
          ))
          .where(eb => eb(
            to_tsvector2(eb.ref('mainEffectEn'), eb.ref('echoEffectEn')),
            '@@',
            phraseto_tsquery("i gain 2 boosts"),
          ))
      }

      if (triggerPart != null) {
        query = query.where((eb) =>
          eb.and([
            eb('UniqueAbilityPart.partType', '=', AbilityPartType.Trigger),
            eb('UniqueAbilityPart.textEn', 'ilike', `%${triggerPart}%`)
          ])
        )
      }
      // if (mainEffect != null) {
      //   const tokens = tokenize(mainEffect);
      //   searchParams = searchParams.concat(tokens.map((token) => {
      //     if (token.negated) {
      //       return {
      //         NOT: { mainEffectEn: { contains: token.text, mode: "insensitive" } }
      //       }
      //     }
      //     return {
      //       mainEffectEn: { contains: token.text, mode: "insensitive" },
      //     }
      //   }))
      // }

      // const mainAbilitySearchParams = [
      //   ...searchInPart(AbilityPartType.Trigger, triggerPart),
      //   ...searchInPart(AbilityPartType.Condition, conditionPart),
      //   ...searchInPart(AbilityPartType.Effect, effectPart),
      // ]

      // if (mainAbilitySearchParams.length > 0) {
      //   searchParams.push({
      //     mainAbilities: {
      //       some: {
      //         AND: mainAbilitySearchParams.map((sp) => ({
      //           allParts: {
      //             some: {
      //               AND: sp
      //             }
      //           },
      //         }))
      //       }
      //     }
      //   })
      // }

      // if (mainCosts) {
      //   if (mainCosts.length == 1) {
      //     searchParams.push({
      //       mainCost: {
      //         equals: mainCosts[0]
      //       }
      //     })
      //   } else {
      //     searchParams.push({
      //       mainCost: {
      //         in: mainCosts
      //       }
      //     })
      //   }
      // }

      // if (recallCosts) {
      //   if (recallCosts.length == 1) {
      //     searchParams.push({
      //       recallCost: {
      //         equals: recallCosts[0]
      //       }
      //     })
      //   } else {
      //     searchParams.push({
      //       recallCost: {
      //         in: recallCosts
      //       }
      //     })
      //   }
      // }

      // if (set != null) {
      //   if (set == CardSet.Core) {
      //     searchParams.push({
      //       cardSet: {
      //         in: [CardSet.Core, "COREKS"]
      //       }
      //     })
      //   } else {
      //     searchParams.push({
      //       cardSet: {
      //         equals: set
      //       }
      //     })
      //   }
      // }



      // if (minPrice != null) {
      //   searchParams.push({
      //     lastSeenInSalePrice: {
      //       gte: minPrice
      //     }
      //   })
      // }
      // if (maxPrice != null) {
      //   searchParams.push({
      //     lastSeenInSalePrice: {
      //       lte: maxPrice
      //     }
      //   })
      // }

      // let query = db.selectFrom('UniqueAbilityPart')
      //   .leftJoin('AbilityPartLink', 'UniqueAbilityPart.id', 'AbilityPartLink.partId')
      //   .leftJoin('UniqueAbilityLine', 'AbilityPartLink.abilityId', 'UniqueAbilityLine.id')
      //   .leftJoin('UniqueInfo', 'UniqueAbilityLine.uniqueInfoId', 'UniqueInfo.id')
      //   .where((eb) => 
      //     eb.and([
      //       eb('UniqueAbilityPart.textEn', 'ilike', '%boost%'),
      //       eb('UniqueAbilityPart.partType', '=', 'Trigger')
      //     ])
      //   )

      let queryWithSelect = query
        .groupBy('UniqueInfo.id')
        .distinctOn('UniqueInfo.id')
        .select([
          'UniqueInfo.id',
          'UniqueInfo.ref',
          'UniqueInfo.nameEn',
          'UniqueInfo.faction',
          'UniqueInfo.mainEffectEn',
          'UniqueInfo.echoEffectEn',
          'UniqueInfo.lastSeenInSaleAt',
          'UniqueInfo.lastSeenInSalePrice',
          'UniqueInfo.seenInLastGeneration',
          'UniqueInfo.cardSet',
          'UniqueInfo.imageUrlEn',
          'UniqueInfo.oceanPower',
          'UniqueInfo.mountainPower',
          'UniqueInfo.forestPower',
          'UniqueInfo.mainCost',
          'UniqueInfo.recallCost',
        ])
        .select((eb) => [
          jsonArrayFrom(
            eb.selectFrom('UniqueAbilityLine')
              .select(['UniqueAbilityLine.id', 'UniqueAbilityLine.lineNumber', 'UniqueAbilityLine.textEn', 'UniqueAbilityLine.isSupport', 'UniqueAbilityLine.characterData'])
              .select((eb2) => [
                jsonArrayFrom(
                  eb2.selectFrom('AbilityPartLink')
                    .select(['AbilityPartLink.id', 'AbilityPartLink.partId', 'AbilityPartLink.partType'])
                    .whereRef('AbilityPartLink.abilityId', '=', 'UniqueAbilityLine.id')
                ).as('allParts')
              ])
              .whereRef('UniqueAbilityLine.uniqueInfoId', '=', 'UniqueInfo.id')
              .orderBy('UniqueAbilityLine.lineNumber')
          ).as('mainAbilities'),
        ])

      return queryWithSelect
    })

  const queryWithCount = queryWithLimit
    .selectFrom('uniques_with_abilities')
    .where((eb) => eb.and([
      minPrice ? eb('lastSeenInSalePrice', '>=', minPrice) : null,
      maxPrice ? eb('lastSeenInSalePrice', '<=', maxPrice) : null,
    ].filter(x => x != null)))
    .select((eb) => [
      eb.fn.count('id').as('totalCount')
    ])

  const queryWithSelect = queryWithLimit
    .selectFrom('uniques_with_abilities')
    .where((eb) => eb.and([
      minPrice ? eb('lastSeenInSalePrice', '>=', minPrice) : null,
      maxPrice ? eb('lastSeenInSalePrice', '<=', maxPrice) : null,
    ].filter(x => x != null)))
    .selectAll()
    .orderBy('lastSeenInSalePrice', 'asc')
    .limit(PAGE_SIZE)
    .offset(PAGE_SIZE * (page - 1))

  if (debug) {
    const compiled = queryWithSelect.compile()
    console.log("Compiled Query:")
    console.log(compiled.sql)

    console.log("Explain Analyze:")
    const explainAnalyze = await queryWithSelect.explain(undefined, sql`analyze`)
    console.log(explainAnalyze.map(x => x['QUERY PLAN']).join('\n'))
  }

  const results = await queryWithSelect.execute()

  // const results = await prisma.uniqueInfo.findMany({
  //   where: whereClause,
  //   orderBy: {
  //     lastSeenInSalePrice: 'asc'
  //   },
  //   include: {
  //     mainAbilities: {
  //       include: {
  //         allParts: true,
  //       },
  //     },
  //   },
  //   skip: PAGE_SIZE * (page - 1), // Page is 1-indexed
  //   take: PAGE_SIZE,
  // });

  let pagination: { totalCount: number, pageCount: number } | undefined = undefined
  if (includePagination) {

    if (debug) {
      const compiled = queryWithCount.compile()
      console.log("Count Query:")
      console.log(compiled.sql)

      // console.log("Explain Analyze:")
      // const explainAnalyze = await queryWithSelect.explain(undefined, sql`analyze`)
      // console.log(explainAnalyze.map(x => x['QUERY PLAN']).join('\n'))
    }

    const countResult = await queryWithCount.executeTakeFirst()
    const totalCount = Number(countResult?.totalCount ?? 0)
    // const countQuery = query
    //   .select((eb) => [
    //     eb.fn.count('UniqueInfo.id').as('count')
    //   ])
    // const totalCount = ((await countQuery.executeTakeFirst())?.count ?? 0) as number

    if (debug) {
      console.log('Total count: ' + totalCount)
    }

    pagination = {
      totalCount: totalCount,
      pageCount: Math.ceil(totalCount / PAGE_SIZE)
    }
  }


  // console.log("Results:")
  // console.dir(results, { depth: null })

  const outResults: DisplayUniqueCard[] = results.map((result) => {
    if (!result.ref || !result.nameEn || !result.faction || !result.mainEffectEn) {
      return null;
    }

    let displayAbilities: DisplayAbilityOnCard[] = result.mainAbilities
      .map((a) => buildDisplayAbility(a))
      .filter((x) => x != null)

    return {
      ref: result.ref,
      name: result.nameEn,
      faction: result.faction as Faction,
      cardSet: result.cardSet!,
      imageUrl: result.imageUrlEn!,
      mainEffect: result.mainEffectEn,
      echoEffect: result.echoEffectEn,
      lastSeenInSaleAt: result.lastSeenInSaleAt?.toISOString(),
      lastSeenInSalePrice: Decimal(result.lastSeenInSalePrice ?? 0).toFixed(2).toString(),
      mainAbilities: displayAbilities.sort((a, b) => a.lineNumber - b.lineNumber),
    }
  }).filter((result) => result !== null);

  return { results: outResults, pagination };
}

export function buildDisplayAbility(
  ability:
    Pick<UniqueAbilityLine, 'id' | 'lineNumber' | 'isSupport' | 'characterData' | 'textEn'> &
    { allParts: Pick<AbilityPartLink, 'id' | 'partId' | 'partType'>[] }
): DisplayAbilityOnCard | undefined {
  if (ability.characterData == null) {
    return undefined;
  }
  const charData = ability.characterData as unknown as AbilityCharacterDataV1;
  const line = ability.textEn
  const displayParts: DisplayPartOnCard[] = charData.parts.map((part) => {
    const matchingPart = ability.allParts
      .find((p) => p?.partId == part.partId)
    if (matchingPart == null) {
      console.error(`Part ${part.partId} not found in ability ${ability.id}`)
      return null;
    }
    return {
      partId: part.partId,
      startIndex: part.startIndex,
      endIndex: part.endIndex,
      partType: matchingPart.partType.toString() as AbilityPartType,
      substituteText: part.substituteText,
    }
  }).filter((x) => x != null)
  return {
    lineNumber: ability.lineNumber,
    isSupport: ability.isSupport,
    text: line,
    parts: displayParts.sort((a, b) => a.startIndex - b.startIndex)
  }
}

