import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { LogoutButton } from "@/components/logout-button";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Dashboard } from "@/components/dashboard/dashboard";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/app">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app" });
  return { title: t("title"), robots: { index: false } };
}

async function Workspace({ locale }: { locale: string }) {
  // Rendu à la requête : la session dépend des cookies et de l'heure courante.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return redirect({ href: "/login", locale });
  }

  return (
    <>
      <Dashboard />
      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-sm text-muted-foreground">
        <span>{data.user.email}</span>
        <LogoutButton />
      </footer>
    </>
  );
}

export default async function AppPage({ params }: PageProps<"/[locale]/app">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tCommon = await getTranslations("common");

  return (
    <>
      <SiteHeader showAuthLinks={false} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <Suspense
          fallback={
            <Card className="p-6 text-muted-foreground">
              {tCommon("loading")}
            </Card>
          }
        >
          <Workspace locale={locale} />
        </Suspense>
      </main>
    </>
  );
}
