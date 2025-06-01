import prisma from "@common/utils/prisma.server";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { ResultGrid } from "~/components/altered/ResultGrid";
import { ResultsPagination } from "~/components/common/pagination";
import { ResultsList } from "~/components/results-list";
import { SearchLayout } from "~/components/search-layout";
import { nullifyParseInt } from "~/lib/utils";
import { buildDisplayAbility } from "~/loaders/search";
import { DisplayAbilityOnCard, DisplayUniqueCard, Faction } from "~/models/cards";


interface LoaderData {
  results: DisplayUniqueCard[];
  pagination: {
    currentPage: number;
    totalCount: number;
    pageCount: number;
  } | undefined;
  metrics: {
    duration: number;
  } | undefined;
}

const PAGE_SIZE = 100

const debug = process.env.DEBUG_WEB == "true"

export async function loader({ request }: LoaderFunctionArgs) {
  // You can customize this with your own static or dynamic results
  const url = new URL(request.url);
  const currentPage = nullifyParseInt(url.searchParams.get("p")) ?? 1;

  const startTs = new Date()

  const textlessCards = await prisma.uniqueInfo.findMany({
    where: {
      mainEffectEn: { equals: null },
    },
    include: {
      mainAbilities: {
        include: {
          allParts: true,
        },
      }
    },
    orderBy: {
      lastSeenInSalePrice: 'asc'
    },
  });

  const totalCount = await prisma.uniqueInfo.count({
    where: {
      mainEffectEn: { equals: null },
    },
  });

  if (debug) {
    console.log('Textless total count: ' + totalCount)
  }

  const pageCount = Math.ceil(totalCount / PAGE_SIZE)

  const endTs = new Date()
  const duration = endTs.getTime() - startTs.getTime()

  const results: DisplayUniqueCard[] = textlessCards.map((result) => {
    if (!result.nameEn || !result.faction) {
      return null;
    }

    let displayAbilities: DisplayAbilityOnCard[] = result.mainAbilities
      .map((a) => buildDisplayAbility(a))
      .filter((x) => x != null)

    return {
      ref: result.ref,
      name: result.nameEn,
      faction: result.faction as Faction,
      cardSet: result.cardSet!,
      imageUrl: result.imageUrlEn!,
      mainEffect: result.mainEffectEn,
      echoEffect: result.echoEffectEn,
      lastSeenInSaleAt: result.lastSeenInSaleAt?.toISOString(),
      lastSeenInSalePrice: result.lastSeenInSalePrice?.toString(),
      mainAbilities: displayAbilities.sort((a, b) => a.lineNumber - b.lineNumber),
    }
  }).filter((result) => result !== null);

  return { results, pagination: { currentPage, totalCount, pageCount }, metrics: { duration } };
}

export default function TextlessSearch() {
  const loaderData = useLoaderData<LoaderData>();
  const now = new Date();
  
  const [searchParams] = useSearchParams();
  const currentPage = parseInt(searchParams.get("p") ?? "1");
  
  const handlePageChange = (page: number) => {
    searchParams.set("p", page.toString());
    window.location.search = searchParams.toString();
  };
  
  const results = loaderData.results
  const pagination = loaderData.pagination

  return (
    <div className="global-page">
      <h2>Textless cards</h2>
      
      {results.length > 0 ? (
        <div className="space-y-6">
          {pagination ? (
            <div className="flex flex-row justify-between gap-8">
              <div>
                <h2 className="grow-1 text-xl font-semibold inline-block">
                  Found {pagination.totalCount} cards
                </h2>
                {loaderData.metrics?.duration && (
                  <span className="ml-2 text-xs text-muted-foreground/50">
                    in {(loaderData.metrics.duration / 1000).toFixed(1)} seconds
                  </span>
                )}
              </div>
            {pagination.pageCount && pagination.pageCount > 1 ? (
              <div>
                <ResultsPagination
                  currentPage={currentPage ?? 1}
                  totalPages={pagination.pageCount ?? 1}
                  onPageChange={handlePageChange}
                />
              </div>
              ) : null}
            </div>
          ) : null}
          <ResultGrid results={results} now={now} />
        </div>
      ) : (
        <p className="text-gray-600">No results found.</p>
      )}
    </div>
  );
}
