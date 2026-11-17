import { DEFAULT_EQUIPMENT_COLOR, defaultEquipmentScale } from "@/editor/scene/catalog";
import { GRASS_PRESETS, LINE_STYLES } from "@/editor/scene/defaults";
import { facingFor } from "@/editor/scene/formations";
import {
  SCENE_VERSION,
  type EquipmentKind,
  type LineKind,
  type Move,
  type PitchView,
  type Scene,
  type SceneObject,
  type Team,
} from "@/editor/scene/types";

/**
 * Petit outil pour écrire les schémas des exercices prêts à l'emploi : on place joueurs, ballons,
 * matériel et tracés en mètres (terrain horizontal, x dans la longueur), puis on ajoute des étapes
 * d'animation. Les identifiants sont stables (p1, b1, c1…) : un même exercice donne toujours la
 * même scène.
 */

export type Pt = [number, number];

/** Équipe 0 (bleue, attaque vers la droite), 1 (rouge, vers la gauche), 2 (jokers, jaunes). */
export type Side = 0 | 1 | 2;

const TEAMS: Team[] = [
  { id: "team-a", name: "A", color: "#1d4ed8" },
  { id: "team-b", name: "B", color: "#dc2626" },
  { id: "team-j", name: "Jokers", color: "#f59e0b" },
];

export const COLORS = {
  orange: "#f97316",
  yellow: "#facc15",
  blue: "#2563eb",
  red: "#ef4444",
  green: "#22c55e",
  white: "#ffffff",
} as const;

interface PlayerOptions {
  n?: string;
  gk?: boolean;
  /** Orientation (degrés, 0 = vers la droite) ; par défaut, vers le but adverse. */
  rot?: number;
  role?: string;
}

interface StepMove {
  x: number;
  y: number;
  rot?: number;
  arc?: number;
  attach?: string;
  delay?: number;
  span?: number;
  curve?: Pt;
}

export class DrillBuilder {
  private objects: SceneObject[] = [];
  private frames: NonNullable<Scene["frames"]> = [];
  private counters = new Map<string, number>();
  /** Position et orientation de chaque objet à la fin de la dernière étape. */
  private poses = new Map<string, { x: number; y: number; rotation: number }>();
  private usedTeams = new Set<number>();

  constructor(
    private sport: "football" | "football8" | "football5",
    private view: PitchView = "full",
  ) {}

  private id(prefix: string) {
    const n = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, n);
    return `${prefix}${n}`;
  }

  private add<T extends SceneObject>(obj: T): string {
    this.objects.push(obj);
    this.poses.set(obj.id, { x: obj.x, y: obj.y, rotation: obj.rotation });
    return obj.id;
  }

  player(side: Side, x: number, y: number, o: PlayerOptions = {}) {
    this.usedTeams.add(side);
    const team = TEAMS[side];
    return this.add({
      id: this.id("p"),
      type: "player",
      x,
      y,
      rotation: o.rot ?? (side === 1 ? facingFor(1, "horizontal") : facingFor(0, "horizontal")),
      teamId: team.id,
      number: o.n ?? "",
      name: "",
      role: o.role ?? "",
      look: "disc",
      goalkeeper: !!o.gk,
    });
  }

  ball(x: number, y: number) {
    return this.add({ id: this.id("b"), type: "ball", x, y, rotation: 0 });
  }

  eq(kind: EquipmentKind, x: number, y: number, o: { color?: string; rot?: number; scale?: number } = {}) {
    return this.add({
      id: this.id("e"),
      type: "equipment",
      kind,
      x,
      y,
      rotation: o.rot ?? 0,
      color: o.color ?? DEFAULT_EQUIPMENT_COLOR[kind],
      scale: o.scale ?? defaultEquipmentScale(kind),
    });
  }

  cones(points: Pt[], color: string = COLORS.orange, kind: EquipmentKind = "marker") {
    return points.map(([x, y]) => this.eq(kind, x, y, { color }));
  }

  /** Carré ou rectangle délimité par des coupelles aux coins (et au milieu des côtés si `mid`). */
  grid(x: number, y: number, w: number, h: number, color: string = COLORS.yellow, mid = false) {
    const pts: Pt[] = [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ];
    if (mid) pts.push([x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]);
    return this.cones(pts, color);
  }

  zone(x: number, y: number, w: number, h: number, fill: string, opacity = 0.18) {
    return this.add({
      id: this.id("z"),
      type: "zone",
      shape: "rect",
      x: x + w / 2,
      y: y + h / 2,
      rotation: 0,
      width: w,
      height: h,
      points: [],
      fill,
      opacity,
    });
  }

  line(kind: LineKind, from: Pt, to: Pt, o: { curve?: Pt; color?: string } = {}) {
    const [x, y] = from;
    const c = o.curve ?? [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    return this.add({
      id: this.id("l"),
      type: "line",
      kind,
      x,
      y,
      rotation: 0,
      points: [0, 0, c[0] - x, c[1] - y, to[0] - x, to[1] - y],
      curved: !!o.curve,
      ...LINE_STYLES[kind],
      color: o.color ?? "#ffffff",
    });
  }

  text(x: number, y: number, text: string, size = 1.6) {
    return this.add({ id: this.id("t"), type: "text", x, y, rotation: 0, text, size, color: "#ffffff", label: true });
  }

  /** Étape d'animation : chaque objet cité finit à la position donnée. */
  step(duration: number, moves: Record<string, StepMove>) {
    const out: Record<string, Move> = {};
    for (const [id, m] of Object.entries(moves)) {
      const pose = this.poses.get(id);
      if (!pose) throw new Error(`objet inconnu : ${id}`);
      const rotation = m.rot ?? pose.rotation;
      const move: Move = { x: m.x, y: m.y, rotation };
      if (m.arc) move.arc = m.arc;
      if (m.attach) move.attach = m.attach;
      if (m.delay) move.delay = m.delay;
      if (m.span) move.span = m.span;
      if (m.curve) {
        move.cx = m.curve[0];
        move.cy = m.curve[1];
      }
      out[id] = move;
      this.poses.set(id, { x: m.x, y: m.y, rotation });
    }
    this.frames.push({ id: `f${this.frames.length + 1}`, duration, moves: out });
    return this;
  }

  /** Position courante (fin de la dernière étape) d'un objet. */
  at(id: string): Pt {
    const pose = this.poses.get(id)!;
    return [pose.x, pose.y];
  }

  scene(): Scene {
    const preset = GRASS_PRESETS[0];
    const teams = [...this.usedTeams].sort().map((i) => TEAMS[i]);
    return {
      version: SCENE_VERSION,
      pitch: { sport: this.sport, view: this.view, orientation: "horizontal", mow: "stripes", grass: preset.grass, lines: preset.lines },
      teams: teams.length ? teams : [TEAMS[0]],
      objects: this.objects,
      ...(this.frames.length ? { frames: this.frames } : {}),
      facing: 1,
    };
  }
}
