import prisma from "@common/utils/prisma.server"
import { AbilityPartType, MainUniqueAbilityPart, PrismaClient, UniqueInfo } from "@prisma/client"
import { pick } from "radash"
import { getEnv } from "./helpers";
import { ITXClientDenyList } from "@prisma/client/runtime/library";


const verboseLevel = parseInt(getEnv("VERBOSE_LEVEL") ?? "1");

interface ProcessedCard {
  uniqueInfo: UniqueInfo
  mainAbilities: {
    textEn: string
    triggerText: string | undefined
    conditionText: string | undefined
    effectText: string | undefined
  }[]
  echoAbilities: {
    textEn: string
    triggerText: string | undefined
    conditionText: string | undefined
    effectText: string | undefined
  }[]
}

/*
---
// {H} []Target a Character in play or in Reserve other than me. Then, roll a die:  • On a 4+, we both gain 1 boost.  • On a 1-3, it gains 1 boost.  When a Character in your Reserve gains 1 or more boosts — []Target Character gains 2 boosts.
*/

function processOneCard(card: UniqueInfo): ProcessedCard | null {

  if (!card.mainEffectEn) {
    return null;
  }

  let mainLines = card.mainEffectEn.split(/  (?!•)/);
  // Support abilities only have a single line right now
  let echoLines = card.echoEffectEn ? [card.echoEffectEn] : [];

  let mainAbilities: ProcessedCard["mainAbilities"] = mainLines.map(line => {

    let triggerText: string | undefined = undefined;
    let conditionText: string | undefined = undefined;
    let effectText: string | undefined = undefined;

    if (line.startsWith("When")) {
      const matches = line.match(/^((?:When .*?)|{H}|{R}|{J})\s+—\s+(\[\]|.*:)(.*)$/i);
      if (matches) {
        triggerText = matches[1];
        conditionText = matches[2];
        effectText = matches[3];
      } else {
        // Some cards are missing the [] for empty condition, use this other pattern:
        const matches = line.match(/^((?:When .*?)|{H}|{R}|{J})\s+—\s+(.*)$/i);
        if (matches) {
          triggerText = matches[1];
          conditionText = undefined;
          effectText = matches[2];
        } else {
          console.error("Line did not match 'When' pattern: " + line)
        }
      }
    } else if (line.startsWith("{H}") || line.startsWith("{R}") || line.startsWith("{J}")) {
      const matches = line.match(/^({H}|{R}|{J})\s+(\[\]|.*:)(.*)$/i)
      if (matches) {
        triggerText = matches[1];
        conditionText = matches[2];
        effectText = matches[3];
      } else {
        console.error("Line did not match 'H/R/J' pattern: " + line)
      }
    } else if (line.startsWith("At")) {
      const matches = line.match(/^(.*)—\s+(\[\]|.*:)(.*)$/i)
      if (matches) {
        triggerText = matches[1];
        conditionText = matches[2];
        effectText = matches[3];
      } else {
        // At Night is missing []. Maybe it does not support a condition?  use this other pattern:
        const matches = line.match(/^(At Night)\s+—\s+(.*)$/i)
        if (matches) {
          triggerText = matches[1];
          conditionText = undefined;
          effectText = matches[2];
        } else {
          console.error("Line did not match 'At (Phase)' pattern: " + line)
        }
      }
    } else if (line.startsWith("[]")) {
      // These are actually Static abilities, not triggered
      const matches = line.match(/^\[\]\s*(\[\]|.*:)(.*)$/i)
      if (matches) {
        triggerText = "$static";
        conditionText = matches[1];
        effectText = matches[2];
      } else {
        console.error("Line did not match Static pattern: " + line)
      }
    } else {
      console.error("Line does not match any known pattern: " + line)
    }

    triggerText = triggerText?.trim();
    conditionText = conditionText?.trim();
    effectText = effectText?.trim();

    return {
      textEn: line,
      triggerText,
      conditionText,
      effectText,
      uniqueInfoId: card.id,
    }
  })

  let echoAbilities: ProcessedCard["echoAbilities"] = echoLines.map(line => {

    let triggerText: string | undefined = undefined;
    let conditionText: string | undefined = undefined;
    let effectText: string | undefined = undefined;

    if (line.startsWith("{D}")) {
      const matches = line.match(/^({D})\s+:\s+\[\](.*)$/i)
      if (matches) {
        triggerText = matches[1];
        effectText = matches[2];
      } else {
        console.error("Line did not match '{D}' pattern: " + line)
      }
    } else if (line.startsWith("{I}") && line.match(/—/) == null) {
      // This is a passive support
      const matches = line.match(/^{I}\s+(\[\]|.*:)(.*)$/i)
      if (matches) {
        triggerText = '$passive';
        conditionText = matches[1];
        effectText = matches[2];
      } else {
        console.error("Line did not match passive support pattern: " + line)
      }
    } else if (line.startsWith("{I} When") || line.startsWith("{I} At")) {
      // This is a triggered support
      const matches = line.match(/^(.*)—\s+(\[\]|.*:)(.*)$/i)
      if (matches) {
        triggerText = matches[1];
        conditionText = matches[2];
        effectText = matches[3];
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

async function upsertAbilityPart(partType: AbilityPartType, isSupport: boolean, text?: string, tx?: Omit<PrismaClient, ITXClientDenyList>): Promise<MainUniqueAbilityPart | undefined> {
  if (!text) {
    return undefined;
  }

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

      let blob = {
        textEn: ability.textEn,
        triggerId: triggerPart?.id,
        conditionId: conditionPart?.id,
        effectId: effectPart?.id,
        isSupport: false,
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
      let triggerPart = await upsertAbilityPart(AbilityPartType.Trigger, true, ability.triggerText, tx);
      let conditionPart = await upsertAbilityPart(AbilityPartType.Condition, true, ability.conditionText, tx);
      let effectPart = await upsertAbilityPart(AbilityPartType.Effect, true, ability.effectText, tx);
      
      let blob = {
        textEn: ability.textEn,
        triggerId: triggerPart?.id,
        conditionId: conditionPart?.id,
        effectId: effectPart?.id,
        lineNumber: 0,
        isSupport: true,
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
