import prisma from "@common/utils/prisma.server.js";
import { UniquesCrawler } from "./uniques.js";
import { getEnv } from "./helpers.js";
import { CommunityDbUniquesCrawler } from "./uniques-community-db.js";
import { delay } from "@common/utils/promise.js";

const debug = process.env.DEBUG_CRAWLER === "true";

const communityDbPath = getEnv("COMMUNITY_DB_PATH")
const authorName = getEnv("GIT_AUTHOR_NAME") ?? "Marketbot"
const authorEmail = getEnv("GIT_AUTHOR_EMAIL") ?? "automated@marketbot.dev"

if (debug) {
  await prisma.uniqueInfo.updateMany({
    data: {
      fetchedDetails: false,
    },
    where: {
      ref: {
        in: [
          // These are present in the community DB
          "ALT_CORE_B_OR_16_U_3142",
          "ALT_ALIZE_B_AX_32_U_5225",
          // These are known missing from the community DB
          "ALT_COREKS_B_BR_12_U_4732",
          "ALT_CORE_B_AX_13_U_8018",
        ]
      }
    },
  })
  await delay(1000);
}

let uniquesCrawler: UniquesCrawler
if (communityDbPath != null) {
  let com = new CommunityDbUniquesCrawler(communityDbPath, authorName, authorEmail);
  await com.communityDbBeginUpdate()
  uniquesCrawler = com
} else {
  uniquesCrawler = new UniquesCrawler();
}


await uniquesCrawler.enqueueUniquesWithMissingEffects({ limit: 250 });

await uniquesCrawler.waitForCompletion();

if (uniquesCrawler instanceof CommunityDbUniquesCrawler) {
  await uniquesCrawler.communityDbCreateCommit();
}

await prisma.$disconnect();
