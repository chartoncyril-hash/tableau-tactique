import { describe, expect, it } from "vitest";
import { createScene } from "../scene/defaults";
import { ballAtFeet, cameraPose, isGroundDrawing, sceneOrigin, toWorld, yaw } from "./layout";

const pitch = createScene().pitch;
const view = { x: -55, y: -36, w: 110, h: 72 };

describe("repère 3D", () => {
  it("place le centre du cadrage à l'origine", () => {
    const o = sceneOrigin({
      ...pitch,
      view: "full",
      orientation: "horizontal",
    });
    expect(toWorld(o.x, o.y, o)).toEqual([0, 0, 0]);
    expect(toWorld(o.x + 10, o.y + 5, o)).toEqual([10, 0, 5]);
  });

  it("change le sens de rotation (horaire à l'écran = négatif autour de y)", () => {
    expect(yaw(90)).toBeCloseTo(-Math.PI / 2);
    expect(yaw(0)).toBeCloseTo(0);
  });

  it("pose zones, tracés et textes au sol, pas les joueurs ni le matériel", () => {
    const base = { id: "a", x: 0, y: 0, rotation: 0 };
    expect(
      isGroundDrawing({
        ...base,
        type: "zone",
        shape: "rect",
        width: 1,
        height: 1,
        points: [],
        fill: "#fff",
        opacity: 1,
      }),
    ).toBe(true);
    expect(isGroundDrawing({ ...base, type: "ball" })).toBe(false);
    expect(
      isGroundDrawing({
        ...base,
        type: "equipment",
        kind: "cone",
        color: "#f00",
        scale: 1,
      }),
    ).toBe(false);
  });
});

describe("points de vue", () => {
  it("vue de dessus : à la verticale du centre, assez haut pour tout voir", () => {
    const pose = cameraPose("top", view, false, 40, 16 / 9);
    expect(pose.position[0]).toBe(0);
    expect(pose.position[1]).toBeGreaterThan(80);
    expect(pose.target).toEqual([0, 0, 0]);
  });

  it("tribune : sur le bord long en bas de l'écran (horizontal), sur le côté (vertical)", () => {
    const h = cameraPose("broadcast", view, false, 40, 16 / 9).position;
    expect(h[0]).toBe(0);
    expect(h[2]).toBeGreaterThan(30);
    const v = cameraPose("broadcast", { x: -36, y: -55, w: 72, h: 110 }, true, 40, 16 / 9).position;
    expect(v[0]).toBeGreaterThan(30);
    expect(v[2]).toBe(0);
  });

  it("derrière le but : à gauche du terrain horizontal, en bas du terrain vertical", () => {
    expect(cameraPose("goal", view, false, 40, 1.5).position[0]).toBeLessThan(-50);
    expect(cameraPose("goal", { x: -36, y: -55, w: 72, h: 110 }, true, 40, 1.5).position[2]).toBeGreaterThan(50);
  });

  it("recule la caméra sur un écran étroit", () => {
    const wide = cameraPose("top", view, false, 40, 2).position[1];
    const narrow = cameraPose("top", view, false, 40, 0.5).position[1];
    expect(narrow).toBeGreaterThan(wide);
  });
});

describe("ballAtFeet", () => {
  const player = { x: 50, y: 30 };
  it("met dans les pieds un ballon au contact de la pastille", () => {
    const at = ballAtFeet({ x: 52.3, y: 30 }, [player], 0.6);
    expect(at.x).toBeCloseTo(50.6);
    expect(at.y).toBeCloseTo(30);
  });
  it("garde la direction du ballon par rapport au joueur", () => {
    const at = ballAtFeet({ x: 50, y: 28 }, [player], 0.6);
    expect(at.x).toBeCloseTo(50);
    expect(at.y).toBeCloseTo(29.4);
  });
  it("ne touche pas un ballon éloigné", () => {
    expect(ballAtFeet({ x: 60, y: 30 }, [player], 0.6)).toEqual({
      x: 60,
      y: 30,
    });
  });
  it("raccorde sans saut à la limite de la zone", () => {
    const edge = ballAtFeet({ x: 53.94, y: 30 }, [player], 0.6);
    expect(edge.x).toBeCloseTo(53.94, 1);
  });
  it("choisit le joueur le plus proche", () => {
    const at = ballAtFeet({ x: 52, y: 30 }, [player, { x: 55, y: 30 }], 0.6);
    expect(at.x).toBeCloseTo(50.6);
  });
});
