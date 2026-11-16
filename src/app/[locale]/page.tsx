import {
  Clapperboard,
  ClipboardList,
  Hand,
  PencilRuler,
  RefreshCw,
  Share2,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PitchIllustration } from "@/components/pitch-illustration";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

const features = [
  { key: "editor", icon: PencilRuler },
  { key: "animation", icon: Clapperboard },
  { key: "sync", icon: RefreshCw },
  { key: "share", icon: Share2 },
  { key: "sessions", icon: ClipboardList },
  { key: "touch", icon: Hand },
] as const;

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-24">
          <div className="flex flex-col items-start gap-6">
            <span className="rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {t("badge")}
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              {t("title")}
            </h1>
            <p className="max-w-prose text-lg text-muted-foreground">
              {t("subtitle")}
            </p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link href="/signup" className={buttonVariants({ size: "lg" })}>
                {t("cta")}
              </Link>
              <Link
                href="/editor"
                className={buttonVariants({ size: "lg", variant: "outline" })}
              >
                {t("tryEditor")}
              </Link>
            </div>
          </div>
          <PitchIllustration label={t("pitchLabel")} />
        </section>

        <section className="border-t bg-muted/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-14">
            <h2 className="text-2xl font-semibold tracking-tight">
              {t("featuresTitle")}
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ key, icon: Icon }) => (
                <li key={key}>
                  <Card className="h-full p-5">
                    <Icon className="size-6 text-primary" aria-hidden />
                    <h3 className="mt-3 font-medium">
                      {t(`features.${key}.title`)}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t(`features.${key}.body`)}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm text-muted-foreground">
              {t("roadmapNote")}
            </p>
          </div>
        </section>
      </main>
      <footer className="border-t">
        <p className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-muted-foreground">
          {t("footer")}
        </p>
      </footer>
    </>
  );
}
