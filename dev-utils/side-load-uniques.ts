import fs from "fs/promises"
import { AlteredggCard } from "../common/models/cards"
import prisma from "../common/utils/prisma.server"
import { recordOneUnique } from "../market-crawler/uniques"

const dir = "../gh-bot-poc/tmp/cards_data"

const files = await fs.glob(`${dir}/**/*.json`)

for await (const file of files) {
  console.log("loading ", file)
  const data = JSON.parse(await fs.readFile(file, "utf-8")) as AlteredggCard
  
  if (!data.reference) {
    console.error("Not a valid card file, skipping.")
    continue;
  }

  await recordOneUnique(data, prisma);
  console.log("Recorded unique ", data.reference)
}

await prisma.$disconnect()

console.log("Done")
