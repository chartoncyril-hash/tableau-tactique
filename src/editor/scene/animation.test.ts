import { describe, expect, it } from "vitest";
import { ATTACH_OFFSET, locate, movePath, moveProgress, posesAt, resolveStep, stepStart, totalDuration } from "./animation";
import { createScene } from "./defaults";
import type { Scene } from "./types";

function scene(): Scene {
  return {
    ...createScene(),
    objects: [
      { id: "p", type: "player", x: 0, y: 0, rotation: 0, teamId: "team-a", number: "9", name: "", role: "", look: "disc", goalkeeper: false },
      { id: "b", type: "ball", x: 2, y: 0, rotation: 0 },
      { id: "c", type: "ball", x: 50, y: 50, rotation: 0 },
    ],
    frames: [
      { id: "f1", duration: 2, moves: { p: { x: 10, y: 0, rotation: 0, ease: "linear" }, b: { x: 0, y: 0, rotation: 0, attach: "p" } } },
      { id: "f2", duration: 4, moves: { b: { x: 40, y: 0, rotation: 0, ease: "linear", arc: 8 } } },
    ],
  };
}

describe("résolution des étapes", () => {
  it("garde les positions de départ à l'étape 0", () => {
    expect(resolveStep(scene(), 0).get("p")).toMatchObject({ x: 0, y: 0 });
  });

  it("cumule les déplacements et laisse immobiles les objets sans déplacement", () => {
    const end = resolveStep(scene(), 2);
    expect(end.get("p")).toMatchObject({ x: 10, y: 0 });
    expect(end.get("b")).toMatchObject({ x: 40, y: 0, lift: 0 });
    expect(end.get("c")).toMatchObject({ x: 50, y: 50 });
  });

  it("ne dépasse pas la dernière étape", () => {
    expect(resolveStep(scene(), 99).get("b")?.x).toBe(40);
  });
});

describe("interpolation", () => {
  it("place l'objet à mi-chemin au milieu d'une étape linéaire", () => {
    expect(posesAt(scene(), 1, 0.5).get("p")?.x).toBeCloseTo(5);
  });

  it("fait suivre le joueur au ballon conduit", () => {
    const poses = posesAt(scene(), 1, 0.5);
    expect(poses.get("b")?.x).toBeCloseTo(5 + ATTACH_OFFSET.x);
    expect(poses.get("b")?.y).toBeCloseTo(ATTACH_OFFSET.y);
  });

  it("élève le ballon au sommet de la cloche puis le repose", () => {
    const from = resolveStep(scene(), 1).get("b")!;
    const mid = posesAt(scene(), 2, 0.5).get("b")!;
    expect(mid.lift).toBeCloseTo(8);
    expect(mid.x).toBeCloseTo((from.x + 40) / 2);
    expect(posesAt(scene(), 2, 1).get("b")?.lift).toBe(0);
  });

  it("suit une trajectoire courbe par son point de contrôle", () => {
    const s = scene();
    s.frames![0].moves.p = { x: 10, y: 0, rotation: 0, cx: 5, cy: 10, ease: "linear" };
    expect(posesAt(s, 1, 0.5).get("p")).toMatchObject({ x: 5, y: 5 });
    expect(movePath({ x: 0, y: 0 }, s.frames![0].moves.p, 2)).toEqual([0, 0, 5, 5, 10, 0]);
  });

  it("applique le retard et la durée propres à un déplacement", () => {
    const move = { x: 1, y: 0, rotation: 0, ease: "linear" as const, delay: 0.5, span: 0.25 };
    expect(moveProgress(move, 0.4)).toBe(0);
    expect(moveProgress(move, 0.625)).toBeCloseTo(0.5);
    expect(moveProgress(move, 0.8)).toBe(1);
  });

  it("accélère puis ralentit par défaut", () => {
    const move = { x: 1, y: 0, rotation: 0 };
    expect(moveProgress(move, 0.25)).toBeLessThan(0.25);
    expect(moveProgress(move, 0.75)).toBeGreaterThan(0.75);
  });
});

describe("ligne de temps", () => {
  it("additionne les durées", () => {
    expect(totalDuration(scene())).toBe(6);
    expect(stepStart(scene(), 2)).toBe(2);
  });

  it("retrouve l'étape et l'avancement d'un instant", () => {
    expect(locate(scene(), 1)).toEqual({ step: 1, p: 0.5 });
    expect(locate(scene(), 4)).toEqual({ step: 2, p: 0.5 });
    expect(locate(scene(), 99)).toEqual({ step: 2, p: 1 });
    expect(locate(createScene(), 3)).toEqual({ step: 0, p: 0 });
  });
});
