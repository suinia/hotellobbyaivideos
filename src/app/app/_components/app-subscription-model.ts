import {
  getPublicBillingPackagesForVariant,
  type BillingPackageId,
  type PricingVariant,
  type PublicBillingPackage
} from "@/lib/billing/catalog";
import type { BillingCurrency, BillingMarket } from "@/lib/billing/market";
import {
  formatBillingAmount,
  getLocalizedPublicBillingPackagesForVariant,
  resolveBillingOffer
} from "@/lib/billing/offers";
import { V19_FREE_IMAGE_CREDIT_PACK_PACKAGE_IDS, V25_IMAGE_CREDIT_PACK_PACKAGE_IDS } from "@/lib/billing/image-credit-packs";
import { SELF_SERVE_VIDEO_CREDIT_PACKS, V25_VIDEO_CREDIT_PACKS } from "@/lib/billing/video-credit-packs";
import { resolveFrontendBillingPlanName } from "@/lib/billing/plan-display";
import { isVideoGenerationSourceUseCase } from "@/lib/videos/source-use-case";

export function filterUpgradePlansForSourceUseCase(
  plans: SubscriptionModalPlanOption[],
  sourceUseCase?: string
): SubscriptionModalPlanOption[] {
  if (!isVideoGenerationSourceUseCase(sourceUseCase)) return plans;
  // Basic 2.2 is image-only, including both monthly and annual subscriptions.
  return plans.filter((plan) => !(
    plan.pricingVariant === "2.2" && plan.checkoutPlan === "basic"
  ));
}

export type RechargePackageId = BillingPackageId;

export type SubscriptionModalPlanOption = {
  packageId: RechargePackageId;
  pricingVariant: PricingVariant;
  checkoutPlan: PublicBillingPackage["checkoutPlan"];
  name: string;
  displayName: string;
  price: string;
  originalPrice?: string;
  discountPercent?: number;
  discountRequestCode?: string;
  savings?: string;
  creditsLabel: string;
  priceLineLabel: string;
  imageCountLabel: string;
  billingInterval?: PublicBillingPackage["interval"];
  billingNote?: string;
  badge?: string;
  valueTag?: string;
  shortNote?: string;
  kind: PublicBillingPackage["kind"];
  billingMarket: BillingMarket;
  currency: BillingCurrency;
  value: number;
};

export type SubscriptionSuccessModalPlan = "guest" | "free";

export type GeneratedImage = {
  assetId: string;
  imageIndex: number;
  url: string;
  accessVariant?: "original" | "watermarked";
  previewVariant?: "watermarked" | "masked_blur" | "low_res_clean";
  width?: number;
  height?: number;
  originalSizeBytes?: number;
  promptSummary?: string;
  parentAssetId?: string | null;
  previewFileName?: string;
  aspectRatio?:
    | "auto"
    | "1:1"
    | "3:2"
    | "2:3"
    | "4:3"
    | "3:4"
    | "5:4"
    | "4:5"
    | "16:9"
    | "9:16"
    | "2:1"
    | "1:2"
    | "21:9"
    | "9:21";
  resolution?: "auto" | "1k" | "2k" | "4k";
};

function formatDiscountedAmount(value: number, currency: BillingCurrency, discountPercent?: number): string {
  if (!discountPercent) return formatBillingAmount(value, currency);
  return formatBillingAmount(value * (1 - discountPercent / 100), currency);
}

export function buildSubscriptionModalPlans(
  pricingVariant: PricingVariant,
  billingContext: { market: BillingMarket; currency: BillingCurrency } = { market: "default", currency: "USD" },
  options: {
    includeImageTextEditorCreditPacks?: boolean;
    imageTextEditorCreditPackAudience?: "free" | "subscriber";
  } = {}
): SubscriptionModalPlanOption[] {
  const variantPackages = getLocalizedPublicBillingPackagesForVariant(pricingVariant, billingContext.market);
  const imageCreditPackAudience = options.imageTextEditorCreditPackAudience ?? "free";
  const imageCreditPackIds = new Set<BillingPackageId>(
    pricingVariant === "2.5"
      ? imageCreditPackAudience === "subscriber" ? V25_VIDEO_CREDIT_PACKS.map((pack) => pack.packageId) : V25_IMAGE_CREDIT_PACK_PACKAGE_IDS
      : imageCreditPackAudience === "subscriber" ? SELF_SERVE_VIDEO_CREDIT_PACKS.map((pack) => pack.packageId) : V19_FREE_IMAGE_CREDIT_PACK_PACKAGE_IDS
  );
  const imageCreditPacks = options.includeImageTextEditorCreditPacks
    && (pricingVariant === "1.9" || pricingVariant === "2.5")
    && (imageCreditPackAudience === "subscriber" || billingContext.market !== "ca")
    ? getPublicBillingPackagesForVariant(pricingVariant === "2.5" ? "2.5" : imageCreditPackAudience === "subscriber" ? "2.0" : "1.9", { activeOnly: false })
        .filter((item) => imageCreditPackIds.has(item.id))
        .map((item) => {
          const offer = resolveBillingOffer({
            packageId: item.id,
            market: imageCreditPackAudience === "subscriber" && billingContext.market !== "gb"
              ? "default"
              : billingContext.market,
            pricingVariant: item.pricingVariant
          });
          return {
            ...item,
            displayAmount: offer.amount,
            displayCurrency: offer.currency
          };
        })
    : [];
  const packages = [...variantPackages, ...imageCreditPacks];
  const planOrder = new Map([["starter", 0], ["basic", 0], ["pro", 1], ["max", 2]]);
  const monthlySubscriptions = new Map(
    packages
      .filter((item) => item.kind === "subscription" && item.interval === "month")
      .map((item) => [item.checkoutPlan, item])
  );

  return packages
    .map((item) => {
      const launchDiscountPercent = item.discountPercent;
      const monthlyPeer = monthlySubscriptions.get(item.checkoutPlan);
      const annualSavings = item.interval === "year" && monthlyPeer
        ? Math.max(0, monthlyPeer.displayAmount * 12 - item.displayAmount)
        : 0;
      const annualDiscountPercent = annualSavings > 0 && monthlyPeer
        ? Math.round((annualSavings / (monthlyPeer.displayAmount * 12)) * 100)
        : undefined;
      const hideAnnualComparison = item.interval === "year" && (item.pricingVariant === "1.7" || item.pricingVariant === "2.0" || item.pricingVariant === "2.1" || item.pricingVariant === "2.2");
      const showAnnualPercent = false;
      const showAnnualSavings = false;
      const discountPercent = launchDiscountPercent ?? (showAnnualPercent ? annualDiscountPercent : undefined);
      const displayAmount = item.interval === "year" ? item.displayAmount / 12 : item.displayAmount;
      const usesMonthlyCreditGrant = item.kind === "subscription" && item.interval === "year" && Boolean(monthlyPeer);
      const priceLineCredits = usesMonthlyCreditGrant && monthlyPeer ? monthlyPeer.credits : item.credits;
      const priceLineImageCount = usesMonthlyCreditGrant && monthlyPeer ? monthlyPeer.imageCountLabel : item.imageCountLabel;
      const priceLineInterval = usesMonthlyCreditGrant ? "month" : item.interval;
      const priceLineGrantCount = usesMonthlyCreditGrant ? " × 12" : "";

      return {
        packageId: item.id,
        pricingVariant: item.pricingVariant,
        checkoutPlan: item.checkoutPlan,
        name: item.name,
        displayName: resolveFrontendBillingPlanName(item.pricingVariant, item.checkoutPlan, item.name),
        price: formatDiscountedAmount(displayAmount, item.displayCurrency, launchDiscountPercent),
        originalPrice: item.interval === "year" && monthlyPeer && !hideAnnualComparison
          ? formatBillingAmount(monthlyPeer.displayAmount, monthlyPeer.displayCurrency)
          : launchDiscountPercent ? formatBillingAmount(item.displayAmount, item.displayCurrency) : undefined,
        discountPercent,
        discountRequestCode: item.discountRequestCode,
        savings: item.interval === "year" && annualSavings > 0 && showAnnualSavings
          ? `Save ${formatBillingAmount(annualSavings, item.displayCurrency)}/year`
          : launchDiscountPercent
            ? `Save ${formatBillingAmount(item.displayAmount * (launchDiscountPercent / 100), item.displayCurrency)}`
            : undefined,
        creditsLabel: `${item.credits.toLocaleString()} credits${item.interval ? `/${item.interval}` : ""}`,
        priceLineLabel: `${priceLineCredits.toLocaleString()} credits${priceLineInterval ? `/${priceLineInterval}` : ""}${priceLineGrantCount} ${priceLineImageCount}`,
        imageCountLabel: item.imageCountLabel,
        billingInterval: item.interval,
        billingNote: item.interval === "year"
          ? `${formatBillingAmount(item.displayAmount, item.displayCurrency)} billed yearly`
          : undefined,
        badge: item.modalBadge ?? item.label,
        valueTag: item.interval === "year" && annualSavings > 0 && showAnnualPercent
          ? item.modalValueTag ?? `Save ${Math.round(annualDiscountPercent ?? 0)}%`
          : launchDiscountPercent ? undefined : item.modalValueTag,
        shortNote: item.note,
        kind: item.kind,
        billingMarket: billingContext.market,
        currency: item.displayCurrency,
        value: item.displayAmount
      };
    })
    .sort((left, right) => (
      (planOrder.get(left.name.toLowerCase()) ?? 99) - (planOrder.get(right.name.toLowerCase()) ?? 99)
    ));
}

export function isGuestWatermarkedSignupImage(image: GeneratedImage): boolean {
  return image.accessVariant !== "original" && image.previewVariant !== "masked_blur" && image.previewVariant !== "low_res_clean";
}

export function isLowResCleanPreviewImage(image: GeneratedImage): boolean {
  return image.accessVariant !== "original" && image.previewVariant === "low_res_clean";
}

export function getBillingIntervalToggleSaveLabel(
  interval: "month" | "year",
  plans: SubscriptionModalPlanOption[]
): string | undefined {
  if (interval === "month") return undefined;
  const annualPlans = plans.filter((plan) => plan.kind === "subscription" && plan.billingInterval === "year");
  const maxConfiguredDiscount = annualPlans
    .map((plan) => {
      const match = plan.valueTag?.match(/Save\s+(\d+)%/i);
      return match ? Number(match[1]) : 0;
    })
    .reduce((max, value) => Math.max(max, value), 0);
  if (annualPlans.some((plan) => plan.pricingVariant === "2.5")) return "Save up to 30%";
  if (maxConfiguredDiscount > 0) return `Save ${maxConfiguredDiscount}%`;
  if (annualPlans.some((plan) => plan.pricingVariant === "1.9")) return "Save 50%";
  if (annualPlans.some((plan) => plan.pricingVariant === "2.0")) return "Save 50%";
  if (annualPlans.some((plan) => plan.pricingVariant === "2.1")) return "Save 50%";
  if (annualPlans.some((plan) => plan.pricingVariant === "2.2")) return "Save 50%";
  if (annualPlans.some((plan) => plan.pricingVariant === "2.4")) return "Save 50%";
  if (annualPlans.some((plan) => plan.pricingVariant === "1.7")) return "Save 50%";
  if (annualPlans.some((plan) => plan.pricingVariant === "1.8")) return "Save 20%";
  const maxDiscount = annualPlans
    .map((plan) => plan.discountPercent ?? 0)
    .reduce((max, value) => Math.max(max, value), 0);
  return maxDiscount > 0 ? `Save ${Math.round(maxDiscount)}%` : undefined;
}
