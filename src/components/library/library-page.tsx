"use client";

import { FolderPlus, Search, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/dashboard/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { migrateScene } from "@/editor/scene/defaults";
import { useRouter } from "@/i18n/navigation";
import { createProject, loadProject, updateBoard } from "@/lib/data/api";
import { DRILL_CATEGORIES, listDrills, trashDrill, type DrillRow } from "@/lib/data/drills-api";
import { DRILL_SHORT_FIELDS, DRILL_TEXT_FIELDS } from "@/lib/sheet";
import { cn } from "@/lib/utils";
import { canEditRole, roleIn, useWorkspace } from "@/lib/workspace";
import { DrillThumb } from "./drill-thumb";

const BoardPlayer = dynamic(() => import("@/components/share/board-player"), { ssr: false });

/** Bibliothèque d'exercices de l'espace courant : recherche, catégories, aperçu, réutilisation. */
export function LibraryPage() {
  const t = useTranslations("library");
  const router = useRouter();
  const clubId = useWorkspace((s) => s.clubId);
  const loaded = useWorkspace((s) => s.loaded);
  const canEdit = useWorkspace((s) => canEditRole(roleIn(s.clubId, s.clubs)));
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [state, setState] = useState<{ key: string; drills: DrillRow[] } | null>(null);
  const [error, setError] = useState(false);
  const [preview, setPreview] = useState<DrillRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const key = JSON.stringify([clubId, category, q, reload]);
  const drills = state?.key === key ? state.drills : null;

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      listDrills(clubId, { category, q })
        .then((rows) => !cancelled && setState({ key, drills: rows }))
        .catch(() => !cancelled && setError(true));
    }, q ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, clubId, category, q, loaded]);

  /** Nouveau projet à partir de l'exercice : son tableau, ses consignes et ses notes. */
  const startProject = async (drill: DrillRow) => {
    setBusy(true);
    try {
      const scene = migrateScene(drill.scene) ?? drill.scene;
      const id = await createProject(drill.title, drill.title.slice(0, 80), scene, null, canEdit ? clubId : null);
      const data = await loadProject(id);
      const board = data?.boards[0];
      if (board) await updateBoard(board.id, { sheet: drill.sheet, notes: drill.notes });
      router.push(`/app/project?id=${id}`);
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  const remove = async (drill: DrillRow) => {
    setBusy(true);
    try {
      await trashDrill(drill.id);
      setPreview(null);
      setReload((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("pageTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(clubId ? "pageIntroClub" : "pageIntro")}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" aria-label={t("search")} placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </label>
        <div role="radiogroup" aria-label={t("category")} className="flex gap-1 overflow-x-auto pb-1">
          {["", ...DRILL_CATEGORIES].map((c) => (
            <button
              key={c || "all"}
              type="button"
              role="radio"
              aria-checked={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3 text-sm whitespace-nowrap",
                category === c ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {c ? t(`categories.${c}`) : t("all")}
            </button>
          ))}
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{t("error")}</p>}
      {drills === null ? (
        <p className="text-muted-foreground" aria-busy="true">{t("loading")}</p>
      ) : drills.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">{t(q || category ? "noResult" : "emptyPage")}</Card>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4" data-testid="drill-grid">
          {drills.map((drill) => (
            <li key={drill.id}>
              <button
                type="button"
                onClick={() => setPreview(drill)}
                className="flex w-full flex-col gap-2 rounded-xl border bg-card p-2 text-left transition-shadow hover:shadow-md"
              >
                <DrillThumb scene={drill.scene} title={drill.title} />
                <span className="truncate px-1 font-medium">{drill.title}</span>
                <span className="flex flex-wrap gap-1 px-1 pb-1">
                  {drill.category && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{t(`categories.${drill.category}`)}</span>
                  )}
                  {drill.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {preview && (
        <Dialog title={preview.title} closeLabel={t("close")} onClose={() => setPreview(null)}>
          <div className="flex max-h-[75dvh] flex-col gap-4 overflow-y-auto">
            <BoardPlayer scene={migrateScene(preview.scene) ?? preview.scene} />
            <dl className="grid gap-2 text-sm">
              {[...DRILL_SHORT_FIELDS, ...DRILL_TEXT_FIELDS]
                .filter((f) => preview.sheet[f])
                .map((f) => (
                  <div key={f}>
                    <dt className="text-xs text-muted-foreground">{t(`fields.${f}`)}</dt>
                    <dd className="whitespace-pre-wrap">{preview.sheet[f]}</dd>
                  </div>
                ))}
              {preview.notes && (
                <div>
                  <dt className="text-xs text-muted-foreground">{t("notes")}</dt>
                  <dd className="whitespace-pre-wrap">{preview.notes}</dd>
                </div>
              )}
            </dl>
            <div className="flex flex-wrap justify-end gap-2">
              {canEdit && (
                <Button variant="ghost" className="text-destructive" disabled={busy} onClick={() => void remove(preview)}>
                  <Trash2 aria-hidden />
                  {t("delete")}
                </Button>
              )}
              <Button disabled={busy} onClick={() => void startProject(preview)}>
                <FolderPlus aria-hidden />
                {t(canEdit ? "newProject" : "newProjectMine")}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
