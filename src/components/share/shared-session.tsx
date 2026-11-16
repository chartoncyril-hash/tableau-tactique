"use client";

import { FileDown } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { exportSessionPdf } from "@/editor/export-pdf";
import { createScene, migrateScene } from "@/editor/scene/defaults";
import { usePdfLabels } from "@/editor/use-pdf-labels";
import { loadSharedProject } from "@/lib/data/api";
import type { SharedProject } from "@/lib/data/types";
import { cells, DEFAULT_SHEET_COLOR, readDrillSheet, readSessionSheet } from "@/lib/sheet";
import { videoEmbedUrl } from "@/lib/video";

const BoardPlayer = dynamic(() => import("./board-player"), {
  ssr: false,
  loading: () => <div className="aspect-[3/2] w-full animate-pulse rounded-lg bg-muted" aria-busy="true" />,
});

function Info({ label, children }: { label: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm whitespace-pre-line">{children}</dd>
    </div>
  );
}

/** Page publique d'une séance partagée : fiche lisible, animations et PDF. */
export function SharedSession({ token }: { token: string }) {
  const t = useTranslations("shared");
  const ts = useTranslations("sheet");
  const labels = usePdfLabels();
  const [data, setData] = useState<SharedProject | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSharedProject(token)
      .then((result) => {
        if (cancelled || !result) return setData(result ?? null);
        setData({
          ...result,
          sheet: readSessionSheet(result.sheet),
          boards: result.boards.map((b) => ({
            ...b,
            sheet: readDrillSheet(b.sheet),
            scene: migrateScene(b.scene) ?? createScene(),
          })),
        });
      })
      .catch(() => !cancelled && setData(null));
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (data === undefined) {
    return (
      <p className="py-20 text-center text-muted-foreground" aria-busy="true">
        {t("loading")}
      </p>
    );
  }
  if (data === null) {
    return (
      <Card className="mx-auto my-16 max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">{t("missingTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("missingBody")}</p>
      </Card>
    );
  }

  const s = data.sheet;
  const color = s.color || DEFAULT_SHEET_COLOR;
  const principles = (["withBall", "withoutBall", "transition"] as const).filter((k) => s[k]);

  const download = async () => {
    setBusy(true);
    setError(false);
    try {
      await exportSessionPdf(data, labels, window.location.href.split("#")[0]);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="overflow-hidden rounded-xl border">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-white" style={{ background: color }}>
          <div>
            <p className="text-sm opacity-90">{[s.club, s.date, s.number && `${ts("fields.number")} ${s.number}`].filter(Boolean).join(" · ")}</p>
            <h1 className="text-2xl font-semibold tracking-tight">{s.theme || data.name}</h1>
          </div>
          {s.category && <span className="rounded-lg bg-white/15 px-3 py-1 text-2xl font-bold">{s.category}</span>}
        </div>
        {(principles.length > 0 || s.coach) && (
          <dl className="grid gap-3 bg-card p-4 sm:grid-cols-3">
            {principles.map((k) => (
              <Info key={k} label={ts(`fields.${k}`)}>
                {cells(s[k]).join(" · ")}
              </Info>
            ))}
            <Info label={ts("fields.coach")}>{s.coach}</Info>
          </dl>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={download} disabled={busy}>
          <FileDown aria-hidden />
          {busy ? ts("pdfBusy") : ts("pdfButton")}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {ts("pdfError")}
          </p>
        )}
      </div>

      {data.boards.map((board, i) => {
        const d = board.sheet;
        const embed = videoEmbedUrl(board.video_url);
        return (
          <section key={board.id} aria-labelledby={`drill-${board.id}`} className="flex flex-col gap-4 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`drill-${board.id}`} className="text-lg font-semibold">
                {i + 1}. {board.name}
              </h2>
              {d.procede && (
                <span className="rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                  {ts(`pdf.procedes.${d.procede}`)}
                </span>
              )}
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <BoardPlayer scene={board.scene} />
              <dl className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <Info label={ts("fields.duration")}>{d.duration}</Info>
                  <Info label={ts("fields.players")}>{d.players}</Info>
                  <Info label={ts("fields.space")}>{d.space}</Info>
                </div>
                <Info label={ts("fields.objective")}>{d.objective}</Info>
                <Info label={ts("fields.goal")}>{d.goal}</Info>
                <Info label={ts("fields.instructions")}>{d.instructions || board.notes}</Info>
                <Info label={ts("fields.variables")}>{d.variables}</Info>
                <Info label={ts("fields.method")}>{d.method}</Info>
                <Info label={ts("fields.behaviours")}>{d.behaviours}</Info>
              </dl>
            </div>
            {embed && (
              <iframe
                src={embed}
                title={board.name}
                loading="lazy"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                referrerPolicy="strict-origin-when-cross-origin"
                className="aspect-video w-full max-w-2xl rounded-md border"
              />
            )}
          </section>
        );
      })}
      <p className="text-center text-xs text-muted-foreground">{t("readOnly")}</p>
    </div>
  );
}
