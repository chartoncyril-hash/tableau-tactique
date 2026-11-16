import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { ClubSettings } from "@/components/club/club-settings";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/club">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "club" });
  return { title: t("title"), robots: { index: false } };
}

export default async function ClubPage({ params }: PageProps<"/[locale]/app/club">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <AppShell locale={locale}>
      <ClubSettings />
    </AppShell>
  );
}
