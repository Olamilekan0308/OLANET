import { Router, type IRouter, type Request, type Response } from "express";
import { getSupabaseConfig } from "../lib/supabase-env";

const router: IRouter = Router();
const ACCESS_COOKIE = "skillhub_access_token";
type User = { id: string };

async function readJson<T>(response: { text(): Promise<string> }): Promise<T | null> {
  const text = await response.text();
  try { return text ? JSON.parse(text) as T : null; } catch { return null; }
}
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

router.get("/conversations", async (req, res): Promise<void> => {
  const a = await auth(req, res); if (!a) return;
  try {
    const m = await supabase(`/rest/v1/direct_conversation_members?user_id=eq.${encodeURIComponent(a.user.id)}&select=conversation_id`, a.token);
    const members = await readJson<Array<{ conversation_id: number }>>(m) ?? [];
    const ids = members.map(x => x.conversation_id).filter(Number.isInteger);
    if (!ids.length) { res.json([]); return; }
    const r = await supabase(`/rest/v1/direct_conversations?id=in.(${ids.join(",")})&select=*`, a.token);
    const data = await readJson<unknown>(r);
    res.status(r.ok ? 200 : 502).json(data ?? []);
  } catch (error) { req.log.error({ error }, "Direct conversation list failed"); res.status(502).json({ error: "Could not load conversations." }); }
});

router.post("/conversations", async (req, res): Promise<void> => {
  const a = await auth(req, res); if (!a) return;
  const ids = Array.isArray(req.body?.user_ids)
    ? [...new Set(req.body.user_ids.filter((x: unknown): x is string => typeof x === "string" && x !== a.user.id))]
    : [];
  if (!ids.length) { res.status(400).json({ error: "At least one other user is required" }); return; }
  try {
    const memberIds = [a.user.id, ...ids];
    const existing = await supabase(`/rest/v1/direct_conversation_members?user_id=eq.${encodeURIComponent(a.user.id)}&select=conversation_id`, a.token);
    const memberships = await readJson<Array<{ conversation_id: number }>>(existing) ?? [];
    for (const membership of memberships) {
      const members = await supabase(`/rest/v1/direct_conversation_members?conversation_id=eq.${membership.conversation_id}&select=user_id`, a.token);
      const rows = await readJson<Array<{ user_id: string }>>(members) ?? [];
      const current = rows.map(x => x.user_id).sort();
      if (current.length === memberIds.length && current.join(",") === [...memberIds].sort().join(",")) {
        const c = await supabase(`/rest/v1/direct_conversations?id=eq.${membership.conversation_id}&select=*`, a.token);
        const data = await readJson<unknown>(c);
        const conversation = Array.isArray(data) ? data[0] : data;
        if (conversation) { res.json(conversation); return; }
      }
    }
    const c = await supabase("/rest/v1/direct_conversations?select=*", a.token, { method: "POST", body: "{}", headers: { Prefer: "return=representation" } });
    const cd = await readJson<Array<{ id: number }>>(c);
    if (!c.ok || !cd?.[0]) { res.status(502).json({ error: "Could not create conversation." }); return; }
    const mr = await supabase("/rest/v1/direct_conversation_members", a.token, { method: "POST", body: JSON.stringify(memberIds.map(user_id => ({ conversation_id: cd[0].id, user_id }))), headers: { Prefer: "return=minimal" } });
    if (!mr.ok) { res.status(502).json({ error: "Could not add conversation members." }); return; }
    res.status(201).json(cd[0]);
  } catch (error) { req.log.error({ error }, "Direct conversation creation failed"); res.status(502).json({ error: "Could not open this chat." }); }
});

router.get("/conversations/:id/messages", async (req, res): Promise<void> => {
  const a = await auth(req, res); if (!a) return;
  try {
    const member = await supabase(`/rest/v1/direct_conversation_members?conversation_id=eq.${encodeURIComponent(req.params.id)}&user_id=eq.${encodeURIComponent(a.user.id)}&select=user_id&limit=1`, a.token);
    const rows = await readJson<unknown[]>(member) ?? [];
    if (!rows.length) { res.status(403).json({ error: "You are not a member of this chat." }); return; }
    const r = await supabase(`/rest/v1/chat_messages?conversation_id=eq.${encodeURIComponent(req.params.id)}&select=*&order=created_at.asc&limit=100`, a.token);
    const data = await readJson<unknown>(r);
    res.status(r.ok ? 200 : 502).json(data ?? []);
  } catch (error) { req.log.error({ error }, "Direct message load failed"); res.status(502).json({ error: "Could not load messages." }); }
});

router.post("/conversations/:id/messages", async (req, res): Promise<void> => {
  const a = await auth(req, res); if (!a) return;
  const text = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!text) { res.status(400).json({ error: "Message is required" }); return; }
  try {
    const member = await supabase(`/rest/v1/direct_conversation_members?conversation_id=eq.${encodeURIComponent(req.params.id)}&user_id=eq.${encodeURIComponent(a.user.id)}&select=user_id&limit=1`, a.token);
    const rows = await readJson<unknown[]>(member) ?? [];
    if (!rows.length) { res.status(403).json({ error: "You are not a member of this chat." }); return; }
    const r = await supabase("/rest/v1/chat_messages?select=*", a.token, { method: "POST", body: JSON.stringify({ conversation_id: Number(req.params.id), sender_id: a.user.id, body: text, reply_to_id: req.body?.reply_to_id ?? null, is_view_once: false, media_type: null, media_url: null }), headers: { Prefer: "return=representation" } });
    const data = await readJson<unknown>(r);
    res.status(r.ok ? 201 : 502).json(data ?? { error: "Could not send message." });
  } catch (error) { req.log.error({ error }, "Direct message send failed"); res.status(502).json({ error: "Could not send message." }); }
});

export default router;
