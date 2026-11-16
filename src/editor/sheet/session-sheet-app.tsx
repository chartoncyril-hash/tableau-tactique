"use client";

import { ArrowDown, ArrowLeft, ArrowUp, Cloud, CloudOff, LoaderCircle, PencilRuler, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { BoardRow } from "@/lib/data/types";
import {
  DEFAULT_SHEET_COLOR,
  PROCEDES,
  type DrillSheet,
  type SessionSheet,
} from "@/lib/sheet";
import { cn } from "@/lib/utils";
import {
  addBoard,
  closeProject,
  moveBoard,
  openProject,
  removeBoard,
  renameBoard,
  renameProject,
  setBoardSheetField,
  setSessionField,
  useProject,
} from "../project-session";
import { squad, usedItems } from "../snapshot";
import { useEditor } from "../store";
import { ItemThumb } from "../ui/object-palette";
import { ExportShare } from "./export-share";
import { useDiagrams } from "./use-diagrams";

/**
 * Fiche de séance modifiable en place, présentée comme la fiche PDF : en-tête, légende puis un
 * bloc par exercice (un tableau du projet), avec ses schémas. Tout s'enregistre automatiquement.
 */

const MAX_CELLS = 4;

function mix(hex: string, ratio: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * ratio));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function Bar({ children, light, className }: { children: ReactNode; light?: boolean; className?: string }) {
  return (
    <div
      className={cn("px-2 py-1 text-center text-xs font-semibold text-white", className)}
      style={{ background: light ? "var(--sheet-light)" : "var(--sheet-main)" }}
    >
      {children}
    </div>
  );
}

const fieldClass =
  "w-full min-w-0 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground/60 placeholder:italic focus-visible:bg-accent/10";

/** Zone de texte qui grandit avec son contenu. */
function Area({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea rows={2} className={cn(fieldClass, "[field-sizing:content]", className)} {...props} />;
}

function Line({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(fieldClass, className)} {...props} />;
}

/** Ligne de principes : une case par idée, jusqu'à quatre. */
function PrincipleRow({ field, label }: { field: "withBall" | "withoutBall" | "transition"; label: string }) {
  const t = useTranslations("sheetPage");
  const value = useProject((s) => s.project?.sheet[field] ?? "");
  const parts = value.split("\n").slice(0, MAX_CELLS);
  const shown = parts.length < MAX_CELLS && parts[parts.length - 1] !== "" ? [...parts, ""] : parts;
  const set = (index: number, text: string) => {
    const next = [...shown];
    next[index] = text.replace(/\n/g, " ");
    while (next.length > 1 && next[next.length - 1] === "" && next[next.length - 2] === "") next.pop();
    setSessionField(field, next.join("\n").replace(/\n+$/, ""));
  };
  return (
    <div className="grid grid-cols-[minmax(7rem,9rem)_1fr] border-b last:border-b-0">
      <Bar className="flex items-center justify-center text-sm">{label}</Bar>
      <div className="grid auto-cols-fr grid-flow-col divide-x">
        {shown.map((part, i) => (
          <Line
            key={i}
            aria-label={`${label} ${i + 1}`}
            value={part}
            placeholder={i === 0 ? t("principlePlaceholder") : t("addCell")}
            maxLength={80}
            className="text-center text-xs"
            onChange={(e) => set(i, e.target.value)}
          />
        ))}
      </div>
    </div>
  );
}

function SheetHeader({ sheet, scenes }: { sheet: SessionSheet; scenes: BoardRow["scene"][] }) {
  const t = useTranslations("sheet");
  const tp = useTranslations("sheetPage");
  const items = useMemo(() => usedItems(scenes), [scenes]);
  const teams = useMemo(() => squad(scenes), [scenes]);
  const field = (key: keyof SessionSheet, extra?: string) => (
    <Line
      aria-label={t(`fields.${key}`)}
      value={sheet[key] ?? ""}
      maxLength={key === "theme" ? 200 : 60}
      placeholder={t(`placeholders.${key}`)}
      className={extra}
      onChange={(e) => setSessionField(key, e.target.value)}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-[10rem_1fr_9rem]">
        <div className="flex flex-col gap-3">
          <div className="border">
            <Bar>{t("pdf.date")}</Bar>
            {field("date", "text-center")}
          </div>
          <div className="grid grid-cols-2 border">
            <Bar className="flex items-center justify-center">{t("pdf.number")}</Bar>
            {field("number", "text-center text-lg font-semibold")}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[minmax(7rem,9rem)_1fr] border">
            <Bar className="flex items-center justify-center text-sm">{t("pdf.theme")}</Bar>
            <Area
              aria-label={t("fields.theme")}
              value={sheet.theme ?? ""}
              maxLength={200}
              placeholder={t("placeholders.theme")}
              className="text-center"
              onChange={(e) => setSessionField("theme", e.target.value)}
            />
          </div>
          <div className="border">
            <PrincipleRow field="withBall" label={t("pdf.withBall")} />
            <PrincipleRow field="withoutBall" label={t("pdf.withoutBall")} />
            <PrincipleRow field="transition" label={t("pdf.transition")} />
          </div>
        </div>
        <div className="flex flex-col border">
          <Bar>{t("pdf.category")}</Bar>
          <Area
            aria-label={t("fields.category")}
            value={sheet.category ?? ""}
            maxLength={60}
            placeholder={t("placeholders.category")}
            className="flex-1 text-center text-2xl font-bold"
            onChange={(e) => setSessionField("category", e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="border">
          <Bar>{t("pdf.equipment")}</Bar>
          <div className="flex min-h-12 flex-wrap items-center gap-1 p-1.5">
            {items.length === 0 ? (
              <span className="text-xs text-muted-foreground">{tp("noEquipment")}</span>
            ) : (
              items.map((item) => (
                <span key={item.id} className="flex size-9 items-center justify-center rounded bg-[#1f5f3c]">
                  <ItemThumb item={item} />
                </span>
              ))
            )}
          </div>
        </div>
        <div className="border">
          <Bar>{t("pdf.action")}</Bar>
          <div className="grid grid-cols-3 divide-x text-center text-[11px] text-muted-foreground">
            {(
              [
                ["run", "4 3"],
                ["pass", ""],
                ["dribble", "wave"],
              ] as const
            ).map(([key, dash]) => (
              <div key={key} className="flex flex-col items-center gap-1 p-1.5">
                <svg viewBox="0 0 60 10" className="h-3 w-full max-w-20" aria-hidden>
                  {dash === "wave" ? (
                    <path d="M2 5 q4 -5 8 0 t8 0 t8 0 t8 0 t8 0" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  ) : (
                    <line x1="2" y1="5" x2="50" y2="5" stroke="currentColor" strokeWidth="1.4" strokeDasharray={dash || undefined} />
                  )}
                  <path d="M50 1 L58 5 L50 9 Z" fill="currentColor" />
                </svg>
                {t(`pdf.${key}`)}
              </div>
            ))}
          </div>
        </div>
        <div className="border">
          <Bar>{t("pdf.squad")}</Bar>
          <div className="flex min-h-12 items-center justify-center gap-4 p-1.5">
            {teams.length === 0 ? (
              <span className="text-xs text-muted-foreground">{tp("noPlayers")}</span>
            ) : (
              teams.map((team) => (
                <span key={team.color} className="flex flex-col items-center text-xs" title={team.name}>
                  <span className="size-4 rounded-full border border-black/40" style={{ background: team.color }} />
                  {team.count}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{tp("legendHint")}</p>
    </div>
  );
}

function Diagrams({ board }: { board: BoardRow }) {
  const tp = useTranslations("sheetPage");
  const { images, aspect } = useDiagrams(board.scene, board.sheet.diagrams);
  if (board.scene.objects.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">{tp("emptyDiagram")}</p>;
  }
  if (!images) {
    return <div className="m-2 animate-pulse rounded bg-muted" style={{ aspectRatio: aspect }} aria-busy="true" />;
  }
  return (
    <div className={cn("grid gap-2 p-2", images.length > 1 && "sm:grid-cols-2")}>
      {images.map((src, i) => (
        <figure key={i} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- image générée dans le navigateur */}
          <img src={src} alt={tp("diagramAlt", { n: i + 1 })} className="w-full rounded" style={{ aspectRatio: aspect }} />
          {images.length > 1 && (
            <figcaption className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded bg-gray-900 px-2 text-xs font-semibold text-white">
              {i + 1}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

function Exercise({ board, index, count, projectId }: { board: BoardRow; index: number; count: number; projectId: string }) {
  const t = useTranslations("sheet");
  const tp = useTranslations("sheetPage");
  const [confirming, setConfirming] = useState(false);
  const d: DrillSheet = board.sheet;
  const set = <K extends keyof DrillSheet>(key: K, value: DrillSheet[K] | "") => setBoardSheetField(board.id, key, value);
  const text = (key: "objective" | "goal" | "instructions" | "variables" | "method" | "behaviours", className?: string) => (
    <Area
      aria-label={t(`fields.${key}`)}
      value={d[key] ?? ""}
      maxLength={2000}
      placeholder={t(`placeholders.${key}`)}
      className={cn("min-h-16 flex-1", className)}
      onChange={(e) => set(key, e.target.value)}
    />
  );
  const short = (key: "duration" | "players" | "space") => (
    <div className="flex flex-1 flex-col border-b last:border-b-0">
      <Bar>{t(`pdf.${key}`)}</Bar>
      <Line
        aria-label={t(`fields.${key}`)}
        value={d[key] ?? ""}
        maxLength={40}
        placeholder={t(`placeholders.${key}`)}
        className="my-auto text-center"
        onChange={(e) => set(key, e.target.value)}
      />
    </div>
  );

  return (
    <article aria-label={tp("exercise", { n: index + 1 })} className="border bg-card">
      <header className="flex flex-wrap items-center gap-1 p-1.5 text-white" style={{ background: "var(--sheet-main)" }}>
        <span className="pl-1 font-semibold">{index + 1}.</span>
        <input
          key={board.name}
          aria-label={tp("exerciseName")}
          defaultValue={board.name}
          maxLength={120}
          className="h-9 min-w-0 flex-1 rounded bg-transparent px-1.5 font-semibold outline-none hover:bg-white/10 focus:bg-white/15"
          onBlur={(e) => void renameBoard(board.id, e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
        <button type="button" aria-label={tp("moveUp")} title={tp("moveUp")} disabled={index === 0} onClick={() => void moveBoard(board.id, -1)} className="inline-flex size-9 items-center justify-center rounded hover:bg-white/15 disabled:opacity-40">
          <ArrowUp className="size-4" aria-hidden />
        </button>
        <button type="button" aria-label={tp("moveDown")} title={tp("moveDown")} disabled={index === count - 1} onClick={() => void moveBoard(board.id, 1)} className="inline-flex size-9 items-center justify-center rounded hover:bg-white/15 disabled:opacity-40">
          <ArrowDown className="size-4" aria-hidden />
        </button>
        {confirming ? (
          <button type="button" onClick={() => void removeBoard(board.id)} onBlur={() => setConfirming(false)} className="h-9 rounded bg-white px-2 text-sm font-medium text-destructive">
            {tp("confirmDelete")}
          </button>
        ) : (
          <button type="button" aria-label={tp("deleteExercise")} title={tp("deleteExercise")} disabled={count <= 1} onClick={() => setConfirming(true)} className="inline-flex size-9 items-center justify-center rounded hover:bg-white/15 disabled:opacity-40">
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
      </header>

      <div className="grid lg:grid-cols-[52fr_18fr_72fr_48fr] lg:divide-x">
        <div className="flex flex-col">
          <Bar light>{t("pdf.objective")}</Bar>
          {text("objective", "text-center")}
          <Bar light>{t("pdf.goal")}</Bar>
          {text("goal", "text-center")}
          <Bar light>{t("pdf.instructions")}</Bar>
          {text("instructions", "min-h-32")}
        </div>
        <div className="grid grid-cols-3 lg:flex lg:flex-col">{(["duration", "players", "space"] as const).map((k) => <div key={k} className="flex flex-col">{short(k)}</div>)}</div>
        <div className="flex flex-col">
          <div role="radiogroup" aria-label={t("fields.procede")} className="grid grid-cols-3 divide-x border-b">
            {PROCEDES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={d.procede === p}
                onClick={() => set("procede", d.procede === p ? "" : p)}
                className={cn("h-9 text-sm", d.procede === p ? "bg-[#4caf50] font-semibold text-white" : "hover:bg-muted")}
                style={d.procede === p ? undefined : { color: "var(--sheet-main)" }}
              >
                {t(`pdf.procedes.${p}`)}
              </button>
            ))}
          </div>
          <Diagrams board={board} />
          <div className="mt-auto flex flex-wrap items-center gap-2 border-t p-2">
            <Link
              href={{ pathname: "/app/project", query: { id: projectId, board: board.id } }}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <PencilRuler aria-hidden />
              {tp("editDiagram")}
            </Link>
            {!!board.scene.frames?.length && (
              <select
                aria-label={t("fields.diagrams")}
                value={d.diagrams ?? "steps"}
                onChange={(e) => set("diagrams", e.target.value === "board" ? "board" : "")}
                className="h-9 rounded-md border border-input bg-card px-2 text-sm"
              >
                <option value="steps">{t("diagrams.steps")}</option>
                <option value="board">{t("diagrams.board")}</option>
              </select>
            )}
          </div>
        </div>
        <div className="flex flex-col">
          <Bar>{t("pdf.pedagogy")}</Bar>
          <Bar light>{t("pdf.variables")}</Bar>
          {text("variables", "bg-[#c5dfb3]/60 text-center dark:bg-[#c5dfb3]/15")}
          <Bar light>{t("pdf.method")}</Bar>
          {text("method", "text-center")}
          <Bar light>{t("pdf.behaviours")}</Bar>
          {text("behaviours", "text-center")}
        </div>
      </div>
    </article>
  );
}

function SaveIndicator() {
  const t = useTranslations("editor.project");
  const state = useProject((s) => s.saveState);
  const Icon = state === "error" ? CloudOff : state === "saved" ? Cloud : LoaderCircle;
  return (
    <span role="status" data-testid="save-state" data-state={state} className={cn("flex shrink-0 items-center gap-1.5 text-xs", state === "error" ? "text-destructive" : "text-muted-foreground")}>
      <Icon className={cn("size-4", state === "saving" && "animate-spin")} aria-hidden />
      <span className="sr-only sm:not-sr-only">{t(`save.${state}`)}</span>
    </span>
  );
}

export default function SessionSheetApp({ projectId }: { projectId: string }) {
  const t = useTranslations("sheetPage");
  const te = useTranslations("editor.project");
  const status = useProject((s) => s.status);
  const project = useProject((s) => s.project);
  const boards = useProject((s) => s.boards);
  const currentId = useProject((s) => s.currentId);
  const liveScene = useEditor((s) => s.scene);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    void openProject(projectId);
    return closeProject;
  }, [projectId]);

  // Le tableau affiché par la session garde sa scène à jour dans l'éditeur.
  const shown = useMemo(
    () => boards.map((b) => (b.id === currentId ? { ...b, scene: liveScene } : b)),
    [boards, currentId, liveScene],
  );
  const scenes = useMemo(() => shown.map((b) => b.scene), [shown]);

  if (status === "missing" || status === "error") {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold">{te(status === "missing" ? "missingTitle" : "errorTitle")}</h1>
        <p className="max-w-sm text-muted-foreground">{te(status === "missing" ? "missingBody" : "errorBody")}</p>
        <Link href="/app" className={buttonVariants()}>
          {te("backToProjects")}
        </Link>
      </main>
    );
  }
  if (status !== "ready" || !project) {
    return <div className="h-dvh animate-pulse bg-muted" aria-busy="true" />;
  }

  const main = project.sheet.color || DEFAULT_SHEET_COLOR;
  const style = { "--sheet-main": main, "--sheet-light": mix(main, 0.45) } as CSSProperties;

  const add = async () => {
    setAdding(true);
    try {
      const used = new Set(boards.map((b) => b.name));
      let n = boards.length + 1;
      while (used.has(te("boardDefault", { n }))) n++;
      await addBoard(te("boardDefault", { n }));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="min-h-dvh bg-muted/40" style={style}>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-2">
        <Link
          href={{ pathname: "/app/project", query: { id: projectId } }}
          aria-label={t("backToEditor")}
          title={t("backToEditor")}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-muted"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <input
          key={project.name}
          aria-label={te("name")}
          defaultValue={project.name}
          maxLength={120}
          className="h-9 min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-2 font-medium hover:border-input focus:border-input"
          onBlur={(e) => void renameProject(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
        <SaveIndicator />
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <span className="sr-only md:not-sr-only text-muted-foreground">{t("color")}</span>
          <input
            type="color"
            aria-label={t("color")}
            value={main}
            onChange={(e) => setSessionField("color", e.target.value)}
            className="h-9 w-11 cursor-pointer rounded-md border border-input bg-card p-1"
          />
        </label>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-3 sm:p-5">
        <h1 className="sr-only">{t("title")}</h1>
        <ExportShare />
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-3 sm:p-4">
          <SheetHeader sheet={project.sheet} scenes={scenes} />
          <div className="grid gap-3 sm:grid-cols-2">
            {(["club", "coach"] as const).map((key) => (
              <label key={key} className="flex items-center gap-2 border text-sm">
                <Bar className="flex h-full w-28 shrink-0 items-center justify-center">{t(`fields.${key}`)}</Bar>
                <Line
                  aria-label={t(`fields.${key}`)}
                  value={project.sheet[key] ?? ""}
                  maxLength={60}
                  onChange={(e) => setSessionField(key, e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>
        {shown.map((board, i) => (
          <Exercise key={board.id} board={board} index={i} count={shown.length} projectId={projectId} />
        ))}
        <button
          type="button"
          disabled={adding}
          onClick={add}
          className="flex h-14 items-center justify-center gap-2 rounded-xl border-2 border-dashed text-muted-foreground hover:bg-card disabled:opacity-50"
        >
          <Plus className="size-5" aria-hidden />
          {t("addExercise")}
        </button>
        <p className="text-center text-xs text-muted-foreground">{t("footerHint")}</p>
      </main>
    </div>
  );
}
