import { DisplayUniqueCard } from "~/models/cards.js";
import { PageParams, search, SearchResults } from "../../app/loaders/search.js";
import { SearchQuery } from "../../app/loaders/search.js";
import { delay } from "@common/utils/promise.js";
import { searchWithJoins } from "~/loaders/search-alternates.js";

interface TestCase {
  name: string;
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
}

const testCases: TestCase[] = [
  // {
  //   name: "Short text search",
  //   query: {
  //     cardText: "When you play a spell",
  //   },
  // },
  // {
  //   name: "Long text search",
  //   query: {
  //     cardText: "When you play a spell I gain 1 boost",
  //   },
  // },
  {
    name: "Complex Search",
    query: {
      faction: "LY",
      mainCosts: [1, 2, 3],
      cardText: undefined,
      triggerPart: "when",
      conditionPart: "[]",
      effectPart: "boost",
    },
  },
  {
    name: "Negative search",
    query: {
      faction: "LY",
      mainCosts: [1, 2, 3],
      cardText: undefined,
      triggerPart: "\"when\"",
      conditionPart: "-landmark",
      effectPart: "boost",
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
    };
  }
}

async function runAllTests() {
  console.log("Starting performance tests...\n");

  const results: TestResult[] = [];
  const implNames = ["searchWithJoins", "search"];
  const searchFunctions: SearchFunction[] = [searchWithJoins, search];
  
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
    console.log(`\n${result.testCase.name}`);
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
