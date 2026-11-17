import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { LibraryPage } from "@/components/library/library-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/library">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "library" });
  return { title: t("pageTitle"), robots: { index: false } };
}

export default async function Library({ params }: PageProps<"/[locale]/app/library">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <AppShell locale={locale}>
      <LibraryPage />
    </AppShell>
  );
}
