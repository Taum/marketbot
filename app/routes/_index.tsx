import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "Uniques Marketplace Search" },
  ];
};

export default function Index() {
  return (
    <div className="flex flex-col h-screen items-center justify-center">
      <Link to="/search" className="text-primary hover:underline">
        Uniques Search
      </Link>
      <hr className="m-4 border-subtle-foreground border-b-1 min-w-24" />
      <Link to="/abilities-list" className="text-primary hover:underline">
        See all abilities
      </Link>
    </div>
  );
}
