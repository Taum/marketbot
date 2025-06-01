import prisma from "@common/utils/prisma.server"
import { AbilityPartType, UniqueAbilityPart, PrismaClient, UniqueInfo, Prisma } from "@prisma/client"
import { unique } from "radash"
import { getEnv } from "./helpers";
import { ITXClientDenyList } from "@prisma/client/runtime/library";
import { PartCharacterData } from "@common/models/postprocess";
import { CardSet } from "@common/models/cards";


const verboseLevel = parseInt(getEnv("VERBOSE_LEVEL") ?? "1");

type ProcessedAbility = Omit<PartCharacterData, "partId"> & { partText: string, partId?: number }

interface ProcessedCard {
  uniqueInfo: UniqueInfo
  mainAbilities: ProcessedAbilityLine[]
  echoAbilities: ProcessedAbilityLine[]
}

interface ProcessedAbilityLine {
  textEn: string
  lineNumber: number
  isSupport: boolean
  lineStartIndex: number
  lineEndIndex: number
  trigger?: ProcessedAbility
  condition?: ProcessedAbility
  effect?: ProcessedAbility
  extraEffectParts?: ProcessedAbility[]
}


function buildProcessedAbility(
  fullText: string,
  match: RegExpMatchArray,
  index: number,
  { subIfEmpty }: { subIfEmpty?: string } = {}
): ProcessedAbility {
  // Typescript compiler doesn't seem to know about the indices property on RegExpMatchArray
  const enhancedMatch = match as RegExpMatchArray & { indices: [number, number][] };

  let [startIndex, endIndex] = enhancedMatch.indices[index];
  let partText = fullText.slice(startIndex, endIndex);

  // We remove leading and trailing spaces and update the start/end indices
  let m: RegExpMatchArray | null = null;
  if (m = partText.match(/^(\s+)/)) {
    startIndex += m[0].length;
    partText = partText.slice(m[0].length);
  }
  if (m = partText.match(/(\s+)$/)) {
    endIndex -= m[0].length;
    partText = partText.slice(0, -m[0].length);
  }

  return {
    startIndex,
    endIndex,
    substituteText: partText == "[]" ? subIfEmpty : undefined,
    partText,
  }
}

function buildEmptyProcessedAbility(
  _fullText: string,
  previousMatch: RegExpMatchArray,
  previousIndex: number,
  substituteText: string,
): ProcessedAbility {
  const enhancedMatch = previousMatch as RegExpMatchArray & { indices: [number, number][] };

  const [_, prevEndIndex] = enhancedMatch.indices[previousIndex];
  const startIndex = prevEndIndex + 1;
  const endIndex = startIndex;
  return {
    startIndex,
    endIndex,
    substituteText,
    partText: "[]",
  }
}

// This splits each ability of the abilities text box, usually separated by two consecutive spaces.
// The exception is when there is a "•" character, which is used to separate the modes. We keep that as
// a single ability line.
function splitLinesWithIndices(text: string): { line: string, startIndex: number, endIndex: number }[] {
  const splits = Array.from(text.matchAll(/  (?!•)/gid));
  if (splits.length == 0) {
    return [{ line: text, startIndex: 0, endIndex: text.length }];
  }
  let j = 0;
  let out: { line: string, startIndex: number, endIndex: number }[] = [];
  for (let i = 0; i < splits.length; i++) {
    let [splitStart, splitEnd] = (splits[i] as any).indices[0] as [number, number];
    out.push({ line: text.slice(j, splitStart), startIndex: j, endIndex: splitStart });
    j = splitEnd;
  }
  out.push({ line: text.slice(j), startIndex: j, endIndex: text.length });
  return out;
}

function normalizeAbilityText(text: string | null | undefined): string | undefined {
  if (!text) {
    return undefined;
  }
  return text
    // Convert any non-breaking spaces to normal spaces
    .replace(/\s/g, "\u0020")
    // .replace("\u00a0", "\u0020")
    // Convert any {*} symbols to uppercase.
    // Meant to fix some cards that have {r}, {j}, {j} instead of {R}, {H}, {J}
    .replace(/\{(\w)\}/g, (m) => `{${m[1].toUpperCase()}}`)
}

function processOneCard(cardIn: UniqueInfo): ProcessedCard | null {

  // start by making a copy, with the ability texts normalized
  const card = {
    ...cardIn,
    mainEffectEn: normalizeAbilityText(cardIn.mainEffectEn) ?? null,
    echoEffectEn: normalizeAbilityText(cardIn.echoEffectEn) ?? null,
  };

  let mainLines = card.mainEffectEn ? splitLinesWithIndices(card.mainEffectEn) : [];
  // Support abilities only have a single line right now
  let echoLines = card.echoEffectEn ? [card.echoEffectEn] : [];

  let mainAbilities: ProcessedAbilityLine[] = mainLines.map((lineData, lineNumber) => {
    const { line, startIndex, endIndex } = lineData;

    let trigger: ProcessedAbility | undefined = undefined;
    let condition: ProcessedAbility | undefined = undefined;
    let effect: ProcessedAbility | undefined = undefined;
    let extraEffectParts: ProcessedAbility[] = [];

    // Search for a few exceptions first
    if (line.indexOf("Then, depending on the number of boosts removed this way") != -1) {
      // This is a "Man in the Maze" ability, try to find the sub effects
      const matches = line.match(/({H}|{R}|{J})\s+(.*?)\s+(• \d+\+:)(.*?)(• \d+\+:)(.*?)(• \d+\+:)(.*?)$/id)
      if (matches) {
        trigger = buildProcessedAbility(line, matches, 1);
        condition = buildEmptyProcessedAbility(line, matches, 1, "$noCondition"); //
        effect = buildProcessedAbility(line, matches, 2);
        // if (verboseLevel >= 2) {
        //   console.log("Extra effects:")
        //   console.log(matches[3], " ==> ", matches[4])
        //   console.log(matches[5], " ==> ", matches[6])
        //   console.log(matches[7], " ==> ", matches[8])
        // }
        extraEffectParts.push(buildProcessedAbility(line, matches, 4))
        extraEffectParts.push(buildProcessedAbility(line, matches, 6))
        extraEffectParts.push(buildProcessedAbility(line, matches, 8))
      }
    }
    else if (line.startsWith("When my Expedition fails to move forward during Dusk — After Rest")) {
      // The Bureaucrats ability always uses After Rest after the long-dash, but that should really be part
      // of the trigger. Note that there doesn't seem to be any card that use this trigger and a condition, but the
      // empty-condition [] marker is still there, so we handle it here, assuming a condition would end with a colon.
      const matches = line.match(/^(When my Expedition fails to move forward during Dusk — After Rest:)\s+(\[\]|.+?:)(.*)$/id);
      if (matches) {
        trigger = buildProcessedAbility(line, matches, 1);
        condition = buildProcessedAbility(line, matches, 2, { subIfEmpty: "$noCondition" });
        effect = buildProcessedAbility(line, matches, 2);
      }
    }
    else if (line.startsWith("When")) {
      const matches = line.match(/^((?:When .*?)|{H}|{R}|{J})\s+—\s+(\[\]|.+?:)(.*)$/id);
      if (matches) {
        trigger = buildProcessedAbility(line, matches, 1);
        condition = buildProcessedAbility(line, matches, 2, { subIfEmpty: "$noCondition" });
        effect = buildProcessedAbility(line, matches, 3);
      } else {
        // Some cards are missing the [] for empty condition, use this other pattern:
        const matches = line.match(/^((?:When .*?)|{H}|{R}|{J})\s+—\s+(.*)$/id);
        if (matches) {
          trigger = buildProcessedAbility(line, matches, 1);
          condition = buildEmptyProcessedAbility(line, matches, 1, "$noCondition");
          effect = buildProcessedAbility(line, matches, 2);
        } else {
          console.error("Line did not match 'When' pattern: " + line)
        }
      }
    } else if (line.startsWith("{H}") || line.startsWith("{R}") || line.startsWith("{J}")) {
      const matches = line.match(/^({H}|{R}|{J})\s+(\[\]|.+?:)(.*)$/id)
      if (matches) {
        trigger = buildProcessedAbility(line, matches, 1);
        condition = buildProcessedAbility(line, matches, 2, { subIfEmpty: "$noCondition" });
        effect = buildProcessedAbility(line, matches, 3);
      } else {
        console.error("Line did not match 'H/R/J' pattern: " + line)
      }
    } else if (line.startsWith("At")) {
      const matches = line.match(/^(.*)—\s+(\[\]|.+?:)(.*)$/id)
      if (matches) {
        trigger = buildProcessedAbility(line, matches, 1);
        condition = buildProcessedAbility(line, matches, 2, { subIfEmpty: "$noCondition" });
        effect = buildProcessedAbility(line, matches, 3);
      } else {
        // At Night is missing []. Maybe it does not support a condition?  use this other pattern:
        const matches = line.match(/^(At Night)\s+—\s+(.*)$/id)
        if (matches) {
          trigger = buildProcessedAbility(line, matches, 1);
          condition = buildEmptyProcessedAbility(line, matches, 1, "$noCondition"); //
          effect = buildProcessedAbility(line, matches, 2);
        } else {
          console.error("Line did not match 'At (Phase)' pattern: " + line)
        }
      }
    } else if (line.startsWith("[]")) {
      // These are actually Static abilities, not triggered
      const matches = line.match(/^(\[\])\s*(\[\]|.+?:)(.*)$/id)
      if (matches) {
        trigger = buildProcessedAbility(line, matches, 1, { subIfEmpty: "$static" });
        condition = buildProcessedAbility(line, matches, 2, { subIfEmpty: "$noCondition" });
        effect = buildProcessedAbility(line, matches, 3);
      } else {
        console.error("Line did not match Static pattern: " + line)
      }
    } else {
      console.error("Line does not match any known pattern: " + line)
    }

    return {
      textEn: line,
      lineNumber,
      isSupport: false,
      lineStartIndex: startIndex,
      lineEndIndex: endIndex,
      trigger,
      condition,
      effect,
      extraEffectParts,
    }
  })

  let echoAbilities: ProcessedAbilityLine[] = echoLines.map(line => {

    let trigger: ProcessedAbility | undefined = undefined;
    let condition: ProcessedAbility | undefined = undefined;
    let effect: ProcessedAbility | undefined = undefined;

    if (line.startsWith("{D}")) {
      const matches = line.match(/^({D})\s+:\s+\[\](.*)$/id)
      if (matches) {
        trigger = buildProcessedAbility(line, matches, 1);
        effect = buildProcessedAbility(line, matches, 2);
      } else {
        console.error("Line did not match '{D}' pattern: " + line)
      }
    } else if (line.startsWith("{I}") && line.match(/—/) == null) {
      // This is a passive support
      const matches = line.match(/^({I})\s+(\[\]|.*:)(.*)$/id)
      if (matches) {
        trigger = buildProcessedAbility(line, matches, 1);
        condition = buildProcessedAbility(line, matches, 2, { subIfEmpty: "$noCondition" });
        effect = buildProcessedAbility(line, matches, 3);
      } else {
        console.error("Line did not match passive support pattern: " + line)
      }
    } else if (line.startsWith("{I} When") || line.startsWith("{I} At")) {
      // This is a triggered support
      const matches = line.match(/^(.*)—\s+(\[\]|.*:)(.*)$/id)
      if (matches) {
        trigger = buildProcessedAbility(line, matches, 1);
        condition = buildProcessedAbility(line, matches, 2, { subIfEmpty: "$noCondition" });
        effect = buildProcessedAbility(line, matches, 3);
      } else {
        console.error("Line did not match triggered support pattern: " + line)
      }
    } else {
      console.error("Line does not match any known pattern: " + line)
    }

    return {
      textEn: line,
      lineNumber: 0,
      isSupport: true,
      lineStartIndex: 0,
      lineEndIndex: line.length,
      trigger,
      condition,
      effect,
    }
  })

  return {
    uniqueInfo: card,
    mainAbilities,
    echoAbilities,
  }
}

let mainAbilityPartsCache: Record<string, UniqueAbilityPart> = {};

async function upsertAbilityPart(
  partType: AbilityPartType,
  isSupport: boolean,
  ability: ProcessedAbility | undefined,
  tx?: Omit<PrismaClient, ITXClientDenyList>
): Promise<(UniqueAbilityPart & PartCharacterData) | undefined> {
  if (!ability) {
    return undefined;
  }
  const text = ability.partText;

  const key = `${partType}-${isSupport}__${text}`;

  let part: UniqueAbilityPart | undefined = undefined;
  if (mainAbilityPartsCache[key]) {
    part = mainAbilityPartsCache[key];
  } else {
    const db = tx ?? prisma;
    part = await db.uniqueAbilityPart.upsert({
      where: {
        textEn_partType_isSupport: {
          textEn: text,
          partType: partType,
          isSupport: isSupport,
        }
      },
      update: {},
      create: {
        textEn: text,
        partType: partType,
        isSupport: isSupport,
      }
    })
    mainAbilityPartsCache[key] = part;
  }
  if (verboseLevel >= 3) {
    console.log(` --> Part #${part.id} / ${part.partType} (${part.textEn})`)
  }
  return {
    ...ability,
    ...part,
    partId: part.id,
  };
}

let totalProcessed = 0;

export async function upsertOneAbilityLine(uniqueInfoId: number, ability: ProcessedAbilityLine, tx: Omit<PrismaClient, ITXClientDenyList>) {
  let allParts: ((UniqueAbilityPart & PartCharacterData) | undefined)[] = [];
  let extraEffectParts: (UniqueAbilityPart & PartCharacterData)[] = [];

  allParts.push(await upsertAbilityPart(AbilityPartType.Trigger, ability.isSupport, ability.trigger, tx));
  allParts.push(await upsertAbilityPart(AbilityPartType.Condition, ability.isSupport, ability.condition, tx));
  allParts.push(await upsertAbilityPart(AbilityPartType.Effect, ability.isSupport, ability.effect, tx));

  if (ability.extraEffectParts) {
    for (let extraEffectPart of ability.extraEffectParts) {
      const part = await upsertAbilityPart(AbilityPartType.Effect, ability.isSupport, extraEffectPart, tx);
      if (part) {
        extraEffectParts.push(part);
      }
    }
  }

  const allPartsNotNull = allParts.filter(part => part != null);

  const characterData = {
    version: 1,
    lineStartIndex: ability.lineStartIndex,
    lineEndIndex: ability.lineEndIndex,
    parts: [
      ...allPartsNotNull.map((p) => ({
        partId: p.id,
        startIndex: p.startIndex,
        endIndex: p.endIndex,
        substituteText: p.substituteText,
      })),
      ...extraEffectParts.map(p => ({
        partId: p.id,
        startIndex: p.startIndex,
        endIndex: p.endIndex,
        substituteText: p.substituteText,
      }))
    ].filter(part => part != null)
  }

  let partsForAdding: UniqueAbilityPart[] = [
    ...allPartsNotNull,
    // It's rare but possible that an effect has the same extra part repeated, in this case we only add it once
    // since we're only interested in linking the part to the ability. The CharacterData will have the repeated info
    ...unique(extraEffectParts.map(p => ({
      ...p,
      partType: AbilityPartType.ExtraEffect,
    })), (p) => p.id),
  ]

  let blob = {
    textEn: ability.textEn,
    isSupport: ability.isSupport,
    characterData: characterData,
    allParts: {
      create: partsForAdding.map(part => ({
        partType: part.partType,
        part: {
          connect: {
            id: part.id,
          }
        }
      })),
    },
  }

  let dbAbilityId: number | undefined = undefined;
  let dbAbility = await tx.uniqueAbilityLine.findUnique({
    where: {
      uniqueInfoId_lineNumber_isSupport: {
        uniqueInfoId: uniqueInfoId,
        lineNumber: ability.lineNumber,
        isSupport: ability.isSupport,
      }
    },
    include: {
      allParts: true,
    }
  })
  if (dbAbility) {
    dbAbilityId = dbAbility.id;
    const partsToDelete = dbAbility.allParts.filter(pl => (partsForAdding.find(p => p.id == pl.partId && p.partType == pl.partType) == null));
    await tx.uniqueAbilityLine.update({
      where: { id: dbAbility.id },
      data: {
        ...blob,
        allParts: {
          delete: partsToDelete.map(p => ({ id: p.id })),
          upsert: partsForAdding.map(p => ({
            where: { partId_abilityId: { partId: p.id, abilityId: dbAbility.id } },
            update: {
              partType: p.partType,
            },
            create: {
              partId: p.id,
              partType: p.partType,
            }
          })),
        }
      },
    })
  } else {
    const res = await tx.uniqueAbilityLine.create({
      data: {
        uniqueInfoId: uniqueInfoId,
        lineNumber: ability.lineNumber,
        ...blob,
      }
    })
    dbAbilityId = res.id;
  }

  if (verboseLevel >= 3) {
    const getDbAbility = await tx.uniqueAbilityLine.findUniqueOrThrow({ where: { id: dbAbilityId }, include: { allParts: true } })
    console.log(` - ${ability.textEn}`)
    console.log(` --> Ability #${dbAbilityId} (parts: ${getDbAbility.allParts.map(p => `${p.partType}=${p.partId}@${p.id}`).join(", ")})`)
  }
}

export async function processOneUnique(unique: UniqueInfo, tx: Omit<PrismaClient, ITXClientDenyList>) {
  let processedCard = processOneCard(unique);
  if (processedCard && (processedCard.mainAbilities.length > 0 || processedCard.echoAbilities.length > 0)) {

    if (verboseLevel >= 2) {
      console.log(`---------------------`)
      console.log(`${processedCard.uniqueInfo.nameEn} (${processedCard.uniqueInfo.ref})`)
      if (processedCard.uniqueInfo.mainEffectEn) {
        console.log(`main: ${processedCard.uniqueInfo.mainEffectEn}`)
      }
      if (processedCard.uniqueInfo.echoEffectEn) {
        console.log(`echo: ${processedCard.uniqueInfo.echoEffectEn}`)
      }
    }

    // We might have modified the mainEffectEn/echoEffectEn strings to fix some typos
    // so we update the UniqueInfo record with the new strings
    await tx.uniqueInfo.update({
      where: { id: unique.id },
      data: {
        mainEffectEn: processedCard.uniqueInfo.mainEffectEn,
        echoEffectEn: processedCard.uniqueInfo.echoEffectEn,
      }
    })

    for (let ability of processedCard.mainAbilities) {
      await upsertOneAbilityLine(processedCard.uniqueInfo.id, ability, tx);
    }
    for (let ability of processedCard.echoAbilities) {
      await upsertOneAbilityLine(processedCard.uniqueInfo.id, ability, tx);
    }
  }
}

export async function processUniquesBatch(fromPage: number = 0, toPage: number | undefined = undefined, batchSize = 500) {
  let page = fromPage;
  console.log(`Starting batch from ${fromPage} to ${toPage}`)
  while (toPage && page < toPage) {

    const startTs = Date.now();

    let batchUniques = await prisma.uniqueInfo.findMany({
      where: {
        fetchedDetails: true,
        cardSet: {
          in: [CardSet.BISE]
        },
        // nameEn: {
        //   equals: "Thoth",
        // }
        // AND: [
        //   { mainEffectEn: { not: null } }
        //   { echoEffectEn: { not: null } }
        // ]
      },
      orderBy: {
        id: "asc",
      },
      take: batchSize,
      skip: batchSize * page,
    })

    if (batchUniques.length == 0) {
      console.log(`Reached end of UniqueInfo (at page ${page})`)
      break;
    }

    await prisma.$transaction(async (tx) => {
      for (let unique of batchUniques) {
        await processOneUnique(unique, tx);
        totalProcessed += 1;
      }
    }, { timeout: 30000 })

    const endTs = Date.now();
    const processingTime = endTs - startTs;
    const cardsPerSecond = (batchUniques.length * 1000) / processingTime;
    console.log(`Done with page ${page} (${totalProcessed} cards processed in ${processingTime}ms (${Math.round(cardsPerSecond)} cards/s))`)
    page += 1;
  }
}
