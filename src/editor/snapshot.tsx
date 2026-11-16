"use client";

import type Konva from "konva";
import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Arrow, Layer, Rect, Stage } from "react-konva";
import { ObjectNode, type NodeHandlers } from "./canvas/object-node";
import { PitchLayer } from "./canvas/pitch-layer";
import { viewRect } from "./pitches";
import { movePath, resolveStep } from "./scene/animation";
import { BALL_SIZE, ballPrims, EQUIPMENT_SIZE, equipmentPrims, type CatalogItem, type Prim } from "./scene/catalog";
import { objectBox, sampleLine, unionBox, type Box } from "./scene/geometry";
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

type ArrowSpec = { points: number[]; dashed: boolean };

/** Flèches d'une étape, selon la légende : déplacement en pointillés, passe pleine, conduite ondulée. */
function stepArrows(scene: Scene, step: number): ArrowSpec[] {
  const frame = step >= 1 ? scene.frames?.[step - 1] : undefined;
  if (!frame) return [];
  const from = resolveStep(scene, step - 1);
  const byId = new Map(scene.objects.map((o) => [o.id, o]));
  const carriers = new Set(Object.values(frame.moves).flatMap((m) => (m.attach ? [m.attach] : [])));
  return Object.entries(frame.moves).flatMap(([id, move]): ArrowSpec[] => {
    const obj = byId.get(id);
    const start = from.get(id);
    if (!obj || !start || move.attach) return [];
    if (Math.hypot(move.x - start.x, move.y - start.y) < 0.5) return [];
    if (obj.type === "player" && carriers.has(id)) {
      const curved = move.cx !== undefined && move.cy !== undefined;
      const points = sampleLine({
        points: [0, 0, (curved ? move.cx! : (start.x + move.x) / 2) - start.x, (curved ? move.cy! : (start.y + move.y) / 2) - start.y, move.x - start.x, move.y - start.y],
        curved,
        wavy: true,
      }).map((v, i) => v + (i % 2 === 0 ? start.x : start.y));
      return [{ points, dashed: false }];
    }
    return [{ points: movePath(start, move), dashed: obj.type !== "ball" }];
  });
}

function SnapshotStage({
  scene,
  step,
  width,
  onReady,
}: {
  scene: Scene;
  step: number;
  width: number;
  onReady: (stage: Konva.Stage) => void;
}) {
  const ref = useRef<Konva.Stage>(null);
  const rect = diagramRect(scene);
  const scale = width / (rect.w + PAD * 2);
  const height = Math.round((rect.h + PAD * 2) * scale);
  const poses = step >= 1 ? resolveStep(scene, step - 1) : null;
  const objects: SceneObject[] = poses
    ? scene.objects.map((o) => {
        const p = poses.get(o.id);
        return p ? { ...o, x: p.x, y: p.y, rotation: p.rotation } : o;
      })
    : scene.objects;
  const teams = new Map(scene.teams.map((t) => [t.id, t]));
  const arrows = stepArrows(scene, step);

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
      <Layer listening={false}>
        {objects.map((obj) => (
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
  );
}

/** Image JPEG d'un tableau, à la largeur demandée (en pixels, avant suréchantillonnage ×2). */
export function renderDiagram(scene: Scene, step: number, width = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;left:-20000px;top:0;pointer-events:none;";
    document.body.appendChild(host);
    const root = createRoot(host);
    const cleanup = () =>
      setTimeout(() => {
        root.unmount();
        host.remove();
      });
    root.render(
      <SnapshotStage
        scene={scene}
        step={step}
        width={width}
        onReady={(stage) => {
          try {
            resolve(stage.toDataURL({ pixelRatio: 2, mimeType: "image/jpeg", quality: 0.9 }));
          } catch (error) {
            reject(error);
          } finally {
            cleanup();
          }
        }}
      />,
    );
  });
}

// --- Icônes de légende -------------------------------------------------------

function primSvg(p: Prim): string {
  const attrs = [
    `fill="${p.fill ?? "none"}"`,
    p.stroke ? `stroke="${p.stroke}"` : "",
    p.sw ? `stroke-width="${p.sw}"` : "",
    p.o !== undefined ? `opacity="${p.o}"` : "",
    `stroke-linecap="round" stroke-linejoin="round"`,
  ].join(" ");
  switch (p.t) {
    case "circle":
      return `<circle cx="${p.x}" cy="${p.y}" r="${p.r}" ${attrs}/>`;
    case "ellipse":
      return `<ellipse cx="${p.x}" cy="${p.y}" rx="${p.rx}" ry="${p.ry}" ${attrs}/>`;
    case "rect":
      return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.r ?? 0}" ${attrs}/>`;
    case "line":
      return `<${p.closed ? "polygon" : "polyline"} points="${p.pts.join(" ")}" ${attrs}/>`;
  }
}

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
