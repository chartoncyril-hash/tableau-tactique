import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { TeamsList } from "@/components/roster/teams-list";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/teams">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "roster" });
  return { title: t("title"), robots: { index: false } };
}

export default async function TeamsPage({ params }: PageProps<"/[locale]/app/teams">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <AppShell locale={locale}>
      <TeamsList />
    </AppShell>
  );
}
