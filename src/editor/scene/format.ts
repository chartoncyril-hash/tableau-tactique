import type { Draft } from "immer";
import { getPitch } from "../pitches";
import type { Scene } from "./types";

/**
 * Change de terrain (foot à 11, 8 ou 5) en gardant le schéma lisible : positions, tracés et
 * déplacements sont mis à l'échelle du nouveau terrain, sur la longueur et sur la largeur.
 * Les tailles des joueurs, ballons et du matériel ne changent pas.
 */
export function rescaleToPitch(scene: Draft<Scene>, sport: string) {
  const from = getPitch(scene.pitch.sport);
  const to = getPitch(sport);
  const vertical = scene.pitch.orientation === "vertical";
  const kl = to.length / from.length;
  const kw = to.width / from.width;
  const sx = vertical ? kw : kl;
  const sy = vertical ? kl : kw;
  const scalePoints = (points: number[]) => {
    for (let i = 0; i < points.length; i += 2) {
      points[i] *= sx;
      points[i + 1] *= sy;
    }
  };
  for (const obj of scene.objects) {
    obj.x *= sx;
    obj.y *= sy;
    if (obj.type === "line" || obj.type === "freehand") scalePoints(obj.points);
    else if (obj.type === "zone") {
      if (obj.shape === "polygon") scalePoints(obj.points);
      else {
        obj.width *= sx;
        obj.height *= sy;
      }
    }
  }
  for (const frame of scene.frames ?? []) {
    for (const move of Object.values(frame.moves)) {
      move.x *= sx;
      move.y *= sy;
      if (move.cx !== undefined && move.cy !== undefined) {
        move.cx *= sx;
        move.cy *= sy;
      }
    }
  }
  scene.pitch.sport = sport;
}
