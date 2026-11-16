import { createClient } from "@/lib/supabase/client";
import { DEFAULT_KIT, readKit, type PlayerFields, type PlayerRow, type TeamRow } from "@/lib/roster";

/** Accès aux effectifs depuis le navigateur ; la RLS limite tout à l'utilisateur connecté. */
let client: ReturnType<typeof createClient> | undefined;
const db = () => (client ??= createClient());

const TEAM_COLS = "id,name,club,category,kit,created_at,updated_at,deleted_at";
const PLAYER_COLS = "id,team_id,first_name,last_name,number,position,foot,notes,photo_path";
export const PHOTO_BUCKET = "player-photos";

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

const toTeam = (row: TeamRow): TeamRow => ({ ...row, kit: readKit(row.kit) });

export async function listTeams(): Promise<TeamRow[]> {
  const rows = unwrap(await db().from("teams").select(TEAM_COLS).is("deleted_at", null).order("name")) as TeamRow[];
  return rows.map(toTeam);
}

export async function loadTeam(id: string): Promise<TeamRow | null> {
  const rows = unwrap(await db().from("teams").select(TEAM_COLS).eq("id", id).is("deleted_at", null).limit(1)) as TeamRow[];
  return rows[0] ? toTeam(rows[0]) : null;
}

export async function createTeam(name: string): Promise<TeamRow> {
  return toTeam(unwrap(await db().from("teams").insert({ name, kit: DEFAULT_KIT }).select(TEAM_COLS).single()) as TeamRow);
}

export async function updateTeam(id: string, patch: Partial<Pick<TeamRow, "name" | "club" | "category" | "kit">>) {
  unwrap(await db().from("teams").update(patch).eq("id", id).select("id"));
}

export async function trashTeam(id: string) {
  unwrap(await db().from("teams").update({ deleted_at: new Date().toISOString() }).eq("id", id).select("id"));
}

export async function listPlayers(teamId: string): Promise<PlayerRow[]> {
  return unwrap(await db().from("players").select(PLAYER_COLS).eq("team_id", teamId).order("created_at")) as PlayerRow[];
}

export async function insertPlayers(teamId: string, players: Partial<PlayerFields>[]): Promise<PlayerRow[]> {
  if (players.length === 0) return [];
  return unwrap(
    await db()
      .from("players")
      .insert(players.map((p) => ({ ...p, team_id: teamId })))
      .select(PLAYER_COLS),
  ) as PlayerRow[];
}

export async function updatePlayer(id: string, patch: Partial<PlayerFields>) {
  unwrap(await db().from("players").update(patch).eq("id", id).select("id"));
}

export async function deletePlayer(player: PlayerRow) {
  unwrap(await db().from("players").delete().eq("id", player.id).select("id"));
  if (player.photo_path) await db().storage.from(PHOTO_BUCKET).remove([player.photo_path]);
}

/** Enregistre la photo d'un joueur dans son dossier privé et remplace l'ancienne. */
export async function setPlayerPhoto(player: PlayerRow, photo: Blob): Promise<string> {
  const { data } = await db().auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new Error("not signed in");
  const path = `${uid}/${player.id}-${Date.now()}.jpg`;
  const upload = await db().storage.from(PHOTO_BUCKET).upload(path, photo, { contentType: "image/jpeg" });
  if (upload.error) throw new Error(upload.error.message);
  await updatePlayer(player.id, { photo_path: path } as Partial<PlayerFields>);
  if (player.photo_path) await db().storage.from(PHOTO_BUCKET).remove([player.photo_path]);
  return path;
}

export async function removePlayerPhoto(player: PlayerRow) {
  if (!player.photo_path) return;
  await updatePlayer(player.id, { photo_path: null } as Partial<PlayerFields>);
  await db().storage.from(PHOTO_BUCKET).remove([player.photo_path]);
}

/** Adresses temporaires (1 h) des photos ; une photo inaccessible est simplement absente. */
export async function signPhotos(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const { data, error } = await db().storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600);
  if (error || !data) return out;
  for (const item of data) if (item.path && item.signedUrl) out.set(item.path, item.signedUrl);
  return out;
}
