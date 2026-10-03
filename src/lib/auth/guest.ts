const GUEST_USER_COOKIE = "vf_guest_user";
const GUEST_USER_HEADER = "x-guest-user-id";
const GUEST_USER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function normalizeGuestUserId(value?: string | null): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (!/^guest:[a-f0-9-]{36}$/i.test(normalized)) return undefined;
  return normalized;
}

export function getGuestUserCookieName(): string {
  return GUEST_USER_COOKIE;
}

export function getGuestUserHeaderName(): string {
  return GUEST_USER_HEADER;
}

export function getGuestUserCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GUEST_USER_COOKIE_MAX_AGE_SECONDS
  };
}

export function parseGuestUserId(value?: string | null): string | undefined {
  return normalizeGuestUserId(value);
}

export function createGuestUserId(): string {
  const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const random = Math.floor(Math.random() * 16);
        const value = char === "x" ? random : (random & 0x3) | 0x8;
        return value.toString(16);
      });
  return `guest:${id}`;
}

export function readGuestUserIdFromCookieHeader(cookieHeader?: string | null): string | undefined {
  const header = cookieHeader?.trim();
  if (!header) return undefined;

  const segments = header.split(";");
  for (const segment of segments) {
    const [rawName, ...rawValueParts] = segment.trim().split("=");
    if (rawName !== GUEST_USER_COOKIE) continue;
    const rawValue = rawValueParts.join("=");
    try {
      return normalizeGuestUserId(decodeURIComponent(rawValue));
    } catch {
      return normalizeGuestUserId(rawValue);
    }
  }

  return undefined;
}

export function readGuestUserIdFromRequestHeaders(headers: Pick<Headers, "get">): string | undefined {
  // The client publishes the guest id returned by /api/v1/account as this
  // explicit header before enabling account-dependent requests. Prefer it to
  // a stale cookie so one browser does not split work across two guest ids.
  return normalizeGuestUserId(headers.get(GUEST_USER_HEADER))
    ?? readGuestUserIdFromCookieHeader(headers.get("cookie"));
}

export function resolveGuestUserCookieUpdate(params: {
  cookieGuestUserId?: string;
  requestGuestUserId?: string;
  createGuestId?: () => string;
}): string | undefined {
  if (params.requestGuestUserId) {
    return params.cookieGuestUserId === params.requestGuestUserId
      ? undefined
      : params.requestGuestUserId;
  }
  if (params.cookieGuestUserId) return undefined;
  return (params.createGuestId ?? createGuestUserId)();
}

export function isGuestUserId(value?: string | null): boolean {
  return Boolean(normalizeGuestUserId(value));
}
