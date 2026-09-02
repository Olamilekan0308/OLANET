import { Router, type IRouter, type Request, type Response } from "express";
import { getSupabaseConfig } from "../lib/supabase-env";

const router: IRouter = Router();
const ACCESS_COOKIE = "skillhub_access_token";
type User = { id: string; email?: string | null };
type PersonRow = { id?: string; full_name?: string | null; username?: string | null; avatar_url?: string | null; bio?: string | null };

async function readJson<T>(response: { text(): Promise<string> }): Promise<T | null> { const text = await response.text(); try { return text ? JSON.parse(text) as T : null; } catch { return null; } }
async function request(path: string, token?: string, init: RequestInit = {}) {
  const { url, anonKey, serviceRoleKey } = getSupabaseConfig(); const key = serviceRoleKey ?? anonKey;
  if (!key) throw new Error("Missing Supabase API key");
  return fetch(`${url}${path}`, { ...init, headers: { apikey: key, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) } });
}
async function auth(req: Request, res: Response): Promise<{ user: User; token: string } | null> {
  const token = (req.cookies?.[ACCESS_COOKIE] ?? req.signedCookies?.[ACCESS_COOKIE]) as string | undefined;
  if (!token) { res.status(401).json({ error: "Not authenticated. Please log in again." }); return null; }
  const r = await request("/auth/v1/user", token); const user = await readJson<User>(r);
  if (!r.ok || !user?.id) { res.status(401).json({ error: "Session expired. Please log in again." }); return null; }
  return { user, token };
}
function cleanSearch(value: string) { return value.replace(/[\\%_,()*.]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80); }

router.get("/people", async (req, res): Promise<void> => {
  const session = await auth(req, res); if (!session) return;
  try {
    const q = typeof req.query.q === "string" ? cleanSearch(req.query.q) : "";
    const base = new URLSearchParams({ select: "id,full_name,username,avatar_url,bio", order: "full_name.asc", limit: "100" });
    const paths = q ? [
      `/rest/v1/profiles?${new URLSearchParams([...base, ["full_name", `ilike.*${q}*`]])}`,
      `/rest/v1/profiles?${new URLSearchParams([...base, ["username", `ilike.*${q}*`]])}`,
    ] : [`/rest/v1/profiles?${base.toString()}`];
    // Keep the authenticated user's bearer token on both profile queries. Without it,
    // RLS can make an otherwise valid search look empty or fail depending on policy setup.
    const responses = await Promise.all(paths.map(path => request(path, session.token)));
    const payloads = await Promise.all(responses.map(readJson<unknown>));
    const failed = responses.findIndex(r => !r.ok);
    if (failed >= 0) { res.status(502).json({ error: "Could not search OLANET users right now." }); return; }
    const rows = payloads.flatMap(data => Array.isArray(data) ? data as PersonRow[] : []);
    const seen = new Set<string>();
    res.json(rows.filter(row => { const id = row.id; if (typeof id !== "string" || id === session.user.id || seen.has(id)) return false; seen.add(id); return true; }));
  } catch (error) { req.log.error({ error }, "Direct people search failed"); res.status(502).json({ error: "Could not search OLANET users right now." }); }
});
export default router;
