"use client";

import { Footprints, Pause, Play, Plus, Repeat, Square, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { pause, play, seek, stop, usePlayback } from "../animation/playback";
import { totalDuration } from "../scene/animation";
import { useEditor } from "../store";
import { cn } from "@/lib/utils";
import { IconButton } from "./controls";

const SPEEDS = [0.5, 1, 1.5, 2];

/** Barre d'animation : étapes (images clés), lecture, boucle, vitesse et traces. */
export function Timeline() {
  const t = useTranslations("editor.anim");
  const frames = useEditor((s) => s.scene.frames);
  const total = useEditor((s) => totalDuration(s.scene));
  const currentStep = useEditor((s) => s.currentStep);
  const { mode, step: playingStep, time, loop, speed, traces } = usePlayback();
  const count = frames?.length ?? 0;
  const readOnly = useEditor((s) => s.readOnly);
  const previewing = mode !== "idle";
  const active = previewing ? playingStep : currentStep;
  const frame = currentStep >= 1 ? frames?.[currentStep - 1] : undefined;
  const editor = useEditor.getState();

  const goTo = (step: number) => {
    if (previewing) stop(step);
    else editor.setStep(step);
  };

  return (
    <div
      data-testid="timeline"
      data-mode={mode}
      className="z-10 flex h-14 shrink-0 items-center gap-1 overflow-x-auto border-t bg-card px-1.5"
    >
      <IconButton
        icon={mode === "playing" ? Pause : Play}
        label={mode === "playing" ? t("pause") : t("play")}
        disabled={count === 0}
        onClick={mode === "playing" ? pause : play}
      />
      <IconButton icon={Square} label={t("stop")} disabled={!previewing} onClick={() => stop()} />
      <span className="mx-1 h-6 w-px shrink-0 bg-border" />

      <div role="tablist" aria-label={t("steps")} className="flex items-center gap-1">
        {Array.from({ length: count + 1 }, (_, step) => (
          <button
            key={step === 0 ? "start" : frames![step - 1].id}
            type="button"
            role="tab"
            aria-selected={active === step}
            aria-label={step === 0 ? t("start") : t("step", { n: step })}
            onClick={() => goTo(step)}
            className={cn(
              "h-9 min-w-9 shrink-0 rounded-md px-2.5 text-sm tabular-nums transition-colors",
              active === step
                ? "bg-primary font-medium text-primary-foreground"
                : "border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {step === 0 ? t("start") : step}
          </button>
        ))}
      </div>
      {!readOnly && (
        <IconButton
          icon={Plus}
          label={t("addStep")}
          disabled={previewing}
          onClick={() => editor.addStep()}
        />
      )}

      {frame && !previewing && !readOnly && (
        <>
          <label className="flex shrink-0 items-center gap-1.5 pl-1 text-sm text-muted-foreground">
            <span className="sr-only sm:not-sr-only">{t("duration")}</span>
            <input
              type="number"
              inputMode="decimal"
              min={0.3}
              max={20}
              step={0.5}
              aria-label={t("duration")}
              value={frame.duration}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (value > 0) editor.setStepDuration(currentStep, value);
              }}
              className="h-9 w-16 rounded-md border border-input bg-card px-2 text-sm text-foreground"
            />
            <span>s</span>
          </label>
          <IconButton icon={Trash2} label={t("removeStep")} onClick={() => editor.removeStep(currentStep)} />
        </>
      )}

      <span className="mx-1 h-6 w-px shrink-0 bg-border" />
      <IconButton
        icon={Repeat}
        label={t("loop")}
        active={loop}
        onClick={() => usePlayback.setState({ loop: !loop })}
      />
      <IconButton
        icon={Footprints}
        label={t("traces")}
        active={traces}
        onClick={() => usePlayback.setState({ traces: !traces })}
      />
      <select
        aria-label={t("speed")}
        value={speed}
        onChange={(e) => usePlayback.setState({ speed: Number(e.target.value) })}
        className="h-9 shrink-0 rounded-md border border-input bg-card px-1.5 text-sm"
      >
        {SPEEDS.map((value) => (
          <option key={value} value={value}>
            {value}×
          </option>
        ))}
      </select>
      <input
        type="range"
        aria-label={t("scrub")}
        min={0}
        max={total || 1}
        step={0.01}
        disabled={count === 0}
        value={previewing ? Math.min(time, total) : 0}
        onChange={(e) => seek(Number(e.target.value))}
        className="ml-1 min-w-32 flex-1 accent-primary"
      />
      <span className="w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
        {(previewing ? Math.min(time, total) : 0).toFixed(1)} / {total.toFixed(1)} s
      </span>
    </div>
  );
}
