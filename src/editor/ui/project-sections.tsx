"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { VersionMeta } from "@/lib/data/types";
import { videoEmbedUrl } from "@/lib/video";
import { fetchVersions, restoreVersion, setBoardMeta, useProject } from "../project-session";
import { Section } from "./controls";
import { DrillSection } from "./drill-section";

/** Notes, vidéo et versions du tableau affiché (projets enregistrés uniquement). */
export function ProjectSections() {
  const t = useTranslations("editor.project");
  const format = useFormatter();
  const board = useProject((s) => s.boards.find((b) => b.id === s.currentId));
  const [versions, setVersions] = useState<{ boardId: string; items: VersionMeta[] } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!board) return null;

  const embed = videoEmbedUrl(board.video_url);
  const shown = versions?.boardId === board.id ? versions.items : null;

  const toggleVersions = async () => {
    if (shown) {
      setVersions(null);
      return;
    }
    setBusy(true);
    try {
      setVersions({ boardId: board.id, items: await fetchVersions() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Section title={t("notes")}>
        <textarea
          aria-label={t("notes")}
          rows={5}
          maxLength={20000}
          placeholder={t("notesPlaceholder")}
          value={board.notes}
          className="rounded-md border border-input bg-card p-2 text-sm"
          onChange={(e) => setBoardMeta(board.id, { notes: e.target.value })}
        />
        <input
          type="url"
          inputMode="url"
          aria-label={t("video")}
          placeholder={t("videoPlaceholder")}
          maxLength={500}
          value={board.video_url ?? ""}
          className="h-9 rounded-md border border-input bg-card px-2 text-sm"
          onChange={(e) => setBoardMeta(board.id, { video_url: e.target.value || null })}
        />
        {embed ? (
          <iframe
            src={embed}
            title={t("video")}
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            className="aspect-video w-full rounded-md border"
          />
        ) : board.video_url ? (
          <p className="text-xs text-destructive">{t("videoInvalid")}</p>
        ) : null}
      </Section>

      <DrillSection />

      <Section title={t("versions")}>
        <Button variant="outline" size="sm" disabled={busy} onClick={toggleVersions}>
          {shown ? t("hideVersions") : t("showVersions")}
        </Button>
        {shown &&
          (shown.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("noVersions")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {shown.map((version) => (
                <li key={version.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{format.dateTime(new Date(version.created_at), { dateStyle: "medium", timeStyle: "short" })}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await restoreVersion(version.id);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {t("restore")}
                  </Button>
                </li>
              ))}
            </ul>
          ))}
        <p className="text-xs text-muted-foreground">{t("versionHint")}</p>
      </Section>
    </>
  );
}
