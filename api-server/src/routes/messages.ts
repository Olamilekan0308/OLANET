import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import socialRouter from "./social";

const router: IRouter = Router();
const ACCESS_COOKIE = "skillhub_access_token";
const REFRESH_COOKIE = "skillhub_refresh_token";

type Session = { id: string; token: string };

function rawCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function cookieValue(req: Request, name: string): string | undefined {
  const signed = (req as Request & { signedCookies?: Record<string, unknown> }).signedCookies?.[name];
  if (typeof signed === "string" && signed) return signed;
  const plain = (req as Request & { cookies?: Record<string, unknown> }).cookies?.[name];
  if (typeof plain === "string" && plain) return plain;
  return rawCookies(req)[name];
}

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = String(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("Supabase environment is not configured");
  return { url, key };
}

async function supabase(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const { url, key } = supabaseConfig();
  return fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: key, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

function setSession(res: Response, data: { access_token: string; refresh_token?: string }) {
  const cookies = [`${ACCESS_COOKIE}=${encodeURIComponent(data.access_token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600; Secure`];
  if (data.refresh_token) cookies.push(`${REFRESH_COOKIE}=${encodeURIComponent(data.refresh_token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure`);
  res.setHeader("Set-Cookie", cookies);
}

async function getSession(req: Request, res: Response): Promise<Session | null> {
  let token = cookieValue(req, ACCESS_COOKIE);
  const refresh = cookieValue(req, REFRESH_COOKIE);
  if (token) {
    const authResponse = await supabase("/auth/v1/user", { headers: { Authorization: `Bearer ${token}` } });
    const user = await readJson<{ id?: string }>(authResponse);
    if (authResponse.ok && user?.id) return { id: user.id, token };
  }
  if (!refresh) return null;
  const refreshResponse = await supabase("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refresh }),
  });
  const refreshed = await readJson<{ access_token?: string; refresh_token?: string; user?: { id?: string } }>(refreshResponse);
  if (!refreshResponse.ok || !refreshed?.access_token || !refreshed.user?.id) return null;
  token = refreshed.access_token;
  setSession(res, { access_token: refreshed.access_token, refresh_token: refreshed.refresh_token });
  return { id: refreshed.user.id, token };
}

async function requireSession(req: Request, res: Response, next?: NextFunction): Promise<Session | null> {
  try {
    const session = await getSession(req, res);
    if (!session) {
      if (next) next(); else res.status(401).json({ error: "Not authenticated" });
      return null;
    }
    return session;
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unable to authenticate" });
    return null;
  }
}

router.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.method === "POST" && req.path === "/conversations" && typeof req.body?.user_id === "string" && !req.body?.user_ids) {
    req.body.user_ids = [req.body.user_id];
  }
  next();
});

router.get("/conversations", async (req: Request, res: Response, next: NextFunction) => {
  const session = await requireSession(req, res, next);
  if (!session) return;
  try {
    const membersResponse = await supabase(`/rest/v1/direct_conversation_members?user_id=eq.${encodeURIComponent(session.id)}&select=conversation_id`, { headers: { Authorization: `Bearer ${session.token}` } });
    const members = await readJson<Array<{ conversation_id: number }>>(membersResponse) || [];
    if (!membersResponse.ok) return res.status(membersResponse.status).json({ error: "Unable to load conversations" });
    const ids = members.map(row => row.conversation_id).filter(id => Number.isFinite(id));
    if (!ids.length) return res.json([]);

    const [conversationsResponse, participantsResponse] = await Promise.all([
      supabase(`/rest/v1/direct_conversations?id=in.(${ids.join(",")})&select=*`, { headers: { Authorization: `Bearer ${session.token}` } }),
      supabase(`/rest/v1/direct_conversation_members?conversation_id=in.(${ids.join(",")})&user_id=neq.${encodeURIComponent(session.id)}&select=conversation_id,user_id`, { headers: { Authorization: `Bearer ${session.token}` } }),
    ]);
    const conversations = await readJson<Array<Record<string, unknown>>>(conversationsResponse) || [];
    const participants = await readJson<Array<{ conversation_id: number; user_id: string }>>(participantsResponse) || [];
    const userIds = [...new Set(participants.map(row => row.user_id))];
    const profilesResponse = userIds.length
      ? await supabase(`/rest/v1/profiles?id=in.(${userIds.map(encodeURIComponent).join(",")})&select=id,full_name,username,avatar_url,bio,department,course`, { headers: { Authorization: `Bearer ${session.token}` } })
      : null;
    const profiles = profilesResponse ? await readJson<Array<Record<string, unknown>>>(profilesResponse) || [] : [];
    const profileById = new Map(profiles.map(profile => [String(profile.id), profile]));
    const participantByConversation = new Map<number, string>();
    for (const participant of participants) participantByConversation.set(participant.conversation_id, participant.user_id);

    const result = [];
    for (const conversation of conversations) {
      const id = Number(conversation.id);
      const otherId = participantByConversation.get(id);
      const lastResponse = await supabase(`/rest/v1/chat_messages?conversation_id=eq.${encodeURIComponent(String(id))}&select=id,body,sender_id,created_at&order=created_at.desc&limit=1`, { headers: { Authorization: `Bearer ${session.token}` } });
      const last = lastResponse.ok ? (await readJson<Array<Record<string, unknown>>>(lastResponse) || [])[0] || null : null;
      result.push({ ...conversation, conversation_id: id, current_user_id: session.id, other_user: otherId ? profileById.get(otherId) ?? { id: otherId } : null, last_message: last });
    }
    result.sort((a, b) => String(b.last_message?.created_at || "").localeCompare(String(a.last_message?.created_at || "")));
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unable to load conversations" });
  }
});

router.use(socialRouter);
export default router;
