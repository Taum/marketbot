
import { Link } from "@remix-run/react";
import { useEffect } from "react";
import { useTranslation } from "~/lib/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";

export const Navigation: React.FC = () => {
  const { t } = useTranslation();

  return (
    <nav data-nav="main" className="bg-muted/20 py-3 px-6 mb-6">
      <div className="max-w-screen-xl mx-auto flex gap-6 items-center">
        <Link 
          to="/search"
          className="text-foreground hover:text-primary transition-colors"
        >
          {t('search')}
        </Link>
        <Link 
          to="/abilities-list"
          className="text-foreground hover:text-primary transition-colors"
        >
          {t('see_all_abilities')}
        </Link>
        <LanguageSwitcher />
      </div>
    </nav>
  );
}
