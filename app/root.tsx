import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import "./tailwind.css";
import { Navigation } from "~/components/common/navigation";
import { detectLocaleFromAcceptLanguage, parseLocaleFromCookie } from "~/lib/i18n.server";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode; }) {
  const data = useLoaderData<{ locale?: string }>();
  const lang = data?.locale ?? "en";
  return (
    <html lang={lang}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: `window.__LOCALE__ = "${lang}";` }} />
      </head>
      <body>
        <Navigation />
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const langParam = url.searchParams.get("lang") ?? undefined;
  const cookieLocale = parseLocaleFromCookie(request.headers.get("cookie") ?? undefined);
  const detected = detectLocaleFromAcceptLanguage(request.headers.get("Accept-Language") ?? undefined);
  const locale = (langParam ?? cookieLocale ?? detected ?? "en").split("-")[0];
  return json({ locale });
}

export default function App() {
  return (
    <Outlet />
  );
}
