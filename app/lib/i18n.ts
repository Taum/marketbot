import { useState, useMemo } from "react";
import en from "~/locales/en.json";
import fr from "~/locales/fr.json";

const DICT: Record<string, Record<string, string>> = { en, fr };

function replaceVars(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  return Object.keys(vars).reduce((acc, k) => acc.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k])), s);
}

export function useTranslation(initialLocale?: string) {
  const [locale, setLocale] = useState<string>(() => {
    if (initialLocale) return initialLocale.split("-")[0];
    if (typeof window !== "undefined") {
      // prefer a cookie set by the language switcher, then a global injected
      // `window.__LOCALE__`, then the browser locale
      const getCookie = (name: string) =>
        document.cookie.split(";").map(c => c.trim()).find(c => c.startsWith(name + "="))?.split("=")[1];
      const cookieLocale = getCookie("locale");
      // @ts-ignore
      const winLocale = (window.__LOCALE__ as string) || navigator.language || "en";
      const chosen = cookieLocale || winLocale;
      return chosen.split("-")[0];
    }
    return "en";
  });

  const t = useMemo(() => {
    const dict = DICT[locale] ?? DICT.en;
    return (key: string, vars?: Record<string, string | number>) => {
      const s = dict[key] ?? DICT.en[key] ?? key;
      return replaceVars(s, vars);
    };
  }, [locale]);

  return { t, locale, setLocale } as const;
}
