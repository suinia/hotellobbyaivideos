import {
  DEFAULT_PRICING_VARIANT,
  PRICING_EXPERIMENT_COOKIE,
  PRICING_EXPERIMENT_KEY,
  SUPPORTED_PRICING_VARIANTS,
  normalizePricingVariant,
  type PricingVariant
} from "@/lib/billing/catalog";
import {
  loadClientAccountSnapshot,
  type ClientAccountContext
} from "@/lib/account/client-snapshot";
import { getClientFlags } from "@/lib/flags/client";
import { isLocalizedBillingMarket, type BillingCurrency, type BillingMarket } from "@/lib/billing/market";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2;
const VIDEO_CONTEXT_IMAGE_PRICING_VARIANT: PricingVariant = "1.1";
const AUTO_PRICING_VARIANT_OVERRIDE_VALUES = new Set(["", "auto", "default", "experiment"]);

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    "Secure"
  ].join("; ");
}

function readClientPricingExperimentCookie(): PricingVariant | null {
  if (typeof document === "undefined") return null;

  const prefix = `${PRICING_EXPERIMENT_COOKIE}=`;
  const rawValue = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length);
  if (!rawValue) return null;

  try {
    const value = decodeURIComponent(rawValue).trim();
    return SUPPORTED_PRICING_VARIANTS.includes(value as PricingVariant)
      ? normalizePricingVariant(value)
      : null;
  } catch {
    return null;
  }
}

export function readClientPricingVariantOverride(): PricingVariant | null {
  const value = process.env.NEXT_PUBLIC_PRICING_VARIANT_OVERRIDE?.trim() ?? "";
  if (AUTO_PRICING_VARIANT_OVERRIDE_VALUES.has(value.toLowerCase())) return null;
  return SUPPORTED_PRICING_VARIANTS.includes(value as PricingVariant) ? (value as PricingVariant) : null;
}

export function resolveClientPricingExperimentVariant(params: {
  assignedVariant?: string | null;
  forcePaidUserA?: boolean;
  pricingContext?: "video" | null;
  requestedVariant?: string | null;
} = {}): { key: string; variant: PricingVariant } {
  const overrideVariant = readClientPricingVariantOverride();
  if (overrideVariant) {
    writeCookie(PRICING_EXPERIMENT_COOKIE, overrideVariant);
    return { key: PRICING_EXPERIMENT_KEY, variant: overrideVariant };
  }

  const assignedVariant = params.assignedVariant?.trim();
  if (assignedVariant) {
    const variant = normalizePricingVariant(assignedVariant);
    writeCookie(PRICING_EXPERIMENT_COOKIE, variant);
    return { key: PRICING_EXPERIMENT_KEY, variant };
  }

  if (params.forcePaidUserA) {
    writeCookie(PRICING_EXPERIMENT_COOKIE, DEFAULT_PRICING_VARIANT);
    return { key: PRICING_EXPERIMENT_KEY, variant: DEFAULT_PRICING_VARIANT };
  }

  const requestedVariant = params.requestedVariant?.trim();
  if (requestedVariant) {
    const variant = normalizePricingVariant(requestedVariant);
    writeCookie(PRICING_EXPERIMENT_COOKIE, variant);
    return { key: PRICING_EXPERIMENT_KEY, variant };
  }

  if (params.pricingContext === "video") {
    writeCookie(PRICING_EXPERIMENT_COOKIE, VIDEO_CONTEXT_IMAGE_PRICING_VARIANT);
    return { key: PRICING_EXPERIMENT_KEY, variant: VIDEO_CONTEXT_IMAGE_PRICING_VARIANT };
  }

  // The account/flags request is asynchronous. Preserve the last server-assigned
  // variant while it is pending instead of briefly replacing it with the default.
  const cookieVariant = readClientPricingExperimentCookie();
  if (cookieVariant) {
    return { key: PRICING_EXPERIMENT_KEY, variant: cookieVariant };
  }

  writeCookie(PRICING_EXPERIMENT_COOKIE, DEFAULT_PRICING_VARIANT);
  return { key: PRICING_EXPERIMENT_KEY, variant: DEFAULT_PRICING_VARIANT };
}

export async function resolveClientPricingExperimentVariantFromServer(): Promise<{
  key: string;
  variant: PricingVariant;
  billingMarket: BillingMarket;
  billingCurrency: BillingCurrency;
}> {
  const overrideVariant = readClientPricingVariantOverride();
  // Billing market is request-specific. Do not let a cached assignment from a
  // previous local override or IP market replace the server-rendered currency.
  const data = await getClientFlags({
    force: true,
    keys: [PRICING_EXPERIMENT_KEY]
  });
  const flag = data.flags.find((item) => item.key === PRICING_EXPERIMENT_KEY);
  if (!flag?.variant) {
    throw new Error("Failed to resolve pricing experiment from client flags.");
  }
  const billingMarket = data.billing_market === "gb" ? "gb" : data.billing_market === "ca" ? "ca" : "default";
  const billingCurrency = data.billing_currency === "GBP" ? "GBP" : data.billing_currency === "CAD" ? "CAD" : "USD";
  if (overrideVariant && !isLocalizedBillingMarket(billingMarket)) {
    writeCookie(PRICING_EXPERIMENT_COOKIE, overrideVariant);
    return {
      key: PRICING_EXPERIMENT_KEY,
      variant: overrideVariant,
      billingMarket,
      billingCurrency
    };
  }
  return {
    key: flag.key,
    variant: normalizePricingVariant(flag.variant),
    billingMarket,
    billingCurrency
  };
}

/**
 * The account snapshot is the canonical pricing assignment for analytics.
 * Its response also sets the cookie; writing it here guarantees that events
 * emitted immediately afterwards read the same assigned variant.
 */
export async function resolveClientPricingExperimentVariantFromAccount(options: {
  accountContext?: ClientAccountContext;
} = {}): Promise<{ key: string; variant: PricingVariant }> {
  const data = await loadClientAccountSnapshot({ context: options.accountContext });
  const assignedVariant = data.user?.pricing_variant?.trim();
  if (!assignedVariant) {
    throw new Error("Account response did not include a pricing variant.");
  }

  const variant = normalizePricingVariant(assignedVariant);
  writeCookie(PRICING_EXPERIMENT_COOKIE, variant);
  return { key: PRICING_EXPERIMENT_KEY, variant };
}
