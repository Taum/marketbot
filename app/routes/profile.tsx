import { type ActionFunctionArgs, type LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { requireUserId } from "~/lib/session.server";
import { getUserById } from "~/lib/auth.server";
import { Button } from "~/components/ui/button";
import { useTranslation } from "~/lib/i18n";
import prisma from "@common/utils/prisma.server";
import { logout } from "~/lib/session.server";
import { useState } from "react";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  
  if (!user) {
    throw new Response("User not found", { status: 404 });
  }

  const url = new URL(request.url);
  const locale = url.searchParams.get("lang") || "en";
  
  return json({ user, locale });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const action = formData.get("_action");

  if (action === "delete") {
    // Delete the user
    await prisma.user.delete({
      where: { id: userId },
    });

    // Logout and redirect to home
    return logout(request);
  }

  return json({ error: "Invalid action" }, { status: 400 });
}

export default function Profile() {
  const { user, locale } = useLoaderData<typeof loader>();
  const { t } = useTranslation(locale);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-8 rounded-lg border border-border bg-card p-8 shadow-lg">
        <div>
          <h1 className="text-3xl font-bold">{t('profile_title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('profile_subtitle')}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('email')}</label>
            <p className="mt-1 text-lg">{user.email}</p>
          </div>

          {user.name && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('name')}</label>
              <p className="mt-1 text-lg">{user.name}</p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('member_since')}</label>
            <p className="mt-1 text-lg">
              {new Date(user.createdAt).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-border">
          <h2 className="text-lg font-semibold text-destructive mb-2">{t('danger_zone')}</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {t('delete_account_warning')}
          </p>

          {!showConfirmDelete ? (
            <Button
              variant="destructive"
              onClick={() => setShowConfirmDelete(true)}
              className="w-full"
            >
              {t('delete_account')}
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-destructive">
                {t('delete_account_confirm')}
              </p>
              <div className="flex gap-2">
                <Form method="post" className="flex-1">
                  <input type="hidden" name="_action" value="delete" />
                  <Button
                    type="submit"
                    variant="destructive"
                    className="w-full"
                  >
                    {t('delete_account_yes')}
                  </Button>
                </Form>
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmDelete(false)}
                  className="flex-1"
                >
                  {t('cancel')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
