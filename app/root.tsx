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
import { getUserById } from "~/lib/auth.server";
import { getUserId } from "~/lib/session.server";
import type { User } from "~/types/user";

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
  const data = useLoaderData<{ locale?: string; user?: User | null }>();
  const lang = data?.locale ?? "en";
  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {/* Set the locale BEFORE any scripts run to prevent flash of wrong language */}
        <script dangerouslySetInnerHTML={{ __html: `window.__LOCALE__ = "${lang}";` }} />
        {/* Apply dark mode class immediately to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            const theme = localStorage.getItem('theme');
            if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
              document.documentElement.classList.add('dark');
            }
          })();
        ` }} />
        {/* Add loading overlay styles */}
        <style dangerouslySetInnerHTML={{ __html: `
          #loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: hsl(var(--background));
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: opacity 0.2s ease-out;
          }
          #loading-overlay.ready {
            opacity: 0;
            pointer-events: none;
          }
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid hsl(var(--muted));
            border-top-color: hsl(var(--primary));
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          body {
            overflow: hidden;
            height: 100vh;
          }
        ` }} />
      </head>
      <body>
        {/* Loading overlay - hidden after locale is ready */}
        <div id="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
        <Navigation user={data?.user} />
        {children}
        <ScrollRestoration />
        <Scripts />
        {/* Hide loading overlay after hydration */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener('load', function() {
            setTimeout(function() {
              document.getElementById('loading-overlay').classList.add('ready');
            }, 100);
          });
        ` }} />
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
  
  // Get current user if logged in
  const userId = await getUserId(request);
  const user = userId ? await getUserById(userId) : null;
  
  return json({ locale, user });
}

export default function App() {
  return (
    <Outlet />
  );
}
