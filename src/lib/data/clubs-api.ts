import { createClient } from "@/lib/supabase/client";

/**
 * Clubs, membres et invitations. Les droits sont appliqués par la base (RLS et fonctions) :
 * ces appels échouent proprement si l'utilisateur n'a pas le rôle requis.
 */
let client: ReturnType<typeof createClient> | undefined;
const db = () => (client ??= createClient());

export const CLUB_ROLES = ["admin", "coach", "viewer"] as const;
export type ClubRole = (typeof CLUB_ROLES)[number];

export interface ClubRow {
  id: string;
  name: string;
  role: ClubRole;
}

export interface MemberRow {
  user_id: string;
  role: ClubRole;
  email: string;
  display_name: string | null;
  created_at: string;
}

export interface InviteRow {
  id: string;
  role: ClubRole;
  label: string;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

export interface InviteInfo {
  club_id: string;
  club_name: string;
  role: ClubRole;
  status: "valid" | "expired" | "used" | "revoked";
  member: boolean;
}

function unwrap<T>(result: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (result.error) throw Object.assign(new Error(result.error.message), { code: result.error.code });
  return result.data as T;
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await db().auth.getSession();
  return data.session?.user.id ?? null;
}

/** Mes clubs, avec mon rôle dans chacun. */
export async function listMyClubs(): Promise<ClubRow[]> {
  const uid = await currentUserId();
  if (!uid) return [];
  const [memberships, clubs] = await Promise.all([
    db().from("club_members").select("club_id,role").eq("user_id", uid),
    db().from("clubs").select("id,name").order("name"),
  ]);
  const roles = new Map(unwrap(memberships).map((m: { club_id: string; role: ClubRole }) => [m.club_id, m.role]));
  return (unwrap(clubs) as { id: string; name: string }[])
    .filter((c) => roles.has(c.id))
    .map((c) => ({ ...c, role: roles.get(c.id)! }));
}

export async function createClub(name: string): Promise<string> {
  return unwrap(await db().rpc("create_club", { p_name: name }));
}

export async function renameClub(id: string, name: string) {
  unwrap(await db().from("clubs").update({ name }).eq("id", id).select("id"));
}

export async function deleteClub(id: string) {
  unwrap(await db().from("clubs").delete().eq("id", id).select("id"));
}

export async function listMembers(clubId: string): Promise<MemberRow[]> {
  return unwrap(await db().rpc("club_members_list", { p_club: clubId }));
}

export async function setMemberRole(clubId: string, userId: string, role: ClubRole) {
  unwrap(await db().from("club_members").update({ role }).eq("club_id", clubId).eq("user_id", userId).select("user_id"));
}

/** Retire un membre (admin) ou quitte le club (soi-même). */
export async function removeMember(clubId: string, userId: string) {
  unwrap(await db().from("club_members").delete().eq("club_id", clubId).eq("user_id", userId).select("user_id"));
}

const INVITE_COLS = "id,role,label,token,created_at,expires_at,accepted_at,revoked_at";

export async function listInvites(clubId: string): Promise<InviteRow[]> {
  return unwrap(
    await db().from("club_invites").select(INVITE_COLS).eq("club_id", clubId).order("created_at", { ascending: false }),
  );
}

export async function createInvite(clubId: string, role: ClubRole, label: string): Promise<InviteRow> {
  const uid = await currentUserId();
  return unwrap(
    await db().from("club_invites").insert({ club_id: clubId, role, label, invited_by: uid }).select(INVITE_COLS).single(),
  );
}

export async function revokeInvite(id: string) {
  unwrap(await db().from("club_invites").update({ revoked_at: new Date().toISOString() }).eq("id", id).select("id"));
}

export async function getInvite(token: string): Promise<InviteInfo | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  return (unwrap(await db().rpc("get_invite", { p_token: token })) as InviteInfo | null) ?? null;
}

export async function acceptInvite(token: string): Promise<string> {
  return unwrap(await db().rpc("accept_invite", { p_token: token }));
}

/** Une invitation encore utilisable. */
export function inviteActive(invite: InviteRow, now = Date.now()) {
  return !invite.revoked_at && !invite.accepted_at && new Date(invite.expires_at).getTime() > now;
}
