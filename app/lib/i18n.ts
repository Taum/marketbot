import { useState, useMemo, useEffect } from "react";
import { useMatches } from "@remix-run/react";
import en from "~/locales/en.json";
import fr from "~/locales/fr.json";

const DICT: Record<string, Record<string, string>> = { en, fr };

function replaceVars(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  return Object.keys(vars).reduce((acc, k) => acc.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k])), s);
}

/**
 * Hook to get the locale from the root loader (works in any route)
 */
export function useLocale(): string {
  const matches = useMatches();
  const rootData = matches.find(m => m.id === "root")?.data as { locale?: string } | undefined;
  return rootData?.locale ?? "en";
}

export function useTranslation(initialLocale?: string) {
  // When initialLocale is provided (from server loader), use it directly to avoid hydration mismatch
  const [locale, setLocale] = useState<string>(() => {
    // Priority: initialLocale from props (SSR-safe) > window.__LOCALE__ > cookie > browser > fallback
    if (initialLocale) return initialLocale.split("-")[0];
    
    if (typeof window !== "undefined") {
      // @ts-expect-error - window.__LOCALE__ is set by root.tsx
      const winLocale = (window.__LOCALE__ as string) || undefined;
      if (winLocale) return winLocale.split("-")[0];
      
      // Fallback to cookie
      const getCookie = (name: string) =>
        document.cookie.split(";").map(c => c.trim()).find(c => c.startsWith(name + "="))?.split("=")[1];
      const cookieLocale = getCookie("locale");
      if (cookieLocale) return cookieLocale.split("-")[0];
      
      // Last resort: browser locale
      if (navigator.language) return navigator.language.split("-")[0];
    }
    
    // SSR fallback
    return "en";
  });

  // Sync with initialLocale if it changes (e.g., navigation with different lang param)
  useEffect(() => {
    if (initialLocale) {
      const newLocale = initialLocale.split("-")[0];
      if (newLocale !== locale) {
        setLocale(newLocale);
      }
    }
  }, [initialLocale, locale]);

  const t = useMemo(() => {
    const dict = DICT[locale] ?? DICT.en;
    return (key: string, vars?: Record<string, string | number>) => {
      const s = dict[key] ?? DICT.en[key] ?? key;
      return replaceVars(s, vars);
    };
  }, [locale]);

  return { t, locale, setLocale } as const;
}
