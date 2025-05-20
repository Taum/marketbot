import { getEnv } from './helpers.js';
import { UniquesCrawler } from './uniques.js';
import { ExhaustiveInSaleCrawler, getNextFetchGenerationId } from './market.js';
import prisma from '@common/utils/prisma.server.js';
import { AuthTokenService } from './refresh-token.js';
import { Faction } from '@common/models/cards.js';

const sessionName = getEnv("ALT_SESSION_NAME")
if (!sessionName) {
  throw new Error("ALT_SESSION_NAME is not set");
}

// const refreshToken = await refreshAccessToken(sessionName);
const authTokenService = new AuthTokenService(sessionName);

const exhaustiveInSaleCrawler = new ExhaustiveInSaleCrawler(authTokenService);

const uniquesCrawler = new UniquesCrawler();

const fetchGenerationId = await getNextFetchGenerationId();

// Let AuthTokenService refresh the token first if needed
const token = await authTokenService.getToken({ forceRefresh: true });

console.log(`Token refreshed: ${token.token.slice(0, 20)}...[redacted] - Expires: ${token.expiresAt}`);

await exhaustiveInSaleCrawler.addAllWithFilter(fetchGenerationId, (c) => {
  // We can implement filters here to exclude certain families
  return true;
})

const inSaleCompletion = exhaustiveInSaleCrawler
  .waitForCompletion()
  .then(() => console.log("InSale task completed"))
  .catch((e) => console.error("InSale task failed with error: ", e));

await uniquesCrawler.enqueueUntil(inSaleCompletion)

// Enqueue large batch when market crawler is finished
// this should ensure we get all the missing uniques -- we may have to even remove this limit
await uniquesCrawler.enqueueUniquesWithMissingEffects({ limit: 10000 });
await uniquesCrawler
  .waitForCompletion()
  .then(() => console.log("Uniques task completed"));

await prisma.$disconnect();