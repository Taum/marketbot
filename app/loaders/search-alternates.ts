import prisma from "@common/utils/prisma.server.js";
import { CardSet, DisplayAbilityOnCard, DisplayPartOnCard, DisplayUniqueCard, AbilityPartType, Faction, allCardSubTypes, CardSubType } from "~/models/cards";
import { UniqueAbilityLine, Prisma, UniqueInfo, UniqueAbilityPart, AbilityPartType as DbAbilityPartType, AbilityPartLink } from '@prisma/client';
import { AbilityCharacterDataV1 } from "@common/models/postprocess";
import { db } from "@common/utils/kysely.server";
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres'
import { Decimal } from "decimal.js";
import { Expression, SelectQueryBuilder, sql } from "kysely";
import { partition } from "~/lib/utils";
import { DB } from "@generated/kysely-db/types";
import { buildDisplayAbility, PageParams, SearchQuery, SearchResults, to_tsvector2, Token, tokenize, tokens_to_tsquery } from "~/loaders/search";

// Add the type from Prisma namespace
type UniqueInfoWhereInput = Prisma.UniqueInfoWhereInput;

const debug = process.env.DEBUG_WEB == "true"

const PAGE_SIZE = 100

export const websearch_to_tsquery = (str: string) => {
  // return sql`websearch_to_tsquery('simple', ${str})`
  return sql`ts_rewrite(websearch_to_tsquery('simple', ${str}), 'SELECT "from","to" FROM "FtsAlias"')`   
}

export async function searchWithJoins(searchQuery: SearchQuery, pageParams: PageParams): Promise<SearchResults> {
  const {
    faction,
    set,
    characterName,
    cardSubTypes,
    cardText,
    triggerPart,
    conditionPart,
    effectPart,
    partIncludeSupport,
    mainCosts,
    recallCosts,
    includeExpiredCards,
    minPrice,
    maxPrice,
    forestPowers,
    mountainPowers,
    oceanPowers,
  } = searchQuery
  const {
    page,
    includePagination,
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

  const abilityParts = [
    { part: AbilityPartType.Trigger, text: triggerPart },
    { part: AbilityPartType.Condition, text: conditionPart },
    { part: AbilityPartType.Effect, text: effectPart }
  ]

  let query: SelectQueryBuilder<DB, "UniqueInfo", {}> = db.selectFrom('UniqueInfo')

  if (abilityParts.some(x => x.text != null)) {
    // If our search is based on ability parts, we start from UniqueAbilityLine and join to UniqueInfo instead
    let abLineQuery = db.selectFrom('UniqueAbilityLine')

    if (abilityParts[0].text != null) {
      abLineQuery = abLineQuery
        .innerJoin('AbilityPartLink as apl1', 'UniqueAbilityLine.id', 'apl1.abilityId')
        .innerJoin('UniqueAbilityPart as upa1', 'apl1.partId', 'upa1.id')
        .where(({ eb, and }) => {
          const [negatedTokens0, tokens0] = partition(tokenize(abilityParts[0].text!), (token) => token.negated);
          return and([
            eb(`upa1.partType`, '=', abilityParts[0].part),
            !partIncludeSupport ? eb(`upa1.isSupport`, '=', false) : null,
            ...tokens0.map(token => eb('upa1.textEn', 'ilike', `%${token.text}%`)),
            ...negatedTokens0.map(token => eb('upa1.textEn', 'not ilike', `%${token.text}%`)),
          ].filter(x => x != null))
        })
    }
    if (abilityParts[1].text != null) {
      abLineQuery = abLineQuery
        .innerJoin('AbilityPartLink as apl2', 'UniqueAbilityLine.id', 'apl2.abilityId')
        .innerJoin('UniqueAbilityPart as upa2', 'apl2.partId', 'upa2.id')
        .where(({ eb, and }) => {
          const [negatedTokens1, tokens1] = partition(tokenize(abilityParts[1].text!), (token) => token.negated);
          return and([
            eb(`upa2.partType`, '=', abilityParts[1].part),
            !partIncludeSupport ? eb(`upa2.isSupport`, '=', false) : null,
            ...tokens1.map(token => eb('upa2.textEn', 'ilike', `%${token.text}%`)),
            ...negatedTokens1.map(token => eb('upa2.textEn', 'not ilike', `%${token.text}%`)),
          ].filter(x => x != null))
        })
    }
    if (abilityParts[2].text != null) {
      abLineQuery = abLineQuery
        .innerJoin('AbilityPartLink as apl3', 'UniqueAbilityLine.id', 'apl3.abilityId')
        .innerJoin('UniqueAbilityPart as upa3', 'apl3.partId', 'upa3.id')
        .where(({ eb, and }) => {
          const [negatedTokens2, tokens2] = partition(tokenize(abilityParts[2].text!), (token) => token.negated);

          return and([
            eb(`upa3.partType`, '=', abilityParts[2].part),
            !partIncludeSupport ? eb(`upa3.isSupport`, '=', false) : null,
            ...tokens2.map(token => eb('upa3.textEn', 'ilike', `%${token.text}%`)),
            ...negatedTokens2.map(token => eb('upa3.textEn', 'not ilike', `%${token.text}%`)),
          ].filter(x => x != null))
        })
    }

    // if (!partIncludeSupport) {
    //   abLineQuery = abLineQuery.where('UniqueAbilityLine.isSupport', '=', false)
    // }

    query = abLineQuery.innerJoin('UniqueInfo', 'UniqueAbilityLine.uniqueInfoId', 'UniqueInfo.id')
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
  
  if (cardSubTypes && cardSubTypes.length > 0) {
    // This may be a little paranoid, but there isn't a point in allowing random strings to be passed in here anyway.
    const validSubtypes = cardSubTypes.filter(subtype => allCardSubTypes.map(x => x.value).includes(subtype as CardSubType))
    query = query.where('cardSubTypes', '&&', sql<string[]>`ARRAY[${sql.join(validSubtypes)}]`)
  }

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
    if (Array.isArray(set)) {
      const sets = set.flatMap(s => s === CardSet.Core ? [CardSet.Core, "COREKS"] : s)
      query = query.where('cardSet', 'in', sets)
    } else {
      if (set == CardSet.Core) {
        query = query.where('cardSet', 'in', [CardSet.Core, "COREKS"])
      } else {
        query = query.where('cardSet', '=', set)
      }
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



export async function searchWithCTEs(searchQuery: SearchQuery, pageParams: PageParams): Promise<SearchResults> {
  const {
    faction,
    set,
    characterName,
    cardSubTypes,
    cardText,
    triggerPart,
    conditionPart,
    effectPart,
    partIncludeSupport,
    mainCosts,
    recallCosts,
    forestPowers,
    mountainPowers,
    oceanPowers,
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
    cardText == null &&
    triggerPart == null &&
    conditionPart == null &&
    effectPart == null
  ) {
    return { results: [], pagination: undefined }
  }

  const abilityParts = [
    { part: AbilityPartType.Trigger, text: triggerPart },
    { part: AbilityPartType.Condition, text: conditionPart },
    { part: AbilityPartType.Effect, text: effectPart }
  ]


  // let withQuery: SelectQueryBuilder<DB, "UniqueInfo", {}> | undefined = undefined
  // if (abilityParts.some(x => x.text != null)) {
  // If our search is based on ability parts, we start from UniqueAbilityLine and join to UniqueInfo instead
  const [negatedTokens0, tokens0] = abilityParts[0].text != null ? partition(tokenize(abilityParts[0].text!), (token) => token.negated) : [[], []];
  const [negatedTokens1, tokens1] = abilityParts[1].text != null ? partition(tokenize(abilityParts[1].text!), (token) => token.negated) : [[], []];
  const [negatedTokens2, tokens2] = abilityParts[2].text != null ? partition(tokenize(abilityParts[2].text!), (token) => token.negated) : [[], []];

  let withQuery = db
    .with('apl1_ids', (eb) => {
      if (abilityParts[0].text != null) {
        return eb.selectFrom('AbilityPartLink')
          .innerJoin('UniqueAbilityPart as upa', 'AbilityPartLink.partId', 'upa.id')
          .select('AbilityPartLink.abilityId')
          .where(({ eb, and }) => {
            return and([
              eb(`upa.partType`, '=', abilityParts[0].part),
              !partIncludeSupport ? eb(`upa.isSupport`, '=', false) : null,
              ...tokens0.map(token => eb('upa.textEn', 'ilike', `%${token.text}%`)),
              ...negatedTokens0.map(token => eb('upa.textEn', 'not ilike', `%${token.text}%`)),
            ].filter(x => x != null))
          })
      } else {
        return eb.selectFrom('AbilityPartLink')
          .select('AbilityPartLink.abilityId')
          .where('AbilityPartLink.id', '=', 0)
      }
    })
    .with('apl2_ids', (eb) => {
      if (abilityParts[1].text != null) {
        return eb.selectFrom('AbilityPartLink')
          .innerJoin('UniqueAbilityPart as upa', 'AbilityPartLink.partId', 'upa.id')
          .select('AbilityPartLink.abilityId')
          .where(({ eb, and }) => {
            return and([
              eb(`upa.partType`, '=', abilityParts[1].part),
              !partIncludeSupport ? eb(`upa.isSupport`, '=', false) : null,
              ...tokens1.map(token => eb('upa.textEn', 'ilike', `%${token.text}%`)),
              ...negatedTokens1.map(token => eb('upa.textEn', 'not ilike', `%${token.text}%`)),
            ].filter(x => x != null))
          })
      } else {
        return eb.selectFrom('AbilityPartLink')
          .select('AbilityPartLink.abilityId')
          .where('AbilityPartLink.id', '=', 0)
      }
    })
    .with('apl3_ids', (eb) => {
      if (abilityParts[2].text != null) {
        return eb.selectFrom('AbilityPartLink')
          .innerJoin('UniqueAbilityPart as upa', 'AbilityPartLink.partId', 'upa.id')
          .select('AbilityPartLink.abilityId')
          .where(({ eb, and }) => {
            return and([
              eb(`upa.partType`, '=', abilityParts[2].part),
              !partIncludeSupport ? eb(`upa.isSupport`, '=', false) : null,
              ...tokens2.map(token => eb('upa.textEn', 'ilike', `%${token.text}%`)),
              ...negatedTokens2.map(token => eb('upa.textEn', 'not ilike', `%${token.text}%`)),
            ].filter(x => x != null))
          })
      } else {
        return eb.selectFrom('AbilityPartLink')
          .select('AbilityPartLink.abilityId')
          .where('AbilityPartLink.id', '=', 0)
      }
    })
    .with('unique_ability_lines', (eb) => {
      let q = eb.selectFrom('apl1_ids').selectAll()
      if (abilityParts[1].text != null) {
        q = q.intersect(eb.selectFrom('apl2_ids').selectAll())
      }
      if (abilityParts[2].text != null) {
        q = q.intersect(eb.selectFrom('apl3_ids').selectAll())
      }
      return q
    })

  let query: SelectQueryBuilder<DB, "UniqueInfo", {}> = withQuery.selectFrom('UniqueInfo')

  if (abilityParts.some(x => x.text != null)) {
    // If our search is based on ability parts, we start from UniqueAbilityLine and join to UniqueInfo instead
    let abLineQuery = db.selectFrom('UniqueAbilityLine')

    abLineQuery = abLineQuery.where('UniqueAbilityLine.id', 'in', withQuery.selectFrom('unique_ability_lines').select('abilityId'))
    // if (abilityParts[0].text != null) {
    //   abLineQuery = abLineQuery
    //     .where('UniqueAbilityLine.id', 'in', withQuery.selectFrom('apl1_ids').select('abilityId'))
    // }
    // if (abilityParts[1].text != null) {
    //   abLineQuery = abLineQuery
    //     .where('UniqueAbilityLine.id', 'in', withQuery.selectFrom('apl2_ids').select('abilityId'))
    // }
    // if (abilityParts[2].text != null) {
    //   abLineQuery = abLineQuery
    //     .where('UniqueAbilityLine.id', 'in', withQuery.selectFrom('apl3_ids').select('abilityId'))
    // }
    query = abLineQuery.innerJoin('UniqueInfo', 'UniqueAbilityLine.uniqueInfoId', 'UniqueInfo.id')
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

  if (cardSubTypes && cardSubTypes.length > 0) {
    // This may be a little paranoid, but there isn't a point in allowing random strings to be passed in here anyway.
    const validSubtypes = cardSubTypes.filter(subtype => allCardSubTypes.map(x => x.value).includes(subtype as CardSubType))
    query = query.where('cardSubTypes', '&&', sql<string[]>`ARRAY[${sql.join(validSubtypes)}]`)
  }

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
    if (Array.isArray(set)) {
      const sets = set.flatMap(s => s === CardSet.Core ? [CardSet.Core, "COREKS"] : s)
      query = query.where('cardSet', 'in', sets)
    } else {
      if (set == CardSet.Core) {
        query = query.where('cardSet', 'in', [CardSet.Core, "COREKS"])
      } else {
        query = query.where('cardSet', '=', set)
      }
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



export async function searchWithCTEsIndexingCharacterNames(searchQuery: SearchQuery, pageParams: PageParams): Promise<SearchResults> {
  const {
    faction,
    set,
    characterName,
    cardSubTypes,
    cardText,
    triggerPart,
    conditionPart,
    effectPart,
    mainCosts,
    recallCosts,
    forestPowers,
    mountainPowers,
    oceanPowers,
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
    cardText == null &&
    triggerPart == null &&
    conditionPart == null &&
    effectPart == null
  ) {
    return { results: [], pagination: undefined }
  }

  const abilityParts = [
    { part: AbilityPartType.Trigger, text: triggerPart },
    { part: AbilityPartType.Condition, text: conditionPart },
    { part: AbilityPartType.Effect, text: effectPart }
  ]

  const partIncludeSupport = searchQuery.partIncludeSupport ?? false

  const nonNullAbilityParts = abilityParts.filter(x => x.text != null)
    .map(x => {
      const [neg, pos] = partition(tokenize(x.text!), (token) => token.negated)
      return { part: x.part, neg, pos }
    })
    .sort((a, b) => {
      if (a.pos.length > 0 && b.pos.length <= 0) {
        return -1;
      }
      if (a.pos.length <= 0 && b.pos.length > 0) {
        return 1;
      }
      return 0;
    })

  if (debug) {
    console.log("Ability Parts (tokenized):")
    console.dir(nonNullAbilityParts)
  }

  let except0 = false
  let except1 = false
  let except2 = false

  let withQuery = db
    .with('apl0_ids', (eb) => {
      if (nonNullAbilityParts.length > 0) {
        const ap = nonNullAbilityParts[0]
        if (ap.pos.length > 0) {
          return eb.selectFrom('AbilityPartLink')
            .innerJoin('UniqueAbilityPart as upa', 'AbilityPartLink.partId', 'upa.id')
            .select('AbilityPartLink.abilityId')
            .where(({ eb, and }) => {
              return and([
                eb(`upa.partType`, '=', ap.part),
                !partIncludeSupport ? eb(`upa.isSupport`, '=', false) : null,
                ...ap.pos.map(token => eb('upa.textEn', 'ilike', `%${token.text}%`)),
                ...ap.neg.map(token => eb('upa.textEn', 'not ilike', `%${token.text}%`)),
              ].filter(x => x != null))
            })
        } else {
          except0 = true
          return eb.selectFrom('AbilityPartLink')
            .innerJoin('UniqueAbilityPart as upa', 'AbilityPartLink.partId', 'upa.id')
            .select('AbilityPartLink.abilityId')
            .where(({ eb, and, or }) => {
              return and([
                eb(`upa.partType`, '=', ap.part),
                !partIncludeSupport ? eb(`upa.isSupport`, '=', false) : null,
                or(ap.neg.map(token => eb('upa.textEn', 'ilike', `%${token.text}%`))),
              ].filter(x => x != null))
            })
        }
      } else {
        return eb.selectFrom('AbilityPartLink')
          .select('AbilityPartLink.abilityId')
          .where('AbilityPartLink.id', '=', 0)
      }
    })
    .with('apl1_ids', (eb) => {
      if (nonNullAbilityParts.length > 1) {
        const ap = nonNullAbilityParts[1]
        if (ap.pos.length > 0) {
          return eb.selectFrom('AbilityPartLink')
            .innerJoin('UniqueAbilityPart as upa', 'AbilityPartLink.partId', 'upa.id')
            .select('AbilityPartLink.abilityId')
            .where(({ eb, and }) => {
              return and([
                eb(`upa.partType`, '=', ap.part),
                !partIncludeSupport ? eb(`upa.isSupport`, '=', false) : null,
                ...ap.pos.map(token => eb('upa.textEn', 'ilike', `%${token.text}%`)),
                ...ap.neg.map(token => eb('upa.textEn', 'not ilike', `%${token.text}%`)),
              ].filter(x => x != null))
            })
        } else {
          except1 = true
          return eb.selectFrom('AbilityPartLink')
            .innerJoin('UniqueAbilityPart as upa', 'AbilityPartLink.partId', 'upa.id')
            .select('AbilityPartLink.abilityId')
            .where(({ eb, and, or }) => {
              return and([
                eb(`upa.partType`, '=', ap.part),
                !partIncludeSupport ? eb(`upa.isSupport`, '=', false) : null,
                or(ap.neg.map(token => eb('upa.textEn', 'ilike', `%${token.text}%`))),
              ].filter(x => x != null))
            })
        }
      } else {
        return eb.selectFrom('AbilityPartLink')
          .select('AbilityPartLink.abilityId')
          .where('AbilityPartLink.id', '=', 0)
      }
    })
    .with('apl2_ids', (eb) => {
      if (nonNullAbilityParts.length > 2) {
        const ap = nonNullAbilityParts[2]
        if (ap.pos.length > 0) {
          return eb.selectFrom('AbilityPartLink')
            .innerJoin('UniqueAbilityPart as upa', 'AbilityPartLink.partId', 'upa.id')
            .select('AbilityPartLink.abilityId')
            .where(({ eb, and }) => {
              return and([
                eb(`upa.partType`, '=', ap.part),
                !partIncludeSupport ? eb(`upa.isSupport`, '=', false) : null,
                ...ap.pos.map(token => eb('upa.textEn', 'ilike', `%${token.text}%`)),
                ...ap.neg.map(token => eb('upa.textEn', 'not ilike', `%${token.text}%`)),
              ].filter(x => x != null))
            })
        } else {
          except2 = true
          return eb.selectFrom('AbilityPartLink')
            .innerJoin('UniqueAbilityPart as upa', 'AbilityPartLink.partId', 'upa.id')
            .select('AbilityPartLink.abilityId')
            .where(({ eb, and, or }) => {
              return and([
                eb(`upa.partType`, '=', ap.part),
                !partIncludeSupport ? eb(`upa.isSupport`, '=', false) : null,
                or(ap.neg.map(token => eb('upa.textEn', 'ilike', `%${token.text}%`))),
              ].filter(x => x != null))
            })
        }
      } else {
        return eb.selectFrom('AbilityPartLink')
          .select('AbilityPartLink.abilityId')
          .where('AbilityPartLink.id', '=', 0)
      }
    })
    .with('unique_ability_lines', (eb) => {
      if (except0) {
        let q = eb
          .selectFrom('apl0_ids').selectAll()
        if (nonNullAbilityParts.length > 1) {
          q = q.union(eb.selectFrom('apl1_ids').selectAll())
        }
        if (nonNullAbilityParts.length > 2) {
          q = q.union(eb.selectFrom('apl2_ids').selectAll())
        }
        return q
      }
      
      let q = eb.selectFrom('apl0_ids').selectAll()
      if (nonNullAbilityParts.length > 1) {
        if (except1) {
          q = q.except(eb.selectFrom('apl1_ids').selectAll())
        } else {
          q = q.intersect(eb.selectFrom('apl1_ids').selectAll())
        }
      }
      if (nonNullAbilityParts.length > 2) {
        if (except2) {
          q = q.except(eb.selectFrom('apl2_ids').selectAll())
        } else {
          q = q.intersect(eb.selectFrom('apl2_ids').selectAll())
        }
      }
      return q
    })

  let query: SelectQueryBuilder<DB, "UniqueInfo", {}> = withQuery.selectFrom('UniqueInfo')

  // If our search is based on ability parts, we start from UniqueAbilityLine and join to UniqueInfo instead
  if (nonNullAbilityParts.length > 0) {
    // If we only have negative parts, we have inverted the `unique_ability_lines` CTE and need to invert the query here
    if (except0) {
      query = db.selectFrom('UniqueAbilityLine')
        .where('UniqueAbilityLine.id', 'not in', withQuery.selectFrom('unique_ability_lines').select('abilityId'))
        .$if(!partIncludeSupport, (eb) => eb.where('UniqueAbilityLine.isSupport', '=', false))
        .innerJoin('UniqueInfo', 'UniqueAbilityLine.uniqueInfoId', 'UniqueInfo.id')
    } else {
      query = db.selectFrom('UniqueAbilityLine')
        .where('UniqueAbilityLine.id', 'in', withQuery.selectFrom('unique_ability_lines').select('abilityId'))
        .innerJoin('UniqueInfo', 'UniqueAbilityLine.uniqueInfoId', 'UniqueInfo.id')
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
      const charNameQuery = db.selectFrom('CardFamilyStats')
        .select('name')
        .distinct()
        .where((eb) => eb.or(
          normalTokens.map(token => eb('name', 'ilike', `%${token.text}%`))
        ))
        .$if(negatedTokens.length > 0, (eb) => eb.where((eb) => eb.and(
          negatedTokens.map(token => eb('name', 'not ilike', `%${token.text}%`))
        )))
      const matchingCharacterNames = await charNameQuery.execute()
      // console.log("Matching character names:", matchingCharacterNames.map(x => x.name).join(', '))
      query = query.where(
        'UniqueInfo.nameEn', 'in', matchingCharacterNames.map(x => x.name)
      )
    }
    else if (negatedTokens.length > 0) {
      query = query.where((eb) => eb.and(
        negatedTokens.map(token => eb('nameEn', 'not ilike', `%${token.text}%`))
      ))
    }
    else {
      throw new Error("Character name search did not generate any tokens")
    }
  }

  if (cardSubTypes && cardSubTypes.length > 0) {
    // This may be a little paranoid, but there isn't a point in allowing random strings to be passed in here anyway.
    const validSubtypes = cardSubTypes.filter(subtype => allCardSubTypes.map(x => x.value).includes(subtype as CardSubType))
    query = query.where('cardSubTypes', '&&', sql<string[]>`ARRAY[${sql.join(validSubtypes)}]`)
  }

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
    if (Array.isArray(set)) {
      const sets = set.flatMap(s => s === CardSet.Core ? [CardSet.Core, "COREKS"] : s)
      query = query.where('cardSet', 'in', sets)
    } else {
      if (set == CardSet.Core) {
        query = query.where('cardSet', 'in', [CardSet.Core, "COREKS"])
      } else {
        query = query.where('cardSet', '=', set)
      }
    }
  }

  if (cardText != null) {
    const { tsQuery } = await db.selectNoFrom(
      websearch_to_tsquery(cardText).as('tsQuery')
    ).executeTakeFirstOrThrow()

    query = query
      .where(eb => eb(
        to_tsvector2(eb.ref('mainEffectEn'), eb.ref('echoEffectEn')),
        '@@',
        tsQuery,
      ))
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
    .$if(minPrice != null || maxPrice != null, (eb) => eb.where((eb) => eb.and([
      minPrice ? eb('lastSeenInSalePrice', '>=', minPrice) : null,
      maxPrice ? eb('lastSeenInSalePrice', '<=', maxPrice) : null,
    ].filter(x => x != null))))
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


export async function searchWithCTEsWithExcept(searchQuery: SearchQuery, pageParams: PageParams): Promise<SearchResults> {
  const {
    faction,
    set,
    characterName,
    cardSubTypes,
    cardText,
    triggerPart,
    conditionPart,
    effectPart,
    mainCosts,
    recallCosts,
    forestPowers,
    mountainPowers,
    oceanPowers,
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
    cardText == null &&
    triggerPart == null &&
    conditionPart == null &&
    effectPart == null
  ) {
    return { results: [], pagination: undefined }
  }

  const abilityParts = [
    { part: AbilityPartType.Trigger, text: triggerPart },
    { part: AbilityPartType.Condition, text: conditionPart },
    { part: AbilityPartType.Effect, text: effectPart }
  ]

  const partIncludeSupport = searchQuery.partIncludeSupport ?? false

  const nonNullAbilityParts = abilityParts.filter(x => x.text != null)
    .map(x => {
      const [neg, pos] = partition(tokenize(x.text!), (token) => token.negated)
      return { part: x.part, neg, pos }
    })
    .sort((a, b) => {
      if (a.pos.length > 0 && b.pos.length <= 0) {
        return -1;
      }
      if (a.pos.length <= 0 && b.pos.length > 0) {
        return 1;
      }
      return 0;
    })

  if (debug) {
    console.log("Ability Parts (tokenized):")
    console.dir(nonNullAbilityParts)
  }

  let except0 = false
  let except1 = false
  let except2 = false

  let withQuery = db
    .with('apl0_ids', (eb) => {
      if (nonNullAbilityParts.length > 0) {
        const ap = nonNullAbilityParts[0]
        if (ap.pos.length > 0) {
          return eb.selectFrom('AbilityPartLink')
            .innerJoin('UniqueAbilityPart as upa', 'AbilityPartLink.partId', 'upa.id')
            .select('AbilityPartLink.abilityId')
            .where(({ eb, and }) => {
              return and([
                eb(`upa.partType`, '=', ap.part),
                !partIncludeSupport ? eb(`upa.isSupport`, '=', false) : null,
                ...ap.pos.map(token => eb('upa.textEn', 'ilike', `%${token.text}%`)),
                ...ap.neg.map(token => eb('upa.textEn', 'not ilike', `%${token.text}%`)),
              ].filter(x => x != null))
            })
        } else {
          except0 = true
          return eb.selectFrom('AbilityPartLink')
            .innerJoin('UniqueAbilityPart as upa', 'AbilityPartLink.partId', 'upa.id')
            .select('AbilityPartLink.abilityId')
            .where(({ eb, and }) => {
              return and([
                eb(`upa.partType`, '=', ap.part),
                !partIncludeSupport ? eb(`upa.isSupport`, '=', false) : null,
                ...ap.neg.map(token => eb('upa.textEn', 'ilike', `%${token.text}%`)),
              ].filter(x => x != null))
            })
        }
      } else {
        return eb.selectFrom('AbilityPartLink')
          .select('AbilityPartLink.abilityId')
          .where('AbilityPartLink.id', '=', 0)
      }
    })
    .with('apl1_ids', (eb) => {
      if (nonNullAbilityParts.length > 1) {
        const ap = nonNullAbilityParts[1]
        if (ap.pos.length > 0) {
          return eb.selectFrom('AbilityPartLink')
            .innerJoin('UniqueAbilityPart as upa', 'AbilityPartLink.partId', 'upa.id')
            .select('AbilityPartLink.abilityId')
            .where(({ eb, and }) => {
              return and([
                eb(`upa.partType`, '=', ap.part),
                !partIncludeSupport ? eb(`upa.isSupport`, '=', false) : null,
                ...ap.pos.map(token => eb('upa.textEn', 'ilike', `%${token.text}%`)),
                ...ap.neg.map(token => eb('upa.textEn', 'not ilike', `%${token.text}%`)),
              ].filter(x => x != null))
            })
        } else {
          except1 = true
          return eb.selectFrom('AbilityPartLink')
            .innerJoin('UniqueAbilityPart as upa', 'AbilityPartLink.partId', 'upa.id')
            .select('AbilityPartLink.abilityId')
            .where(({ eb, and }) => {
              return and([
                eb(`upa.partType`, '=', ap.part),
                !partIncludeSupport ? eb(`upa.isSupport`, '=', false) : null,
                ...ap.neg.map(token => eb('upa.textEn', 'ilike', `%${token.text}%`)),
              ].filter(x => x != null))
            })
        }
      } else {
        return eb.selectFrom('AbilityPartLink')
          .select('AbilityPartLink.abilityId')
          .where('AbilityPartLink.id', '=', 0)
      }
    })
    .with('apl2_ids', (eb) => {
      if (nonNullAbilityParts.length > 2) {
        const ap = nonNullAbilityParts[2]
        if (ap.pos.length > 0) {
          return eb.selectFrom('AbilityPartLink')
            .innerJoin('UniqueAbilityPart as upa', 'AbilityPartLink.partId', 'upa.id')
            .select('AbilityPartLink.abilityId')
            .where(({ eb, and }) => {
              return and([
                eb(`upa.partType`, '=', ap.part),
                !partIncludeSupport ? eb(`upa.isSupport`, '=', false) : null,
                ...ap.pos.map(token => eb('upa.textEn', 'ilike', `%${token.text}%`)),
                ...ap.neg.map(token => eb('upa.textEn', 'not ilike', `%${token.text}%`)),
              ].filter(x => x != null))
            })
        } else {
          except2 = true
          return eb.selectFrom('AbilityPartLink')
            .innerJoin('UniqueAbilityPart as upa', 'AbilityPartLink.partId', 'upa.id')
            .select('AbilityPartLink.abilityId')
            .where(({ eb, and }) => {
              return and([
                eb(`upa.partType`, '=', ap.part),
                !partIncludeSupport ? eb(`upa.isSupport`, '=', false) : null,
                ...ap.neg.map(token => eb('upa.textEn', 'ilike', `%${token.text}%`)),
              ].filter(x => x != null))
            })
        }
      } else {
        return eb.selectFrom('AbilityPartLink')
          .select('AbilityPartLink.abilityId')
          .where('AbilityPartLink.id', '=', 0)
      }
    })
    .with('unique_ability_lines', (eb) => {
      if (except0) {
        let q = eb
          .selectFrom('apl0_ids').selectAll()
        if (nonNullAbilityParts.length > 1) {
          q = q.union(eb.selectFrom('apl1_ids').selectAll())
        }
        if (nonNullAbilityParts.length > 2) {
          q = q.union(eb.selectFrom('apl2_ids').selectAll())
        }
        return q
      }
      
      let q = eb.selectFrom('apl0_ids').selectAll()
      if (nonNullAbilityParts.length > 1) {
        if (except1) {
          q = q.except(eb.selectFrom('apl1_ids').selectAll())
        } else {
          q = q.intersect(eb.selectFrom('apl1_ids').selectAll())
        }
      }
      if (nonNullAbilityParts.length > 2) {
        if (except2) {
          q = q.except(eb.selectFrom('apl2_ids').selectAll())
        } else {
          q = q.intersect(eb.selectFrom('apl2_ids').selectAll())
        }
      }
      return q
    })

  let query: SelectQueryBuilder<DB, "UniqueInfo", {}> = withQuery.selectFrom('UniqueInfo')

  // If our search is based on ability parts, we start from UniqueAbilityLine and join to UniqueInfo instead
  if (nonNullAbilityParts.length > 0) {
    // If we only have negative parts, we have inverted the `unique_ability_lines` CTE and need to invert the query here
    if (except0) {
      query = db.selectFrom('UniqueAbilityLine')
        .where('UniqueAbilityLine.id', 'not in', withQuery.selectFrom('unique_ability_lines').select('abilityId'))
        .$if(!partIncludeSupport, (eb) => eb.where('UniqueAbilityLine.isSupport', '=', false))
        .innerJoin('UniqueInfo', 'UniqueAbilityLine.uniqueInfoId', 'UniqueInfo.id')
    } else {
      query = db.selectFrom('UniqueAbilityLine')
        .where('UniqueAbilityLine.id', 'in', withQuery.selectFrom('unique_ability_lines').select('abilityId'))
        .$if(!partIncludeSupport, (eb) => eb.where('UniqueAbilityLine.isSupport', '=', false))
        .innerJoin('UniqueInfo', 'UniqueAbilityLine.uniqueInfoId', 'UniqueInfo.id')
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

  if (cardSubTypes && cardSubTypes.length > 0) {
    // This may be a little paranoid, but there isn't a point in allowing random strings to be passed in here anyway.
    const validSubtypes = cardSubTypes.filter(subtype => allCardSubTypes.map(x => x.value).includes(subtype as CardSubType))
    query = query.where('cardSubTypes', '&&', sql<string[]>`ARRAY[${sql.join(validSubtypes)}]`)
  }

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
    if (Array.isArray(set)) {
      const sets = set.flatMap(s => s === CardSet.Core ? [CardSet.Core, "COREKS"] : s)
      query = query.where('cardSet', 'in', sets)
    } else {
      if (set == CardSet.Core) {
        query = query.where('cardSet', 'in', [CardSet.Core, "COREKS"])
      } else {
        query = query.where('cardSet', '=', set)
      }
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