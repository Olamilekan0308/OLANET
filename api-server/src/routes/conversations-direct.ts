import { Router, type IRouter, type Request, type Response } from "express";
import { getSupabaseConfig } from "../lib/supabase-env";

const router: IRouter = Router();
const ACCESS_COOKIE = "skillhub_access_token";
const REFRESH_COOKIE = "skillhub_refresh_token";
type User = { id: string };
type Session = { user: User; token: string };

async function readJson<T>(r: { text(): Promise<string> }): Promise<T | null> {
  const t = await r.text();
  try { return t ? JSON.parse(t) as T : null; } catch { return null; }
}

async function sb(path: string, token: string | undefined, init: RequestInit = {}) {
  const c = getSupabaseConfig();
  const key = c.serviceRoleKey ?? c.anonKey;
  if (!key) throw new Error("Missing Supabase API key");
  return fetch(`${c.url}${path}`, {
    ...init,
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
}

function setCookie(res: Response, name: string, value: string, maxAge: number) {
  res.cookie(name, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge });
}

async function auth(req: Request, res: Response): Promise<Session | null> {
  const token = (req.cookies?.[ACCESS_COOKIE] ?? req.signedCookies?.[ACCESS_COOKIE]) as string | undefined;
  const refreshToken = (req.cookies?.[REFRESH_COOKIE] ?? req.signedCookies?.[REFRESH_COOKIE]) as string | undefined;
  if (token) {
    const r = await sb("/auth/v1/user", token);
    const user = await readJson<User>(r);
    if (r.ok && user?.id) return { user, token };
  }
  if (refreshToken) {
    const c = getSupabaseConfig();
    const r = await sb("/auth/v1/token?grant_type=refresh_token", undefined, {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
      headers: { Authorization: `Bearer ${c.anonKey ?? c.serviceRoleKey}` },
    });
    const d = await readJson<{ access_token?: string; refresh_token?: string; user?: User }>(r);
    if (r.ok && d?.access_token && d.user?.id) {
      setCookie(res, ACCESS_COOKIE, d.access_token, 3600000);
      if (d.refresh_token) setCookie(res, REFRESH_COOKIE, d.refresh_token, 2592000000);
      return { user: d.user, token: d.access_token };
    }
  }
  res.status(401).json({ error: "Not authenticated. Please log in again." });
  return null;
}

async function hasRelationship(a: string, b: string, token: string) {
  const r = await sb(`/rest/v1/friendships?or=(and(requester_id.eq.${encodeURIComponent(a)},addressee_id.eq.${encodeURIComponent(b)}),and(requester_id.eq.${encodeURIComponent(b)},addressee_id.eq.${encodeURIComponent(a)}))&status=in.(pending,accepted)&select=id&limit=1`, token);
  return r.ok && (await readJson<unknown[]>(r) ?? []).length > 0;
}

router.get("/conversations", async (req, res): Promise<void> => {
  const a = await auth(req, res); if (!a) return;
  try {
    const m = await sb(`/rest/v1/direct_conversation_members?user_id=eq.${encodeURIComponent(a.user.id)}&select=conversation_id`, a.token);
    if (!m.ok) { res.status(m.status || 502).json({ error: "Could not load conversations." }); return; }
    const rows = await readJson<Array<{ conversation_id: number }>>(m) ?? [];
    const ids = rows.map(x => x.conversation_id).filter(Number.isInteger);
    if (!ids.length) { res.json([]); return; }
    const r = await sb(`/rest/v1/direct_conversations?id=in.(${ids.join(",")})&select=*`, a.token);
    res.status(r.ok ? 200 : 502).json(await readJson<unknown>(r) ?? []);
  } catch (e) { req.log.error({ e }, "Conversation list failed"); res.status(502).json({ error: "Could not load conversations." }); }
});

router.post("/conversations", async (req, res): Promise<void> => {
  const a = await auth(req, res); if (!a) return;
  const ids = Array.isArray(req.body?.user_ids)
    ? [...new Set(req.body.user_ids.filter((x: unknown): x is string => typeof x === "string" && x !== a.user.id))]
    : [];
  if (ids.length !== 1) { res.status(400).json({ error: "A private chat must contain exactly one person." }); return; }
  if (!(await hasRelationship(a.user.id, ids[0], a.token))) {
    res.status(403).json({ error: "Add this person as a friend first." }); return;
  }
  try {
    const existing = await sb(`/rest/v1/direct_conversation_members?user_id=eq.${encodeURIComponent(a.user.id)}&select=conversation_id`, a.token);
    if (!existing.ok) { res.status(existing.status || 502).json({ error: "Could not load your conversations." }); return; }
    const memberships = await readJson<Array<{ conversation_id: number }>>(existing) ?? [];
    const target = [a.user.id, ids[0]].sort().join(",");
    for (const x of memberships) {
      const mr = await sb(`/rest/v1/direct_conversation_members?conversation_id=eq.${x.conversation_id}&select=user_id`, a.token);
      if (!mr.ok) continue;
      const members = await readJson<Array<{ user_id: string }>>(mr) ?? [];
      if (members.map(v => v.user_id).sort().join(",") === target) {
        const cr = await sb(`/rest/v1/direct_conversations?id=eq.${x.conversation_id}&select=*`, a.token);
        const d = await readJson<unknown>(cr);
        if (Array.isArray(d) && d[0]) { res.json(d[0]); return; }
      }
    }
    const c = await sb("/rest/v1/direct_conversations?select=*", a.token, { method: "POST", body: "{}", headers: { Prefer: "return=representation" } });
    const cd = await readJson<Array<{ id: number }>>(c);
    if (!c.ok || !cd?.[0]) { res.status(c.status || 502).json({ error: "Could not create conversation.", details: cd }); return; }
    const mr = await sb("/rest/v1/direct_conversation_members", a.token, {
      method: "POST",
      body: JSON.stringify([a.user.id, ids[0]].map(user_id => ({ conversation_id: cd[0].id, user_id }))),
      headers: { Prefer: "return=minimal" },
    });
    if (!mr.ok) { res.status(mr.status || 502).json({ error: "Could not add conversation members." }); return; }
    res.status(201).json(cd[0]);
  } catch (e) { req.log.error({ e }, "Conversation creation failed"); res.status(502).json({ error: "Could not open this chat." }); }
});

router.get("/conversations/:id/messages", async (req, res): Promise<void> => {
  const a = await auth(req, res); if (!a) return;
  try {
    const m = await sb(`/rest/v1/direct_conversation_members?conversation_id=eq.${encodeURIComponent(req.params.id)}&user_id=eq.${encodeURIComponent(a.user.id)}&select=user_id&limit=1`, a.token);
    if (!(await readJson<unknown[]>(m) ?? []).length) { res.status(403).json({ error: "You are not a member of this chat." }); return; }
    const r = await sb(`/rest/v1/chat_messages?conversation_id=eq.${encodeURIComponent(req.params.id)}&select=*&order=created_at.asc&limit=100`, a.token);
    res.status(r.ok ? 200 : 502).json(await readJson<unknown>(r) ?? []);
  } catch (e) { req.log.error({ e }, "Message load failed"); res.status(502).json({ error: "Could not load messages." }); }
});

router.post("/conversations/:id/messages", async (req, res): Promise<void> => {
  const a = await auth(req, res); if (!a) return;
  const text = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!text) { res.status(400).json({ error: "Message is required" }); return; }
  try {
    const m = await sb(`/rest/v1/direct_conversation_members?conversation_id=eq.${encodeURIComponent(req.params.id)}&user_id=eq.${encodeURIComponent(a.user.id)}&select=user_id&limit=1`, a.token);
    if (!(await readJson<unknown[]>(m) ?? []).length) { res.status(403).json({ error: "You are not a member of this chat." }); return; }
    const r = await sb("/rest/v1/chat_messages?select=*", a.token, {
      method: "POST",
      body: JSON.stringify({ conversation_id: Number(req.params.id), sender_id: a.user.id, body: text, reply_to_id: req.body?.reply_to_id ?? null, is_view_once: false, media_type: null, media_url: null }),
      headers: { Prefer: "return=representation" },
    });
    const data = await readJson<unknown>(r);
    res.status(r.ok ? 201 : r.status || 502).json(data ?? { error: "Could not send message." });
  } catch (e) { req.log.error({ e }, "Message send failed"); res.status(502).json({ error: "Could not send message." }); }
});

export default router;
