import express, { Router, type IRouter, type Request, type Response } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

type SupabaseUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type AuthPayload = {
  access_token?: string;
  refresh_token?: string;
  user?: SupabaseUser | null;
};

type AuthSessionPayload = {
  access_token: string;
  refresh_token: string;
  user: SupabaseUser;
};

type AuthProviderPayload = AuthPayload & {
  error?: string;
  error_description?: string;
  msg?: string;
};

type ProviderError = {
  status: number;
  code?: string;
  message: string;
  details?: string;
  hint?: string;
};

type SessionUser = SupabaseUser & {
  profile?: {
    id?: string;
    full_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    bio?: string | null;
    department?: string | null;
    course?: string | null;
  } | null;
};

const router: IRouter = Router();
const ACCESS_COOKIE = "skillhub_access_token";
const REFRESH_COOKIE = "skillhub_refresh_token";
const cookieOptions = {
  httpOnly: true,
  signed: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

function supabaseRequest(
  path: string,
  init: { method?: string; headers?: Record<string, string>; body?: unknown } = {},
) {
  const connectors = new ReplitConnectors();
  return connectors.proxy("supabase", path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

async function readJson<T>(response: { text(): Promise<string> }): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function providerError(response: { status: number; text(): Promise<string> }, fallback: string): Promise<ProviderError> {
  const details = await readJson<{
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
    error?: string;
    error_description?: string;
    msg?: string;
  }>(response);
  return {
    status: response.status,
    code: details?.code,
    message: details?.message ?? details?.error_description ?? details?.error ?? details?.msg ?? fallback,
    details: details?.details,
    hint: details?.hint,
  };
}

function setSessionCookies(res: Response, payload: AuthPayload) {
  if (!payload.access_token || !payload.refresh_token) return;
  res.cookie(ACCESS_COOKIE, payload.access_token, {
    ...cookieOptions,
    maxAge: 60 * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, payload.refresh_token, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function clearSessionCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, cookieOptions);
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
}

function getSessionTokens(req: Request) {
  return {
    accessToken: req.signedCookies?.[ACCESS_COOKIE] as string | undefined,
    refreshToken: req.signedCookies?.[REFRESH_COOKIE] as string | undefined,
  };
}

function getFullName(user: SupabaseUser, requestedName?: string) {
  const metadataName = user.user_metadata?.["full_name"];
  if (requestedName?.trim()) return requestedName.trim();
  if (typeof metadataName === "string" && metadataName.trim()) return metadataName.trim();
  return user.email?.split("@")[0] ?? "SkillHub member";
}

async function ensureProfile(user: SupabaseUser, accessToken: string | undefined, requestedName?: string): Promise<ProviderError | null> {
  // Try the user's JWT first so RLS policies can authorize the insert.
  // If the attached connection uses a service_role key, retry without the
  // user Authorization header so Supabase can apply its server-side bypass.
  const attempts = accessToken ? [accessToken, undefined] : [undefined];
  let lastError: ProviderError | null = null;

  for (const token of attempts) {
    try {
      const headers: Record<string, string> = {
        Prefer: "resolution=merge-duplicates,return=minimal",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await supabaseRequest("/rest/v1/profiles", {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: user.id,
          full_name: getFullName(user, requestedName),
        }),
      });

      if (response.ok || response.status === 409) return null;
      lastError = await providerError(response, "Unable to create your profile");
    } catch (error) {
      lastError = {
        status: 502,
        message: error instanceof Error ? error.message : "Unable to reach Supabase profiles",
      };
    }
  }

  return lastError;
}

async function getProfile(userId: string, accessToken: string) {
  const response = await supabaseRequest(
    `/rest/v1/profiles?select=id,full_name,username,avatar_url,bio,department,course&id=eq.${encodeURIComponent(userId)}&limit=1`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!response.ok) return null;
  const profiles = await readJson<SessionUser["profile"][]>(response);
  return profiles?.[0] ?? null;
}

async function getAuthenticatedSession(req: Request, res: Response) {
  const { accessToken, refreshToken } = getSessionTokens(req);
  if (!accessToken && !refreshToken) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }

  let user = accessToken ? await getUserFromAccessToken(accessToken) : null;
  let activeAccessToken = accessToken;

  if (!user && refreshToken) {
    const refreshed = await refreshSession(refreshToken);
    if (refreshed) {
      setSessionCookies(res, refreshed);
      user = refreshed.user;
      activeAccessToken = refreshed.access_token;
    }
  }

  if (!user || !activeAccessToken) {
    clearSessionCookies(res);
    res.status(401).json({ error: "Session expired" });
    return null;
  }

  return { user, accessToken: activeAccessToken };
}

type ProfileUpdate = {
  username?: string | null;
  full_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  department?: string | null;
  course?: string | null;
};

async function updateProfileRecord(user: SupabaseUser, accessToken: string, updates: ProfileUpdate) {
  const response = await supabaseRequest("/rest/v1/profiles?on_conflict=id", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      id: user.id,
      ...updates,
    }),
  });

  if (!response.ok && response.status !== 409) {
    return { error: await providerError(response, "Unable to save your profile") };
  }

  return { profile: await getProfile(user.id, accessToken) };
}

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function uploadAvatar(user: SupabaseUser, accessToken: string, body: Buffer, contentType: string) {
  const objectPath = `${user.id}/avatar`;
  const storagePath = objectPath.split("/").map(encodeURIComponent).join("/");
  const upload = async (token?: string) => {
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "x-upsert": "true",
      "Cache-Control": "3600",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return supabaseRequest(`/storage/v1/object/${AVATAR_BUCKET}/${storagePath}`, {
      method: "POST",
      headers,
      body,
    });
  };

  let response = await upload(accessToken);
  if (!response.ok) {
    return { error: await providerError(response, "Unable to upload your profile picture") };
  }

  const profile = await updateProfileRecord(user, accessToken, {
    avatar_url: `/api/profile/avatar`,
  });
  if ("error" in profile) return profile;
  return { profile: profile.profile };
}

router.get("/profile/me", async (req, res): Promise<void> => {
  try {
    const session = await getAuthenticatedSession(req, res);
    if (!session) return;

    let profile = await getProfile(session.user.id, session.accessToken);
    let profileError: ProviderError | null = null;
    if (!profile) {
      profileError = await ensureProfile(session.user, session.accessToken);
      if (!profileError) profile = await getProfile(session.user.id, session.accessToken);
    }

    res.json({ profile, profileError });
  } catch (error) {
    const provider = {
      status: 502,
      message: error instanceof Error ? error.message : "Unable to load your profile",
    };
    req.log.error({ provider }, "Profile load failed");
    res.status(provider.status).json({ error: provider.message, provider });
  }
});

router.put("/profile/me", async (req, res): Promise<void> => {
  try {
    const session = await getAuthenticatedSession(req, res);
    if (!session) return;

    const body = req.body as Record<string, unknown> | undefined;
    const updates: ProfileUpdate = {};

    if ("username" in (body ?? {})) {
      if (body?.username !== null && typeof body?.username !== "string") {
        res.status(400).json({ error: "Username must be text" });
        return;
      }
      const username = typeof body?.username === "string" ? body.username.trim() : "";
      if (username.length > 50) {
        res.status(400).json({ error: "Username must be 50 characters or fewer" });
        return;
      }
      updates.username = username || null;
    }

    if ("full_name" in (body ?? {})) {
      if (body?.full_name !== null && typeof body?.full_name !== "string") {
        res.status(400).json({ error: "Full name must be text" });
        return;
      }
      const fullName = typeof body?.full_name === "string" ? body.full_name.trim() : "";
      if (fullName.length > 120) {
        res.status(400).json({ error: "Full name must be 120 characters or fewer" });
        return;
      }
      updates.full_name = fullName || null;
    }

    if ("bio" in (body ?? {})) {
      if (body?.bio !== null && typeof body?.bio !== "string") {
        res.status(400).json({ error: "Bio must be text" });
        return;
      }
      const bio = typeof body?.bio === "string" ? body.bio.trim() : "";
      if (bio.length > 500) {
        res.status(400).json({ error: "Bio must be 500 characters or fewer" });
        return;
      }
      updates.bio = bio || null;
    }

    for (const field of ["department", "course"] as const) {
      if (!(field in (body ?? {}))) continue;
      if (body?.[field] !== null && typeof body?.[field] !== "string") {
        res.status(400).json({ error: `${field === "department" ? "Department" : "Course"} must be text` });
        return;
      }
      const value = typeof body?.[field] === "string" ? body[field].trim() : "";
      if (value.length > 120) {
        res.status(400).json({ error: `${field === "department" ? "Department" : "Course"} must be 120 characters or fewer` });
        return;
      }
      updates[field] = value || null;
    }

    if ("avatar_url" in (body ?? {})) {
      if (body?.avatar_url !== null && typeof body?.avatar_url !== "string") {
        res.status(400).json({ error: "Profile picture URL must be text" });
        return;
      }
      const avatarUrl = typeof body?.avatar_url === "string" ? body.avatar_url.trim() : "";
      if (avatarUrl.length > 1000) {
        res.status(400).json({ error: "Profile picture URL is too long" });
        return;
      }
      updates.avatar_url = avatarUrl || null;
    }

    if (!Object.keys(updates).length) {
      res.status(400).json({ error: "No profile changes were provided" });
      return;
    }

    const result = await updateProfileRecord(session.user, session.accessToken, updates);
    if (result.error) {
      const { error } = result;
      res.status(error.status || 502).json({
        error: error.message,
        provider: error,
      });
      return;
    }

    res.json({ profile: result.profile });
  } catch (error) {
    const provider = {
      status: 502,
      message: error instanceof Error ? error.message : "Unable to save your profile",
    };
    req.log.error({ provider }, "Profile update failed");
    res.status(provider.status).json({ error: provider.message, provider });
  }
});

router.post(
  "/profile/avatar",
  express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: MAX_AVATAR_BYTES }),
  async (req, res): Promise<void> => {
    try {
      const session = await getAuthenticatedSession(req, res);
      if (!session) return;

      const contentType = req.headers["content-type"]?.split(";")[0]?.toLowerCase() ?? "";
      if (!AVATAR_TYPES.has(contentType)) {
        res.status(400).json({ error: "Profile picture must be a JPG, PNG, or WebP image" });
        return;
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: "Choose a profile picture to upload" });
        return;
      }
      if (req.body.length > MAX_AVATAR_BYTES) {
        res.status(413).json({ error: "Profile picture must be 5 MB or smaller" });
        return;
      }

      const result = await uploadAvatar(session.user, session.accessToken, req.body, contentType);
      if (result.error) {
        const { error } = result;
        res.status(error.status || 502).json({
          error: error.message,
          provider: error,
        });
        return;
      }

      res.json({ profile: result.profile });
    } catch (error) {
      const provider = {
        status: 502,
        message: error instanceof Error ? error.message : "Unable to upload your profile picture",
      };
      req.log.error({ provider }, "Profile picture upload failed");
      res.status(provider.status).json({ error: provider.message, provider });
    }
  },
);

router.get("/profile/avatar", async (req, res): Promise<void> => {
  try {
    const session = await getAuthenticatedSession(req, res);
    if (!session) return;

    const response = await supabaseRequest(
      `/storage/v1/object/${AVATAR_BUCKET}/${session.user.id}/avatar`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${session.accessToken}` },
      },
    );
    if (!response.ok) {
      const provider = await providerError(response, "Unable to load your profile picture");
      res.status(provider.status).json({ error: provider.message, provider });
      return;
    }

    const contentType = response.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    const provider = {
      status: 502,
      message: error instanceof Error ? error.message : "Unable to load your profile picture",
    };
    req.log.error({ provider }, "Profile picture load failed");
    res.status(provider.status).json({ error: provider.message, provider });
  }
});

async function authenticateWithPassword(email: string, password: string): Promise<AuthSessionPayload> {
  const response = await supabaseRequest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const payload = await readJson<AuthPayload & { error_description?: string; msg?: string }>(response);
  if (!response.ok || !payload?.access_token || !payload.refresh_token || !payload.user) {
    const message = payload?.error_description ?? payload?.msg ?? "The email or password is incorrect";
    const error = new Error(message);
    (error as Error & { status?: number }).status = response.status || 401;
    throw error;
  }
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    user: payload.user,
  };
}

async function getUserFromAccessToken(accessToken: string) {
  const response = await supabaseRequest("/auth/v1/user", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const user = await readJson<SupabaseUser>(response);
  if (!response.ok || !user?.id) return null;
  return user;
}

async function refreshSession(refreshToken: string): Promise<AuthSessionPayload | null> {
  const response = await supabaseRequest("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const payload = await readJson<AuthPayload>(response);
  if (!response.ok || !payload?.access_token || !payload.refresh_token || !payload.user) return null;
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    user: payload.user,
  };
}

async function verifyEmailCode(email: string, token: string): Promise<AuthSessionPayload> {
  const response = await supabaseRequest("/auth/v1/verify", {
    method: "POST",
    body: JSON.stringify({ type: "signup", email, token }),
  });
  const payload = await readJson<AuthProviderPayload>(response);
  if (!response.ok || !payload?.access_token || !payload.refresh_token || !payload.user) {
    const error = new Error(
      payload?.error_description ?? payload?.msg ?? payload?.error ?? "That verification code is incorrect or expired",
    );
    (error as Error & { status?: number }).status = response.status || 400;
    throw error;
  }
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    user: payload.user,
  };
}

async function resendEmailCode(email: string) {
  const response = await supabaseRequest("/auth/v1/resend", {
    method: "POST",
    body: JSON.stringify({ type: "signup", email }),
  });
  const payload = await readJson<AuthProviderPayload>(response);
  if (!response.ok) {
    const error = new Error(
      payload?.error_description ?? payload?.msg ?? payload?.error ?? "Unable to resend the verification code",
    );
    (error as Error & { status?: number }).status = response.status || 400;
    throw error;
  }
}

router.post("/auth/verify-email", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";

  if (!email || !token) {
    res.status(400).json({ error: "Enter the verification code from your email" });
    return;
  }
  if (!/^\d{6}$/.test(token)) {
    res.status(400).json({ error: "The verification code must be 6 digits" });
    return;
  }

  try {
    const session = await verifyEmailCode(email, token);
    const profileError = await ensureProfile(session.user, session.access_token);
    setSessionCookies(res, session);
    const profile = await getProfile(session.user.id, session.access_token);
    res.json({ user: { ...session.user, profile }, profileError, verified: true });
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    if (status && status < 500) {
      res.status(status).json({ error: (error as Error).message });
      return;
    }
    req.log.error({ err: error }, "Supabase email verification failed");
    res.status(502).json({ error: "Supabase could not verify this code right now" });
  }
});

router.post("/auth/resend-email", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    res.status(400).json({ error: "Enter a valid email address" });
    return;
  }

  try {
    await resendEmailCode(email);
    res.json({ sent: true });
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    if (status && status < 500) {
      res.status(status).json({ error: (error as Error).message });
      return;
    }
    req.log.error({ err: error }, "Supabase verification code resend failed");
    res.status(502).json({ error: "Supabase could not resend the code right now" });
  }
});

router.post("/ai/ask", async (req, res) => {
  try {
    const session = await getAuthenticatedSession(req, res);
    if (!session) return;

    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    const context = typeof req.body?.context === "string" ? req.body.context.trim() : "";
    if (!question) {
      res.status(400).json({ error: "Ask a question before starting AI help" });
      return;
    }

    const response = await supabaseRequest("/functions/v1/ask-ai", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.accessToken}` },
      body: JSON.stringify({ question, context }),
    });
    const payload = await readJson<Record<string, unknown> & { error?: string }>(response);
    if (!response.ok) {
      const provider = {
        status: response.status,
        message: typeof payload?.error === "string" ? payload.error : "The ask-ai function could not answer",
        provider: payload,
      };
      res.status(provider.status).json({ error: provider.message, provider });
      return;
    }
    res.json(payload ?? {});
  } catch (error) {
    const provider = {
      status: 502,
      message: error instanceof Error ? error.message : "Unable to reach the ask-ai function",
    };
    req.log.error({ provider }, "ask-ai request failed");
    res.status(provider.status).json({ error: provider.message, provider });
  }
});

router.post("/auth/signup", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const fullName = typeof req.body?.fullName === "string" ? req.body.fullName : "";

  if (!email || !email.includes("@")) {
    res.status(400).json({ error: "Enter a valid email address" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Your password must be at least 6 characters" });
    return;
  }

  try {
    let response;
    try {
      response = await supabaseRequest("/auth/v1/signup", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          data: { full_name: fullName.trim() },
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reach Supabase Auth";
      res.status(502).json({ error: message, source: "supabase_auth" });
      return;
    }
    const payload = await readJson<AuthProviderPayload>(response);
    if (!response.ok || !payload?.user) {
      const authError = {
        status: response.status || 400,
        code: payload?.error,
        message: payload?.error_description ?? payload?.msg ?? payload?.error ?? "Unable to create your account",
      };
      res.status(authError.status).json({ error: authError.message, source: "supabase_auth", provider: authError });
      return;
    }

    if (payload.access_token && payload.refresh_token) {
      const profileError = await ensureProfile(payload.user, payload.access_token, fullName);
      setSessionCookies(res, payload);
      res.json({ user: payload.user, profileCreated: !profileError, profileError, needsEmailConfirmation: false });
      return;
    }

    // Do not write profiles before the user has verified their email. RLS normally
    // rejects an unauthenticated insert; verification creates the authenticated session.
    res.json({
      user: payload.user,
      profileCreated: false,
      profileError: null,
      needsEmailConfirmation: true,
    });
  } catch (error) {
    req.log.error({ err: error }, "Supabase signup failed");
    res.status(502).json({ error: "Supabase could not complete signup right now" });
  }
});

router.post("/auth/login", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    res.status(400).json({ error: "Enter your email and password" });
    return;
  }

  try {
    const payload = await authenticateWithPassword(email, password);
    const profileError = await ensureProfile(payload.user, payload.access_token);
    setSessionCookies(res, payload);
    const profile = await getProfile(payload.user.id, payload.access_token);
    res.json({ user: { ...payload.user, profile }, profileError });
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    if (status && status < 500) {
      res.status(status).json({ error: (error as Error).message });
      return;
    }
    req.log.error({ err: error }, "Supabase login failed");
    res.status(502).json({ error: "Supabase could not complete login right now" });
  }
});

router.get("/auth/session", async (req, res) => {
  const { accessToken, refreshToken } = getSessionTokens(req);
  if (!accessToken && !refreshToken) {
    res.json({ user: null });
    return;
  }

  try {
    let user = accessToken ? await getUserFromAccessToken(accessToken) : null;
    let activeAccessToken = accessToken;

    if (!user && refreshToken) {
      const refreshed = await refreshSession(refreshToken);
      if (refreshed) {
        setSessionCookies(res, refreshed);
        user = refreshed.user ?? null;
        activeAccessToken = refreshed.access_token;
      }
    }

    if (!user || !activeAccessToken) {
      clearSessionCookies(res);
      res.json({ user: null });
      return;
    }

    const profileError = await ensureProfile(user, activeAccessToken);
    const profile = await getProfile(user.id, activeAccessToken);
    res.json({ user: { ...user, profile }, profileError });
  } catch (error) {
    req.log.error({ err: error }, "Supabase session check failed");
    clearSessionCookies(res);
    res.json({ user: null });
  }
});

router.post("/auth/logout", async (req, res) => {
  const { accessToken } = getSessionTokens(req);
  try {
    if (accessToken) {
      await supabaseRequest("/auth/v1/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }
  } catch (error) {
    req.log.warn({ err: error }, "Supabase logout request failed");
  } finally {
    clearSessionCookies(res);
  }
  res.status(204).send();
});

export default router;