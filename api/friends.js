import express from "express";

const app = express();
const ACCESS_COOKIE = "skillhub_access_token";
app.use(express.json({ limit: "1mb" }));

function config() {
  const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = String(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("Supabase environment is not configured");
  return { url, key };
}
async function supabase(path, options = {}) {
  const { url, key } = config();
  return fetch(`${url}${path}`, { ...options, headers: { apikey: key, "Content-Type": "application/json", ...(options.headers || {}) } });
}
async function json(response) { const text = await response.text(); if (!text) return null; try { return JSON.parse(text); } catch { return null; } }
function cookies(req) { const out = {}; for (const part of String(req.headers.cookie || "").split(";")) { const i = part.indexOf("="); if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } return out; }
async function auth(req, res) {
  const token = cookies(req)[ACCESS_COOKIE];
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return null; }
  const r = await supabase("/auth/v1/user", { headers: { Authorization: `Bearer ${token}` } });
  const user = await json(r);
  if (!r.ok || !user?.id) { res.status(401).json({ error: "Session expired. Please log in again." }); return null; }
  return { user, token };
}
app.get("/api/friends", async (req, res) => {
  const a = await auth(req, res); if (!a) return;
  try { const r = await supabase(`/rest/v1/friendships?or=(requester_id.eq.${encodeURIComponent(a.user.id)},addressee_id.eq.${encodeURIComponent(a.user.id)})&select=*`, { headers: { Authorization: `Bearer ${a.token}` } }); const data = await json(r); return res.status(r.ok ? 200 : r.status).json(Array.isArray(data) ? data : []); }
  catch (e) { return res.status(500).json({ error: e?.message || "Unable to load friends." }); }
});
app.get("/api/friends/requests", async (req, res) => {
  const a = await auth(req, res); if (!a) return;
  try { const r = await supabase(`/rest/v1/friendships?addressee_id=eq.${encodeURIComponent(a.user.id)}&status=eq.pending&select=*`, { headers: { Authorization: `Bearer ${a.token}` } }); const data = await json(r); return res.status(r.ok ? 200 : r.status).json(Array.isArray(data) ? data : []); }
  catch (e) { return res.status(500).json({ error: e?.message || "Unable to load friend requests." }); }
});
app.post("/api/friends/:userId", async (req, res) => {
  const a = await auth(req, res); if (!a) return;
  const target = String(req.params.userId || "");
  if (!target || target === a.user.id) return res.status(400).json({ error: "You cannot send a friend request to yourself." });
  try {
    const existing = await supabase(`/rest/v1/friendships?or=(and(requester_id.eq.${encodeURIComponent(a.user.id)},addressee_id.eq.${encodeURIComponent(target)}),and(requester_id.eq.${encodeURIComponent(target)},addressee_id.eq.${encodeURIComponent(a.user.id)}))&select=*`, { headers: { Authorization: `Bearer ${a.token}` } });
    const rows = await json(existing) || [];
    if (Array.isArray(rows) && rows.length) return res.status(409).json({ error: `A friendship or request already exists (${rows[0].status}).`, friendship: rows[0] });
    const r = await supabase("/rest/v1/friendships?select=*", { method: "POST", headers: { Authorization: `Bearer ${a.token}`, Prefer: "return=representation" }, body: JSON.stringify({ requester_id: a.user.id, addressee_id: target, status: "pending" }) });
    const data = await json(r); if (!r.ok) return res.status(r.status).json(data || { error: "Could not send friend request." });
    return res.status(201).json(Array.isArray(data) ? data[0] : data);
  } catch (e) { return res.status(500).json({ error: e?.message || "Could not send friend request." }); }
});
app.patch("/api/friends/:friendshipId", async (req, res) => {
  const a = await auth(req, res); if (!a) return;
  const status = typeof req.body?.status === "string" ? req.body.status : "";
  if (!["accepted", "declined", "blocked"].includes(status)) return res.status(400).json({ error: "Invalid friendship status." });
  try {
    const r = await supabase(`/rest/v1/friendships?id=eq.${encodeURIComponent(req.params.friendshipId)}&addressee_id=eq.${encodeURIComponent(a.user.id)}&status=eq.pending`, { method: "PATCH", headers: { Authorization: `Bearer ${a.token}`, Prefer: "return=representation" }, body: JSON.stringify({ status, updated_at: new Date().toISOString() }) });
    const data = await json(r); return res.status(r.ok ? 200 : r.status).json(data || {});
  } catch (e) { return res.status(500).json({ error: e?.message || "Unable to update friend request." }); }
});
app.delete("/api/friends/:friendshipId", async (req, res) => {
  const a = await auth(req, res); if (!a) return;
  try {
    const r = await supabase(`/rest/v1/friendships?id=eq.${encodeURIComponent(req.params.friendshipId)}&or=(requester_id.eq.${encodeURIComponent(a.user.id)},addressee_id.eq.${encodeURIComponent(a.user.id)})`, { method: "DELETE", headers: { Authorization: `Bearer ${a.token}` } });
    if (!r.ok) return res.status(r.status).json(await json(r) || { error: "Unable to remove friendship." });
    return res.status(204).send();
  } catch (e) { return res.status(500).json({ error: e?.message || "Unable to remove friendship." }); }
});
export default function handler(req, res) { return app(req, res); }
