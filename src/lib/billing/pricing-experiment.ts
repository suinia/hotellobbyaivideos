import {
  DEFAULT_PRICING_VARIANT,
  PRICING_EXPERIMENT_COOKIE,
  PRICING_EXPERIMENT_KEY,
  normalizePricingVariant,
  type PricingVariant
} from "@/lib/billing/catalog";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2;

function parseCookieHeader(cookieHeader?: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const item of (cookieHeader ?? "").split(";")) {
    const separatorIndex = item.indexOf("=");
    if (separatorIndex < 0) continue;
    const key = item.slice(0, separatorIndex).trim();
    const value = item.slice(separatorIndex + 1).trim();
    if (!key) continue;
    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

export function resolvePricingExperimentVariant(params: {
  cookieHeader?: string | null;
  forcePaidUserA?: boolean;
} = {}): { key: string; variant: PricingVariant; shouldSetCookie: boolean } {
  if (params.forcePaidUserA) {
    return {
      key: PRICING_EXPERIMENT_KEY,
      variant: DEFAULT_PRICING_VARIANT,
      shouldSetCookie: true
    };
  }

  const cookieVariant = parseCookieHeader(params.cookieHeader)[PRICING_EXPERIMENT_COOKIE];
  if (cookieVariant) {
    return {
      key: PRICING_EXPERIMENT_KEY,
      variant: normalizePricingVariant(cookieVariant),
      shouldSetCookie: false
    };
  }

  return {
    key: PRICING_EXPERIMENT_KEY,
    variant: DEFAULT_PRICING_VARIANT,
    shouldSetCookie: true
  };
}

export function buildPricingExperimentCookie(variant: PricingVariant): string {
  return [
    `${PRICING_EXPERIMENT_COOKIE}=${encodeURIComponent(variant)}`,
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    "Secure"
  ].join("; ");
}
