import { type ActionFunctionArgs, type LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useSearchParams } from "@remix-run/react";
import { createUser } from "~/lib/auth.server";
import { createUserSession, getUserId } from "~/lib/session.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useTranslation } from "~/lib/i18n";
import { useState } from "react";
import { PasswordStrengthIndicator } from "~/components/common/PasswordStrengthIndicator";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await getUserId(request);
  if (userId) return redirect("/");
  
  const url = new URL(request.url);
  const locale = url.searchParams.get("lang") || "en";
  
  return json({ locale });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const name = formData.get("name");
  const redirectTo = formData.get("redirectTo") || "/";

  if (typeof email !== "string" || typeof password !== "string") {
    return json(
      { error: "Invalid form data", fields: { email, password, name } },
      { status: 400 }
    );
  }

  if (!email || !password) {
    return json(
      { error: "Email and password are required", fields: { email, password, name } },
      { status: 400 }
    );
  }

  // Strong password validation
  if (password.length < 8) {
    return json(
      { error: "Password must be at least 8 characters", fields: { email, password, name } },
      { status: 400 }
    );
  }

  if (!/[a-z]/.test(password)) {
    return json(
      { error: "Password must contain at least one lowercase letter", fields: { email, password, name } },
      { status: 400 }
    );
  }

  if (!/[A-Z]/.test(password)) {
    return json(
      { error: "Password must contain at least one uppercase letter", fields: { email, password, name } },
      { status: 400 }
    );
  }

  if (!/[0-9]/.test(password)) {
    return json(
      { error: "Password must contain at least one number", fields: { email, password, name } },
      { status: 400 }
    );
  }

  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>?]/.test(password)) {
    return json(
      { error: "Password must contain at least one special character", fields: { email, password, name } },
      { status: 400 }
    );
  }

  // Check if user already exists
  try {
    const user = await createUser(email, password, typeof name === "string" ? name : undefined);
    return createUserSession(user.id, typeof redirectTo === "string" ? redirectTo : "/");
  } catch (error: unknown) {
    // Check for unique constraint violation (user already exists)
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === "P2002") {
      return json(
        { error: "A user with this email already exists", fields: { email, password, name } },
        { status: 400 }
      );
    }
    return json(
      { error: "Something went wrong. Please try again.", fields: { email, password, name } },
      { status: 500 }
    );
  }
}

export default function Register() {
  const actionData = useActionData<typeof action>();
  const loaderData = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation(loaderData.locale);
  const [password, setPassword] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 rounded-lg border border-border bg-card p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold">{t('register_title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('register_subtitle')}
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
              <Label htmlFor="name">{t('name')} {t('optional')}</Label>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                className="mt-1"
                defaultValue={actionData?.fields?.name as string}
              />
            </div>

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
                autoComplete="new-password"
                required
                className="mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <PasswordStrengthIndicator password={password} t={t} />
            </div>
          </div>

          {actionData?.error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {actionData.error}
            </div>
          )}

          <Button type="submit" className="w-full">
            {t('register_button')}
          </Button>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">{t('have_account')} </span>
            <Link
              to={`/login?${searchParams.toString()}`}
              className="font-medium text-primary hover:underline"
            >
              {t('login_link')}
            </Link>
          </div>
        </Form>
      </div>
    </div>
  );
}
