import { createClient } from "@/lib/supabase/client";

/** Commentaires des tableaux ; la RLS limite tout aux tableaux que l'utilisateur peut voir. */
let client: ReturnType<typeof createClient> | undefined;
const db = () => (client ??= createClient());

export interface CommentRow {
  id: string;
  board_id: string;
  author_id: string | null;
  author_name: string;
  parent_id: string | null;
  body: string;
  x: number | null;
  y: number | null;
  resolved_at: string | null;
  created_at: string;
}

const COLS = "id,board_id,author_id,author_name,parent_id,body,x,y,resolved_at,created_at";

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export async function listComments(boardId: string): Promise<CommentRow[]> {
  return unwrap(await db().from("board_comments").select(COLS).eq("board_id", boardId).order("created_at"));
}

export async function addComment(
  boardId: string,
  body: string,
  options: { parentId?: string; x?: number; y?: number } = {},
): Promise<CommentRow> {
  const { data } = await db().auth.getSession();
  return unwrap(
    await db()
      .from("board_comments")
      .insert({
        board_id: boardId,
        author_id: data.session?.user.id,
        body,
        parent_id: options.parentId ?? null,
        x: options.x ?? null,
        y: options.y ?? null,
      })
      .select(COLS)
      .single(),
  );
}

export async function setResolved(id: string, resolved: boolean) {
  unwrap(
    await db()
      .from("board_comments")
      .update({ resolved_at: resolved ? new Date().toISOString() : null })
      .eq("id", id)
      .select("id"),
  );
}

export async function deleteComment(id: string) {
  unwrap(await db().from("board_comments").delete().eq("id", id).select("id"));
}
