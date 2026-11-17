import { produce, type Draft } from "immer";
import { create } from "zustand";
import { getPitch, toHorizontal, toVertical } from "./pitches";
import { DEFAULT_STEP_DURATION, resolveStep } from "./scene/animation";
import { createScene, DEFAULT_INK, LINE_STYLES, TEAM_COLORS } from "./scene/defaults";
import { applyPatch, type ScenePatch } from "./collab/patch";
import { facingFor, formationSlots, type FormationId } from "./scene/formations";
import { rescaleToPitch } from "./scene/format";
import { assignLineup, shortName, type PlayerRow, type TeamRow } from "@/lib/roster";
import { alignDeltas, distributeDeltas, type AlignMode } from "./scene/geometry";
import {
  MAX_TEAMS,
  type BallStyle,
  type EquipmentKind,
  type LineKind,
  type Move,
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
  | { type: "ball"; style?: BallStyle }
  | { type: "equipment"; kind: EquipmentKind; color?: string }
  | { type: "zone"; shape: ZoneShape; hatch?: boolean }
  | { type: "eraser" }
  | { type: "text"; label: boolean }
  | { type: "line"; kind: LineKind }
  | { type: "freehand" }
  /** Placer l'épingle d'un commentaire sur le tableau. */
  | { type: "comment" };

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
  /** Épaisseur des nouveaux tracés, en mètres. */
  inkWidth: number;
  overlays: { voronoi: boolean; blockLines: boolean };
  past: HistoryEntry[];
  future: HistoryEntry[];
  clipboard: SceneObject[];
  liveBase: Scene | null;
  /** Lecture seule (lecteur d'un club) : aucune modification de la scène n'est appliquée. */
  readOnly: boolean;
  /** Étape d'animation affichée et modifiée : 0 = départ. */
  currentStep: number;
  /** Vrai une fois la scène initiale chargée dans le navigateur. */
  hydrated: boolean;

  commit: (
    label: string,
    recipe: (scene: Draft<Scene>) => void,
    coalesceKey?: string,
    /** Vrai pour agir sur la scène brute, sans passer par l'étape affichée. */
    raw?: boolean,
  ) => void;
  beginLive: () => void;
  live: (recipe: (scene: Draft<Scene>) => void) => void;
  endLive: (label: string) => void;
  undo: () => void;
  redo: () => void;
  loadScene: (scene: Scene) => void;

  setStep: (step: number) => void;
  addStep: () => void;
  removeStep: (step: number) => void;
  setStepDuration: (step: number, seconds: number) => void;
  /** Règle le déplacement des objets sélectionnés pour l'étape affichée. */
  updateMoves: (patch: Partial<Move>, coalesceKey?: string) => void;
  /** Supprime le déplacement des objets sélectionnés pour l'étape affichée. */
  clearMoves: () => void;
  /** Remplace toute la scène en gardant l'historique (restauration d'une version). */
  replaceScene: (scene: Scene, label: string) => void;
  /** Change reçu d'un autre entraîneur : appliqué partout, historique compris, sans entrée d'annulation. */
  applyRemote: (patch: ScenePatch) => void;

  setTool: (tool: Tool) => void;
  setActiveTeam: (id: string) => void;
  setPlayerLook: (look: PlayerLook) => void;
  setInk: (color: string) => void;
  setInkWidth: (width: number) => void;
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
  /** Change de format de jeu (et de catégorie) : le schéma est mis à l'échelle du nouveau terrain. */
  setFormat: (sport: string, category?: string | null) => void;
  updateTeam: (id: string, patch: Partial<Team>, coalesceKey?: string) => void;
  addTeam: (name: string) => void;
  removeTeam: (id: string) => void;
  applyFormation: (teamId: string, formation: FormationId) => void;
  /** Remplace les joueurs d'une équipe du tableau par une composition tirée de l'effectif. */
  composeFromRoster: (sceneTeamId: string, roster: TeamRow, players: PlayerRow[], formation: FormationId) => void;
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
  else if (obj.type === "zone" || obj.type === "equipment" || obj.type === "player") {
    obj.rotation += to === "vertical" ? -90 : 90;
  }
}

function pruneMoves(scene: Draft<Scene>) {
  if (!scene.frames) return;
  const ids = new Set(scene.objects.map((o) => o.id));
  for (const frame of scene.frames) {
    for (const [id, move] of Object.entries(frame.moves)) {
      if (!ids.has(id)) delete frame.moves[id];
      else if (move.attach && !ids.has(move.attach)) delete move.attach;
    }
  }
}

let displayCache: { scene: Scene; step: number; objects: SceneObject[] } | undefined;

/** Objets tels qu'affichés à une étape : positions de départ plus les déplacements cumulés. */
export function displayObjects(scene: Scene, step: number): SceneObject[] {
  if (step <= 0 || !scene.frames?.length) return scene.objects;
  if (displayCache?.scene === scene && displayCache.step === step) return displayCache.objects;
  const poses = resolveStep(scene, step);
  const objects = scene.objects.map((o) => {
    const pose = poses.get(o.id);
    return !pose || (pose.x === o.x && pose.y === o.y && pose.rotation === o.rotation)
      ? o
      : { ...o, x: pose.x, y: pose.y, rotation: pose.rotation };
  });
  displayCache = { scene, step, objects };
  return objects;
}

/**
 * Applique une modification à l'étape affichée. La recette voit les objets à leur position
 * dans cette étape ; tout changement de position devient un déplacement de l'étape, et les
 * positions de départ restent intactes.
 */
function produceAtStep(scene: Scene, step: number, recipe: (scene: Draft<Scene>) => void): Scene {
  if (step <= 0 || !scene.frames?.[step - 1]) {
    return produce(scene, (draft) => {
      recipe(draft);
      pruneMoves(draft);
    });
  }
  const shown = displayObjects(scene, step);
  const projected = shown === scene.objects ? scene : { ...scene, objects: shown };
  const after = produce(projected, recipe);
  if (after === projected) return scene;
  const base = new Map(scene.objects.map((o) => [o.id, o]));
  const seen = new Map(shown.map((o) => [o.id, o]));
  return produce(after, (draft) => {
    const frame = draft.frames?.[step - 1];
    for (const obj of draft.objects) {
      const b = base.get(obj.id);
      const r = seen.get(obj.id);
      if (!b || !r) continue;
      if (frame && (obj.x !== r.x || obj.y !== r.y || obj.rotation !== r.rotation)) {
        const previous = frame.moves[obj.id];
        frame.moves[obj.id] = { ...previous, x: obj.x, y: obj.y, rotation: obj.rotation };
        // Un ballon déplacé à la main n'est plus conduit par un joueur.
        delete frame.moves[obj.id].attach;
      }
      if (obj.x !== b.x) obj.x = b.x;
      if (obj.y !== b.y) obj.y = b.y;
      if (obj.rotation !== b.rotation) obj.rotation = b.rotation;
    }
    pruneMoves(draft);
  });
}

const clampStep = (scene: Scene, step: number) => Math.min(Math.max(0, step), scene.frames?.length ?? 0);

let remoteDepth = 0;
/** Vrai pendant l'application d'un changement reçu : il ne doit être ni renvoyé ni réenregistré. */
export const applyingRemote = () => remoteDepth > 0;

export const useEditor = create<EditorState>()((set, get) => ({
  scene: createScene(),
  selection: [],
  tool: { type: "select" },
  activeTeamId: "team-a",
  playerLook: "disc",
  ink: DEFAULT_INK,
  inkWidth: 0.3,
  overlays: { voronoi: false, blockLines: false },
  past: [],
  future: [],
  clipboard: [],
  liveBase: null,
  readOnly: false,
  currentStep: 0,
  hydrated: false,

  commit(label, recipe, coalesceKey, raw) {
    if (get().readOnly) return;
    const { scene, past, currentStep } = get();
    const after = raw ? produce(scene, recipe) : produceAtStep(scene, currentStep, recipe);
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
    if (get().readOnly) return;
    set({ scene: produceAtStep(get().scene, get().currentStep, recipe) });
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
      currentStep: clampStep(entry.before, get().currentStep),
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
      currentStep: clampStep(entry.after, get().currentStep),
      liveBase: null,
    });
  },
  loadScene(scene) {
    set({
      scene,
      past: [],
      future: [],
      selection: [],
      currentStep: 0,
      liveBase: null,
      activeTeamId: scene.teams[0]?.id ?? "team-a",
    });
  },

  setStep(step) {
    set({ currentStep: clampStep(get().scene, step) });
  },
  addStep() {
    if (get().readOnly) return;
    const at = get().currentStep;
    get().commit(
      "addStep",
      (scene) => {
        scene.frames ??= [];
        scene.frames.splice(at, 0, { id: newId(), duration: DEFAULT_STEP_DURATION, moves: {} });
      },
      undefined,
      true,
    );
    set({ currentStep: at + 1 });
  },
  removeStep(step) {
    if (step < 1) return;
    get().commit("removeStep", (scene) => void scene.frames?.splice(step - 1, 1), undefined, true);
    set({ currentStep: clampStep(get().scene, Math.min(get().currentStep, step - 1)) });
  },
  setStepDuration(step, seconds) {
    const duration = Math.min(20, Math.max(0.3, Math.round(seconds * 10) / 10));
    get().commit(
      "stepDuration",
      (scene) => {
        const frame = scene.frames?.[step - 1];
        if (frame) frame.duration = duration;
      },
      `stepDuration:${step}`,
      true,
    );
  },
  updateMoves(patch, coalesceKey) {
    const { scene, selection, currentStep } = get();
    if (currentStep < 1 || !scene.frames?.[currentStep - 1]) return;
    const poses = resolveStep(scene, currentStep);
    get().commit(
      "editMove",
      (draft) => {
        const frame = draft.frames![currentStep - 1];
        for (const id of selection) {
          const pose = poses.get(id);
          if (!pose) continue;
          const current = frame.moves[id] ?? { x: pose.x, y: pose.y, rotation: pose.rotation };
          const next: Move = { ...current, ...patch };
          for (const key of Object.keys(next) as (keyof Move)[]) {
            if (next[key] === undefined) delete next[key];
          }
          frame.moves[id] = next;
        }
      },
      coalesceKey,
      true,
    );
  },
  clearMoves() {
    const { selection, currentStep } = get();
    if (currentStep < 1) return;
    get().commit(
      "clearMove",
      (draft) => {
        const frame = draft.frames?.[currentStep - 1];
        if (frame) for (const id of selection) delete frame.moves[id];
      },
      undefined,
      true,
    );
  },

  applyRemote(patch) {
    const { scene, past, future, liveBase, selection } = get();
    const rebase = (e: HistoryEntry) => ({ ...e, before: applyPatch(e.before, patch), after: applyPatch(e.after, patch) });
    remoteDepth++;
    try {
      const next = applyPatch(scene, patch);
      const ids = new Set(next.objects.map((o) => o.id));
      set({
        scene: next,
        past: past.map(rebase),
        future: future.map(rebase),
        liveBase: liveBase ? applyPatch(liveBase, patch) : null,
        selection: selection.filter((id) => ids.has(id)),
        currentStep: clampStep(next, get().currentStep),
      });
    } finally {
      remoteDepth--;
    }
  },

  replaceScene(scene, label) {
    if (get().readOnly) return;
    const { scene: before, past } = get();
    set({
      scene,
      past: [...past, { label, before, after: scene, time: Date.now() }],
      future: [],
      selection: [],
      liveBase: null,
    });
  },

  setTool: (tool) => set({ tool }),
  setActiveTeam: (id) => set({ activeTeamId: id }),
  setPlayerLook: (look) => set({ playerLook: look }),
  setInk: (color) => set({ ink: color }),
  setInkWidth: (width) => set({ inkWidth: width }),
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
    const side = (Math.max(0, scene.teams.findIndex((t) => t.id === teamId)) % 2) as 0 | 1;
    return get().addObject(
      {
        type: "player",
        x,
        y,
        rotation: facingFor(side, scene.pitch.orientation),
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
      displayObjects(scene, get().currentStep).filter((o) => selection.includes(o.id)),
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
    const picked = displayObjects(scene, get().currentStep).filter((o) => selection.includes(o.id));
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
      displayObjects(scene, get().currentStep).filter((o) => selection.includes(o.id) && !o.locked),
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
      displayObjects(scene, get().currentStep).filter((o) => selection.includes(o.id) && !o.locked),
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
  setFormat(sport, category) {
    get().commit("format", (scene) => {
      if (sport !== scene.pitch.sport) rescaleToPitch(scene, sport);
      if (category === null) delete scene.pitch.category;
      else if (category !== undefined) scene.pitch.category = category;
    }, undefined, true);
  },
  toggleOrientation() {
    get().commit(
      "orientation",
      (scene) => {
        const to = scene.pitch.orientation === "horizontal" ? "vertical" : "horizontal";
        const { length } = getPitch(scene.pitch.sport);
        const turn = (x: number, y: number) =>
          to === "vertical" ? toVertical(x, y, length) : toHorizontal(x, y, length);
        const spins = new Set(
          scene.objects
            .filter((o) => o.type === "equipment" || o.type === "player" || (o.type === "zone" && o.shape !== "polygon"))
            .map((o) => o.id),
        );
        for (const obj of scene.objects) rotateObject(obj, to, length);
        // Les déplacements enregistrés tournent avec le terrain.
        for (const frame of scene.frames ?? []) {
          for (const [id, move] of Object.entries(frame.moves)) {
            const end = turn(move.x, move.y);
            move.x = end.x;
            move.y = end.y;
            if (move.cx !== undefined && move.cy !== undefined) {
              const control = turn(move.cx, move.cy);
              move.cx = control.x;
              move.cy = control.y;
            }
            if (spins.has(id)) move.rotation += to === "vertical" ? -90 : 90;
          }
        }
        scene.pitch.orientation = to;
      },
      undefined,
      true,
    );
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

  composeFromRoster(sceneTeamId, roster, players, formation) {
    const look = get().playerLook;
    get().commit("compose", (scene) => {
      const index = scene.teams.findIndex((t) => t.id === sceneTeamId);
      if (index === -1) return;
      const team = scene.teams[index];
      team.name = roster.name;
      team.color = roster.kit.color;
      team.pattern = roster.kit.pattern;
      team.color2 = roster.kit.color2;
      team.rosterTeamId = roster.id;
      const slots = formationSlots(formation, (index % 2) as 0 | 1, scene.pitch.sport, scene.pitch.orientation);
      const facing = facingFor((index % 2) as 0 | 1, scene.pitch.orientation);
      const lineup = assignLineup(slots, players);
      scene.objects = scene.objects.filter((o) => o.type !== "player" || o.teamId !== sceneTeamId);
      slots.forEach((slot, i) => {
        const player = lineup[i];
        scene.objects.push({
          id: newId(),
          type: "player",
          x: slot.x,
          y: slot.y,
          rotation: facing,
          teamId: sceneTeamId,
          number: player?.number || slot.number,
          name: player ? shortName(player) : "",
          role: player?.position || slot.role,
          look,
          goalkeeper: slot.goalkeeper,
          ...(player ? { rosterId: player.id } : {}),
          ...(player?.photo_path ? { photo: player.photo_path } : {}),
        });
      });
    });
    set({ activeTeamId: sceneTeamId, selection: [] });
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
      const facing = facingFor((index % 2) as 0 | 1, scene.pitch.orientation);
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
          existing.rotation = facing;
          existing.goalkeeper = slot.goalkeeper;
          existing.role = slot.role;
          if (!existing.name) existing.number = slot.number;
        } else {
          scene.objects.push({
            id: newId(),
            type: "player",
            x: slot.x,
            y: slot.y,
            rotation: facing,
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

export function lineDefaults(kind: LineKind, color: string, inkWidth = 0.3) {
  const style = LINE_STYLES[kind];
  return { kind, color, curved: false, ...style, width: style.width * (inkWidth / 0.3) };
}
