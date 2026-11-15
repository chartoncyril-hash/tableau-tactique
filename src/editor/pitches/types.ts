export type Marking =
  | { t: "line"; x1: number; y1: number; x2: number; y2: number }
  | { t: "rect"; x: number; y: number; w: number; h: number }
  | { t: "circle"; cx: number; cy: number; r: number }
  | { t: "arc"; cx: number; cy: number; r: number; from: number; to: number }
  | { t: "spot"; cx: number; cy: number }
  | { t: "goal"; x: number; y: number; w: number; h: number };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Définition d'un terrain, toujours décrite à l'horizontale (longueur sur x).
 * Ajouter un sport = ajouter un fichier de ce type et l'enregistrer dans index.ts.
 */
export interface PitchDefinition {
  id: string;
  length: number;
  width: number;
  /** Largeur des traits, en mètres. */
  lineWidth: number;
  markings: Marking[];
  /** Cadrages disponibles, en coordonnées horizontales. */
  views: { full: Rect; half: Rect; third: Rect; box: Rect };
}
