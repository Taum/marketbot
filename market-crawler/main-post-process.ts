import { processUniquesBatch } from "./post-process";

const batchSize = process.env.BATCH_SIZE ? parseInt(process.env.BATCH_SIZE) : 1000;

const batch1 = processUniquesBatch(0, 100000, batchSize);

await batch1;
// await Promise.all([batch1, batch2, batch3, batch4, batch5]);

console.log("Done")
