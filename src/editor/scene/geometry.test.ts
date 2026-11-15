import { describe, expect, it } from "vitest";
import {
  alignDeltas,
  clusterLines,
  distributeDeltas,
  sampleLine,
  simplify,
  snapPoint,
} from "./geometry";
import type { SceneObject } from "./types";

const ball = (id: string, x: number, y: number): SceneObject => ({
  id,
  type: "ball",
  x,
  y,
  rotation: 0,
});

describe("alignDeltas", () => {
  it("aligne les bords gauches sur le plus à gauche", () => {
    const deltas = alignDeltas([ball("a", 10, 5), ball("b", 30, 9)], "left");
    expect(deltas.get("a")).toEqual({ dx: 0, dy: 0 });
    expect(deltas.get("b")).toEqual({ dx: -20, dy: 0 });
  });

  it("centre verticalement", () => {
    const deltas = alignDeltas([ball("a", 0, 0), ball("b", 0, 10)], "centerY");
    expect(deltas.get("a")?.dy).toBe(5);
    expect(deltas.get("b")?.dy).toBe(-5);
  });

  it("ne fait rien avec un seul objet", () => {
    expect(alignDeltas([ball("a", 1, 1)], "left").size).toBe(0);
  });
});

describe("distributeDeltas", () => {
  it("répartit les centres à intervalles égaux", () => {
    const deltas = distributeDeltas([ball("a", 0, 0), ball("b", 2, 0), ball("c", 10, 0)], "x");
    expect(deltas.get("a")?.dx).toBe(0);
    expect(deltas.get("b")?.dx).toBe(3);
    expect(deltas.get("c")?.dx).toBe(0);
  });
});

describe("snapPoint", () => {
  it("aimante sur le candidat le plus proche sous le seuil", () => {
    const r = snapPoint(10.3, 20, [10, 12], [50], 0.5);
    expect(r.x).toBe(10);
    expect(r.guideX).toBe(10);
    expect(r.y).toBe(20);
    expect(r.guideY).toBeNull();
  });
});

describe("sampleLine", () => {
  it("renvoie deux points pour une ligne droite", () => {
    expect(sampleLine({ points: [0, 0, 5, 0, 10, 0], curved: false, wavy: false })).toEqual([0, 0, 10, 0]);
  });

  it("garde les extrémités d'une ligne ondulée", () => {
    const pts = sampleLine({ points: [0, 0, 5, 0, 20, 0], curved: false, wavy: true });
    expect(pts.slice(0, 2)).toEqual([0, 0]);
    expect(pts[pts.length - 2]).toBeCloseTo(20);
    expect(pts[pts.length - 1]).toBeCloseTo(0);
  });

  it("passe par le sommet d'une courbe", () => {
    const pts = sampleLine({ points: [0, 0, 5, 10, 10, 0], curved: true, wavy: false });
    const mid = pts.length / 2 - (pts.length / 2) % 2;
    expect(pts[mid + 1]).toBeGreaterThan(4);
  });
});

describe("simplify", () => {
  it("supprime les points alignés", () => {
    expect(simplify([0, 0, 1, 0.01, 2, 0, 3, 0.01, 4, 0], 0.1)).toEqual([0, 0, 4, 0]);
  });

  it("conserve les angles", () => {
    expect(simplify([0, 0, 5, 0, 5, 5], 0.1)).toEqual([0, 0, 5, 0, 5, 5]);
  });
});

describe("clusterLines", () => {
  it("sépare défense, milieu et attaque", () => {
    const lines = clusterLines([10, 11, 12, 13, 25, 26, 27, 40, 41]);
    expect(lines.map((l) => l.length)).toEqual([4, 3, 2]);
  });

  it("garde une seule ligne sans écart marqué", () => {
    expect(clusterLines([10, 11, 12])).toEqual([[10, 11, 12]]);
  });
});
