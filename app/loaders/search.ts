import { CardSet, DisplayAbilityOnCard, DisplayPartOnCard, DisplayUniqueCard, AbilityPartType, Faction } from "~/models/cards";
import { UniqueAbilityLine, Prisma, UniqueInfo, UniqueAbilityPart, AbilityPartType as DbAbilityPartType, AbilityPartLink } from '@prisma/client';
import { AbilityCharacterDataV1 } from "@common/models/postprocess";
import { db } from "@common/utils/kysely.server";
import { jsonArrayFrom } from 'kysely/helpers/postgres'
import { Decimal } from "decimal.js";
import { Expression, SelectQueryBuilder, sql } from "kysely";
import { partition } from "~/lib/utils";
import { DB } from "@generated/kysely-db/types";

// Add the type from Prisma namespace
type UniqueInfoWhereInput = Prisma.UniqueInfoWhereInput;

const debug = process.env.DEBUG_WEB == "true"

export interface SearchQuery {
  faction?: string;
  set?: string | string[];
  characterName?: string;
  cardSubTypes?: string[];
  cardText?: string;
  triggerPart?: string[];
  conditionPart?: string[];
  effectPart?: string[];
  matchAllAbilities?: boolean;
  partIncludeSupport?: boolean;
  partFilterArrow?: boolean;
  partFilterHand?: boolean;
  partFilterReserve?: boolean;
  filterTextless?: boolean;
  filterZeroStat?: boolean;
  mainCosts?: number[];
  recallCosts?: number[];
  includeExpiredCards?: boolean;
  minPrice?: number;
  maxPrice?: number;
  forestPowers?: number[];
  mountainPowers?: number[];
  oceanPowers?: number[];
}

export interface PageParams {
  page: number;
  includePagination: boolean;
  locale?: string;
}

export interface Token {
  text: string
  negated: boolean
}

export function to_tsvector(expr: Expression<string | null> | string) {
  return sql`to_tsvector('simple', COALESCE(${expr}, ''))`
}
export function to_tsvector2(expr1: Expression<string | null> | string, expr2: Expression<string | null> | string) {
  return sql`to_tsvector('simple', COALESCE(${expr1}, '') || ' ' || COALESCE(${expr2}, ''))`
}
export function plainto_tsquery(expr: Expression<string> | string) {
  return sql`plainto_tsquery('simple', ${expr})`
}
export function phraseto_tsquery(expr: Expression<string> | string) {
  return sql`phraseto_tsquery('simple', ${expr})`
}
export function tokens_to_tsquery(tokens: Token[]) {
  const tokensAsSql = tokens.map(token => {
    const neg = token.negated ? (x) => `!!(${x})` : (x) => x
    if (token.text.indexOf(' ') >= 0) {
      return neg(sql`phraseto_tsquery('simple', ${token.text})`)
    }
    return neg(sql`plainto_tsquery('simple', ${token.text})`)
  })
  return sql`(${sql.join(tokensAsSql, sql`&&`)})`
}

export function tokenize(text: string): Token[] {
  const quotedRegex = /(-?)(?:"([^"]+)"|(\S+))/g;
  let match;
  const tokens: Token[] = [];

  while ((match = quotedRegex.exec(text)) !== null) {
    // match[1] contains text inside quotes, match[2] contains unquoted text
    tokens.push({ text: match[2] || match[3], negated: match[1] === "-" });
  }
  return tokens;
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
    cardSubTypes,
    cardText,
    triggerPart,
    conditionPart,
    effectPart,
    matchAllAbilities,
    partIncludeSupport,
    partFilterArrow,
    partFilterHand,
    partFilterReserve,
    filterTextless,
    filterZeroStat,
    mainCosts,
    recallCosts,
    includeExpiredCards,
    minPrice,
    maxPrice,
    forestPowers,
    mountainPowers,
    oceanPowers
  } = searchQuery
  const {
    page,
    includePagination,
    locale,
  } = pageParams

  if (
    faction == null &&
    set == null &&
    characterName == null &&
    cardText == null &&
    triggerPart == null &&
    conditionPart == null &&
    effectPart == null
  ) {
    return { results: [], pagination: undefined }
  }

  // Group ability parts into combinations
  // Each index represents one ability search (trigger[i], condition[i], effect[i])
  const maxAbilityCount = Math.max(
    triggerPart?.length ?? 0,
    conditionPart?.length ?? 0,
    effectPart?.length ?? 0
  );
  
  // Edge case: Prevent excessive combinations (protect against potential abuse)
  const MAX_ABILITY_COMBINATIONS = 3;
  if (maxAbilityCount > MAX_ABILITY_COMBINATIONS) {
    throw new Error(`Too many ability combinations. Maximum allowed is ${MAX_ABILITY_COMBINATIONS}.`);
  }
  
  const abilityCombinations: Array<{ trigger?: string; condition?: string; effect?: string }> = [];
  for (let i = 0; i < maxAbilityCount; i++) {
    // Trim and clean up each part
    const triggerValue = triggerPart?.[i]?.trim() || undefined;
    const conditionValue = conditionPart?.[i]?.trim() || undefined;
    const effectValue = effectPart?.[i]?.trim() || undefined;
    
    const combo = {
      trigger: triggerValue,
      condition: conditionValue,
      effect: effectValue
    };
    
    // Only add if at least one part is defined and non-empty
    if (combo.trigger || combo.condition || combo.effect) {
      abilityCombinations.push(combo);
    }
  }
  
  // Edge case: If after filtering we have no valid combinations, 
  // treat as if no ability search was specified
  if (abilityCombinations.length === 0 && (triggerPart || conditionPart || effectPart)) {
    // User specified ability arrays but all were empty/whitespace
    // Continue with query but don't add ability filters
  }

  let query: SelectQueryBuilder<DB, "UniqueInfo", {}> = db.selectFrom('UniqueInfo')

  if (abilityCombinations.length > 0) {
    // Build filters for each ability combination
    // For each combination, we check if the card has an ability line matching all specified parts
    
    const combinationFilters = abilityCombinations.map((combo) => {
      // Build list of parts for this combination
      const parts: Array<{ part: AbilityPartType; text: string }> = [];
      if (combo.trigger) parts.push({ part: AbilityPartType.Trigger, text: combo.trigger });
      if (combo.condition) parts.push({ part: AbilityPartType.Condition, text: combo.condition });
      if (combo.effect) parts.push({ part: AbilityPartType.Effect, text: combo.effect });

      return ({ exists, selectFrom }) => {
        return exists(
          selectFrom('UniqueAbilityLine')
            .where(({ and, exists, selectFrom, not, eb }) => {
              // This ability line must match ALL parts in this combination
              const partFilters = parts.map((part) => {
                const [negatedTokens, tokens] = partition(tokenize(part.text), (token) => token.negated);

                return exists(
                  selectFrom('AbilityPartLink')
                    .where(({ and, exists, selectFrom, not, eb }) => {
                      return and([
                        tokens.length > 0 ?
                          exists(
                            selectFrom('UniqueAbilityPart')
                              .where(({ and, or, eb }) => {
                                return and([
                                  eb('UniqueAbilityPart.partType', '=', part.part),
                                  !partIncludeSupport ? eb('UniqueAbilityPart.isSupport', '=', false) : null,
                                  // OR between English and French text search
                                  or([
                                    and(tokens.map(token => eb('UniqueAbilityPart.textEn', 'ilike', `%${token.text}%`))),
                                    and(tokens.map(token => eb('UniqueAbilityPart.textFr', 'ilike', `%${token.text}%`))),
                                  ]),
                                ].filter(x => x != null))
                              })
                              .whereRef('UniqueAbilityPart.id', '=', 'AbilityPartLink.partId')
                          )
                          : null,
                        negatedTokens.length > 0 ?
                          not(
                            exists(
                              selectFrom('UniqueAbilityPart')
                                .where(({ and, or, eb }) => {
                                  return and([
                                    eb('UniqueAbilityPart.partType', '=', part.part),
                                    !partIncludeSupport ? eb('UniqueAbilityPart.isSupport', '=', false) : null,
                                    or([
                                      // OR between English and French text for negated tokens
                                      or(negatedTokens.map(token => eb('UniqueAbilityPart.textEn', 'ilike', `%${token.text}%`))),
                                      or(negatedTokens.map(token => eb('UniqueAbilityPart.textFr', 'ilike', `%${token.text}%`))),
                                    ])
                                  ].filter(x => x != null))
                                })
                                .whereRef('UniqueAbilityPart.id', '=', 'AbilityPartLink.partId')
                            )
                          )
                          : null,
                      ].filter(x => x != null))
                    })
                    .whereRef('AbilityPartLink.abilityId', '=', 'UniqueAbilityLine.id')
                );
              });

              return and([
                !partIncludeSupport ? eb('UniqueAbilityLine.isSupport', '=', false) : null,
                ...partFilters
              ].filter(x => x != null));
            })
            .whereRef('UniqueAbilityLine.uniqueInfoId', '=', 'UniqueInfo.id')
        );
      };
    });

    // Apply the combination filters based on matchAllAbilities
    if (matchAllAbilities) {
      // Match ALL: card must have ability lines matching ALL combinations (AND logic)
      query = query.where(({ and, exists, selectFrom }) => 
        and(combinationFilters.map(f => f({ exists, selectFrom })))
      );
    } else {
      // Match ANY: card must have ability line matching ANY combination (OR logic)
      query = query.where(({ or, exists, selectFrom }) => 
        or(combinationFilters.map(f => f({ exists, selectFrom })))
      );
    }
  }

  // Now we can add all the filters based on the UniqueInfo table
  if (faction != null) {
    query = query.where('faction', '=', faction)
  }

  if (characterName != null) {
    // Character name should default to a OR, not AND
    // but negation of OR is NAND, so we need to handle that
    const [negatedTokens, normalTokens] = partition(tokenize(characterName), t => t.negated);

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

  // I just discovered that the postgres planner will actually optimize this
  // to `mainCost = X` if the list is just one element. So no need to manually
  // address that fairly common case
  if (mainCosts && mainCosts.length > 0) {
    query = query.where('mainCost', 'in', mainCosts)
  }
  if (recallCosts && recallCosts.length > 0) {
    query = query.where('recallCost', 'in', recallCosts)
  }

  if (forestPowers && forestPowers.length > 0) {
    query = query.where('forestPower', 'in', forestPowers)
  }
  if (mountainPowers && mountainPowers.length > 0) {
    query = query.where('mountainPower', 'in', mountainPowers)
  }
  if (oceanPowers && oceanPowers.length > 0) {
    query = query.where('oceanPower', 'in', oceanPowers)
  }

  if (set != null) {
    if (set == CardSet.Core) {
      query = query.where('cardSet', 'in', [CardSet.Core, "COREKS"])
    } else {
      query = query.where('cardSet', '=', set)
    }
  }

  if (cardText != null) {
    const tokens = tokenize(cardText);
    // This condition is more art than science:
    // For some reason I didn't understand, some searches with AbilityLine where much slower when using FTS.
    // Also when we return a lot of results, the Query Planner prefers doing a full table scan. This is expected, but
    // at that point we're better off with a simple LIKE. Ideally we would have a way to tell ahead of time or allow
    // Postgres to use either, but I didn't find a way to do that. Checking the number and length of token is a
    // crude way to approximate that.
    const useFTS = (triggerPart == null && conditionPart == null && effectPart == null) &&
      (tokens.length > 5 || tokens.some(token => token.text.length > 15));
    if (useFTS) {
      query = query
        .where(eb => eb(
          to_tsvector2(eb.ref('mainEffectEn'), eb.ref('echoEffectEn')),
          '@@',
          tokens_to_tsquery(tokens),
        ))
    } else {
      query = query.where((eb) => eb.and(
        tokens.map(token => eb('mainEffectEn', 'ilike', `%${token.text}%`)),
      ))
    }
  }

  if (!includeExpiredCards) {
    query = query.where('seenInLastGeneration', '=', true)
  }


  const queryWithSelect = query
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
    .select(() => [
      sql`COUNT(*) OVER ()`.as('totalCount')
    ])
    .select((eb) => [
      jsonArrayFrom(
        eb.selectFrom('UniqueAbilityLine')
          .select(['UniqueAbilityLine.id', 'UniqueAbilityLine.lineNumber', 'UniqueAbilityLine.textEn', 'UniqueAbilityLine.textFr', 'UniqueAbilityLine.isSupport', 'UniqueAbilityLine.characterData'])
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
    .where((eb) => eb.and([
      minPrice ? eb('lastSeenInSalePrice', '>=', minPrice) : null,
      maxPrice ? eb('lastSeenInSalePrice', '<=', maxPrice) : null,
    ].filter(x => x != null)))
    .orderBy('lastSeenInSalePrice', 'asc')
    .orderBy('UniqueInfo.id', 'asc') // This ID doesn't really mean anything, it's just here to make the results deterministic
    .limit(PAGE_SIZE)
    .offset(PAGE_SIZE * (page - 1))

  if (debug) {
    const compiled = queryWithSelect.compile()
    console.log("Compiled Query:")
    console.log(compiled.sql)

    const params = compiled.parameters
    const interpolated = compiled.sql.replace(/\$(\d+)/g, (match) => {
      const paramIndex = parseInt(match.slice(1)) - 1;
      const param = params[paramIndex];
      if (typeof param === 'string') {
        return `'${param}'`;
      }
      return `${param}`;
    })
    console.log("Interpolated: --------------------------------")
    console.log(interpolated)
    console.log("--------------------------------")

    console.log("Explain Analyze:")
    const explainAnalyze = await queryWithSelect.explain(undefined, sql`analyze`)
    console.log(explainAnalyze.map(x => x['QUERY PLAN']).join('\n'))
  }

  const results = await queryWithSelect.execute()

  let pagination: { totalCount: number, pageCount: number } | undefined = undefined
  if (includePagination) {
    const totalCount = results.length > 0 ? Number(results[0].totalCount) : 0
    if (debug) {
      console.log('Total count: ' + totalCount)
    }

    pagination = {
      totalCount: totalCount,
      pageCount: Math.ceil(totalCount / PAGE_SIZE)
    }
  }

  const outResults: DisplayUniqueCard[] = results.map((result) => {
    if (!result.ref || !result.nameEn || !result.faction || !result.mainEffectEn) {
      return null;
    }

    let displayAbilities: DisplayAbilityOnCard[] = result.mainAbilities
      .map((a) => buildDisplayAbility(a, locale))
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
    Pick<UniqueAbilityLine, 'id' | 'lineNumber' | 'isSupport' | 'characterData' | 'textEn' | 'textFr'> &
    { allParts: Pick<AbilityPartLink, 'id' | 'partId' | 'partType'>[] },
  locale: string = 'en'
): DisplayAbilityOnCard | undefined {
  if (ability.characterData == null) {
    return undefined;
  }
  const charData = ability.characterData as unknown as AbilityCharacterDataV1;
  const line = locale === "fr" && ability.textFr ? ability.textFr : ability.textEn;
  const parts = locale === "fr" && charData.partsFr ? charData.partsFr : charData.parts;
  const displayParts: DisplayPartOnCard[] = parts.map((part) => {
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
