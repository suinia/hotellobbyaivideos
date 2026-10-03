"use client";

import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";
import { t } from "@/lib/i18n/catalog";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { captureAnalyticsEvent } from "@/lib/analytics/posthog";
import {
  clearGuestClaimIntent,
  prepareGuestClaimIntent,
  shouldResolveGuestClaimForAuthMode
} from "@/lib/auth/guest-claim";
import { buildOAuthCallbackPath, oauthFailureFromError, resetOAuthFailureReportDedupe } from "@/lib/auth/oauth-failure-reporting";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { supabaseConfig } from "@/lib/supabase/config";
import {
  normalizeAuthEmail,
  sendSupabaseEmailOtp,
  verifySupabaseEmailOtp
} from "@/lib/supabase/email-otp";
import { useAppAccountStore } from "./app-account-store";
import { guestCreditLimitSignupCta } from "./app-cta-copy";
import styles from "./app.module.css";

export const APP_AUTH_TRIGGER_ATTRIBUTE = "data-app-auth-trigger";

const APP_PENDING_GUEST_CLAIM_KEY = "vismuse.app.pendingGuestClaim";
const APP_PENDING_AUTH_ANALYTICS_KEY = "vismuse.app.pendingAuthAnalytics";
const APP_PENDING_CHECKOUT_AFTER_AUTH_KEY = "vismuse.app.pendingCheckoutAfterAuth";
const APP_GUEST_CLAIM_CHECKOUT_READY_KEY = "vismuse.app.guestClaimCheckoutReady";
const THREAD_PENDING_IMAGE_UNLOCK_CHECKOUT_KEY = "vismuse:socialmedia-pending-image-unlock-checkout";
const APP_AUTH_MODAL_CLOSED_EVENT = "vismuse:auth-modal-closed";

type AppAuthPromptCase = "default" | "guest_depleted_signup_bonus" | "checkout_auth_required" | "guest_account_already_claimed";
type AppAuthPendingAction = "google" | "apple" | "email_send" | "email_verify";
type AppAuthProvider = "google" | "apple" | "email";

type AppAuthModalEventDetail = {
  promptCase?: AppAuthPromptCase;
  prompt_case?: AppAuthPromptCase;
  claimedGuest?: boolean;
  claimed_guest?: boolean;
  claimedEmail?: string;
  claimed_email?: string;
  claimedProviders?: string[];
  claimed_providers?: string[];
};

function buildAppAuthNextPath(): string {
  if (typeof window === "undefined") return "/app";
  return `${window.location.pathname}${window.location.search}`;
}

function notifyAppAuthModalClosed(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(APP_AUTH_MODAL_CLOSED_EVENT));
}

function readAppAuthRouteContext(): { sessionId?: string; jobId?: string } {
  if (typeof window === "undefined") return {};
  const [, appSegment, routeSegment, sessionSegment] = window.location.pathname.split("/");
  const sessionId = appSegment === "app" && routeSegment === "chat" ? sessionSegment : undefined;
  let jobId: string | undefined;
  try {
    jobId = new URL(window.location.href).searchParams.get("job_id") ?? undefined;
  } catch {
    jobId = undefined;
  }
  return {
    sessionId: sessionId ? decodeURIComponent(sessionId) : undefined,
    jobId
  };
}

function rememberPendingAppGuestClaim(): void {
  if (typeof window === "undefined") return;
  const account = useAppAccountStore.getState().account;
  if (!shouldResolveGuestClaimForAuthMode(account.authMode) || !account.id) return;
  try {
    window.sessionStorage.setItem(APP_PENDING_GUEST_CLAIM_KEY, JSON.stringify({
      guestId: account.id,
      // A claimed guest is relation resolution, not a new binding request.
      // Require the server's HttpOnly guest cookie to prove the browser still
      // owns this guest before checking the linked formal account.
      requireCookieMatch: account.authMode === "guest_claimed",
      createdAt: new Date().toISOString()
    }));
  } catch {
    // The sign-in can still continue; the account refresh fallback will keep the app usable.
  }
}

function rememberPendingAppAuthAnalytics(provider: AppAuthProvider, promptCase: AppAuthPromptCase, options?: { claimGuest?: boolean }): void {
  if (typeof window === "undefined") return;
  const account = useAppAccountStore.getState().account;
  const guestId = account.authMode === "guest" || account.authMode === "guest_claimed" ? account.id : undefined;
  let gclid: string | undefined;
  try {
    gclid = new URL(window.location.href).searchParams.get("gclid") ?? undefined;
  } catch {
    gclid = undefined;
  }
  try {
    const routeContext = readAppAuthRouteContext();
    window.sessionStorage.setItem(APP_PENDING_AUTH_ANALYTICS_KEY, JSON.stringify({
      provider,
      promptCase,
      guestId,
      claimGuest: options?.claimGuest === true,
      nextPath: buildAppAuthNextPath(),
      sessionId: routeContext.sessionId,
      jobId: routeContext.jobId,
      landingUrl: window.location.href,
      gclid,
      createdAt: new Date().toISOString()
    }));
  } catch {
    // Auth can continue without analytics context.
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

function hasPendingAppGuestClaim(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.sessionStorage.getItem(APP_PENDING_GUEST_CLAIM_KEY));
  } catch {
    return false;
  }
}

function clearPendingAppCheckoutAfterAuth(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(APP_PENDING_CHECKOUT_AFTER_AUTH_KEY);
    window.sessionStorage.removeItem(APP_GUEST_CLAIM_CHECKOUT_READY_KEY);
    window.sessionStorage.removeItem(THREAD_PENDING_IMAGE_UNLOCK_CHECKOUT_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function clearPendingAppAuthWork(): void {
  clearPendingAppGuestClaim();
  clearPendingAppCheckoutAfterAuth();
  void clearGuestClaimIntent();
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(APP_PENDING_AUTH_ANALYTICS_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function shouldClaimCurrentAppGuest(): boolean {
  const account = useAppAccountStore.getState().account;
  return shouldResolveGuestClaimForAuthMode(account.authMode) && Boolean(account.id?.trim());
}

async function startAppOAuth(
  provider: "google" | "apple",
  setPendingAction: (value: AppAuthPendingAction | null) => void,
  options?: { claimGuest?: boolean; promptCase?: AppAuthPromptCase }
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase auth is not configured.");
  }

  setPendingAction(provider);
  if (options?.claimGuest) {
    rememberPendingAppGuestClaim();
    await prepareGuestClaimIntent();
  } else {
    clearPendingAppGuestClaim();
  }
  rememberPendingAppAuthAnalytics(provider, options?.promptCase ?? "default", {
    claimGuest: options?.claimGuest
  });
  resetOAuthFailureReportDedupe();
  captureAnalyticsEvent("signup_started", { provider, entry: "app_auth_modal" });
  const redirectTo =
    typeof window === "undefined"
      ? "/auth/callback"
      : `${window.location.origin}${buildOAuthCallbackPath(buildAppAuthNextPath(), provider)}`;

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo }
  });

  if (error) {
    captureAnalyticsEvent("oauth_failed", {
      ...oauthFailureFromError(error, provider, "oauth_start"),
      status: "failed"
    });
    clearPendingAppAuthWork();
    setPendingAction(null);
    throw new Error(error.message);
  }
}

export function AppAuthModal() {
  const uiLocale = useUiLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [promptCase, setPromptCase] = useState<AppAuthPromptCase>("default");
  const [claimedGuest, setClaimedGuest] = useState(false);
  const [claimedEmail, setClaimedEmail] = useState("");
  const [claimedProviders, setClaimedProviders] = useState<string[]>([]);
  const [authPendingAction, setAuthPendingAction] = useState<AppAuthPendingAction | null>(null);
  const [error, setError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [emailAuthAddress, setEmailAuthAddress] = useState("");
  const [emailAuthCode, setEmailAuthCode] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const supportsGoogle = supabaseConfig.authProviders.includes("google");
  const supportsApple = supabaseConfig.authProviders.includes("apple");
  const supportsEmail = supabaseConfig.authProviders.includes("email");
  const isGuestCreditLimitPrompt = promptCase === "guest_depleted_signup_bonus";
  const isCheckoutAuthPrompt = promptCase === "checkout_auth_required";
  const isClaimedGuestPrompt = claimedGuest || promptCase === "guest_account_already_claimed";
  const claimedIdentity = claimedEmail.trim() || "the linked account";
  const claimedProviderNames = claimedProviders
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean);
  const claimedProviderLabel = claimedProviderNames.includes("apple")
    ? "Apple"
    : claimedProviderNames.includes("google")
      ? "Google"
      : claimedProviderNames.includes("email")
        ? "email"
        : "that account";
  const isClaimedGoogleProvider = isClaimedGuestPrompt && claimedProviderNames.includes("google");
  const isClaimedAppleProvider = isClaimedGuestPrompt && claimedProviderNames.includes("apple");
  const modalTitle = isClaimedGuestPrompt
    ? "Sign in to continue"
    : isGuestCreditLimitPrompt
      ? guestCreditLimitSignupCta.modalTitle
      : "Welcome to Hotel Lobby AI";
  const modalCopy = isGuestCreditLimitPrompt
    ? guestCreditLimitSignupCta.modalCopy
    : isClaimedGuestPrompt
      ? `This workspace is linked to ${claimedIdentity}. Sign in with ${claimedProviderLabel} to continue.`
      : isCheckoutAuthPrompt
        ? "Sign in or create an account to continue to secure checkout."
        : "Sign in or create an account";
  const defaultNotice = isGuestCreditLimitPrompt
    ? guestCreditLimitSignupCta.modalNotice
    : isClaimedGuestPrompt
      ? "Uploads, generation, and history are locked until you sign in to the linked account."
      : isCheckoutAuthPrompt
        ? "We will keep your guest checkout ready after sign-in."
        : "Guest creations stay on this browser only. Sign in when you want a shared workspace.";
  const authPending = authPendingAction !== null;
  const closeLocked = authPendingAction === "email_send" || authPendingAction === "email_verify";

  useEffect(() => useAppAccountStore.subscribe((state) => {
    if (!state.isReady || !state.account.isLoggedIn || state.account.authMode !== "supabase") return;
    // The shell publishes the signed-in account after guest claim resolution.
    // Successful login must not cancel pending checkout or generation actions.
    setOpen(false);
    setAuthPendingAction(null);
    setEmailAuthCode("");
    setEmailOtpSent(false);
    setError("");
    setAuthNotice("");
  }), []);

  useEffect(() => {
    const openModal = (event?: Event) => {
      const detail = event instanceof CustomEvent ? (event.detail as AppAuthModalEventDetail | undefined) : undefined;
      const nextPromptCase = detail?.promptCase ?? detail?.prompt_case;
      const nextClaimedGuest = Boolean(detail?.claimedGuest || detail?.claimed_guest || nextPromptCase === "guest_account_already_claimed");
      const nextClaimedEmail = detail?.claimedEmail ?? detail?.claimed_email ?? "";
      const nextClaimedProviders = detail?.claimedProviders ?? detail?.claimed_providers ?? [];
      setError("");
      setAuthNotice("");
      setEmailAuthCode("");
      setEmailOtpSent(false);
      setAuthPendingAction(null);
      setClaimedGuest(nextClaimedGuest);
      setClaimedEmail(nextClaimedEmail);
      setClaimedProviders(nextClaimedProviders);
      const nextClaimedProviderNames = nextClaimedProviders
        .map((provider) => provider.trim().toLowerCase())
        .filter(Boolean);
      const shouldPrefillEmail = nextClaimedGuest
        && nextClaimedEmail
        && nextClaimedProviderNames.includes("email");
      setEmailAuthAddress(shouldPrefillEmail ? nextClaimedEmail : "");
      setPromptCase(
        nextPromptCase === "guest_depleted_signup_bonus"
          || nextPromptCase === "checkout_auth_required"
          || nextPromptCase === "guest_account_already_claimed"
          ? nextPromptCase
          : "default"
      );
      setOpen(true);
    };

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest(`[${APP_AUTH_TRIGGER_ATTRIBUTE}]`)) return;
      event.preventDefault();
      openModal();
    };

    window.addEventListener("vismuse:open-auth-modal", openModal);
    document.addEventListener("click", handleDocumentClick);

    return () => {
      window.removeEventListener("vismuse:open-auth-modal", openModal);
      document.removeEventListener("click", handleDocumentClick);
    };
  }, []);

  useEffect(() => {
    const resetReturnedAuthAttempt = () => {
      if (authPendingAction !== "google" && authPendingAction !== "apple") return;
      setAuthPendingAction(null);
      clearPendingAppAuthWork();
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        resetReturnedAuthAttempt();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        resetReturnedAuthAttempt();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", resetReturnedAuthAttempt);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", resetReturnedAuthAttempt);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authPendingAction, supportsApple, supportsGoogle]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || closeLocked) return;
      clearPendingAppAuthWork();
      notifyAppAuthModalClosed();
      setOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeLocked, open]);

  const handleGoogleSignIn = async () => {
    if (!supportsGoogle) return;

    setError("");
    try {
      const claimGuest = shouldClaimCurrentAppGuest() || (isClaimedGuestPrompt && hasPendingAppGuestClaim());
      await startAppOAuth("google", setAuthPendingAction, {
        claimGuest,
        promptCase
      });
    } catch {
      setError(t(uiLocale, "workbench.auth.errors.signInFailed"));
    }
  };

  const handleAppleSignIn = async () => {
    if (!supportsApple) return;

    setError("");
    try {
      const claimGuest = shouldClaimCurrentAppGuest() || (isClaimedGuestPrompt && hasPendingAppGuestClaim());
      await startAppOAuth("apple", setAuthPendingAction, {
        claimGuest,
        promptCase
      });
    } catch {
      setError(t(uiLocale, "workbench.auth.errors.signInFailed"));
    }
  };

  const handleSendEmailCode = async () => {
    if (!supportsEmail) return;

    const email = normalizeAuthEmail(emailAuthAddress);
    const emailRedirectTo =
      typeof window === "undefined"
        ? "/auth/callback"
        : `${window.location.origin}/auth/callback?next=${encodeURIComponent(buildAppAuthNextPath())}`;

    setAuthPendingAction("email_send");
    setError("");
    setAuthNotice("");
    const claimGuest = shouldClaimCurrentAppGuest() || (isClaimedGuestPrompt && hasPendingAppGuestClaim());
    if (claimGuest) {
      rememberPendingAppGuestClaim();
      await prepareGuestClaimIntent();
    } else {
      clearPendingAppGuestClaim();
    }
    rememberPendingAppAuthAnalytics("email", promptCase, {
      claimGuest
    });
    captureAnalyticsEvent("signup_started", { provider: "email", entry: "app_auth_modal" });

    const result = await sendSupabaseEmailOtp({
      email,
      emailRedirectTo,
      shouldCreateUser: true,
      locale: uiLocale,
      analytics: { entry: "app_auth_modal" }
    });

    setAuthPendingAction(null);
    if (!result.ok) {
      clearPendingAppAuthWork();
      setError(result.error);
      return;
    }

    setEmailAuthAddress(email);
    setEmailAuthCode("");
    setEmailOtpSent(true);
    setAuthNotice(t(uiLocale, "workbench.auth.codeSent", { email }));
  };

  const handleVerifyEmailCode = async () => {
    if (!supportsEmail) return;

    setAuthPendingAction("email_verify");
    setError("");
    const result = await verifySupabaseEmailOtp({
      email: emailAuthAddress,
      token: emailAuthCode,
      locale: uiLocale
    });

    if (!result.ok) {
      setAuthPendingAction(null);
      setError(result.error);
      setAuthNotice("");
      return;
    }

    setOpen(false);
    setAuthPendingAction(null);
    setEmailAuthCode("");
    setAuthNotice("");
    router.refresh();
  };

  const handleEmailSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (emailOtpSent ? handleVerifyEmailCode() : handleSendEmailCode());
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    localizeUiTree(<div
      className={styles.authModalOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
      onClick={() => {
        if (closeLocked) return;
        clearPendingAppAuthWork();
        notifyAppAuthModalClosed();
        setOpen(false);
      }}
    >
      <div className={styles.authModalShell} onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className={styles.authModalClose}
          onClick={() => {
            clearPendingAppAuthWork();
            notifyAppAuthModalClosed();
            setOpen(false);
          }}
          aria-label="Close sign-in dialog"
          disabled={closeLocked}
        >
          <X size={18} />
        </button>

        <div className={styles.authModalCopy}>
          <h2>{modalTitle}</h2>
          <p>{modalCopy}</p>
        </div>

        <p className={error ? styles.authError : isGuestCreditLimitPrompt ? styles.authWarning : styles.authNotice}>
          {error || defaultNotice}
        </p>

        <div className={styles.authModalActions}>
          {supportsGoogle ? (
            <button
              type="button"
              className={styles.authOauthButton}
              onClick={() => void handleGoogleSignIn()}
              disabled={authPending}
            >
              <span className={styles.authOauthIconSlot} aria-hidden="true">
                <Image src="/assets/logos/google.png" alt="" width={18} height={18} className={styles.authOauthIcon} />
              </span>
              <span>{authPendingAction === "google" ? "Connecting to Google..." : isClaimedGuestPrompt ? "Log in with Google" : "Continue with Google"}</span>
              {isClaimedGoogleProvider ? <span className={styles.authOauthBadge}>Linked account</span> : null}
            </button>
          ) : null}
          {supportsApple ? (
            <button
              type="button"
              className={styles.authOauthButton}
              onClick={() => void handleAppleSignIn()}
              disabled={authPending}
            >
              <span className={styles.authOauthIconSlot} aria-hidden="true">
                <Image src="/assets/logos/apple.png" alt="" width={18} height={18} className={styles.authOauthIconApple} />
              </span>
              <span>{authPendingAction === "apple" ? "Connecting to Apple..." : isClaimedGuestPrompt ? "Log in with Apple" : "Continue with Apple"}</span>
              {isClaimedAppleProvider ? <span className={styles.authOauthBadge}>Linked account</span> : null}
            </button>
          ) : null}
          {supportsEmail ? (
            <>
              <div className={styles.authDivider} aria-hidden="true">
                <span>or</span>
              </div>
              <form className={styles.authEmailForm} onSubmit={handleEmailSubmit}>
                <input
                  className={styles.authInput}
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
                    className={styles.authInput}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6-digit code"
                    value={emailAuthCode}
                    onChange={(event) => setEmailAuthCode(event.target.value)}
                    disabled={authPending}
                  />
                ) : null}
                <button type="submit" className={styles.authEmailSubmit} disabled={authPending || !emailAuthAddress.trim()}>
                  {authPendingAction === "email_send"
                    ? "Sending code..."
                    : authPendingAction === "email_verify" ? "Verifying code..."
                    : emailOtpSent ? "Verify code" : "Continue with email"}
                </button>
              </form>
            </>
          ) : null}
        </div>

        {!error && authNotice ? <p className={styles.authSuccessNotice}>{authNotice}</p> : null}

        <p className={styles.authModalFootnote}>
          By continuing, you agree to our Terms and Privacy Policy.
        </p>
      </div>
    </div>, uiLocale),
    document.body
  );
}
