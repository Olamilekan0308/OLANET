import { Router, type IRouter, type Request, type Response } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router: IRouter = Router();
const ACCESS_COOKIE = "skillhub_access_token";

type User = { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null };
async function readJson<T>(response: { text(): Promise<string> }): Promise<T | null> { const text = await response.text(); try { return text ? JSON.parse(text) as T : null; } catch { return null; } }
async function supabase(path: string, accessToken: string, init: { method?: string; body?: unknown } = {}) { const connectors = new ReplitConnectors(); return connectors.proxy("supabase", path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` } }); }
async function authenticatedUser(req: Request, res: Response): Promise<{ user: User; accessToken: string } | null> {
  const accessToken = req.signedCookies?.[ACCESS_COOKIE] as string | undefined;
  if (!accessToken) { res.status(401).json({ error: "Not authenticated" }); return null; }
  const response = await supabase("/auth/v1/user", accessToken, { method: "GET" }); const user = await readJson<User>(response);
  if (!response.ok || !user?.id) { res.status(401).json({ error: "Session expired. Please log in again." }); return null; }
  return { user, accessToken };
}
router.post("/support/ai", async (req, res): Promise<void> => {
  try {
    const session = await authenticatedUser(req, res); if (!session) return;
    const body = req.body as { message?: string; sessionId?: number }; const message = body?.message?.trim();
    if (!message) { res.status(400).json({ error: "message is required." }); return; }
    if (message.length > 6000) { res.status(400).json({ error: "Message is too long." }); return; }
    const system = `You are OLANET AI, the official live support assistant for the OLANET app. Help users understand and troubleshoot their OLANET account, login, profile, Circles, messages, posts, courses, opportunities, tools, payments, notifications and other app features. Give step-by-step instructions. Never ask for or expose passwords, verification codes, access tokens, payment card numbers or other secrets. You cannot directly change an account unless a specific authorized tool is provided, so explain what the user can do and when human support is needed. Be concise but useful. If the issue could be a security incident, prioritize account safety.`;
    const aiResponse = await supabase("/functions/v1/ask-ai", session.accessToken, { method: "POST", body: JSON.stringify({ message, systemPrompt: system, model: "gpt-5.6-luna" }) });
    const data = await readJson<{ ok?: boolean; response?: string; error?: { message?: string } }>(aiResponse);
    if (!aiResponse.ok || !data?.ok || !data.response) { res.status(502).json({ error: data?.error?.message || "OLANET support is temporarily unavailable." }); return; }
    const answer = data.response;
    let sessionId = Number.isInteger(body.sessionId) ? body.sessionId! : null;
    if (!sessionId) { const created = await supabase("/rest/v1/ai_sessions", session.accessToken, { method: "POST", body: JSON.stringify({ user_id: session.user.id, session_type: "support", title: "OLANET AI Support" }) }); const rows = await readJson<Array<{ id: number }>>(created); sessionId = rows?.[0]?.id ?? null; }
    await supabase("/rest/v1/ai_requests", session.accessToken, { method: "POST", body: JSON.stringify({ user_id: session.user.id, session_id: sessionId, request_text: message, response_text: answer, language: "en", status: "completed" }) }).catch(() => undefined);
    res.json({ aiName: "OLANET AI", sessionId, response: answer });
  } catch (error) { req.log.error({ error }, "OLANET support AI request failed"); res.status(502).json({ error: error instanceof Error ? error.message : "OLANET support is temporarily unavailable." }); }
});
export default router;
