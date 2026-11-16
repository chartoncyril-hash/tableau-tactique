import type { Scene } from "@/editor/scene/types";
import { createClient } from "@/lib/supabase/client";
import type { BoardRow, FolderRow, ProjectFilter, ProjectRow, VersionMeta } from "./types";

/**
 * Accès aux données depuis le navigateur. La RLS limite chaque requête aux lignes de
 * l'utilisateur connecté ; ces fonctions ne filtrent jamais par propriétaire elles-mêmes.
 */
let client: ReturnType<typeof createClient> | undefined;
const db = () => (client ??= createClient());

const PROJECT_COLS = "id,name,folder_id,tags,favorite,is_template,created_at,updated_at,deleted_at";
const BOARD_COLS = "id,project_id,position,name,notes,video_url,scene";

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

// --- Dossiers ----------------------------------------------------------------

export async function listFolders(): Promise<FolderRow[]> {
  return unwrap(await db().from("folders").select("id,name").is("deleted_at", null).order("name"));
}

export async function createFolder(name: string): Promise<FolderRow> {
  return unwrap(await db().from("folders").insert({ name }).select("id,name").single());
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

export async function listProjects(filter: ProjectFilter): Promise<ProjectRow[]> {
  let query = db().from("projects").select(PROJECT_COLS);
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

export async function searchProjects(q: string): Promise<ProjectRow[]> {
  // % et _ sont des jokers pour ILIKE : on les neutralise dans la saisie.
  const safe = q.replace(/[%_\\]/g, " ").trim();
  if (!safe) return [];
  return unwrap(await db().rpc("search_projects", { q: safe }));
}

export async function createProject(
  name: string,
  boardName: string,
  scene: Scene,
  folderId: string | null,
): Promise<string> {
  return unwrap(
    await db().rpc("create_project", {
      p_name: name,
      p_board_name: boardName,
      p_scene: scene,
      p_folder: folderId,
    }),
  );
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<ProjectRow, "name" | "folder_id" | "tags" | "favorite" | "is_template" | "deleted_at">>,
) {
  unwrap(await db().from("projects").update(patch).eq("id", id).select("id"));
}

export async function duplicateProject(id: string, name: string, asTemplate: boolean): Promise<string> {
  return unwrap(await db().rpc("duplicate_project", { p_id: id, p_name: name, p_as_template: asTemplate }));
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
  patch: Partial<Pick<BoardRow, "name" | "notes" | "video_url" | "scene" | "position">> & { deleted_at?: string },
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
