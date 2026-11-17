import { SENIOR_DRILLS } from "./senior";
import { U13_DRILLS } from "./u13";
import { U9_DRILLS } from "./u9";
import { sheetIn, type AgeBand, type CatalogDrill, type Lang } from "./types";

/**
 * Exercices prêts à l'emploi, livrés avec l'application (aucune donnée en base) : une dizaine par
 * tranche d'âge, tirés d'exercices reconnus (FFF, rondos de l'Ajax et du Barça, FIFA 11+, jeu de
 * position, contre-pressing, parcours de Hoff…).
 */
export const CATALOG: CatalogDrill[] = [...U9_DRILLS, ...U13_DRILLS, ...SENIOR_DRILLS];

export { AGE_BANDS, sheetIn, type AgeBand, type CatalogDrill, type Lang } from "./types";

const scenes = new Map<string, ReturnType<CatalogDrill["build"]>>();

/** Schéma d'un exercice, construit une fois puis gardé (vignettes, aperçus). */
export function sceneOf(drill: CatalogDrill) {
  let scene = scenes.get(drill.id);
  if (!scene) {
    scene = drill.build();
    scenes.set(drill.id, scene);
  }
  return scene;
}

export function catalogDrill(id: string) {
  return CATALOG.find((d) => d.id === id);
}

export function filterCatalog(filter: { band?: AgeBand | ""; category?: string; q?: string; lang: Lang }) {
  const q = filter.q?.trim().toLowerCase();
  return CATALOG.filter(
    (d) =>
      (!filter.band || d.band === filter.band) &&
      (!filter.category || d.category === filter.category) &&
      (!q || d.title[filter.lang].toLowerCase().includes(q) || d.tags[filter.lang].some((t) => t.toLowerCase().includes(q))),
  );
}

/** Exercice prêt à l'emploi sous la forme d'un exercice de bibliothèque (schéma, fiche, notes). */
export function catalogAsDrill(drill: CatalogDrill, lang: Lang) {
  return {
    title: drill.title[lang],
    // Copie : le tableau créé est modifiable sans toucher au schéma gardé en mémoire.
    scene: structuredClone(sceneOf(drill)),
    sheet: sheetIn(drill, lang),
    notes: `${lang === "fr" ? "Origine" : "Source"} : ${drill.source[lang]}`,
    category: drill.category,
    tags: drill.tags[lang],
  };
}
