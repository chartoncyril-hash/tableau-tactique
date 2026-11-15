export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
export const isGoogleAuthEnabled =
  process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "1";
