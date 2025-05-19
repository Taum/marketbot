import prisma from "@common/utils/prisma.server"
import { AbilityPartType, GenericTriggerType, MainUniqueAbilityPart, UniqueInfo } from "@prisma/client"
import { pick } from "radash"
import { getEnv } from "./helpers";


const verboseLevel = parseInt(getEnv("VERBOSE_LEVEL") ?? "1");

interface ProcessedCard {
  uniqueInfo: UniqueInfo
  mainAbilities: {
    textEn: string
    genericTrigger: GenericTriggerType | undefined
    triggerText: string | undefined
    triggerConditionText: string | undefined
    conditionText: string | undefined
    effectText: string | undefined
  }[]
}

function genericTriggerFromSymbol(symbol: string): GenericTriggerType | undefined {
  if (symbol == "{H}") {
    return GenericTriggerType.FromHand;
  } else if (symbol == "{R}") {
    return GenericTriggerType.FromReserve;
  } else if (symbol == "{J}") {
    return GenericTriggerType.FromAnwhere;
  }
  return undefined;
}

function processOneCard(card: UniqueInfo): ProcessedCard | null {

  if (!card.mainEffectEn) {
    return null;
  }

  let mainLines = card.mainEffectEn.split("  ");

  let mainAbilities: ProcessedCard["mainAbilities"] = mainLines.map(line => {

    let genericTrigger: GenericTriggerType | undefined = undefined;
    let triggerText: string | undefined = undefined;
    let triggerConditionText: string | undefined = undefined;
    let conditionText: string | undefined = undefined;
    let effectText: string | undefined = undefined;

    if (line.startsWith("When")) {
      const matches = line.match(/^((?:When .*?)|{H}|{R}|{J})\s+((?:if|unless).*)?—\s+(\[\]|.*:)(.*)$/i);
      if (matches) {
        triggerText = matches[1];
        triggerConditionText = matches[2];
        conditionText = matches[3];
        effectText = matches[4];
      } else {
        console.error("Line did not match 'When' pattern: " + line)
      }
    } else if (line.startsWith("{H}") || line.startsWith("{R}") || line.startsWith("{J}")) {
      const matches = line.match(/^({H}|{R}|{J})\s+(\[\]|.*:)(.*)$/i)
      if (matches) {
        genericTrigger = genericTriggerFromSymbol(matches[1]);
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
        console.error("Line did not match 'At (Phase)' pattern: " + line)
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
    triggerConditionText = triggerConditionText?.trim();
    conditionText = conditionText?.trim();
    effectText = effectText?.trim();

    return {
      textEn: line,
      genericTrigger,
      triggerText,
      triggerConditionText,
      conditionText,
      effectText,
      uniqueInfoId: card.id,
    }
  })

  return {
    uniqueInfo: card,
    mainAbilities
  }
}

async function upsertAbilityPart(partType: AbilityPartType, text?: string): Promise<MainUniqueAbilityPart | undefined> {
  if (!text) {
    return undefined;
  }
  let part = await prisma.mainUniqueAbilityPart.upsert({
    where: {
      textEn_partType: {
        textEn: text,
        partType: partType,
      }
    },
    update: {},
    create: {
      textEn: text,
      partType: partType,
    }
  })
  return part;
}

let totalProcessed = 0;

export async function processUniques(fromPage: number = 0, toPage: number | undefined = undefined, batchSize = 100) {
  let page = fromPage;
  while (toPage && page < toPage) {
    let uniques = await prisma.uniqueInfo.findMany({
      where: {
        AND: [
          { mainEffectEn: { not: null } },
        ]
      },
      take: batchSize,
      skip: batchSize * page,
    })

    if (uniques.length == 0) {
      console.log(`Reached end of UniqueInfo (at page ${page})`)
      break;
    }

    for (let unique of uniques) {
      let processedCard = processOneCard(unique);
      
      if (processedCard && processedCard.mainAbilities.length > 0) {
        if (verboseLevel >= 2) {
          console.log(`---------------------`)
          console.log(`${processedCard.uniqueInfo.nameEn} (${processedCard.uniqueInfo.ref})`)
          console.log(`text: ${processedCard.uniqueInfo.mainEffectEn}`)
        }

        let i = 1;
        for (let ability of processedCard.mainAbilities) {
          let triggerPart = await upsertAbilityPart(AbilityPartType.Trigger, ability.triggerText);
          let triggerConditionPart = await upsertAbilityPart(AbilityPartType.TriggerCondition, ability.triggerConditionText);
          let conditionPart = await upsertAbilityPart(AbilityPartType.Condition, ability.conditionText);
          let effectPart = await upsertAbilityPart(AbilityPartType.Effect, ability.effectText);

          let blob = {
            textEn: ability.textEn,
            genericTrigger: ability.genericTrigger,
            triggerId: triggerPart?.id,
            triggerConditionId: triggerConditionPart?.id,
            conditionId: conditionPart?.id,
            effectId: effectPart?.id,
          }
          let dbAbility = await prisma.mainUniqueAbility.upsert({
            where: {
              uniqueInfoId_lineNumber: {
                uniqueInfoId: unique.id,
                lineNumber: i,
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
            console.dir(pick(ability, ["genericTrigger", "triggerText", "triggerConditionText", "conditionText", "effectText"]))
            console.log(`  --> Ability #${dbAbility.id} (trigger=${triggerPart?.id}, trigCond=${triggerConditionPart?.id} condition=${conditionPart?.id}, effect=${effectPart?.id})`)
          }
          i += 1;
        }

        totalProcessed += 1;
      }
    }
    
    console.log(`Done with page ${page} (${totalProcessed} cards processed)`)
    page += 1;
  }
}
