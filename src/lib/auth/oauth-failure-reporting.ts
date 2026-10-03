export type OAuthFailureProvider = "google" | "apple" | "unknown";
export type OAuthFailureSource = "oauth_start" | "provider_callback" | "session_exchange" | "callback_exception" | "unknown";

export type OAuthFailureReport = {
  provider: OAuthFailureProvider;
  reason: string;
  error_code?: string;
  error_description?: string;
  error_source: OAuthFailureSource;
};

const MAX_ERROR_DETAIL_LENGTH = 1_000;
export const OAUTH_FAILURE_REPORTED_KEY = "vismuse_posthog_oauth_failure_reported";

function cleanDetail(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_ERROR_DETAIL_LENGTH) : undefined;
}

export function normalizeOAuthFailureProvider(value: unknown): OAuthFailureProvider {
  return value === "google" || value === "apple" ? value : "unknown";
}

function normalizeOAuthFailureSource(value: unknown): OAuthFailureSource {
  return value === "oauth_start"
    || value === "provider_callback"
    || value === "session_exchange"
    || value === "callback_exception"
    ? value
    : "unknown";
}

export function buildOAuthCallbackPath(nextPath: string, provider: Exclude<OAuthFailureProvider, "unknown">): string {
  const params = new URLSearchParams({ next: nextPath, auth_provider: provider });
  return `/auth/callback?${params.toString()}`;
}

export function resetOAuthFailureReportDedupe(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(OAUTH_FAILURE_REPORTED_KEY);
  } catch {
    // OAuth must remain usable when storage is unavailable.
  }
}

export function oauthFailureFromError(
  error: unknown,
  provider: OAuthFailureProvider,
  source: OAuthFailureSource,
  fallbackReason = "oauth_failed"
): OAuthFailureReport {
  const candidate = error && typeof error === "object"
    ? error as { code?: unknown; name?: unknown; message?: unknown }
    : {};
  const errorCode = cleanDetail(candidate.code) ?? cleanDetail(candidate.name);
  const errorDescription = cleanDetail(candidate.message) ?? cleanDetail(error);
  return {
    provider,
    reason: errorCode ?? fallbackReason,
    ...(errorCode ? { error_code: errorCode } : {}),
    ...(errorDescription ? { error_description: errorDescription } : {}),
    error_source: source
  };
}

export function appendOAuthFailureParams(url: URL, report: OAuthFailureReport): URL {
  url.searchParams.set("auth_error", report.reason);
  url.searchParams.set("auth_provider", report.provider);
  url.searchParams.set("auth_error_source", report.error_source);
  if (report.error_code) url.searchParams.set("auth_error_code", report.error_code);
  if (report.error_description) url.searchParams.set("auth_error_description", report.error_description);
  return url;
}

export function readOAuthFailureReport(input: string | URL): OAuthFailureReport | null {
  const url = input instanceof URL ? input : new URL(input);
  const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  const read = (...keys: string[]) => {
    for (const key of keys) {
      const value = cleanDetail(url.searchParams.get(key)) ?? cleanDetail(hashParams.get(key));
      if (value) return value;
    }
    return undefined;
  };
  const reason = read("auth_error", "error");
  if (!reason) return null;

  const errorCode = read("auth_error_code", "error_code");
  const errorDescription = read("auth_error_description", "error_description");
  return {
    provider: normalizeOAuthFailureProvider(read("auth_provider", "provider")),
    reason,
    ...(errorCode ? { error_code: errorCode } : {}),
    ...(errorDescription ? { error_description: errorDescription } : {}),
    error_source: normalizeOAuthFailureSource(read("auth_error_source"))
  };
}
