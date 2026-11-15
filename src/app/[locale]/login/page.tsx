import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("loginTitle") };
}

async function LoginForm({
  searchParams,
}: Pick<PageProps<"/[locale]/login">, "searchParams">) {
  const { error } = await searchParams;
  return <AuthForm mode="login" initialError={error === "callback"} />;
}

export default async function LoginPage({
  params,
  searchParams,
}: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <AuthShell title={t("loginTitle")} subtitle={t("loginSubtitle")}>
      <Suspense fallback={<AuthForm mode="login" />}>
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
