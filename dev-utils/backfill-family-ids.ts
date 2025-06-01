
import fs from "fs/promises"
import { AlteredggCard, CardDbEntry } from "../common/models/cards"
import prisma from "../common/utils/prisma.server"
import cardsJson from "@data/cards_min.json" assert { type: "json" };

const cards = await prisma.uniqueInfo.findMany({
  where: {
    cardFamilyId: {
      equals: null
    }
  },
  orderBy: {
    id: "asc"
  }
})

for (const card of cards) {
  const idSplit = card.ref.split("_")
  if (idSplit.length < 6) {
    console.error(`Invalid card ref: ${card.ref}`)
    continue
  }
  if (!card.faction || !card.nameEn) {
    console.error(`Card has no faction or name: ${card.ref}`)
    continue
  }

  const familyId = idSplit[3] + "_" + idSplit[4]
  console.log(`Updating ${card.ref} with familyId ${familyId}`)

  const family = await prisma.cardFamilyStats.upsert({
    where: {
      cardFamilyId_faction: {
        cardFamilyId: familyId,
        faction: card.faction
      }
    },
    update: {},
    create: {
      cardFamilyId: familyId,
      faction: card.faction,
      fetchStartGeneration: 1,
      fetchStartedAt: new Date(),
      fetchCompletedAt: new Date(),
      fetchCompletedGeneration: card.lastSeenGenerationId,
      name: card.nameEn,
    }
  })
  
  await prisma.uniqueInfo.update({
    where: {
      id: card.id
    },
    data: {
      cardFamilyId: familyId
    }
  })
}

await prisma.$disconnect()
console.log("Done")