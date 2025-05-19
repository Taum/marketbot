import { processUniques } from "./post-process";

const batch1 = processUniques(0, 150);
const batch2 = processUniques(150, 300);
const batch3 = processUniques(300, 450);
const batch4 = processUniques(450, 600);
const batch5 = processUniques(600, 750);

await Promise.all([batch1, batch2, batch3, batch4, batch5]);

console.log("Done")
