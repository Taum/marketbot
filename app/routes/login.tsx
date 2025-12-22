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
  
  return json({ locale });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const redirectTo = formData.get("redirectTo") || "/";

  if (typeof email !== "string" || typeof password !== "string") {
    return json(
      { error: "Invalid form data", fields: { email, password } },
      { status: 400 }
    );
  }

  if (!email || !password) {
    return json(
      { error: "Email and password are required", fields: { email, password } },
      { status: 400 }
    );
  }

  const user = await verifyLogin(email, password);
  if (!user) {
    return json(
      { error: "Invalid email or password", fields: { email, password } },
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
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
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

          <div className="text-center text-sm">
            <span className="text-muted-foreground">{t('no_account')} </span>
            <Link
              to={`/register?${searchParams.toString()}`}
              className="font-medium text-primary hover:underline"
            >
              {t('register_link')}
            </Link>
          </div>
        </Form>
      </div>
    </div>
  );
}
