import { viewRect } from "../pitches";
import type { Box } from "../scene/geometry";
import type { PitchSettings, SceneObject } from "../scene/types";

/**
 * Passage du plan 2D (mètres, y vers le bas) à la scène 3D (y vers le haut) : le point (x, y) du
 * tableau devient (x - cx, 0, y - cy), le centre du cadrage affiché étant à l'origine.
 * Sans dépendance à three.js : testé seul.
 */

export function sceneOrigin(pitch: PitchSettings) {
  const view = viewRect(pitch);
  return { x: view.x + view.w / 2, y: view.y + view.h / 2 };
}

export function toWorld(x: number, y: number, origin: { x: number; y: number }): [number, number, number] {
  return [x - origin.x, 0, y - origin.y];
}

/** Rotation horaire à l'écran (degrés) → rotation autour de l'axe vertical (radians). */
export function yaw(rotation: number) {
  return (-rotation * Math.PI) / 180;
}

/** Dessins posés au sol (texture de la pelouse) : zones, tracés, textes. */
export function isGroundDrawing(obj: SceneObject) {
  return obj.type === "zone" || obj.type === "line" || obj.type === "freehand" || obj.type === "text";
}

export const CAMERA_PRESETS = ["broadcast", "top", "goal", "corner"] as const;
export type CameraPreset = (typeof CAMERA_PRESETS)[number];

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

/**
 * Positions de caméra pour le cadrage affiché. « broadcast » : vue de tribune, depuis le bord long
 * situé en bas de l'écran ; « goal » : derrière le but de gauche (horizontal) ou du bas (vertical).
 */
export function cameraPose(preset: CameraPreset, view: Box, vertical: boolean, fov: number, aspect: number): CameraPose {
  const t = Math.tan(((fov / 2) * Math.PI) / 180);
  const long = vertical ? view.h : view.w;
  const short = vertical ? view.w : view.h;
  const target: [number, number, number] = [0, 0, 0];
  // Distance pour que le terrain tienne dans l'image, en largeur comme en hauteur.
  const fit = (width: number, depth: number) => Math.max(width / 2 / (t * aspect), depth / 2 / t) * 1.08;
  const along = (a: number, b: number, elevation: number, dist: number, alongLong: boolean): [number, number, number] => {
    const e = (elevation * Math.PI) / 180;
    const h = Math.sin(e) * dist;
    const g = Math.cos(e) * dist;
    // alongLong : la caméra regarde dans l'axe du terrain ; sinon elle se tient sur le bord long.
    if (vertical) return alongLong ? [a, h, g + b] : [g + b, h, a];
    return alongLong ? [-(g + b), h, a] : [a, h, g + b];
  };
  switch (preset) {
    case "top": {
      const d = fit(view.w, view.h);
      // Léger décalage : évite l'indétermination de la caméra à la verticale exacte.
      return { position: [0, d, 0.001], target };
    }
    case "broadcast":
      return {
        position: along(0, short * 0.1, 30, fit(long, short * 0.8) * 1.12, false),
        target,
      };
    case "goal":
      return {
        position: along(0, long * 0.08, 24, fit(short, long * 0.6) * 1.1, true),
        target,
      };
    case "corner": {
      const d = fit(long, short) * 0.95;
      const e = (30 * Math.PI) / 180;
      const h = Math.sin(e) * d;
      const g = (Math.cos(e) * d) / Math.SQRT2;
      return { position: vertical ? [g, h, g] : [-g, h, g], target };
    }
  }
}

/**
 * En 2D, un joueur est une pastille de 3,2 m et le ballon un disque de 1,5 m : un ballon posé
 * « juste devant » un joueur a son centre à 2,3 m du sien. En relief, le joueur est mince et ce
 * même ballon semblerait loin de ses pieds. Un ballon proche d'un joueur est donc rapproché :
 * au contact sur le tableau, il est dans les pieds en 3D ; au-delà de `reach`, rien ne change.
 */
export const BALL_CONTACT_2D = 2.35;
const BALL_REACH_2D = BALL_CONTACT_2D + 1.6;

export function ballAtFeet(
  ball: { x: number; y: number },
  players: Iterable<{ x: number; y: number }>,
  feet: number,
): { x: number; y: number } {
  let nearest: { x: number; y: number } | null = null;
  let best = BALL_REACH_2D;
  for (const p of players) {
    const d = Math.hypot(ball.x - p.x, ball.y - p.y);
    if (d < best) {
      best = d;
      nearest = p;
    }
  }
  if (!nearest || best < 1e-3) return ball;
  const d =
    best <= BALL_CONTACT_2D
      ? feet
      : feet + ((best - BALL_CONTACT_2D) * (BALL_REACH_2D - feet)) / (BALL_REACH_2D - BALL_CONTACT_2D);
  const k = d / best;
  return {
    x: nearest.x + (ball.x - nearest.x) * k,
    y: nearest.y + (ball.y - nearest.y) * k,
  };
}
