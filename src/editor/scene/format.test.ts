import { produce } from "immer";
import { describe, expect, it } from "vitest";
import { getPitch } from "../pitches";
import { formatForCategory } from "../pitches/formats";
import { createScene } from "./defaults";
import { rescaleToPitch } from "./format";
import { formationSlots, formationsFor } from "./formations";
import type { Scene } from "./types";

const player = (id: string, x: number, y: number) =>
  ({ id, type: "player", x, y, rotation: 0, teamId: "a", number: "1", name: "", role: "", goalkeeper: false }) as Scene["objects"][number];

describe("formats et catégories", () => {
  it("associe les catégories FFF à leur format", () => {
    expect(formatForCategory("U9")).toBe("football5");
    expect(formatForCategory("U11")).toBe("football8");
    expect(formatForCategory("U13")).toBe("football8");
    expect(formatForCategory("U15")).toBe("football");
    expect(formatForCategory("senior")).toBe("football");
  });

  it("donne des terrains aux dimensions réglementaires", () => {
    expect([getPitch("football8").length, getPitch("football8").width]).toEqual([65, 50]);
    expect([getPitch("football5").length, getPitch("football5").width]).toEqual([40, 30]);
  });

  it.each([
    ["football", 11],
    ["football8", 8],
    ["football5", 5],
  ])("propose des systèmes à %s joueurs complets", (sport, players) => {
    for (const formation of formationsFor(sport)) {
      const slots = formationSlots(formation, 0, sport, "horizontal");
      expect(slots).toHaveLength(players);
      const { length, width } = getPitch(sport);
      for (const s of slots) {
        expect(s.x).toBeGreaterThan(0);
        expect(s.x).toBeLessThan(length / 2);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(width);
      }
    }
  });
});

describe("rescaleToPitch", () => {
  it("met le schéma à l'échelle du nouveau terrain, déplacements compris", () => {
    const scene = produce(createScene(), (d) => {
      d.objects.push(player("p", 52.5, 34));
      d.objects.push(player("q", 105, 68));
      d.frames = [{ id: "f", duration: 2, moves: { p: { x: 70, y: 17, rotation: 0, cx: 60, cy: 20 } } }];
    });
    const next = produce(scene, (d) => rescaleToPitch(d, "football8"));
    expect(next.pitch.sport).toBe("football8");
    expect(next.objects.find((o) => o.id === "p")).toMatchObject({ x: 32.5, y: 25 });
    expect(next.objects.find((o) => o.id === "q")).toMatchObject({ x: 65, y: 50 });
    const move = next.frames![0].moves.p;
    expect(move.x).toBeCloseTo((70 * 65) / 105);
    expect(move.y).toBeCloseTo(12.5);
    expect(move.cx).toBeCloseTo((60 * 65) / 105);
  });

  it("tient compte d'un terrain vertical (longueur sur y)", () => {
    const scene = produce(createScene(), (d) => {
      d.pitch.orientation = "vertical";
      d.objects.push(player("p", 68, 105));
    });
    const next = produce(scene, (d) => rescaleToPitch(d, "football5"));
    expect(next.objects[0]).toMatchObject({ x: 30, y: 40 });
  });
});
