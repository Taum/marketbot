import { processUniquesBatch } from "./post-process";

const batch1 = processUniquesBatch(0, 100);

await batch1;
// await Promise.all([batch1, batch2, batch3, batch4, batch5]);

console.log("Done")
