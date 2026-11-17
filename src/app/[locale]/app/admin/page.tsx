import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminPage } from "@/components/admin/admin-page";
import { AppShell } from "@/components/app-shell";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/admin">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("title"), robots: { index: false } };
}

export default async function Admin({ params }: PageProps<"/[locale]/app/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <AppShell locale={locale}>
      <AdminPage />
    </AppShell>
  );
}
