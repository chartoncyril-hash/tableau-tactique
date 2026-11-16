import { describe, expect, it } from "vitest";
import { createScene } from "../scene/defaults";
import type { Scene } from "../scene/types";
import { fileName, objectsAtStep, stepArrows } from "./frame";
import { escapeXml, sceneToSvg, tensionPath } from "./svg";

const rect = { x: 0, y: 0, w: 105, h: 68 };

function scene(): Scene {
  const base = createScene();
  return {
    ...base,
    teams: [{ ...base.teams[0], pattern: "stripes", color2: "#ffffff" }, base.teams[1]],
    objects: [
      { id: "p1", type: "player", x: 30, y: 20, rotation: 0, teamId: base.teams[0].id, number: "10", name: "Léa <C>", role: "", look: "disc", goalkeeper: true, captain: true },
      { id: "p2", type: "player", x: 60, y: 30, rotation: 0, teamId: base.teams[1].id, number: "4", name: "", role: "", look: "jersey", goalkeeper: false, photo: "u/p.jpg" },
      { id: "b", type: "ball", x: 32, y: 21, rotation: 0 },
      { id: "c", type: "equipment", x: 50, y: 10, rotation: 45, kind: "cone", color: "#f97316", scale: 1.5 },
      { id: "z", type: "zone", x: 50, y: 34, rotation: 0, shape: "rect", width: 20, height: 10, points: [], fill: "#facc15", opacity: 0.3, pattern: "hatch" },
      { id: "t", type: "text", x: 52, y: 60, rotation: 0, text: "Ligne 1\nLigne 2", size: 2, color: "#ffffff", label: true },
      { id: "l", type: "line", x: 10, y: 10, rotation: 0, kind: "pass", points: [0, 0, 5, 5, 10, 0], curved: true, dashed: true, wavy: false, arrowStart: false, arrowEnd: true, double: true, barEnd: true, width: 0.3, color: "#ffffff" },
      { id: "f", type: "freehand", x: 70, y: 50, rotation: 0, points: [0, 0, 2, 3, 5, 1, 8, 4], width: 0.3, color: "#ef4444" },
    ],
    frames: [{ id: "s1", duration: 2, moves: { p1: { x: 40, y: 20, rotation: 0 }, b: { x: 80, y: 40, rotation: 0 } } }],
  };
}

describe("export SVG", () => {
  it("produit un document SVG complet aux bonnes dimensions", () => {
    const svg = sceneToSvg(scene(), { rect, width: 1090 });
    expect(svg.startsWith("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1090\" height=\"720\"")).toBe(true);
    expect(svg).toContain('viewBox="-2 -2 109 72"');
    expect(svg.endsWith("</svg>")).toBe(true);
  });

  it("dessine chaque type d'objet", () => {
    const svg = sceneToSvg(scene(), { rect, width: 800 });
    expect(svg).toContain('translate(30 20)');
    expect(svg).toContain(">10</text>");
    expect(svg).toContain('stroke="#facc15"'); // gardien
    expect(svg).toContain(">C</text>"); // capitaine
    expect(svg).toContain("rotate(45) scale(1.5)"); // plot tourné et agrandi
    expect(svg).toMatch(/<pattern id="hatch-/);
    expect(svg).toMatch(/<linearGradient id="kit-stripes/);
    expect(svg).toContain(">Ligne 1</text>");
    expect(svg).toContain(">Ligne 2</text>");
    expect(svg).toContain('stroke-dasharray="1.1 0.9"');
    expect(svg).toMatch(/<path d="M0 0 Q/); // tracé main levée lissé
  });

  it("échappe les textes", () => {
    const svg = sceneToSvg(scene(), { rect, width: 800 });
    expect(svg).toContain("Léa &lt;C&gt;");
    expect(svg).not.toContain("<C>");
    expect(escapeXml(`a&"'`)).toBe("a&amp;&quot;&apos;");
  });

  it("n'intègre une photo que si elle est fournie, et jamais sur un maillot", () => {
    const s = scene();
    const disc = { ...s, objects: s.objects.map((o) => (o.id === "p2" && o.type === "player" ? { ...o, look: "disc" as const } : o)) };
    expect(sceneToSvg(disc, { rect, width: 800 })).not.toContain("<image");
    const withPhoto = sceneToSvg(disc, { rect, width: 800, photos: { "u/p.jpg": "data:image/jpeg;base64,AAAA" } });
    expect(withPhoto).toContain('href="data:image/jpeg;base64,AAAA"');
    expect(sceneToSvg(s, { rect, width: 800, photos: { "u/p.jpg": "data:x" } })).not.toContain("<image");
  });

  it("tourne le terrain en orientation verticale", () => {
    const s = scene();
    const svg = sceneToSvg({ ...s, pitch: { ...s.pitch, orientation: "vertical" } }, { rect: { x: 0, y: 0, w: 68, h: 105 }, width: 600 });
    expect(svg).toContain('transform="translate(0 105) rotate(-90)"');
  });

  it("place les objets et les flèches d'une étape", () => {
    const s = scene();
    const objects = objectsAtStep(s, 1);
    expect(objects.find((o) => o.id === "p1")).toMatchObject({ x: 30, y: 20 });
    const arrows = stepArrows(s, 1);
    expect(arrows).toHaveLength(2);
    expect(arrows.find((a) => !a.dashed)).toBeDefined(); // passe du ballon : trait plein
    const svg = sceneToSvg(s, { rect, width: 800, objects, arrows });
    expect(svg).toContain('stroke-dasharray="0.9 0.7"');
  });
});

describe("courbe lissée", () => {
  it("passe par le premier et le dernier point", () => {
    const d = tensionPath([0, 0, 5, 5, 10, 0], 0.4);
    expect(d.startsWith("M0 0 Q")).toBe(true);
    expect(d.endsWith("10 0")).toBe(true);
  });

  it("se réduit à un segment avec deux points", () => {
    expect(tensionPath([0, 0, 3, 4], 0.4)).toBe("M0 0 L3 4");
  });
});

describe("nom de fichier", () => {
  it("retire accents et caractères spéciaux", () => {
    expect(fileName(["Séance U13 : pressing", "Tableau 1", undefined], "png")).toBe("seance-u13-pressing-tableau-1.png");
    expect(fileName([], "gif")).toBe("tableau.gif");
  });
});
