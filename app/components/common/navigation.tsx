
import { Link, useSearchParams } from "@remix-run/react";
import { useState } from "react";
import { useTranslation } from "~/lib/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { Button } from "~/components/ui/button";
import { UserMenu } from "./UserMenu";
import type { User } from "~/types/user";

interface NavigationProps {
  user?: User | null;
}

// eslint-disable-next-line react/prop-types
export const Navigation: React.FC<NavigationProps> = ({ user }) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const lang = searchParams.get("lang");
  const langParam = lang ? `?lang=${lang}` : "";
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav data-nav="main" className="bg-muted/20 py-3 px-6">
      <div className="flex gap-6 items-center justify-between w-full">
        {/* Hamburger Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-foreground hover:text-primary transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" x2="20" y1="12" y2="12"/>
              <line x1="4" x2="20" y1="6" y2="6"/>
              <line x1="4" x2="20" y1="18" y2="18"/>
            </svg>
          )}
        </button>
        
        <div className="flex gap-2 items-center">
          <ThemeSwitcher />
          <LanguageSwitcher />
          
          {/* User menu */}
          {user ? (
            <UserMenu user={user} />
          ) : (
            <Link to={`/login${langParam}`}>
              <Button variant="outline" size="sm">
                {t('login_button')}
              </Button>
            </Link>
          )}
        </div>
      </div>
      
      {/* Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="mt-4 pb-2 flex flex-col gap-3 border-t border-border pt-3">
          <Link 
            to={`/search${langParam}`}
            className="text-foreground hover:text-primary transition-colors py-2 flex items-center gap-3"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <img src="/assets/search.svg" alt="" className="w-5 h-5 dark:invert" />
            {t('search')}
          </Link>
          <Link 
            to={`/abilities-list${langParam}`}
            className="text-foreground hover:text-primary transition-colors py-2 flex items-center gap-3"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <img src="/assets/list.svg" alt="" className="w-5 h-5 dark:invert" />
            {t('see_all_abilities')}
          </Link>
        </div>
      )}
    </nav>
  );
}
