import { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { AbilityPartType, MainUniqueAbility, MainUniqueAbilityPart } from "@prisma/client";
import prisma from "@common/utils/prisma.server";
import { DisplayUniqueCard, Faction } from "~/models/cards";
import { ResultGrid } from "~/components/altered/ResultGrid";
import { ResultsPagination } from "~/components/common/pagination";

interface DisplayAbility {
  id: number
  textEn: string
  parts: {
    trigger: { id: number, textEn: string } | null
    condition: { id: number, textEn: string } | null
    effect: { id: number, textEn: string } | null
  }
}

type LoaderData = {
  part: MainUniqueAbilityPart | null;
  generalSearchLink: string | null;
  abilities: MainUniqueAbility[]
  results: DisplayUniqueCard[]
  pagination: { totalCount: number, pageCount: number, currentPage: number }
};

const PAGE_SIZE = 100;

export async function loader({ params, request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);
  const partId = parseInt(params.partId || "", 10);
  const currentPage = parseInt(searchParams.get("p") ?? "1");

  if (isNaN(partId)) {
    throw new Response("Invalid part ID", { status: 400 });
  }

  // Find the ability part
  const part = await prisma.mainUniqueAbilityPart.findUnique({
    where: { id: partId },
  });

  if (!part) {
    throw new Response("Part not found", { status: 404 });
  }

  // Find all unique cards that have this ability part in any of the part types
  const dbAbilities = await prisma.mainUniqueAbility.findMany({
    where: {
      OR: [
        { triggerId: partId },
        { conditionId: partId },
        { effectId: partId },
      ],
    },
    include: {
      trigger: true,
      condition: true,
      effect: true,
      uniqueInfo: {
        select: {
          id: true,
          ref: true,
          nameEn: true,
          faction: true,
          cardSet: true,
          mainEffectEn: true,
          echoEffectEn: true,
          imageUrlEn: true,
          lastSeenInSaleAt: true,
          lastSeenInSalePrice: true,
        },
      },
    },
    orderBy: {
      uniqueInfo: {
        lastSeenInSalePrice: "asc",
      },
    },
    take: PAGE_SIZE,
    skip: (currentPage - 1) * PAGE_SIZE,
  });

  const totalCount = await prisma.mainUniqueAbility.count({
    where: {
      OR: [
        { triggerId: partId },
        { conditionId: partId },
        { effectId: partId },
      ],
    }
  });

  const results: DisplayUniqueCard[] = dbAbilities.map((ability) => {
    if (!ability.uniqueInfo.ref || !ability.uniqueInfo.nameEn || !ability.uniqueInfo.faction) {
      return null;
    }
    return {
      ref: ability.uniqueInfo.ref,
      name: ability.uniqueInfo.nameEn,
      faction: ability.uniqueInfo.faction as Faction,
      cardSet: ability.uniqueInfo.cardSet ?? "",
      mainEffect: ability.uniqueInfo.mainEffectEn ?? "",
      echoEffect: ability.uniqueInfo.echoEffectEn ?? "",
      imageUrl: ability.uniqueInfo.imageUrlEn ?? "",
      lastSeenInSaleAt: ability.uniqueInfo.lastSeenInSaleAt?.toISOString(),
      lastSeenInSalePrice: ability.uniqueInfo.lastSeenInSalePrice?.toString(),
    };
  }).filter((unique) => unique !== null);

  let generalSearchLink: string | null = null;
  if (part.partType == AbilityPartType.Condition) {
    generalSearchLink = `/search?cond=${part.textEn}`;
  } else if (part.partType == AbilityPartType.Effect) {
    generalSearchLink = `/search?eff=${part.textEn}`;
  } else if (part.partType == AbilityPartType.Trigger) {
    generalSearchLink = `/search?tr=${part.textEn}`;
  }

  return {
    part,
    results,
    generalSearchLink,
    pagination: {
      totalCount, pageCount: Math.ceil(totalCount / PAGE_SIZE),
      currentPage: currentPage
    }
  };
}

export default function ByAbilityPartRoute() {
  const { part, results, pagination, generalSearchLink } = useLoaderData<LoaderData>();
  const { currentPage, totalCount, pageCount } = pagination;
  const [searchParams] = useSearchParams();

  if (!part) {
    return <div className="container mx-auto p-6">Ability part not found</div>;
  }

  const handlePageChange = (page: number) => {
    searchParams.set("p", page.toString());
    window.location.search = searchParams.toString();
  }

  const now = new Date()

  return (
    <div className="container mx-auto p-6">
      <div className="mt-6 mb-2">
        <Link to="/abilities-list" className="text-primary hover:underline">
          ← Back to abilities list
        </Link>
      </div>
      <div className="bg-muted px-4 py-2 rounded-lg mb-6">
        <span className="text text-muted-foreground">Ability ({part.partType}):</span>
        <h1 className="text-xl font-bold mb-2">{part.textEn}</h1>
        <div className="text-sm text-muted-foreground">
          <span>Found in {pagination.totalCount} cards</span>
          <span className="px-2">&middot;</span>
          <span>{generalSearchLink ? <Link to={generalSearchLink} className="text-link">Search with other filters</Link> : null}</span>
        </div>
      </div>

      {pagination.pageCount && pagination.pageCount > 1 ? (
        <div className="mb-6">
          <ResultsPagination
            currentPage={currentPage}
            totalPages={pagination.pageCount}
            onPageChange={handlePageChange}
          />
        </div>
      ) : null}

      {results.length > 0 ? (
        <ResultGrid results={results} now={now} />
      ) : (
        <div className="text-center py-6">
          <p>No unique cards found with this ability part.</p>
        </div>
      )}

    </div>
  );
}
