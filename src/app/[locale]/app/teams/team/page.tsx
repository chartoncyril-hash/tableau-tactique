import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { TeamDetailLoader } from "@/components/roster/team-detail";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/teams/team">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "roster" });
  return { title: t("title"), robots: { index: false } };
}

export default async function TeamPage({ params }: PageProps<"/[locale]/app/teams/team">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <AppShell locale={locale}>
      <TeamDetailLoader />
    </AppShell>
  );
}
