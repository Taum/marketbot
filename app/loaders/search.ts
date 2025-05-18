import prisma from "@common/utils/prisma.server.js";

export interface DisplayUniqueCard {
  id: number;
  name: string;
  imageUrl: string;
  mainEffect: string;
  echoEffect: string;
  lastSeenInSaleAt: string;
}

export interface SearchQuery {
  query: string;
}

export async function search({ query }: SearchQuery): Promise<DisplayUniqueCard[]> {
  const results = await prisma.uniqueInfo.findMany({
    where: {
      or: [
        { mainEffectEn: { contains: query } },
        { echoEffectEn: { contains: query } },
      ],
    },
  });

  const outResults = results.map((result) => ({
    id: result.id,
    name: result.nameEn,
    imageUrl: result.imageUrlEn,
    mainEffect: result.mainEffectEn,
    echoEffect: result.echoEffectEn,
  }));

  return outResults;
}
