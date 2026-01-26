import { getEnv } from './helpers.js';
import {
  ExhaustiveInSaleCrawler,
  MarketUpdateCrawlerStats,
  marketUpdateStatsComplete,
  marketUpdateStatsStartAndGetGenerationId,
  marketUpdateUniqueTableIsCurrent,
} from './market-public-api.js';
import prisma from '@common/utils/prisma.server.js';

const debugCrawler = getEnv("DEBUG_CRAWLER") == "true";

const exhaustiveInSaleCrawler = new ExhaustiveInSaleCrawler({ pageSize: 30, userAgent: "marketbot-public-api/1.0" });

const fetchGenerationId = await marketUpdateStatsStartAndGetGenerationId();

console.log(`Started crawler from Public API with fetchGenerationId=${fetchGenerationId}`);

await exhaustiveInSaleCrawler.addAllWithFilter(fetchGenerationId, (c) => {
  // We can implement filters here to exclude certain families
  if (debugCrawler) {
    return c.name.en.startsWith("Ascended") || c.name.en.startsWith("Gavroche");
  }
  return true;
})

try {
  const stats = await exhaustiveInSaleCrawler.waitForCompletion();
  await marketUpdateStatsComplete(fetchGenerationId, stats);
  await marketUpdateUniqueTableIsCurrent(fetchGenerationId);
  console.log(`Recorded crawler stats: ${JSON.stringify(stats)}`);
} catch (e) {
  console.error("Crawler task failed with error: ", e);
}

await prisma.$disconnect();