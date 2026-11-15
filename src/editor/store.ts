import { produce, type Draft } from "immer";
import { create } from "zustand";
import { getPitch, toHorizontal, toVertical } from "./pitches";
import { createScene, DEFAULT_INK, LINE_STYLES, TEAM_COLORS } from "./scene/defaults";
import { formationSlots, type FormationId } from "./scene/formations";
import { alignDeltas, distributeDeltas, type AlignMode } from "./scene/geometry";
import {
  MAX_TEAMS,
  type EquipmentKind,
  type LineKind,
  type PitchSettings,
  type PlayerLook,
  type Scene,
  type SceneObject,
  type Team,
  type ZoneShape,
} from "./scene/types";

export type Tool =
  | { type: "select" }
  | { type: "pan" }
  | { type: "player"; goalkeeper: boolean }
  | { type: "ball" }
  | { type: "equipment"; kind: EquipmentKind }
  | { type: "zone"; shape: ZoneShape }
  | { type: "text"; label: boolean }
  | { type: "line"; kind: LineKind }
  | { type: "freehand" };

export type ReorderMode = "front" | "back" | "forward" | "backward";

/** Une commande de l'historique : l'état avant et après, partagés structurellement. */
interface HistoryEntry {
  label: string;
  before: Scene;
  after: Scene;
  coalesceKey?: string;
  time: number;
}

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
export type NewObject = DistributiveOmit<SceneObject, "id">;

const COALESCE_MS = 800;

export function newId() {
  // Préfixe alphabétique : l'identifiant sert aussi d'id de nœud Konva.
  return `o${Math.random().toString(36).slice(2, 10)}`;
}

export interface EditorState {
  scene: Scene;
  selection: string[];
  tool: Tool;
  activeTeamId: string;
  playerLook: PlayerLook;
  ink: string;
  overlays: { voronoi: boolean; blockLines: boolean };
  past: HistoryEntry[];
  future: HistoryEntry[];
  clipboard: SceneObject[];
  liveBase: Scene | null;
  /** Vrai une fois la scène initiale chargée dans le navigateur. */
  hydrated: boolean;

  commit: (label: string, recipe: (scene: Draft<Scene>) => void, coalesceKey?: string) => void;
  beginLive: () => void;
  live: (recipe: (scene: Draft<Scene>) => void) => void;
  endLive: (label: string) => void;
  undo: () => void;
  redo: () => void;
  loadScene: (scene: Scene) => void;

  setTool: (tool: Tool) => void;
  setActiveTeam: (id: string) => void;
  setPlayerLook: (look: PlayerLook) => void;
  setInk: (color: string) => void;
  toggleOverlay: (key: "voronoi" | "blockLines") => void;

  select: (ids: string[], additive?: boolean) => void;
  selectAll: () => void;

  addObject: (object: NewObject, label?: string) => string;
  addPlayerAt: (x: number, y: number, goalkeeper: boolean) => string;
  updateSelected: (
    recipe: (object: Draft<SceneObject>) => void,
    label: string,
    coalesceKey?: string,
  ) => void;
  moveBy: (ids: string[], dx: number, dy: number) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  copy: () => void;
  paste: () => void;
  group: () => void;
  ungroup: () => void;
  toggleLock: () => void;
  reorder: (mode: ReorderMode) => void;
  align: (mode: AlignMode) => void;
  distribute: (axis: "x" | "y") => void;

  setPitch: (patch: Partial<PitchSettings>, coalesceKey?: string) => void;
  toggleOrientation: () => void;
  updateTeam: (id: string, patch: Partial<Team>, coalesceKey?: string) => void;
  addTeam: (name: string) => void;
  removeTeam: (id: string) => void;
  applyFormation: (teamId: string, formation: FormationId) => void;
  clearAll: () => void;
}

function withGroups(scene: Scene, ids: string[]): string[] {
  const groups = new Set<string>();
  for (const obj of scene.objects) {
    if (obj.groupId && ids.includes(obj.id)) groups.add(obj.groupId);
  }
  if (groups.size === 0) return ids;
  const out = new Set(ids);
  for (const obj of scene.objects) {
    if (obj.groupId && groups.has(obj.groupId)) out.add(obj.id);
  }
  return [...out];
}

function cloneWithNewIds(objects: SceneObject[], offset: number): SceneObject[] {
  const groupMap = new Map<string, string>();
  return objects.map((obj) => {
    const copy: SceneObject = { ...obj, id: newId(), x: obj.x + offset, y: obj.y + offset };
    if (obj.groupId) {
      if (!groupMap.has(obj.groupId)) groupMap.set(obj.groupId, newId());
      copy.groupId = groupMap.get(obj.groupId);
    }
    return copy;
  });
}

function rotateObject(obj: Draft<SceneObject>, to: "vertical" | "horizontal", length: number) {
  const p = to === "vertical" ? toVertical(obj.x, obj.y, length) : toHorizontal(obj.x, obj.y, length);
  obj.x = p.x;
  obj.y = p.y;
  const turn = (points: number[]) => {
    for (let i = 0; i < points.length; i += 2) {
      const dx = points[i];
      const dy = points[i + 1];
      points[i] = to === "vertical" ? dy : -dy;
      points[i + 1] = to === "vertical" ? -dx : dx;
    }
  };
  if (obj.type === "line" || obj.type === "freehand") turn(obj.points);
  else if (obj.type === "zone" && obj.shape === "polygon") turn(obj.points);
  else if (obj.type === "zone" || obj.type === "equipment") {
    obj.rotation += to === "vertical" ? -90 : 90;
  }
}

export const useEditor = create<EditorState>()((set, get) => ({
  scene: createScene(),
  selection: [],
  tool: { type: "select" },
  activeTeamId: "team-a",
  playerLook: "disc",
  ink: DEFAULT_INK,
  overlays: { voronoi: false, blockLines: false },
  past: [],
  future: [],
  clipboard: [],
  liveBase: null,
  hydrated: false,

  commit(label, recipe, coalesceKey) {
    const { scene, past } = get();
    const after = produce(scene, recipe);
    if (after === scene) return;
    const now = Date.now();
    const last = past[past.length - 1];
    if (coalesceKey && last?.coalesceKey === coalesceKey && now - last.time < COALESCE_MS) {
      set({
        scene: after,
        past: [...past.slice(0, -1), { ...last, after, time: now }],
        future: [],
      });
      return;
    }
    set({
      scene: after,
      past: [...past, { label, before: scene, after, coalesceKey, time: now }],
      future: [],
    });
  },

  beginLive() {
    if (!get().liveBase) set({ liveBase: get().scene });
  },
  live(recipe) {
    set({ scene: produce(get().scene, recipe) });
  },
  endLive(label) {
    const { liveBase, scene, past } = get();
    if (!liveBase) return;
    if (liveBase === scene) {
      set({ liveBase: null });
      return;
    }
    set({
      liveBase: null,
      past: [...past, { label, before: liveBase, after: scene, time: Date.now() }],
      future: [],
    });
  },

  undo() {
    const { past, future, selection } = get();
    const entry = past[past.length - 1];
    if (!entry) return;
    const ids = new Set(entry.before.objects.map((o) => o.id));
    set({
      scene: entry.before,
      past: past.slice(0, -1),
      future: [...future, entry],
      selection: selection.filter((id) => ids.has(id)),
      liveBase: null,
    });
  },
  redo() {
    const { past, future, selection } = get();
    const entry = future[future.length - 1];
    if (!entry) return;
    const ids = new Set(entry.after.objects.map((o) => o.id));
    set({
      scene: entry.after,
      past: [...past, entry],
      future: future.slice(0, -1),
      selection: selection.filter((id) => ids.has(id)),
      liveBase: null,
    });
  },
  loadScene(scene) {
    set({
      scene,
      past: [],
      future: [],
      selection: [],
      liveBase: null,
      activeTeamId: scene.teams[0]?.id ?? "team-a",
    });
  },

  setTool: (tool) => set({ tool }),
  setActiveTeam: (id) => set({ activeTeamId: id }),
  setPlayerLook: (look) => set({ playerLook: look }),
  setInk: (color) => set({ ink: color }),
  toggleOverlay: (key) =>
    set({ overlays: { ...get().overlays, [key]: !get().overlays[key] } }),

  select(ids, additive) {
    const { scene, selection } = get();
    const expanded = withGroups(scene, ids);
    if (!additive) {
      set({ selection: expanded });
      return;
    }
    const allSelected = expanded.every((id) => selection.includes(id));
    set({
      selection: allSelected
        ? selection.filter((id) => !expanded.includes(id))
        : [...new Set([...selection, ...expanded])],
    });
  },
  selectAll: () => set({ selection: get().scene.objects.map((o) => o.id) }),

  addObject(object, label = "add") {
    const id = newId();
    get().commit(label, (scene) => {
      scene.objects.push({ ...object, id } as Draft<SceneObject>);
    });
    set({ selection: [id] });
    return id;
  },

  addPlayerAt(x, y, goalkeeper) {
    const { scene, activeTeamId, playerLook } = get();
    const teamId = scene.teams.some((t) => t.id === activeTeamId)
      ? activeTeamId
      : scene.teams[0].id;
    const used = scene.objects
      .filter((o) => o.type === "player" && o.teamId === teamId)
      .map((o) => Number((o as { number: string }).number) || 0);
    const number = goalkeeper && !used.includes(1) ? 1 : Math.max(1, ...used) + 1;
    return get().addObject(
      {
        type: "player",
        x,
        y,
        rotation: 0,
        teamId,
        number: String(used.length === 0 && !goalkeeper ? 2 : number),
        name: "",
        role: goalkeeper ? "G" : "",
        look: playerLook,
        goalkeeper,
      },
      "addPlayer",
    );
  },

  updateSelected(recipe, label, coalesceKey) {
    const ids = new Set(get().selection);
    get().commit(
      label,
      (scene) => {
        for (const obj of scene.objects) if (ids.has(obj.id)) recipe(obj);
      },
      coalesceKey,
    );
  },

  moveBy(ids, dx, dy) {
    if (!dx && !dy) return;
    const set_ = new Set(ids);
    get().commit("move", (scene) => {
      for (const obj of scene.objects) {
        if (set_.has(obj.id) && !obj.locked) {
          obj.x += dx;
          obj.y += dy;
        }
      }
    }, `move:${ids.join(",")}`);
  },

  deleteSelected() {
    const ids = new Set(get().selection);
    if (ids.size === 0) return;
    get().commit("delete", (scene) => {
      scene.objects = scene.objects.filter((o) => !ids.has(o.id) || o.locked);
    });
    set({ selection: get().selection.filter((id) => get().scene.objects.some((o) => o.id === id)) });
  },

  duplicateSelected() {
    const { scene, selection } = get();
    const copies = cloneWithNewIds(
      scene.objects.filter((o) => selection.includes(o.id)),
      2,
    );
    if (copies.length === 0) return;
    get().commit("duplicate", (draft) => {
      draft.objects.push(...(copies as Draft<SceneObject>[]));
    });
    set({ selection: copies.map((c) => c.id) });
  },

  copy() {
    const { scene, selection } = get();
    const picked = scene.objects.filter((o) => selection.includes(o.id));
    if (picked.length) set({ clipboard: picked });
  },
  paste() {
    const { clipboard } = get();
    if (clipboard.length === 0) return;
    const copies = cloneWithNewIds(clipboard, 2);
    get().commit("paste", (draft) => {
      draft.objects.push(...(copies as Draft<SceneObject>[]));
    });
    // Le presse-papiers avance pour que des collages successifs ne se superposent pas.
    set({ selection: copies.map((c) => c.id), clipboard: copies });
  },

  group() {
    const ids = new Set(get().selection);
    if (ids.size < 2) return;
    const groupId = newId();
    get().commit("group", (scene) => {
      for (const obj of scene.objects) if (ids.has(obj.id)) obj.groupId = groupId;
    });
  },
  ungroup() {
    const ids = new Set(get().selection);
    get().commit("ungroup", (scene) => {
      for (const obj of scene.objects) if (ids.has(obj.id)) delete obj.groupId;
    });
  },
  toggleLock() {
    const { scene, selection } = get();
    const picked = scene.objects.filter((o) => selection.includes(o.id));
    const lock = picked.some((o) => !o.locked);
    get().updateSelected((obj) => {
      if (lock) obj.locked = true;
      else delete obj.locked;
    }, "lock");
  },

  reorder(mode) {
    const ids = new Set(get().selection);
    if (ids.size === 0) return;
    get().commit("reorder", (scene) => {
      const list = scene.objects;
      if (mode === "front" || mode === "back") {
        const picked = list.filter((o) => ids.has(o.id));
        const rest = list.filter((o) => !ids.has(o.id));
        scene.objects = mode === "front" ? [...rest, ...picked] : [...picked, ...rest];
        return;
      }
      if (mode === "forward") {
        for (let i = list.length - 2; i >= 0; i--) {
          if (ids.has(list[i].id) && !ids.has(list[i + 1].id)) {
            [list[i], list[i + 1]] = [list[i + 1], list[i]];
          }
        }
      } else {
        for (let i = 1; i < list.length; i++) {
          if (ids.has(list[i].id) && !ids.has(list[i - 1].id)) {
            [list[i], list[i - 1]] = [list[i - 1], list[i]];
          }
        }
      }
    });
  },

  align(mode) {
    const { scene, selection } = get();
    const deltas = alignDeltas(
      scene.objects.filter((o) => selection.includes(o.id) && !o.locked),
      mode,
    );
    get().commit("align", (draft) => {
      for (const obj of draft.objects) {
        const d = deltas.get(obj.id);
        if (d) {
          obj.x += d.dx;
          obj.y += d.dy;
        }
      }
    });
  },
  distribute(axis) {
    const { scene, selection } = get();
    const deltas = distributeDeltas(
      scene.objects.filter((o) => selection.includes(o.id) && !o.locked),
      axis,
    );
    get().commit("distribute", (draft) => {
      for (const obj of draft.objects) {
        const d = deltas.get(obj.id);
        if (d) {
          obj.x += d.dx;
          obj.y += d.dy;
        }
      }
    });
  },

  setPitch(patch, coalesceKey) {
    get().commit(
      "pitch",
      (scene) => {
        Object.assign(scene.pitch, patch);
      },
      coalesceKey,
    );
  },
  toggleOrientation() {
    get().commit("orientation", (scene) => {
      const to = scene.pitch.orientation === "horizontal" ? "vertical" : "horizontal";
      const { length } = getPitch(scene.pitch.sport);
      for (const obj of scene.objects) rotateObject(obj, to, length);
      scene.pitch.orientation = to;
    });
  },

  updateTeam(id, patch, coalesceKey) {
    get().commit(
      "team",
      (scene) => {
        const team = scene.teams.find((t) => t.id === id);
        if (team) Object.assign(team, patch);
      },
      coalesceKey,
    );
  },
  addTeam(name) {
    const { scene } = get();
    if (scene.teams.length >= MAX_TEAMS) return;
    const id = `team-${newId()}`;
    const color = TEAM_COLORS.find((c) => !scene.teams.some((t) => t.color === c)) ?? "#7c3aed";
    get().commit("addTeam", (draft) => {
      draft.teams.push({ id, name, color });
    });
    set({ activeTeamId: id });
  },
  removeTeam(id) {
    const { scene } = get();
    if (scene.teams.length <= 1) return;
    get().commit("removeTeam", (draft) => {
      draft.teams = draft.teams.filter((t) => t.id !== id);
      draft.objects = draft.objects.filter((o) => o.type !== "player" || o.teamId !== id);
    });
    const next = get().scene;
    set({
      activeTeamId: next.teams[0].id,
      selection: get().selection.filter((s) => next.objects.some((o) => o.id === s)),
    });
  },

  applyFormation(teamId, formation) {
    get().commit("formation", (scene) => {
      const index = scene.teams.findIndex((t) => t.id === teamId);
      if (index === -1) return;
      const slots = formationSlots(
        formation,
        (index % 2) as 0 | 1,
        scene.pitch.sport,
        scene.pitch.orientation,
      );
      const players = scene.objects
        .filter((o) => o.type === "player" && o.teamId === teamId)
        .sort((a, b) => {
          const pa = a as { goalkeeper: boolean; number: string };
          const pb = b as { goalkeeper: boolean; number: string };
          return (
            Number(pb.goalkeeper) - Number(pa.goalkeeper) ||
            (Number(pa.number) || 99) - (Number(pb.number) || 99)
          );
        });
      slots.forEach((slot, i) => {
        const existing = players[i];
        if (existing && existing.type === "player") {
          existing.x = slot.x;
          existing.y = slot.y;
          existing.goalkeeper = slot.goalkeeper;
          existing.role = slot.role;
          if (!existing.name) existing.number = slot.number;
        } else {
          scene.objects.push({
            id: newId(),
            type: "player",
            x: slot.x,
            y: slot.y,
            rotation: 0,
            teamId,
            number: slot.number,
            name: "",
            role: slot.role,
            look: get().playerLook,
            goalkeeper: slot.goalkeeper,
          });
        }
      });
    });
  },

  clearAll() {
    get().commit("clear", (scene) => {
      scene.objects = [];
    });
    set({ selection: [] });
  },
}));

export function lineDefaults(kind: LineKind, color: string) {
  return { kind, color, curved: false, ...LINE_STYLES[kind] };
}
