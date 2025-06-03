
import fs from "fs/promises"
import { AlteredggCard, CardDbEntry } from "../common/models/cards"
import prisma from "../common/utils/prisma.server"
import cardsJson from "@data/cards_min.json" assert { type: "json" };

// const families = await prisma.cardFamilyStats.findMany({
//   select: {
//     cardFamilyId: true,
//   },
//   distinct: ["cardFamilyId"],
//   orderBy: {
//     cardFamilyId: "asc"
//   }
// })

// const cardsArray = Object.values(cardsJson) as CardDbEntry[]

// for (const family of families) {
//   const common = cardsArray.find(c => c.id.endsWith(family.cardFamilyId + "_C"))
//   if (!common) {
//     console.error(`Common card not found: ${family.cardFamilyId}`)
//     continue
//   }

//   const subtypes = common.subTypes
//   if (subtypes.length == 0) {
//     console.error(`No subtypes found for ${family.cardFamilyId}`)
//     continue
//   }
  
//   console.log(`Updating ${family.cardFamilyId} with subtypes ${subtypes.join(", ")}`)
//   await prisma.uniqueInfo.updateMany({
//     where: {
//       cardFamilyId: family.cardFamilyId
//     },
//     data: {
//       cardSubTypes: subtypes
//     }
//   })
// }

const cards = await prisma.uniqueInfo.findMany({
  where: {
    cardSubTypes: {
      isEmpty: true
    }
  }
})

console.log(`Found ${cards.length} cards with no subtypes`)

for (const card of cards) {
  const baseCardRef = card.ref.replace(/U_\d+$/, "_C")
  const baseCard = cardsJson[baseCardRef]
  if (!baseCard) {
    console.error(`Base card not found: ${baseCardRef}`)
    continue
  }

  const subtypes = baseCard.subTypes
  if (subtypes.length == 0) {
    console.error(`No subtypes found for ${card.ref}`)
    continue
  }

  console.log(`Updating ${card.ref} with subtypes ${subtypes.join(", ")}`)
  await prisma.uniqueInfo.update({
    where: { ref: card.ref },
    data: { cardSubTypes: subtypes }
  })
}

await prisma.$disconnect()
console.log("Done")