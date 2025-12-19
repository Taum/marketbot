import { useSearchParams } from "@remix-run/react";
import { useState, useEffect } from "react";
import { useTranslation } from "~/lib/i18n";

export const LanguageSwitcher: React.FC = () => {
  const { locale, setLocale } = useTranslation();
  const [searchParams] = useSearchParams();
  const [current, setCurrent] = useState<string>(locale ?? "en");

  useEffect(() => {
    setCurrent(locale ?? "en");
  }, [locale]);

  function changeLocale(lang: string) {
    // Persist in cookie for server-side use on next request
    try {
      document.cookie = `locale=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      // Update runtime locale flag for immediate client-side use
      // @ts-ignore
      window.__LOCALE__ = lang;
      setLocale(lang);
      setCurrent(lang);
      // Reload to let server render localized content
      searchParams.set("lang", lang);
      window.location.search = searchParams.toString();
    } catch (e) {
      console.error("Failed to set locale cookie", e);
    }
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      <button aria-label="English" title="English" onClick={() => changeLocale("en")} className={`p-1 rounded ${current === "en" ? "ring-2 ring-primary" : ""}`}>
        <span role="img" aria-hidden>🇬🇧</span>
      </button>
      <button aria-label="Français" title="Français" onClick={() => changeLocale("fr")} className={`p-1 rounded ${current === "fr" ? "ring-2 ring-primary" : ""}`}>
        <span role="img" aria-hidden>🇫🇷</span>
      </button>
    </div>
  );
};
