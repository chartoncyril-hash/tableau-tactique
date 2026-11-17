"use client";

import { BookMarked, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { Dialog } from "@/components/dashboard/dialog";
import { DrillThumb } from "@/components/library/drill-thumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DRILL_CATEGORIES, listDrills, parseTags, saveDrill, type DrillRow } from "@/lib/data/drills-api";
import { CatalogCard, CatalogFilters, useCatalog } from "@/components/library/catalog-section";
import { catalogAsDrill, type CatalogDrill } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { addBoardFromDrill, useProject } from "../project-session";
import { useEditor } from "../store";
import { IconButton } from "./controls";

const field = "h-11 rounded-md border border-input bg-card px-3 text-sm md:h-9";

function SaveForm({ onDone }: { onDone: (title: string) => void }) {
  const t = useTranslations("library");
  const board = useProject((s) => s.boards.find((b) => b.id === s.currentId));
  const clubId = useProject((s) => s.project?.club_id ?? null);
  const [title, setTitle] = useState(board?.name ?? "");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = title.trim().slice(0, 120);
    if (!text || !board) return;
    setBusy(true);
    setError(false);
    try {
      await saveDrill({
        title: text,
        category,
        tags: parseTags(tags),
        scene: useEditor.getState().scene,
        sheet: board.sheet,
        notes: board.notes,
        clubId,
      });
      onDone(text);
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t(clubId ? "saveHelpClub" : "saveHelp")}</p>
      <label className="flex flex-col gap-1 text-sm">
        <span>{t("titleField")}</span>
        <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>{t("category")}</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
          <option value="">{t("noCategory")}</option>
          {DRILL_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>{t("tags")}</span>
        <Input value={tags} placeholder={t("tagsPlaceholder")} onChange={(e) => setTags(e.target.value)} />
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{t("error")}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={busy || !title.trim()}>
          <BookMarked aria-hidden />
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

/** Exercices prêts à l'emploi à insérer comme nouveau tableau du projet. */
function CatalogInsert({ onDone }: { onDone: (title: string) => void }) {
  const t = useTranslations("library");
  const { lang, drills, filters } = useCatalog();
  const [busy, setBusy] = useState(false);
  const insert = async (drill: CatalogDrill) => {
    setBusy(true);
    try {
      const d = catalogAsDrill(drill, lang);
      await addBoardFromDrill(d);
      onDone(d.title);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <CatalogFilters {...filters} compact />
      <ul className={cn("grid max-h-[45dvh] grid-cols-2 gap-2 overflow-y-auto", busy && "pointer-events-none opacity-60")} data-testid="catalog-picker">
        {drills.map((drill) => (
          <li key={drill.id}>
            <CatalogCard drill={drill} lang={lang} label={t("insertDrill", { title: drill.title[lang] })} onClick={() => void insert(drill)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function InsertSource({ onDone }: { onDone: (title: string) => void }) {
  const t = useTranslations("library");
  const [source, setSource] = useState<"catalog" | "mine">("catalog");
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label={t("catalog.source")} className="flex gap-1">
        {(["catalog", "mine"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={source === key}
            onClick={() => setSource(key)}
            className={cn("h-8 rounded-full border px-3 text-sm", source === key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
          >
            {t(key === "catalog" ? "catalog.short" : "catalog.mineShort")}
          </button>
        ))}
      </div>
      {source === "catalog" ? <CatalogInsert onDone={onDone} /> : <InsertList onDone={onDone} />}
    </div>
  );
}

function InsertList({ onDone }: { onDone: (title: string) => void }) {
  const t = useTranslations("library");
  const clubId = useProject((s) => s.project?.club_id ?? null);
  const [drills, setDrills] = useState<DrillRow[] | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      listDrills(clubId, { q })
        .then((rows) => !cancelled && setDrills(rows))
        .catch(() => !cancelled && setDrills([]));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [clubId, q]);

  const insert = async (drill: DrillRow) => {
    setBusy(drill.id);
    try {
      await addBoardFromDrill(drill);
      onDone(drill.title);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Input type="search" aria-label={t("search")} placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
      {drills === null ? (
        <p className="text-sm text-muted-foreground" aria-busy="true">{t("loading")}</p>
      ) : drills.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(q ? "noResult" : "empty")}</p>
      ) : (
        <ul className="grid max-h-[50dvh] grid-cols-2 gap-2 overflow-y-auto" data-testid="drill-picker">
          {drills.map((drill) => (
            <li key={drill.id}>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void insert(drill)}
                aria-label={t("insertDrill", { title: drill.title })}
                className="flex w-full flex-col gap-1 rounded-lg border p-1.5 text-left hover:bg-muted disabled:opacity-50"
              >
                <DrillThumb scene={drill.scene} title={drill.title} />
                <span className="truncate text-sm font-medium">{drill.title}</span>
                {drill.category && <span className="truncate text-xs text-muted-foreground">{t(`categories.${drill.category}`)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Bouton « Bibliothèque » de l'éditeur : enregistrer le tableau affiché, ou insérer un exercice. */
export function LibraryButton() {
  const t = useTranslations("library");
  const readOnly = useEditor((s) => s.readOnly);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"save" | "insert">("insert");
  const [done, setDone] = useState<string | null>(null);
  if (readOnly) return null;
  return (
    <>
      <IconButton
        icon={BookMarked}
        label={t("open")}
        className="hidden sm:inline-flex"
        onClick={() => {
          setDone(null);
          setTab("insert");
          setOpen(true);
        }}
      />
      {open && (
        <Dialog title={t("dialogTitle")} closeLabel={t("close")} onClose={() => setOpen(false)}>
          <div role="tablist" aria-label={t("dialogTitle")} className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(["insert", "save"] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => {
                  setTab(key);
                  setDone(null);
                }}
                className={cn("flex h-9 items-center justify-center gap-1.5 rounded-md text-sm", tab === key ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}
              >
                {key === "insert" ? <Plus className="size-4" aria-hidden /> : <BookMarked className="size-4" aria-hidden />}
                {t(key === "insert" ? "tabInsert" : "tabSave")}
              </button>
            ))}
          </div>
          {done ? (
            <div className="flex flex-col gap-3">
              <p role="status" className="text-sm">
                {t(tab === "save" ? "saved" : "inserted", { title: done })}
              </p>
              <div className="flex justify-end">
                <Button onClick={() => setOpen(false)}>{t("close")}</Button>
              </div>
            </div>
          ) : tab === "save" ? (
            <SaveForm onDone={setDone} />
          ) : (
            <InsertSource
              onDone={(title) => {
                setDone(title);
                setOpen(false);
              }}
            />
          )}
        </Dialog>
      )}
    </>
  );
}
