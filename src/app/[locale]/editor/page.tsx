import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EditorLoader } from "@/editor/editor-loader";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/editor">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "editor" });
  return { title: t("title") };
}

export default async function EditorPage({ params }: PageProps<"/[locale]/editor">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <EditorLoader />;
}
