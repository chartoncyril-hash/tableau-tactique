import { create } from "zustand";
import {
  insertBoard,
  insertVersion,
  listVersions,
  loadProject,
  loadVersionScene,
  updateBoard,
  updateProject,
} from "@/lib/data/api";
import type { BoardRow, ProjectRow, VersionMeta } from "@/lib/data/types";
import { readDrillSheet, readSessionSheet, type DrillSheet, type SessionSheet } from "@/lib/sheet";
import { createScene, migrateScene } from "./scene/defaults";
import type { Scene } from "./scene/types";
import { useEditor } from "./store";

/**
 * Session d'édition d'un projet enregistré : charge les tableaux, bascule de l'un à l'autre,
 * enregistre en différé uniquement les tableaux modifiés et prend des versions restaurables.
 */
export type SaveState = "saved" | "dirty" | "saving" | "error";

interface ProjectState {
  status: "idle" | "loading" | "ready" | "missing" | "error";
  project: ProjectRow | null;
  boards: BoardRow[];
  currentId: string | null;
  saveState: SaveState;
}

const initial: ProjectState = {
  status: "idle",
  project: null,
  boards: [],
  currentId: null,
  saveState: "saved",
};

export const useProject = create<ProjectState>(() => initial);

const SAVE_DELAY = 1200;
const RETRY_DELAY = 5000;
const META_DELAY = 800;
const VERSION_INTERVAL = 5 * 60_000;

/** Scènes en attente d'enregistrement, par tableau. */
const dirty = new Map<string, Scene>();
/** Scène telle qu'ouverte : sert de point de restauration « avant cette session ». */
const baseline = new Map<string, Scene>();
const lastVersionAt = new Map<string, number>();
const metaTimers = new Map<string, ReturnType<typeof setTimeout>>();
/** Écritures différées en attente (fiches, notes, vidéo), par clé. */
const metaJobs = new Map<string, () => Promise<void>>();

function deferMeta(key: string, job: () => Promise<void>) {
  clearTimeout(metaTimers.get(key));
  metaJobs.set(key, job);
  useProject.setState({ saveState: "dirty" });
  metaTimers.set(key, setTimeout(() => void runMeta(key), META_DELAY));
}

async function runMeta(key: string) {
  clearTimeout(metaTimers.get(key));
  metaTimers.delete(key);
  const job = metaJobs.get(key);
  metaJobs.delete(key);
  if (!job) return;
  try {
    await job();
    if (metaTimers.size === 0 && dirty.size === 0) useProject.setState({ saveState: "saved" });
  } catch {
    useProject.setState({ saveState: "error" });
  }
}

/** Envoie tout de suite les écritures différées (avant un partage, un export ou une fermeture). */
export async function flushMeta() {
  await Promise.all([...metaJobs.keys()].map(runMeta));
}
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saving = false;
let switching = false;
let unsubscribe: (() => void) | undefined;
let session = 0;

const patchBoard = (id: string, patch: Partial<BoardRow>) =>
  useProject.setState((s) => ({ boards: s.boards.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));

function showScene(scene: Scene) {
  switching = true;
  useEditor.getState().loadScene(scene);
  switching = false;
}

function schedule(delay = SAVE_DELAY) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void flush(), delay);
}

export async function flush() {
  await flushMeta();
  clearTimeout(saveTimer);
  if (saving || dirty.size === 0) return;
  saving = true;
  useProject.setState({ saveState: "saving" });
  let failed = false;
  try {
    for (const [id, scene] of [...dirty]) {
      if (!lastVersionAt.has(id)) {
        const before = baseline.get(id);
        if (before) await insertVersion(id, before);
        lastVersionAt.set(id, Date.now());
      }
      await updateBoard(id, { scene });
      if (dirty.get(id) === scene) dirty.delete(id);
      if (Date.now() - (lastVersionAt.get(id) ?? 0) > VERSION_INTERVAL) {
        await insertVersion(id, scene);
        lastVersionAt.set(id, Date.now());
      }
    }
  } catch {
    failed = true;
  } finally {
    saving = false;
  }
  useProject.setState({ saveState: failed ? "error" : dirty.size ? "dirty" : "saved" });
  if (dirty.size) schedule(failed ? RETRY_DELAY : SAVE_DELAY);
}

const onHide = () => {
  if (document.visibilityState === "hidden") void flush();
};

/** Ouvre un projet ; `boardId` choisit le tableau affiché au départ. */
export async function openProject(id: string, boardId?: string) {
  const mine = ++session;
  closeListeners();
  useProject.setState({ ...initial, status: "loading" });
  useEditor.setState({ hydrated: false });
  try {
    const data = await loadProject(id);
    if (mine !== session) return;
    if (!data || data.boards.length === 0) {
      useProject.setState({ status: "missing" });
      return;
    }
    const boards = data.boards.map((b) => ({
      ...b,
      sheet: readDrillSheet(b.sheet),
      scene: migrateScene(b.scene) ?? createScene(),
    }));
    const project = { ...data.project, sheet: readSessionSheet(data.project.sheet) };
    for (const b of boards) baseline.set(b.id, b.scene);
    const first = boards.find((b) => b.id === boardId) ?? boards[0];
    useProject.setState({ status: "ready", project, boards, currentId: first.id });
    showScene(first.scene);
    useEditor.setState({ hydrated: true });

    unsubscribe = useEditor.subscribe((state, previous) => {
      if (switching || state.scene === previous.scene) return;
      const current = useProject.getState().currentId;
      if (!current) return;
      dirty.set(current, state.scene);
      useProject.setState({ saveState: "dirty" });
      schedule();
    });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
  } catch {
    if (mine === session) useProject.setState({ status: "error" });
  }
}

function closeListeners() {
  unsubscribe?.();
  unsubscribe = undefined;
  document.removeEventListener("visibilitychange", onHide);
  window.removeEventListener("pagehide", onHide);
}

export function closeProject() {
  session++;
  // flush envoie aussi les fiches et notes en attente : rien n'est perdu en quittant la page.
  void flush();
  closeListeners();
  baseline.clear();
  lastVersionAt.clear();
  useProject.setState(initial);
  useEditor.setState({ hydrated: false });
}

/** Range la scène affichée dans la liste locale avant de changer de tableau. */
function stashCurrent() {
  const { currentId } = useProject.getState();
  if (currentId) patchBoard(currentId, { scene: useEditor.getState().scene });
}

export function selectBoard(id: string) {
  const { currentId, boards } = useProject.getState();
  const next = boards.find((b) => b.id === id);
  if (!next || id === currentId) return;
  stashCurrent();
  useProject.setState({ currentId: id });
  showScene(next.scene);
}

async function appendBoard(
  name: string,
  scene: Scene,
  extra: Partial<Pick<BoardRow, "notes" | "video_url" | "sheet">> = {},
) {
  const { project, boards } = useProject.getState();
  if (!project) return;
  const position = Math.max(-1, ...boards.map((b) => b.position)) + 1;
  const row = await insertBoard({ project_id: project.id, name, scene, position, ...extra });
  const board = { ...row, sheet: readDrillSheet(row.sheet), scene: migrateScene(row.scene) ?? scene };
  baseline.set(board.id, board.scene);
  useProject.setState((s) => ({ boards: [...s.boards, board] }));
  selectBoard(board.id);
}

/** Nouveau tableau vide, avec le même terrain et les mêmes équipes que le tableau affiché. */
export function addBoard(name: string) {
  // Même terrain et mêmes équipes, mais ni objets ni étapes d'animation.
  return appendBoard(name, { ...useEditor.getState().scene, objects: [], frames: [] });
}

export function duplicateBoard(name: string) {
  const { boards, currentId } = useProject.getState();
  const current = boards.find((b) => b.id === currentId);
  return appendBoard(name, useEditor.getState().scene, {
    notes: current?.notes ?? "",
    video_url: current?.video_url ?? null,
    sheet: current?.sheet ?? {},
  });
}

export async function renameBoard(id: string, name: string) {
  const clean = name.trim().slice(0, 120);
  if (!clean) return;
  patchBoard(id, { name: clean });
  await updateBoard(id, { name: clean });
}

export async function removeBoard(id: string) {
  const { boards, currentId } = useProject.getState();
  if (boards.length <= 1) return;
  const index = boards.findIndex((b) => b.id === id);
  if (index === -1) return;
  if (id === currentId) selectBoard(boards[index === 0 ? 1 : index - 1].id);
  dirty.delete(id);
  useProject.setState((s) => ({ boards: s.boards.filter((b) => b.id !== id) }));
  await updateBoard(id, { deleted_at: new Date().toISOString() });
}

/** Notes et lien vidéo : affichage immédiat, enregistrement différé. */
export function setBoardMeta(id: string, patch: Partial<Pick<BoardRow, "notes" | "video_url" | "sheet">>) {
  patchBoard(id, patch);
  deferMeta(`${id}:${Object.keys(patch).join(",")}`, () => updateBoard(id, patch));
}

export async function renameProject(name: string) {
  const { project } = useProject.getState();
  const clean = name.trim().slice(0, 120);
  if (!project || !clean || clean === project.name) return;
  useProject.setState({ project: { ...project, name: clean } });
  await updateProject(project.id, { name: clean });
}

export async function fetchVersions(): Promise<VersionMeta[]> {
  const { currentId } = useProject.getState();
  return currentId ? listVersions(currentId) : [];
}

/** Restaure une version dans l'éditeur ; l'opération reste annulable. */
export async function restoreVersion(id: string) {
  const scene = migrateScene(await loadVersionScene(id));
  if (scene) useEditor.getState().replaceScene(scene, "restoreVersion");
}

/** Modifie un champ de la fiche d'exercice du tableau affiché. */
export function setDrillField<K extends keyof DrillSheet>(key: K, value: DrillSheet[K] | "") {
  const { currentId } = useProject.getState();
  if (currentId) setBoardSheetField(currentId, key, value);
}

/** Modifie un champ de la fiche d'exercice d'un tableau ; enregistrement différé. */
export function setBoardSheetField<K extends keyof DrillSheet>(boardId: string, key: K, value: DrillSheet[K] | "") {
  const board = useProject.getState().boards.find((b) => b.id === boardId);
  if (!board) return;
  const sheet: DrillSheet = { ...board.sheet };
  if (value) sheet[key] = value as DrillSheet[K];
  else delete sheet[key];
  setBoardMeta(board.id, { sheet });
}


/** Modifie un champ de l'en-tête de la fiche de séance ; enregistrement différé. */
export function setSessionField(key: keyof SessionSheet, value: string) {
  const { project } = useProject.getState();
  if (!project) return;
  const sheet: SessionSheet = { ...project.sheet };
  if (value) sheet[key] = value;
  else delete sheet[key];
  useProject.setState({ project: { ...project, sheet } });
  deferMeta("project:sheet", async () => {
    const current = useProject.getState().project;
    if (current) await updateProject(current.id, { sheet: current.sheet });
  });
}

/** Déplace un tableau d'un cran vers le début (-1) ou la fin (+1) du projet. */
export async function moveBoard(id: string, delta: -1 | 1) {
  const { boards } = useProject.getState();
  const index = boards.findIndex((b) => b.id === id);
  const other = boards[index + delta];
  if (index === -1 || !other) return;
  const a = boards[index];
  const next = [...boards];
  next[index] = { ...other, position: a.position };
  next[index + delta] = { ...a, position: other.position };
  // Positions égales (anciens tableaux) : on les rend distinctes.
  if (a.position === other.position) next.forEach((b, i) => (next[i] = { ...b, position: i }));
  useProject.setState({ boards: next });
  useProject.setState({ saveState: "saving" });
  try {
    await Promise.all(
      next
        .filter((b) => boards.find((o) => o.id === b.id)?.position !== b.position)
        .map((b) => updateBoard(b.id, { position: b.position })),
    );
    useProject.setState({ saveState: dirty.size || metaTimers.size ? "dirty" : "saved" });
  } catch {
    useProject.setState({ saveState: "error" });
  }
}

/** Tous les tableaux du projet, celui affiché avec sa scène à jour (pour la fiche PDF). */
export function sessionSnapshot() {
  stashCurrent();
  const { project, boards } = useProject.getState();
  return project ? { name: project.name, sheet: project.sheet, boards } : null;
}
