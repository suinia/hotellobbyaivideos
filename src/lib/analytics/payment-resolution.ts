import { checkoutPackageAnalytics } from "@/lib/analytics/checkout";
import type { CheckoutSyncPaymentDetails } from "@/lib/billing/checkout-sync-client";

type ResolveGooglePurchasePaymentDetailsInput = {
  fallbackPackageId?: string | null;
  fallbackValue?: number;
  fallbackCurrency?: string;
  synced: CheckoutSyncPaymentDetails;
};

export function resolveGooglePurchasePaymentDetails({
  fallbackPackageId,
  fallbackValue,
  fallbackCurrency,
  synced
}: ResolveGooglePurchasePaymentDetailsInput): {
  packageId?: string;
  value?: number;
  currency?: string;
} {
  const packageId = synced.packageId || fallbackPackageId?.trim() || undefined;
  const packageAnalytics = checkoutPackageAnalytics(packageId);
  const confirmedPackageChanged = Boolean(
    synced.packageId
    && fallbackPackageId?.trim()
    && synced.packageId !== fallbackPackageId.trim()
  );
  const fallbackResolvedValue = confirmedPackageChanged
    ? packageAnalytics?.value ?? fallbackValue
    : fallbackValue ?? packageAnalytics?.value;
  const fallbackResolvedCurrency = confirmedPackageChanged
    ? packageAnalytics?.currency ?? fallbackCurrency
    : fallbackCurrency || packageAnalytics?.currency;

  return {
    packageId,
    value: synced.value ?? fallbackResolvedValue,
    currency: synced.currency || fallbackResolvedCurrency
  };
}
