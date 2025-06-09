import { getEnv } from './helpers.js';
import { UniquesCrawler } from './uniques.js';
import { ExhaustiveInSaleCrawler, MarketUpdateCrawlerStats, marketUpdateStatsComplete, marketUpdateStatsStartAndGetGenerationId, marketUpdateUniqueTableIsCurrent } from './market.js';
import prisma from '@common/utils/prisma.server.js';
import { AuthTokenService } from './refresh-token.js';
import { CommunityDbUniquesCrawler } from './uniques-community-db.js';

const sessionName = getEnv("ALT_SESSION_NAME")
if (!sessionName) {
  throw new Error("ALT_SESSION_NAME is not set");
}

const debugCrawler = getEnv("DEBUG_CRAWLER") == "true";

const communityDbPath = getEnv("COMMUNITY_DB_PATH")
const authorName = getEnv("GIT_AUTHOR_NAME") ?? "Marketbot"
const authorEmail = getEnv("GIT_AUTHOR_EMAIL") ?? "automated@marketbot.dev"

const authTokenService = new AuthTokenService(sessionName);

const exhaustiveInSaleCrawler = new ExhaustiveInSaleCrawler(authTokenService);

let uniquesCrawler: UniquesCrawler
if (communityDbPath != null) {
  let com = new CommunityDbUniquesCrawler(communityDbPath, authorName, authorEmail);
  await com.communityDbBeginUpdate()
  uniquesCrawler = com
} else {
  uniquesCrawler = new UniquesCrawler();
}

const fetchGenerationId = await marketUpdateStatsStartAndGetGenerationId();

console.log(`Started crawler with fetchGenerationId=${fetchGenerationId}`);

// Let AuthTokenService refresh the token first if needed
const token = await authTokenService.getToken({ forceRefresh: true });

console.log(`Token refreshed: ${token.token.slice(0, 20)}...[redacted] - Expires: ${token.expiresAt}`);

// We don't need this anymore, since we updated cards_min.json with
// the BISE cards
// await exhaustiveInSaleCrawler.addSpecialQuery(fetchGenerationId, {
//   "cardSet": "BISE",
// })

await exhaustiveInSaleCrawler.addAllWithFilter(fetchGenerationId, (c) => {
  // We can implement filters here to exclude certain families
  if (debugCrawler) {
    return c.name.en.startsWith("Copp") || c.name.en.startsWith("Efr");
  }
  return true;
})

let g_crawlerStats: MarketUpdateCrawlerStats | null = null;

const inSaleCompletion = exhaustiveInSaleCrawler
  .waitForCompletion()
  .then((stats) => {
    g_crawlerStats = stats;
    console.log("InSale task completed")
  })
  .catch((e) => console.error("InSale task failed with error: ", e));

if (debugCrawler) {
  await inSaleCompletion;
} else {
  await uniquesCrawler.enqueueUntil(inSaleCompletion)
}

// Enqueue large batch when market crawler is finished
// this should ensure we get all the missing uniques -- we may have to even remove this limit
await uniquesCrawler.enqueueUniquesWithMissingEffects({ limit: 10000 });
await (
  uniquesCrawler
    .waitForCompletion()
    .then(() => console.log("Uniques task completed"))
);

if (uniquesCrawler instanceof CommunityDbUniquesCrawler) {
  await uniquesCrawler.communityDbCreateCommit();
}

await marketUpdateStatsComplete(fetchGenerationId, g_crawlerStats);
await marketUpdateUniqueTableIsCurrent(fetchGenerationId);

console.log(`Recorded crawler stats: ${JSON.stringify(g_crawlerStats)}`);

await prisma.$disconnect();