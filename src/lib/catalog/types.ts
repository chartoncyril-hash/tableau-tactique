import type { Scene } from "@/editor/scene/types";
import type { DrillCategory } from "@/lib/data/drills-api";
import type { DrillSheet, Procede } from "@/lib/sheet";

/** Tranches d'âge du catalogue, alignées sur les formats de jeu (FFF). */
export const AGE_BANDS = ["u9", "u13", "senior"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export type Lang = "fr" | "en";
export type Text = Record<Lang, string>;

type SheetText = Partial<Record<Exclude<keyof DrillSheet, "procede" | "diagrams">, Text>>;

/** Exercice prêt à l'emploi : textes en français et en anglais, schéma construit à la demande. */
export interface CatalogDrill {
  id: string;
  band: AgeBand;
  category: DrillCategory;
  title: Text;
  procede: Procede;
  sheet: SheetText;
  /** Origine de l'exercice (fédération, club, méthode). */
  source: Text;
  tags: Record<Lang, string[]>;
  build: () => Scene;
}

export const L = (fr: string, en: string): Text => ({ fr, en });

/** Fiche dans une langue, prête pour un tableau (affichage, PDF). */
export function sheetIn(drill: CatalogDrill, lang: Lang): DrillSheet {
  const out: DrillSheet = { procede: drill.procede, diagrams: drill.build().frames?.length ? "steps" : "board" };
  for (const [key, text] of Object.entries(drill.sheet)) {
    if (text) (out as Record<string, string>)[key] = text[lang];
  }
  return out;
}
