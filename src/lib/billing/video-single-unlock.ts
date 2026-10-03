import type { BillingPackageId, PricingVariant } from "@/lib/billing/catalog";

export const VIDEO_SINGLE_UNLOCK_PACKAGE_ID = "video_unlock_single" as const satisfies BillingPackageId;
export const LEGACY_VIDEO_SINGLE_UNLOCK_PRICING_VARIANT = "1.6" as const satisfies PricingVariant;

export function isVideoSingleUnlockAvailableForPricingVariant(pricingVariant: PricingVariant): boolean {
  return pricingVariant !== "2.3";
}

export function resolveVideoSingleUnlockCheckoutPricingVariant(
  pricingVariant: PricingVariant
): PricingVariant {
  return pricingVariant === "2.4" || pricingVariant === "2.5"
    ? pricingVariant
    : LEGACY_VIDEO_SINGLE_UNLOCK_PRICING_VARIANT;
}

export function isPricingV24VideoSingleUnlockCheckout(params: {
  packageId: BillingPackageId;
  requestedPricingVariant?: PricingVariant;
}): boolean {
  return params.packageId === VIDEO_SINGLE_UNLOCK_PACKAGE_ID
    && (params.requestedPricingVariant === "2.4" || params.requestedPricingVariant === "2.5");
}
