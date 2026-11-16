import { getPitch, toVertical } from "../pitches";
import type { Orientation } from "./types";

export const FORMATIONS = [
  "4-4-2",
  "4-3-3",
  "3-5-2",
  "4-2-3-1",
  "3-4-3",
  "5-3-2",
  "4-1-4-1",
  "4-5-1",
] as const;
export type FormationId = (typeof FORMATIONS)[number];

export interface FormationSlot {
  x: number;
  y: number;
  number: string;
  role: string;
  goalkeeper: boolean;
}

/**
 * Calcule les 11 positions d'une formation.
 * `side` 0 défend à gauche (en bas à la verticale), `side` 1 en face.
 */
export function formationSlots(
  formation: FormationId,
  side: 0 | 1,
  sport: string,
  orientation: Orientation,
): FormationSlot[] {
  const pitch = getPitch(sport);
  const lines = formation.split("-").map(Number);
  const half = pitch.length / 2;
  const slots: FormationSlot[] = [];

  const place = (depth: number, lateral: number) => {
    let x = 4 + depth * (half - 10);
    const y = lateral * pitch.width;
    if (side === 1) x = pitch.length - x;
    return orientation === "vertical" ? toVertical(x, y, pitch.length) : { x, y };
  };

  slots.push({ ...place(0, 0.5), number: "1", role: "G", goalkeeper: true });

  let number = 2;
  lines.forEach((count, lineIndex) => {
    const depth = (lineIndex + 1) / lines.length;
    const role = lineIndex === 0 ? "D" : lineIndex === lines.length - 1 ? "A" : "M";
    for (let j = 0; j < count; j++) {
      // Les lignes fournies occupent toute la largeur, les lignes courtes restent axiales.
      const spread = Math.min(0.84, 0.22 * count);
      const lateral = count === 1 ? 0.5 : 0.5 - spread / 2 + (spread * j) / (count - 1);
      slots.push({
        ...place(depth, side === 1 ? 1 - lateral : lateral),
        number: String(number++),
        role,
        goalkeeper: false,
      });
    }
  });

  return slots;
}
