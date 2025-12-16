import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { useTranslation } from "~/lib/i18n";

export const meta: MetaFunction = () => {
  return [
    { title: "Uniques Marketplace Search" },
  ];
};

export default function Index() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col h-screen items-center justify-center">
      <Link to="/search" className="text-primary hover:underline">
        {t('uniques_search')}
      </Link>
      <hr className="m-4 border-subtle-foreground border-b-1 min-w-24" />
      <Link to="/abilities-list" className="text-primary hover:underline">
        {t('see_all_abilities')}
      </Link>
    </div>
  );
}
