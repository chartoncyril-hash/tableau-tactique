/** Fiche de séance : en-tête au niveau du projet, fiche d'exercice au niveau de chaque tableau. */

export const PROCEDES = ["game", "situation", "exercise"] as const;
export type Procede = (typeof PROCEDES)[number];

export interface SessionSheet {
  date?: string;
  number?: string;
  theme?: string;
  category?: string;
  club?: string;
  coach?: string;
  /** Une idée par ligne : chaque ligne devient une case de la fiche. */
  withBall?: string;
  withoutBall?: string;
  transition?: string;
  /** Couleur des bandeaux de la fiche, aux couleurs du club. */
  color?: string;
}

export interface DrillSheet {
  procede?: Procede;
  objective?: string;
  goal?: string;
  instructions?: string;
  duration?: string;
  players?: string;
  space?: string;
  variables?: string;
  method?: string;
  behaviours?: string;
  /** Schémas imprimés : une vignette par étape d'animation, ou le tableau seul. */
  diagrams?: "steps" | "board";
}

export const SESSION_FIELDS = ["date", "number", "theme", "category", "club", "coach"] as const;
export const PRINCIPLE_FIELDS = ["withBall", "withoutBall", "transition"] as const;
export const DRILL_TEXT_FIELDS = ["objective", "goal", "instructions", "variables", "method", "behaviours"] as const;
export const DRILL_SHORT_FIELDS = ["duration", "players", "space"] as const;

export const DEFAULT_SHEET_COLOR = "#2f4b8f";

/** Lecture tolérante d'une fiche enregistrée (champ absent, mauvais type ou texte trop long). */
export function cleanSheet<T extends object>(input: unknown, keys: readonly string[]): T {
  const out: Record<string, string> = {};
  if (input && typeof input === "object") {
    for (const key of keys) {
      const value = (input as Record<string, unknown>)[key];
      if (typeof value === "string" && value.length) out[key] = value.slice(0, 4000);
    }
  }
  return out as T;
}

export const SESSION_KEYS = [...SESSION_FIELDS, ...PRINCIPLE_FIELDS, "color"] as const;
export const DRILL_KEYS = [...DRILL_TEXT_FIELDS, ...DRILL_SHORT_FIELDS, "procede", "diagrams"] as const;

export const readSessionSheet = (input: unknown) => cleanSheet<SessionSheet>(input, SESSION_KEYS);

export function readDrillSheet(input: unknown): DrillSheet {
  const sheet = cleanSheet<DrillSheet>(input, DRILL_KEYS);
  if (sheet.procede && !PROCEDES.includes(sheet.procede)) delete sheet.procede;
  if (sheet.diagrams && sheet.diagrams !== "steps" && sheet.diagrams !== "board") delete sheet.diagrams;
  return sheet;
}

/** Découpe un champ « une idée par ligne » en cases. */
export function cells(text: string | undefined): string[] {
  return (text ?? "")
    .split(/\n|\|/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
}
