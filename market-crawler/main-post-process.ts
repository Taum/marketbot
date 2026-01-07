import { processUniquesBatch } from "./post-process";

const batchSize = process.env.BATCH_SIZE ? parseInt(process.env.BATCH_SIZE) : 1000;

const batch1 = processUniquesBatch(0, 100000, batchSize, "en-us");
const batch2 = processUniquesBatch(0, 100000, batchSize, "fr-fr");

await Promise.all([batch1, batch2]);

console.log("Done")
