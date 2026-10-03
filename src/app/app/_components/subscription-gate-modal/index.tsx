"use client";

import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Crown,
  Download,
  X,
  Zap
} from "lucide-react";
import {
  resolveDefaultSubscriptionCheckoutPlan,
  type PricingVariant,
  type PublicBillingPackage
} from "@/lib/billing/catalog";
import {
  getBillingIntervalToggleSaveLabel,
  filterUpgradePlansForSourceUseCase,
  type GeneratedImage,
  type RechargePackageId,
  type SubscriptionModalPlanOption,
  type SubscriptionSuccessModalPlan
} from "../app-subscription-model";
import { trackClientEvent } from "@/lib/telemetry/client";
import { captureAnalyticsEvent } from "@/lib/analytics/posthog";
import {
  buildImagePreviewFailureReason,
  useRetryingImagePreview
} from "../use-retrying-image-preview";
import { RetryingPreviewImage } from "../retrying-preview-image";
import { GateImagePreviewOverlay } from "../gate-image-preview-overlay";
import { isV19FreeImageCreditPackPackageId } from "@/lib/billing/image-credit-packs";
import { isVideoCreditPackPackageId } from "@/lib/billing/video-credit-packs";
import { formatBillingAmount, formatCheckoutAmountDueToday } from "@/lib/billing/offers";
import styles from "./index.module.css";

type SubscriptionBillingInterval = NonNullable<PublicBillingPackage["interval"]>;
const CREDIT_PACK_SALES_CONTACT_HREF = "mailto:support@vismuse.com?subject=Vismuse%20high-volume%20image%20credits";
export type SubscriptionCta = {
  position: "primary_button" | "watermarked_tips_button";
  label: string;
};
type WatermarkedDownloadResult = {
  downloadedBytes?: number;
};
type UpgradeModalPlanBenefit = {
  strong: string;
  copy?: string;
};

type AppSubscriptionImageModalProps = {
  mode: "image";
  sourceUseCase: string;
  pricingVariant: PricingVariant;
  plan: SubscriptionSuccessModalPlan;
  image: GeneratedImage;
  selectableImages?: GeneratedImage[];
  onImageSelect?: (image: GeneratedImage) => void;
  plans: SubscriptionModalPlanOption[];
  subscribePendingPackage: "" | RechargePackageId;
  unlockPending: boolean;
  error?: string;
  onClose: () => void;
  onSubscribe: (packageId: RechargePackageId, cta?: SubscriptionCta) => void;
  onPlanSelect?: (packageId: RechargePackageId, previousPackageId: RechargePackageId) => void;
  onCreditPackViewOpen?: (packageIds: RechargePackageId[]) => void;
  onCreditPackPlanSelect?: (packageId: RechargePackageId, previousPackageId: RechargePackageId) => void;
  onCreditPackSubscribe?: (packageId: RechargePackageId, image: GeneratedImage) => void;
  onUnlock: () => void;
  onDownloadWatermarked: (image: GeneratedImage) => Promise<WatermarkedDownloadResult | void>;
  isSignedIn?: boolean;
  accountPlan?: string;
  guestId?: string;
  onGuestProviderSelect?: (provider: "google" | "apple", image: GeneratedImage) => void;
  onGuestEmailStart?: (image: GeneratedImage) => boolean | Promise<boolean>;
  onGuestEmailSuccess?: () => Promise<void> | void;
};

type AppSubscriptionUpgradeModalProps = {
  mode: "upgrade";
  initialBillingInterval?: "month" | "year";
  accountPlan?: string;
  sourceUseCase?: string;
  title?: string;
  subtitle?: string;
  pricingVariant: PricingVariant;
  plans: SubscriptionModalPlanOption[];
  pendingPackage: "" | RechargePackageId;
  error?: string;
  onClose: () => void;
  onSubscribe: (packageId: RechargePackageId, cta?: SubscriptionCta) => void;
  onPlanSelect?: (packageId: RechargePackageId, previousPackageId: RechargePackageId) => void;
  onAddCredits?: () => void;
};

export type SubscriptionGateModalProps = AppSubscriptionImageModalProps | AppSubscriptionUpgradeModalProps;

const UPGRADE_PRICING_FAQS = [
  {
    id: "vismuse",
    question: "What is Vismuse?",
    answer:
      "Vismuse helps you generate images across different mini tools, including product images, ads, flyers, album covers, book covers, stickers, wallpapers, logos, tattoo concepts, and more."
  },
  {
    id: "credits",
    question: "Are credits the main difference?",
    answer:
      "Credits control monthly generation volume. For most users, the bigger upgrade is the room to keep refining, compare more directions, and finish watermark-free images."
  },
  {
    id: "upgrade",
    question: "Do I need Max?",
    answer:
      "Start with Pro unless you create large batches or many revisions. Max is for heavier monthly production."
  },
  {
    id: "watermarks",
    question: "What do paid plans unlock?",
    answer:
      "Paid plans unlock watermark-free results, continued refinement with Vismuse, multi-image creation, higher-resolution generation, commercial use, and monthly credits."
  }
];

const IMAGE_UNLOCK_PRICE_LABEL = "$6.99";
const IMAGE_UNLOCK_V19_PRICE_LABEL = "$9.99";
const IMAGE_UNLOCK_GBP_PRICE_LABEL = "£7.99";
const IMAGE_UNLOCK_CAD_PRICE_LABEL = "C$12.99";
const SUBSCRIPTION_CREDIT_USAGE_TIP_ID = "subscription-credit-usage-tip";
const SUBSCRIPTION_HISTORY_UNLOCK_TIP_ID = "subscription-history-unlock-tip";

function getMonthly1kImageCount(imageCountLabel?: string): number | undefined {
  const match = imageCountLabel?.match(/([\d,]+)\s+(?:HD\s+)?images/i);
  if (!match) return undefined;
  const count = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(count) && count > 0 ? count : undefined;
}

function SubscriptionCreditUsageTip({ monthly1kImageCount }: { monthly1kImageCount: number }) {
  const uiLocale = useUiLocale();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const imageCounts = [
    { resolution: "1K", count: monthly1kImageCount },
    // Pricing 1.9 and 2.4 use the same resolution-based image rates:
    // 1K = 10 credits, 2K = 20 credits, and 4K = 40 credits.
    { resolution: "2K", count: Math.max(1, Math.floor(monthly1kImageCount / 2)) },
    { resolution: "4K", count: Math.max(1, Math.floor(monthly1kImageCount / 4)) }
  ];

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return localizeUiTree((
    <span className={styles.subscriptionCreditUsageTip} ref={containerRef}>
      <button
        type="button"
        className={styles.subscriptionCreditUsageTipButton}
        aria-label="Show estimated monthly image counts by resolution"
        aria-expanded={open}
        aria-controls={SUBSCRIPTION_CREDIT_USAGE_TIP_ID}
        onClick={() => setOpen((current) => !current)}
      >
        <CircleHelp size={15} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {open ? (
        <span
          id={SUBSCRIPTION_CREDIT_USAGE_TIP_ID}
          className={styles.subscriptionCreditUsageTipPopover}
          role="tooltip"
        >
          <strong className={styles.subscriptionCreditUsageTipTitle}>Estimated images per month</strong>
          {imageCounts.map(({ resolution, count }) => (
            <span key={resolution}>
              <span>{resolution}</span>
              <strong>Up to ~{count.toLocaleString()}</strong>
            </span>
          ))}
        </span>
      ) : null}
    </span>
  ), uiLocale);
}

function SubscriptionHistoryUnlockTip() {
  const uiLocale = useUiLocale();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return localizeUiTree((
    <span className={styles.subscriptionHistoryUnlockTip} ref={containerRef}>
      <button
        type="button"
        className={styles.subscriptionHistoryUnlockTipButton}
        aria-label="Learn about unlocking previous images"
        aria-expanded={open}
        aria-controls={SUBSCRIPTION_HISTORY_UNLOCK_TIP_ID}
        onClick={() => setOpen((current) => !current)}
      >
        <CircleHelp size={16} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {open ? (
        <span
          id={SUBSCRIPTION_HISTORY_UNLOCK_TIP_ID}
          className={styles.subscriptionHistoryUnlockTipPopover}
          role="tooltip"
        >
          Unlock all watermarked images you’ve already generated.
        </span>
      ) : null}
    </span>
  ), uiLocale);
}

function formatDownloadedFileSize(bytes?: number): string | undefined {
  if (!bytes || bytes < 1) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${Math.round(kilobytes)} KB`;
  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
}

function usesAnnualBillingToggle(pricingVariant?: PricingVariant): boolean {
  return pricingVariant === "1.7" || pricingVariant === "1.8" || pricingVariant === "1.9" || pricingVariant === "2.0" || pricingVariant === "2.1" || pricingVariant === "2.2" || pricingVariant === "2.4" || pricingVariant === "2.5";
}

function canShowSubscriptionPlanOptionSavings(_plan: SubscriptionModalPlanOption): boolean {
  return false;
}

function formatDiscountPercentLabel(discountPercent: number): string {
  return `${Math.round(discountPercent)}% off`;
}

function getBillingIntervalLabel(interval?: PublicBillingPackage["interval"]): string {
  if (interval === "year") return "Annual";
  if (interval === "month") return "Monthly";
  return "One-time";
}

function getBillingIntervalSuffix(plan: Pick<SubscriptionModalPlanOption, "kind" | "billingInterval">): string {
  if (plan.kind !== "subscription") return "/one-time";
  return "/month";
}

function getAvailableBillingIntervals(plans: SubscriptionModalPlanOption[]): SubscriptionBillingInterval[] {
  const seen = new Set<SubscriptionBillingInterval>();
  for (const plan of plans) {
    if (plan.kind === "subscription" && plan.billingInterval) {
      seen.add(plan.billingInterval);
    }
  }
  return (["month", "year"] as const).filter((interval) => seen.has(interval));
}

function filterPlansForBillingInterval(
  plans: SubscriptionModalPlanOption[],
  interval: SubscriptionBillingInterval,
  enabled: boolean
): SubscriptionModalPlanOption[] {
  if (!enabled) return plans;
  return plans.filter((plan) => plan.kind !== "subscription" || plan.billingInterval === interval);
}

function findBillingIntervalPlan(
  plans: SubscriptionModalPlanOption[],
  interval: SubscriptionBillingInterval,
  currentPlan?: SubscriptionModalPlanOption
): SubscriptionModalPlanOption | undefined {
  return plans.find((plan) => (
    plan.kind === "subscription"
    && plan.billingInterval === interval
    && plan.checkoutPlan === currentPlan?.checkoutPlan
  )) ?? plans.find((plan) => (
    plan.kind === "subscription"
    && plan.billingInterval === interval
    && plan.name.toLowerCase() === "pro"
  )) ?? plans.find((plan) => (
    plan.kind === "subscription"
    && plan.billingInterval === interval
  ));
}


function getDefaultUpgradeModalPackageId(plans: SubscriptionModalPlanOption[]): RechargePackageId {
  const pricingVariant = plans.find((item) => item.kind === "subscription")?.pricingVariant;
  const defaultCheckoutPlan = pricingVariant
    ? resolveDefaultSubscriptionCheckoutPlan(pricingVariant)
    : "pro";
  return (
    plans.find((item) => item.checkoutPlan === defaultCheckoutPlan)?.packageId
    ?? plans.find((item) => item.kind === "subscription")?.packageId
    ?? plans[0]?.packageId
    ?? "pro_monthly_v17"
  );
}

function isUnavailableForCurrentPlan(plan: SubscriptionModalPlanOption, accountPlan: string): boolean {
  if (plan.kind !== "subscription") return false;
  const planName = plan.name.toLowerCase();
  return planName === accountPlan || isIncludedInCurrentPlan(planName, accountPlan);
}

function getDefaultAvailableUpgradeModalPackageId(
  plans: SubscriptionModalPlanOption[],
  accountPlan: string
): RechargePackageId {
  const availablePlans = plans.filter((plan) => !isUnavailableForCurrentPlan(plan, accountPlan));
  return getDefaultUpgradeModalPackageId(availablePlans.length ? availablePlans : plans);
}

function getDefaultCreditPackPackageId(plans: SubscriptionModalPlanOption[]): RechargePackageId | undefined {
  return plans.find((item) => item.checkoutPlan === "starter" && item.kind === "one_time")?.packageId;
}

function getCreditPackImageCount(plan: SubscriptionModalPlanOption): number {
  const match = plan.imageCountLabel.match(/[\d,]+/) ?? plan.name.match(/[\d,]+/);
  return match ? Number(match[0].replace(/,/g, "")) || 0 : 0;
}

function getCreditPackUnitLabel(plan: SubscriptionModalPlanOption): string {
  if (plan.packageId === "starter_pack_1_v20") return "Unlock this image";
  if (plan.pricingVariant === "2.4") return plan.name;
  if (isV19FreeImageCreditPackPackageId(plan.packageId)) return plan.name;
  if (isVideoCreditPackPackageId(plan.packageId)) return plan.creditsLabel;
  const imageCount = getCreditPackImageCount(plan);
  if (imageCount <= 0) return "image credit pack";
  return `${imageCount.toLocaleString()} image${imageCount === 1 ? "" : "s"}`;
}

function getCreditPackValueLabel(plan: SubscriptionModalPlanOption): string | undefined {
  if (plan.pricingVariant === "2.4") return undefined;
  if (plan.packageId === "starter_pack_1_v20") return undefined;
  if (isVideoCreditPackPackageId(plan.packageId)) return undefined;
  if (plan.packageId === "starter_pack_100_v20") return "Best value";
  if (plan.packageId === "starter_pack_1000_v20") return "Largest pack";
  return plan.badge;
}

function getCreditPackPriceLabel(plan: SubscriptionModalPlanOption): string {
  return plan.price;
}

function getCreditPackUnitPriceLabel(plan: SubscriptionModalPlanOption): string | undefined {
  if (plan.packageId === "starter_pack_1_v20") return undefined;
  if (isVideoCreditPackPackageId(plan.packageId) && plan.pricingVariant !== "2.4") return undefined;
  const imageCount = getCreditPackImageCount(plan);
  if (imageCount <= 1) return undefined;
  const amount = Number(getCreditPackPriceLabel(plan).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  const unitPrice = amount / imageCount;
  const formatted = plan.pricingVariant === "2.4"
    ? unitPrice.toFixed(2)
    : String(Number(unitPrice.toFixed(2)));
  const symbol = plan.currency === "GBP" ? "£" : plan.currency === "CAD" ? "C$" : "$";
  return `${symbol}${formatted}/image`;
}

function getUpgradeModalCtaLabel(plan?: SubscriptionModalPlanOption): string {
  const planName = plan?.name.toLowerCase();
  if (plan?.pricingVariant === "2.4" && plan.checkoutPlan === "basic") return "Get Starter";
  if ((plan?.pricingVariant === "2.1" || plan?.pricingVariant === "2.2" || plan?.pricingVariant === "2.4") && planName === "basic") return "Get Basic";
  if (planName === "starter") return "Get started";
  if (planName === "pro") return "Get Pro";
  if (planName === "max") return "Get Max";
  return plan?.displayName ? `Get ${plan.displayName}` : "Get started";
}

function isIncludedInCurrentPlan(planName: string, accountPlan: string): boolean {
  const planRank: Record<string, number> = { basic: 1, pro: 2, max: 3 };
  const selectedRank = planRank[planName];
  const accountRank = planRank[accountPlan];
  return selectedRank !== undefined && accountRank !== undefined && selectedRank < accountRank;
}

function getIncludedPlanLabel(accountPlan: string): string {
  return accountPlan === "max" ? "Included in Max" : "Included in Pro";
}

function getPlanBadgeLabel(plan: SubscriptionModalPlanOption, badge = plan.badge): string | undefined {
  const isRecommended = badge?.trim().toLowerCase() === "recommended";
  const isAnnualPro = plan.kind === "subscription"
    && plan.name.toLowerCase() === "pro"
    && plan.billingInterval === "year";
  return isRecommended || isAnnualPro ? "Most Popular" : badge;
}

function formatSubscriptionExportAllowanceCopy(value?: string): string {
  return (value ?? "").replace(/\bimages\b/i, "HD exports");
}

function formatSubscriptionExportCountCopy(value?: string): string {
  return formatSubscriptionExportAllowanceCopy(value)
    .replace(/^≈\s*/, "");
}

function formatSubscriptionApproxImageCountCopy(value?: string): string {
  return (value ?? "")
    .replace(/^≈\s*/, "about ")
    .replace(/\bimages\b/i, "HD images");
}

function getCheckoutTrustLine(plan: SubscriptionModalPlanOption): string {
  if (plan.kind === "one_time" && plan.pricingVariant === "2.4") {
    return `${plan.price} one-time payment · Credits valid for 90 days`;
  }
  const selectedName = isVideoCreditPackPackageId(plan.packageId) ? plan.creditsLabel : plan.displayName;
  return plan.kind === "one_time"
    ? `Selected: ${selectedName} · Secure checkout · No subscription`
    : `Selected: ${plan.displayName} ${getBillingIntervalLabel(plan.billingInterval)} · Secure checkout · Cancel anytime`;
}

function getCheckoutPaymentExplanation(plan: SubscriptionModalPlanOption): string {
  return plan.kind === "one_time"
    ? `Today: ${plan.price} · One-time payment · No subscription`
    : `Today: ${formatCheckoutAmountDueToday(plan.price, plan.billingInterval, plan.currency, plan.value)} · Renews ${plan.billingInterval === "year" ? "yearly" : "monthly"} · Cancel anytime`;
}

function getUpgradeModalPlanSubtitle(plan: SubscriptionModalPlanOption, options?: { sourceUseCase?: string }): string {
  if (options?.sourceUseCase === "tattoo-generator") {
    const planName = plan.name.toLowerCase();
    if (planName === "starter") return "For testing a first tattoo direction and exporting a clean reference.";
    if (planName === "pro") return "For refining tattoo concepts into stencil-style and placement-ready variations.";
    if (planName === "max") return "For larger tattoo batches, style studies, and high-volume concept work.";
  }
  const planName = plan.name.toLowerCase();
  if (plan.pricingVariant === "2.2" && planName === "basic") return "For occasional image creation. Video generation is not included.";
  if (plan.pricingVariant === "2.4" && planName === "basic") return "For occasional image and video creation.";
  if (plan.pricingVariant === "2.1" && planName === "basic") return "For occasional image and video creation.";
  if (planName === "starter") return "For first-timers bringing a small idea to life.";
  if (planName === "pro") return "For growing creators producing visuals every month.";
  if (planName === "max") return "For teams and power users creating at full scale.";
  return plan.shortNote ?? "";
}

function getUpgradeModalPlanBenefits(plan: SubscriptionModalPlanOption, options?: { sourceUseCase?: string }): UpgradeModalPlanBenefit[] {
  const planName = plan.name.toLowerCase();
  const exportFormatBenefits: UpgradeModalPlanBenefit[] = planName === "pro"
    && (plan.pricingVariant === "1.9" || plan.pricingVariant === "2.5")
    ? [{ strong: "Export as PDF, PNG & JPG" }]
    : [];
  if (options?.sourceUseCase === "tattoo-generator") {
    if (planName === "starter") {
      return [
        { strong: "Stencil-style output", copy: "for cleaner linework references" },
        { strong: "Body placement preview", copy: "for scale and fit checks" },
        { strong: "HD export", copy: "for finished reference images" },
        { strong: "Private saved designs", copy: "in your workspace" }
      ];
    }
    if (planName === "pro") {
      return [
        { strong: "Unlock all variants", copy: "without watermarks" },
        { strong: "4x / 4K export", copy: "for sharper stencil and preview files" },
        ...exportFormatBenefits,
        { strong: "More style + placement templates", copy: "for tattoo-specific exploration" },
        { strong: "Complexity, line weight, and color controls" },
        { strong: "Private saved designs", copy: "keeps your tattoo ideas organized" }
      ];
    }
    if (planName === "max") {
      return [
        { strong: "Everything in Pro", copy: "for tattoo concept production" },
        { strong: "High-volume variant generation", copy: "for sleeves, coverups, and style studies" },
        { strong: "4x / 4K export", copy: "with more monthly credits" },
        { strong: "Private saved designs", copy: "across larger batches" }
      ];
    }
  }
  if (plan.pricingVariant === "2.5") {
    const isMax = planName === "max";
    return [
      { strong: `${isMax ? "6,000" : "1,500"} credits/month,`, copy: plan.billingInterval === "year" ? "billed annually" : "cancel anytime" },
      { strong: `Up to ${isMax ? "600" : "150"} 1K images or ${isMax ? "60" : "15"} videos/month`, copy: "Videos: 720p, 5 seconds" },
      { strong: "Export in 2K & 4K" },
      ...exportFormatBenefits,
      { strong: "Commercial use", copy: "included" },
      { strong: isMax ? "Higher priority" : "Failed generations", copy: isMax ? "for faster generation" : "auto-refunded" }
    ];
  }
  if (plan.pricingVariant === "2.2") {
    const basicImageAllowance = 10;
    const proImageAllowance = 100;
    const allowance = planName === "basic"
      ? `Up to ${basicImageAllowance} HD images/month · No video generation`
      : planName === "pro"
        ? `Up to ${proImageAllowance} HD images or 10 videos/month`
        : "Up to 1,000 HD images or 100 videos/month";
    return [
      { strong: planName === "basic" ? `Up to ${basicImageAllowance} HD images/month` : allowance, copy: planName === "basic" ? "· No video included" : undefined },
      { strong: "Export in 2K & 4K", copy: "· Free is a 512px preview" },
      { strong: "Commercial use", copy: "included" },
      { strong: planName === "max" ? "Highest priority for the fastest generation speeds" : "Failed edits auto-refunded" }
    ];
  }
  if (plan.pricingVariant === "2.4") {
    const allowance = planName === "basic"
      ? "Up to 100 HD images or 10 videos/month"
      : planName === "pro"
        ? "Up to 300 HD images or 30 videos/month"
        : "Up to 1,000 HD images or 100 videos/month";
    return [
      { strong: allowance },
      { strong: "Export in 2K & 4K", copy: "· Free is a 512px preview" },
      { strong: "Commercial use", copy: "included" },
      { strong: planName === "max" ? "Highest priority for the fastest generation speeds" : "Failed edits auto-refunded" }
    ];
  }
  if (plan.pricingVariant === "2.1") {
    const allowance = planName === "basic"
      ? "Up to 20 HD images or 4 videos/month"
      : planName === "pro"
        ? "Up to 100 HD images or 20 videos/month"
        : "Up to 1,000 HD images or 200 videos/month";
    return [
      { strong: allowance },
      { strong: "Export in 2K & 4K" },
      { strong: "Commercial use", copy: "included" },
      { strong: planName === "max" ? "Higher priority" : "Cancel anytime" }
    ];
  }
  if (planName === "starter") {
    return [
      { strong: "200 one-time credits,", copy: "no subscription" },
      { strong: "Up to ~20 HD images" },
      { strong: "Refine images", copy: "with the Vismuse agent" },
      { strong: "Commercial use", copy: "included" }
    ];
  }
  if (planName === "pro") {
    return [
      { strong: "2,000 credits/month,", copy: "cancel anytime" },
      { strong: "Up to ~200 HD images or ~10 videos/month" },
      { strong: "Export in 2K & 4K" },
      ...exportFormatBenefits,
      { strong: "Commercial use", copy: "included" },
      { strong: "Failed generations", copy: "auto-refunded" }
    ];
  }
  if (planName === "max") {
    if (plan.pricingVariant === "1.9" || plan.pricingVariant === "2.0") {
      return [
        { strong: "20,000 credits/month,", copy: "cancel anytime" },
        { strong: "Up to ~2,000 HD images or ~100 videos/month" },
        { strong: "Export in 2K & 4K" },
        { strong: "Commercial use", copy: "included" },
        { strong: "Higher priority", copy: "for faster generation" }
      ];
    }
    if (plan.pricingVariant === "1.7") {
      return [
        { strong: "10,000 credits/month,", copy: "cancel anytime" },
        { strong: "Up to ~1,000 HD images or ~50 videos/month" },
        { strong: "Export in 2K & 4K" },
        { strong: "Commercial use", copy: "included" },
        { strong: "Higher priority", copy: "for faster generation" }
      ];
    }
    return [
      { strong: "10,000 credits/month,", copy: "for high-volume work" },
      { strong: "Up to ~1,000 HD images" },
      { strong: "Everything in Pro" },
      { strong: "Higher priority", copy: "for faster generation" }
    ];
  }
  return [{ strong: plan.priceLineLabel }];
}

function getAccountUpgradePlanBenefits(plan: SubscriptionModalPlanOption, options?: { sourceUseCase?: string }): UpgradeModalPlanBenefit[] {
  const benefits = getUpgradeModalPlanBenefits(plan, options);
  const planName = plan.name.toLowerCase();
  let accountBenefits = benefits;
  if (planName === "pro" && benefits.some((benefit) => benefit.strong === "Export in 2K & 4K")
    && benefits.some((benefit) => benefit.strong === "Export as PDF, PNG & JPG")) {
    accountBenefits = benefits
      .filter((benefit) => benefit.strong !== "Export as PDF, PNG & JPG")
      .map((benefit) => benefit.strong === "Export in 2K & 4K"
        ? { strong: "Export in 2K & 4K · PDF, PNG & JPG" }
        : benefit);
  }
  if (planName === "max") {
    const sharedBenefits = new Set([
      "Everything in Pro",
      "Export in 2K & 4K",
      "Commercial use",
      "4x / 4K export",
      "Private saved designs"
    ]);
    const maxBenefits = benefits.filter((benefit) => !sharedBenefits.has(benefit.strong));
    accountBenefits = [
      ...maxBenefits.slice(0, 2),
      { strong: "Everything in Pro" },
      ...maxBenefits.slice(2)
    ];
  }
  if (planName !== "pro" && planName !== "max") return accountBenefits;
  if (plan.billingInterval === "year") {
    return accountBenefits.map((benefit) => benefit.copy === "cancel anytime"
      ? { ...benefit, copy: "billed annually" }
      : benefit);
  }
  return accountBenefits.map((benefit, index) => index < 2
    ? { ...benefit, strong: benefit.strong.replace(/\/month\b|\s+per month\b/gi, "") }
    : benefit);
}

function AppUpgradePricingModal({
  initialBillingInterval,
  accountPlan = "free",
  sourceUseCase,
  title,
  subtitle,
  pricingVariant,
  plans: inputPlans,
  pendingPackage,
  error,
  onClose,
  onSubscribe,
  onPlanSelect,
  onAddCredits
}: AppSubscriptionUpgradeModalProps) {
  const uiLocale = useUiLocale();
  const plans = useMemo(
    () => filterUpgradePlansForSourceUseCase(inputPlans, sourceUseCase),
    [inputPlans, sourceUseCase]
  );
  const isUpgradePricingVersion18 = plans.some((plan) => plan.pricingVariant === "1.8");
  const usesUpgradeAnnualBilling = plans.some((plan) => usesAnnualBillingToggle(plan.pricingVariant));
  const upgradeBillingIntervals = useMemo(() => getAvailableBillingIntervals(plans), [plans]);
  const defaultUpgradeBillingInterval: SubscriptionBillingInterval = initialBillingInterval ?? (pricingVariant === "2.3" ? "year" : "month");
  const [upgradeBillingIntervalSelection, setUpgradeBillingIntervalSelection] = useState<{
    pricingVariant: PricingVariant;
    interval: SubscriptionBillingInterval;
  }>(() => ({
    pricingVariant,
    interval: defaultUpgradeBillingInterval
  }));
  const selectedUpgradeBillingInterval = upgradeBillingIntervalSelection.pricingVariant === pricingVariant
    ? upgradeBillingIntervalSelection.interval
    : defaultUpgradeBillingInterval;
  const showUpgradeBillingIntervalToggle = usesUpgradeAnnualBilling && upgradeBillingIntervals.length > 1;
  const isUpgradeAnnualBillingSelected = selectedUpgradeBillingInterval === "year";
  const upgradeAnnualSaveLabel = showUpgradeBillingIntervalToggle
    ? getBillingIntervalToggleSaveLabel("year", plans)
    : undefined;
  const visibleUpgradeModalPlans = useMemo(
    () => {
      const subscriptionOnlyPlans = plans.filter((plan) => plan.kind === "subscription");
      const intervalPlans = filterPlansForBillingInterval(
        subscriptionOnlyPlans.length ? subscriptionOnlyPlans : plans,
        selectedUpgradeBillingInterval,
        showUpgradeBillingIntervalToggle
      );
      return intervalPlans;
    },
    [plans, selectedUpgradeBillingInterval, showUpgradeBillingIntervalToggle]
  );
  const [selectedUpgradePackageId, setSelectedUpgradePackageId] = useState<RechargePackageId>(() => (
    getDefaultAvailableUpgradeModalPackageId(visibleUpgradeModalPlans, accountPlan)
  ));
  const [upgradePricingFaqOpen, setUpgradePricingFaqOpen] = useState<string | null>("credits");
  const effectiveSelectedUpgradePackageId = visibleUpgradeModalPlans.some((plan) => (
    plan.packageId === selectedUpgradePackageId && !isUnavailableForCurrentPlan(plan, accountPlan)
  ))
    ? selectedUpgradePackageId
    : getDefaultAvailableUpgradeModalPackageId(visibleUpgradeModalPlans, accountPlan);
  const selectedUpgradePlan = useMemo(() => (
    visibleUpgradeModalPlans.find((plan) => plan.packageId === effectiveSelectedUpgradePackageId)
    ?? visibleUpgradeModalPlans[0]
  ), [effectiveSelectedUpgradePackageId, visibleUpgradeModalPlans]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function toggleUpgradeBillingInterval() {
    const nextInterval: SubscriptionBillingInterval = isUpgradeAnnualBillingSelected ? "month" : "year";
    selectUpgradeBillingInterval(nextInterval);
  }

  function selectUpgradeBillingInterval(nextInterval: SubscriptionBillingInterval) {
    if (nextInterval === selectedUpgradeBillingInterval) return;
    const currentPackage = plans.find((item) => item.packageId === effectiveSelectedUpgradePackageId);
    const replacement = findBillingIntervalPlan(plans, nextInterval, currentPackage);
    if (replacement && replacement.packageId !== effectiveSelectedUpgradePackageId) {
      onPlanSelect?.(replacement.packageId, effectiveSelectedUpgradePackageId);
      setSelectedUpgradePackageId(replacement.packageId);
    }
    setUpgradeBillingIntervalSelection({ pricingVariant, interval: nextInterval });
  }

  function selectPlanFromUpgradePricingModal(packageId: RechargePackageId) {
    if (packageId === effectiveSelectedUpgradePackageId) return;
    const plan = visibleUpgradeModalPlans.find((item) => item.packageId === packageId);
    if (!plan || isUnavailableForCurrentPlan(plan, accountPlan)) return;
    onPlanSelect?.(packageId, effectiveSelectedUpgradePackageId);
    setSelectedUpgradePackageId(packageId);
  }

  if (!visibleUpgradeModalPlans.length) return null;

  const pricingModalClassName = [
    styles.pricingModal,
    styles.appSubscriptionModal,
    isUpgradePricingVersion18 ? styles.pricingModalV18 : ""
  ].filter(Boolean).join(" ");

  const modal = localizeUiTree((
    <div className={`${styles.pricingModalBackdrop} ${styles.appSubscriptionModalBackdrop}`} role="presentation" onClick={onClose}>
      <div className={pricingModalClassName} role="dialog" aria-modal="true" aria-labelledby="resolution-upgrade-title" onClick={(event) => event.stopPropagation()}>
        <nav className={styles.pricingModalNav} aria-label="Pricing dialog navigation">
          <button
            type="button"
            className={styles.pricingModalBack}
            onClick={onClose}
            aria-label="Close pricing dialog"
          >
            <ChevronLeft size={22} aria-hidden="true" />
            <Image src="/assets/socialmedia/logo.png" alt="Vismuse" width={30} height={30} />
          </button>
          <button
            type="button"
            className={styles.pricingModalClose}
            onClick={onClose}
            aria-label="Close pricing dialog"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </nav>

        <div className={styles.pricingModalBody}>
          <div className={styles.pricingModalHead}>
            <h2 id="resolution-upgrade-title">{title ?? "Choose your plan"}</h2>
            <p>{subtitle ?? <>More credits. High-res exports.<br />Commercial use included.</>}</p>
          </div>

          {error ? <p className={styles.pricingModalError}>{error}</p> : null}

          {showUpgradeBillingIntervalToggle ? (
            <div className={isUpgradePricingVersion18 ? styles.subscriptionBillingRow : styles.pricingBillingRow} aria-label="Choose billing interval">
              {isUpgradePricingVersion18 ? (
                <div className={styles.billingSegmentedControl} role="group" aria-label="Choose billing interval">
                  <button
                    type="button"
                    className={`${styles.billingSegmentedOption} ${!isUpgradeAnnualBillingSelected ? styles.billingSegmentedOptionSelected : ""}`.trim()}
                    onClick={() => selectUpgradeBillingInterval("month")}
                    aria-pressed={!isUpgradeAnnualBillingSelected}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    className={`${styles.billingSegmentedOption} ${isUpgradeAnnualBillingSelected ? styles.billingSegmentedOptionSelected : ""}`.trim()}
                    onClick={() => selectUpgradeBillingInterval("year")}
                    aria-pressed={isUpgradeAnnualBillingSelected}
                  >
                    Yearly{upgradeAnnualSaveLabel ? (
                      <> · <span className={styles.billingSegmentedSave}>{upgradeAnnualSaveLabel}</span></>
                    ) : null}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.billingSwitchButton}
                  onClick={toggleUpgradeBillingInterval}
                  aria-pressed={isUpgradeAnnualBillingSelected}
                >
                  <span className={styles.billingSwitchText}>Annually</span>
                  {upgradeAnnualSaveLabel ? (
                    <span className={styles.billingSwitchOffer}>
                      <span className={styles.billingSwitchSave}>{upgradeAnnualSaveLabel}</span>
                      {pricingVariant !== "1.9" && pricingVariant !== "2.5" ? <span className={styles.billingSwitchLimitedTime}>Limited-time offer</span> : null}
                    </span>
                  ) : null}
                  <span
                    className={`${styles.billingSwitchTrack} ${isUpgradeAnnualBillingSelected ? styles.billingSwitchTrackOn : ""}`.trim()}
                    aria-hidden="true"
                  >
                    <span className={styles.billingSwitchThumb} />
                  </span>
                </button>
              )}
            </div>
          ) : null}

          <div className={styles.pricingModalDesktopPlans}>
            <div className={styles.pricingModalGrid} aria-label="Pricing plans">
              {visibleUpgradeModalPlans.map((plan, planIndex) => {
                const isCurrentPlan = plan.kind === "subscription" && plan.name.toLowerCase() === accountPlan;
                const isIncludedInCurrent = plan.kind === "subscription" && isIncludedInCurrentPlan(plan.name.toLowerCase(), accountPlan);
                const disabled = pendingPackage !== "" || isCurrentPlan || isIncludedInCurrent;
                const isHighlighted = plan.name.toLowerCase() === "pro" && !isCurrentPlan;
                const Icon = plan.name.toLowerCase() === "max" ? Zap : Crown;
                const planPending = pendingPackage === plan.packageId;
                const planBadge = plan.pricingVariant === "1.9" && plan.name.toLowerCase() === "max"
                  ? "10× Credits"
                  : getPlanBadgeLabel(plan);
                const showBadgeByTitle = (plan.name.toLowerCase() === "pro" && planBadge === "Most Popular")
                  || (plan.name.toLowerCase() === "max" && planBadge === "10× Credits");
                return (
                  <article
                    key={plan.packageId}
                    data-pricing-modal-plan-card={plan.name.toLowerCase()}
                    data-pricing-modal-plan-index={planIndex}
                    className={`${styles.pricingPlanCard} ${isHighlighted ? styles.pricingPlanFeatured : ""}`.trim()}
                    aria-label={`${plan.displayName} plan`}
                  >
                    <Icon className={styles.pricingPlanIcon} size={34} aria-hidden="true" />
                    <h3 className={styles.pricingPlanTitle}>
                      {plan.displayName}
                      {showBadgeByTitle ? <span className={styles.pricingPlanBadge}>{planBadge}</span> : null}
                    </h3>
                    <p className={styles.pricingPlanSub}>{getUpgradeModalPlanSubtitle(plan, { sourceUseCase })}</p>
                    <p className={styles.pricingPlanPrice}>
                      {plan.price}
                      {plan.originalPrice ? <del>{plan.originalPrice}</del> : null}
                      <span>{plan.kind === "subscription"
                        ? `${plan.currency !== "USD" ? "/ month" : "USD / month"}${plan.billingInterval !== "year" && plan.billingNote ? `, ${plan.billingNote}` : ""}`
                        : plan.currency !== "USD" ? "one-time" : "USD one-time"}</span>
                    </p>
                    {plan.billingInterval === "year" ? (
                      <p className={styles.pricingPlanAnnualTotal}>
                        {formatCheckoutAmountDueToday(plan.price, plan.billingInterval, plan.currency, plan.value)} billed yearly
                      </p>
                    ) : null}
                    {plan.discountPercent && plan.billingInterval !== "year" ? <span className={styles.pricingPlanDiscountBadge}>{formatDiscountPercentLabel(plan.discountPercent)}</span> : null}
                    {plan.billingInterval !== "year" && plan.savings ? <span className={styles.pricingPlanDiscountBadge}>{plan.savings}</span> : null}
                    {planBadge && !showBadgeByTitle && !(plan.billingInterval === "year" && /^save\b/i.test(planBadge)) ? <span className={styles.pricingPlanBadge}>{planBadge}</span> : null}
                    <button
                      type="button"
                      className={`${styles.pricingPlanButton} ${isHighlighted ? styles.pricingPlanButtonHighlight : ""}`.trim()}
                      onClick={() => onSubscribe(plan.packageId)}
                      disabled={disabled}
                    >
                      {isCurrentPlan
                        ? "Current plan"
                        : isIncludedInCurrent
                          ? getIncludedPlanLabel(accountPlan)
                          : planPending
                            ? "Processing..."
                            : getUpgradeModalCtaLabel(plan)}
                    </button>
                    {!isCurrentPlan && !isIncludedInCurrent ? (
                      <p className={styles.pricingPlanPaymentExplanation}>{getCheckoutPaymentExplanation(plan)}</p>
                    ) : null}
                    <ul>
                      {getAccountUpgradePlanBenefits(plan, { sourceUseCase }).map((benefit) => (
                        <li key={`${benefit.strong}-${benefit.copy ?? ""}`}>
                          <Check size={15} aria-hidden="true" />
                          <span><strong>{benefit.strong}</strong>{benefit.copy ? ` ${benefit.copy}` : ""}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>

          <div className={[
            styles.pricingModalMobilePlans,
            styles.accountUpgradePlans,
            isUpgradePricingVersion18 ? styles.subscriptionModalV18 : "",
            isUpgradePricingVersion18 ? styles.subscriptionModalFrameV18 : "",
            isUpgradePricingVersion18 ? styles.pricingModalPlansV18 : ""
          ].filter(Boolean).join(" ")}>
            <div className={isUpgradePricingVersion18 ? styles.subscriptionPlanSelector : styles.pricingMobilePlanList} aria-label="Pricing plans">
              {visibleUpgradeModalPlans.map((plan, planIndex) => {
                const isCurrentPlan = plan.kind === "subscription" && plan.name.toLowerCase() === accountPlan;
                const isIncludedInCurrent = plan.kind === "subscription" && isIncludedInCurrentPlan(plan.name.toLowerCase(), accountPlan);
                const disabled = pendingPackage !== "" || isCurrentPlan || isIncludedInCurrent;
                const selected = effectiveSelectedUpgradePackageId === plan.packageId;
                const monthlyPlan = plans.find((item) => item.checkoutPlan === plan.checkoutPlan && item.billingInterval === "month");
                const isAnnualMaxV19 = plan.pricingVariant === "1.9" && plan.name.toLowerCase() === "max" && plan.billingInterval === "year";
                const rawPlanBadge = isAnnualMaxV19 ? monthlyPlan?.badge ?? plan.badge : plan.badge;
                const planBadge = isCurrentPlan
                  ? "Current plan"
                  : isIncludedInCurrent
                    ? getIncludedPlanLabel(accountPlan)
                    : getPlanBadgeLabel(plan, rawPlanBadge) ?? (plan.kind === "subscription" ? "Monthly" : "One-time");
                const secondaryPlanBadge = isAnnualMaxV19 && !isCurrentPlan && !isIncludedInCurrent ? plan.badge : undefined;
                const planBenefits = getAccountUpgradePlanBenefits(plan, { sourceUseCase });
                const annualOriginalTotal = plan.billingInterval === "year" && plan.originalPrice && monthlyPlan
                  ? formatBillingAmount(monthlyPlan.value * 12, plan.currency)
                  : null;
                return (
                  <button
                    type="button"
                    key={plan.packageId}
                    data-pricing-modal-plan-card={plan.name.toLowerCase()}
                    data-pricing-modal-plan-interval={plan.billingInterval ?? "one-time"}
                    data-pricing-modal-plan-index={planIndex}
                    className={[
                      styles.subscriptionPlanOption,
                      selected ? styles.subscriptionPlanOptionSelected : ""
                    ].filter(Boolean).join(" ")}
                    onClick={() => selectPlanFromUpgradePricingModal(plan.packageId)}
                    disabled={disabled}
                    aria-pressed={selected}
                    aria-label={`${plan.displayName} plan. ${planBenefits.map((benefit) => `${benefit.strong}${benefit.copy ? ` ${benefit.copy}` : ""}`).join(". ")}`}
                  >
                    <span className={styles.subscriptionPlanOptionRadio} aria-hidden="true">
                      {selected ? <Check size={18} aria-hidden="true" /> : null}
                    </span>
                    <span className={styles.subscriptionPlanOptionCopy}>
                      <strong className={styles.subscriptionPlanOptionName}>{plan.displayName}</strong>
                      {planBadge ? <span className={styles.subscriptionPlanOptionMeta}>{planBadge}</span> : null}
                      {secondaryPlanBadge ? <span className={styles.subscriptionPlanOptionMeta}>{secondaryPlanBadge}</span> : null}
                    </span>
                    <span className={styles.subscriptionPlanOptionPriceBlock}>
                      <span className={[styles.subscriptionPlanOptionPrice, plan.billingInterval === "year" ? styles.subscriptionPlanOptionAnnualPrice : ""].filter(Boolean).join(" ")}>
                        <strong>{plan.price}</strong>
                        <small>{getBillingIntervalSuffix(plan)}</small>
                        {plan.originalPrice ? <del>{plan.originalPrice}</del> : null}
                      </span>
                      {plan.billingInterval === "year" ? (
                        <span className={styles.pricingPlanAnnualTotal}>
                          <span className={styles.pricingPlanAnnualTotalLabel}>Total</span>
                          <strong>{formatCheckoutAmountDueToday(plan.price, plan.billingInterval, plan.currency, plan.value)}</strong>
                          <small>/year</small>
                          {annualOriginalTotal ? <del>{annualOriginalTotal}</del> : null}
                        </span>
                      ) : null}
                      <span className={styles.subscriptionPlanOptionDealRow}>
                        {plan.billingInterval !== "year" && plan.billingNote && canShowSubscriptionPlanOptionSavings(plan) ? <span className={styles.subscriptionPlanOptionSavings}>{plan.billingNote}</span> : null}
                        {plan.discountPercent && plan.billingInterval !== "year" ? (
                          <span className={styles.subscriptionPlanOptionDiscountBadge}>{formatDiscountPercentLabel(plan.discountPercent)}</span>
                        ) : null}
                        {plan.billingInterval !== "year" && plan.savings && canShowSubscriptionPlanOptionSavings(plan) ? <span className={styles.subscriptionPlanOptionSavings}>{plan.savings}</span> : null}
                      </span>
                    </span>
                    <span className={styles.pricingModalPlanOptionBenefits} aria-hidden="true">
                      {planBenefits.map((benefit) => (
                        <span key={`${benefit.strong}-${benefit.copy ?? ""}`}>
                          <Check size={14} aria-hidden="true" />
                          <span><strong>{benefit.strong}</strong>{benefit.copy ? ` ${benefit.copy}` : ""}</span>
                        </span>
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
            {selectedUpgradePlan ? (() => {
              const isCurrentPlan = selectedUpgradePlan.kind === "subscription" && selectedUpgradePlan.name.toLowerCase() === accountPlan;
              const isIncludedInCurrent = selectedUpgradePlan.kind === "subscription" && isIncludedInCurrentPlan(selectedUpgradePlan.name.toLowerCase(), accountPlan);
              const selectedPlanPending = pendingPackage === selectedUpgradePlan.packageId;
              const disabled = pendingPackage !== "" || isCurrentPlan || isIncludedInCurrent;
              return (
                <>
                  <button
                    type="button"
                    className={styles.pricingModalPrimaryButton}
                    onClick={() => onSubscribe(selectedUpgradePlan.packageId)}
                    disabled={disabled}
                  >
                    {isCurrentPlan
                      ? "Current plan"
                      : isIncludedInCurrent
                        ? getIncludedPlanLabel(accountPlan)
                        : selectedPlanPending
                          ? "Processing..."
                          : getUpgradeModalCtaLabel(selectedUpgradePlan)}
                  </button>
                  {!isCurrentPlan && !isIncludedInCurrent ? (
                    <p className={styles.pricingCheckoutFootnote}>
                      {getCheckoutPaymentExplanation(selectedUpgradePlan)}
                    </p>
                  ) : null}
                </>
              );
            })() : null}
          </div>

          {onAddCredits ? (
            <div className={styles.pricingAddCreditsEntry}>
              <button
                type="button"
                className={styles.pricingAddCreditsButton}
                onClick={onAddCredits}
                disabled={pendingPackage !== ""}
              >
                <span>Add credits</span>
                <ArrowRight size={17} aria-hidden="true" />
              </button>
              <p>One-time credit packs are valid for {pricingVariant === "2.4" ? "90 days" : "one year"}.</p>
            </div>
          ) : null}

          <section className={styles.pricingFaq} aria-labelledby="pricing-faq-title">
            <h3 id="pricing-faq-title">Frequently Asked Questions</h3>
            <div className={styles.pricingFaqList}>
              {UPGRADE_PRICING_FAQS.map((item) => {
                const isOpen = upgradePricingFaqOpen === item.id;
                return (
                  <article className={styles.pricingFaqItem} key={item.id}>
                    <button
                      type="button"
                      className={styles.pricingFaqQuestion}
                      onClick={() => setUpgradePricingFaqOpen(isOpen ? null : item.id)}
                      aria-expanded={isOpen}
                    >
                      <span>{item.question}</span>
                      <ChevronRight className={isOpen ? styles.pricingFaqChevronOpen : undefined} size={18} aria-hidden="true" />
                    </button>
                    {isOpen ? <p className={styles.pricingFaqAnswer}>{item.answer}</p> : null}
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  ), uiLocale);

  // Settings and other account dialogs already render at the document root.
  // Portal the upgrade modal there as well so mobile shell stacking contexts
  // cannot place pricing underneath the dialog that opened it.
  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}

function ImageSubscriptionGateModal({
  sourceUseCase,
  pricingVariant,
  image,
  selectableImages = [image],
  onImageSelect,
  plans,
  subscribePendingPackage,
  unlockPending,
  error,
  onClose,
  onSubscribe,
  onPlanSelect,
  onCreditPackViewOpen,
  onCreditPackPlanSelect,
  onCreditPackSubscribe,
  onUnlock,
  onDownloadWatermarked,
  accountPlan = "free"
}: AppSubscriptionImageModalProps) {
  const uiLocale = useUiLocale();
  const [selectedBillingInterval, setSelectedBillingInterval] = useState<SubscriptionBillingInterval>(pricingVariant === "2.3" ? "year" : "month");
  useEffect(() => {
    setSelectedBillingInterval(pricingVariant === "2.3" ? "year" : "month");
  }, [pricingVariant]);
  const [selectedPackageId, setSelectedPackageId] = useState<RechargePackageId>(() => (
    getDefaultAvailableUpgradeModalPackageId(plans, accountPlan)
  ));
  const [downloadingWatermarked, setDownloadingWatermarked] = useState(false);
  const [watermarkedDownloadCompleted, setWatermarkedDownloadCompleted] = useState(false);
  const [watermarkedDownloadBytes, setWatermarkedDownloadBytes] = useState<number | undefined>();
  const preview = useRetryingImagePreview(image.url);
  const previewLoadStartedAtRef = useRef(Date.now());
  const [expandedPreviewOpen, setExpandedPreviewOpen] = useState(false);
  const [mobileBenefitsOpen, setMobileBenefitsOpen] = useState(false);
  const [purchaseView, setPurchaseView] = useState<"subscription" | "credit_pack">("subscription");
  const subscriptionPlans = useMemo(() => {
    const subscriptionOnlyPlans = plans.filter((item) => item.kind === "subscription");
    return subscriptionOnlyPlans.length ? subscriptionOnlyPlans : plans;
  }, [plans]);
  const availableBillingIntervals = getAvailableBillingIntervals(subscriptionPlans);
  const showBillingIntervalToggle = subscriptionPlans.some((item) => usesAnnualBillingToggle(item.pricingVariant))
    && availableBillingIntervals.length > 1;
  const isAnnualBillingSelected = selectedBillingInterval === "year";
  const annualSaveLabel = showBillingIntervalToggle
    ? getBillingIntervalToggleSaveLabel("year", subscriptionPlans)
    : undefined;
  const visiblePlans = useMemo(
    () => filterPlansForBillingInterval(subscriptionPlans, selectedBillingInterval, showBillingIntervalToggle),
    [selectedBillingInterval, showBillingIntervalToggle, subscriptionPlans]
  );
  const creditPackPlans = useMemo(() => (
    plans
      .filter((item) => (
        item.kind === "one_time"
        && item.checkoutPlan === "starter"
      ))
      .sort((left, right) => getCreditPackImageCount(left) - getCreditPackImageCount(right))
  ), [plans]);
  const [selectedCreditPackPackageId, setSelectedCreditPackPackageId] = useState<RechargePackageId | undefined>(() => (
    getDefaultCreditPackPackageId(plans)
  ));
  const effectiveSelectedPackageId = visiblePlans.some((item) => (
    item.packageId === selectedPackageId && !isUnavailableForCurrentPlan(item, accountPlan)
  ))
    ? selectedPackageId
    : getDefaultAvailableUpgradeModalPackageId(visiblePlans, accountPlan);
  const effectiveSelectedCreditPackPackageId = creditPackPlans.some((item) => item.packageId === selectedCreditPackPackageId)
    ? selectedCreditPackPackageId
    : getDefaultCreditPackPackageId(creditPackPlans);
  const selectedPlan = useMemo(() => (
    visiblePlans.find((item) => item.packageId === effectiveSelectedPackageId)
    ?? visiblePlans[0]
  ), [effectiveSelectedPackageId, visiblePlans]);
  const selectedCreditPack = useMemo(() => (
    creditPackPlans.find((item) => item.packageId === effectiveSelectedCreditPackPackageId)
    ?? creditPackPlans[0]
  ), [creditPackPlans, effectiveSelectedCreditPackPackageId]);
  const previewChoices = selectableImages.filter((item) => item.url);
  const showPreviewChoices = previewChoices.length > 1;
  const isMaskedBlurPreview = image.previewVariant === "masked_blur";
  const isWatermarkedPreview = image.previewVariant === "watermarked" || image.accessVariant === "watermarked";
  const isSelectedOneTimePlan = selectedPlan?.kind === "one_time";
  const isSelectedPricingVersion17 = usesAnnualBillingToggle(selectedPlan?.pricingVariant);
  const shouldPlaceFootnoteBelowPrimaryButton = selectedPlan?.pricingVariant === "1.9"
    || selectedPlan?.pricingVariant === "2.0"
    || selectedPlan?.pricingVariant === "2.4"
    || selectedPlan?.pricingVariant === "2.5";
  const isLowResCleanPreview = image.previewVariant === "low_res_clean";
  const isRegisteredLockedPreview = isMaskedBlurPreview;
  const canDownloadWatermarkedPreview = isWatermarkedPreview && !isMaskedBlurPreview;
  const selectedPlanName = selectedPlan?.displayName ?? "Pro";
  const selectedPlanCtaLabel = `Get ${selectedPlanName}`;
  const selectedPlanCredits = selectedPlan?.creditsLabel ?? "";
  const selectedPlanPriceLineCopy = selectedPlan?.priceLineLabel.replace(/\bimages\b/i, "HD images") ?? "";
  const selectedPlanExportPriceLineCopy = formatSubscriptionExportAllowanceCopy(selectedPlan?.priceLineLabel);
  const selectedPlanExportCountLineCopy = formatSubscriptionExportCountCopy(selectedPlan?.imageCountLabel);
  const selectedPlanMonthly1kImageCount = getMonthly1kImageCount(selectedPlan?.imageCountLabel);
  const watermarkedDownloadSizeLabel = formatDownloadedFileSize(watermarkedDownloadBytes);
  const originalImageSizeLabel = formatDownloadedFileSize(image.originalSizeBytes);
  const selectedAnnualPlanMonthlyExportCountLineCopy = formatSubscriptionExportCountCopy(selectedPlan?.imageCountLabel);
  const selectedPricingVersion17PriceLine = selectedPlan?.billingInterval === "year"
    ? `${selectedAnnualPlanMonthlyExportCountLineCopy} * 12`
    : selectedPlanExportCountLineCopy;
  const selectedMonthlyImageAllowancePriceLine = selectedPlanMonthly1kImageCount
    ? `Up to ~${selectedPlanMonthly1kImageCount.toLocaleString()} HD images/month${selectedPlan?.billingInterval === "year" ? " × 12" : ""}`
    : selectedPlanExportPriceLineCopy;
  const selectedPlanPriceLine = isSelectedOneTimePlan
    ? `one-time · ${selectedPlanPriceLineCopy}`
    : selectedPlan?.pricingVariant === "1.9" || selectedPlan?.pricingVariant === "2.4" || selectedPlan?.pricingVariant === "2.5"
      ? selectedMonthlyImageAllowancePriceLine
      : isSelectedPricingVersion17
        ? selectedPricingVersion17PriceLine
        : selectedPlanExportPriceLineCopy;
  const selectedPlanApproxImageCount = formatSubscriptionApproxImageCountCopy(selectedPlan?.imageCountLabel);
  const selectedOneTimeValueCopy = `${selectedPlanCredits}, enough for ${selectedPlanApproxImageCount}`;
  const selectedPlanPaymentExplanation = selectedPlan ? getCheckoutPaymentExplanation(selectedPlan) : "";
  const subscriptionCopy = isSelectedOneTimePlan
    ? isLowResCleanPreview
      ? `Buy ${selectedPlanName} once to download the HD original image and get ${selectedOneTimeValueCopy}. No monthly plan.`
      : isRegisteredLockedPreview
        ? `Buy ${selectedPlanName} once to unlock this HD original image and get ${selectedOneTimeValueCopy}. No subscription.`
        : `You're viewing a watermarked preview. Buy ${selectedPlanName} once to unlock the HD original image and get ${selectedOneTimeValueCopy}.`
    : isLowResCleanPreview
      ? `You're viewing an ultra-low-res clean preview. Upgrade to ${selectedPlanName} to download the HD original image and get the benefits below.`
      : isRegisteredLockedPreview
        ? `You’re out of free credits, so this result is shown as a locked preview. Upgrade to ${selectedPlanName} to unlock the HD, watermark-free version and all ${selectedPlanName} benefits below.`
        : `This is a watermarked preview. Upgrade to ${selectedPlanName} for the HD, watermark-free image and all ${selectedPlanName} benefits below.`;
  const subscribePending = subscribePendingPackage !== "";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    setExpandedPreviewOpen(false);
    setWatermarkedDownloadCompleted(false);
    setWatermarkedDownloadBytes(undefined);
    previewLoadStartedAtRef.current = Date.now();
  }, [image.url]);

  useEffect(() => {
    if (!visiblePlans.length) return;
    if (visiblePlans.some((item) => (
      item.packageId === selectedPackageId && !isUnavailableForCurrentPlan(item, accountPlan)
    ))) return;
    setSelectedPackageId(getDefaultAvailableUpgradeModalPackageId(visiblePlans, accountPlan));
  }, [accountPlan, selectedPackageId, visiblePlans]);

  useEffect(() => {
    if (!creditPackPlans.length) return;
    if (creditPackPlans.some((item) => item.packageId === selectedCreditPackPackageId)) return;
    setSelectedCreditPackPackageId(getDefaultCreditPackPackageId(creditPackPlans));
  }, [creditPackPlans, selectedCreditPackPackageId]);

  function selectBillingInterval(nextInterval: SubscriptionBillingInterval) {
    if (nextInterval === selectedBillingInterval) return;
    const currentPackage = plans.find((item) => item.packageId === effectiveSelectedPackageId);
    const replacement = findBillingIntervalPlan(subscriptionPlans, nextInterval, currentPackage);
    if (replacement && replacement.packageId !== effectiveSelectedPackageId) {
      onPlanSelect?.(replacement.packageId, effectiveSelectedPackageId);
      setSelectedPackageId(replacement.packageId);
    }
    setSelectedBillingInterval(nextInterval);
  }

  function toggleBillingInterval() {
    selectBillingInterval(isAnnualBillingSelected ? "month" : "year");
  }

  function handlePlanSelect(packageId: RechargePackageId) {
    if (packageId === effectiveSelectedPackageId) return;
    const plan = visiblePlans.find((item) => item.packageId === packageId);
    if (!plan || isUnavailableForCurrentPlan(plan, accountPlan)) return;
    onPlanSelect?.(packageId, effectiveSelectedPackageId);
    setSelectedPackageId(packageId);
  }

  function handleCreditPackPlanSelect(packageId: RechargePackageId) {
    if (packageId === effectiveSelectedCreditPackPackageId) return;
    onCreditPackPlanSelect?.(packageId, effectiveSelectedCreditPackPackageId ?? packageId);
    setSelectedCreditPackPackageId(packageId);
  }

  function handleCreditPackPurchase() {
    if (!selectedCreditPack) return;
    if (onCreditPackSubscribe) {
      onCreditPackSubscribe(selectedCreditPack.packageId, image);
      return;
    }
    onSubscribe(selectedCreditPack.packageId);
  }

  function openCreditPackView() {
    const defaultPackageId = getDefaultCreditPackPackageId(creditPackPlans);
    setSelectedCreditPackPackageId(defaultPackageId);
    setPurchaseView("credit_pack");
    onCreditPackViewOpen?.(creditPackPlans.map((item) => item.packageId));
  }

  function openSubscriptionViewFromCreditPack() {
    const availablePlan = visiblePlans.find((item) => (
      item.name.toLowerCase() === "pro" && !isUnavailableForCurrentPlan(item, accountPlan)
    )) ?? visiblePlans.find((item) => !isUnavailableForCurrentPlan(item, accountPlan));
    if (availablePlan) handlePlanSelect(availablePlan.packageId);
    setPurchaseView("subscription");
  }

  function selectV24PurchaseView(nextView: "subscription" | "credit_pack") {
    if (nextView === purchaseView) return;
    setPurchaseView(nextView);
    if (nextView === "credit_pack") {
      onCreditPackViewOpen?.(creditPackPlans.map((item) => item.packageId));
    }
  }

  function handleV24PurchaseTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const nextView = event.key === "ArrowLeft" || event.key === "Home" ? "subscription" : "credit_pack";
    selectV24PurchaseView(nextView);
    window.requestAnimationFrame(() => {
      document.getElementById(nextView === "subscription" ? "subscription-purchase-tab" : "credit-pack-purchase-tab")?.focus();
    });
  }

  async function handleDownloadWatermarked() {
    if (downloadingWatermarked || !isWatermarkedPreview) return;
    setDownloadingWatermarked(true);
    try {
      const result = await onDownloadWatermarked(image);
      setWatermarkedDownloadBytes(result?.downloadedBytes);
      setWatermarkedDownloadCompleted(true);
    } finally {
      setDownloadingWatermarked(false);
    }
  }

  if (!selectedPlan) return null;

  const subscriptionModalClassName = styles.subscriptionModal;
  const subscriptionModalFrameClassName = `${styles.subscriptionModalFrame} ${styles.imageUnlockModalFrame}`;
  const subscriptionModalBackdropClassName = selectedPlan.pricingVariant === "2.4"
    ? `${styles.subscriptionModalBackdrop} ${styles.subscriptionModalBackdropV24}`
    : styles.subscriptionModalBackdrop;
  const subscribeCtaLabel = subscribePending
    ? "Processing..."
    : selectedPlan.pricingVariant === "2.4"
      ? `Get ${selectedPlanName} and unlock this image`
      : `Start ${selectedPlanName} and unlock this image`;
  const imageUnlockPriceLabel = selectedPlan.billingMarket === "gb"
    ? IMAGE_UNLOCK_GBP_PRICE_LABEL
    : selectedPlan.billingMarket === "ca"
      ? IMAGE_UNLOCK_CAD_PRICE_LABEL
    : selectedPlan.pricingVariant === "1.9" || selectedPlan.pricingVariant === "2.4" || selectedPlan.pricingVariant === "2.5"
      ? IMAGE_UNLOCK_V19_PRICE_LABEL
      : IMAGE_UNLOCK_PRICE_LABEL;
  const showCreditPacks = creditPackPlans.length > 0;
  const showV24PurchaseTabs = pricingVariant === "2.4" && showCreditPacks;
  const showOneTimePurchaseEntry = selectedPlan.pricingVariant !== "2.1" && selectedPlan.pricingVariant !== "2.2";
  const isV19ImageTextEditorEntry = sourceUseCase === "ai-image-text-editor"
    && (selectedPlan.pricingVariant === "1.9" || selectedPlan.pricingVariant === "2.5");
  const isDirectImageUnlockEntry = selectedPlan.pricingVariant === "2.4" || isV19ImageTextEditorEntry;
  const showV19ImageTextEditorCreditPackEntry = isV19ImageTextEditorEntry && showCreditPacks;
  const isCreditPackView = purchaseView === "credit_pack" && showCreditPacks;
  const creditPackSingleImagePlan = creditPackPlans.find((item) => item.packageId === "starter_pack_1_v20") ?? creditPackPlans[0];
  const creditPackUnlockPriceLabel = creditPackSingleImagePlan
    ? getCreditPackPriceLabel(creditPackSingleImagePlan)
    : imageUnlockPriceLabel;

  return localizeUiTree((
    <>
    <div className={subscriptionModalBackdropClassName} role="presentation">
      <div className={subscriptionModalClassName} role="dialog" aria-modal="true" aria-labelledby="subscription-modal-title" onClick={(event) => event.stopPropagation()}>
        <nav className={styles.subscriptionModalNav} aria-label="Subscription dialog navigation">
          <button type="button" className={styles.subscriptionModalBack} onClick={onClose} aria-label="Close subscription dialog">
            <ChevronLeft size={22} aria-hidden="true" />
            <Image src="/assets/socialmedia/logo.png" alt="Vismuse" width={30} height={30} />
          </button>
          <button type="button" className={styles.subscriptionModalClose} onClick={onClose} aria-label="Close subscription dialog">
            <X size={22} aria-hidden="true" />
          </button>
        </nav>

        <div className={subscriptionModalFrameClassName}>
          <div className={`${styles.subscriptionPreviewColumn} ${showPreviewChoices ? styles.subscriptionPreviewColumnWithChoices : ""}`.trim()}>
            <div className={styles.subscriptionPreviewPane}>
            {!preview.loaded && !preview.failed ? (
              <span
                className={styles.modalPreviewImageLoading}
                role="status"
                aria-label={preview.retrying ? "Retrying preview image" : "Loading preview image"}
              />
            ) : null}
            {preview.failed ? (
              <div className={styles.modalPreviewImageError} role="alert">
                <span>Image preview unavailable</span>
                <button type="button" className={styles.modalPreviewRetry} onClick={preview.retry}>
                  Retry preview
                </button>
              </div>
            ) : null}
            <button
              type="button"
              className={styles.modalPreviewImageButton}
              onClick={() => setExpandedPreviewOpen(true)}
              disabled={!preview.loaded}
              aria-label="Open enlarged image preview"
              title={preview.loaded ? "Open preview" : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={preview.requestKey}
                className={preview.loaded ? styles.modalPreviewImageLoaded : styles.modalPreviewImageHidden}
                src={preview.src}
                alt={image.promptSummary || "Generated image preview"}
                width={image.width}
                height={image.height}
                onLoad={() => {
                  preview.handleLoad();
                  captureAnalyticsEvent("generation_preview_loaded", {
                    action: "load_preview",
                    stage: "preview",
                    status: "success",
                    duration_ms: Math.max(0, Date.now() - previewLoadStartedAtRef.current),
                    modal_variant: "post_generation_subscription",
                    asset_id: image.assetId,
                    image_index: image.imageIndex,
                    preview_variant: image.previewVariant,
                    access_variant: image.accessVariant,
                    source_use_case: sourceUseCase
                  });
                }}
                onError={() => {
                  if (preview.handleError() === "failed") {
                    trackClientEvent("socialmedia.image_preview.failed", {
                      action: "load_preview",
                      stage: "preview",
                      status: "failed",
                      reason: buildImagePreviewFailureReason(image.assetId)
                    });
                  }
                }}
                draggable={false}
              />
            </button>
            </div>
            {showPreviewChoices ? (
              <div className={styles.subscriptionPreviewGallery}>
                <div className={styles.subscriptionPreviewStrip} role="listbox" aria-label="Choose an image to unlock">
                  {previewChoices.map((choice, index) => {
                    const selected = choice.assetId
                      ? choice.assetId === image.assetId
                      : choice.url === image.url;
                    return (
                      <button
                        type="button"
                        key={choice.assetId || `${choice.imageIndex}-${index}`}
                        className={selected ? `${styles.subscriptionPreviewThumb} ${styles.subscriptionPreviewThumbSelected}` : styles.subscriptionPreviewThumb}
                        onClick={() => onImageSelect?.(choice)}
                        role="option"
                        aria-selected={selected}
                        aria-label={selected ? "Selected image preview" : "Select image preview"}
                        style={{ aspectRatio: `${Math.max(1, choice.width ?? 1)} / ${Math.max(1, choice.height ?? 1)}` }}
                      >
                        <RetryingPreviewImage
                          sourceUrl={choice.url}
                          alt=""
                          width={choice.width}
                          height={choice.height}
                        />
                        {selected ? (
                          <span className={styles.subscriptionPreviewThumbCheck} aria-hidden="true">
                            <Check size={11} strokeWidth={3} />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className={styles.subscriptionCopyPane}>
            {showV24PurchaseTabs ? (
              <div className={styles.subscriptionPurchaseTabs} role="tablist" aria-label="Choose purchase type">
                <button
                  id="subscription-purchase-tab"
                  type="button"
                  role="tab"
                  className={`${styles.subscriptionPurchaseTab} ${!isCreditPackView ? styles.subscriptionPurchaseTabActive : ""}`.trim()}
                  aria-selected={!isCreditPackView}
                  aria-controls="subscription-purchase-panel"
                  tabIndex={!isCreditPackView ? 0 : -1}
                  onClick={() => selectV24PurchaseView("subscription")}
                  onKeyDown={handleV24PurchaseTabKeyDown}
                  disabled={subscribePending}
                >
                  Subscription
                </button>
                <button
                  id="credit-pack-purchase-tab"
                  type="button"
                  role="tab"
                  className={`${styles.subscriptionPurchaseTab} ${isCreditPackView ? styles.subscriptionPurchaseTabActive : ""}`.trim()}
                  aria-selected={isCreditPackView}
                  aria-controls="subscription-purchase-panel"
                  tabIndex={isCreditPackView ? 0 : -1}
                  onClick={() => selectV24PurchaseView("credit_pack")}
                  onKeyDown={handleV24PurchaseTabKeyDown}
                  disabled={subscribePending}
                >
                  Credit packs
                </button>
              </div>
            ) : null}

            <div
              id={showV24PurchaseTabs ? "subscription-purchase-panel" : undefined}
              role={showV24PurchaseTabs ? "tabpanel" : undefined}
              aria-labelledby={showV24PurchaseTabs
                ? isCreditPackView ? "credit-pack-purchase-tab" : "subscription-purchase-tab"
                : undefined}
              className={styles.subscriptionPurchasePanel}
            >
            {isCreditPackView ? (
              <div className={styles.subscriptionCopyDetails}>
                {!showV24PurchaseTabs ? (
                  <button
                    type="button"
                    className={styles.creditPackInlineBack}
                    onClick={() => setPurchaseView("subscription")}
                    disabled={subscribePending}
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                    <span>Subscription plans</span>
                  </button>
                ) : null}
                <h2 id="subscription-modal-title">
                  {pricingVariant === "2.4"
                    ? <>Unlock this image with <span>Credit Pack</span></>
                    : "Unlock this image with Credit Pack"}
                </h2>
                <p className={styles.subscriptionSubcopy}>
                  {pricingVariant === "2.4"
                    ? "No subscription. Buy once. Credits are valid for 90 days."
                    : "Buy once. Export HD, watermark-free images anytime. Credits are valid for one year."}
                </p>
              </div>
            ) : (
              <div className={styles.subscriptionCopyDetails}>
                <div className={styles.subscriptionTitleRow}>
                  <h2 id="subscription-modal-title">
                    {isSelectedOneTimePlan
                      ? <>Unlock HD image, <span>no subscription</span></>
                      : <>Unlock this image with <span>{selectedPlanName}</span></>}
                  </h2>
                  {pricingVariant === "1.9" || pricingVariant === "2.4" || pricingVariant === "2.5"
                    ? <SubscriptionHistoryUnlockTip />
                    : null}
                </div>
                <p className={styles.subscriptionPriceLine}>
                  {selectedPlanName} · {selectedPlanPriceLine}
                  {(selectedPlan?.pricingVariant === "1.9" || selectedPlan?.pricingVariant === "2.4" || selectedPlan?.pricingVariant === "2.5") && selectedPlanMonthly1kImageCount ? (
                    <SubscriptionCreditUsageTip monthly1kImageCount={selectedPlanMonthly1kImageCount} />
                  ) : null}
                </p>
                <p className={styles.subscriptionSubcopy}>{subscriptionCopy}</p>

                <button
                  type="button"
                  className={styles.subscriptionBenefitsToggle}
                  onClick={() => setMobileBenefitsOpen((open) => !open)}
                  aria-expanded={mobileBenefitsOpen}
                  aria-controls="subscription-benefits-list"
                >
                  <span>What’s included</span>
                  <ChevronRight
                    className={mobileBenefitsOpen ? styles.subscriptionBenefitsToggleIconOpen : styles.subscriptionBenefitsToggleIcon}
                    size={16}
                    aria-hidden="true"
                  />
                </button>

                <ul
                  id="subscription-benefits-list"
                  className={`${styles.subscriptionFeatureList} ${styles.subscriptionFeatureListCollapsible} ${mobileBenefitsOpen ? styles.subscriptionFeatureListOpen : ""}`.trim()}
                >
                  {getUpgradeModalPlanBenefits(selectedPlan).map((benefit) => (
                    <li key={`${benefit.strong}-${benefit.copy ?? ""}`}>
                      <Check size={18} aria-hidden="true" />
                      <span><strong>{benefit.strong}</strong>{benefit.copy ? ` ${benefit.copy}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error ? <p className={styles.subscriptionModalError}>{error}</p> : null}

            {isCreditPackView ? (
              <>
                <div className={styles.creditPackGrid} aria-label="Choose image credit pack">
                  {creditPackPlans.map((planOption) => {
                    const selected = effectiveSelectedCreditPackPackageId === planOption.packageId;
                    const valueLabel = getCreditPackValueLabel(planOption);
                    const visibleValueLabel = planOption.pricingVariant === "2.4"
                      ? undefined
                      : valueLabel ?? (planOption.packageId === "starter_pack_1_v20" ? undefined : "One-time");
                    const unitPriceLabel = getCreditPackUnitPriceLabel(planOption);
                    return (
                      <button
                        type="button"
                        key={planOption.packageId}
                        className={[
                          styles.creditPackOption,
                          selected ? styles.creditPackOptionSelected : "",
                          planOption.packageId === "starter_pack_100_v20" ? styles.creditPackOptionFeatured : ""
                        ].filter(Boolean).join(" ")}
                        onClick={() => handleCreditPackPlanSelect(planOption.packageId)}
                        disabled={subscribePending}
                        aria-pressed={selected}
                      >
                        <span className={styles.creditPackRadio} aria-hidden="true">
                          {selected ? <Check size={14} aria-hidden="true" /> : null}
                        </span>
                        <span className={styles.creditPackOptionCopy}>
                          <span className={`${styles.creditPackOptionTop} ${visibleValueLabel ? styles.creditPackOptionTopWithBadge : ""}`.trim()}>
                            <strong>{getCreditPackUnitLabel(planOption)}</strong>
                            {visibleValueLabel ? <span className={styles.creditPackBadge}>{visibleValueLabel}</span> : null}
                          </span>
                          {planOption.pricingVariant === "2.4" ? <small>{planOption.imageCountLabel}</small> : null}
                        </span>
                        <span className={styles.creditPackPrice}>
                          <span>{getCreditPackPriceLabel(planOption)}</span>
                          {unitPriceLabel ? <small>{unitPriceLabel}</small> : null}
                        </span>
                      </button>
                    );
                  })}
                  {showV19ImageTextEditorCreditPackEntry ? (
                    <a
                      className={`${styles.creditPackOption} ${styles.creditPackContactOption}`}
                      href={CREDIT_PACK_SALES_CONTACT_HREF}
                    >
                      <span className={`${styles.creditPackRadio} ${styles.creditPackContactIcon}`} aria-hidden="true">
                        <Zap size={13} />
                      </span>
                      <span className={styles.creditPackOptionCopy}>
                        <span className={styles.creditPackOptionTop}><strong>Need more credits?</strong></span>
                        <small>Talk to us about custom volume</small>
                      </span>
                      <strong className={styles.creditPackContactCta}>Contact sales <ArrowRight size={15} aria-hidden="true" /></strong>
                    </a>
                  ) : null}
                </div>

                <button
                  type="button"
                  className={styles.creditPackPrimaryButton}
                  onClick={handleCreditPackPurchase}
                  disabled={!selectedCreditPack || subscribePending}
                >
                  {subscribePending
                    ? "Processing..."
                    : pricingVariant === "2.4" && selectedCreditPack
                      ? `Get ${selectedCreditPack.name} and unlock this image`
                      : "Continue and unlock this image"}
                  {!subscribePending ? <ArrowRight size={18} aria-hidden="true" /> : null}
                </button>
                {selectedCreditPack ? (
                  <p className={styles.creditPackFootnote}>{getCheckoutTrustLine(selectedCreditPack)}</p>
                ) : null}
                {showV24PurchaseTabs ? (
                  <button
                    type="button"
                    className={styles.subscriptionInlineStarterButton}
                    onClick={onUnlock}
                    disabled={unlockPending || subscribePending}
                  >
                    <span className={styles.subscriptionInlineStarterMain}>
                      <span>
                        {unlockPending
                          ? "Processing..."
                          : `Unlock this image only for ${imageUnlockPriceLabel}`}
                      </span>
                    </span>
                  </button>
                ) : null}
                {!showV24PurchaseTabs ? (
                  <button
                    type="button"
                    className={styles.creditPackSubscriptionPrompt}
                    onClick={openSubscriptionViewFromCreditPack}
                    disabled={subscribePending}
                  >
                    Want a subscription? Choose a plan
                  </button>
                ) : null}
              </>
            ) : (
              <>
                {showBillingIntervalToggle ? (
                  <div className={styles.subscriptionBillingRow} aria-label="Choose billing interval">
                    <button
                      type="button"
                      className={styles.billingSwitchButton}
                      onClick={toggleBillingInterval}
                      aria-pressed={isAnnualBillingSelected}
                    >
                      <span className={styles.billingSwitchText}>Annually</span>
                      {annualSaveLabel ? (
                        <span className={styles.billingSwitchOffer}>
                          <span className={styles.billingSwitchSave}>{annualSaveLabel}</span>
                          {pricingVariant !== "1.9" && pricingVariant !== "2.5" ? <span className={styles.billingSwitchLimitedTime}>Limited-time offer</span> : null}
                        </span>
                      ) : null}
                      <span
                        className={`${styles.billingSwitchTrack} ${isAnnualBillingSelected ? styles.billingSwitchTrackOn : ""}`.trim()}
                        aria-hidden="true"
                      >
                        <span className={styles.billingSwitchThumb} />
                      </span>
                    </button>
                  </div>
                ) : null}

                <div className={styles.subscriptionPlanSelector} aria-label="Choose plan">
                  {visiblePlans.map((planOption) => {
                    const selected = effectiveSelectedPackageId === planOption.packageId;
                    const isCurrentPlan = planOption.kind === "subscription" && planOption.name.toLowerCase() === accountPlan;
                    const isIncludedInCurrent = planOption.kind === "subscription" && isIncludedInCurrentPlan(planOption.name.toLowerCase(), accountPlan);
                    const unavailable = isCurrentPlan || isIncludedInCurrent;
                    const showPlanBadge = !(
                      planOption.pricingVariant === "2.4"
                      && planOption.checkoutPlan === "basic"
                      && planOption.billingInterval === "month"
                    );
                    const rawPlanBadge = planOption.badge
                      ?? (planOption.billingInterval ? getBillingIntervalLabel(planOption.billingInterval) : "Monthly");
                    const planBadge = isCurrentPlan
                      ? "Current plan"
                      : isIncludedInCurrent
                        ? getIncludedPlanLabel(accountPlan)
                        : getPlanBadgeLabel(planOption, rawPlanBadge);
                    return (
                      <button
                        type="button"
                        key={planOption.packageId}
                        className={[
                          styles.subscriptionPlanOption,
                          selected ? styles.subscriptionPlanOptionSelected : ""
                        ].filter(Boolean).join(" ")}
                        onClick={() => handlePlanSelect(planOption.packageId)}
                        disabled={unavailable || subscribePending}
                        aria-pressed={selected}
                      >
                        <span className={styles.subscriptionPlanOptionRadio} aria-hidden="true">
                          {selected ? <Check size={14} aria-hidden="true" /> : null}
                        </span>
                        <span className={styles.subscriptionPlanOptionCopy}>
                          <span className={[
                            styles.subscriptionPlanOptionCopyTopline,
                            planOption.pricingVariant === "2.4" ? styles.subscriptionPlanOptionCopyToplineV24 : "",
                            planOption.pricingVariant === "1.9" || planOption.pricingVariant === "2.5"
                              ? styles.subscriptionPlanOptionCopyToplineAligned
                              : ""
                          ].filter(Boolean).join(" ")}>
                            <strong className={styles.subscriptionPlanOptionName}>{planOption.displayName}</strong>
                            {showPlanBadge ? <span className={styles.subscriptionPlanOptionMeta}>{planBadge}</span> : null}
                          </span>
                        </span>
                        <span className={styles.subscriptionPlanOptionPriceBlock}>
                          <span className={[styles.subscriptionPlanOptionPrice, planOption.billingInterval === "year" ? styles.subscriptionPlanOptionAnnualPrice : ""].filter(Boolean).join(" ")}>
                            <strong>{planOption.price}</strong>
                            {planOption.originalPrice ? <del>{planOption.originalPrice}</del> : null}
                            {planOption.billingInterval !== "year" ? <small>{getBillingIntervalSuffix(planOption)}</small> : null}
                          </span>
                          {planOption.billingInterval === "year" ? <span className={styles.subscriptionPlanOptionBillingCaption}>per month, billed yearly</span> : null}
                          <span className={styles.subscriptionPlanOptionDealRow}>
                            {planOption.billingNote && canShowSubscriptionPlanOptionSavings(planOption) ? <span className={styles.subscriptionPlanOptionSavings}>{planOption.billingNote}</span> : null}
                            {planOption.discountPercent && planOption.billingInterval !== "year" ? (
                              <span className={styles.subscriptionPlanOptionDiscountBadge}>{formatDiscountPercentLabel(planOption.discountPercent)}</span>
                            ) : null}
                            {planOption.savings && canShowSubscriptionPlanOptionSavings(planOption) ? <span className={styles.subscriptionPlanOptionSavings}>{planOption.savings}</span> : null}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className={styles.subscriptionPrimaryButton}
                  onClick={() => onSubscribe(selectedPlan.packageId, {
                    position: "primary_button",
                    label: subscribeCtaLabel
                  })}
                  disabled={subscribePending}
                >
                  {subscribeCtaLabel}
                  {!subscribePending ? <ArrowRight size={20} aria-hidden="true" /> : null}
                </button>

                {shouldPlaceFootnoteBelowPrimaryButton ? (
                  <p className={styles.subscriptionFootnote}>{selectedPlanPaymentExplanation}</p>
                ) : null}

                {showOneTimePurchaseEntry ? (
                  <>
                    <button
                      type="button"
                      className={styles.subscriptionInlineStarterButton}
                      onClick={isDirectImageUnlockEntry
                        ? onUnlock
                        : showCreditPacks
                          ? openCreditPackView
                          : onUnlock}
                      disabled={unlockPending || subscribePending}
                    >
                      <span className={styles.subscriptionInlineStarterMain}>
                        <span>
                          {isDirectImageUnlockEntry
                            ? unlockPending
                              ? "Processing..."
                              : `Unlock this image only for ${imageUnlockPriceLabel}`
                            : selectedPlan.pricingVariant === "2.0"
                            ? `Unlock this image only for ${creditPackUnlockPriceLabel}`
                            : showCreditPacks
                            ? `No subscription — Get 10 images for ${creditPackUnlockPriceLabel}`
                            : unlockPending
                              ? "Processing..."
                              : `Unlock this image only for ${imageUnlockPriceLabel}`}
                        </span>
                      </span>
                    </button>
                    {showV19ImageTextEditorCreditPackEntry ? (
                      <button
                        type="button"
                        className={styles.subscriptionInlineStarterButton}
                        onClick={openCreditPackView}
                        disabled={unlockPending || subscribePending}
                      >
                        <span className={styles.subscriptionInlineStarterMain}>
                          <span>More credits without a subscription?</span>
                        </span>
                      </button>
                    ) : null}
                  </>
                ) : null}
              </>
            )}

            {!isCreditPackView && !shouldPlaceFootnoteBelowPrimaryButton ? (
              <p className={styles.subscriptionFootnote}>{selectedPlanPaymentExplanation}</p>
            ) : null}

            {canDownloadWatermarkedPreview ? (
              <button
                type="button"
                className={styles.subscriptionTertiaryButton}
                onClick={() => void handleDownloadWatermarked()}
                disabled={downloadingWatermarked || unlockPending || subscribePending}
              >
                <Download size={17} aria-hidden="true" />
                <span className={styles.subscriptionTertiaryLabel}>
                  {downloadingWatermarked
                    ? "Downloading..."
                    : "Download with watermark"}
                </span>
              </button>
            ) : null}
            </div>
          </div>
        </div>
        {watermarkedDownloadCompleted ? (
          <section className={styles.watermarkedDownloadSuccess} aria-live="polite">
            <button
              type="button"
              className={styles.watermarkedDownloadSuccessClose}
              onClick={() => setWatermarkedDownloadCompleted(false)}
              aria-label="Dismiss download confirmation"
            >
              <X size={14} aria-hidden="true" />
            </button>
            <div className={styles.watermarkedDownloadSuccessThumbnail} aria-hidden="true">
              <img src={preview.src} alt="" />
            </div>
            <div className={styles.watermarkedDownloadSuccessCopy}>
              <span className={styles.watermarkedDownloadSuccessTitle}>
                <Check size={14} aria-hidden="true" />
                Preview saved
              </span>
              <p>
                <span>{watermarkedDownloadSizeLabel
                  ? `${watermarkedDownloadSizeLabel} watermarked preview downloaded.`
                  : "Watermarked preview downloaded."}</span>
                <span>{originalImageSizeLabel
                  ? `${selectedPlanCtaLabel} to unlock the HD original (${originalImageSizeLabel}).`
                  : `${selectedPlanCtaLabel} to unlock the HD original.`}</span>
              </p>
            </div>
            <button
              type="button"
              className={styles.watermarkedDownloadSuccessCta}
              onClick={() => onSubscribe(selectedPlan.packageId, {
                position: "watermarked_tips_button",
                label: selectedPlanCtaLabel
              })}
              disabled={subscribePending}
            >
              {subscribePending ? "Opening…" : selectedPlanCtaLabel}
            </button>
          </section>
        ) : null}
      </div>
    </div>
    {expandedPreviewOpen ? (
      <GateImagePreviewOverlay image={{ ...image, url: preview.src }} onClose={() => setExpandedPreviewOpen(false)} />
    ) : null}
    </>
  ), uiLocale);
}

export function SubscriptionGateModal(props: SubscriptionGateModalProps) {
  const uiLocale = useUiLocale();
  if (props.mode === "image") {
    return <ImageSubscriptionGateModal {...props} />;
  }

  return localizeUiTree(<AppUpgradePricingModal {...props} />, uiLocale);
}
