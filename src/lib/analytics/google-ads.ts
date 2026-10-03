"use client";

import { checkoutPackageAnalytics } from "@/lib/analytics/checkout";
import { captureAnalyticsEvent } from "@/lib/analytics/posthog";
import { registerTelemetryFlushHook } from "@/lib/telemetry/client";

export const GOOGLE_ADS_ID = "AW-18040611490";
const GOOGLE_ADS_LANDING_VIEW_CONVERSIONS = [
  {
    sendTo: "AW-18040611490/OlqeCNzC5LIcEKLFt5pD",
    value: 0.01,
    currency: "USD"
  }
];
const GOOGLE_ADS_SIGNUP_CONVERSIONS = [
  {
    sendTo: "AW-18040611490/yVoLCIKI_q4cEKLFt5pD",
    value: 0.02,
    currency: "USD"
  },
  {
    sendTo: "AW-17927852462/PrQfCLuA0JIcEK6j1eRC"
  }
];
const GOOGLE_ADS_BEGIN_CHECKOUT_CONVERSIONS = [
  {
    sendTo: "AW-18040611490/BSVnCMT66bIcEKLFt5pD",
    value: 1,
    currency: "USD"
  },
  {
    sendTo: "AW-17927852462/tqDHCOq7rL8cEK6j1eRC"
  }
];
const BEGIN_CHECKOUT_VALUE_MULTIPLIER = 0.2;
const GOOGLE_ADS_PURCHASE_CONVERSIONS = [
  {
    sendTo: "AW-18040611490/ri2ECK_wi7UcEKLFt5pD",
    value: 1,
    currency: "USD"
  },
  {
    sendTo: "AW-17927852462/UHVbCL7J9MkcEK6j1eRC"
  }
];
const GOOGLE_ADS_SUBSCRIPTION_MODAL_VIEW_CONVERSIONS = [
  {
    sendTo: "AW-18040611490/8BSdCM66pLUcEKLFt5pD",
    value: 0.01,
    currency: "USD"
  }
];
const LANDING_VIEW_CONVERSION_SEEN_KEY = "vismuse_google_ads_landing_view_conversion_seen";
const SIGNUP_CONVERSION_SEEN_KEY = "vismuse_google_ads_signup_conversion_seen";
const SIGNUP_RETRY_QUEUE_KEY = "vismuse_google_ads_signup_retry_queue_v1";
const BEGIN_CHECKOUT_CONVERSION_SEEN_KEY_PREFIX = "vismuse_google_ads_begin_checkout_conversion_seen:";
const BEGIN_CHECKOUT_RETRY_QUEUE_KEY = "vismuse_google_ads_begin_checkout_retry_queue_v1";
const PURCHASE_CONVERSION_SEEN_KEY_PREFIX = "vismuse_google_ads_purchase_conversion_seen:";
const PURCHASE_RETRY_QUEUE_KEY = "vismuse_google_ads_purchase_retry_queue_v1";
const PURCHASE_RETRY_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SUBSCRIPTION_MODAL_VIEW_SEEN_KEY_PREFIX = "vismuse_google_ads_subscription_modal_view_seen:";
const LOCAL_GOOGLE_ADS_DEBUG_KEY = "vismuse_google_ads_local_debug";
const GOOGLE_ADS_EVENT_CALLBACK_TIMEOUT_MS = 1500;

type GtagCommand = "event" | "config" | "js" | "set";
type Gtag = (command: GtagCommand, target: string | Date, params?: Record<string, unknown>) => void;
type GoogleAdsSignupDiagnosticStatus =
  | "attempted"
  | "dispatched"
  | "callback_received"
  | "timeout"
  | "skipped"
  | "failed";
type GoogleAdsSignupInput = {
  dedupeKey: string;
  email?: string | null;
};
type GoogleAdsBeginCheckoutDiagnosticStatus =
  | "attempted"
  | "dispatched"
  | "callback_received"
  | "timeout"
  | "skipped"
  | "failed";
type GoogleAdsBeginCheckoutInput = {
  dedupeKey: string;
  packageId?: string | null;
  value?: number;
  currency?: string;
};
type GoogleAdsPurchaseDiagnosticStatus =
  | "attempted"
  | "dispatched"
  | "callback_received"
  | "timeout"
  | "skipped"
  | "failed";
type GoogleAdsPurchaseInput = {
  packageId?: string | null;
  transactionId?: string;
  value?: number;
  currency?: string;
};
type QueuedGoogleAdsBeginCheckout = GoogleAdsBeginCheckoutInput & {
  createdAt: number;
};
type QueuedGoogleAdsSignup = GoogleAdsSignupInput & {
  createdAt: number;
};
type QueuedGoogleAdsPurchase = GoogleAdsPurchaseInput & {
  dedupeKey: string;
  createdAt: number;
};

let signupRetryHandlersRegistered = false;
let beginCheckoutRetryHandlersRegistered = false;
let purchaseRetryHandlersRegistered = false;

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.trim().toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function allowLocalGoogleAdsDebug(): boolean {
  if (typeof window === "undefined" || !isLocalhost()) return false;
  try {
    if (new URL(window.location.href).searchParams.get("google_ads_debug") === "1") {
      window.sessionStorage.setItem(LOCAL_GOOGLE_ADS_DEBUG_KEY, "1");
      return true;
    }
    return window.sessionStorage.getItem(LOCAL_GOOGLE_ADS_DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

function shouldSkipGoogleAdsTracking(): boolean {
  return typeof window === "undefined" || (isLocalhost() && !allowLocalGoogleAdsDebug());
}

function getGtag(): Gtag | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as Window & { gtag?: unknown }).gtag;
  return typeof candidate === "function" ? (candidate as Gtag) : null;
}

function normalizeEmail(email?: string | null): string | undefined {
  const normalized = email?.trim().toLowerCase();
  return normalized && normalized.includes("@") ? normalized : undefined;
}

function setEnhancedConversionUserData(gtag: Gtag, params: { email?: string | null }): void {
  const email = normalizeEmail(params.email);
  if (!email) return;

  gtag("set", "user_data", {
    email
  });
}

function roundCurrencyValue(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function resolveGoogleAdsBeginCheckoutValue(params: {
  packageId?: string | null;
  value?: number;
  fallbackValue?: number;
}): number {
  const packageAnalytics = checkoutPackageAnalytics(params.packageId);
  const selectedValue = typeof params.value === "number" && Number.isFinite(params.value)
    ? params.value
    : packageAnalytics?.value ?? params.fallbackValue ?? 1;
  return roundCurrencyValue(selectedValue * BEGIN_CHECKOUT_VALUE_MULTIPLIER);
}

export function createGoogleAdsCheckoutIntentDedupeKey(packageId?: string | null): string {
  const normalizedPackageId = (packageId?.trim() || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `checkout_intent_${normalizedPackageId}_${randomPart}`;
}

function hasSeenStoredConversion(seenKey: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.localStorage.getItem(seenKey) === "1") return true;
  } catch {
    // Fall back to sessionStorage below.
  }
  try {
    return window.sessionStorage.getItem(seenKey) === "1";
  } catch {
    return false;
  }
}

function markStoredConversionSeen(seenKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(seenKey, "1");
    return;
  } catch {
    // Fall back to sessionStorage if localStorage is unavailable.
  }
  try {
    window.sessionStorage.setItem(seenKey, "1");
  } catch {
    // Ignore analytics storage failures.
  }
}

function beginCheckoutSeenKey(dedupeKey: string): string {
  return `${BEGIN_CHECKOUT_CONVERSION_SEEN_KEY_PREFIX}${dedupeKey}`;
}

function signupSeenKey(dedupeKey: string): string {
  return `${SIGNUP_CONVERSION_SEEN_KEY}:${dedupeKey}`;
}

function purchaseSeenKey(dedupeKey: string): string {
  return `${PURCHASE_CONVERSION_SEEN_KEY_PREFIX}${dedupeKey}`;
}

function normalizeQueuedBeginCheckout(value: unknown): QueuedGoogleAdsBeginCheckout | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const dedupeKey = typeof record.dedupeKey === "string" ? record.dedupeKey.trim() : "";
  if (!dedupeKey) return null;
  return {
    dedupeKey,
    packageId: typeof record.packageId === "string" ? record.packageId : undefined,
    value: typeof record.value === "number" && Number.isFinite(record.value) ? record.value : undefined,
    currency: typeof record.currency === "string" ? record.currency : undefined,
    createdAt: typeof record.createdAt === "number" && Number.isFinite(record.createdAt) ? record.createdAt : Date.now()
  };
}

function readBeginCheckoutRetryQueue(): QueuedGoogleAdsBeginCheckout[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BEGIN_CHECKOUT_RETRY_QUEUE_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeQueuedBeginCheckout)
      .filter((item): item is QueuedGoogleAdsBeginCheckout => Boolean(item));
  } catch {
    return [];
  }
}

function writeBeginCheckoutRetryQueue(queue: QueuedGoogleAdsBeginCheckout[]): void {
  if (typeof window === "undefined") return;
  try {
    if (!queue.length) {
      window.localStorage.removeItem(BEGIN_CHECKOUT_RETRY_QUEUE_KEY);
      return;
    }
    window.localStorage.setItem(BEGIN_CHECKOUT_RETRY_QUEUE_KEY, JSON.stringify(queue.slice(-20)));
  } catch {
    // Retry persistence should never block checkout.
  }
}

function queueBeginCheckoutRetry(params: GoogleAdsBeginCheckoutInput): void {
  const dedupeKey = params.dedupeKey.trim();
  if (!dedupeKey) return;
  const queue = readBeginCheckoutRetryQueue();
  const existingIndex = queue.findIndex((item) => item.dedupeKey === dedupeKey);
  const nextItem: QueuedGoogleAdsBeginCheckout = {
    dedupeKey,
    packageId: params.packageId,
    value: params.value,
    currency: params.currency,
    createdAt: existingIndex >= 0 ? queue[existingIndex].createdAt : Date.now()
  };
  if (existingIndex >= 0) {
    queue[existingIndex] = nextItem;
  } else {
    queue.push(nextItem);
  }
  writeBeginCheckoutRetryQueue(queue);
}

function removeBeginCheckoutRetry(dedupeKey: string): void {
  const normalized = dedupeKey.trim();
  if (!normalized) return;
  writeBeginCheckoutRetryQueue(readBeginCheckoutRetryQueue().filter((item) => item.dedupeKey !== normalized));
}

function normalizeQueuedSignup(value: unknown): QueuedGoogleAdsSignup | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const dedupeKey = typeof record.dedupeKey === "string" ? record.dedupeKey.trim() : "";
  if (!dedupeKey) return null;
  return {
    dedupeKey,
    email: typeof record.email === "string" ? record.email : undefined,
    createdAt: typeof record.createdAt === "number" && Number.isFinite(record.createdAt) ? record.createdAt : Date.now()
  };
}

function readSignupRetryQueue(): QueuedGoogleAdsSignup[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SIGNUP_RETRY_QUEUE_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeQueuedSignup)
      .filter((item): item is QueuedGoogleAdsSignup => Boolean(item));
  } catch {
    return [];
  }
}

function writeSignupRetryQueue(queue: QueuedGoogleAdsSignup[]): void {
  if (typeof window === "undefined") return;
  try {
    if (!queue.length) {
      window.localStorage.removeItem(SIGNUP_RETRY_QUEUE_KEY);
      return;
    }
    window.localStorage.setItem(SIGNUP_RETRY_QUEUE_KEY, JSON.stringify(queue.slice(-20)));
  } catch {
    // Retry persistence should never block signup.
  }
}

function queueSignupRetry(params: GoogleAdsSignupInput): void {
  const dedupeKey = params.dedupeKey.trim();
  if (!dedupeKey) return;
  const queue = readSignupRetryQueue();
  const existingIndex = queue.findIndex((item) => item.dedupeKey === dedupeKey);
  const nextItem: QueuedGoogleAdsSignup = {
    dedupeKey,
    email: params.email,
    createdAt: existingIndex >= 0 ? queue[existingIndex].createdAt : Date.now()
  };
  if (existingIndex >= 0) {
    queue[existingIndex] = nextItem;
  } else {
    queue.push(nextItem);
  }
  writeSignupRetryQueue(queue);
}

function removeSignupRetry(dedupeKey: string): void {
  const normalized = dedupeKey.trim();
  if (!normalized) return;
  writeSignupRetryQueue(readSignupRetryQueue().filter((item) => item.dedupeKey !== normalized));
}

function normalizeQueuedPurchase(value: unknown): QueuedGoogleAdsPurchase | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const dedupeKey = typeof record.dedupeKey === "string" ? record.dedupeKey.trim() : "";
  if (!dedupeKey) return null;
  return {
    dedupeKey,
    packageId: typeof record.packageId === "string" ? record.packageId : undefined,
    transactionId: typeof record.transactionId === "string" ? record.transactionId : undefined,
    value: typeof record.value === "number" && Number.isFinite(record.value) ? record.value : undefined,
    currency: typeof record.currency === "string" ? record.currency : undefined,
    createdAt: typeof record.createdAt === "number" && Number.isFinite(record.createdAt) ? record.createdAt : Number.NaN
  };
}

function readPurchaseRetryQueue(): QueuedGoogleAdsPurchase[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PURCHASE_RETRY_QUEUE_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    const queue = parsed
      .map(normalizeQueuedPurchase)
      .filter((item): item is QueuedGoogleAdsPurchase => (
        Boolean(item)
        && Number.isFinite(item?.createdAt)
        && (item?.createdAt ?? 0) <= Date.now()
        && Date.now() - (item?.createdAt ?? 0) <= PURCHASE_RETRY_MAX_AGE_MS
      ));
    if (queue.length !== parsed.length) {
      writePurchaseRetryQueue(queue);
    }
    return queue;
  } catch {
    return [];
  }
}

function writePurchaseRetryQueue(queue: QueuedGoogleAdsPurchase[]): void {
  if (typeof window === "undefined") return;
  try {
    if (!queue.length) {
      window.localStorage.removeItem(PURCHASE_RETRY_QUEUE_KEY);
      return;
    }
    window.localStorage.setItem(PURCHASE_RETRY_QUEUE_KEY, JSON.stringify(queue.slice(-20)));
  } catch {
    // Retry persistence should never block checkout completion.
  }
}

function createGoogleAdsPurchaseFallbackDedupeKey(packageId?: string | null): string {
  const normalizedPackageId = (packageId?.trim() || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `purchase_${normalizedPackageId}_${randomPart}`;
}

function resolveGoogleAdsPurchaseDedupeKey(params: GoogleAdsPurchaseInput): string {
  return params.transactionId?.trim() || createGoogleAdsPurchaseFallbackDedupeKey(params.packageId);
}

function queuePurchaseRetry(params: GoogleAdsPurchaseInput, dedupeKey: string): void {
  const normalizedDedupeKey = dedupeKey.trim();
  if (!normalizedDedupeKey) return;
  const queue = readPurchaseRetryQueue();
  const existingIndex = queue.findIndex((item) => item.dedupeKey === normalizedDedupeKey);
  const nextItem: QueuedGoogleAdsPurchase = {
    dedupeKey: normalizedDedupeKey,
    packageId: params.packageId,
    transactionId: params.transactionId,
    value: params.value,
    currency: params.currency,
    createdAt: existingIndex >= 0 ? queue[existingIndex].createdAt : Date.now()
  };
  if (existingIndex >= 0) {
    queue[existingIndex] = nextItem;
  } else {
    queue.push(nextItem);
  }
  writePurchaseRetryQueue(queue);
}

function removePurchaseRetry(dedupeKey: string): void {
  const normalized = dedupeKey.trim();
  if (!normalized) return;
  writePurchaseRetryQueue(readPurchaseRetryQueue().filter((item) => item.dedupeKey !== normalized));
}

function captureGoogleAdsBeginCheckoutDiagnostic(
  status: GoogleAdsBeginCheckoutDiagnosticStatus,
  properties: Record<string, unknown>
): void {
  captureAnalyticsEvent("google_ads_begin_checkout", {
    provider: "google_ads",
    action: `google_ads_begin_checkout_${status}`,
    status,
    event_source: "client",
    capture_source: "client",
    ...properties
  });
}

function captureGoogleAdsSignupDiagnostic(
  status: GoogleAdsSignupDiagnosticStatus,
  properties: Record<string, unknown>
): void {
  captureAnalyticsEvent("google_ads_signup", {
    provider: "google_ads",
    action: `google_ads_signup_${status}`,
    status,
    event_source: "client",
    capture_source: "client",
    ...properties
  });
}

function captureGoogleAdsPurchaseDiagnostic(
  status: GoogleAdsPurchaseDiagnosticStatus,
  properties: Record<string, unknown>
): void {
  captureAnalyticsEvent("google_ads_purchase", {
    provider: "google_ads",
    action: `google_ads_purchase_${status}`,
    status,
    event_source: "client",
    capture_source: "client",
    ...properties
  });
}

function buildBeginCheckoutDiagnosticProperties(params: GoogleAdsBeginCheckoutInput): Record<string, unknown> {
  const packageAnalytics = checkoutPackageAnalytics(params.packageId);
  return {
    dedupe_key: params.dedupeKey,
    package_id: params.packageId,
    checkout_plan: packageAnalytics?.checkout_plan,
    conversion_count: GOOGLE_ADS_BEGIN_CHECKOUT_CONVERSIONS.length
  };
}

function buildSignupDiagnosticProperties(params: GoogleAdsSignupInput): Record<string, unknown> {
  return {
    dedupe_key: params.dedupeKey,
    conversion_count: GOOGLE_ADS_SIGNUP_CONVERSIONS.length
  };
}

function buildPurchaseDiagnosticProperties(params: GoogleAdsPurchaseInput, dedupeKey: string): Record<string, unknown> {
  const packageAnalytics = checkoutPackageAnalytics(params.packageId);
  return {
    dedupe_key: dedupeKey,
    transaction_id: params.transactionId,
    package_id: params.packageId,
    checkout_plan: packageAnalytics?.checkout_plan,
    conversion_count: GOOGLE_ADS_PURCHASE_CONVERSIONS.length
  };
}

function registerSignupRetryHandlers(): void {
  if (typeof window === "undefined" || signupRetryHandlersRegistered) return;
  signupRetryHandlersRegistered = true;
  registerTelemetryFlushHook(() => {
    flushQueuedGoogleAdsSignupConversions();
  });
}

function registerBeginCheckoutRetryHandlers(): void {
  if (typeof window === "undefined" || beginCheckoutRetryHandlersRegistered) return;
  beginCheckoutRetryHandlersRegistered = true;
  registerTelemetryFlushHook(() => {
    flushQueuedGoogleAdsBeginCheckoutConversions();
  });
}

function registerPurchaseRetryHandlers(): void {
  if (typeof window === "undefined" || purchaseRetryHandlersRegistered) return;
  purchaseRetryHandlersRegistered = true;
  registerTelemetryFlushHook(() => {
    flushQueuedGoogleAdsPurchaseConversions();
  });
}

export function flushQueuedGoogleAdsSignupConversions(): void {
  if (typeof window === "undefined") return;
  if (shouldSkipGoogleAdsTracking()) return;

  const queued = readSignupRetryQueue();
  if (!queued.length) return;

  const gtag = getGtag();
  if (!gtag) return;

  writeSignupRetryQueue([]);

  for (const item of queued) {
    setEnhancedConversionUserData(gtag, { email: item.email });
    markStoredConversionSeen(signupSeenKey(item.dedupeKey));
    for (const conversion of GOOGLE_ADS_SIGNUP_CONVERSIONS) {
      gtag("event", "conversion", {
        send_to: conversion.sendTo,
        value: conversion.value,
        currency: conversion.currency
      });
    }
  }
}

export function flushQueuedGoogleAdsBeginCheckoutConversions(): void {
  if (typeof window === "undefined") return;
  if (shouldSkipGoogleAdsTracking()) return;

  const queued = readBeginCheckoutRetryQueue();
  if (!queued.length) return;

  const gtag = getGtag();
  if (!gtag) return;

  writeBeginCheckoutRetryQueue([]);

  for (const item of queued) {
    markStoredConversionSeen(beginCheckoutSeenKey(item.dedupeKey));
    for (const conversion of GOOGLE_ADS_BEGIN_CHECKOUT_CONVERSIONS) {
      const value = resolveGoogleAdsBeginCheckoutValue({
        packageId: item.packageId,
        value: item.value,
        fallbackValue: conversion.value
      });
      const currency = item.currency || checkoutPackageAnalytics(item.packageId)?.currency || conversion.currency;
      gtag("event", "conversion", {
        send_to: conversion.sendTo,
        value,
        currency,
        transaction_id: item.dedupeKey
      });
    }
  }
}

export function flushQueuedGoogleAdsPurchaseConversions(): void {
  if (typeof window === "undefined") return;
  if (shouldSkipGoogleAdsTracking()) return;

  const queued = readPurchaseRetryQueue();
  if (!queued.length) return;

  const gtag = getGtag();
  if (!gtag) return;

  for (const item of queued) {
    const seenKey = purchaseSeenKey(item.dedupeKey);
    if (hasSeenStoredConversion(seenKey)) {
      removePurchaseRetry(item.dedupeKey);
      continue;
    }
    dispatchGoogleAdsPurchase(gtag, item, item.dedupeKey, {
      includePurchaseEvent: false,
      onConversionCallback: () => {
        markStoredConversionSeen(seenKey);
        removePurchaseRetry(item.dedupeKey);
      }
    });
  }
}

if (typeof window !== "undefined") {
  registerSignupRetryHandlers();
  registerBeginCheckoutRetryHandlers();
  registerPurchaseRetryHandlers();
}

export function trackGoogleAdsLandingViewConversion(): void {
  if (shouldSkipGoogleAdsTracking()) return;

  try {
    if (window.sessionStorage.getItem(LANDING_VIEW_CONVERSION_SEEN_KEY) === "1") {
      return;
    }

    const gtag = getGtag();
    if (!gtag) return;

    for (const conversion of GOOGLE_ADS_LANDING_VIEW_CONVERSIONS) {
      gtag("event", "conversion", {
        send_to: conversion.sendTo,
        value: conversion.value,
        currency: conversion.currency
      });
    }

    window.sessionStorage.setItem(LANDING_VIEW_CONVERSION_SEEN_KEY, "1");
  } catch {
    // Ignore analytics write failures.
  }
}

export function trackGoogleAdsSignupConversion(params: GoogleAdsSignupInput): void {
  const startedAt = Date.now();
  registerSignupRetryHandlers();
  const baseDiagnosticProperties = buildSignupDiagnosticProperties(params);

  if (shouldSkipGoogleAdsTracking()) {
    captureGoogleAdsSignupDiagnostic("skipped", {
      ...baseDiagnosticProperties,
      reason: "tracking_disabled_or_localhost"
    });
    return;
  }

  try {
    const dedupeKey = params.dedupeKey.trim();
    if (!dedupeKey) {
      captureGoogleAdsSignupDiagnostic("skipped", {
        ...baseDiagnosticProperties,
        reason: "missing_dedupe_key"
      });
      return;
    }

    const seenKey = signupSeenKey(dedupeKey);
    if (hasSeenStoredConversion(seenKey)) {
      captureGoogleAdsSignupDiagnostic("skipped", {
        ...baseDiagnosticProperties,
        reason: "deduped"
      });
      return;
    }

    queueSignupRetry({ ...params, dedupeKey });
    const gtag = getGtag();
    if (!gtag) {
      captureGoogleAdsSignupDiagnostic("skipped", {
        ...baseDiagnosticProperties,
        reason: "gtag_missing"
      });
      return;
    }

    let callbackReceived = false;
    window.setTimeout(() => {
      if (callbackReceived) return;
      captureGoogleAdsSignupDiagnostic("timeout", {
        ...baseDiagnosticProperties,
        reason: "event_callback_timeout",
        elapsed_ms: Date.now() - startedAt
      });
    }, GOOGLE_ADS_EVENT_CALLBACK_TIMEOUT_MS);

    setEnhancedConversionUserData(gtag, { email: params.email });
    captureGoogleAdsSignupDiagnostic("attempted", {
      ...baseDiagnosticProperties,
      has_gtag: true
    });
    for (const [index, conversion] of GOOGLE_ADS_SIGNUP_CONVERSIONS.entries()) {
      captureGoogleAdsSignupDiagnostic("dispatched", {
        ...baseDiagnosticProperties,
        send_to: conversion.sendTo,
        value: conversion.value,
        currency: conversion.currency
      });
      gtag("event", "conversion", {
        send_to: conversion.sendTo,
        value: conversion.value,
        currency: conversion.currency,
        ...(index === 0
          ? {
              event_callback: () => {
                callbackReceived = true;
                markStoredConversionSeen(seenKey);
                removeSignupRetry(dedupeKey);
                captureGoogleAdsSignupDiagnostic("callback_received", {
                  ...baseDiagnosticProperties,
                  send_to: conversion.sendTo,
                  value: conversion.value,
                  currency: conversion.currency,
                  elapsed_ms: Date.now() - startedAt
                });
              }
            }
          : {})
      });
    }
  } catch (error) {
    captureGoogleAdsSignupDiagnostic("failed", {
      ...baseDiagnosticProperties,
      reason: error instanceof Error ? error.message : String(error)
    });
  }
}

export function trackGoogleAdsBeginCheckoutConversion(params: GoogleAdsBeginCheckoutInput): Promise<void> {
  const startedAt = Date.now();
  registerBeginCheckoutRetryHandlers();
  const baseDiagnosticProperties = buildBeginCheckoutDiagnosticProperties(params);

  if (shouldSkipGoogleAdsTracking()) {
    captureGoogleAdsBeginCheckoutDiagnostic("skipped", {
      ...baseDiagnosticProperties,
      reason: "tracking_disabled_or_localhost"
    });
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let didResolve = false;
    const finish = () => {
      if (didResolve) return;
      didResolve = true;
      resolve();
    };
    window.setTimeout(() => {
      if (didResolve) return;
      captureGoogleAdsBeginCheckoutDiagnostic("timeout", {
        ...baseDiagnosticProperties,
        reason: "event_callback_timeout",
        elapsed_ms: Date.now() - startedAt
      });
      finish();
    }, GOOGLE_ADS_EVENT_CALLBACK_TIMEOUT_MS);

    try {
      const dedupeKey = params.dedupeKey.trim();
      if (!dedupeKey) {
        captureGoogleAdsBeginCheckoutDiagnostic("skipped", {
          ...baseDiagnosticProperties,
          reason: "missing_dedupe_key"
        });
        finish();
        return;
      }

      const seenKey = `${BEGIN_CHECKOUT_CONVERSION_SEEN_KEY_PREFIX}${dedupeKey}`;
      if (hasSeenStoredConversion(seenKey)) {
        captureGoogleAdsBeginCheckoutDiagnostic("skipped", {
          ...baseDiagnosticProperties,
          reason: "deduped"
        });
        finish();
        return;
      }

      queueBeginCheckoutRetry(params);
      const gtag = getGtag();
      if (!gtag) {
        captureGoogleAdsBeginCheckoutDiagnostic("skipped", {
          ...baseDiagnosticProperties,
          reason: "gtag_missing"
        });
        finish();
        return;
      }

      captureGoogleAdsBeginCheckoutDiagnostic("attempted", {
        ...baseDiagnosticProperties,
        has_gtag: true
      });
      for (const conversion of GOOGLE_ADS_BEGIN_CHECKOUT_CONVERSIONS) {
        const value = resolveGoogleAdsBeginCheckoutValue({
          packageId: params.packageId,
          value: params.value,
          fallbackValue: conversion.value
        });
        const currency = params.currency || checkoutPackageAnalytics(params.packageId)?.currency || conversion.currency;
        captureGoogleAdsBeginCheckoutDiagnostic("dispatched", {
          ...baseDiagnosticProperties,
          send_to: conversion.sendTo,
          value,
          currency
        });
        gtag("event", "conversion", {
          send_to: conversion.sendTo,
          value,
          currency,
          transaction_id: dedupeKey,
          event_callback: () => {
            markStoredConversionSeen(seenKey);
            removeBeginCheckoutRetry(dedupeKey);
            captureGoogleAdsBeginCheckoutDiagnostic("callback_received", {
              ...baseDiagnosticProperties,
              send_to: conversion.sendTo,
              value,
              currency,
              elapsed_ms: Date.now() - startedAt
            });
            finish();
          }
        });
      }
    } catch (error) {
      captureGoogleAdsBeginCheckoutDiagnostic("failed", {
        ...baseDiagnosticProperties,
        reason: error instanceof Error ? error.message : String(error)
      });
      finish();
    }
  });
}

export function trackGoogleAdsSubscriptionModalViewConversion(params: { userId?: string | null } = {}): void {
  if (shouldSkipGoogleAdsTracking()) return;

  try {
    const userId = params.userId?.trim();
    if (!userId) return;

    const seenKey = `${SUBSCRIPTION_MODAL_VIEW_SEEN_KEY_PREFIX}${userId}`;
    if (hasSeenStoredConversion(seenKey)) {
      return;
    }

    const gtag = getGtag();
    if (!gtag) return;

    for (const conversion of GOOGLE_ADS_SUBSCRIPTION_MODAL_VIEW_CONVERSIONS) {
      gtag("event", "conversion", {
        send_to: conversion.sendTo,
        value: conversion.value,
        currency: conversion.currency
      });
    }

    markStoredConversionSeen(seenKey);
  } catch {
    // Ignore analytics write failures.
  }
}

function dispatchGoogleAdsPurchase(
  gtag: Gtag,
  params: GoogleAdsPurchaseInput,
  dedupeKey: string,
  options: {
    includePurchaseEvent?: boolean;
    onConversionCallback?: (conversion: typeof GOOGLE_ADS_PURCHASE_CONVERSIONS[number]) => void;
  } = {}
): void {
  for (const conversion of GOOGLE_ADS_PURCHASE_CONVERSIONS) {
    const value = params.value ?? conversion.value;
    const currency = params.currency || conversion.currency;
    gtag("event", "conversion", {
      send_to: conversion.sendTo,
      value,
      currency,
      transaction_id: dedupeKey,
      ...(options.onConversionCallback
        ? {
            event_callback: () => options.onConversionCallback?.(conversion)
          }
        : {})
    });
  }

  if (options.includePurchaseEvent === false) return;

  gtag("event", "purchase", {
    transaction_id: dedupeKey,
    value: params.value,
    currency: params.currency || "USD",
    items: params.packageId
      ? [
          {
            item_id: params.packageId,
            item_name: params.packageId
          }
        ]
      : undefined
  });
}

export function trackGoogleAnalyticsPurchase(params: GoogleAdsPurchaseInput): void {
  const startedAt = Date.now();
  registerPurchaseRetryHandlers();
  const dedupeKey = resolveGoogleAdsPurchaseDedupeKey(params);
  const seenKey = purchaseSeenKey(dedupeKey);
  const baseDiagnosticProperties = buildPurchaseDiagnosticProperties(params, dedupeKey);

  if (shouldSkipGoogleAdsTracking()) {
    captureGoogleAdsPurchaseDiagnostic("skipped", {
      ...baseDiagnosticProperties,
      reason: "tracking_disabled_or_localhost"
    });
    return;
  }

  try {
    if (hasSeenStoredConversion(seenKey)) {
      captureGoogleAdsPurchaseDiagnostic("skipped", {
        ...baseDiagnosticProperties,
        reason: "deduped"
      });
      return;
    }

    queuePurchaseRetry(params, dedupeKey);
    const gtag = getGtag();
    if (!gtag) {
      captureGoogleAdsPurchaseDiagnostic("skipped", {
        ...baseDiagnosticProperties,
        reason: "gtag_missing"
      });
      return;
    }

    let callbackReceived = false;
    window.setTimeout(() => {
      if (callbackReceived) return;
      captureGoogleAdsPurchaseDiagnostic("timeout", {
        ...baseDiagnosticProperties,
        reason: "event_callback_timeout",
        elapsed_ms: Date.now() - startedAt
      });
    }, GOOGLE_ADS_EVENT_CALLBACK_TIMEOUT_MS);

    captureGoogleAdsPurchaseDiagnostic("attempted", {
      ...baseDiagnosticProperties,
      has_gtag: true
    });
    for (const conversion of GOOGLE_ADS_PURCHASE_CONVERSIONS) {
      captureGoogleAdsPurchaseDiagnostic("dispatched", {
        ...baseDiagnosticProperties,
        send_to: conversion.sendTo,
        value: params.value ?? conversion.value,
        currency: params.currency || conversion.currency
      });
    }

    dispatchGoogleAdsPurchase(gtag, params, dedupeKey, {
      onConversionCallback: (conversion) => {
        callbackReceived = true;
        markStoredConversionSeen(seenKey);
        removePurchaseRetry(dedupeKey);
        captureGoogleAdsPurchaseDiagnostic("callback_received", {
          ...baseDiagnosticProperties,
          send_to: conversion.sendTo,
          value: params.value ?? conversion.value,
          currency: params.currency || conversion.currency,
          elapsed_ms: Date.now() - startedAt
        });
      }
    });
  } catch (error) {
    captureGoogleAdsPurchaseDiagnostic("failed", {
      ...baseDiagnosticProperties,
      reason: error instanceof Error ? error.message : String(error)
    });
  }
}
