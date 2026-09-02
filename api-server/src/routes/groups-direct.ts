import { Router, type IRouter, type Request, type Response } from "express";
import { getSupabaseConfig } from "../lib/supabase-env";

const router: IRouter = Router();
const ACCESS_COOKIE = "skillhub_access_token";
type User = { id: string };

async function readJson<T>(response: { text(): Promise<string> }): Promise<T | null> { const text = await response.text(); try { return text ? JSON.parse(text) as T : null; } catch { return null; } }
async function supabase(path: string, token: string, init: RequestInit = {}) {
  const { url, serviceRoleKey, anonKey } = getSupabaseConfig();
  const key = serviceRoleKey ?? anonKey;
  if (!key) throw new Error("Missing Supabase API key");
  return fetch(`${url}${path}`, { ...init, headers: { apikey: key, "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
}
async function auth(req: Request, res: Response): Promise<{ user: User; token: string } | null> {
  const token = (req.cookies?.[ACCESS_COOKIE] ?? req.signedCookies?.[ACCESS_COOKIE]) as string | undefined;
  if (!token) { res.status(401).json({ error: "Not authenticated. Please log in again." }); return null; }
  const r = await supabase("/auth/v1/user", token);
  const user = await readJson<User>(r);
  if (!r.ok || !user?.id) { res.status(401).json({ error: "Session expired. Please log in again." }); return null; }
  return { user, token };
}

router.get("/groups", async (req, res): Promise<void> => {
  const a = await auth(req, res); if (!a) return;
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
    const params = new URLSearchParams({ select: "*", order: "created_at.desc", limit: "50" });
    if (q) params.set("name", `ilike.*${q.replace(/[\\%_,()]/g, " ")}*`);
    const r = await supabase(`/rest/v1/groups?${params}`, a.token);
    const data = await readJson<unknown>(r);
    res.status(r.ok ? 200 : 502).json(data ?? { error: "Could not load groups." });
  } catch (error) { req.log.error({ error }, "Group list failed"); res.status(502).json({ error: "Could not load groups." }); }
});

router.post("/groups", async (req, res): Promise<void> => {
  const a = await auth(req, res); if (!a) return;
  const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 120) : "";
  if (!name) { res.status(400).json({ error: "Group name is required" }); return; }
  try {
    const r = await supabase("/rest/v1/groups?select=*", a.token, { method: "POST", body: JSON.stringify({ name, description: req.body?.description ?? null, avatar_url: req.body?.avatar_url ?? null, created_by: a.user.id }), headers: { Prefer: "return=representation" } });
    const data = await readJson<unknown>(r);
    if (!r.ok) { res.status(502).json({ error: "Could not create group." }); return; }
    const group = Array.isArray(data) ? data[0] : data;
    const id = group && typeof (group as { id?: unknown }).id === "number" ? (group as { id: number }).id : null;
    if (id !== null) await supabase("/rest/v1/group_members", a.token, { method: "POST", body: JSON.stringify({ group_id: id, user_id: a.user.id, role: "owner" }) });
    res.status(201).json(group);
  } catch (error) { req.log.error({ error }, "Group creation failed"); res.status(502).json({ error: "Could not create group." }); }
});

router.post("/groups/:id/join", async (req, res): Promise<void> => {
  const a = await auth(req, res); if (!a) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid group." }); return; }
  try {
    const r = await supabase("/rest/v1/group_members", a.token, { method: "POST", body: JSON.stringify({ group_id: id, user_id: a.user.id, role: "member" }), headers: { Prefer: "resolution=ignore-duplicates,return=minimal" } });
    if (!r.ok && r.status !== 409) { const d = await readJson<{ message?: string }>(r); res.status(502).json({ error: d?.message || "Unable to join this group." }); return; }
    res.json({ joined: true, groupId: id });
  } catch (error) { req.log.error({ error }, "Group join failed"); res.status(502).json({ error: "Unable to join this group." }); }
});

router.delete("/groups/:id/leave", async (req, res): Promise<void> => {
  const a = await auth(req, res); if (!a) return;
  const r = await supabase(`/rest/v1/group_members?group_id=eq.${encodeURIComponent(req.params.id)}&user_id=eq.${encodeURIComponent(a.user.id)}`, a.token, { method: "DELETE" });
  if (!r.ok && r.status !== 404) { res.status(502).json({ error: "Unable to leave this group." }); return; }
  res.status(204).send();
});

router.get("/groups/:id/messages", async (req, res): Promise<void> => {
  const a = await auth(req, res); if (!a) return;
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const r = await supabase(`/rest/v1/chat_messages?group_id=eq.${encodeURIComponent(req.params.id)}&select=*&order=created_at.desc&limit=${limit}`, a.token);
  const data = await readJson<unknown>(r);
  res.status(r.ok ? 200 : 502).json(Array.isArray(data) ? data.reverse() : data ?? []);
});

router.post("/groups/:id/messages", async (req, res): Promise<void> => {
  const a = await auth(req, res); if (!a) return;
  const text = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  const mediaUrl = typeof req.body?.media_url === "string" ? req.body.media_url.trim() : null;
  if (!text && !mediaUrl) { res.status(400).json({ error: "Message or media is required" }); return; }
  const r = await supabase("/rest/v1/chat_messages?select=*", a.token, { method: "POST", body: JSON.stringify({ group_id: Number(req.params.id), sender_id: a.user.id, body: text, reply_to_id: req.body?.reply_to_id ?? null, is_view_once: Boolean(req.body?.is_view_once), media_type: req.body?.media_type ?? null, media_url: mediaUrl }), headers: { Prefer: "return=representation" } });
  const data = await readJson<unknown>(r);
  res.status(r.ok ? 201 : 502).json(data ?? { error: "Could not send message." });
});

export default router;
