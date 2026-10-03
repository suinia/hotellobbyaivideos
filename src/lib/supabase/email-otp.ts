"use client";

import { captureAnalyticsEvent } from "@/lib/analytics/posthog";
import { t } from "@/lib/i18n/catalog";
import type { SiteLocale } from "@/lib/i18n/site-locales";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { trackClientEvent } from "@/lib/telemetry/client";

export type EmailOtpErrorCode =
  | "unavailable"
  | "invalidEmail"
  | "rateLimited"
  | "sendTimedOut"
  | "sendFailed"
  | "invalidCode"
  | "codeInvalidOrExpired"
  | "verifyTimedOut"
  | "verifyFailed";

export type EmailOtpResult =
  | { ok: true }
  | { ok: false; error: string; code: EmailOtpErrorCode };
export type EmailOtpAnalyticsContext = {
  entry: string;
};

const EMAIL_OTP_TIMEOUT_MS = 15_000;

class EmailOtpTimeoutError extends Error {
  constructor() {
    super("email_otp_timeout");
    this.name = "EmailOtpTimeoutError";
  }
}

function withEmailOtpTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new EmailOtpTimeoutError());
    }, EMAIL_OTP_TIMEOUT_MS);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export function getEmailOtpErrorMessage(locale: SiteLocale, code: EmailOtpErrorCode): string {
  return t(locale, `workbench.auth.errors.${code}`);
}

function emailOtpFailure(locale: SiteLocale, code: EmailOtpErrorCode): EmailOtpResult {
  return { ok: false, code, error: getEmailOtpErrorMessage(locale, code) };
}

function readAuthErrorDetails(error: unknown): string {
  if (!error || typeof error !== "object") return String(error ?? "").toLowerCase();
  const candidate = error as { code?: unknown; message?: unknown };
  return `${String(candidate.code ?? "")} ${String(candidate.message ?? "")}`.trim().toLowerCase();
}

function isRateLimitError(error: unknown): boolean {
  const details = readAuthErrorDetails(error);
  return details.includes("rate limit")
    || details.includes("too many requests")
    || details.includes("over_email_send_rate_limit")
    || details.includes("email_rate_limit_exceeded")
    || details.includes("security purposes");
}

function isInvalidOrExpiredCodeError(error: unknown): boolean {
  const details = readAuthErrorDetails(error);
  return details.includes("otp_expired")
    || details.includes("token has expired")
    || details.includes("invalid token")
    || details.includes("invalid otp")
    || details.includes("expired");
}

export function normalizeAuthEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidAuthEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function normalizeEmailOtpToken(value: string): string {
  return value.replace(/\s+/g, "");
}

function captureEmailOtpEvent(
  event: "email_otp_send_started" | "email_otp_sent" | "email_otp_send_failed",
  params: {
    email?: string;
    analytics?: EmailOtpAnalyticsContext;
    reason?: string;
  }
): void {
  const status = event === "email_otp_sent" ? "success" : event === "email_otp_send_failed" ? "failed" : "started";
  captureAnalyticsEvent(event, {
    provider: "email",
    entry: params.analytics?.entry ?? "unknown",
    action: "email_otp_send",
    stage: "auth",
    status,
    reason: params.reason
  });
  trackClientEvent(`auth.${event}`, {
    entry: params.analytics?.entry ?? "unknown",
    action: "email_otp_send",
    stage: "auth",
    status,
    reason: params.reason,
    promptPreview: params.email
  });
}

export async function sendSupabaseEmailOtp(params: {
  email: string;
  emailRedirectTo: string;
  shouldCreateUser: boolean;
  locale: SiteLocale;
  analytics?: EmailOtpAnalyticsContext;
}): Promise<EmailOtpResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    captureEmailOtpEvent("email_otp_send_failed", {
      email: normalizeAuthEmail(params.email),
      analytics: params.analytics,
      reason: "supabase_not_configured"
    });
    return emailOtpFailure(params.locale, "unavailable");
  }

  const email = normalizeAuthEmail(params.email);
  if (!isValidAuthEmail(email)) {
    captureEmailOtpEvent("email_otp_send_failed", {
      email,
      analytics: params.analytics,
      reason: "invalid_email"
    });
    return emailOtpFailure(params.locale, "invalidEmail");
  }

  captureEmailOtpEvent("email_otp_send_started", {
    email,
    analytics: params.analytics
  });

  try {
    const { error } = await withEmailOtpTimeout(
      supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: params.emailRedirectTo,
          shouldCreateUser: params.shouldCreateUser
        }
      })
    );

    if (error) {
      captureEmailOtpEvent("email_otp_send_failed", {
        email,
        analytics: params.analytics,
        reason: error.message || "send_error"
      });
      return emailOtpFailure(params.locale, isRateLimitError(error) ? "rateLimited" : "sendFailed");
    }

    captureEmailOtpEvent("email_otp_sent", {
      email,
      analytics: params.analytics
    });
    return { ok: true };
  } catch (error) {
    captureEmailOtpEvent("email_otp_send_failed", {
      email,
      analytics: params.analytics,
      reason: error instanceof Error ? error.message : "send_exception"
    });
    return emailOtpFailure(params.locale, error instanceof EmailOtpTimeoutError ? "sendTimedOut" : "sendFailed");
  }
}

export async function verifySupabaseEmailOtp(params: {
  email: string;
  token: string;
  locale: SiteLocale;
}): Promise<EmailOtpResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return emailOtpFailure(params.locale, "unavailable");
  }

  const email = normalizeAuthEmail(params.email);
  const token = normalizeEmailOtpToken(params.token);
  if (!isValidAuthEmail(email) || token.length < 6) {
    return emailOtpFailure(params.locale, "invalidCode");
  }

  try {
    const { error } = await withEmailOtpTimeout(
      supabase.auth.verifyOtp({
        email,
        token,
        type: "email"
      })
    );

    if (!error) return { ok: true };
    if (isRateLimitError(error)) return emailOtpFailure(params.locale, "rateLimited");
    return emailOtpFailure(
      params.locale,
      isInvalidOrExpiredCodeError(error) ? "codeInvalidOrExpired" : "verifyFailed"
    );
  } catch (error) {
    return emailOtpFailure(params.locale, error instanceof EmailOtpTimeoutError ? "verifyTimedOut" : "verifyFailed");
  }
}
