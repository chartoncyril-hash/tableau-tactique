import { describe, expect, it } from "vitest";
import {
  BALL_SIZE,
  ballPrims,
  CATALOG,
  DEFAULT_EQUIPMENT_COLOR,
  EQUIPMENT_SIZE,
  equipmentPrims,
} from "./catalog";
import { BALL_STYLES, EQUIPMENT_KINDS } from "./types";

describe("banque d'objets", () => {
  it.each(EQUIPMENT_KINDS)("%s a un dessin qui tient dans sa boîte", (kind) => {
    const prims = equipmentPrims(kind, DEFAULT_EQUIPMENT_COLOR[kind]);
    const { w, h } = EQUIPMENT_SIZE[kind];
    expect(prims.length).toBeGreaterThan(0);
    for (const p of prims) {
      const xs = p.t === "line" ? p.pts.filter((_, i) => i % 2 === 0) : p.t === "rect" ? [p.x, p.x + p.w] : [p.x];
      const ys = p.t === "line" ? p.pts.filter((_, i) => i % 2 === 1) : p.t === "rect" ? [p.y, p.y + p.h] : [p.y];
      for (const x of xs) expect(Math.abs(x)).toBeLessThanOrEqual(w / 2 + 0.35);
      for (const y of ys) expect(Math.abs(y)).toBeLessThanOrEqual(h / 2 + 0.35);
    }
  });

  it.each(BALL_STYLES)("le ballon %s est dessiné", (style) => {
    expect(ballPrims(style).length).toBeGreaterThan(0);
    expect(BALL_SIZE[style].w).toBeGreaterThan(0);
  });

  it("propose chaque type de matériel au moins une fois, sans doublon", () => {
    const items = CATALOG.flatMap((c) => c.items);
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    const kinds = new Set(items.flatMap((i) => (i.type === "equipment" ? [i.kind] : [])));
    for (const kind of EQUIPMENT_KINDS) expect(kinds.has(kind)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(40);
  });
});
