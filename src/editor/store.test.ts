import { beforeEach, describe, expect, it } from "vitest";
import { createScene } from "./scene/defaults";
import { FORMATIONS, formationSlots } from "./scene/formations";
import { useEditor } from "./store";

const state = () => useEditor.getState();

beforeEach(() => {
  state().loadScene(createScene());
  useEditor.setState({ clipboard: [], tool: { type: "select" } });
});

describe("historique", () => {
  it("annule et rétablit sans limite", () => {
    for (let i = 0; i < 250; i++) state().addPlayerAt(i, 10, false);
    expect(state().scene.objects).toHaveLength(250);
    for (let i = 0; i < 250; i++) state().undo();
    expect(state().scene.objects).toHaveLength(0);
    for (let i = 0; i < 250; i++) state().redo();
    expect(state().scene.objects).toHaveLength(250);
  });

  it("vide la pile de rétablissement après une nouvelle action", () => {
    state().addPlayerAt(1, 1, false);
    state().undo();
    state().addPlayerAt(2, 2, false);
    expect(state().future).toHaveLength(0);
  });

  it("regroupe un geste en direct en une seule commande", () => {
    const id = state().addPlayerAt(0, 0, false);
    const before = state().past.length;
    state().beginLive();
    for (let i = 1; i <= 20; i++) {
      state().live((scene) => {
        scene.objects.find((o) => o.id === id)!.x = i;
      });
    }
    state().endLive("drag");
    expect(state().past.length).toBe(before + 1);
    state().undo();
    expect(state().scene.objects[0].x).toBe(0);
  });
});

describe("joueurs", () => {
  it("numérote à la suite dans chaque équipe", () => {
    state().addPlayerAt(0, 0, true);
    state().addPlayerAt(0, 0, false);
    state().addPlayerAt(0, 0, false);
    state().setActiveTeam("team-b");
    state().addPlayerAt(0, 0, false);
    const numbers = state().scene.objects.map((o) => (o.type === "player" ? o.number : ""));
    expect(numbers).toEqual(["1", "2", "3", "2"]);
  });

  it("accepte jusqu'à quatre équipes", () => {
    state().addTeam("C");
    state().addTeam("D");
    state().addTeam("E");
    expect(state().scene.teams).toHaveLength(4);
    expect(new Set(state().scene.teams.map((t) => t.color)).size).toBe(4);
  });
});

describe("formations", () => {
  it.each(FORMATIONS)("%s place onze joueurs dans sa moitié", (formation) => {
    const slots = formationSlots(formation, 0, "football", "horizontal");
    expect(slots).toHaveLength(11);
    expect(slots.filter((s) => s.goalkeeper)).toHaveLength(1);
    for (const s of slots) {
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThanOrEqual(52.5);
      expect(s.y).toBeGreaterThan(0);
      expect(s.y).toBeLessThan(68);
    }
  });

  it("réutilise les joueurs existants", () => {
    state().applyFormation("team-a", "4-4-2");
    state().applyFormation("team-a", "4-3-3");
    expect(state().scene.objects).toHaveLength(11);
  });

  it("place l'équipe adverse en face", () => {
    state().applyFormation("team-b", "4-4-2");
    expect(state().scene.objects.every((o) => o.x >= 52.5)).toBe(true);
  });
});

describe("manipulation", () => {
  it("sélectionne tout un groupe d'un clic", () => {
    const a = state().addPlayerAt(0, 0, false);
    const b = state().addPlayerAt(5, 0, false);
    state().addPlayerAt(9, 0, false);
    state().select([a, b]);
    state().group();
    state().select([a]);
    expect(state().selection.sort()).toEqual([a, b].sort());
  });

  it("ne déplace ni ne supprime un objet verrouillé", () => {
    const a = state().addPlayerAt(0, 0, false);
    state().toggleLock();
    state().moveBy([a], 5, 5);
    state().deleteSelected();
    expect(state().scene.objects[0]).toMatchObject({ x: 0, y: 0, locked: true });
  });

  it("colle des copies décalées avec de nouveaux identifiants", () => {
    const a = state().addPlayerAt(10, 10, false);
    state().copy();
    state().paste();
    state().paste();
    const objects = state().scene.objects;
    expect(objects).toHaveLength(3);
    expect(new Set(objects.map((o) => o.id)).size).toBe(3);
    expect(objects[2].x).toBe(14);
    expect(objects[0].id).toBe(a);
  });

  it("change l'ordre d'empilement", () => {
    const a = state().addPlayerAt(0, 0, false);
    const b = state().addPlayerAt(1, 0, false);
    state().select([a]);
    state().reorder("front");
    expect(state().scene.objects.map((o) => o.id)).toEqual([b, a]);
  });

  it("retrouve la scène d'origine après deux changements d'orientation", () => {
    state().addPlayerAt(20, 30, false);
    state().addObject({
      type: "line",
      x: 10,
      y: 10,
      rotation: 0,
      kind: "pass",
      points: [0, 0, 5, 2, 10, 4],
      curved: true,
      dashed: false,
      wavy: false,
      arrowStart: false,
      arrowEnd: true,
      width: 0.3,
      color: "#fff",
    });
    const before = state().scene.objects;
    state().toggleOrientation();
    expect(state().scene.objects[0]).toMatchObject({ x: 30, y: 85 });
    state().toggleOrientation();
    const after = state().scene.objects;
    after.forEach((obj, i) => {
      expect(obj.x).toBeCloseTo(before[i].x);
      expect(obj.y).toBeCloseTo(before[i].y);
    });
    const line = after[1];
    expect(line.type === "line" && line.points.map((p) => p + 0)).toEqual([0, 0, 5, 2, 10, 4]);
  });
});
