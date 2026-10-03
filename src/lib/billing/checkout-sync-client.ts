export type CheckoutSyncProvider = "creem" | "stripe" | "waffo";

export function resolveCheckoutSyncEndpoint(
  checkoutId?: string | null,
  provider?: string | null
): string | undefined {
  if (provider?.trim().toLowerCase() === "waffo" || checkoutId?.trim().startsWith("waffo:")) {
    return "/api/v1/billing/waffo/sync-checkout";
  }
  return checkoutId?.trim().startsWith("cs_")
    ? "/api/v1/billing/stripe/sync-checkout"
    : "/api/v1/billing/creem/sync-checkout";
}

export type CheckoutSyncPaymentDetails = {
  transactionId?: string;
  orderId?: string;
  subscriptionId?: string;
  packageId?: string;
  value?: number;
  currency?: string;
};
