import type { BillingPackageId, PricingVariant, UserPlan } from "@/lib/billing/catalog";

export const VIDEO_CREDIT_PACK_CHECKOUT_TYPE = "video_credit_pack" as const;

export const VIDEO_CREDIT_PACKS = [
  {
    packageId: "video_credit_pack_2000_v20",
    credits: 2_000,
    usdAmount: 19.99
  },
  {
    packageId: "video_credit_pack_6000_v20",
    credits: 6_000,
    usdAmount: 39.99
  },
  {
    packageId: "video_credit_pack_20000_v20",
    credits: 20_000,
    usdAmount: 99.99
  }
] as const satisfies ReadonlyArray<{
  packageId: BillingPackageId;
  credits: number;
  usdAmount: number;
}>;

export const V25_VIDEO_CREDIT_PACKS = [
  { packageId: "video_credit_pack_1500_v25", credits: 1500, usdAmount: 19.99 },
  { packageId: "video_credit_pack_5000_v25", credits: 5000, usdAmount: 39.99 }
] as const satisfies ReadonlyArray<{ packageId: BillingPackageId; credits: number; usdAmount: number }>;

export const V24_VIDEO_CREDIT_PACKS = [
  {
    packageId: "image_credit_pack_500_v24",
    credits: 1_000,
    usdAmount: 29.99,
    estimatedVideos: 10
  },
  {
    packageId: "image_credit_pack_2000_v24",
    credits: 3_000,
    usdAmount: 49.99,
    estimatedVideos: 30
  },
  {
    packageId: "image_credit_pack_10000_v24",
    credits: 10_000,
    usdAmount: 89.99,
    estimatedVideos: 100
  }
] as const satisfies ReadonlyArray<{
  packageId: BillingPackageId;
  credits: number;
  usdAmount: number;
  estimatedVideos: number;
}>;

// Keep the 20,000-credit package recognized for existing and in-flight
// checkouts, while directing new high-volume purchases through sales.
export const SELF_SERVE_VIDEO_CREDIT_PACKS = VIDEO_CREDIT_PACKS.filter(
  (pack) => pack.packageId !== "video_credit_pack_20000_v20"
);

export type VideoCreditPackPackageId =
  | (typeof VIDEO_CREDIT_PACKS)[number]["packageId"]
  | (typeof V25_VIDEO_CREDIT_PACKS)[number]["packageId"]
  | (typeof V24_VIDEO_CREDIT_PACKS)[number]["packageId"];

export const V24_VIDEO_CREDIT_PACK_CURRENT_VIDEO_COST = 100;

export function isV24VideoCreditPackPackageId(value: BillingPackageId): value is (typeof V24_VIDEO_CREDIT_PACKS)[number]["packageId"] {
  return V24_VIDEO_CREDIT_PACKS.some((pack) => pack.packageId === value);
}

export function isVideoCreditPackPricingVariant(value: PricingVariant): value is "1.9" | "2.0" | "2.1" | "2.2" | "2.3" | "2.4" | "2.5" {
  return value === "1.9"
    || value === "2.0"
    || value === "2.1"
    || value === "2.2"
    || value === "2.3"
    || value === "2.4"
    || value === "2.5";
}

export function shouldShowAccountUpgradeCreditPackEntry(params: {
  isLoggedIn: boolean;
  accountPlan: UserPlan;
  pricingVariant: PricingVariant;
}): boolean {
  return params.isLoggedIn
    && params.accountPlan !== "free"
    && isVideoCreditPackPricingVariant(params.pricingVariant);
}

export function isVideoCreditPackPackageId(value: BillingPackageId): value is VideoCreditPackPackageId {
  return [...VIDEO_CREDIT_PACKS, ...V25_VIDEO_CREDIT_PACKS].some((pack) => pack.packageId === value)
    || isV24VideoCreditPackPackageId(value);
}

export function isSelfServeVideoCreditPackPackageId(value: BillingPackageId): boolean {
  return [...SELF_SERVE_VIDEO_CREDIT_PACKS, ...V25_VIDEO_CREDIT_PACKS].some((pack) => pack.packageId === value)
    || isV24VideoCreditPackPackageId(value);
}

export function resolveVideoCreditPackAmount(packageId: BillingPackageId): number | undefined {
  return [...VIDEO_CREDIT_PACKS, ...V25_VIDEO_CREDIT_PACKS].find((pack) => pack.packageId === packageId)?.credits
    ?? V24_VIDEO_CREDIT_PACKS.find((pack) => pack.packageId === packageId)?.credits;
}

export function isV24VideoCreditPackCheckout(params: {
  checkoutType?: string;
  packageId: BillingPackageId;
  pricingVariant?: PricingVariant;
}): boolean {
  return params.checkoutType === VIDEO_CREDIT_PACK_CHECKOUT_TYPE
    && params.pricingVariant === "2.4"
    && isV24VideoCreditPackPackageId(params.packageId);
}

export function resolveVideoCreditPackPricingVariant(params: {
  checkoutType?: string;
  packageId: BillingPackageId;
  checkoutPricingVariant?: PricingVariant;
  packagePricingVariant: PricingVariant;
}): PricingVariant {
  if (
    isVideoCreditPackCheckout(params)
    && params.checkoutPricingVariant
    && isVideoCreditPackPricingVariant(params.checkoutPricingVariant)
  ) {
    return params.checkoutPricingVariant;
  }

  return params.packagePricingVariant;
}

export function resolveVideoCreditPackResultPlan(params: {
  checkoutType?: string;
  packageId: BillingPackageId;
  accountPlan: UserPlan;
  packagePlan: UserPlan;
}): UserPlan {
  return isVideoCreditPackCheckout(params) ? params.accountPlan : params.packagePlan;
}

export function isVideoCreditPackCheckout(params: {
  checkoutType?: string;
  packageId: BillingPackageId;
}): boolean {
  return params.checkoutType === VIDEO_CREDIT_PACK_CHECKOUT_TYPE
    && isVideoCreditPackPackageId(params.packageId);
}
