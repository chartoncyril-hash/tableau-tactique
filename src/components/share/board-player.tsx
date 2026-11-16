"use client";

import type Konva from "konva";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Layer, Rect, Stage } from "react-konva";
import { ObjectNode, type NodeHandlers } from "@/editor/canvas/object-node";
import { PitchLayer } from "@/editor/canvas/pitch-layer";
import { viewRect } from "@/editor/pitches";
import { locate, posesAt, resolveStep, totalDuration } from "@/editor/scene/animation";
import type { Scene } from "@/editor/scene/types";
import { cn } from "@/lib/utils";

const noop = () => {};
const handlers: NodeHandlers = { onPointerDown: noop, onDragStart: noop, onDragMove: noop, onDragEnd: noop };
const PAD = 2;

/** Lecteur en lecture seule d'un tableau animé, pour les liens publics. */
export default function BoardPlayer({ scene }: { scene: Scene }) {
  const t = useTranslations("shared");
  const hostRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const [width, setWidth] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const timeRef = useRef(0);
  const total = totalDuration(scene);
  const frames = scene.frames?.length ?? 0;

  const rect = viewRect(scene.pitch);
  const scale = width / (rect.w + PAD * 2);
  const height = Math.round((rect.h + PAD * 2) * scale);
  const teams = useMemo(() => new Map(scene.teams.map((team) => [team.id, team])), [scene.teams]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /** Place chaque nœud à sa pose, sans passer par React. */
  const apply = (poses: Map<string, { x: number; y: number; rotation: number; lift: number }>) => {
    const layer = layerRef.current;
    if (!layer) return;
    for (const node of layer.getChildren()) {
      const pose = poses.get(node.id());
      if (!pose) continue;
      node.position({ x: pose.x, y: pose.y - pose.lift * 0.35 });
      node.rotation(pose.rotation);
      if (node.hasName("ball")) {
        const s = 1 + pose.lift * 0.09;
        node.scale({ x: s, y: s });
      }
    }
    layer.batchDraw();
  };

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      timeRef.current = Math.min(total, timeRef.current + (now - last) / 1000);
      last = now;
      const where = locate(scene, timeRef.current);
      apply(posesAt(scene, where.step, where.p));
      setStep((s) => (s === where.step ? s : where.step));
      if (timeRef.current >= total) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, scene, total]);

  // Hors lecture, le tableau montre la fin de l'étape choisie.
  useEffect(() => {
    if (!playing && width) apply(resolveStep(scene, step));
  }, [playing, step, scene, width]);

  const start = () => {
    if (timeRef.current >= total) timeRef.current = 0;
    setPlaying(true);
  };

  const goTo = (n: number) => {
    setPlaying(false);
    setStep(n);
    timeRef.current = (scene.frames ?? []).slice(0, n).reduce((sum, f) => sum + f.duration, 0);
  };

  return (
    <div className="flex flex-col gap-2">
      <div ref={hostRef} className="w-full overflow-hidden rounded-lg border" style={{ height: height || undefined }}>
        {width > 0 && (
          <Stage width={width} height={height} scaleX={scale} scaleY={scale} x={(PAD - rect.x) * scale} y={(PAD - rect.y) * scale} listening={false}>
            <Layer listening={false}>
              <Rect x={rect.x - PAD} y={rect.y - PAD} width={rect.w + PAD * 2} height={rect.h + PAD * 2} fill={scene.pitch.grass} />
            </Layer>
            <PitchLayer settings={scene.pitch} />
            <Layer ref={layerRef} listening={false}>
              {scene.objects.map((obj) => (
                <ObjectNode
                  key={obj.id}
                  obj={obj}
                  team={obj.type === "player" ? teams.get(obj.teamId) : undefined}
                  ink={scene.pitch.lines}
                  draggable={false}
                  handlers={handlers}
                />
              ))}
            </Layer>
          </Stage>
        )}
      </div>
      {frames > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={playing ? () => setPlaying(false) : start}
            aria-label={playing ? t("pause") : t("play")}
            className="inline-flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground"
          >
            {playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => {
              goTo(0);
              setTimeout(start);
            }}
            aria-label={t("replay")}
            className="inline-flex size-11 items-center justify-center rounded-md border hover:bg-muted"
          >
            <RotateCcw className="size-5" aria-hidden />
          </button>
          <div role="tablist" aria-label={t("steps")} className="flex flex-wrap gap-1">
            {Array.from({ length: frames + 1 }, (_, n) => (
              <button
                key={n}
                type="button"
                role="tab"
                aria-selected={step === n}
                onClick={() => goTo(n)}
                className={cn(
                  "h-11 min-w-11 rounded-md px-3 text-sm tabular-nums",
                  step === n ? "bg-primary font-medium text-primary-foreground" : "border hover:bg-muted",
                )}
              >
                {n === 0 ? t("start") : n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
