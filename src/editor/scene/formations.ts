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

/** Systèmes de jeu proposés pour chaque format (joueurs de champ, sans le gardien). */
export const FORMATIONS_BY_FORMAT: Record<string, readonly string[]> = {
  football: FORMATIONS,
  football8: ["3-3-1", "2-3-2", "3-2-2", "2-4-1", "3-1-3"],
  football5: ["2-2", "1-2-1", "2-1-1", "3-1"],
};

/** Un système s'écrit « 4-4-2 » : nombre de joueurs par ligne, de la défense à l'attaque. */
export type FormationId = string;

export function formationsFor(sport: string): readonly string[] {
  return FORMATIONS_BY_FORMAT[sport] ?? FORMATIONS;
}

export interface FormationSlot {
  x: number;
  y: number;
  number: string;
  role: string;
  goalkeeper: boolean;
}

/**
 * Calcule les positions d'une formation (gardien compris).
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
    // Marges proportionnelles : 4 m et 10 m sur un terrain de 105 m.
    let x = pitch.length * 0.038 + depth * (half - pitch.length * 0.095);
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

/**
 * Orientation par défaut d'un joueur (degrés, 0 = vers la droite) : chaque camp regarde le but
 * adverse. Horizontal : camp 0 vers la droite, camp 1 vers la gauche ; vertical : camp 0 vers le
 * haut, camp 1 vers le bas.
 */
export function facingFor(side: 0 | 1, orientation: Orientation): number {
  if (orientation === "vertical") return side === 0 ? 270 : 90;
  return side === 0 ? 0 : 180;
}
