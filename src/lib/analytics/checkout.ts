import { getBillingPackage, type BillingPackageId, type CheckoutPlan } from "@/lib/billing/catalog";

const CHECKOUT_CONTEXT_KEY = "vismuse:checkout_context";
const CHECKOUT_CONTEXT_FALLBACK_KEY = "vismuse:checkout_context:auto_create_fallback";
const CHECKOUT_CONTEXT_PENDING_KEY = "vismuse:checkout_context:pending";
export const CHECKOUT_RECOVERY_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const IMAGE_UNLOCK_PACKAGE_ID = "image_unlock_single";
const IMAGE_UNLOCK_PRICE_USD = 6.99;
const IMAGE_UNLOCK_V14_PRICE_USD = 2.99;
const IMAGE_UNLOCK_V19_PRICE_USD = 9.99;
const IMAGE_UNLOCK_STARTER_CREDITS = 100;
const IMAGE_UNLOCK_V14_STARTER_CREDITS = 100;

export type CheckoutContext = {
  package_id?: string;
  checkout_plan?: string;
  checkout_scenario?: string;
  entry?: string;
  billing_surface?: string;
  checkout_id?: string;
  provider?: string;
  transaction_id?: string;
  plan?: string;
  price?: number;
  value?: number;
  revenue?: number;
  currency?: string;
  credits?: number;
  asset_id?: string;
  job_id?: string;
  session_id?: string;
  return_path?: string;
  guest_id?: string;
  auto_create_checkout?: boolean;
  created_at?: string;
  discount_code?: string;
  pricing_variant?: string;
  pricing_experiment_key?: string;
  generation_resolution_experiment_key?: string;
  generation_resolution_experiment_variant?: string;
  generation_resolution_experiment_source?: string;
  saved_at?: number;
};

export type CheckoutAnalyticsProperties = CheckoutContext & Record<string, unknown>;

type CheckoutReturnSearchParams = Pick<URLSearchParams, "get">;

export type CheckoutPackageAnalytics = {
  package_id: BillingPackageId | "image_unlock_single";
  checkout_plan: CheckoutPlan | "image_unlock";
  value: number;
  currency: "USD";
  credits: number;
  original_value?: number;
  discount_percent?: number;
  discount_amount?: number;
};

function roundCurrencyValue(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function discountedPackageValue(value: number, discountPercent?: number): number {
  if (!discountPercent || discountPercent <= 0) return roundCurrencyValue(value);
  return roundCurrencyValue(value * (1 - discountPercent / 100));
}

function explicitCheckoutValue(context: CheckoutAnalyticsProperties): number | undefined {
  for (const candidate of [context.value, context.price, context.revenue]) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0) {
      return roundCurrencyValue(candidate);
    }
  }
  return undefined;
}

export function checkoutPlanFromPackageId(packageId?: string | null): CheckoutPlan | "image_unlock" | undefined {
  const billingPackage = getBillingPackage(packageId);
  if (billingPackage) return billingPackage.checkoutPlan;
  if (packageId === IMAGE_UNLOCK_PACKAGE_ID) return "image_unlock";
  return undefined;
}

export function checkoutPackageAnalytics(packageId?: string | null): CheckoutPackageAnalytics | undefined {
  const billingPackage = getBillingPackage(packageId);
  if (billingPackage) {
    const originalValue = roundCurrencyValue(billingPackage.usdAmount);
    const value = discountedPackageValue(originalValue, billingPackage.discountPercent);
    const discountAmount = billingPackage.discountPercent ? roundCurrencyValue(originalValue - value) : undefined;
    return {
      package_id: billingPackage.id,
      checkout_plan: billingPackage.checkoutPlan,
      value,
      currency: "USD",
      credits: billingPackage.credits,
      ...(billingPackage.discountPercent ? {
        original_value: originalValue,
        discount_percent: billingPackage.discountPercent,
        discount_amount: discountAmount
      } : {})
    };
  }
  if (packageId === IMAGE_UNLOCK_PACKAGE_ID) {
    return {
      package_id: packageId,
      checkout_plan: "image_unlock",
      value: IMAGE_UNLOCK_PRICE_USD,
      currency: "USD",
      credits: IMAGE_UNLOCK_STARTER_CREDITS
    };
  }
  return undefined;
}

export function buildCheckoutAnalyticsProperties(
  packageId?: string | null,
  context: CheckoutAnalyticsProperties = {}
): CheckoutAnalyticsProperties {
  const resolvedPackageId = packageId || context.package_id;
  const packageAnalytics = checkoutPackageAnalytics(resolvedPackageId);
  const checkoutPlan = packageAnalytics?.checkout_plan || checkoutPlanFromPackageId(resolvedPackageId);
  const imageUnlockV14 = resolvedPackageId === IMAGE_UNLOCK_PACKAGE_ID && context.pricing_variant === "1.4";
  const imageUnlockV19 = resolvedPackageId === IMAGE_UNLOCK_PACKAGE_ID
    && (context.pricing_variant === "1.9" || context.pricing_variant === "2.3" || context.pricing_variant === "2.4" || context.pricing_variant === "2.5");
  const contextValue = explicitCheckoutValue(context);
  const resolvedValue = contextValue
    ?? (imageUnlockV19
      ? IMAGE_UNLOCK_V19_PRICE_USD
      : imageUnlockV14
        ? IMAGE_UNLOCK_V14_PRICE_USD
        : packageAnalytics?.value);
  const resolvedCredits = imageUnlockV14 ? IMAGE_UNLOCK_V14_STARTER_CREDITS : packageAnalytics?.credits;
  const originalValue = packageAnalytics?.original_value;

  return {
    ...context,
    package_id: packageAnalytics?.package_id || resolvedPackageId || context.package_id,
    checkout_plan: checkoutPlan || context.checkout_plan,
    plan: checkoutPlan || context.plan,
    price: resolvedValue ?? context.price,
    value: resolvedValue ?? context.value,
    revenue: resolvedValue ?? context.revenue,
    currency: context.currency || packageAnalytics?.currency,
    credits: resolvedCredits ?? context.credits,
    ...(originalValue ? {
      original_price: originalValue,
      original_value: originalValue
    } : {}),
    ...(packageAnalytics?.discount_percent ? { discount_percent: packageAnalytics.discount_percent } : {}),
    ...(packageAnalytics?.discount_amount ? { discount_amount: packageAnalytics.discount_amount } : {})
  };
}

export function rememberCheckoutContext(context: CheckoutContext): void {
  if (typeof window === "undefined") return;
  let serialized: string;
  try {
    serialized = JSON.stringify({
      ...context,
      saved_at: Date.now()
    });
  } catch {
    return;
  }
  try {
    window.sessionStorage.setItem(CHECKOUT_CONTEXT_KEY, serialized);
  } catch {
    // Continue with durable storage when session storage is unavailable.
  }
  if (context.checkout_id?.trim()) {
    try {
      window.localStorage.setItem(CHECKOUT_CONTEXT_PENDING_KEY, serialized);
    } catch {
      // Checkout should never depend on analytics storage availability.
    }
  } else {
    try {
      window.localStorage.removeItem(CHECKOUT_CONTEXT_PENDING_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
  }
  if (context.auto_create_checkout === true) {
    try {
      window.localStorage.setItem(CHECKOUT_CONTEXT_FALLBACK_KEY, serialized);
    } catch {
      // Checkout should never depend on analytics storage availability.
    }
  } else {
    try {
      window.localStorage.removeItem(CHECKOUT_CONTEXT_FALLBACK_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
  }
}

export function readCheckoutContext(): CheckoutContext {
  if (typeof window === "undefined") return {};
  const sources = [
    { storage: window.sessionStorage, key: CHECKOUT_CONTEXT_KEY },
    { storage: window.localStorage, key: CHECKOUT_CONTEXT_PENDING_KEY },
    { storage: window.localStorage, key: CHECKOUT_CONTEXT_FALLBACK_KEY }
  ];
  const candidates: Array<{ parsed: CheckoutContext; raw: string; savedAt: number }> = [];
  const now = Date.now();

  for (const source of sources) {
    try {
      const raw = source.storage.getItem(source.key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as CheckoutContext;
      if (!parsed || typeof parsed !== "object") {
        source.storage.removeItem(source.key);
        continue;
      }
      if (
        parsed.checkout_id?.trim()
        && (
          typeof parsed.saved_at !== "number"
          || !Number.isFinite(parsed.saved_at)
          || parsed.saved_at > now
          || now - parsed.saved_at > CHECKOUT_RECOVERY_MAX_AGE_MS
        )
      ) {
        source.storage.removeItem(source.key);
        continue;
      }
      candidates.push({
        parsed,
        raw,
        savedAt: typeof parsed.saved_at === "number" && Number.isFinite(parsed.saved_at)
          ? parsed.saved_at
          : 0
      });
    } catch {
      try {
        source.storage.removeItem(source.key);
      } catch {
        // Continue to the next storage fallback.
      }
    }
  }

  const selected = candidates.sort((left, right) => right.savedAt - left.savedAt)[0];
  if (!selected) return {};
  try {
    window.sessionStorage.setItem(CHECKOUT_CONTEXT_KEY, selected.raw);
  } catch {
    // Reading a valid context must not depend on session storage availability.
  }
  return selected.parsed;
}

export function mergeCheckoutReturnContext(
  stored: CheckoutContext,
  searchParams: CheckoutReturnSearchParams
): CheckoutContext {
  const returnedCheckoutId = searchParams.get("checkout_id")?.trim();
  const returnedPackageId = searchParams.get("package_id")?.trim();
  const returnedAssetId = searchParams.get("asset_id")?.trim();
  const returnedJobId = searchParams.get("job_id")?.trim();
  const returnedSessionId = searchParams.get("session_id")?.trim();
  const returnedProvider = searchParams.get("payment_provider")?.trim().toLowerCase();
  const paymentProvider = returnedProvider === "creem" || returnedProvider === "stripe" || returnedProvider === "waffo"
    ? returnedProvider
    : undefined;

  return {
    ...stored,
    ...(returnedCheckoutId ? { checkout_id: returnedCheckoutId } : {}),
    ...(returnedPackageId ? { package_id: returnedPackageId } : {}),
    ...(returnedAssetId ? { asset_id: returnedAssetId } : {}),
    ...(returnedJobId ? { job_id: returnedJobId } : {}),
    ...(returnedSessionId ? { session_id: returnedSessionId } : {}),
    ...(paymentProvider ? { provider: paymentProvider } : {})
  };
}

export function clearCheckoutContext(): void {
  if (typeof window === "undefined") return;
  for (const { storage, key } of [
    { storage: window.sessionStorage, key: CHECKOUT_CONTEXT_KEY },
    { storage: window.localStorage, key: CHECKOUT_CONTEXT_FALLBACK_KEY },
    { storage: window.localStorage, key: CHECKOUT_CONTEXT_PENDING_KEY }
  ]) {
    try {
      storage.removeItem(key);
    } catch {
      // Continue clearing the remaining storage copies.
    }
  }
}
