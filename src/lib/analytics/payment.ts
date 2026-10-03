"use client";

import { captureAnalyticsEvent } from "@/lib/analytics/posthog";
import { buildCheckoutAnalyticsProperties, checkoutPackageAnalytics, type CheckoutContext } from "@/lib/analytics/checkout";
import {
  readPendingGooglePurchases,
  removePendingGooglePurchase,
  type PendingGooglePurchase,
  upsertPendingGooglePurchase
} from "@/lib/analytics/payment-pending";
import { resolveGooglePurchasePaymentDetails } from "@/lib/analytics/payment-resolution";
import { createGooglePurchaseSyncProcessor } from "@/lib/analytics/payment-sync-retry";
import { resolveCheckoutSyncEndpoint, type CheckoutSyncPaymentDetails } from "@/lib/billing/checkout-sync-client";
import { trackGoogleAnalyticsPurchase } from "@/lib/analytics/google-ads";
import { trackMetaEvent } from "@/lib/analytics/meta-pixel";

const PAYMENT_SUCCESS_SEEN_KEY = "vismuse_payment_success_seen";
const CHECKOUT_SYNC_TIMEOUT_MS = 10_000;

type PaymentSuccessInput = {
  packageId?: string | null;
  stored: CheckoutContext;
  confirmedPayment?: CheckoutSyncPaymentDetails;
  fallbackEntry: string;
  fallbackScenario: string;
  fallbackSurface: string;
  extra?: Record<string, unknown>;
};

function hasSeenPaymentSuccess(dedupeKey: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const seen = window.sessionStorage.getItem(PAYMENT_SUCCESS_SEEN_KEY);
    if (seen === dedupeKey) return true;
    window.sessionStorage.setItem(PAYMENT_SUCCESS_SEEN_KEY, dedupeKey);
  } catch {
    return false;
  }
  return false;
}

function normalizeIdentifier(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizePaymentValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function normalizeCurrency(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().toUpperCase() : undefined;
}

function resolveGooglePurchaseTransactionId(params: CheckoutSyncPaymentDetails & {
  checkoutId?: string;
  fallbackTransactionId?: string;
}): string | undefined {
  return normalizeIdentifier(params.transactionId)
    || normalizeIdentifier(params.orderId)
    || normalizeIdentifier(params.subscriptionId)
    || normalizeIdentifier(params.checkoutId)
    || normalizeIdentifier(params.fallbackTransactionId);
}

function pendingGooglePurchaseKey(params: {
  checkoutId?: string;
  fallbackTransactionId?: string;
  packageId?: string | null;
}): string {
  return normalizeIdentifier(params.checkoutId)
    || normalizeIdentifier(params.fallbackTransactionId)
    || `purchase:${normalizeIdentifier(params.packageId) || "unknown"}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function readPersistedGooglePurchases(): PendingGooglePurchase[] {
  if (typeof window === "undefined") return [];
  try {
    return readPendingGooglePurchases(window.localStorage);
  } catch {
    return [];
  }
}

function persistGooglePurchase(purchase: PendingGooglePurchase): void {
  if (typeof window === "undefined") return;
  try {
    upsertPendingGooglePurchase(window.localStorage, purchase);
  } catch {
    // Payment completion must not depend on analytics persistence.
  }
}

function clearPersistedGooglePurchase(key: string): void {
  if (typeof window === "undefined") return;
  try {
    removePendingGooglePurchase(window.localStorage, key);
  } catch {
    // A stale pending item is safe because Google Ads also deduplicates by transaction id.
  }
}

async function syncCheckoutSoon(checkoutId?: string, provider?: string): Promise<CheckoutSyncPaymentDetails> {
  const normalizedCheckoutId = checkoutId?.trim();
  if (!normalizedCheckoutId || typeof window === "undefined") return {};

  const endpoint = resolveCheckoutSyncEndpoint(normalizedCheckoutId, provider);
  if (!endpoint) return {};

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CHECKOUT_SYNC_TIMEOUT_MS);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ checkout_id: normalizedCheckoutId }),
    signal: controller.signal
  }).catch(() => null).finally(() => {
    window.clearTimeout(timeout);
  });

  if (!response?.ok) {
    // The webhook remains authoritative; this is only a fast return-page fallback.
    return {};
  }

  const data = await response.json().catch(() => ({})) as {
    transaction_id?: string;
    order_id?: string;
    subscription_id?: string;
    package_id?: string;
    value?: number;
    currency?: string;
  };
  return {
    transactionId: normalizeIdentifier(data.transaction_id),
    orderId: normalizeIdentifier(data.order_id),
    subscriptionId: normalizeIdentifier(data.subscription_id),
    packageId: normalizeIdentifier(data.package_id),
    value: normalizePaymentValue(data.value),
    currency: normalizeCurrency(data.currency)
  };
}

const googlePurchaseSyncProcessor = createGooglePurchaseSyncProcessor({
  sync: (pending) => syncCheckoutSoon(pending.checkoutId, pending.provider),
  handOff: (pending, synced) => {
    const payment = resolveGooglePurchasePaymentDetails({
      fallbackPackageId: pending.packageId,
      fallbackValue: pending.value,
      fallbackCurrency: pending.currency,
      synced
    });
    trackGoogleAnalyticsPurchase({
      packageId: payment.packageId,
      transactionId: resolveGooglePurchaseTransactionId({
        ...synced,
        checkoutId: pending.checkoutId,
        fallbackTransactionId: pending.fallbackTransactionId
      }),
      value: payment.value,
      currency: payment.currency
    });
  },
  // trackGoogleAnalyticsPurchase synchronously hands the conversion to its own
  // durable retry queue before this record is removed.
  clearPending: clearPersistedGooglePurchase,
  setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearTimeout: (handle) => window.clearTimeout(handle as number),
  canRetry: () => document.visibilityState !== "hidden" && navigator.onLine !== false
});

function canResumePendingGooglePurchases(): boolean {
  return document.visibilityState !== "hidden" && navigator.onLine !== false;
}

function resumePendingGooglePurchases(): void {
  if (!canResumePendingGooglePurchases()) return;
  googlePurchaseSyncProcessor.resume(readPersistedGooglePurchases());
}

function restartPendingGooglePurchases(): void {
  if (!canResumePendingGooglePurchases()) return;
  googlePurchaseSyncProcessor.restart(readPersistedGooglePurchases());
}

function trackGooglePurchaseAndSyncCheckoutSoon(params: {
  checkoutId?: string;
  provider?: string;
  fallbackTransactionId?: string;
  packageId?: string | null;
  value?: number;
  currency?: string;
}, confirmedPayment?: CheckoutSyncPaymentDetails): void {
  const pending: PendingGooglePurchase = {
    key: pendingGooglePurchaseKey(params),
    checkoutId: normalizeIdentifier(params.checkoutId),
    provider: normalizeIdentifier(params.provider),
    fallbackTransactionId: normalizeIdentifier(params.fallbackTransactionId),
    packageId: normalizeIdentifier(params.packageId),
    value: normalizePaymentValue(params.value),
    currency: normalizeCurrency(params.currency),
    createdAt: Date.now()
  };
  persistGooglePurchase(pending);
  void googlePurchaseSyncProcessor.process(pending, confirmedPayment);
}

if (typeof window !== "undefined") {
  window.setTimeout(resumePendingGooglePurchases, 0);
  window.addEventListener("online", restartPendingGooglePurchases);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") restartPendingGooglePurchases();
  });
}

export function trackClientPaymentSuccess({
  packageId,
  stored,
  confirmedPayment,
  fallbackEntry,
  fallbackScenario,
  fallbackSurface,
  extra
}: PaymentSuccessInput): void {
  const resolvedPackageId = confirmedPayment?.packageId || packageId || stored.package_id;
  const packageAnalytics = checkoutPackageAnalytics(resolvedPackageId);
  const checkoutStartedAt = typeof stored.saved_at === "number" ? stored.saved_at : undefined;
  const fallbackTransactionId = normalizeIdentifier(stored.transaction_id)
    || normalizeIdentifier(stored.checkout_id)
    || (checkoutStartedAt && resolvedPackageId
    ? `checkout:${resolvedPackageId}:${checkoutStartedAt}`
    : undefined);
  const transactionId = resolveGooglePurchaseTransactionId({
    ...(confirmedPayment ?? {}),
    checkoutId: stored.checkout_id,
    fallbackTransactionId
  });
  const dedupeKey = transactionId || `${resolvedPackageId || "unknown"}:${fallbackEntry}`;
  if (hasSeenPaymentSuccess(dedupeKey)) {
    if (confirmedPayment) {
      const payment = resolveGooglePurchasePaymentDetails({
        fallbackPackageId: resolvedPackageId,
        fallbackValue: normalizePaymentValue(stored.value) ?? packageAnalytics?.value,
        fallbackCurrency: normalizeCurrency(stored.currency) ?? packageAnalytics?.currency,
        synced: confirmedPayment
      });
      trackGooglePurchaseAndSyncCheckoutSoon({
        packageId: payment.packageId,
        checkoutId: stored.checkout_id,
        provider: stored.provider,
        fallbackTransactionId: transactionId,
        value: payment.value,
        currency: payment.currency
      }, confirmedPayment);
    } else {
      void syncCheckoutSoon(stored.checkout_id, stored.provider);
    }
    return;
  }

  const confirmedValue = normalizePaymentValue(confirmedPayment?.value);
  const confirmedCurrency = normalizeCurrency(confirmedPayment?.currency);
  const properties = buildCheckoutAnalyticsProperties(resolvedPackageId, {
    ...stored,
    ...extra,
    package_id: resolvedPackageId,
    value: confirmedValue ?? stored.value,
    currency: confirmedCurrency ?? stored.currency,
    entry: stored.entry || fallbackEntry,
    checkout_scenario: stored.checkout_scenario || fallbackScenario,
    billing_surface: stored.billing_surface || fallbackSurface,
    status: "success",
    transaction_id: transactionId
  });
  const paymentValue = normalizePaymentValue(properties.value) ?? packageAnalytics?.value;
  const paymentCurrency = normalizeCurrency(properties.currency) ?? packageAnalytics?.currency ?? "USD";

  captureAnalyticsEvent("checkout_success", properties);
  trackGooglePurchaseAndSyncCheckoutSoon({
    packageId: resolvedPackageId,
    checkoutId: stored.checkout_id,
    provider: stored.provider,
    fallbackTransactionId: transactionId,
    value: paymentValue,
    currency: paymentCurrency
  }, confirmedPayment);
  trackMetaEvent("Purchase", {
    content_name: packageAnalytics?.checkout_plan || resolvedPackageId || "subscription",
    content_ids: resolvedPackageId ? [resolvedPackageId] : undefined,
    currency: paymentCurrency,
    value: paymentValue
  });
}
