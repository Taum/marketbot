import prisma from "@common/utils/prisma.server"
import { AbilityPartType, MainUniqueAbilityPart, PrismaClient, UniqueInfo } from "@prisma/client"
import { pick } from "radash"
import { getEnv } from "./helpers";
import { ITXClientDenyList } from "@prisma/client/runtime/library";
import { PartCharacterData } from "@common/models/postprocess";


const verboseLevel = parseInt(getEnv("VERBOSE_LEVEL") ?? "1");

type ProcessedAbility = Omit<PartCharacterData, "partId"> & { partText: string, partId?: number }

interface ProcessedCard {
  uniqueInfo: UniqueInfo
  mainAbilities: {
    textEn: string
    lineStartIndex: number
    lineEndIndex: number
    triggerText: ProcessedAbility | undefined
    conditionText: ProcessedAbility | undefined
    effectText: ProcessedAbility | undefined
    extraEffectParts: ProcessedAbility[]
  }[]
  echoAbilities: {
    textEn: string
    triggerText: ProcessedAbility | undefined
    conditionText: ProcessedAbility | undefined
    effectText: ProcessedAbility | undefined
  }[]
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
  const startIndex = prevEndIndex+1;
  const endIndex = startIndex;
  return {
    startIndex,
    endIndex,
    substituteText,
    partText: "[]",
  }
}

/*
---
// {H} []Target a Character in play or in Reserve other than me. Then, roll a die:  • On a 4+, we both gain 1 boost.  • On a 1-3, it gains 1 boost.  When a Character in your Reserve gains 1 or more boosts — []Target Character gains 2 boosts.
*/

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


function processOneCard(card: UniqueInfo): ProcessedCard | null {

  if (!card.mainEffectEn) {
    return null;
  }

  let mainLines = splitLinesWithIndices(card.mainEffectEn);
  // Support abilities only have a single line right now
  let echoLines = card.echoEffectEn ? [card.echoEffectEn] : [];

  let mainAbilities: ProcessedCard["mainAbilities"] = mainLines.map(lineData => {
    const { line, startIndex, endIndex } = lineData;

    let triggerText: ProcessedAbility | undefined = undefined;
    let conditionText: ProcessedAbility | undefined = undefined;
    let effectText: ProcessedAbility | undefined = undefined;
    let extraEffectParts: ProcessedAbility[] = [];

    // Search for a few exceptions first
    if (line.indexOf("Then, depending on the number of boosts removed this way") != -1) {
      // This is a "Man in the Maze" ability, try to find the sub effects
      const matches = line.match(/({H}|{R}|{J})\s+(.*?)\s+(• \d+\+:)(.*?)(• \d+\+:)(.*?)(• \d+\+:)(.*?)$/id)
      if (matches) {
        triggerText = buildProcessedAbility(line, matches, 1);
        conditionText = buildEmptyProcessedAbility(line, matches, 1, "$noCondition"); //
        effectText = buildProcessedAbility(line, matches, 2);
        if (verboseLevel >= 2) {
          console.log("Extra effects:")
          console.log(matches[3], " ==> ", matches[4])
          console.log(matches[5], " ==> ", matches[6])
          console.log(matches[7], " ==> ", matches[8])
        }
        extraEffectParts.push(buildProcessedAbility(line, matches, 4))
        extraEffectParts.push(buildProcessedAbility(line, matches, 6))
        extraEffectParts.push(buildProcessedAbility(line, matches, 8))
      }
    }
    // else if (line.indexOf("Then, depending on the number of boosts removed this way") != -1) {
    // }
    else if (line.startsWith("When")) {
      const matches = line.match(/^((?:When .*?)|{H}|{R}|{J})\s+—\s+(\[\]|.*:)(.*)$/id);
      if (matches) {
        triggerText = buildProcessedAbility(line, matches, 1);
        conditionText = buildProcessedAbility(line, matches, 2, { subIfEmpty: "$noCondition" });
        effectText = buildProcessedAbility(line, matches, 3);
      } else {
        // Some cards are missing the [] for empty condition, use this other pattern:
        const matches = line.match(/^((?:When .*?)|{H}|{R}|{J})\s+—\s+(.*)$/id);
        if (matches) {
          triggerText = buildProcessedAbility(line, matches, 1);
          conditionText = buildEmptyProcessedAbility(line, matches, 1, "$noCondition"); //
          effectText = buildProcessedAbility(line, matches, 2);
        } else {
          console.error("Line did not match 'When' pattern: " + line)
        }
      }
    } else if (line.startsWith("{H}") || line.startsWith("{R}") || line.startsWith("{J}")) {
      const matches = line.match(/^({H}|{R}|{J})\s+(\[\]|.*:)(.*)$/id)
      if (matches) {
        triggerText = buildProcessedAbility(line, matches, 1);
        conditionText = buildProcessedAbility(line, matches, 2, { subIfEmpty: "$noCondition" });
        effectText = buildProcessedAbility(line, matches, 3);
      } else {
        console.error("Line did not match 'H/R/J' pattern: " + line)
      }
    } else if (line.startsWith("At")) {
      const matches = line.match(/^(.*)—\s+(\[\]|.*:)(.*)$/id)
      if (matches) {
        triggerText = buildProcessedAbility(line, matches, 1);
        conditionText = buildProcessedAbility(line, matches, 2, { subIfEmpty: "$noCondition" });
        effectText = buildProcessedAbility(line, matches, 3);
      } else {
        // At Night is missing []. Maybe it does not support a condition?  use this other pattern:
        const matches = line.match(/^(At Night)\s+—\s+(.*)$/id)
        if (matches) {
          triggerText = buildProcessedAbility(line, matches, 1);
          conditionText = buildEmptyProcessedAbility(line, matches, 1, "$noCondition"); //
          effectText = buildProcessedAbility(line, matches, 2);
        } else {
          console.error("Line did not match 'At (Phase)' pattern: " + line)
        }
      }
    } else if (line.startsWith("[]")) {
      // These are actually Static abilities, not triggered
      const matches = line.match(/^(\[\])\s*(\[\]|.*:)(.*)$/id)
      if (matches) {
        triggerText = buildProcessedAbility(line, matches, 1, { subIfEmpty: "$static" });
        conditionText = buildProcessedAbility(line, matches, 2, { subIfEmpty: "$noCondition" });
        effectText = buildProcessedAbility(line, matches, 3);
      } else {
        console.error("Line did not match Static pattern: " + line)
      }
    } else {
      console.error("Line does not match any known pattern: " + line)
    }

    return {
      textEn: line,
      lineStartIndex: startIndex,
      lineEndIndex: endIndex,
      triggerText,
      conditionText,
      effectText,
      uniqueInfoId: card.id,
      extraEffectParts: extraEffectParts,
    }
  })
  
  let echoAbilities: ProcessedCard["echoAbilities"] = echoLines.map(line => {

    let triggerText: ProcessedAbility | undefined = undefined;
    let conditionText: ProcessedAbility | undefined = undefined;
    let effectText: ProcessedAbility | undefined = undefined;

    if (line.startsWith("{D}")) {
      const matches = line.match(/^({D})\s+:\s+\[\](.*)$/id)
      if (matches) {
        triggerText = buildProcessedAbility(line, matches, 1);
        effectText = buildProcessedAbility(line, matches, 2);
      } else {
        console.error("Line did not match '{D}' pattern: " + line)
      }
    } else if (line.startsWith("{I}") && line.match(/—/) == null) {
      // This is a passive support
      const matches = line.match(/^({I})\s+(\[\]|.*:)(.*)$/id)
      if (matches) {
        triggerText = buildProcessedAbility(line, matches, 1);
        conditionText = buildProcessedAbility(line, matches, 2, { subIfEmpty: "$noCondition" });
        effectText = buildProcessedAbility(line, matches, 3);
      } else {
        console.error("Line did not match passive support pattern: " + line)
      }
    } else if (line.startsWith("{I} When") || line.startsWith("{I} At")) {
      // This is a triggered support
      const matches = line.match(/^(.*)—\s+(\[\]|.*:)(.*)$/id)
      if (matches) {
        triggerText = buildProcessedAbility(line, matches, 1);
        conditionText = buildProcessedAbility(line, matches, 2, { subIfEmpty: "$noCondition" });
        effectText = buildProcessedAbility(line, matches, 3);
      } else {
        console.error("Line did not match triggered support pattern: " + line)
      }
    } else {
      console.error("Line does not match any known pattern: " + line)
    }
    
    return {
      textEn: line,
      triggerText,
      conditionText,
      effectText,
    }
  })

  return {
    uniqueInfo: card,
    mainAbilities,
    echoAbilities,
  }
}

let mainAbilityPartsCache: Record<string, MainUniqueAbilityPart> = {};

async function upsertAbilityPart(partType: AbilityPartType, isSupport: boolean, ability: ProcessedAbility | undefined, tx?: Omit<PrismaClient, ITXClientDenyList>): Promise<MainUniqueAbilityPart | undefined> {
  if (!ability) {
    return undefined;
  }
  const text = ability.partText;

  const key = `${partType}-${isSupport}__${text}`;

  if (mainAbilityPartsCache[key]) {
    return mainAbilityPartsCache[key];
  }

  const db = tx ?? prisma;

  let part = await db.mainUniqueAbilityPart.upsert({
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
  return part;
}

let totalProcessed = 0;

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

    let i = 1;
    for (let ability of processedCard.mainAbilities) {
      let triggerPart = await upsertAbilityPart(AbilityPartType.Trigger, false, ability.triggerText, tx);
      let conditionPart = await upsertAbilityPart(AbilityPartType.Condition, false, ability.conditionText, tx);
      let effectPart = await upsertAbilityPart(AbilityPartType.Effect, false, ability.effectText, tx);
      let extraEffectParts: MainUniqueAbilityPart[] = [];
      for (let extraEffectPart of ability.extraEffectParts) {
        let part = await upsertAbilityPart(AbilityPartType.Effect, false, extraEffectPart, tx);
        if (part) {
          extraEffectPart.partId = part.id;
          extraEffectParts.push(part);
        }
      }

      const characterData = {
        version: 1,
        lineStartIndex: ability.lineStartIndex,
        lineEndIndex: ability.lineEndIndex,
        parts: [
          ability.triggerText ? {
            partId: triggerPart?.id,
            startIndex: ability.triggerText.startIndex,
            endIndex: ability.triggerText.endIndex,
            substituteText: ability.triggerText.substituteText,
          } : null,
          ability.conditionText ? {
            partId: conditionPart?.id,
            startIndex: ability.conditionText.startIndex,
            endIndex: ability.conditionText.endIndex,
            substituteText: ability.conditionText.substituteText,
          } : null,
          ability.effectText ? {  
            partId: effectPart?.id,
            startIndex: ability.effectText.startIndex,
            endIndex: ability.effectText.endIndex,
            substituteText: ability.effectText.substituteText,
          } : null,
          ...(ability.extraEffectParts.map(part => ({
            partId: part.partId,
            startIndex: part.startIndex,
            endIndex: part.endIndex,
            substituteText: part.substituteText,
          })))
        ].filter(part => part != null)
      }

      let blob = {
        textEn: ability.textEn,
        isSupport: false,
        triggerId: triggerPart?.id,
        conditionId: conditionPart?.id,
        effectId: effectPart?.id,
        extraEffectParts: { connect: extraEffectParts.map(part => ({ id: part.id })) },
        characterData: characterData,
      }
      let dbAbility = await tx.mainUniqueAbility.upsert({
        where: {
          uniqueInfoId_lineNumber_isSupport: {
            uniqueInfoId: unique.id,
            lineNumber: i,
            isSupport: false,
          }
        },
        update: blob,
        create: {
          uniqueInfoId: unique.id,
          lineNumber: i,
          ...blob,
        }
      })
      
      if (verboseLevel >= 3) {
        console.log(` - ${ability.textEn}`)
        console.dir(pick(ability, ["triggerText", "conditionText", "effectText"]))
        console.log(`  --> Ability #${dbAbility.id} (trigger=${triggerPart?.id}, condition=${conditionPart?.id}, effect=${effectPart?.id})`)
      }
      i += 1;
    }

    for (let ability of processedCard.echoAbilities) {
      let triggerPart = await upsertAbilityPart(AbilityPartType.Trigger, false, ability.triggerText, tx);
      let conditionPart = await upsertAbilityPart(AbilityPartType.Condition, false, ability.conditionText, tx);
      let effectPart = await upsertAbilityPart(AbilityPartType.Effect, false, ability.effectText, tx);

      const characterData = {
        version: 1,
        parts: [
          ability.triggerText ? {
            partId: triggerPart?.id,
            startIndex: ability.triggerText.startIndex,
            endIndex: ability.triggerText.endIndex,
            substituteText: ability.triggerText.substituteText,
          } : null,
          ability.conditionText ? {
            partId: conditionPart?.id,
            startIndex: ability.conditionText.startIndex,
            endIndex: ability.conditionText.endIndex,
            substituteText: ability.conditionText.substituteText,
          } : null,
          ability.effectText ? {  
            partId: effectPart?.id,
            startIndex: ability.effectText.startIndex,
            endIndex: ability.effectText.endIndex,
            substituteText: ability.effectText.substituteText,
          } : null,
        ].filter(part => part != null)
      }

      let blob = {
        textEn: ability.textEn,
        isSupport: true,
        lineNumber: 0,
        triggerId: triggerPart?.id,
        conditionId: conditionPart?.id,
        effectId: effectPart?.id,
        characterData: characterData,
      }
      let dbAbility = await tx.mainUniqueAbility.upsert({
        where: {
          uniqueInfoId_lineNumber_isSupport: {
            uniqueInfoId: unique.id,
            lineNumber: 0,
            isSupport: true,
          }
        },
        update: blob,
        create: {
          uniqueInfoId: unique.id,
          ...blob,
        }
      })
      
      if (verboseLevel >= 3) {
        console.log(` - ${ability.textEn}`)
        console.dir(pick(ability, ["triggerText", "conditionText", "effectText"]))
        console.log(`  --> Support #${dbAbility.id} (trigger=${triggerPart?.id}, condition=${conditionPart?.id}, effect=${effectPart?.id})`)
      }
      i += 1;
    }
  }
}

export async function processUniquesBatch(fromPage: number = 0, toPage: number | undefined = undefined, batchSize = 5000) {
  let page = fromPage;
  console.log(`Starting batch from ${fromPage} to ${toPage}`)
  while (toPage && page < toPage) {

    const startTs = Date.now();

    let batchUniques = await prisma.uniqueInfo.findMany({
      where: {
        fetchedDetails: true,
        // nameEn: {
        //   equals: "Man in the Maze",
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
