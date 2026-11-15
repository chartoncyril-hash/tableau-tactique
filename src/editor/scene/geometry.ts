import type { LineObject, SceneObject } from "./types";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const PLAYER_RADIUS = 1.6;
export const BALL_RADIUS = 0.75;

function boxFromPoints(points: number[], ox: number, oy: number, pad = 0): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    minX = Math.min(minX, points[i]);
    maxX = Math.max(maxX, points[i]);
    minY = Math.min(minY, points[i + 1]);
    maxY = Math.max(maxY, points[i + 1]);
  }
  return {
    x: ox + minX - pad,
    y: oy + minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  };
}

export const EQUIPMENT_SIZE: Record<string, { w: number; h: number }> = {
  cone: { w: 1.4, h: 1.4 },
  marker: { w: 1.2, h: 1.2 },
  pole: { w: 0.9, h: 0.9 },
  hurdle: { w: 2.4, h: 0.8 },
  ladder: { w: 5, h: 1.2 },
  mannequin: { w: 1.6, h: 1.6 },
  minigoal: { w: 1.2, h: 2.4 },
  goal: { w: 2, h: 7.32 },
};

/** Boîte englobante alignée sur les axes ; la rotation est ignorée (approximation). */
export function objectBox(obj: SceneObject): Box {
  switch (obj.type) {
    case "player":
      return { x: obj.x - PLAYER_RADIUS, y: obj.y - PLAYER_RADIUS, w: PLAYER_RADIUS * 2, h: PLAYER_RADIUS * 2 };
    case "ball":
      return { x: obj.x - BALL_RADIUS, y: obj.y - BALL_RADIUS, w: BALL_RADIUS * 2, h: BALL_RADIUS * 2 };
    case "equipment": {
      const s = EQUIPMENT_SIZE[obj.kind];
      const w = s.w * obj.scale;
      const h = s.h * obj.scale;
      return { x: obj.x - w / 2, y: obj.y - h / 2, w, h };
    }
    case "zone":
      if (obj.shape === "polygon") return boxFromPoints(obj.points, obj.x, obj.y);
      return { x: obj.x - obj.width / 2, y: obj.y - obj.height / 2, w: obj.width, h: obj.height };
    case "text": {
      const lines = obj.text.split("\n");
      const w = Math.max(...lines.map((l) => l.length), 1) * obj.size * 0.56;
      const h = lines.length * obj.size * 1.2;
      return { x: obj.x - w / 2, y: obj.y - h / 2, w, h };
    }
    case "line":
      return boxFromPoints(
        obj.curved ? obj.points : [obj.points[0], obj.points[1], obj.points[4], obj.points[5]],
        obj.x,
        obj.y,
        obj.width,
      );
    case "freehand":
      return boxFromPoints(obj.points, obj.x, obj.y, obj.width);
  }
}

export function unionBox(boxes: Box[]): Box {
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function boxesIntersect(a: Box, b: Box) {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

export type AlignMode = "left" | "centerX" | "right" | "top" | "centerY" | "bottom";

/** Renvoie le déplacement à appliquer à chaque objet pour l'aligner sur la sélection. */
export function alignDeltas(objects: SceneObject[], mode: AlignMode) {
  const deltas = new Map<string, { dx: number; dy: number }>();
  if (objects.length < 2) return deltas;
  const boxes = objects.map(objectBox);
  const all = unionBox(boxes);
  objects.forEach((obj, i) => {
    const b = boxes[i];
    let dx = 0;
    let dy = 0;
    if (mode === "left") dx = all.x - b.x;
    if (mode === "right") dx = all.x + all.w - (b.x + b.w);
    if (mode === "centerX") dx = all.x + all.w / 2 - (b.x + b.w / 2);
    if (mode === "top") dy = all.y - b.y;
    if (mode === "bottom") dy = all.y + all.h - (b.y + b.h);
    if (mode === "centerY") dy = all.y + all.h / 2 - (b.y + b.h / 2);
    deltas.set(obj.id, { dx, dy });
  });
  return deltas;
}

/** Répartit les centres à intervalles égaux entre le premier et le dernier objet. */
export function distributeDeltas(objects: SceneObject[], axis: "x" | "y") {
  const deltas = new Map<string, { dx: number; dy: number }>();
  if (objects.length < 3) return deltas;
  const centers = objects
    .map((obj) => {
      const b = objectBox(obj);
      return { id: obj.id, c: axis === "x" ? b.x + b.w / 2 : b.y + b.h / 2 };
    })
    .sort((a, b) => a.c - b.c);
  const first = centers[0].c;
  const step = (centers[centers.length - 1].c - first) / (centers.length - 1);
  centers.forEach((entry, i) => {
    const d = first + step * i - entry.c;
    deltas.set(entry.id, axis === "x" ? { dx: d, dy: 0 } : { dx: 0, dy: d });
  });
  return deltas;
}

export interface SnapResult {
  x: number;
  y: number;
  guideX: number | null;
  guideY: number | null;
}

/** Aimante un point sur la valeur candidate la plus proche de chaque axe. */
export function snapPoint(
  x: number,
  y: number,
  candidatesX: number[],
  candidatesY: number[],
  threshold: number,
): SnapResult {
  const nearest = (value: number, candidates: number[]) => {
    let best: number | null = null;
    let bestDistance = threshold;
    for (const c of candidates) {
      const d = Math.abs(c - value);
      if (d <= bestDistance) {
        best = c;
        bestDistance = d;
      }
    }
    return best;
  };
  const gx = nearest(x, candidatesX);
  const gy = nearest(y, candidatesY);
  return { x: gx ?? x, y: gy ?? y, guideX: gx, guideY: gy };
}

/** Échantillonne le tracé d'une ligne (droite ou Bézier quadratique), ondulation comprise. */
export function sampleLine(line: Pick<LineObject, "points" | "curved" | "wavy">): number[] {
  const [x0, y0, cx, cy, x1, y1] = line.points;
  const length = Math.hypot(x1 - x0, y1 - y0);
  const steps = line.curved || line.wavy ? Math.max(12, Math.min(96, Math.round(length * 2))) : 1;
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let px: number;
    let py: number;
    let tx: number;
    let ty: number;
    if (line.curved) {
      const u = 1 - t;
      px = u * u * x0 + 2 * u * t * cx + t * t * x1;
      py = u * u * y0 + 2 * u * t * cy + t * t * y1;
      tx = 2 * u * (cx - x0) + 2 * t * (x1 - cx);
      ty = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
    } else {
      px = x0 + (x1 - x0) * t;
      py = y0 + (y1 - y0) * t;
      tx = x1 - x0;
      ty = y1 - y0;
    }
    if (line.wavy && length > 0) {
      const norm = Math.hypot(tx, ty) || 1;
      // L'amplitude s'annule aux extrémités pour que la flèche reste dans l'axe.
      const envelope = Math.min(1, t * 6, (1 - t) * 6);
      const offset = Math.sin(t * length * 1.6) * 0.55 * envelope;
      px += (-ty / norm) * offset;
      py += (tx / norm) * offset;
    }
    out.push(px, py);
  }
  return out;
}

/** Simplification de Ramer-Douglas-Peucker pour le dessin à main levée. */
export function simplify(points: number[], tolerance: number): number[] {
  const n = points.length / 2;
  if (n <= 2) return points;
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const ax = points[a * 2];
    const ay = points[a * 2 + 1];
    const bx = points[b * 2];
    const by = points[b * 2 + 1];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let index = -1;
    let max = tolerance;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - points[i * 2 + 1]) - (ax - points[i * 2]) * (by - ay)) / len;
      if (d > max) {
        max = d;
        index = i;
      }
    }
    if (index !== -1) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i * 2], points[i * 2 + 1]);
  return out;
}

/** Regroupe des profondeurs en lignes (défense, milieu, attaque) en coupant aux plus grands écarts. */
export function clusterLines(depths: number[], maxLines = 3, minGap = 4): number[][] {
  const sorted = [...depths].sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const gaps = sorted
    .slice(1)
    .map((d, i) => ({ gap: d - sorted[i], index: i + 1 }))
    .filter((g) => g.gap >= minGap)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, maxLines - 1)
    .map((g) => g.index)
    .sort((a, b) => a - b);
  const groups: number[][] = [];
  let start = 0;
  for (const cut of [...gaps, sorted.length]) {
    groups.push(sorted.slice(start, cut));
    start = cut;
  }
  return groups;
}
