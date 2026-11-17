"use client";

import { ChevronLeft, ChevronRight, Eraser, NotebookText, Pencil, Presentation, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { DRILL_SHORT_FIELDS, DRILL_TEXT_FIELDS } from "@/lib/sheet";
import { cn } from "@/lib/utils";
import { sessionSnapshot, useProject } from "../project-session";
import { viewRect } from "../pitches";
import { IconButton } from "../ui/controls";

const BoardPlayer = dynamic(() => import("@/components/share/board-player"), { ssr: false });

const PAD = 2;
const INKS = ["#facc15", "#ef4444", "#ffffff", "#22d3ee"];

type Stroke = { color: string; points: number[] };

/**
 * Calque de dessin à main levée, posé sur le tableau. Les traits sont gardés en coordonnées
 * relatives (0 à 1) pour suivre un changement de taille ; rien n'est enregistré.
 */
function InkLayer({ active, color, strokes, onChange }: { active: boolean; color: string; strokes: Stroke[]; onChange: (s: Stroke[]) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<Stroke | null>(null);

  const paint = useCallback(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const { width, height } = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const g = canvas.getContext("2d")!;
    g.scale(ratio, ratio);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.lineWidth = Math.max(3, width / 220);
    for (const stroke of [...strokes, ...(drawing.current ? [drawing.current] : [])]) {
      g.strokeStyle = stroke.color;
      g.beginPath();
      for (let i = 0; i < stroke.points.length; i += 2) {
        const x = stroke.points[i] * width;
        const y = stroke.points[i + 1] * height;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  }, [strokes]);

  useEffect(() => {
    paint();
    const canvas = ref.current;
    if (!canvas) return;
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paint]);

  const at = (e: ReactPointerEvent) => {
    const box = ref.current!.getBoundingClientRect();
    return [(e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height];
  };

  return (
    <canvas
      ref={ref}
      data-testid="ink"
      data-strokes={strokes.length}
      className={cn("absolute inset-0 h-full w-full touch-none", active ? "cursor-crosshair" : "pointer-events-none")}
      onPointerDown={(e) => {
        if (!active) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = { color, points: at(e) };
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return;
        drawing.current.points.push(...at(e));
        paint();
      }}
      onPointerUp={() => {
        if (!drawing.current) return;
        const stroke = drawing.current;
        drawing.current = null;
        if (stroke.points.length >= 4) onChange([...strokes, stroke]);
        else paint();
      }}
    />
  );
}

/** Mode présentation plein écran : un tableau à la fois, en grand, pour une causerie. */
function Presenter({ onClose }: { onClose: () => void }) {
  const t = useTranslations("present");
  const tSheet = useTranslations("sheet");
  const [snapshot] = useState(() => sessionSnapshot());
  const boards = snapshot?.boards ?? [];
  const [index, setIndex] = useState(() => {
    const at = boards.findIndex((b) => b.id === useProject.getState().currentId);
    return Math.max(0, at);
  });
  const [pen, setPen] = useState(false);
  const [ink, setInk] = useState(INKS[0]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [notes, setNotes] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const swipe = useRef<number | null>(null);
  const board = boards[index];

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => Math.min(boards.length - 1, Math.max(0, i + delta)));
      setStrokes([]);
    },
    [boards.length],
  );

  // Plein écran si le navigateur le permet ; le quitter (Échap du navigateur) ferme la présentation.
  useEffect(() => {
    const el = rootRef.current;
    let entered = false;
    el?.requestFullscreen?.().then(() => (entered = true)).catch(() => undefined);
    const onChange = () => {
      if (entered && !document.fullscreenElement) onClose();
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "PageDown") go(1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
      else if (e.key.toLowerCase() === "d") setPen((p) => !p);
      else if (e.key.toLowerCase() === "x") setStrokes([]);
      else if (e.key.toLowerCase() === "n") setNotes((n) => !n);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!board) return null;
  const rect = viewRect(board.scene.pitch);
  const ratio = (rect.w + PAD * 2) / (rect.h + PAD * 2);
  const controls = (board.scene.frames?.length ?? 0) > 0 ? 64 : 0;
  // Le plus grand tableau qui tienne, commandes de lecture comprises.
  const width = Math.max(200, Math.min(size.w, (size.h - controls - 16) * ratio));
  const drill = board.sheet;
  const lines = [...DRILL_SHORT_FIELDS, ...DRILL_TEXT_FIELDS].filter((f) => drill[f]).map((f) => ({ label: tSheet(`fields.${f}`), text: drill[f]! }));

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("label")}
      className="fixed inset-0 z-[70] flex flex-col bg-neutral-950 text-white"
    >
      <header className="flex items-center gap-1 px-2 py-1.5">
        <h2 className="min-w-0 flex-1 truncate px-2 text-lg font-semibold" aria-live="polite">
          {board.name}
          <span className="ml-3 text-sm font-normal text-white/60">{t("position", { n: index + 1, total: boards.length })}</span>
        </h2>
        <div className="flex items-center gap-1 [&_button]:text-white [&_button:hover]:bg-white/10">
          <IconButton icon={ChevronLeft} label={t("previous")} disabled={index === 0} onClick={() => go(-1)} />
          <IconButton icon={ChevronRight} label={t("next")} disabled={index === boards.length - 1} onClick={() => go(1)} />
          <span className="mx-1 h-6 w-px bg-white/20" />
          <IconButton icon={Pencil} label={t("pen")} active={pen} onClick={() => setPen((p) => !p)} />
          {pen &&
            INKS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={t("color", { color })}
                aria-pressed={ink === color}
                onClick={() => setInk(color)}
                className={cn("size-7 rounded-full border-2", ink === color ? "border-white" : "border-transparent")}
                style={{ background: color }}
              />
            ))}
          <IconButton icon={Eraser} label={t("clear")} disabled={strokes.length === 0} onClick={() => setStrokes([])} />
          {lines.length + (board.notes ? 1 : 0) > 0 && (
            <IconButton icon={NotebookText} label={t("notes")} active={notes} onClick={() => setNotes((n) => !n)} />
          )}
          <span className="mx-1 h-6 w-px bg-white/20" />
          <IconButton icon={X} label={t("close")} onClick={onClose} />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3">
        <div
          ref={stageRef}
          className="flex min-w-0 flex-1 items-center justify-center"
          onPointerDown={(e) => {
            if (!pen) swipe.current = e.clientX;
          }}
          onPointerUp={(e) => {
            if (swipe.current === null) return;
            const dx = e.clientX - swipe.current;
            swipe.current = null;
            if (Math.abs(dx) > 80) go(dx < 0 ? 1 : -1);
          }}
        >
          {size.w > 0 && (
            <div key={board.id} style={{ width }} className="rounded-xl bg-card p-2 text-card-foreground">
              <BoardPlayer
                scene={board.scene}
                keyboard
                overlay={<InkLayer active={pen} color={ink} strokes={strokes} onChange={setStrokes} />}
              />
            </div>
          )}
        </div>
        {notes && (
          <aside aria-label={t("notes")} className="hidden w-80 shrink-0 overflow-y-auto rounded-xl bg-white/5 p-4 text-sm md:block">
            <dl className="flex flex-col gap-3">
              {lines.map((line) => (
                <div key={line.label}>
                  <dt className="text-xs tracking-wide text-white/60 uppercase">{line.label}</dt>
                  <dd className="whitespace-pre-wrap">{line.text}</dd>
                </div>
              ))}
              {board.notes && (
                <div>
                  <dt className="text-xs tracking-wide text-white/60 uppercase">{t("boardNotes")}</dt>
                  <dd className="whitespace-pre-wrap">{board.notes}</dd>
                </div>
              )}
            </dl>
          </aside>
        )}
      </div>
      <p className="pb-2 text-center text-xs text-white/50">{t("help")}</p>
    </div>
  );
}

export function PresentButton() {
  const t = useTranslations("present");
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      {/* Pas sur téléphone : écran trop petit pour une causerie, barre d'outils déjà pleine. */}
      <IconButton icon={Presentation} label={t("open")} className="hidden sm:inline-flex" onClick={() => setOpen(true)} />
      {open && <Presenter onClose={close} />}
    </>
  );
}
