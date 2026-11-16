import { getPitch } from "../pitches";
import { ballPrims, equipmentPrims, type Prim } from "../scene/catalog";
import { arrowHead, endBar, objectBox, offsetPolyline, PLAYER_RADIUS, sampleLine, type Box } from "../scene/geometry";
import type { PitchSettings, Scene, SceneObject, Team } from "../scene/types";

/**
 * Export vectoriel d'un tableau. Reproduit le rendu du canevas (terrain, objets, flèches
 * d'étape) en SVG pur, sans dépendance au DOM : le même fichier s'ouvre dans un navigateur,
 * Inkscape, Illustrator ou PowerPoint et reste net à toute taille.
 */

export const SVG_FONT = "Arial, Helvetica, sans-serif";
const PAD = 2;
const MARGIN = 3;
const BANDS = 18;
const JERSEY =
  "M-1.1,-1.6 L-0.45,-1.6 Q0,-1.15 0.45,-1.6 L1.1,-1.6 L2.05,-0.75 L1.5,-0.1 L1.1,-0.45 L1.1,1.6 L-1.1,1.6 L-1.1,-0.45 L-1.5,-0.1 L-2.05,-0.75 Z";

export interface SvgArrow {
  points: number[];
  dashed: boolean;
}

export interface SvgOptions {
  /** Cadre exporté, en mètres. */
  rect: Box;
  /** Largeur du fichier, en pixels (la hauteur suit le cadre). */
  width: number;
  /** Objets à leur position pour l'image (par défaut ceux de la scène). */
  objects?: SceneObject[];
  /** Flèches des déplacements de l'étape. */
  arrows?: SvgArrow[];
  /** Photos des joueurs déjà converties en data URL, par chemin. */
  photos?: Record<string, string>;
}

const n = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000));
const pts = (p: number[]) => p.map(n).join(" ");

export function escapeXml(text: string) {
  return text.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}

function attrs(values: Record<string, string | number | undefined | false>) {
  return Object.entries(values)
    .filter(([, v]) => v !== undefined && v !== false && v !== "")
    .map(([k, v]) => ` ${k}="${typeof v === "number" ? n(v) : escapeXml(String(v))}"`)
    .join("");
}

export function contrastOn(hex: string) {
  const c = hex.replace("#", "");
  const full = c.length === 3 ? c.replace(/./g, "$&$&") : c;
  const v = parseInt(full, 16);
  return 0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255) > 150 ? "#111827" : "#ffffff";
}

export function primSvg(p: Prim): string {
  const paint = attrs({
    fill: p.fill ?? "none",
    stroke: p.stroke,
    "stroke-width": p.sw,
    opacity: p.o,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  switch (p.t) {
    case "circle":
      return `<circle${attrs({ cx: p.x, cy: p.y, r: p.r })}${paint}/>`;
    case "ellipse":
      return `<ellipse${attrs({ cx: p.x, cy: p.y, rx: p.rx, ry: p.ry })}${paint}/>`;
    case "rect":
      return `<rect${attrs({ x: p.x, y: p.y, width: p.w, height: p.h, rx: p.r })}${paint}/>`;
    case "line":
      return `<${p.closed ? "polygon" : "polyline"} points="${pts(p.pts)}"${paint}/>`;
  }
}

/** Texte centré verticalement autour de `y`, comme les textes Konva du canevas. */
function text(value: string, x: number, y: number, size: number, extra: Record<string, string | number | undefined> = {}) {
  return `<text${attrs({ x, y, "font-size": size, "text-anchor": "middle", "dominant-baseline": "central", ...extra })}>${escapeXml(value)}</text>`;
}

/** Courbe lissée identique au paramètre `tension` des lignes Konva. */
export function tensionPath(points: number[], tension: number): string {
  const count = points.length / 2;
  if (count < 3) return `M${pts(points.slice(0, 2))}${count === 2 ? ` L${pts(points.slice(2, 4))}` : ""}`;
  const controls: number[] = [];
  for (let i = 1; i < count - 1; i++) {
    const [x0, y0, x1, y1, x2, y2] = points.slice((i - 1) * 2, (i + 2) * 2);
    const d01 = Math.hypot(x1 - x0, y1 - y0);
    const d12 = Math.hypot(x2 - x1, y2 - y1);
    const sum = d01 + d12 || 1;
    const fa = (tension * d01) / sum;
    const fb = (tension * d12) / sum;
    controls.push(x1 - fa * (x2 - x0), y1 - fa * (y2 - y0), x1 + fb * (x2 - x0), y1 + fb * (y2 - y0));
  }
  let d = `M${n(points[0])} ${n(points[1])} Q${n(controls[0])} ${n(controls[1])} ${n(points[2])} ${n(points[3])}`;
  for (let i = 2; i < count - 1; i++) {
    const c = (i - 2) * 4;
    d += ` C${pts([controls[c + 2], controls[c + 3], controls[c + 4], controls[c + 5], points[i * 2], points[i * 2 + 1]])}`;
  }
  const last = controls.length - 2;
  d += ` Q${n(controls[last])} ${n(controls[last + 1])} ${n(points[points.length - 2])} ${n(points[points.length - 1])}`;
  return d;
}

class Defs {
  private items = new Map<string, string>();
  add(id: string, body: () => string) {
    if (!this.items.has(id)) this.items.set(id, body());
    return `url(#${id})`;
  }
  toString() {
    return this.items.size ? `<defs>${[...this.items.values()].join("")}</defs>` : "";
  }
}

const safeId = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "_");

function teamPaint(defs: Defs, team: Team | undefined, extent: number) {
  const c1 = team?.color ?? "#6b7280";
  const pattern = team?.pattern ?? "plain";
  if (pattern === "plain") return c1;
  const c2 = team?.color2 ?? "#111827";
  const bands = pattern === "halves" ? [c1, c2] : [c1, c2, c1, c2, c1];
  const across = pattern !== "hoops";
  const id = safeId(`kit-${pattern}-${c1}-${c2}-${extent}`);
  return defs.add(id, () => {
    const stops = bands
      .map((c, i) => `<stop offset="${n(i / bands.length)}" stop-color="${c}"/><stop offset="${n((i + 1) / bands.length)}" stop-color="${c}"/>`)
      .join("");
    const [x1, y1, x2, y2] = across ? [-extent, 0, extent, 0] : [0, -extent, 0, extent];
    return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse"${attrs({ x1, y1, x2, y2 })}>${stops}</linearGradient>`;
  });
}

function hatch(defs: Defs, color: string) {
  const id = safeId(`hatch-${color}`);
  const s = 2.6 / 32;
  return defs.add(id, () => {
    const lines = [-32, 0, 32]
      .map((o) => `<line${attrs({ x1: (o - 4) * s, y1: 36 * s, x2: (o + 36) * s, y2: -4 * s })}/>`)
      .join("");
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="2.6" height="2.6"><g stroke="${color}" stroke-width="${n(9 * s)}">${lines}</g></pattern>`;
  });
}

function arcPath(cx: number, cy: number, r: number, from: number, to: number) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const sweep = to - from;
  if (Math.abs(sweep) >= 360) return `M${n(cx - r)} ${n(cy)} a${n(r)} ${n(r)} 0 1 0 ${n(r * 2)} 0 a${n(r)} ${n(r)} 0 1 0 ${n(-r * 2)} 0`;
  const x1 = cx + r * Math.cos(rad(from));
  const y1 = cy + r * Math.sin(rad(from));
  const x2 = cx + r * Math.cos(rad(to));
  const y2 = cy + r * Math.sin(rad(to));
  return `M${n(x1)} ${n(y1)} A${n(r)} ${n(r)} 0 ${Math.abs(sweep) > 180 ? 1 : 0} ${sweep > 0 ? 1 : 0} ${n(x2)} ${n(y2)}`;
}

export function pitchSvg(settings: PitchSettings): string {
  const pitch = getPitch(settings.sport);
  const { length: L, width: W, lineWidth } = pitch;
  const view = pitch.views[settings.view === "blank" ? "full" : settings.view];
  const vertical = settings.orientation === "vertical";
  const band = L / BANDS;
  const crossBand = W / 12;
  const clipId = safeId(`pitch-clip-${settings.view}-${settings.orientation}`);
  const parts: string[] = [
    `<rect${attrs({ x: -MARGIN, y: -MARGIN, width: L + MARGIN * 2, height: W + MARGIN * 2, fill: settings.grass })}/>`,
  ];
  if (settings.mow !== "plain") {
    for (let i = 0; i < BANDS / 2; i++) parts.push(`<rect${attrs({ x: i * 2 * band, y: 0, width: band, height: W, fill: "#000", opacity: 0.07 })}/>`);
  }
  if (settings.mow === "checker") {
    for (let i = 0; i < 6; i++) parts.push(`<rect${attrs({ x: 0, y: i * 2 * crossBand, width: L, height: crossBand, fill: "#000", opacity: 0.07 })}/>`);
  }
  if (settings.view !== "blank") {
    const lines: string[] = [];
    for (const m of pitch.markings) {
      switch (m.t) {
        case "line":
          lines.push(`<line${attrs({ x1: m.x1, y1: m.y1, x2: m.x2, y2: m.y2 })}/>`);
          break;
        case "rect":
          lines.push(`<rect${attrs({ x: m.x, y: m.y, width: m.w, height: m.h })}/>`);
          break;
        case "circle":
          lines.push(`<circle${attrs({ cx: m.cx, cy: m.cy, r: m.r })}/>`);
          break;
        case "arc":
          lines.push(`<path d="${arcPath(m.cx, m.cy, m.r, m.from, m.to)}"/>`);
          break;
        case "spot":
          lines.push(`<circle${attrs({ cx: m.cx, cy: m.cy, r: 0.3, fill: settings.lines, stroke: "none" })}/>`);
          break;
        case "goal":
          lines.push(`<rect${attrs({ x: m.x, y: m.y, width: m.w, height: m.h, fill: settings.lines, opacity: 0.35 })}/>`);
          break;
      }
    }
    parts.push(`<g fill="none" stroke="${escapeXml(settings.lines)}" stroke-width="${n(lineWidth)}">${lines.join("")}</g>`);
  }
  const clip = `<clipPath id="${clipId}"><rect${attrs({ x: view.x - MARGIN, y: view.y - MARGIN, width: view.w + MARGIN * 2, height: view.h + MARGIN * 2 })}/></clipPath>`;
  const transform = vertical ? ` transform="translate(0 ${n(L)}) rotate(-90)"` : "";
  return `<g${transform}>${clip}<g clip-path="url(#${clipId})">${parts.join("")}</g></g>`;
}

function playerSvg(defs: Defs, obj: Extract<SceneObject, { type: "player" }>, team: Team | undefined, ink: string, photo?: string) {
  const R = PLAYER_RADIUS;
  const color = team?.color ?? "#6b7280";
  const patterned = !!team?.pattern && team.pattern !== "plain";
  const jersey = obj.look === "jersey";
  const fill = teamPaint(defs, team, jersey ? 2.05 : R);
  const out: string[] = [];
  if (obj.goalkeeper) out.push(`<circle${attrs({ r: R + 0.42, fill: "none", stroke: "#facc15", "stroke-width": 0.26 })}/>`);
  out.push(
    jersey
      ? `<path${attrs({ d: JERSEY, fill, stroke: "#fff", "stroke-width": 0.16, "stroke-linejoin": "round" })}/>`
      : `<circle${attrs({ r: R, fill, stroke: "#fff", "stroke-width": 0.22 })}/>`,
  );
  const bold = { "font-weight": "bold" };
  if (photo && !jersey) {
    const clip = defs.add("player-photo-clip", () => `<clipPath id="player-photo-clip"><circle r="${n(R - 0.2)}"/></clipPath>`);
    out.push(
      `<image${attrs({ href: photo, x: -R, y: -R, width: R * 2, height: R * 2, preserveAspectRatio: "xMidYMid slice", "clip-path": clip })}/>`,
      `<circle${attrs({ r: R - 0.1, fill: "none", stroke: color, "stroke-width": 0.32 })}/>`,
      `<circle${attrs({ cx: R * 0.78, cy: R * 0.78, r: 0.75, fill: color, stroke: "#fff", "stroke-width": 0.1 })}/>`,
      text(obj.number, R * 0.78, R * 0.78 + 0.05, 0.85, { ...bold, fill: contrastOn(color) }),
    );
  } else if (obj.number) {
    out.push(
      text(obj.number, 0, 0.08, 1.7, {
        ...bold,
        fill: patterned ? "#ffffff" : contrastOn(color),
        stroke: patterned ? "#111827" : undefined,
        "stroke-width": patterned ? 0.32 : undefined,
        "paint-order": patterned ? "stroke" : undefined,
      }),
    );
  }
  if (obj.captain) {
    out.push(
      `<circle${attrs({ cx: R * 0.85, cy: -R * 0.85, r: 0.62, fill: "#facc15", stroke: "#111827", "stroke-width": 0.1 })}/>`,
      text("C", R * 0.85, -R * 0.85 + 0.04, 0.85, { ...bold, fill: "#111827" }),
    );
  }
  if (obj.name) out.push(text(obj.name, 0, R + 0.35 + 0.65, 1.3, { "font-weight": 600, fill: ink }));
  if (obj.role) out.push(text(obj.role, 0, -R - 1.55 + 0.525, 1.05, { fill: ink, opacity: 0.85 }));
  return out.join("");
}

function lineSvg(obj: Extract<SceneObject, { type: "line" }>) {
  const points = sampleLine(obj);
  const head = 0.9 + obj.width * 1.6;
  const stroke = attrs({
    fill: "none",
    stroke: obj.color,
    "stroke-width": obj.width,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  const dash = obj.dashed ? ` stroke-dasharray="1.1 0.9"` : "";
  const out: string[] = [];
  const headSize = obj.double ? head * 1.5 : head;
  if (obj.double) {
    const gap = obj.width * 0.9 + 0.14;
    out.push(`<polyline points="${pts(offsetPolyline(points, gap))}"${stroke}${dash}/>`);
    out.push(`<polyline points="${pts(offsetPolyline(points, -gap))}"${stroke}${dash}/>`);
  } else {
    out.push(`<polyline points="${pts(points)}"${stroke}${dash}/>`);
  }
  // Comme Konva, la pointe est remplie et cerclée du trait.
  const tip = obj.double ? ` fill="${escapeXml(obj.color)}"` : `${stroke.replace('fill="none"', `fill="${escapeXml(obj.color)}"`)}`;
  if (obj.arrowEnd) out.push(`<polygon points="${pts(arrowHead(points, true, headSize))}"${tip}/>`);
  if (obj.arrowStart) out.push(`<polygon points="${pts(arrowHead(points, false, headSize))}"${tip}/>`);
  if (obj.barEnd) out.push(`<polyline points="${pts(endBar(points, 0.9 + obj.width))}"${stroke}/>`);
  return out.join("");
}

function textSvg(obj: Extract<SceneObject, { type: "text" }>) {
  const box = objectBox(obj);
  const out: string[] = [];
  if (obj.label) {
    const w = box.w + obj.size * 0.8;
    const h = box.h + obj.size * 0.3;
    out.push(`<rect${attrs({ x: -w / 2, y: -h / 2, width: w, height: h, rx: obj.size * 0.3, fill: contrastOn(obj.color), opacity: 0.9 })}/>`);
  }
  const lines = obj.text.split("\n");
  const step = obj.size * 1.2;
  lines.forEach((line, i) => {
    out.push(text(line, 0, (i - (lines.length - 1) / 2) * step, obj.size, { "font-weight": 600, fill: obj.color }));
  });
  return out.join("");
}

function zoneSvg(defs: Defs, obj: Extract<SceneObject, { type: "zone" }>) {
  const fill = obj.pattern === "hatch" ? hatch(defs, obj.fill) : obj.fill;
  const paint = attrs({ fill, stroke: obj.fill, "stroke-width": 0.25 });
  const body =
    obj.shape === "rect"
      ? `<rect${attrs({ x: -obj.width / 2, y: -obj.height / 2, width: obj.width, height: obj.height })}${paint}/>`
      : obj.shape === "ellipse"
        ? `<ellipse${attrs({ rx: obj.width / 2, ry: obj.height / 2 })}${paint}/>`
        : `<polygon points="${pts(obj.points)}"${paint}/>`;
  return `<g opacity="${n(obj.opacity)}">${body}</g>`;
}

export function objectSvg(defs: Defs, obj: SceneObject, team: Team | undefined, ink: string, photo?: string): string {
  const scale = obj.type === "equipment" ? obj.scale : 1;
  const transform = [
    `translate(${n(obj.x)} ${n(obj.y)})`,
    obj.rotation ? `rotate(${n(obj.rotation)})` : "",
    scale !== 1 ? `scale(${n(scale)})` : "",
  ]
    .filter(Boolean)
    .join(" ");
  let body: string;
  switch (obj.type) {
    case "player":
      body = playerSvg(defs, obj, team, ink, photo);
      break;
    case "ball":
      body = ballPrims(obj.style ?? "classic").map(primSvg).join("");
      break;
    case "equipment":
      body = equipmentPrims(obj.kind, obj.color).map(primSvg).join("");
      break;
    case "zone":
      body = zoneSvg(defs, obj);
      break;
    case "text":
      body = textSvg(obj);
      break;
    case "line":
      body = lineSvg(obj);
      break;
    case "freehand":
      body = `<path${attrs({ d: tensionPath(obj.points, 0.4), fill: "none", stroke: obj.color, "stroke-width": obj.width, "stroke-linecap": "round", "stroke-linejoin": "round" })}/>`;
      break;
  }
  return `<g transform="${transform}">${body}</g>`;
}

function arrowSvg(arrow: SvgArrow, color: string) {
  const dash = arrow.dashed ? ` stroke-dasharray="0.9 0.7"` : "";
  return `<polyline points="${pts(arrow.points)}" fill="none" stroke="${escapeXml(color)}" stroke-width="0.32" stroke-linecap="round" stroke-linejoin="round"${dash}/><polygon points="${pts(arrowHead(arrow.points, true, 1.3))}" fill="${escapeXml(color)}" stroke="${escapeXml(color)}" stroke-width="0.32" stroke-linejoin="round"/>`;
}

/** Document SVG complet d'un tableau. */
export function sceneToSvg(scene: Scene, options: SvgOptions): string {
  const { rect, width } = options;
  const vb = { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 };
  const height = Math.round((vb.h / vb.w) * width);
  const defs = new Defs();
  const teams = new Map(scene.teams.map((t) => [t.id, t]));
  const ink = scene.pitch.lines;
  const objects = (options.objects ?? scene.objects)
    .map((o) =>
      objectSvg(
        defs,
        o,
        o.type === "player" ? teams.get(o.teamId) : undefined,
        ink,
        o.type === "player" && o.photo ? options.photos?.[o.photo] : undefined,
      ),
    )
    .join("");
  const arrows = (options.arrows ?? []).map((a) => arrowSvg(a, ink)).join("");
  const frame = `frame-${Math.round(vb.x * 10)}-${Math.round(vb.y * 10)}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${pts([vb.x, vb.y, vb.w, vb.h])}" font-family="${SVG_FONT}">`,
    `<clipPath id="${frame}"><rect${attrs({ x: vb.x, y: vb.y, width: vb.w, height: vb.h })}/></clipPath>`,
    defs.toString(),
    `<g clip-path="url(#${frame})">`,
    `<rect${attrs({ x: vb.x, y: vb.y, width: vb.w, height: vb.h, fill: scene.pitch.grass })}/>`,
    pitchSvg(scene.pitch),
    arrows,
    objects,
    `</g></svg>`,
  ].join("");
}

export { Defs };
