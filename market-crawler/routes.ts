import { createHttpRouter, createJSDOMRouter, createPlaywrightRouter, HttpCrawler, JSDOMCrawler } from 'crawlee';
import { Page } from 'playwright';
import { getEnv } from './helpers.js';


function buildCardsUrl(faction: string, rarity: string) {
    return `https://api.altered.gg/cards?factions%5B%5D=${faction}&inSale=true&mainCost[]=2&translations.name=inkcaster&rarity%5B%5D=${rarity}&itemsPerPage=36&locale=en-us`;
}

export async function startAPICrawler(authToken: string) {

    const httpRouter = createHttpRouter();
    httpRouter.addHandler('hydra-api', async ({ request, log, body, addRequests }) => {
        log.info(`hydra-api: ${request.url}`);
        const json = JSON.parse((body as Buffer).toString());
        console.log('hydra:view', json['hydra:view']);
        console.log('members')
        let i = 1;
        for (const member of json['hydra:member']) {
            const card = member['reference'];
            const imagePath = member['imagePath'];
            console.log(`${i}: `, card, imagePath);
            i += 1;
        }

        const nextPage = json['hydra:view']['hydra:next'];
        if (nextPage) {
            log.info(`nextPage: ${nextPage}`);
            
            addRequests([{
                url: 'https://api.altered.gg' + nextPage,
                label: 'hydra-api'
            }]);
        }
    });
    
    const httpCrawler = new HttpCrawler({
        requestHandler: httpRouter,
        maxRequestsPerCrawl: 5,
        maxRequestsPerMinute: 20,
        maxConcurrency: 1,
        sameDomainDelaySecs: 3,
        additionalMimeTypes: ['application/json', 'application/ld+json'],
        preNavigationHooks: [
            (_crawlingContext, gotOptions) => {
                gotOptions.headers = {
                    'Authorization': `Bearer ${authToken}`
                }
            },
        ]
    });
    await httpCrawler.run([
        { url: buildCardsUrl('LY', 'UNIQUE'), label: 'hydra-api' }
    ]);
}

export const router = createPlaywrightRouter();

router.addDefaultHandler(async ({ page, log }) => {
    log.info(`DefaultHandler: ${page.url}`);
    
});

router.addHandler('mainPage', async ({ request, page, log, pushData }) => {
    const title = await page.title();
    log.info(`${title}`, { url: request.loadedUrl });

    const email = getEnv('ALTERED_EMAIL');
    const password = getEnv('ALTERED_PASSWORD');

    await page.waitForTimeout(1000);
    await page.getByText("Agree", { exact: true}).click()

    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: "sign in" }).click()

    await page.waitForTimeout(2000);
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill(password);

    await page.waitForTimeout(500);
    page.on('request', request => {
        // console.log('>>', request.url());
        if (request.url().includes('https://api.altered.gg/me')) {
            // console.log('>>', request.url());
            const headers = request.headers();
            // console.log('headers', headers);
            const authHeader = headers['authorization'];
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                console.log('intercepted token=', token);
                startAPICrawler(token);
            }
        }
    });
    await page.getByRole('button', { name: "Continue" }).click()

    await page.getByText("thistledthrwy").waitFor()

    await page.waitForTimeout(1000);

    // await page.getByText("Decks").first().click()
    // await page.waitForTimeout(10000);
    
});