import { type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData, useSearchParams } from "@remix-run/react";
import { search } from "~/loaders/search.js";
import { FC, useState } from "react";
import { FactionSelect } from "~/components/altered/FactionSelect";
import { SetSelect } from "~/components/altered/SetSelect";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { nullifyParseInt, nullifyTrim, parseRange } from "~/lib/utils";
import { ResultGrid } from "~/components/altered/ResultGrid";
import { ResultsPagination } from "~/components/common/pagination";
import { DisplayUniqueCard } from "~/models/cards";
import { Checkbox } from "~/components/ui/checkbox";


interface SearchQuery {
  faction?: string;
  set?: string;
  characterName?: string;
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
  query: SearchQuery;
  error: string | undefined;
}


export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const cardText = nullifyTrim(url.searchParams.get("text"));
  const characterName = nullifyTrim(url.searchParams.get("cname"));
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

  const currentPage = nullifyParseInt(url.searchParams.get("p")) ?? 1;

  const mainCosts = parseRange(mainCostRange)
  const recallCosts = parseRange(recallCostRange)

  try {
    const startTs = performance.now()

    const { results, pagination } = await search(
      {
        faction,
        set,
        characterName,
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
      },
      {
        page: currentPage,
        includePagination: true
      }
    );

    const endTs = performance.now()
    const duration = endTs - startTs
    
    return {
      results,
      pagination: { ...pagination, currentPage },
      metrics: {
        duration,
      },
      query: {
        faction,
        set,
        characterName,
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
      },
    };
  } catch (e) {
    console.error("Search error: ", e);
    return {
      error: e.message,
      results: [],
      pagination: undefined,
      metrics: undefined,
      query: {
        faction,
        set,
        characterName,
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
      },
    }
  }
}

export default function SearchPage() {
  const loaderData = useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();

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
      <SearchForm {...loaderData.query} />

      {/* Results Section */}
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
      ) : (loaderData.error ? (
        <p className="text-red-500">Error: {loaderData.error}</p>
      ) : loaderData.query ? (
        <p className="text-gray-600">No results found.</p>
      ) : null)}
    </div>
  );
}


const SearchForm: FC<SearchQuery> = ({
  faction,
  set,
  characterName,
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
}: SearchQuery) => {
  const [selectedFaction, setSelectedFaction] = useState(faction ?? undefined);
  const [selectedSet, setSelectedSet] = useState(set ?? undefined);

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
  
  return (
    <Form method="get" id="search-form"className="mb-8">
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
              value={selectedSet ?? "any"}
              onValueChange={(newVal) => setSelectedSet(newVal == "any" ? undefined : newVal)} />
            <input type="hidden" name="s" value={selectedSet} />
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
          <div className="grow-1 flex-[30%]">
            <Label htmlFor="tr">Trigger</Label>
            <Input
              type="search"
              name="tr"
              defaultValue={triggerPart ?? ""}
              placeholder="Trigger text..."
            />
          </div>
          <div className="grow-1 flex-[30%]">
            <Label htmlFor="cond">Condition</Label>
            <Input
              type="search"
              name="cond"
              defaultValue={conditionPart ?? ""}
              placeholder="Condition text..."
            />
          </div>
          <div className="grow-1 flex-[30%]">
            <Label htmlFor="eff">Effect</Label>
            <Input
              type="search"
              name="eff"
              defaultValue={effectPart ?? ""}
              placeholder="Effect text..."
            />
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
