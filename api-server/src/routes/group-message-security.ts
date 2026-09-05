import { Router, type Request, type Response, type NextFunction } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router = Router();
const ACCESS_COOKIE = "skillhub_access_token";

type User = { id: string };

async function readJson<T>(response: { text(): Promise<string> }): Promise<T | null> {
  const text = await response.text();
  try { return text ? JSON.parse(text) as T : null; } catch { return null; }
}

async function supabase(path: string, token: string) {
  const connectors = new ReplitConnectors();
  return connectors.proxy("supabase", path, {
    method: "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
}

async function protect(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.signedCookies?.[ACCESS_COOKIE] as string | undefined;
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }

  const userResponse = await supabase("/auth/v1/user", token);
  const user = await readJson<User>(userResponse);
  if (!userResponse.ok || !user?.id) { res.status(401).json({ error: "Session expired. Please log in again." }); return; }

  const groupId = String(req.params.id || "").trim();
  if (!groupId || !/^\d+$/.test(groupId)) { res.status(400).json({ error: "Invalid group" }); return; }

  const membership = await supabase(
    `/rest/v1/group_members?group_id=eq.${encodeURIComponent(groupId)}&user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`,
    token,
  );
  const rows = await readJson<unknown[]>(membership) ?? [];
  if (!membership.ok) { res.status(403).json({ error: "Unable to verify group membership" }); return; }
  if (!rows.length) { res.status(403).json({ error: "You are not a member of this group" }); return; }

  next();
}

router.use(protect);
export default router;
