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
  };
}

type LineStyle = Pick<
  LineObject,
  "dashed" | "wavy" | "arrowStart" | "arrowEnd" | "width"
>;

/** Conventions de tracé : passe pleine, course en pointillés, conduite ondulée, tir épais. */
export const LINE_STYLES: Record<LineKind, LineStyle> = {
  pass: { dashed: false, wavy: false, arrowStart: false, arrowEnd: true, width: 0.3 },
  run: { dashed: true, wavy: false, arrowStart: false, arrowEnd: true, width: 0.3 },
  dribble: { dashed: false, wavy: true, arrowStart: false, arrowEnd: true, width: 0.3 },
  shot: { dashed: false, wavy: false, arrowStart: false, arrowEnd: true, width: 0.6 },
  free: { dashed: false, wavy: false, arrowStart: false, arrowEnd: false, width: 0.3 },
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
  return scene as Scene;
}
