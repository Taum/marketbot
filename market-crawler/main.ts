import { getEnv } from './helpers.js';
import { UniquesCrawler } from './uniques.js';
import { ExhaustiveInSaleCrawler, getNextFetchGenerationId, MarketUpdateCrawlerStats, marketUpdateStatsComplete, marketUpdateStatsStart } from './market.js';
import prisma from '@common/utils/prisma.server.js';
import { AuthTokenService } from './refresh-token.js';

const sessionName = getEnv("ALT_SESSION_NAME")
if (!sessionName) {
  throw new Error("ALT_SESSION_NAME is not set");
}

const debugCrawler = getEnv("DEBUG_CRAWLER") == "true";

const authTokenService = new AuthTokenService(sessionName);

const exhaustiveInSaleCrawler = new ExhaustiveInSaleCrawler(authTokenService);

const uniquesCrawler = new UniquesCrawler();

const fetchGenerationId = await getNextFetchGenerationId();

console.log(`Start crawler with fetchGenerationId=${fetchGenerationId}`);
await marketUpdateStatsStart(fetchGenerationId);

// Let AuthTokenService refresh the token first if needed
const token = await authTokenService.getToken({ forceRefresh: true });

console.log(`Token refreshed: ${token.token.slice(0, 20)}...[redacted] - Expires: ${token.expiresAt}`);

await exhaustiveInSaleCrawler.addAllWithFilter(fetchGenerationId, (c) => {
  // We can implement filters here to exclude certain families
  if (debugCrawler) {
    return c.name.en == "Alice";
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

await uniquesCrawler.enqueueUntil(inSaleCompletion)

// Enqueue large batch when market crawler is finished
// this should ensure we get all the missing uniques -- we may have to even remove this limit
await uniquesCrawler.enqueueUniquesWithMissingEffects({ limit: 10000 });
await (
  uniquesCrawler
    .waitForCompletion()
    .then(() => console.log("Uniques task completed"))
);

await marketUpdateStatsComplete(fetchGenerationId, g_crawlerStats);

console.log(`Recorded crawler stats: ${JSON.stringify(g_crawlerStats)}`);

await prisma.$disconnect();