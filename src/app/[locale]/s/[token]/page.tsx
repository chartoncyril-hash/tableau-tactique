import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { SharedSession } from "@/components/share/shared-session";
import { SiteHeader } from "@/components/site-header";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/s/[token]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shared" });
  // Une séance partagée n'a pas vocation à être indexée ni à fuiter par l'en-tête Referer.
  return { title: t("title"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

async function Shared({ params }: Pick<PageProps<"/[locale]/s/[token]">, "params">) {
  // Le jeton n'est connu qu'à la requête : tout le contenu est rendu dans le Suspense.
  const { locale, token } = await params;
  setRequestLocale(locale);
  return (
    <>
      <SiteHeader showAuthLinks={false} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <SharedSession token={token} />
      </main>
    </>
  );
}

export default function SharedPage({ params }: PageProps<"/[locale]/s/[token]">) {
  return (
    <Suspense fallback={null}>
      <Shared params={params} />
    </Suspense>
  );
}
