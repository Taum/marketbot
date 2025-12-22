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

  function toggleLanguage() {
    const newLang = current === "en" ? "fr" : "en";
    
    // Persist in cookie for server-side use on next request
    try {
      document.cookie = `locale=${newLang}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      // Update runtime locale flag for immediate client-side use
      // @ts-expect-error - Runtime global
      window.__LOCALE__ = newLang;
      setLocale(newLang);
      setCurrent(newLang);
      // Reload to let server render localized content
      const newParams = new URLSearchParams(searchParams);
      newParams.set("lang", newLang);
      window.location.search = newParams.toString();
    } catch (e) {
      console.error("Failed to set locale cookie", e);
    }
  }

  const currentFlag = current === "en" ? "/assets/eng.png" : "/assets/fr.png";
  const currentLabel = current === "en" ? "English" : "Français";
  const nextLabel = current === "en" ? "Français" : "English";

  return (
    <button 
      aria-label={`Switch to ${nextLabel}`}
      title={`Switch to ${nextLabel}`}
      onClick={toggleLanguage}
      className="p-1 rounded hover:bg-accent/10 transition-colors"
    >
      <img 
        src={currentFlag} 
        alt={currentLabel}
        className="w-6 h-6 object-contain"
      />
    </button>
  );
};
