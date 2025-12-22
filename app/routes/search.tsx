import { type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData, useSearchParams } from "@remix-run/react";
import { FC, useState, useEffect } from "react";
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

interface SearchQuery {
  faction?: string;
  set?: string;
  characterName?: string;
  cardSubTypes?: string[];
  cardText?: string;
  triggerPart?: string;
  conditionPart?: string;
  effectPart?: string;
  partIncludeSupport?: boolean;
  mainCostRange?: string;
  recallCostRange?: string;
  includeExpiredCards?: boolean;
  minPrice?: number;
  maxPrice?: number;
  forestPowerRange?: string;
  mountainPowerRange?: string;
  oceanPowerRange?: string;
}

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
}


export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const lang = nullifyTrim(url.searchParams.get("lang")) ?? "en";
  const cardText = nullifyTrim(url.searchParams.get("text"));
  const characterName = nullifyTrim(url.searchParams.get("cname"));
  const cardSubTypes = nullifyTrim(url.searchParams.get("types"))?.split(",") ?? [];
  const faction = nullifyTrim(url.searchParams.get("f"));
  const set = nullifyTrim(url.searchParams.get("s"));
  const triggerPart = nullifyTrim(url.searchParams.get("tr"));
  const conditionPart = nullifyTrim(url.searchParams.get("cond"));
  const effectPart = nullifyTrim(url.searchParams.get("eff"));
  const partIncludeSupport = nullifyTrim(url.searchParams.get("inclSup")) == "1";
  const mainCostRange = nullifyTrim(url.searchParams.get("mc"));
  const recallCostRange = nullifyTrim(url.searchParams.get("rc"));
  const includeExpiredCards = nullifyTrim(url.searchParams.get("exp")) == "1";
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
    triggerPart,
    conditionPart,
    effectPart,
    partIncludeSupport,
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

  try {
    const startTs = performance.now()

    const { results, pagination } = await searchWithCTEsIndexingCharacterNames(
      {
        faction,
        set,
        characterName,
        cardSubTypes: validSubtypes,
        cardText,
        triggerPart,
        conditionPart,
        effectPart,
        partIncludeSupport,
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
    }
  }
}

export default function SearchPage() {
  const loaderData = useLoaderData<LoaderData>();
  const { t } = useTranslation(loaderData.locale);
  const [searchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'row'>('grid');
  const [gridColumns, setGridColumns] = useState<2 | 3 | 4>(3);
  const [hasLastSearch, setHasLastSearch] = useState(false);

  const now = new Date();

  const results = loaderData.results
  const pagination = loaderData.pagination

  const currentPage = parseInt(searchParams.get("p") ?? "1");

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
    if (query.triggerPart) filters.push(t('trigger') + `: "${query.triggerPart}"`);
    if (query.conditionPart) filters.push(t('condition') + `: "${query.conditionPart}"`);
    if (query.effectPart) filters.push(t('effect') + `: "${query.effectPart}"`);
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

  return (
    <div className="flex flex-row h-[calc(100vh-3rem)] overflow-hidden">
      {/* Left Content - Results */}
      <div className="flex-1 flex flex-col p-6">
        {results.length > 0 ? (
          <div id="results" className="relative flex flex-col h-full">
            {pagination ? (
              <div className="mb-6">
                <div className="flex flex-row items-center mb-4">
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
                  <div className="flex-1 flex justify-center">
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
                    {viewMode === 'grid' && (
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
              <ResultGrid results={results} now={now} viewMode={viewMode} gridColumns={gridColumns} />
            </div>
          </div>
        ) : (loaderData.error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-red-500">{t('error_prefix')} {loaderData.error}</p>
          </div>
        ) : loaderData.query ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-gray-600">{t('no_results')}</p>
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
          </div>
        ))}
      </div>

      {/* Right Sidebar - Search Form */}
      {showFilters && (
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
          />
        </div>
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
  }
> = ({
  faction,
  set,
  characterName,
  cardSubTypes,
  cardText,
  triggerPart,
  conditionPart,
  effectPart,
  partIncludeSupport,
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
}: SearchQuery & { triggers?: { id: number; text: string }[]; conditions?: { id: number; text: string }[]; effects?: { id: number; text: string }[]; locale?: string }) => {
  const { t } = useTranslation(locale);
  const [selectedFaction, setSelectedFaction] = useState(faction ?? undefined);
  const [selectedSet, setSelectedSet] = useState(set ?? undefined);
  const [selectedCardSubTypes, setSelectedCardSubTypes] = useState<string[]>(cardSubTypes ?? []);
  const [triggerValue, setTriggerValue] = useState<string>(triggerPart ?? "");
  const [showTriggerOptions, setShowTriggerOptions] = useState<boolean>(false);
  const [conditionValue, setConditionValue] = useState<string>(conditionPart ?? "");
  const [showConditionOptions, setShowConditionOptions] = useState<boolean>(false);
  const [effectValue, setEffectValue] = useState<string>(effectPart ?? "");  const [showEffectOptions, setShowEffectOptions] = useState<boolean>(false);

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


  const [searchParams] = useSearchParams();
  const handleExpiredCardsChange = (newValue: boolean) => {
    const newParams = new URLSearchParams(searchParams);
    if (newValue) {
      newParams.set("exp", "1");
    } else {
      newParams.delete("exp");
    }
    window.location.search = newParams.toString();
  }

  const handleIncludeSupport = (newValue: boolean) => {
    const newParams = new URLSearchParams(searchParams);
    if (newValue) {
      newParams.set("inclSup", "1");
    } else {
      newParams.delete("inclSup");
    }
    window.location.search = newParams.toString();
  }

  const handleCardSubTypesChange = (newValues: string[]) => {
    setSelectedCardSubTypes(newValues);
    const newParams = new URLSearchParams(searchParams);
    newParams.set("types", newValues.join(","));
    window.location.search = newParams.toString();
  }

  return (
    <Form method="get" id="search-form" className="space-y-4">
      {/* Preserve the lang parameter across form submissions */}
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
            value={selectedSet ?? "any"}
            onValueChange={(newVal) => setSelectedSet(newVal == "any" ? undefined : newVal)} />
          <input type="hidden" name="s" value={selectedSet} />
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

        {/* Powers Section */}
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

        {/* Trigger */}
        <div className="relative">
          <Label htmlFor="tr">{t('trigger')}</Label>
          <Input
            type="search"
            name="tr"
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
                      setTriggerValue(t.text); 
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
            name="cond"
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
                    setConditionValue(t.text); 
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
            name="eff"
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
                    setEffectValue(t.text); 
                    setShowEffectOptions(false); 
                  }}
                >
                  {t.text}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Include Support Checkbox */}
        <div className="flex flex-row gap-2 items-center">
          <Checkbox
            value="1"
            name="inclSup"
            defaultChecked={partIncludeSupport ?? false}
            onCheckedChange={handleIncludeSupport}
          />
          <Label htmlFor="inclSup" className="text-sm">{t('also_match_support')}</Label>
        </div>

        {/* Include Expired Cards */}
        <div className="flex flex-row gap-2 items-center">
          <Checkbox
            value="1"
            name="exp"
            defaultChecked={includeExpiredCards ?? false}
            onCheckedChange={handleExpiredCardsChange}
          />
          <Label htmlFor="exp">{t('include_unavailable')}</Label>
        </div>

        {/* Price Range */}
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

        {/* Search Button */}
        <Button
          type="submit"
          className="w-full bg-accent/80 text-foreground hover:bg-accent"
        >
          {t('search')}
        </Button>

        <input type="hidden" name="lang" value={locale ?? searchParams.get("lang") ?? "en"} />
      </div>
    </Form>
  )
}
