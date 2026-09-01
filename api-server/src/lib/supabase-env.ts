/**
 * Vercel-compatible Supabase configuration.
 *
 * This is intentionally kept separate from the legacy Replit connector so
 * the API routes can be migrated incrementally without breaking production.
 */
export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url) {
    throw new Error("Missing SUPABASE_URL environment variable");
  }

  if (!anonKey && !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY environment variable",
    );
  }

  return {
    url,
    anonKey,
    serviceRoleKey,
  };
}

export function supabaseRestUrl(path: string) {
  const { url } = getSupabaseConfig();
  return `${url}/rest/v1/${path.replace(/^\//, "")}`;
}

export function supabaseAuthUrl(path: string) {
  const { url } = getSupabaseConfig();
  return `${url}/auth/v1/${path.replace(/^\//, "")}`;
}

export function supabaseStorageUrl(path: string) {
  const { url } = getSupabaseConfig();
  return `${url}/storage/v1/${path.replace(/^\//, "")}`;
}
