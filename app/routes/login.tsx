import { type ActionFunctionArgs, type LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useSearchParams } from "@remix-run/react";
import { verifyLogin } from "~/lib/auth.server";
import { createUserSession, getUserId } from "~/lib/session.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { getTranslator } from "~/lib/i18n.server";
import { useTranslation } from "~/lib/i18n";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await getUserId(request);
  if (userId) return redirect("/");
  
  const url = new URL(request.url);
  const locale = url.searchParams.get("lang") || "en";
  const t = getTranslator(locale);
  
  const allowGoogleConnection = process.env.ALLOW_GOOGLE_CONNECTION === "true";
  
  return json({ locale, allowGoogleConnection });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const emailOrName = formData.get("email");
  const password = formData.get("password");
  const redirectTo = formData.get("redirectTo") || "/";

  if (typeof emailOrName !== "string" || typeof password !== "string") {
    return json(
      { error: "Invalid form data", fields: { email: emailOrName, password } },
      { status: 400 }
    );
  }

  if (!emailOrName || !password) {
    return json(
      { error: "Email/nickname and password are required", fields: { email: emailOrName, password } },
      { status: 400 }
    );
  }

  const user = await verifyLogin(emailOrName, password);
  if (!user) {
    return json(
      { error: "Invalid email/nickname or password", fields: { email: emailOrName, password } },
      { status: 400 }
    );
  }

  return createUserSession(user.id, typeof redirectTo === "string" ? redirectTo : "/");
}

export default function Login() {
  const actionData = useActionData<typeof action>();
  const loaderData = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation(loaderData.locale);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 rounded-lg border border-border bg-card p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold">{t('login_title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('login_subtitle')}
          </p>
        </div>

        <Form method="post" className="mt-8 space-y-6">
          <input
            type="hidden"
            name="redirectTo"
            value={searchParams.get("redirectTo") ?? undefined}
          />

          <div className="space-y-4">
            <div>
              <Label htmlFor="email">{t('email_or_nickname')}</Label>
              <Input
                id="email"
                name="email"
                type="text"
                autoComplete="email"
                required
                className="mt-1"
                defaultValue={actionData?.fields?.email as string}
              />
            </div>

            <div>
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1"
              />
            </div>
          </div>

          {actionData?.error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {actionData.error}
            </div>
          )}

          <Button type="submit" className="w-full">
            {t('login_button')}
          </Button>
        </Form>

        {loaderData.allowGoogleConnection && (
          <>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  {t('or_continue_with')}
                </span>
              </div>
            </div>

            <Form method="post" action="/auth/google">
              {searchParams.get("redirectTo") && (
                <input
                  type="hidden"
                  name="redirectTo"
                  value={searchParams.get("redirectTo")!}
                />
              )}
              <Button type="submit" variant="outline" className="w-full">
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {t('sign_in_with_google')}
              </Button>
            </Form>
          </>
        )}

        <div className="text-center text-sm">
          <span className="text-muted-foreground">{t('no_account')} </span>
          <Link
            to={`/register?${searchParams.toString()}`}
            className="font-medium text-primary hover:underline"
          >
            {t('register_link')}
          </Link>
        </div>
      </div>
    </div>
  );
}
