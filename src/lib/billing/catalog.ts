export type UserPlan = "free" | "basic" | "pro" | "max";
export const SUPPORTED_PRICING_VARIANTS = ["1.0", "1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8", "1.9", "2.0", "2.1", "2.2", "2.3", "2.4", "2.5"] as const;
export const PRICING_EXPERIMENT_V15_DISCOUNT_REQUEST = "PRICING_EXPERIMENT_V15";
const LEGACY_PRICING_VARIANT_MAP = {
  A: "1.0",
  B: "1.1",
  C: "1.2"
} as const;

export type PricingVariant = (typeof SUPPORTED_PRICING_VARIANTS)[number];

export function resolveDefaultSubscriptionCheckoutPlan(variant: PricingVariant): "basic" | "pro" {
  return variant === "2.4" ? "basic" : "pro";
}

export function resolvePricingCatalogVariant(variant: PricingVariant): PricingVariant {
  return variant === "2.3" ? "1.9" : variant;
}
export type BillingPackageKind = "subscription" | "one_time";
export type BillingPackageId =
  | "pro_monthly"
  | "max_monthly"
  | "starter_pack_b"
  | "pro_monthly_b"
  | "max_monthly_b"
  | "starter_pack_c"
  | "pro_monthly_c"
  | "max_monthly_c"
  | "starter_pack_v13"
  | "pro_monthly_v13"
  | "max_monthly_v13"
  | "pro_monthly_v14"
  | "max_monthly_v14"
  | "starter_pack_v15"
  | "pro_monthly_v15"
  | "max_monthly_v15"
  | "starter_pack_v16"
  | "pro_monthly_v16"
  | "max_monthly_v16"
  | "starter_pack_v17"
  | "pro_monthly_v17"
  | "pro_annual_v17"
  | "max_monthly_v17"
  | "max_annual_v17"
  | "starter_pack_v18"
  | "pro_monthly_v18"
  | "pro_annual_v18"
  | "max_monthly_v18"
  | "max_annual_v18"
  | "pro_monthly_v25"
  | "pro_annual_v25"
  | "max_monthly_v25"
  | "max_annual_v25"
  | "pro_monthly_v19"
  | "pro_annual_v19"
  | "max_monthly_v19"
  | "max_annual_v19"
  | "image_credit_pack_1500_v25"
  | "image_credit_pack_1000_v19"
  | "image_credit_pack_5000_v25"
  | "image_credit_pack_3000_v19"
  | "starter_pack_1_v20"
  | "starter_pack_10_v20"
  | "starter_pack_100_v20"
  | "starter_pack_1000_v20"
  | "video_credit_pack_1500_v25"
  | "video_credit_pack_2000_v20"
  | "video_credit_pack_5000_v25"
  | "video_credit_pack_6000_v20"
  | "video_credit_pack_20000_v20"
  | "pro_monthly_v20"
  | "pro_annual_v20"
  | "max_monthly_v20"
  | "max_annual_v20"
  | "basic_monthly_v21"
  | "basic_annual_v21"
  | "pro_monthly_v21"
  | "pro_annual_v21"
  | "max_monthly_v21"
  | "max_annual_v21"
  | "basic_monthly_v22"
  | "basic_annual_v22"
  | "pro_monthly_v22"
  | "pro_annual_v22"
  | "max_monthly_v22"
  | "max_annual_v22"
  | "basic_monthly_v24"
  | "basic_annual_v24"
  | "pro_monthly_v24"
  | "pro_annual_v24"
  | "max_monthly_v24"
  | "max_annual_v24"
  | "image_credit_pack_500_v24"
  | "image_credit_pack_2000_v24"
  | "image_credit_pack_10000_v24"
  | "video_unlock_single"
  | "video_basic_v1"
  | "video_standard_v1"
  | "video_ultimate_v1"
  | "video_basic_annual_v1"
  | "video_standard_annual_v1"
  | "video_ultimate_annual_v1";
export type CheckoutPlan = "starter" | "basic" | "pro" | "max";

export type BillingPackage = {
  id: BillingPackageId;
  pricingVariant: PricingVariant;
  kind: BillingPackageKind;
  plan: UserPlan;
  checkoutPlan: CheckoutPlan;
  title: string;
  name: string;
  usdAmount: number;
  currency: "USD";
  credits: number;
  interval?: "month" | "year";
  productEnvKey: string;
  activeForNewCheckout: boolean;
  featured?: boolean;
  label?: string;
  cta: string;
  description: string;
  note: string;
  imageCountLabel: string;
  features: string[];
  modalSub: string;
  modalBadge?: string;
  modalValueTag?: string;
  discountPercent?: number;
  discountRequestCode?: string;
};

export type PublicBillingPackage = Omit<BillingPackage, "productEnvKey">;

export const DEFAULT_PRICING_VARIANT: PricingVariant = "1.9";
export const PRICING_EXPERIMENT_KEY = "pricing_experiment_v1";
export const PRICING_EXPERIMENT_COOKIE = "vismuse_pricing_experiment_v1";

export const BILLING_PACKAGES: readonly BillingPackage[] = [
  {
    id: "image_credit_pack_1500_v25",
    pricingVariant: "2.5",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "1,500 Image Credits",
    name: "1,500 credits",
    usdAmount: 19.99,
    currency: "USD",
    credits: 1_500,
    productEnvKey: "CREEM_PRODUCT_ID_IMAGE_CREDIT_PACK_1500_V25",
    activeForNewCheckout: false,
    label: "One-time",
    cta: "Buy credits",
    description: "A one-year credit pack for up to about 150 HD images.",
    note: "Grants 1,500 credits and uses 10 credits to unlock the current image",
    imageCountLabel: "≈ 150 images",
    modalSub: "For up to about 150 HD image exports without a subscription.",
    modalBadge: "≈ 150 images",
    features: [
      "1,500 paid credits, including the current image unlock",
      "Up to about 150 HD images total",
      "Credits valid for one year",
      "Commercial use included"
    ]
  },
  {
    id: "image_credit_pack_5000_v25",
    pricingVariant: "2.5",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "5,000 Image Credits",
    name: "5,000 credits",
    usdAmount: 39.99,
    currency: "USD",
    credits: 5_000,
    productEnvKey: "CREEM_PRODUCT_ID_IMAGE_CREDIT_PACK_5000_V25",
    activeForNewCheckout: false,
    label: "Best value",
    cta: "Buy credits",
    description: "A one-year credit pack for up to about 500 HD images.",
    note: "Grants 5,000 credits and uses 10 credits to unlock the current image",
    imageCountLabel: "≈ 500 images",
    modalSub: "Best value for up to about 500 HD image exports without a subscription.",
    modalBadge: "≈ 500 images",
    features: [
      "5,000 paid credits, including the current image unlock",
      "Up to about 500 HD images total",
      "Credits valid for one year",
      "Commercial use included"
    ]
  },
  {
    id: "video_credit_pack_1500_v25",
    pricingVariant: "2.5",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "1,500 credits",
    name: "1,500 video credits",
    usdAmount: 19.99,
    currency: "USD",
    credits: 1_500,
    productEnvKey: "CREEM_PRODUCT_ID_VIDEO_CREDIT_PACK_1500_V25",
    activeForNewCheckout: false,
    label: "One-time",
    cta: "Buy video credits",
    description: "One-year credits for AI video generation.",
    note: "1,500 video credits valid for one year, no subscription required for this top-up",
    imageCountLabel: "1,500 video credits",
    modalSub: "For paid members who need more AI video generation credits.",
    features: [
      "1,500 video credits valid for one year",
      "Expires one year after purchase",
      "Use with all supported video models",
      "Available to paid members"
    ]
  },
  {
    id: "video_credit_pack_5000_v25",
    pricingVariant: "2.5",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "5,000 credits",
    name: "5,000 video credits",
    usdAmount: 39.99,
    currency: "USD",
    credits: 5_000,
    productEnvKey: "CREEM_PRODUCT_ID_VIDEO_CREDIT_PACK_5000_V25",
    activeForNewCheckout: false,
    label: "Best value",
    cta: "Buy video credits",
    description: "One-year credits for more AI video generation.",
    note: "5,000 video credits valid for one year, no subscription required for this top-up",
    imageCountLabel: "5,000 video credits",
    modalSub: "Best value for paid members creating videos regularly.",
    modalBadge: "Best value",
    features: [
      "5,000 video credits valid for one year",
      "Expires one year after purchase",
      "Use with all supported video models",
      "Available to paid members"
    ]
  },
  {
    id: "pro_monthly",
    pricingVariant: "1.0",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Monthly",
    name: "Pro",
    usdAmount: 9.9,
    currency: "USD",
    credits: 5000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_PRO",
    activeForNewCheckout: true,
    featured: true,
    label: "Recommended",
    cta: "Get pro",
    description: "For growing creators producing visuals every month.",
    note: "5,000 credits/month ≈ 500 images",
    imageCountLabel: "≈ 500 images",
    modalSub: "For growing creators producing visuals every month.",
    features: [
      "5,000 credits/month, cancel anytime",
      "Up to ~500 HD images",
      "No watermarks, with 2K/4K exports",
      "Keep refining and generate more versions in one run",
      "Cloud storage keeps your data permanently stored."
    ]
  },
  {
    id: "max_monthly",
    pricingVariant: "1.0",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Monthly",
    name: "Max",
    usdAmount: 19.9,
    currency: "USD",
    credits: 20000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_MAX",
    activeForNewCheckout: true,
    label: "Best value",
    cta: "Get Max",
    description: "For teams and power users creating at full scale.",
    note: "20,000 credits/month ≈ 2000 images",
    imageCountLabel: "≈ 2000 images",
    modalSub: "For teams and power users creating at full scale.",
    modalBadge: "Best value",
    modalValueTag: "4x more images",
    features: [
      "20,000 credits per month, cancel anytime",
      "Up to ~2000 HD images",
      "Includes all Pro features",
      "Faster, higher-quality generation",
      "Early access to new features"
    ]
  },
  {
    id: "starter_pack_b",
    pricingVariant: "1.1",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "Starter Pack",
    name: "Starter",
    usdAmount: 6.99,
    currency: "USD",
    credits: 200,
    productEnvKey: "CREEM_PRODUCT_ID_STARTER_PACK_B",
    activeForNewCheckout: true,
    label: "One-time",
    cta: "Get started",
    description: "For first-timers bringing a small idea to life.",
    note: "200 credits ≈ 20 images",
    imageCountLabel: "≈ 20 images",
    modalSub: "For first-timers bringing a small idea to life.",
    features: [
      "200 one-time credits, no subscription",
      "Up to ~20 HD images",
      "Refine images with the Vismuse agent",
      "Commercial use included"
    ]
  },
  {
    id: "pro_monthly_b",
    pricingVariant: "1.1",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Monthly",
    name: "Pro",
    usdAmount: 14.99,
    currency: "USD",
    credits: 2000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_PRO_B",
    activeForNewCheckout: true,
    featured: true,
    label: "Recommended",
    cta: "Get pro",
    description: "For growing creators producing visuals every month.",
    note: "2,000 credits/month ≈ 200 images",
    imageCountLabel: "≈ 200 images",
    modalSub: "For growing creators producing visuals every month.",
    features: [
      "2,000 credits/month, cancel anytime",
      "Up to ~200 HD images",
      "No watermarks, with 2K/4K exports",
      "Keep refining and generate more versions in one run",
      "Cloud storage keeps your data permanently stored."
    ]
  },
  {
    id: "max_monthly_b",
    pricingVariant: "1.1",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Monthly",
    name: "Max",
    usdAmount: 39.99,
    currency: "USD",
    credits: 10000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_MAX_B",
    activeForNewCheckout: true,
    label: "Best value",
    cta: "Get Max",
    description: "For teams and power users creating at full scale.",
    note: "10,000 credits/month ≈ 1000 images",
    imageCountLabel: "≈ 1000 images",
    modalSub: "For teams and power users creating at full scale.",
    modalBadge: "Best value",
    modalValueTag: "5x Pro",
    features: [
      "10,000 credits per month, cancel anytime",
      "Up to ~1000 HD images",
      "Includes all Pro features",
      "Faster, higher-quality generation",
      "Early access to new features"
    ]
  },
  {
    id: "starter_pack_c",
    pricingVariant: "1.2",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "Starter Pack",
    name: "Starter",
    usdAmount: 6.99,
    currency: "USD",
    credits: 200,
    productEnvKey: "CREEM_PRODUCT_ID_STARTER_PACK_B",
    activeForNewCheckout: true,
    label: "One-time",
    cta: "Get started",
    description: "For first-timers bringing a small idea to life.",
    note: "200 credits ≈ 20 images",
    imageCountLabel: "≈ 20 images",
    modalSub: "For first-timers bringing a small idea to life.",
    features: [
      "200 one-time credits, no subscription",
      "Up to ~20 HD images",
      "Refine images with the Vismuse agent",
      "Commercial use included"
    ]
  },
  {
    id: "pro_monthly_c",
    pricingVariant: "1.2",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Monthly",
    name: "Pro",
    usdAmount: 14.99,
    currency: "USD",
    credits: 2000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_PRO_B",
    activeForNewCheckout: true,
    featured: true,
    label: "Most popular",
    cta: "Get pro",
    description: "For growing creators producing visuals every month.",
    note: "2,000 credits/month ≈ 200 images",
    imageCountLabel: "≈ 200 images",
    modalSub: "For growing creators producing visuals every month.",
    features: [
      "2,000 credits/month, cancel anytime",
      "Up to ~200 HD images",
      "No watermarks, with 2K/4K exports",
      "Keep refining and generate more versions in one run",
      "Cloud storage keeps your data permanently stored."
    ]
  },
  {
    id: "max_monthly_c",
    pricingVariant: "1.2",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Monthly",
    name: "Max",
    usdAmount: 39.99,
    currency: "USD",
    credits: 10000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_MAX_B",
    activeForNewCheckout: true,
    label: "Best savings",
    cta: "Get Max",
    description: "For teams and power users creating at full scale.",
    note: "10,000 credits/month ≈ 1000 images",
    imageCountLabel: "≈ 1000 images",
    modalSub: "For teams and power users creating at full scale.",
    modalBadge: "Best savings",
    modalValueTag: "30% off",
    features: [
      "10,000 credits per month, cancel anytime",
      "Up to ~1000 HD images",
      "Includes all Pro features",
      "Faster, higher-quality generation",
      "Early access to new features"
    ]
  },
  {
    id: "starter_pack_v13",
    pricingVariant: "1.3",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "Starter Pack",
    name: "Starter",
    usdAmount: 6.99,
    currency: "USD",
    credits: 200,
    productEnvKey: "CREEM_PRODUCT_ID_STARTER_PACK_B",
    activeForNewCheckout: true,
    label: "One-time",
    cta: "Get started",
    description: "For first-timers bringing a small idea to life.",
    note: "200 credits ≈ 20 images",
    imageCountLabel: "≈ 20 images",
    modalSub: "For first-timers bringing a small idea to life.",
    features: [
      "200 one-time credits, no subscription",
      "Up to ~20 HD images",
      "Refine images with the Vismuse agent",
      "Commercial use included"
    ]
  },
  {
    id: "pro_monthly_v13",
    pricingVariant: "1.3",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Monthly",
    name: "Pro",
    usdAmount: 14.99,
    currency: "USD",
    credits: 2000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_PRO_B",
    activeForNewCheckout: true,
    featured: true,
    label: "Most popular",
    cta: "Get pro",
    description: "For growing creators producing visuals every month.",
    note: "2,000 credits/month ≈ 200 images",
    imageCountLabel: "≈ 200 images",
    modalSub: "For growing creators producing visuals every month.",
    features: [
      "2,000 credits/month, cancel anytime",
      "Up to ~200 HD images",
      "No watermarks, with 2K/4K exports",
      "Keep refining and generate more versions in one run",
      "Cloud storage keeps your data permanently stored."
    ]
  },
  {
    id: "max_monthly_v13",
    pricingVariant: "1.3",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Monthly",
    name: "Max",
    usdAmount: 39.99,
    currency: "USD",
    credits: 10000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_MAX_B",
    activeForNewCheckout: true,
    label: "5x Pro",
    cta: "Get Max",
    description: "For teams and power users creating at full scale.",
    note: "10,000 credits/month ≈ 1000 images",
    imageCountLabel: "≈ 1000 images",
    modalSub: "For teams and power users creating at full scale.",
    modalBadge: "5x Pro",
    modalValueTag: "30% off",
    features: [
      "10,000 credits per month, cancel anytime",
      "Up to ~1000 HD images",
      "Includes all Pro features",
      "Faster, higher-quality generation",
      "Early access to new features"
    ]
  },
  {
    id: "pro_monthly_v14",
    pricingVariant: "1.4",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Monthly",
    name: "Pro",
    usdAmount: 9.9,
    currency: "USD",
    credits: 2000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_PRO_V14",
    activeForNewCheckout: true,
    featured: true,
    label: "Recommended",
    cta: "Get pro",
    description: "For creators who want every generated image watermark-free.",
    note: "2,000 credits/month ≈ 200 images",
    imageCountLabel: "≈ 200 images",
    modalSub: "Remove watermarks from every image you generate.",
    features: [
      "2,000 credits/month, cancel anytime",
      "Up to ~200 HD images",
      "No watermarks, with 2K/4K exports",
      "Keep refining and generate more versions in one run",
      "Cloud storage keeps your data permanently stored."
    ]
  },
  {
    id: "max_monthly_v14",
    pricingVariant: "1.4",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Monthly",
    name: "Max",
    usdAmount: 29.9,
    currency: "USD",
    credits: 10000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_MAX_V14",
    activeForNewCheckout: true,
    label: "Best value",
    cta: "Get Max",
    description: "For teams and power users creating at full scale.",
    note: "10,000 credits/month ≈ 1000 images",
    imageCountLabel: "≈ 1000 images",
    modalSub: "For teams and power users creating at full scale.",
    modalBadge: "Best value",
    modalValueTag: "5x Pro",
    features: [
      "10,000 credits per month, cancel anytime",
      "Up to ~1000 HD images",
      "Includes all Pro features",
      "Faster, higher-quality generation",
      "Early access to new features"
    ]
  },
  {
    id: "starter_pack_v15",
    pricingVariant: "1.5",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "Starter Pack",
    name: "Starter",
    usdAmount: 6.99,
    currency: "USD",
    credits: 200,
    productEnvKey: "CREEM_PRODUCT_ID_STARTER_PACK_B",
    activeForNewCheckout: true,
    label: "One-time",
    cta: "Get started",
    description: "For first-timers bringing a small idea to life.",
    note: "200 credits ≈ 20 images",
    imageCountLabel: "≈ 20 images",
    modalSub: "For first-timers bringing a small idea to life.",
    features: [
      "200 one-time credits, no subscription",
      "Up to ~20 HD images",
      "Refine images with the Vismuse agent",
      "Commercial use included"
    ]
  },
  {
    id: "pro_monthly_v15",
    pricingVariant: "1.5",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Monthly",
    name: "Pro",
    usdAmount: 14.99,
    currency: "USD",
    credits: 2000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_PRO_B",
    activeForNewCheckout: true,
    featured: true,
    label: "Recommended",
    cta: "Get pro",
    description: "For growing creators producing visuals every month.",
    note: "2,000 credits/month ≈ 200 images",
    imageCountLabel: "≈ 200 images",
    modalSub: "For growing creators producing visuals every month.",
    discountPercent: 20,
    discountRequestCode: PRICING_EXPERIMENT_V15_DISCOUNT_REQUEST,
    features: [
      "2,000 credits/month, cancel anytime",
      "Up to ~200 HD images",
      "No watermarks, with 2K/4K exports",
      "Keep refining and generate more versions in one run",
      "Cloud storage keeps your data permanently stored."
    ]
  },
  {
    id: "max_monthly_v15",
    pricingVariant: "1.5",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Monthly",
    name: "Max",
    usdAmount: 39.99,
    currency: "USD",
    credits: 10000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_MAX_B",
    activeForNewCheckout: true,
    label: "Best value",
    cta: "Get Max",
    description: "For teams and power users creating at full scale.",
    note: "10,000 credits/month ≈ 1000 images",
    imageCountLabel: "≈ 1000 images",
    modalSub: "For teams and power users creating at full scale.",
    modalBadge: "Best value",
    modalValueTag: "4x more images",
    discountPercent: 30,
    discountRequestCode: PRICING_EXPERIMENT_V15_DISCOUNT_REQUEST,
    features: [
      "10,000 credits per month, cancel anytime",
      "Up to ~1000 HD images",
      "Includes all Pro features",
      "Faster, higher-quality generation",
      "Early access to new features"
    ]
  },
  {
    id: "starter_pack_v16",
    pricingVariant: "1.6",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "Starter Pack",
    name: "Starter",
    usdAmount: 6.99,
    currency: "USD",
    credits: 200,
    productEnvKey: "CREEM_PRODUCT_ID_STARTER_PACK_B",
    activeForNewCheckout: true,
    label: "One-time",
    cta: "Get started",
    description: "For first-timers bringing a small idea to life.",
    note: "200 credits ≈ 20 images",
    imageCountLabel: "≈ 20 images",
    modalSub: "For first-timers bringing a small idea to life.",
    features: [
      "200 one-time credits, no subscription",
      "Up to ~20 HD images",
      "Refine images with the Vismuse agent",
      "Commercial use included"
    ]
  },
  {
    id: "pro_monthly_v16",
    pricingVariant: "1.6",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Monthly",
    name: "Pro",
    usdAmount: 14.99,
    currency: "USD",
    credits: 2000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_PRO_B",
    activeForNewCheckout: true,
    featured: true,
    label: "Recommended",
    cta: "Get pro",
    description: "For growing creators producing visuals every month.",
    note: "2,000 credits/month ≈ 200 images",
    imageCountLabel: "≈ 200 images",
    modalSub: "For growing creators producing visuals every month.",
    discountPercent: 20,
    discountRequestCode: PRICING_EXPERIMENT_V15_DISCOUNT_REQUEST,
    features: [
      "2,000 credits/month, cancel anytime",
      "Up to ~200 HD images",
      "No watermarks, with 2K/4K exports",
      "Keep refining and generate more versions in one run",
      "Cloud storage keeps your data permanently stored."
    ]
  },
  {
    id: "max_monthly_v16",
    pricingVariant: "1.6",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Monthly",
    name: "Max",
    usdAmount: 39.99,
    currency: "USD",
    credits: 10000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_MAX_B",
    activeForNewCheckout: true,
    label: "Best value",
    cta: "Get Max",
    description: "For teams and power users creating at full scale.",
    note: "10,000 credits/month ≈ 1000 images",
    imageCountLabel: "≈ 1000 images",
    modalSub: "For teams and power users creating at full scale.",
    modalBadge: "Best value",
    modalValueTag: "4x more images",
    discountPercent: 30,
    discountRequestCode: PRICING_EXPERIMENT_V15_DISCOUNT_REQUEST,
    features: [
      "10,000 credits per month, cancel anytime",
      "Up to ~1000 HD images",
      "Includes all Pro features",
      "Faster, higher-quality generation",
      "Early access to new features"
    ]
  },
  {
    id: "starter_pack_v17",
    pricingVariant: "1.7",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "Starter Pack",
    name: "Starter",
    usdAmount: 6.99,
    currency: "USD",
    credits: 200,
    productEnvKey: "CREEM_PRODUCT_ID_STARTER_PACK_B",
    activeForNewCheckout: false,
    label: "One-time",
    cta: "Get started",
    description: "For first-timers bringing a small idea to life.",
    note: "200 credits ≈ 20 images",
    imageCountLabel: "≈ 20 images",
    modalSub: "For first-timers bringing a small idea to life.",
    features: [
      "200 one-time credits, no subscription",
      "Up to ~20 HD images",
      "Refine images with the Vismuse agent",
      "Commercial use included"
    ]
  },
  {
    id: "pro_monthly_v17",
    pricingVariant: "1.7",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Monthly",
    name: "Pro",
    usdAmount: 14.99,
    currency: "USD",
    credits: 2000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_PRO_B",
    activeForNewCheckout: true,
    featured: true,
    label: "Monthly",
    cta: "Get pro monthly",
    description: "For growing creators producing visuals every month.",
    note: "2,000 credits/month ≈ 200 images",
    imageCountLabel: "≈ 200 images/month",
    modalSub: "For growing creators producing visuals every month.",
    features: [
      "2,000 credits/month, cancel anytime",
      "Up to ~200 HD images or ~10 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Failed generations auto-refunded"
    ]
  },
  {
    id: "pro_annual_v17",
    pricingVariant: "1.7",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Annual",
    name: "Pro",
    usdAmount: 119.88,
    currency: "USD",
    credits: 24000,
    interval: "year",
    productEnvKey: "CREEM_PRODUCT_ID_PRO_ANNUAL_V17",
    activeForNewCheckout: true,
    featured: true,
    label: "Annual",
    cta: "Get pro annual",
    description: "For regular creators who want a lower yearly rate.",
    note: "2,000 credits/month ≈ 200 images",
    imageCountLabel: "≈ 200 images/month",
    modalSub: "Annual Pro for ongoing visual creation.",
    modalBadge: "Save $60",
    features: [
      "2,000 credits/month, billed annually",
      "Up to ~200 HD images or ~10 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Failed generations auto-refunded"
    ]
  },
  {
    id: "max_monthly_v17",
    pricingVariant: "1.7",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Monthly",
    name: "Max",
    usdAmount: 39.99,
    currency: "USD",
    credits: 10000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_MAX_B",
    activeForNewCheckout: true,
    label: "Monthly",
    cta: "Get Max monthly",
    description: "For teams and power users creating at full scale.",
    note: "10,000 credits/month ≈ 1,000 images",
    imageCountLabel: "≈ 1,000 images/month",
    modalSub: "For teams and power users creating at full scale.",
    features: [
      "10,000 credits per month, cancel anytime",
      "Up to ~1,000 HD images or ~50 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Higher priority for faster generation"
    ]
  },
  {
    id: "max_annual_v17",
    pricingVariant: "1.7",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Annual",
    name: "Max",
    usdAmount: 239.88,
    currency: "USD",
    credits: 120000,
    interval: "year",
    productEnvKey: "CREEM_PRODUCT_ID_MAX_ANNUAL_V17",
    activeForNewCheckout: true,
    label: "Annual",
    cta: "Get Max annual",
    description: "For high-volume creators who want the best yearly rate.",
    note: "10,000 credits/month ≈ 1,000 images",
    imageCountLabel: "≈ 1,000 images/month",
    modalSub: "Annual Max for high-volume visual production.",
    modalBadge: "Save $240",
    features: [
      "10,000 credits per month, billed annually",
      "Up to ~1,000 HD images or ~50 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Higher priority for faster generation"
    ]
  },
  {
    id: "starter_pack_v18",
    pricingVariant: "1.8",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "Starter Pack",
    name: "Starter",
    usdAmount: 6.99,
    currency: "USD",
    credits: 200,
    productEnvKey: "CREEM_PRODUCT_ID_STARTER_PACK_B",
    activeForNewCheckout: false,
    label: "One-time",
    cta: "Get started",
    description: "For first-timers bringing a small idea to life.",
    note: "200 credits ≈ 20 images",
    imageCountLabel: "≈ 20 images",
    modalSub: "For first-timers bringing a small idea to life.",
    features: [
      "200 one-time credits, no subscription",
      "Up to ~20 HD images",
      "Refine images with the Vismuse agent",
      "Commercial use included"
    ]
  },
  {
    id: "pro_monthly_v18",
    pricingVariant: "1.8",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Monthly",
    name: "Pro",
    usdAmount: 14.99,
    currency: "USD",
    credits: 2000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_PRO_B",
    activeForNewCheckout: true,
    featured: true,
    label: "Recommended",
    cta: "Get pro monthly",
    description: "For growing creators producing visuals every month.",
    note: "2,000 credits/month ≈ 200 images",
    imageCountLabel: "≈ 200 images/month",
    modalSub: "For growing creators producing visuals every month.",
    features: [
      "2,000 credits/month, cancel anytime",
      "Up to ~200 HD images or ~10 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Failed generations auto-refunded"
    ]
  },
  {
    id: "pro_annual_v18",
    pricingVariant: "1.8",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Annual",
    name: "Pro",
    usdAmount: 143.9,
    currency: "USD",
    credits: 24000,
    interval: "year",
    productEnvKey: "CREEM_PRODUCT_ID_PRO_ANNUAL_V17",
    activeForNewCheckout: true,
    featured: true,
    label: "Annual",
    cta: "Get pro annual",
    description: "For regular creators who want a lower yearly rate.",
    note: "2,000 credits/month ≈ 200 images",
    imageCountLabel: "≈ 200 images/month",
    modalSub: "Annual Pro for ongoing visual creation.",
    modalBadge: "Save $36",
    features: [
      "2,000 credits/month, billed annually",
      "Up to ~200 HD images or ~10 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Failed generations auto-refunded"
    ]
  },
  {
    id: "max_monthly_v18",
    pricingVariant: "1.8",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Monthly",
    name: "Max",
    usdAmount: 39.99,
    currency: "USD",
    credits: 10000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_MAX_B",
    activeForNewCheckout: true,
    label: "5x credits",
    cta: "Get Max monthly",
    description: "For teams and power users creating at full scale.",
    note: "10,000 credits/month ≈ 1,000 images",
    imageCountLabel: "≈ 1,000 images/month",
    modalSub: "For teams and power users creating at full scale.",
    modalBadge: "5x credits",
    features: [
      "10,000 credits per month, cancel anytime",
      "Up to ~1,000 HD images/month",
      "Includes all Pro features",
      "Faster, higher-quality generation",
      "Early access to new features"
    ]
  },
  {
    id: "max_annual_v18",
    pricingVariant: "1.8",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Annual",
    name: "Max",
    usdAmount: 395.88,
    currency: "USD",
    credits: 120000,
    interval: "year",
    productEnvKey: "CREEM_PRODUCT_ID_MAX_ANNUAL_V17",
    activeForNewCheckout: true,
    label: "Annual",
    cta: "Get Max annual",
    description: "For high-volume creators who want the best yearly rate.",
    note: "10,000 credits/month ≈ 1,000 images",
    imageCountLabel: "≈ 1,000 images/month",
    modalSub: "Annual Max for high-volume visual production.",
    modalBadge: "5x credits",
    features: [
      "10,000 credits per month, billed annually",
      "Up to ~1,000 HD images/month",
      "Includes all Pro features",
      "Faster, higher-quality generation",
      "Early access to new features"
    ]
  },
  {
    id: "pro_monthly_v19",
    pricingVariant: "1.9",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Monthly",
    name: "Pro",
    usdAmount: 19.99,
    currency: "USD",
    credits: 2000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_PRO_V19",
    activeForNewCheckout: true,
    featured: true,
    label: "Monthly",
    cta: "Get pro monthly",
    description: "For growing creators producing visuals every month.",
    note: "2,000 credits/month ≈ 200 images",
    imageCountLabel: "≈ 200 images/month",
    modalSub: "For growing creators producing visuals every month.",
    modalBadge: "Recommended",
    features: [
      "2,000 credits/month, cancel anytime",
      "Up to ~200 HD images or ~10 videos/month",
      "Export in 2K & 4K",
      "Export as PDF, PNG & JPG",
      "Commercial use included",
      "Failed generations auto-refunded"
    ]
  },
  {
    id: "pro_annual_v19",
    pricingVariant: "1.9",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Annual",
    name: "Pro",
    usdAmount: 119.88,
    currency: "USD",
    credits: 24000,
    interval: "year",
    productEnvKey: "CREEM_PRODUCT_ID_PRO_ANNUAL_V19",
    activeForNewCheckout: true,
    featured: true,
    label: "Annual",
    cta: "Get pro annual",
    description: "For regular creators who want a lower yearly rate.",
    note: "2,000 credits/month ≈ 200 images",
    imageCountLabel: "≈ 200 images/month",
    modalSub: "Annual Pro for ongoing visual creation.",
    modalBadge: "Save $120",
    features: [
      "2,000 credits/month, billed annually",
      "Up to ~200 HD images or ~10 videos/month",
      "Export in 2K & 4K",
      "Export as PDF, PNG & JPG",
      "Commercial use included",
      "Failed generations auto-refunded"
    ]
  },
  {
    id: "max_monthly_v19",
    pricingVariant: "1.9",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Monthly",
    name: "Max",
    usdAmount: 79.99,
    currency: "USD",
    credits: 20000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_MAX_V19",
    activeForNewCheckout: true,
    label: "Monthly",
    cta: "Get Max monthly",
    description: "For teams and power users creating at full scale.",
    note: "20,000 credits/month ≈ 2,000 images or 100 videos",
    imageCountLabel: "≈ 2,000 images/month",
    modalSub: "For teams and power users creating at full scale.",
    modalBadge: "10× Credits",
    features: [
      "20,000 credits per month, cancel anytime",
      "Up to ~2,000 HD images or ~100 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Higher priority for faster generation"
    ]
  },
  {
    id: "max_annual_v19",
    pricingVariant: "1.9",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Annual",
    name: "Max",
    usdAmount: 479.88,
    currency: "USD",
    credits: 240000,
    interval: "year",
    productEnvKey: "CREEM_PRODUCT_ID_MAX_ANNUAL_V19",
    activeForNewCheckout: true,
    label: "Annual",
    cta: "Get Max annual",
    description: "For high-volume creators who want the best yearly rate.",
    note: "20,000 credits/month ≈ 2,000 images or 100 videos",
    imageCountLabel: "≈ 2,000 images/month",
    modalSub: "Annual Max for high-volume visual production.",
    modalBadge: "Save $480",
    features: [
      "20,000 credits per month, billed annually",
      "Up to ~2,000 HD images or ~100 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Higher priority for faster generation"
    ]
  },
  {
    id: "pro_monthly_v25",
    pricingVariant: "2.5",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Monthly",
    name: "Pro",
    usdAmount: 19.99,
    currency: "USD",
    credits: 1500,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_PRO_V25",
    activeForNewCheckout: true,
    featured: true,
    label: "Monthly",
    modalBadge: "Recommended",
    cta: "Get pro monthly",
    description: "For growing creators producing visuals every month.",
    note: "1,500 credits/month ≈ 150 images",
    imageCountLabel: "≈ 150 images/month",
    modalSub: "For growing creators producing visuals every month.",
    features: [
      "1,500 credits/month, cancel anytime",
      "Up to ~150 1K images or ~15 videos/month (720p, 5 seconds)",
      "Export in 2K & 4K",
      "Export as PDF, PNG & JPG",
      "Commercial use included",
      "Failed generations auto-refunded"
    ]
  },
  {
    id: "pro_annual_v25",
    pricingVariant: "2.5",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Annual",
    name: "Pro",
    usdAmount: 179.88,
    currency: "USD",
    credits: 18000,
    interval: "year",
    productEnvKey: "CREEM_PRODUCT_ID_PRO_ANNUAL_V25",
    activeForNewCheckout: true,
    featured: true,
    label: "Save $60",
    cta: "Get pro annual",
    description: "For regular creators who want a lower yearly rate.",
    note: "1,500 credits/month ≈ 150 images",
    imageCountLabel: "≈ 150 images/month",
    modalSub: "Annual Pro for ongoing visual creation.",
    modalBadge: "Save $60",
    modalValueTag: "Save $60",
    features: [
      "1,500 credits/month, billed annually",
      "Up to ~150 1K images or ~15 videos/month (720p, 5 seconds)",
      "Export in 2K & 4K",
      "Export as PDF, PNG & JPG",
      "Commercial use included",
      "Failed generations auto-refunded"
    ]
  },
  {
    id: "max_monthly_v25",
    pricingVariant: "2.5",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Monthly",
    name: "Max",
    usdAmount: 49.99,
    currency: "USD",
    credits: 6000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_MAX_V25",
    activeForNewCheckout: true,
    label: "Monthly",
    modalBadge: "4× Credits",
    cta: "Get Max monthly",
    description: "For teams and power users creating at full scale.",
    note: "6,000 credits/month ≈ 600 images or 60 videos",
    imageCountLabel: "≈ 600 images/month",
    modalSub: "For teams and power users creating at full scale.",
    features: [
      "6,000 credits per month, cancel anytime",
      "Up to ~600 1K images or ~60 videos/month (720p, 5 seconds)",
      "Export in 2K & 4K",
      "Commercial use included",
      "Higher priority for faster generation"
    ]
  },
  {
    id: "max_annual_v25",
    pricingVariant: "2.5",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Annual",
    name: "Max",
    usdAmount: 419.88,
    currency: "USD",
    credits: 72000,
    interval: "year",
    productEnvKey: "CREEM_PRODUCT_ID_MAX_ANNUAL_V25",
    activeForNewCheckout: true,
    label: "Save $180",
    cta: "Get Max annual",
    description: "For high-volume creators who want the best yearly rate.",
    note: "6,000 credits/month ≈ 600 images or 60 videos",
    imageCountLabel: "≈ 600 images/month",
    modalSub: "Annual Max for high-volume visual production.",
    modalBadge: "Save $180",
    modalValueTag: "Save $180",
    features: [
      "6,000 credits per month, billed annually",
      "Up to ~600 1K images or ~60 videos/month (720p, 5 seconds)",
      "Export in 2K & 4K",
      "Commercial use included",
      "Higher priority for faster generation"
    ]
  },
  {
    id: "image_credit_pack_1000_v19",
    pricingVariant: "1.9",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "500 Image Credits",
    name: "500 credits",
    usdAmount: 19.99,
    currency: "USD",
    credits: 500,
    productEnvKey: "CREEM_PRODUCT_ID_IMAGE_CREDIT_PACK_1000_V19",
    activeForNewCheckout: false,
    label: "One-time",
    cta: "Buy credits",
    description: "A one-year credit pack for up to about 50 HD images.",
    note: "Grants 500 credits and uses 10 credits to unlock the current image",
    imageCountLabel: "≈ 50 images",
    modalSub: "For up to about 50 HD image exports without a subscription.",
    modalBadge: "≈ 50 images",
    features: [
      "500 paid credits, including the current image unlock",
      "Up to about 50 HD images total",
      "Credits valid for one year",
      "Commercial use included"
    ]
  },
  {
    id: "image_credit_pack_3000_v19",
    pricingVariant: "1.9",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "2,000 Image Credits",
    name: "2,000 credits",
    usdAmount: 39.99,
    currency: "USD",
    credits: 2_000,
    productEnvKey: "CREEM_PRODUCT_ID_IMAGE_CREDIT_PACK_3000_V19",
    activeForNewCheckout: false,
    label: "Best value",
    cta: "Buy credits",
    description: "A one-year credit pack for up to about 200 HD images.",
    note: "Grants 2,000 credits and uses 10 credits to unlock the current image",
    imageCountLabel: "≈ 200 images",
    modalSub: "Best value for up to about 200 HD image exports without a subscription.",
    modalBadge: "≈ 200 images",
    features: [
      "2,000 paid credits, including the current image unlock",
      "Up to about 200 HD images total",
      "Credits valid for one year",
      "Commercial use included"
    ]
  },
  {
    id: "starter_pack_1_v20",
    pricingVariant: "2.0",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "Unlock This Image",
    name: "Unlock this image",
    usdAmount: 9.99,
    currency: "USD",
    credits: 0,
    productEnvKey: "CREEM_PRODUCT_ID_IMAGE_CREDIT_PACK_1_V20",
    activeForNewCheckout: true,
    label: "One-time",
    cta: "Buy credits",
    description: "Unlock watermark-free image generation without a subscription.",
    note: "Unlocks the current image and includes 100 free credits",
    imageCountLabel: "Unlock this image",
    modalSub: "For unlocking a single HD image workflow.",
    features: [
      "Unlock the current image",
      "100 free credits for watermarked creation",
      "Refine images with the Vismuse agent",
      "Commercial use included"
    ]
  },
  {
    id: "starter_pack_10_v20",
    pricingVariant: "2.0",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "10 Image Credit Pack",
    name: "10 images",
    usdAmount: 19.99,
    currency: "USD",
    credits: 90,
    productEnvKey: "CREEM_PRODUCT_ID_IMAGE_CREDIT_PACK_10_V20",
    activeForNewCheckout: true,
    label: "One-time",
    cta: "Buy credits",
    description: "A small credit pack for several watermark-free images.",
    note: "Unlocks the current image, plus 90 paid credits and 100 free credits",
    imageCountLabel: "10 image pack",
    modalSub: "For several HD image exports without a subscription.",
    features: [
      "90 paid credits, no subscription",
      "100 free credits for watermarked creation",
      "Unlock HD watermark-free images",
      "Commercial use included"
    ]
  },
  {
    id: "starter_pack_100_v20",
    pricingVariant: "2.0",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "100 Image Credit Pack",
    name: "100 images",
    usdAmount: 39.99,
    currency: "USD",
    credits: 990,
    productEnvKey: "CREEM_PRODUCT_ID_IMAGE_CREDIT_PACK_100_V20",
    activeForNewCheckout: true,
    label: "Best value",
    cta: "Buy credits",
    description: "The best-value credit pack for watermark-free image batches.",
    note: "Unlocks the current image, plus 990 paid credits and 200 free credits",
    imageCountLabel: "100 image pack",
    modalSub: "Best value for batches of HD image exports.",
    modalBadge: "Best value",
    features: [
      "990 paid credits, no subscription",
      "200 free credits for watermarked creation",
      "Unlock HD watermark-free images",
      "Commercial use included"
    ]
  },
  {
    id: "starter_pack_1000_v20",
    pricingVariant: "2.0",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "1000 Image Credit Pack",
    name: "1000 images",
    usdAmount: 99.99,
    currency: "USD",
    credits: 9990,
    productEnvKey: "CREEM_PRODUCT_ID_IMAGE_CREDIT_PACK_1000_V20",
    activeForNewCheckout: true,
    label: "Largest pack",
    cta: "Buy credits",
    description: "A high-volume credit pack for watermark-free image creation.",
    note: "Unlocks the current image, plus 9,990 paid credits and 500 free credits",
    imageCountLabel: "1000 image pack",
    modalSub: "For high-volume HD image workflows.",
    modalBadge: "Largest pack",
    features: [
      "9,990 paid credits, no subscription",
      "500 free credits for watermarked creation",
      "Unlock HD watermark-free images",
      "Commercial use included"
    ]
  },
  {
    id: "video_credit_pack_2000_v20",
    pricingVariant: "2.0",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "2,000 credits",
    name: "2,000 video credits",
    usdAmount: 19.99,
    currency: "USD",
    credits: 2_000,
    productEnvKey: "CREEM_PRODUCT_ID_VIDEO_CREDIT_PACK_2000_V20",
    activeForNewCheckout: false,
    label: "One-time",
    cta: "Buy video credits",
    description: "One-year credits for AI video generation.",
    note: "2,000 video credits valid for one year, no subscription required for this top-up",
    imageCountLabel: "2,000 video credits",
    modalSub: "For paid members who need more AI video generation credits.",
    features: [
      "2,000 video credits valid for one year",
      "Expires one year after purchase",
      "Use with all supported video models",
      "Available to paid members"
    ]
  },
  {
    id: "video_credit_pack_6000_v20",
    pricingVariant: "2.0",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "6,000 credits",
    name: "6,000 video credits",
    usdAmount: 39.99,
    currency: "USD",
    credits: 6_000,
    productEnvKey: "CREEM_PRODUCT_ID_VIDEO_CREDIT_PACK_6000_V20",
    activeForNewCheckout: false,
    label: "Best value",
    cta: "Buy video credits",
    description: "One-year credits for more AI video generation.",
    note: "6,000 video credits valid for one year, no subscription required for this top-up",
    imageCountLabel: "6,000 video credits",
    modalSub: "Best value for paid members creating videos regularly.",
    modalBadge: "Best value",
    features: [
      "6,000 video credits valid for one year",
      "Expires one year after purchase",
      "Use with all supported video models",
      "Available to paid members"
    ]
  },
  {
    id: "video_credit_pack_20000_v20",
    pricingVariant: "2.0",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "20,000 credits",
    name: "20,000 video credits",
    usdAmount: 99.99,
    currency: "USD",
    credits: 20_000,
    productEnvKey: "CREEM_PRODUCT_ID_VIDEO_CREDIT_PACK_20000_V20",
    activeForNewCheckout: false,
    label: "Largest pack",
    cta: "Buy video credits",
    description: "One-year credits for high-volume AI video generation.",
    note: "20,000 video credits valid for one year, no subscription required for this top-up",
    imageCountLabel: "20,000 video credits",
    modalSub: "For paid members with high-volume video creation needs.",
    modalBadge: "Largest pack",
    features: [
      "20,000 video credits valid for one year",
      "Expires one year after purchase",
      "Use with all supported video models",
      "Available to paid members"
    ]
  },
  {
    id: "pro_monthly_v20",
    pricingVariant: "2.0",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Monthly",
    name: "Pro",
    usdAmount: 19.99,
    currency: "USD",
    credits: 2000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_PRO_V19",
    activeForNewCheckout: true,
    featured: true,
    label: "Monthly",
    cta: "Get pro monthly",
    description: "For growing creators producing visuals every month.",
    note: "2,000 credits/month ≈ 200 images",
    imageCountLabel: "≈ 200 images/month",
    modalSub: "For growing creators producing visuals every month.",
    features: [
      "2,000 credits/month, cancel anytime",
      "Up to ~200 HD images or ~10 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Failed generations auto-refunded"
    ]
  },
  {
    id: "pro_annual_v20",
    pricingVariant: "2.0",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Annual",
    name: "Pro",
    usdAmount: 119.88,
    currency: "USD",
    credits: 24000,
    interval: "year",
    productEnvKey: "CREEM_PRODUCT_ID_PRO_ANNUAL_V19",
    activeForNewCheckout: true,
    featured: true,
    label: "Annual",
    cta: "Get pro annual",
    description: "For regular creators who want a lower yearly rate.",
    note: "2,000 credits/month ≈ 200 images",
    imageCountLabel: "≈ 200 images/month",
    modalSub: "Annual Pro for ongoing visual creation.",
    modalBadge: "Save $120",
    features: [
      "2,000 credits/month, billed annually",
      "Up to ~200 HD images or ~10 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Failed generations auto-refunded"
    ]
  },
  {
    id: "max_monthly_v20",
    pricingVariant: "2.0",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Monthly",
    name: "Max",
    usdAmount: 79.99,
    currency: "USD",
    credits: 20000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_MAX_V19",
    activeForNewCheckout: true,
    label: "Monthly",
    cta: "Get Max monthly",
    description: "For teams and power users creating at full scale.",
    note: "20,000 credits/month ≈ 2,000 images or 100 videos",
    imageCountLabel: "≈ 2,000 images/month",
    modalSub: "For teams and power users creating at full scale.",
    features: [
      "20,000 credits per month, cancel anytime",
      "Up to ~2,000 HD images or ~100 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Higher priority for faster generation"
    ]
  },
  {
    id: "max_annual_v20",
    pricingVariant: "2.0",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Annual",
    name: "Max",
    usdAmount: 479.88,
    currency: "USD",
    credits: 240000,
    interval: "year",
    productEnvKey: "CREEM_PRODUCT_ID_MAX_ANNUAL_V19",
    activeForNewCheckout: true,
    label: "Annual",
    cta: "Get Max annual",
    description: "For high-volume creators who want the best yearly rate.",
    note: "20,000 credits/month ≈ 2,000 images or 100 videos",
    imageCountLabel: "≈ 2,000 images/month",
    modalSub: "Annual Max for high-volume visual production.",
    modalBadge: "Save $480",
    features: [
      "20,000 credits per month, billed annually",
      "Up to ~2,000 HD images or ~100 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Higher priority for faster generation"
    ]
  },
  {
    id: "basic_monthly_v21",
    pricingVariant: "2.1",
    kind: "subscription",
    plan: "basic",
    checkoutPlan: "basic",
    title: "Basic Monthly",
    name: "Basic",
    usdAmount: 19.99,
    currency: "USD",
    credits: 200,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_BASIC_V21",
    activeForNewCheckout: true,
    cta: "Get Basic",
    description: "For occasional image and video creation.",
    note: "Up to 20 images or 4 videos per month",
    imageCountLabel: "≈ 20 images/month",
    modalSub: "For light monthly image and video creation.",
    features: [
      "Up to 20 HD images/month",
      "Up to 4 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Cancel anytime"
    ]
  },
  {
    id: "basic_annual_v21",
    pricingVariant: "2.1",
    kind: "subscription",
    plan: "basic",
    checkoutPlan: "basic",
    title: "Basic Annual",
    name: "Basic",
    usdAmount: 119.88,
    currency: "USD",
    credits: 2400,
    interval: "year",
    productEnvKey: "CREEM_PRODUCT_ID_BASIC_ANNUAL_V21",
    activeForNewCheckout: true,
    label: "Annual",
    cta: "Get Basic annual",
    description: "For occasional creation at the lowest yearly rate.",
    note: "Up to 20 images or 4 videos per month",
    imageCountLabel: "≈ 20 images/month",
    modalSub: "Annual Basic for occasional image and video creation.",
    modalBadge: "Save $120",
    features: [
      "Up to 20 HD images/month",
      "Up to 4 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Billed annually"
    ]
  },
  {
    id: "pro_monthly_v21",
    pricingVariant: "2.1",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Monthly",
    name: "Pro",
    usdAmount: 29.99,
    currency: "USD",
    credits: 1000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_PRO_V21",
    activeForNewCheckout: true,
    featured: true,
    label: "Recommended",
    cta: "Get Pro",
    description: "The best value for creators producing every month.",
    note: "5× more than Basic: up to 100 images or 20 videos per month",
    imageCountLabel: "≈ 100 images/month",
    modalSub: "For regular monthly image and video creation.",
    modalBadge: "Recommended",
    modalValueTag: "5× more",
    features: [
      "Up to 100 HD images/month",
      "Up to 20 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Failed generations auto-refunded"
    ]
  },
  {
    id: "pro_annual_v21",
    pricingVariant: "2.1",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Annual",
    name: "Pro",
    usdAmount: 179.88,
    currency: "USD",
    credits: 12000,
    interval: "year",
    productEnvKey: "CREEM_PRODUCT_ID_PRO_ANNUAL_V21",
    activeForNewCheckout: true,
    featured: true,
    label: "Recommended",
    cta: "Get Pro annual",
    description: "The best value for creators producing every month.",
    note: "5× more than Basic: up to 100 images or 20 videos per month",
    imageCountLabel: "≈ 100 images/month",
    modalSub: "Annual Pro for regular image and video creation.",
    modalBadge: "Save $180",
    modalValueTag: "5× more",
    features: [
      "Up to 100 HD images/month",
      "Up to 20 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Billed annually"
    ]
  },
  {
    id: "max_monthly_v21",
    pricingVariant: "2.1",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Monthly",
    name: "Max",
    usdAmount: 79.99,
    currency: "USD",
    credits: 10000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_MAX_V21",
    activeForNewCheckout: true,
    label: "High volume",
    cta: "Get Max",
    description: "For teams and power users creating at full scale.",
    note: "Up to 1,000 images or 200 videos per month",
    imageCountLabel: "≈ 1,000 images/month",
    modalSub: "For high-volume monthly image and video creation.",
    features: [
      "Up to 1,000 HD images/month",
      "Up to 200 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Higher priority for faster generation"
    ]
  },
  {
    id: "max_annual_v21",
    pricingVariant: "2.1",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Annual",
    name: "Max",
    usdAmount: 479.88,
    currency: "USD",
    credits: 120000,
    interval: "year",
    productEnvKey: "CREEM_PRODUCT_ID_MAX_ANNUAL_V21",
    activeForNewCheckout: true,
    label: "Annual",
    cta: "Get Max annual",
    description: "For high-volume creation at the best yearly rate.",
    note: "Up to 1,000 images or 200 videos per month",
    imageCountLabel: "≈ 1,000 images/month",
    modalSub: "Annual Max for high-volume image and video creation.",
    modalBadge: "Save $480",
    features: [
      "Up to 1,000 HD images/month",
      "Up to 200 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Billed annually"
    ]
  },
  {
    id: "basic_monthly_v22",
    pricingVariant: "2.2",
    kind: "subscription",
    plan: "basic",
    checkoutPlan: "basic",
    title: "Basic Monthly",
    name: "Basic",
    usdAmount: 14.99,
    currency: "USD",
    credits: 100,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_BASIC_V22",
    activeForNewCheckout: true,
    cta: "Get Basic",
    description: "For occasional image creation.",
    note: "Up to 10 images per month. Video generation is not included.",
    imageCountLabel: "≈ 10 images/month",
    modalSub: "For light monthly image creation.",
    features: [
      "Up to 10 HD images/month",
      "Video generation not included",
      "Export in 2K & 4K",
      "Commercial use included",
      "Cancel anytime"
    ]
  },
  {
    id: "basic_annual_v22",
    pricingVariant: "2.2",
    kind: "subscription",
    plan: "basic",
    checkoutPlan: "basic",
    title: "Basic Annual",
    name: "Basic",
    usdAmount: 89.88,
    currency: "USD",
    credits: 1200,
    interval: "year",
    productEnvKey: "CREEM_PRODUCT_ID_BASIC_ANNUAL_V22",
    activeForNewCheckout: true,
    label: "Annual",
    cta: "Get Basic annual",
    description: "For occasional image creation at the lowest yearly rate.",
    note: "Up to 10 images per month. Video generation is not included.",
    imageCountLabel: "≈ 10 images/month",
    modalSub: "Annual Basic for occasional image creation.",
    modalBadge: "Save $90",
    features: [
      "Up to 10 HD images/month",
      "Video generation not included",
      "Export in 2K & 4K",
      "Commercial use included",
      "Billed annually"
    ]
  },
  {
    id: "pro_monthly_v22",
    pricingVariant: "2.2",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Monthly",
    name: "Pro",
    usdAmount: 24.99,
    currency: "USD",
    credits: 1000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_PRO_V22",
    activeForNewCheckout: true,
    featured: true,
    label: "Recommended",
    cta: "Get Pro",
    description: "The best value for creators producing every month.",
    note: "Up to 100 images or 10 videos per month",
    imageCountLabel: "≈ 100 images/month",
    modalSub: "For regular monthly image and video creation.",
    modalBadge: "Recommended",
    modalValueTag: "10× more",
    features: [
      "Up to 100 HD images/month",
      "Up to 10 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Failed generations auto-refunded"
    ]
  },
  {
    id: "pro_annual_v22",
    pricingVariant: "2.2",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Annual",
    name: "Pro",
    usdAmount: 149.88,
    currency: "USD",
    credits: 12000,
    interval: "year",
    productEnvKey: "CREEM_PRODUCT_ID_PRO_ANNUAL_V22",
    activeForNewCheckout: true,
    featured: true,
    label: "Recommended",
    cta: "Get Pro annual",
    description: "The best value for creators producing every month.",
    note: "Up to 100 images or 10 videos per month",
    imageCountLabel: "≈ 100 images/month",
    modalSub: "Annual Pro for regular image and video creation.",
    modalBadge: "Save $150",
    modalValueTag: "10× more",
    features: [
      "Up to 100 HD images/month",
      "Up to 10 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Billed annually"
    ]
  },
  {
    id: "max_monthly_v22",
    pricingVariant: "2.2",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Monthly",
    name: "Max",
    usdAmount: 79.99,
    currency: "USD",
    credits: 10000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_MAX_V22",
    activeForNewCheckout: true,
    label: "High volume",
    cta: "Get Max",
    description: "For teams and power users creating at full scale.",
    note: "Up to 1,000 images or 100 videos per month",
    imageCountLabel: "≈ 1,000 images/month",
    modalSub: "For high-volume monthly image and video creation.",
    features: [
      "Up to 1,000 HD images/month",
      "Up to 100 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Higher priority for faster generation"
    ]
  },
  {
    id: "max_annual_v22",
    pricingVariant: "2.2",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Annual",
    name: "Max",
    usdAmount: 479.88,
    currency: "USD",
    credits: 120000,
    interval: "year",
    productEnvKey: "CREEM_PRODUCT_ID_MAX_ANNUAL_V22",
    activeForNewCheckout: true,
    label: "Annual",
    cta: "Get Max annual",
    description: "For high-volume creation at the best yearly rate.",
    note: "Up to 1,000 images or 100 videos per month",
    imageCountLabel: "≈ 1,000 images/month",
    modalSub: "Annual Max for high-volume image and video creation.",
    modalBadge: "Save $480",
    features: [
      "Up to 1,000 HD images/month",
      "Up to 100 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Billed annually"
    ]
  },
  {
    id: "basic_monthly_v24",
    pricingVariant: "2.4",
    kind: "subscription",
    plan: "basic",
    checkoutPlan: "basic",
    title: "Basic Monthly",
    name: "Basic",
    usdAmount: 19.99,
    currency: "USD",
    credits: 1000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_BASIC_V24",
    activeForNewCheckout: true,
    cta: "Get Basic",
    description: "For occasional image and video creation.",
    note: "Up to 100 images or 10 videos per month",
    imageCountLabel: "≈ 100 images/month",
    modalSub: "For light monthly image and video creation.",
    features: [
      "Up to 100 HD images/month",
      "Up to 10 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Cancel anytime"
    ]
  },
  {
    id: "basic_annual_v24",
    pricingVariant: "2.4",
    kind: "subscription",
    plan: "basic",
    checkoutPlan: "basic",
    title: "Basic Annual",
    name: "Basic",
    usdAmount: 119.88,
    currency: "USD",
    credits: 12000,
    interval: "year",
    productEnvKey: "CREEM_PRODUCT_ID_BASIC_ANNUAL_V24",
    activeForNewCheckout: true,
    label: "Annual",
    cta: "Get Basic annual",
    description: "For occasional image and video creation at the lowest yearly rate.",
    note: "Up to 100 images or 10 videos per month",
    imageCountLabel: "≈ 100 images/month",
    modalSub: "Annual Basic for occasional image and video creation.",
    modalBadge: "Save $120",
    features: [
      "Up to 100 HD images/month",
      "Up to 10 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Billed annually"
    ]
  },
  {
    id: "pro_monthly_v24",
    pricingVariant: "2.4",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Monthly",
    name: "Pro",
    usdAmount: 39.99,
    currency: "USD",
    credits: 3000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_PRO_V24",
    activeForNewCheckout: true,
    featured: true,
    label: "Recommended",
    cta: "Get Pro",
    description: "The best value for creators producing every month.",
    note: "Up to 300 images or 30 videos per month",
    imageCountLabel: "≈ 300 images/month",
    modalSub: "For regular monthly image and video creation.",
    modalBadge: "Popular",
    modalValueTag: "3× more",
    features: [
      "Up to 300 HD images/month",
      "Up to 30 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Failed generations auto-refunded"
    ]
  },
  {
    id: "pro_annual_v24",
    pricingVariant: "2.4",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Pro Annual",
    name: "Pro",
    usdAmount: 239.88,
    currency: "USD",
    credits: 36000,
    interval: "year",
    productEnvKey: "CREEM_PRODUCT_ID_PRO_ANNUAL_V24",
    activeForNewCheckout: true,
    featured: true,
    label: "Recommended",
    cta: "Get Pro annual",
    description: "The best value for creators producing every month.",
    note: "Up to 300 images or 30 videos per month",
    imageCountLabel: "≈ 300 images/month",
    modalSub: "Annual Pro for regular image and video creation.",
    modalBadge: "Save $240",
    modalValueTag: "3× more",
    features: [
      "Up to 300 HD images/month",
      "Up to 30 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Billed annually"
    ]
  },
  {
    id: "max_monthly_v24",
    pricingVariant: "2.4",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Monthly",
    name: "Max",
    usdAmount: 79.99,
    currency: "USD",
    credits: 10000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_MAX_V24",
    activeForNewCheckout: true,
    label: "High volume",
    cta: "Get Max",
    description: "For teams and power users creating at full scale.",
    note: "Up to 1,000 images or 100 videos per month",
    imageCountLabel: "≈ 1,000 images/month",
    modalSub: "For high-volume monthly image and video creation.",
    features: [
      "Up to 1,000 HD images/month",
      "Up to 100 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Higher priority for faster generation"
    ]
  },
  {
    id: "max_annual_v24",
    pricingVariant: "2.4",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Max Annual",
    name: "Max",
    usdAmount: 479.88,
    currency: "USD",
    credits: 120000,
    interval: "year",
    productEnvKey: "CREEM_PRODUCT_ID_MAX_ANNUAL_V24",
    activeForNewCheckout: true,
    label: "Annual",
    cta: "Get Max annual",
    description: "For high-volume creation at the best yearly rate.",
    note: "Up to 1,000 images or 100 videos per month",
    imageCountLabel: "≈ 1,000 images/month",
    modalSub: "Annual Max for high-volume image and video creation.",
    modalBadge: "Save $480",
    features: [
      "Up to 1,000 HD images/month",
      "Up to 100 videos/month",
      "Export in 2K & 4K",
      "Commercial use included",
      "Billed annually"
    ]
  },
  {
    id: "image_credit_pack_500_v24",
    pricingVariant: "2.4",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "1,000 Credit Pack",
    name: "1,000 credits",
    usdAmount: 29.99,
    currency: "USD",
    credits: 1_000,
    productEnvKey: "CREEM_PRODUCT_ID_IMAGE_CREDIT_PACK_500_V24",
    activeForNewCheckout: true,
    label: "One-time",
    cta: "Buy credits",
    description: "A one-time credit pack for image and video creation.",
    note: "1,000 paid credits valid for 90 days",
    imageCountLabel: "≈ 100 images",
    modalSub: "For occasional creation without a subscription.",
    features: [
      "1,000 paid credits",
      "Credits valid for 90 days",
      "Unlock HD watermark-free images",
      "Commercial use included"
    ]
  },
  {
    id: "image_credit_pack_2000_v24",
    pricingVariant: "2.4",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "3,000 Credit Pack",
    name: "3,000 credits",
    usdAmount: 49.99,
    currency: "USD",
    credits: 3_000,
    productEnvKey: "CREEM_PRODUCT_ID_IMAGE_CREDIT_PACK_2000_V24",
    activeForNewCheckout: true,
    label: "One-time",
    cta: "Buy credits",
    description: "A one-time credit pack for regular image and video creation.",
    note: "3,000 paid credits valid for 90 days",
    imageCountLabel: "≈ 300 images",
    modalSub: "For regular creation without a subscription.",
    features: [
      "3,000 paid credits",
      "Credits valid for 90 days",
      "Unlock HD watermark-free images",
      "Commercial use included"
    ]
  },
  {
    id: "image_credit_pack_10000_v24",
    pricingVariant: "2.4",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "10,000 Credit Pack",
    name: "10,000 credits",
    usdAmount: 89.99,
    currency: "USD",
    credits: 10_000,
    productEnvKey: "CREEM_PRODUCT_ID_IMAGE_CREDIT_PACK_10000_V24",
    activeForNewCheckout: true,
    label: "One-time",
    cta: "Buy credits",
    description: "A one-time credit pack for high-volume image and video creation.",
    note: "10,000 paid credits valid for 90 days",
    imageCountLabel: "≈ 1,000 images",
    modalSub: "For high-volume creation without a subscription.",
    features: [
      "10,000 paid credits",
      "Credits valid for 90 days",
      "Unlock HD watermark-free images",
      "Commercial use included"
    ]
  },
  {
    id: "video_unlock_single",
    pricingVariant: "1.6",
    kind: "one_time",
    plan: "free",
    checkoutPlan: "starter",
    title: "Unlock This Video",
    name: "Unlock this video",
    usdAmount: 9.99,
    currency: "USD",
    credits: 100,
    productEnvKey: "CREEM_PRODUCT_ID_VIDEO_UNLOCK_SINGLE",
    activeForNewCheckout: false,
    label: "One-time",
    cta: "Unlock this video only for $9.99",
    description: "Unlock this watermark-free HD original video and keep creating with bonus credits.",
    note: "Unlock this video + 100 credits",
    imageCountLabel: "1 HD video",
    modalSub: "Unlock this video without a monthly plan.",
    features: [
      "Unlock this HD original video",
      "Watermark-free download",
      "100 bonus credits",
      "No subscription"
    ]
  },
  {
    id: "video_basic_v1",
    pricingVariant: "1.6",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Video Basic Monthly",
    name: "Basic",
    usdAmount: 14.99,
    currency: "USD",
    credits: 2000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_VIDEO_BASIC_V1",
    activeForNewCheckout: false,
    cta: "Get Basic",
    description: "For lighter monthly AI video creation.",
    note: "2,000 credits/month. Up to ~10 video generations/month",
    imageCountLabel: "Up to ~10 videos",
    modalSub: "For lighter monthly AI video creation.",
    features: [
      "2,000 credits per month",
      "Up to ~10 video generations/month",
      "Saved account workspace"
    ]
  },
  {
    id: "video_standard_v1",
    pricingVariant: "1.6",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Video Standard Monthly",
    name: "Standard",
    usdAmount: 39.99,
    currency: "USD",
    credits: 10000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_VIDEO_STANDARD_V1",
    activeForNewCheckout: false,
    cta: "Get Standard",
    description: "For regular AI video publishing volume.",
    note: "10,000 credits/month. Up to ~50 video generations/month",
    imageCountLabel: "Up to ~50 videos",
    modalSub: "For regular AI video publishing volume.",
    features: [
      "10,000 credits per month",
      "Up to ~50 video generations/month",
      "More room for batches"
    ]
  },
  {
    id: "video_ultimate_v1",
    pricingVariant: "1.6",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Video Ultimate Monthly",
    name: "Ultimate",
    usdAmount: 79.99,
    currency: "USD",
    credits: 50000,
    interval: "month",
    productEnvKey: "CREEM_PRODUCT_ID_VIDEO_ULTIMATE_V1",
    activeForNewCheckout: false,
    cta: "Get Ultimate",
    description: "For high-volume AI video creation.",
    note: "50,000 credits/month. Up to ~250 video generations/month",
    imageCountLabel: "Up to ~250 videos",
    modalSub: "For high-volume AI video creation.",
    features: [
      "50,000 credits per month",
      "Up to ~250 video generations/month",
      "Best for high-volume creation"
    ]
  },
  {
    id: "video_basic_annual_v1",
    pricingVariant: "1.6",
    kind: "subscription",
    plan: "pro",
    checkoutPlan: "pro",
    title: "Video Basic Annual",
    name: "Basic",
    usdAmount: 143.88,
    currency: "USD",
    credits: 24000,
    interval: "year",
    productEnvKey: "CREEM_PRODUCT_ID_VIDEO_BASIC_ANNUAL_V1",
    activeForNewCheckout: false,
    cta: "Get Basic Annual",
    description: "For lighter monthly AI video creation, billed yearly.",
    note: "2,000 credits/month, billed annually. Up to ~10 video generations/month",
    imageCountLabel: "Up to ~10 videos/month",
    modalSub: "Annual Basic for lighter AI video creation.",
    modalBadge: "Save $36",
    features: [
      "2,000 credits per month",
      "Up to ~10 video generations/month",
      "Saved account workspace",
      "Billed annually"
    ]
  },
  {
    id: "video_standard_annual_v1",
    pricingVariant: "1.6",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Video Standard Annual",
    name: "Standard",
    usdAmount: 395.88,
    currency: "USD",
    credits: 120000,
    interval: "year",
    productEnvKey: "CREEM_PRODUCT_ID_VIDEO_STANDARD_ANNUAL_V1",
    activeForNewCheckout: false,
    cta: "Get Standard Annual",
    description: "For regular AI video publishing volume, billed yearly.",
    note: "10,000 credits/month, billed annually. Up to ~50 video generations/month",
    imageCountLabel: "Up to ~50 videos/month",
    modalSub: "Annual Standard for regular AI video publishing volume.",
    modalBadge: "Save $84",
    features: [
      "10,000 credits per month",
      "Up to ~50 video generations/month",
      "More room for batches",
      "Billed annually"
    ]
  },
  {
    id: "video_ultimate_annual_v1",
    pricingVariant: "1.6",
    kind: "subscription",
    plan: "max",
    checkoutPlan: "max",
    title: "Video Ultimate Annual",
    name: "Ultimate",
    usdAmount: 719.88,
    currency: "USD",
    credits: 600000,
    interval: "year",
    productEnvKey: "CREEM_PRODUCT_ID_VIDEO_ULTIMATE_ANNUAL_V1",
    activeForNewCheckout: false,
    cta: "Get Ultimate Annual",
    description: "For high-volume AI video creation at a lower yearly rate.",
    note: "50,000 credits/month, billed annually. Up to ~250 video generations/month",
    imageCountLabel: "Up to ~250 videos/month",
    modalSub: "Annual Ultimate for high-volume AI video creation.",
    modalBadge: "Save $240",
    features: [
      "50,000 credits per month",
      "Up to ~250 video generations/month",
      "Supports 720p and 1080p exports",
      "Best for high-volume creation"
    ]
  }
] as const;

export const BILLING_PACKAGE_IDS = BILLING_PACKAGES.map((item) => item.id) as BillingPackageId[];

export function normalizePricingVariant(value?: string | null): PricingVariant {
  const normalized = value?.trim().toUpperCase();
  const legacyVariant = LEGACY_PRICING_VARIANT_MAP[normalized as keyof typeof LEGACY_PRICING_VARIANT_MAP];
  if (legacyVariant) return legacyVariant;
  return SUPPORTED_PRICING_VARIANTS.includes(normalized as PricingVariant)
    ? normalized as PricingVariant
    : DEFAULT_PRICING_VARIANT;
}

export function isBillingPackageId(value?: string | null): value is BillingPackageId {
  return BILLING_PACKAGES.some((item) => item.id === value);
}

export function getBillingPackage(packageId?: string | null): BillingPackage | undefined {
  if (!isBillingPackageId(packageId)) return undefined;
  return BILLING_PACKAGES.find((item) => item.id === packageId);
}

export function requireBillingPackage(packageId: string): BillingPackage {
  const billingPackage = getBillingPackage(packageId);
  if (!billingPackage) {
    throw new Error("INVALID_RECHARGE_PACKAGE");
  }
  return billingPackage;
}

export function isSubscriptionPackage(packageId?: string | null): boolean {
  return getBillingPackage(packageId)?.kind === "subscription";
}

export function getBillingPackagesForVariant(
  variant: PricingVariant,
  options: { activeOnly?: boolean; includeOneTime?: boolean } = {}
): BillingPackage[] {
  const normalizedVariant = normalizePricingVariant(variant);
  const catalogVariant = resolvePricingCatalogVariant(normalizedVariant);
  const activeOnly = options.activeOnly ?? true;
  const includeOneTime = options.includeOneTime ?? true;
  return BILLING_PACKAGES.filter((item) => (
    item.pricingVariant === catalogVariant
    && (!activeOnly || item.activeForNewCheckout)
    && (includeOneTime || item.kind === "subscription")
  ));
}

export function toPublicBillingPackage(item: BillingPackage): PublicBillingPackage {
  const { productEnvKey, ...publicPackage } = item;
  void productEnvKey;
  return publicPackage;
}

export function getPublicBillingPackagesForVariant(
  variant: PricingVariant,
  options?: { activeOnly?: boolean; includeOneTime?: boolean }
): PublicBillingPackage[] {
  return getBillingPackagesForVariant(variant, options).map(toPublicBillingPackage);
}

export function resolveEffectiveBillingPackageUsdAmount(packageId: BillingPackageId): number {
  const billingPackage = requireBillingPackage(packageId);
  if (!billingPackage.discountPercent || billingPackage.discountPercent <= 0) {
    return billingPackage.usdAmount;
  }
  return Math.round((billingPackage.usdAmount * (1 - billingPackage.discountPercent / 100) + Number.EPSILON) * 100) / 100;
}

export function stripePackageEnvSuffix(packageId: BillingPackageId): string {
  return packageId.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

export function resolveStripePriceIdForPackage(packageId: BillingPackageId): string {
  requireBillingPackage(packageId);
  return process.env[`STRIPE_PRICE_ID_${stripePackageEnvSuffix(packageId)}`]?.trim() ?? "";
}

export function resolveProductIdForPackage(packageId: BillingPackageId): string {
  const billingPackage = requireBillingPackage(packageId);
  const productId = process.env[billingPackage.productEnvKey]?.trim() ?? "";
  if (!productId) {
    throw new Error(`Creem product is not configured for package: ${packageId}`);
  }
  return productId;
}

export function getBillingPackageByProductId(productId?: string | null): BillingPackage | undefined {
  const normalizedProductId = productId?.trim();
  if (!normalizedProductId) return undefined;
  return BILLING_PACKAGES.find((item) => process.env[item.productEnvKey]?.trim() === normalizedProductId);
}
