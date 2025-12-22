import { type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData, useSearchParams } from "@remix-run/react";
import { FC, useState } from "react";
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
import { getTranslator, detectLocaleFromAcceptLanguage } from "~/lib/i18n.server";
import { useTranslation } from "~/lib/i18n";

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

  const now = new Date();

  const results = loaderData.results
  const pagination = loaderData.pagination

  const currentPage = parseInt(searchParams.get("p") ?? "1");

  const handlePageChange = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("p", page.toString());
    window.location.search = newParams.toString();
  };

  return (
    <div className="global-page">
      {/* Search Form */}
      <SearchForm 
        {...loaderData.query} 
        triggers={loaderData.triggers}
        conditions={loaderData.conditions}
        effects={loaderData.effects}
        locale={loaderData.locale}
      />

      {/* Results Section */}
      {results.length > 0 ? (
        <div id="results" className="relative">
          <div className="space-y-6">
            {pagination ? (
              <div className="flex flex-row justify-between gap-8">
                <div>
                  <h2 className="grow-1 text-xl font-semibold inline-block">
                    {loaderData.localizedFoundText ?? `${t('found_count', { count: pagination.totalCount })}`}
                  </h2>
                  {loaderData.metrics?.duration && (
                      <span className="ml-2 text-xs text-muted-foreground/50">
                        {t('in_seconds', { seconds: (loaderData.metrics.duration / 1000).toFixed(1) })}
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
              <p className="text-red-500">{t('error_prefix')} {loaderData.error}</p>
      ) : loaderData.query ? (
              <p className="text-gray-600">{t('no_results')}</p>
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
  , setSubmitting, triggers = [], conditions = [], effects = []
  , locale
}: SearchQuery & { setSubmitting?: (v: boolean) => void; triggers?: { id: number; text: string }[]; conditions?: { id: number; text: string }[]; effects?: { id: number; text: string }[]; locale?: string }) => {
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
    <Form method="get" id="search-form" className="mb-8">
      {/* Preserve the lang parameter across form submissions */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-row gap-8">
            <div>
            <Label>{t('faction')}</Label>
            <FactionSelect
              value={selectedFaction ?? "any"}
              onValueChange={(newVal) => setSelectedFaction(newVal == "any" ? undefined : newVal)} />
            <input type="hidden" name="f" value={selectedFaction} />
          </div>
          <div>
            <Label htmlFor="cname">{t('set')}</Label>
            <SetSelect
              value={selectedSet ?? "any"}
              onValueChange={(newVal) => setSelectedSet(newVal == "any" ? undefined : newVal)} />
            <input type="hidden" name="s" value={selectedSet} />
          </div>
          <div>
            <Label htmlFor="cname">{t('character_name')}</Label>
            <Input
              type="text"
              name="cname"
              defaultValue={characterName ?? ""}
              placeholder={t('placeholder_character_name')}
            />
          </div>
          <div>
            <Label htmlFor="mc">{t('hand_cost')}</Label>
            <Input
              type="text"
              name="mc"
              defaultValue={mainCostRange ?? ""}
              placeholder={t('placeholder_hand_cost')}
            />
          </div>
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
        <div className="flex flex-row gap-8">
          <div>
            <Label htmlFor="cname">{t('character_type')}</Label>
            <MultiSelect
              options={allCardSubTypes}
              onValueChange={handleCardSubTypesChange}
              defaultValue={selectedCardSubTypes}
              placeholder={t('placeholder_select_character_types')}
              variant="secondary"
              animation={0.5}
              maxCount={3}
            />
            <input type="hidden" name="types" value={selectedCardSubTypes.join(",")} />
          </div>
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
        <div className="flex flex-row gap-4">
          <div className="grow-1 flex-[60%]">
            <Label htmlFor="text">Card text</Label>
            <Input
              type="search"
              name="text"
              defaultValue={cardText ?? ""}
              placeholder={t('placeholder_card_text')}
            />
          </div>
        </div>
        <div className="flex flex-row gap-4">
            <div className="grow-1 flex-[30%] relative">
            <Label htmlFor="tr">{t('trigger')}</Label>
            {/* Controlled input to allow "contains" filtering */}
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
              <ul role="listbox" className="absolute z-40 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-white shadow-lg">
                {filteredTriggers.length > 0 ? (
                  filteredTriggers.map((t) => (
                    <li 
                      key={t.id} 
                      role="option" 
                      className="cursor-pointer px-3 py-2 hover:bg-gray-100 text-sm" 
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
                  <li className="px-3 py-2 text-sm text-gray-500 italic">
                    {t('no_matching_triggers') || 'No matching triggers found'}
                  </li>
                )}
              </ul>
            )}
          </div>
            <div className="grow-1 flex-[30%] relative">
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
            <Label htmlFor="inclSup" className="text-xs/3 inline-block">{t('also_match_support')}</Label>
          </div>
        </div>
        <div className="flex flex-row gap-8 align-self-start justify-between items-end">
          <Button
            type="submit"
            className="bg-accent/80 text-foreground hover:bg-accent"
          >
            {t('search')}
          </Button>
          <div className="flex flex-row gap-2">
            <div className="flex flex-row gap-2 items-center mt-6 mr-2">
              <Checkbox
                value="1"
                name="exp"
                defaultChecked={includeExpiredCards ?? false}
                onCheckedChange={handleExpiredCardsChange}
              />
              <Label htmlFor="exp">{t('include_unavailable')}</Label>
            </div>
            <div className="">
              <Label htmlFor="minpr">{t('min_price')}</Label>
              <Input
                type="search"
                name="minpr"
                className="w-20"
                defaultValue={minPrice ?? ""}
                  placeholder={t('placeholder_ellipsis')}
              />
            </div>
            <div className="">
              <Label htmlFor="maxpr">{t('max_price')}</Label>
              <Input
                type="search"
                name="maxpr"
                className="w-20"
                defaultValue={maxPrice ?? ""}
                  placeholder={t('placeholder_ellipsis')}
              />
            </div>
          </div>
        </div>
        <input type="hidden" name="lang" value={locale ?? searchParams.get("lang") ?? "en"} />
      </div>
    </Form>
  )
}
