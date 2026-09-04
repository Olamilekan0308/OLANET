import { Router, type IRouter, type Request, type Response } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router: IRouter = Router();
const ACCESS_COOKIE = "skillhub_access_token";
type User = { id: string; email?: string | null };
async function readJson<T>(response: { text(): Promise<string> }): Promise<T | null> { const text = await response.text(); try { return text ? JSON.parse(text) as T : null; } catch { return null; } }
async function supabase(path: string, token: string, init: { method?: string; body?: unknown; headers?: Record<string,string> } = {}) { const connectors = new ReplitConnectors(); return connectors.proxy("supabase", path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) } }); }
async function auth(req: Request, res: Response): Promise<{ user: User; token: string } | null> { const token = req.signedCookies?.[ACCESS_COOKIE] as string | undefined; if (!token) { res.status(401).json({ error: "Not authenticated" }); return null; } const r = await supabase("/auth/v1/user", token, { method: "GET" }); const user = await readJson<User>(r); if (!r.ok || !user?.id) { res.status(401).json({ error: "Session expired. Please log in again." }); return null; } return { user, token }; }
const json = (value: unknown) => JSON.stringify(value);

router.get("/friends", async (req, res): Promise<void> => {
  const a = await auth(req, res); if (!a) return;
  const r = await supabase(`/rest/v1/friendships?or=(requester_id.eq.${a.user.id},addressee_id.eq.${a.user.id})&select=*`, a.token, { method: "GET" });
  res.status(r.ok ? 200 : r.status).json(await readJson<unknown>(r) ?? []);
});

router.get("/friends/requests", async (req, res): Promise<void> => {
  const a = await auth(req, res); if (!a) return;
  const r = await supabase(`/rest/v1/friendships?addressee_id=eq.${a.user.id}&status=eq.pending&select=*`, a.token, { method: "GET" });
  res.status(r.ok ? 200 : r.status).json(await readJson<unknown>(r) ?? []);
});

router.post("/friends/:userId", async (req, res): Promise<void> => {
  const a = await auth(req, res); if (!a) return;
  const target = req.params.userId;
  if (!target || target === a.user.id) { res.status(400).json({ error: "You cannot send a friend request to yourself." }); return; }
  const existing = await supabase(`/rest/v1/friendships?or=(and(requester_id.eq.${a.user.id},addressee_id.eq.${target}),and(requester_id.eq.${target},addressee_id.eq.${a.user.id}))&select=*`, a.token, { method: "GET" });
  const rows = await readJson<Array<{ id: string; requester_id: string; addressee_id: string; status: string }>>(existing) ?? [];
  if (rows.length) { res.status(409).json({ error: `A friendship or request already exists (${rows[0].status}).`, friendship: rows[0] }); return; }
  const r = await supabase("/rest/v1/friendships?select=*", a.token, { method: "POST", body: json({ requester_id: a.user.id, addressee_id: target, status: "pending" }), headers: { Prefer: "return=representation" } });
  const data = await readJson<unknown>(r);
  if (!r.ok) { res.status(r.status).json(data ?? { error: "Could not send friend request." }); return; }
  res.status(201).json(Array.isArray(data) ? data[0] : data);
});

router.patch("/friends/:friendshipId", async (req, res): Promise<void> => {
  const a = await auth(req, res); if (!a) return;
  const status = typeof req.body?.status === "string" ? req.body.status : "";
  if (!new Set(["accepted", "declined", "blocked"]).has(status)) { res.status(400).json({ error: "Invalid friendship status." }); return; }
  const r = await supabase(`/rest/v1/friendships?id=eq.${encodeURIComponent(req.params.friendshipId)}&addressee_id=eq.${a.user.id}&status=eq.pending`, a.token, { method: "PATCH", body: json({ status, updated_at: new Date().toISOString() }), headers: { Prefer: "return=representation" } });
  const data = await readJson<unknown>(r);
  res.status(r.ok ? 200 : r.status).json(data ?? {});
});

router.delete("/friends/:friendshipId", async (req, res): Promise<void> => {
  const a = await auth(req, res); if (!a) return;
  const r = await supabase(`/rest/v1/friendships?id=eq.${encodeURIComponent(req.params.friendshipId)}&or=(requester_id.eq.${a.user.id},addressee_id.eq.${a.user.id})`, a.token, { method: "DELETE" });
  res.status(r.ok ? 204 : r.status).send();
});

export default router;
