import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { InviteLanding } from "@/components/club/invite-landing";
import { SiteHeader } from "@/components/site-header";

export async function generateMetadata({ params }: PageProps<"/[locale]/invite/[token]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "invite" });
  // Lien personnel : jamais indexé, jamais transmis par l'en-tête Referer.
  return { title: t("title"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

async function Invite({ params }: Pick<PageProps<"/[locale]/invite/[token]">, "params">) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  return (
    <>
      <SiteHeader showAuthLinks={false} />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-10">
        <InviteLanding token={token} />
      </main>
    </>
  );
}

export default function InvitePage({ params }: PageProps<"/[locale]/invite/[token]">) {
  return (
    <Suspense fallback={null}>
      <Invite params={params} />
    </Suspense>
  );
}
