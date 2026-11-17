"use client";

import { ImagePlus, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { clearBrandLogo, loadBrand, uploadBrandLogo, useBrand } from "@/lib/brand";

/** Logo du club : affiché dans le stade de la vue 3D (panneaux et tribunes). */
export function ClubLogoField({ clubId }: { clubId: string }) {
  const t = useTranslations("club");
  const brand = useBrand(clubId);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => loadBrand(clubId), [clubId]);

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setError(false);
    try {
      await job();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="text-muted-foreground">{t("logo")}</span>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex size-16 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {brand?.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- adresse signée temporaire
            <img src={brand.url} alt={t("logoAlt")} className="size-full object-contain" />
          ) : (
            <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="sr-only"
          aria-label={t("logo")}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void run(() => uploadBrandLogo(clubId, file));
          }}
        />
        <Button variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {t(brand?.path ? "logoChange" : "logoAdd")}
        </Button>
        {brand?.path && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(() => clearBrandLogo(clubId))}>
            {t("logoRemove")}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("logoHint")}</p>
      {error && (
        <p role="status" className="text-xs text-destructive">
          {t("logoError")}
        </p>
      )}
    </div>
  );
}
