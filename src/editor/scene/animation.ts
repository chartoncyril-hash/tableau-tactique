import type { Easing, Frame, Move, Scene } from "./types";

export interface Pose {
  x: number;
  y: number;
  rotation: number;
  /** Hauteur au-dessus du sol, en mètres (ballon en cloche). */
  lift: number;
}

/** Décalage du ballon par rapport au joueur qui le conduit. */
export const ATTACH_OFFSET = { x: 1.9, y: 1.1 };
export const DEFAULT_STEP_DURATION = 2;

const EASE: Record<Easing, (t: number) => number> = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => t * (2 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Avancement propre à un déplacement (0 à 1) pour un avancement `p` de l'étape. */
export function moveProgress(move: Move, p: number): number {
  const delay = Math.min(0.8, Math.max(0, move.delay ?? 0));
  const span = Math.min(1 - delay, Math.max(0.2, move.span ?? 1));
  return EASE[move.ease ?? "inOut"](clamp01((p - delay) / span));
}

function along(from: Pose, move: Move, q: number): Pose {
  const u = 1 - q;
  const curved = move.cx !== undefined && move.cy !== undefined;
  const x = curved ? u * u * from.x + 2 * u * q * move.cx! + q * q * move.x : from.x + (move.x - from.x) * q;
  const y = curved ? u * u * from.y + 2 * u * q * move.cy! + q * q * move.y : from.y + (move.y - from.y) * q;
  return {
    x,
    y,
    rotation: from.rotation + (move.rotation - from.rotation) * q,
    lift: (move.arc ?? 0) * 4 * q * u,
  };
}

function basePoses(scene: Scene): Map<string, Pose> {
  return new Map(scene.objects.map((o) => [o.id, { x: o.x, y: o.y, rotation: o.rotation, lift: 0 }]));
}

function applyFrame(poses: Map<string, Pose>, frame: Frame, p: number) {
  const attached: [string, string][] = [];
  for (const [id, move] of Object.entries(frame.moves)) {
    const from = poses.get(id);
    if (!from) continue;
    if (move.attach && poses.has(move.attach)) attached.push([id, move.attach]);
    else poses.set(id, along(from, move, p >= 1 ? 1 : moveProgress(move, p)));
  }
  // Les ballons conduits suivent leur joueur, une fois celui-ci placé.
  for (const [id, playerId] of attached) {
    const player = poses.get(playerId)!;
    poses.set(id, { x: player.x + ATTACH_OFFSET.x, y: player.y + ATTACH_OFFSET.y, rotation: 0, lift: 0 });
  }
}

/** Poses de tous les objets à la fin de l'étape `step` (0 = départ). */
export function resolveStep(scene: Scene, step: number): Map<string, Pose> {
  const poses = basePoses(scene);
  const frames = scene.frames ?? [];
  for (let i = 0; i < Math.min(step, frames.length); i++) applyFrame(poses, frames[i], 1);
  return poses;
}

/** Poses pendant l'étape `step` (à partir de 1), à l'avancement `p` (0 à 1). */
export function posesAt(scene: Scene, step: number, p: number): Map<string, Pose> {
  const poses = resolveStep(scene, step - 1);
  const frame = scene.frames?.[step - 1];
  if (frame) applyFrame(poses, frame, clamp01(p));
  return poses;
}

export function totalDuration(scene: Scene): number {
  return (scene.frames ?? []).reduce((sum, f) => sum + f.duration, 0);
}

/** Étape et avancement correspondant à un instant de la lecture. */
export function locate(scene: Scene, time: number): { step: number; p: number } {
  const frames = scene.frames ?? [];
  if (frames.length === 0) return { step: 0, p: 0 };
  let start = 0;
  for (let i = 0; i < frames.length; i++) {
    const end = start + frames[i].duration;
    if (time < end || i === frames.length - 1) {
      return { step: i + 1, p: clamp01((time - start) / frames[i].duration) };
    }
    start = end;
  }
  return { step: frames.length, p: 1 };
}

/** Instant du début de l'étape `step` (à partir de 1). */
export function stepStart(scene: Scene, step: number): number {
  return (scene.frames ?? []).slice(0, Math.max(0, step - 1)).reduce((sum, f) => sum + f.duration, 0);
}

/** Tracé d'un déplacement, pour l'affichage des traces. */
export function movePath(from: { x: number; y: number }, move: Move, samples = 20): number[] {
  if (move.cx === undefined || move.cy === undefined) return [from.x, from.y, move.x, move.y];
  const origin: Pose = { x: from.x, y: from.y, rotation: 0, lift: 0 };
  const out: number[] = [];
  for (let i = 0; i <= samples; i++) {
    const pose = along(origin, move, i / samples);
    out.push(pose.x, pose.y);
  }
  return out;
}

export interface StepTrace {
  id: string;
  start: Pose;
  move: Move;
}

/** Déplacements de l'étape `step` à tracer (ni ballons conduits, ni petits pas sur place). */
export function stepTraces(scene: Scene, step: number): StepTrace[] {
  const frame = step >= 1 ? scene.frames?.[step - 1] : undefined;
  if (!frame) return [];
  const from = resolveStep(scene, step - 1);
  return Object.entries(frame.moves).flatMap(([id, move]) => {
    const start = from.get(id);
    if (!start || move.attach) return [];
    if (Math.hypot(move.x - start.x, move.y - start.y) < 0.3) return [];
    return [{ id, start, move }];
  });
}

/** Tracé en relief d'un déplacement : la cloche d'un ballon y est visible. */
export function movePath3d(from: { x: number; y: number }, move: Move, samples = 32): Pose[] {
  const origin: Pose = { x: from.x, y: from.y, rotation: 0, lift: 0 };
  return Array.from({ length: samples + 1 }, (_, i) => along(origin, move, i / samples));
}
