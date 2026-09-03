const ACCESS_COOKIE = "skillhub_access_token";
const REFRESH_COOKIE = "skillhub_refresh_token";

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
async function json(r) { const t = await r.text(); if (!t) return null; try { return JSON.parse(t); } catch { return null; } }
function cookies(req) { const out = {}; for (const p of String(req.headers.cookie || "").split(";")) { const i = p.indexOf("="); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } return out; }
function setSession(res, d) { res.setHeader("Set-Cookie", [`${ACCESS_COOKIE}=${encodeURIComponent(d.access_token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600; Secure`, `${REFRESH_COOKIE}=${encodeURIComponent(d.refresh_token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure`]); }
async function session(req, res) {
  const auth = String(req.headers.authorization || "");
  let token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const c = cookies(req); if (!token) token = c[ACCESS_COOKIE];
  let user = null;
  if (token) { const r = await sb("/auth/v1/user", { headers: { Authorization: `Bearer ${token}` } }); if (r.ok) user = await json(r); }
  if (!user && c[REFRESH_COOKIE]) { const r = await sb("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: c[REFRESH_COOKIE] }) }); const d = await json(r); if (r.ok && d?.access_token && d?.user) { token = d.access_token; user = d.user; setSession(res, d); } }
  return user?.id && token ? { user, token } : null;
}
async function profiles(ids, token) {
  if (!ids.length) return new Map();
  const r = await sb(`/rest/v1/profiles?select=id,full_name,username,avatar_url,bio&id=in.(${ids.join(",")})`, { headers: { Authorization: `Bearer ${token}` } });
  const rows = await json(r) || [];
  return new Map(Array.isArray(rows) ? rows.map(x => [x.id, x]) : []);
}
export default async function handler(req, res) {
  try {
    const s = await session(req, res);
    if (!s) return res.status(401).json({ error: "Not authenticated" });
    if (req.method === "GET") {
      const limit = Math.min(Math.max(Number(req.query?.limit) || 30, 1), 50);
      const r = await sb(`/rest/v1/posts?select=id,user_id,content,media_url,media_type,created_at,updated_at&order=created_at.desc&limit=${limit}`, { headers: { Authorization: `Bearer ${s.token}` } });
      const rows = await json(r);
      if (!r.ok) return res.status(r.status).json({ error: rows?.message || rows?.hint || "Unable to load posts" });
      const ids = [...new Set((Array.isArray(rows) ? rows : []).map(x => x.user_id).filter(Boolean))];
      const pm = await profiles(ids, s.token);
      const postIds = (Array.isArray(rows) ? rows : []).map(x => x.id);
      let likes = [], comments = [], shares = [];
      if (postIds.length) {
        const filter = postIds.join(",");
        const [lr, cr, sr] = await Promise.all([
          sb(`/rest/v1/post_likes?select=post_id,user_id&post_id=in.(${filter})`, { headers: { Authorization: `Bearer ${s.token}` } }),
          sb(`/rest/v1/comments?select=post_id&post_id=in.(${filter})`, { headers: { Authorization: `Bearer ${s.token}` } }),
          sb(`/rest/v1/post_shares?select=post_id&post_id=in.(${filter})`, { headers: { Authorization: `Bearer ${s.token}` } })
        ]);
        likes = await json(lr) || []; comments = await json(cr) || []; shares = await json(sr) || [];
      }
      const count = (arr, id) => Array.isArray(arr) ? arr.filter(x => x.post_id === id).length : 0;
      return res.json((Array.isArray(rows) ? rows : []).map(p => { const profile = pm.get(p.user_id) || {}; return { ...p, author: profile, likes: count(likes,p.id), comments: count(comments,p.id), shares: count(shares,p.id), liked: Array.isArray(likes) && likes.some(x => x.post_id === p.id && x.user_id === s.user.id) }; }));
    }
    if (req.method === "POST") {
      const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
      const mediaUrl = typeof req.body?.media_url === "string" ? req.body.media_url.trim() || null : null;
      const mediaType = typeof req.body?.media_type === "string" ? req.body.media_type.trim() || null : null;
      if (!content && !mediaUrl) return res.status(400).json({ error: "Write something or attach media before posting." });
      const r = await sb("/rest/v1/posts?select=id,user_id,content,media_url,media_type,created_at,updated_at", { method: "POST", headers: { Authorization: `Bearer ${s.token}`, Prefer: "return=representation" }, body: JSON.stringify({ user_id: s.user.id, content: content || null, media_url: mediaUrl, media_type: mediaType }) });
      const d = await json(r);
      if (!r.ok) return res.status(r.status).json({ error: d?.message || d?.hint || d?.details || "Unable to create post" });
      return res.status(201).json(Array.isArray(d) ? d[0] : d);
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) { return res.status(500).json({ error: e?.message || "Unable to process post request" }); }
}
