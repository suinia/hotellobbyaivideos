"use client";

import { trackClientEvent } from "@/lib/telemetry/client";
import { DEFAULT_PRICING_VARIANT, PRICING_EXPERIMENT_COOKIE, normalizePricingVariant } from "@/lib/billing/catalog";

export type SimpleAttribution = {
  source: string;
  creative: string;
  medium: string;
  campaign: string;
  term: string;
  googleAdsKeyword: string;
  googleAdsMatchType: string;
  googleAdsNetwork: string;
  googleAdsDevice: string;
  googleAdsCampaignId: string;
  googleAdsAdGroupId: string;
  googleAdsCreativeId: string;
  content: string;
  gclid: string;
  landingPath: string;
  landingUrl: string;
  referrer: string;
  referralSource: string;
  referralInviterEmail: string;
  referralCampaign: string;
  firstTouchSource: string;
  firstTouchCreative: string;
  firstTouchMedium: string;
  firstTouchCampaign: string;
  firstTouchTerm: string;
  firstTouchGoogleAdsKeyword: string;
  firstTouchGoogleAdsMatchType: string;
  firstTouchGoogleAdsNetwork: string;
  firstTouchGoogleAdsDevice: string;
  firstTouchGoogleAdsCampaignId: string;
  firstTouchGoogleAdsAdGroupId: string;
  firstTouchGoogleAdsCreativeId: string;
  firstTouchContent: string;
  firstTouchGclid: string;
  firstTouchLandingPath: string;
  firstTouchLandingUrl: string;
  firstTouchReferrer: string;
  firstTouchReferralSource: string;
  firstTouchReferralInviterEmail: string;
  firstTouchReferralCampaign: string;
};

const ATTRIBUTION_STORAGE_KEY = "vismuse_attribution_v1";
const DIRECT_SOURCE = "direct";
const NO_MEDIUM = "none";
const LEGACY_DEFAULT_SOURCE = "organic";
const LEGACY_DEFAULT_MEDIUM = "organic";
function isLocalAnalyticsDisabled(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.trim().toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

type PosthogBrowserApi = {
  capture?: (event: string, properties?: Record<string, unknown>, options?: { transport?: "XHR" | "sendBeacon" }) => void;
  identify?: (distinctId: string, properties?: Record<string, unknown>) => void;
  register?: (properties: Record<string, unknown>) => void;
  startSessionRecording?: () => void;
};

type PosthogBrowserWindow = Window & {
  posthog?: unknown;
  __vismusePosthogReplayRequested?: boolean;
  __vismusePosthogReplayStartQueued?: boolean;
};

function getPosthog(): PosthogBrowserApi | null {
  if (typeof window === "undefined") return null;
  if (isLocalAnalyticsDisabled()) return null;
  const candidate = (window as PosthogBrowserWindow).posthog;
  if (!candidate || typeof candidate !== "object") return null;
  return candidate as PosthogBrowserApi;
}

export function startAnalyticsSessionRecording(): boolean {
  if (typeof window === "undefined" || isLocalAnalyticsDisabled()) return false;

  const analyticsWindow = window as PosthogBrowserWindow;
  if (analyticsWindow.__vismusePosthogReplayRequested) return false;
  analyticsWindow.__vismusePosthogReplayRequested = true;

  const posthog = getPosthog();
  if (typeof posthog?.startSessionRecording === "function") {
    analyticsWindow.__vismusePosthogReplayStartQueued = true;
    posthog.startSessionRecording();
  }
  return true;
}

function normalizeParam(value: string | null): string {
  return value?.trim() || "";
}

function normalizeOptional(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAttributionHost(value: string): string {
  return value.trim().toLowerCase().replace(/^www\./, "");
}

function isDirectLike(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return !normalized || normalized === DIRECT_SOURCE || normalized === "$direct";
}

function compactAttribution(partial: Partial<SimpleAttribution>): Partial<SimpleAttribution> {
  return Object.fromEntries(
    Object.entries(partial).filter(([, value]) => value !== undefined)
  ) as Partial<SimpleAttribution>;
}

// Login/payment redirects are journey steps, not acquisition sources. Keep
// these aligned with the dashboard's AUTH_OR_PAYMENT_SOURCE_LIST.
const AUTH_OR_PAYMENT_REFERRER_HOSTS = [
  "accounts.google.com",
  "appleid.apple.com",
  "creem.io",
  "stripe.com",
  "googleusercontent.com"
];

function searchEngineSourceFromHost(hostname: string): string | undefined {
  const host = normalizeAttributionHost(hostname);
  if (host === "google" || host.startsWith("google.") || host.endsWith(".google.com")) return "google";
  if (host === "bing" || host.startsWith("bing.") || host.endsWith(".bing.com")) return "bing";
  if (host === "duckduckgo.com" || host.endsWith(".duckduckgo.com")) return "duckduckgo";
  if (host === "yahoo.com" || host.endsWith(".yahoo.com")) return "yahoo";
  if (host === "baidu.com" || host.endsWith(".baidu.com")) return "baidu";
  return undefined;
}

export function getDefaultAttribution(): SimpleAttribution {
  return {
    source: DIRECT_SOURCE,
    creative: "none",
    medium: NO_MEDIUM,
    campaign: "none",
    term: "none",
    googleAdsKeyword: "none",
    googleAdsMatchType: "none",
    googleAdsNetwork: "none",
    googleAdsDevice: "none",
    googleAdsCampaignId: "none",
    googleAdsAdGroupId: "none",
    googleAdsCreativeId: "none",
    content: "none",
    gclid: "none",
    landingPath: "/",
    landingUrl: "",
    referrer: "direct",
    referralSource: "none",
    referralInviterEmail: "none",
    referralCampaign: "none",
    firstTouchSource: DIRECT_SOURCE,
    firstTouchCreative: "none",
    firstTouchMedium: NO_MEDIUM,
    firstTouchCampaign: "none",
    firstTouchTerm: "none",
    firstTouchGoogleAdsKeyword: "none",
    firstTouchGoogleAdsMatchType: "none",
    firstTouchGoogleAdsNetwork: "none",
    firstTouchGoogleAdsDevice: "none",
    firstTouchGoogleAdsCampaignId: "none",
    firstTouchGoogleAdsAdGroupId: "none",
    firstTouchGoogleAdsCreativeId: "none",
    firstTouchContent: "none",
    firstTouchGclid: "none",
    firstTouchLandingPath: "/",
    firstTouchLandingUrl: "",
    firstTouchReferrer: "direct",
    firstTouchReferralSource: "none",
    firstTouchReferralInviterEmail: "none",
    firstTouchReferralCampaign: "none"
  };
}

export function readAttributionFromReferrer(referrer: string, currentUrl: string): Partial<SimpleAttribution> {
  const normalizedReferrer = referrer.trim();
  if (isDirectLike(normalizedReferrer)) return {};

  try {
    const referrerUrl = new URL(normalizedReferrer);
    const current = currentUrl.trim() ? new URL(currentUrl) : null;
    const referrerHost = normalizeAttributionHost(referrerUrl.hostname);
    const currentHost = current ? normalizeAttributionHost(current.hostname) : "";
    if (!referrerHost || referrerHost === currentHost) return {};
    if (AUTH_OR_PAYMENT_REFERRER_HOSTS.some(
      (host) => referrerHost === host || referrerHost.endsWith(`.${host}`)
    )) return {};

    const searchSource = searchEngineSourceFromHost(referrerHost);
    if (searchSource) {
      return {
        source: searchSource,
        medium: LEGACY_DEFAULT_MEDIUM
      };
    }

    return {
      source: referrerHost,
      medium: "referral"
    };
  } catch {
    return {};
  }
}

export function readAttributionFromSearchParams(searchParams: URLSearchParams): Partial<SimpleAttribution> {
  const rawSource = normalizeParam(searchParams.get("utm_source")) || normalizeParam(searchParams.get("source"));
  const creative = normalizeParam(searchParams.get("utm_content")) || normalizeParam(searchParams.get("creative")) || undefined;
  const rawMedium = normalizeParam(searchParams.get("utm_medium"));
  const campaign = normalizeParam(searchParams.get("utm_campaign")) || undefined;
  const googleAdsKeyword = normalizeParam(searchParams.get("keyword")) || normalizeParam(searchParams.get("kw")) || undefined;
  const googleAdsMatchType = normalizeParam(searchParams.get("matchtype")) || undefined;
  const googleAdsNetwork = normalizeParam(searchParams.get("network")) || undefined;
  const googleAdsDevice = normalizeParam(searchParams.get("device")) || undefined;
  const googleAdsCampaignId = normalizeParam(searchParams.get("campaignid")) || undefined;
  const googleAdsAdGroupId = normalizeParam(searchParams.get("adgroupid")) || undefined;
  const googleAdsCreativeId = normalizeParam(searchParams.get("creative")) || undefined;
  const term = normalizeParam(searchParams.get("utm_term")) || googleAdsKeyword || undefined;
  const content = normalizeParam(searchParams.get("utm_content")) || undefined;
  const gclid = normalizeParam(searchParams.get("gclid")) || undefined;
  const referralInviterEmail =
    normalizeParam(searchParams.get("referrer_email")) ||
    normalizeParam(searchParams.get("inviter_email")) ||
    normalizeParam(searchParams.get("utm_inviter")) ||
    normalizeParam(searchParams.get("ref")) ||
    undefined;
  const referralSource = referralInviterEmail
    ? normalizeParam(searchParams.get("referral_source")) || rawSource || "email"
    : undefined;
  const referralCampaign = referralInviterEmail
    ? campaign || normalizeParam(searchParams.get("referral_campaign")) || "growth_gift_50_referral"
    : undefined;
  const source = rawSource || (gclid ? "google" : undefined);
  const medium = rawMedium || (gclid ? "cpc" : undefined);

  return compactAttribution({
    source,
    creative,
    medium,
    campaign,
    term,
    googleAdsKeyword,
    googleAdsMatchType,
    googleAdsNetwork,
    googleAdsDevice,
    googleAdsCampaignId,
    googleAdsAdGroupId,
    googleAdsCreativeId,
    content,
    gclid,
    referralSource,
    referralInviterEmail,
    referralCampaign
  });
}

export function getStoredAttribution(): SimpleAttribution {
  if (typeof window === "undefined") {
    return getDefaultAttribution();
  }

  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return getDefaultAttribution();
    const parsed = JSON.parse(raw) as Partial<SimpleAttribution>;
    const defaults = getDefaultAttribution();
    return repairCrossSourceFirstTouchAttribution(normalizeLegacyDefaultOrganicAttribution({
      source: normalizeOptional(parsed.source) || defaults.source,
      creative: normalizeOptional(parsed.creative) || defaults.creative,
      medium: normalizeOptional(parsed.medium) || defaults.medium,
      campaign: normalizeOptional(parsed.campaign) || defaults.campaign,
      term: normalizeOptional(parsed.term) || defaults.term,
      googleAdsKeyword: normalizeOptional(parsed.googleAdsKeyword) || defaults.googleAdsKeyword,
      googleAdsMatchType: normalizeOptional(parsed.googleAdsMatchType) || defaults.googleAdsMatchType,
      googleAdsNetwork: normalizeOptional(parsed.googleAdsNetwork) || defaults.googleAdsNetwork,
      googleAdsDevice: normalizeOptional(parsed.googleAdsDevice) || defaults.googleAdsDevice,
      googleAdsCampaignId: normalizeOptional(parsed.googleAdsCampaignId) || defaults.googleAdsCampaignId,
      googleAdsAdGroupId: normalizeOptional(parsed.googleAdsAdGroupId) || defaults.googleAdsAdGroupId,
      googleAdsCreativeId: normalizeOptional(parsed.googleAdsCreativeId) || defaults.googleAdsCreativeId,
      content: normalizeOptional(parsed.content) || defaults.content,
      gclid: normalizeOptional(parsed.gclid) || defaults.gclid,
      landingPath: normalizeOptional(parsed.landingPath) || defaults.landingPath,
      landingUrl: normalizeOptional(parsed.landingUrl) || defaults.landingUrl,
      referrer: normalizeOptional(parsed.referrer) || defaults.referrer,
      referralSource: normalizeOptional(parsed.referralSource) || defaults.referralSource,
      referralInviterEmail: normalizeOptional(parsed.referralInviterEmail) || defaults.referralInviterEmail,
      referralCampaign: normalizeOptional(parsed.referralCampaign) || defaults.referralCampaign,
      firstTouchSource: normalizeOptional(parsed.firstTouchSource) || defaults.firstTouchSource,
      firstTouchCreative: normalizeOptional(parsed.firstTouchCreative) || defaults.firstTouchCreative,
      firstTouchMedium: normalizeOptional(parsed.firstTouchMedium) || defaults.firstTouchMedium,
      firstTouchCampaign: normalizeOptional(parsed.firstTouchCampaign) || defaults.firstTouchCampaign,
      firstTouchTerm: normalizeOptional(parsed.firstTouchTerm) || defaults.firstTouchTerm,
      firstTouchGoogleAdsKeyword: normalizeOptional(parsed.firstTouchGoogleAdsKeyword) || defaults.firstTouchGoogleAdsKeyword,
      firstTouchGoogleAdsMatchType: normalizeOptional(parsed.firstTouchGoogleAdsMatchType) || defaults.firstTouchGoogleAdsMatchType,
      firstTouchGoogleAdsNetwork: normalizeOptional(parsed.firstTouchGoogleAdsNetwork) || defaults.firstTouchGoogleAdsNetwork,
      firstTouchGoogleAdsDevice: normalizeOptional(parsed.firstTouchGoogleAdsDevice) || defaults.firstTouchGoogleAdsDevice,
      firstTouchGoogleAdsCampaignId: normalizeOptional(parsed.firstTouchGoogleAdsCampaignId) || defaults.firstTouchGoogleAdsCampaignId,
      firstTouchGoogleAdsAdGroupId: normalizeOptional(parsed.firstTouchGoogleAdsAdGroupId) || defaults.firstTouchGoogleAdsAdGroupId,
      firstTouchGoogleAdsCreativeId: normalizeOptional(parsed.firstTouchGoogleAdsCreativeId) || defaults.firstTouchGoogleAdsCreativeId,
      firstTouchContent: normalizeOptional(parsed.firstTouchContent) || defaults.firstTouchContent,
      firstTouchGclid: normalizeOptional(parsed.firstTouchGclid) || defaults.firstTouchGclid,
      firstTouchLandingPath: normalizeOptional(parsed.firstTouchLandingPath) || defaults.firstTouchLandingPath,
      firstTouchLandingUrl: normalizeOptional(parsed.firstTouchLandingUrl) || defaults.firstTouchLandingUrl,
      firstTouchReferrer: normalizeOptional(parsed.firstTouchReferrer) || defaults.firstTouchReferrer,
      firstTouchReferralSource: normalizeOptional(parsed.firstTouchReferralSource) || defaults.firstTouchReferralSource,
      firstTouchReferralInviterEmail: normalizeOptional(parsed.firstTouchReferralInviterEmail) || defaults.firstTouchReferralInviterEmail,
      firstTouchReferralCampaign: normalizeOptional(parsed.firstTouchReferralCampaign) || defaults.firstTouchReferralCampaign
    }));
  } catch {
    return getDefaultAttribution();
  }
}

function isLegacyDefaultOrganicAttribution(attribution: SimpleAttribution): boolean {
  return attribution.source === LEGACY_DEFAULT_SOURCE
    && attribution.medium === LEGACY_DEFAULT_MEDIUM
    && attribution.firstTouchSource === LEGACY_DEFAULT_SOURCE
    && attribution.firstTouchMedium === LEGACY_DEFAULT_MEDIUM
    && isDirectLike(attribution.referrer)
    && isDirectLike(attribution.firstTouchReferrer)
    && attribution.campaign === "none"
    && attribution.term === "none"
    && attribution.content === "none"
    && attribution.gclid === "none"
    && attribution.referralSource === "none"
    && attribution.referralInviterEmail === "none"
    && attribution.referralCampaign === "none";
}

function normalizeLegacyDefaultOrganicAttribution(attribution: SimpleAttribution): SimpleAttribution {
  if (!isLegacyDefaultOrganicAttribution(attribution)) return attribution;
  return {
    ...attribution,
    source: DIRECT_SOURCE,
    medium: NO_MEDIUM,
    firstTouchSource: DIRECT_SOURCE,
    firstTouchMedium: NO_MEDIUM
  };
}

function isDefaultSource(value: string): boolean {
  return isDirectLike(value) || value === LEGACY_DEFAULT_SOURCE;
}

function isDefaultMedium(value: string): boolean {
  return value === NO_MEDIUM || value === LEGACY_DEFAULT_MEDIUM;
}

function shouldSetFirstTouchMedium(currentMedium: string, next: SimpleAttribution): boolean {
  if (!isDefaultMedium(currentMedium) || next.medium === NO_MEDIUM) return false;
  return next.medium !== LEGACY_DEFAULT_MEDIUM || !isDefaultSource(next.source);
}

function isDifferentAcquisitionSource(firstSource: string, currentSource: string): boolean {
  if (isDefaultSource(firstSource)) return false;
  const canonical = (source: string) => searchEngineSourceFromHost(source) ?? normalizeAttributionHost(source);
  return canonical(firstSource) !== canonical(currentSource);
}

function repairCrossSourceFirstTouchAttribution(attribution: SimpleAttribution): SimpleAttribution {
  if (!isDifferentAcquisitionSource(attribution.firstTouchSource, attribution.source)) return attribution;

  let firstTouchParams: URLSearchParams | null = null;
  try {
    firstTouchParams = new URL(attribution.firstTouchLandingUrl).searchParams;
  } catch {
    return attribution;
  }
  const referrerAttribution = readAttributionFromReferrer(
    attribution.firstTouchReferrer,
    attribution.firstTouchLandingUrl
  );
  const firstTouchSourceIsSupported = [
    firstTouchParams.get("utm_source"),
    referrerAttribution.source
  ].some(source => source && !isDifferentAcquisitionSource(attribution.firstTouchSource, source));
  if (!firstTouchSourceIsSupported) return attribution;

  const firstTouchCampaign = firstTouchParams.get("utm_campaign")?.trim() || "none";
  const firstTouchMedium = firstTouchParams.get("utm_medium")?.trim()
    || referrerAttribution.medium
    || "none";
  return {
    ...attribution,
    firstTouchCampaign: attribution.firstTouchCampaign === attribution.campaign
      ? firstTouchCampaign
      : attribution.firstTouchCampaign,
    firstTouchMedium: attribution.firstTouchMedium === attribution.medium
      ? firstTouchMedium
      : attribution.firstTouchMedium
  };
}

export function persistAttribution(partial: Partial<SimpleAttribution>): SimpleAttribution {
  const current = getStoredAttribution();
  const next = { ...current };
  const hasFreshSignal = Boolean(
    partial.source?.trim() ||
    partial.creative?.trim() ||
    partial.medium?.trim() ||
    partial.campaign?.trim() ||
    partial.term?.trim() ||
    partial.googleAdsKeyword?.trim() ||
    partial.googleAdsMatchType?.trim() ||
    partial.googleAdsNetwork?.trim() ||
    partial.googleAdsDevice?.trim() ||
    partial.googleAdsCampaignId?.trim() ||
    partial.googleAdsAdGroupId?.trim() ||
    partial.googleAdsCreativeId?.trim() ||
    partial.content?.trim() ||
    partial.gclid?.trim() ||
    partial.referralInviterEmail?.trim() ||
    partial.referralSource?.trim() ||
    partial.referralCampaign?.trim()
  );

  if (partial.source?.trim()) next.source = partial.source.trim();
  if (partial.creative?.trim()) next.creative = partial.creative.trim();
  if (partial.medium?.trim()) next.medium = partial.medium.trim();
  if (partial.campaign?.trim()) next.campaign = partial.campaign.trim();
  if (partial.term?.trim()) next.term = partial.term.trim();
  if (partial.googleAdsKeyword?.trim()) next.googleAdsKeyword = partial.googleAdsKeyword.trim();
  if (partial.googleAdsMatchType?.trim()) next.googleAdsMatchType = partial.googleAdsMatchType.trim();
  if (partial.googleAdsNetwork?.trim()) next.googleAdsNetwork = partial.googleAdsNetwork.trim();
  if (partial.googleAdsDevice?.trim()) next.googleAdsDevice = partial.googleAdsDevice.trim();
  if (partial.googleAdsCampaignId?.trim()) next.googleAdsCampaignId = partial.googleAdsCampaignId.trim();
  if (partial.googleAdsAdGroupId?.trim()) next.googleAdsAdGroupId = partial.googleAdsAdGroupId.trim();
  if (partial.googleAdsCreativeId?.trim()) next.googleAdsCreativeId = partial.googleAdsCreativeId.trim();
  if (partial.content?.trim()) next.content = partial.content.trim();
  if (partial.gclid?.trim()) next.gclid = partial.gclid.trim();
  if (partial.landingPath?.trim()) next.landingPath = partial.landingPath.trim();
  if (partial.landingUrl?.trim()) next.landingUrl = partial.landingUrl.trim();
  if (partial.referrer?.trim()) next.referrer = partial.referrer.trim();
  if (partial.referralSource?.trim()) next.referralSource = partial.referralSource.trim();
  if (partial.referralInviterEmail?.trim()) next.referralInviterEmail = partial.referralInviterEmail.trim().toLowerCase();
  if (partial.referralCampaign?.trim()) next.referralCampaign = partial.referralCampaign.trim();

  if (current.firstTouchLandingPath === "/" && next.landingPath !== "/") {
    next.firstTouchLandingPath = next.landingPath;
  }
  if (!current.firstTouchLandingUrl && next.landingUrl) {
    next.firstTouchLandingUrl = next.landingUrl;
  }
  if (isDirectLike(current.firstTouchReferrer) && !isDirectLike(next.referrer)) {
    next.firstTouchReferrer = next.referrer;
  }

  // First-touch fields belong to one acquisition. A later tagged referral may
  // update the current touch, but must not fill gaps in an earlier touch.
  if (hasFreshSignal && !isDifferentAcquisitionSource(current.firstTouchSource, next.source)) {
    if (isDefaultSource(current.firstTouchSource) && !isDefaultSource(next.source)) {
      next.firstTouchSource = next.source;
    }
    if (current.firstTouchCreative === "none" && next.creative !== "none") {
      next.firstTouchCreative = next.creative;
    }
    if (shouldSetFirstTouchMedium(current.firstTouchMedium, next)) {
      next.firstTouchMedium = next.medium;
    }
    if (current.firstTouchCampaign === "none" && next.campaign !== "none") {
      next.firstTouchCampaign = next.campaign;
    }
    if (current.firstTouchTerm === "none" && next.term !== "none") {
      next.firstTouchTerm = next.term;
    }
    if (current.firstTouchGoogleAdsKeyword === "none" && next.googleAdsKeyword !== "none") {
      next.firstTouchGoogleAdsKeyword = next.googleAdsKeyword;
    }
    if (current.firstTouchGoogleAdsMatchType === "none" && next.googleAdsMatchType !== "none") {
      next.firstTouchGoogleAdsMatchType = next.googleAdsMatchType;
    }
    if (current.firstTouchGoogleAdsNetwork === "none" && next.googleAdsNetwork !== "none") {
      next.firstTouchGoogleAdsNetwork = next.googleAdsNetwork;
    }
    if (current.firstTouchGoogleAdsDevice === "none" && next.googleAdsDevice !== "none") {
      next.firstTouchGoogleAdsDevice = next.googleAdsDevice;
    }
    if (current.firstTouchGoogleAdsCampaignId === "none" && next.googleAdsCampaignId !== "none") {
      next.firstTouchGoogleAdsCampaignId = next.googleAdsCampaignId;
    }
    if (current.firstTouchGoogleAdsAdGroupId === "none" && next.googleAdsAdGroupId !== "none") {
      next.firstTouchGoogleAdsAdGroupId = next.googleAdsAdGroupId;
    }
    if (current.firstTouchGoogleAdsCreativeId === "none" && next.googleAdsCreativeId !== "none") {
      next.firstTouchGoogleAdsCreativeId = next.googleAdsCreativeId;
    }
    if (current.firstTouchContent === "none" && next.content !== "none") {
      next.firstTouchContent = next.content;
    }
    if (current.firstTouchGclid === "none" && next.gclid !== "none") {
      next.firstTouchGclid = next.gclid;
    }
    if (current.firstTouchReferralSource === "none" && next.referralSource !== "none") {
      next.firstTouchReferralSource = next.referralSource;
    }
    if (current.firstTouchReferralInviterEmail === "none" && next.referralInviterEmail !== "none") {
      next.firstTouchReferralInviterEmail = next.referralInviterEmail;
    }
    if (current.firstTouchReferralCampaign === "none" && next.referralCampaign !== "none") {
      next.firstTouchReferralCampaign = next.referralCampaign;
    }
  }

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage failures in private mode or restricted contexts.
    }
  }

  return next;
}

export function registerAttribution(attribution: SimpleAttribution): void {
  if (isLocalAnalyticsDisabled()) return;
  getPosthog()?.register?.({
    source: attribution.source,
    creative: attribution.creative,
    utm_source: attribution.source,
    utm_medium: attribution.medium,
    utm_campaign: attribution.campaign,
    utm_term: attribution.term,
    google_ads_keyword: attribution.googleAdsKeyword,
    google_ads_match_type: attribution.googleAdsMatchType,
    google_ads_network: attribution.googleAdsNetwork,
    google_ads_device: attribution.googleAdsDevice,
    google_ads_campaign_id: attribution.googleAdsCampaignId,
    google_ads_ad_group_id: attribution.googleAdsAdGroupId,
    google_ads_creative_id: attribution.googleAdsCreativeId,
    utm_content: attribution.content,
    gclid: attribution.gclid,
    landing_path: attribution.landingPath,
    landing_url: attribution.landingUrl,
    referrer_url: attribution.referrer,
    referral_source: attribution.referralSource,
    referral_inviter_email: attribution.referralInviterEmail,
    referral_campaign: attribution.referralCampaign,
    first_touch_source: attribution.firstTouchSource,
    first_touch_creative: attribution.firstTouchCreative,
    first_touch_medium: attribution.firstTouchMedium,
    first_touch_campaign: attribution.firstTouchCampaign,
    first_touch_term: attribution.firstTouchTerm,
    first_touch_google_ads_keyword: attribution.firstTouchGoogleAdsKeyword,
    first_touch_google_ads_match_type: attribution.firstTouchGoogleAdsMatchType,
    first_touch_google_ads_network: attribution.firstTouchGoogleAdsNetwork,
    first_touch_google_ads_device: attribution.firstTouchGoogleAdsDevice,
    first_touch_google_ads_campaign_id: attribution.firstTouchGoogleAdsCampaignId,
    first_touch_google_ads_ad_group_id: attribution.firstTouchGoogleAdsAdGroupId,
    first_touch_google_ads_creative_id: attribution.firstTouchGoogleAdsCreativeId,
    first_touch_content: attribution.firstTouchContent,
    first_touch_gclid: attribution.firstTouchGclid,
    first_touch_landing_path: attribution.firstTouchLandingPath,
    first_touch_landing_url: attribution.firstTouchLandingUrl,
    first_touch_referrer_url: attribution.firstTouchReferrer,
    first_touch_referral_source: attribution.firstTouchReferralSource,
    first_touch_referral_inviter_email: attribution.firstTouchReferralInviterEmail,
    first_touch_referral_campaign: attribution.firstTouchReferralCampaign
  });
}

export function registerAnalyticsContext(properties: Record<string, unknown>): void {
  if (isLocalAnalyticsDisabled()) return;
  getPosthog()?.register?.(properties);
}

export function identifyAnalyticsUser(userId: string, properties?: Record<string, unknown>): void {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId || isLocalAnalyticsDisabled()) return;
  getPosthog()?.identify?.(normalizedUserId, properties);
}

function pickStringOrNumber(properties: Record<string, unknown>, ...keys: string[]): string | number | undefined {
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === "string" || typeof value === "number") return value;
  }
  return undefined;
}

function readPricingExperimentVariant(): string {
  if (typeof document === "undefined") return DEFAULT_PRICING_VARIANT;
  const prefix = `${PRICING_EXPERIMENT_COOKIE}=`;
  const raw = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length);
  return raw ? normalizePricingVariant(decodeURIComponent(raw)) : DEFAULT_PRICING_VARIANT;
}

function buildAxiomAnalyticsMirrorProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const statusCode = pickStringOrNumber(properties, "statusCode");
  const referralCampaign = pickStringOrNumber(properties, "referral_campaign");
  const referralSource = pickStringOrNumber(properties, "referral_source");
  const referralInviterEmail = pickStringOrNumber(properties, "referral_inviter_email");
  const axiomProperties: Record<string, unknown> = {
    action: pickStringOrNumber(properties, "action") ?? referralCampaign,
    stage: pickStringOrNumber(properties, "stage"),
    status: pickStringOrNumber(properties, "status"),
    sessionId: pickStringOrNumber(properties, "sessionId", "session_id", "appSessionId", "app_session_id"),
    traceId: pickStringOrNumber(properties, "traceId", "trace_id"),
    requestId: pickStringOrNumber(properties, "requestId", "request_id"),
    jobId: pickStringOrNumber(properties, "jobId", "job_id"),
    userId: pickStringOrNumber(properties, "userId", "user_id", "uid"),
    appSessionId: pickStringOrNumber(properties, "appSessionId", "app_session_id"),
    sourceUseCase: pickStringOrNumber(properties, "sourceUseCase", "source_use_case"),
    outputType: pickStringOrNumber(properties, "outputType", "output_type"),
    promptCase: pickStringOrNumber(properties, "promptCase", "prompt_case"),
    entry: pickStringOrNumber(properties, "entry") ?? referralSource,
    package_id: pickStringOrNumber(properties, "package_id"),
    pricing_variant: pickStringOrNumber(properties, "pricing_variant", "pricing_experiment_variant"),
    pricing_experiment_key: pickStringOrNumber(properties, "pricing_experiment_key"),
    modal_variant: pickStringOrNumber(properties, "modal_variant"),
    checkout_plan: pickStringOrNumber(properties, "checkout_plan"),
    checkout_scenario: pickStringOrNumber(properties, "checkout_scenario"),
    billing_surface: pickStringOrNumber(properties, "billing_surface"),
    reason: pickStringOrNumber(properties, "reason") ?? referralInviterEmail,
    route: pickStringOrNumber(properties, "route"),
    path: pickStringOrNumber(properties, "path"),
    errorName: pickStringOrNumber(properties, "errorName", "error_name"),
    errorMessage: pickStringOrNumber(properties, "errorMessage", "error_message"),
    errorStack: pickStringOrNumber(properties, "errorStack", "error_stack"),
    utm_source: pickStringOrNumber(properties, "utm_source"),
    utm_medium: pickStringOrNumber(properties, "utm_medium"),
    utm_campaign: pickStringOrNumber(properties, "utm_campaign"),
    ...(typeof statusCode === "number" ? { statusCode } : {})
  };

  return Object.fromEntries(Object.entries(axiomProperties).filter(([, value]) => value !== undefined));
}

export function buildAxiomAnalyticsMirrorPropertiesForTest(
  properties: Record<string, unknown>
): Record<string, unknown> {
  return buildAxiomAnalyticsMirrorProperties(properties);
}

export function captureAnalyticsEvent(event: string, properties?: Record<string, unknown>): void {
  if (isLocalAnalyticsDisabled()) return;
  const attribution = getStoredAttribution();
  const attributionProperties = {
    source: attribution.source,
    creative: attribution.creative,
    utm_source: attribution.source,
    utm_medium: attribution.medium,
    utm_campaign: attribution.campaign,
    utm_term: attribution.term,
    google_ads_keyword: attribution.googleAdsKeyword,
    google_ads_match_type: attribution.googleAdsMatchType,
    google_ads_network: attribution.googleAdsNetwork,
    google_ads_device: attribution.googleAdsDevice,
    google_ads_campaign_id: attribution.googleAdsCampaignId,
    google_ads_ad_group_id: attribution.googleAdsAdGroupId,
    google_ads_creative_id: attribution.googleAdsCreativeId,
    utm_content: attribution.content,
    gclid: attribution.gclid,
    landing_path: attribution.landingPath,
    landing_url: attribution.landingUrl,
    referrer_url: attribution.referrer,
    referral_source: attribution.referralSource,
    referral_inviter_email: attribution.referralInviterEmail,
    referral_campaign: attribution.referralCampaign,
    first_touch_source: attribution.firstTouchSource,
    first_touch_creative: attribution.firstTouchCreative,
    first_touch_medium: attribution.firstTouchMedium,
    first_touch_campaign: attribution.firstTouchCampaign,
    first_touch_term: attribution.firstTouchTerm,
    first_touch_google_ads_keyword: attribution.firstTouchGoogleAdsKeyword,
    first_touch_google_ads_match_type: attribution.firstTouchGoogleAdsMatchType,
    first_touch_google_ads_network: attribution.firstTouchGoogleAdsNetwork,
    first_touch_google_ads_device: attribution.firstTouchGoogleAdsDevice,
    first_touch_google_ads_campaign_id: attribution.firstTouchGoogleAdsCampaignId,
    first_touch_google_ads_ad_group_id: attribution.firstTouchGoogleAdsAdGroupId,
    first_touch_google_ads_creative_id: attribution.firstTouchGoogleAdsCreativeId,
    first_touch_content: attribution.firstTouchContent,
    first_touch_gclid: attribution.firstTouchGclid,
    first_touch_landing_path: attribution.firstTouchLandingPath,
    first_touch_landing_url: attribution.firstTouchLandingUrl,
    first_touch_referrer_url: attribution.firstTouchReferrer,
    first_touch_referral_source: attribution.firstTouchReferralSource,
    first_touch_referral_inviter_email: attribution.firstTouchReferralInviterEmail,
    first_touch_referral_campaign: attribution.firstTouchReferralCampaign
  };

  registerAttribution(attribution);
  const eventProperties: Record<string, unknown> = { ...attributionProperties, ...properties };
  const effectivePricingVariant = normalizeOptional(eventProperties.pricing_variant);
  delete eventProperties.pricing_variant;
  delete eventProperties.pricing_experiment_key;
  delete eventProperties.pricingExperimentVariant;
  delete eventProperties.pricingExperimentKey;
  delete eventProperties.generation_resolution_experiment_key;
  delete eventProperties.generation_resolution_experiment_variant;
  delete eventProperties.generationResolutionExperimentKey;
  delete eventProperties.generationResolutionExperimentVariant;
  eventProperties.pricing_experiment_variant = effectivePricingVariant || readPricingExperimentVariant();
  // Temporarily disabled; retain the field contract for a future re-enable.
  // eventProperties.ui_version = "2.0";
  // Preserve Beacon for page exits and redirects; use the SDK default for regular interactions.
  const isLeavingPage = (event === "page_active_time"
    && (eventProperties.trigger === "hidden" || eventProperties.trigger === "pagehide"))
    || event === "checkout_started_web"
    || (event === "signup_started"
      && (eventProperties.provider === "google" || eventProperties.provider === "apple"));
  getPosthog()?.capture?.(
    event,
    eventProperties,
    isLeavingPage ? { transport: "sendBeacon" } : undefined
  );
  // Keep Axiom's schema stable: mirror analytics events using existing
  // top-level telemetry fields only. PostHog keeps the full rich payload.
  trackClientEvent(`analytics.${event}`, buildAxiomAnalyticsMirrorProperties(eventProperties));
}
