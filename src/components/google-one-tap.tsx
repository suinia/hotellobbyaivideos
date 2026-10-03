"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { captureAnalyticsEvent } from "@/lib/analytics/posthog";
import {
  ClientAccountRequestError,
  loadClientAccountSnapshot,
  type ClientAccountContext
} from "@/lib/account/client-snapshot";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { supabaseConfig } from "@/lib/supabase/config";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            cancel_on_tap_outside?: boolean;
            auto_select?: boolean;
            itp_support?: boolean;
            use_fedcm_for_prompt?: boolean;
            context?: "signin" | "signup" | "use";
          }) => void;
          prompt: (listener?: (notification: {
            isDisplayMoment?: () => boolean;
            isDisplayed?: () => boolean;
            isDismissedMoment?: () => boolean;
            isNotDisplayed?: () => boolean;
            isSkippedMoment?: () => boolean;
            getDismissedReason?: () => string;
            getMomentType?: () => string;
            getNotDisplayedReason?: () => string;
            getSkippedReason?: () => string;
          }) => void) => void;
          cancel: () => void;
        };
      };
    };
  }
}

const DEFAULT_GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()
  || "574770378733-9f77keba5hffotmmdc0q246uh4gkfcpp.apps.googleusercontent.com";
const GOOGLE_ONE_TAP_CONFIG = {
  itpSupport: true,
  fedcmPrompt: false
} as const;

type GoogleOneTapProps = {
  entry: "marketing_home_v2" | "pricing" | "generator_landing" | "workspace";
  nextPath?: string;
  redirectOnSuccess?: boolean;
  accountLoader?: () => Promise<AccountPayload>;
  accountContext?: ClientAccountContext;
};

type OneTapAuthStatus = "checking" | "signed_in" | "signed_out";
type GoogleOneTapEventStatus = "requested" | "shown" | "unavailable" | "dismissed" | "started" | "succeeded" | "failed";

export function isGoogleOneTapUserDismissal(reason?: string): boolean {
  return reason === "auto_cancel" || reason === "tap_outside" || reason === "user_cancel";
}

type AccountPayload = {
  authenticated?: boolean;
  guest?: boolean;
  user?: {
    auth_mode?: string | null;
  } | null;
};

function sanitizeNextPath(raw?: string | null): string {
  if (!raw || !raw.startsWith("/")) {
    return "/app";
  }
  return raw.startsWith("//") ? "/app" : raw;
}

function resolveTargetPath(fallback?: string | null): string {
  if (typeof window === "undefined") {
    return sanitizeNextPath(fallback);
  }

  return sanitizeNextPath(new URLSearchParams(window.location.search).get("next") || fallback);
}

function readSupabaseProjectRef(): string | null {
  try {
    const hostname = new URL(supabaseConfig.url).hostname;
    return hostname.split(".")[0]?.trim() || null;
  } catch {
    return null;
  }
}

function isSupabaseAuthStorageKey(key: string, projectRef: string | null): boolean {
  if (projectRef && key === `sb-${projectRef}-auth-token`) {
    return true;
  }
  return /^sb-[a-z0-9-]+-auth-token$/i.test(key);
}

function isSupabaseAuthCookieName(name: string, projectRef: string | null): boolean {
  if (projectRef && (name === `sb-${projectRef}-auth-token` || name.startsWith(`sb-${projectRef}-auth-token.`))) {
    return true;
  }
  return /^sb-[a-z0-9-]+-auth-token(?:\.\d+)?$/i.test(name);
}

function hasLocalSupabaseAuthRecord(): boolean {
  if (typeof window === "undefined") return false;

  const projectRef = readSupabaseProjectRef();

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !isSupabaseAuthStorageKey(key, projectRef)) continue;
      if (window.localStorage.getItem(key)?.trim()) {
        return true;
      }
    }
  } catch {
    // Storage can be unavailable in private contexts; cookies are checked below.
  }

  try {
    return document.cookie
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .some((item) => {
        const separatorIndex = item.indexOf("=");
        const name = separatorIndex >= 0 ? item.slice(0, separatorIndex).trim() : item;
        const value = separatorIndex >= 0 ? item.slice(separatorIndex + 1).trim() : "";
        return Boolean(value) && isSupabaseAuthCookieName(name, projectRef);
      });
  } catch {
    return false;
  }
}

function isSignedInAccount(data: AccountPayload): boolean {
  if (!data.authenticated || data.guest === true || !data.user) {
    return false;
  }

  return data.user.auth_mode !== "guest" && data.user.auth_mode !== "guest_claimed";
}

function createPromptAttemptId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function buildGoogleOneTapAnalyticsProperties(params: {
  entry: GoogleOneTapProps["entry"];
  promptAttemptId: string;
  status: GoogleOneTapEventStatus;
  nextPath?: string;
  reason?: string;
  momentType?: string;
  error?: string;
}): Record<string, unknown> {
  return {
    provider: "google_one_tap",
    entry: params.entry,
    prompt_attempt_id: params.promptAttemptId,
    status: params.status,
    next_path: params.nextPath,
    reason: params.reason,
    moment_type: params.momentType,
    error: params.error,
    itp_support: GOOGLE_ONE_TAP_CONFIG.itpSupport,
    fedcm_prompt: GOOGLE_ONE_TAP_CONFIG.fedcmPrompt
  };
}

export default function GoogleOneTap({
  entry,
  nextPath = "/app",
  redirectOnSuccess = true,
  accountLoader,
  accountContext
}: GoogleOneTapProps) {
  const router = useRouter();
  const [scriptReady, setScriptReady] = useState(false);
  const [authStatus, setAuthStatus] = useState<OneTapAuthStatus>("checking");
  const startedRef = useRef(false);
  const initialAuthResolvedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try {
        window.google?.accounts?.id?.cancel?.();
      } catch {
        // Ignore cleanup failures.
      }
    };
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let cancelled = false;

    const applyAuthStatus = (status: OneTapAuthStatus) => {
      if (cancelled || !mountedRef.current) return;
      initialAuthResolvedRef.current = true;
      setAuthStatus(status);
    };

    const resolveInitialAuth = async () => {
      const hasLocalAuthRecord = hasLocalSupabaseAuthRecord();
      let hasBrowserSession = false;

      try {
        const { data } = await supabase.auth.getSession();
        hasBrowserSession = Boolean(data.session);

        const account = await (accountLoader
          ? accountLoader()
          : loadClientAccountSnapshot({ context: accountContext }));
        applyAuthStatus(isSignedInAccount(account) ? "signed_in" : "signed_out");
      } catch (error) {
        if (error instanceof ClientAccountRequestError && (error.status === 401 || error.status === 403)) {
          applyAuthStatus("signed_out");
          return;
        }

        applyAuthStatus(hasBrowserSession || hasLocalAuthRecord ? "signed_in" : "signed_out");
      }
    };

    void resolveInitialAuth();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return;
      if (event === "INITIAL_SESSION") return;
      if (!initialAuthResolvedRef.current && event !== "SIGNED_IN") return;
      if (event === "SIGNED_OUT") {
        startedRef.current = false;
      }
      initialAuthResolvedRef.current = true;
      setAuthStatus(session ? "signed_in" : "signed_out");
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [accountContext, accountLoader]);

  useEffect(() => {
    if (!scriptReady || authStatus !== "signed_out" || startedRef.current) return;
    if (!supabaseConfig.enabled || !supabaseConfig.authProviders.includes("google")) return;
    if (typeof window === "undefined") return;

    const googleId = window.google?.accounts?.id;
    const targetPath = resolveTargetPath(nextPath);
    const promptAttemptId = createPromptAttemptId();
    if (!googleId) {
      captureAnalyticsEvent("login_prompt_unavailable", buildGoogleOneTapAnalyticsProperties({
        entry,
        promptAttemptId,
        status: "unavailable",
        nextPath: targetPath,
        reason: "google_id_missing"
      }));
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    startedRef.current = true;
    captureAnalyticsEvent("login_prompt_requested", buildGoogleOneTapAnalyticsProperties({
      entry,
      promptAttemptId,
      status: "requested",
      nextPath: targetPath
    }));

    googleId.initialize({
      client_id: DEFAULT_GOOGLE_CLIENT_ID,
      // Allow users to dismiss the prompt by tapping outside.
      // Keeps the login surface visible without being aggressive.
      cancel_on_tap_outside: true,
      auto_select: false,
      itp_support: GOOGLE_ONE_TAP_CONFIG.itpSupport,
      ...(GOOGLE_ONE_TAP_CONFIG.fedcmPrompt
        ? { use_fedcm_for_prompt: GOOGLE_ONE_TAP_CONFIG.fedcmPrompt }
        : {}),
      context: "signin",
      callback: async (response) => {
        const credential = response?.credential?.trim();
        if (!credential) {
          captureAnalyticsEvent("login_prompt_dismissed", buildGoogleOneTapAnalyticsProperties({
            entry,
            promptAttemptId,
            status: "dismissed",
            nextPath: targetPath,
            reason: "empty_credential"
          }));
          return;
        }

        captureAnalyticsEvent("login_started", buildGoogleOneTapAnalyticsProperties({
          entry,
          promptAttemptId,
          status: "started",
          nextPath: targetPath
        }));

        try {
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: credential
          });

          if (!error) {
            captureAnalyticsEvent("login_succeeded", buildGoogleOneTapAnalyticsProperties({
              entry,
              promptAttemptId,
              status: "succeeded",
              nextPath: targetPath
            }));
            if (redirectOnSuccess) {
              router.push(targetPath);
              router.refresh();
            }
          } else {
            captureAnalyticsEvent("login_failed", buildGoogleOneTapAnalyticsProperties({
              entry,
              promptAttemptId,
              status: "failed",
              nextPath: targetPath,
              error: error.message ?? "unknown"
            }));
          }
        } catch (err) {
          captureAnalyticsEvent("login_failed", buildGoogleOneTapAnalyticsProperties({
            entry,
            promptAttemptId,
            status: "failed",
            nextPath: targetPath,
            error: String(err)
          }));
        }
      }
    });

    googleId.prompt((notification) => {
      if (!mountedRef.current) return;

      const momentType = notification?.getMomentType?.();
      if (notification?.isDisplayMoment?.() || notification?.isDisplayed?.()) {
        captureAnalyticsEvent("login_prompt_shown", buildGoogleOneTapAnalyticsProperties({
          entry,
          promptAttemptId,
          status: "shown",
          nextPath: targetPath,
          momentType
        }));
        return;
      }

      const isSkipped = notification?.isSkippedMoment?.() ?? false;
      if (notification?.isNotDisplayed?.() || isSkipped) {
        const reason = isSkipped
          ? notification?.getSkippedReason?.()
          : notification.getNotDisplayedReason?.();
        const isUserDismissal = isSkipped && isGoogleOneTapUserDismissal(reason);
        captureAnalyticsEvent(isUserDismissal ? "login_prompt_dismissed" : "login_prompt_unavailable", buildGoogleOneTapAnalyticsProperties({
          entry,
          promptAttemptId,
          status: isUserDismissal ? "dismissed" : "unavailable",
          nextPath: targetPath,
          reason,
          momentType
        }));
        return;
      }
      if (notification?.isDismissedMoment?.()) {
        // User tapped outside or dismissed — track and do NOT fall back automatically.
        // They can use the explicit sign-in button.
        captureAnalyticsEvent("login_prompt_dismissed", buildGoogleOneTapAnalyticsProperties({
          entry,
          promptAttemptId,
          status: "dismissed",
          nextPath: targetPath,
          reason: notification?.getDismissedReason?.(),
          momentType
        }));
      }
    });
  }, [authStatus, entry, nextPath, redirectOnSuccess, router, scriptReady]);

  if (!supabaseConfig.enabled || !supabaseConfig.authProviders.includes("google")) {
    return null;
  }

  return (
    <Script
      id={`google-one-tap-${entry}`}
      src="https://accounts.google.com/gsi/client"
      strategy="afterInteractive"
      onLoad={() => setScriptReady(true)}
      onReady={() => setScriptReady(true)}
    />
  );
}
