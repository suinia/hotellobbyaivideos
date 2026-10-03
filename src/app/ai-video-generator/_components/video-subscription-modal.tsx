"use client";

import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";

import Image from "next/image";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Crown, Download, Sparkles, Volume2, VolumeX, X, Zap } from "lucide-react";
import { buildCheckoutAnalyticsProperties, rememberCheckoutContext } from "@/lib/analytics/checkout";
import { createGoogleAdsCheckoutIntentDedupeKey, trackGoogleAdsBeginCheckoutConversion } from "@/lib/analytics/google-ads";
import { captureAnalyticsEvent, getStoredAttribution } from "@/lib/analytics/posthog";
import {
  DEFAULT_PRICING_VARIANT,
  normalizePricingVariant,
  resolveDefaultSubscriptionCheckoutPlan,
  type BillingPackageId,
  type PricingVariant,
  type PublicBillingPackage
} from "@/lib/billing/catalog";
import {
  isLocalizedBillingMarket,
  resolveBillingPricingVariant,
  type BillingCurrency,
  type BillingMarket
} from "@/lib/billing/market";
import {
  formatBillingAmount,
  formatCheckoutAmountDueToday,
  getLocalizedPublicBillingPackagesForVariant,
  resolveBillingOffer
} from "@/lib/billing/offers";
import { readClientPricingVariantOverride } from "@/lib/billing/pricing-experiment-client";
import {
  VIDEO_CREDIT_PACK_CHECKOUT_TYPE,
  SELF_SERVE_VIDEO_CREDIT_PACKS,
  V24_VIDEO_CREDIT_PACKS,
  V25_VIDEO_CREDIT_PACKS,
  VIDEO_CREDIT_PACKS,
  isVideoCreditPackPackageId,
  isVideoCreditPackPricingVariant,
  shouldShowAccountUpgradeCreditPackEntry,
  type VideoCreditPackPackageId
} from "@/lib/billing/video-credit-packs";
import {
  LEGACY_VIDEO_SINGLE_UNLOCK_PRICING_VARIANT,
  VIDEO_SINGLE_UNLOCK_PACKAGE_ID,
  isVideoSingleUnlockAvailableForPricingVariant,
  resolveVideoSingleUnlockCheckoutPricingVariant
} from "@/lib/billing/video-single-unlock";
import OriginalThinkingLoader from "@/components/original-thinking-loader";
import { resolveFrontendBillingPlanCta, resolveFrontendBillingPlanName } from "@/lib/billing/plan-display";
import { fetchSocialmediaAccount } from "../../socialmedia/_components/socialmedia-account-client";
import socialStyles from "../../socialmedia/socialmedia.module.css";
import appSubscriptionStyles from "../../app/_components/subscription-gate-modal/index.module.css";
import styles from "./video-generator.module.css";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

type VideoCheckoutPackageId = BillingPackageId;
type VideoBillingInterval = "month" | "year";
type VideoSubscriptionPlanKey = "pro" | "max" | "basic" | "standard" | "ultimate";
type AccountPlan = "free" | "basic" | "pro" | "max";
export type VideoPricingDefaultView = "subscription" | "credit_pack";

const SALES_CONTACT_HREF = "mailto:support@vismuse.com?subject=Vismuse%20high-volume%20credits";

type VideoSubscriptionPlan = {
  key: VideoSubscriptionPlanKey;
  name: string;
  price: string;
  packageId: BillingPackageId;
  cta: string;
  badge: string;
  highlighted: boolean;
  priceLineLabel: string;
  valueTag: string;
  features: string[];
  billingInterval: VideoBillingInterval;
  currency?: BillingCurrency;
  value?: number;
};

const VIDEO_CREDITS_PER_GENERATION = 200;
const monthlyLegacyVideoSubscriptionPlans: VideoSubscriptionPlan[] = [
  {
    key: "basic",
    name: "Basic",
    price: "$14.99",
    packageId: "video_basic_v1",
    cta: "Get Basic",
    badge: "Monthly",
    highlighted: false,
    priceLineLabel: "2,000 credits/month ≈ 10 HD videos",
    valueTag: "",
    features: [
      "2,000 credits per month",
      "Up to ~10 video generations/month",
      "Supports 720p and 1080p exports",
      "Saved account workspace"
    ],
    billingInterval: "month"
  },
  {
    key: "standard",
    name: "Standard",
    price: "$39.99",
    packageId: "video_standard_v1",
    cta: "Get Standard",
    badge: "Recommended",
    highlighted: true,
    priceLineLabel: "10,000 credits/month ≈ 50 HD videos",
    valueTag: "",
    features: [
      "10,000 credits per month",
      "Up to ~50 video generations/month",
      "Supports 720p and 1080p exports",
      "More room for batches"
    ],
    billingInterval: "month"
  },
  {
    key: "ultimate",
    name: "Ultimate",
    price: "$79.99",
    packageId: "video_ultimate_v1",
    cta: "Get Ultimate",
    badge: "Best value",
    highlighted: false,
    priceLineLabel: "50,000 credits/month ≈ 250 HD videos",
    valueTag: "5x Standard",
    features: [
      "50,000 credits per month",
      "Up to ~250 video generations/month",
      "Supports 720p and 1080p exports",
      "Best for high-volume creation"
    ],
    billingInterval: "month"
  }
];

const annualLegacyVideoSubscriptionPlans: VideoSubscriptionPlan[] = [
  {
    key: "basic",
    name: "Basic",
    price: "$11.99",
    packageId: "video_basic_annual_v1",
    cta: "Get Basic Annual",
    badge: "Save $36",
    highlighted: false,
    priceLineLabel: "2,000 credits/month ≈ 10 HD videos",
    valueTag: "",
    features: [
      "2,000 credits per month",
      "Up to ~10 video generations/month",
      "Supports 720p and 1080p exports",
      "Billed annually"
    ],
    billingInterval: "year"
  },
  {
    key: "standard",
    name: "Standard",
    price: "$32.99",
    packageId: "video_standard_annual_v1",
    cta: "Get Standard Annual",
    badge: "Save $84",
    highlighted: true,
    priceLineLabel: "10,000 credits/month ≈ 50 HD videos",
    valueTag: "",
    features: [
      "10,000 credits per month",
      "Up to ~50 video generations/month",
      "Supports 720p and 1080p exports",
      "Billed annually"
    ],
    billingInterval: "year"
  },
  {
    key: "ultimate",
    name: "Ultimate",
    price: "$59.99",
    packageId: "video_ultimate_annual_v1",
    cta: "Get Ultimate Annual",
    badge: "Save $240",
    highlighted: false,
    priceLineLabel: "50,000 credits/month ≈ 250 HD videos",
    valueTag: "Annual price",
    features: [
      "50,000 credits per month",
      "Up to ~250 video generations/month",
      "Supports 720p and 1080p exports",
      "Billed annually"
    ],
    billingInterval: "year"
  }
];

const videoPricingFaqs = [
  {
    id: "credits",
    question: "How do video credits work?",
    answer: "Each video generation uses credits based on model, duration, and settings. The plan limits shown are estimates for typical short video generations."
  },
  {
    id: "workspace",
    question: "Can I use these credits in the video workspace?",
    answer: "Yes. These video subscriptions add credits to your Vismuse account, and you can keep creating from the AI Video Generator workspace."
  },
  {
    id: "cancel",
    question: "Can I cancel anytime?",
    answer: "Yes. Subscriptions can be managed from your account subscription settings."
  }
] as const;

type VideoSubscriptionPreview = {
  assetId?: string;
  asset_id?: string;
  videoIndex?: number;
  video_index?: number;
  url: string;
  thumbnailUrl?: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  duration?: number;
  promptSummary?: string;
  prompt_summary?: string;
  accessVariant?: "original" | "watermarked";
  access_variant?: "original" | "watermarked";
};

export type VideoCheckoutCreatedContext = {
  checkoutId?: string;
  packageId: BillingPackageId;
  paymentProvider?: string;
  pricingVariant: PricingVariant;
  assetId?: string;
  jobId?: string;
  sessionId?: string;
  isUnlockCheckout: boolean;
};

type VideoDownloadRouteResponse = {
  url?: string;
  fileName?: string;
  file_name?: string;
  mimeType?: string;
  accessVariant?: "original" | "watermarked";
  assetId?: string;
};

function createClientIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readVideoAssetId(video?: VideoSubscriptionPreview | null): string {
  return (video?.assetId ?? video?.asset_id ?? "").trim();
}

function readVideoIndex(video?: VideoSubscriptionPreview | null): number {
  const rawIndex = video?.videoIndex ?? video?.video_index;
  return typeof rawIndex === "number" && Number.isInteger(rawIndex) && rawIndex >= 0 ? rawIndex : 0;
}

function isUuid(value?: string): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function resolveVideoPricingVariant(value?: string | null): PricingVariant {
  const overrideVariant = readClientPricingVariantOverride();
  if (overrideVariant) {
    return overrideVariant === "1.9" || overrideVariant === "2.0" || overrideVariant === "2.1" || overrideVariant === "2.2" || overrideVariant === "2.3" || overrideVariant === "2.4" || overrideVariant === "2.5"
      ? overrideVariant
      : "1.7";
  }
  const variant = value ? normalizePricingVariant(value) : DEFAULT_PRICING_VARIANT;
  return variant === "1.9" || variant === "2.0" || variant === "2.1" || variant === "2.2" || variant === "2.3" || variant === "2.4" || variant === "2.5" ? variant : "1.7";
}

function getMonthlyVideoCount(plan: PublicBillingPackage, monthlyPeer?: PublicBillingPackage): number {
  const credits = plan.interval === "year" && monthlyPeer ? monthlyPeer.credits : plan.credits;
  const creditsPerVideo = plan.pricingVariant === "2.1"
    ? 50
    : plan.pricingVariant === "2.2" || plan.pricingVariant === "2.4" || plan.pricingVariant === "2.5"
      ? 100
      : VIDEO_CREDITS_PER_GENERATION;
  return Math.max(1, Math.round(credits / creditsPerVideo));
}

function getMonthlyImageCount(plan: PublicBillingPackage, monthlyPeer?: PublicBillingPackage): number {
  const credits = plan.interval === "year" && monthlyPeer ? monthlyPeer.credits : plan.credits;
  return Math.max(1, Math.round(credits / 10));
}

function formatVideoCountLine(plan: PublicBillingPackage, monthlyPeer?: PublicBillingPackage): string {
  const count = getMonthlyVideoCount(plan, monthlyPeer).toLocaleString();
  if (plan.pricingVariant === "2.5") return `Up to ${count} videos/month (720p, 5 seconds)`;
  return plan.interval === "year"
    ? `${count} HD videos * 12`
    : `${count} HD videos`;
}

function getVideoModalPlanFeatures(plan: PublicBillingPackage, monthlyPeer?: PublicBillingPackage): string[] {
  if (plan.pricingVariant === "2.2") {
    const videoEntitlements = plan.checkoutPlan === "pro"
      ? ["Up to 100 HD images/month", "Up to 10 videos/month"]
      : ["Up to 1,000 HD images/month", "Up to 100 videos/month"];
    return [...videoEntitlements, ...plan.features.slice(2)];
  }
  if (plan.pricingVariant === "2.4" || plan.pricingVariant === "2.5") return plan.features;
  if (plan.pricingVariant === "2.1") return plan.features;
  const monthlyCredits = plan.interval === "year" && monthlyPeer ? monthlyPeer.credits : plan.credits;
  const monthlyImageCount = getMonthlyImageCount(plan, monthlyPeer).toLocaleString();
  const monthlyVideoCount = getMonthlyVideoCount(plan, monthlyPeer).toLocaleString();
  if (plan.checkoutPlan === "pro") {
    return [
      `${monthlyCredits.toLocaleString()} credits/month, cancel anytime`,
      `Up to ~${monthlyImageCount} HD images or ~${monthlyVideoCount} videos/month`,
      "Export in 1080P & 4K",
      "Commercial use included",
      "Failed generations auto-refunded"
    ];
  }
  return [
    `${monthlyCredits.toLocaleString()} credits/month, cancel anytime`,
    `Up to ~${monthlyImageCount} HD images or ~${monthlyVideoCount} videos/month`,
    "Export in 1080P & 4K",
    "Commercial use included",
    "Higher priority for faster generation"
  ];
}

function buildVideoSubscriptionPlans(
  pricingVariant: PricingVariant,
  billingMarket: BillingMarket
): VideoSubscriptionPlan[] {
  const packages = getLocalizedPublicBillingPackagesForVariant(pricingVariant, billingMarket, { includeOneTime: false })
    .filter((item) => {
      if (item.kind !== "subscription") return false;
      if (item.checkoutPlan !== "basic" && item.checkoutPlan !== "pro" && item.checkoutPlan !== "max") return false;

      // Basic 2.2 is an image-only subscription. Keep it in the image pricing
      // surfaces, but never offer it from a video upgrade flow.
      return item.pricingVariant !== "2.2" || item.checkoutPlan !== "basic";
    });
  const monthlySubscriptions = new Map(
    packages
      .filter((item) => item.interval === "month")
      .map((item) => [item.checkoutPlan, item])
  );
  const planOrder = new Map<VideoSubscriptionPlanKey, number>([["basic", 0], ["pro", 1], ["max", 2]]);
  return packages
    .map((item): VideoSubscriptionPlan => {
      const monthlyPeer = monthlySubscriptions.get(item.checkoutPlan);
      const displayAmount = item.interval === "year" ? item.displayAmount / 12 : item.displayAmount;
      return {
        key: item.checkoutPlan as VideoSubscriptionPlanKey,
        name: item.name,
        price: formatBillingAmount(displayAmount, item.displayCurrency),
        packageId: item.id,
        cta: item.cta,
        badge: item.modalBadge ?? item.label ?? (item.interval === "year" ? "Annual" : "Monthly"),
        highlighted: item.checkoutPlan === "pro",
        priceLineLabel: formatVideoCountLine(item, monthlyPeer),
        valueTag: (item.pricingVariant === "2.2" || item.pricingVariant === "2.4") && item.checkoutPlan === "pro"
          ? ""
          : item.modalValueTag ?? "",
        features: getVideoModalPlanFeatures(item, monthlyPeer),
        billingInterval: item.interval === "year" ? "year" : "month",
        currency: item.displayCurrency,
        value: item.displayAmount
      };
    })
    .sort((left, right) => (planOrder.get(left.key) ?? 99) - (planOrder.get(right.key) ?? 99));
}

function normalizeAccountPlan(value?: string | null): AccountPlan {
  return value === "basic" || value === "pro" || value === "max" ? value : "free";
}

function isUnavailableVideoSubscriptionPlan(plan: VideoSubscriptionPlan, accountPlan: AccountPlan | null): boolean {
  if (!accountPlan || accountPlan === "free") return false;

  // The current app plan order is Basic < Pro < Max. Legacy video-only packages
  // deliberately remain unchanged because they are not equivalent app plans.
  if (accountPlan === "max") {
    return plan.key === "basic" || plan.key === "pro" || plan.key === "max";
  }

  if (accountPlan === "pro") return plan.key === "basic" || plan.key === "pro";
  return plan.key === "basic";
}

function unavailablePlanLabel(plan: VideoSubscriptionPlan, accountPlan: AccountPlan | null): string {
  if (plan.key === accountPlan) return "Current plan";
  return accountPlan === "max" ? "Included in Max" : "Included in Pro";
}

function formatVideoCreditPackUnitPrice(params: {
  amount: number;
  currency: BillingCurrency;
  estimatedVideos: number;
}): string {
  const symbol = params.currency === "GBP" ? "£" : params.currency === "CAD" ? "C$" : "$";
  return `${symbol}${(params.amount / params.estimatedVideos).toFixed(2)}/video`;
}

export default function VideoSubscriptionModal({
  open,
  onClose,
  onCheckoutCreated,
  video,
  jobId,
  sessionId,
  presentation = "legacy",
  pricingVariant,
  defaultView = "subscription",
  initialBillingInterval,
  initialAccountPlan,
  initialCreditBalance,
  initialBillingMarket
}: {
  open: boolean;
  onClose: () => void;
  onCheckoutCreated?: (context: VideoCheckoutCreatedContext) => void;
  jobId?: string;
  sessionId?: string;
  video?: VideoSubscriptionPreview | null;
  presentation?: "legacy" | "app";
  pricingVariant?: PricingVariant | string | null;
  defaultView?: VideoPricingDefaultView;
  initialBillingInterval?: VideoBillingInterval;
  initialAccountPlan?: AccountPlan;
  initialCreditBalance?: number;
  initialBillingMarket?: BillingMarket;
}) {
  const uiLocale = useUiLocale();
  const videoPricingVariant = resolveVideoPricingVariant(pricingVariant);
  const initialCreditPackPlan = defaultView === "credit_pack" && initialAccountPlan !== "free"
    ? initialAccountPlan ?? null
    : null;
  const [pricingPendingPackage, setPricingPendingPackage] = useState<VideoCheckoutPackageId | "">("");
  const [pricingError, setPricingError] = useState("");
  const [videoBillingInterval, setVideoBillingInterval] = useState<VideoBillingInterval>(() => (
    initialBillingInterval ?? (videoPricingVariant === "2.3" ? "year" : "month")
  ));
  const [selectedVideoPlanKey, setSelectedVideoPlanKey] = useState<VideoSubscriptionPlanKey>(() => (
    videoPricingVariant === "2.4"
      ? resolveDefaultSubscriptionCheckoutPlan(videoPricingVariant)
      : presentation === "app" ? "pro" : "standard"
  ));
  const [videoBenefitsOpen, setVideoBenefitsOpen] = useState(false);
  const [videoPricingFaqOpen, setVideoPricingFaqOpen] = useState<string | null>("credits");
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [previewMuted, setPreviewMuted] = useState(true);
  const [accountPlan, setAccountPlan] = useState<AccountPlan | null>(initialCreditPackPlan);
  const [accountCreditBalance, setAccountCreditBalance] = useState<number | null>(() => (
    Number.isFinite(initialCreditBalance) ? Math.max(0, Math.floor(initialCreditBalance ?? 0)) : null
  ));
  const [billingMarket, setBillingMarket] = useState<BillingMarket | null>(
    initialCreditPackPlan ? initialBillingMarket ?? "default" : null
  );
  const resolvedBillingMarket = billingMarket ?? "default";
  const creditPackBillingMarket: BillingMarket = billingMarket === "gb" ? "gb" : "default";
  const activeVideoPricingVariant = billingMarket === null
    ? videoPricingVariant
    : resolveBillingPricingVariant(billingMarket, videoPricingVariant);
  const videoUnlockPriceLabel = billingMarket === null
    ? null
    : billingMarket === "gb" ? "£9.99" : billingMarket === "ca" ? "C$12.99" : "$9.99";
  const [selectedVideoCreditPackId, setSelectedVideoCreditPackId] = useState<VideoCreditPackPackageId>(() => (
    videoPricingVariant === "2.4" ? "image_credit_pack_500_v24" : "video_credit_pack_6000_v20"
  ));
  const [pricingView, setPricingView] = useState<VideoPricingDefaultView>(defaultView);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const hasVideoPreview = Boolean(video?.url);
  const appVideoSubscriptionPlans = useMemo(
    () => buildVideoSubscriptionPlans(activeVideoPricingVariant, resolvedBillingMarket),
    [activeVideoPricingVariant, resolvedBillingMarket]
  );
  const usesExperimentVideoCatalog = isLocalizedBillingMarket(billingMarket) || presentation === "app" || activeVideoPricingVariant === "2.3" || activeVideoPricingVariant === "2.4" || activeVideoPricingVariant === "2.5";
  const allVideoSubscriptionPlans = usesExperimentVideoCatalog
    ? appVideoSubscriptionPlans
    : videoBillingInterval === "year"
      ? annualLegacyVideoSubscriptionPlans
      : monthlyLegacyVideoSubscriptionPlans;
  const videoSubscriptionPlans = allVideoSubscriptionPlans.filter((plan) => plan.billingInterval === videoBillingInterval);
  const requestedVideoPlan = videoSubscriptionPlans.find((plan) => plan.key === selectedVideoPlanKey)
    ?? videoSubscriptionPlans[0]
    ?? allVideoSubscriptionPlans[0];
  const selectedVideoPlan = isUnavailableVideoSubscriptionPlan(requestedVideoPlan, accountPlan)
    ? videoSubscriptionPlans.find((plan) => !isUnavailableVideoSubscriptionPlan(plan, accountPlan))
      ?? videoSubscriptionPlans.find((plan) => plan.key === accountPlan)
      ?? requestedVideoPlan
    : requestedVideoPlan;
  const selectedVideoPlanDisplayName = resolveFrontendBillingPlanName(
    activeVideoPricingVariant,
    selectedVideoPlan.key,
    selectedVideoPlan.name
  );
  const selectedVideoPlanOffer = resolveBillingOffer({
    packageId: selectedVideoPlan.packageId,
    market: resolvedBillingMarket,
    pricingVariant: activeVideoPricingVariant
  });
  const selectedVideoPlanPaymentExplanation = `Today: ${formatCheckoutAmountDueToday(selectedVideoPlan.price, selectedVideoPlan.billingInterval, selectedVideoPlanOffer.currency, selectedVideoPlanOffer.amount)} · Renews ${selectedVideoPlan.billingInterval === "year" ? "yearly" : "monthly"} · Cancel anytime`;
  const modalStyles = presentation === "app" ? appSubscriptionStyles : socialStyles;
  const selectedPlanUnavailable = isUnavailableVideoSubscriptionPlan(selectedVideoPlan, accountPlan);
  const usesV24PurchaseTabs = activeVideoPricingVariant === "2.4";
  const canAccessVideoCreditPacks = accountPlan !== null
    && (usesV24PurchaseTabs || accountPlan !== "free")
    && isVideoCreditPackPricingVariant(activeVideoPricingVariant);
  const showVideoCreditPacks = canAccessVideoCreditPacks && (
    usesV24PurchaseTabs
    || pricingView === "credit_pack"
    || (
      accountCreditBalance !== null
      && shouldShowAccountUpgradeCreditPackEntry({
        isLoggedIn: true,
        accountPlan,
        pricingVariant: activeVideoPricingVariant
      })
    )
  );
  const visibleVideoCreditPacks = usesV24PurchaseTabs ? V24_VIDEO_CREDIT_PACKS : activeVideoPricingVariant === "2.5" ? V25_VIDEO_CREDIT_PACKS : SELF_SERVE_VIDEO_CREDIT_PACKS;
  const selectedVideoCreditPack = visibleVideoCreditPacks.find((pack) => pack.packageId === selectedVideoCreditPackId)
    ?? visibleVideoCreditPacks[0]
    ?? VIDEO_CREDIT_PACKS[0];

  useEffect(() => {
    setPreviewLoaded(false);
    setPreviewFailed(false);
    setPreviewMuted(true);
  }, [video?.url, open]);

  useEffect(() => {
    if (!open) return;
    setVideoBillingInterval(initialBillingInterval ?? (activeVideoPricingVariant === "2.3" ? "year" : "month"));
    setSelectedVideoPlanKey(activeVideoPricingVariant === "2.4"
      ? resolveDefaultSubscriptionCheckoutPlan(activeVideoPricingVariant)
      : presentation === "app" ? "pro" : "standard");
    setSelectedVideoCreditPackId(activeVideoPricingVariant === "2.4"
      ? "image_credit_pack_500_v24"
      : "video_credit_pack_6000_v20");
    setPricingView(defaultView);
  }, [activeVideoPricingVariant, defaultView, initialBillingInterval, open, presentation]);

  useEffect(() => {
    if (!open) return;

    if (defaultView === "credit_pack" && initialAccountPlan && initialAccountPlan !== "free") {
      setAccountPlan(initialAccountPlan);
      setAccountCreditBalance(Number.isFinite(initialCreditBalance)
        ? Math.max(0, Math.floor(initialCreditBalance ?? 0))
        : null);
      setBillingMarket(initialBillingMarket ?? "default");
      setPricingError("");
      return;
    }

    let cancelled = false;
    setAccountPlan(null);
    setAccountCreditBalance(null);
    setBillingMarket(null);
    setPricingError("");
    void fetchSocialmediaAccount({ force: true })
      .then((data) => {
        if (cancelled) return;
        const isV22Basic = data.user?.subscription_package_id === "basic_monthly_v22"
          || data.user?.subscription_package_id === "basic_annual_v22";
        setAccountPlan(defaultView === "credit_pack"
          ? normalizeAccountPlan(data.user?.plan)
          : isV22Basic ? "free" : normalizeAccountPlan(data.user?.plan));
        setAccountCreditBalance(typeof data.user?.credit_balance === "number"
          ? Math.max(0, Math.floor(data.user.credit_balance))
          : null);
        setBillingMarket(data.user?.billing_market === "gb" || data.billing_market === "gb"
          ? "gb"
          : data.user?.billing_market === "ca" || data.billing_market === "ca" ? "ca" : "default");
      })
      .catch(() => {
        if (cancelled) return;
        setAccountPlan("free");
        setAccountCreditBalance(null);
        setPricingError("Unable to confirm your billing region. Please close this window and try again.");
      });

    return () => {
      cancelled = true;
    };
  }, [defaultView, initialAccountPlan, initialBillingMarket, initialCreditBalance, open]);

  useEffect(() => {
    if (!open || !video?.url) return;
    const previewVideo = previewVideoRef.current;
    if (!previewVideo) return;
    let cancelled = false;
    const markPreviewLoaded = () => {
      if (cancelled) return;
      setPreviewLoaded(true);
      setPreviewFailed(false);
    };
    previewVideo.addEventListener("loadeddata", markPreviewLoaded);
    if (previewVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) markPreviewLoaded();

    async function playMutedPreview() {
      if (!previewVideo) return;
      previewVideo.defaultMuted = true;
      previewVideo.muted = true;
      setPreviewMuted(true);

      try {
        await previewVideo.play();
      } catch {
        // Keep native controls available if autoplay is blocked entirely.
      }
    }

    void playMutedPreview();

    return () => {
      cancelled = true;
      previewVideo.removeEventListener("loadeddata", markPreviewLoaded);
    };
  }, [open, video?.url]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function downloadBlob(blob: Blob, fileName: string) {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  function openVideoUrlDownloadFallback(fileName: string) {
    if (!video?.url) return;
    const link = document.createElement("a");
    link.href = video.url;
    link.download = fileName;
    link.rel = "noreferrer";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function togglePreviewSound() {
    const previewVideo = previewVideoRef.current;
    if (!previewVideo) return;
    if (!previewVideo.muted && previewVideo.volume > 0) {
      previewVideo.muted = true;
      setPreviewMuted(true);
      return;
    }
    previewVideo.defaultMuted = false;
    previewVideo.muted = false;
    previewVideo.volume = 1;
    setPreviewMuted(false);
    try {
      await previewVideo.play();
    } catch {
      previewVideo.muted = true;
      setPreviewMuted(true);
    }
  }

  async function downloadWatermarkedVideo() {
    const assetId = readVideoAssetId(video);
    const videoIndex = readVideoIndex(video);
    let fileName = "vismuse-watermarked-video.mp4";
    let sourceUrl = video?.url ?? "";
    captureAnalyticsEvent("pricing_modal_watermarked_download_clicked", {
      action: "download_watermarked",
      status: "started",
      checkout_scenario: "video_sidebar_pricing_modal",
      billing_surface: "video_sidebar_pricing_modal",
      modal_variant: "post_generation_video_subscription",
      job_id: jobId,
      session_id: sessionId,
      asset_id: assetId || undefined,
      video_index: videoIndex,
      displayed_video_access_variant: video?.accessVariant ?? video?.access_variant,
      is_watermarked_download: true
    });
    if (!video?.url) {
      openVideoUrlDownloadFallback(fileName);
      return;
    }

    try {
      if (jobId) {
        const params = new URLSearchParams();
        if (assetId) params.set("assetId", assetId);
        const response = await fetch(
          `/api/v1/jobs/${encodeURIComponent(jobId)}/videos/${videoIndex}/download${params.toString() ? `?${params}` : ""}`,
          { cache: "no-store" }
        );
        if (response.ok) {
          const data = await response.json().catch(() => ({})) as VideoDownloadRouteResponse;
          sourceUrl = data.url?.trim() || sourceUrl;
          fileName = data.fileName?.trim() || data.file_name?.trim() || fileName;
        }
      }
      const response = await fetch(sourceUrl, { credentials: "omit" });
      if (!response.ok) throw new Error("Failed to download video");
      downloadBlob(await response.blob(), fileName);
      captureAnalyticsEvent("generation_downloaded", {
        action: "download",
        stage: "asset",
        status: "success",
        download_source: "subscription_modal_watermarked",
        checkout_scenario: "video_sidebar_pricing_modal",
        modal_variant: "post_generation_video_subscription",
        job_id: jobId,
        session_id: sessionId,
        asset_id: assetId || undefined,
        video_index: videoIndex,
        is_watermarked_download: true
      });
    } catch (error) {
      captureAnalyticsEvent("pricing_modal_watermarked_download_failed", {
        action: "download_watermarked",
        status: "failed",
        checkout_scenario: "video_sidebar_pricing_modal",
        billing_surface: "video_sidebar_pricing_modal",
        modal_variant: "post_generation_video_subscription",
        job_id: jobId,
        session_id: sessionId,
        asset_id: assetId || undefined,
        video_index: videoIndex,
        reason: error instanceof Error ? error.message : "download_failed"
      });
      openVideoUrlDownloadFallback(fileName);
    }
  }

  async function startVideoCheckout(packageId: VideoCheckoutPackageId) {
    if (billingMarket === null) {
      setPricingError("Checking your billing region. Please try again in a moment.");
      return;
    }
    const isCreditPackCheckout = isVideoCreditPackPackageId(packageId);
    if (isCreditPackCheckout && (
      accountPlan === null
      || (!usesV24PurchaseTabs && accountPlan === "free")
      || !isVideoCreditPackPricingVariant(activeVideoPricingVariant)
    )) {
      setPricingError(accountPlan === null
        ? "Checking your current plan. Please try again in a moment."
        : "One-time video credit packs are available to paid members only.");
      return;
    }
    const requestedPlan = videoSubscriptionPlans.find((plan) => plan.packageId === packageId);
    if (requestedPlan && (accountPlan === null || isUnavailableVideoSubscriptionPlan(requestedPlan, accountPlan))) {
      setPricingError(accountPlan === null
        ? "Checking your current plan. Please try again in a moment."
        : "Your current plan is already included. Choose a higher plan to upgrade.");
      return;
    }
    const plan = videoSubscriptionPlans.find((item) => item.packageId === packageId);
    const assetId = readVideoAssetId(video);
    const videoIndex = readVideoIndex(video);
    const isUnlockCheckout = packageId === VIDEO_SINGLE_UNLOCK_PACKAGE_ID;
    const checkoutPricingVariant = isCreditPackCheckout
      ? activeVideoPricingVariant
      : isUnlockCheckout
        ? resolveVideoSingleUnlockCheckoutPricingVariant(activeVideoPricingVariant)
        : !usesExperimentVideoCatalog
          ? LEGACY_VIDEO_SINGLE_UNLOCK_PRICING_VARIANT
          : activeVideoPricingVariant;
    const checkoutOffer = resolveBillingOffer({
      packageId,
      market: isCreditPackCheckout ? creditPackBillingMarket : billingMarket,
      pricingVariant: checkoutPricingVariant
    });
    const returnPath = typeof window === "undefined"
      ? "/ai-video-generator"
      : `${window.location.pathname}${window.location.search}`;
    const checkoutContext = buildCheckoutAnalyticsProperties(packageId, {
      action: "checkout_start",
      status: "started",
      checkout_scenario: "video_sidebar_pricing_modal",
      billing_surface: "video_sidebar_pricing_modal",
      checkout_mode: isCreditPackCheckout
        ? "one_time_video_credit_pack"
        : isUnlockCheckout
          ? "one_time_video_unlock"
          : "video_subscription",
      pricing_variant: checkoutPricingVariant,
      job_id: jobId,
      session_id: sessionId,
      asset_id: assetId || undefined,
      video_index: videoIndex,
      displayed_video_access_variant: video?.accessVariant ?? video?.access_variant,
      value: checkoutOffer.amount,
      currency: checkoutOffer.currency
    });
    rememberCheckoutContext(checkoutContext);

    captureAnalyticsEvent(
      isCreditPackCheckout
        ? "pricing_modal_video_credit_pack_clicked"
        : isUnlockCheckout
          ? "pricing_modal_video_unlock_clicked"
          : "pricing_modal_subscribe_clicked",
      checkoutContext
    );
    captureAnalyticsEvent("checkout_plan_selected", checkoutContext);
    captureAnalyticsEvent("checkout_started_web", checkoutContext);
    setPricingPendingPackage(packageId);
    setPricingError("");

    const checkoutIntentKey = createGoogleAdsCheckoutIntentDedupeKey(packageId);
    const googleAdsBeginCheckout = trackGoogleAdsBeginCheckoutConversion({
      dedupeKey: checkoutIntentKey,
      packageId,
      value: checkoutOffer.amount,
      currency: checkoutOffer.currency
    });

    try {
      const response = await fetch("/api/v1/credits/recharge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": createClientIdempotencyKey()
        },
        body: JSON.stringify({
          package_id: packageId,
          pricing_variant: checkoutPricingVariant,
          return_to: returnPath,
          ...(isCreditPackCheckout ? { checkout_context: VIDEO_CREDIT_PACK_CHECKOUT_TYPE } : {}),
          ...((!isCreditPackCheckout || usesV24PurchaseTabs) && isUuid(jobId) ? { job_id: jobId } : {}),
          ...((!isCreditPackCheckout || usesV24PurchaseTabs) && isUuid(sessionId) ? { session_id: sessionId } : {}),
          ...((!isCreditPackCheckout || usesV24PurchaseTabs) && isUuid(assetId) ? { asset_id: assetId } : {}),
          attribution: getStoredAttribution()
        })
      });
      const data = await response.json().catch(() => ({})) as {
        checkout_url?: string;
        transaction_id?: string;
        payment_provider?: string;
        package_id?: BillingPackageId;
        pricing_variant?: PricingVariant;
        value?: number;
        currency?: string;
        error?: string;
      };

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setPricingPendingPackage("");
          setPricingError("Please sign in before subscribing.");
          window.dispatchEvent(new CustomEvent("vismuse:socialmedia-open-auth", {
            detail: {
              message: "Sign in or create an account to continue to secure checkout.",
              promptCase: "video_subscription_checkout",
              nextPath: returnPath
            }
          }));
          return;
        }
        throw new Error(data.error || "Checkout failed.");
      }

      if (!data.checkout_url) {
        throw new Error("Checkout link is missing.");
      }

      await googleAdsBeginCheckout;
      rememberCheckoutContext(buildCheckoutAnalyticsProperties(packageId, {
        ...checkoutContext,
        checkout_id: data.transaction_id,
        provider: data.payment_provider,
        transaction_id: data.transaction_id,
        value: data.value ?? checkoutOffer.amount,
        currency: data.currency ?? checkoutOffer.currency
      }));
      onCheckoutCreated?.({
        checkoutId: data.transaction_id,
        packageId: data.package_id ?? packageId,
        paymentProvider: data.payment_provider,
        pricingVariant: data.pricing_variant ?? checkoutPricingVariant,
        assetId: assetId || undefined,
        jobId: isUuid(jobId) ? jobId : undefined,
        sessionId: isUuid(sessionId) ? sessionId : undefined,
        isUnlockCheckout
      });
      window.location.assign(data.checkout_url);
    } catch (error) {
      setPricingPendingPackage("");
      setPricingError(error instanceof Error ? error.message : "Checkout failed.");
      captureAnalyticsEvent("checkout_failed", buildCheckoutAnalyticsProperties(packageId, {
        action: "checkout_failed",
        status: "failed",
        checkout_scenario: "video_sidebar_pricing_modal",
        billing_surface: "video_sidebar_pricing_modal",
        pricing_variant: checkoutPricingVariant,
        plan: plan?.name.toLowerCase(),
        reason: error instanceof Error ? error.message : "Checkout failed."
      }));
    }
  }

  function selectV24PurchaseView(nextView: VideoPricingDefaultView) {
    if (nextView === pricingView) return;
    setPricingView(nextView);
  }

  function handleV24PurchaseTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const nextView: VideoPricingDefaultView = event.key === "ArrowLeft" || event.key === "Home"
      ? "subscription"
      : "credit_pack";
    selectV24PurchaseView(nextView);
    window.requestAnimationFrame(() => {
      document.getElementById(nextView === "subscription"
        ? "video-subscription-purchase-tab"
        : "video-credit-pack-purchase-tab")?.focus();
    });
  }

  function renderV24VideoCreditPackPanel() {
    const selectedPack = V24_VIDEO_CREDIT_PACKS.find((pack) => pack.packageId === selectedVideoCreditPackId)
      ?? V24_VIDEO_CREDIT_PACKS[0];
    const selectedOffer = resolveBillingOffer({
      packageId: selectedPack.packageId,
      market: creditPackBillingMarket,
      pricingVariant: "2.4"
    });

    return (
      <>
        <div className={modalStyles.subscriptionCopyDetails}>
          <h2 id="video-subscription-modal-title">Unlock this video with <span>Credit Pack</span></h2>
          <p className={modalStyles.subscriptionSubcopy}>No subscription. Buy once. Credits are valid for 90 days.</p>
        </div>

        {pricingError ? <p className={styles.videoPricingError}>{pricingError}</p> : null}

        <div className={modalStyles.creditPackGrid} aria-label="Choose video credit pack">
          {V24_VIDEO_CREDIT_PACKS.map((pack) => {
            const selected = pack.packageId === selectedPack.packageId;
            const offer = resolveBillingOffer({
              packageId: pack.packageId,
              market: creditPackBillingMarket,
              pricingVariant: "2.4"
            });
            return (
              <button
                type="button"
                key={pack.packageId}
                className={`${modalStyles.creditPackOption} ${selected ? modalStyles.creditPackOptionSelected : ""}`.trim()}
                onClick={() => setSelectedVideoCreditPackId(pack.packageId)}
                disabled={pricingPendingPackage !== ""}
                aria-pressed={selected}
              >
                <span className={modalStyles.creditPackRadio} aria-hidden="true">
                  {selected ? <Check size={14} aria-hidden="true" /> : null}
                </span>
                <span className={modalStyles.creditPackOptionCopy}>
                  <span className={modalStyles.creditPackOptionTop}><strong>{pack.credits.toLocaleString()} credits</strong></span>
                  <small>≈ {pack.estimatedVideos.toLocaleString()} videos</small>
                </span>
                <span className={modalStyles.creditPackPrice}>
                  <span>{formatBillingAmount(offer.amount, offer.currency)}</span>
                  <small>{formatVideoCreditPackUnitPrice({
                    amount: offer.amount,
                    currency: offer.currency,
                    estimatedVideos: pack.estimatedVideos
                  })}</small>
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className={modalStyles.creditPackPrimaryButton}
          onClick={() => void startVideoCheckout(selectedPack.packageId)}
          disabled={pricingPendingPackage !== ""}
        >
          {pricingPendingPackage
            ? "Processing..."
            : `Get ${selectedPack.credits.toLocaleString()} credits and unlock this video`}
          {!pricingPendingPackage ? <ArrowRight size={18} aria-hidden="true" /> : null}
        </button>
        <p className={modalStyles.creditPackFootnote}>
          {formatBillingAmount(selectedOffer.amount, selectedOffer.currency)} one-time payment · Credits valid for 90 days
        </p>
        <button
          type="button"
          className={modalStyles.subscriptionInlineStarterButton}
          onClick={() => void startVideoCheckout(VIDEO_SINGLE_UNLOCK_PACKAGE_ID)}
          disabled={pricingPendingPackage !== "" || billingMarket === null}
        >
          {pricingPendingPackage === VIDEO_SINGLE_UNLOCK_PACKAGE_ID
            ? "Processing..."
            : videoUnlockPriceLabel
              ? `Unlock this video only for ${videoUnlockPriceLabel}`
              : "Checking price..."}
        </button>
        <button
          type="button"
          className={modalStyles.subscriptionTertiaryButton}
          onClick={() => void downloadWatermarkedVideo()}
          disabled={pricingPendingPackage !== ""}
        >
          <Download size={13} aria-hidden="true" />
          <span className={modalStyles.subscriptionTertiaryLabel}>Download with watermark</span>
        </button>
      </>
    );
  }

  function renderVideoCreditPacks() {
    if (!showVideoCreditPacks) return null;

    const workspaceTopup = pricingView === "credit_pack";
    const creditPackValidityLabel = usesV24PurchaseTabs ? "90 days" : "one year";
    const selectedVideoCreditPackOffer = resolveBillingOffer({
      packageId: selectedVideoCreditPack.packageId,
      market: creditPackBillingMarket,
      pricingVariant: activeVideoPricingVariant
    });

    return (
      <section className={styles.videoCreditPackSection} aria-labelledby="video-credit-pack-title">
        <div className={styles.videoCreditPackHeading}>
          <div>
            <h3 id="video-credit-pack-title">{workspaceTopup ? "Choose a credit pack" : "Add credits"}</h3>
            <p>One-time purchase. Credits are valid for {creditPackValidityLabel} and your subscription stays unchanged.</p>
          </div>
          <span>Paid members</span>
        </div>
        <div className={styles.videoCreditPackGrid} role="radiogroup" aria-label={`Choose a ${creditPackValidityLabel} credit pack`}>
          {visibleVideoCreditPacks.map((pack) => {
            const selected = pack.packageId === selectedVideoCreditPack.packageId;
            const estimatedSeconds = Math.round(pack.credits / 20);
            const offer = resolveBillingOffer({
              packageId: pack.packageId,
              market: creditPackBillingMarket,
              pricingVariant: activeVideoPricingVariant
            });
            return (
              <button
                type="button"
                key={pack.packageId}
                className={`${styles.videoCreditPackOption} ${selected ? styles.videoCreditPackOptionSelected : ""}`.trim()}
                onClick={() => setSelectedVideoCreditPackId(pack.packageId)}
                disabled={pricingPendingPackage !== ""}
                role="radio"
                aria-checked={selected}
              >
                <span className={styles.videoCreditPackRadio} aria-hidden="true">{selected ? <Check size={13} /> : null}</span>
                <span className={styles.videoCreditPackCopy}>
                  <strong>{pack.credits.toLocaleString()} credits</strong>
                  <small>{workspaceTopup
                    ? `Valid for ${creditPackValidityLabel}`
                    : "estimatedVideos" in pack
                      ? `≈ ${pack.estimatedVideos.toLocaleString()} videos`
                      : `≈ ${estimatedSeconds}s at 480p / 720p`}</small>
                </span>
                <strong className={styles.videoCreditPackPrice}>{formatBillingAmount(offer.amount, offer.currency)}</strong>
              </button>
            );
          })}
        </div>
        <a className={`${styles.videoCreditPackOption} ${styles.videoCreditPackContactOption}`} href={SALES_CONTACT_HREF}>
          <span className={styles.videoCreditPackRadio} aria-hidden="true"><Sparkles size={12} /></span>
          <span className={styles.videoCreditPackCopy}>
            <strong>Need more credits?</strong>
            <small>Talk to us about custom volume and limits</small>
          </span>
          <strong className={styles.videoCreditPackContactCta}>Contact sales <ArrowRight size={16} aria-hidden="true" /></strong>
        </a>
        <button
          type="button"
          className={styles.videoCreditPackBuyButton}
          onClick={() => void startVideoCheckout(selectedVideoCreditPack.packageId)}
          disabled={pricingPendingPackage !== ""}
        >
          {pricingPendingPackage === selectedVideoCreditPack.packageId
            ? "Processing..."
            : `Buy ${selectedVideoCreditPack.credits.toLocaleString()} credits · ${formatBillingAmount(
              selectedVideoCreditPackOffer.amount,
              selectedVideoCreditPackOffer.currency
            )}`}
          {pricingPendingPackage !== selectedVideoCreditPack.packageId ? <ArrowRight size={18} aria-hidden="true" /> : null}
        </button>
      </section>
    );
  }

  if (!open) return null;

  if (hasVideoPreview && video?.url) {
    const poster = video.thumbnailUrl ?? video.thumbnail_url;
    return (
      <div
        className={`${modalStyles.subscriptionModalBackdrop}${pricingVariant === "2.4" ? ` ${modalStyles.subscriptionModalBackdropV24}` : ""}`}
        role="presentation"
      >
        <div className={modalStyles.subscriptionModal} role="dialog" aria-modal="true" aria-labelledby="video-subscription-modal-title" onClick={(event) => event.stopPropagation()}>
          <nav className={modalStyles.subscriptionModalNav} aria-label="Subscription dialog navigation">
            <button
              type="button"
              className={modalStyles.subscriptionModalBack}
              onClick={onClose}
              aria-label="Close subscription dialog"
            >
              <ChevronLeft size={22} aria-hidden="true" />
              <Image src="/brand/icon-192.png" alt="Hotel Lobby AI" width={30} height={30} priority />
            </button>
            <button
              type="button"
              className={modalStyles.subscriptionModalClose}
              onClick={onClose}
              aria-label="Close subscription dialog"
            >
              <X size={22} aria-hidden="true" />
            </button>
          </nav>

          <div className={modalStyles.subscriptionModalFrame}>
            <div className={modalStyles.subscriptionPreviewPane}>
              {!previewLoaded && !previewFailed ? (
                <span className={modalStyles.modalPreviewImageLoading} role="status" aria-label="Loading preview video">
                  {presentation === "legacy" ? <OriginalThinkingLoader className={modalStyles.modalPreviewImageLoader} size={96} /> : null}
                </span>
              ) : null}
              {previewFailed ? <span className={modalStyles.modalPreviewImageError}>Video preview unavailable</span> : null}
              <video
                ref={previewVideoRef}
                className={previewLoaded ? modalStyles.modalPreviewImageLoaded : modalStyles.modalPreviewImageHidden}
                src={video.url}
                poster={poster}
                controls
                autoPlay
                muted={previewMuted}
                loop
                playsInline
                preload="metadata"
                onLoadedData={() => {
                  setPreviewLoaded(true);
                  setPreviewFailed(false);
                }}
                onError={() => {
                  setPreviewFailed(true);
                  setPreviewLoaded(false);
                }}
                onVolumeChange={() => {
                  const previewVideo = previewVideoRef.current;
                  if (!previewVideo) return;
                  const isMuted = previewVideo.muted || previewVideo.volume === 0;
                  setPreviewMuted(isMuted);
                }}
              />
              {previewLoaded && !previewFailed ? (
                <button
                  type="button"
                  className={modalStyles.modalPreviewSoundButton}
                  onClick={() => void togglePreviewSound()}
                  aria-label={previewMuted ? "Unmute preview sound" : "Mute preview sound"}
                >
                  {previewMuted ? <VolumeX size={24} aria-hidden="true" /> : <Volume2 size={24} aria-hidden="true" />}
                </button>
              ) : null}
            </div>

            <div className={modalStyles.subscriptionCopyPane}>
              {usesV24PurchaseTabs && showVideoCreditPacks ? (
                <div className={modalStyles.subscriptionPurchaseTabs} role="tablist" aria-label="Choose purchase type">
                  <button
                    id="video-subscription-purchase-tab"
                    type="button"
                    role="tab"
                    className={`${modalStyles.subscriptionPurchaseTab} ${pricingView === "subscription" ? modalStyles.subscriptionPurchaseTabActive : ""}`.trim()}
                    aria-selected={pricingView === "subscription"}
                    aria-controls="video-subscription-purchase-panel"
                    tabIndex={pricingView === "subscription" ? 0 : -1}
                    onClick={() => selectV24PurchaseView("subscription")}
                    onKeyDown={handleV24PurchaseTabKeyDown}
                    disabled={pricingPendingPackage !== ""}
                  >
                    Subscription
                  </button>
                  <button
                    id="video-credit-pack-purchase-tab"
                    type="button"
                    role="tab"
                    className={`${modalStyles.subscriptionPurchaseTab} ${pricingView === "credit_pack" ? modalStyles.subscriptionPurchaseTabActive : ""}`.trim()}
                    aria-selected={pricingView === "credit_pack"}
                    aria-controls="video-subscription-purchase-panel"
                    tabIndex={pricingView === "credit_pack" ? 0 : -1}
                    onClick={() => selectV24PurchaseView("credit_pack")}
                    onKeyDown={handleV24PurchaseTabKeyDown}
                    disabled={pricingPendingPackage !== ""}
                  >
                    Credit packs
                  </button>
                </div>
              ) : null}

              <div
                id={usesV24PurchaseTabs ? "video-subscription-purchase-panel" : undefined}
                role={usesV24PurchaseTabs ? "tabpanel" : undefined}
                aria-labelledby={usesV24PurchaseTabs
                  ? pricingView === "credit_pack" ? "video-credit-pack-purchase-tab" : "video-subscription-purchase-tab"
                  : undefined}
                className={modalStyles.subscriptionPurchasePanel}
              >
                {usesV24PurchaseTabs && pricingView === "credit_pack" ? renderV24VideoCreditPackPanel() : (
                  <>
                    <div id="video-subscription-copy-details" className={modalStyles.subscriptionCopyDetails}>
                      <h2 id="video-subscription-modal-title">Unlock this video with <span>{selectedVideoPlanDisplayName}</span></h2>
                      <p className={modalStyles.subscriptionPriceLine}>
                        {selectedVideoPlanDisplayName} · {selectedVideoPlan.priceLineLabel}
                      </p>
                      <p className={modalStyles.subscriptionSubcopy}>
                        You&apos;re viewing a watermarked video preview. Upgrade to {selectedVideoPlanDisplayName} to unlock the HD original video and get the benefits below.
                      </p>
                      <button
                        type="button"
                        className={modalStyles.subscriptionBenefitsToggle}
                        onClick={() => setVideoBenefitsOpen((open) => !open)}
                        aria-expanded={videoBenefitsOpen}
                        aria-controls="video-subscription-benefits-list"
                      >
                        <span>Benefits included</span>
                        <ChevronRight
                          className={videoBenefitsOpen ? modalStyles.subscriptionBenefitsToggleIconOpen : modalStyles.subscriptionBenefitsToggleIcon}
                          size={16}
                          aria-hidden="true"
                        />
                      </button>

                      <ul
                        id="video-subscription-benefits-list"
                        className={`${modalStyles.subscriptionFeatureList} ${modalStyles.subscriptionFeatureListCollapsible} ${videoBenefitsOpen ? modalStyles.subscriptionFeatureListOpen : ""}`.trim()}
                      >
                        {selectedVideoPlan.features.map((feature) => (
                          <li key={feature}>
                            <Check size={18} aria-hidden="true" />
                            <span><strong>{feature}</strong></span>
                          </li>
                        ))}
                      </ul>

                      <div className={modalStyles.subscriptionBillingRow}>
                        <button
                          type="button"
                          className={modalStyles.billingSwitchButton}
                          onClick={() => setVideoBillingInterval((current) => current === "year" ? "month" : "year")}
                          aria-pressed={videoBillingInterval === "year"}
                          aria-label="Toggle annual billing"
                        >
                          <span className={modalStyles.billingSwitchText}>Annually</span>
                          <span className={modalStyles.billingSwitchSave}>{activeVideoPricingVariant === "2.5" ? "Save up to 30%" : "Save 50%"}</span>
                          <span
                            className={`${modalStyles.billingSwitchTrack} ${videoBillingInterval === "year" ? modalStyles.billingSwitchTrackOn : ""}`.trim()}
                            aria-hidden="true"
                          >
                            <span className={modalStyles.billingSwitchThumb} />
                          </span>
                        </button>
                      </div>

                      <div className={modalStyles.subscriptionPlanSelector} aria-label="Choose video plan">
                        {videoSubscriptionPlans.map((plan) => {
                          const displayName = resolveFrontendBillingPlanName(activeVideoPricingVariant, plan.key, plan.name);
                          const selected = selectedVideoPlan.key === plan.key;
                          const unavailable = isUnavailableVideoSubscriptionPlan(plan, accountPlan);
                          return (
                            <button
                              type="button"
                              key={plan.packageId}
                              className={selected ? `${modalStyles.subscriptionPlanOption} ${modalStyles.subscriptionPlanOptionSelected}` : modalStyles.subscriptionPlanOption}
                              onClick={() => setSelectedVideoPlanKey(plan.key)}
                              disabled={pricingPendingPackage !== "" || accountPlan === null || unavailable}
                              aria-pressed={selected}
                            >
                              <span className={modalStyles.subscriptionPlanOptionRadio} aria-hidden="true">
                                {selected ? <Check size={14} aria-hidden="true" /> : null}
                              </span>
                              <span className={modalStyles.subscriptionPlanOptionCopy}>
                                <strong className={modalStyles.subscriptionPlanOptionName}>{displayName}</strong>
                                <span className={modalStyles.subscriptionPlanOptionMeta}>{unavailable ? unavailablePlanLabel(plan, accountPlan) : plan.badge}</span>
                              </span>
                              <span className={modalStyles.subscriptionPlanOptionPriceBlock}>
                                <span className={modalStyles.subscriptionPlanOptionPrice}>
                                  <strong>{plan.price}</strong>
                                  <small>/month</small>
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {!usesV24PurchaseTabs ? renderVideoCreditPacks() : null}
                    </div>
                    {pricingError ? <p className={styles.videoPricingError}>{pricingError}</p> : null}

                    <button
                      type="button"
                      className={modalStyles.subscriptionPrimaryButton}
                      onClick={() => void startVideoCheckout(selectedVideoPlan.packageId)}
                      disabled={pricingPendingPackage !== "" || accountPlan === null || selectedPlanUnavailable}
                    >
                      {pricingPendingPackage
                        ? "Processing..."
                        : selectedPlanUnavailable
                          ? unavailablePlanLabel(selectedVideoPlan, accountPlan)
                          : `Start ${selectedVideoPlanDisplayName} and unlock this video`}
                      {!pricingPendingPackage ? <ArrowRight size={20} aria-hidden="true" /> : null}
                    </button>

                    <p className={modalStyles.subscriptionFootnote}>
                      {selectedVideoPlanPaymentExplanation}
                    </p>

                    {isVideoSingleUnlockAvailableForPricingVariant(activeVideoPricingVariant) ? (
                      <button
                        type="button"
                        className={modalStyles.subscriptionInlineStarterButton}
                        onClick={() => void startVideoCheckout(VIDEO_SINGLE_UNLOCK_PACKAGE_ID)}
                        disabled={pricingPendingPackage !== "" || billingMarket === null}
                      >
                        {pricingPendingPackage === VIDEO_SINGLE_UNLOCK_PACKAGE_ID
                          ? "Processing..."
                          : videoUnlockPriceLabel
                            ? `Unlock this video only for ${videoUnlockPriceLabel}`
                            : "Checking price..."}
                      </button>
                    ) : null}

                    <button
                      type="button"
                      className={modalStyles.subscriptionTertiaryButton}
                      onClick={() => void downloadWatermarkedVideo()}
                      disabled={pricingPendingPackage !== ""}
                    >
                      <Download size={13} aria-hidden="true" />
                      <span className={modalStyles.subscriptionTertiaryLabel}>Download with watermark</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (pricingView === "credit_pack") {
    const upgradeTarget = accountPlan === "basic" ? "Pro" : "Max";
    const canUpgrade = accountPlan === "basic" || accountPlan === "pro";

    return (
      <div className={modalStyles.pricingModalBackdrop} role="presentation" onClick={onClose}>
        <div
          className={`${modalStyles.pricingModal} ${presentation === "app" ? modalStyles.pricingModalV18 : ""}`.trim()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="credit-pack-pricing-title"
          onClick={(event) => event.stopPropagation()}
        >
          <nav className={modalStyles.pricingModalNav} aria-label="Credit pack dialog navigation">
            <button type="button" className={modalStyles.pricingModalBack} onClick={onClose} aria-label="Close credit pack dialog">
              <ChevronLeft size={22} aria-hidden="true" />
              <Image src="/brand/icon-192.png" alt="Hotel Lobby AI" width={30} height={30} priority />
            </button>
            <button type="button" className={modalStyles.pricingModalClose} onClick={onClose} aria-label="Close credit pack dialog">
              <X size={22} aria-hidden="true" />
            </button>
          </nav>

          <div className={modalStyles.pricingModalBody}>
            <div className={modalStyles.pricingModalHead}>
              <h2 id="credit-pack-pricing-title">Add credits</h2>
              <p>Keep creating with a one-time credit pack. Purchased credits are valid for {usesV24PurchaseTabs ? "90 days" : "one year"} and your current plan stays unchanged.</p>
            </div>

            {pricingError ? <p className={modalStyles.pricingModalError}>{pricingError}</p> : null}
            {accountPlan === null ? (
              <p className={styles.videoCreditPackLoading} role="status">Checking your account and billing region…</p>
            ) : showVideoCreditPacks ? renderVideoCreditPacks() : (
              <p className={modalStyles.pricingModalError}>Credit packs are not available for this account or billing region.</p>
            )}

            {canUpgrade ? (
              <div className={styles.videoCreditPackSecondary}>
                <button type="button" onClick={() => setPricingView("subscription")} disabled={pricingPendingPackage !== ""}>
                  Need more every month? Upgrade to {upgradeTarget}
                </button>
              </div>
            ) : accountPlan !== "max" ? (
              <div className={styles.videoCreditPackSecondary}>
                <button type="button" onClick={() => setPricingView("subscription")} disabled={pricingPendingPackage !== ""}>
                  View subscription plans
                </button>
              </div>
            ) : null}

            <p className={modalStyles.pricingCheckoutFootnote}>
              <span className={modalStyles.pricingMerchantFootnote}>Secure checkout. Purchased credits are valid for {usesV24PurchaseTabs ? "90 days" : "one year"}.</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return localizeUiTree((
    <div className={modalStyles.pricingModalBackdrop} role="presentation" onClick={onClose}>
      <div
        className={`${modalStyles.pricingModal} ${presentation === "app" ? modalStyles.pricingModalV18 : ""}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-pricing-title"
        onClick={(event) => event.stopPropagation()}
      >
        <nav className={modalStyles.pricingModalNav} aria-label="Video pricing dialog navigation">
          <button
            type="button"
            className={modalStyles.pricingModalBack}
            onClick={onClose}
            aria-label="Close pricing dialog"
          >
            <ChevronLeft size={22} aria-hidden="true" />
            <Image src="/brand/icon-192.png" alt="Hotel Lobby AI" width={30} height={30} priority />
          </button>
          <button
            type="button"
            className={modalStyles.pricingModalClose}
            onClick={onClose}
            aria-label="Close pricing dialog"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </nav>

        <div className={modalStyles.pricingModalBody}>
          <div className={modalStyles.pricingModalHead}>
            <h2 id="video-pricing-title">Upgrade your video plan</h2>
            <p>Subscribe with video credits and keep creating directly from this workspace.</p>
          </div>

          {pricingError ? <p className={modalStyles.pricingModalError}>{pricingError}</p> : null}

          {presentation === "app" ? (
            <ul className={`${modalStyles.pricingModalBenefits} ${modalStyles.videoPricingModalBenefits}`.trim()} aria-label="Included video benefits">
              {selectedVideoPlan.features.map((feature) => (
                <li key={feature}>
                  <Check size={18} aria-hidden="true" />
                  <span><strong>{feature}</strong></span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className={presentation === "app" ? modalStyles.subscriptionBillingRow : modalStyles.pricingBillingRow}>
            <button
              type="button"
              className={modalStyles.billingSwitchButton}
              onClick={() => setVideoBillingInterval((current) => current === "year" ? "month" : "year")}
              aria-pressed={videoBillingInterval === "year"}
              aria-label="Toggle annual billing"
            >
              <span className={modalStyles.billingSwitchText}>Annually</span>
              <span className={modalStyles.billingSwitchSave}>{activeVideoPricingVariant === "2.5" ? "Save up to 30%" : "Save 50%"}</span>
              <span
                className={`${modalStyles.billingSwitchTrack} ${videoBillingInterval === "year" ? modalStyles.billingSwitchTrackOn : ""}`.trim()}
                aria-hidden="true"
              >
                <span className={modalStyles.billingSwitchThumb} />
              </span>
            </button>
          </div>

          <div className={modalStyles.pricingModalDesktopPlans}>
            <div className={modalStyles.pricingModalGrid} aria-label="Video pricing plans">
              {videoSubscriptionPlans.map((plan, planIndex) => {
                const displayName = resolveFrontendBillingPlanName(activeVideoPricingVariant, plan.key, plan.name);
                const displayCta = resolveFrontendBillingPlanCta(activeVideoPricingVariant, plan.key, plan.billingInterval, plan.cta);
                const Icon = plan.name === "Standard" ? Zap : plan.key === "max" || plan.name === "Ultimate" ? Crown : Sparkles;
                const planPending = pricingPendingPackage === plan.packageId;
                const unavailable = isUnavailableVideoSubscriptionPlan(plan, accountPlan);
                const disabled = pricingPendingPackage !== "" || accountPlan === null || unavailable;
                return (
                  <article
                    key={plan.name}
                    data-pricing-modal-plan-card={plan.name.toLowerCase()}
                    data-pricing-modal-plan-index={planIndex}
                    className={`${modalStyles.pricingPlanCard} ${plan.highlighted ? modalStyles.pricingPlanFeatured : ""}`.trim()}
                    aria-label={`${displayName} video plan`}
                  >
                    <Icon className={modalStyles.pricingPlanIcon} size={34} aria-hidden="true" />
                    <h3>{displayName}</h3>
                    <p className={modalStyles.pricingPlanSub}>{plan.badge}</p>
                    <p className={modalStyles.pricingPlanPrice}>
                      {plan.price} <span>{plan.currency !== "USD" ? "/ month" : "USD / month"}</span>
                    </p>
                    <span className={modalStyles.pricingPlanBadge}>{plan.badge}</span>
                    <button
                      type="button"
                      className={`${modalStyles.pricingPlanButton} ${plan.highlighted ? modalStyles.pricingPlanButtonHighlight : ""}`.trim()}
                      onClick={() => void startVideoCheckout(plan.packageId)}
                      disabled={disabled}
                    >
                      {planPending ? "Processing..." : unavailable ? unavailablePlanLabel(plan, accountPlan) : displayCta}
                    </button>
                    <p className={modalStyles.pricingPlanNote}>Cancel anytime.</p>
                    <ul>
                      {plan.features.map((feature) => (
                        <li key={feature}>
                          <Check size={15} aria-hidden="true" />
                          <span><strong>{feature}</strong></span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>

          <div
            className={[
              modalStyles.pricingModalMobilePlans,
              presentation === "app" ? modalStyles.pricingModalPlansV18 : ""
            ].filter(Boolean).join(" ")}
          >
            {presentation === "app" ? null : (
              <ul className={modalStyles.pricingModalBenefits} aria-label="Included benefits">
                {selectedVideoPlan.features.map((feature) => (
                  <li key={feature}>
                    <Check size={18} aria-hidden="true" />
                    <span><strong>{feature}</strong></span>
                  </li>
                ))}
              </ul>
            )}

            <div
              className={[
                presentation === "app" ? modalStyles.subscriptionPlanSelector : modalStyles.pricingMobilePlanList,
                presentation === "app" ? modalStyles.videoPricingPlanSelector : ""
              ].filter(Boolean).join(" ")}
              aria-label="Video pricing plans"
            >
              {videoSubscriptionPlans.map((plan, planIndex) => {
                const displayName = resolveFrontendBillingPlanName(activeVideoPricingVariant, plan.key, plan.name);
                const selected = plan.key === selectedVideoPlan.key;
                const unavailable = isUnavailableVideoSubscriptionPlan(plan, accountPlan);
                const disabled = pricingPendingPackage !== "" || accountPlan === null || unavailable;
                return (
                  <button
                    type="button"
                    key={plan.name}
                    data-pricing-modal-plan-card={plan.name.toLowerCase()}
                    data-pricing-modal-plan-index={planIndex}
                    className={[
                      modalStyles.subscriptionPlanOption,
                      presentation === "app" && !selected ? modalStyles.subscriptionPlanOptionCompact : "",
                      selected ? modalStyles.subscriptionPlanOptionSelected : ""
                    ].filter(Boolean).join(" ")}
                    onClick={() => setSelectedVideoPlanKey(plan.key)}
                    disabled={disabled}
                    aria-pressed={selected}
                    aria-label={`${displayName} video plan`}
                  >
                    <span className={modalStyles.subscriptionPlanOptionRadio} aria-hidden="true">
                      {selected ? <Check size={18} aria-hidden="true" /> : null}
                    </span>
                    <span className={modalStyles.subscriptionPlanOptionCopy}>
                      <span className={modalStyles.subscriptionPlanOptionCopyTopline}>
                        <strong className={modalStyles.subscriptionPlanOptionName}>{displayName}</strong>
                        <span className={modalStyles.subscriptionPlanOptionMeta}>{unavailable ? unavailablePlanLabel(plan, accountPlan) : plan.badge}</span>
                      </span>
                    </span>
                    <span className={modalStyles.subscriptionPlanOptionPriceBlock}>
                      <span className={modalStyles.subscriptionPlanOptionPrice}>
                        <strong>{plan.price}</strong>
                        <small>/month</small>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className={modalStyles.pricingModalPrimaryButton}
              onClick={() => void startVideoCheckout(selectedVideoPlan.packageId)}
              disabled={pricingPendingPackage !== "" || accountPlan === null || selectedPlanUnavailable}
            >
              {pricingPendingPackage === selectedVideoPlan.packageId
                ? "Processing..."
                : selectedPlanUnavailable
                  ? unavailablePlanLabel(selectedVideoPlan, accountPlan)
                  : resolveFrontendBillingPlanCta(
                    activeVideoPricingVariant,
                    selectedVideoPlan.key,
                    selectedVideoPlan.billingInterval,
                    selectedVideoPlan.cta
                  )}
            </button>
          </div>

          {renderVideoCreditPacks()}

          <p className={modalStyles.pricingCheckoutFootnote}>
            <span className={modalStyles.pricingMerchantFootnote}>Secure checkout. Credits apply to AI video generation.</span>
          </p>

          <section className={modalStyles.pricingFaq} aria-labelledby="video-pricing-faq-title">
            <h3 id="video-pricing-faq-title">Frequently Asked Questions</h3>
            <div className={modalStyles.pricingFaqList}>
              {videoPricingFaqs.map((item) => {
                const isOpen = videoPricingFaqOpen === item.id;
                return (
                  <article className={modalStyles.pricingFaqItem} key={item.id}>
                    <button
                      type="button"
                      className={modalStyles.pricingFaqQuestion}
                      onClick={() => setVideoPricingFaqOpen(isOpen ? null : item.id)}
                      aria-expanded={isOpen}
                    >
                      <span>{item.question}</span>
                      <ChevronRight className={isOpen ? modalStyles.pricingFaqChevronOpen : undefined} size={18} aria-hidden="true" />
                    </button>
                    {isOpen ? <p className={modalStyles.pricingFaqAnswer}>{item.answer}</p> : null}
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  ), uiLocale);
}
