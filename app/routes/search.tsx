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


interface SearchQuery {
  faction?: string;
  set?: string;
  characterName?: string;
  mainEffect?: string;
  triggerPart?: string;
  conditionPart?: string;
  effectPart?: string;
  mainCostRange?: string;
  recallCostRange?: string;
}

interface LoaderData {
  results: DisplayUniqueCard[];
  pagination: {
    currentPage: number;
    totalCount: number;
    pageCount: number;
  } | undefined;
  query: SearchQuery;
  error: string | undefined;
}


export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const mainEffect = nullifyTrim(url.searchParams.get("m"));
  const characterName = nullifyTrim(url.searchParams.get("cname"));
  const faction = nullifyTrim(url.searchParams.get("f"));
  const set = nullifyTrim(url.searchParams.get("s"));
  const triggerPart = nullifyTrim(url.searchParams.get("tr"));
  const conditionPart = nullifyTrim(url.searchParams.get("cond"));
  const effectPart = nullifyTrim(url.searchParams.get("eff"));
  const mainCostRange = nullifyTrim(url.searchParams.get("mc"));
  const recallCostRange = nullifyTrim(url.searchParams.get("rc"));

  const currentPage = nullifyParseInt(url.searchParams.get("p")) ?? 1;

  const mainCosts = parseRange(mainCostRange)
  const recallCosts = parseRange(recallCostRange)

  try {
    const { results, pagination } = await search(
      {
        faction,
        set,
        characterName,
        mainEffect,
        triggerPart,
        conditionPart,
        effectPart,
        mainCosts,
        recallCosts
      },
      {
        page: currentPage,
        includePagination: true
      }
    );
    
    return {
      results,
      pagination: { ...pagination, currentPage },
      query: {
        faction,
        set,
        characterName,
        mainEffect,
        triggerPart,
        conditionPart,
        effectPart,
        mainCostRange,
        recallCostRange
      },
    };
  } catch (e) {
    console.error("Search error: ", e);
    return {
      error: e.message,
      results: [],
      pagination: undefined,
      query: {
        faction,
        set,
        characterName,
        mainEffect,
        triggerPart,
        conditionPart,
        effectPart,
        mainCostRange,
        recallCostRange
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
              <h2 className="grow-1 text-xl font-semibold">
                Showing {pagination.totalCount} matching
            </h2>
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
  mainEffect,
  triggerPart,
  conditionPart,
  effectPart,
  mainCostRange,
  recallCostRange,
}: SearchQuery) => {
  const [selectedFaction, setSelectedFaction] = useState(faction ?? undefined);
  const [selectedSet, setSelectedSet] = useState(set ?? undefined);
  
  return (
    <Form method="get" className="mb-8">
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
            <Label htmlFor="m">Main effect</Label>
            <Input
              type="search"
              name="m"
              defaultValue={mainEffect ?? ""}
              placeholder="Search..."
            />
          </div>
        </div>
        <div className="flex flex-row gap-4">
          <div className="grow-1 flex-[60%]">
            <Label htmlFor="t">Trigger</Label>
            <Input
              type="search"
              name="tr"
              defaultValue={triggerPart ?? ""}
              placeholder="Search..."
            />
          </div>
          <div className="grow-1 flex-[60%]">
            <Label htmlFor="t">Condition</Label>
            <Input
              type="search"
              name="cond"
              defaultValue={conditionPart ?? ""}
              placeholder="Search..."
            />
          </div>
          <div className="grow-1 flex-[60%]">
            <Label htmlFor="t">Effect</Label>
            <Input
              type="search"
              name="eff"
              defaultValue={effectPart ?? ""}
              placeholder="Search..."
            />
          </div>
        </div>
        <div className="align-self-start">
          <Button
            type="submit"
            className="bg-accent/80 text-foreground hover:bg-accent"
          >
            Search
          </Button>
        </div>
      </div>
    </Form>
  )
}
