"use client";

import type Konva from "konva";
import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Arrow, Layer, Rect, Stage } from "react-konva";
import { ensurePhotos, usePhotos } from "@/lib/photos";
import { ObjectNode, type NodeHandlers } from "./canvas/object-node";
import { PitchLayer } from "./canvas/pitch-layer";
import { viewRect } from "./pitches";
import { resolveStep } from "./scene/animation";
import { objectsAtStep, stepArrows, type ArrowSpec } from "./export/frame";
import { primSvg } from "./export/svg";
import { BALL_SIZE, ballPrims, EQUIPMENT_SIZE, equipmentPrims, type CatalogItem } from "./scene/catalog";
import { objectBox, unionBox, type Box } from "./scene/geometry";
import type { Scene, SceneObject } from "./scene/types";

/**
 * Images fixes d'un tableau, pour la fiche PDF : le tableau seul (étape 0) ou une étape
 * d'animation (positions au début de l'étape et flèches des déplacements de l'étape).
 */

const noop = () => {};
const handlers: NodeHandlers = { onPointerDown: noop, onDragStart: noop, onDragMove: noop, onDragEnd: noop };
const PAD = 2;
export const MAX_DIAGRAMS = 4;

/** Étapes à imprimer pour un tableau : 0 = tableau seul. */
export function diagramSteps(scene: Scene, mode: "steps" | "board" | undefined): number[] {
  const frames = scene.frames?.length ?? 0;
  if (mode === "board" || frames === 0) return [0];
  return Array.from({ length: Math.min(frames, MAX_DIAGRAMS) }, (_, i) => i + 1);
}

const CROP_MARGIN = 5;
const MIN_W = 26;
const MIN_H = 20;

/**
 * Cadre imprimé d'un tableau : la zone occupée par les objets sur toutes les étapes, avec une
 * marge, sans jamais déborder du cadrage choisi pour le terrain. Un exercice qui n'occupe
 * qu'une partie du terrain est ainsi imprimé en grand.
 */
export function diagramRect(scene: Scene): Box {
  const view = viewRect(scene.pitch);
  if (scene.objects.length === 0) return view;
  const steps = scene.frames?.length ?? 0;
  const boxes: Box[] = [];
  for (let step = 0; step <= steps; step++) {
    const poses = resolveStep(scene, step);
    for (const obj of scene.objects) {
      const pose = poses.get(obj.id);
      boxes.push(objectBox(pose ? { ...obj, x: pose.x, y: pose.y } : obj));
    }
  }
  const used = unionBox(boxes);
  let x0 = used.x - CROP_MARGIN;
  let y0 = used.y - CROP_MARGIN;
  let x1 = used.x + used.w + CROP_MARGIN;
  let y1 = used.y + used.h + CROP_MARGIN;
  // Taille minimale, agrandie autour du centre.
  if (x1 - x0 < MIN_W) {
    const c = (x0 + x1) / 2;
    x0 = c - MIN_W / 2;
    x1 = c + MIN_W / 2;
  }
  if (y1 - y0 < MIN_H) {
    const c = (y0 + y1) / 2;
    y0 = c - MIN_H / 2;
    y1 = c + MIN_H / 2;
  }
  x0 = Math.max(x0, view.x);
  y0 = Math.max(y0, view.y);
  x1 = Math.min(x1, view.x + view.w);
  y1 = Math.min(y1, view.y + view.h);
  // Recadrage inutile : on garde le terrain entier, plus lisible.
  if ((x1 - x0) * (y1 - y0) > view.w * view.h * 0.8) return view;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Rapport largeur / hauteur des images d'un tableau. */
export function diagramAspect(scene: Scene) {
  const r = diagramRect(scene);
  return (r.w + PAD * 2) / (r.h + PAD * 2);
}

export type Framing = "crop" | "view";

/** Cadre d'une image : zone utilisée (recadrée) ou cadrage du terrain choisi dans l'éditeur. */
export function frameRect(scene: Scene, framing: Framing): Box {
  return framing === "crop" ? diagramRect(scene) : viewRect(scene.pitch);
}

/** Taille en pixels (avant suréchantillonnage) d'une image du tableau à la largeur donnée. */
export function frameSize(rect: Box, width: number) {
  const scale = width / (rect.w + PAD * 2);
  return { width, height: Math.round((rect.h + PAD * 2) * scale), scale };
}

interface StageProps {
  scene: Scene;
  objects: SceneObject[];
  arrows: ArrowSpec[];
  rect: Box;
  width: number;
  onReady: (stage: Konva.Stage) => void;
}

function SnapshotStage({ scene, objects, arrows, rect, width, onReady }: StageProps) {
  const ref = useRef<Konva.Stage>(null);
  const { height, scale } = frameSize(rect, width);
  const teams = new Map(scene.teams.map((t) => [t.id, t]));
  const photos = usePhotos.getState().images;

  useEffect(() => {
    // Deux images d'affichage : le temps que Konva ait dessiné tous les calques.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => ref.current && onReady(ref.current));
    });
    return () => cancelAnimationFrame(frame);
  }, [onReady]);

  return (
    <Stage
      ref={ref}
      width={width}
      height={height}
      scaleX={scale}
      scaleY={scale}
      x={(PAD - rect.x) * scale}
      y={(PAD - rect.y) * scale}
      listening={false}
    >
      <Layer listening={false}>
        <Rect x={rect.x - PAD} y={rect.y - PAD} width={rect.w + PAD * 2} height={rect.h + PAD * 2} fill={scene.pitch.grass} />
      </Layer>
      <PitchLayer settings={scene.pitch} />
      <Layer listening={false}>
        {arrows.map((a, i) => (
          <Arrow
            key={i}
            points={a.points}
            stroke={scene.pitch.lines}
            fill={scene.pitch.lines}
            strokeWidth={0.32}
            dash={a.dashed ? [0.9, 0.7] : undefined}
            pointerLength={1.3}
            pointerWidth={1.3}
            lineCap="round"
            lineJoin="round"
          />
        ))}
      </Layer>
      <Layer listening={false} name="objects">
        {objects.map((obj) => (
          <ObjectNode
            key={obj.id}
            obj={obj}
            team={obj.type === "player" ? teams.get(obj.teamId) : undefined}
            photo={obj.type === "player" && obj.photo ? photos[obj.photo] : undefined}
            ink={scene.pitch.lines}
            draggable={false}
            handlers={handlers}
            showFacing={!scene.hideFacing}
          />
        ))}
      </Layer>
    </Stage>
  );
}

/**
 * Monte un tableau hors écran et rend la scène Konva une fois dessinée. `dispose` le démonte.
 * Les photos des joueurs sont chargées avant le montage.
 */
export async function mountStage(
  scene: Scene,
  options: { step?: number; rect: Box; width: number; arrows?: boolean },
): Promise<{ stage: Konva.Stage; dispose: () => void }> {
  await ensurePhotos(scene.objects.flatMap((o) => (o.type === "player" && o.photo ? [o.photo] : [])));
  const step = options.step ?? 0;
  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;left:-20000px;top:0;pointer-events:none;";
    document.body.appendChild(host);
    const root = createRoot(host);
    const dispose = () =>
      setTimeout(() => {
        root.unmount();
        host.remove();
      });
    root.render(
      <SnapshotStage
        scene={scene}
        objects={objectsAtStep(scene, step)}
        arrows={options.arrows === false ? [] : stepArrows(scene, step)}
        rect={options.rect}
        width={options.width}
        onReady={(stage) => resolve({ stage, dispose })}
      />,
    );
  });
}

/** Image JPEG d'un tableau, à la largeur demandée (en pixels, avant suréchantillonnage ×2). */
export async function renderDiagram(scene: Scene, step: number, width = 900): Promise<string> {
  const { stage, dispose } = await mountStage(scene, { step, rect: diagramRect(scene), width });
  try {
    return stage.toDataURL({ pixelRatio: 2, mimeType: "image/jpeg", quality: 0.9 });
  } finally {
    dispose();
  }
}

// --- Icônes de légende -------------------------------------------------------

/** Icône PNG d'un objet de la banque, sur fond vert, pour la légende « Matériel ». */
export function iconPng(item: CatalogItem, size = 96): Promise<string> {
  const box = item.type === "ball" ? BALL_SIZE[item.style] : EQUIPMENT_SIZE[item.kind];
  const prims = item.type === "ball" ? ballPrims(item.style) : equipmentPrims(item.kind, item.color);
  const side = Math.max(box.w, box.h) + 0.6;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-side / 2} ${-side / 2} ${side} ${side}"><rect x="${-side / 2}" y="${-side / 2}" width="${side}" height="${side}" fill="#2f8f57"/>${prims.map(primSvg).join("")}</svg>`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** Objets de la banque présents dans une séance, sans doublon, pour la légende. */
export function usedItems(scenes: Scene[], max = 10): CatalogItem[] {
  const seen = new Map<string, CatalogItem>();
  for (const scene of scenes) {
    for (const o of scene.objects) {
      if (o.type === "ball") {
        const style = o.style ?? "classic";
        seen.set(`ball-${style}`, { id: `ball-${style}`, type: "ball", style });
      } else if (o.type === "equipment") {
        const id = `${o.kind}-${o.color}`;
        seen.set(id, { id, type: "equipment", kind: o.kind, color: o.color });
      }
    }
  }
  return [...seen.values()].slice(0, max);
}

/** Effectif par équipe : le plus grand nombre de joueurs de l'équipe sur un tableau. */
export function squad(scenes: Scene[]): { color: string; name: string; count: number }[] {
  const out = new Map<string, { color: string; name: string; count: number }>();
  for (const scene of scenes) {
    for (const team of scene.teams) {
      const count = scene.objects.filter((o) => o.type === "player" && o.teamId === team.id).length;
      const key = team.color.toLowerCase();
      const current = out.get(key);
      if (count && (!current || count > current.count)) out.set(key, { color: team.color, name: team.name, count });
    }
  }
  return [...out.values()].slice(0, 4);
}
