import type { Frame, PitchSettings, Scene, SceneObject, Team } from "../scene/types";

/**
 * Différence entre deux versions d'une scène, objet par objet. Deux entraîneurs qui modifient des
 * objets différents ne s'écrasent pas : seuls les objets touchés voyagent. Les réglages (terrain,
 * équipes, étapes) sont remplacés en bloc, le dernier qui écrit l'emporte. Sans dépendance au DOM.
 */
export interface ScenePatch {
  upsert?: SceneObject[];
  remove?: string[];
  /** Ordre d'empilement complet, s'il a changé. */
  order?: string[];
  pitch?: PitchSettings;
  teams?: Team[];
  frames?: Frame[] | null;
  hideFacing?: boolean | null;
}

/** Ce qui a changé de `prev` à `next` ; null si rien. Repose sur le partage structurel d'Immer. */
export function diffScenes(prev: Scene, next: Scene): ScenePatch | null {
  if (prev === next) return null;
  const patch: ScenePatch = {};
  if (prev.objects !== next.objects) {
    const before = new Map(prev.objects.map((o) => [o.id, o]));
    const after = new Set(next.objects.map((o) => o.id));
    const upsert = next.objects.filter((o) => before.get(o.id) !== o);
    const remove = prev.objects.filter((o) => !after.has(o.id)).map((o) => o.id);
    if (upsert.length) patch.upsert = upsert;
    if (remove.length) patch.remove = remove;
    const kept = prev.objects.filter((o) => after.has(o.id)).map((o) => o.id);
    const nextOrder = next.objects.map((o) => o.id).filter((id) => before.has(id));
    if (kept.join() !== nextOrder.join() || upsert.some((o) => !before.has(o.id))) {
      patch.order = next.objects.map((o) => o.id);
    }
  }
  if (prev.pitch !== next.pitch) patch.pitch = next.pitch;
  if (prev.teams !== next.teams) patch.teams = next.teams;
  if (prev.frames !== next.frames) patch.frames = next.frames ?? null;
  if (prev.hideFacing !== next.hideFacing) patch.hideFacing = next.hideFacing ?? null;
  return Object.keys(patch).length ? patch : null;
}

/**
 * Applique une différence reçue. Les objets inconnus de l'ordre reçu (créés ici entre-temps)
 * gardent leur place relative, après les autres.
 */
export function applyPatch(scene: Scene, patch: ScenePatch): Scene {
  let objects = scene.objects;
  if (patch.upsert || patch.remove || patch.order) {
    const removed = new Set(patch.remove ?? []);
    const byId = new Map(objects.filter((o) => !removed.has(o.id)).map((o) => [o.id, o]));
    for (const obj of patch.upsert ?? []) if (!removed.has(obj.id)) byId.set(obj.id, obj);
    if (patch.order) {
      const rank = new Map(patch.order.map((id, i) => [id, i]));
      const local = objects.map((o) => o.id);
      const ids = [...byId.keys()];
      ids.sort((a, b) => {
        const ra = rank.get(a);
        const rb = rank.get(b);
        if (ra !== undefined && rb !== undefined) return ra - rb;
        if (ra !== undefined) return -1;
        if (rb !== undefined) return 1;
        return local.indexOf(a) - local.indexOf(b);
      });
      objects = ids.map((id) => byId.get(id)!);
    } else {
      // Sans ordre : on garde l'ordre local, les nouveaux objets en dernier.
      const seen = new Set<string>();
      const next: SceneObject[] = [];
      for (const o of objects) {
        const current = byId.get(o.id);
        if (current) {
          next.push(current);
          seen.add(o.id);
        }
      }
      for (const [id, o] of byId) if (!seen.has(id)) next.push(o);
      objects = next;
    }
  }
  const out: Scene = { ...scene, objects };
  if (patch.pitch) out.pitch = patch.pitch;
  if (patch.teams) out.teams = patch.teams;
  if (patch.frames !== undefined) {
    if (patch.frames === null) delete out.frames;
    else out.frames = patch.frames;
  }
  if (patch.hideFacing !== undefined) {
    if (patch.hideFacing) out.hideFacing = true;
    else delete out.hideFacing;
  }
  return out;
}

/** Fusionne deux différences successives (la seconde l'emporte). */
export function mergePatches(a: ScenePatch | null, b: ScenePatch | null): ScenePatch | null {
  if (!a) return b;
  if (!b) return a;
  const upsert = new Map((a.upsert ?? []).map((o) => [o.id, o]));
  for (const o of b.upsert ?? []) upsert.set(o.id, o);
  const remove = new Set([...(a.remove ?? []), ...(b.remove ?? [])]);
  for (const id of b.remove ?? []) upsert.delete(id);
  for (const o of b.upsert ?? []) remove.delete(o.id);
  const out: ScenePatch = { ...a, ...b };
  if (upsert.size) out.upsert = [...upsert.values()];
  else delete out.upsert;
  if (remove.size) out.remove = [...remove];
  else delete out.remove;
  return out;
}
