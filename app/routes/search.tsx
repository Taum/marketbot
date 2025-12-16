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

interface SearchQuery {
  faction?: string;
  set?: string | string[];
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
  query: SearchQuery;
  error: string | undefined;
}


export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const cardText = nullifyTrim(url.searchParams.get("text"));
  const characterName = nullifyTrim(url.searchParams.get("cname"));
  const cardSubTypes = nullifyTrim(url.searchParams.get("types"))?.split(",") ?? [];
  const faction = nullifyTrim(url.searchParams.get("f"));
  const setParam = nullifyTrim(url.searchParams.get("s"));
  const parsedSets = setParam?.split(",").map(s => s.trim()).filter(Boolean) ?? []
  const set = parsedSets.length === 0 ? undefined : (parsedSets.length === 1 ? parsedSets[0] : parsedSets)
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
        includePagination: true
      }
    );

    const endTs = performance.now()
    const duration = endTs - startTs

    // fetch ability parts (Trigger/Condition/Effect) in a single query and group them
    const allParts = await prisma.uniqueAbilityPart.findMany({
      where: { partType: { in: ["Trigger", "Condition", "Effect"] } },
      orderBy: { textEn: "asc" },
      select: { id: true, textEn: true, partType: true }
    });

    const triggers = allParts.filter(p => p.partType === "Trigger").map(p => ({ id: p.id, text: p.textEn }));
    const conditions = allParts.filter(p => p.partType === "Condition").map(p => ({ id: p.id, text: p.textEn }));
    const effects = allParts.filter(p => p.partType === "Effect").map(p => ({ id: p.id, text: p.textEn }));

    return {
      results,
      pagination: { ...pagination, currentPage },
      metrics: {
        duration,
      },
      triggers,
      conditions,
      effects,
      query: originalQuery,
    };
  } catch (e) {
    console.error("Search error: ", e);
    return {
      error: e.message,
      results: [],
      pagination: undefined,
      metrics: undefined,
      query: originalQuery,
    }
  }
}

export default function SearchPage() {
  const loaderData = useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Clear submitting flag when loader data updates
    setIsSubmitting(false);
  }, [loaderData]);

  const now = new Date();

  const results = loaderData.results
  const pagination = loaderData.pagination

  const currentPage = parseInt(searchParams.get("p") ?? "1");

  const handlePageChange = (page: number) => {
    searchParams.set("p", page.toString());
    window.location.search = searchParams.toString();
  };

  return (
    <div className="global-page">
      {/* Search Form */}
      <SearchForm
        {...loaderData.query}
        setSubmitting={setIsSubmitting}
        triggers={loaderData.triggers ?? []}
        conditions={loaderData.conditions ?? []}
        effects={loaderData.effects ?? []}
      />

      {/* Results Section */}
      {results.length > 0 ? (
        <div id="results" className="relative">
          {isSubmitting && (
            <div className="absolute inset-0 bg-white/60 z-50 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <img src="/assets/loading.svg" alt="Loading" className="h-12 w-12" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                <span className="text-sm text-gray-700">Searching...</span>
              </div>
            </div>
          )}
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
        </div>
      ) : (loaderData.error ? (
        <p className="text-red-500">Error: {loaderData.error}</p>
      ) : loaderData.query ? (
        <p className="text-gray-600">No results found.</p>
      ) : null)}
    </div>
  );
}

const SearchForm: FC<
  SearchQuery & {
    setSubmitting?: (v: boolean) => void;
    triggers?: { id: number; text: string }[];
    conditions?: { id: number; text: string }[];
    effects?: { id: number; text: string }[];
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
  , setSubmitting, triggers = [], conditions = [], effects = []
}: SearchQuery & { setSubmitting?: (v: boolean) => void; triggers?: { id: number; text: string }[]; conditions?: { id: number; text: string }[]; effects?: { id: number; text: string }[] }) => {
  const [selectedFaction, setSelectedFaction] = useState(faction ?? undefined);
  const [selectedSet, setSelectedSet] = useState<string | string[] | undefined>(set ?? undefined);
  const [selectedCardSubTypes, setSelectedCardSubTypes] = useState<string[]>(cardSubTypes ?? []);
  const [triggerValue, setTriggerValue] = useState<string>(triggerPart ?? "");
  const [showTriggerOptions, setShowTriggerOptions] = useState<boolean>(false);
  const [conditionValue, setConditionValue] = useState<string>(conditionPart ?? "");
  const [showConditionOptions, setShowConditionOptions] = useState<boolean>(false);
  const [effectValue, setEffectValue] = useState<string>(effectPart ?? "");
  const [showEffectOptions, setShowEffectOptions] = useState<boolean>(false);

  const filteredTriggers = triggers.filter(t => {
    const q = triggerValue?.toLowerCase().trim();
    if (!q) return true;
    return t.text.toLowerCase().includes(q);
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
    if (newValue) {
      searchParams.set("exp", "1");
    } else {
      searchParams.delete("exp");
    }
    window.location.search = searchParams.toString();
  }

  const handleIncludeSupport = (newValue: boolean) => {
    if (newValue) {
      searchParams.set("inclSup", "1");
    } else {
      searchParams.delete("inclSup");
    }
    window.location.search = searchParams.toString();
  }

  const handleCardSubTypesChange = (newValues: string[]) => {
    setSelectedCardSubTypes(newValues);
    searchParams.set("types", newValues.join(","));
  }

  return (
    <Form method="get" id="search-form" className="mb-8" onSubmit={() => setSubmitting?.(true)}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-row gap-8">
          <div>
            <Label>Faction</Label>
            <FactionSelect
              value={selectedFaction ?? "any"}
              onValueChange={(newVal) => setSelectedFaction(newVal == "any" ? undefined : newVal)} />
            <input type="hidden" name="f" value={selectedFaction} />
          </div>
          <div>
            <Label htmlFor="cname">Set</Label>
            <SetSelect
              multiple={true}
              value={selectedSet ?? "any"}
              onValueChange={(newVal) => {
                if (Array.isArray(newVal)) {
                  setSelectedSet(newVal.length === 0 ? undefined : newVal)
                } else {
                  setSelectedSet(newVal == "any" ? undefined : newVal as string)
                }
              }} />
            <input type="hidden" name="s" value={Array.isArray(selectedSet) ? selectedSet.join(",") : (selectedSet ?? "")} />
          </div>
          <div>
            <Label htmlFor="cname">Character name</Label>
            <Input
              type="text"
              name="cname"
              defaultValue={characterName ?? ""}
              placeholder="Character name"
            />
          </div>
          <div>
            <Label htmlFor="mc">Hand cost</Label>
            <Input
              type="text"
              name="mc"
              defaultValue={mainCostRange ?? ""}
              placeholder="1-3"
            />
          </div>
          <div>
            <Label htmlFor="rc">Reserve cost</Label>
            <Input
              type="text"
              name="rc"
              defaultValue={recallCostRange ?? ""}
              placeholder="4,6"
            />
          </div>
        </div>
        <div className="flex flex-row gap-8">
          <div>
            <Label htmlFor="cname">Character type</Label>
            <MultiSelect
              options={allCardSubTypes}
              onValueChange={handleCardSubTypesChange}
              defaultValue={selectedCardSubTypes}
              placeholder="Select character types"
              variant="secondary"
              animation={0.5}
              maxCount={3}
            />
            <input type="hidden" name="types" value={selectedCardSubTypes.join(",")} />
          </div>
          <div>
            <Label htmlFor="fp">Forest power</Label>
            <Input
              type="text"
              name="fp"
              defaultValue={forestPowerRange ?? ""}
              placeholder="1-4"
            />
          </div>
          <div>
            <Label htmlFor="mp">Mountain power</Label>
            <Input
              type="text"
              name="mp"
              defaultValue={mountainPowerRange ?? ""}
              placeholder="1-4"
            />
          </div>
          <div>
            <Label htmlFor="op">Forest power</Label>
            <Input
              type="text"
              name="op"
              defaultValue={oceanPowerRange ?? ""}
              placeholder="1-4"
            />
          </div>
        </div>
        <div className="flex flex-row gap-4">
          <div className="grow-1 flex-[60%]">
            <Label htmlFor="text">Card text</Label>
            <Input
              type="search"
              name="text"
              defaultValue={cardText ?? ""}
              placeholder="Card text..."
            />
          </div>
        </div>
        <div className="flex flex-row gap-4">
          <div className="grow-1 flex-[30%] relative">
            <Label htmlFor="tr">Trigger</Label>
            {/* Controlled input to allow "contains" filtering */}
            <Input
              type="search"
              name="tr"
              id="tr"
              value={triggerValue}
              onChange={(e) => { setTriggerValue(e.target.value); setShowTriggerOptions(true); }}
              onFocus={() => setShowTriggerOptions(true)}
              onBlur={() => setTimeout(() => setShowTriggerOptions(false), 150)}
              placeholder="Trigger text..."
              autoComplete="off"
            />
            {showTriggerOptions && filteredTriggers.length > 0 && (
              <ul role="listbox" className="absolute z-40 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-white shadow-lg">
                {filteredTriggers.map((t) => (
                  <li key={t.id} role="option" className="cursor-pointer px-3 py-2 hover:bg-gray-100" onMouseDown={(e) => { e.preventDefault(); setTriggerValue(t.text); setShowTriggerOptions(false); }}>
                    {t.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grow-1 flex-[30%] relative">
            <Label htmlFor="cond">Condition</Label>
            <Input
              type="search"
              name="cond"
              id="cond"
              value={conditionValue}
              onChange={(e) => { setConditionValue(e.target.value); setShowConditionOptions(true); }}
              onFocus={() => setShowConditionOptions(true)}
              onBlur={() => setTimeout(() => setShowConditionOptions(false), 150)}
              placeholder="Condition text..."
              autoComplete="off"
            />
            {showConditionOptions && filteredConditions.length > 0 && (
              <ul role="listbox" className="absolute z-40 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-white shadow-lg">
                {filteredConditions.map((t) => (
                  <li key={t.id} role="option" className="cursor-pointer px-3 py-2 hover:bg-gray-100" onMouseDown={(e) => { e.preventDefault(); setConditionValue(t.text); setShowConditionOptions(false); }}>
                    {t.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grow-1 flex-[30%] relative">
            <Label htmlFor="eff">Effect</Label>
            <Input
              type="search"
              name="eff"
              id="eff"
              value={effectValue}
              onChange={(e) => { setEffectValue(e.target.value); setShowEffectOptions(true); }}
              onFocus={() => setShowEffectOptions(true)}
              onBlur={() => setTimeout(() => setShowEffectOptions(false), 150)}
              placeholder="Effect text..."
              autoComplete="off"
            />
            {showEffectOptions && filteredEffects.length > 0 && (
              <ul role="listbox" className="absolute z-40 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-white shadow-lg">
                {filteredEffects.map((t) => (
                  <li key={t.id} role="option" className="cursor-pointer px-3 py-2 hover:bg-gray-100" onMouseDown={(e) => { e.preventDefault(); setEffectValue(t.text); setShowEffectOptions(false); }}>
                    {t.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grow-1 flex-[10%] pt-4 flex flex-row gap-2 items-center">
            <Checkbox
              value="1"
              name="inclSup"
              defaultChecked={partIncludeSupport ?? false}
              onCheckedChange={handleIncludeSupport}
            />
            <Label htmlFor="inclSup" className="text-xs/3 inline-block">Also match support abilities</Label>
          </div>
        </div>
        <div className="flex flex-row gap-8 align-self-start justify-between items-end">
          <Button
            type="submit"
            className="bg-accent/80 text-foreground hover:bg-accent"
          >
            Search
          </Button>
          <div className="flex flex-row gap-2">
            <div className="flex flex-row gap-2 items-center mt-6 mr-2">
              <Checkbox
                value="1"
                name="exp"
                defaultChecked={includeExpiredCards ?? false}
                onCheckedChange={handleExpiredCardsChange}
              />
              <Label htmlFor="exp">Include unavailable cards</Label>
            </div>
            <div className="">
              <Label htmlFor="minpr">Min price</Label>
              <Input
                type="search"
                name="minpr"
                className="w-20"
                defaultValue={minPrice ?? ""}
                placeholder="..."
              />
            </div>
            <div className="">
              <Label htmlFor="maxpr">Max price</Label>
              <Input
                type="search"
                name="maxpr"
                className="w-20"
                defaultValue={maxPrice ?? ""}
                placeholder="..."
              />
            </div>
          </div>
        </div>
      </div>
    </Form>
  )
}
