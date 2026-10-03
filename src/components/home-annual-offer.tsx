"use client";

import { useSessionBannerDismissal } from "@/lib/use-session-banner-dismissal";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Gift, Video, X } from "lucide-react";
import { useSubscriptionModalPreload } from "@/app/app/_components/use-subscription-modal-preload";
import { useAppAccountStore } from "@/app/app/_components/app-account-store";
import { buildSubscriptionModalPlans, getBillingIntervalToggleSaveLabel, type RechargePackageId } from "@/app/app/_components/app-subscription-model";
import { requestCheckoutWithAuthRecovery } from "@/lib/auth/checkout-request";
import { resolveClientPricingExperimentVariantFromServer } from "@/lib/billing/pricing-experiment-client";
import { buildCheckoutAnalyticsProperties, rememberCheckoutContext } from "@/lib/analytics/checkout";
import { createGoogleAdsCheckoutIntentDedupeKey, trackGoogleAdsBeginCheckoutConversion, trackGoogleAdsSubscriptionModalViewConversion } from "@/lib/analytics/google-ads";
import { trackTopBannerInteraction } from "@/lib/analytics/top-banner";
import { captureAnalyticsEvent, getStoredAttribution } from "@/lib/analytics/posthog";
import { t } from "@/lib/i18n/catalog";
import { getAnnualOfferMessageParts } from "@/lib/i18n/annual-offer";
import type { SiteLocale } from "@/lib/i18n/site-locales";
import { openMarketingHomeAuthModal } from "./marketing-home-account";
import styles from "./home-annual-offer.module.css";

const SubscriptionGateModal = dynamic(() => import("@/app/app/_components/subscription-gate-modal").then((module) => module.SubscriptionGateModal));

type OfferPricing = Awaited<ReturnType<typeof resolveClientPricingExperimentVariantFromServer>>;

export default function HomeAnnualOffer({ locale }: { locale: SiteLocale }) {
  const account = useAppAccountStore((state) => state.account);
  const accountReady = useAppAccountStore((state) => state.isReady);
  const [pricing, setPricing] = useState<OfferPricing | null>(null);
  const [dismissed, dismissOffer] = useSessionBannerDismissal("annual-offer");
  const [videoDismissed, dismissVideo] = useSessionBannerDismissal("video");
  const isPaidAccount = account.plan !== "free";
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<"" | RechargePackageId>("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    resolveClientPricingExperimentVariantFromServer().then((value) => {
      if (active) setPricing(value);
    }).catch(() => { /* Keep the offer hidden until its actual pricing is available. */ });
    return () => { active = false; };
  }, [account.id, account.isLoggedIn]);
  const plans = useMemo(() => pricing ? buildSubscriptionModalPlans(pricing.variant, {
    market: pricing.billingMarket,
    currency: pricing.billingCurrency
  }) : [], [pricing]);
  const saveLabel = getBillingIntervalToggleSaveLabel("year", plans);
  const saveMessage = getAnnualOfferMessageParts(locale, saveLabel);
  const preloadSubscriptionModal = useSubscriptionModalPreload(accountReady && !isPaidAccount && !dismissed && Boolean(pricing && saveLabel));

  function trackBannerAction(action: "claim" | "video" | "close") {
    trackTopBannerInteraction({
      action, banner: isPaidAccount ? "video" : "annual_offer", surface: "homepage",
      accountPlan: account.plan, isLoggedIn: account.isLoggedIn,
      pricingVariant: pricing?.variant, locale
    });
  }

  async function subscribe(packageId: RechargePackageId) {
    if (!pricing || pending) return;
    if (!account.isLoggedIn) {
      setOpen(false);
      openMarketingHomeAuthModal();
      return;
    }
    const plan = plans.find((item) => item.packageId === packageId);
    setPending(packageId);
    setError("");
    const context = buildCheckoutAnalyticsProperties(packageId, {
      trigger: "annual_offer_bar", billing_surface: "homepage", checkout_scenario: "homepage_annual_offer",
      pricing_variant: pricing.variant, value: plan?.value, currency: plan?.currency
    });
    captureAnalyticsEvent("pricing_modal_subscribe_clicked", context);
    captureAnalyticsEvent("checkout_started_web", context);
    const conversion = trackGoogleAdsBeginCheckoutConversion({ dedupeKey: createGoogleAdsCheckoutIntentDedupeKey(packageId), packageId, value: plan?.value, currency: plan?.currency });
    try {
      const response = await requestCheckoutWithAuthRecovery("/api/v1/credits/recharge", {
        method: "POST",
        signal: AbortSignal.timeout(30_000),
        headers: { "Content-Type": "application/json", "x-idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({
          package_id: packageId,
          pricing_variant: pricing.variant,
          return_to: `${window.location.pathname}${window.location.search}`,
          discount_code: plan?.discountRequestCode,
          checkout_theme: "default",
          attribution: getStoredAttribution()
        })
      }, account.id);
      const data = await response.json();
      if (response.status === 401 || response.status === 403) {
        setOpen(false);
        openMarketingHomeAuthModal();
        return;
      }
      if (!response.ok || !data.checkout_url) throw new Error(data.error || "Checkout failed. Please try again.");
      rememberCheckoutContext({ ...context, checkout_id: data.transaction_id, provider: data.payment_provider, value: data.value ?? plan?.value, currency: data.currency ?? plan?.currency });
      await conversion;
      window.location.assign(data.checkout_url);
    } catch (caught) {
      captureAnalyticsEvent("checkout_failed", { ...context, reason: caught instanceof Error ? caught.message : "checkout_failed" });
      setError(caught instanceof Error ? caught.message : "Checkout failed. Please try again.");
    } finally {
      setPending("");
    }
  }

  return <>
    {accountReady && (isPaidAccount ? !videoDismissed : pricing && saveLabel && !dismissed) ? <div className={styles.bar} data-home-announcement data-annual-offer={isPaidAccount ? undefined : true}>
      {isPaidAccount ? <Link className={styles.offer} href="/ai-video-generator" prefetch={false} onClick={() => trackBannerAction("video")}>
        <Video size={17} aria-hidden />
        <span><strong className={styles.videoAnnouncementText}>{t(locale, "workbench.videoAnnouncement.message")}</strong></span>
        <span className={styles.cta}>{t(locale, "workbench.videoAnnouncement.cta")}</span>
      </Link> : <button className={styles.offer} type="button" aria-haspopup="dialog" onPointerEnter={preloadSubscriptionModal} onFocus={preloadSubscriptionModal} onPointerDown={preloadSubscriptionModal} onClick={() => {
        trackBannerAction("claim");
        setError("");
        setOpen(true);
        trackGoogleAdsSubscriptionModalViewConversion({ userId: account.isLoggedIn ? account.id : undefined });
        captureAnalyticsEvent("pricing_modal_opened", { trigger: "annual_offer_bar", billing_surface: "homepage", pricing_variant: pricing?.variant });
      }}>
        <Gift size={17} aria-hidden />
        <span>{saveMessage.before}<strong className={styles.discount}>{saveMessage.discount}</strong>{saveMessage.after}</span>
        <span className={styles.cta}>{t(locale, "workbench.annualOffer.cta")}</span>
      </button>}
      <button className={styles.close} type="button" aria-label={t(locale, isPaidAccount ? "workbench.videoAnnouncement.dismiss" : "workbench.annualOffer.dismiss")} onClick={() => {
        trackBannerAction("close");
        if (isPaidAccount) dismissVideo();
        else dismissOffer();
      }}><X size={16} aria-hidden /></button>
    </div> : null}
    {open && pricing ? <SubscriptionGateModal mode="upgrade" initialBillingInterval="year" accountPlan={account.plan} sourceUseCase="homepage" pricingVariant={pricing.variant} plans={plans} pendingPackage={pending} error={error} onClose={() => setOpen(false)} onSubscribe={(packageId) => void subscribe(packageId)} /> : null}
  </>;
}
