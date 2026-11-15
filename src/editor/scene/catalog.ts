import type { BallStyle, EquipmentKind } from "./types";

/**
 * Banque d'objets. Chaque objet est décrit par des primitives vectorielles (en mètres,
 * centrées sur l'origine) : la même description sert au canevas Konva et aux vignettes SVG.
 * Dessins originaux — ne rien reprendre d'un produit existant.
 */
export type Prim =
  | { t: "circle"; x: number; y: number; r: number; fill?: string; stroke?: string; sw?: number; o?: number }
  | { t: "ellipse"; x: number; y: number; rx: number; ry: number; fill?: string; stroke?: string; sw?: number; o?: number }
  | { t: "rect"; x: number; y: number; w: number; h: number; r?: number; fill?: string; stroke?: string; sw?: number; o?: number }
  | { t: "line"; pts: number[]; closed?: boolean; fill?: string; stroke?: string; sw?: number; o?: number };

const WHITE = "#ffffff";
const SHADE = "rgba(0,0,0,0.32)";
const STEEL = "#9ca3af";

export const EQUIPMENT_SIZE: Record<EquipmentKind, { w: number; h: number }> = {
  cone: { w: 1.8, h: 1.9 },
  marker: { w: 1.5, h: 0.8 },
  pole: { w: 0.8, h: 2.2 },
  flag: { w: 1.2, h: 2.2 },
  ring: { w: 2.2, h: 1.1 },
  hurdle: { w: 2.8, h: 1.4 },
  ladder: { w: 5, h: 1.2 },
  grid: { w: 3.6, h: 3.6 },
  mannequin: { w: 1.2, h: 2.5 },
  wall: { w: 3.6, h: 2.5 },
  minigoal: { w: 1.2, h: 2.4 },
  goal5: { w: 1.6, h: 5 },
  goal: { w: 2, h: 7.32 },
  rebounder: { w: 2.2, h: 1.6 },
  mat: { w: 3, h: 2 },
  bench: { w: 4, h: 0.9 },
  box: { w: 1.5, h: 1.5 },
  bosu: { w: 2, h: 1.1 },
  dumbbell: { w: 2.4, h: 1 },
  bib: { w: 1.5, h: 1.8 },
};

function mannequin(c: string, dx = 0): Prim[] {
  return [
    { t: "rect", x: dx - 0.55, y: 1.0, w: 1.1, h: 0.22, r: 0.08, fill: SHADE },
    { t: "line", pts: [dx - 0.45, -0.55, dx + 0.45, -0.55, dx + 0.3, 1.0, dx - 0.3, 1.0], closed: true, fill: c },
    { t: "circle", x: dx, y: -0.92, r: 0.32, fill: c, stroke: WHITE, sw: 0.07 },
  ];
}

/** But vu de dessus : cadre en U ouvert vers la droite, filet hachuré. */
function goal(c: string, depth: number, width: number): Prim[] {
  const hw = width / 2;
  const hd = depth / 2;
  const net: Prim[] = [{ t: "rect", x: -hd, y: -hw, w: depth, h: width, fill: c, o: 0.18 }];
  const step = Math.max(0.35, width / 12);
  for (let y = -hw + step; y < hw - 0.05; y += step) {
    net.push({ t: "line", pts: [-hd, y, hd, y], stroke: c, sw: 0.05, o: 0.6 });
  }
  for (let x = -hd + step; x < hd - 0.05; x += step) {
    net.push({ t: "line", pts: [x, -hw, x, hw], stroke: c, sw: 0.05, o: 0.6 });
  }
  net.push({ t: "line", pts: [hd, -hw, -hd, -hw, -hd, hw, hd, hw], stroke: c, sw: Math.min(0.26, 0.12 + width / 50) });
  return net;
}

export function equipmentPrims(kind: EquipmentKind, c: string): Prim[] {
  switch (kind) {
    case "cone":
      return [
        { t: "rect", x: -0.9, y: 0.72, w: 1.8, h: 0.22, r: 0.06, fill: c },
        { t: "line", pts: [-0.68, 0.74, 0, -0.9, 0.68, 0.74], closed: true, fill: c },
        { t: "line", pts: [-0.3, -0.18, 0.3, -0.18, 0.43, 0.14, -0.43, 0.14], closed: true, fill: WHITE },
      ];
    case "marker":
      return [
        { t: "ellipse", x: 0, y: 0.05, rx: 0.72, ry: 0.32, fill: c, stroke: SHADE, sw: 0.08 },
        { t: "ellipse", x: 0, y: -0.04, rx: 0.26, ry: 0.1, fill: SHADE },
      ];
    case "pole":
      return [
        { t: "ellipse", x: 0, y: 0.95, rx: 0.36, ry: 0.13, fill: SHADE },
        { t: "line", pts: [0, 0.95, 0, -1.05], stroke: c, sw: 0.16 },
      ];
    case "flag":
      return [
        { t: "ellipse", x: -0.3, y: 0.95, rx: 0.36, ry: 0.13, fill: SHADE },
        { t: "line", pts: [-0.3, 0.95, -0.3, -1.05], stroke: "#e5e7eb", sw: 0.12 },
        { t: "line", pts: [-0.3, -1.05, 0.55, -0.72, -0.3, -0.4], closed: true, fill: c },
      ];
    case "ring":
      return [{ t: "ellipse", x: 0, y: 0, rx: 1, ry: 0.46, stroke: c, sw: 0.17 }];
    case "hurdle":
      return [
        { t: "line", pts: [-1.4, 0.62, -0.8, 0.62], stroke: c, sw: 0.18 },
        { t: "line", pts: [0.8, 0.62, 1.4, 0.62], stroke: c, sw: 0.18 },
        { t: "line", pts: [-1.1, 0.62, -1.1, -0.55, 1.1, -0.55, 1.1, 0.62], stroke: c, sw: 0.2 },
      ];
    case "ladder":
      return [
        { t: "rect", x: -2.5, y: -0.6, w: 5, h: 1.2, fill: "rgba(0,0,0,0.08)", stroke: c, sw: 0.14 },
        ...[-1.875, -1.25, -0.625, 0, 0.625, 1.25, 1.875].map(
          (x): Prim => ({ t: "line", pts: [x, -0.6, x, 0.6], stroke: c, sw: 0.12 }),
        ),
      ];
    case "grid":
      return [
        { t: "rect", x: -1.8, y: -1.8, w: 3.6, h: 3.6, fill: "rgba(0,0,0,0.06)", stroke: c, sw: 0.16 },
        { t: "line", pts: [-0.6, -1.8, -0.6, 1.8], stroke: c, sw: 0.12 },
        { t: "line", pts: [0.6, -1.8, 0.6, 1.8], stroke: c, sw: 0.12 },
        { t: "line", pts: [-1.8, -0.6, 1.8, -0.6], stroke: c, sw: 0.12 },
        { t: "line", pts: [-1.8, 0.6, 1.8, 0.6], stroke: c, sw: 0.12 },
      ];
    case "mannequin":
      return mannequin(c);
    case "wall":
      return [...mannequin(c, -1.2), ...mannequin(c, 0), ...mannequin(c, 1.2)];
    case "minigoal":
      return goal(c, 1.2, 2.4);
    case "goal5":
      return goal(c, 1.6, 5);
    case "goal":
      return goal(c, 2, 7.32);
    case "rebounder":
      return [
        { t: "rect", x: -1, y: -0.75, w: 2, h: 1.2, fill: c, o: 0.2 },
        { t: "line", pts: [-1, -0.75, 1, 0.45], stroke: c, sw: 0.05, o: 0.7 },
        { t: "line", pts: [1, -0.75, -1, 0.45], stroke: c, sw: 0.05, o: 0.7 },
        { t: "line", pts: [0, -0.75, 0, 0.45], stroke: c, sw: 0.05, o: 0.7 },
        { t: "rect", x: -1, y: -0.75, w: 2, h: 1.2, stroke: c, sw: 0.16 },
        { t: "line", pts: [-1, 0.45, -1.05, 0.78], stroke: STEEL, sw: 0.12 },
        { t: "line", pts: [1, 0.45, 1.05, 0.78], stroke: STEEL, sw: 0.12 },
      ];
    case "mat":
      return [
        { t: "rect", x: -1.5, y: -1, w: 3, h: 2, r: 0.18, fill: c, o: 0.88, stroke: WHITE, sw: 0.08 },
        { t: "line", pts: [0, -1, 0, 1], stroke: WHITE, sw: 0.06, o: 0.5 },
      ];
    case "bench":
      return [
        { t: "line", pts: [-1.6, 0.15, -1.6, 0.45], stroke: STEEL, sw: 0.14 },
        { t: "line", pts: [1.6, 0.15, 1.6, 0.45], stroke: STEEL, sw: 0.14 },
        { t: "rect", x: -2, y: -0.4, w: 4, h: 0.6, r: 0.1, fill: c, stroke: SHADE, sw: 0.06 },
      ];
    case "box":
      return [
        { t: "rect", x: -0.75, y: -0.75, w: 1.5, h: 1.5, r: 0.1, fill: c, stroke: SHADE, sw: 0.08 },
        { t: "rect", x: -0.42, y: -0.42, w: 0.84, h: 0.84, r: 0.06, stroke: WHITE, sw: 0.07, o: 0.7 },
      ];
    case "bosu":
      return [
        { t: "ellipse", x: 0, y: 0.32, rx: 1, ry: 0.2, fill: SHADE },
        { t: "line", pts: [-0.95, 0.3, -0.8, -0.2, -0.4, -0.48, 0, -0.55, 0.4, -0.48, 0.8, -0.2, 0.95, 0.3], closed: true, fill: c },
      ];
    case "dumbbell":
      return [
        { t: "line", pts: [-0.9, 0, 0.9, 0], stroke: STEEL, sw: 0.16 },
        { t: "rect", x: -1.2, y: -0.48, w: 0.38, h: 0.96, r: 0.1, fill: c },
        { t: "rect", x: 0.82, y: -0.48, w: 0.38, h: 0.96, r: 0.1, fill: c },
      ];
    case "bib":
      return [
        {
          t: "line",
          pts: [-0.72, -0.9, -0.34, -0.9, 0, -0.42, 0.34, -0.9, 0.72, -0.9, 0.72, 0.9, -0.72, 0.9],
          closed: true,
          fill: c,
          stroke: WHITE,
          sw: 0.07,
        },
      ];
  }
}

function pentagon(r: number, fill: string): Prim {
  const pts: number[] = [];
  for (let i = 0; i < 5; i++) {
    const a = ((-90 + i * 72) * Math.PI) / 180;
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return { t: "line", pts, closed: true, fill };
}

const INK = "#111827";

export function ballPrims(style: BallStyle = "classic"): Prim[] {
  const R = 0.75;
  const panel = (base: string, accent: string): Prim[] => [
    { t: "circle", x: 0, y: 0, r: R, fill: base, stroke: INK, sw: 0.12 },
    pentagon(0.32, accent),
  ];
  switch (style) {
    case "classic":
      return panel(WHITE, INK);
    case "blue":
      return panel(WHITE, "#1d4ed8");
    case "red":
      return panel("#ef4444", INK);
    case "yellow":
      return panel("#facc15", INK);
    case "futsal":
      return [
        { t: "circle", x: 0, y: 0, r: 0.62, fill: "#fb923c", stroke: INK, sw: 0.12 },
        pentagon(0.26, WHITE),
      ];
    case "rugby":
      return [
        { t: "ellipse", x: 0, y: 0, rx: 0.95, ry: 0.58, fill: "#f8fafc", stroke: INK, sw: 0.12 },
        { t: "line", pts: [-0.5, 0, 0.5, 0], stroke: INK, sw: 0.08 },
        { t: "line", pts: [-0.2, -0.14, -0.2, 0.14], stroke: INK, sw: 0.06 },
        { t: "line", pts: [0.2, -0.14, 0.2, 0.14], stroke: INK, sw: 0.06 },
      ];
    case "volley":
      return [
        { t: "circle", x: 0, y: 0, r: R, fill: "#fde047", stroke: INK, sw: 0.12 },
        { t: "line", pts: [-0.7, -0.2, -0.25, 0, 0.25, 0, 0.7, -0.2], stroke: "#1d4ed8", sw: 0.16 },
        { t: "line", pts: [-0.5, 0.5, 0, 0.3, 0.5, 0.5], stroke: "#1d4ed8", sw: 0.16 },
      ];
    case "tennis":
      return [
        { t: "circle", x: 0, y: 0, r: 0.45, fill: "#d9f99d", stroke: "#4d7c0f", sw: 0.08 },
        { t: "line", pts: [-0.3, -0.3, -0.08, 0, -0.3, 0.3], stroke: WHITE, sw: 0.07 },
      ];
    case "medicine":
      return [
        { t: "circle", x: 0, y: 0, r: 0.95, fill: "#7c2d12", stroke: INK, sw: 0.12 },
        { t: "line", pts: [-0.95, 0, 0.95, 0], stroke: "#fdba74", sw: 0.08 },
        { t: "line", pts: [0, -0.95, 0, 0.95], stroke: "#fdba74", sw: 0.08 },
      ];
  }
}

export const BALL_SIZE: Record<BallStyle, { w: number; h: number }> = {
  classic: { w: 1.5, h: 1.5 },
  blue: { w: 1.5, h: 1.5 },
  red: { w: 1.5, h: 1.5 },
  yellow: { w: 1.5, h: 1.5 },
  futsal: { w: 1.3, h: 1.3 },
  rugby: { w: 1.9, h: 1.2 },
  volley: { w: 1.5, h: 1.5 },
  tennis: { w: 0.9, h: 0.9 },
  medicine: { w: 1.9, h: 1.9 },
};

export type CatalogItem =
  | { id: string; type: "ball"; style: BallStyle }
  | { id: string; type: "equipment"; kind: EquipmentKind; color: string };

export interface CatalogCategory {
  id: "balls" | "cones" | "agility" | "goals" | "mannequins" | "fitness";
  items: CatalogItem[];
}

const eq = (kind: EquipmentKind, color: string): CatalogItem => ({
  id: `${kind}-${color}`,
  type: "equipment",
  kind,
  color,
});
const ball = (style: BallStyle): CatalogItem => ({ id: `ball-${style}`, type: "ball", style });

const BLUE = "#2563eb";
const RED = "#ef4444";
const YELLOW = "#facc15";
const ORANGE = "#f97316";

export const CATALOG: CatalogCategory[] = [
  {
    id: "balls",
    items: (["classic", "blue", "red", "yellow", "futsal", "rugby", "volley", "tennis", "medicine"] as const).map(ball),
  },
  {
    id: "cones",
    items: [
      eq("cone", ORANGE), eq("cone", YELLOW), eq("cone", BLUE),
      eq("marker", BLUE), eq("marker", RED), eq("marker", YELLOW), eq("marker", WHITE),
      eq("pole", RED), eq("pole", YELLOW), eq("flag", RED), eq("flag", YELLOW),
    ],
  },
  {
    id: "agility",
    items: [
      eq("ring", BLUE), eq("ring", RED), eq("ring", YELLOW),
      eq("hurdle", RED), eq("hurdle", YELLOW),
      eq("ladder", YELLOW), eq("grid", "#111827"),
    ],
  },
  {
    id: "goals",
    items: [eq("goal", WHITE), eq("goal5", WHITE), eq("minigoal", WHITE), eq("minigoal", YELLOW), eq("rebounder", BLUE)],
  },
  {
    id: "mannequins",
    items: [eq("mannequin", YELLOW), eq("mannequin", BLUE), eq("mannequin", RED), eq("wall", YELLOW), eq("wall", BLUE)],
  },
  {
    id: "fitness",
    items: [
      eq("mat", "#7c3aed"), eq("bench", "#b45309"), eq("box", "#b45309"), eq("bosu", BLUE), eq("dumbbell", "#374151"),
      eq("bib", YELLOW), eq("bib", ORANGE), eq("bib", "#22c55e"),
    ],
  },
];

export const DEFAULT_EQUIPMENT_COLOR: Record<EquipmentKind, string> = {
  cone: ORANGE,
  marker: YELLOW,
  pole: RED,
  flag: RED,
  ring: BLUE,
  hurdle: YELLOW,
  ladder: YELLOW,
  grid: "#111827",
  mannequin: YELLOW,
  wall: YELLOW,
  minigoal: WHITE,
  goal5: WHITE,
  goal: WHITE,
  rebounder: BLUE,
  mat: "#7c3aed",
  bench: "#b45309",
  box: "#b45309",
  bosu: BLUE,
  dumbbell: "#374151",
  bib: YELLOW,
};

const TRUE_SCALE: EquipmentKind[] = ["goal", "goal5", "minigoal", "ladder", "grid", "mat", "bench", "rebounder"];

/** Les petits objets sont grossis à la pose pour rester lisibles sur un terrain entier. */
export function defaultEquipmentScale(kind: EquipmentKind) {
  return TRUE_SCALE.includes(kind) ? 1 : 1.6;
}
