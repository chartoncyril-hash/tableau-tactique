"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Dialog } from "@/components/dashboard/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { exportGif, exportPng, exportSvg, exportVideo, fileName, saveBlob, VideoUnsupportedError } from "../export/media";
import { useProject } from "../project-session";
import type { Framing } from "../snapshot";
import { useEditor } from "../store";
import { IconButton } from "./controls";

type Format = "png" | "svg" | "gif" | "video";
type Quality = "standard" | "high";

const FORMATS: Format[] = ["png", "svg", "gif", "video"];

/** Largeur (en pixels) de chaque format, selon la qualité choisie. */
const SIZES: Record<Format, Record<Quality, { width: number; pixelRatio: number }>> = {
  png: { standard: { width: 1600, pixelRatio: 1 }, high: { width: 1600, pixelRatio: 2 } },
  svg: { standard: { width: 1600, pixelRatio: 1 }, high: { width: 1600, pixelRatio: 1 } },
  gif: { standard: { width: 640, pixelRatio: 1 }, high: { width: 960, pixelRatio: 1 } },
  video: { standard: { width: 1280, pixelRatio: 1 }, high: { width: 1920, pixelRatio: 1 } },
};

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string; disabled?: boolean }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex min-h-11 flex-col items-start justify-center rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:opacity-40",
              value === o.value ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted",
            )}
          >
            {o.label}
            {o.hint && <span className="text-xs font-normal text-muted-foreground">{o.hint}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function ExportForm({ onClose }: { onClose: () => void }) {
  const t = useTranslations("editor.export");
  const scene = useEditor((s) => s.scene);
  const step = useEditor((s) => s.currentStep);
  const projectName = useProject((s) => s.project?.name);
  const boardName = useProject((s) => s.boards.find((b) => b.id === s.currentId)?.name);
  const animated = (scene.frames?.length ?? 0) > 0;

  const [format, setFormat] = useState<Format>("png");
  const [framing, setFraming] = useState<Framing>("view");
  const [quality, setQuality] = useState<Quality>("standard");
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ kind: "done" | "error"; text: string } | null>(null);
  const abort = useRef<AbortController | null>(null);

  const isAnimation = format === "gif" || format === "video";
  const busy = progress !== null;

  async function run() {
    const controller = new AbortController();
    abort.current = controller;
    setMessage(null);
    setProgress(0);
    const size = SIZES[format][quality];
    const base = [projectName, boardName, !isAnimation && step > 0 ? t("stepSuffix", { step }) : undefined];
    try {
      let blob: Blob;
      let extension: string = format;
      if (format === "png") blob = await exportPng(scene, step, { framing, ...size });
      else if (format === "svg") blob = await exportSvg(scene, step, { framing, width: size.width });
      else if (format === "gif")
        blob = await exportGif(scene, { framing, width: size.width, onProgress: setProgress, signal: controller.signal });
      else {
        const video = await exportVideo(scene, { framing, width: size.width, onProgress: setProgress, signal: controller.signal });
        blob = video.blob;
        extension = video.extension;
      }
      const name = fileName(base, extension);
      saveBlob(blob, name);
      setMessage({ kind: "done", text: t("done", { name }) });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") setMessage(null);
      else setMessage({ kind: "error", text: t(error instanceof VideoUnsupportedError ? "videoUnsupported" : "failed") });
    } finally {
      setProgress(null);
      abort.current = null;
    }
  }

  const sizeHint = (q: Quality) => {
    const s = SIZES[format][q];
    return format === "svg" ? t("vector") : t("pixels", { width: s.width * s.pixelRatio });
  };

  return (
    <Dialog
      title={t("title")}
      closeLabel={t("close")}
      onClose={() => {
        abort.current?.abort();
        onClose();
      }}
    >
      <div className="flex flex-col gap-4">
        <Choice
          label={t("format")}
          value={format}
          disabled={busy}
          onChange={(f) => {
            setFormat(f);
            setMessage(null);
          }}
          options={FORMATS.map((f) => ({
            value: f,
            label: t(`formats.${f}`),
            hint: t(`hints.${f}`),
            disabled: (f === "gif" || f === "video") && !animated,
          }))}
        />
        {!animated && <p className="text-xs text-muted-foreground">{t("noAnimation")}</p>}
        <Choice
          label={t("framing")}
          value={framing}
          disabled={busy}
          onChange={setFraming}
          options={[
            { value: "view", label: t("framings.view") },
            { value: "crop", label: t("framings.crop") },
          ]}
        />
        {format !== "svg" && (
          <Choice
            label={t("quality")}
            value={quality}
            disabled={busy}
            onChange={setQuality}
            options={[
              { value: "standard", label: t("qualities.standard"), hint: sizeHint("standard") },
              { value: "high", label: t("qualities.high"), hint: sizeHint("high") },
            ]}
          />
        )}
        <p className="text-sm text-muted-foreground">
          {isAnimation ? t("animationNote") : step > 0 ? t("stepNote", { step }) : t("boardNote")}
        </p>

        {busy && isAnimation && (
          <div className="flex flex-col gap-1.5">
            <div
              role="progressbar"
              aria-label={t("progress")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full bg-primary transition-[width]" style={{ width: `${progress * 100}%` }} />
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">{Math.round(progress * 100)} %</p>
          </div>
        )}
        <p
          role="status"
          className={cn("min-h-5 text-sm", message?.kind === "error" ? "text-destructive" : "text-muted-foreground")}
        >
          {message?.text}
        </p>

        <div className="flex justify-end gap-2">
          {busy && isAnimation ? (
            <Button variant="outline" onClick={() => abort.current?.abort()}>
              {t("cancel")}
            </Button>
          ) : null}
          <Button onClick={() => void run()} disabled={busy}>
            <Download className="size-4" aria-hidden />
            {busy ? t("working") : t("submit")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function ExportButton() {
  const t = useTranslations("editor.export");
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton icon={Download} label={t("open")} onClick={() => setOpen(true)} />
      {open && <ExportForm onClose={() => setOpen(false)} />}
    </>
  );
}
