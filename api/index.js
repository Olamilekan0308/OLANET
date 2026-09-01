import express from "express";

const app = express();
app.use(express.json());

const accessCookie = "skillhub_access_token";
const refreshCookie = "skillhub_refresh_token";

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = String(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url) throw new Error("Missing SUPABASE_URL environment variable");
  if (!key) throw new Error("Missing Supabase API key environment variable");
  return { url, key };
}

async function supabase(path, options = {}) {
  const { url, key } = supabaseConfig();
  return fetch(`${url}${path}`, {
    ...options,
    headers: { apikey: key, "Content-Type": "application/json", ...(options.headers || {}) },
  });
}

async function json(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function setSession(res, data) {
  res.setHeader("Set-Cookie", [
    `${accessCookie}=${encodeURIComponent(data.access_token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600; Secure`,
    `${refreshCookie}=${encodeURIComponent(data.refresh_token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure`,
  ]);
}

function clearSession(res) {
  res.setHeader("Set-Cookie", [
    `${accessCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    `${refreshCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  ]);
}

async function currentUser(req, res) {
  const c = cookies(req);
  if (!c[accessCookie] && !c[refreshCookie]) return null;
  let token = c[accessCookie];
  let user = null;
  if (token) {
    const r = await supabase("/auth/v1/user", { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) user = await json(r);
  }
  if (!user && c[refreshCookie]) {
    const r = await supabase("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: c[refreshCookie] }) });
    const d = await json(r);
    if (r.ok && d?.access_token && d?.user) { token = d.access_token; user = d.user; setSession(res, d); }
  }
  return user ? { user, token } : null;
}

app.get("/api/healthz", (_req, res) => res.json({ status: "ok" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    const r = await supabase("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
    const d = await json(r);
    if (!r.ok || !d?.access_token) return res.status(r.status || 401).json({ error: d?.error_description || d?.msg || "Invalid email or password" });
    setSession(res, d);
    return res.json({ user: { ...d.user, profile: null } });
  } catch (e) { return res.status(500).json({ error: e?.message || "Unable to connect to authentication service" }); }
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const fullName = String(req.body?.fullName || "").trim();
    if (fullName.length < 2 || !email || password.length < 6) return res.status(400).json({ error: "Name, valid email and a password of at least 6 characters are required" });
    const r = await supabase("/auth/v1/signup", { method: "POST", body: JSON.stringify({ email, password, data: { full_name: fullName } }) });
    const d = await json(r);
    if (!r.ok || !d?.user) return res.status(r.status || 400).json({ error: d?.msg || d?.error_description || "Unable to create your account" });
    if (d.access_token) setSession(res, d);
    return res.json({ user: d.access_token ? { ...d.user, profile: null } : null, needsEmailConfirmation: !d.access_token });
  } catch (e) { return res.status(500).json({ error: e?.message || "Unable to create your account" }); }
});

app.get("/api/auth/session", async (req, res) => {
  try {
    const s = await currentUser(req, res);
    if (!s) return res.status(401).json({ error: "Not authenticated" });
    return res.json({ user: { ...s.user, profile: null } });
  } catch (e) { return res.status(500).json({ error: e?.message || "Unable to check your session" }); }
});

app.post("/api/auth/logout", async (req, res) => {
  try {
    const c = cookies(req);
    if (c[accessCookie]) await supabase("/auth/v1/logout", { method: "POST", headers: { Authorization: `Bearer ${c[accessCookie]}` } }).catch(() => null);
  } finally { clearSession(res); return res.json({ ok: true }); }
});

app.post("/api/auth/resend-email", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Email is required" });
    const r = await supabase("/auth/v1/resend", { method: "POST", body: JSON.stringify({ type: "signup", email }) });
    const d = await json(r);
    if (!r.ok) return res.status(r.status || 400).json({ error: d?.msg || d?.error_description || "Unable to resend the verification code" });
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e?.message || "Unable to resend the verification code" }); }
});

app.post("/api/auth/verify-email", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const token = String(req.body?.token || "");
    if (!email || !token) return res.status(400).json({ error: "Email and verification code are required" });
    const r = await supabase("/auth/v1/verify", { method: "POST", body: JSON.stringify({ type: "email", email, token }) });
    const d = await json(r);
    if (!r.ok || !d?.access_token) return res.status(r.status || 400).json({ error: d?.msg || d?.error_description || "That verification code is invalid or expired" });
    setSession(res, d);
    return res.json({ user: { ...d.user, profile: null }, verified: true });
  } catch (e) { return res.status(500).json({ error: e?.message || "Unable to verify your email" }); }
});

export default function handler(req, res) { return app(req, res); }
