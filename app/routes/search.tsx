import { type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData, useSearchParams } from "@remix-run/react";
import { FC, useEffect, useState } from "react";
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
import { SaveSelect } from "~/components/save/SaveSelect";
import { search } from "~/loaders/search";


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
  const cardSubTypes = nullifyTrim(url.searchParams.get("types"))?.split(",") ?? [];
  const faction = nullifyTrim(url.searchParams.get("f"));
  const set = nullifyTrim(url.searchParams.get("s"));
  const triggerPart = nullifyTrim(url.searchParams.get("tr"));
  const conditionPart = nullifyTrim(url.searchParams.get("cond"));
  const effectPart = nullifyTrim(url.searchParams.get("eff"));
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
    triggerPart,
    conditionPart,
    effectPart,
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
  cardSubTypes,
  cardText,
  triggerPart,
  conditionPart,
  effectPart,
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
}: SearchQuery) => {
  const [selectedFaction, setSelectedFaction] = useState(faction ?? undefined);
  const [selectedSet, setSelectedSet] = useState(set ?? undefined);
  const [selectedCardSubTypes, setSelectedCardSubTypes] = useState<string[]>(cardSubTypes ?? []);
  const [isAdvSearchOpen, setIsAdvSearchOpen] = useState(false);
  const [isSaveLoadOpen, setIsSaveLoadOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [loadingSave, setLoadingSave] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  const [searchParams] = useSearchParams();
  const [additionalSearchParams, setAdditionalSearchParams] = useState<URLSearchParams | undefined>(undefined);

  useEffect(() => {
    setAdditionalSearchParams(searchParams);
    setIsAdvSearchOpen(searchParams.has("arrow") || searchParams.has("hand") || searchParams.has("reserve") || searchParams.has("inclSup") || searchParams.has("zeroStat") || searchParams.has("textless"));
  }, [searchParams]);

  const handleExpiredCardsChange = (newValue: boolean) => {
    if (newValue) {
      searchParams.set("exp", "1");
    } else {
      searchParams.delete("exp");
    }
    window.location.search = searchParams.toString();
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
    searchParams.set("types", newValues.join(","));
    window.location.search = searchParams.toString();
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

  return (
    <Form method="get" id="search-form" className="mb-8">
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
        </div>
        
        <Button type="button" className="bg-accent/80 text-foreground hover:bg-accent" onClick={() => {
          setIsAdvSearchOpen(!isAdvSearchOpen);
        }}>
          Advanced Filters
        </Button>
        {isAdvSearchOpen && (
          <>
            <div className="flex flex-row gap-4">
              <div>
                <div className="grow-1 flex-[10%] pt-4 flex flex-row gap-2 items-center">
                  <Checkbox
                    value="1"
                    name="arrow"
                    defaultChecked={partFilterArrow ?? false}
                    onCheckedChange={handleArrow}
                  />
                  <Label htmlFor="arrow" className="text-xs/3 inline-block">Filter by arrow effect</Label>
                </div>
              </div>
              <div>
                <div className="grow-1 flex-[10%] pt-4 flex flex-row gap-2 items-center">
                  <Checkbox
                    value="1"
                    name="hand"
                    defaultChecked={partFilterHand ?? false}
                    onCheckedChange={handleHand}
                  />
                  <Label htmlFor="hand" className="text-xs/3 inline-block">Filter by hand effect</Label>
                </div>
              </div>
              <div>
                <div className="grow-1 flex-[10%] pt-4 flex flex-row gap-2 items-center">
                  <Checkbox
                    value="1"
                    name="reserve"
                    defaultChecked={partFilterReserve ?? false}
                    onCheckedChange={handleReserve}
                  />
                  <Label htmlFor="reserve" className="text-xs/3 inline-block">Filter by reserve effect</Label>
                </div>
              </div>
            </div>
            <div className="flex flex-row gap-4">
              <div>
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
              <div>
                <div className="grow-1 flex-[10%] pt-4 flex flex-row gap-2 items-center">
                  <Checkbox
                    value="1"
                    name="zeroStat"
                    defaultChecked={filterZeroStat ?? false}
                    onCheckedChange={handleSearchZero}
                  />
                  <Label htmlFor="zeroStat" className="text-xs/3 inline-block">Search for at least one 0 stat</Label>
                </div>
              </div>
              <div>
                <div className="grow-1 flex-[10%] pt-4 flex flex-row gap-2 items-center">
                  <Checkbox
                    value="1"
                    name="textless"
                    defaultChecked={filterTextless ?? false}
                    onCheckedChange={handleTextless}
                  />
                  <Label htmlFor="textless" className="text-xs/3 inline-block">Search for cards without text (only support)</Label>
                </div>
              </div>
            </div>
          </>
        )}
        <Button type="button" className="bg-accent/80 text-foreground hover:bg-accent" onClick={() => {
          setIsSaveLoadOpen(!isSaveLoadOpen);
        }}>
          Save/Load Search
        </Button>
        {isSaveLoadOpen && (
          <>
            <div className="flex flex-row gap-4">
              <div className="flex flex-column gap-1 align-self-start">
                <Input
                  type="search"
                  name="save"
                  defaultValue={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Name to save this search"
                />
              </div>
              <Button
                name="saveBtn"
                onClick={() => { 
                  saveSearch();
                }}
                className="bg-accent/80 text-foreground hover:bg-accent"
              >
                Save
              </Button>
            </div>
             <div className="flex flex-row gap-4">
              <div className="flex flex-column gap-1 align-self-start">
                <SaveSelect
                  name="loadSelect"
                  value={loadingSave}
                  options={document.cookie.split('; ')
                    .filter(cookie => cookie.startsWith('save-market-'))
                    .map(cookie => cookie.split('=')[0].replace('save-market-', ''))}
                  onValueChange={(value) => {
                    setLoadingSave(value ?? '');
                  }}
                />
              </div>
              <Button
                name="loadBtn"
                onClick={() => { 
                  loadSearch();
                }}
                className="bg-accent/80 text-foreground hover:bg-accent"
                disabled={loadingSave === '' || showConfirm}
              >
                Load
              </Button>
              <Button
                name="deleteBtn"
                onClick={() => { 
                  deleteSave();
                }}
                className="bg-accent/80 text-foreground hover:bg-accent"
                disabled={loadingSave === ''}
              >
                {!showConfirm ? 'Delete' : 'Confirm'}
              </Button>
              {showConfirm && <Button
                  name="cancelBtn"
                  onClick={() => { 
                    setShowConfirm(false);
                    setMessage('');
                    setError(false);
                  }}
                  className="bg-accent/80 text-foreground hover:bg-accent"
                >
                  Cancel
                </Button>
              }
            </div>
            {message && <Label id="message" style={{color: error ? 'red' : 'green', paddingTop: '5px'}}>{message}</Label>}
          </>
        )}
        <div className="flex flex-row gap-8 align-self-start justify-between items-end">
          <div className="flex flex-row gap-4 align-self-start">
            <Button
              onClick={() => {
                const temporarySearchParamsStr = additionalSearchParams?.toString();
                if(temporarySearchParamsStr) {
                  window.location.search = temporarySearchParamsStr;
                }
              }}
              type="submit"
              className="bg-accent/80 text-foreground hover:bg-accent"
            >
              Search
            </Button>
            <Button
              onClick={() => {
                window.location.search = "";
              }}
              type="reset"
              className="bg-accent/80 text-foreground hover:bg-accent"
            >
              Clear
            </Button>
          </div>
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
