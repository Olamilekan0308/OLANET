const ACCESS_COOKIE = "skillhub_access_token";
const REFRESH_COOKIE = "skillhub_refresh_token";

function config() {
  const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
  if (!url || !key) throw new Error("Supabase environment is not configured");
  return { url, key };
}

async function sb(path, options = {}) {
  const { url, key } = config();
  return fetch(`${url}${path}`, {
    ...options,
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
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
    `${ACCESS_COOKIE}=${encodeURIComponent(data.access_token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600; Secure`,
    `${REFRESH_COOKIE}=${encodeURIComponent(data.refresh_token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure`,
  ]);
}

async function getSession(req, res) {
  const c = cookies(req);
  let token = c[ACCESS_COOKIE];
  let user = null;

  if (token) {
    const response = await sb("/auth/v1/user", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) user = await json(response);
  }

  if (!user && c[REFRESH_COOKIE]) {
    const response = await sb("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: c[REFRESH_COOKIE] }),
    });
    const data = await json(response);
    if (response.ok && data?.access_token && data?.user) {
      token = data.access_token;
      user = data.user;
      setSession(res, data);
    }
  }

  if (!user?.id || !token) return null;
  return { user, token };
}

function normalize(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });

  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Not authenticated. Please log in again." });

    const requested = String(req.query?.q || "").trim().slice(0, 80);
    const response = await sb("/rest/v1/profiles?select=id,full_name,username,avatar_url,bio&order=full_name.asc&limit=100", {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    const data = await json(response);

    if (!response.ok) {
      return res.status(response.status).json({ error: "Could not load OLANET users.", details: data });
    }

    const needle = normalize(requested);
    const people = (Array.isArray(data) ? data : [])
      .filter(person => person.id !== session.user.id)
      .filter(person => !needle || normalize(person.full_name).includes(needle) || normalize(person.username).includes(needle));

    res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    return res.status(200).json(people);
  } catch (error) {
    return res.status(500).json({ error: error?.message || "People search failed." });
  }
}
