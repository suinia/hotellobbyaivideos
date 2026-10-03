"use client";

import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";

import { safeReturnPath as sanitizeNextPath } from "@/lib/auth/safe-return-path";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, X } from "lucide-react";
import { captureAnalyticsEvent, getStoredAttribution } from "@/lib/analytics/posthog";
import {
  buildCheckoutAnalyticsProperties,
  clearCheckoutContext,
  mergeCheckoutReturnContext,
  readCheckoutContext,
  rememberCheckoutContext
} from "@/lib/analytics/checkout";
import { trackClientPaymentSuccess } from "@/lib/analytics/payment";
import { createGoogleAdsCheckoutIntentDedupeKey, trackGoogleAdsBeginCheckoutConversion } from "@/lib/analytics/google-ads";
import { clearCheckoutDiscountCode, markCheckoutDiscountCodeUsed, readCheckoutDiscountCode, rememberCheckoutDiscountCode } from "@/lib/billing/checkout-discount";
import {
  DEFAULT_PRICING_VARIANT,
  PRICING_EXPERIMENT_KEY,
  type PricingVariant,
  type PublicBillingPackage
} from "@/lib/billing/catalog";
import { isLocalizedBillingMarket, type BillingContext, type BillingCurrency, type BillingMarket } from "@/lib/billing/market";
import {
  formatBillingAmount,
  getLocalizedPublicBillingPackagesForVariant,
  type LocalizedPublicBillingPackage
} from "@/lib/billing/offers";
import { resolveFrontendBillingPlanCta, resolveFrontendBillingPlanName } from "@/lib/billing/plan-display";

import {
  resolveClientPricingExperimentVariant,
  resolveClientPricingExperimentVariantFromServer
} from "@/lib/billing/pricing-experiment-client";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { supabaseConfig } from "@/lib/supabase/config";
import {
  normalizeAuthEmail,
  sendSupabaseEmailOtp,
  verifySupabaseEmailOtp
} from "@/lib/supabase/email-otp";
import HotelSiteFooter from "@/components/hotel-site-footer";

import GoogleOneTap from "@/components/google-one-tap";
import styles from "@/components/pricing-page.module.css";

type Plan = {
  name: string;
  packageId?: PublicBillingPackage["id"];
  pricingVariant?: PricingVariant;
  kind?: PublicBillingPackage["kind"];
  checkoutPlan?: PublicBillingPackage["checkoutPlan"];
  interval?: PublicBillingPackage["interval"];
  label?: string;
  price: string;
  originalPrice?: string;
  discountPercent?: number;
  discountRequestCode?: string;
  cycle: string;
  description: string;
  cta: string;
  note?: string;
  billingNote?: string;
  featured?: boolean;
  features: string[];
  value?: number;
  currency?: BillingCurrency;
};

type PaidPackageId = PublicBillingPackage["id"];
type PricingBillingInterval = "month" | "year";
type FaqItem = {
  question: string;
  answer: string;
};

const BILLING_RETURN_PATH = "/";
const WINBACK_DISCOUNT_CODES = new Set(["WINBACK50", "RETURN50"]);

function createClientIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDiscountedAmount(value: number, currency: BillingCurrency, discountPercent?: number): string {
  if (!discountPercent) return formatBillingAmount(value, currency);
  return formatBillingAmount(value * (1 - discountPercent / 100), currency);
}

function formatDiscountPercentLabel(discountPercent: number): string {
  return `${Math.round(discountPercent)}% off`;
}

function usesPricingExperimentBPublicLayout(plan: Pick<Plan, "checkoutPlan" | "pricingVariant">): boolean {
  return (plan.pricingVariant === "1.7" || plan.pricingVariant === "1.9" || plan.pricingVariant === "2.0") && plan.checkoutPlan === "starter";
}

function shouldHidePublicPlanPrice(plan: Pick<Plan, "checkoutPlan" | "pricingVariant">): boolean {
  return usesPricingExperimentBPublicLayout(plan);
}

function shouldHidePublicPlanCard(plan: Pick<Plan, "checkoutPlan" | "pricingVariant">): boolean {
  return usesPricingExperimentBPublicLayout(plan);
}

function shouldShowPublicDiscount(_plan: Pick<Plan, "pricingVariant">): boolean {
  return false;
}

function shouldShowAnnualMonthlyComparison(plan: Pick<Plan, "pricingVariant" | "interval" | "originalPrice">): boolean {
  return (plan.pricingVariant === "1.9" || plan.pricingVariant === "2.5") && plan.interval === "year" && Boolean(plan.originalPrice);
}

function winbackDiscountPrice(plan: Plan, market: BillingMarket): string | undefined {
  if (!plan.packageId || plan.kind !== "subscription") return undefined;
  const billingPackage = getLocalizedPublicBillingPackagesForVariant(
    plan.pricingVariant ?? DEFAULT_PRICING_VARIANT,
    market,
    { includeOneTime: true }
  )
    .find((item) => item.id === plan.packageId);
  if (!billingPackage) return undefined;
  return formatBillingAmount(billingPackage.displayAmount / 2, billingPackage.displayCurrency);
}

function isWinbackDiscountCode(code: string): boolean {
  return WINBACK_DISCOUNT_CODES.has(code.trim().toUpperCase());
}

function authCallbackMessage(authError: string): string {
  if (authError === "bad_oauth_state") {
    return "That sign-in link expired or was already used. Please try signing in again.";
  }
  return "Sign-in failed. Please try again.";
}

const freePlan: Plan = {
  name: "Free",
  price: "$0",
  cycle: "Limited free trial",
  description: "For exploring the studio before choosing a paid plan.",
  cta: "Start for Free",
  features: [
    "Trial availability shown in your account",
    "Explore photo uploads and Hotel Lobby prompts",
    "Try the studio with your shared Vismuse account",
    "See the credit estimate before generating",
    "Keep your chats, assets, and credits synced after sign-up"
  ]
};

function formatHotelPlanCopy(copy: string): string {
  return copy
    .replace(/~?[\d,]+\s+(?:HD\s+)?images?\s+or\s+/gi, "")
    .replace(/\s*≈\s*~?[\d,]+\s+(?:HD\s+)?images?/gi, "")
    .trim();
}

function buildPlans(
  pricingVariant: PricingVariant,
  billingInterval: PricingBillingInterval,
  market: BillingMarket,
  currency: BillingCurrency
): Plan[] {
  const packages = getLocalizedPublicBillingPackagesForVariant(pricingVariant, market)
    .filter((item) => item.kind === "subscription" && (item.checkoutPlan === "basic" || item.checkoutPlan === "pro" || item.checkoutPlan === "max"));
  const monthlySubscriptions = new Map(
    packages
      .filter((item) => item.interval === "month")
      .map((item) => [item.checkoutPlan, item])
  );
  const planOrder = new Map([["basic", 0], ["pro", 1], ["max", 2]]);
  const selectedPackages = ["basic", "pro", "max"]
    .map((checkoutPlan) => (
      packages.find((item) => item.checkoutPlan === checkoutPlan && item.interval === billingInterval)
      ?? packages.find((item) => item.checkoutPlan === checkoutPlan && item.interval === "month")
    ))
    .filter((item): item is LocalizedPublicBillingPackage => Boolean(item))
    .sort((left, right) => (
      (planOrder.get(left.checkoutPlan) ?? 99) - (planOrder.get(right.checkoutPlan) ?? 99)
    ));
  return [
    { ...freePlan, price: formatBillingAmount(0, currency) },
    ...selectedPackages.map((item): Plan => {
      const displayAmount = item.interval === "year" ? item.displayAmount / 12 : item.displayAmount;
      const monthlyPeer = monthlySubscriptions.get(item.checkoutPlan);
      const annualMonthlyComparison = (item.pricingVariant === "1.9" || item.pricingVariant === "2.5") && item.interval === "year" && monthlyPeer
        ? formatBillingAmount(monthlyPeer.displayAmount, monthlyPeer.displayCurrency)
        : undefined;
      return {
      name: item.name,
      packageId: item.id,
      pricingVariant: item.pricingVariant,
      kind: item.kind,
      checkoutPlan: item.checkoutPlan,
      interval: item.interval,
      label: item.label,
      price: formatDiscountedAmount(displayAmount, item.displayCurrency, item.discountPercent),
      originalPrice: annualMonthlyComparison ?? (item.discountPercent
        ? formatBillingAmount(item.displayAmount, item.displayCurrency)
        : undefined),
      discountPercent: item.discountPercent,
      discountRequestCode: item.discountRequestCode,
      cycle: item.displayCurrency !== "USD"
        ? item.interval === "year" || item.interval === "month" ? "/ month" : "one-time"
        : item.interval === "year" ? "USD / month" : item.interval === "month" ? "USD / month" : "USD one-time",
      description: item.description,
      cta: item.cta,
      note: item.note ? formatHotelPlanCopy(item.note) : undefined,
      billingNote: item.interval === "year"
        ? `${formatBillingAmount(item.displayAmount, item.displayCurrency)} billed yearly`
        : undefined,
      featured: item.featured,
      features: item.features.filter(feature => !/^Export (?:in|as) /i.test(feature)).map(formatHotelPlanCopy),
      value: item.displayAmount,
      currency: item.displayCurrency
      };
    })
  ];
}

const pricingFaqs: FaqItem[] = [
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. You can cancel a subscription anytime. Your paid access remains active until the end of the current billing period, and you will not be charged for the next one."
  },
  {
    question: "Do you refund the current billing period?",
    answer:
      "You can cancel anytime and keep paid access through the end of the current billing period. You may request a refund within 7 days of a charge if there have been no downloads and no more than 5 paid generations. Any download after subscribing or more than 5 paid generations counts as material use and is generally non-refundable. We review verified billing errors, duplicate charges, and confirmed technical issues case by case. See our Refund Policy or email support@vismuse.com with your account email and order or invoice reference."
  },
  {
    question: "What are credits used for?",
    answer:
      "Credits are used for video generation and revisions. Your model, duration, resolution, and generation settings determine the credit cost. Credits have no cash value and cannot be transferred, sold, or exchanged for cash."
  },
  {
    question: "Which plan should I start with?",
    answer:
      "Compare the included credits with your expected video usage. The studio shows the required credits before you generate."
  }
];

async function startOAuth(
  provider: "google" | "apple",
  setPending: (value: boolean) => void,
  nextPathOverride?: string
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase auth is not configured.");
  }

  setPending(true);
  captureAnalyticsEvent("signup_started", { provider, entry: "pricing" });
  const nextPath =
    nextPathOverride?.trim()
      ? sanitizeNextPath(nextPathOverride.trim())
      : typeof window === "undefined"
        ? "/"
        : `${window.location.pathname}${window.location.search}`;
  const redirectTo =
    typeof window === "undefined"
      ? "/auth/callback"
      : `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo
    }
  });

  if (error) {
    setPending(false);
    throw new Error(error.message);
  }
}

export default function PricingPage({ initialBillingContext }: { initialBillingContext: BillingContext }) {
  const uiLocale = useUiLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pricingExperiment, setPricingExperiment] = useState({
    key: PRICING_EXPERIMENT_KEY,
    variant: initialBillingContext.pricingVariant,
    billingMarket: initialBillingContext.market,
    billingCurrency: initialBillingContext.currency
  });
  const [pricingAssignmentReady, setPricingAssignmentReady] = useState(false);
  const [billingInterval, setBillingInterval] = useState<PricingBillingInterval>(() => searchParams.get("package")?.includes("annual") || initialBillingContext.pricingVariant === "2.3" ? "year" : "month");

  useEffect(() => {
    setBillingInterval(searchParams.get("package")?.includes("annual") || pricingExperiment.variant === "2.3" ? "year" : "month");
  }, [pricingExperiment.variant, searchParams]);

  useEffect(() => {
    let active = true;
    setPricingAssignmentReady(false);
    const requestedVariant = searchParams.get("pricing_variant");
    if (requestedVariant && !isLocalizedBillingMarket(pricingExperiment.billingMarket)) {
      const assignment = resolveClientPricingExperimentVariant({ requestedVariant });
      setPricingExperiment((current) => ({ ...current, ...assignment }));
      setPricingAssignmentReady(true);
      return () => {
        active = false;
      };
    }

    void resolveClientPricingExperimentVariantFromServer()
      .then((assignment) => {
        if (active) setPricingExperiment(assignment);
      })
      .catch(() => {
        if (!active) return;
        const assignment = resolveClientPricingExperimentVariant({
          pricingContext: undefined,
          requestedVariant: isLocalizedBillingMarket(pricingExperiment.billingMarket) ? undefined : requestedVariant
        });
        setPricingExperiment((current) => ({ ...current, ...assignment }));
      })
      .finally(() => {
        if (active) setPricingAssignmentReady(true);
      });

    return () => {
      active = false;
    };
  }, [pricingExperiment.billingMarket, searchParams]);
  const plans = useMemo(() => {
    const builtPlans = buildPlans(
      pricingExperiment.variant,
      billingInterval,
      pricingExperiment.billingMarket,
      pricingExperiment.billingCurrency
    );
    return builtPlans.length > 1
      ? builtPlans
      : [{ ...freePlan, price: formatBillingAmount(0, pricingExperiment.billingCurrency) }];
  }, [billingInterval, pricingExperiment]);
  const allPlans = plans;
  const visiblePlans = useMemo(() => {
    return plans.filter((plan) => !shouldHidePublicPlanCard(plan));
  }, [plans]);
  const showAnnualBillingToggle = useMemo(() => (
    getLocalizedPublicBillingPackagesForVariant(
      pricingExperiment.variant,
      pricingExperiment.billingMarket,
      { includeOneTime: false }
    )
      .some((plan) => plan.kind === "subscription" && plan.interval === "year")
  ), [pricingExperiment.billingMarket, pricingExperiment.variant]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authPending, setAuthPending] = useState(false);
  const [authNextPath, setAuthNextPath] = useState("");
  const [error, setError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [emailAuthAddress, setEmailAuthAddress] = useState("");
  const [emailAuthCode, setEmailAuthCode] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [pendingPackage, setPendingPackage] = useState<PaidPackageId | "">("");
  const [checkoutDiscountCode, setCheckoutDiscountCode] = useState("");
  const [activePlanIndex, setActivePlanIndex] = useState(1);
  const autoCheckoutKeyRef = useRef("");
  const planRailRef = useRef<HTMLDivElement | null>(null);
  const didAlignMobileProRef = useRef(false);
  const supportsGoogle = supabaseConfig.authProviders.includes("google");
  const supportsApple = supabaseConfig.authProviders.includes("apple");
  const supportsEmail = supabaseConfig.authProviders.includes("email");
  const nextPath = sanitizeNextPath(searchParams.get("next")?.trim() || BILLING_RETURN_PATH);
  const buildCheckoutPath = useCallback((packageId: PaidPackageId) => {
    const params = new URLSearchParams({
      checkout: "1",
      package: packageId,
      pricing_variant: pricingExperiment.variant
    });
    return `/pricing?${params.toString()}`;
  }, [pricingExperiment.variant, searchParams]);

  const openAuthModal = useCallback((nextPathOverride?: string) => {
    setError("");
    setAuthNotice("");
    setEmailAuthCode("");
    setEmailOtpSent(false);
    setAuthNextPath(nextPathOverride?.trim() || "");
    setAuthModalOpen(true);
  }, []);

  useEffect(() => {
    const authError = searchParams.get("auth_error")?.trim();
    if (!authError) return;

    setError(authCallbackMessage(authError));
    setAuthModalOpen(true);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("auth_error");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [searchParams]);

  useEffect(() => {
    const rail = planRailRef.current;
    if (!rail) return;

    const syncActivePlan = () => {
      const railCenter = rail.scrollLeft + rail.clientWidth / 2;
      const cards = Array.from(rail.querySelectorAll<HTMLElement>("[data-plan-card]"));
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;

      cards.forEach((card, index) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const distance = Math.abs(cardCenter - railCenter);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });

      setActivePlanIndex(nearestIndex);
    };

    const alignProOnMobile = () => {
      if (didAlignMobileProRef.current || !window.matchMedia("(max-width: 700px)").matches) {
        syncActivePlan();
        return;
      }

      const primaryCard = rail.querySelector<HTMLElement>('[data-plan-card="pro"]')
        ?? rail.querySelector<HTMLElement>('[data-plan-card="standard"]');
      if (!primaryCard) return;

      didAlignMobileProRef.current = true;
      const targetLeft = primaryCard.offsetLeft - (rail.clientWidth - primaryCard.offsetWidth) / 2;
      rail.scrollTo({ left: Math.max(0, targetLeft), behavior: "auto" });
      const primaryIndex = Array.from(rail.querySelectorAll<HTMLElement>("[data-plan-card]")).indexOf(primaryCard);
      setActivePlanIndex(Math.max(0, primaryIndex));
    };

    alignProOnMobile();
    rail.addEventListener("scroll", syncActivePlan, { passive: true });
    window.addEventListener("resize", alignProOnMobile);

    return () => {
      rail.removeEventListener("scroll", syncActivePlan);
      window.removeEventListener("resize", alignProOnMobile);
    };
  }, []);

  const scrollToPlan = (index: number) => {
    const rail = planRailRef.current;
    const card = rail?.querySelectorAll<HTMLElement>("[data-plan-card]")[index];
    if (!rail || !card) return;

    const targetLeft = card.offsetLeft - (rail.clientWidth - card.offsetWidth) / 2;
    rail.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
    setActivePlanIndex(index);
  };
  const isAnnualBillingSelected = billingInterval === "year";

  const toggleBillingInterval = () => {
    setBillingInterval((current) => current === "year" ? "month" : "year");
  };

  const startCheckout = useCallback(async (packageId: PaidPackageId) => {
    const checkoutPlan = allPlans.find((plan) => plan.packageId === packageId);
    const checkoutPricingVariant = pricingExperiment.variant;
    const discountCode = readCheckoutDiscountCode() || checkoutPlan?.discountRequestCode || undefined;
    setPendingPackage(packageId);
    setCheckoutError("");
    const checkoutIntentKey = createGoogleAdsCheckoutIntentDedupeKey(packageId);
    const googleAdsBeginCheckout = trackGoogleAdsBeginCheckoutConversion({
      dedupeKey: checkoutIntentKey,
      packageId,
      value: checkoutPlan?.value,
      currency: checkoutPlan?.currency
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
          return_to: BILLING_RETURN_PATH,
          discount_code: discountCode,
          attribution: getStoredAttribution(),
          pricing_variant: checkoutPricingVariant
        })
      });
      const data = await response.json().catch(() => ({})) as {
        checkout_url?: string;
        transaction_id?: string;
        payment_provider?: string;
        value?: number;
        currency?: string;
        error?: string;
      };

      if (response.status === 401 || response.status === 403) {
        setPendingPackage("");
        openAuthModal(buildCheckoutPath(packageId));
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to start checkout.");
      }
      if (!data.checkout_url) {
        throw new Error("Checkout URL is missing.");
      }

      if (data.transaction_id) {
        rememberCheckoutContext(buildCheckoutAnalyticsProperties(packageId, {
          ...readCheckoutContext(),
          checkout_id: data.transaction_id,
          provider: data.payment_provider,
          pricing_variant: checkoutPricingVariant,
          pricing_experiment_key: pricingExperiment.key,
          value: data.value,
          currency: data.currency
        }));
      }
      await googleAdsBeginCheckout;
      window.location.href = data.checkout_url;
    } catch (caughtError) {
      captureAnalyticsEvent("checkout_failed", buildCheckoutAnalyticsProperties(packageId, {
        entry: "pricing",
        checkout_scenario: "pricing_page",
          billing_surface: "pricing_page",
          pricing_variant: checkoutPricingVariant,
          pricing_experiment_key: pricingExperiment.key,
          reason: caughtError instanceof Error ? caughtError.message : "Failed to start checkout."
      }));
      setCheckoutError(caughtError instanceof Error ? caughtError.message : "Failed to start checkout.");
      setPendingPackage("");
    }
  }, [allPlans, buildCheckoutPath, openAuthModal, pricingExperiment.key, pricingExperiment.variant]);

  const handlePricingAction = async (plan?: Plan) => {
    if (!plan?.packageId) {
      router.push(nextPath);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const checkoutPath = buildCheckoutPath(plan.packageId);
    const checkoutContext = buildCheckoutAnalyticsProperties(plan.packageId, {
      entry: "pricing",
      checkout_scenario: "pricing_page",
      billing_surface: "pricing_page",
      pricing_variant: pricingExperiment.variant,
      pricing_experiment_key: pricingExperiment.key,
      value: plan.value,
      currency: plan.currency
    });
    rememberCheckoutContext(checkoutContext);
    captureAnalyticsEvent("checkout_plan_selected", checkoutContext);
    captureAnalyticsEvent("checkout_started_web", checkoutContext);

    if (!supabase) {
      setCheckoutError("Sign-in is required before checkout.");
      return;
    }

    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!sessionError && data.session) {
        await startCheckout(plan.packageId);
        return;
      }
    } catch {
      // Fall through to sign-in modal if session lookup fails.
    }

    openAuthModal(checkoutPath);
  };

  useEffect(() => {
    if (searchParams.get("billing") === "success") {
      const stored = mergeCheckoutReturnContext(readCheckoutContext(), searchParams);
      const discountCode = readCheckoutDiscountCode();
      const packageId = searchParams.get("package_id") || stored.package_id;
      trackClientPaymentSuccess({
        packageId,
        stored,
        fallbackEntry: "pricing",
        fallbackScenario: "pricing_page",
        fallbackSurface: "pricing_page"
      });
      clearCheckoutContext();
      if (discountCode) {
        markCheckoutDiscountCodeUsed(discountCode);
      } else {
        clearCheckoutDiscountCode();
      }
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("billing");
        url.searchParams.delete("package_id");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      }
      return;
    }

    const queryDiscountCode = rememberCheckoutDiscountCode(searchParams.get("code"));
    setCheckoutDiscountCode(queryDiscountCode || readCheckoutDiscountCode());

    const requestedPackage = searchParams.get("package");
    const packageId = allPlans.some((plan) => plan.packageId === requestedPackage) ? requestedPackage as PaidPackageId : "";
    if (!pricingAssignmentReady || searchParams.get("checkout") !== "1" || !packageId) return;

    const checkoutKey = `${packageId}:${searchParams.toString()}`;
    if (autoCheckoutKeyRef.current === checkoutKey) return;
    autoCheckoutKeyRef.current = checkoutKey;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setCheckoutError("Sign-in is required before checkout.");
      return;
    }

    void (async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (!sessionError && data.session) {
          await startCheckout(packageId);
          return;
        }
      } catch {
        // Fall through to sign-in modal if session lookup fails.
      }
      openAuthModal(buildCheckoutPath(packageId));
    })();
  }, [allPlans, buildCheckoutPath, openAuthModal, pricingAssignmentReady, searchParams, startCheckout]);

  const handleGoogleSignIn = async () => {
    if (!supportsGoogle) return;

    setError("");
    try {
      await startOAuth("google", setAuthPending, authNextPath);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Sign-in failed.");
    }
  };

  const handleAppleSignIn = async () => {
    if (!supportsApple) return;

    setError("");
    try {
      await startOAuth("apple", setAuthPending, authNextPath);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Sign-in failed.");
    }
  };

  const resolveAuthNextPath = useCallback(() => {
    if (authNextPath.trim()) {
      return sanitizeNextPath(authNextPath.trim());
    }
    return typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`;
  }, [authNextPath]);

  const handleSendEmailCode = async () => {
    if (!supportsEmail) return;

    const nextPathForEmail = resolveAuthNextPath();
    const emailRedirectTo =
      typeof window === "undefined"
        ? "/auth/callback"
        : `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPathForEmail)}`;
    const email = normalizeAuthEmail(emailAuthAddress);

    setAuthPending(true);
    setError("");
    setAuthNotice("");
    captureAnalyticsEvent("signup_started", { provider: "email", entry: "pricing" });

    const result = await sendSupabaseEmailOtp({
      locale: uiLocale,
      email,
      emailRedirectTo,
      shouldCreateUser: true,
      analytics: { entry: "pricing" }
    });

    setAuthPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setEmailAuthAddress(email);
    setEmailAuthCode("");
    setEmailOtpSent(true);
    setAuthNotice(`We sent a 6-digit code to ${email}.`);
  };

  const handleVerifyEmailCode = async () => {
    if (!supportsEmail) return;

    setAuthPending(true);
    setError("");
    const result = await verifySupabaseEmailOtp({
      locale: uiLocale,
      email: emailAuthAddress,
      token: emailAuthCode
    });

    if (!result.ok) {
      setAuthPending(false);
      setError(result.error);
      setAuthNotice("");
      return;
    }

    const targetPath = resolveAuthNextPath();
    setAuthModalOpen(false);
    setAuthPending(false);
    setAuthNotice("");
    setEmailAuthCode("");
    // Reload even for the same checkout URL so the verified session resumes once.
    window.location.assign(targetPath);
  };

  return localizeUiTree((
    <main className={styles.page}>
      <GoogleOneTap entry="pricing" nextPath={nextPath} />


      <section className={`${styles.container} ${styles.hero}`}>
        <p className={styles.kicker}>Hotel Lobby AI pricing</p>
        <h1>Your next performance starts here</h1>
        <p>Compare monthly and annual plans for Hotel Lobby AI. Use your shared Vismuse credits to bring people and pets to the mic.</p>
      </section>

      {showAnnualBillingToggle ? <div className={`${styles.container} ${styles.billingToggleWrap}`}>
        <button
          type="button"
          className={styles.billingSwitchButton}
          onClick={toggleBillingInterval}
          aria-pressed={isAnnualBillingSelected}
          aria-label="Toggle annual billing"
        >
          <span
            className={`${styles.billingSwitchTrack} ${isAnnualBillingSelected ? styles.billingSwitchTrackOn : ""}`.trim()}
            aria-hidden="true"
          >
            <span className={styles.billingSwitchThumb} />
          </span>
          <span className={styles.billingSwitchText}>Annually</span>
          <span className={styles.billingSwitchSave}>{pricingExperiment.variant === "2.5" ? "Save up to 30%" : "Save 50%"}</span>
        </button>
      </div> : null}

      <section className={`${styles.container} ${styles.planSection}`} aria-busy={!pricingAssignmentReady}>
        <>
          <div className={styles.grid} ref={planRailRef} aria-label="Pricing plans">
            {visiblePlans.map((plan) => {
              const displayName = resolveFrontendBillingPlanName(plan.pricingVariant, plan.checkoutPlan, plan.name);
              const displayCta = resolveFrontendBillingPlanCta(plan.pricingVariant, plan.checkoutPlan, plan.interval, plan.cta);
              const showPublicDiscount = shouldShowPublicDiscount(plan);
              const showAnnualMonthlyComparison = shouldShowAnnualMonthlyComparison(plan);
              const discountPrice = plan.packageId && isWinbackDiscountCode(checkoutDiscountCode)
                ? winbackDiscountPrice(plan, pricingExperiment.billingMarket)
                : undefined;

              return (
                <article
                  key={plan.name}
                  data-plan={plan.name.toLowerCase()}
                  data-plan-card={plan.name.toLowerCase()}
                  className={`${styles.card} ${plan.featured ? styles.featured : ""}`.trim()}
                  aria-label={`${displayName} plan`}
                >
                  {plan.label ? <span className={styles.badge}>{plan.label}</span> : null}
                  <h2>{displayName}</h2>
                  {!shouldHidePublicPlanPrice(plan) ? (
                    <p className={styles.price}>
                      {discountPrice ? (
                        <>
                          <span className={styles.originalPrice}>{plan.originalPrice ?? plan.price}</span>
                          {discountPrice} <span>/ month</span>
                        </>
                      ) : showAnnualMonthlyComparison && plan.originalPrice ? (
                        <>
                          {plan.price}<span className={styles.originalPrice}>{plan.originalPrice}</span><span>{plan.cycle}</span>
                        </>
                      ) : showPublicDiscount && plan.originalPrice ? (
                        <>
                          <span className={styles.originalPrice}>{plan.originalPrice}</span>
                          {plan.price} <span>{plan.cycle}</span>
                        </>
                      ) : (
                        <>
                          {plan.price} <span>{plan.cycle}</span>
                        </>
                      )}
                    </p>
                  ) : null}
                  {discountPrice ? <p className={styles.discountTip}>First month 50% off</p> : null}
                  {showPublicDiscount && !discountPrice && plan.discountPercent ? <p className={styles.discountTip}>{formatDiscountPercentLabel(plan.discountPercent)}</p> : null}
                  {plan.billingNote ? <p className={styles.billingNote}>{plan.billingNote}</p> : null}
                  <p className={styles.desc}>{plan.description}</p>
                  <button
                    type="button"
                    className={styles.cta}
                    onClick={() => void handlePricingAction(plan)}
                    disabled={!pricingAssignmentReady || Boolean(pendingPackage)}
                  >
                    {pendingPackage && pendingPackage === plan.packageId ? "Opening checkout..." : displayCta}
                  </button>
                  {plan.packageId ? <p className={styles.planNote}>{plan.note}</p> : null}
                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <Check size={14} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
          <div className={styles.planDots} aria-label="Choose a pricing plan">
            {visiblePlans.map((plan, index) => {
              const displayName = resolveFrontendBillingPlanName(plan.pricingVariant, plan.checkoutPlan, plan.name);
              return (
                <button
                  key={plan.name}
                  type="button"
                  className={`${styles.planDot} ${activePlanIndex === index ? styles.planDotActive : ""}`.trim()}
                  onClick={() => scrollToPlan(index)}
                  aria-label={`Show ${displayName} plan`}
                  aria-current={activePlanIndex === index ? "true" : undefined}
                />
              );
            })}
          </div>
          {checkoutError ? <p className={styles.checkoutError}>{checkoutError}</p> : null}
        </>
      </section>

      <section className={`${styles.container} ${styles.noteSection}`}>
        <p>
          Credits are shared with your Vismuse account. Video costs depend on the selected model, duration, and settings.
          Review the credit estimate in the studio before generating; the package details below reflect the shared billing catalog.
        </p>
      </section>

      <section className={`${styles.container} ${styles.faqSection}`}>
        <p className={styles.faqKicker}>Frequently Asked Questions</p>
        <div className={styles.faqList}>
          {pricingFaqs.map((item) => (
            <details className={styles.faqItem} key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {authModalOpen ? (
        <div
          className="vf-auth-modal-overlay vf-pricing-auth-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Sign in"
          onClick={() => {
            if (authPending) return;
            setAuthModalOpen(false);
          }}
        >
          <div className="vf-auth-modal-shell" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="vf-auth-modal-close"
              onClick={() => setAuthModalOpen(false)}
              aria-label="Close sign-in dialog"
              disabled={authPending}
            >
              <X size={22} />
            </button>

            <div className="vf-auth-modal-brand">
              <Image src="/icon.svg" alt="Hotel Lobby AI" width={42} height={42} className="vf-auth-modal-logo" />
              <span>Hotel Lobby AI</span>
            </div>

            <div className="vf-auth-modal-copy">
              <h2>Start free with Hotel Lobby AI</h2>
              <p>Save your videos and return to your projects. No credit card required.</p>
            </div>

            <div className="vf-auth-modal-actions">
              <button
                type="button"
                className="vf-auth-modal-oauth"
                onClick={() => void handleGoogleSignIn()}
                disabled={authPending || !supportsGoogle}
              >
                <span className="vf-auth-oauth-icon-slot" aria-hidden="true">
                  <Image
                    src="/assets/logos/google.png"
                    alt=""
                    aria-hidden="true"
                    width={18}
                    height={18}
                    className="vf-auth-oauth-icon"
                  />
                </span>
                <span>{authPending ? "Connecting to Google..." : "Continue with Google"}</span>
              </button>
              <button
                type="button"
                className="vf-auth-modal-oauth"
                onClick={() => void handleAppleSignIn()}
                disabled={authPending || !supportsApple}
              >
                <span className="vf-auth-oauth-icon-slot" aria-hidden="true">
                  <Image
                    src="/assets/logos/apple.png"
                    alt=""
                    aria-hidden="true"
                    width={18}
                    height={18}
                    className="vf-auth-oauth-icon vf-auth-oauth-icon-apple"
                  />
                </span>
                <span>{authPending ? "Connecting to Apple..." : "Continue with Apple"}</span>
              </button>
              {supportsEmail ? (
                <>
                  <div className="vf-auth-divider" aria-hidden="true">
                    <span>or</span>
                  </div>
                  <form
                    className="vf-auth-email-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void (emailOtpSent ? handleVerifyEmailCode() : handleSendEmailCode());
                    }}
                  >
                    <input
                      className="vf-auth-email-input"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="Enter your email"
                      value={emailAuthAddress}
                      onChange={(event) => {
                        setEmailAuthAddress(event.target.value);
                        if (emailOtpSent) {
                          setEmailOtpSent(false);
                          setEmailAuthCode("");
                          setAuthNotice("");
                        }
                      }}
                      disabled={authPending}
                    />
                    {emailOtpSent ? (
                      <input
                        className="vf-auth-email-input"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="6-digit code"
                        value={emailAuthCode}
                        onChange={(event) => setEmailAuthCode(event.target.value)}
                        disabled={authPending}
                      />
                    ) : null}
                    <button
                      type="submit"
                      className="vf-auth-email-submit"
                      disabled={authPending || !emailAuthAddress.trim()}
                    >
                      {authPending
                        ? emailOtpSent ? "Verifying code..." : "Sending code..."
                        : emailOtpSent ? "Verify code" : "Continue"}
                    </button>
                  </form>
                </>
              ) : null}
              {error ? <p className="vf-auth-modal-footnote">{error}</p> : null}
              {!error && authNotice ? <p className="vf-auth-modal-footnote">{authNotice}</p> : null}
            </div>

            {!error && !authNotice ? (
              <p className="vf-auth-modal-footnote">
                Your videos, credits, and history stay synced across devices. By continuing, you agree to our Terms and Privacy Policy.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <style>{`
        .vf-pricing-auth-modal-overlay {
          background: rgba(0, 0, 0, 0.62) !important;
          backdrop-filter: blur(16px) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 24px !important;
        }

        .vf-pricing-auth-modal-overlay .vf-auth-modal-shell {
          width: min(420px, 100%) !important;
          max-height: calc(100dvh - 48px) !important;
          border-radius: 24px !important;
          padding: 30px !important;
          background: linear-gradient(170deg, rgba(10, 10, 10, 0.94) 0%, rgba(38, 38, 38, 0.88) 100%) !important;
        }

        .vf-pricing-auth-modal-overlay .vf-auth-modal-close {
          top: 14px !important;
          right: 14px !important;
          width: 34px !important;
          height: 34px !important;
          border-radius: 10px !important;
        }

        .vf-pricing-auth-modal-overlay .vf-auth-modal-brand {
          margin-bottom: 22px !important;
          gap: 10px !important;
          font-size: 18px !important;
          font-weight: 700 !important;
        }

        .vf-pricing-auth-modal-overlay .vf-auth-modal-logo {
          width: 42px !important;
          height: 42px !important;
        }

        .vf-pricing-auth-modal-overlay .vf-auth-modal-copy {
          margin: 0 0 22px !important;
          text-align: left !important;
        }

        .vf-pricing-auth-modal-overlay .vf-auth-modal-copy h2 {
          font-size: 26px !important;
          line-height: 1.12 !important;
          font-weight: 800 !important;
          letter-spacing: 0 !important;
        }

        .vf-pricing-auth-modal-overlay .vf-auth-modal-copy p {
          margin: 10px 0 0 !important;
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
          color: rgba(255, 255, 255, 0.62) !important;
          font-size: 14px !important;
          line-height: 1.55 !important;
          font-weight: 400 !important;
        }

        .vf-pricing-auth-modal-overlay .vf-auth-modal-actions,
        .vf-pricing-auth-modal-overlay .vf-auth-email-form {
          display: grid !important;
          gap: 10px !important;
          margin: 0 !important;
        }

        .vf-pricing-auth-modal-overlay .vf-auth-modal-oauth,
        .vf-pricing-auth-modal-overlay .vf-auth-email-submit {
          min-height: 48px !important;
          padding: 0 16px !important;
          font-size: 14px !important;
          font-weight: 700 !important;
          border-radius: 999px !important;
        }

        .vf-pricing-auth-modal-overlay .vf-auth-email-input {
          min-height: 46px !important;
          padding: 0 14px !important;
          border-radius: 14px !important;
          font-size: 14px !important;
          font-weight: 400 !important;
        }

        .vf-pricing-auth-modal-overlay .vf-auth-divider {
          gap: 14px !important;
          font-size: 14px !important;
          font-weight: 700 !important;
        }

        .vf-pricing-auth-modal-overlay .vf-auth-oauth-icon-slot {
          width: 24px !important;
          height: 24px !important;
          flex-basis: 24px !important;
        }

        .vf-pricing-auth-modal-overlay .vf-auth-oauth-icon,
        .vf-pricing-auth-modal-overlay .vf-auth-oauth-icon-apple {
          width: 18px !important;
          height: 18px !important;
        }

        .vf-pricing-auth-modal-overlay .vf-auth-modal-footnote {
          margin: 18px 0 0 !important;
          padding: 0 !important;
          font-size: 11px !important;
          line-height: 1.5 !important;
        }

        @media (max-width: 1120px) {
          .vf-pricing-auth-modal-overlay {
            padding: 16px !important;
          }

          .vf-pricing-auth-modal-overlay .vf-auth-modal-shell {
            max-height: calc(100dvh - 32px) !important;
            padding: 24px !important;
          }
        }
      `}</style>

      <HotelSiteFooter />
    </main>
  ), uiLocale);
}
