import { type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData, useSearchParams, useFetcher, useSubmit } from "@remix-run/react";
import { FC, useState, useEffect, useRef } from "react";
import { FactionSelect } from "~/components/altered/FactionSelect";
import { SetSelect } from "~/components/altered/SetSelect";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { nullifyParseInt, nullifyTrim, parseRange } from "~/lib/utils";
import { ResultGrid } from "~/components/altered/ResultGrid";
import { ResultsPagination } from "~/components/common/pagination";
import { allCardSubTypes, CardSubType, DisplayUniqueCard } from "~/models/cards";
import { Checkbox } from "~/components/ui/checkbox";
import { searchWithCTEsIndexingCharacterNames } from "~/loaders/search-alternates";
import { MultiSelect } from "~/components/ui-ext/multi-select";
import prisma from "@common/utils/prisma.server";
import { getTranslator } from "~/lib/i18n.server";
import { useTranslation } from "~/lib/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { SaveSelect } from "~/components/save/SaveSelect";
import { search } from "~/loaders/search";
import { getUserId } from "~/lib/session.server";
import { runCheckIsDesktop } from "~/lib/mediaQueries";


interface SearchQuery {
  faction?: string;
  set?: string | string[];
  characterName?: string;
  cardSubTypes?: string[];
  cardText?: string;
  triggerPart?: string[];
  conditionPart?: string[];
  effectPart?: string[];
  matchAllAbilities?: boolean;
  partIncludeSupport?: boolean;
  partFilterArrow?: boolean;
  partFilterHand?: boolean;
  partFilterReserve?: boolean;
  filterZeroStat?: boolean;
  filterTextless?: boolean;
  mainCostRange?: string;
  recallCostRange?: string;
  includeExpiredCards?: boolean;
  minPrice?: number;
  maxPrice?: number;
  forestPowerRange?: string;
  mountainPowerRange?: string;
  oceanPowerRange?: string;
}

// Maximum number of ability combinations allowed
const MAX_ABILITY_COMBINATIONS = 3;

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
  triggers?: { id: number; text: string }[];
  conditions?: { id: number; text: string }[];
  effects?: { id: number; text: string }[];
  locale?: string;
  localizedFoundText?: string;
  query: SearchQuery;
  error: string | undefined;
  userId?: number;
  savedSearches?: Array<{ id: number; name: string; searchParams: string; updatedAt: string }>;
}


export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const userId = await getUserId(request);
  const lang = nullifyTrim(url.searchParams.get("lang")) ?? "en";
  const cardText = nullifyTrim(url.searchParams.get("text"));
  const characterName = nullifyTrim(url.searchParams.get("cname"));
  const cardSubTypes = nullifyTrim(url.searchParams.get("types"))?.split(",") ?? [];
  const faction = nullifyTrim(url.searchParams.get("f"));
  const setParam = nullifyTrim(url.searchParams.get("s"));
  const set = setParam?.includes(",") ? setParam.split(",") : setParam ?? undefined;
  
  // Parse ability parts as arrays - keep empty strings to maintain alignment
  const triggerParts = url.searchParams.getAll("tr").map(v => v.trim() || "");
  const conditionParts = url.searchParams.getAll("cond").map(v => v.trim() || "");
  const effectParts = url.searchParams.getAll("eff").map(v => v.trim() || "");
  const matchAllAbilities = nullifyTrim(url.searchParams.get("matchAll")) === "1";
  
  const partIncludeSupport = nullifyTrim(url.searchParams.get("inclSup")) === "1";
  const partFilterArrow = nullifyTrim(url.searchParams.get("arrow")) === "1";
  const partFilterHand = nullifyTrim(url.searchParams.get("hand")) === "1";
  const partFilterReserve = nullifyTrim(url.searchParams.get("reserve")) === "1";
  const filterTextless = nullifyTrim(url.searchParams.get("textless")) === "1";
  const filterZeroStat = nullifyTrim(url.searchParams.get("zeroStat")) === "1";
  const mainCostRange = nullifyTrim(url.searchParams.get("mc"));
  const recallCostRange = nullifyTrim(url.searchParams.get("rc"));
  const includeExpiredCards = nullifyTrim(url.searchParams.get("exp")) === "1";
  const minPrice = nullifyParseInt(url.searchParams.get("minpr"));
  const maxPrice = nullifyParseInt(url.searchParams.get("maxpr"));
  const forestPowerRange = nullifyTrim(url.searchParams.get("fp"));
  const mountainPowerRange = nullifyTrim(url.searchParams.get("mp"));
  const oceanPowerRange = nullifyTrim(url.searchParams.get("op"));

  const validSubtypes = cardSubTypes.filter(subtype => allCardSubTypes.map(x => x.value).includes(subtype as CardSubType))

  const originalQuery = {
    faction,
    set,
    characterName,
    cardSubTypes: validSubtypes,
    cardText,
    triggerPart: triggerParts.length > 0 ? triggerParts : undefined,
    conditionPart: conditionParts.length > 0 ? conditionParts : undefined,
    effectPart: effectParts.length > 0 ? effectParts : undefined,
    matchAllAbilities,
    partIncludeSupport,
    partFilterArrow,
    partFilterHand,
    partFilterReserve,
    filterTextless,
    filterZeroStat,
    mainCostRange,
    recallCostRange,
    includeExpiredCards,
    minPrice,
    maxPrice,
    forestPowerRange,
    mountainPowerRange,
    oceanPowerRange
  }

  const currentPage = nullifyParseInt(url.searchParams.get("p")) ?? 1;

  const mainCosts = parseRange(mainCostRange)
  const recallCosts = parseRange(recallCostRange)
  const forestPowers = parseRange(forestPowerRange)
  const mountainPowers = parseRange(mountainPowerRange)
  const oceanPowers = parseRange(oceanPowerRange)

  // fetch ability parts (Trigger/Condition/Effect) - always load these for the dropdowns
  type AbilityPartWithFr = { id: number; textEn: string; textFr: string; partType: string; isSupport: boolean };
  const allParts = await prisma.uniqueAbilityPart.findMany({
    where: { partType: { in: ["Trigger", "Condition", "Effect"] } },
  }) as AbilityPartWithFr[];

  // Sort by the appropriate language field
  const sortedParts = allParts.sort((a, b) => {
    const textA = (lang === "fr" ? a.textFr : a.textEn) || "";
    const textB = (lang === "fr" ? b.textFr : b.textEn) || "";
    return textA.localeCompare(textB);
  });

  const triggers = sortedParts.filter(p => p.partType === "Trigger").map(p => ({ id: p.id, text: lang === "fr" && !!p.textFr ? p.textFr : p.textEn }));
  const conditions = sortedParts.filter(p => p.partType === "Condition").map(p => ({ id: p.id, text: lang === "fr" && !!p.textFr ? p.textFr : p.textEn }));
  const effects = sortedParts.filter(p => p.partType === "Effect").map(p => ({ id: p.id, text: lang === "fr" && !!p.textFr ? p.textFr : p.textEn }));

  // Fetch saved searches for the logged-in user
  let savedSearches: Array<{ id: number; name: string; searchParams: string; updatedAt: Date }> = [];
  if (userId) {
    savedSearches = await prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        searchParams: true,
        updatedAt: true,
      }
    });
  }

  try {
    const startTs = performance.now()

    // Edge case: Limit maximum ability combinations
    const MAX_ABILITY_COMBINATIONS = 3;
    const maxLength = Math.max(triggerParts.length, conditionParts.length, effectParts.length);
    
    if (maxLength > MAX_ABILITY_COMBINATIONS) {
      return {
        results: [],
        pagination: undefined,
        metrics: undefined,
        triggers,
        conditions,
        effects,
        locale: lang,
        localizedFoundText: undefined,
        query: originalQuery,
        error: `Too many ability combinations. Maximum allowed is ${MAX_ABILITY_COMBINATIONS}.`,
        userId,
        savedSearches
      };
    }

    // Check if we have multiple ability combinations
    // Count how many complete combinations we have (at least one part filled per index)
    let combinationCount = 0;
    for (let i = 0; i < maxLength; i++) {
      const hasTrigger = triggerParts[i]?.trim();
      const hasCondition = conditionParts[i]?.trim();
      const hasEffect = effectParts[i]?.trim();
      if (hasTrigger || hasCondition || hasEffect) {
        combinationCount++;
      }
    }
    const hasMultipleAbilities = combinationCount > 1;

    // Use search.ts for multiple abilities (has full multi-ability support)
    // Use searchWithCTEsIndexingCharacterNames for single ability (optimized)
    const { results, pagination } = hasMultipleAbilities 
      ? await search(
          {
            faction,
            set,
            characterName,
            cardSubTypes: validSubtypes,
            cardText,
            triggerPart: triggerParts.length > 0 ? triggerParts : undefined,
            conditionPart: conditionParts.length > 0 ? conditionParts : undefined,
            effectPart: effectParts.length > 0 ? effectParts : undefined,
            matchAllAbilities,
            partIncludeSupport,
            partFilterArrow,
            partFilterHand,
            partFilterReserve,
            filterTextless,
            filterZeroStat,
            mainCosts,
            recallCosts,
            includeExpiredCards,
            minPrice,
            maxPrice,
            forestPowers,
            mountainPowers,
            oceanPowers
          },
          {
            page: currentPage,
            includePagination: true,
            locale: lang
          }
        )
      : await searchWithCTEsIndexingCharacterNames(
          {
            faction,
            set,
            characterName,
            cardSubTypes: validSubtypes,
            cardText,
            triggerPart: triggerParts.length > 0 ? triggerParts : undefined,
            conditionPart: conditionParts.length > 0 ? conditionParts : undefined,
            effectPart: effectParts.length > 0 ? effectParts : undefined,
            matchAllAbilities,
            partIncludeSupport,
            partFilterArrow,
            partFilterHand,
            partFilterReserve,
            filterTextless,
            filterZeroStat,
            mainCosts,
            recallCosts,
            includeExpiredCards,
            minPrice,
            maxPrice,
            forestPowers,
            mountainPowers,
            oceanPowers
          },
          {
            page: currentPage,
            includePagination: true,
            locale: lang
          }
        );

    const endTs = performance.now()
    const duration = endTs - startTs

    const t = getTranslator(lang);
    const localizedFoundText = pagination ? t("found_count", { count: pagination.totalCount }) : undefined;

    return {
      results,
      pagination: { ...pagination, currentPage },
      metrics: {
        duration,
      },
      triggers,
      conditions,
      effects,
      locale: lang,
      localizedFoundText,
      query: originalQuery,
      userId,
      savedSearches,
    };
  } catch (e) {
    console.error("Search error: ", e);
    return {
      error: e.message,
      results: [],
      pagination: undefined,
      metrics: undefined,
      triggers,
      conditions,
      effects,
      locale: lang,
      query: originalQuery,
      userId,
      savedSearches,
    }
  }
}

export default function SearchPage() {
  const loaderData = useLoaderData<LoaderData>();
  const { t } = useTranslation(loaderData.locale);
  const [searchParams] = useSearchParams();
  const saveFetcher = useFetcher<{ success?: boolean; error?: string; message?: string }>();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'row'>('grid');
  const [gridColumns, setGridColumns] = useState<2 | 3 | 4>(3);
  const [hasLastSearch, setHasLastSearch] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const hasLoadedPreferences = useRef(false);

  const now = new Date();

  const results = loaderData.results
  const pagination = loaderData.pagination

  const currentPage = parseInt(searchParams.get("p") ?? "1");

  // Prevent body scroll on this page
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Check if we're on desktop
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

  // Load view preferences from localStorage on mount
  useEffect(() => {
    try {
      const savedViewMode = localStorage.getItem('viewMode');
      const savedGridColumns = localStorage.getItem('gridColumns');
      const savedShowFilters = localStorage.getItem('showFilters');
      
      if (savedViewMode === 'grid' || savedViewMode === 'row') {
        setViewMode(savedViewMode);
      }
      
      if (savedGridColumns) {
        const cols = parseInt(savedGridColumns);
        if (cols === 2 || cols === 3 || cols === 4) {
          setGridColumns(cols);
        }
      }
      
      if (savedShowFilters !== null) {
        setShowFilters(savedShowFilters === 'true');
      }
      
      // Mark as loaded after state updates are queued
      setTimeout(() => {
        hasLoadedPreferences.current = true;
      }, 0);
    } catch (e) {
      console.error('Failed to load view preferences:', e);
      hasLoadedPreferences.current = true;
    }
  }, []);

  // Save viewMode to localStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (!hasLoadedPreferences.current) {
      return;
    }
    try {
      localStorage.setItem('viewMode', viewMode);
    } catch (e) {
      console.error('Failed to save viewMode:', e);
    }
  }, [viewMode]);

  // Save gridColumns to localStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (!hasLoadedPreferences.current) {
      return;
    }
    try {
      localStorage.setItem('gridColumns', gridColumns.toString());
    } catch (e) {
      console.error('Failed to save gridColumns:', e);
    }
  }, [gridColumns]);

  // Save showFilters to localStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (!hasLoadedPreferences.current) {
      return;
    }
    try {
      localStorage.setItem('showFilters', showFilters.toString());
    } catch (e) {
      console.error('Failed to save showFilters:', e);
    }
  }, [showFilters]);

  // Check if there's a saved search on mount
  useEffect(() => {
    try {
      const lastSearch = localStorage.getItem('lastSearch');
      const currentSearch = searchParams.toString();
      // Has last search AND it's different from current
      setHasLastSearch(!!lastSearch && lastSearch !== currentSearch);
    } catch (e) {
      setHasLastSearch(false);
    }
  }, [searchParams]);

  // Save current search to localStorage whenever search params change
  useEffect(() => {
    const hasSearchParams = Array.from(searchParams.keys()).some(
      key => key !== 'lang' && key !== 'p'
    );
    
    if (hasSearchParams) {
      try {
        localStorage.setItem('lastSearch', searchParams.toString());
        setHasLastSearch(true);
      } catch (e) {
        console.error('Failed to save search to localStorage', e);
      }
    }
  }, [searchParams]);

  const handleRestoreLastSearch = () => {
    try {
      const lastSearch = localStorage.getItem('lastSearch');
      if (lastSearch) {
        const params = new URLSearchParams(lastSearch);
        // Keep current language
        const currentLang = searchParams.get('lang');
        if (currentLang) {
          params.set('lang', currentLang);
        }
        // Reset to page 1
        params.delete('p');
        
        window.location.search = params.toString();
      }
    } catch (e) {
      console.error('Failed to restore search from localStorage', e);
    }
  };

  const handlePageChange = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("p", page.toString());
    window.location.search = newParams.toString();
  };

  // Build active filters summary
  const getActiveFiltersSummary = () => {
    const filters: string[] = [];
    const query = loaderData.query;
    
    if (query.faction) filters.push(t('faction') + `: ${query.faction}`);
    if (query.set) filters.push(t('set') + `: ${query.set}`);
    if (query.characterName) filters.push(t('character_name') + `: ${query.characterName}`);
    if (query.cardSubTypes && query.cardSubTypes.length > 0) {
      filters.push(t('character_type') + `: ${query.cardSubTypes.join(', ')}`);
    }
    if (query.mainCostRange) filters.push(t('hand_cost') + `: ${query.mainCostRange}`);
    if (query.recallCostRange) filters.push(t('reserve_cost') + `: ${query.recallCostRange}`);
    if (query.forestPowerRange) filters.push(t('forest_power') + `: ${query.forestPowerRange}`);
    if (query.mountainPowerRange) filters.push(t('mountain_power') + `: ${query.mountainPowerRange}`);
    if (query.oceanPowerRange) filters.push(t('ocean_power') + `: ${query.oceanPowerRange}`);
    if (query.cardText) filters.push(t('placeholder_card_text') + `: "${query.cardText}"`);
    
    // Display ability searches
    if (query.triggerPart && query.triggerPart.length > 0) {
      query.triggerPart.forEach((tp, idx) => {
        const parts: string[] = [];
        if (tp) parts.push(t('trigger') + `: "${tp}"`);
        if (query.conditionPart?.[idx]) parts.push(t('condition') + `: "${query.conditionPart[idx]}"`);
        if (query.effectPart?.[idx]) parts.push(t('effect') + `: "${query.effectPart[idx]}"`);
        if (parts.length > 0) {
          filters.push(`Ability ${idx + 1}: ${parts.join(' + ')}`);
        }
      });
      if (query.matchAllAbilities) {
        filters.push('Match: ALL abilities');
      } else {
        filters.push('Match: ANY ability');
      }
    }
    
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const priceRange = [
        query.minPrice !== undefined ? `${query.minPrice}` : '',
        query.maxPrice !== undefined ? `${query.maxPrice}` : ''
      ].filter(Boolean).join(' - ');
      filters.push(t('min_price') + ` - ${t('max_price')}: ${priceRange}`);
    }
    if (query.includeExpiredCards) filters.push(t('include_unavailable'));
    
    return filters.length > 0 ? filters.join(' • ') : null;
  };

  const activeFilters = getActiveFiltersSummary();
  
  // Use row mode on mobile, otherwise use the selected view mode
  const effectiveViewMode = isDesktop ? viewMode : 'row';

  return (
    <div className="flex flex-row h-[calc(100vh-3rem)] overflow-hidden">
      {/* Left Content - Results */}
      <div className="flex-1 flex flex-col p-6">
        {results.length > 0 ? (
          <div id="results" className="relative flex flex-col h-full">
            {pagination ? (
              <div className="mb-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                  {/* Left: Results count */}
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold inline-block">
                      {loaderData.localizedFoundText ?? `${t('found_count', { count: pagination.totalCount })}`}
                    </h2>
                    {loaderData.metrics?.duration && (
                        <span className="ml-2 text-xs text-muted-foreground/50">
                          {t('in_seconds', { seconds: (loaderData.metrics.duration / 1000).toFixed(1) })}
                        </span>
                      )}
                    {activeFilters && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {activeFilters}
                      </div>
                    )}
                  </div>
                  
                  {/* Center: Pagination */}
                  <div className="flex-1 flex justify-center md:justify-center">
                    {pagination.pageCount && pagination.pageCount > 1 ? (
                      <ResultsPagination
                        currentPage={currentPage ?? 1}
                        totalPages={pagination.pageCount ?? 1}
                        onPageChange={handlePageChange}
                      />
                    ) : null}
                  </div>
                  
                  {/* Right: Control buttons */}
                  <div className="flex-1 flex flex-row gap-4 items-center justify-end">
                    {/* Only show column selector and view toggle on desktop */}
                    {isDesktop && viewMode === 'grid' && (
                      <Select
                        value={gridColumns.toString()}
                        onValueChange={(value) => setGridColumns(parseInt(value) as 2 | 3 | 4)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder={t('columns')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">{t('columns_2')}</SelectItem>
                          <SelectItem value="3">{t('columns_3')}</SelectItem>
                          <SelectItem value="4">{t('columns_4')}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
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
                    {/* Show filters toggle button - always visible */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                      className="flex items-center gap-2"
                    >
                      {showFilters ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18M6 6l12 12"/>
                          </svg>
                          {t('hide_filters')}
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                          </svg>
                          {t('show_filters')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="overflow-y-auto flex-1">
              <ResultGrid results={results} now={now} viewMode={effectiveViewMode} gridColumns={gridColumns} />
            </div>
          </div>
        ) : (loaderData.error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-red-500">{t('error_prefix')} {loaderData.error}</p>
            {!showFilters && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => setShowFilters(true)}
                className="flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                {t('show_filters')}
              </Button>
            )}
          </div>
        ) : loaderData.query ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-gray-600">{t('no_results')}</p>
            {!showFilters && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => setShowFilters(true)}
                className="flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                {t('show_filters')}
              </Button>
            )}
          </div>
        ) : (
          // Empty state - show restore button if available
          <div className="flex flex-col items-center justify-center h-full gap-4">
            {hasLastSearch ? (
              <>
                <p className="text-muted-foreground">{t('no_search_yet')}</p>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleRestoreLastSearch}
                  className="flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                    <path d="M3 21v-5h5"/>
                  </svg>
                  {t('restore_last_search')}
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground">{t('no_search_yet')}</p>
            )}
            {!showFilters && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => setShowFilters(true)}
                className="flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                {t('show_filters')}
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Right Sidebar - Search Form */}
      {showFilters && (
        <>
          {/* Mobile: Full-screen overlay */}
          {!isDesktop && (
            <div className="fixed inset-0 z-50 bg-background">
              <div className="flex flex-col h-full">
                {/* Mobile header with close button */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-muted/5">
                  <h2 className="text-lg font-semibold">{t('search_filters')}</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFilters(false)}
                    className="flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    {t('close')}
                  </Button>
                </div>
                
                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto p-4">
                  {/* Restore Last Search Button */}
                  {hasLastSearch && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRestoreLastSearch}
                      className="w-full flex items-center justify-center gap-2 mb-4"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                        <path d="M21 3v5h-5"/>
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                        <path d="M3 21v-5h5"/>
                      </svg>
                      {t('restore_last_search')}
                    </Button>
                  )}
                  
                  <SearchForm 
                    {...loaderData.query} 
                    triggers={loaderData.triggers}
                    conditions={loaderData.conditions}
                    effects={loaderData.effects}
                    locale={loaderData.locale}
                    userId={loaderData.userId}
                    savedSearches={loaderData.savedSearches}
                    onSearch={() => setShowFilters(false)}
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Desktop: Side drawer */}
          {isDesktop && (
            <div className="w-[360px] flex-shrink-0 border-l border-border overflow-y-auto p-6 bg-muted/5">
              <h2 className="text-lg font-semibold mb-4">{t('search_filters')}</h2>
          
              {/* Restore Last Search Button */}
              {hasLastSearch && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRestoreLastSearch}
                  className="w-full flex items-center justify-center gap-2 mb-4"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                    <path d="M3 21v-5h5"/>
                  </svg>
                  {t('restore_last_search')}
                </Button>
              )}
          
              <SearchForm 
                {...loaderData.query} 
                triggers={loaderData.triggers}
                conditions={loaderData.conditions}
                effects={loaderData.effects}
                locale={loaderData.locale}
                userId={loaderData.userId}
                savedSearches={loaderData.savedSearches}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

const SearchForm: FC<
  SearchQuery & {
    triggers?: { id: number; text: string }[];
    conditions?: { id: number; text: string }[];
    effects?: { id: number; text: string }[];
    locale?: string;
    userId?: number;
    savedSearches?: Array<{ id: number; name: string; searchParams: string; updatedAt: string }>;
    onSearch?: () => void;
  }
> = ({
  faction,
  set,
  characterName,
  cardSubTypes,
  cardText,
  triggerPart: triggerParts,
  conditionPart: conditionParts,
  effectPart: effectParts,
  matchAllAbilities,
  partIncludeSupport,
  partFilterArrow,
  partFilterHand,
  partFilterReserve,
  filterZeroStat,
  filterTextless,
  mainCostRange,
  recallCostRange,
  includeExpiredCards,
  minPrice,
  maxPrice,
  forestPowerRange,
  mountainPowerRange,
  oceanPowerRange
  , triggers = [], conditions = [], effects = []
  , locale
  , userId
  , savedSearches = []
  , onSearch
}: SearchQuery & { triggers?: { id: number; text: string }[]; conditions?: { id: number; text: string }[]; effects?: { id: number; text: string }[]; locale?: string; userId?: number; savedSearches?: Array<{ id: number; name: string; searchParams: string; updatedAt: string }>; onSearch?: () => void }) => {
  const { t } = useTranslation(locale);
  const saveFetcher = useFetcher<{ success?: boolean; error?: string; message?: string }>();
  const deleteFetcher = useFetcher<{ success?: boolean; error?: string; message?: string }>();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [searchParams] = useSearchParams();
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
  
  // Load the last selected search from localStorage on mount
  const [selectedSearch, setSelectedSearch] = useState<string>("");

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const lastSearch = localStorage.getItem('lastSelectedSearch') || "";
      // Only set if the saved search still exists
      if (lastSearch && savedSearches.find(s => s.id.toString() === lastSearch)) {
        setSelectedSearch(lastSearch);
      }
    }
    return () => {
      localStorage.removeItem('lastSelectedSearch');
    };
  }, [savedSearches])
  
  // Save to localStorage whenever selection changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (selectedSearch) {
        localStorage.setItem('lastSelectedSearch', selectedSearch);
      } else {
        localStorage.removeItem('lastSelectedSearch');
      }
    }
  }, [selectedSearch]);
  
  // Check if search name exists
  const existingSearch = savedSearches.find(s => s.name === searchName.trim());
  
  const handleSaveSearch = () => {
    if (!searchName.trim()) return;
    
    // If name exists and user hasn't confirmed, show warning
    if (existingSearch && !showOverwriteWarning) {
      setShowOverwriteWarning(true);
      return;
    }
    
    saveFetcher.submit(
      {
        name: searchName.trim(),
        searchParams: searchParams.toString()
      },
      { method: "post", action: "/api/save-search" }
    );
    setShowOverwriteWarning(false);
  };
  
  // Close dialog and reload when save is successful
  useEffect(() => {
    if (saveFetcher.data?.success) {
      setSearchName("");
      setShowSaveDialog(false);
      setShowOverwriteWarning(false);
      // Small delay before reload to show success message
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  }, [saveFetcher.data]);
  
  // Reload when delete is successful
  useEffect(() => {
    if (deleteFetcher.data?.success) {
      localStorage.removeItem('lastSelectedSearch');
      window.location.reload();
    }
  }, [deleteFetcher.data]);
  
  const handleLoadSearch = (searchParamsStr: string) => {
    window.location.search = searchParamsStr;
  };
  
  const handleDeleteSearch = (searchId: number) => {
    if (confirm(t('confirm_delete_search') || "Are you sure you want to delete this saved search?")) {
      deleteFetcher.submit(
        { searchId: searchId.toString() },
        { method: "post", action: "/api/delete-saved-search" }
      );
      setSelectedSearch("");
    }
  };
  
  const submit = useSubmit();
  
  const handleRemoveAbility = (index: number) => {
    const newAbilities = savedAbilities.filter((_, i) => i !== index);
    setSavedAbilities(newAbilities);
    
    // Build form data with updated abilities
    const formData = new FormData(document.getElementById('search-form') as HTMLFormElement);
    
    // Remove all existing ability params
    formData.delete('tr');
    formData.delete('cond');
    formData.delete('eff');
    
    // Add updated abilities
    newAbilities.forEach(ability => {
      if (ability.trigger) formData.append('tr', ability.trigger);
      if (ability.condition) formData.append('cond', ability.condition);
      if (ability.effect) formData.append('eff', ability.effect);
    });
    
    // Submit the form
    submit(formData, { method: "get" });
  };
  
  const [selectedFaction, setSelectedFaction] = useState(faction ?? undefined);
  const [selectedSet, setSelectedSet] = useState<string | string[] | undefined>(set ?? undefined);
  const [selectedCardSubTypes, setSelectedCardSubTypes] = useState<string[]>(cardSubTypes ?? []);
  
  // State for managing multiple ability searches
  type AbilitySearch = { trigger: string; condition: string; effect: string };
  const [savedAbilities, setSavedAbilities] = useState<AbilitySearch[]>(() => {
    // Initialize from URL params
    const maxLen = Math.max(triggerParts?.length ?? 0, conditionParts?.length ?? 0, effectParts?.length ?? 0);
    if (maxLen === 0) return [];
    
    const abilities: AbilitySearch[] = [];
    for (let i = 0; i < maxLen; i++) {
      const ability: AbilitySearch = {
        trigger: triggerParts?.[i] || "",
        condition: conditionParts?.[i] || "",
        effect: effectParts?.[i] || ""
      };
      // Only add if at least one part is non-empty
      if (ability.trigger || ability.condition || ability.effect) {
        abilities.push(ability);
      }
    }
    return abilities;
  });
  const [matchAll, setMatchAll] = useState<boolean>(matchAllAbilities ?? false);
  
  // Current input values (for adding new ability search)
  const [triggerValue, setTriggerValue] = useState<string>("");
  const [showTriggerOptions, setShowTriggerOptions] = useState<boolean>(false);
  const [conditionValue, setConditionValue] = useState<string>("");
  const [showConditionOptions, setShowConditionOptions] = useState<boolean>(false);
  const [effectValue, setEffectValue] = useState<string>("");  const [showEffectOptions, setShowEffectOptions] = useState<boolean>(false);

  const filteredTriggers = triggers.filter(tr => {
    const q = triggerValue?.toLowerCase().trim();
    if (!q) return true;
    return tr.text.toLowerCase().includes(q);
  });

  const filteredConditions = conditions.filter(t => {
    const q = conditionValue?.toLowerCase().trim();
    if (!q) return true;
    return t.text.toLowerCase().includes(q);
  });

  const filteredEffects = effects.filter(t => {
    const q = effectValue?.toLowerCase().trim();
    if (!q) return true;
    return t.text.toLowerCase().includes(q);
  });

  const [isAdvSearchOpen, setIsAdvSearchOpen] = useState(false);
  const [isIdentityOpen, setIsIdentityOpen] = useState(true);
  const [isCostsOpen, setIsCostsOpen] = useState(false);
  const [isPowersOpen, setIsPowersOpen] = useState(false);
  const [isTextTypeOpen, setIsTextTypeOpen] = useState(false);
  const [isEffectsOpen, setIsEffectsOpen] = useState(false);
  const [isPricesOpen, setIsPricesOpen] = useState(false);
  const [isSaveLoadOpen, setIsSaveLoadOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [loadingSave, setLoadingSave] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  const [additionalSearchParams, setAdditionalSearchParams] = useState<URLSearchParams | undefined>(undefined);

  useEffect(() => {
    setAdditionalSearchParams(searchParams);
    setIsAdvSearchOpen(searchParams.has("arrow") || searchParams.has("hand") || searchParams.has("reserve") || searchParams.has("inclSup") || searchParams.has("zeroStat") || searchParams.has("textless"));
  }, [searchParams]);

  const handleExpiredCardsChange = (newValue: boolean) => {
    const newParams = new URLSearchParams(searchParams);
    if (newValue) {
      newParams.set("exp", "1");
    } else {
      newParams.delete("exp");
    }
    window.location.search = newParams.toString();
  }
  
  const handleArrow = (newValue: boolean) => {
    setAdditionalSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (newValue) {
        newParams.set("arrow", "1");
      } else {
        newParams.delete("arrow");
      }
      return newParams;
    });
  }
  
  const handleHand = (newValue: boolean) => {
    setAdditionalSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (newValue) {
        newParams.set("hand", "1");
      } else {
        newParams.delete("hand");
      }
      return newParams;
    });
  }
  
  const handleReserve = (newValue: boolean) => {
    setAdditionalSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (newValue) {
        newParams.set("reserve", "1");
      } else {
        newParams.delete("reserve");
      }
      return newParams;
    });
  }

  const handleIncludeSupport = (newValue: boolean) => {
    setAdditionalSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (newValue) {
        newParams.set("inclSup", "1");
      } else {
        newParams.delete("inclSup");
      }
      return newParams;
    });
  }
  
  const handleSearchZero = (newValue: boolean) => {
    setAdditionalSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (newValue) {
        newParams.set("zeroStat", "1");
      } else {
        newParams.delete("zeroStat");
      }
      return newParams;
    });
  }
  
  const handleTextless = (newValue: boolean) => {
    setAdditionalSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (newValue) {
        newParams.set("textless", "1");
      } else {
        newParams.delete("textless");
      }
      return newParams;
    });
  }

  const handleCardSubTypesChange = (newValues: string[]) => {
    setSelectedCardSubTypes(newValues);
    const newParams = new URLSearchParams(searchParams);
    newParams.set("types", newValues.join(","));
  }

  const deleteSave = () => {
    setError(false);
    setMessage('');
    if(!loadingSave) {
      setMessage('You must select a save to delete.');
      setError(true);
    }
    else if(!showConfirm) {
      setError(true);
      setMessage(`The save "${loadingSave}" will be deleted permanently. Are you sure?`);
      setShowConfirm(true);
    }
    else {
      // save search to cookie
      deleteCookie(`save-market-${loadingSave}`);
    }
  };

  const loadSearch = () => {
    setMessage('');
    if (loadingSave) {
      const savedSearch = document.cookie
        .split('; ')
        .find(cookie => cookie.startsWith(`save-market-${loadingSave}`))
        ?.split('=')[1];
      if (savedSearch) {
        const loadedSaveParams = decodeURIComponent(savedSearch);
        window.location.search = loadedSaveParams;
      }
    }
  }

  const saveSearch = () => {
    setError(false);
    setMessage('');
    if(!saveName) {
      setMessage('You must provide a name to save this research.');
      setError(true);
    }
    else {
      // save search to cookie
      setCookie(`save-market-${saveName}`, window.location.search, 30);
      setMessage('Your search has been saved and can be reloaded for 1 month');
    }
  } 

  function setCookie(name: string, value: string, days: number) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
  }

  function deleteCookie(name: string) {
    const expires = new Date(0).toUTCString();
    document.cookie = `${name}=; expires=${expires}; path=/`;
    setLoadingSave('');
    setShowConfirm(false);
    setMessage(`The save "${loadingSave}" has been deleted.`);
  }

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // If there are values in the current input fields, add them as a new ability before submitting
    if (triggerValue || conditionValue || effectValue) {
      e.preventDefault();
      
      const newAbilities = [...savedAbilities, {
        trigger: triggerValue,
        condition: conditionValue,
        effect: effectValue
      }];
      
      const formData = new FormData(e.currentTarget);
      
      // Remove all existing ability params
      formData.delete('tr');
      formData.delete('cond');
      formData.delete('eff');
      
      // Add all abilities (including the new one) with proper array alignment
      newAbilities.forEach(ability => {
        formData.append('tr', ability.trigger || "");
        formData.append('cond', ability.condition || "");
        formData.append('eff', ability.effect || "");
      });
      
      submit(formData, { method: "get" });
    }
    // Otherwise, let the form submit normally with just the saved abilities
  };

  return (
    <Form method="get" id="search-form" className="space-y-4" onSubmit={handleFormSubmit}>
      {/* Preserve the lang parameter across form submissions */}
      <div className="space-y-4">
        {/* Saved Searches - Only visible when logged in */}
        {userId && savedSearches && savedSearches.length > 0 && (
          <div className="border-b border-border pb-4">
            <Label htmlFor="saved-search">{t('saved_searches')}</Label>
            <div className="flex flex-row gap-2 mt-2">
              <Select
                value={selectedSearch || "none"}
                onValueChange={(value) => {
                  if (value === "none") {
                    setSelectedSearch("");
                    return;
                  }
                  setSelectedSearch(value);
                  const search = savedSearches.find(s => s.id.toString() === value);
                  if (search) {
                    handleLoadSearch(search.searchParams);
                  }
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue>
                    {selectedSearch 
                      ? savedSearches.find(s => s.id.toString() === selectedSearch)?.name 
                      : t('select_saved_search')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">{t('select_saved_search')}</span>
                  </SelectItem>
                  {savedSearches.map((search) => (
                    <SelectItem key={search.id} value={search.id.toString()}>
                      {search.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowSaveDialog(true)}
                title={t('save_current_search')}
                className="w-10 h-10 p-0"
              >
                <img src="/assets/save.svg" alt="Save" className="w-5 h-5 dark:invert" />
              </Button>
              
              {selectedSearch && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleDeleteSearch(parseInt(selectedSearch))}
                  title={t('delete_saved_search')}
                  className="w-10 h-10 p-0"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                  </svg>
                </Button>
              )}
            </div>
          </div>
        )}
        
        {/* Save button for logged in users with no saved searches yet */}
        {userId && (!savedSearches || savedSearches.length === 0) && (
          <div className="border-b border-border pb-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSaveDialog(true)}
              className="w-full flex items-center justify-center gap-2"
            >
              <img src="/assets/save.svg" alt="Save" className="w-5 h-5 dark:invert" />
              <span>{t('save_current_search')}</span>
            </Button>
          </div>
        )}
        
        {/* Identity Section - Collapsible, Open by default */}
        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setIsIdentityOpen(!isIdentityOpen)}
            className="w-full flex items-center justify-between py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            <span>{t('section_identity')}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${isIdentityOpen ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
        {isIdentityOpen && (
          <div className="space-y-4">
              {/* Faction */}
              <div>
                <Label>{t('faction')}</Label>
                <FactionSelect
                  value={selectedFaction ?? "any"}
                  onValueChange={(newVal) => setSelectedFaction(newVal == "any" ? undefined : newVal)} />
                <input type="hidden" name="f" value={selectedFaction} />
              </div>

              {/* Set */}
              <div>
                <Label htmlFor="cname">{t('set')}</Label>
                <SetSelect
                  multiple
                  value={Array.isArray(selectedSet) ? selectedSet : selectedSet ? [selectedSet] : []}
                  onValueChange={(newVals) => setSelectedSet(Array.isArray(newVals) && newVals.length > 0 ? newVals : undefined)} />
                {Array.isArray(selectedSet) ? (
                  <input type="hidden" name="s" value={selectedSet.join(",")} />
                ) : selectedSet ? (
                  <input type="hidden" name="s" value={selectedSet} />
                ) : null}
              </div>

              {/* Character Name */}
              <div>
                <Label htmlFor="cname">{t('character_name')}</Label>
                <Input
                  type="text"
                  name="cname"
                  defaultValue={characterName ?? ""}
                  placeholder={t('placeholder_character_name')}
                />
              </div>
          </div>
        )}

        {/* COSTS Section - Collapsible */}
        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setIsCostsOpen(!isCostsOpen)}
            className="w-full flex items-center justify-between py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            <span>{t('section_costs')}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${isCostsOpen ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
        {isCostsOpen && (
          <div className="space-y-4">
            {/* Hand Cost */}
            <div>
              <Label htmlFor="mc">{t('hand_cost')}</Label>
              <Input
                type="text"
                name="mc"
                defaultValue={mainCostRange ?? ""}
                placeholder={t('placeholder_hand_cost')}
              />
            </div>

            {/* Reserve Cost */}
            <div>
              <Label htmlFor="rc">{t('reserve_cost')}</Label>
              <Input
                type="text"
                name="rc"
                defaultValue={recallCostRange ?? ""}
                placeholder={t('placeholder_reserve_cost')}
              />
            </div>
          </div>
        )}

        {/* POWER STATS Section - Collapsible */}
        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setIsPowersOpen(!isPowersOpen)}
            className="w-full flex items-center justify-between py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            <span>{t('section_power_stats')}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${isPowersOpen ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
        {isPowersOpen && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="fp">{t('forest_power')}</Label>
              <Input
                type="text"
                name="fp"
                defaultValue={forestPowerRange ?? ""}
                placeholder={t('placeholder_power_range')}
              />
            </div>

            <div>
              <Label htmlFor="mp">{t('mountain_power')}</Label>
              <Input
                type="text"
                name="mp"
                defaultValue={mountainPowerRange ?? ""}
                placeholder={t('placeholder_power_range')}
              />
            </div>

            <div>
              <Label htmlFor="op">{t('ocean_power')}</Label>
              <Input
                type="text"
                name="op"
                defaultValue={oceanPowerRange ?? ""}
                placeholder={t('placeholder_power_range')}
              />
            </div>
          </div>
        )}

        {/* TEXT & TYPE Section - Collapsible */}
        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setIsTextTypeOpen(!isTextTypeOpen)}
            className="w-full flex items-center justify-between py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            <span>{t('section_text_type')}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${isTextTypeOpen ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
        {isTextTypeOpen && (
          <div className="space-y-4">
            {/* Card Text */}
            <div>
              <Label htmlFor="text">Card text</Label>
              <Input
                type="search"
                name="text"
                defaultValue={cardText ?? ""}
                placeholder={t('placeholder_card_text')}
              />
            </div>

            {/* Character Type */}
            <div>
              <Label htmlFor="cname">{t('character_type')}</Label>
              <MultiSelect
                options={allCardSubTypes}
                onValueChange={handleCardSubTypesChange}
                defaultValue={selectedCardSubTypes}
                placeholder={t('placeholder_select_character_types')}
                variant="secondary"
                animation={0.5}
                maxCount={2}
              />
              <input type="hidden" name="types" value={selectedCardSubTypes.join(",")} />
            </div>
          </div>
        )}

        {/* EFFECTS Section - Collapsible */}
        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setIsEffectsOpen(!isEffectsOpen)}
            className="w-full flex items-center justify-between py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            <span>{t('section_effects')}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${isEffectsOpen ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
        {isEffectsOpen && (
          <div className="space-y-4">
            {/* Saved Abilities List */}
            {savedAbilities.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">{t('saved_ability_searches')}</Label>
                  <span className="text-xs text-muted-foreground">
                    {savedAbilities.length} / {MAX_ABILITY_COMBINATIONS}
                  </span>
                </div>
                {savedAbilities.map((ability, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-secondary/50 rounded-md border border-border">
                    <div className="flex-1 text-sm">
                      {ability.trigger && <span className="font-medium">{t('trigger')}: {ability.trigger}</span>}
                      {ability.trigger && (ability.condition || ability.effect) && <span className="mx-1">+</span>}
                      {ability.condition && <span className="font-medium">{t('condition')}: {ability.condition}</span>}
                      {ability.condition && ability.effect && <span className="mx-1">+</span>}
                      {ability.effect && <span className="font-medium">{t('effect')}: {ability.effect}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAbility(index)}
                      className="ml-2 text-red-500 hover:text-red-700"
                      aria-label="Remove ability"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Match All/Any Toggle */}
            {savedAbilities.length > 0 && (
              <div className="flex items-center gap-2">
                <Label htmlFor="matchAll" className="text-sm">{t('match_label')}</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMatchAll(false);
                      // Build form data with updated matchAll value
                      const formData = new FormData(document.getElementById('search-form') as HTMLFormElement);
                      formData.delete('matchAll');
                      formData.set('matchAll', '0');
                      // Submit the form
                      setTimeout(() => submit(formData, { method: "get" }), 0);
                    }}
                    className={`px-3 py-1 rounded text-sm ${!matchAll ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}
                  >
                    {t('match_any_ability')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMatchAll(true);
                      // Build form data with updated matchAll value
                      const formData = new FormData(document.getElementById('search-form') as HTMLFormElement);
                      formData.delete('matchAll');
                      formData.set('matchAll', '1');
                      // Submit the form
                      setTimeout(() => submit(formData, { method: "get" }), 0);
                    }}
                    className={`px-3 py-1 rounded text-sm ${matchAll ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}
                  >
                    {t('match_all_abilities')}
                  </button>
                </div>
              </div>
            )}
            
            {/* Current Ability Input */}
            <div className="border-t border-border pt-4 mt-4">
              <Label className="text-sm font-medium mb-2 block">{t('add_ability_search')}</Label>
              <p className="text-xs text-muted-foreground mb-3">{t('use_quotes_exact_match')}</p>
            
            {/* Trigger */}
            <div className="relative">
              <Label htmlFor="tr">{t('trigger')}</Label>
              <Input
                type="search"
                id="tr"
                value={triggerValue}
                onChange={(e) => { setTriggerValue(e.target.value); setShowTriggerOptions(true); }}
                onFocus={() => setShowTriggerOptions(true)}
                onBlur={() => setTimeout(() => setShowTriggerOptions(false), 200)}
                onKeyDown={(e) => { if (e.key === 'Enter') setShowTriggerOptions(false); }}
                placeholder={t('placeholder_trigger_text')}
                autoComplete="off"
              />
              {showTriggerOptions && (
                <ul role="listbox" className="absolute z-40 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-lg">
                  {filteredTriggers.length > 0 ? (
                    filteredTriggers.map((t) => (
                      <li 
                        key={t.id} 
                        role="option"
                        aria-selected={triggerValue === t.text}
                        className="cursor-pointer px-3 py-2 hover:bg-accent hover:text-accent-foreground text-sm" 
                        onMouseDown={(e) => { 
                          e.preventDefault(); 
                          setTriggerValue(`"${t.text}"`); 
                          setShowTriggerOptions(false); 
                        }}
                      >
                        {t.text}
                      </li>
                    ))
                  ) : (
                    <li className="px-3 py-2 text-sm text-muted-foreground italic">
                      {t('no_matching_triggers') || 'No matching triggers found'}
                    </li>
                  )}
                </ul>
              )}
            </div>

            {/* Condition */}
            <div className="relative">
              <Label htmlFor="cond">{t('condition')}</Label>
              <Input
                type="search"
                id="cond"
                value={conditionValue}
                onChange={(e) => { setConditionValue(e.target.value); setShowConditionOptions(true); }}
                onFocus={() => setShowConditionOptions(true)}
                onBlur={() => setTimeout(() => setShowConditionOptions(false), 200)}
                onKeyDown={(e) => { if (e.key === 'Enter') setShowConditionOptions(false); }}
                placeholder={t('placeholder_condition_text')}
                autoComplete="off"
              />
              {showConditionOptions && filteredConditions.length > 0 && (
                <ul role="listbox" className="absolute z-40 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-lg">
                  {filteredConditions.map((t) => (
                    <li 
                      key={t.id} 
                      role="option"
                      aria-selected={conditionValue === t.text}
                      className="cursor-pointer px-3 py-2 hover:bg-accent hover:text-accent-foreground text-sm" 
                      onMouseDown={(e) => { 
                        e.preventDefault(); 
                        setConditionValue(`"${t.text}"`); 
                        setShowConditionOptions(false); 
                      }}
                    >
                      {t.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Effect */}
            <div className="relative">
              <Label htmlFor="eff">{t('effect')}</Label>
              <Input
                type="search"
                id="eff"
                value={effectValue}
                onChange={(e) => { setEffectValue(e.target.value); setShowEffectOptions(true); }}
                onFocus={() => setShowEffectOptions(true)}
                onBlur={() => setTimeout(() => setShowEffectOptions(false), 200)}
                onKeyDown={(e) => { if (e.key === 'Enter') setShowEffectOptions(false); }}
                placeholder={t('placeholder_effect_text')}
                autoComplete="off"
              />
              {showEffectOptions && filteredEffects.length > 0 && (
                <ul role="listbox" className="absolute z-40 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-lg">
                  {filteredEffects.map((t) => (
                    <li 
                      key={t.id} 
                      role="option"
                      aria-selected={effectValue === t.text}
                      className="cursor-pointer px-3 py-2 hover:bg-accent hover:text-accent-foreground text-sm" 
                      onMouseDown={(e) => { 
                        e.preventDefault(); 
                        setEffectValue(`"${t.text}"`); 
                        setShowEffectOptions(false); 
                      }}
                    >
                      {t.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            {/* Add Ability Button */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={savedAbilities.length >= MAX_ABILITY_COMBINATIONS}
                onClick={() => {
                  if (triggerValue || conditionValue || effectValue) {
                    const newAbilities = [...savedAbilities, {
                      trigger: triggerValue,
                      condition: conditionValue,
                      effect: effectValue
                    }];
                    setSavedAbilities(newAbilities);
                    setTriggerValue("");
                    setConditionValue("");
                    setEffectValue("");
                    
                    // Build form data with updated abilities
                    const formData = new FormData(document.getElementById('search-form') as HTMLFormElement);
                    
                    // Remove all existing ability params
                    formData.delete('tr');
                    formData.delete('cond');
                    formData.delete('eff');
                    
                    // Add updated abilities with proper array alignment
                    // We need to ensure all arrays have the same length with empty strings as placeholders
                    newAbilities.forEach(ability => {
                      formData.append('tr', ability.trigger || "");
                      formData.append('cond', ability.condition || "");
                      formData.append('eff', ability.effect || "");
                    });
                    
                    // Preserve matchAll if we have multiple abilities
                    if (newAbilities.length > 1) {
                      formData.set('matchAll', matchAll ? "1" : "0");
                    }
                    
                    // Submit the form
                    submit(formData, { method: "get" });
                  }
                }}
                className="flex-1"
                title={savedAbilities.length >= MAX_ABILITY_COMBINATIONS ? t('max_abilities_reached') : undefined}
              >
                {t('add_ability_button')}
              </Button>
            </div>
            </div>
            
            {/* Hidden inputs for form submission - only if not adding/editing abilities */}
            {savedAbilities.map((ability, index) => (
              <div key={index}>
                <input type="hidden" name="tr" value={ability.trigger || ""} />
                <input type="hidden" name="cond" value={ability.condition || ""} />
                <input type="hidden" name="eff" value={ability.effect || ""} />
              </div>
            ))}
            {savedAbilities.length > 1 && <input type="hidden" name="matchAll" value={matchAll ? "1" : "0"} />}
          </div>
        )}

        {/* PRICES Section - Collapsible */}
        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setIsPricesOpen(!isPricesOpen)}
            className="w-full flex items-center justify-between py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            <span>{t('section_prices')}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${isPricesOpen ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
        {isPricesOpen && (
          <div className="flex flex-row gap-2">
            <div className="flex-1">
              <Label htmlFor="minpr">{t('min_price')}</Label>
              <Input
                type="search"
                name="minpr"
                defaultValue={minPrice ?? ""}
                placeholder={t('placeholder_ellipsis')}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="maxpr">{t('max_price')}</Label>
              <Input
                type="search"
                name="maxpr"
                defaultValue={maxPrice ?? ""}
                placeholder={t('placeholder_ellipsis')}
              />
            </div>
          </div>
        )}

        {/* Advanced Filters Collapsible */}
        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setIsAdvSearchOpen(!isAdvSearchOpen)}
            className="w-full flex items-center justify-between py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            <span>{t('section_advanced_filters')}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${isAdvSearchOpen ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
        {isAdvSearchOpen && (
          <div className="space-y-4">
            <div className="flex flex-row gap-2 items-center">
              <Checkbox
                id="arrow"
                value="1"
                name="arrow"
                defaultChecked={partFilterArrow ?? false}
                onCheckedChange={handleArrow}
              />
              <Label htmlFor="arrow" className="text-xs/3 inline-block">{t('filter_arrow_effect')}</Label>
            </div>
            <div className="flex flex-row gap-2 items-center">
              <Checkbox
                id="hand"
                value="1"
                name="hand"
                defaultChecked={partFilterHand ?? false}
                onCheckedChange={handleHand}
              />
              <Label htmlFor="hand" className="text-xs/3 inline-block">{t('filter_hand_effect')}</Label>
            </div>
            <div className="flex flex-row gap-2 items-center">
              <Checkbox
                id="reserve"
                value="1"
                name="reserve"
                defaultChecked={partFilterReserve ?? false}
                onCheckedChange={handleReserve}
              />
              <Label htmlFor="reserve" className="text-xs/3 inline-block">{t('filter_reserve_effect')}</Label>
            </div>
            <div className="flex flex-row gap-2 items-center">
              <Checkbox
                id="inclSup"
                value="1"
                name="inclSup"
                defaultChecked={partIncludeSupport ?? false}
                onCheckedChange={handleIncludeSupport}
              />
              <Label htmlFor="inclSup" className="text-xs/3 inline-block">{t('also_match_support')}</Label>
            </div>
            <div className="flex flex-row gap-2 items-center">
              <Checkbox
                id="zeroStat"
                value="1"
                name="zeroStat"
                defaultChecked={filterZeroStat ?? false}
                onCheckedChange={handleSearchZero}
              />
              <Label htmlFor="zeroStat" className="text-xs/3 inline-block">{t('filter_zero_stat')}</Label>
            </div>
            <div className="flex flex-row gap-2 items-center">
              <Checkbox
                id="textless"
                value="1"
                name="textless"
                defaultChecked={filterTextless ?? false}
                onCheckedChange={handleTextless}
              />
              <Label htmlFor="textless" className="text-xs/3 inline-block">{t('filter_textless')}</Label>
            </div>
          </div>
        )}

        {/* Include Expired Cards */}
        <div className="border-t border-border pt-4">
          <div className="flex flex-row gap-2 items-center">
            <Checkbox
              id="exp"
              value="1"
              name="exp"
              defaultChecked={includeExpiredCards ?? false}
              onCheckedChange={handleExpiredCardsChange}
            />
            <Label htmlFor="exp">{t('include_unavailable')}</Label>
          </div>
        </div>

        {/* Search and Reset Buttons */}
        <div className="flex gap-2">
          <Button
            type="submit"
            className="flex-1 bg-accent/80 text-foreground hover:bg-accent"
            onClick={() => onSearch?.()}
          >
            {t('search')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              // Clear the selected search from localStorage
              if (typeof window !== 'undefined') {
                localStorage.removeItem('lastSelectedSearch');
              }
              const currentLang = searchParams.get("lang") ?? locale ?? "en";
              window.location.href = `/search?lang=${currentLang}`;
            }}
            className="flex-1"
          >
            {t('reset')}
          </Button>
        </div>

        <input type="hidden" name="lang" value={locale ?? searchParams.get("lang") ?? "en"} />
      </div>

      {/* Save Search Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={(open) => {
        setShowSaveDialog(open);
        if (!open) {
          setSearchName("");
          setShowOverwriteWarning(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('save_search_title')}</DialogTitle>
            <DialogDescription>
              {t('save_search_description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="search-name">{t('search_name_label')}</Label>
              <Input
                id="search-name"
                value={searchName}
                onChange={(e) => {
                  setSearchName(e.target.value);
                  setShowOverwriteWarning(false);
                }}
                placeholder={t('search_name_placeholder')}
              />
            </div>
            {showOverwriteWarning && (
              <p className="text-sm text-yellow-600 dark:text-yellow-500">
                ⚠️ {t('overwrite_warning')}
              </p>
            )}
            {saveFetcher.data?.error && (
              <p className="text-sm text-red-500">{saveFetcher.data.error}</p>
            )}
            {saveFetcher.data?.success && (
              <p className="text-sm text-green-500">{saveFetcher.data.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSaveDialog(false);
                setSearchName("");
                setShowOverwriteWarning(false);
              }}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleSaveSearch}
              disabled={!searchName.trim() || saveFetcher.state === "submitting"}
            >
              {saveFetcher.state === "submitting" ? t('saving') : showOverwriteWarning ? t('overwrite') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  )
}
