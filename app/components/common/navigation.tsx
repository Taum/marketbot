
import { Link, useSearchParams } from "@remix-run/react";
import { useEffect } from "react";
import { useTranslation } from "~/lib/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";

export const Navigation: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const lang = searchParams.get("lang");
  const langParam = lang ? `?lang=${lang}` : "";

  return (
    <nav data-nav="main" className="bg-muted/20 py-3 px-6">
      <div className="flex gap-6 items-center justify-between w-full">
        <div className="flex gap-6 items-center">
          <Link 
            to={`/search${langParam}`}
            className="text-foreground hover:text-primary transition-colors"
          >
            {t('search')}
          </Link>
          <Link 
            to={`/abilities-list${langParam}`}
            className="text-foreground hover:text-primary transition-colors"
          >
            {t('see_all_abilities')}
          </Link>
        </div>
        <div className="flex gap-2 items-center">
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </div>
    </nav>
  );
}
