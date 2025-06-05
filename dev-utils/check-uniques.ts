import fs from "fs"
import prisma from "@common/utils/prisma.server"
import { getEnv } from "../market-crawler/helpers"

const dbRepoPath = getEnv("DB_REPO_PATH")

const cards = await prisma.uniqueInfo.findMany({
})

console.log(`Testing ${cards.length} cards`)

const total = cards.length
let found = 0
let missing = 0

for (const card of cards) {
  const parts = card.ref.split("_")
  const path = `${dbRepoPath}/${parts[1]}/${parts[3]}/${parts[4]}/${card.ref}.json`
  if (fs.existsSync(path)) {
    found++
  } else {
    console.log(`Missing ${card.ref}`)
    missing++
  }
}

console.log(`Found ${found} of ${total} cards`)
console.log(`Missing ${missing} of ${total} cards`)

