import {
  getPublicBillingPackagesForVariant,
  requireBillingPackage,
  resolveEffectiveBillingPackageUsdAmount,
  resolveStripePriceIdForPackage,
  type BillingPackageId,
  type PricingVariant,
  type PublicBillingPackage
} from "@/lib/billing/catalog";
import type { BillingCurrency, BillingMarket } from "@/lib/billing/market";

export const BILLING_IMAGE_UNLOCK_PACKAGE_ID = "image_unlock_single" as const;
const IMAGE_UNLOCK_PACKAGE_ID = BILLING_IMAGE_UNLOCK_PACKAGE_ID;

export type BillablePackageId = BillingPackageId | typeof IMAGE_UNLOCK_PACKAGE_ID;

export type BillingOffer = {
  packageId: BillablePackageId;
  market: BillingMarket;
  currency: BillingCurrency;
  amount: number;
  amountMinor: number;
  interval?: "month" | "year";
  stripePriceId: string;
};

export type LocalizedPublicBillingPackage = PublicBillingPackage & {
  displayAmount: number;
  displayCurrency: BillingCurrency;
};

type LocalizedOfferDefinition = {
  amountMinor: number;
  envKey?: string;
  interval?: "month" | "year";
};

const GBP_OFFER_DEFINITIONS: Partial<Record<BillablePackageId, LocalizedOfferDefinition>> = {
  image_credit_pack_1500_v25: { amountMinor: 1499 },
  image_credit_pack_5000_v25: { amountMinor: 2999 },
  video_credit_pack_1500_v25: { amountMinor: 1499 },
  video_credit_pack_5000_v25: { amountMinor: 2999 },
  pro_monthly_v25: {
    amountMinor: 1499,
    envKey: "STRIPE_PRICE_ID_GBP_PRO_MONTHLY_V25",
    interval: "month"
  },
  pro_annual_v25: {
    amountMinor: 13488,
    envKey: "STRIPE_PRICE_ID_GBP_PRO_ANNUAL_V25",
    interval: "year"
  },
  max_monthly_v25: {
    amountMinor: 3599,
    envKey: "STRIPE_PRICE_ID_GBP_MAX_MONTHLY_V25",
    interval: "month"
  },
  max_annual_v25: {
    amountMinor: 29988,
    envKey: "STRIPE_PRICE_ID_GBP_MAX_ANNUAL_V25",
    interval: "year"
  },
  basic_monthly_v24: {
    amountMinor: 1499,
    envKey: "STRIPE_PRICE_ID_GBP_BASIC_MONTHLY_V24",
    interval: "month"
  },
  basic_annual_v24: {
    amountMinor: 8988,
    envKey: "STRIPE_PRICE_ID_GBP_BASIC_ANNUAL_V24",
    interval: "year"
  },
  pro_monthly_v24: {
    amountMinor: 2999,
    envKey: "STRIPE_PRICE_ID_GBP_PRO_MONTHLY_V24",
    interval: "month"
  },
  pro_annual_v24: {
    amountMinor: 17988,
    envKey: "STRIPE_PRICE_ID_GBP_PRO_ANNUAL_V24",
    interval: "year"
  },
  max_monthly_v24: {
    amountMinor: 5999,
    envKey: "STRIPE_PRICE_ID_GBP_MAX_MONTHLY_V24",
    interval: "month"
  },
  max_annual_v24: {
    amountMinor: 35988,
    envKey: "STRIPE_PRICE_ID_GBP_MAX_ANNUAL_V24",
    interval: "year"
  },
  image_credit_pack_500_v24: {
    amountMinor: 2299
  },
  image_credit_pack_2000_v24: {
    amountMinor: 3999
  },
  image_credit_pack_10000_v24: {
    amountMinor: 6999
  },
  pro_monthly_v19: {
    amountMinor: 1499,
    envKey: "STRIPE_PRICE_ID_GBP_PRO_MONTHLY_V19",
    interval: "month"
  },
  pro_annual_v19: {
    amountMinor: 8988,
    envKey: "STRIPE_PRICE_ID_GBP_PRO_ANNUAL_V19",
    interval: "year"
  },
  max_monthly_v19: {
    amountMinor: 5999,
    envKey: "STRIPE_PRICE_ID_GBP_MAX_MONTHLY_V19",
    interval: "month"
  },
  max_annual_v19: {
    amountMinor: 35988,
    envKey: "STRIPE_PRICE_ID_GBP_MAX_ANNUAL_V19",
    interval: "year"
  },
  image_credit_pack_1000_v19: {
    amountMinor: 1499
  },
  image_credit_pack_3000_v19: {
    amountMinor: 2999
  },
  starter_pack_1_v20: {
    amountMinor: 799
  },
  starter_pack_10_v20: {
    amountMinor: 1499
  },
  starter_pack_100_v20: {
    amountMinor: 2999
  },
  starter_pack_1000_v20: {
    amountMinor: 7999
  },
  video_credit_pack_2000_v20: {
    amountMinor: 1499
  },
  video_credit_pack_6000_v20: {
    amountMinor: 2999
  },
  video_credit_pack_20000_v20: {
    amountMinor: 7999
  },
  [IMAGE_UNLOCK_PACKAGE_ID]: {
    amountMinor: 799
  },
  video_unlock_single: {
    amountMinor: 999
  }
};

const CAD_OFFER_DEFINITIONS: Partial<Record<BillablePackageId, LocalizedOfferDefinition>> = {
  pro_monthly_v19: {
    amountMinor: 2499,
    envKey: "STRIPE_PRICE_ID_CAD_PRO_MONTHLY_V19",
    interval: "month"
  },
  pro_annual_v19: {
    amountMinor: 14988,
    envKey: "STRIPE_PRICE_ID_CAD_PRO_ANNUAL_V19",
    interval: "year"
  },
  max_monthly_v19: {
    amountMinor: 9999,
    envKey: "STRIPE_PRICE_ID_CAD_MAX_MONTHLY_V19",
    interval: "month"
  },
  max_annual_v19: {
    amountMinor: 59988,
    envKey: "STRIPE_PRICE_ID_CAD_MAX_ANNUAL_V19",
    interval: "year"
  },
  [IMAGE_UNLOCK_PACKAGE_ID]: {
    amountMinor: 1299
  },
  video_unlock_single: {
    amountMinor: 1299
  }
};

const LOCALIZED_OFFER_DEFINITIONS = {
  gb: GBP_OFFER_DEFINITIONS,
  ca: CAD_OFFER_DEFINITIONS
} as const;

function amountFromMinor(amountMinor: number): number {
  return Math.round(amountMinor) / 100;
}

function readStripePriceId(envKey: string): string {
  if (typeof process === "undefined") return "";
  return process.env[envKey]?.trim() ?? "";
}

function resolveDefaultImageUnlockAmount(pricingVariant?: PricingVariant): number {
  if (pricingVariant === "1.9" || pricingVariant === "2.3" || pricingVariant === "2.4" || pricingVariant === "2.5") return 9.99;
  return pricingVariant === "1.4" ? 2.99 : 6.99;
}

export function isBillingPackageAvailableInMarket(
  packageId: BillablePackageId,
  market: BillingMarket
): boolean {
  return market === "default" || Boolean(LOCALIZED_OFFER_DEFINITIONS[market][packageId]);
}

function defaultOffer(packageId: BillablePackageId, pricingVariant?: PricingVariant): BillingOffer {
  if (packageId === IMAGE_UNLOCK_PACKAGE_ID) {
    const amount = resolveDefaultImageUnlockAmount(pricingVariant);
    return {
      packageId,
      market: "default",
      currency: "USD",
      amount,
      amountMinor: Math.round(amount * 100),
      stripePriceId: process.env.STRIPE_PRICE_ID_IMAGE_UNLOCK_SINGLE?.trim()
        || process.env.STRIPE_PRICE_ID_IMAGE_UNLOCK?.trim()
        || ""
    };
  }

  const billingPackage = requireBillingPackage(packageId);
  const amount = resolveEffectiveBillingPackageUsdAmount(packageId);
  return {
    packageId,
    market: "default",
    currency: "USD",
    amount,
    amountMinor: Math.round(amount * 100),
    interval: billingPackage.interval,
    stripePriceId: resolveStripePriceIdForPackage(packageId)
  };
}

export function resolveBillingOffer(params: {
  packageId: BillablePackageId;
  market: BillingMarket;
  pricingVariant?: PricingVariant;
}): BillingOffer {
  if (params.market === "default") {
    return defaultOffer(params.packageId, params.pricingVariant);
  }

  const definition = LOCALIZED_OFFER_DEFINITIONS[params.market][params.packageId];
  if (!definition) {
    throw new Error(`BILLING_PACKAGE_NOT_AVAILABLE_IN_${params.market.toUpperCase()}`);
  }

  return {
    packageId: params.packageId,
    market: params.market,
    currency: params.market === "gb" ? "GBP" : "CAD",
    amount: amountFromMinor(definition.amountMinor),
    amountMinor: definition.amountMinor,
    interval: definition.interval,
    stripePriceId: definition.envKey ? readStripePriceId(definition.envKey) : ""
  };
}

export function resolveBillingOfferByStripePriceId(priceId?: string | null): BillingOffer | null {
  const normalized = priceId?.trim();
  if (!normalized) return null;

  for (const market of ["gb", "ca"] as const) {
    for (const [packageId, definition] of Object.entries(LOCALIZED_OFFER_DEFINITIONS[market])) {
      if (definition.envKey && readStripePriceId(definition.envKey) === normalized) {
        return resolveBillingOffer({
          packageId: packageId as BillablePackageId,
          market,
          pricingVariant: "1.9"
        });
      }
    }
  }

  return null;
}

export function getLocalizedPublicBillingPackagesForVariant(
  variant: PricingVariant,
  market: BillingMarket,
  options?: { activeOnly?: boolean; includeOneTime?: boolean }
): LocalizedPublicBillingPackage[] {
  const packages = getPublicBillingPackagesForVariant(variant, options);
  const localizedPackages = packages.map((item) => {
    const offer = resolveBillingOffer({ packageId: item.id, market, pricingVariant: variant });
    return {
      ...item,
      displayAmount: offer.amount,
      displayCurrency: offer.currency
    };
  });

  if (market === "default") return localizedPackages;

  return localizedPackages.map((item) => {
    if (item.interval !== "year") return item;
    const monthlyPeer = localizedPackages.find((candidate) => (
      candidate.checkoutPlan === item.checkoutPlan && candidate.interval === "month"
    ));
    if (!monthlyPeer) return item;
    const annualSavings = Math.max(
      0,
      Math.round((monthlyPeer.displayAmount * 12 - item.displayAmount) * 100) / 100
    );
    const savingsLabel = annualSavings > 0
      ? `Save ${formatBillingAmount(annualSavings, item.displayCurrency)}`
      : item.label;
    return {
      ...item,
      modalBadge: savingsLabel,
      ...(item.pricingVariant === "2.5" ? {
        label: savingsLabel,
        modalValueTag: savingsLabel
      } : {})
    };
  });
}

export function formatBillingAmount(value: number, currency: BillingCurrency): string {
  const symbol = currency === "GBP" ? "£" : currency === "CAD" ? "C$" : "$";
  return `${symbol}${value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}`;
}

export function formatCheckoutAmountDueToday(
  displayedPrice: string,
  billingInterval: "month" | "year" | undefined,
  currency: BillingCurrency,
  billingAmount: number
): string {
  if (billingInterval !== "year") return displayedPrice;
  return Number.isFinite(billingAmount)
    ? formatBillingAmount(billingAmount, currency)
    : displayedPrice;
}
