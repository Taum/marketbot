import { createHttpRouter, HttpCrawler, HttpCrawlingContext, RequestProvider, RequestQueue, RouterHandler } from 'crawlee';

export class UniquesCrawler {
  private _crawler: HttpCrawler<HttpCrawlingContext<any, any>>;
  private _requestHandler: RouterHandler<HttpCrawlingContext<any, any>>;

  private _requestQueue: RequestProvider;

  constructor() {
    this._requestHandler = createHttpRouter();
    this._requestHandler.addHandler('card-page', this._handleCardPage.bind(this));

    this._initCrawlerIfNeeded();
  }

  // Also re-initializes if it's no longer running
  private _initCrawlerIfNeeded() {
    if (this._crawler == null || !this._crawler.running) {
      this._crawler = new HttpCrawler({
        requestHandler: this._requestHandler,
        maxRequestsPerCrawl: 100,
        maxRequestsPerMinute: 60,
        maxConcurrency: 1,
        sameDomainDelaySecs: 1,
        additionalMimeTypes: ['application/json', 'application/ld+json'],
        keepAlive: true,
      })
    }
  }

  private _handleCardPage(context: HttpCrawlingContext<any, any>) {
    console.log(context.request.url);
    const json = JSON.parse((context.body as Buffer).toString()) as AlteredggCard;
    const data = {
      id: json.reference,
      imagePath: json.imagePath,
      name: json.name,
      mainFaction: json.mainFaction.reference,
      elements: json.elements,
    }
    console.log("-> ", data.id, " '", data.name, "'");
    console.dir(data, { depth: null });
  }

  async start() {
    await this._crawler.run([]);
  }

  async enqueueUniques(ids: string[]) {
    const requests = ids.map(id => ({ 
      url: `https://api.altered.gg/cards/${id}?locale=en-us`,
      label: 'card-page'
    }));
    console.log("Enqueuing ", requests.length, " requests");
    await this._crawler.addRequests(requests);
  }

  async stopAfterCompletion() {
    // await this._crawler.stop();
  }
}
