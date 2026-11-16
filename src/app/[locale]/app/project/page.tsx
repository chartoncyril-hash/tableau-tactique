import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { ProjectEditorLoader } from "@/editor/editor-loader";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/app/project">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "editor" });
  return { title: t("title"), robots: { index: false } };
}

export default async function ProjectPage({ params }: PageProps<"/[locale]/app/project">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="h-dvh animate-pulse bg-muted" aria-busy="true" />}>
      <ProjectEditorLoader />
    </Suspense>
  );
}
