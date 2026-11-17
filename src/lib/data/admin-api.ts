import { createClient } from "@/lib/supabase/client";

/**
 * Tableau de bord du propriétaire : la base ne répond qu'aux administrateurs de l'application
 * (table app_admins), voir la migration admin_stats.
 */
let client: ReturnType<typeof createClient> | undefined;
const db = () => (client ??= createClient());

export interface DayCount {
  day: string;
  count: number;
}

export interface AdminStats {
  users: { total: number; confirmed: number; new7: number; new30: number; active7: number; active30: number };
  content: Record<"projects" | "boards" | "clubs" | "teams" | "players" | "drills" | "shares" | "comments", number>;
  signups: DayCount[];
  projectsPerDay: DayCount[];
  recent: { email: string; created_at: string; last_sign_in_at: string | null; confirmed: boolean; projects: number; clubs: number }[];
}

let adminCheck: Promise<boolean> | null = null;

/** Vrai pour un administrateur de l'application ; vérifié une fois par visite. */
export function isAppAdmin(): Promise<boolean> {
  adminCheck ??= Promise.resolve(db().rpc("is_app_admin")).then(
    ({ data, error }) => !error && data === true,
    () => false,
  );
  return adminCheck;
}

export async function adminStats(): Promise<AdminStats> {
  const { data, error } = await db().rpc("admin_stats");
  if (error) throw new Error(error.message);
  return data as AdminStats;
}
