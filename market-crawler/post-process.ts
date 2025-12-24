import prisma from "@common/utils/prisma.server"
import { AbilityPartType, UniqueAbilityPart, PrismaClient, UniqueInfo, Prisma } from "@prisma/client"
import { unique } from "radash"
import { getEnv } from "./helpers";
import { ITXClientDenyList } from "@prisma/client/runtime/library";
import { AbilityCharacterDataV1, PartCharacterData } from "@common/models/postprocess";
import { CardSet } from "@common/models/cards";


const verboseLevel = parseInt(getEnv("VERBOSE_LEVEL") ?? "1");

type ProcessedAbility = Omit<PartCharacterData, "partId"> & { partText: string, enPartText?: string, partId?: number }

interface ProcessedCard {
  uniqueInfo: UniqueInfo
  mainAbilities: ProcessedAbilityLine[]
  echoAbilities: ProcessedAbilityLine[]
}

interface ProcessedAbilityLine {
  textEn?: string
  textFr?: string
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
function splitLinesWithIndices(text: string | null | undefined): { line: string, startIndex: number, endIndex: number }[] {
  if (!text) return [];
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

function processOneCard(cardIn: UniqueInfo, mainEffect: string | null, echoEffect: string | null, locale: string): ProcessedCard {
  // start by making a copy, with the ability texts normalized
  let mainEff = normalizeAbilityText(mainEffect) ?? '';
  let echoEff = normalizeAbilityText(echoEffect) ?? '';
  if (locale === "fr-fr") {
    mainEff = normalizeAbilityText(mainEffect) ?? '';
    echoEff = normalizeAbilityText(echoEffect) ?? '';
  }

  let mainLines = mainEff ? splitLinesWithIndices(mainEff) : [];
  // Support abilities only have a single line right now
  let echoLines = echoEff ? [echoEff] : [];

  let mainAbilities: ProcessedAbilityLine[] = mainLines.map((lineData, lineNumber) => {
    const { line, startIndex, endIndex } = lineData;

    let trigger: ProcessedAbility | undefined = undefined;
    let condition: ProcessedAbility | undefined = undefined;
    let effect: ProcessedAbility | undefined = undefined;
    let extraEffectParts: ProcessedAbility[] = [];

    // Search for a few exceptions first
    if (line.indexOf("Then, depending on the number of boosts removed this way") != -1 ||
        line.indexOf("Puis, en fonction du nombre de boosts retirés de cette manière") != -1) {
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
    else if (line.startsWith("When my Expedition fails to move forward during Dusk — After Rest") ||
      line.startsWith("Lorsque mon Expédition n'avance pas pendant le Crépuscule — Après le Repos")) {
      // The Bureaucrats ability always uses After Rest after the long-dash, but that should really be part
      // of the trigger. Note that there doesn't seem to be any card that use this trigger and a condition, but the
      // empty-condition [] marker is still there, so we handle it here, assuming a condition would end with a colon.
      let matches = line.match(/^(When my Expedition fails to move forward during Dusk — After Rest:)\s+(\[\]|.+?:)(.*)$/id);
      if(!matches) {
        matches = line.match(/^(Lorsque mon Expédition n'avance pas pendant le Crépuscule — Après le Repos:)\s+(\[\]|.+?:)(.*)$/id);
      }
      if (matches) {
        trigger = buildProcessedAbility(line, matches, 1);
        condition = buildProcessedAbility(line, matches, 2, { subIfEmpty: "$noCondition" });
        effect = buildProcessedAbility(line, matches, 2);
      }
    }
    else if (line.startsWith("When") || line.startsWith("Lorsque")) {
      const processWhens = (fullLine: string, matches: RegExpMatchArray | null, r: any): boolean => {
        if (matches) {
          trigger = buildProcessedAbility(fullLine, matches, 1);
          condition = buildProcessedAbility(fullLine, matches, 2, { subIfEmpty: "$noCondition" });
          effect = buildProcessedAbility(fullLine, matches, 3);

          return true;
        } else {
          // Some cards are missing the [] for empty condition, use this other pattern:
          const matches = fullLine.match(r);
          if (matches) {
            trigger = buildProcessedAbility(fullLine, matches, 1);
            condition = buildEmptyProcessedAbility(fullLine, matches, 1, "$noCondition");
            effect = buildProcessedAbility(fullLine, matches, 2);

            return true;
          }
        }
        return false;
      }
      
      const matches = line.match(/^((?:When .*?)|{H}|{R}|{J})\s+—\s+(\[\]|.+?:)(.*)$/id);
      let found = processWhens(line, matches, /^((?:When .*?)|{H}|{R}|{J})\s+—\s+(.*)$/id);
      if(!found) {
        const matches = line.match(/^((?:Lorsque .*?)|{H}|{R}|{J})\s+—\s+(\[\]|.+?:)(.*)$/id);
        found = processWhens(line, matches, /^((?:Lorsque .*?)|{H}|{R}|{J})\s+—\s+(.*)$/id);
        if (!found) {
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
    } else if (line.startsWith("At") || line.startsWith("Au Crépuscule") || line.startsWith("À midi")) {
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

    const result: ProcessedAbilityLine = {
      lineNumber,
      isSupport: false,
      lineStartIndex: startIndex,
      lineEndIndex: endIndex,
      trigger,
      condition,
      effect,
      extraEffectParts,
    }
    if(locale === "fr-fr") {
      result.textFr = line;
    } else {
      result.textEn = line;
    }
    return result;
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

    const result: ProcessedAbilityLine = {
      lineNumber: 0,
      isSupport: true,
      lineStartIndex: 0,
      lineEndIndex: line.length,
      trigger,
      condition,
      effect,
    }
    if (locale === "fr-fr") {
      result.textFr = line;
    } else {
      result.textEn = line;
    }
    return result;
  })

  return {
    uniqueInfo: { ...cardIn },
    mainAbilities,
    echoAbilities,
  }
}

let mainAbilityPartsCache: Record<string, UniqueAbilityPart> = {};

async function upsertAbilityPart(
  partType: AbilityPartType,
  isSupport: boolean,
  ability: ProcessedAbility | undefined,
  tx?: Omit<PrismaClient, ITXClientDenyList>,
  locale?: string
): Promise<(UniqueAbilityPart & PartCharacterData) | undefined> {
  if (!ability) {
    return undefined;
  }
  let textEn = "";
  let textFr = "";
  let text = ability.partText;

  const key = `${partType}-${isSupport}__${text}__${locale?.split('-')?.at(0) || "en"}`;
  if(locale === "fr-fr") {
    textFr = text;
    if (ability.enPartText) {
      textEn = ability.enPartText;
    }
  } else {
    textEn = text;
  }

  let part: UniqueAbilityPart | undefined = undefined;
  if (mainAbilityPartsCache[key]) {
    part = mainAbilityPartsCache[key];
  } else {
    const db = tx ?? prisma;
      part = await db.uniqueAbilityPart.upsert({
      where: {
        textEn_partType_isSupport: {
          textEn: textEn,
          partType: partType,
          isSupport: isSupport,
        },
      },
      update: {
        textEn: textEn,
        textFr: textFr,
      },
      create: {
        textEn: textEn,
        partType: partType,
        isSupport: isSupport,
      }
    });
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

export async function upsertOneAbilityLine(uniqueInfoId: number, ability: ProcessedAbilityLine, tx: Omit<PrismaClient, ITXClientDenyList>, locale?: string) {
  let allParts: ((UniqueAbilityPart & PartCharacterData) | undefined)[] = [];
  let extraEffectParts: (UniqueAbilityPart & PartCharacterData)[] = [];

  allParts.push(await upsertAbilityPart(AbilityPartType.Trigger, ability.isSupport, ability.trigger, tx, locale));
  allParts.push(await upsertAbilityPart(AbilityPartType.Condition, ability.isSupport, ability.condition, tx, locale));
  allParts.push(await upsertAbilityPart(AbilityPartType.Effect, ability.isSupport, ability.effect, tx, locale));

  if (ability.extraEffectParts) {
    for (let extraEffectPart of ability.extraEffectParts) {
      const part = await upsertAbilityPart(AbilityPartType.Effect, ability.isSupport, extraEffectPart, tx, locale);
      if (part) {
        extraEffectParts.push(part);
      }
    }
  }

  const allPartsNotNull = allParts.filter(part => part != null);

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

  const characterData: any = {
    version: 1,
  }
  if (locale === "fr-fr") {
    characterData.lineStartIndexFr = ability.lineStartIndex,
    characterData.lineEndIndexFr = ability.lineEndIndex,
    characterData.partsFr = [
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
  } else {
    characterData.lineStartIndex = ability.lineStartIndex,
    characterData.lineEndIndex = ability.lineEndIndex,
    characterData.parts = [
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
    textFr: ability.textFr,
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

  if (dbAbility) {
    dbAbilityId = dbAbility.id;
    const existingLine = await tx.uniqueAbilityLine.findUniqueOrThrow({ where: { id: dbAbility.id }, include: { allParts: true } });
    if (existingLine.textEn == blob.textEn && JSON.stringify(existingLine.characterData) != JSON.stringify(blob.characterData)
    ) {
      blob.characterData = {
        ...blob.characterData,
        ...existingLine.characterData as any
      };
    }

    const partsToDelete = dbAbility.allParts.filter(pl => (partsForAdding.find(p => p.id == pl.partId && p.partType == pl.partType) == null));
    const res = await tx.uniqueAbilityLine.update({
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

export async function processAndWriteOneUnique(unique: UniqueInfo, tx: Omit<PrismaClient, ITXClientDenyList>, locale?: string) {
  let processedCard: ProcessedCard | undefined = undefined;
  if (locale === "fr-fr") {
    processedCard = processOneCard(unique, unique.mainEffectFr, unique.echoEffectFr, locale || 'fr-fr');
    // when running for fr-fr, we still need to get the English texts for each ability part before upsert logic, as uniqueness is verified over english text
    const processCardForEnLocal = processOneCard(unique, unique.mainEffectEn, unique.echoEffectEn, 'en-us');
    processedCard.mainAbilities.map((ma, idx) => {
      const enMa = processCardForEnLocal.mainAbilities[idx];
      ma.textEn = enMa.textEn;
      ma.trigger && (ma.trigger.enPartText = enMa.trigger?.partText);
      ma.condition && (ma.condition.enPartText = enMa.condition?.partText);
      ma.effect && (ma.effect.enPartText = enMa.effect?.partText);
    });
    processedCard.echoAbilities.map((ea, idx) => {
      const enEa = processCardForEnLocal.echoAbilities[idx];
      ea.textEn = enEa.textEn;
      ea.trigger && (ea.trigger.enPartText = enEa.trigger?.partText);
      ea.condition && (ea.condition.enPartText = enEa.condition?.partText);
      ea.effect && (ea.effect.enPartText = enEa.effect?.partText);    
    });
  } else {
    processedCard = processOneCard(unique, unique.mainEffectEn, unique.echoEffectEn, locale || 'en-us');
  }
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
    await writeProcessedCard(processedCard, unique, tx, locale);
  }
}

let textUpdatedCount = 0;
async function writeProcessedCard(processedCard: ProcessedCard, originalUnique: UniqueInfo, tx: Omit<PrismaClient, ITXClientDenyList>, locale?: string) {
  if (originalUnique.mainEffectEn != processedCard.uniqueInfo.mainEffectEn || originalUnique.echoEffectEn != processedCard.uniqueInfo.echoEffectEn
    || originalUnique.mainEffectFr != processedCard.uniqueInfo.mainEffectFr || originalUnique.echoEffectFr != processedCard.uniqueInfo.echoEffectFr
  ) {
    // We might have modified the mainEffectEn/echoEffectEn strings to fix some typos
    // so we update the UniqueInfo record with the new strings
    textUpdatedCount += 1;
    await tx.uniqueInfo.update({
      where: { id: processedCard.uniqueInfo.id },
      data: {
        mainEffectEn: processedCard.uniqueInfo.mainEffectEn,
        echoEffectEn: processedCard.uniqueInfo.echoEffectEn,
        mainEffectFr: processedCard.uniqueInfo.mainEffectFr,
        echoEffectFr: processedCard.uniqueInfo.echoEffectFr,
      }
    })
  }

  for (let ability of processedCard.mainAbilities) {
    await upsertOneAbilityLine(processedCard.uniqueInfo.id, ability, tx, locale);
  }
  for (let ability of processedCard.echoAbilities) {
    await upsertOneAbilityLine(processedCard.uniqueInfo.id, ability, tx, locale);
  }
}

export async function processUniquesBatch(fromPage: number = 0, toPage: number | undefined = undefined, batchSize = 100, locale: string) {
  let page = fromPage;
  console.log(`Starting batch from ${fromPage} to ${toPage} (batchSize=${batchSize})`)
  while (toPage && page < toPage) {

    const startTs = Date.now();

    let batchUniques = await prisma.uniqueInfo.findMany({
      where: {
        fetchedDetails: true,
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

    const readTs = Date.now();
    const readTime = readTs - startTs;

    const processedCards: { original: UniqueInfo, processed: ProcessedCard }[] = batchUniques
      .map(u => {
        let processedCard: ProcessedCard | undefined = undefined;
        if (locale === "fr-fr") {
          processedCard = processOneCard(u, u.mainEffectFr, u.echoEffectFr, locale || 'fr-fr');
        } else {
          processedCard = processOneCard(u, u.mainEffectEn, u.echoEffectEn, locale || 'en-us');
        }
        return { original: u, processed: processedCard }
      })
      .filter(pc => pc.processed.mainAbilities.length > 0 || pc.processed.echoAbilities.length > 0)

    const processTs = Date.now();
    const processTime = processTs - readTs;

    await prisma.$transaction(async (tx) => {
      for (let { original, processed } of processedCards) {
        await writeProcessedCard(processed, original, tx, locale);
        totalProcessed += 1;
      }
    }, { timeout: 60000 })

    const endTs = Date.now();
    const writeTime = endTs - processTs;
    const totalTime = endTs - startTs;
    const cardsPerSecond = (batchUniques.length * 1000) / totalTime;
    console.log(`Done with page ${page} (${totalProcessed} cards processed - ${textUpdatedCount} txt updated) - cards/s=${Math.round(cardsPerSecond)} - read=${readTime}ms, process=${processTime}ms, write=${writeTime}ms, total=${totalTime}ms`)
    page += 1;
  }
}
