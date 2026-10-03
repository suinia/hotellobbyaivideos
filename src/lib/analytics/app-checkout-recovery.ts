import { CHECKOUT_RECOVERY_MAX_AGE_MS, type CheckoutContext } from "@/lib/analytics/checkout";
import { resolveCheckoutSyncEndpoint, type CheckoutSyncPaymentDetails } from "@/lib/billing/checkout-sync-client";

const APP_CHECKOUT_CONTEXT_KEY = "vismuse.app.checkoutContext";

export type AppCheckoutKind = "subscription" | "image_unlock" | "video_unlock";

export type AppCheckoutContext = {
  checkoutId?: string;
  packageId: string;
  kind: AppCheckoutKind;
  paymentProvider?: string;
  assetId?: string;
  jobId?: string;
  sessionId?: string;
  pricingVariant?: string;
  value?: number;
  currency?: string;
  recoveryAttempts?: number;
  recoveryStartedAt?: string;
  createdAt: string;
};

type CheckoutContextStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type AppCheckoutContextStorages = {
  sessionStorage: CheckoutContextStorage;
  localStorage: CheckoutContextStorage;
};

type AppCheckoutRecoveryHandledRef = {
  current: string;
};

export type AppCheckoutRecoveryResult =
  | "confirmed"
  | "not_confirmed"
  | "attempts_exhausted"
  | "missing_checkout_id"
  | "skipped";

export type AppCheckoutRecoveryConfirmation = CheckoutSyncPaymentDetails & {
  checkoutId: string;
};

export type AppStripeCheckoutReturnStatus = {
  state: "paid" | "processing" | "action_required" | "failed" | "incomplete";
  checkoutStatus?: string;
  paymentStatus?: string;
  paymentIntentStatus?: string;
  checkoutUrl?: string;
  checkoutType?: string;
  canContinueStripe: boolean;
  canSwitchPaymentMethod: boolean;
};

export function isAppStripeCheckoutContext(context?: AppCheckoutContext | null): boolean {
  const provider = context?.paymentProvider?.trim().toLowerCase();
  if (provider === "stripe") return true;
  if (provider === "waffo" || provider === "creem") return false;
  return Boolean(context?.checkoutId?.trim().startsWith("cs_"));
}

type AppCheckoutRecoveryFetch = (
  input: string,
  init: RequestInit
) => Promise<Pick<Response, "ok" | "status" | "json">>;

const APP_CHECKOUT_RECOVERY_REQUEST_TIMEOUT_MS = 10_000;
export const APP_CHECKOUT_RECOVERY_WINDOW_MS = 60_000;
export const APP_CHECKOUT_RECOVERY_MAX_RETRIES = 5;
export const APP_CHECKOUT_RECOVERY_MAX_ATTEMPTS = APP_CHECKOUT_RECOVERY_MAX_RETRIES + 1;
const APP_CHECKOUT_RECOVERY_RETRY_DELAYS_MS = [
  1_000,
  2_000,
  5_000,
  15_000,
  30_000
] as const;

const APP_STRIPE_CHECKOUT_STATUS_ENDPOINT = "/api/v1/billing/stripe/checkout-status";

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeOptionalValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function browserStorages(): AppCheckoutContextStorages | null {
  if (typeof window === "undefined") return null;
  return {
    sessionStorage: window.sessionStorage,
    localStorage: window.localStorage
  };
}

function safeGet(storage: CheckoutContextStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: CheckoutContextStorage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Checkout navigation and recovery must not depend on browser storage availability.
  }
}

function safeRemove(storage: CheckoutContextStorage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function parseAppCheckoutContext(raw: string | null, now: number): AppCheckoutContext | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AppCheckoutContext>;
    const createdMs = Date.parse(parsed.createdAt ?? "");
    const recoveryStartedMs = Date.parse(parsed.recoveryStartedAt ?? "");
    if (
      typeof parsed.packageId !== "string"
      || !parsed.packageId.trim()
      || (parsed.kind !== "subscription" && parsed.kind !== "image_unlock" && parsed.kind !== "video_unlock")
      || !Number.isFinite(createdMs)
      || createdMs > now
      || now - createdMs > CHECKOUT_RECOVERY_MAX_AGE_MS
    ) {
      return null;
    }
    return {
      packageId: parsed.packageId.trim(),
      kind: parsed.kind,
      checkoutId: parsed.checkoutId?.trim() || undefined,
      paymentProvider: parsed.paymentProvider?.trim() || undefined,
      assetId: parsed.assetId?.trim() || undefined,
      jobId: parsed.jobId?.trim() || undefined,
      sessionId: parsed.sessionId?.trim() || undefined,
      pricingVariant: parsed.pricingVariant?.trim() || undefined,
      value: typeof parsed.value === "number" && Number.isFinite(parsed.value) && parsed.value >= 0
        ? parsed.value
        : undefined,
      currency: parsed.currency?.trim() || undefined,
      recoveryAttempts: typeof parsed.recoveryAttempts === "number" && Number.isInteger(parsed.recoveryAttempts)
        ? Math.min(APP_CHECKOUT_RECOVERY_MAX_ATTEMPTS, Math.max(0, parsed.recoveryAttempts))
        : 0,
      recoveryStartedAt: Number.isFinite(recoveryStartedMs)
        && recoveryStartedMs >= createdMs
        && recoveryStartedMs <= now
        ? parsed.recoveryStartedAt
        : undefined,
      createdAt: parsed.createdAt as string
    };
  } catch {
    return null;
  }
}

function appCheckoutRecoveryExpiresAt(context: AppCheckoutContext): number {
  return Date.parse(context.createdAt) + CHECKOUT_RECOVERY_MAX_AGE_MS;
}

function recoveryRetryDelayMs(failedRounds: number): number {
  return APP_CHECKOUT_RECOVERY_RETRY_DELAYS_MS[
    Math.min(failedRounds, APP_CHECKOUT_RECOVERY_RETRY_DELAYS_MS.length - 1)
  ];
}

function waitForRecoveryRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = setTimeout(done, delayMs);
    signal?.addEventListener("abort", done, { once: true });

    function done() {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", done);
      resolve();
    }
  });
}

export function rememberAppCheckoutContext(
  context: Omit<AppCheckoutContext, "createdAt">,
  storages = browserStorages()
): void {
  if (!storages) return;
  const serialized = JSON.stringify({
    ...context,
    createdAt: new Date().toISOString()
  });
  safeSet(storages.sessionStorage, APP_CHECKOUT_CONTEXT_KEY, serialized);
  safeSet(storages.localStorage, APP_CHECKOUT_CONTEXT_KEY, serialized);
}

export function readAppCheckoutContext(
  storages = browserStorages(),
  now = Date.now()
): AppCheckoutContext | null {
  if (!storages) return null;
  const candidates = [
    {
      storage: storages.sessionStorage,
      context: parseAppCheckoutContext(safeGet(storages.sessionStorage, APP_CHECKOUT_CONTEXT_KEY), now)
    },
    {
      storage: storages.localStorage,
      context: parseAppCheckoutContext(safeGet(storages.localStorage, APP_CHECKOUT_CONTEXT_KEY), now)
    }
  ];

  for (const candidate of candidates) {
    if (!candidate.context) safeRemove(candidate.storage, APP_CHECKOUT_CONTEXT_KEY);
  }

  const selected = candidates
    .map((candidate) => candidate.context)
    .filter((context): context is AppCheckoutContext => Boolean(context))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ?? null;
  if (!selected) return null;

  const serialized = JSON.stringify(selected);
  safeSet(storages.sessionStorage, APP_CHECKOUT_CONTEXT_KEY, serialized);
  safeSet(storages.localStorage, APP_CHECKOUT_CONTEXT_KEY, serialized);
  return selected;
}

export function appCheckoutContextToPaymentContext(context: AppCheckoutContext): CheckoutContext {
  return {
    package_id: context.packageId,
    checkout_id: context.checkoutId,
    provider: context.paymentProvider,
    asset_id: context.assetId,
    job_id: context.jobId,
    session_id: context.sessionId,
    pricing_variant: context.pricingVariant,
    value: context.value,
    currency: context.currency,
    created_at: context.createdAt
  };
}

export function clearAppCheckoutContext(storages = browserStorages()): void {
  if (!storages) return;
  safeRemove(storages.sessionStorage, APP_CHECKOUT_CONTEXT_KEY);
  safeRemove(storages.localStorage, APP_CHECKOUT_CONTEXT_KEY);
}

export function updateAppCheckoutRecoveryAttempts(
  context: AppCheckoutContext,
  recoveryAttempts: number,
  storages = browserStorages()
): void {
  if (!storages) return;
  const current = readAppCheckoutContext(storages);
  if (
    current?.checkoutId?.trim() !== context.checkoutId?.trim()
    || current?.createdAt !== context.createdAt
  ) {
    return;
  }
  const serialized = JSON.stringify({
    ...current,
    ...(current.recoveryStartedAt || context.recoveryStartedAt
      ? { recoveryStartedAt: current.recoveryStartedAt || context.recoveryStartedAt }
      : {}),
    recoveryAttempts: Math.min(
      APP_CHECKOUT_RECOVERY_MAX_ATTEMPTS,
      Math.max(0, Math.floor(recoveryAttempts))
    )
  });
  safeSet(storages.sessionStorage, APP_CHECKOUT_CONTEXT_KEY, serialized);
  safeSet(storages.localStorage, APP_CHECKOUT_CONTEXT_KEY, serialized);
}

export async function inspectAppStripeCheckoutReturn(
  checkoutId: string,
  options: {
    fetcher?: AppCheckoutRecoveryFetch;
    requestTimeoutMs?: number;
  } = {}
): Promise<AppStripeCheckoutReturnStatus | null> {
  const normalizedCheckoutId = checkoutId.trim();
  if (!normalizedCheckoutId.startsWith("cs_")) return null;
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(1, options.requestTimeoutMs ?? APP_CHECKOUT_RECOVERY_REQUEST_TIMEOUT_MS)
  );
  try {
    const response = await fetcher(APP_STRIPE_CHECKOUT_STATUS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkout_id: normalizedCheckoutId }),
      signal: controller.signal
    }).catch(() => null);
    if (!response?.ok) return null;
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    const state = data.state;
    if (
      state !== "paid"
      && state !== "processing"
      && state !== "action_required"
      && state !== "failed"
      && state !== "incomplete"
    ) {
      return null;
    }
    return {
      state,
      checkoutStatus: normalizeOptionalString(data.checkout_status),
      paymentStatus: normalizeOptionalString(data.payment_status),
      paymentIntentStatus: normalizeOptionalString(data.payment_intent_status),
      checkoutUrl: normalizeOptionalString(data.checkout_url),
      checkoutType: normalizeOptionalString(data.checkout_type),
      canContinueStripe: data.can_continue_stripe === true,
      canSwitchPaymentMethod: data.can_switch_payment_method === true
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncAppCheckoutForRecovery(
  checkoutId: string,
  options: {
    fetcher?: AppCheckoutRecoveryFetch;
    wait?: (delayMs: number) => Promise<void>;
    maxAttempts?: number;
    requestTimeoutMs?: number;
    paymentProvider?: string;
  } = {}
): Promise<AppCheckoutRecoveryConfirmation | null> {
  const normalizedCheckoutId = checkoutId.trim();
  if (!normalizedCheckoutId) return null;
  const syncEndpoint = resolveCheckoutSyncEndpoint(normalizedCheckoutId, options.paymentProvider);
  if (!syncEndpoint) return null;
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  const maxAttempts = Math.max(1, options.maxAttempts ?? 1);
  const requestTimeoutMs = Math.max(1, options.requestTimeoutMs ?? APP_CHECKOUT_RECOVERY_REQUEST_TIMEOUT_MS);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetcher(syncEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkout_id: normalizedCheckoutId }),
        signal: controller.signal
      }).catch(() => null);
      if (response?.ok) {
        const data = await response.json().catch(() => ({})) as Record<string, unknown>;
        if (data.ok !== true) return null;
        return {
          checkoutId: normalizedCheckoutId,
          transactionId: normalizeOptionalString(data.transaction_id),
          orderId: normalizeOptionalString(data.order_id),
          subscriptionId: normalizeOptionalString(data.subscription_id),
          packageId: normalizeOptionalString(data.package_id),
          value: normalizeOptionalValue(data.value),
          currency: normalizeOptionalString(data.currency)?.toUpperCase()
        };
      }
      if (response?.status !== 409 || attempt === maxAttempts - 1) return null;
    } finally {
      clearTimeout(timeout);
    }
    await wait(1000);
  }
  return null;
}

export async function recoverAppCheckoutPayment(params: {
  context: AppCheckoutContext;
  handledRef: AppCheckoutRecoveryHandledRef;
  syncCheckout: (checkoutId: string) => Promise<AppCheckoutRecoveryConfirmation | null>;
  onConfirmed: (
    context: AppCheckoutContext,
    confirmation: AppCheckoutRecoveryConfirmation
  ) => void;
  signal?: AbortSignal;
  now?: () => number;
  wait?: (delayMs: number) => Promise<void>;
  onAttempt?: (context: AppCheckoutContext, attemptCount: number) => void;
}): Promise<AppCheckoutRecoveryResult> {
  const checkoutId = params.context.checkoutId?.trim();
  if (!checkoutId) return "missing_checkout_id";

  const recoveryKey = `recovery:${checkoutId}`;
  if (params.handledRef.current === recoveryKey) return "skipped";
  params.handledRef.current = recoveryKey;
  const now = params.now ?? Date.now;
  const wait = params.wait ?? ((delayMs) => waitForRecoveryRetry(delayMs, params.signal));
  const recoveryNow = now();
  const storedRecoveryStartedMs = Date.parse(params.context.recoveryStartedAt ?? "");
  const recoveryStartedMs = Number.isFinite(storedRecoveryStartedMs)
    && storedRecoveryStartedMs <= recoveryNow
    ? storedRecoveryStartedMs
    : recoveryNow;
  const recoveryContext: AppCheckoutContext = {
    ...params.context,
    recoveryStartedAt: new Date(recoveryStartedMs).toISOString()
  };
  const expiresAt = Math.min(
    appCheckoutRecoveryExpiresAt(params.context),
    recoveryStartedMs + APP_CHECKOUT_RECOVERY_WINDOW_MS
  );
  let attemptCount = Math.min(
    APP_CHECKOUT_RECOVERY_MAX_ATTEMPTS,
    Math.max(0, Math.floor(params.context.recoveryAttempts ?? 0))
  );
  let confirmed = false;

  try {
    while (
      !params.signal?.aborted
      && now() < expiresAt
      && attemptCount < APP_CHECKOUT_RECOVERY_MAX_ATTEMPTS
    ) {
      attemptCount += 1;
      try {
        params.onAttempt?.(recoveryContext, attemptCount);
      } catch {
        // Recovery should continue when attempt persistence is unavailable.
      }
      const confirmation = await params.syncCheckout(checkoutId).catch(() => null);
      if (params.signal?.aborted) break;
      if (confirmation) {
        params.onConfirmed(recoveryContext, confirmation);
        confirmed = true;
        return "confirmed";
      }

      const remainingMs = expiresAt - now();
      if (remainingMs <= 0) break;
      if (attemptCount < APP_CHECKOUT_RECOVERY_MAX_ATTEMPTS) {
        await wait(Math.min(recoveryRetryDelayMs(attemptCount - 1), remainingMs));
      }
    }

    if (params.signal?.aborted) return "skipped";
    return now() >= expiresAt ? "not_confirmed" : "attempts_exhausted";
  } finally {
    if (!confirmed && params.handledRef.current === recoveryKey) {
      params.handledRef.current = "";
    }
  }
}

export async function recoverAppCheckoutPaymentOnce(params: {
  context: AppCheckoutContext;
  handledRef: AppCheckoutRecoveryHandledRef;
  syncCheckout: (checkoutId: string) => Promise<AppCheckoutRecoveryConfirmation | null>;
  onConfirmed: (
    context: AppCheckoutContext,
    confirmation: AppCheckoutRecoveryConfirmation
  ) => void;
}): Promise<AppCheckoutRecoveryResult> {
  const checkoutId = params.context.checkoutId?.trim();
  if (!checkoutId) return "missing_checkout_id";

  const recoveryKey = `recovery:${checkoutId}`;
  if (params.handledRef.current === recoveryKey) return "skipped";
  params.handledRef.current = recoveryKey;

  try {
    const confirmation = await params.syncCheckout(checkoutId);
    if (!confirmation) {
      if (params.handledRef.current === recoveryKey) params.handledRef.current = "";
      return "not_confirmed";
    }
    params.onConfirmed(params.context, confirmation);
    return "confirmed";
  } catch (error) {
    if (params.handledRef.current === recoveryKey) params.handledRef.current = "";
    throw error;
  }
}
