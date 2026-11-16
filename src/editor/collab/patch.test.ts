import { produce } from "immer";
import { describe, expect, it } from "vitest";
import { createScene } from "../scene/defaults";
import type { Scene } from "../scene/types";
import { applyPatch, diffScenes, mergePatches } from "./patch";

const ball = (id: string, x: number) => ({ id, type: "ball" as const, x, y: 10, rotation: 0 });
const base = (): Scene => ({ ...createScene(), objects: [ball("a", 1), ball("b", 2), ball("c", 3)] });

describe("différences de scène", () => {
  it("ne transporte que les objets modifiés", () => {
    const prev = base();
    const next = produce(prev, (d) => {
      d.objects[1].x = 20;
    });
    const patch = diffScenes(prev, next)!;
    expect(patch.upsert?.map((o) => o.id)).toEqual(["b"]);
    expect(patch.order).toBeUndefined();
    expect(applyPatch(prev, patch)).toEqual(next);
  });

  it("rien à envoyer quand rien ne change", () => {
    const s = base();
    expect(diffScenes(s, s)).toBeNull();
  });

  it("deux modifications concurrentes d'objets différents se cumulent", () => {
    const start = base();
    const mine = produce(start, (d) => {
      d.objects[0].x = 100;
    });
    const theirs = produce(start, (d) => {
      d.objects[2].x = 300;
    });
    const merged = applyPatch(mine, diffScenes(start, theirs)!);
    expect(merged.objects.map((o) => o.x)).toEqual([100, 2, 300]);
  });

  it("ajouts, suppressions et ordre d'empilement", () => {
    const prev = base();
    const next = produce(prev, (d) => {
      d.objects.splice(0, 1);
      d.objects.push(ball("d", 4));
      d.objects.reverse();
    });
    const patch = diffScenes(prev, next)!;
    expect(patch.remove).toEqual(["a"]);
    expect(applyPatch(prev, patch).objects.map((o) => o.id)).toEqual(["d", "c", "b"]);
  });

  it("garde un objet créé ici entre-temps", () => {
    const start = base();
    const local = produce(start, (d) => {
      d.objects.push(ball("local", 9));
    });
    const remote = produce(start, (d) => {
      d.objects.unshift(ball("z", 0));
    });
    const merged = applyPatch(local, diffScenes(start, remote)!);
    expect(merged.objects.map((o) => o.id)).toEqual(["z", "a", "b", "c", "local"]);
  });

  it("transporte terrain, équipes et étapes", () => {
    const prev = base();
    const next = produce(prev, (d) => {
      d.pitch.mow = "plain";
      d.teams[0].color = "#000000";
      d.frames = [{ id: "f", duration: 2, moves: {} }];
      d.hideFacing = true;
    });
    const out = applyPatch(prev, diffScenes(prev, next)!);
    expect(out.pitch.mow).toBe("plain");
    expect(out.teams[0].color).toBe("#000000");
    expect(out.frames).toHaveLength(1);
    expect(out.hideFacing).toBe(true);
    const back = applyPatch(out, diffScenes(out, prev)!);
    expect(back.frames).toBeUndefined();
    expect(back.hideFacing).toBeUndefined();
  });

  it("fusionne des différences successives", () => {
    const s0 = base();
    const s1 = produce(s0, (d) => {
      d.objects[0].x = 5;
    });
    const s2 = produce(s1, (d) => {
      d.objects.splice(0, 1);
    });
    const merged = mergePatches(diffScenes(s0, s1), diffScenes(s1, s2))!;
    expect(merged.upsert).toBeUndefined();
    expect(applyPatch(s0, merged).objects.map((o) => o.id)).toEqual(["b", "c"]);
  });
});
