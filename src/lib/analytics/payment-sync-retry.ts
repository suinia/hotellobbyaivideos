import type { PendingGooglePurchase } from "@/lib/analytics/payment-pending";
import type { CheckoutSyncPaymentDetails } from "@/lib/billing/checkout-sync-client";

export const GOOGLE_PURCHASE_SYNC_RETRY_DELAYS_MS = [1_000, 3_000, 10_000, 30_000, 60_000] as const;

type TimeoutHandle = unknown;

type GooglePurchaseSyncProcessorDependencies = {
  sync: (pending: PendingGooglePurchase) => Promise<CheckoutSyncPaymentDetails>;
  handOff: (
    pending: PendingGooglePurchase,
    synced: CheckoutSyncPaymentDetails
  ) => void;
  clearPending: (key: string) => void;
  setTimeout: (callback: () => void, delayMs: number) => TimeoutHandle;
  clearTimeout: (handle: TimeoutHandle) => void;
  canRetry?: () => boolean;
};

export function hasConfirmedPaymentValueAndCurrency(
  payment: CheckoutSyncPaymentDetails
): boolean {
  return typeof payment.value === "number"
    && Number.isFinite(payment.value)
    && payment.value >= 0
    && typeof payment.currency === "string"
    && Boolean(payment.currency.trim());
}

export function createGooglePurchaseSyncProcessor(
  dependencies: GooglePurchaseSyncProcessorDependencies
): {
  process: (
    pending: PendingGooglePurchase,
    confirmedPayment?: CheckoutSyncPaymentDetails
  ) => Promise<void>;
  resume: (pending: PendingGooglePurchase[]) => void;
  restart: (pending: PendingGooglePurchase[]) => void;
} {
  const processing = new Set<string>();
  const retryAttempts = new Map<string, number>();
  const retryTimers = new Map<string, TimeoutHandle>();
  const restartRequested = new Map<string, PendingGooglePurchase>();

  function cancelRetry(key: string): void {
    const timer = retryTimers.get(key);
    if (timer !== undefined) {
      dependencies.clearTimeout(timer);
      retryTimers.delete(key);
    }
    retryAttempts.delete(key);
  }

  function scheduleRetry(pending: PendingGooglePurchase): void {
    if (retryTimers.has(pending.key)) return;
    const attempt = retryAttempts.get(pending.key) ?? 0;
    const delayMs = GOOGLE_PURCHASE_SYNC_RETRY_DELAYS_MS[attempt];
    if (delayMs === undefined) return;

    retryAttempts.set(pending.key, attempt + 1);
    const timer = dependencies.setTimeout(() => {
      retryTimers.delete(pending.key);
      if (dependencies.canRetry?.() === false) return;
      void process(pending);
    }, delayMs);
    retryTimers.set(pending.key, timer);
  }

  async function process(
    pending: PendingGooglePurchase,
    confirmedPayment?: CheckoutSyncPaymentDetails
  ): Promise<void> {
    if (processing.has(pending.key)) return;
    processing.add(pending.key);

    try {
      const synced = confirmedPayment ?? await dependencies.sync(pending);

      // A checkout id means the server is authoritative for the charged value.
      // Keep the durable pending record until sync returns both fields so that
      // discounts and tax can never be replaced by the client-side list price.
      if (pending.checkoutId && !hasConfirmedPaymentValueAndCurrency(synced)) {
        scheduleRetry(pending);
        return;
      }

      dependencies.handOff(pending, synced);
      dependencies.clearPending(pending.key);
      cancelRetry(pending.key);
      restartRequested.delete(pending.key);
    } finally {
      processing.delete(pending.key);
      const restartPending = restartRequested.get(pending.key);
      if (restartPending) {
        restartRequested.delete(pending.key);
        cancelRetry(pending.key);
        void process(restartPending);
      }
    }
  }

  return {
    process,
    resume(pendingPurchases) {
      for (const pending of pendingPurchases) {
        void process(pending);
      }
    },
    restart(pendingPurchases) {
      for (const pending of pendingPurchases) {
        cancelRetry(pending.key);
        if (processing.has(pending.key)) {
          restartRequested.set(pending.key, pending);
        } else {
          void process(pending);
        }
      }
    }
  };
}
