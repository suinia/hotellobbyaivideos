import type { PricingVariant } from "@/lib/billing/catalog";

export type BillingMarket = "default" | "gb" | "ca";
export type BillingCurrency = "USD" | "GBP" | "CAD";

export type BillingContext = {
  market: BillingMarket;
  currency: BillingCurrency;
  pricingVariant: PricingVariant;
};

type HeaderReader = Pick<Headers, "get">;

export const GB_PRICING_VARIANT: PricingVariant = "1.9";
export const CA_PRICING_VARIANT: PricingVariant = "1.9";

export function resolveBillingPricingVariant(
  market: BillingMarket,
  assignedPricingVariant: PricingVariant
): PricingVariant {
  if (market === "gb") {
    return assignedPricingVariant === "2.4" || assignedPricingVariant === "2.5"
      ? assignedPricingVariant
      : GB_PRICING_VARIANT;
  }
  if (market === "ca") return CA_PRICING_VARIANT;
  return assignedPricingVariant;
}

function resolveLocalBillingMarketOverride(): BillingMarket | null {
  if (process.env.NODE_ENV === "production") return null;
  const override = process.env.BILLING_MARKET_OVERRIDE?.trim().toLowerCase();
  if (override === "gb") return "gb";
  if (override === "ca") return "ca";
  if (override === "default") return "default";
  return null;
}

export function resolveBillingMarket(params: {
  headers: HeaderReader;
  isVercel?: boolean;
}): BillingMarket {
  const localOverride = resolveLocalBillingMarketOverride();
  if (localOverride) return localOverride;

  const isVercel = params.isVercel ?? process.env.VERCEL === "1";
  if (!isVercel) return "default";

  const country = params.headers.get("x-vercel-ip-country")?.trim().toUpperCase();
  if (country === "GB") return "gb";
  if (country === "CA") return "ca";
  return "default";
}

export function billingCurrencyForMarket(market: BillingMarket): BillingCurrency {
  if (market === "gb") return "GBP";
  if (market === "ca") return "CAD";
  return "USD";
}

export function resolveBillingContext(params: {
  headers: HeaderReader;
  assignedPricingVariant: PricingVariant;
  isVercel?: boolean;
}): BillingContext {
  const market = resolveBillingMarket(params);
  return {
    market,
    currency: billingCurrencyForMarket(market),
    pricingVariant: resolveBillingPricingVariant(market, params.assignedPricingVariant)
  };
}

export function isGbBillingMarket(market?: BillingMarket | null): boolean {
  return market === "gb";
}

export function isLocalizedBillingMarket(market?: BillingMarket | null): boolean {
  return market === "gb" || market === "ca";
}
