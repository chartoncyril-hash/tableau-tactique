/** Format de scène — voir docs/SCENE_FORMAT.md. Toutes les longueurs sont en mètres. */
export const SCENE_VERSION = 1;

export type Orientation = "horizontal" | "vertical";
export type PitchView = "full" | "half" | "third" | "box" | "blank";
export type MowStyle = "plain" | "stripes" | "checker";

export interface PitchSettings {
  sport: string;
  view: PitchView;
  orientation: Orientation;
  mow: MowStyle;
  grass: string;
  lines: string;
}

export const TEAM_PATTERNS = ["plain", "stripes", "hoops", "halves"] as const;
export type TeamPattern = (typeof TEAM_PATTERNS)[number];

export interface Team {
  id: string;
  name: string;
  color: string;
  /** Motif des jetons de l'équipe ; absent = uni. */
  pattern?: TeamPattern;
  /** Seconde couleur du motif. */
  color2?: string;
}

interface Base {
  id: string;
  x: number;
  y: number;
  rotation: number;
  locked?: boolean;
  groupId?: string;
}

export type PlayerLook = "disc" | "jersey";

export interface PlayerObject extends Base {
  type: "player";
  teamId: string;
  number: string;
  name: string;
  role: string;
  look: PlayerLook;
  goalkeeper: boolean;
  captain?: boolean;
}

export const BALL_STYLES = [
  "classic",
  "blue",
  "red",
  "yellow",
  "futsal",
  "rugby",
  "volley",
  "tennis",
  "medicine",
] as const;
export type BallStyle = (typeof BALL_STYLES)[number];

export interface BallObject extends Base {
  type: "ball";
  /** Absent = ballon classique (compatibilité avec les premières scènes). */
  style?: BallStyle;
}

export const EQUIPMENT_KINDS = [
  "cone",
  "marker",
  "pole",
  "flag",
  "ring",
  "hurdle",
  "ladder",
  "grid",
  "mannequin",
  "wall",
  "minigoal",
  "goal5",
  "goal",
  "rebounder",
  "mat",
  "bench",
  "box",
  "bosu",
  "dumbbell",
  "bib",
] as const;
export type EquipmentKind = (typeof EQUIPMENT_KINDS)[number];

export interface EquipmentObject extends Base {
  type: "equipment";
  kind: EquipmentKind;
  color: string;
  scale: number;
}

export type ZoneShape = "rect" | "ellipse" | "polygon";

export interface ZoneObject extends Base {
  type: "zone";
  shape: ZoneShape;
  /** Rectangle et ellipse : dimensions centrées sur (x, y). */
  width: number;
  height: number;
  /** Polygone : sommets relatifs à (x, y), à plat [x0, y0, x1, y1…]. */
  points: number[];
  fill: string;
  opacity: number;
  /** Absent = remplissage plein. */
  pattern?: "solid" | "hatch";
}

export interface TextObject extends Base {
  type: "text";
  text: string;
  size: number;
  color: string;
  /** Une étiquette a un fond plein ; un texte simple n'en a pas. */
  label: boolean;
}

export const LINE_KINDS = ["pass", "run", "dribble", "shot", "block", "free"] as const;
export type LineKind = (typeof LINE_KINDS)[number];

export interface LineObject extends Base {
  type: "line";
  kind: LineKind;
  /** Départ, point de contrôle, arrivée, relatifs à (x, y) : [x0, y0, cx, cy, x1, y1]. */
  points: [number, number, number, number, number, number];
  curved: boolean;
  dashed: boolean;
  wavy: boolean;
  arrowStart: boolean;
  arrowEnd: boolean;
  /** Double trait (tir). */
  double?: boolean;
  /** Extrémité en T (blocage, marquage). */
  barEnd?: boolean;
  width: number;
  color: string;
}

export interface FreehandObject extends Base {
  type: "freehand";
  points: number[];
  width: number;
  color: string;
}

export type SceneObject =
  | PlayerObject
  | BallObject
  | EquipmentObject
  | ZoneObject
  | TextObject
  | LineObject
  | FreehandObject;

export type SceneObjectType = SceneObject["type"];

export const EASINGS = ["inOut", "linear", "in", "out"] as const;
export type Easing = (typeof EASINGS)[number];

/** Déplacement d'un objet pendant une étape d'animation. */
export interface Move {
  /** Position et rotation à la fin de l'étape. */
  x: number;
  y: number;
  rotation: number;
  /** Point de contrôle d'une trajectoire courbe (Bézier quadratique) ; absent = ligne droite. */
  cx?: number;
  cy?: number;
  /** Départ différé, en fraction de l'étape (0 à 0,8). */
  delay?: number;
  /** Part de l'étape occupée par le déplacement (0,2 à 1) ; plus court = plus rapide. */
  span?: number;
  ease?: Easing;
  /** Ballon : hauteur maximale de la cloche, en mètres. */
  arc?: number;
  /** Ballon : identifiant du joueur qui le conduit pendant cette étape. */
  attach?: string;
}

/** Une étape d'animation : les objets absents de `moves` ne bougent pas. */
export interface Frame {
  id: string;
  /** Durée en secondes. */
  duration: number;
  moves: Record<string, Move>;
}

export interface Scene {
  version: typeof SCENE_VERSION;
  pitch: PitchSettings;
  teams: Team[];
  /** L'ordre du tableau est l'ordre d'empilement : le dernier est au-dessus. */
  objects: SceneObject[];
  /** Étapes d'animation ; les positions de `objects` sont celles du départ. */
  frames?: Frame[];
}

export const MAX_TEAMS = 4;
