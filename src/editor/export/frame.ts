import { movePath, resolveStep } from "../scene/animation";
import { sampleLine } from "../scene/geometry";
import type { Scene, SceneObject } from "../scene/types";

/** Images d'un tableau : positions des objets et flèches d'une étape. Sans dépendance au DOM. */

export type ArrowSpec = { points: number[]; dashed: boolean };

/** Objets placés comme au début de l'étape (étape 0 = tableau seul). */
export function objectsAtStep(scene: Scene, step: number): SceneObject[] {
  const poses = step >= 1 ? resolveStep(scene, step - 1) : null;
  if (!poses) return scene.objects;
  return scene.objects.map((o) => {
    const p = poses.get(o.id);
    return p ? { ...o, x: p.x, y: p.y, rotation: p.rotation } : o;
  });
}

/** Flèches d'une étape, selon la légende : déplacement en pointillés, passe pleine, conduite ondulée. */
export function stepArrows(scene: Scene, step: number): ArrowSpec[] {
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

/** Nom de fichier lisible, sans accents ni caractères spéciaux. */
export function fileName(parts: (string | undefined)[], extension: string) {
  const base = parts
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80);
  return `${base || "tableau"}.${extension}`;
}
