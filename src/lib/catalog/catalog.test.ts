import { describe, expect, it } from "vitest";
import { migrateScene } from "@/editor/scene/defaults";
import { getPitch } from "@/editor/pitches";
import { DRILL_CATEGORIES } from "@/lib/data/drills-api";
import { AGE_BANDS, CATALOG, catalogAsDrill, filterCatalog } from "./index";

describe("exercices prêts à l'emploi", () => {
  it("propose au moins dix exercices par tranche d'âge", () => {
    for (const band of AGE_BANDS) expect(CATALOG.filter((d) => d.band === band).length).toBeGreaterThanOrEqual(10);
  });

  it("a des identifiants uniques et des catégories connues", () => {
    expect(new Set(CATALOG.map((d) => d.id)).size).toBe(CATALOG.length);
    for (const d of CATALOG) expect(DRILL_CATEGORIES).toContain(d.category);
  });

  it.each(CATALOG.map((d) => [d.id, d] as const))("%s : textes complets en français et en anglais", (_, d) => {
    for (const lang of ["fr", "en"] as const) {
      expect(d.title[lang].length).toBeGreaterThan(3);
      expect(d.source[lang].length).toBeGreaterThan(3);
      for (const key of ["objective", "goal", "instructions", "duration", "players", "space", "behaviours"] as const) {
        expect(d.sheet[key]?.[lang], `${key} (${lang})`).toBeTruthy();
      }
    }
  });

  it.each(CATALOG.map((d) => [d.id, d] as const))("%s : schéma valide, objets sur le terrain, étapes cohérentes", (_, d) => {
    const scene = d.build();
    expect(migrateScene(JSON.parse(JSON.stringify(scene)))).not.toBeNull();
    const { length, width } = getPitch(scene.pitch.sport);
    const ids = new Set(scene.objects.map((o) => o.id));
    expect(ids.size).toBe(scene.objects.length);
    for (const o of scene.objects) {
      expect(o.x, o.id).toBeGreaterThanOrEqual(-3);
      expect(o.x, o.id).toBeLessThanOrEqual(length + 3);
      expect(o.y, o.id).toBeGreaterThanOrEqual(-3);
      expect(o.y, o.id).toBeLessThanOrEqual(width + 3);
      if (o.type === "player") expect(scene.teams.some((t) => t.id === o.teamId)).toBe(true);
    }
    for (const frame of scene.frames ?? []) {
      for (const [id, move] of Object.entries(frame.moves)) {
        expect(ids.has(id), id).toBe(true);
        if (move.attach) expect(ids.has(move.attach)).toBe(true);
        expect(move.x).toBeGreaterThanOrEqual(-3);
        expect(move.x).toBeLessThanOrEqual(length + 3);
      }
    }
    // Un même exercice donne toujours la même scène.
    expect(JSON.stringify(d.build())).toBe(JSON.stringify(scene));
  });

  it("filtre par tranche, catégorie et recherche", () => {
    expect(filterCatalog({ band: "u9", lang: "fr" }).every((d) => d.band === "u9")).toBe(true);
    expect(filterCatalog({ category: "finishing", lang: "fr" }).every((d) => d.category === "finishing")).toBe(true);
    expect(filterCatalog({ q: "rondo", lang: "fr" }).map((d) => d.id)).toEqual(["u13-rondo-4c1", "sr-rondo-5c2"]);
  });

  it("se convertit en exercice de bibliothèque, avec l'origine en note", () => {
    const drill = catalogAsDrill(CATALOG.find((d) => d.id === "sr-fifa-11plus")!, "en");
    expect(drill.title).toBe("FIFA 11+ warm-up");
    expect(drill.sheet.procede).toBe("exercise");
    expect(drill.notes).toContain("FIFA");
  });
});
