
import { Link, useSearchParams } from "@remix-run/react";
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
    </nav>
  );
}
