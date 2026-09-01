const ACCESS_COOKIE = "skillhub_access_token";
const REFRESH_COOKIE = "skillhub_refresh_token";

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return await new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; if (data.length > 2_000_000) req.destroy(); });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
    req.on("error", () => resolve({}));
  });
}

function config() {
  const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = String(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("Supabase environment is not configured");
  return { url, key };
}

async function sb(path, token, options = {}) {
  const { url, key } = config();
  return fetch(`${url}${path}`, { ...options, headers: { apikey: key, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
}

async function json(r) { const text = await r.text(); if (!text) return null; try { return JSON.parse(text); } catch { return null; } }

async function authenticated(req, res) {
  const cookies = parseCookies(req);
  let token = cookies[ACCESS_COOKIE];
  if (token) {
    const r = await sb("/auth/v1/user", token);
    const user = await json(r);
    if (r.ok && user?.id) return { user, token };
  }
  if (cookies[REFRESH_COOKIE]) {
    const r = await sb("/auth/v1/token?grant_type=refresh_token", null, { method: "POST", body: JSON.stringify({ refresh_token: cookies[REFRESH_COOKIE] }) });
    const d = await json(r);
    if (r.ok && d?.access_token && d?.user) return { user: d.user, token: d.access_token };
  }
  res.status(401).json({ error: "Not authenticated" });
  return null;
}

function cleanHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()).slice(-12).map((m) => ({ role: m.role, content: m.content.trim().slice(0, 12000) }));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const session = await authenticated(req, res);
    if (!session) return;
    const body = await readBody(req);
    const circleId = Number(body?.circleId);
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!Number.isInteger(circleId) || circleId <= 0 || !message) return res.status(400).json({ error: "circleId and message are required." });

    const cr = await sb(`/rest/v1/circles?select=id,name,description&id=eq.${circleId}&limit=1`, session.token);
    const rows = await json(cr);
    const circle = Array.isArray(rows) ? rows[0] : null;
    if (!circle) return res.status(404).json({ error: "Circle not found." });

    const cfg = await sb(`/rest/v1/circle_ai_configs?select=ai_name,instructions,knowledge,enabled&circle_id=eq.${circleId}&limit=1`, session.token);
    const configs = await json(cfg);
    const ai = Array.isArray(configs) ? configs[0] : null;
    if (ai?.enabled === false) return res.status(403).json({ error: "OLANET AI is currently disabled for this department." });

    const systemPrompt = `You are OLANET AI, the official specialist assistant inside the OLANET department "${circle.name}". Answer questions according to this department's subject. Be accurate, practical, educational and clear. You are not a human administrator. Department description: ${circle.description || "No description provided."}\nAdministrator instructions: ${ai?.instructions || "Give helpful answers appropriate for this department."}\nAdministrator knowledge: ${ai?.knowledge || "Use your general knowledge and clearly state uncertainty when necessary."}`;
    const aiResponse = await sb("/functions/v1/ask-ai", session.token, { method: "POST", body: JSON.stringify({ message, systemPrompt, history: cleanHistory(body?.history), model: "gpt-5.6-luna" }) });
    const result = await json(aiResponse);
    if (!aiResponse.ok || !result?.ok || !result?.response) return res.status(502).json({ error: result?.error?.message || "OLANET AI could not answer right now." });

    return res.json({ aiName: ai?.ai_name || "OLANET AI", circleId, sessionId: Number.isInteger(body?.sessionId) ? body.sessionId : null, response: result.response });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "OLANET AI is temporarily unavailable." });
  }
}
