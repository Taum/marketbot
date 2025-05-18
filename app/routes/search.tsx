import { ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useSearchParams } from "@remix-run/react";
import { search } from "../loaders/search.js";

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
  const query = url.searchParams.get("q") || "";
  
  // TODO: Implement actual search logic here
  const results = await search({ query });

  return { query, results };
}

export default function SearchPage() {
  const loaderData = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  
  // Safely destructure with default values
  const { query = "", results = [] } = loaderData ?? {};

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Search Form */}
      <Form method="get" className="mb-8">
        <div className="flex gap-4">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search..."
            className="flex-1 px-4 py-2 border rounded-lg"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Search
          </button>
        </div>
      </Form>

      {/* Results Section */}
      <div className="space-y-6">
        {query && (
          <h2 className="text-xl font-semibold">
            Search results for: {query}
          </h2>
        )}

        {/* Results List */}
        {results.length > 0 ? (
          <div className="space-y-4">
            {results.map((result) => (
              <div key={result.id} className="border p-4 rounded-lg">
                <h3 className="text-lg font-medium">
                  <a href={result.url} className="text-blue-600 hover:underline">
                    {result.title}
                  </a>
                </h3>
                <p className="text-gray-600 mt-1">{result.description}</p>
              </div>
            ))}
          </div>
        ) : query ? (
          <p className="text-gray-600">No results found.</p>
        ) : null}
      </div>
    </div>
  );
}
