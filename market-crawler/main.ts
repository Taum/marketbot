import { getEnv } from './helpers.js';
import { UniquesCrawler } from './uniques.js';
import { ExhaustiveInSaleCrawler } from './market.js';
import prisma from '@common/utils/prisma.server.js';
import { AuthTokenService } from './refresh-token.js';
import { Faction } from '@common/models/cards.js';

const sessionName = getEnv("ALT_SESSION_NAME")

// const refreshToken = await refreshAccessToken(sessionName);
const authTokenService = new AuthTokenService(sessionName);

const exhaustiveInSaleCrawler = new ExhaustiveInSaleCrawler(authTokenService);

const uniquesCrawler = new UniquesCrawler();

await exhaustiveInSaleCrawler.addAllWithFilter((c) => {
  // We can implement filters here to exclude certain families
  return true;
})

const inSaleCompletion = exhaustiveInSaleCrawler
  .waitForCompletion()
  .catch((e) => console.error("InSale task failed with error: ", e))
  .then(() => console.log("InSale task completed"));

// await uniquesCrawler.enqueueUntil(inSaleCompletion)

// // Enqueue one more when finished
// await uniquesCrawler.enqueueUniquesWithMissingEffects();
// await uniquesCrawler
//   .waitForCompletion()
//   .then(() => console.log("Uniques task completed"));;

await prisma.$disconnect();