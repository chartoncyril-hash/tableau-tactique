import { beforeEach, describe, expect, it } from "vitest";
import { sceneToSvg } from "../export/svg";
import { useEditor } from "../store";
import { createScene, migrateScene } from "./defaults";
import { facingFor } from "./formations";
import type { PlayerObject, Scene } from "./types";

const state = () => useEditor.getState();
const players = () => state().scene.objects.filter((o): o is PlayerObject => o.type === "player");

beforeEach(() => {
  state().loadScene(createScene());
});

describe("orientation par défaut", () => {
  it("chaque camp regarde le but adverse", () => {
    expect(facingFor(0, "horizontal")).toBe(0);
    expect(facingFor(1, "horizontal")).toBe(180);
    expect(facingFor(0, "vertical")).toBe(270);
    expect(facingFor(1, "vertical")).toBe(90);
  });

  it("un joueur posé regarde selon son équipe", () => {
    state().addPlayerAt(10, 10, false);
    useEditor.setState({ activeTeamId: "team-b" });
    state().addPlayerAt(90, 10, false);
    expect(players().map((p) => p.rotation)).toEqual([0, 180]);
  });

  it("une formation place les deux équipes face à face", () => {
    state().applyFormation("team-a", "4-4-2");
    state().applyFormation("team-b", "4-3-3");
    const byTeam = (id: string) => new Set(players().filter((p) => p.teamId === id).map((p) => p.rotation));
    expect(byTeam("team-a")).toEqual(new Set([0]));
    expect(byTeam("team-b")).toEqual(new Set([180]));
  });

  it("les joueurs tournent avec le terrain", () => {
    state().addPlayerAt(10, 10, false);
    state().toggleOrientation();
    expect(((players()[0].rotation % 360) + 360) % 360).toBe(270);
    state().toggleOrientation();
    expect(players()[0].rotation % 360).toBe(0);
  });
});

describe("tableaux enregistrés avant l'orientation", () => {
  const old = (): Scene => {
    const base = createScene();
    delete base.facing;
    return {
      ...base,
      objects: [
        { id: "a", type: "player", x: 10, y: 10, rotation: 0, teamId: "team-a", number: "1", name: "", role: "", look: "disc", goalkeeper: false },
        { id: "b", type: "player", x: 90, y: 10, rotation: 10, teamId: "team-b", number: "2", name: "", role: "", look: "disc", goalkeeper: false },
        { id: "c", type: "ball", x: 50, y: 30, rotation: 0 },
      ],
      frames: [{ id: "f", duration: 2, moves: { b: { x: 80, y: 10, rotation: 10 }, c: { x: 60, y: 30, rotation: 0 } } }],
    };
  };

  it("donne à chaque joueur l'orientation de son camp, rotation existante comprise", () => {
    const scene = migrateScene(old())!;
    expect(scene.facing).toBe(1);
    expect(scene.objects.map((o) => o.rotation)).toEqual([0, 190, 0]);
    expect(scene.frames![0].moves.b.rotation).toBe(190);
    expect(scene.frames![0].moves.c.rotation).toBe(0);
  });

  it("ne convertit qu'une fois", () => {
    const once = migrateScene(old())!;
    expect(migrateScene(once)).toBe(once);
  });
});

describe("rendu de l'orientation", () => {
  const scene = (): Scene => ({
    ...createScene(),
    objects: [{ id: "a", type: "player", x: 10, y: 10, rotation: 90, teamId: "team-a", number: "7", name: "Léa", role: "", look: "disc", goalkeeper: false }],
  });
  const rect = { x: 0, y: 0, w: 105, h: 68 };

  it("dessine bras et pointe, et garde le numéro droit", () => {
    const svg = sceneToSvg(scene(), { rect, width: 800 });
    expect(svg).toContain("rotate(90)");
    expect(svg).toContain('<g transform="rotate(-90)">');
    expect(svg.match(/<ellipse rx="0.7"/g)).toHaveLength(2);
    expect(svg).toMatch(/<polygon points="2.85 0 /);
  });

  it("peut masquer les repères d'orientation", () => {
    const svg = sceneToSvg({ ...scene(), hideFacing: true }, { rect, width: 800 });
    expect(svg).not.toContain('<ellipse rx="0.7"');
    expect(svg).not.toMatch(/<polygon points="2.85 0 /);
  });
});
