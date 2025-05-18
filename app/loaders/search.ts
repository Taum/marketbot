import prisma from "@common/utils/prisma.server.js";
import { DisplayUniqueCard } from "../models/cards";
import { Prisma } from '@prisma/client';

// Add the type from Prisma namespace
type UniqueInfoWhereInput = Prisma.UniqueInfoWhereInput;

export interface SearchQuery {
  faction: string;
  characterName: string;
  mainEffect: string;
}

interface Token {
  text: string
  negated: boolean
}

export async function search({ faction, characterName, mainEffect }: SearchQuery): Promise<DisplayUniqueCard[]> {
  if (faction == null && characterName == null && mainEffect == null) {
    return []
  }

  let searchParams: UniqueInfoWhereInput[] = []

  if (faction != null) {
    searchParams.push({
      faction: {
        equals: faction
      }
    })
  }

  if (characterName != null) {
    searchParams.push({
      nameEn: {
        contains: characterName,
        mode: "insensitive"
      }
    })
  }  

  if (mainEffect != null) {
    const quotedRegex = /(-?)(?:"([^"]+)"|(\S+))/g;
    let match;
    const tokens: Token[] = [];

    while ((match = quotedRegex.exec(mainEffect)) !== null) {
      // match[1] contains text inside quotes, match[2] contains unquoted text
      tokens.push({ text: match[2] || match[3], negated: match[1] === "-" });
    }

    console.log("Tokens: ", tokens);

    searchParams = searchParams.concat(tokens.map((token) => {
      if (token.negated) {
        return {
          NOT: { mainEffectEn: { contains: token.text, mode: "insensitive" } }
        }
      }
      return {
        mainEffectEn: { contains: token.text, mode: "insensitive" },
      }
    }))
  }
  

  const whereClause: UniqueInfoWhereInput = {
    AND: searchParams,
  }
  
  console.dir(whereClause, { depth: null });

  const results = await prisma.uniqueInfo.findMany({
    where: whereClause,
    orderBy: {
      lastSeenInSalePrice: 'asc'
    }
  });

  const outResults = results.map((result) => ({
    ref: result.ref,
    name: result.nameEn,
    imageUrl: result.imageUrlEn,
    mainEffect: result.mainEffectEn,
    echoEffect: result.echoEffectEn,
    lastSeenInSaleAt: result.lastSeenInSaleAt?.toISOString(),
    lastSeenInSalePrice: result.lastSeenInSalePrice?.toString(),
  }));

  return outResults;
}

