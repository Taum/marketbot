import { ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useSearchParams } from "@remix-run/react";
import { search } from "~/loaders/search.js";
import { CardImage } from "~/components/altered/CardImage.js";
import { DisplayUniqueCard } from "~/models/cards";
import { FC, useMemo, useState } from "react";
import { formatDistance } from "date-fns";
import { FactionSelect } from "~/components/altered/FactionSelect";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { nullifyTrim } from "~/lib/utils";

// Define the type for a search result item
type SearchResult = {
  id: string;
  title: string;
  description: string;
  url: string;
};

// Loader function to handle search requests
// export async function action({ request }: ActionFunctionArgs) {
//   const url = new URL(request.url);
//   const formData = await request.formData();
//   const query = formData.get("q") as string || "";
//   // TODO: Implement actual search logic here
//   const results: SearchResult[] = [];

//   return { query, results };
// }

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const mainEffect = nullifyTrim(url.searchParams.get("m"));
  const characterName = nullifyTrim(url.searchParams.get("cname"));
  const faction = nullifyTrim(url.searchParams.get("f"));

  // TODO: Implement actual search logic here
  const results = await search({ faction, characterName, mainEffect });

  return { query: { faction, characterName, mainEffect }, results };
}

export default function SearchPage() {
  const loaderData = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const now = useMemo(() => new Date(), []);

  // Safely destructure with default values
  const { faction, characterName, mainEffect } = loaderData?.query ?? {};
  const results = loaderData.results

  const [selectedFaction, setSelectedFaction] = useState(faction ?? undefined);

  return (
    <div className="max-w-screen-xl mx-auto p-6">
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
            <div className="shrink-0 align-self-end flex flex-row items-end">
              <Button
                type="submit"
                className="bg-accent/80 text-foreground hover:bg-accent"
              >
                Search
              </Button>
            </div>
          </div>
        </div>
      </Form>

      {/* Results Section */}
      {results.length > 0 ? (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">
            Found {results.length} matching
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {results.map((result) => (
              <Result key={result.ref} result={result} now={now} />
            ))}
          </div>
        </div>
      ) : loaderData?.query ? (
        <p className="text-gray-600">No results found.</p>
      ) : null}
    </div>
  );
}

const Result: FC<{ result: DisplayUniqueCard, now: Date }> = ({ result, now }) => {
  return (
    <div className="rounded-lg p-2 bg-subtle-background flex flex-row gap-4">
      <div className="flex-1">
        <CardImage card={result} className="rounded-alt-card" />
        <div className="text-subtle-foreground">
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-between">
        <div className="pb-2 flex flex-row gap-2 justify-between">
          <div>
            <div className="font-bold text-lg">
              {result.lastSeenInSalePrice}&euro;
            </div>
            <div className="text-xs text-subtle-foreground">
              {formatLastSeen(result.lastSeenInSaleAt, now)}
            </div>
          </div>
          <div>
            <Link to={`https://www.altered.gg/cards/${result.ref}`}>
              View on Altered
            </Link>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {result.mainEffect && <div className="text-sm">{result.mainEffect}</div>}
          {result.mainEffect && result.echoEffect && (
            <hr className="border-subtle-foreground border-b-1" />
          )}
          {result.echoEffect && <div className="text-xs">{result.echoEffect}</div>}
        </div>
        <div className="grow-0"></div>
      </div>
    </div>
  );
}

function formatLastSeen(lastSeenInSaleAt: string | undefined, now: Date): string | null {
  if (!lastSeenInSaleAt) return null
  const date = new Date(lastSeenInSaleAt)
  const fmtDiff = formatDistance(date, now, { addSuffix: true, includeSeconds: false })
  return fmtDiff
}

