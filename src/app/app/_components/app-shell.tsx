"use client";

import HotelSiteNav from "@/components/hotel-site-nav";

import { bindChatViewport } from "@/lib/app/chat-viewport";

import { useSessionBannerDismissal } from "@/lib/use-session-banner-dismissal";

import { t } from "@/lib/i18n/catalog";
import { getAnnualOfferMessageParts } from "@/lib/i18n/annual-offer";
import { stripSiteLocaleFromPath } from "@/lib/i18n/site-locales";
import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSubscriptionModalPreload } from "./use-subscription-modal-preload";
import { useWorkbenchPrefetch } from "./use-workbench-prefetch";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { trackTopBannerInteraction } from "@/lib/analytics/top-banner";
import { captureAnalyticsEvent, getStoredAttribution } from "@/lib/analytics/posthog";
import { buildCheckoutAnalyticsProperties, mergeCheckoutReturnContext } from "@/lib/analytics/checkout";
import { appCheckoutContextToPaymentContext, clearAppCheckoutContext, inspectAppStripeCheckoutReturn, isAppStripeCheckoutContext, readAppCheckoutContext, recoverAppCheckoutPayment, rememberAppCheckoutContext, syncAppCheckoutForRecovery, updateAppCheckoutRecoveryAttempts, type AppCheckoutContext, type AppStripeCheckoutReturnStatus } from "@/lib/analytics/app-checkout-recovery";
import { trackClientPaymentSuccess } from "@/lib/analytics/payment";
import { createGoogleAdsCheckoutIntentDedupeKey, trackGoogleAdsBeginCheckoutConversion, trackGoogleAdsSubscriptionModalViewConversion } from "@/lib/analytics/google-ads";
import { requestCheckoutWithAuthRecovery } from "@/lib/auth/checkout-request";
import { DEFAULT_PRICING_VARIANT, PRICING_EXPERIMENT_KEY, isBillingPackageId, normalizePricingVariant, type PricingVariant } from "@/lib/billing/catalog";
import { resolveFrontendBillingPlanName } from "@/lib/billing/plan-display";
import { readClientPricingVariantOverride, resolveClientPricingExperimentVariant } from "@/lib/billing/pricing-experiment-client";
import { SOCIALMEDIA_INPUT_MODE_EXPERIMENT_KEY } from "@/lib/socialmedia/input-mode-experiment";
import { getClientSessionId, trackClientEvent, truncateTelemetryText } from "@/lib/telemetry/client";
import DiscordInviteLink from "@/components/discord-invite-link";
import SiteLanguageSwitcher from "@/components/site-language-switcher";
import { Check, ChevronLeft, Copy, CreditCard, FileText, Gift, Headphones, House, LogOut, Mail, ShieldCheck, Sparkles, UserRound, Video, X } from "lucide-react";
import styles from "./app.module.css";
import { AppLoadingSpinner } from "./app-loading-spinner";
import { findAppTool, findAppToolByPathname, appAnnouncement, appAccountSummary, appTools, type AppAccountSummary, type AppAnnouncementConfig, type AppNavId } from "./app-data";
import { buildSubscriptionModalPlans, getBillingIntervalToggleSaveLabel, type RechargePackageId } from "./app-subscription-model";
import { shouldShowAccountUpgradeCreditPackEntry } from "@/lib/billing/video-credit-packs";
import { isV24ImageCreditPackPackageId } from "@/lib/billing/image-credit-packs";
import { resolveCreditPackCheckoutType } from "@/lib/billing/credit-pack-checkout-context";
import { APP_UPGRADE_MODAL_EVENT, APP_ANALYTICS_WORKFLOW, buildAppGenerationAnalyticsProperties, dispatchAppUpgradeModal, openThreadAuthModal } from "./app-composer";
import { getExploreToolDescription, imageToolFeatures, APP_LAST_CREATE_HREF_UPDATE_EVENT, createAppRechargeIdempotencyKey, getAppCheckoutPlanName, getAppSubscriptionClickScenario, getAppOutputType, APP_IMAGE_UNLOCK_PACKAGE_ID, APP_CHECKOUT_START_TIMEOUT_MS, APP_CHECKOUT_SYNCED_EVENT, APP_TOAST_EVENT, type AppToastState, dispatchAppToast, type AppCheckoutSyncedEventDetail, getAppCheckoutFailureMessage, clearAppPendingCheckoutAfterAuth, isBackForwardPageShow, useResetCheckoutPendingOnPageShow } from "./app-shared";

function SubscriptionModalLoading() {
  return (
    <div className={styles.subscriptionModalLoading} role="status" aria-busy="true" aria-label="Loading upgrade options">
      <AppLoadingSpinner size={28} />
    </div>
  );
}

const SubscriptionGateModal = dynamic(
  () => import("./subscription-gate-modal").then((module) => module.SubscriptionGateModal),
  { loading: SubscriptionModalLoading }
);
const VideoSubscriptionModal = dynamic(() => import("@/app/ai-video-generator/_components/video-subscription-modal"));

const desktopRailSections = [
  { label: "Studio", items: [{ label: "Hotel Lobby AI", href: "/", icon: RailVideoIcon }] },
  { label: "Discover", items: [
    { label: "Video examples", href: "/examples", icon: Video },
    { label: "Prompt library", href: "/prompts", icon: Sparkles },
    { label: "Studio guides", href: "/guides", icon: FileText },
    { label: "Plans & credits", href: "/pricing", icon: CreditCard }
  ] }
];

const VIDEO_TOOL_SLUGS = new Set([
  "ai-video-generator",
  "ai-animation-generator",
  "promo-video-maker",
  "hotel-lobby-ai",
  "spotify-canvas-generator"
]);

const IMAGE_RAIL_TOOL_SLUGS = new Set([
  "ai-image-maker",
  "ai-flyer-generator",
  "ai-album-cover-generator",
  "ai-image-text-editor",
  "ai-brochure-generator",
  "ai-comic-generator",
  "ai-anime-generator",
  "baby-shower-invitations",
  "playlist-cover-maker",
  "vision-board-maker",
  // "ai-infographic-generator",
  "ai-menu-generator",
  // "ai-certificate-generator",
  "ai-product-ad-image-generator",
  // "poster-maker",
  "business-card-maker",
  "ai-logo-generator",
  // "ai-sticker-generator",
  // "ai-wallpaper-generator",
  // "ai-book-cover-generator",
  // "invitation-maker",
  "background-remover",
  // "ai-room-design",
  // "ai-interior-design",
  // "tattoo-generator"
]);

const imageRailPrioritySlugs = [
  "ai-image-maker",
  "ai-flyer-generator",
  "ai-album-cover-generator",
  "ai-image-text-editor",
  "ai-brochure-generator"
];
const imageRailToolFeatures = [
  ...imageRailPrioritySlugs.flatMap((slug) => imageToolFeatures.filter((tool) => tool.slug === slug)),
  ...imageToolFeatures.filter((tool) => IMAGE_RAIL_TOOL_SLUGS.has(tool.slug) && !imageRailPrioritySlugs.includes(tool.slug))
];

const videoToolFeatures = appTools
  .filter((tool) => VIDEO_TOOL_SLUGS.has(tool.slug))
  .map((tool) => ({
    title: tool.workbenchTitle,
    description: getExploreToolDescription(tool),
    href: tool.href,
    icon: tool.icon
  }));

const TELEMETRY_HEARTBEAT_ENABLED = process.env.NEXT_PUBLIC_SOCIALMEDIA_TELEMETRY_HEARTBEAT === "true";

// Temporarily pause the automatic Stripe-to-Waffo switch prompt on unpaid checkout returns.
const PAYMENT_METHOD_FALLBACK_MODAL_ENABLED = false;

const TELEMETRY_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

const mobileBottomItems: Array<{
  id: AppNavId;
  label: string;
  href: string;
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  size: number;
}> = [
  { id: "create", label: "Create", href: "/", icon: BottomCreateIcon, size: 22 },
  { id: "recents", label: "Recents", href: "/app/recents", icon: BottomHistoryIcon, size: 22 },
  { id: "assets", label: "Assets", href: "/app/assets", icon: RailAssetsIcon, size: 20 },
  { id: "explore", label: "Explore", href: "/app/explore", icon: RailExploreIcon, size: 22 }
];

function RailImageIcon({ size = 24, "aria-hidden": ariaHidden }: { size?: number; "aria-hidden"?: boolean }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" aria-hidden={ariaHidden}>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M8.753 21.002C8.101 15.66 15.538 13 21 12.669m0-4.642v7.953c0 2.946-1.843 5.024-4.788 5.024H7.778C4.833 21.004 3 18.926 3 15.979V8.027c0-2.946 1.843-5.023 4.778-5.023h8.434C19.157 3.004 21 5.08 21 8.027ZM10.829 9.783a1.697 1.697 0 1 1-3.395.001 1.697 1.697 0 0 1 3.395-.001Z"
      />
    </svg>
  );
}

function RailVideoIcon({ size = 24, "aria-hidden": ariaHidden }: { size?: number; "aria-hidden"?: boolean }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" aria-hidden={ariaHidden}>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M6.123 14.96h2.841m7.52-4.97 3.407-2.788a1.292 1.292 0 0 1 2.11 1l-.013 7.602a1.29 1.29 0 0 1-2.11.995l-3.394-2.787M12.64 4.754H5.85C3.483 4.754 2 6.43 2 8.8v6.397c0 2.371 1.476 4.047 3.85 4.047h6.79c2.373 0 3.851-1.676 3.851-4.047V8.801c0-2.371-1.478-4.047-3.85-4.047Z"
      />
    </svg>
  );
}

function RailAssetsIcon({ size = 20, "aria-hidden": ariaHidden }: { size?: number; "aria-hidden"?: boolean }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 20 20" aria-hidden={ariaHidden}>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M14.167 13.75v1.667a1.667 1.667 0 0 1-1.667 1.667H4.167A1.667 1.667 0 0 1 2.5 15.417v-7.5A1.667 1.667 0 0 1 4.167 6.25h1.666M7.5 2.917H10l1.667 1.667h4.166A1.666 1.666 0 0 1 17.5 6.25v5.834a1.667 1.667 0 0 1-1.667 1.666H7.5a1.667 1.667 0 0 1-1.667-1.666v-7.5A1.667 1.667 0 0 1 7.5 2.917"
      />
    </svg>
  );
}

function RailExploreIcon({ size = 24, "aria-hidden": ariaHidden }: { size?: number; "aria-hidden"?: boolean }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" aria-hidden={ariaHidden}>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M12 21a9 9 0 0 0 9-9m-9 9a9 9 0 0 1-9-9m9 9a15.536 15.536 0 0 0 3.461-9A15.535 15.535 0 0 0 12 3m0 18a15.536 15.536 0 0 1-3.462-9A15.535 15.535 0 0 1 12 3m9 9a9 9 0 0 0-9-9m9 9H3m9-9a9 9 0 0 0-9 9"
      />
    </svg>
  );
}

function BottomCreateIcon({ size = 22, "aria-hidden": ariaHidden }: { size?: number; "aria-hidden"?: boolean }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 18 18" aria-hidden={ariaHidden}>
      <path
        d="M12.9703 7.87502V2.25M10.1914 5.06277H15.75M8.05219 14.9549L5.63333 10.8753C5.43183 10.5355 4.9451 10.5355 4.74359 10.8753L2.32473 14.9549C2.11726 15.3048 2.36634 15.75 2.76961 15.75H7.60732C8.01058 15.75 8.25967 15.3048 8.05219 14.9549ZM6.85623 2.25H3.52106C2.90708 2.25 2.40934 2.75368 2.40934 3.375V6.75C2.40934 7.37134 2.90708 7.875 3.52106 7.875H6.85623C7.47021 7.875 7.96795 7.37134 7.96795 6.75V3.375C7.96795 2.75368 7.47021 2.25 6.85623 2.25ZM12.9707 10.125C12.9707 10.125 15.75 10.125 15.75 12.9375C15.75 12.9375 15.75 15.75 12.9707 15.75C12.9707 15.75 10.1914 15.75 10.1914 12.9375C10.1914 12.9375 10.1914 10.125 12.9707 10.125Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function BottomHistoryIcon({ size = 22, "aria-hidden": ariaHidden }: { size?: number; "aria-hidden"?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden={ariaHidden}>
      <path
        d="M7.69307 10.1538H13.8469M7.69307 13.8461H11.3854M9.53866 4H17.5387C17.8651 4 18.1782 4.12967 18.409 4.36048C18.6397 4.5913 18.7695 4.90435 18.7695 5.23077V16.9231M15.0779 6.4615H6.46245C5.78272 6.4615 5.23167 7.01254 5.23167 7.69228V18.7692C5.23167 19.449 5.78272 20 6.46245 20H15.0779C15.7576 20 16.3086 19.449 16.3086 18.7692V7.69228C16.3086 7.01254 15.7576 6.4615 15.0779 6.4615Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function CreditIcon({ size = 18, "aria-hidden": ariaHidden }: { size?: number; "aria-hidden"?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={ariaHidden}>
      <circle cx="12" cy="12" r="10" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 18V6" />
    </svg>
  );
}

function CreditGemIcon({ "aria-hidden": ariaHidden }: { "aria-hidden"?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden={ariaHidden} className={styles.creditGemIcon}>
      <path d="M3 1.5H9L8 5H4L3 1.5Z" fill="url(#creditGemPaint0)" />
      <path d="M2.99976 1.5L0.999756 5H3.99976L2.99976 1.5Z" fill="url(#creditGemPaint1)" />
      <path d="M9.00024 1.5L11.0002 5H8.00024L9.00024 1.5Z" fill="url(#creditGemPaint2)" />
      <path d="M0.999756 4.99951H3.99976L5.99976 10.9995L0.999756 4.99951Z" fill="url(#creditGemPaint3)" />
      <path d="M3.99976 4.99951H5.99976V10.9995L3.99976 4.99951Z" fill="url(#creditGemPaint4)" />
      <path d="M6 4.99951H8L6 10.9995V4.99951Z" fill="url(#creditGemPaint5)" />
      <path d="M8 4.99951H11L6 10.9995L8 4.99951Z" fill="url(#creditGemPaint6)" />
      <path d="M3 1.5H9L8 5H4L3 1.5Z" fill="url(#creditGemPaint7)" />
      <path d="M2.99976 1.5L0.999756 5H3.99976L2.99976 1.5Z" fill="url(#creditGemPaint8)" />
      <path d="M9.00024 1.5L11.0002 5H8.00024L9.00024 1.5Z" fill="url(#creditGemPaint9)" />
      <path d="M3.99976 4.99951H5.99976V10.9995L3.99976 4.99951Z" fill="url(#creditGemPaint10)" />
      <path d="M3.24976 1.55029H8.74976" stroke="white" strokeOpacity="0.95" strokeWidth="0.3" strokeLinecap="round" />
      <path d="M3 1.5L4 5" stroke="white" strokeOpacity="0.55" strokeWidth="0.2" strokeLinecap="round" />
      <path opacity="0.55" d="M6.74976 2.09961H4.24976C4.11168 2.09961 3.99976 2.21154 3.99976 2.34961V2.64961C3.99976 2.78768 4.11168 2.89961 4.24976 2.89961H6.74976C6.88783 2.89961 6.99976 2.78768 6.99976 2.64961V2.34961C6.99976 2.21154 6.88783 2.09961 6.74976 2.09961Z" fill="white" />
      <path d="M2.99976 1.5L3.99976 5L5.99976 11M8.99976 1.5L7.99976 5L5.99976 11M5.99976 11V5M0.999756 5H10.9998" stroke="url(#creditGemPaint11)" strokeWidth="0.2" />
      <path d="M2.99976 1.5H8.99976L10.9998 5L5.99976 11L0.999756 5L2.99976 1.5Z" stroke="url(#creditGemPaint12)" strokeWidth="0.25" strokeLinejoin="round" />
      <defs>
        <linearGradient id="creditGemPaint0" x1="3" y1="1.5" x2="9" y2="5" gradientUnits="userSpaceOnUse"><stop stopColor="#484644" /><stop offset="1" stopColor="#282624" /></linearGradient>
        <linearGradient id="creditGemPaint1" x1="0.999756" y1="1.5" x2="3.99976" y2="5" gradientUnits="userSpaceOnUse"><stop stopColor="#302E2C" /><stop offset="1" stopColor="#1A1918" /></linearGradient>
        <linearGradient id="creditGemPaint2" x1="9.00024" y1="1.5" x2="11.0002" y2="5" gradientUnits="userSpaceOnUse"><stop stopColor="#3A3836" /><stop offset="1" stopColor="#201E1C" /></linearGradient>
        <linearGradient id="creditGemPaint3" x1="0.999756" y1="4.99951" x2="5.99976" y2="10.9995" gradientUnits="userSpaceOnUse"><stop stopColor="#181614" /><stop offset="1" stopColor="#080706" /></linearGradient>
        <linearGradient id="creditGemPaint4" x1="3.99976" y1="4.99951" x2="5.99976" y2="10.9995" gradientUnits="userSpaceOnUse"><stop stopColor="#2A2826" /><stop offset="1" stopColor="#0E0D0C" /></linearGradient>
        <linearGradient id="creditGemPaint5" x1="8" y1="4.99951" x2="6" y2="10.9995" gradientUnits="userSpaceOnUse"><stop stopColor="#201E1C" /><stop offset="1" stopColor="#0A0908" /></linearGradient>
        <linearGradient id="creditGemPaint6" x1="11" y1="4.99951" x2="6" y2="10.9995" gradientUnits="userSpaceOnUse"><stop stopColor="#161412" /><stop offset="1" stopColor="#060505" /></linearGradient>
        <linearGradient id="creditGemPaint7" x1="1" y1="1.5" x2="9" y2="8" gradientUnits="userSpaceOnUse"><stop stopColor="white" stopOpacity="0.7" /><stop offset="0.2" stopColor="white" stopOpacity="0.25" /><stop offset="0.6" stopColor="white" stopOpacity="0.05" /><stop offset="1" stopColor="white" stopOpacity="0" /></linearGradient>
        <linearGradient id="creditGemPaint8" x1="0.999756" y1="1.5" x2="8.99976" y2="8" gradientUnits="userSpaceOnUse"><stop stopColor="white" stopOpacity="0.7" /><stop offset="0.2" stopColor="white" stopOpacity="0.25" /><stop offset="0.6" stopColor="white" stopOpacity="0.05" /><stop offset="1" stopColor="white" stopOpacity="0" /></linearGradient>
        <linearGradient id="creditGemPaint9" x1="11.0002" y1="1.5" x2="8.00024" y2="5" gradientUnits="userSpaceOnUse"><stop stopColor="white" stopOpacity="0.45" /><stop offset="1" stopColor="white" stopOpacity="0" /></linearGradient>
        <linearGradient id="creditGemPaint10" x1="3.99976" y1="4.99951" x2="5.99976" y2="7.99951" gradientUnits="userSpaceOnUse"><stop stopColor="#D0CCC8" stopOpacity="0.5" /><stop offset="1" stopColor="#D0CCC8" stopOpacity="0" /></linearGradient>
        <linearGradient id="creditGemPaint11" x1="0.999756" y1="1.5" x2="10.9998" y2="11" gradientUnits="userSpaceOnUse"><stop stopColor="white" stopOpacity="0.75" /><stop offset="0.5" stopColor="white" stopOpacity="0.25" /><stop offset="1" stopColor="white" stopOpacity="0.04" /></linearGradient>
        <linearGradient id="creditGemPaint12" x1="0.999756" y1="1.5" x2="10.9998" y2="11" gradientUnits="userSpaceOnUse"><stop stopColor="white" stopOpacity="0.75" /><stop offset="0.5" stopColor="white" stopOpacity="0.25" /><stop offset="1" stopColor="white" stopOpacity="0.04" /></linearGradient>
      </defs>
    </svg>
  );
}

function PlanSettingsIcon({ size = 16, "aria-hidden": ariaHidden }: { size?: number; "aria-hidden"?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden={ariaHidden}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

type AppShellProps = {
  active: AppNavId;
  account?: AppAccountSummary;
  accountReady?: boolean;
  announcement?: AppAnnouncementConfig;
  createHref?: string;
  isChatRoute?: boolean;
  isGeneralWorkspace?: boolean;
  onRefreshAccount?: () => void | Promise<void>;
  children: ReactNode;
};

const planLabels: Record<AppAccountSummary["plan"], string> = {
  free: "Free Plan",
  basic: "Basic Plan",
  pro: "Pro Plan",
  max: "Max Plan"
};

function getFrontendAccountPlanLabel(account: AppAccountSummary): string {
  const fallbackName = planLabels[account.plan].replace(/ Plan$/, "");
  const displayName = resolveFrontendBillingPlanName(account.pricingVariant, account.plan, fallbackName);
  return `${displayName} Plan`;
}

type SettingsMenuItem = {
  label: string;
  href?: string;
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  featured?: boolean;
  authTrigger?: boolean;
  upgradeTrigger?: boolean;
  billingPortalTrigger?: boolean;
  settingsDialogTrigger?: boolean;
  contactTrigger?: boolean;
};

const guestSettingsItems: SettingsMenuItem[] = [
  { label: "Sign in", icon: Sparkles, authTrigger: true },
  { label: "Terms of Service", href: "/terms", icon: FileText },
  { label: "Privacy Policy", href: "/privacy", icon: ShieldCheck },
  { label: "Contact us", icon: Mail, contactTrigger: true }
];

const accountSettingsItems: SettingsMenuItem[] = [
  { label: "Settings", icon: PlanSettingsIcon, settingsDialogTrigger: true },
  { label: "Go homepage", href: "/home", icon: House },
  { label: "Terms of Service", href: "/terms", icon: FileText },
  { label: "Privacy Policy", href: "/privacy", icon: ShieldCheck },
  { label: "Contact us", icon: Mail, contactTrigger: true }
];

const APP_INPUT_MODE_EXPERIMENT_PREFETCH_STORAGE_KEY = "vismuse:input-mode-experiment-prefetched:v1";

const SUPPORT_EMAIL = "support@vismuse.com";

const SUPPORT_MAILTO_HREF = `mailto:${SUPPORT_EMAIL}`;

type SettingsDialogTab = "personal" | "subscription";

function settingsDateFormatter(locale: string) { return new Intl.DateTimeFormat(locale, {
  month: "short",
  day: "numeric",
  year: "numeric"
}); }

function formatSettingsDate(value?: string, locale = "en-US"): string {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : settingsDateFormatter(locale).format(date);
}

function formatSettingsPeriod(start?: string, end?: string, locale = "en-US"): string {
  if (!start || !end) return "Not available";
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "Not available";
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const startLabel = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" })
  }).format(startDate);
  return `${startLabel} – ${settingsDateFormatter(locale).format(endDate)}`;
}

function formatSubscriptionStatus(status?: string): string {
  const normalized = status?.trim().toLowerCase();
  if (!normalized || normalized === "none") return "No active subscription";
  return normalized
    .split(/[_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatBillingCycle(packageId?: string, start?: string, end?: string): string {
  if (packageId?.includes("annual")) return "Annual";
  if (packageId?.includes("monthly")) return "Monthly";
  if (!start || !end) return "Not available";
  const durationMs = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "Not available";
  const durationDays = durationMs / (24 * 60 * 60 * 1000);
  if (durationDays >= 300) return "Annual";
  if (durationDays >= 20 && durationDays <= 45) return "Monthly";
  return "Custom";
}

function AvatarContent({ account, isLoading = false }: { account: AppAccountSummary; isLoading?: boolean }) {
  const uiLocale = useUiLocale();
  if (isLoading) {
    return <span className={styles.avatarLoadingSpinner} aria-hidden="true" />;
  }

  if (account.avatarUrl) {
    return (
      <span
        className={styles.avatarImage}
        style={{ backgroundImage: `url("${account.avatarUrl}")` }}
        aria-hidden="true"
      />
    );
  }

  return localizeUiTree(<span>{account.isLoggedIn ? account.initial : "G"}</span>, uiLocale);
}

export function AppShell({
  active,
  account = appAccountSummary,
  accountReady = true,
  announcement = appAnnouncement,
  createHref = "/",
  isChatRoute = false,
  isGeneralWorkspace = false,
  onRefreshAccount,
  children
}: AppShellProps) {
  const shellRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!isChatRoute) return;
    const shell = shellRef.current;
    if (!shell) return;
    return bindChatViewport(shell);
  }, [isChatRoute]);

  const uiLocale = useUiLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shellRequestedPricingVariant =
    searchParams.get("pricing_variant")
    ?? searchParams.get("variant");
  const checkoutReturnKey = searchParams.toString();
  const [announcementDismissed, dismissAnnouncement] = useSessionBannerDismissal("annual-offer");
  const [videoAnnouncementDismissed, dismissVideoAnnouncement] = useSessionBannerDismissal("video");
  const accountCta = accountReady ? (account.isLoggedIn ? "Upgrade" : "Sign in") : "Loading";
  const accountDisplayName = account.displayName || (account.isLoggedIn ? "Creator" : "Guest");
  const accountEmailLabel = account.isLoggedIn ? account.email : "Guest mode active";
  const settingsItems = account.isLoggedIn ? accountSettingsItems : guestSettingsItems;
  const mobileAccountItems = account.isLoggedIn ? accountSettingsItems : guestSettingsItems;

  const canOpenAccountSettings = accountReady && account.isLoggedIn;
  const [isImageToolsFlyoutOpen, setIsImageToolsFlyoutOpen] = useState(false);
  const [isVideoToolsFlyoutOpen, setIsVideoToolsFlyoutOpen] = useState(false);
  const [isMobileAccountMenuOpen, setIsMobileAccountMenuOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsDialogTab, setSettingsDialogTab] = useState<SettingsDialogTab>("subscription");
  const [shellInitialBillingInterval, setShellInitialBillingInterval] = useState<"month" | "year" | undefined>();
  const [shellUpgradeModalOpen, setShellUpgradeModalOpen] = useState(false);
  const [shellCreditPackModalOpen, setShellCreditPackModalOpen] = useState(false);
  const [shellPricingVariant, setShellPricingVariant] = useState<PricingVariant>(() => (
    resolveClientPricingExperimentVariant({
      assignedVariant: account.pricingVariant,
      requestedVariant: shellRequestedPricingVariant
    }).variant
  ));
  const assignedShellPricingVariant = account.pricingVariant
    ? normalizePricingVariant(account.pricingVariant)
    : undefined;
  const shellPricingVariantOverride = readClientPricingVariantOverride();
  const shellPricingAssignmentReady = Boolean(shellPricingVariantOverride || assignedShellPricingVariant);
  const effectiveShellPricingVariant = shellPricingVariantOverride
    ?? assignedShellPricingVariant
    ?? (shellRequestedPricingVariant ? normalizePricingVariant(shellRequestedPricingVariant) : undefined)
    ?? shellPricingVariant;
  const [shellRechargePendingPackage, setShellRechargePendingPackage] = useState<"" | RechargePackageId>("");
  const [shellUpgradeError, setShellUpgradeError] = useState("");
  const [stripePaymentFallback, setStripePaymentFallback] = useState<AppStripePaymentFallback | null>(null);
  const [stripePaymentFallbackPending, setStripePaymentFallbackPending] = useState(false);
  const [stripePaymentFallbackError, setStripePaymentFallbackError] = useState("");
  const [checkoutReturnProbe, setCheckoutReturnProbe] = useState(0);
  const [currentChatSourceUseCase, setCurrentChatSourceUseCase] = useState("");
  const [appToast, setAppToast] = useState<AppToastState | null>(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactCopied, setContactCopied] = useState(false);
  const accountPaidCredits = Math.max(0, Math.floor(Number(account.paidCredits ?? 0) || 0));
  const accountFreeCredits = Math.max(
    0,
    Math.floor(Number(account.freeCredits ?? (account.credits - accountPaidCredits)) || 0)
  );
  const accountPaidExpiringCredits = Math.max(
    0,
    Math.floor(Number(account.paidExpiringCredits ?? (account.paidCreditExpiresAt ? accountPaidCredits : 0)) || 0)
  );
  const accountFreeExpiringCredits = Math.max(
    0,
    Math.floor(Number(account.freeExpiringCredits ?? (account.freeCreditExpiresAt ? accountFreeCredits : 0)) || 0)
  );
  const accountPaidExpiringCreditTotal = Math.max(
    accountPaidExpiringCredits,
    Math.floor(Number(account.paidExpiringCreditTotal ?? accountPaidExpiringCredits) || 0)
  );
  const accountFreeExpiringCreditTotal = Math.max(
    accountFreeExpiringCredits,
    Math.floor(Number(account.freeExpiringCreditTotal ?? accountFreeExpiringCredits) || 0)
  );
  const accountPaidPermanentCredits = Math.max(
    0,
    Math.floor(Number(
      account.paidPermanentCredits
      ?? (account.paidCreditExpiresAt ? accountPaidCredits - accountPaidExpiringCredits : accountPaidCredits)
    ) || 0)
  );
  const accountPaidPackExpiringCredits = Math.max(
    0,
    Math.floor(Number(account.paidPackExpiringCredits ?? 0) || 0)
  );
  const accountPaidPackExpiringCreditTotal = Math.max(
    accountPaidPackExpiringCredits,
    Math.floor(Number(account.paidPackExpiringCreditTotal ?? accountPaidPackExpiringCredits) || 0)
  );
  const accountPaidPackExpiringCreditsUsed = Math.max(
    0,
    accountPaidPackExpiringCreditTotal - accountPaidPackExpiringCredits
  );
  const accountFreePermanentCredits = Math.max(
    0,
    Math.floor(Number(
      account.freePermanentCredits
      ?? (account.freeCreditExpiresAt ? accountFreeCredits - accountFreeExpiringCredits : accountFreeCredits)
    ) || 0)
  );
  const accountFreeCreditProgress = accountFreeExpiringCreditTotal > 0
    ? Math.min(100, (accountFreeExpiringCredits / accountFreeExpiringCreditTotal) * 100)
    : 0;
  const accountPaidExpiringCreditsUsed = Math.max(
    0,
    accountPaidExpiringCreditTotal - accountPaidExpiringCredits
  );
  const accountPaidCreditProgress = accountPaidExpiringCreditTotal > 0
    ? Math.min(100, (accountPaidExpiringCreditsUsed / accountPaidExpiringCreditTotal) * 100)
    : 0;
  const showWatermarkFreeCredits = (effectiveShellPricingVariant === "2.0" || effectiveShellPricingVariant === "2.1" || effectiveShellPricingVariant === "2.2" || effectiveShellPricingVariant === "2.4") && accountPaidCredits > 0;
  const imageToolsFlyoutDismissedRef = useRef(false);
  const videoToolsFlyoutDismissedRef = useRef(false);
  const mobileAccountMenuRef = useRef<HTMLDivElement | null>(null);
  const appToastTimerRef = useRef<number | null>(null);
  const contactCopiedTimerRef = useRef<number | null>(null);
  const checkoutRecoveryControllerRef = useRef<{
    checkoutId: string;
    controller: AbortController;
  } | null>(null);
  const stripePaymentFallbackImpressionRef = useRef("");
  const latestAccountRef = useRef(account);
  latestAccountRef.current = account;
  const shellSubscriptionModalPlans = useMemo(() => {
    const billingContext = {
      market: account.billingMarket ?? "default",
      currency: account.billingCurrency ?? "USD"
    } as const;
    const plans = buildSubscriptionModalPlans(effectiveShellPricingVariant, billingContext);
    return plans.length ? plans : buildSubscriptionModalPlans(DEFAULT_PRICING_VARIANT, billingContext);
  }, [account.billingCurrency, account.billingMarket, effectiveShellPricingVariant]);

  const shellSourceUseCase = "hotel-lobby-ai";
  const isShellVideoWorkspace = getAppOutputType(currentChatSourceUseCase || shellSourceUseCase) === "video";
  const currentPageTool = findAppToolByPathname(stripSiteLocaleFromPath(pathname));
  const hideVideoAnnouncement = isChatRoute
    ? isShellVideoWorkspace
    : getAppOutputType(currentPageTool?.slug) === "video";
  const annualOfferLabel = getBillingIntervalToggleSaveLabel("year", shellSubscriptionModalPlans);
  const annualOfferMessage = getAnnualOfferMessageParts(uiLocale, annualOfferLabel);
  const isPaidAccount = account.plan !== "free";
  const showAnnouncement = announcement.enabled && accountReady && (isPaidAccount
    ? !videoAnnouncementDismissed && !hideVideoAnnouncement
    : !announcementDismissed && shellPricingAssignmentReady && Boolean(annualOfferLabel));

  useEffect(() => () => {
    checkoutRecoveryControllerRef.current?.controller.abort();
    checkoutRecoveryControllerRef.current = null;
  }, []);

  useEffect(() => {
    const probeStoredStripeCheckout = () => {
      const context = readAppCheckoutContext();
      if (isAppStripeCheckoutContext(context)) {
        setCheckoutReturnProbe((value) => value + 1);
      }
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      if (isBackForwardPageShow(event)) probeStoredStripeCheckout();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") probeStoredStripeCheckout();
    };
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
  const preloadSubscriptionModal = useSubscriptionModalPreload(
    showAnnouncement && !isPaidAccount,
    isShellVideoWorkspace ? "video" : "image"
  );
  const buildShellGenerationAnalyticsProperties = useCallback((overrides: Record<string, unknown> = {}) => {
    const outputType = getAppOutputType(shellSourceUseCase);
    return buildAppGenerationAnalyticsProperties({
      appSessionId: undefined,
      jobId: undefined,
      source_use_case: shellSourceUseCase,
      sourceUseCase: shellSourceUseCase,
      output_type: outputType,
      outputType,
      ...overrides
    });
  }, [shellSourceUseCase]);
  const buildShellBillingAnalyticsProperties = useCallback((overrides: Record<string, unknown> = {}) => (
    buildShellGenerationAnalyticsProperties({
      session_id: undefined,
      job_id: undefined,
      action: "billing",
      stage: "billing",
      credit_balance: account.credits,
      entry: APP_ANALYTICS_WORKFLOW,
      pricing_variant: effectiveShellPricingVariant,
      pricing_experiment_key: PRICING_EXPERIMENT_KEY,
      checkout_scenario: "upgrade_cta",
      billing_surface: "result",
      ...overrides
    })
  ), [account.credits, buildShellGenerationAnalyticsProperties, effectiveShellPricingVariant]);
  useResetCheckoutPendingOnPageShow(() => setShellRechargePendingPackage(""));

  // Assign input mode as soon as a user enters the app, matching the
  // subscription experiment lifecycle. The message endpoint reuses the
  // persisted assignment when the user submits a prompt.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(APP_INPUT_MODE_EXPERIMENT_PREFETCH_STORAGE_KEY) === "1") return;
    } catch {
      // Continue without the client cache if storage is unavailable.
    }
    void fetch(`/api/v1/flags/${SOCIALMEDIA_INPUT_MODE_EXPERIMENT_KEY}`, {
      cache: "no-store",
      credentials: "same-origin"
    }).then((response) => {
      if (!response.ok) return;
      try {
        window.sessionStorage.setItem(APP_INPUT_MODE_EXPERIMENT_PREFETCH_STORAGE_KEY, "1");
      } catch {
        // Assignment still persists server-side even when storage is unavailable.
      }
    }).catch(() => {
      // Assignment falls back to the server-side request path on submission.
    });
  }, []);

  useEffect(() => {
    if (!isChatRoute) setCurrentChatSourceUseCase("");
  }, [isChatRoute]);

  useEffect(() => {
    const handleCreateHrefUpdate = (event: Event) => {
      const sourceUseCase = event instanceof CustomEvent && typeof event.detail?.sourceUseCase === "string"
        ? event.detail.sourceUseCase.trim()
        : "";
      if (sourceUseCase) {
        setCurrentChatSourceUseCase(sourceUseCase);
      }
    };
    window.addEventListener(APP_LAST_CREATE_HREF_UPDATE_EVENT, handleCreateHrefUpdate);
    return () => {
      window.removeEventListener(APP_LAST_CREATE_HREF_UPDATE_EVENT, handleCreateHrefUpdate);
    };
  }, []);

  useEffect(() => {
    if (!account.id) return;
    const enteredAt = Date.now();
    const sessionId = getClientSessionId();
    const outputType = getAppOutputType(shellSourceUseCase);

    trackClientEvent("socialmedia.page.viewed", {
      sessionId,
      userId: account.id,
      action: "view",
      stage: "page",
      status: "success",
      pageKind: APP_ANALYTICS_WORKFLOW,
      workflow: APP_ANALYTICS_WORKFLOW,
      sourceUseCase: shellSourceUseCase,
      source_use_case: shellSourceUseCase,
      outputType,
      output_type: outputType,
      path: window.location.pathname,
      referrer: document.referrer || undefined
    });

    const heartbeatId = TELEMETRY_HEARTBEAT_ENABLED
      ? window.setInterval(() => {
          if (document.visibilityState !== "visible") return;
          trackClientEvent("socialmedia.page.heartbeat", {
            sessionId,
            userId: account.id,
            action: "heartbeat",
            stage: "page",
            status: "active",
            pageKind: APP_ANALYTICS_WORKFLOW,
            workflow: APP_ANALYTICS_WORKFLOW,
            sourceUseCase: shellSourceUseCase,
            source_use_case: shellSourceUseCase,
            outputType,
            output_type: outputType,
            durationMs: Date.now() - enteredAt
          });
        }, TELEMETRY_HEARTBEAT_INTERVAL_MS)
      : undefined;

    const handleClick = (event: MouseEvent) => {
      const details = describeClickedElement(event.target);
      if (!details.elementTag) return;
      trackClientEvent("socialmedia.ui.clicked", {
        sessionId,
        userId: account.id,
        action: "click",
        stage: "ui",
        pageKind: APP_ANALYTICS_WORKFLOW,
        workflow: APP_ANALYTICS_WORKFLOW,
        sourceUseCase: shellSourceUseCase,
        source_use_case: shellSourceUseCase,
        outputType,
        output_type: outputType,
        ...details
      });
    };

    const trackExit = () => {
      trackClientEvent("socialmedia.page.exited", {
        sessionId,
        userId: account.id,
        action: "exit",
        stage: "page",
        status: "success",
        pageKind: APP_ANALYTICS_WORKFLOW,
        workflow: APP_ANALYTICS_WORKFLOW,
        sourceUseCase: shellSourceUseCase,
        source_use_case: shellSourceUseCase,
        outputType,
        output_type: outputType,
        durationMs: Date.now() - enteredAt
      });
    };

    document.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("pagehide", trackExit);

    return () => {
      if (heartbeatId !== undefined) window.clearInterval(heartbeatId);
      document.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("pagehide", trackExit);
      trackExit();
    };
  }, [account.id, shellSourceUseCase]);

  useEffect(() => {
    const stored = readAppCheckoutContext();
    const returnedCheckoutId = searchParams.get("checkout_id")?.trim();
    const isKnownCheckoutReturn =
      Boolean(returnedCheckoutId)
      && Boolean(stored?.checkoutId)
      && returnedCheckoutId === stored?.checkoutId;
    const paymentStatus = searchParams.get("payment")?.trim().toLowerCase();
    const isPaymentCancelReturn =
      paymentStatus === "cancel" || paymentStatus === "cancelled" || paymentStatus === "canceled";
    const billingStatus = searchParams.get("billing") || (isPaymentCancelReturn ? "cancelled" : isKnownCheckoutReturn ? "success" : null);

    const presentStripeFallback = (
      context: AppCheckoutContext,
      status: AppStripeCheckoutReturnStatus
    ) => {
      if (!PAYMENT_METHOD_FALLBACK_MODAL_ENABLED) {
        const currentContext = readAppCheckoutContext();
        const currentCheckoutId = currentContext?.checkoutId?.trim();
        if (
          currentContext
          && currentCheckoutId
          && currentCheckoutId === context.checkoutId?.trim()
          && currentContext.createdAt === context.createdAt
        ) {
          clearAppCheckoutContext();
        }
        return;
      }
      checkoutRecoveryControllerRef.current?.controller.abort();
      checkoutRecoveryControllerRef.current = null;
      setStripePaymentFallback({ context, status });
      setStripePaymentFallbackPending(false);
      setStripePaymentFallbackError("");
      captureAnalyticsEvent("payment_method_fallback_offered", buildCheckoutAnalyticsProperties(context.packageId, {
        action: "payment_method_fallback_offer",
        stage: "billing",
        status: "started",
        provider: "stripe",
        fallback_provider: "waffo",
        checkout_id: context.checkoutId,
        checkout_status: status.checkoutStatus,
        payment_status: status.paymentStatus,
        payment_intent_status: status.paymentIntentStatus,
        return_state: status.state,
        asset_id: context.assetId,
        job_id: context.jobId,
        session_id: context.sessionId
      }));
    };

    function startCheckoutRecovery(
      context: AppCheckoutContext,
      source: "billing_return" | "local_checkout_context"
    ) {
      const checkoutId = context.checkoutId?.trim();
      if (!checkoutId) return;
      const activeRecovery = checkoutRecoveryControllerRef.current;
      if (activeRecovery?.checkoutId === checkoutId && !activeRecovery.controller.signal.aborted) return;

      activeRecovery?.controller.abort();
      const controller = new AbortController();
      checkoutRecoveryControllerRef.current = { checkoutId, controller };

      void recoverAppCheckoutPayment({
        context,
        handledRef: { current: "" },
        signal: controller.signal,
        syncCheckout: (recoveryCheckoutId) => syncAppCheckoutForRecovery(recoveryCheckoutId, {
          paymentProvider: context.paymentProvider
        }),
        onAttempt: updateAppCheckoutRecoveryAttempts,
        onConfirmed: (confirmedContext, confirmation) => {
          if (controller.signal.aborted) return;
          const currentAccount = latestAccountRef.current;
          const paymentContext = appCheckoutContextToPaymentContext(confirmedContext);
          trackClientPaymentSuccess({
            packageId: paymentContext.package_id,
            stored: paymentContext,
            confirmedPayment: confirmation,
            fallbackEntry: APP_ANALYTICS_WORKFLOW,
            fallbackScenario: confirmedContext.kind === "image_unlock"
              ? "image_unlock"
              : confirmedContext.kind === "video_unlock"
                ? "video_unlock"
                : "app_checkout",
            fallbackSurface: confirmedContext.kind === "image_unlock" || confirmedContext.kind === "video_unlock"
              ? "result"
              : "upgrade_modal",
            extra: {
              workflow: APP_ANALYTICS_WORKFLOW,
              action: source === "local_checkout_context" ? "checkout_success_recovered" : "checkout_success",
              stage: "billing",
              status: "success",
              ...(source === "local_checkout_context" ? { recovery_source: source } : {}),
              auth_state: currentAccount.authMode === "supabase" ? "signed_in" : currentAccount.authMode ?? "guest",
              auth_mode: currentAccount.authMode ?? "guest",
              account_plan: currentAccount.plan,
              credit_balance: currentAccount.credits
            }
          });

          if (source === "billing_return" && confirmedContext.kind === "image_unlock") {
            const baseProperties = buildCheckoutAnalyticsProperties(APP_IMAGE_UNLOCK_PACKAGE_ID, {
              ...confirmedContext,
              workflow: APP_ANALYTICS_WORKFLOW,
              auth_state: currentAccount.authMode === "supabase" ? "signed_in" : currentAccount.authMode ?? "guest",
              auth_mode: currentAccount.authMode ?? "guest",
              account_plan: currentAccount.plan,
              checkout_id: confirmedContext.checkoutId,
              session_id: confirmedContext.sessionId,
              job_id: confirmedContext.jobId,
              asset_id: confirmedContext.assetId,
              credit_balance: currentAccount.credits
            });
            captureAnalyticsEvent("image_unlock_payment_returned", {
              ...baseProperties,
              action: "payment_return",
              stage: "billing",
              status: "success"
            });
            captureAnalyticsEvent("image_unlock_checkout_sync_finished", {
              ...baseProperties,
              action: "download_unlocked_image",
              stage: "download",
              status: "success"
            });
          }

          clearAppCheckoutContext();
          clearAppPendingCheckoutAfterAuth();
          dispatchAppCheckoutRefreshes(confirmation.checkoutId, true, {
            kind: confirmedContext.kind,
            paymentProvider: confirmedContext.paymentProvider,
            assetId: confirmedContext.assetId,
            jobId: confirmedContext.jobId,
            sessionId: confirmedContext.sessionId
          });
        }
      }).then((result) => {
        if (result !== "not_confirmed" && result !== "attempts_exhausted") return;
        const expiredContext = readAppCheckoutContext();
        if (expiredContext?.checkoutId?.trim() !== checkoutId) return;
        if (!isAppStripeCheckoutContext(expiredContext)) {
          clearAppCheckoutContext();
          return;
        }
        void inspectAppStripeCheckoutReturn(checkoutId).then((status) => {
          if (status?.state === "paid") {
            window.setTimeout(() => startCheckoutRecovery({
              ...expiredContext,
              recoveryAttempts: 0,
              recoveryStartedAt: undefined
            }, source), 0);
            return;
          }
          if (status?.canSwitchPaymentMethod) {
            presentStripeFallback(expiredContext, status);
            return;
          }
          if (status?.state !== "processing") clearAppCheckoutContext();
        });
      }).catch((error) => {
        console.error("[billing] failed to finalize recovered checkout:", error);
      }).finally(() => {
        if (checkoutRecoveryControllerRef.current?.controller === controller) {
          checkoutRecoveryControllerRef.current = null;
        }
      });
    }

    const inspectStripeReturn = async (
      context: AppCheckoutContext,
      source: "billing_return" | "local_checkout_context"
    ) => {
      const checkoutId = context.checkoutId?.trim();
      if (!checkoutId) return;
      const status = await inspectAppStripeCheckoutReturn(checkoutId);
      if (!status) {
        startCheckoutRecovery(context, source);
        return;
      }
      if (status.state === "paid") {
        // A prior processing recovery may already have consumed its retry
        // budget. Once Stripe itself reports paid, always make a fresh sync
        // attempt so entitlements and the current session refresh immediately.
        startCheckoutRecovery({
          ...context,
          recoveryAttempts: 0,
          recoveryStartedAt: undefined
        }, source);
        return;
      }
      if (status.state === "processing") {
        dispatchAppToast("Your Stripe payment is still processing. We'll keep checking it.", "info");
        startCheckoutRecovery(context, source);
        return;
      }
      if (status.canSwitchPaymentMethod) {
        presentStripeFallback(context, status);
        return;
      }
      clearAppCheckoutContext();
    };

    if (billingStatus !== "success" && billingStatus !== "cancelled") {
      if (!stored?.checkoutId?.trim()) return;
      if (isAppStripeCheckoutContext(stored)) {
        void inspectStripeReturn(stored, "local_checkout_context");
      } else {
        startCheckoutRecovery(stored, "local_checkout_context");
      }
      return;
    }

    setShellRechargePendingPackage("");
    if (billingStatus === "cancelled") {
      checkoutRecoveryControllerRef.current?.controller.abort();
      checkoutRecoveryControllerRef.current = null;
      clearAppPendingCheckoutAfterAuth();
      clearAppBillingReturnParams();
      if (stored?.checkoutId?.trim() && isAppStripeCheckoutContext(stored)) {
        void inspectStripeReturn(stored, "billing_return");
      } else {
        clearAppCheckoutContext();
      }
      return;
    }

    const checkoutId = returnedCheckoutId || stored?.checkoutId;
    const paymentContext = mergeCheckoutReturnContext(
      stored ? appCheckoutContextToPaymentContext(stored) : {},
      searchParams
    );
    const checkoutSyncProvider = stored?.paymentProvider ?? paymentContext.provider;
    if (!checkoutId) {
      dispatchAppCheckoutRefreshes(undefined, false);
      clearAppBillingReturnParams();
      return;
    }

    let recoveryContext: AppCheckoutContext = {
      checkoutId,
      packageId: paymentContext.package_id || stored?.packageId || "unknown",
      kind: stored?.kind ?? "subscription",
      paymentProvider: checkoutSyncProvider,
      assetId: paymentContext.asset_id || stored?.assetId,
      jobId: paymentContext.job_id || stored?.jobId,
      sessionId: paymentContext.session_id || stored?.sessionId,
      pricingVariant: stored?.pricingVariant,
      value: stored?.value,
      currency: stored?.currency,
      createdAt: stored?.createdAt || new Date().toISOString()
    };
    if (!stored || stored.checkoutId?.trim() !== checkoutId) {
      rememberAppCheckoutContext({
        checkoutId: recoveryContext.checkoutId,
        packageId: recoveryContext.packageId,
        kind: recoveryContext.kind,
        paymentProvider: recoveryContext.paymentProvider,
        assetId: recoveryContext.assetId,
        jobId: recoveryContext.jobId,
        sessionId: recoveryContext.sessionId,
        pricingVariant: recoveryContext.pricingVariant,
        value: recoveryContext.value,
        currency: recoveryContext.currency
      });
      const rememberedContext = readAppCheckoutContext();
      if (rememberedContext?.checkoutId?.trim() === checkoutId) {
        recoveryContext = rememberedContext;
      }
    }
    startCheckoutRecovery(recoveryContext, "billing_return");
    clearAppBillingReturnParams();
  }, [checkoutReturnKey, checkoutReturnProbe, searchParams]);

  useEffect(() => {
    if (!stripePaymentFallback) {
      stripePaymentFallbackImpressionRef.current = "";
      return;
    }

    const { context, status } = stripePaymentFallback;
    const impressionKey = `${context.checkoutId}:${context.packageId}:${status.state}`;
    if (stripePaymentFallbackImpressionRef.current === impressionKey) return;
    stripePaymentFallbackImpressionRef.current = impressionKey;

    captureAnalyticsEvent("payment_method_fallback_modal_viewed", buildCheckoutAnalyticsProperties(context.packageId, {
      provider: "stripe",
      fallback_provider: "waffo",
      checkout_id: context.checkoutId,
      value: context.value,
      currency: context.currency,
      action: "payment_method_fallback_modal_view",
      stage: "billing",
      status: "viewed",
      checkout_status: status.checkoutStatus,
      payment_status: status.paymentStatus,
      payment_intent_status: status.paymentIntentStatus,
      return_state: status.state,
      asset_id: context.assetId,
      job_id: context.jobId,
      session_id: context.sessionId
    }));
  }, [stripePaymentFallback]);

  useEffect(() => {
    if (!stripePaymentFallback || stripePaymentFallbackPending) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      captureAnalyticsEvent("payment_method_fallback_dismissed", {
        provider: "stripe",
        fallback_provider: "waffo",
        checkout_id: stripePaymentFallback.context.checkoutId,
        package_id: stripePaymentFallback.context.packageId,
        action: "payment_method_fallback_dismiss",
        stage: "billing",
        status: "cancelled"
      });
      setStripePaymentFallback(null);
      setStripePaymentFallbackError("");
      clearAppCheckoutContext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stripePaymentFallback, stripePaymentFallbackPending]);

  const dismissStripePaymentFallback = useCallback(() => {
    if (!stripePaymentFallback || stripePaymentFallbackPending) return;
    captureAnalyticsEvent("payment_method_fallback_dismissed", {
      provider: "stripe",
      fallback_provider: "waffo",
      checkout_id: stripePaymentFallback.context.checkoutId,
      package_id: stripePaymentFallback.context.packageId,
      action: "payment_method_fallback_dismiss",
      stage: "billing",
      status: "cancelled"
    });
    setStripePaymentFallback(null);
    setStripePaymentFallbackError("");
    clearAppCheckoutContext();
  }, [stripePaymentFallback, stripePaymentFallbackPending]);

  const continueStripeCheckout = useCallback(() => {
    if (!stripePaymentFallback?.status.checkoutUrl || stripePaymentFallbackPending) return;
    captureAnalyticsEvent("payment_method_fallback_button_clicked", buildCheckoutAnalyticsProperties(stripePaymentFallback.context.packageId, {
      provider: "stripe",
      fallback_provider: "waffo",
      selected_provider: "stripe",
      button: "continue_with_stripe",
      checkout_id: stripePaymentFallback.context.checkoutId,
      value: stripePaymentFallback.context.value,
      currency: stripePaymentFallback.context.currency,
      action: "payment_method_fallback_button_click",
      stage: "billing",
      status: "clicked",
      asset_id: stripePaymentFallback.context.assetId,
      job_id: stripePaymentFallback.context.jobId,
      session_id: stripePaymentFallback.context.sessionId
    }));
    captureAnalyticsEvent("payment_method_fallback_stripe_continued", {
      provider: "stripe",
      checkout_id: stripePaymentFallback.context.checkoutId,
      package_id: stripePaymentFallback.context.packageId,
      action: "continue_stripe_checkout",
      stage: "billing",
      status: "started"
    });
    setStripePaymentFallback(null);
    window.location.assign(stripePaymentFallback.status.checkoutUrl);
  }, [stripePaymentFallback, stripePaymentFallbackPending]);

  const switchStripeCheckoutToWaffo = useCallback(async () => {
    if (!stripePaymentFallback || stripePaymentFallbackPending) return;
    const { context } = stripePaymentFallback;
    const originalCheckoutId = context.checkoutId?.trim();
    if (!originalCheckoutId) return;

    setStripePaymentFallbackPending(true);
    setStripePaymentFallbackError("");
    captureAnalyticsEvent("payment_method_fallback_button_clicked", buildCheckoutAnalyticsProperties(context.packageId, {
      provider: "stripe",
      fallback_provider: "waffo",
      selected_provider: "waffo",
      button: "switch_to_waffo",
      checkout_id: originalCheckoutId,
      value: context.value,
      currency: context.currency,
      action: "payment_method_fallback_button_click",
      stage: "billing",
      status: "clicked",
      asset_id: context.assetId,
      job_id: context.jobId,
      session_id: context.sessionId
    }));
    captureAnalyticsEvent("payment_method_fallback_selected", buildCheckoutAnalyticsProperties(context.packageId, {
      provider: "stripe",
      fallback_provider: "waffo",
      checkout_id: originalCheckoutId,
      action: "switch_payment_method",
      stage: "billing",
      status: "started",
      asset_id: context.assetId,
      job_id: context.jobId,
      session_id: context.sessionId
    }));

    try {
      const latestStatus = await inspectAppStripeCheckoutReturn(originalCheckoutId);
      if (!latestStatus) throw new Error("We couldn't verify the Stripe payment. Please try again.");
      if (latestStatus.state === "paid") {
        setStripePaymentFallback(null);
        dispatchAppToast("Your Stripe payment completed. Refreshing your account…", "success");
        setCheckoutReturnProbe((value) => value + 1);
        return;
      }
      if (latestStatus.state === "processing") {
        throw new Error("Your Stripe payment is still processing. Please wait before switching payment methods.");
      }
      if (!latestStatus.canSwitchPaymentMethod) {
        throw new Error("This Stripe checkout can't be switched safely. Please start a new payment.");
      }

      const isImageUnlock = context.kind === "image_unlock";
      if (isImageUnlock && !context.assetId) {
        throw new Error("The image for this checkout is no longer available.");
      }
      const endpoint = isImageUnlock
        ? "/api/v1/socialmedia/assets/unlock"
        : "/api/v1/credits/recharge";
      const checkoutContext = isBillingPackageId(context.packageId)
        ? resolveCreditPackCheckoutType({
            checkoutType: latestStatus.checkoutType,
            packageId: context.packageId,
            allowUnambiguousPackageInference: true
          })
        : undefined;
      if (
        isBillingPackageId(context.packageId)
        && isV24ImageCreditPackPackageId(context.packageId)
        && !checkoutContext
      ) {
        throw new Error("The original credit-pack checkout context is unavailable. Please start a new payment.");
      }
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": createAppRechargeIdempotencyKey(`waffo-fallback:${context.packageId}`)
        },
        body: JSON.stringify(isImageUnlock
          ? {
              asset_id: context.assetId,
              pricing_variant: context.pricingVariant ?? effectiveShellPricingVariant,
              return_to: `${window.location.pathname}${window.location.search}`,
              checkout_theme: "default",
              payment_provider: "waffo",
              fallback_from_checkout_id: originalCheckoutId,
              attribution: getStoredAttribution()
            }
          : {
              package_id: context.packageId,
              pricing_variant: context.pricingVariant ?? effectiveShellPricingVariant,
              checkout_context: checkoutContext,
              asset_id: context.assetId,
              job_id: context.jobId,
              session_id: context.sessionId,
              return_to: `${window.location.pathname}${window.location.search}`,
              checkout_theme: "default",
              payment_provider: "waffo",
              fallback_from_checkout_id: originalCheckoutId,
              attribution: getStoredAttribution()
            })
      });
      const data = await response.json().catch(() => ({})) as {
        already_unlocked?: boolean;
        checkout_url?: string;
        transaction_id?: string;
        payment_provider?: string;
        package_id?: string;
        pricing_variant?: string;
        asset_id?: string;
        job_id?: string;
        value?: number;
        currency?: string;
        code?: string;
        error?: string;
      };
      if (data.code === "STRIPE_FALLBACK_CHECKOUT_ALREADY_PAID") {
        setStripePaymentFallback(null);
        dispatchAppToast("Your Stripe payment completed. Refreshing your account…", "success");
        setCheckoutReturnProbe((value) => value + 1);
        return;
      }
      if (!response.ok) throw new Error(data.error || "Unable to switch payment methods.");
      if (data.already_unlocked) {
        clearAppCheckoutContext();
        setStripePaymentFallback(null);
        dispatchAppCheckoutRefreshes(originalCheckoutId, true, {
          kind: context.kind,
          paymentProvider: "stripe",
          assetId: data.asset_id ?? context.assetId,
          jobId: data.job_id ?? context.jobId,
          sessionId: context.sessionId
        });
        return;
      }
      if (!data.checkout_url || !data.transaction_id) {
        throw new Error("The alternate checkout link is missing.");
      }

      rememberAppCheckoutContext({
        checkoutId: data.transaction_id,
        packageId: data.package_id || context.packageId,
        kind: context.kind,
        paymentProvider: data.payment_provider || "waffo",
        assetId: data.asset_id ?? context.assetId,
        jobId: data.job_id ?? context.jobId,
        sessionId: context.sessionId,
        pricingVariant: data.pricing_variant ?? context.pricingVariant,
        value: data.value ?? context.value,
        currency: data.currency ?? context.currency
      });
      captureAnalyticsEvent("payment_method_fallback_checkout_created", buildCheckoutAnalyticsProperties(context.packageId, {
        provider: "waffo",
        fallback_from_provider: "stripe",
        fallback_from_checkout_id: originalCheckoutId,
        checkout_id: data.transaction_id,
        action: "fallback_checkout_created",
        stage: "billing",
        status: "success",
        asset_id: context.assetId,
        job_id: context.jobId,
        session_id: context.sessionId
      }));
      window.location.assign(data.checkout_url);
    } catch (error) {
      const message = getAppCheckoutFailureMessage(error, "Unable to switch payment methods.");
      setStripePaymentFallbackError(message);
      captureAnalyticsEvent("payment_method_fallback_failed", buildCheckoutAnalyticsProperties(context.packageId, {
        provider: "stripe",
        fallback_provider: "waffo",
        checkout_id: originalCheckoutId,
        action: "switch_payment_method",
        stage: "billing",
        status: "failed",
        reason: message,
        asset_id: context.assetId,
        job_id: context.jobId,
        session_id: context.sessionId
      }));
    } finally {
      setStripePaymentFallbackPending(false);
    }
  }, [effectiveShellPricingVariant, stripePaymentFallback, stripePaymentFallbackPending]);

  const openImageToolsFlyout = () => {
    if (!imageToolsFlyoutDismissedRef.current) {
      setIsImageToolsFlyoutOpen(true);
    }
  };

  const dismissImageToolsFlyout = () => {
    imageToolsFlyoutDismissedRef.current = true;
    setIsImageToolsFlyoutOpen(false);
  };

  const resetImageToolsFlyout = () => {
    imageToolsFlyoutDismissedRef.current = false;
    setIsImageToolsFlyoutOpen(false);
  };

  const openVideoToolsFlyout = () => {
    if (!videoToolsFlyoutDismissedRef.current) {
      setIsVideoToolsFlyoutOpen(true);
    }
  };

  const dismissVideoToolsFlyout = () => {
    videoToolsFlyoutDismissedRef.current = true;
    setIsVideoToolsFlyoutOpen(false);
  };

  const resetVideoToolsFlyout = () => {
    videoToolsFlyoutDismissedRef.current = false;
    setIsVideoToolsFlyoutOpen(false);
  };

  const trackBannerAction = (action: "claim" | "video" | "close") => {
    trackTopBannerInteraction({
      action, banner: isPaidAccount ? "video" : "annual_offer", surface: "workbench",
      accountPlan: account.plan, isLoggedIn: account.isLoggedIn,
      pricingVariant: effectiveShellPricingVariant, locale: uiLocale
    });
  };

  const openAppUpgradeModal = (params: { trigger?: string; billingSurface?: string; initialBillingInterval?: "month" | "year" } = {}) => {
    trackClientEvent("socialmedia_sidebar_credit_upgrade_clicked", {
      product_area: "socialmedia",
      action: "upgrade",
      trigger: params.trigger ?? "sidebar_credit_upgrade",
      billing_surface: params.billingSurface ?? "sidebar_credit_panel",
      account_plan: account.plan,
      credit_balance: account.credits,
      auth_mode: account.authMode ?? (accountReady ? "guest" : "local"),
      path: window.location.pathname
    });
    dispatchAppUpgradeModal(params);
  };

  const openBillingPortal = () => {
    const returnPath = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/api/v1/billing/portal?return_to=${encodeURIComponent(returnPath)}`);
  };

  const openSettingsDialog = (tab: SettingsDialogTab = "subscription") => {
    if (!canOpenAccountSettings) return;
    void onRefreshAccount?.();
    setIsMobileAccountMenuOpen(false);
    setSettingsDialogTab(tab);
    setSettingsDialogOpen(true);
    trackClientEvent("socialmedia_account_settings_opened", {
      product_area: "socialmedia",
      action: "open",
      surface: "account_settings_dialog",
      tab,
      account_plan: account.plan,
      credit_balance: account.credits,
      path: window.location.pathname
    });
  };

  const closeSettingsDialog = () => {
    setSettingsDialogOpen(false);
  };

  const handleTopCreditButtonClick = () => {
    openSettingsDialog("subscription");
  };

  const openContactModal = () => {
    setIsMobileAccountMenuOpen(false);
    setContactCopied(false);
    setContactModalOpen(true);
  };

  const handleCopyContactEmail = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setContactCopied(true);
      if (contactCopiedTimerRef.current !== null) {
        window.clearTimeout(contactCopiedTimerRef.current);
      }
      contactCopiedTimerRef.current = window.setTimeout(() => {
        setContactCopied(false);
        contactCopiedTimerRef.current = null;
      }, 1600);
    } catch {
      setContactCopied(false);
    }
  }, []);

  useEffect(() => {
    const initialAssignment = resolveClientPricingExperimentVariant({
      assignedVariant: account.pricingVariant,
      requestedVariant: shellRequestedPricingVariant
    });
    setShellPricingVariant(initialAssignment.variant);
  }, [account.pricingVariant, shellRequestedPricingVariant]);

  useEffect(() => {
    const handleAppUpgradeModal = (event: Event) => {
      if (!shellPricingAssignmentReady) return;
      const detail = event instanceof CustomEvent && event.detail && typeof event.detail === "object"
        ? event.detail as { trigger?: string; billingSurface?: string; initialBillingInterval?: "month" | "year" }
        : {};
      const trigger = detail.trigger ?? "upgrade_cta";
      const billingSurface = detail.billingSurface ?? "upgrade_modal";
      setShellUpgradeError("");
      setShellInitialBillingInterval(detail.initialBillingInterval === "year" ? "year" : undefined);
      setShellUpgradeModalOpen(true);
      trackGoogleAdsSubscriptionModalViewConversion({
        userId: account.authMode === "supabase" ? account.id : undefined
      });
      captureAnalyticsEvent("pricing_modal_opened", buildShellBillingAnalyticsProperties({
        action: "pricing_open",
        status: "started",
        trigger,
        checkout_scenario: trigger,
        billing_surface: billingSurface,
        surface: billingSurface,
        modal_variant: "upgrade_pricing_modal"
      }));
    };

    window.addEventListener(APP_UPGRADE_MODAL_EVENT, handleAppUpgradeModal);
    return () => {
      window.removeEventListener(APP_UPGRADE_MODAL_EVENT, handleAppUpgradeModal);
    };
  }, [account.authMode, account.id, buildShellBillingAnalyticsProperties, shellPricingAssignmentReady]);

  useEffect(() => {
    const handleAppToast = (event: Event) => {
      const detail = event instanceof CustomEvent && event.detail && typeof event.detail === "object"
        ? event.detail as Partial<AppToastState>
        : {};
      if (!detail.message) return;
      setAppToast({
        message: detail.message,
        tone: detail.tone === "success" || detail.tone === "warning" || detail.tone === "error" ? detail.tone : "info",
        placement: detail.placement === "center" ? "center" : undefined
      });
      if (appToastTimerRef.current !== null) {
        window.clearTimeout(appToastTimerRef.current);
      }
      appToastTimerRef.current = window.setTimeout(() => {
        setAppToast(null);
        appToastTimerRef.current = null;
      }, 5200);
    };

    window.addEventListener(APP_TOAST_EVENT, handleAppToast);
    return () => {
      window.removeEventListener(APP_TOAST_EVENT, handleAppToast);
      if (appToastTimerRef.current !== null) {
        window.clearTimeout(appToastTimerRef.current);
        appToastTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (contactCopiedTimerRef.current !== null) {
        window.clearTimeout(contactCopiedTimerRef.current);
        contactCopiedTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!contactModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContactModalOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [contactModalOpen]);

  const subscribeFromShellUpgradeModal = useCallback(async (packageId: RechargePackageId) => {
    const selectedPlan = shellSubscriptionModalPlans.find((item) => item.packageId === packageId);
    const plan = getAppCheckoutPlanName(packageId, shellSubscriptionModalPlans);
    const clickContext = buildShellBillingAnalyticsProperties({
      action: "subscribe_click",
      status: "started",
      package_id: packageId,
      checkout_plan: plan,
      plan,
      pricing_variant: effectiveShellPricingVariant,
      pricing_experiment_key: PRICING_EXPERIMENT_KEY,
      trigger: "upgrade_cta",
      checkout_scenario: "upgrade_cta",
      modal_variant: "upgrade_pricing_modal",
      subscription_click_scenario: getAppSubscriptionClickScenario("upgrade_cta", "upgrade_pricing_modal")
    });
    captureAnalyticsEvent("pricing_modal_subscribe_clicked", clickContext);
    captureAnalyticsEvent("checkout_plan_selected", clickContext);
    if (!account.isLoggedIn) {
      captureAnalyticsEvent("guest_upgrade_requires_auth", buildShellBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(packageId, {
        action: "auth_required",
        status: "started",
        checkout_scenario: "upgrade_cta",
        auth_mode: account.authMode ?? "guest"
      })));
      setShellUpgradeModalOpen(false);
      openThreadAuthModal();
      return;
    }

    setShellRechargePendingPackage(packageId);
    setShellUpgradeError("");
    captureAnalyticsEvent("checkout_started_web", buildShellBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(packageId, {
      action: "checkout_start",
      status: "started",
      package_id: packageId,
      checkout_plan: plan,
      plan,
      pricing_variant: effectiveShellPricingVariant,
      pricing_experiment_key: PRICING_EXPERIMENT_KEY,
      trigger: "upgrade_cta",
      checkout_scenario: "upgrade_cta",
      billing_surface: "upgrade_modal",
      value: selectedPlan?.value,
      currency: selectedPlan?.currency
    })));
    const checkoutIntentKey = createGoogleAdsCheckoutIntentDedupeKey(packageId);
    const googleAdsBeginCheckout = trackGoogleAdsBeginCheckoutConversion({
      dedupeKey: checkoutIntentKey,
      packageId,
      value: selectedPlan?.value,
      currency: selectedPlan?.currency
    });
    const checkoutController = new AbortController();
    const checkoutTimeoutId = window.setTimeout(() => checkoutController.abort(), APP_CHECKOUT_START_TIMEOUT_MS);
    try {
      const response = await requestCheckoutWithAuthRecovery("/api/v1/credits/recharge", {
        method: "POST",
        signal: checkoutController.signal,
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": createAppRechargeIdempotencyKey(packageId)
        },
        body: JSON.stringify({
          package_id: packageId,
          pricing_variant: effectiveShellPricingVariant,
          return_to: `${window.location.pathname}${window.location.search}`,
          discount_code: selectedPlan?.discountRequestCode,
          checkout_theme: "default",
          attribution: getStoredAttribution()
        })
      }, account.id);
      const data = await response.json().catch(() => ({})) as {
        checkout_url?: string;
        transaction_id?: string;
        payment_provider?: string;
        package_id?: string;
        pricing_variant?: string;
        value?: number;
        currency?: string;
        error?: string;
      };
      if (response.status === 401 || response.status === 403) {
        captureAnalyticsEvent("checkout_failed", buildShellBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(packageId, {
          action: "checkout_failed",
          status: "failed",
          statusCode: response.status,
          reason: typeof data.error === "string" ? data.error : "auth_required"
        })));
        setShellUpgradeModalOpen(false);
        openThreadAuthModal({ promptCase: "checkout_auth_required" });
        return;
      }
      if (!response.ok) {
        throw new Error(data.error || "Checkout failed.");
      }
      if (!data.checkout_url) {
        throw new Error("Checkout link is missing.");
      }
      rememberAppCheckoutContext({
        checkoutId: data.transaction_id,
        packageId: data.package_id || packageId,
        kind: "subscription",
        paymentProvider: data.payment_provider,
        pricingVariant: data.pricing_variant ?? effectiveShellPricingVariant,
        value: data.value ?? selectedPlan?.value,
        currency: data.currency ?? selectedPlan?.currency
      });
      await googleAdsBeginCheckout;
      window.location.href = data.checkout_url;
    } catch (caughtError) {
      const failureMessage = getAppCheckoutFailureMessage(caughtError);
      captureAnalyticsEvent("checkout_failed", buildShellBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(packageId, {
        action: "checkout_failed",
        status: "failed",
        reason: failureMessage
      })));
      setShellUpgradeError(failureMessage);
    } finally {
      window.clearTimeout(checkoutTimeoutId);
      setShellRechargePendingPackage("");
    }
  }, [
    account.authMode,
    account.id,
    account.isLoggedIn,
    buildShellBillingAnalyticsProperties,
    effectiveShellPricingVariant,
    shellSubscriptionModalPlans
  ]);

  const closeShellUpgradeModal = useCallback(() => {
    captureAnalyticsEvent("pricing_modal_closed", buildShellBillingAnalyticsProperties({
      action: "pricing_close",
      status: "dismissed",
      trigger: "upgrade_cta",
      checkout_scenario: "upgrade_cta",
      billing_surface: "upgrade_modal",
      surface: "upgrade_modal",
      modal_variant: "upgrade_pricing_modal",
      close_method: "x_button"
    }));
    setShellUpgradeModalOpen(false);
  }, [buildShellBillingAnalyticsProperties]);

  const openShellCreditPackModal = useCallback(() => {
    setShellUpgradeModalOpen(false);
    setShellUpgradeError("");
    setShellCreditPackModalOpen(true);
    captureAnalyticsEvent("pricing_modal_video_credit_pack_clicked", buildShellBillingAnalyticsProperties({
      action: "add_credits",
      status: "started",
      trigger: "account_upgrade_add_credits",
      checkout_scenario: "account_upgrade_add_credits",
      billing_surface: "upgrade_modal",
      modal_variant: "credit_pack"
    }));
  }, [buildShellBillingAnalyticsProperties]);

  const closeShellCreditPackModal = useCallback(() => {
    setShellCreditPackModalOpen(false);
  }, []);

  const selectShellUpgradeModalPlan = useCallback((packageId: RechargePackageId, previousPackageId: RechargePackageId) => {
    const selectedPlan = shellSubscriptionModalPlans.find((item) => item.packageId === packageId);
    const plan = getAppCheckoutPlanName(packageId, shellSubscriptionModalPlans);
    const previousPlan = getAppCheckoutPlanName(previousPackageId, shellSubscriptionModalPlans);
    captureAnalyticsEvent("pricing_modal_plan_selected", buildShellBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(packageId, {
      action: "plan_select",
      status: "started",
      package_id: packageId,
      selected_package_id: packageId,
      checkout_plan: plan,
      plan,
      selected_plan: plan,
      previous_package_id: previousPackageId,
      previous_plan: previousPlan,
      pricing_variant: effectiveShellPricingVariant,
      pricing_experiment_key: PRICING_EXPERIMENT_KEY,
      trigger: "upgrade_cta",
      checkout_scenario: "manual_upgrade_modal",
      modal_variant: "upgrade_pricing_modal",
      billing_surface: "upgrade_modal",
      surface: "upgrade_modal",
      value: selectedPlan?.value,
      currency: selectedPlan?.currency
    })));
  }, [buildShellBillingAnalyticsProperties, effectiveShellPricingVariant, shellSubscriptionModalPlans]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setIsMobileAccountMenuOpen(false), 0);
    return () => window.clearTimeout(timeoutId);
  }, [account.authMode, account.id, account.isLoggedIn]);

  useEffect(() => {
    if (!settingsDialogOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !shellUpgradeModalOpen && !shellCreditPackModalOpen) setSettingsDialogOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [settingsDialogOpen, shellCreditPackModalOpen, shellUpgradeModalOpen]);

  useEffect(() => {
    if (!isMobileAccountMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && mobileAccountMenuRef.current?.contains(target)) {
        return;
      }
      setIsMobileAccountMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMobileAccountMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown, { capture: true });
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, { capture: true });
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileAccountMenuOpen]);

  const appToastToneClass = appToast?.tone === "success"
    ? styles.appToastSuccess
    : appToast?.tone === "warning"
      ? styles.appToastWarning
      : appToast?.tone === "error"
        ? styles.appToastError
        : "";
  const accountPlanLabel = getFrontendAccountPlanLabel(account);
  const settingsPlanName = accountPlanLabel.replace(/ Plan$/, "");
  const settingsHasSubscription = account.plan !== "free" && account.subscriptionStatus !== "none";
  const settingsStatusLabel = account.cancelAtPeriodEnd
    ? "Cancelled"
    : formatSubscriptionStatus(account.subscriptionStatus);
  const settingsCanRenewSubscription = account.cancelAtPeriodEnd
    && (account.billingProvider === "stripe" || account.billingProvider === "waffo");
  const settingsBillingCycle = formatBillingCycle(
    account.subscriptionPackageId,
    account.currentPeriodStartAt,
    account.currentPeriodEndAt
  );
  const settingsPeriodLabel = formatSettingsPeriod(account.currentPeriodStartAt, account.currentPeriodEndAt, uiLocale);
  const settingsRenewalLabel = account.cancelAtPeriodEnd ? "Access ends" : "Next renewal";
  const settingsRenewalDate = formatSettingsDate(account.currentPeriodEndAt, uiLocale);
  const prefersPublicToolLinks = !createHref.startsWith("/app/");
  const normalizeToolLinkHref = useCallback((href: string) => {
    if (!prefersPublicToolLinks) return href;
    const [path = "", query = ""] = href.split("?");
    const [, appSegment, toolSegment] = path.split("/");
    if (appSegment !== "app" || !toolSegment || !findAppTool(toolSegment)) return href;
    return `/${toolSegment}${query ? `?${query}` : ""}`;
  }, [prefersPublicToolLinks]);
  const prefetchAppRoute = useWorkbenchPrefetch(accountReady);

  return localizeUiTree((
    <main ref={shellRef} className={`${styles.shell} ${showAnnouncement ? styles.shellWithAnnouncement : ""} ${isChatRoute ? styles.shellChatRoute : ""} ${isGeneralWorkspace ? styles.shellGeneralWorkspace : ""}`}>
      {showAnnouncement ? (
        <div className={styles.promoBar}>
          {isPaidAccount ? (
            <Link className={styles.promoBarOffer} href="/" prefetch={false} onClick={() => trackBannerAction("video")}>
              <Video size={17} aria-hidden />
              <span className={styles.promoBarCopy}><strong className={styles.videoAnnouncementText}>{t(uiLocale, "workbench.videoAnnouncement.message")}</strong></span>
              <span className={styles.promoBarCta}>{t(uiLocale, "workbench.videoAnnouncement.cta")}</span>
            </Link>
          ) : <button
            className={styles.promoBarOffer}
            type="button"
            aria-haspopup="dialog"
            onPointerEnter={preloadSubscriptionModal}
            onFocus={preloadSubscriptionModal}
            onPointerDown={preloadSubscriptionModal}
            onClick={() => {
              trackBannerAction("claim");
              openAppUpgradeModal({ trigger: "annual_offer_bar", billingSurface: "top_offer_bar", initialBillingInterval: "year" });
            }}
          >
            <Gift size={17} aria-hidden />
            <span className={styles.promoBarCopy}>
              {annualOfferMessage.before}<strong className={styles.promoBarDiscount}>{annualOfferMessage.discount}</strong>{annualOfferMessage.after}
            </span>
            <span className={styles.promoBarCta}>{t(uiLocale, "workbench.annualOffer.cta")}</span>
          </button>}
          <button className={styles.promoBarClose} type="button" aria-label={t(uiLocale, isPaidAccount ? "workbench.videoAnnouncement.dismiss" : "workbench.annualOffer.dismiss")} onClick={() => {
            trackBannerAction("close");
            if (isPaidAccount) dismissVideoAnnouncement();
            else dismissAnnouncement();
          }}>
            <X size={16} aria-hidden />
          </button>
        </div>
      ) : null}

      <aside className={styles.desktopRail} aria-label="App navigation">
        <Link prefetch={false} className={styles.railLogo} href="/" aria-label="Hotel Lobby AI home">
          <Image src="/icon.svg" width={30} height={30} alt="" />
          <span>Hotel Lobby AI</span>
        </Link>
        <nav className={styles.railNav}>
          <div className={styles.railScrollArea}>
            {desktopRailSections.map((section) => (
              <section className={styles.railSection} key={section.label}>
                <h2>{section.label}</h2>
                <div className={styles.railSectionItems}>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    if (item.label === "AI Image") {
                      return (
                        <div
                          className={`${styles.railFlyoutTrigger} ${isImageToolsFlyoutOpen ? styles.railFlyoutOpen : ""}`}
                          key={item.label}
                          onBlur={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget)) {
                              resetImageToolsFlyout();
                            }
                          }}
                          onFocus={openImageToolsFlyout}
                          onMouseEnter={openImageToolsFlyout}
                          onMouseLeave={resetImageToolsFlyout}
                        >
                          <Link
                            prefetch={false}
                            className={styles.railToolLink}
                            href={normalizeToolLinkHref(item.href)}
                            onFocus={() => prefetchAppRoute(normalizeToolLinkHref(item.href))}
                            onMouseEnter={() => prefetchAppRoute(normalizeToolLinkHref(item.href))}
                          >
                            <Icon size={22} aria-hidden />
                            <span>{item.label}</span>
                          </Link>
                          <div className={styles.imageToolsFlyout} role="menu" aria-label="Image tools">
                            <section>
                              <h3>Image Tools</h3>
                              <p>Choose the image workflow you need.</p>
                              <div className={styles.imageToolList}>
                                {imageRailToolFeatures.map((feature) => {
                                  const FeatureIcon = feature.icon;
                                  return (
                                    <Link
                                      prefetch={false}
                                      className={styles.imageToolItem}
                                      href={normalizeToolLinkHref(feature.href)}
                                      key={feature.title}
                                      onClick={dismissImageToolsFlyout}
                                      onFocus={() => prefetchAppRoute(normalizeToolLinkHref(feature.href))}
                                      onMouseEnter={() => prefetchAppRoute(normalizeToolLinkHref(feature.href))}
                                    >
                                      <span className={styles.imageToolIcon}><FeatureIcon size={20} aria-hidden /></span>
                                      <span>
                                        <strong>{feature.title}</strong>
                                        <small>{feature.description}</small>
                                      </span>
                                    </Link>
                                  );
                                })}
                              </div>
                            </section>
                          </div>
                        </div>
                      );
                    }
                    if (item.label === "AI Video") {
                      return (
                        <div
                          className={`${styles.railFlyoutTrigger} ${isVideoToolsFlyoutOpen ? styles.railFlyoutOpen : ""}`}
                          key={item.label}
                          onBlur={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget)) {
                              resetVideoToolsFlyout();
                            }
                          }}
                          onFocus={openVideoToolsFlyout}
                          onMouseEnter={openVideoToolsFlyout}
                          onMouseLeave={resetVideoToolsFlyout}
                        >
                          <Link
                            prefetch={false}
                            className={styles.railToolLink}
                            href={normalizeToolLinkHref(item.href)}
                            onFocus={() => prefetchAppRoute(normalizeToolLinkHref(item.href))}
                            onMouseEnter={() => prefetchAppRoute(normalizeToolLinkHref(item.href))}
                          >
                            <Icon size={22} aria-hidden />
                            <span>{item.label}</span>
                          </Link>
                          <div className={styles.imageToolsFlyout} role="menu" aria-label="Video tools">
                            <section>
                              <h3>Video Tools</h3>
                              <p>Choose the video workflow you need.</p>
                              <div className={styles.imageToolList}>
                                {videoToolFeatures.map((feature) => {
                                  const FeatureIcon = feature.icon;
                                  const featureHref = normalizeToolLinkHref(feature.href);
                                  return (
                                    <Link
                                      prefetch={false}
                                      className={styles.imageToolItem}
                                      href={featureHref}
                                      key={feature.title}
                                      onClick={dismissVideoToolsFlyout}
                                      onFocus={() => prefetchAppRoute(featureHref)}
                                      onMouseEnter={() => prefetchAppRoute(featureHref)}
                                    >
                                      <span className={styles.imageToolIcon}><FeatureIcon size={20} aria-hidden /></span>
                                      <span>
                                        <strong>{feature.title}</strong>
                                        <small>{feature.description}</small>
                                      </span>
                                    </Link>
                                  );
                                })}
                              </div>
                            </section>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <Link
                        prefetch={false}
                        className={styles.railToolLink}
                        href={normalizeToolLinkHref(item.href)}
                        key={item.label}
                        onFocus={() => prefetchAppRoute(normalizeToolLinkHref(item.href))}
                        onMouseEnter={() => prefetchAppRoute(normalizeToolLinkHref(item.href))}
                      >
                        <Icon size={22} aria-hidden />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
            <div className={styles.railDivider} />
            <div className={styles.railSectionItems}>
              <Link
                prefetch={false}
                href="/app/recents"
                onFocus={() => prefetchAppRoute("/app/recents")}
                onMouseEnter={() => prefetchAppRoute("/app/recents")}
              >
                <BottomHistoryIcon size={20} aria-hidden />
                <span>Recents</span>
              </Link>
              <Link
                prefetch={false}
                href="/app/assets"
                onFocus={() => prefetchAppRoute("/app/assets")}
                onMouseEnter={() => prefetchAppRoute("/app/assets")}
              >
                <RailAssetsIcon size={20} aria-hidden />
                <span>Assets</span>
              </Link>
              <Link
                prefetch={false}
                href="/app/explore"
                onFocus={() => prefetchAppRoute("/app/explore")}
                onMouseEnter={() => prefetchAppRoute("/app/explore")}
              >
                <RailExploreIcon size={22} aria-hidden />
                <span>Explore</span>
              </Link>
            </div>
          </div>
        </nav>
        <div className={styles.railAccount}>
          <div className={styles.railUtilityLinks}>
            <DiscordInviteLink entry="app_sidebar" iconSize={22} />
            <button type="button" onClick={openContactModal}>
              <Headphones size={22} aria-hidden />
              <span>Support</span>
            </button>

          </div>
          <div className={styles.planCard}>
            <div className={styles.planCardTop}>
              <button className={styles.avatarButton} type="button" aria-label="Account">
                <AvatarContent account={account} isLoading={!accountReady} />
              </button>
              <div>
                {accountReady ? (
                  <>
                    <strong>{accountPlanLabel}</strong>
                    <span><CreditIcon size={14} aria-hidden />{account.credits.toLocaleString()}</span>
                  </>
                ) : (
                  <strong className={styles.accountLoadingLabel}>Loading account</strong>
                )}
              </div>
              <div className={styles.planSettingsMenu}>
                <button className={styles.planSettingsButton} type="button" aria-label={accountReady ? "Settings" : "Loading account"} disabled={!accountReady}>
                  <PlanSettingsIcon size={16} aria-hidden />
                </button>
                {accountReady ? <div className={styles.settingsPopover}>
                  <header className={styles.settingsProfile}>
                    <button className={styles.settingsAvatar} type="button" aria-label="Account">
                      <AvatarContent account={account} />
                    </button>
                    <div>
                      <strong data-i18n-skip={Boolean(account.displayName)}>{accountDisplayName}</strong>
                      <span data-i18n-skip={Boolean(account.email)}>{accountEmailLabel}</span>
                    </div>
                  </header>
                  {!account.isLoggedIn ? (
                    <section className={styles.settingsPlanPanel}>
                      <div>
                        <strong>FREE</strong>
                        <span>Available credits: {account.credits.toLocaleString()}</span>
                        {showWatermarkFreeCredits ? (
                          <span className={styles.accountPaidCredits}>Watermark-free credits: {accountPaidCredits.toLocaleString()}</span>
                        ) : null}
                      </div>
                      <p>Guest mode on this browser. Sign in to use an account workspace for future creations.</p>
                    </section>
                  ) : null}
                  <nav className={styles.settingsMenuList} aria-label="Settings menu">
                    {settingsItems.map((item) => {
                      const Icon = item.icon;
                      if (item.authTrigger) {
                        return (
                          <button className={`${styles.settingsMenuItem} ${item.featured ? styles.featuredSettingsItem : ""}`} type="button" data-app-auth-trigger key={item.label}>
                            <Icon size={22} aria-hidden />
                            <span>{item.label}</span>
                          </button>
                        );
                      }
                      if (item.upgradeTrigger) {
                        return (
                          <button
                            className={`${styles.settingsMenuItem} ${item.featured ? styles.featuredSettingsItem : ""}`}
                            type="button"
                            key={item.label}
                            onClick={() => openAppUpgradeModal({ trigger: "account_menu_dialog", billingSurface: "account" })}
                          >
                            <Icon size={22} aria-hidden />
                            <span>{item.label}</span>
                          </button>
                        );
                      }
                      if (item.settingsDialogTrigger) {
                        return (
                          <button
                            className={`${styles.settingsMenuItem} ${item.featured ? styles.featuredSettingsItem : ""}`}
                            type="button"
                            key={item.label}
                            onClick={() => openSettingsDialog("subscription")}
                          >
                            <Icon size={22} aria-hidden />
                            <span>{item.label}</span>
                          </button>
                        );
                      }
                      if (item.billingPortalTrigger) {
                        return (
                          <button
                            className={`${styles.settingsMenuItem} ${item.featured ? styles.featuredSettingsItem : ""}`}
                            type="button"
                            key={item.label}
                            onClick={openBillingPortal}
                          >
                            <Icon size={22} aria-hidden />
                            <span>{item.label}</span>
                          </button>
                        );
                      }
                      if (item.contactTrigger) {
                        return (
                          <button
                            className={`${styles.settingsMenuItem} ${item.featured ? styles.featuredSettingsItem : ""}`}
                            type="button"
                            key={item.label}
                            onClick={openContactModal}
                          >
                            <Icon size={22} aria-hidden />
                            <span>{item.label}</span>
                          </button>
                        );
                      }
                      return (
                        <Link prefetch={false} className={`${styles.settingsMenuItem} ${item.featured ? styles.featuredSettingsItem : ""}`} href={item.href ?? "#"} key={item.label}>
                          <Icon size={22} aria-hidden />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </nav>
                  {account.isLoggedIn ? (
                    <>
                      <div className={styles.settingsDivider} />
                      <button className={styles.settingsSignOut} type="button" data-app-logout-trigger>
                        <LogOut size={22} aria-hidden />
                        <span>Sign out</span>
                      </button>
                    </>
                  ) : null}
                </div> : null}
              </div>
            </div>
            <button
              className={styles.upgradeButton}
              type="button"
              data-app-auth-trigger={accountReady && !account.isLoggedIn ? "" : undefined}
              disabled={!accountReady}
              onClick={accountReady && account.isLoggedIn ? () => openAppUpgradeModal({ trigger: "sidebar_credit_upgrade", billingSurface: "sidebar_credit_panel" }) : undefined}
            >
              {accountCta}
            </button>
          </div>
        </div>
      </aside>

      <section className={styles.appFrame}>
        <header className={styles.appTopbar}>
          {isChatRoute ? (
            <button className={styles.appTopBackButton} type="button" aria-label={t(uiLocale, "workbench.thread.back")} onClick={() => router.push(currentChatSourceUseCase === "general" ? "/app" : createHref)}>
              <ChevronLeft size={17} aria-hidden />
              <span>{t(uiLocale, "workbench.thread.back")}</span>
            </button>
          ) : (
            <Link prefetch={false} href="/" aria-label="Hotel Lobby AI home">
              <Image src="/icon.svg" width={27} height={27} alt="" />
            </Link>
          )}
          <div className={styles.appTopActions}>

            {accountReady ? (
              <button
                className={styles.topCreditButton}
                type="button"
                aria-label={canOpenAccountSettings ? "Open credits and subscription settings" : "Credits"}
                aria-haspopup={canOpenAccountSettings ? "dialog" : undefined}
                onClick={handleTopCreditButtonClick}
              >
                <CreditGemIcon aria-hidden />
                <span>{account.credits.toLocaleString()}</span>
              </button>
            ) : null}
            <div
              ref={mobileAccountMenuRef}
              className={`${styles.mobileAccountMenu} ${accountReady && isMobileAccountMenuOpen ? styles.mobileAccountMenuOpen : ""}`}
            >
              <button
                type="button"
                aria-label={accountReady ? "Open account menu" : "Loading account"}
                aria-expanded={accountReady && isMobileAccountMenuOpen}
                aria-controls="app-mobile-account-menu"
                className={styles.mobileAvatar}
                disabled={!accountReady}
                onClick={() => {
                  if (!accountReady) return;
                  setIsMobileAccountMenuOpen((isOpen) => !isOpen);
                }}
              >
                <AvatarContent account={account} isLoading={!accountReady} />
              </button>
              {accountReady ? <div className={styles.mobileAccountPopover} id="app-mobile-account-menu">
                <div className={styles.mobileAccountUser}>
                  <div className={styles.mobileAccountAvatar}>
                    <AvatarContent account={account} />
                  </div>
                  <div>
                    <p data-i18n-skip={Boolean(account.displayName)} className={styles.mobileAccountName}>{accountDisplayName}</p>
                    <p data-i18n-skip={Boolean(account.email)} className={styles.mobileAccountEmail}>{accountEmailLabel}</p>
                  </div>
                </div>
                <div className={styles.mobileSubscriptionCard}>
                  <div className={styles.mobileSubscriptionHead}>
                    <span>{account.plan.toUpperCase()}</span>
                    {account.isLoggedIn ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMobileAccountMenuOpen(false);
                          openAppUpgradeModal({ trigger: "mobile_account_upgrade", billingSurface: "account" });
                        }}
                      >
                        Upgrade
                      </button>
                    ) : null}
                  </div>
                  {account.isLoggedIn ? (
                    account.creditBreakdownAvailable === false ? (
                      <>
                        <p>Available credits: {account.credits.toLocaleString()}</p>
                        <p>Credit details are temporarily unavailable.</p>
                      </>
                    ) : (
                      <>
                        <p className={styles.accountPaidCredits}>Paid credits: {accountPaidCredits.toLocaleString()}</p>
                        <p>Free credits: {accountFreeCredits.toLocaleString()}</p>
                      </>
                    )
                  ) : (
                    <>
                      <p>Available credits: {account.credits.toLocaleString()}</p>
                      {showWatermarkFreeCredits ? (
                        <p className={styles.accountPaidCredits}>Watermark-free credits: {accountPaidCredits.toLocaleString()}</p>
                      ) : null}
                    </>
                  )}
                  <p>{account.isLoggedIn ? "Stored in your account profile." : "Guest mode on this browser."}</p>
                </div>
                <nav className={styles.mobileAccountList} aria-label="Account menu">
                  {mobileAccountItems.map((item) => {
                    const Icon = item.icon;
                    if (item.authTrigger) {
                      return (
                        <button
                          className={styles.mobileAccountListButton}
                          type="button"
                          data-app-auth-trigger
                          key={item.label}
                          onClick={() => setIsMobileAccountMenuOpen(false)}
                        >
                          <Icon size={16} aria-hidden />
                          <span>{item.label}</span>
                        </button>
                      );
                    }
                    if (item.upgradeTrigger) {
                      return (
                        <button
                          className={`${styles.mobileAccountListButton} ${styles.mobileAccountListButtonNeutral}`}
                          type="button"
                          key={item.label}
                          onClick={() => {
                            setIsMobileAccountMenuOpen(false);
                            openAppUpgradeModal({ trigger: "mobile_account_dialog", billingSurface: "account" });
                          }}
                        >
                          <Icon size={16} aria-hidden />
                          <span>{item.label}</span>
                        </button>
                      );
                    }
                    if (item.settingsDialogTrigger) {
                      return (
                        <button
                          className={`${styles.mobileAccountListButton} ${styles.mobileAccountListButtonNeutral}`}
                          type="button"
                          key={item.label}
                          onClick={() => openSettingsDialog("subscription")}
                        >
                          <Icon size={16} aria-hidden />
                          <span>{item.label}</span>
                        </button>
                      );
                    }
                    if (item.billingPortalTrigger) {
                      return (
                        <button
                          className={`${styles.mobileAccountListButton} ${styles.mobileAccountListButtonNeutral}`}
                          type="button"
                          key={item.label}
                          onClick={() => {
                            setIsMobileAccountMenuOpen(false);
                            openBillingPortal();
                          }}
                        >
                          <Icon size={16} aria-hidden />
                          <span>{item.label}</span>
                        </button>
                      );
                    }
                    if (item.contactTrigger) {
                      return (
                        <button
                          className={`${styles.mobileAccountListButton} ${styles.mobileAccountListButtonNeutral}`}
                          type="button"
                          key={item.label}
                          onClick={openContactModal}
                        >
                          <Icon size={16} aria-hidden />
                          <span>{item.label}</span>
                        </button>
                      );
                    }
                    return (
                      <Link prefetch={false} href={item.href ?? "#"} key={item.label} onClick={() => setIsMobileAccountMenuOpen(false)}>
                        <Icon size={16} aria-hidden />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                  <DiscordInviteLink
                    entry="mobile_account"
                    iconSize={16}
                    onClick={() => setIsMobileAccountMenuOpen(false)}
                  />
                  {account.isLoggedIn ? (
                    <button
                      className={`${styles.mobileAccountListButton} ${styles.mobileAccountSignOut}`}
                      type="button"
                      data-app-logout-trigger
                      onClick={() => setIsMobileAccountMenuOpen(false)}
                    >
                      <LogOut size={16} aria-hidden />
                      <span>Sign out</span>
                    </button>
                  ) : null}
                </nav>
              </div> : null}
            </div>
          </div>
        </header>
        <div className={styles.appScrollRegion}>
          <HotelSiteNav workspace />
          {children}
        </div>
      </section>

      {!isChatRoute ? (
        <nav className={styles.mobileBottomNav} aria-label="App navigation">
          {mobileBottomItems.map((item) => {
            const Icon = item.icon;
            const href = item.id === "create" ? createHref : item.href;
            return (
              <Link
                prefetch={false}
                className={item.id === active ? styles.activeBottomItem : ""}
                aria-current={item.id === active ? "page" : undefined}
                href={href}
                key={item.id}
                onFocus={() => prefetchAppRoute(href)}
                onMouseEnter={() => prefetchAppRoute(href)}
                onTouchStart={() => prefetchAppRoute(href)}
              >
                <Icon size={item.size} aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}
      {appToast ? (
        <div className={`${styles.appToast} ${appToastToneClass} ${appToast.placement === "center" ? styles.appToastCenter : ""}`} role="status" aria-live="polite">
          <span>{appToast.message}</span>
        </div>
      ) : null}
      {PAYMENT_METHOD_FALLBACK_MODAL_ENABLED && stripePaymentFallback && typeof document !== "undefined" ? createPortal(
        localizeUiTree(<div
          className={styles.paymentFallbackOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) dismissStripePaymentFallback();
          }}
        >
          <section
            className={styles.paymentFallbackDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-fallback-title"
            aria-describedby="payment-fallback-description"
          >
            <button
              type="button"
              className={styles.paymentFallbackClose}
              onClick={dismissStripePaymentFallback}
              disabled={stripePaymentFallbackPending}
              aria-label="Close payment options"
            >
              <X size={20} aria-hidden />
            </button>
            <div className={styles.paymentFallbackIcon} aria-hidden>
              <CreditCard size={24} />
            </div>
            <h2 id="payment-fallback-title">Having trouble with payment?</h2>
            <p id="payment-fallback-description">
              We couldn&apos;t confirm your payment. Continue with Stripe, or switch to Waffo for the same plan and price without losing your current work.
            </p>
            {stripePaymentFallbackError ? (
              <div className={styles.paymentFallbackError} role="alert">
                {stripePaymentFallbackError}
              </div>
            ) : null}
            <div className={styles.paymentFallbackActions}>
              {stripePaymentFallback.status.canContinueStripe && stripePaymentFallback.status.checkoutUrl ? (
                <button
                  type="button"
                  className={styles.paymentFallbackSecondary}
                  onClick={continueStripeCheckout}
                  disabled={stripePaymentFallbackPending}
                  autoFocus
                >
                  Continue with Stripe
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.paymentFallbackSecondary}
                  onClick={dismissStripePaymentFallback}
                  disabled={stripePaymentFallbackPending}
                  autoFocus
                >
                  Not now
                </button>
              )}
              <button
                type="button"
                className={styles.paymentFallbackSecondary}
                onClick={() => void switchStripeCheckoutToWaffo()}
                disabled={stripePaymentFallbackPending}
              >
                {stripePaymentFallbackPending ? <AppLoadingSpinner size={17} /> : null}
                <span>{stripePaymentFallbackPending ? "Switching…" : "Switch to Waffo"}</span>
              </button>
            </div>
            <p className={styles.paymentFallbackSecurity}>
              <ShieldCheck size={14} aria-hidden />
              <span>Alternate secure checkout powered by Waffo</span>
            </p>
            <a
              className={styles.paymentFallbackContact}
              href={SUPPORT_MAILTO_HREF}
              onClick={() => void handleCopyContactEmail()}
              title={`Email ${SUPPORT_EMAIL} (copies the address)`}
            >
              Need help? Contact us
            </a>
          </section>
        </div>, uiLocale),
        document.body
      ) : null}
      {settingsDialogOpen && typeof document !== "undefined" ? createPortal(
        localizeUiTree(<div
          className={styles.accountSettingsOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSettingsDialog();
          }}
        >
          <section
            className={styles.accountSettingsDialog}
            role="dialog"
            aria-modal="true"
            aria-label="Account settings"
          >
            <header className={styles.accountSettingsHeader}>
              <div className={styles.accountSettingsTabs} role="tablist" aria-label="Settings sections">
                <button
                  type="button"
                  role="tab"
                  aria-selected={settingsDialogTab === "personal"}
                  className={settingsDialogTab === "personal" ? styles.accountSettingsTabActive : ""}
                  onClick={() => setSettingsDialogTab("personal")}
                >
                  <UserRound size={16} aria-hidden />
                  <span>Personal Info</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={settingsDialogTab === "subscription"}
                  className={settingsDialogTab === "subscription" ? styles.accountSettingsTabActive : ""}
                  onClick={() => setSettingsDialogTab("subscription")}
                >
                  <CreditCard size={16} aria-hidden />
                  <span>Subscription</span>
                </button>
              </div>
              <button
                type="button"
                className={styles.accountSettingsClose}
                onClick={closeSettingsDialog}
                aria-label="Close settings"
              >
                <X size={20} aria-hidden />
              </button>
            </header>

            <div className={styles.accountSettingsBody}>
              {settingsDialogTab === "personal" ? (
                <div role="tabpanel" className={styles.accountSettingsPanel}>
                  <div className={styles.accountSettingsIntro}>
                    <h3>Personal Info</h3>
                    <p>Your account details for Hotel Lobby AI.</p>
                  </div>
                  <div className={styles.accountSettingsCard}>
                    <div className={styles.accountSettingsField}>
                      <span>Name</span>
                      <strong data-i18n-skip={Boolean(account.displayName)}>{accountDisplayName}</strong>
                    </div>
                    <div className={styles.accountSettingsField}>
                      <span>Email</span>
                      <strong>{account.email || "Not available"}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div role="tabpanel" className={styles.accountSettingsPanel}>
                  <div className={styles.accountSettingsIntro}>
                    <h3>Subscription</h3>
                    <p>Manage your subscription and credits.</p>
                  </div>

                  <section className={styles.accountSettingsCard} aria-label="Current plan">
                    <div className={styles.accountSettingsPlanTop}>
                      <div>
                        <span>Current Plan</span>
                        <strong>{settingsPlanName}</strong>
                      </div>
                      {settingsHasSubscription ? <span className={styles.accountSettingsStatus}>{settingsStatusLabel}</span> : null}
                    </div>

                    {settingsHasSubscription ? (
                      <dl className={styles.accountSettingsPlanDetails}>
                        <div>
                          <dt>Billing cycle</dt>
                          <dd>{settingsBillingCycle}</dd>
                        </div>
                        <div>
                          <dt>Current period</dt>
                          <dd>{settingsPeriodLabel}</dd>
                        </div>
                        <div>
                          <dt>{settingsRenewalLabel}</dt>
                          <dd>{settingsRenewalDate}</dd>
                        </div>
                      </dl>
                    ) : null}

                    <button
                      type="button"
                      className={styles.accountSettingsPrimaryAction}
                      onClick={() => {
                        if (account.plan === "free") {
                          openAppUpgradeModal({ trigger: "account_settings_upgrade", billingSurface: "account_settings" });
                          return;
                        }
                        closeSettingsDialog();
                        openBillingPortal();
                      }}
                    >
                      {account.plan === "free" ? <Sparkles size={17} aria-hidden /> : null}
                      <span>
                        {account.plan === "free"
                          ? "Upgrade Plan"
                          : settingsCanRenewSubscription
                            ? "Renew Plan"
                            : "Manage Subscription"}
                      </span>
                    </button>
                  </section>

                  <section className={`${styles.accountSettingsCard} ${styles.accountSettingsCreditsCard}`} aria-label="Credits balance">
                    <div className={styles.accountSettingsCreditsTop}>
                      <span>Credits Balance</span>
                      <strong>{account.credits.toLocaleString()} remaining</strong>
                    </div>

                    {account.creditBreakdownAvailable === false ? (
                      <div className={styles.accountSettingsCreditRows}>
                        <div className={styles.accountSettingsCreditRow}>
                          <p>Credit details are temporarily unavailable. Please try again.</p>
                        </div>
                      </div>
                    ) : (
                    <div className={styles.accountSettingsCreditRows}>
                      <div className={styles.accountSettingsCreditRow}>
                        <div className={styles.accountSettingsCreditLabel}>
                          <span>Free credits</span>
                          <strong>{accountFreeCredits.toLocaleString()}</strong>
                        </div>
                        {accountFreeExpiringCreditTotal > 0 ? (
                          <>
                            <div
                              className={styles.accountSettingsCreditTrack}
                              role="progressbar"
                              aria-label="Free credits for the current period"
                              aria-valuemin={0}
                              aria-valuemax={accountFreeExpiringCreditTotal}
                              aria-valuenow={accountFreeExpiringCredits}
                            >
                              <span
                                className={styles.accountSettingsCreditFillFree}
                                style={{ width: `${accountFreeCreditProgress}%` }}
                              />
                            </div>
                            <p>
                              {accountFreeExpiringCredits.toLocaleString()} / {accountFreeExpiringCreditTotal.toLocaleString()} this period
                              {account.freeCreditExpiresAt ? ` · Expires ${formatSettingsDate(account.freeCreditExpiresAt, uiLocale)}` : ""}
                            </p>
                          </>
                        ) : null}
                        {accountFreePermanentCredits > 0 ? (
                          <p>{accountFreePermanentCredits.toLocaleString()} credits · Never expires</p>
                        ) : null}
                        {accountFreeCredits === 0 ? <p>No free credits available</p> : null}
                      </div>

                      <div className={styles.accountSettingsCreditRow}>
                        <div className={styles.accountSettingsCreditLabel}>
                          <span>Subscription credits</span>
                          <strong>
                            {accountPaidExpiringCreditsUsed.toLocaleString()} / {accountPaidExpiringCreditTotal.toLocaleString()} used
                          </strong>
                        </div>
                        {accountPaidExpiringCreditTotal > 0 ? (
                          <>
                            <div
                              className={styles.accountSettingsCreditTrack}
                              role="progressbar"
                              aria-label="Subscription credits used in the current period"
                              aria-valuemin={0}
                              aria-valuemax={accountPaidExpiringCreditTotal}
                              aria-valuenow={accountPaidExpiringCreditsUsed}
                            >
                              <span
                                className={styles.accountSettingsCreditFillPaid}
                                style={{ width: `${accountPaidCreditProgress}%` }}
                              />
                            </div>
                            <p>
                              {accountPaidExpiringCredits.toLocaleString()} credits remaining
                              {account.paidCreditExpiresAt ? ` · Expires ${formatSettingsDate(account.paidCreditExpiresAt, uiLocale)}` : ""}
                            </p>
                          </>
                        ) : <p>No active subscription credits</p>}
                        {accountPaidPackExpiringCredits > 0 ? (
                          <p>
                            Purchased credits: {accountPaidPackExpiringCreditsUsed.toLocaleString()} / {accountPaidPackExpiringCreditTotal.toLocaleString()} used
                            {` · ${accountPaidPackExpiringCredits.toLocaleString()} remaining`}
                            {account.paidPackCreditExpiresAt
                              ? ` · Next expiry ${formatSettingsDate(account.paidPackCreditExpiresAt, uiLocale)}`
                              : ""}
                          </p>
                        ) : null}
                        {accountPaidPermanentCredits > 0 ? (
                          <p>Purchased credits: {accountPaidPermanentCredits.toLocaleString()} remaining · Never expires</p>
                        ) : null}
                      </div>
                    </div>
                    )}
                  </section>
                </div>
              )}
            </div>
          </section>
        </div>, uiLocale),
        document.body
      ) : null}
      {contactModalOpen && typeof document !== "undefined" ? createPortal(
        localizeUiTree(<div
          className={styles.contactModalOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Contact support"
          onClick={() => setContactModalOpen(false)}
        >
          <div className={styles.contactModalShell} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={styles.contactModalClose}
              onClick={() => setContactModalOpen(false)}
              aria-label="Close contact dialog"
            >
              <X size={20} aria-hidden />
            </button>
            <div className={styles.contactModalBody}>
              <p className={styles.contactModalLabel}>Email</p>
              <a className={styles.contactModalEmail} href={SUPPORT_MAILTO_HREF}>
                {SUPPORT_EMAIL}
              </a>
              <button
                type="button"
                className={styles.contactModalCopy}
                onClick={() => void handleCopyContactEmail()}
              >
                {contactCopied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
                <span>{contactCopied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>
        </div>, uiLocale),
        document.body
      ) : null}
      {shellPricingAssignmentReady && shellUpgradeModalOpen ? (
        <SubscriptionGateModal
          mode="upgrade"
          initialBillingInterval={shellInitialBillingInterval}
          accountPlan={account.plan}
          sourceUseCase={currentChatSourceUseCase || shellSourceUseCase}
          title={isShellVideoWorkspace ? "Upgrade your video plan" : undefined}
          subtitle={isShellVideoWorkspace
            ? "Subscribe with video credits and keep creating directly from this workspace."
            : undefined}
          pricingVariant={effectiveShellPricingVariant}
          plans={shellSubscriptionModalPlans}
          pendingPackage={shellRechargePendingPackage}
          error={shellUpgradeError}
          onClose={closeShellUpgradeModal}
          onSubscribe={(packageId) => void subscribeFromShellUpgradeModal(packageId)}
          onPlanSelect={selectShellUpgradeModalPlan}
          onAddCredits={shouldShowAccountUpgradeCreditPackEntry({
            isLoggedIn: account.isLoggedIn,
            accountPlan: account.plan,
            pricingVariant: effectiveShellPricingVariant
          }) ? openShellCreditPackModal : undefined}
        />
      ) : null}
      {shellPricingAssignmentReady && shellCreditPackModalOpen && typeof document !== "undefined" ? createPortal(
        localizeUiTree(<VideoSubscriptionModal
          open={shellCreditPackModalOpen}
          presentation="app"
          video={null}
          pricingVariant={effectiveShellPricingVariant}
          defaultView="credit_pack"
          initialAccountPlan={account.plan}
          initialCreditBalance={account.credits}
          initialBillingMarket={account.billingMarket}
          onClose={closeShellCreditPackModal}
        />, uiLocale),
        document.body
      ) : null}
    </main>
  ), uiLocale);
}

function describeClickedElement(target: EventTarget | null) {
  if (!(target instanceof Element)) return {};
  const element = target.closest("button,a,[role='button'],input,textarea,select");
  if (!element) return {};
  const label = element.getAttribute("aria-label")
    || element.getAttribute("title")
    || element.textContent
    || element.getAttribute("name")
    || element.tagName.toLowerCase();
  return {
    elementTag: element.tagName.toLowerCase(),
    elementRole: element.getAttribute("role") ?? undefined,
    elementLabel: truncateTelemetryText(label, 120),
    elementHref: element instanceof HTMLAnchorElement ? element.getAttribute("href") ?? undefined : undefined
  };
}

type AppStripePaymentFallback = {
  context: AppCheckoutContext;
  status: AppStripeCheckoutReturnStatus;
};

function dispatchAppCheckoutSynced(detail: AppCheckoutSyncedEventDetail): void {
  window.dispatchEvent(new CustomEvent(APP_CHECKOUT_SYNCED_EVENT, { detail }));
}

function dispatchAppCheckoutRefreshes(
  checkoutId: string | undefined,
  checkoutSyncOk: boolean,
  detail: Omit<AppCheckoutSyncedEventDetail, "checkoutId" | "checkoutSyncOk"> = {}
): void {
  window.dispatchEvent(new Event("vismuse:account-updated"));
  dispatchAppCheckoutSynced({ ...detail, checkoutId, checkoutSyncOk });
  for (const delayMs of [2500, 7500, 15000]) {
    window.setTimeout(() => {
      window.dispatchEvent(new Event("vismuse:account-updated"));
      dispatchAppCheckoutSynced({ ...detail, checkoutId, checkoutSyncOk });
    }, delayMs);
  }
}

function clearAppBillingReturnParams(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  for (const key of [
    "billing",
    "payment",
    "package_id",
    "asset_id",
    "job_id",
    "session_id",
    "checkout_id",
    "payment_provider",
    "order_id",
    "customer_id",
    "product_id",
    "signature"
  ]) {
    url.searchParams.delete(key);
  }
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}
