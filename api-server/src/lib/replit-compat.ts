import { getSupabaseConfig } from "./supabase-env";

export class ReplitConnectors {
  async proxy(_service: string, path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
    const { url, anonKey, serviceRoleKey } = getSupabaseConfig();
    const apiKey = anonKey ?? serviceRoleKey;
    if (!apiKey) throw new Error("Missing Supabase API key");
    const headers: Record<string, string> = {
      apikey: apiKey,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    };
    const body = init.body === undefined
      ? undefined
      : typeof init.body === "string"
        ? init.body
        : JSON.stringify(init.body);
    return fetch(`${url}${path}`, {
      method: init.method ?? "GET",
      headers,
      body,
    });
  }
}
