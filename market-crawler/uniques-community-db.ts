import { TooManyRequestsError } from "./generic-indexer.js";
import { AlteredggCard } from "@common/models/cards.js";
import prisma from "@common/utils/prisma.server.js";
import { processAndWriteOneUnique } from "./post-process.js";
import { ThrottlingConfig, throttlingConfig } from "./config.js";
import { getEnv } from "./helpers.js";
import { PrismaClient } from "@prisma/client";
import path from "node:path";
import fs from "fs/promises";
import { UniquesCrawler } from "./uniques.js";
import throttledQueue from "throttled-queue";
import { simpleGit, SimpleGit } from 'simple-git';
import { sortJsonKeysAlphabetically } from '@common/utils/json.js';
import os from "node:os";

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
    cardSubTypes: cardData.cardSubTypes.map(subtype => subtype.reference),
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
  private uniquesAddedToRepo: number = 0
  private tempDir: string

  constructor(
    private dbRoot: string,
    private authorName: string,
    private authorEmail: string,
  ) {
    // We don't use the generic throttling from GenericIndexer because we fetch most of the data 
    // from the Community DB. We are managing our own ThrottledQueue for the API calls below.
    const config: ThrottlingConfig = {
      maxOperationsPerWindow: 100,
      windowMs: 1000,
    }
    super(config);

    // Create a temporary file to hold the downloaded JSON files
    this.tempDir = os.tmpdir()

    this.git = simpleGit(this.dbRoot)
    const apiThrottle = throttlingConfig["uniques"]
    this.apiThrottleQueue = throttledQueue(apiThrottle.maxOperationsPerWindow, apiThrottle.windowMs, apiThrottle.evenlySpaced);
  }

  public async fetch(request: UniqueRequest) {
    const id = request.id

    const alreadyInDb = await prisma.uniqueInfo.findUnique({ where: { ref: id, fetchedDetails: true } })
    if (alreadyInDb) {
      console.log(`Unique ${id} already exists in database, skipping...`)
      return { card: null }
    }

    if (await this.communityDbFileExists(id)) {
      console.log(`Community DB file exists for ${id}, reading from file...`)
      const card = await this.communityDbRead(id)
      return { card }
    }

    // console.log(`Community DB file does not exist for ${id}`)
    console.log(`Fetching ${request.id} (en-us) from API...`)
    const responseEn = await this.apiThrottleQueue(() => fetch(`https://api.altered.gg/cards/${request.id}?locale=en-us`));
    if (!responseEn.ok) {
      if (responseEn.status == 429) {
        console.error(`Rate limit exceeded for ${request.id} (en-us)`)
        throw new TooManyRequestsError(`Rate limit exceeded for ${request.id} (en-us)`)
      }
      console.error(`Error fetching ${request.id} (en-us): ${responseEn.status} ${responseEn.statusText}`)
      throw new Error(`Error fetching ${request.id} (en-us): ${responseEn.status} ${responseEn.statusText}`)
    }
    const cardEn = await responseEn.json();
    console.log(`Fetching ${request.id} (fr-fr) from API...`)
    const responseFr = await this.apiThrottleQueue(() => fetch(`https://api.altered.gg/cards/${request.id}?locale=fr-fr`));
    if (!responseFr.ok) {
      if (responseFr.status == 429) {
        console.error(`Rate limit exceeded for ${request.id} (fr-fr)`)
        throw new TooManyRequestsError(`Rate limit exceeded for ${request.id} (fr-fr)`)
      }
      console.error(`Error fetching ${request.id} (fr-fr): ${responseFr.status} ${responseFr.statusText}`)
      throw new Error(`Error fetching ${request.id} (fr-fr): ${responseFr.status} ${responseFr.statusText}`)
    }
    const cardFr = await responseFr.json();
    const mergedCard = this.mergeCard(cardEn, cardFr)

    await this.communityDbWriteFile(request.id, mergedCard)

    return { card: mergedCard };
  };

  private mergeCard(cardEn: AlteredggCard, cardFr: AlteredggCard): AlteredggCard & { translations: Record<string, AlteredggCard> } {
    return {
      ...cardEn,
      translations: {
        "fr-fr": cardFr,
      },
    }
  }

  private communityDbPath(id: string, joinFn: (...args: string[]) => string = (...args) => args.join("/")): string {
    const split = id.split("_")
    return joinFn(split[1], split[3], split[4], `${id}.json`)
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

  public async communityDbBeginUpdate() {
    try {
      // Read the current HEAD tree into the index so we preserve existing files
      await this.git.raw(['read-tree', 'HEAD'])
      console.log('Read existing tree from HEAD into index')
    } catch (error) {
      // No HEAD means this is the first commit, index remains empty
      console.error('No existing tree to read (first commit or empty repo)')
      throw error
    }
  }

  public async communityDbWriteFile(id: string, data: AlteredggCard & { translations: Record<string, AlteredggCard> }) {
    const sortedData = sortJsonKeysAlphabetically(data)
    const json = JSON.stringify(sortedData, null, 4)
    const gitPath = this.communityDbPath(id)
    
    const tempFilePath = path.join(this.tempDir, `git-temp-${Date.now()}-${id}.json`)
    await fs.writeFile(tempFilePath, json)
    
    try {
      // Create a blob object from the file content
      const blobHashResult = await this.git.raw(['hash-object', '-w', tempFilePath])
      const blobHash = blobHashResult.trim()
      
      // Add the blob to the index at the specified path
      await this.git.raw(['update-index', '--add', '--cacheinfo', '100644', blobHash, gitPath])
      
      this.uniquesAddedToRepo++
    }
    catch (error) {
      if (error instanceof Error && error.message.includes("index.lock")) {
        console.error('index.lock already exists, ignoring this file', error)
        return
      }
      throw error
    }
    finally {
      // Clean up the temporary file
      await fs.unlink(tempFilePath).catch(() => {}) // Ignore errors when cleaning up
    }
  }

    public async communityDbCreateCommit() {
    // For bare repositories, we need to use plumbing commands to create commits
    try {
      // 1. Create a tree object from the current index
      const treeHashResult = await this.git.raw(['write-tree'])
      const treeHash = treeHashResult.trim()
      
      // 2. Get the current HEAD commit (parent) if it exists
      let parentCommit: string | null = null
      try {
        const headResult = await this.git.raw(['rev-parse', 'HEAD'])
        parentCommit = headResult.trim()
      } catch (error) {
        // No HEAD means this is the first commit (no parent)
        console.log('Creating initial commit (no parent)')
      }
      
      // 3. Create the commit object with author and committer info
      const message = `Added ${this.uniquesAddedToRepo} uniques`
      const commitArgs = ['commit-tree', treeHash, '-m', message]
      if (parentCommit) {
        commitArgs.push('-p', parentCommit)
      }
      
      // Set author and committer environment variables for the commit
      const commitEnv = {
        ...process.env,
        GIT_AUTHOR_NAME: this.authorName,
        GIT_AUTHOR_EMAIL: this.authorEmail,
        GIT_COMMITTER_NAME: this.authorName,
        GIT_COMMITTER_EMAIL: this.authorEmail,
        GIT_AUTHOR_DATE: new Date().toISOString(),
        GIT_COMMITTER_DATE: new Date().toISOString()
      }
      
      // Execute the commit-tree command with environment variables
      const gitWithEnv = this.git.env(commitEnv)
      const commitHashResult = await gitWithEnv.raw(commitArgs)
      const commitHash = commitHashResult.trim()
      
              // 4. Update the HEAD reference to point to the new commit
        await this.git.raw(['update-ref', 'HEAD', commitHash])
        
        // 5. Reset the counter since files are now committed
        this.uniquesAddedToRepo = 0
        
        console.log(`Created commit ${commitHash}: ${message}`)
        
        return commitHash
    } catch (error) {
      console.error('Failed to create commit:', error)
      throw error
    }
  }
}
