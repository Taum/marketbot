import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Uniques Marketplace Search" },
  ];
};

export default function Index() {
  return (
    <div className="flex h-screen items-center justify-center">
      <h1>Search for uniques</h1>
      <form method="post" action="/search">
        <input type="text" name="name" />
        <button type="submit">Search</button>
      </form>

    </div>
  );
}
