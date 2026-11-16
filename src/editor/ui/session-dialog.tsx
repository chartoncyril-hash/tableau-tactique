"use client";

import { Check, Copy, FileDown, Link2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/dashboard/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { activeShare, createShare, revokeShare } from "@/lib/data/api";
import type { ShareRow } from "@/lib/data/types";
import { DEFAULT_SHEET_COLOR, PRINCIPLE_FIELDS, SESSION_FIELDS } from "@/lib/sheet";
import { exportSessionPdf } from "../export-pdf";
import { flush, sessionSnapshot, setSessionField, useProject } from "../project-session";
import { usePdfLabels } from "../use-pdf-labels";

/** En-tête de la fiche de séance, export PDF et lien public. */
export function SessionDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("sheet");
  const locale = useLocale();
  const labels = usePdfLabels();
  const project = useProject((s) => s.project);
  const [share, setShare] = useState<ShareRow | null | undefined>(undefined);
  const [busy, setBusy] = useState<"pdf" | "share" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    activeShare(project.id)
      .then((row) => !cancelled && setShare(row))
      .catch(() => !cancelled && setShare(null));
    return () => {
      cancelled = true;
    };
  }, [project]);

  if (!project) return null;
  const sheet = project.sheet;
  const url = share ? `${window.location.origin}/${locale}/s/${share.token}` : "";

  const downloadPdf = async () => {
    const source = sessionSnapshot();
    if (!source) return;
    setBusy("pdf");
    setError(null);
    try {
      // Avec un lien actif, la fiche porte son QR code vers les animations.
      await exportSessionPdf(source, labels, url || undefined);
    } catch {
      setError(t("pdfError"));
    } finally {
      setBusy(null);
    }
  };

  const toggleShare = async () => {
    setBusy("share");
    setError(null);
    try {
      if (share) {
        await revokeShare(share.id);
        setShare(null);
      } else {
        // Le lien montre ce qui est enregistré : on vide d'abord la file d'enregistrement.
        await flush();
        setShare(await createShare(project.id));
      }
    } catch {
      setError(t("shareError"));
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t("copyError"));
    }
  };

  return (
    <Dialog title={t("sessionTitle")} closeLabel={t("close")} onClose={onClose}>
      <div className="flex max-h-[70dvh] flex-col gap-5 overflow-y-auto pr-1">
        <section className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            {SESSION_FIELDS.map((key) => (
              <label key={key} className={`flex flex-col gap-1 text-sm ${key === "theme" ? "col-span-2" : ""}`}>
                <span className="text-muted-foreground">{t(`fields.${key}`)}</span>
                <Input
                  value={sheet[key] ?? ""}
                  maxLength={key === "theme" ? 200 : 60}
                  placeholder={t(`placeholders.${key}`)}
                  onChange={(e) => setSessionField(key, e.target.value)}
                />
              </label>
            ))}
          </div>
          {PRINCIPLE_FIELDS.map((key) => (
            <label key={key} className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">{t(`fields.${key}`)}</span>
              <textarea
                rows={2}
                maxLength={400}
                value={sheet[key] ?? ""}
                placeholder={t(`placeholders.${key}`)}
                className="rounded-md border border-input bg-card p-2 text-sm"
                onChange={(e) => setSessionField(key, e.target.value)}
              />
            </label>
          ))}
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{t("fields.color")}</span>
            <input
              type="color"
              value={sheet.color ?? DEFAULT_SHEET_COLOR}
              onChange={(e) => setSessionField("color", e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-md border border-input bg-card p-1"
            />
          </label>
          <p className="text-xs text-muted-foreground">{t("sessionHint")}</p>
        </section>

        <section className="flex flex-col gap-2 border-t pt-4">
          <Button onClick={downloadPdf} disabled={busy !== null}>
            <FileDown aria-hidden />
            {busy === "pdf" ? t("pdfBusy") : t("pdfButton")}
          </Button>
        </section>

        <section className="flex flex-col gap-2 border-t pt-4">
          <h3 className="text-sm font-medium">{t("shareTitle")}</h3>
          <p className="text-xs text-muted-foreground">{t("shareHint")}</p>
          {share && (
            <div className="flex gap-2">
              <Input readOnly aria-label={t("shareUrl")} value={url} onFocus={(e) => e.target.select()} />
              <Button variant="outline" size="icon" aria-label={t("copy")} title={t("copy")} onClick={copy}>
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              </Button>
            </div>
          )}
          <Button variant={share ? "outline" : "secondary"} disabled={busy !== null || share === undefined} onClick={toggleShare}>
            <Link2 aria-hidden />
            {share ? t("revoke") : t("createLink")}
          </Button>
        </section>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
