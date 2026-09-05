import { Router, type IRouter, type Request, type Response } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router: IRouter = Router();
const ACCESS_COOKIE = "skillhub_access_token";
const MAX_AVATAR_LENGTH = 2_200_000;

async function readJson<T>(response: { text(): Promise<string> }): Promise<T | null> {
  const text = await response.text();
  try { return text ? JSON.parse(text) as T : null; } catch { return null; }
}

async function supabase(path: string, token: string, init: { method?: string; body?: unknown; headers?: Record<string,string> } = {}) {
  const connectors = new ReplitConnectors();
  return connectors.proxy("supabase", path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
}

async function auth(req: Request, res: Response) {
  const token = req.signedCookies?.[ACCESS_COOKIE] as string | undefined;
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return null; }
  const r = await supabase("/auth/v1/user", token, { method: "GET" });
  const user = await readJson<{ id?: string }>(r);
  if (!r.ok || !user?.id) { res.status(401).json({ error: "Session expired" }); return null; }
  return { token, id: user.id };
}

router.get("/profile", async (req, res): Promise<void> => {
  const a = await auth(req, res); if (!a) return;
  const r = await supabase(`/rest/v1/profiles?id=eq.${encodeURIComponent(a.id)}&select=id,full_name,username,avatar_url,bio,department`, a.token, { method: "GET" });
  const rows = await readJson<unknown>(r);
  if (!r.ok) { res.status(r.status).json(rows ?? { error: "Could not load profile" }); return; }
  res.json(Array.isArray(rows) ? rows[0] ?? {} : rows ?? {});
});

router.patch("/profile", async (req, res): Promise<void> => {
  const a = await auth(req, res); if (!a) return;
  const update: Record<string, unknown> = {};
  for (const key of ["full_name", "bio", "department"]) {
    if (typeof req.body?.[key] === "string") update[key] = req.body[key].trim().slice(0, 500);
  }
  if (typeof req.body?.avatar_url === "string") {
    const avatar = req.body.avatar_url.trim();
    if (avatar && !/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar)) {
      res.status(400).json({ error: "Avatar must be a JPG, PNG or WebP image" }); return;
    }
    if (avatar.length > MAX_AVATAR_LENGTH) { res.status(413).json({ error: "Avatar image is too large" }); return; }
    update.avatar_url = avatar;
  }
  if (!Object.keys(update).length) { res.status(400).json({ error: "No profile fields supplied" }); return; }
  const r = await supabase(`/rest/v1/profiles?id=eq.${encodeURIComponent(a.id)}`, a.token, {
    method: "PATCH", body: JSON.stringify(update), headers: { Prefer: "return=representation" },
  });
  const data = await readJson<unknown>(r);
  if (!r.ok) { res.status(r.status).json(data ?? { error: "Could not update profile" }); return; }
  res.json(Array.isArray(data) ? data[0] ?? update : data ?? update);
});

export default router;
