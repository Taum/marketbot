import prisma from "@common/utils/prisma.server.js";
import { UniquesCrawler } from "./uniques.js";

const debug = process.env.DEBUG_CRAWLER === "true";

const uniquesCrawler = new UniquesCrawler();

await uniquesCrawler.enqueueUniquesWithMissingEffects({ limit: 25000 });

await uniquesCrawler.waitForCompletion();

await prisma.$disconnect();
