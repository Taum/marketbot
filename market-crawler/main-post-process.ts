import { processUniquesBatch } from "./post-process";

const batch1 = processUniquesBatch(0, 150);
const batch2 = processUniquesBatch(150, 300);
const batch3 = processUniquesBatch(300, 450);
const batch4 = processUniquesBatch(450, 600);
const batch5 = processUniquesBatch(600, 750);

await Promise.all([batch1, batch2, batch3, batch4, batch5]);

console.log("Done")
