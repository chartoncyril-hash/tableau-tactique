"use client";

import { BookMarked, FolderPlus, Search } from "lucide-react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Dialog } from "@/components/dashboard/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { AGE_BANDS, catalogAsDrill, filterCatalog, sceneOf, type AgeBand, type CatalogDrill, type Lang } from "@/lib/catalog";
import { createProject, loadProject, updateBoard } from "@/lib/data/api";
import { DRILL_CATEGORIES, saveDrill } from "@/lib/data/drills-api";
import { DRILL_SHORT_FIELDS, DRILL_TEXT_FIELDS } from "@/lib/sheet";
import { cn } from "@/lib/utils";
import { canEditRole, roleIn, useWorkspace } from "@/lib/workspace";
import { DrillThumb } from "./drill-thumb";

const BoardPlayer = dynamic(() => import("@/components/share/board-player"), { ssr: false });

const chip = (on: boolean) =>
  cn("h-9 shrink-0 rounded-full border px-3 text-sm whitespace-nowrap", on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted");

/** Filtres du catalogue : tranche d'âge, type d'entraînement, recherche. */
export function CatalogFilters({
  band,
  category,
  q,
  onBand,
  onCategory,
  onQ,
  compact = false,
}: {
  band: AgeBand | "";
  category: string;
  q: string;
  onBand: (b: AgeBand | "") => void;
  onCategory: (c: string) => void;
  onQ: (q: string) => void;
  compact?: boolean;
}) {
  const t = useTranslations("library");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className={cn("relative flex-1", !compact && "sm:max-w-sm")}>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" aria-label={t("search")} placeholder={t("search")} value={q} onChange={(e) => onQ(e.target.value)} className="pl-9" />
        </label>
        <div role="radiogroup" aria-label={t("catalog.band")} className="flex gap-1 overflow-x-auto pb-1">
          {(["", ...AGE_BANDS] as const).map((b) => (
            <button key={b || "all"} type="button" role="radio" aria-checked={band === b} onClick={() => onBand(b)} className={chip(band === b)}>
              {b ? t(`catalog.bands.${b}`) : t("catalog.allAges")}
            </button>
          ))}
        </div>
      </div>
      <div role="radiogroup" aria-label={t("category")} className="flex gap-1 overflow-x-auto pb-1">
        {["", ...DRILL_CATEGORIES].map((c) => (
          <button key={c || "all"} type="button" role="radio" aria-checked={category === c} onClick={() => onCategory(c)} className={chip(category === c)}>
            {c ? t(`categories.${c}`) : t("all")}
          </button>
        ))}
      </div>
    </div>
  );
}

export function useCatalog() {
  const lang = (useLocale() === "en" ? "en" : "fr") as Lang;
  const [band, setBand] = useState<AgeBand | "">("");
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const drills = useMemo(() => filterCatalog({ band, category, q, lang }), [band, category, q, lang]);
  return { lang, drills, filters: { band, category, q, onBand: setBand, onCategory: setCategory, onQ: setQ } };
}

export function CatalogCard({ drill, lang, onClick, label }: { drill: CatalogDrill; lang: Lang; onClick: () => void; label?: string }) {
  const t = useTranslations("library");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex w-full flex-col gap-2 rounded-xl border bg-card p-2 text-left transition-shadow hover:shadow-md"
    >
      <DrillThumb scene={sceneOf(drill)} title={drill.title[lang]} />
      <span className="line-clamp-2 px-1 font-medium">{drill.title[lang]}</span>
      <span className="flex flex-wrap gap-1 px-1 pb-1">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{t(`catalog.bands.${drill.band}`)}</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{t(`categories.${drill.category}`)}</span>
      </span>
    </button>
  );
}

/** Exercices prêts à l'emploi : parcourir, prévisualiser, créer un projet ou copier dans sa bibliothèque. */
export function CatalogSection() {
  const t = useTranslations("library");
  const router = useRouter();
  const clubId = useWorkspace((s) => s.clubId);
  const canEdit = useWorkspace((s) => canEditRole(roleIn(s.clubId, s.clubs)));
  const { lang, drills, filters } = useCatalog();
  const [preview, setPreview] = useState<CatalogDrill | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const target = canEdit ? clubId : null;

  const startProject = async (drill: CatalogDrill) => {
    setBusy(true);
    try {
      const d = catalogAsDrill(drill, lang);
      const id = await createProject(d.title, d.title.slice(0, 80), d.scene, null, target);
      const board = (await loadProject(id))?.boards[0];
      if (board) await updateBoard(board.id, { sheet: d.sheet, notes: d.notes });
      router.push(`/app/project?id=${id}`);
    } catch {
      setNotice({ kind: "error", text: t("error") });
      setBusy(false);
    }
  };

  const copy = async (drill: CatalogDrill) => {
    setBusy(true);
    try {
      const d = catalogAsDrill(drill, lang);
      await saveDrill({ title: d.title, category: d.category, tags: d.tags, scene: d.scene, sheet: d.sheet, notes: d.notes, clubId: target });
      setNotice({ kind: "ok", text: t("catalog.copied", { title: d.title }) });
      setPreview(null);
    } catch {
      setNotice({ kind: "error", text: t("error") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("catalog.intro")}</p>
      <CatalogFilters {...filters} />
      {notice && (
        <p role={notice.kind === "error" ? "alert" : "status"} className={cn("text-sm", notice.kind === "error" ? "text-destructive" : "text-primary")}>
          {notice.text}
        </p>
      )}
      {drills.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noResult")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4" data-testid="catalog-grid" data-count={drills.length}>
          {drills.map((drill) => (
            <li key={drill.id}>
              <CatalogCard drill={drill} lang={lang} onClick={() => setPreview(drill)} />
            </li>
          ))}
        </ul>
      )}
      {preview && (
        <Dialog title={preview.title[lang]} closeLabel={t("close")} onClose={() => setPreview(null)}>
          <div className="flex max-h-[75dvh] flex-col gap-4 overflow-y-auto">
            <BoardPlayer scene={sceneOf(preview)} />
            <p className="text-xs text-muted-foreground">
              {t(`catalog.bands.${preview.band}`)} · {t(`categories.${preview.category}`)} · {preview.source[lang]}
            </p>
            <dl className="grid gap-2 text-sm">
              {[...DRILL_SHORT_FIELDS, ...DRILL_TEXT_FIELDS]
                .filter((f) => preview.sheet[f])
                .map((f) => (
                  <div key={f}>
                    <dt className="text-xs text-muted-foreground">{t(`fields.${f}`)}</dt>
                    <dd className="whitespace-pre-wrap">{preview.sheet[f]![lang]}</dd>
                  </div>
                ))}
            </dl>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={busy} onClick={() => void copy(preview)}>
                <BookMarked aria-hidden />
                {t(target ? "catalog.copyClub" : "catalog.copy")}
              </Button>
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
