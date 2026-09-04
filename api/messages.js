import express from "express";

const app = express();
app.use(express.json({ limit: "1mb" }));
const accessCookie = "skillhub_access_token";

function config() {
  const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = String(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("Supabase environment is not configured");
  return { url, key };
}
async function sb(path, options = {}) {
  const { url, key } = config();
  return fetch(`${url}${path}`, { ...options, headers: { apikey: key, "Content-Type": "application/json", ...(options.headers || {}) } });
}
async function body(r) { const text = await r.text(); if (!text) return null; try { return JSON.parse(text); } catch { return null; } }
function cookies(req) { const out = {}; for (const part of String(req.headers.cookie || "").split(";")) { const i = part.indexOf("="); if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } return out; }
async function session(req, res) {
  const token = cookies(req)[accessCookie];
  if (!token) return null;
  const r = await sb("/auth/v1/user", { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  return { user: await body(r), token };
}
async function auth(req, res) {
  const s = await session(req, res);
  if (!s) { res.status(401).json({ error: "Not authenticated" }); return null; }
  return s;
}
function fail(res, status, error) { return res.status(status).json({ error }); }

async function isMember(conversationId, userId, token) {
  const r = await sb(`/rest/v1/direct_conversation_members?select=conversation_id&conversation_id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return false;
  const rows = await body(r);
  return Array.isArray(rows) && rows.length > 0;
}

app.get("/api/messages/conversations", async (req, res) => {
  try {
    const s = await auth(req, res); if (!s) return;
    const r = await sb(`/rest/v1/direct_conversation_members?select=conversation_id&user_id=eq.${encodeURIComponent(s.user.id)}`, { headers: { Authorization: `Bearer ${s.token}` } });
    if (!r.ok) return fail(res, r.status, "Unable to load conversations");
    const memberships = await body(r) || [];
    const result = [];
    for (const m of memberships) {
      const mr = await sb(`/rest/v1/direct_conversation_members?select=user_id&conversation_id=eq.${encodeURIComponent(m.conversation_id)}&user_id=neq.${encodeURIComponent(s.user.id)}`, { headers: { Authorization: `Bearer ${s.token}` } });
      const others = mr.ok ? (await body(mr) || []) : [];
      const otherId = others[0]?.user_id;
      let profile = null;
      if (otherId) {
        const pr = await sb(`/rest/v1/profiles?select=id,full_name,username,avatar_url,bio,department,course&id=eq.${encodeURIComponent(otherId)}&limit=1`, { headers: { Authorization: `Bearer ${s.token}` } });
        if (pr.ok) profile = (await body(pr) || [])[0] || null;
      }
      const lr = await sb(`/rest/v1/chat_messages?select=id,body,sender_id,created_at&conversation_id=eq.${encodeURIComponent(m.conversation_id)}&order=created_at.desc&limit=1`, { headers: { Authorization: `Bearer ${s.token}` } });
      const last = lr.ok ? (await body(lr) || [])[0] || null : null;
      result.push({ conversation_id: m.conversation_id, other_user: profile, last_message: last });
    }
    result.sort((a, b) => String(b.last_message?.created_at || "").localeCompare(String(a.last_message?.created_at || "")));
    return res.json(result);
  } catch (e) { return fail(res, 500, e instanceof Error ? e.message : "Unable to load conversations"); }
});

app.post("/api/messages/conversations", async (req, res) => {
  try {
    const s = await auth(req, res); if (!s) return;
    const otherUserId = String(req.body?.user_id || "").trim();
    if (!otherUserId || otherUserId === s.user.id) return fail(res, 400, "A different user is required");
    const existing = await sb(`/rest/v1/direct_conversation_members?select=conversation_id&user_id=eq.${encodeURIComponent(s.user.id)}`, { headers: { Authorization: `Bearer ${s.token}` } });
    if (!existing.ok) return fail(res, existing.status, "Unable to check conversations");
    const mine = await body(existing) || [];
    for (const row of mine) {
      const other = await sb(`/rest/v1/direct_conversation_members?select=conversation_id&conversation_id=eq.${encodeURIComponent(row.conversation_id)}&user_id=eq.${encodeURIComponent(otherUserId)}&limit=1`, { headers: { Authorization: `Bearer ${s.token}` } });
      if (other.ok && (await body(other) || []).length) return res.json({ conversation_id: row.conversation_id, existing: true });
    }
    const created = await sb("/rest/v1/direct_conversations", { method: "POST", headers: { Authorization: `Bearer ${s.token}`, Prefer: "return=representation" }, body: JSON.stringify({}) });
    if (!created.ok) return fail(res, created.status, (await body(created))?.message || "Unable to create conversation");
    const conversation = (await body(created) || [])[0];
    if (!conversation?.id) return fail(res, 500, "Conversation was not created");
    const members = await sb("/rest/v1/direct_conversation_members", { method: "POST", headers: { Authorization: `Bearer ${s.token}`, Prefer: "return=minimal" }, body: JSON.stringify([{ conversation_id: conversation.id, user_id: s.user.id }, { conversation_id: conversation.id, user_id: otherUserId }]) });
    if (!members.ok) return fail(res, members.status, (await body(members))?.message || "Unable to add conversation members");
    return res.status(201).json({ conversation_id: conversation.id, existing: false });
  } catch (e) { return fail(res, 500, e instanceof Error ? e.message : "Unable to create conversation"); }
});

app.get("/api/messages/conversations/:conversationId", async (req, res) => {
  try {
    const s = await auth(req, res); if (!s) return;
    const id = String(req.params.conversationId);
    if (!(await isMember(id, s.user.id, s.token))) return fail(res, 403, "You are not a member of this conversation");
    const r = await sb(`/rest/v1/chat_messages?select=id,conversation_id,sender_id,body,created_at,edited_at,reply_to_id,reactions,media_type,media_url,is_view_once&conversation_id=eq.${encodeURIComponent(id)}&order=created_at.asc`, { headers: { Authorization: `Bearer ${s.token}` } });
    if (!r.ok) return fail(res, r.status, "Unable to load messages");
    return res.json(await body(r) || []);
  } catch (e) { return fail(res, 500, e instanceof Error ? e.message : "Unable to load messages"); }
});

app.post("/api/messages/conversations/:conversationId/messages", async (req, res) => {
  try {
    const s = await auth(req, res); if (!s) return;
    const id = String(req.params.conversationId);
    if (!(await isMember(id, s.user.id, s.token))) return fail(res, 403, "You are not a member of this conversation");
    const text = String(req.body?.body || "").trim();
    if (!text) return fail(res, 400, "Message cannot be empty");
    if (text.length > 5000) return fail(res, 400, "Message is too long");
    const payload = { conversation_id: id, sender_id: s.user.id, body: text, reply_to_id: req.body?.reply_to_id || null, media_type: req.body?.media_type || null, media_url: req.body?.media_url || null, is_view_once: Boolean(req.body?.is_view_once) };
    const r = await sb("/rest/v1/chat_messages", { method: "POST", headers: { Authorization: `Bearer ${s.token}`, Prefer: "return=representation" }, body: JSON.stringify(payload) });
    if (!r.ok) return fail(res, r.status, (await body(r))?.message || "Unable to send message");
    return res.status(201).json((await body(r) || [])[0] || null);
  } catch (e) { return fail(res, 500, e instanceof Error ? e.message : "Unable to send message"); }
});

export default app;
