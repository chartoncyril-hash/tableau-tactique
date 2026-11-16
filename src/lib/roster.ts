import type { FormationSlot } from "@/editor/scene/formations";
import type { TeamPattern } from "@/editor/scene/types";

/** Effectifs : équipes du club, joueurs et maillots. */

export const POSITIONS = ["G", "D", "M", "A"] as const;
export type Position = (typeof POSITIONS)[number];
export const FEET = ["right", "left", "both"] as const;
export type Foot = (typeof FEET)[number];

export interface Kit {
  color: string;
  color2?: string;
  pattern?: TeamPattern;
}

export interface TeamRow {
  id: string;
  name: string;
  /** Nom du club affiché sur la fiche (texte libre). */
  club: string;
  /** Espace club propriétaire ; nul pour une équipe personnelle. */
  club_id: string | null;
  category: string;
  kit: Kit;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PlayerRow {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  number: string;
  position: Position | "";
  foot: Foot | "";
  notes: string;
  photo_path: string | null;
}

export type PlayerFields = Omit<PlayerRow, "id" | "team_id" | "photo_path">;

export const DEFAULT_KIT: Kit = { color: "#1d4ed8", pattern: "plain" };

const HEX = /^#[0-9a-f]{6}$/i;
const PATTERNS = ["plain", "stripes", "hoops", "halves"];

/** Lecture tolérante d'un maillot enregistré. */
export function readKit(input: unknown): Kit {
  const kit = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    color: typeof kit.color === "string" && HEX.test(kit.color) ? kit.color : DEFAULT_KIT.color,
    color2: typeof kit.color2 === "string" && HEX.test(kit.color2) ? kit.color2 : undefined,
    pattern: typeof kit.pattern === "string" && PATTERNS.includes(kit.pattern) ? (kit.pattern as TeamPattern) : "plain",
  };
}

/** Nom affiché sur le terrain : prénom seul, ou nom si le prénom manque. */
export function shortName(p: Pick<PlayerRow, "first_name" | "last_name">) {
  return (p.first_name || p.last_name).trim();
}

export function fullName(p: Pick<PlayerRow, "first_name" | "last_name">) {
  return `${p.first_name} ${p.last_name}`.trim();
}

const ORDER: Record<string, number> = { G: 0, D: 1, M: 2, A: 3, "": 4 };
const num = (p: Pick<PlayerRow, "number">) => Number(p.number) || 999;

/** Tri d'un effectif : par poste (gardiens d'abord), puis par numéro, puis par nom. */
export function sortPlayers<T extends Pick<PlayerRow, "position" | "number" | "first_name" | "last_name">>(players: T[]): T[] {
  return [...players].sort(
    (a, b) =>
      ORDER[a.position] - ORDER[b.position] ||
      num(a) - num(b) ||
      fullName(a).localeCompare(fullName(b), "fr"),
  );
}

/**
 * Affecte des joueurs aux places d'une formation : chaque place prend d'abord un joueur de son
 * poste, puis les places restantes sont complétées dans l'ordre de l'effectif.
 */
export function assignLineup<T extends Pick<PlayerRow, "id" | "position" | "number" | "first_name" | "last_name">>(
  slots: Pick<FormationSlot, "role">[],
  players: T[],
): (T | undefined)[] {
  const pool = sortPlayers(players);
  const used = new Set<string>();
  const out: (T | undefined)[] = slots.map((slot) => {
    const match = pool.find((p) => !used.has(p.id) && p.position === slot.role);
    if (match) used.add(match.id);
    return match;
  });
  return out.map((player, i) => {
    if (player) return player;
    // Le but reste aux gardiens, et un gardien n'est pas envoyé dans le champ.
    if (slots[i].role === "G") return undefined;
    const fallback = pool.find((p) => !used.has(p.id) && p.position !== "G");
    if (fallback) used.add(fallback.id);
    return fallback;
  });
}

// --- CSV ------------------------------------------------------------------------

const HEADERS: Record<keyof PlayerFields, string[]> = {
  number: ["numero", "numéro", "n°", "no", "num", "number", "#"],
  first_name: ["prenom", "prénom", "first name", "firstname", "first_name"],
  last_name: ["nom", "last name", "lastname", "last_name", "surname"],
  position: ["poste", "position"],
  foot: ["pied", "pied fort", "foot", "strong foot"],
  notes: ["notes", "note", "commentaire", "commentaires", "comments"],
};

const POSITION_WORDS: Record<string, Position> = {
  g: "G", gb: "G", gardien: "G", goalkeeper: "G", gk: "G",
  d: "D", def: "D", defenseur: "D", défenseur: "D", defender: "D",
  m: "M", mil: "M", milieu: "M", midfielder: "M",
  a: "A", att: "A", attaquant: "A", forward: "A", striker: "A", f: "A",
};

const FOOT_WORDS: Record<string, Foot> = {
  d: "right", droit: "right", right: "right", r: "right",
  g: "left", gauche: "left", left: "left", l: "left",
  "les deux": "both", ambidextre: "both", both: "both", deux: "both",
};

const norm = (s: string) => s.trim().toLowerCase();

/** Découpe un CSV (virgule ou point-virgule, guillemets doublés). */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

/** Joueurs lus depuis un CSV : la première ligne doit nommer les colonnes. */
export function playersFromCsv(text: string, max = 200): PlayerFields[] {
  const [head, ...rows] = parseCsv(text);
  if (!head) return [];
  const columns = head.map((h) => {
    const key = norm(h);
    return (Object.keys(HEADERS) as (keyof PlayerFields)[]).find((field) => HEADERS[field].includes(key));
  });
  if (!columns.includes("first_name") && !columns.includes("last_name")) return [];
  return rows.slice(0, max).flatMap((cells) => {
    const p: PlayerFields = { number: "", first_name: "", last_name: "", position: "", foot: "", notes: "" };
    columns.forEach((field, i) => {
      const value = (cells[i] ?? "").trim();
      if (!field || !value) return;
      if (field === "position") p.position = POSITION_WORDS[norm(value)] ?? "";
      else if (field === "foot") p.foot = FOOT_WORDS[norm(value)] ?? "";
      else if (field === "number") p.number = value.replace(/\D/g, "").slice(0, 3);
      else p[field] = value.slice(0, field === "notes" ? 1000 : 60);
    });
    return p.first_name || p.last_name ? [p] : [];
  });
}

const FOOT_FR: Record<string, string> = { right: "droit", left: "gauche", both: "les deux" };

/** Effectif exporté en CSV (point-virgule, avec BOM pour Excel). */
export function playersToCsv(players: PlayerFields[]): string {
  const quote = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [
    ["numero", "prenom", "nom", "poste", "pied", "notes"].join(";"),
    ...sortPlayers(players).map((p) =>
      [p.number, p.first_name, p.last_name, p.position, FOOT_FR[p.foot] ?? "", p.notes].map(quote).join(";"),
    ),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}
