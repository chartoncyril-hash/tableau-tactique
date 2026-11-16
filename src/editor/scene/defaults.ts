import { facingFor } from "./formations";
import {
  SCENE_VERSION,
  type LineKind,
  type LineObject,
  type Scene,
  type Team,
} from "./types";

export const TEAM_COLORS = ["#1d4ed8", "#dc2626", "#f59e0b", "#111827"];

export const GRASS_PRESETS = [
  { id: "green", grass: "#2f8f57", lines: "#f5faf6" },
  { id: "dark", grass: "#1f5f3c", lines: "#e3efe7" },
  { id: "blue", grass: "#1f6aa5", lines: "#f2f7fb" },
  { id: "board", grass: "#f8faf9", lines: "#1f2937" },
  { id: "night", grass: "#111827", lines: "#e5e7eb" },
] as const;

export function defaultTeams(names: [string, string]): Team[] {
  return [
    { id: "team-a", name: names[0], color: TEAM_COLORS[0] },
    { id: "team-b", name: names[1], color: TEAM_COLORS[1] },
  ];
}

export function createScene(names: [string, string] = ["A", "B"]): Scene {
  return {
    version: SCENE_VERSION,
    pitch: {
      sport: "football",
      view: "full",
      orientation: "horizontal",
      mow: "stripes",
      grass: GRASS_PRESETS[0].grass,
      lines: GRASS_PRESETS[0].lines,
    },
    teams: defaultTeams(names),
    objects: [],
    facing: 1,
  };
}

type LineStyle = Required<
  Pick<LineObject, "dashed" | "wavy" | "arrowStart" | "arrowEnd" | "double" | "barEnd" | "width">
>;

const base = { dashed: false, wavy: false, arrowStart: false, arrowEnd: true, double: false, barEnd: false, width: 0.3 };

/** Conventions de tracé : passe pleine, course en pointillés, conduite ondulée, tir en double trait, blocage en T. */
export const LINE_STYLES: Record<LineKind, LineStyle> = {
  pass: base,
  run: { ...base, dashed: true },
  dribble: { ...base, wavy: true },
  shot: { ...base, double: true, width: 0.22 },
  block: { ...base, arrowEnd: false, barEnd: true },
  free: { ...base, arrowEnd: false },
};

export const DEFAULT_INK = "#ffffff";

/** Met à niveau une scène enregistrée dans un ancien format. */
export function migrateScene(input: unknown): Scene | null {
  if (!input || typeof input !== "object") return null;
  const scene = input as Partial<Scene>;
  if (scene.version !== SCENE_VERSION) return null;
  if (!scene.pitch || !Array.isArray(scene.teams) || !Array.isArray(scene.objects)) {
    return null;
  }
  return scene.facing === 1 ? (scene as Scene) : withFacing(scene as Scene);
}

/**
 * Tableaux d'avant l'orientation des joueurs : chaque joueur prend l'orientation par défaut de son
 * camp, à laquelle s'ajoute la rotation qu'il avait déjà (et de même pour ses déplacements).
 */
function withFacing(scene: Scene): Scene {
  const side = new Map(scene.teams.map((t, i) => [t.id, (i % 2) as 0 | 1]));
  const offsets = new Map<string, number>();
  const objects = scene.objects.map((o) => {
    if (o.type !== "player") return o;
    const offset = facingFor(side.get(o.teamId) ?? 0, scene.pitch.orientation);
    offsets.set(o.id, offset);
    return { ...o, rotation: o.rotation + offset };
  });
  const frames = scene.frames?.map((f) => ({
    ...f,
    moves: Object.fromEntries(
      Object.entries(f.moves).map(([id, m]) => [id, offsets.has(id) ? { ...m, rotation: m.rotation + offsets.get(id)! } : m]),
    ),
  }));
  return { ...scene, objects, ...(frames ? { frames } : {}), facing: 1 };
}
