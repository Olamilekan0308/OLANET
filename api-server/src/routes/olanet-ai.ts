import { Router, type IRouter, type Request, type Response } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router: IRouter = Router();
const ACCESS_COOKIE = "skillhub_access_token";
const OPENAI_MODEL = process.env.OLANET_AI_MODEL || "gpt-5.6-luna";

type User = { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null };

async function json<T>(response: { text(): Promise<string> }): Promise<T | null> {
  const text = await response.text();
  try { return text ? JSON.parse(text) as T : null; } catch { return null; }
}

async function supabase(path: string, accessToken: string, init: { method?: string; body?: unknown } = {}) {
  const connectors = new ReplitConnectors();
  return connectors.proxy("supabase", path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
  });
}

async function authenticatedUser(req: Request, res: Response): Promise<{ user: User; accessToken: string } | null> {
  const accessToken = req.signedCookies?.[ACCESS_COOKIE] as string | undefined;
  if (!accessToken) { res.status(401).json({ error: "Not authenticated" }); return null; }
  const response = await supabase("/auth/v1/user", accessToken, { method: "GET" });
  const user = await json<User>(response);
  if (!response.ok || !user?.id) { res.status(401).json({ error: "Session expired. Please log in again." }); return null; }
  return { user, accessToken };
}

async function callModel(system: string, message: string, history: Array<{ role: string; content: string }> = []) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OLANET_OPENAI_API_KEY;
  if (!apiKey) throw new Error("OLANET AI is not configured. Add OPENAI_API_KEY to the server environment.");
  const input = [
    { role: "developer", content: system },
    ...history.slice(-12).map((item) => ({ role: item.role === "assistant" ? "assistant" : "user", content: item.content })),
    { role: "user", content: message },
  ];
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: OPENAI_MODEL, input, max_output_tokens: 1200 }),
  });
  const data = await response.json().catch(() => ({})) as { output_text?: string; error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || "OLANET AI could not answer right now.");
  return data.output_text?.trim() || "I couldn't produce an answer just now. Please try again.";
}

async function createSession(userId: string, accessToken: string, sessionType: string, title: string) {
  const response = await supabase("/rest/v1/ai_sessions", accessToken, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, session_type: sessionType, title }),
  });
  const rows = await json<Array<{ id: number }>>(response);
  return rows?.[0]?.id ?? null;
}

async function saveRequest(userId: string, sessionId: number | null, accessToken: string, requestText: string, responseText: string, status: string) {
  await supabase("/rest/v1/ai_requests", accessToken, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, session_id: sessionId, request_text: requestText, response_text: responseText, language: "en", status }),
  });
}

router.post("/ai/circle", async (req, res): Promise<void> => {
  try {
    const session = await authenticatedUser(req, res);
    if (!session) return;
    const body = req.body as { circleId?: string | number; message?: string; sessionId?: number };
    const circleId = Number(body?.circleId);
    const message = body?.message?.trim();
    if (!Number.isInteger(circleId) || circleId <= 0 || !message) { res.status(400).json({ error: "circleId and message are required." }); return; }
    if (message.length > 6000) { res.status(400).json({ error: "Message is too long." }); return; }

    const circleResponse = await supabase(`/rest/v1/circles?select=id,name,description&id=eq.${circleId}&limit=1`, session.accessToken, { method: "GET" });
    const circles = await json<Array<{ id: number; name: string; description?: string | null }>>(circleResponse);
    const circle = circles?.[0];
    if (!circle) { res.status(404).json({ error: "Circle not found." }); return; }

    const configResponse = await supabase(`/rest/v1/circle_ai_configs?select=ai_name,instructions,knowledge,enabled&circle_id=eq.${circleId}&limit=1`, session.accessToken, { method: "GET" });
    const configs = await json<Array<{ ai_name?: string; instructions?: string | null; knowledge?: string | null; enabled?: boolean }>>(configResponse);
    const config = configs?.[0];
    if (config?.enabled === false) { res.status(403).json({ error: "OLANET AI is currently disabled for this Circle." }); return; }

    const system = `You are OLANET AI, the official AI assistant inside the OLANET Circle "${circle.name}". Answer according to this Circle's subject and community context. Be accurate, practical, clear and helpful. Do not claim to be a human administrator. Circle description: ${circle.description || "No description provided."}\nAdministrator instructions: ${config?.instructions || "Give helpful answers appropriate to this Circle."}\nAdministrator knowledge: ${config?.knowledge || "Use your general knowledge and clearly state uncertainty when necessary."}`;
    const answer = await callModel(system, message);
    let sessionId = Number.isInteger(body.sessionId) ? body.sessionId! : null;
    if (!sessionId) sessionId = await createSession(session.user.id, session.accessToken, `circle:${circleId}`, `OLANET AI — ${circle.name}`);
    await saveRequest(session.user.id, sessionId, session.accessToken, message, answer, "completed").catch(() => undefined);
    res.json({ aiName: "OLANET AI", circleId, sessionId, response: answer });
  } catch (error) {
    req.log.error({ error }, "Circle OLANET AI request failed");
    res.status(502).json({ error: error instanceof Error ? error.message : "OLANET AI is temporarily unavailable." });
  }
});

export default router;
export async function registerOlanetAIRoutes() { return undefined; }
