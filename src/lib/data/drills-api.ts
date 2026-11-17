import type { Scene } from "@/editor/scene/types";
import { inScope } from "@/lib/data/api";
import type { DrillSheet } from "@/lib/sheet";
import { createClient } from "@/lib/supabase/client";

/**
 * Bibliothèque d'exercices, personnelle ou de club (mêmes droits que les projets, voir la RLS).
 * Un exercice garde le schéma (scène, animation comprise), les consignes de la fiche et les notes.
 */
let client: ReturnType<typeof createClient> | undefined;
const db = () => (client ??= createClient());

export const DRILL_CATEGORIES = ["warmup", "technique", "tactics", "game", "finishing", "physical", "goalkeeper", "setPieces"] as const;
export type DrillCategory = (typeof DRILL_CATEGORIES)[number];

export interface DrillRow {
  id: string;
  club_id: string | null;
  owner_id: string;
  title: string;
  category: string;
  tags: string[];
  scene: Scene;
  sheet: DrillSheet;
  notes: string;
  created_at: string;
  updated_at: string;
}

const COLS = "id,club_id,owner_id,title,category,tags,scene,sheet,notes,created_at,updated_at";

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

/** Exercices d'un espace, les plus récents d'abord ; filtre facultatif par catégorie et texte. */
export async function listDrills(clubId: string | null, filter: { category?: string; q?: string } = {}): Promise<DrillRow[]> {
  let query = inScope(db().from("drills").select(COLS).is("deleted_at", null), clubId);
  if (filter.category) query = query.eq("category", filter.category);
  const q = filter.q?.trim().replace(/[%_,()]/g, " ").slice(0, 80);
  if (q) query = query.ilike("title", `%${q}%`);
  return unwrap(await query.order("updated_at", { ascending: false }).limit(200));
}

export async function saveDrill(drill: {
  title: string;
  category: string;
  tags: string[];
  scene: Scene;
  sheet: DrillSheet;
  notes: string;
  clubId: string | null;
}): Promise<DrillRow> {
  const { clubId, ...fields } = drill;
  return unwrap(await db().from("drills").insert({ ...fields, club_id: clubId }).select(COLS).single());
}

export async function trashDrill(id: string) {
  unwrap(await db().from("drills").update({ deleted_at: new Date().toISOString() }).eq("id", id).select("id"));
}

/** Étiquettes saisies librement : « pressing, U13 » → ["pressing", "U13"]. */
export function parseTags(text: string): string[] {
  return [...new Set(text.split(",").map((t) => t.trim().slice(0, 30)).filter(Boolean))].slice(0, 20);
}
