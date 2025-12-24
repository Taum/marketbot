import prisma from "@common/utils/prisma.server";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { useState, useEffect } from "react";
import { ResultGrid } from "~/components/altered/ResultGrid";
import { ResultsPagination } from "~/components/common/pagination";
import { Button } from "~/components/ui/button";
import { nullifyParseInt } from "~/lib/utils";
import { buildDisplayAbility } from "~/loaders/search";
import { DisplayAbilityOnCard, DisplayUniqueCard, Faction } from "~/models/cards";
import { useTranslation, useLocale } from "~/lib/i18n";
import { runCheckIsDesktop } from "~/lib/mediaQueries";


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

    const displayAbilities: DisplayAbilityOnCard[] = result.mainAbilities
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
  const locale = useLocale();
  const { t } = useTranslation(locale);
  
  const [searchParams] = useSearchParams();
  const currentPage = parseInt(searchParams.get("p") ?? "1");
  
  const [viewMode, setViewMode] = useState<'grid' | 'row'>('row');
  const [isDesktop, setIsDesktop] = useState(true);
  
  // Check if we're on desktop and set initial view mode
  useEffect(() => {
    const checkDesktop = () => {
      const desktop = runCheckIsDesktop();
      setIsDesktop(desktop);
      // Force row mode on mobile
      if (!desktop) {
        setViewMode('row');
      }
    };
    
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);
  
  const handlePageChange = (page: number) => {
    searchParams.set("p", page.toString());
    window.location.search = searchParams.toString();
  };
  
  const results = loaderData.results
  const pagination = loaderData.pagination
  
  // Use row mode on mobile, otherwise use the selected view mode
  const effectiveViewMode = isDesktop ? viewMode : 'row';

  return (
    <div className="global-page">
      <h2 className="text-2xl md:text-3xl font-bold mb-4">{t('textless_title')}</h2>
      
      {results.length > 0 ? (
        <div className="space-y-4 md:space-y-6">
          {pagination ? (
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 md:gap-8">
              <div className="flex-1">
                <h2 className="text-lg md:text-xl font-semibold inline-block">
                  {t('found_count', { count: pagination.totalCount })}
                </h2>
                {loaderData.metrics?.duration && (
                  <span className="ml-2 text-xs text-muted-foreground/50">
                    in {(loaderData.metrics.duration / 1000).toFixed(1)} seconds
                  </span>
                )}
              </div>
              <div className="flex flex-row gap-4 items-center justify-center md:justify-end">
                {pagination.pageCount && pagination.pageCount > 1 ? (
                  <ResultsPagination
                    currentPage={currentPage ?? 1}
                    totalPages={pagination.pageCount ?? 1}
                    onPageChange={handlePageChange}
                  />
                ) : null}
                {/* Only show view toggle on desktop */}
                {isDesktop && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewMode(viewMode === 'grid' ? 'row' : 'grid')}
                    className="flex items-center gap-2"
                  >
                    {viewMode === 'grid' ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="8" y1="6" x2="21" y2="6"/>
                          <line x1="8" y1="12" x2="21" y2="12"/>
                          <line x1="8" y1="18" x2="21" y2="18"/>
                          <line x1="3" y1="6" x2="3.01" y2="6"/>
                          <line x1="3" y1="12" x2="3.01" y2="12"/>
                          <line x1="3" y1="18" x2="3.01" y2="18"/>
                        </svg>
                        {t('row_view')}
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="7" height="7"/>
                          <rect x="14" y="3" width="7" height="7"/>
                          <rect x="14" y="14" width="7" height="7"/>
                          <rect x="3" y="14" width="7" height="7"/>
                        </svg>
                        {t('grid_view')}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          ) : null}
          <ResultGrid results={results} now={now} viewMode={effectiveViewMode} />
        </div>
      ) : (
        <p className="text-gray-600">{t('no_results')}</p>
      )}
    </div>
  );
}
