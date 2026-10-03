import { createHash } from "node:crypto";
import { appConfig } from "@/lib/config";
import { readGuestUserIdFromRequestHeaders } from "@/lib/auth/guest";
import { supabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateApiKey } from "@/lib/auth/api-key";

export type AppUser = {
  id: string;
  email?: string;
  createdAt?: string;
  authMode: "supabase" | "guest" | "api-key" | "local-dev";
};

type AuthResult =
  | { ok: true; user: AppUser }
  | { ok: false; status: number; reason: string };

type CachedAuthResult = {
  expiresAt: number;
  value: AuthResult;
};

const authResultCache = new Map<string, CachedAuthResult>();
const authInflightCache = new Map<string, Promise<AuthResult>>();

const AUTH_CACHE_TTL_SUCCESS_MS = 15_000;
const AUTH_CACHE_TTL_UNAUTHORIZED_MS = 5_000;
const AUTH_CACHE_TTL_ERROR_MS = 1_000;
const SUPABASE_AUTH_TIMEOUT_MS = Math.max(
  1_000,
  Number(process.env.SUPABASE_AUTH_TIMEOUT_MS ?? 5_000) || 5_000
);

function buildApiKeyActorId(apiKey: string): string {
  const digest = createHash("sha256").update(apiKey).digest("hex").slice(0, 24);
  return `api-key:${digest}`;
}

function extractSupabaseAuthCookieFingerprint(cookieHeader: string): string {
  const authCookies = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const separatorIndex = item.indexOf("=");
      const cookieName = separatorIndex >= 0 ? item.slice(0, separatorIndex).trim() : item;
      return cookieName.startsWith("sb-") && cookieName.includes("-auth-token");
    })
    .sort();

  return authCookies.join(";");
}

function hasSupabaseAuthCookie(cookieHeader: string): boolean {
  return cookieHeader
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .some((item) => {
      const separatorIndex = item.indexOf("=");
      const cookieName = separatorIndex >= 0 ? item.slice(0, separatorIndex).trim() : item;
      return cookieName.startsWith("sb-") && cookieName.includes("-auth-token");
    });
}

function buildRequestCacheKey(request: Request): string {
  const authHeader = request.headers.get("authorization")?.trim() ?? "";
  const cookieHeader = request.headers.get("cookie")?.trim() ?? "";
  const supabaseCookieFingerprint = extractSupabaseAuthCookieFingerprint(cookieHeader);
  const guestUserId = readGuestUserIdFromRequestHeaders(request.headers);
  // A signed-in identity remains the cache authority. Without one, key the
  // cache by the same canonical guest identity used by request auth so a stale
  // cookie result cannot mask a newer explicit guest header.
  const source = authHeader
    ? `authorization:${authHeader}`
    : supabaseCookieFingerprint
      ? `supabase-cookie:${supabaseCookieFingerprint}`
      : guestUserId
        ? `guest:${guestUserId}`
        : "anonymous";
  return createHash("sha256").update(source).digest("hex");
}

function buildTimedAuthFetch(): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUPABASE_AUTH_TIMEOUT_MS);
    try {
      return await fetch(input, {
        ...init,
        signal: init?.signal ?? controller.signal
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Supabase auth timed out after ${SUPABASE_AUTH_TIMEOUT_MS}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };
}

function readErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const status = (error as { status?: unknown }).status;
  const parsed = Number(status);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "";
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
}

function isUnauthorizedAuthError(error: unknown): boolean {
  const status = readErrorStatus(error);
  if (status === 401 || status === 403) return true;
  const message = readErrorMessage(error).toLowerCase();
  return (
    message.includes("session") ||
    message.includes("jwt") ||
    message.includes("token") ||
    message.includes("unauthorized") ||
    message.includes("forbidden")
  );
}

function getCachedAuth(cacheKey: string): AuthResult | null {
  if (!cacheKey) return null;
  const cached = authResultCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    authResultCache.delete(cacheKey);
    return null;
  }
  return cached.value;
}

function setCachedAuth(cacheKey: string, value: AuthResult): void {
  if (!cacheKey) return;
  const ttl =
    value.ok
      ? AUTH_CACHE_TTL_SUCCESS_MS
      : value.status === 401
        ? AUTH_CACHE_TTL_UNAUTHORIZED_MS
        : AUTH_CACHE_TTL_ERROR_MS;
  authResultCache.set(cacheKey, {
    expiresAt: Date.now() + ttl,
    value
  });
}

function buildGuestAuthResult(request: Request, cacheKey: string): AuthResult | null {
  const guestUserId = readGuestUserIdFromRequestHeaders(request.headers);
  if (!guestUserId) return null;

  const guest = {
    ok: true as const,
    user: {
      id: guestUserId,
      authMode: "guest" as const
    }
  };
  setCachedAuth(cacheKey, guest);
  return guest;
}

export async function requireAppUser(request: Request): Promise<AuthResult> {
  if (supabaseConfig.enabled) {
    const cacheKey = buildRequestCacheKey(request);
    const authHeader = request.headers.get("authorization")?.trim() ?? "";
    const cookieHeader = request.headers.get("cookie")?.trim() ?? "";
    const hasSupabaseSessionCookie = hasSupabaseAuthCookie(cookieHeader);
    const hit = getCachedAuth(cacheKey);
    if (hit) return hit;

    if (!authHeader && !hasSupabaseSessionCookie) {
      const guest = buildGuestAuthResult(request, cacheKey);
      if (guest) {
        return guest;
      }

      const failed = { ok: false as const, status: 401, reason: "Sign in required" };
      setCachedAuth(cacheKey, failed);
      return failed;
    }

    const inflight = cacheKey ? authInflightCache.get(cacheKey) : null;
    if (inflight) {
      return inflight;
    }

    const resolveAuth = (async (): Promise<AuthResult> => {
      try {
        const supabase = await createSupabaseServerClient({ fetch: buildTimedAuthFetch() });
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          if (isUnauthorizedAuthError(error)) {
            const guest = hasSupabaseSessionCookie ? null : buildGuestAuthResult(request, cacheKey);
            if (guest) {
              return guest;
            }
          }

          const failed = { ok: false as const, status: 401, reason: readErrorMessage(error) || "Sign in required" };
          setCachedAuth(cacheKey, failed);
          return failed;
        }
        if (data.user) {
          const success = {
            ok: true as const,
            user: {
              id: data.user.id,
              email: data.user.email ?? undefined,
              createdAt: data.user.created_at ?? undefined,
              authMode: "supabase" as const
            }
          };
          setCachedAuth(cacheKey, success);
          return success;
        }
      } catch (error) {
        const guest = hasSupabaseSessionCookie ? null : buildGuestAuthResult(request, cacheKey);
        if (guest) {
          return guest;
        }

        const failed = {
          ok: false as const,
          status: 500,
          reason: error instanceof Error ? error.message : "Failed to initialize Supabase auth"
        };
        setCachedAuth(cacheKey, failed);
        return failed;
      }

      const guest = hasSupabaseSessionCookie ? null : buildGuestAuthResult(request, cacheKey);
      if (guest) {
        return guest;
      }

      const failed = { ok: false as const, status: 401, reason: "Sign in required" };
      setCachedAuth(cacheKey, failed);
      return failed;
    })();

    if (cacheKey) {
      authInflightCache.set(cacheKey, resolveAuth);
    }

    try {
      return await resolveAuth;
    } finally {
      if (cacheKey) {
        authInflightCache.delete(cacheKey);
      }
    }
  }

  const headerValue = request.headers.get("x-api-key");
  const auth = validateApiKey(headerValue);
  if (!auth.ok) {
    return { ok: false, status: 401, reason: auth.reason ?? "Unauthorized" };
  }

  if (headerValue) {
    return {
      ok: true,
      user: {
        id: buildApiKeyActorId(headerValue),
        authMode: "api-key"
      }
    };
  }

  if (appConfig.security.allowWithoutKey) {
    return {
      ok: true,
      user: {
        id: "local-dev",
        authMode: "local-dev"
      }
    };
  }

  return { ok: false, status: 401, reason: "Unauthorized" };
}
