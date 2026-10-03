"use client";

import { DEFAULT_PRICING_VARIANT, PRICING_EXPERIMENT_COOKIE, normalizePricingVariant } from "@/lib/billing/catalog";

type ClientTelemetryEvent = {
  level?: "info" | "warn" | "error";
  sessionId?: string;
  traceId?: string;
  requestId?: string;
  jobId?: string;
  [key: string]: unknown;
};
export type TelemetryFlushReason =
  | "interval"
  | "immediate"
  | "visibility_hidden"
  | "pagehide"
  | "beforeunload"
  | "manual";
type TelemetryFlushHook = (reason: TelemetryFlushReason) => void;

const SESSION_STORAGE_KEY = "vismuse_socialmedia_session_id";
const ANONYMOUS_STORAGE_KEY = "vismuse_anonymous_id";
const USER_STORAGE_KEY = "vismuse_socialmedia_user_id";
const GUEST_USER_STORAGE_KEY = "vismuse_socialmedia_guest_user_id";
const GUEST_USER_HEADER = "x-guest-user-id";
const TELEMETRY_QUEUE_STORAGE_KEY = "vismuse_telemetry_queue_v1";
const MAX_PREVIEW_CHARS = 500;
const TELEMETRY_FLUSH_INTERVAL_MS = 30 * 1000;
const TELEMETRY_MAX_BATCH_EVENTS = 50;
const TELEMETRY_MAX_PERSISTED_EVENTS = 200;
const CANONICAL_GUEST_IDENTITY_LOCK = "vismuse-canonical-guest-identity";
const EXPERIMENT_TELEMETRY_FIELDS = new Set([
  "pricing_variant",
  "pricing_experiment_key",
  "pricingExperimentVariant",
  "pricingExperimentKey"
]);
let telemetryUserId: string | undefined;
let telemetryGuestUserId: string | undefined;
let telemetryGuestUserIdentityReady = false;
let telemetryFlushTimer: number | undefined;
let telemetryQueueLoaded = false;
let telemetryIsFlushing = false;
let telemetryUnloadListenersRegistered = false;
let canonicalGuestIdentityLockTail: Promise<void> = Promise.resolve();
const telemetryQueue: Record<string, unknown>[] = [];
const telemetryFlushHooks = new Set<TelemetryFlushHook>();

type GuestUserIdentityStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function isGuestUserId(value?: string): boolean {
  return /^guest:[a-f0-9-]{36}$/i.test(value?.trim() ?? "");
}

function getBrowserGuestUserIdentityStorage(): GuestUserIdentityStorage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

type GuestIdentityLockManager = {
  request: <T>(name: string, callback: () => Promise<T> | T) => Promise<T>;
};

function getBrowserGuestIdentityLockManager(): GuestIdentityLockManager | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { locks?: GuestIdentityLockManager }).locks;
}

export function withCanonicalGuestIdentityLock<T>(work: () => Promise<T> | T): Promise<T> {
  const lockManager = getBrowserGuestIdentityLockManager();
  if (lockManager) return lockManager.request(CANONICAL_GUEST_IDENTITY_LOCK, work);

  const request = canonicalGuestIdentityLockTail.then(work, work);
  canonicalGuestIdentityLockTail = request.then(() => undefined, () => undefined);
  return request;
}

export function resolveGuestAccountResponseIdentity(params: {
  responseGuestUserId?: string;
  establishedGuestUserId?: string;
}): string | undefined {
  const establishedGuestUserId = isGuestUserId(params.establishedGuestUserId)
    ? params.establishedGuestUserId?.trim()
    : undefined;
  if (establishedGuestUserId) return establishedGuestUserId;
  return isGuestUserId(params.responseGuestUserId)
    ? params.responseGuestUserId?.trim()
    : undefined;
}

export function subscribeCanonicalGuestUserRequestIdentity(
  listener: (guestUserId: string | undefined) => void
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handleStorage = (event: StorageEvent) => {
    if (event.storageArea !== window.localStorage || event.key !== GUEST_USER_STORAGE_KEY) return;
    const guestUserId = isGuestUserId(event.newValue ?? undefined)
      ? event.newValue?.trim()
      : undefined;
    telemetryGuestUserId = guestUserId;
    telemetryGuestUserIdentityReady = true;
    listener(guestUserId);
  };
  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}

export function resolveCanonicalGuestUserId(account: {
  id?: string;
  authMode?: string;
}): string | undefined {
  return account.authMode === "guest" && isGuestUserId(account.id)
    ? account.id?.trim()
    : undefined;
}

export function isAccountRequestIdentityReady(
  accountReady: boolean,
  options?: { allowMock?: boolean }
): boolean {
  return accountReady || options?.allowMock === true;
}

export function syncCanonicalGuestUserRequestIdentity(
  account: { id?: string; authMode?: string },
  storage: GuestUserIdentityStorage | undefined = getBrowserGuestUserIdentityStorage()
): string | undefined {
  const guestUserId = resolveCanonicalGuestUserId(account);
  telemetryGuestUserId = guestUserId;
  telemetryGuestUserIdentityReady = true;
  if (!storage) return guestUserId;
  try {
    if (guestUserId) {
      storage.setItem(GUEST_USER_STORAGE_KEY, guestUserId);
    } else {
      storage.removeItem(GUEST_USER_STORAGE_KEY);
    }
  } catch {
    // The account store remains canonical when storage is unavailable.
  }
  return guestUserId;
}

export function getStoredGuestUserId(
  storage: GuestUserIdentityStorage | undefined = getBrowserGuestUserIdentityStorage()
): string | undefined {
  if (!storage) return undefined;
  try {
    const value = storage.getItem(GUEST_USER_STORAGE_KEY)?.trim();
    return isGuestUserId(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function buildGuestUserRequestHeaders(
  storage: GuestUserIdentityStorage | undefined = getBrowserGuestUserIdentityStorage()
): Record<string, string> {
  const browserStorage = getBrowserGuestUserIdentityStorage();
  const guestUserId = storage === browserStorage && telemetryGuestUserIdentityReady
    ? telemetryGuestUserId
    : getStoredGuestUserId(storage);
  return guestUserId ? { [GUEST_USER_HEADER]: guestUserId } : {};
}

function isLocalTelemetryHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]";
}

function isLocalTelemetryDisabled(): boolean {
  if (typeof window === "undefined") return false;
  return isLocalTelemetryHost(window.location.hostname);
}

function getStorageId(key: string): string {
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const next = crypto.randomUUID();
    window.localStorage.setItem(key, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

export function getClientSessionId(): string {
  return getStorageId(SESSION_STORAGE_KEY);
}

export function getAnonymousId(): string {
  return getStorageId(ANONYMOUS_STORAGE_KEY);
}

export function createTraceId(): string {
  return crypto.randomUUID();
}

export function setTelemetryUserId(userId?: string): void {
  const normalized = userId?.trim();
  telemetryUserId = normalized || undefined;
  const guestUserId = normalized && isGuestUserId(normalized) ? normalized : undefined;
  if (guestUserId) telemetryGuestUserId = guestUserId;
  try {
    if (normalized) {
      window.localStorage.setItem(USER_STORAGE_KEY, normalized);
    } else {
      window.localStorage.removeItem(USER_STORAGE_KEY);
    }
    if (guestUserId) {
      window.localStorage.setItem(GUEST_USER_STORAGE_KEY, guestUserId);
    } else if (normalized) {
      window.localStorage.removeItem(GUEST_USER_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures.
  }
}

function getTelemetryUserId(): string | undefined {
  if (telemetryUserId) return telemetryUserId;
  try {
    telemetryUserId = window.localStorage.getItem(USER_STORAGE_KEY)?.trim() || undefined;
  } catch {
    telemetryUserId = undefined;
  }
  return telemetryUserId;
}

function getTelemetryGuestUserId(): string | undefined {
  if (telemetryGuestUserId) return telemetryGuestUserId;
  telemetryGuestUserId = getStoredGuestUserId();
  return telemetryGuestUserId && isGuestUserId(telemetryGuestUserId) ? telemetryGuestUserId : undefined;
}

function readPricingExperimentVariant(): string {
  try {
    const prefix = `${PRICING_EXPERIMENT_COOKIE}=`;
    const raw = document.cookie
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(prefix))
      ?.slice(prefix.length);
    return raw ? normalizePricingVariant(decodeURIComponent(raw)) : DEFAULT_PRICING_VARIANT;
  } catch {
    return DEFAULT_PRICING_VARIANT;
  }
}

export function truncateTelemetryText(value: unknown, maxChars = MAX_PREVIEW_CHARS): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.length > maxChars ? normalized.slice(0, maxChars) : normalized;
}

function asTelemetryQueueRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function loadTelemetryQueue(): void {
  if (telemetryQueueLoaded) return;
  telemetryQueueLoaded = true;

  try {
    const stored = window.localStorage.getItem(TELEMETRY_QUEUE_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed)) return;
    const persisted = parsed
      .map(asTelemetryQueueRecord)
      .filter((record): record is Record<string, unknown> => Boolean(record))
      .slice(-TELEMETRY_MAX_PERSISTED_EVENTS);
    telemetryQueue.push(...persisted);
  } catch {
    // Ignore malformed or inaccessible local storage.
  }
}

function saveTelemetryQueue(): void {
  try {
    if (!telemetryQueue.length) {
      window.localStorage.removeItem(TELEMETRY_QUEUE_STORAGE_KEY);
      return;
    }

    const persisted = telemetryQueue.slice(-TELEMETRY_MAX_PERSISTED_EVENTS);
    window.localStorage.setItem(TELEMETRY_QUEUE_STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // Telemetry persistence is best-effort.
  }
}

function clearTelemetryFlushTimer(): void {
  if (telemetryFlushTimer === undefined) return;
  window.clearTimeout(telemetryFlushTimer);
  telemetryFlushTimer = undefined;
}

function sendTelemetryBatch(events: Record<string, unknown>[], keepalive: boolean): void {
  if (!events.length) return;

  const body = JSON.stringify({ events });

  if (keepalive && navigator.sendBeacon) {
    const sent = navigator.sendBeacon("/api/telemetry", new Blob([body], { type: "application/json" }));
    if (sent) return;
  }

  void fetch("/api/telemetry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive
  }).catch(() => {
    // Telemetry is best-effort; avoid retry loops in the product path.
  });
}

function runTelemetryFlushHooks(reason: TelemetryFlushReason): void {
  for (const hook of telemetryFlushHooks) {
    try {
      hook(reason);
    } catch {
      // Flush hooks must never block telemetry delivery.
    }
  }
}

export function registerTelemetryFlushHook(hook: TelemetryFlushHook): () => void {
  telemetryFlushHooks.add(hook);
  return () => {
    telemetryFlushHooks.delete(hook);
  };
}

function flushTelemetryQueue(keepalive = false, reason: TelemetryFlushReason = "manual"): void {
  if (typeof window === "undefined") return;
  if (telemetryIsFlushing) return;

  telemetryIsFlushing = true;
  try {
    loadTelemetryQueue();
    clearTelemetryFlushTimer();
    runTelemetryFlushHooks(reason);

    const pending = telemetryQueue.splice(0);
    saveTelemetryQueue();

    while (pending.length) {
      sendTelemetryBatch(pending.splice(0, TELEMETRY_MAX_BATCH_EVENTS), keepalive);
    }
  } finally {
    telemetryIsFlushing = false;
  }
}

function scheduleTelemetryFlush(): void {
  if (telemetryFlushTimer !== undefined) return;
  telemetryFlushTimer = window.setTimeout(() => {
    flushTelemetryQueue(false, "interval");
  }, TELEMETRY_FLUSH_INTERVAL_MS);
}

function shouldFlushImmediately(event: string, data: ClientTelemetryEvent): boolean {
  return event === "socialmedia.page.exited"
    || event === "analytics.checkout_plan_selected"
    || event === "analytics.checkout_failed"
    || event === "analytics.checkout_started_web"
    || event === "analytics.guest_upgrade_requires_auth"
    || event === "analytics.guest_image_unlock_requires_auth"
    || event === "analytics.image_unlock_checkout_requested"
    || (event === "analytics.page_active_time" && (data.trigger === "hidden" || data.trigger === "pagehide"));
}

function omitExperimentTelemetryFields(data: ClientTelemetryEvent): ClientTelemetryEvent {
  const sanitized: ClientTelemetryEvent = {};
  for (const [key, value] of Object.entries(data)) {
    if (!EXPERIMENT_TELEMETRY_FIELDS.has(key)) sanitized[key] = value;
  }
  return sanitized;
}

function resolveExplicitPricingExperimentVariant(data: ClientTelemetryEvent): string | undefined {
  for (const key of ["pricing_experiment_variant", "pricing_variant"]) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return normalizePricingVariant(value);
  }
  return undefined;
}

function ensureTelemetryUnloadListeners(): void {
  if (telemetryUnloadListenersRegistered) return;
  telemetryUnloadListenersRegistered = true;

  const flushForUnload = (reason: TelemetryFlushReason) => flushTelemetryQueue(true, reason);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushForUnload("visibility_hidden");
  });
  window.addEventListener("pagehide", () => flushForUnload("pagehide"));
  window.addEventListener("beforeunload", () => flushForUnload("beforeunload"));
}

export function trackClientEvent(event: string, data: ClientTelemetryEvent = {}): void {
  if (typeof window === "undefined") return;
  if (isLocalTelemetryDisabled()) return;
  loadTelemetryQueue();
  ensureTelemetryUnloadListeners();

  const explicitPricingExperimentVariant = resolveExplicitPricingExperimentVariant(data);
  const telemetryData = omitExperimentTelemetryFields(data);
  const anonymousId = getAnonymousId();
  const userId = telemetryData.userId ?? getTelemetryUserId();
  const guestUserId = typeof telemetryData.guestUserId === "string"
    ? telemetryData.guestUserId
    : typeof telemetryData.guest_user_id === "string"
      ? telemetryData.guest_user_id
      : getTelemetryGuestUserId();
  const deviceId = guestUserId ?? anonymousId;

  const payload = {
    ...telemetryData,
    event,
    level: telemetryData.level ?? "info",
    source: "client",
    service: "vismuse-web",
    env: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
    sessionId: telemetryData.sessionId ?? getClientSessionId(),
    userId,
    anonymousId: telemetryData.anonymousId ?? anonymousId,
    deviceId: telemetryData.deviceId ?? deviceId,
    pricing_experiment_variant: explicitPricingExperimentVariant ?? readPricingExperimentVariant(),
    // Temporarily disabled; retain the field contract for a future re-enable.
    // ui_version: "2.0",
    route: window.location.pathname,
    url: window.location.href,
    referrer: document.referrer || undefined,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    userAgent: navigator.userAgent,
    _time: new Date().toISOString()
  };

  try {
    telemetryQueue.push(payload);
    if (telemetryQueue.length > TELEMETRY_MAX_PERSISTED_EVENTS) {
      telemetryQueue.splice(0, telemetryQueue.length - TELEMETRY_MAX_PERSISTED_EVENTS);
    }
    saveTelemetryQueue();

    if (shouldFlushImmediately(event, telemetryData) || telemetryQueue.length >= TELEMETRY_MAX_BATCH_EVENTS) {
      flushTelemetryQueue(true, "immediate");
      return;
    }

    scheduleTelemetryFlush();
  } catch {
    // Telemetry must never affect the product path.
  }
}
