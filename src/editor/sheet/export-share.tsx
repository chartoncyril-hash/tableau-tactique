"use client";

import { Check, Copy, FileDown, Link2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { activeShare, createShare, revokeShare } from "@/lib/data/api";
import type { ShareRow } from "@/lib/data/types";
import { exportSessionPdf } from "../export-pdf";
import { flush, sessionSnapshot, useProject } from "../project-session";
import { useEditor } from "../store";
import { usePdfLabels } from "../use-pdf-labels";

/** Téléchargement du PDF et lien public en lecture seule. */
export function ExportShare() {
  const t = useTranslations("sheet");
  const locale = useLocale();
  const labels = usePdfLabels();
  const projectId = useProject((s) => s.project?.id);
  // Les liens publics sont gérés par ceux qui peuvent modifier le projet.
  const readOnly = useEditor((s) => s.readOnly);
  const [share, setShare] = useState<ShareRow | null | undefined>(undefined);
  const [busy, setBusy] = useState<"pdf" | "share" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    activeShare(projectId)
      .then((row) => !cancelled && setShare(row))
      .catch(() => !cancelled && setShare(null));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!projectId) return null;
  const url = share ? `${window.location.origin}/${locale}/s/${share.token}` : "";

  const downloadPdf = async () => {
    const source = sessionSnapshot();
    if (!source) return;
    setBusy("pdf");
    // Le PDF part du navigateur, mais on enregistre au passage ce qui est en attente.
    void flush();
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
        setShare(await createShare(projectId));
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
    <section aria-label={t("shareTitle")} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={downloadPdf} disabled={busy !== null}>
          <FileDown aria-hidden />
          {busy === "pdf" ? t("pdfBusy") : t("pdfButton")}
        </Button>
        {!readOnly && (
          <Button
            variant={share ? "outline" : "secondary"}
            disabled={busy !== null || share === undefined}
            onClick={toggleShare}
          >
            <Link2 aria-hidden />
            {share ? t("revoke") : t("createLink")}
          </Button>
        )}
      </div>
      {share && !readOnly && (
        <div className="flex gap-2">
          <Input readOnly aria-label={t("shareUrl")} value={url} onFocus={(e) => e.target.select()} />
          <Button variant="outline" size="icon" aria-label={t("copy")} title={t("copy")} onClick={copy}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          </Button>
        </div>
      )}
      {!readOnly && <p className="text-xs text-muted-foreground">{t("shareHint")}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
