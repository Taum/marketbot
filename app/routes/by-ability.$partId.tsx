import { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { AbilityPartType, UniqueAbilityLine, UniqueAbilityPart } from "@prisma/client";
import prisma from "@common/utils/prisma.server";
import { DisplayAbilityOnCard, DisplayUniqueCard, Faction } from "~/models/cards";
import { ResultGrid } from "~/components/altered/ResultGrid";
import { ResultsPagination } from "~/components/common/pagination";
import { buildDisplayAbility } from "~/loaders/search";

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
  part: UniqueAbilityPart | null;
  generalSearchLink: string | null;
  abilities: UniqueAbilityLine[]
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
  const part = await prisma.uniqueAbilityPart.findUnique({
    where: { id: partId },
  });

  if (!part) {
    throw new Response("Part not found", { status: 404 });
  }

  const dbAbilityPart = await prisma.uniqueAbilityPart.findUnique({
    where: { id: partId },
  });

  // Find all unique cards that have this ability part in any of the part types
  const dbCards = await prisma.uniqueInfo.findMany({
    where: {
      mainAbilities: {
        some: {
          allParts: {
            some: {
              partId: partId,
            },
          },
        },
      },
    },
    include: {
      mainAbilities: {
        include: {
          allParts: true,
        },
      }
    },
    orderBy: {
      lastSeenInSalePrice: "asc",
    },
    take: PAGE_SIZE,
    skip: (currentPage - 1) * PAGE_SIZE,
  });

  const totalCount = await prisma.uniqueInfo.count({
    where: {
      mainAbilities: {
        some: {
          allParts: {
            some: {
              partId: partId,
            },
          },
        },
      },
    },
  });

  const results: DisplayUniqueCard[] = dbCards.map((card) => {
    if (!card.nameEn) {
      return null;
    }

    let displayAbilities: DisplayAbilityOnCard[] = card.mainAbilities
      .map((a) => buildDisplayAbility(a))
      .filter((x) => x != null)

    return {
      ref: card.ref,
      name: card.nameEn,
      faction: card.faction as Faction,
      cardSet: card.cardSet ?? "",
      mainEffect: card.mainEffectEn ?? "",
      echoEffect: card.echoEffectEn ?? "",
      imageUrl: card.imageUrlEn ?? "",
      lastSeenInSaleAt: card.lastSeenInSaleAt?.toISOString(),
      lastSeenInSalePrice: card.lastSeenInSalePrice?.toString(),
      mainAbilities: displayAbilities.sort((a, b) => a.index - b.index),
    };
  }).filter((unique) => unique !== null);

  let generalSearchLink: string | null = null;
  if (part.partType == AbilityPartType.Condition) {
    generalSearchLink = `/search?cond="${part.textEn}"`;
  } else if (part.partType == AbilityPartType.Effect) {
    generalSearchLink = `/search?eff="${part.textEn}"`;
  } else if (part.partType == AbilityPartType.Trigger) {
    generalSearchLink = `/search?tr="${part.textEn}"`;
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
