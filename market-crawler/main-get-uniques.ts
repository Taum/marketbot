import prisma from "@common/utils/prisma.server.js";
import { UniquesCrawler } from "./uniques.js";

const uniquesCrawler = new UniquesCrawler();

await uniquesCrawler.enqueueUniquesWithMissingEffects();

await uniquesCrawler.waitForCompletion();

await prisma.$disconnect();
