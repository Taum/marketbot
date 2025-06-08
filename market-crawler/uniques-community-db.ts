import { GenericIndexer } from "./generic-indexer.js";
import { AlteredggCard } from "@common/models/cards.js";
import prisma from "@common/utils/prisma.server.js";
import { delay } from "@common/utils/promise.js";
import { processAndWriteOneUnique } from "./post-process.js";
import { ThrottlingConfig, throttlingConfig } from "./config.js";
import { getEnv } from "./helpers.js";
import { PrismaClient, UniqueInfo } from "@prisma/client";
import path from "node:path";
import fs from "fs/promises";
import { UniquesCrawler } from "./uniques.js";
import throttledQueue from "throttled-queue";
import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';

export interface UniqueRequest {
  id: string;
}

export interface UniqueData {
  card: AlteredggCard;
}

const debugCrawler = getEnv("DEBUG_CRAWLER") == "true";

export const recordOneUnique = async (cardData: AlteredggCard, prisma: PrismaClient) => {
  const blob = {
    ref: cardData.reference,
    faction: cardData.mainFaction.reference,
    mainCost: parseInt(cardData!.elements.MAIN_COST || "0", 10),
    recallCost: parseInt(cardData!.elements.RECALL_COST || "0", 10),
    oceanPower: parseInt(cardData!.elements.OCEAN_POWER || "0", 10),
    mountainPower: parseInt(cardData!.elements.MOUNTAIN_POWER || "0", 10),
    forestPower: parseInt(cardData!.elements.FOREST_POWER || "0", 10),
    nameEn: cardData!.name,
    imageUrlEn: cardData!.imagePath,
    mainEffectEn: cardData!.elements.MAIN_EFFECT,
    echoEffectEn: cardData!.elements.ECHO_EFFECT,
    cardSet: cardData!.cardSet.reference,
    fetchedDetails: true,
    fetchedDetailsAt: new Date(),
  }

  try {
    const uniqueInfo = await prisma.uniqueInfo.upsert({
      where: { ref: blob.ref },
      update: blob,
      create: blob,
    });
    console.debug(`Recorded unique ${blob.ref} (${blob.nameEn})`);

    // Post-process the unique -- breakdown abilities and upsert them
    await processAndWriteOneUnique(uniqueInfo, prisma);

  } catch (error) {
    console.error(`Error recording unique ${blob.ref} (${blob.nameEn}): ${error}`);
  }
}

export class CommunityDbUniquesCrawler extends UniquesCrawler {

  private apiThrottleQueue
  private git: SimpleGit

  constructor(
    private dbRoot: string
  ) {
    const config: ThrottlingConfig = {
      maxOperationsPerWindow: 100,
      windowMs: 1000,
    }
    super(config);

    this.git = simpleGit(this.dbRoot)
    this.apiThrottleQueue = throttledQueue(config.maxOperationsPerWindow, config.windowMs, true);
  }

  public async fetch(request: UniqueRequest) {
    const id = request.id

    if (await this.communityDbFileExists(id)) {
      console.log(`Community DB file exists for ${id}, reading from file...`)
      const card = await this.communityDbRead(id)
      return { card }
    }

    console.log(`Community DB file does not exist for ${id}, fetching from API...`)
    const response = await this.apiThrottleQueue(() => fetch(`https://api.altered.gg/cards/${request.id}`));
    const card = await response.json();
    return { card };
  };

  public async persist(data: UniqueData, _request: UniqueRequest) {
    const cardData = data.card;
    await recordOneUnique(cardData, prisma);
  };

  public async enqueueUniquesWithId(ids: string[]) {
    console.log(`Enqueuing by ID ${ids.length} uniques...`)
    for (const id of ids) {
      await this.addRequests([{ id }]);
    }
  }

  public async enqueueUniquesWithMissingEffects({ limit = 10 }: { limit?: number } = {}) {
    const uniques = await prisma.uniqueInfo.findMany({
      where: {
        fetchedDetails: false,
      },
      orderBy: {
        lastSeenInSaleAt: 'desc',
      },
      take: limit,
    });

    console.log(`Uniques task enqueueing ${uniques.length} uniques...`)
    for (const unique of uniques) {
      await this.addRequests([{ id: unique.ref }]);
    }
  }

  public async enqueueUntil(otherPromise: Promise<void>) {
    let otherDone = false
    otherPromise.finally(() => otherDone = true)
    while (!otherDone) {
      await this.enqueueUniquesWithMissingEffects()
      await this.waitForCompletion()
      if (debugCrawler) {
        console.log("Uniques task pausing for 10s...")
        await delay(10_000)
      } else {
        await delay(60_000)
      }
    }
  }


  private communityDbPath(id: string, joinFn: (...args: string[]) => string = (...args) => args.join("/")): string {
    const split = id.split("_")
    return joinFn(split[1], split[3], split[4], `${id}.json`)
  }
  private communityDbFullPath(id: string) {
    return path.join(this.dbRoot, this.communityDbPath(id, path.join))
  }

  public async communityDbFileExists(id: string): Promise<boolean> {
    try {
      const path = this.communityDbPath(id)
      const cat = await this.git.catFile(['-t', `HEAD:${path}`])
      if (cat.trim() == "blob") {
        return true 
      } else {
        return false
      }
    } catch (error) {
      return false
    }
  }

  public async communityDbRead(id: string): Promise<AlteredggCard> {
    const path = this.communityDbPath(id)
    const cat = await this.git.catFile(['-p', `HEAD:${path}`])
    const json = JSON.parse(cat)
    return json
  }
}
