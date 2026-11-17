/**
 * Formats de jeu et catégories d'âge (pratique FFF) : la catégorie choisit le format par
 * défaut, que l'on peut ensuite changer (foot à 8 en seniors, par exemple).
 */
export const FORMATS = ["football", "football8", "football5"] as const;
export type GameFormat = (typeof FORMATS)[number];

export const CATEGORIES = ["U7", "U9", "U11", "U13", "U15", "U17", "U19", "senior", "veteran"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Nombre de joueurs par équipe, gardien compris. */
export const FORMAT_PLAYERS: Record<GameFormat, number> = { football: 11, football8: 8, football5: 5 };

export function formatForCategory(category: Category): GameFormat {
  if (category === "U7" || category === "U9") return "football5";
  if (category === "U11" || category === "U13") return "football8";
  return "football";
}

export function isFormat(sport: string): sport is GameFormat {
  return (FORMATS as readonly string[]).includes(sport);
}

export function isCategory(value: string | undefined): value is Category {
  return !!value && (CATEGORIES as readonly string[]).includes(value);
}
