import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { AppNav } from "@/components/app-nav";
import { LogoutButton } from "@/components/logout-button";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

async function Workspace({ locale, children }: { locale: string; children: ReactNode }) {
  // Rendu à la requête : la session dépend des cookies et de l'heure courante.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return redirect({ href: "/login", locale });

  return (
    <>
      {children}
      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-sm text-muted-foreground">
        <span>{data.user.email}</span>
        <LogoutButton />
      </footer>
    </>
  );
}

/** Cadre commun des pages de l'espace connecté : en-tête, onglets, vérification de session. */
export async function AppShell({ locale, children }: { locale: string; children: ReactNode }) {
  const tCommon = await getTranslations("common");
  return (
    <>
      <SiteHeader showAuthLinks={false} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <AppNav />
        <Suspense fallback={<Card className="p-6 text-muted-foreground">{tCommon("loading")}</Card>}>
          <Workspace locale={locale}>{children}</Workspace>
        </Suspense>
      </main>
    </>
  );
}
