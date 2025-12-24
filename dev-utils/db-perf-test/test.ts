import { DisplayUniqueCard } from "~/models/cards.js";
import { PageParams, search, SearchResults } from "../../app/loaders/search.js";
import { SearchQuery } from "../../app/loaders/search.js";
import { delay } from "@common/utils/promise.js";
import { searchWithCTEs, searchWithCTEsIndexingCharacterNames, searchWithCTEsWithExcept, searchWithJoins } from "~/loaders/search-alternates.js";

interface TestCase {
  name: string;
  url?: string;
  query: SearchQuery;
}

interface TestResult {
  testCase: TestCase;
  durations: Record<string, number>;
  totalCounts: Record<string, number>;
}

interface RunResult {
  duration: number;
  totalCount: number;
  error?: string;
  stack?: string;
}

const testCases: TestCase[] = [
  {
    name: "Short text search",
    url: "http://localhost:5173/search?f=YZ&s=&cname=&mc=1-2&rc=1-3&text=When+you+play+a+spell&tr=&cond=&eff=&minpr=&maxpr=",
    query: {
      cardText: "When you play a spell",
    },
  },
  {
    name: "Long text search",
    url: "http://localhost:5173/search?f=YZ&s=&cname=&mc=1-2&rc=1-3&text=When+you+play+a+spell+I+gain+1+boost&tr=&cond=&eff=&minpr=&maxpr=",
    query: {
      cardText: "When you play a spell I gain 1 boost",
    },
  },
  {
    name: "Complex Search",
    url: "http://localhost:5173/search?f=YZ&s=&cname=&mc=1-2&rc=1-3&text=you+may+return&tr=&cond=%5B%5D&eff=&minpr=&maxpr=",
    query: {
      faction: "YZ",
      mainCosts: [1, 2],
      recallCosts: [1, 2, 3],
      cardText: "You may return",
      conditionPart: "[]",
    },
  },
  {
    name: "Complex Search 2",
    url: "http://localhost:5173/search?f=BR&s=&cname=&mc=1-3&rc=&text=landmark&tr=%7Bj%7D&cond=&eff=&minpr=&maxpr=",
    query: {
      faction: "BR",
      mainCosts: [1, 2, 3],
      cardText: "landmark",
      triggerPart: "{j}",
    },
  },
  {
    name: "Negative Card Text Search",
    url: "http://localhost:5173/search?f=BR&s=&cname=&mc=1-3&rc=&text=-landmark&tr=%7Bj%7D&cond=&eff=&minpr=&maxpr=",
    query: {
      faction: "BR",
      mainCosts: [1, 2, 3],
      cardText: "-landmark",
      triggerPart: "{j}",
    },
  },
  {
    name: "Negative search",
    url: "http://localhost:5173/search?f=LY&s=&cname=&mc=1-3&rc=&text=&tr=when&cond=-landmark&eff=boost&minpr=&maxpr=",
    query: {
      faction: "LY",
      mainCosts: [1, 2, 3],
      cardText: undefined,
      triggerPart: "when",
      conditionPart: "-landmark",
      effectPart: "boost",
    },
  },
  {
    name: "Negative Trigger",
    url: "http://localhost:5173/search?f=&s=&cname=&mc=1-3&rc=&text=&tr=-when&cond=&eff=boost&minpr=&maxpr=",
    query: {
      mainCosts: [1, 2, 3],
      cardText: undefined,
      triggerPart: "-when",
      conditionPart: undefined,
      effectPart: "boost",
    },
  },
  {
    name: "Negative all",
    url: "http://localhost:5173/search?f=&s=&cname=&mc=1-3&rc=&text=&tr=-when&cond=-landmark&eff=-boost&minpr=&maxpr=",
    query: {
      mainCosts: [1, 2, 3],
      cardText: undefined,
      triggerPart: "-when",
      conditionPart: "-landmark",
      effectPart: "-boost",
    },
  },
  {
    name: "Positive+Negative search",
    url: "http://localhost:5173/search?f=MU&s=&cname=&mc=&rc=&text=&tr=when&cond=reserve+-discard&eff=anchored&minpr=&maxpr=",
    query: {
      faction: "MU",
      cardText: undefined,
      triggerPart: "when",
      conditionPart: "reserve -discard",
      effectPart: "anchored",
    },
  },
  {
    name: "Ability + Character name",
    url: "http://localhost:5173/search?f=OR&s=&cname=issitoq&mc=4-8&rc=5-7&text=&tr=%7Bj%7D&cond=[]&eff=&minpr=&maxpr=",
    query: {
      faction: "OR",
      mainCosts: [4, 5, 6, 7, 8],
      recallCosts: [5, 6, 7],
      cardText: undefined,
      characterName: "issitoq",
      triggerPart: "{J}",
      conditionPart: "[]",
      effectPart: undefined,
    },
  },
  {
    name: "Character name only",
    url: "http://localhost:5173/search?f=&s=&cname=demet&mc=&rc=&text=&tr=&cond=&eff=&minpr=&maxpr=",
    query: {
      characterName: "demet",
      faction: "MU",
    },
  },
  {
    name: "Ambiguous character name",
    url: "http://localhost:5173/search?f=&s=&cname=ordis&mc=&rc=&text=&tr=%7Bj%7D&cond=&eff=&minpr=&maxpr=",
    query: {
      characterName: "ordis",
      triggerPart: "{J}",
    },
  },
  // Multi-ability search tests
  {
    name: "Multi-ability: 2 abilities with ANY (OR logic)",
    url: "http://localhost:5173/search?cname=Bessie+Coleman&tr=%22When+you+sacrifice+a+Permanent%22&tr=&cond=&cond=%22You+may+discard+a+card+from+your+Reserve.+If+you+do%3A%22&eff=%22I+gain+1+boost.%22&eff=&matchAll=0",
    query: {
      characterName: "Bessie Coleman",
      triggerPart: ['"When you sacrifice a Permanent"', ''],
      conditionPart: ['', '"You may discard a card from your Reserve. If you do:"'],
      effectPart: ['"I gain 1 boost."', ''],
      matchAllAbilities: false,
    },
  },
  {
    name: "Multi-ability: 2 abilities with ALL (AND logic)",
    url: "http://localhost:5173/search?cname=Bessie+Coleman&tr=%22When+you+sacrifice+a+Permanent%22&tr=&cond=&cond=%22You+may+discard+a+card+from+your+Reserve.+If+you+do%3A%22&eff=%22I+gain+1+boost.%22&eff=&matchAll=1",
    query: {
      characterName: "Bessie Coleman",
      triggerPart: ['"When you sacrifice a Permanent"', ''],
      conditionPart: ['', '"You may discard a card from your Reserve. If you do:"'],
      effectPart: ['"I gain 1 boost."', ''],
      matchAllAbilities: true,
    },
  },
  {
    name: "Multi-ability: 3 abilities with ANY",
    url: "http://localhost:5173/search?tr=when&tr=%7BH%7D&tr=&cond=&cond=&cond=%5B%5D&eff=boost&eff=&eff=token&matchAll=0",
    query: {
      triggerPart: ['when', '{H}', ''],
      conditionPart: ['', '', '[]'],
      effectPart: ['boost', '', 'token'],
      matchAllAbilities: false,
    },
  },
  {
    name: "Multi-ability: 3 abilities with ALL",
    url: "http://localhost:5173/search?tr=when&tr=%7BH%7D&tr=&cond=&cond=&cond=%5B%5D&eff=boost&eff=&eff=token&matchAll=1",
    query: {
      triggerPart: ['when', '{H}', ''],
      conditionPart: ['', '', '[]'],
      effectPart: ['boost', '', 'token'],
      matchAllAbilities: true,
    },
  },
  {
    name: "Multi-ability: Mixed with other filters",
    url: "http://localhost:5173/search?f=YZ&mc=1-3&tr=when&tr=&cond=&cond=%5B%5D&eff=&eff=boost&matchAll=0",
    query: {
      faction: "YZ",
      mainCosts: [1, 2, 3],
      triggerPart: ['when', ''],
      conditionPart: ['', '[]'],
      effectPart: ['', 'boost'],
      matchAllAbilities: false,
    },
  },
  {
    name: "Multi-ability: Empty strings in arrays",
    url: "http://localhost:5173/search?tr=&tr=when&tr=&cond=&cond=&cond=&eff=boost&eff=&eff=&matchAll=0",
    query: {
      triggerPart: ['', 'when', ''],
      conditionPart: ['', '', ''],
      effectPart: ['boost', '', ''],
      matchAllAbilities: false,
    },
  },
  {
    name: "Multi-ability: Negation in multiple abilities",
    url: "http://localhost:5173/search?tr=when&tr=-permanent&cond=&cond=&eff=boost&eff=-landmark&matchAll=0",
    query: {
      triggerPart: ['when', '-permanent'],
      conditionPart: ['', ''],
      effectPart: ['boost', '-landmark'],
      matchAllAbilities: false,
    },
  }
];

type SearchFunction = (searchQuery: SearchQuery, pageParams: PageParams) => Promise<SearchResults>;

async function runTest(testCase: TestCase, searchFn: SearchFunction): Promise<RunResult> {
  const startTime = performance.now();
  
  try {
    const { results, pagination } = await searchFn(testCase.query, { page: 1, includePagination: true });
    const endTime = performance.now();
    const duration = endTime - startTime;

    return {
      duration,
      totalCount: pagination?.totalCount ?? 0,
    };
  } catch (error) {
    return {
      duration: 0,
      totalCount: 0,
      error: error.message,
      stack: error instanceof Error ? error.stack : undefined,
    };
  }
}

async function runAllTests() {
  console.log("Starting performance tests...\n");

  const results: TestResult[] = [];
  const implNames = ["searchWithCTEs", "searchWithCTEsWithExcept", "searchWithCTEsIndexingCharacterNames", "searchWithJoins", "search"];
  const searchFunctions: SearchFunction[] = [searchWithCTEs, searchWithCTEsWithExcept, searchWithCTEsIndexingCharacterNames, searchWithJoins, search];
  
  for (const testCase of testCases) {
    console.log(`Running test: ${testCase.name}`);
    let result: TestResult = {
      testCase,
      durations: {},
      totalCounts: {},
    };
    results.push(result);
    
    // Run each test 4 times. discard the first result, then take the average
    const RUNS_COUNT = 4;
    for (let i = 0; i < RUNS_COUNT; i++) {
      for (let j = 0; j < searchFunctions.length; j++) {
        const searchFn = searchFunctions[j];
        if (i === 0) {
          result.durations[implNames[j]] = 0;
        }

        const runResult = await runTest(testCase, searchFn);
        
        if (runResult.error) {
          console.error(`Error in test: ${runResult.error}`);
          if (runResult.stack) {
            console.log(runResult.stack)
          }
          break;
        }

        if (i === 0) {
          result.totalCounts[implNames[j]] = runResult.totalCount;
        } else if (result.totalCounts[implNames[j]] !== runResult.totalCount) {
          console.error(`Total count mismatch for ${implNames[j]}: ${result.totalCounts[implNames[j]]} != ${runResult.totalCount}`);
          break;
        } else {
          result.durations[implNames[j]] += runResult.duration;
        }

        
        await delay(100);
      }
    }

    // Calculate averages after all runs
    for (let j = 0; j < searchFunctions.length; j++) {
      result.durations[implNames[j]] /= RUNS_COUNT - 1;
    }
  }

  // Print results
  console.log("\nTest Results:");
  
  const maxImplNameLength = Math.max(...implNames.map(name => name.length));

  results.forEach((result) => {
    console.log(`\n${result.testCase.name} (${result.testCase.url})`);
    for (const [implName, duration] of Object.entries(result.durations)) {
      console.log(`- ${implName.padEnd(maxImplNameLength + 3, ".")}${duration.toFixed(0).padStart(4)}ms, ${result.totalCounts[implName]} results`);
    }
  });
}

// Run the tests
runAllTests()
  .catch(console.error)
  .finally(() => {
    console.log("Done");
    process.exit(0);
  });
