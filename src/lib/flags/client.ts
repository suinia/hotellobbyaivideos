export type ClientFlagAssignment = {
  key: string;
  variant: string;
  source: string;
  persisted?: boolean;
  active?: boolean;
};

export type ClientFlagsResponse = {
  actor?: {
    id?: string | null;
    auth_mode?: string | null;
  };
  billing_market?: "default" | "gb" | "ca";
  billing_currency?: "USD" | "GBP" | "CAD";
  flags: ClientFlagAssignment[];
  errors: Array<{
    key: string;
    error: string;
    status?: number;
  }>;
};

export const CLIENT_FLAGS_UPDATED_EVENT = "vismuse:client-flags-updated";
export const CLIENT_FLAGS_ACTOR_CHANGED_EVENT = "vismuse:client-flags-actor-changed";

const CLIENT_FLAGS_CACHE_KEY = "vismuse:client-flags:v1";
const CLIENT_FLAGS_ACTOR_KEY = "vismuse:client-flags-actor:v1";
const CLIENT_FLAGS_TTL_MS = 5 * 60_000;

let flagsInFlight: { key: string; request: Promise<ClientFlagsResponse> } | null = null;
let currentActorId = "";

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readStoredActorId(): string {
  const storage = getSessionStorage();
  return storage?.getItem(CLIENT_FLAGS_ACTOR_KEY) ?? "";
}

function writeStoredActorId(actorId: string): void {
  const storage = getSessionStorage();
  if (!storage) return;
  if (actorId) {
    storage.setItem(CLIENT_FLAGS_ACTOR_KEY, actorId);
  } else {
    storage.removeItem(CLIENT_FLAGS_ACTOR_KEY);
  }
}

function readCurrentActorId(): string {
  if (currentActorId) return currentActorId;
  currentActorId = readStoredActorId();
  return currentActorId;
}

function parseCachedFlags(raw: string | null): { actorId: string; expiresAt: number; allKeys: boolean; value: ClientFlagsResponse } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      actorId?: unknown;
      expiresAt?: unknown;
      allKeys?: unknown;
      value?: unknown;
    };
    if (typeof parsed.actorId !== "string") return null;
    if (typeof parsed.expiresAt !== "number" || !Number.isFinite(parsed.expiresAt)) return null;
    if (typeof parsed.allKeys !== "boolean") return null;
    if (!parsed.value || typeof parsed.value !== "object") return null;
    const value = parsed.value as ClientFlagsResponse;
    if (!Array.isArray(value.flags) || !Array.isArray(value.errors)) return null;
    return {
      actorId: parsed.actorId,
      expiresAt: parsed.expiresAt,
      allKeys: parsed.allKeys,
      value
    };
  } catch {
    return null;
  }
}

function hasRequestedFlags(value: ClientFlagsResponse, keys?: string[]): boolean {
  if (!keys?.length) return true;
  const available = new Set(value.flags.map((flag) => flag.key));
  const failed = new Set(value.errors.map((error) => error.key));
  return keys.every((key) => available.has(key) || failed.has(key));
}

function mergeFlagsResponse(current: ClientFlagsResponse | null, next: ClientFlagsResponse): ClientFlagsResponse {
  if (!current) return next;
  const flagsByKey = new Map(current.flags.map((flag) => [flag.key, flag]));
  for (const flag of next.flags) {
    flagsByKey.set(flag.key, flag);
  }
  const errorsByKey = new Map(current.errors.map((error) => [error.key, error]));
  for (const error of next.errors) {
    errorsByKey.set(error.key, error);
  }
  for (const flag of next.flags) {
    errorsByKey.delete(flag.key);
  }
  return {
    actor: next.actor ?? current.actor,
    billing_market: next.billing_market ?? current.billing_market,
    billing_currency: next.billing_currency ?? current.billing_currency,
    flags: Array.from(flagsByKey.values()),
    errors: Array.from(errorsByKey.values())
  };
}

function readCachedFlags(keys?: string[]): ClientFlagsResponse | null {
  const storage = getSessionStorage();
  const cached = parseCachedFlags(storage?.getItem(CLIENT_FLAGS_CACHE_KEY) ?? null);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) return null;
  if (cached.actorId !== readCurrentActorId()) return null;
  if (!keys?.length && !cached.allKeys) return null;
  if (!hasRequestedFlags(cached.value, keys)) return null;
  return cached.value;
}

function writeCachedFlags(value: ClientFlagsResponse, ttlMs: number, options?: { allKeys?: boolean }): void {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.setItem(CLIENT_FLAGS_CACHE_KEY, JSON.stringify({
    actorId: readCurrentActorId(),
    expiresAt: Date.now() + ttlMs,
    allKeys: options?.allKeys === true,
    value
  }));
}

export function clearClientFlagsCache(): void {
  flagsInFlight = null;
  getSessionStorage()?.removeItem(CLIENT_FLAGS_CACHE_KEY);
}

export function buildClientFlagsActorId(user?: {
  id?: string | null;
  auth_mode?: string | null;
  authMode?: string | null;
} | null): string {
  const id = user?.id?.trim();
  const authMode = (user?.auth_mode ?? user?.authMode ?? "").trim();
  if (!id && !authMode) return "";
  return `${authMode || "unknown"}:${id || "anonymous"}`;
}

export function setClientFlagsActor(actorId?: string | null): void {
  if (typeof window === "undefined") return;
  const normalized = actorId?.trim() ?? "";
  const previous = readCurrentActorId();
  if (previous === normalized) return;

  currentActorId = normalized;
  writeStoredActorId(normalized);
  clearClientFlagsCache();
  window.dispatchEvent(new CustomEvent(CLIENT_FLAGS_ACTOR_CHANGED_EVENT, {
    detail: {
      previousActorId: previous,
      actorId: normalized
    }
  }));
}

export function readClientFlag(key: string): ClientFlagAssignment | undefined {
  return readCachedFlags([key])?.flags.find((flag) => flag.key === key);
}

export async function getClientFlags(options: {
  force?: boolean;
  keys?: string[];
  ttlMs?: number;
} = {}): Promise<ClientFlagsResponse> {
  const requestKey = options.keys?.length ? [...options.keys].sort().join(",") : "*";
  if (!options.force) {
    const cached = readCachedFlags(options.keys);
    if (cached) return cached;
    if (flagsInFlight && (flagsInFlight.key === requestKey || flagsInFlight.key === "*")) {
      return flagsInFlight.request;
    }
  }

  const searchParams = new URLSearchParams();
  if (options.keys?.length) {
    searchParams.set("keys", options.keys.join(","));
  }
  const suffix = searchParams.size ? `?${searchParams.toString()}` : "";

  const request = fetch(`/api/v1/flags${suffix}`, {
    cache: "no-store",
    credentials: "same-origin",
    headers: { accept: "application/json" }
  })
    .then(async (response) => {
      const data = await response.json().catch(() => ({})) as {
        actor?: unknown;
        billing_market?: unknown;
        billing_currency?: unknown;
        flags?: unknown;
        errors?: unknown;
      };
      if (!response.ok) {
        throw new Error(`Failed to resolve client flags: ${response.status}`);
      }
      const value: ClientFlagsResponse = {
        actor: data.actor && typeof data.actor === "object"
          ? data.actor as ClientFlagsResponse["actor"]
          : undefined,
        billing_market: data.billing_market === "gb" ? "gb" : data.billing_market === "ca" ? "ca" : "default",
        billing_currency: data.billing_currency === "GBP" ? "GBP" : data.billing_currency === "CAD" ? "CAD" : "USD",
        flags: Array.isArray(data.flags) ? data.flags as ClientFlagAssignment[] : [],
        errors: Array.isArray(data.errors) ? data.errors as ClientFlagsResponse["errors"] : []
      };
      if (value.actor) {
        setClientFlagsActor(buildClientFlagsActorId(value.actor));
      }
      const cached = readCachedFlags();
      const nextValue = options.keys?.length
        ? mergeFlagsResponse(cached, value)
        : value;
      writeCachedFlags(nextValue, options.ttlMs ?? CLIENT_FLAGS_TTL_MS, {
        allKeys: !options.keys?.length || Boolean(cached)
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(CLIENT_FLAGS_UPDATED_EVENT, {
          detail: nextValue
        }));
      }
      return nextValue;
    })
    .finally(() => {
      if (flagsInFlight?.request === request) {
        flagsInFlight = null;
      }
    });

  flagsInFlight = { key: requestKey, request };
  return request;
}
