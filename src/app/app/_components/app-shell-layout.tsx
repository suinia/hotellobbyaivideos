"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { captureAnalyticsEvent } from "@/lib/analytics/posthog";
import GoogleOneTap from "@/components/google-one-tap";
import {
  clearGuestClaimIntent,
  GUEST_CLAIM_INTENT_RECOVERY_SENTINEL,
  guestClaimKeepsCurrentWorkspace,
  reconcilePendingGuestClaimIdentity,
  resolveGuestClaimOutcome,
  type GuestClaimOutcome
} from "@/lib/auth/guest-claim";
import {
  buildGuestUserRequestHeaders,
  getStoredGuestUserId,
  resolveGuestAccountResponseIdentity,
  subscribeCanonicalGuestUserRequestIdentity,
  syncCanonicalGuestUserRequestIdentity,
  trackClientEvent,
  withCanonicalGuestIdentityLock
} from "@/lib/telemetry/client";
import { resolveAppCtaMockScene } from "@/lib/app/cta-mock-scenes";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useAppAccountStore } from "./app-account-store";
import { AppShell } from "./app-shell";
import { resolveAppCreateHref } from "@/lib/app/create-navigation";
import {
  appAccountSummary,
  findAppToolByPathname,
  type AppAccountPlan,
  type AppAccountSummary,
  type AppNavId
} from "./app-data";
import { resetAppAssetsStore } from "./app-assets-store";
import { resetAppRecentsStore } from "./app-recents-store";

const LAST_CREATE_HREF_STORAGE_KEY = "vismuse.app.lastCreateHref";
const LAST_CREATE_HREF_UPDATE_EVENT = "vismuse:app-last-create-href";
const LAST_CREATE_TOOL_COOKIE = "vismuse_last_create_tool";
const DEFAULT_APP_CREATE_HREF = "/";
const APP_PENDING_GUEST_CLAIM_KEY = "vismuse.app.pendingGuestClaim";
const APP_PENDING_AUTH_ANALYTICS_KEY = "vismuse.app.pendingAuthAnalytics";
const THREAD_PENDING_SIGNUP_IMAGE_UNLOCK_KEY = "vismuse:socialmedia-pending-signup-image-unlock";
const APP_GUEST_CLAIM_CHECKOUT_READY_KEY = "vismuse.app.guestClaimCheckoutReady";
const APP_GUEST_CLAIM_STARTED_EVENT = "vismuse:app-guest-claim-started";
const APP_GUEST_CLAIM_COMPLETED_EVENT = "vismuse:app-guest-claim-completed";
const APP_GUEST_CLAIM_ENDED_EVENT = "vismuse:app-guest-claim-ended";
const APP_TOAST_EVENT = "vismuse:app-toast";
const APP_ANALYTICS_WORKFLOW = "app_chat";
const ACCOUNT_CACHE_TTL_MS = 60 * 1000;

type AccountApiUser = {
  id?: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
  plan?: AppAccountPlan;
  credit_balance?: number;
  credit_breakdown_available?: boolean;
  paid_credit_balance?: number;
  free_credit_balance?: number;
  paid_credit_total?: number;
  free_credit_total?: number;
  paid_expiring_credit_balance?: number;
  free_expiring_credit_balance?: number;
  paid_expiring_credit_total?: number;
  free_expiring_credit_total?: number;
  paid_pack_expiring_credit_balance?: number;
  paid_pack_expiring_credit_total?: number;
  paid_permanent_credit_balance?: number;
  free_permanent_credit_balance?: number;
  paid_credit_expires_at?: string | null;
  paid_pack_credit_expires_at?: string | null;
  free_credit_expires_at?: string | null;
  starter_access?: boolean;
  pricing_variant?: string;
  billing_market?: "default" | "gb" | "ca";
  billing_currency?: "USD" | "GBP" | "CAD";
  billing_provider?: "creem" | "stripe" | "waffo" | null;
  subscription_package_id?: string;
  subscription?: {
    status?: string;
    started_at?: string | null;
    current_period_start_at?: string | null;
    current_period_end_at?: string | null;
    cancel_at_period_end?: boolean;
    canceled_at?: string | null;
  };
  auth_mode?: "supabase" | "guest" | "guest_claimed";
  claimed_email?: string;
  claimed_providers?: string[];
};

type AccountApiResponse = {
  enabled?: boolean;
  authenticated?: boolean;
  billing_market?: "default" | "gb" | "ca";
  billing_currency?: "USD" | "GBP" | "CAD";
  user?: AccountApiUser;
};

type GuestClaimResult = {
  ok: boolean;
  status?: number;
  error?: string;
  outcome?: GuestClaimOutcome;
  guestId?: string;
  balanceSynced?: boolean;
  migratedRows?: Record<string, number>;
  claimedEmail?: string;
  claimedProviders?: string[];
  secondarySyncPending?: boolean;
};

type AnnualCreditRefreshResponse = {
  ok?: boolean;
  issued?: boolean;
};

type PendingAppGuestClaim = {
  guestId: string;
  createdAt: string;
  requireCookieMatch?: boolean;
};

type PendingAppAuthAnalytics = {
  provider?: "google" | "apple" | "email";
  promptCase?: string;
  guestId?: string;
  claimGuest?: boolean;
  nextPath?: string;
  sessionId?: string;
  jobId?: string;
  landingUrl?: string;
  gclid?: string;
  createdAt?: string;
};

let sharedAccountFetchRequest: { request: Promise<AccountApiResponse | null>; force: boolean } | null = null;
let sharedAccountCache: { value: AccountApiResponse | null; expiresAt: number } | null = null;
let sharedAccountFetchVersion = 0;
let sharedGuestClaimRequest: Promise<GuestClaimResult> | null = null;
const annualCreditRefreshRequests = new Map<string, Promise<boolean>>();

function refreshAnnualSubscriptionCreditsAfterLogin(userId: string): Promise<boolean> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) return Promise.resolve(false);

  const existing = annualCreditRefreshRequests.get(normalizedUserId);
  if (existing) return existing;

  const request = fetch("/api/v1/account/annual-credit-refresh", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      ...buildGuestUserRequestHeaders(),
      accept: "application/json"
    }
  })
    .then(async (response) => {
      if (!response.ok) return false;
      const result = await response.json() as AnnualCreditRefreshResponse;
      return result.ok === true && result.issued === true;
    })
    .catch(() => false)
    .finally(() => {
      if (annualCreditRefreshRequests.get(normalizedUserId) === request) {
        annualCreditRefreshRequests.delete(normalizedUserId);
      }
    });
  annualCreditRefreshRequests.set(normalizedUserId, request);
  return request;
}

function fetchAccountSnapshot(options: { force?: boolean } = {}): Promise<AccountApiResponse | null> {
  const force = Boolean(options.force);
  if (!force && sharedAccountCache && sharedAccountCache.expiresAt > Date.now()) {
    return Promise.resolve(sharedAccountCache.value);
  }
  if (sharedAccountFetchRequest && (!force || sharedAccountFetchRequest.force)) {
    return sharedAccountFetchRequest.request;
  }

  const accountUrl = force
    ? "/api/v1/account?context=socialmedia&sync=1"
    : "/api/v1/account?context=socialmedia";
  const requestVersion = ++sharedAccountFetchVersion;
  const request = fetch(accountUrl, {
    cache: "no-store",
    headers: buildGuestUserRequestHeaders()
  })
    .then(async (response) => {
      if (!response.ok) return null;
      const data = (await response.json()) as AccountApiResponse;
      if (requestVersion !== sharedAccountFetchVersion) return null;
      sharedAccountCache = {
        value: data,
        expiresAt: Date.now() + ACCOUNT_CACHE_TTL_MS
      };
      return data;
    })
    .catch(() => null)
    .finally(() => {
      if (sharedAccountFetchRequest?.request === request) {
        sharedAccountFetchRequest = null;
      }
    });
  sharedAccountFetchRequest = { request, force };
  return request;
}

function getGuestClaimFailureMessage(result: GuestClaimResult): string {
  if (result.error?.includes("GUEST_CLAIM_REQUIRES_NEW_ACCOUNT")) {
    return "This guest chat can only be moved to a new account. Opening a fresh workspace for this account.";
  }
  if (result.error?.includes("GUEST_ACCOUNT_ALREADY_CLAIMED")) {
    return "This guest workspace was already linked to another account.";
  }
  return "We could not move this guest chat to the signed-in account.";
}

function isExistingAccountGuestClaimSkip(error?: string): boolean {
  return Boolean(error?.includes("GUEST_CLAIM_REQUIRES_NEW_ACCOUNT"));
}

function isGuestClaimCheckoutBlocked(error?: string): boolean {
  return Boolean(
    error?.includes("GUEST_CLAIM_REQUIRES_NEW_ACCOUNT")
    || error?.includes("GUEST_ACCOUNT_ALREADY_CLAIMED")
  );
}

const GUEST_CLAIM_RETRY_DELAYS_MS = [250, 750, 1500];
const GUEST_SECONDARY_SYNC_RETRY_DELAYS_MS = [750, 1500];

function isRetryableGuestClaimFailure(result: GuestClaimResult): boolean {
  return result.error === "NETWORK_ERROR"
    || result.status === 429
    || (typeof result.status === "number" && result.status >= 500);
}

function readPendingAppGuestClaim(): PendingAppGuestClaim | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(APP_PENDING_GUEST_CLAIM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingAppGuestClaim>;
    const guestId = parsed.guestId?.trim();
    if (!guestId) return null;
    const createdMs = Date.parse(parsed.createdAt ?? "");
    if (Number.isFinite(createdMs) && Date.now() - createdMs > 30 * 60 * 1000) {
      window.sessionStorage.removeItem(APP_PENDING_GUEST_CLAIM_KEY);
      return null;
    }
    return {
      guestId,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
      requireCookieMatch: parsed.requireCookieMatch === true
    };
  } catch {
    return null;
  }
}

function clearPendingAppGuestClaim(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(APP_PENDING_GUEST_CLAIM_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function readPendingAppAuthAnalytics(): PendingAppAuthAnalytics | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(APP_PENDING_AUTH_ANALYTICS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingAppAuthAnalytics>;
    const createdMs = Date.parse(parsed.createdAt ?? "");
    if (Number.isFinite(createdMs) && Date.now() - createdMs > 30 * 60 * 1000) {
      window.sessionStorage.removeItem(APP_PENDING_AUTH_ANALYTICS_KEY);
      return null;
    }
    return {
      provider: parsed.provider === "google" || parsed.provider === "apple" || parsed.provider === "email" ? parsed.provider : undefined,
      promptCase: typeof parsed.promptCase === "string" ? parsed.promptCase : undefined,
      guestId: parsed.guestId?.trim() || undefined,
      claimGuest: parsed.claimGuest === true,
      nextPath: typeof parsed.nextPath === "string" ? parsed.nextPath : undefined,
      sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : undefined,
      jobId: typeof parsed.jobId === "string" ? parsed.jobId : undefined,
      landingUrl: typeof parsed.landingUrl === "string" ? parsed.landingUrl : undefined,
      gclid: typeof parsed.gclid === "string" ? parsed.gclid : undefined,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : undefined
    };
  } catch {
    return null;
  }
}

function clearPendingAppAuthAnalytics(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(APP_PENDING_AUTH_ANALYTICS_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function reconcilePendingAppGuestIdentity(canonicalGuestId: string): void {
  if (typeof window === "undefined") return;
  try {
    const pendingClaim = readPendingAppGuestClaim();
    if (pendingClaim) {
      window.sessionStorage.setItem(
        APP_PENDING_GUEST_CLAIM_KEY,
        JSON.stringify(reconcilePendingGuestClaimIdentity(pendingClaim, canonicalGuestId))
      );
    }
    const pendingThreadSignupRaw = window.sessionStorage.getItem(THREAD_PENDING_SIGNUP_IMAGE_UNLOCK_KEY);
    if (pendingThreadSignupRaw) {
      const pendingThreadSignup = JSON.parse(pendingThreadSignupRaw) as { guestId?: string; [key: string]: unknown };
      window.sessionStorage.setItem(
        THREAD_PENDING_SIGNUP_IMAGE_UNLOCK_KEY,
        JSON.stringify(reconcilePendingGuestClaimIdentity(pendingThreadSignup, canonicalGuestId))
      );
    }
    const pendingAuth = readPendingAppAuthAnalytics();
    if (pendingAuth?.guestId && pendingAuth.guestId !== canonicalGuestId) {
      window.sessionStorage.setItem(APP_PENDING_AUTH_ANALYTICS_KEY, JSON.stringify({
        ...pendingAuth,
        guestId: canonicalGuestId
      }));
    }
  } catch {
    // Account refresh still aligns future guest requests if session storage is unavailable.
  }
}

function rememberGuestClaimCheckoutReady(guestId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(APP_GUEST_CLAIM_CHECKOUT_READY_KEY, JSON.stringify({
      guestId,
      createdAt: new Date().toISOString()
    }));
  } catch {
    // The event path can still continue checkout in this tab.
  }
}

function clearGuestClaimCheckoutReady(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(APP_GUEST_CLAIM_CHECKOUT_READY_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function claimCurrentGuestWorkspace(
  guestId?: string,
  options?: { requireCookieMatch?: boolean; requireClaimIntent?: boolean }
): Promise<GuestClaimResult> {
  if (sharedGuestClaimRequest) return sharedGuestClaimRequest;
  const requestGuestId = guestId?.trim()
    || (options?.requireClaimIntent ? GUEST_CLAIM_INTENT_RECOVERY_SENTINEL : undefined);

  const request = fetch("/api/v1/account/claim-guest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(requestGuestId ? { guest_id: requestGuestId } : {}),
      ...(options?.requireCookieMatch ? { require_cookie_match: true } : {}),
      ...(options?.requireClaimIntent ? { require_claim_intent: true } : {}),
      client_capabilities: ["guest_claim_outcomes_v1"]
    })
  })
    .then(async (response) => {
      const data = await response.json().catch(() => ({})) as {
        error?: string;
        outcome?: string;
        guest_id?: string;
        balance_synced?: boolean;
        migrated_rows?: Record<string, number>;
        claimed_email?: string;
        claimed_providers?: string[];
        secondary_sync_pending?: boolean;
      };
      const ok = response.ok;
      const resolvedGuestId = typeof data.guest_id === "string" ? data.guest_id : guestId;
      const outcome = resolveGuestClaimOutcome({ ok, outcome: data.outcome, error: data.error });
      if (guestClaimKeepsCurrentWorkspace(outcome)) {
        if (resolvedGuestId) rememberGuestClaimCheckoutReady(resolvedGuestId);
      } else {
        clearGuestClaimCheckoutReady();
      }
      return {
        ok,
        status: response.status,
        error: typeof data.error === "string" ? data.error : undefined,
        outcome,
        guestId: resolvedGuestId,
        balanceSynced: data.balance_synced,
        migratedRows: data.migrated_rows,
        claimedEmail: typeof data.claimed_email === "string" ? data.claimed_email : undefined,
        claimedProviders: Array.isArray(data.claimed_providers)
          ? data.claimed_providers.filter((provider): provider is string => typeof provider === "string")
          : undefined,
        secondarySyncPending: data.secondary_sync_pending === true
      };
    })
    .catch(() => {
      clearGuestClaimCheckoutReady();
      return {
        ok: false,
        error: "NETWORK_ERROR",
        guestId
      };
    })
    .finally(() => {
      if (sharedGuestClaimRequest === request) {
        sharedGuestClaimRequest = null;
      }
    });
  sharedGuestClaimRequest = request;
  return request;
}

function retryPendingGuestSecondarySync(guestId: string): void {
  void (async () => {
    for (const delayMs of GUEST_SECONDARY_SYNC_RETRY_DELAYS_MS) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      const retry = await claimCurrentGuestWorkspace(guestId);
      if (!guestClaimKeepsCurrentWorkspace(retry.outcome)) return;
      if (!retry.secondarySyncPending) {
        window.dispatchEvent(new Event("vismuse:account-updated"));
        return;
      }
    }
  })();
}

function getActiveAppNav(pathname: string): AppNavId {
  if (pathname === "/app" || pathname === "/app/create" || pathname.startsWith("/app/chat/")) return "create";
  if (pathname === "/app/recents") return "recents";
  if (pathname === "/app/assets") return "assets";
  if (pathname === "/app/explore") return "explore";
  if (pathname.startsWith("/app/")) return "create";
  if (getToolSlugFromPathname(pathname)) return "create";
  return "agent";
}

function getToolSlugFromPathname(pathname: string): string | null {
  return findAppToolByPathname(pathname)?.slug ?? null;
}


function shouldPreferPublicToolRoutes(pathname: string): boolean {
  void pathname;
  return true;
}

function rememberLastCreateTool(href: string): void {
  const toolSlug = getToolSlugFromPathname(href);
  if (!toolSlug) return;

  const secureAttribute = window.location.protocol === "https:" ? "Secure" : "";
  document.cookie = [
    `${LAST_CREATE_TOOL_COOKIE}=${encodeURIComponent(toolSlug)}`,
    "Path=/",
    "Max-Age=31536000",
    "SameSite=Lax",
    secureAttribute
  ].filter(Boolean).join("; ");
}

function getAccountInitial(user?: AccountApiUser): string {
  const source = user?.display_name?.trim() || user?.email?.trim() || (user?.auth_mode === "guest" ? "Guest" : "Vismuse");
  return source.charAt(0).toUpperCase() || "G";
}

function toAppAccountSummary(data: AccountApiResponse): AppAccountSummary {
  const user = data.user;
  const authMode = user?.auth_mode;
  const isLoggedIn = Boolean(data.authenticated && authMode === "supabase");

  if (!user) {
    return appAccountSummary;
  }

  return {
    id: user.id?.trim() || "",
    isLoggedIn,
    plan: user.plan === "basic" || user.plan === "pro" || user.plan === "max" ? user.plan : "free",
    credits: typeof user.credit_balance === "number" ? user.credit_balance : 0,
    creditBreakdownAvailable: user.credit_breakdown_available !== false,
    paidCredits: typeof user.paid_credit_balance === "number" ? user.paid_credit_balance : 0,
    freeCredits: typeof user.free_credit_balance === "number" ? user.free_credit_balance : undefined,
    paidCreditTotal: typeof user.paid_credit_total === "number" ? user.paid_credit_total : undefined,
    freeCreditTotal: typeof user.free_credit_total === "number" ? user.free_credit_total : undefined,
    paidExpiringCredits: typeof user.paid_expiring_credit_balance === "number" ? user.paid_expiring_credit_balance : undefined,
    freeExpiringCredits: typeof user.free_expiring_credit_balance === "number" ? user.free_expiring_credit_balance : undefined,
    paidExpiringCreditTotal: typeof user.paid_expiring_credit_total === "number" ? user.paid_expiring_credit_total : undefined,
    freeExpiringCreditTotal: typeof user.free_expiring_credit_total === "number" ? user.free_expiring_credit_total : undefined,
    paidPackExpiringCredits: typeof user.paid_pack_expiring_credit_balance === "number" ? user.paid_pack_expiring_credit_balance : undefined,
    paidPackExpiringCreditTotal: typeof user.paid_pack_expiring_credit_total === "number" ? user.paid_pack_expiring_credit_total : undefined,
    paidPermanentCredits: typeof user.paid_permanent_credit_balance === "number" ? user.paid_permanent_credit_balance : undefined,
    freePermanentCredits: typeof user.free_permanent_credit_balance === "number" ? user.free_permanent_credit_balance : undefined,
    paidCreditExpiresAt: user.paid_credit_expires_at?.trim() || undefined,
    paidPackCreditExpiresAt: user.paid_pack_credit_expires_at?.trim() || undefined,
    freeCreditExpiresAt: user.free_credit_expires_at?.trim() || undefined,
    starterAccess: user.starter_access === true,
    pricingVariant: user.pricing_variant?.trim() || undefined,
    billingMarket: user.billing_market === "gb" || data.billing_market === "gb"
      ? "gb"
      : user.billing_market === "ca" || data.billing_market === "ca" ? "ca" : "default",
    billingCurrency: user.billing_currency === "GBP" || data.billing_currency === "GBP"
      ? "GBP"
      : user.billing_currency === "CAD" || data.billing_currency === "CAD" ? "CAD" : "USD",
    billingProvider: user.billing_provider === "creem" || user.billing_provider === "stripe" || user.billing_provider === "waffo"
      ? user.billing_provider
      : undefined,
    subscriptionPackageId: user.subscription_package_id?.trim() || undefined,
    subscriptionStatus: user.subscription?.status?.trim() || "none",
    subscriptionStartedAt: user.subscription?.started_at?.trim() || undefined,
    currentPeriodStartAt: user.subscription?.current_period_start_at?.trim() || undefined,
    currentPeriodEndAt: user.subscription?.current_period_end_at?.trim() || undefined,
    cancelAtPeriodEnd: user.subscription?.cancel_at_period_end === true,
    canceledAt: user.subscription?.canceled_at?.trim() || undefined,
    initial: getAccountInitial(user),
    displayName: user.display_name?.trim() || (isLoggedIn ? user.email?.split("@")[0] || "Creator" : "Guest"),
    email: user.email?.trim() || "",
    avatarUrl: user.avatar_url?.trim() || "",
    authMode,
    claimedEmail: user.claimed_email?.trim() || undefined,
    claimedProviders: user.claimed_providers
  };
}

function readMockAppAccountSummary(searchParams: { get: (key: string) => string | null }): AppAccountSummary | null {
  const scene = resolveAppCtaMockScene(searchParams.get("scene") ?? searchParams.get("sence"));
  const requestedMode = searchParams.get("mock_account") ?? searchParams.get("auth") ?? scene?.accountMode ?? "";
  const mode = requestedMode.trim().toLowerCase();
  if (mode !== "guest" && mode !== "free" && mode !== "basic" && mode !== "pro" && mode !== "max") return null;

  const requestedCredits = Number(searchParams.get("credits") ?? scene?.credits ?? 50);
  const credits = Number.isFinite(requestedCredits) ? Math.max(0, Math.floor(requestedCredits)) : 50;

  if (mode === "guest") {
    return {
      ...appAccountSummary,
      id: "guest:mock-cta",
      isLoggedIn: false,
      plan: "free",
      credits,
      initial: "G",
      displayName: "Guest Mock",
      authMode: "guest"
    };
  }

  const mockPlan = mode === "basic" || mode === "pro" || mode === "max" ? mode : "free";
  const requestedPaidCredits = searchParams.get("paid_credits");
  const requestedFreeCredits = searchParams.get("free_credits");
  const hasCreditSplit = requestedPaidCredits !== null || requestedFreeCredits !== null;
  const paidCredits = hasCreditSplit
    ? Math.max(0, Math.floor(Number(requestedPaidCredits) || 0))
    : mockPlan === "free" ? 0 : credits;
  const freeCredits = hasCreditSplit
    ? Math.max(0, Math.floor(Number(requestedFreeCredits) || 0))
    : mockPlan === "free" ? credits : 0;
  const requestedPaidCreditTotal = searchParams.get("paid_total");
  const requestedFreeCreditTotal = searchParams.get("free_total");
  const paidCreditTotal = Math.max(
    paidCredits,
    Math.floor(Number(requestedPaidCreditTotal ?? paidCredits) || 0)
  );
  const freeCreditTotal = Math.max(
    freeCredits,
    Math.floor(Number(requestedFreeCreditTotal ?? freeCredits) || 0)
  );
  const mockPeriodStart = searchParams.get("period_start") ?? "2026-08-01T00:00:00.000Z";
  const mockPeriodEnd = searchParams.get("period_end") ?? "2026-09-01T00:00:00.000Z";
  const defaultPaidExpiringCredits = mockPlan === "free" ? 0 : paidCredits;
  const paidExpiringCredits = Math.min(
    paidCredits,
    Math.max(0, Math.floor(Number(searchParams.get("paid_period_credits") ?? defaultPaidExpiringCredits) || 0))
  );
  const paidExpiringCreditTotal = Math.max(
    paidExpiringCredits,
    Math.floor(Number(searchParams.get("paid_period_total") ?? (paidExpiringCredits > 0 ? paidCreditTotal : 0)) || 0)
  );
  const paidPackExpiringCredits = Math.min(
    Math.max(0, paidCredits - paidExpiringCredits),
    Math.max(0, Math.floor(Number(searchParams.get("paid_pack_credits") ?? 0) || 0))
  );
  const paidPackExpiringCreditTotal = Math.max(
    paidPackExpiringCredits,
    Math.floor(Number(searchParams.get("paid_pack_total") ?? paidPackExpiringCredits) || 0)
  );
  const paidPermanentCredits = Math.max(
    0,
    Math.floor(Number(
      searchParams.get("paid_permanent_credits")
      ?? (paidCredits - paidExpiringCredits - paidPackExpiringCredits)
    ) || 0)
  );
  const freeExpiringCredits = Math.min(
    freeCredits,
    Math.max(0, Math.floor(Number(searchParams.get("free_period_credits") ?? 0) || 0))
  );
  const freeExpiringCreditTotal = Math.max(
    freeExpiringCredits,
    Math.floor(Number(searchParams.get("free_period_total") ?? (freeExpiringCredits > 0 ? freeCreditTotal : 0)) || 0)
  );
  const freePermanentCredits = Math.max(
    0,
    Math.floor(Number(searchParams.get("free_permanent_credits") ?? (freeCredits - freeExpiringCredits)) || 0)
  );
  const mockBillingMarket = searchParams.get("billing_market") === "gb"
    ? "gb"
    : searchParams.get("billing_market") === "ca" ? "ca" : "default";

  return {
    ...appAccountSummary,
    id: `mock-${mockPlan}-user`,
    isLoggedIn: true,
    plan: mockPlan,
    credits: hasCreditSplit ? paidCredits + freeCredits : credits,
    paidCredits,
    freeCredits,
    paidCreditTotal,
    freeCreditTotal,
    paidExpiringCredits,
    freeExpiringCredits,
    paidExpiringCreditTotal,
    freeExpiringCreditTotal,
    paidPackExpiringCredits,
    paidPackExpiringCreditTotal,
    paidPermanentCredits,
    freePermanentCredits,
    paidCreditExpiresAt: paidExpiringCreditTotal > 0
      ? searchParams.get("paid_expires_at") ?? mockPeriodEnd
      : undefined,
    paidPackCreditExpiresAt: paidPackExpiringCredits > 0
      ? searchParams.get("paid_pack_expires_at") ?? "2027-08-23T00:00:00.000Z"
      : undefined,
    freeCreditExpiresAt: freeExpiringCreditTotal > 0
      ? searchParams.get("free_expires_at") ?? mockPeriodEnd
      : undefined,
    initial: mockPlan.charAt(0).toUpperCase(),
    displayName: `${mockPlan.charAt(0).toUpperCase()}${mockPlan.slice(1)} Mock`,
    email: `${mockPlan}.mock@vismuse.test`,
    authMode: "supabase",
    billingProvider: searchParams.get("billing_provider") === "stripe"
      ? "stripe"
      : searchParams.get("billing_provider") === "waffo"
        ? "waffo"
        : "creem",
    billingMarket: mockBillingMarket,
    billingCurrency: mockBillingMarket === "gb" ? "GBP" : mockBillingMarket === "ca" ? "CAD" : "USD",
    pricingVariant: searchParams.get("pricing_variant")?.trim() || undefined,
    subscriptionStatus: mockPlan === "free" ? "none" : "active",
    currentPeriodStartAt: mockPlan === "free" ? undefined : mockPeriodStart,
    currentPeriodEndAt: mockPlan === "free" ? undefined : mockPeriodEnd,
    cancelAtPeriodEnd: searchParams.get("cancel_at_period_end") === "1"
  };
}

async function loadWorkspaceOneTapAccount() {
  const { account } = useAppAccountStore.getState();
  return {
    authenticated: account.isLoggedIn,
    user: { auth_mode: account.authMode }
  };
}

export function AppShellLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mockAccount = useMemo(() => readMockAppAccountSummary(searchParams), [searchParams]);
  const isChatRoute = pathname.startsWith("/app/chat/");
  const preferPublicToolRoutes = shouldPreferPublicToolRoutes(pathname);
  const [createHref, setCreateHref] = useState(DEFAULT_APP_CREATE_HREF);
  const account = useAppAccountStore((state) => state.account);
  const accountReady = useAppAccountStore((state) => state.isReady);
  const setAccount = useAppAccountStore((state) => state.setAccount);
  const markAccountReady = useAppAccountStore((state) => state.markAccountReady);
  const resetAccount = useAppAccountStore((state) => state.resetAccount);
  const reportedSignupUserRef = useRef("");
  const reportedGuestClaimRef = useRef("");
  const initialSessionRefreshUserIdRef = useRef<string | null>(null);
  const claimedGuestAuthPromptKeyRef = useRef("");

  useEffect(() => {
    const applyCreateHref = (href: string | null | undefined, options?: { persist?: boolean }) => {
      const normalizedHref = href ? resolveAppCreateHref(href, preferPublicToolRoutes) : null;
      if (!normalizedHref) return false;
      setCreateHref(normalizedHref);
      if (options?.persist) {
        window.localStorage.setItem(LAST_CREATE_HREF_STORAGE_KEY, normalizedHref);
        rememberLastCreateTool(normalizedHref);
      }
      return true;
    };

    const currentCreateHref = resolveAppCreateHref(pathname, preferPublicToolRoutes);
    if (applyCreateHref(currentCreateHref, { persist: true })) {
      return undefined;
    }

    const storedCreateHref = window.localStorage.getItem(LAST_CREATE_HREF_STORAGE_KEY);
    applyCreateHref(storedCreateHref);

    const handleCreateHrefUpdate = (event: Event) => {
      const href = event instanceof CustomEvent && typeof event.detail?.href === "string"
        ? event.detail.href
        : "";
      applyCreateHref(href, { persist: true });
    };
    window.addEventListener(LAST_CREATE_HREF_UPDATE_EVENT, handleCreateHrefUpdate);
    return () => {
      window.removeEventListener(LAST_CREATE_HREF_UPDATE_EVENT, handleCreateHrefUpdate);
    };
  }, [pathname, preferPublicToolRoutes]);

  const refreshAccount = useCallback((options: { force?: boolean } = {}): Promise<void> => {
    return withCanonicalGuestIdentityLock(async () => {
      if (mockAccount) {
        syncCanonicalGuestUserRequestIdentity(mockAccount);
        setAccount(mockAccount);
        return;
      }
      try {
        let data = await fetchAccountSnapshot({ force: options.force });
        if (!data) return;
        let nextAccount = toAppAccountSummary(data);
        const establishedGuestId = getStoredGuestUserId();
        const canonicalGuestId = nextAccount.authMode === "guest"
          ? resolveGuestAccountResponseIdentity({
              responseGuestUserId: nextAccount.id,
              establishedGuestUserId: establishedGuestId
            })
          : undefined;
        if (canonicalGuestId && canonicalGuestId !== nextAccount.id) {
          // Another tab established the browser's guest while this request was
          // in flight. Retry with that canonical header so the server also
          // repairs the shared cookie before this tab becomes ready.
          data = await fetchAccountSnapshot({ force: true });
          if (!data) return;
          nextAccount = toAppAccountSummary(data);
          if (nextAccount.authMode === "guest" && nextAccount.id !== canonicalGuestId) {
            nextAccount = { ...nextAccount, id: canonicalGuestId };
          }
        }
        // Publish the account API's guest id before setAccount marks the
        // account ready. Composer/session requests can then never bootstrap a
        // second guest while the response cookie is still being applied.
        const previousAccount = useAppAccountStore.getState().account;
        syncCanonicalGuestUserRequestIdentity(nextAccount);
        setAccount(nextAccount);
        const justSignedIn = nextAccount.authMode === "supabase"
          && Boolean(nextAccount.id)
          && (previousAccount.authMode !== "supabase" || previousAccount.id !== nextAccount.id);
        if (justSignedIn) {
          void refreshAnnualSubscriptionCreditsAfterLogin(nextAccount.id).then(async (issued) => {
            if (!issued) return;
            const currentAccount = useAppAccountStore.getState().account;
            if (currentAccount.authMode !== "supabase" || currentAccount.id !== nextAccount.id) return;

            const refreshedData = await fetchAccountSnapshot({ force: true });
            if (!refreshedData) return;
            const refreshedAccount = toAppAccountSummary(refreshedData);
            if (refreshedAccount.authMode === "supabase" && refreshedAccount.id === nextAccount.id) {
              setAccount(refreshedAccount);
            }
          });
        }
      } catch {
        // Keep the current or cached account visible when the refresh fails.
      } finally {
        markAccountReady();
      }
    });
  }, [markAccountReady, mockAccount, setAccount]);

  useEffect(() => {
    if (mockAccount) return;
    return subscribeCanonicalGuestUserRequestIdentity((canonicalGuestId) => {
      const currentAccount = useAppAccountStore.getState().account;
      if (
        canonicalGuestId
        && currentAccount.authMode === "guest"
        && currentAccount.id === canonicalGuestId
      ) {
        return;
      }
      if (canonicalGuestId && currentAccount.authMode === "guest") {
        reconcilePendingAppGuestIdentity(canonicalGuestId);
      }
      // Close the composer/session request barrier immediately; refresh then
      // aligns the account store and shared cookie with the storage identity.
      resetAccount();
      void refreshAccount({ force: true });
    });
  }, [mockAccount, refreshAccount, resetAccount]);

  const trackAppSignupCompleted = useCallback((userId: string, pendingAuthContext: PendingAppAuthAnalytics | null) => {
    if (!pendingAuthContext) return;
    if (!userId || reportedSignupUserRef.current === userId) return;
    reportedSignupUserRef.current = userId;
    trackClientEvent("socialmedia.signup_completed", {
      product_area: "socialmedia",
      user_id: userId,
      userId,
      guest_id: pendingAuthContext?.guestId,
      guestId: pendingAuthContext?.guestId,
      action: "signup_complete",
      stage: "auth",
      status: "success",
      provider: pendingAuthContext?.provider,
      prompt_case: pendingAuthContext?.promptCase,
      promptCase: pendingAuthContext?.promptCase,
      landing_url: pendingAuthContext?.landingUrl,
      landingUrl: pendingAuthContext?.landingUrl,
      gclid: pendingAuthContext?.gclid,
      auth_state: "signed_in",
      auth_mode: "supabase"
    });
  }, []);

  const claimGuestWorkspaceAndRefreshAccount = useCallback(async (options: {
    showLoading?: boolean;
    allowCookieFallback?: boolean;
    allowClaimIntentFallback?: boolean;
  } = {}) => {
    const pendingAuthContext = readPendingAppAuthAnalytics();
    const explicitPendingGuestClaim = readPendingAppGuestClaim();
    if (!explicitPendingGuestClaim && !options.allowCookieFallback && !options.allowClaimIntentFallback) {
      // INITIAL_SESSION is page restoration, not binding intent. A residual
      // browser cookie must never claim a guest during an authenticated reload.
      await refreshAccount({ force: Boolean(pendingAuthContext) });
      const accountAfterRefresh = useAppAccountStore.getState().account;
      if (accountAfterRefresh.authMode === "supabase" && accountAfterRefresh.id) {
        trackAppSignupCompleted(accountAfterRefresh.id, pendingAuthContext);
        clearPendingAppAuthAnalytics();
      }
      return;
    }
    // A real SIGNED_IN event can come from One Tap or another auth entry that
    // could not persist sessionStorage. In that one case the HttpOnly cookie is
    // accepted as the intent proof, with a strict server-side cookie match.
    const pendingGuestClaim = explicitPendingGuestClaim ?? {
      guestId: "guest-cookie",
      createdAt: new Date().toISOString()
    };

    let result: GuestClaimResult = { ok: false };
    let claimIntentMissing = false;
    if (options.showLoading) {
      window.dispatchEvent(new Event(APP_GUEST_CLAIM_STARTED_EVENT));
    }
    try {
      for (let attempt = 0; attempt <= GUEST_CLAIM_RETRY_DELAYS_MS.length; attempt += 1) {
        result = explicitPendingGuestClaim
          ? await claimCurrentGuestWorkspace(
              explicitPendingGuestClaim.guestId,
              explicitPendingGuestClaim.requireCookieMatch ? { requireCookieMatch: true } : undefined
            )
          : options.allowClaimIntentFallback
            ? await claimCurrentGuestWorkspace(undefined, { requireClaimIntent: true })
            : await claimCurrentGuestWorkspace(undefined, { requireCookieMatch: true });
        if (
          !explicitPendingGuestClaim
          && !result.ok
          && options.allowClaimIntentFallback
          && result.error?.includes("GUEST_CLAIM_INTENT_MISSING")
        ) {
          claimIntentMissing = true;
          break;
        }
        if (
          !explicitPendingGuestClaim
          && !result.ok
          && (
            result.error?.includes("GUEST_CLAIM_COOKIE_MISSING")
            || result.error?.includes("Invalid guest id")
          )
        ) {
          result = { ...result, outcome: "login_only" };
        }
        const delayMs = GUEST_CLAIM_RETRY_DELAYS_MS[attempt];
        if (result.ok || !isRetryableGuestClaimFailure(result) || delayMs === undefined) break;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      if (claimIntentMissing) {
        await refreshAccount({ force: true });
        return;
      }
      if (result.outcome && result.outcome !== "guest_bound_elsewhere") clearPendingAppGuestClaim();
      // Keep the store's request barrier closed while the current URL still
      // points at a guest workspace that this formal account does not own.
      const currentWorkspaceIsSafe = result.ok && guestClaimKeepsCurrentWorkspace(result.outcome);
      if (result.outcome !== "guest_bound_elsewhere" && (!isChatRoute || currentWorkspaceIsSafe)) {
        await refreshAccount({ force: true });
      }
    } finally {
      const accountAfterClaim = useAppAccountStore.getState().account;
      if (accountAfterClaim.authMode === "supabase" && accountAfterClaim.id) {
        trackAppSignupCompleted(accountAfterClaim.id, pendingAuthContext);
      }
      if (claimIntentMissing) {
        clearPendingAppAuthAnalytics();
        if (options.showLoading) {
          window.dispatchEvent(new CustomEvent(APP_GUEST_CLAIM_ENDED_EVENT, {
            detail: { ok: true, outcome: "login_only", reason: "claim_intent_missing" }
          }));
        }
        // Let an authenticated reload resolve the requested session with the
        // formal account identity. The session API owner-scopes that lookup;
        // a foreign guest session returns 404 and the thread fallback then
        // leaves the URL without ejecting users from their own saved session.
        return;
      }
      const guestClaimKey = `${accountAfterClaim.id}:${pendingGuestClaim.guestId}:${result.outcome ?? ""}:${result.status ?? ""}:${result.error ?? ""}`;
      if (result.outcome === "login_only") {
        clearPendingAppGuestClaim();
        clearGuestClaimCheckoutReady();
        if (accountAfterClaim.authMode === "supabase" && accountAfterClaim.id && reportedGuestClaimRef.current !== guestClaimKey) {
          reportedGuestClaimRef.current = guestClaimKey;
          trackClientEvent("socialmedia.guest_claim_failed", {
            product_area: "socialmedia",
            user_id: accountAfterClaim.id,
            userId: accountAfterClaim.id,
            guest_id: pendingGuestClaim.guestId,
            guestId: pendingGuestClaim.guestId,
            action: "guest_claim",
            stage: "auth",
            status: "skipped",
            provider: pendingAuthContext?.provider,
            reason: "formal_account_already_bound",
            outcome: "login_only",
            next_path: pendingAuthContext?.nextPath,
            nextPath: pendingAuthContext?.nextPath
          });
        }
        window.dispatchEvent(new CustomEvent(APP_GUEST_CLAIM_ENDED_EVENT, {
          detail: { ok: true, outcome: "login_only" }
        }));
        if (isChatRoute) {
          // A full navigation guarantees that no effect from the old guest
          // thread can observe the newly signed-in identity before unmounting.
          window.location.assign(createHref);
        } else {
          clearPendingAppAuthAnalytics();
        }
        return;
      }
      if (result.outcome === "guest_bound_elsewhere") {
        // Authentication succeeded, but this browser guest belongs to a
        // different formal account. Keep the signed-in identity, abandon the
        // attempted relationship, and leave the foreign guest workspace. A
        // second forced sign-in modal would trap the newly signed-in user in a
        // loop and is not required to protect ownership.
        clearPendingAppGuestClaim();
        clearPendingAppAuthAnalytics();
        clearGuestClaimCheckoutReady();
        if (accountAfterClaim.authMode === "supabase" && accountAfterClaim.id && reportedGuestClaimRef.current !== guestClaimKey) {
          reportedGuestClaimRef.current = guestClaimKey;
          trackClientEvent("socialmedia.guest_claim_failed", {
            product_area: "socialmedia",
            user_id: accountAfterClaim.id,
            userId: accountAfterClaim.id,
            guest_id: pendingGuestClaim.guestId,
            guestId: pendingGuestClaim.guestId,
            action: "guest_claim",
            stage: "auth",
            status: "failed",
            provider: pendingAuthContext?.provider,
            reason: "guest_bound_elsewhere",
            outcome: "guest_bound_elsewhere"
          });
        }
        window.dispatchEvent(new CustomEvent(APP_GUEST_CLAIM_ENDED_EVENT, {
          detail: { ok: false, status: result.status, error: result.error, outcome: "guest_bound_elsewhere" }
        }));
        // Start leaving the foreign workspace while the request barrier is
        // still closed, then publish the authenticated account. Avoid a full
        // reload: Supabase can emit SIGNED_IN again during boot, which would
        // retry the residual guest cookie and create a 409 reload loop.
        router.replace(createHref);
        await clearGuestClaimIntent();
        await refreshAccount({ force: true });
        return;
      }
      if (!result.ok) {
        const retryableFailure = isRetryableGuestClaimFailure(result);
        if (!retryableFailure) clearPendingAppGuestClaim();
        if (accountAfterClaim.authMode === "supabase" && accountAfterClaim.id && reportedGuestClaimRef.current !== guestClaimKey) {
          reportedGuestClaimRef.current = guestClaimKey;
          const fallbackPath = `${window.location.pathname}${window.location.search}`;
          if (isExistingAccountGuestClaimSkip(result.error)) {
            trackClientEvent("socialmedia.guest_claim_failed", {
              product_area: "socialmedia",
              user_id: accountAfterClaim.id,
              userId: accountAfterClaim.id,
              guest_id: pendingGuestClaim.guestId,
              guestId: pendingGuestClaim.guestId,
              action: "guest_claim",
              stage: "auth",
              status: "skipped",
              provider: pendingAuthContext?.provider,
              reason: "existing_account_no_merge",
              error_code: "GUEST_CLAIM_REQUIRES_NEW_ACCOUNT",
              errorCode: "GUEST_CLAIM_REQUIRES_NEW_ACCOUNT",
              next_path: pendingAuthContext?.nextPath,
              nextPath: pendingAuthContext?.nextPath,
              fallback_path: fallbackPath,
              fallbackPath
            });
          } else if (result.error?.includes("GUEST_ACCOUNT_ALREADY_CLAIMED")) {
            trackClientEvent("socialmedia.guest_claim_failed", {
              product_area: "socialmedia",
              user_id: accountAfterClaim.id,
              userId: accountAfterClaim.id,
              guest_id: pendingGuestClaim.guestId,
              guestId: pendingGuestClaim.guestId,
              action: "guest_claim",
              stage: "auth",
              status: "failed",
              provider: pendingAuthContext?.provider,
              error_code: "GUEST_ACCOUNT_ALREADY_CLAIMED",
              errorCode: "GUEST_ACCOUNT_ALREADY_CLAIMED",
              next_path: pendingAuthContext?.nextPath,
              nextPath: pendingAuthContext?.nextPath,
              fallback_path: fallbackPath,
              fallbackPath
            });
          } else {
            trackClientEvent("socialmedia.guest_claim_failed", {
              product_area: "socialmedia",
              user_id: accountAfterClaim.id,
              userId: accountAfterClaim.id,
              guest_id: pendingGuestClaim.guestId,
              guestId: pendingGuestClaim.guestId,
              action: "guest_claim",
              stage: "auth",
              status: "failed",
              provider: pendingAuthContext?.provider,
              error_message: result.error,
              errorMessage: result.error
            });
          }
        }
        if (isExistingAccountGuestClaimSkip(result.error)) {
          captureAnalyticsEvent("guest_claim_skipped", {
            workflow: APP_ANALYTICS_WORKFLOW,
            generation_entry: APP_ANALYTICS_WORKFLOW,
            action: "guest_claim",
            status: "skipped",
            reason: "existing_account_no_merge",
            guest_id: pendingGuestClaim.guestId,
            session_id: pendingAuthContext?.sessionId,
            job_id: pendingAuthContext?.jobId,
            auth_mode: account.authMode
          });
        }
        if (isGuestClaimCheckoutBlocked(result.error)) {
          captureAnalyticsEvent("guest_claim_checkout_blocked", {
            workflow: APP_ANALYTICS_WORKFLOW,
            generation_entry: APP_ANALYTICS_WORKFLOW,
            action: "guest_claim",
            status: "failed",
            reason: result.error?.includes("GUEST_ACCOUNT_ALREADY_CLAIMED")
              ? "GUEST_ACCOUNT_ALREADY_CLAIMED"
              : "GUEST_CLAIM_REQUIRES_NEW_ACCOUNT",
            session_id: pendingAuthContext?.sessionId,
            job_id: pendingAuthContext?.jobId,
            guest_id: pendingGuestClaim.guestId,
            auth_mode: account.authMode,
            fallback_path: `${window.location.pathname}${window.location.search}`
          });
        }
        window.dispatchEvent(new CustomEvent(APP_TOAST_EVENT, {
          detail: {
            message: getGuestClaimFailureMessage(result),
            tone: "warning"
          }
        }));
        window.dispatchEvent(new CustomEvent(APP_GUEST_CLAIM_ENDED_EVENT, {
          detail: {
            ok: false,
            status: result.status,
            error: result.error
          }
        }));
        if (!retryableFailure) clearPendingAppAuthAnalytics();
        return;
      }
      window.dispatchEvent(new Event(APP_GUEST_CLAIM_COMPLETED_EVENT));
      if (result.secondarySyncPending && result.guestId) {
        // Ownership is already committed. Secondary credit/experiment sync is
        // retried silently and must never turn the ownership success into an
        // authentication failure.
        retryPendingGuestSecondarySync(result.guestId);
      }
      if (accountAfterClaim.authMode === "supabase" && accountAfterClaim.id && reportedGuestClaimRef.current !== guestClaimKey) {
        reportedGuestClaimRef.current = guestClaimKey;
        trackClientEvent("socialmedia.guest_claim_completed", {
          product_area: "socialmedia",
          user_id: accountAfterClaim.id,
          userId: accountAfterClaim.id,
          guest_id: result.guestId ?? pendingGuestClaim.guestId,
          guestId: result.guestId ?? pendingGuestClaim.guestId,
          action: "guest_claim",
          stage: "auth",
          status: "success",
          provider: pendingAuthContext?.provider,
          balance_synced: result.balanceSynced,
          balanceSynced: result.balanceSynced,
          secondary_sync_pending: result.secondarySyncPending,
          secondarySyncPending: result.secondarySyncPending,
          migrated_rows: result.migratedRows,
          migratedRows: result.migratedRows,
          next_path: pendingAuthContext?.nextPath,
          nextPath: pendingAuthContext?.nextPath
        });
        clearPendingAppAuthAnalytics();
      }
    }
  }, [account.authMode, createHref, isChatRoute, refreshAccount, router, trackAppSignupCompleted]);

  useEffect(() => {
    if (!mockAccount) return;
    setAccount(mockAccount);
  }, [mockAccount, setAccount]);

  useEffect(() => {
    if (mockAccount) return;
    if (getSupabaseBrowserClient()) return;
    void refreshAccount();
  }, [mockAccount, refreshAccount]);

  useEffect(() => {
    const handleAccountUpdated = () => {
      resetAppAssetsStore();
      resetAppRecentsStore();
      if (mockAccount) {
        setAccount(mockAccount);
        return;
      }
      void refreshAccount({ force: true });
    };

    window.addEventListener("vismuse:account-updated", handleAccountUpdated);
    return () => window.removeEventListener("vismuse:account-updated", handleAccountUpdated);
  }, [mockAccount, refreshAccount, setAccount]);

  useEffect(() => {
    if (!accountReady || mockAccount) return;
    if (account.authMode !== "guest_claimed") {
      claimedGuestAuthPromptKeyRef.current = "";
      return;
    }

    const promptKey = `${account.id}:${account.claimedEmail ?? ""}:${account.claimedProviders?.join(",") ?? ""}`;
    if (claimedGuestAuthPromptKeyRef.current === promptKey) return;
    claimedGuestAuthPromptKeyRef.current = promptKey;

    window.dispatchEvent(new CustomEvent("vismuse:open-auth-modal", {
      detail: {
        promptCase: "guest_account_already_claimed",
        claimedGuest: true,
        claimedEmail: account.claimedEmail,
        claimedProviders: account.claimedProviders
      }
    }));
  }, [account.authMode, account.claimedEmail, account.claimedProviders, account.id, accountReady, mockAccount]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const logoutLink = target?.closest("[data-app-logout-trigger]");
      if (!logoutLink) return;
      event.preventDefault();
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      void (async () => {
        try {
          const { error } = await supabase.auth.signOut();
          if (error) return;
        } catch {
          return;
        }
        resetAccount();
        resetAppAssetsStore();
        resetAppRecentsStore();
        router.replace("/");
        router.refresh();
        window.location.assign("/");
      })();
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [resetAccount, router]);

  useEffect(() => {
    if (mockAccount) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") {
        const currentState = useAppAccountStore.getState();
        const currentAccount = currentState.account;
        const sessionUserId = session?.user?.id ?? "";
        const sessionChanged =
          (Boolean(sessionUserId) && (currentAccount.authMode !== "supabase" || currentAccount.id !== sessionUserId))
          || (!sessionUserId && currentAccount.authMode === "supabase");
        if (!currentState.isReady) {
          initialSessionRefreshUserIdRef.current = sessionUserId || "guest";
          void (async () => {
            try {
              if (sessionUserId) {
                await claimGuestWorkspaceAndRefreshAccount({ allowClaimIntentFallback: true });
                return;
              }
              await refreshAccount();
            } finally {
              if (initialSessionRefreshUserIdRef.current === (sessionUserId || "guest")) {
                initialSessionRefreshUserIdRef.current = null;
              }
            }
          })();
          return;
        }
        if (sessionChanged) {
          resetAppAssetsStore();
          resetAppRecentsStore();
          resetAccount();
          void claimGuestWorkspaceAndRefreshAccount({
            showLoading: Boolean(sessionUserId),
            allowClaimIntentFallback: Boolean(sessionUserId)
          });
        }
        return;
      }

      if (event === "SIGNED_OUT") {
        const currentState = useAppAccountStore.getState();
        if (currentState.isReady && currentState.account.authMode !== "supabase") {
          return;
        }
        resetAppAssetsStore();
        resetAppRecentsStore();
        resetAccount();
        void refreshAccount({ force: true });
        return;
      }

      if (event === "SIGNED_IN") {
        const sessionUserId = session?.user?.id ?? "";
        if (sessionUserId && initialSessionRefreshUserIdRef.current === sessionUserId) {
          return;
        }
        const currentState = useAppAccountStore.getState();
        if (
          sessionUserId
          && currentState.isReady
          && currentState.account.authMode === "supabase"
          && currentState.account.id === sessionUserId
        ) {
          return;
        }
        resetAppAssetsStore();
        resetAppRecentsStore();
        resetAccount();
        void claimGuestWorkspaceAndRefreshAccount({ showLoading: true, allowCookieFallback: true });
        return;
      }

      if (event === "USER_UPDATED") {
        void refreshAccount({ force: true });
      }
    });

    return () => data.subscription.unsubscribe();
  }, [claimGuestWorkspaceAndRefreshAccount, mockAccount, refreshAccount, resetAccount]);

  return (
    <AppShell
      active={getActiveAppNav(pathname)}
      account={account}
      accountReady={accountReady}
      createHref="/"
      isChatRoute={isChatRoute}
      isGeneralWorkspace={false}
      onRefreshAccount={() => refreshAccount({ force: true })}
    >
      {accountReady && !mockAccount ? (
        <GoogleOneTap
          entry="workspace"
          nextPath={`${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`}
          accountLoader={loadWorkspaceOneTapAccount}
          redirectOnSuccess={false}
        />
      ) : null}
      {children}
    </AppShell>
  );
}
