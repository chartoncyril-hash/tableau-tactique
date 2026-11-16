import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { SessionSheetLoader } from "@/editor/editor-loader";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/app/project/sheet">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sheetPage" });
  return { title: t("title"), robots: { index: false } };
}

export default async function SessionSheetPage({ params }: PageProps<"/[locale]/app/project/sheet">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="h-dvh animate-pulse bg-muted" aria-busy="true" />}>
      <SessionSheetLoader />
    </Suspense>
  );
}
