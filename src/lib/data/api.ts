import type { Scene } from "@/editor/scene/types";
import { createClient } from "@/lib/supabase/client";
import type { BoardRow, FolderRow, ProjectFilter, ProjectRow, SharedProject, ShareRow, VersionMeta } from "./types";

/**
 * Accès aux données depuis le navigateur. La RLS limite chaque requête aux lignes que
 * l'utilisateur peut voir (les siennes et celles de ses clubs) ; ces fonctions ne filtrent
 * jamais par propriétaire, seulement par espace (`clubId` nul = espace personnel).
 */
export function inScope<Q>(query: Q, clubId: string | null): Q {
  const q = query as unknown as { is: (c: string, v: null) => Q; eq: (c: string, v: string) => Q };
  return clubId ? q.eq("club_id", clubId) : q.is("club_id", null);
}
let client: ReturnType<typeof createClient> | undefined;
const db = () => (client ??= createClient());

const PROJECT_COLS = "id,name,folder_id,club_id,tags,favorite,is_template,sheet,created_at,updated_at,deleted_at";
const BOARD_COLS = "id,project_id,position,name,notes,video_url,sheet,scene";

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

// --- Dossiers ----------------------------------------------------------------

export async function listFolders(clubId: string | null): Promise<FolderRow[]> {
  return unwrap(await inScope(db().from("folders").select("id,name").is("deleted_at", null), clubId).order("name"));
}

export async function createFolder(name: string, clubId: string | null): Promise<FolderRow> {
  return unwrap(await db().from("folders").insert({ name, club_id: clubId }).select("id,name").single());
}

export async function renameFolder(id: string, name: string) {
  unwrap(await db().from("folders").update({ name }).eq("id", id).select("id"));
}

/** Met le dossier et ses projets à la corbeille. */
export async function trashFolder(id: string) {
  const now = new Date().toISOString();
  unwrap(
    await db().from("projects").update({ deleted_at: now }).eq("folder_id", id).is("deleted_at", null).select("id"),
  );
  unwrap(await db().from("folders").update({ deleted_at: now }).eq("id", id).select("id"));
}

// --- Projets -----------------------------------------------------------------

export async function listProjects(filter: ProjectFilter, clubId: string | null): Promise<ProjectRow[]> {
  let query = inScope(db().from("projects").select(PROJECT_COLS), clubId);
  if (filter.kind === "trash") {
    query = query.not("deleted_at", "is", null);
  } else {
    query = query.is("deleted_at", null);
    if (filter.kind === "all") query = query.eq("is_template", false);
    if (filter.kind === "favorites") query = query.eq("favorite", true);
    if (filter.kind === "templates") query = query.eq("is_template", true);
    if (filter.kind === "folder") query = query.eq("folder_id", filter.folderId);
  }
  return unwrap(await query.order("updated_at", { ascending: false }).limit(200));
}

export async function searchProjects(q: string, clubId: string | null): Promise<ProjectRow[]> {
  // % et _ sont des jokers pour ILIKE : on les neutralise dans la saisie.
  const safe = q.replace(/[%_\\]/g, " ").trim();
  if (!safe) return [];
  return unwrap(await db().rpc("search_projects", { q: safe, p_club: clubId }));
}

export async function createProject(
  name: string,
  boardName: string,
  scene: Scene,
  folderId: string | null,
  clubId: string | null,
): Promise<string> {
  return unwrap(
    await db().rpc("create_project", {
      p_name: name,
      p_board_name: boardName,
      p_scene: scene,
      p_folder: folderId,
      p_club: clubId,
    }),
  );
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<ProjectRow, "name" | "folder_id" | "club_id" | "tags" | "favorite" | "is_template" | "deleted_at" | "sheet">>,
) {
  unwrap(await db().from("projects").update(patch).eq("id", id).select("id"));
}

/** Copie vers l'espace indiqué (par défaut celui du projet). */
export async function duplicateProject(id: string, name: string, asTemplate: boolean, clubId: string | null): Promise<string> {
  return unwrap(
    await db().rpc("duplicate_project", { p_id: id, p_name: name, p_as_template: asTemplate, p_club: clubId }),
  );
}

/** Range un projet dans un autre espace (il quitte son dossier). */
export async function moveProject(id: string, clubId: string | null) {
  unwrap(await db().from("projects").update({ club_id: clubId, folder_id: null }).eq("id", id).select("id"));
}

export async function purgeProject(id: string) {
  unwrap(await db().from("projects").delete().eq("id", id).select("id"));
}

export async function loadProject(id: string): Promise<{ project: ProjectRow; boards: BoardRow[] } | null> {
  const project = unwrap(
    await db().from("projects").select(PROJECT_COLS).eq("id", id).is("deleted_at", null).limit(1),
  ) as ProjectRow[];
  if (project.length === 0) return null;
  const boards = unwrap(
    await db().from("boards").select(BOARD_COLS).eq("project_id", id).is("deleted_at", null).order("position"),
  ) as BoardRow[];
  return { project: project[0], boards };
}

// --- Tableaux ----------------------------------------------------------------

export async function insertBoard(
  board: Pick<BoardRow, "project_id" | "name" | "scene" | "position"> & Partial<Pick<BoardRow, "notes" | "video_url">>,
): Promise<BoardRow> {
  return unwrap(await db().from("boards").insert(board).select(BOARD_COLS).single());
}

export async function updateBoard(
  id: string,
  patch: Partial<Pick<BoardRow, "name" | "notes" | "video_url" | "scene" | "position" | "sheet">> & { deleted_at?: string },
) {
  unwrap(await db().from("boards").update(patch).eq("id", id).select("id"));
}

// --- Versions ----------------------------------------------------------------

export async function listVersions(boardId: string): Promise<VersionMeta[]> {
  return unwrap(
    await db()
      .from("board_versions")
      .select("id,created_at")
      .eq("board_id", boardId)
      .order("created_at", { ascending: false })
      .limit(50),
  );
}

export async function insertVersion(boardId: string, scene: Scene) {
  unwrap(await db().from("board_versions").insert({ board_id: boardId, scene }).select("id"));
}

export async function loadVersionScene(id: string): Promise<Scene | null> {
  const rows = unwrap(await db().from("board_versions").select("scene").eq("id", id).limit(1)) as {
    scene: Scene;
  }[];
  return rows[0]?.scene ?? null;
}

// --- Liens publics -----------------------------------------------------------

export async function activeShare(projectId: string): Promise<ShareRow | null> {
  const rows = unwrap(
    await db()
      .from("shares")
      .select("id,token,created_at")
      .eq("project_id", projectId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1),
  ) as ShareRow[];
  return rows[0] ?? null;
}

export async function createShare(projectId: string): Promise<ShareRow> {
  return unwrap(await db().from("shares").insert({ project_id: projectId }).select("id,token,created_at").single());
}

export async function revokeShare(id: string) {
  unwrap(await db().from("shares").update({ revoked_at: new Date().toISOString() }).eq("id", id).select("id"));
}

/** Lecture publique, sans compte : seul un jeton valide et actif renvoie quelque chose. */
export async function loadSharedProject(token: string): Promise<SharedProject | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  return (unwrap(await db().rpc("get_shared_project", { p_token: token })) as SharedProject | null) ?? null;
}
