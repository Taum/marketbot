// For more information, see https://crawlee.dev/
import { JSDOMCrawler, PlaywrightCrawler, ProxyConfiguration } from 'crawlee';

import { router, startAPICrawler } from './routes.js';
import { getEnv } from './helpers.js';
import { UniquesCrawler } from './uniques.js';
import { delay } from '../common/utils/promise.js';
import { CardFamilyStatsCrawler, ExhaustiveInSaleCrawler } from './market.js';
import prisma from '@common/utils/prisma.server.js';
// const token = getEnv('ALTERED_TOKEN');
// if (token) {
//   await startAPICrawler(token);
// }
// else {
//   const crawler = new PlaywrightCrawler({
//     launchContext: {
//       // Here you can set options that are passed to the playwright .launch() function.
//       launchOptions: {
//         headless: false,
//       },
//     },
//     // proxyConfiguration: new ProxyConfiguration({ proxyUrls: ['...'] }),
//     requestHandler: router,
//     // Comment this option to scrape the full website.
//     maxRequestsPerCrawl: 20,

//     // Dev option
//     keepAlive: true,
//   });

//   await crawler.run([
//     { url: 'https://www.altered.gg/', label: 'mainPage' }
//   ]);
// }

// const uniquesCrawler = new UniquesCrawler();


// await delay(100);

// await uniquesCrawler.addRequests([
//   { id: 'ALT_COREKS_B_YZ_17_U_436' }
// ])

// await delay(5000);

// await uniquesCrawler.addRequests([
//   { id: 'ALT_ALIZE_B_AX_33_U_1004' },
//   { id: 'ALT_ALIZE_B_AX_32_U_1173' },
//   { id: 'ALT_ALIZE_B_AX_38_U_16754' },
//   { id: 'ALT_ALIZE_B_AX_32_U_11095' }
// ])

// await delay(1500);

// await uniquesCrawler.addRequests([
//   { id: 'ALT_ALIZE_B_BR_39_U_1108' }
// ]);

// await uniquesCrawler.waitForCompletion();

// console.log("Done");

const token = getEnv('ALTERED_TOKEN');

/*
Get families
const cardFamilyStatsCrawler = new CardFamilyStatsCrawler(token);

await cardFamilyStatsCrawler.addAllNotInDatabase();

await cardFamilyStatsCrawler.waitForCompletion();
*/

// Get One family
const exhaustiveInSaleCrawler = new ExhaustiveInSaleCrawler(token);

await exhaustiveInSaleCrawler.addRequests([
  { name: "Sneezer Shroom", faction: "MU" }
])

await exhaustiveInSaleCrawler.waitForCompletion();

await prisma.$disconnect();