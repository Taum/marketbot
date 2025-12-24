import en from "~/locales/en.json";
import fr from "~/locales/fr.json";

const DICT: Record<string, Record<string, string>> = {
  en,
  fr,
};

function replaceVars(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  return Object.keys(vars).reduce((acc, k) => acc.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k])), s);
}

export function getTranslator(locale?: string) {
  const lang = (locale || "en").split("-")[0];
  const dict = DICT[lang] ?? DICT.en;
  return (key: string, vars?: Record<string, string | number>) => {
    const s = dict[key] ?? DICT.en[key] ?? key;
    return replaceVars(s, vars);
  };
}

export function detectLocaleFromAcceptLanguage(header?: string) {
  if (!header) return "en";
  const parts = header.split(",");
  if (parts.length === 0) return "en";
  return parts[0].split(";")[0].split("-")[0];
}

export function parseLocaleFromCookie(header?: string) {
  if (!header) return undefined;
  const parts = header.split(";").map(p => p.trim());
  for (const part of parts) {
    if (part.startsWith("locale=")) {
      return part.split("=")[1].split("-")[0];
    }
  }
  return undefined;
}
