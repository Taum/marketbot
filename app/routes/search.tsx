import { type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData, useSearchParams } from "@remix-run/react";
import { search } from "~/loaders/search.js";
import { useMemo, useState } from "react";
import { FactionSelect } from "~/components/altered/FactionSelect";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { nullifyParseInt, nullifyTrim } from "~/lib/utils";
import { ResultGrid } from "~/components/altered/ResultGrid";
import { ResultsPagination } from "~/components/common/pagination";


export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const mainEffect = nullifyTrim(url.searchParams.get("m"));
  const characterName = nullifyTrim(url.searchParams.get("cname"));
  const faction = nullifyTrim(url.searchParams.get("f"));
  const triggerPart = nullifyTrim(url.searchParams.get("tr"));
  const conditionPart = nullifyTrim(url.searchParams.get("cond"));
  const effectPart = nullifyTrim(url.searchParams.get("eff"));

  const currentPage = nullifyParseInt(url.searchParams.get("p")) ?? 1;

  const { results, pagination } = await search(
    { faction, characterName, mainEffect, triggerPart, conditionPart, effectPart },
    { page: currentPage, includePagination: true }
  );

  return {
    results,
    pagination: { ...pagination, currentPage },
    query: { faction, characterName, mainEffect, triggerPart, conditionPart, effectPart },
  };
}

export default function SearchPage() {
  const loaderData = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const now = useMemo(() => new Date(), []);

  // Safely destructure with default values
  const { faction, characterName, mainEffect, triggerPart, conditionPart, effectPart } = loaderData?.query ?? {};
  const results = loaderData.results
  const pagination = loaderData.pagination

  const [selectedFaction, setSelectedFaction] = useState(faction ?? undefined);

  const currentPage = parseInt(searchParams.get("p") ?? "1");
  const totalPages = pagination;

  const handlePageChange = (page: number) => {
    searchParams.set("p", page.toString());
    window.location.search = searchParams.toString();
  };

  return (
    <div className="global-page">
      {/* Search Form */}
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
              <Label htmlFor="cname">Character name</Label>
              <Input
                type="text"
                name="cname"
                defaultValue={characterName ?? ""}
                placeholder="Character name"
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

      {/* Results Section */}
      {results.length > 0 ? (
        <div className="space-y-6">
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
          <ResultGrid results={results} now={now} />
        </div>
      ) : loaderData?.query ? (
        <p className="text-gray-600">No results found.</p>
      ) : null}
    </div>
  );
}
