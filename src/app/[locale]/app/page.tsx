import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { LogoutButton } from "@/components/logout-button";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
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
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const t = await getTranslations({ locale, namespace: "app" });

  if (!data.user) {
    return redirect({ href: "/login", locale });
  }

  return (
    <Card className="flex flex-col items-start gap-4 p-6">
      <p className="text-lg font-medium">
        {t("welcome", { email: data.user.email ?? "" })}
      </p>
      <p className="text-muted-foreground">{t("empty")}</p>
      <p className="text-sm text-muted-foreground">{t("nextStep")}</p>
      <LogoutButton />
    </Card>
  );
}

export default async function AppPage({ params }: PageProps<"/[locale]/app">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app");
  const tCommon = await getTranslations("common");

  return (
    <>
      <SiteHeader showAuthLinks={false} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <h1 className="mb-6 text-3xl font-semibold tracking-tight">
          {t("title")}
        </h1>
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
