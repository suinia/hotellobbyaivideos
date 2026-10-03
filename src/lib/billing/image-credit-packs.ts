import type { BillingPackageId, PricingVariant } from "@/lib/billing/catalog";
import { isVideoCreditPackPackageId } from "@/lib/billing/video-credit-packs";

export const IMAGE_CREDIT_PACK_CHECKOUT_TYPE = "image_credit_pack" as const;
export const IMAGE_GUIDED_CREDIT_PACK_CURRENT_IMAGE_COST = 10;
export const V19_FREE_IMAGE_CREDIT_PACK_CURRENT_IMAGE_COST = IMAGE_GUIDED_CREDIT_PACK_CURRENT_IMAGE_COST;

export const V19_FREE_IMAGE_CREDIT_PACK_PACKAGE_IDS = [
  "image_credit_pack_1000_v19",
  "image_credit_pack_3000_v19"
] as const satisfies ReadonlyArray<BillingPackageId>;

export const V25_IMAGE_CREDIT_PACK_PACKAGE_IDS = ["image_credit_pack_1500_v25", "image_credit_pack_5000_v25"] as const satisfies ReadonlyArray<BillingPackageId>;

export type V19FreeImageCreditPackPackageId = (typeof V19_FREE_IMAGE_CREDIT_PACK_PACKAGE_IDS)[number] | (typeof V25_IMAGE_CREDIT_PACK_PACKAGE_IDS)[number];

export const V24_IMAGE_CREDIT_PACK_PACKAGE_IDS = [
  "image_credit_pack_500_v24",
  "image_credit_pack_2000_v24",
  "image_credit_pack_10000_v24"
] as const satisfies ReadonlyArray<BillingPackageId>;

export type V24ImageCreditPackPackageId = (typeof V24_IMAGE_CREDIT_PACK_PACKAGE_IDS)[number];

export const IMAGE_CREDIT_PACK_PACKAGE_IDS = [
  ...V19_FREE_IMAGE_CREDIT_PACK_PACKAGE_IDS,
  ...V25_IMAGE_CREDIT_PACK_PACKAGE_IDS,
  "starter_pack_1_v20",
  "starter_pack_10_v20",
  "starter_pack_100_v20",
  "starter_pack_1000_v20",
  ...V24_IMAGE_CREDIT_PACK_PACKAGE_IDS
] as const satisfies ReadonlyArray<BillingPackageId>;

export type ImageCreditPackPackageId = (typeof IMAGE_CREDIT_PACK_PACKAGE_IDS)[number];

export function isImageCreditPackPackageId(value: BillingPackageId): value is ImageCreditPackPackageId {
  return IMAGE_CREDIT_PACK_PACKAGE_IDS.some((packageId) => packageId === value);
}

export function isV19FreeImageCreditPackPackageId(
  value: BillingPackageId
): value is V19FreeImageCreditPackPackageId {
  return [...V19_FREE_IMAGE_CREDIT_PACK_PACKAGE_IDS, ...V25_IMAGE_CREDIT_PACK_PACKAGE_IDS].some((packageId) => packageId === value);
}

export function isV24ImageCreditPackPackageId(
  value: BillingPackageId
): value is V24ImageCreditPackPackageId {
  return V24_IMAGE_CREDIT_PACK_PACKAGE_IDS.some((packageId) => packageId === value);
}

export function isImageGuidedCreditPackPurchase(params: {
  packageId: BillingPackageId;
  assetId?: string;
  jobId?: string;
}): boolean {
  return Boolean(params.assetId && params.jobId)
    && (
      isV19FreeImageCreditPackPackageId(params.packageId)
      || isV24ImageCreditPackPackageId(params.packageId)
      || isVideoCreditPackPackageId(params.packageId)
    );
}

export function resolveV19FreeImageCreditPackBundleCredits(
  packageId: BillingPackageId
): number | undefined {
  if (packageId === "image_credit_pack_1500_v25") return 1_500;
  if (packageId === "image_credit_pack_5000_v25") return 5_000;
  if (packageId === "image_credit_pack_1000_v19") return 500;
  if (packageId === "image_credit_pack_3000_v19") return 2_000;
  return undefined;
}

export function isV19ImageCreditPackCheckout(params: {
  checkoutType?: string;
  packageId: BillingPackageId;
  pricingVariant?: PricingVariant;
}): boolean {
  return params.checkoutType === IMAGE_CREDIT_PACK_CHECKOUT_TYPE
    && (params.packageId.endsWith("_v25") ? params.pricingVariant === "2.5" : params.pricingVariant === "1.9" || params.pricingVariant === "2.5")
    && isV19FreeImageCreditPackPackageId(params.packageId);
}

export function isV24ImageCreditPackCheckout(params: {
  checkoutType?: string;
  packageId: BillingPackageId;
  pricingVariant?: PricingVariant;
}): boolean {
  return params.checkoutType === IMAGE_CREDIT_PACK_CHECKOUT_TYPE
    && params.pricingVariant === "2.4"
    && isV24ImageCreditPackPackageId(params.packageId);
}

export function resolveImageCreditPackPricingVariant(params: {
  checkoutType?: string;
  packageId: BillingPackageId;
  checkoutPricingVariant?: PricingVariant;
  packagePricingVariant: PricingVariant;
}): PricingVariant {
  if (params.checkoutPricingVariant && isV19ImageCreditPackCheckout({
    checkoutType: params.checkoutType,
    packageId: params.packageId,
    pricingVariant: params.checkoutPricingVariant
  })) {
    return params.checkoutPricingVariant;
  }

  return params.packagePricingVariant;
}
