import { retryBillingRead } from "@/lib/billing/read-retry";
import {
  getBillingPackage,
  SUPPORTED_PRICING_VARIANTS,
  type BillingPackageId,
  type PricingVariant
} from "@/lib/billing/catalog";
import type { CreemSubscriptionStatus } from "@/lib/billing/creem";
import type { BillingPaymentProvider } from "@/lib/billing/billing-payments";
import {
  ACTIVE_ENTITLEMENT_STATUSES,
  hasActiveEntitlementPeriod
} from "@/lib/billing/subscription-expiry";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseConfig } from "@/lib/supabase/config";

export type BillingSubscriptionBinding = {
  provider?: BillingPaymentProvider;
  userId: string;
  providerSubscriptionId: string;
  providerCustomerId?: string;
  packageId: BillingPackageId;
  pricingVariant: PricingVariant;
  status?: CreemSubscriptionStatus;
  currentPeriodStartAt?: string;
  currentPeriodEndAt?: string;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string;
};

export type ActiveBillingSubscriptionBinding = {
  packageId: BillingPackageId;
  pricingVariant: PricingVariant;
  provider?: BillingPaymentProvider;
  providerSubscriptionId?: string;
};

export type BillingSubscriptionBindingErrorKind = "transient_read" | "integrity";

export class BillingSubscriptionBindingError extends Error {
  readonly name = "BillingSubscriptionBindingError";

  constructor(
    readonly code:
      | "BILLING_SUBSCRIPTION_BINDING_READ_FAILED"
      | "BILLING_SUBSCRIPTION_PRICING_VARIANT_INVALID",
    readonly kind: BillingSubscriptionBindingErrorKind,
    options?: ErrorOptions
  ) {
    super(code, options);
  }
}

export function isTransientBillingSubscriptionBindingError(
  error: unknown
): error is BillingSubscriptionBindingError {
  return error instanceof BillingSubscriptionBindingError
    && error.kind === "transient_read";
}

function parseStoredPricingVariant(value: unknown): PricingVariant | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  return SUPPORTED_PRICING_VARIANTS.includes(normalized as PricingVariant)
    ? normalized as PricingVariant
    : undefined;
}

function parseBillingPaymentProvider(value: unknown): BillingPaymentProvider | undefined {
  return value === "creem" || value === "stripe" || value === "waffo"
    ? value
    : undefined;
}

export async function upsertBillingSubscriptionBinding(params: BillingSubscriptionBinding): Promise<void> {
  if (!supabaseConfig.adminEnabled) return;

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("billing_subscriptions")
    .upsert(
      {
        provider: params.provider ?? "creem",
        provider_subscription_id: params.providerSubscriptionId,
        provider_customer_id: params.providerCustomerId ?? null,
        user_id: params.userId,
        package_id: params.packageId,
        pricing_variant: params.pricingVariant,
        status: params.status ?? null,
        current_period_start_at: params.currentPeriodStartAt ?? null,
        current_period_end_at: params.currentPeriodEndAt ?? null,
        cancel_at_period_end: params.cancelAtPeriodEnd ?? null,
        canceled_at: params.canceledAt ?? null,
        updated_at: new Date().toISOString()
      },
      { onConflict: "provider,provider_subscription_id" }
    );

  if (error) {
    throw new Error(error.message);
  }
}

export async function readBillingSubscriptionBinding(
  providerSubscriptionId?: string,
  provider: BillingPaymentProvider = "creem"
): Promise<BillingSubscriptionBinding | null> {
  if (!supabaseConfig.adminEnabled || !providerSubscriptionId?.trim()) return null;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("billing_subscriptions")
    .select(
      "user_id, provider_subscription_id, provider_customer_id, package_id, pricing_variant, status, " +
        "current_period_start_at, current_period_end_at, cancel_at_period_end, canceled_at"
    )
    .eq("provider", provider)
    .eq("provider_subscription_id", providerSubscriptionId.trim())
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) return null;

  const row = data as unknown as Record<string, unknown>;
  const billingPackage = getBillingPackage(String(row.package_id));
  if (!billingPackage) return null;
  const pricingVariant = parseStoredPricingVariant(row.pricing_variant);
  if (!pricingVariant) {
    throw new BillingSubscriptionBindingError(
      "BILLING_SUBSCRIPTION_PRICING_VARIANT_INVALID",
      "integrity"
    );
  }

  return {
    userId: String(row.user_id),
    provider,
    providerSubscriptionId: String(row.provider_subscription_id),
    providerCustomerId: typeof row.provider_customer_id === "string" ? row.provider_customer_id : undefined,
    packageId: billingPackage.id,
    pricingVariant,
    status: typeof row.status === "string" ? row.status as CreemSubscriptionStatus : undefined,
    currentPeriodStartAt: typeof row.current_period_start_at === "string" ? row.current_period_start_at : undefined,
    currentPeriodEndAt: typeof row.current_period_end_at === "string" ? row.current_period_end_at : undefined,
    cancelAtPeriodEnd: typeof row.cancel_at_period_end === "boolean" ? row.cancel_at_period_end : undefined,
    canceledAt: typeof row.canceled_at === "string" ? row.canceled_at : undefined
  };
}

export function isBillingSubscriptionPackageForPricingVariant(
  packageId: string,
  pricingVariant: PricingVariant
): boolean {
  const billingPackage = getBillingPackage(packageId);
  return Boolean(
    billingPackage
    && billingPackage.kind === "subscription"
    && billingPackage.pricingVariant === pricingVariant
  );
}

export type ActiveBillingSubscriptionRow = {
  provider?: string | null;
  provider_subscription_id?: string | null;
  package_id?: string | null;
  pricing_variant?: string | null;
  status?: string | null;
  current_period_end_at?: string | null;
};

export type PreferredBillingSubscription = {
  provider?: BillingPaymentProvider | null;
  providerSubscriptionId?: string | null;
};

export function resolvePreferredBillingSubscription(params: {
  billingProvider?: string | null;
  creemSubscriptionId?: string | null;
  stripeSubscriptionId?: string | null;
  waffoSubscriptionId?: string | null;
}): PreferredBillingSubscription {
  const provider = params.billingProvider;
  if (provider === "creem") {
    return { provider, providerSubscriptionId: params.creemSubscriptionId ?? undefined };
  }
  if (provider === "stripe") {
    return { provider, providerSubscriptionId: params.stripeSubscriptionId ?? undefined };
  }
  if (provider === "waffo") {
    return { provider, providerSubscriptionId: params.waffoSubscriptionId ?? undefined };
  }
  return { provider: undefined, providerSubscriptionId: undefined };
}

function selectActiveBillingSubscriptionRow(
  rows: ActiveBillingSubscriptionRow[],
  preferred?: PreferredBillingSubscription
): { row: ActiveBillingSubscriptionRow; packageId: BillingPackageId } | undefined {
  const candidates = rows.flatMap((row) => {
    const billingPackage = getBillingPackage(String(row.package_id));
    if (
      !billingPackage
      || billingPackage.kind !== "subscription"
      || !hasActiveEntitlementPeriod(row.status, row.current_period_end_at)
    ) {
      return [];
    }
    return [{ row, packageId: billingPackage.id }];
  });

  const preferredSubscriptionId = preferred?.providerSubscriptionId?.trim();
  if (preferredSubscriptionId) {
    const exact = candidates.find(({ row }) => (
      row.provider_subscription_id === preferredSubscriptionId
      && (!preferred?.provider || row.provider === preferred.provider)
    ));
    if (exact) return exact;
  }

  const preferredProvider = preferred?.provider;
  if (preferredProvider) {
    const fromCurrentProvider = candidates.find(({ row }) => (
      row.provider === preferredProvider && row.status !== "canceled"
    ));
    if (fromCurrentProvider) return fromCurrentProvider;
  }

  return candidates.find(({ row }) => row.status !== "canceled")
    ?? candidates[0];
}

export function selectActiveBillingSubscriptionPackageId(
  rows: ActiveBillingSubscriptionRow[],
  preferred?: PreferredBillingSubscription
): BillingPackageId | undefined {
  return selectActiveBillingSubscriptionRow(rows, preferred)?.packageId;
}

export function selectActiveBillingSubscriptionBinding(
  rows: ActiveBillingSubscriptionRow[],
  preferred?: PreferredBillingSubscription
): ActiveBillingSubscriptionBinding | undefined {
  const selected = selectActiveBillingSubscriptionRow(rows, preferred);
  if (!selected) return undefined;

  const pricingVariant = parseStoredPricingVariant(selected.row.pricing_variant);
  if (!pricingVariant) {
    throw new BillingSubscriptionBindingError(
      "BILLING_SUBSCRIPTION_PRICING_VARIANT_INVALID",
      "integrity"
    );
  }

  return {
    packageId: selected.packageId,
    pricingVariant,
    provider: parseBillingPaymentProvider(selected.row.provider),
    providerSubscriptionId: selected.row.provider_subscription_id?.trim() || undefined
  };
}

export async function hasActiveBillingSubscriptionForPricingVariant(
  userId: string,
  pricingVariant: PricingVariant
): Promise<boolean> {
  if (!supabaseConfig.adminEnabled || !userId.trim()) return false;

  const admin = getSupabaseAdminClient();
  const { data, error } = await retryBillingRead(() => admin
    .from("billing_subscriptions")
    .select("package_id, status, current_period_end_at")
    .eq("user_id", userId.trim())
    .in("status", [...ACTIVE_ENTITLEMENT_STATUSES])
    .order("updated_at", { ascending: false })
    .limit(10));

  if (error) throw new Error(error.message);

  return (data ?? []).some((row) => {
    if (!isBillingSubscriptionPackageForPricingVariant(String(row.package_id), pricingVariant)) {
      return false;
    }
    return hasActiveEntitlementPeriod(row.status, row.current_period_end_at);
  });
}

export async function getActiveBillingSubscriptionPackageId(
  userId: string,
  preferred?: PreferredBillingSubscription
): Promise<BillingPackageId | undefined> {
  if (!supabaseConfig.adminEnabled || !userId.trim()) return undefined;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("billing_subscriptions")
    .select("provider, provider_subscription_id, package_id, status, current_period_end_at")
    .eq("user_id", userId.trim())
    .in("status", [...ACTIVE_ENTITLEMENT_STATUSES])
    .order("updated_at", { ascending: false })
    .limit(10);

  if (error) throw new Error(error.message);

  return selectActiveBillingSubscriptionPackageId(data ?? [], preferred);
}

export async function getAuthoritativeActiveBillingSubscriptionBinding(
  userId: string
): Promise<ActiveBillingSubscriptionBinding | undefined> {
  if (!supabaseConfig.adminEnabled || !userId.trim()) return undefined;

  const admin = getSupabaseAdminClient();
  const [profileResult, subscriptionsResult] = await Promise.all([
    admin
      .from("profiles")
      .select("billing_provider, creem_subscription_id, stripe_subscription_id, waffo_subscription_id")
      .eq("id", userId.trim())
      .maybeSingle(),
    admin
      .from("billing_subscriptions")
      .select("provider, provider_subscription_id, package_id, pricing_variant, status, current_period_end_at")
      .eq("user_id", userId.trim())
      .in("status", [...ACTIVE_ENTITLEMENT_STATUSES])
      .order("updated_at", { ascending: false })
      .limit(10)
  ]);

  if (profileResult.error) {
    throw new BillingSubscriptionBindingError(
      "BILLING_SUBSCRIPTION_BINDING_READ_FAILED",
      "transient_read",
      { cause: profileResult.error }
    );
  }
  if (subscriptionsResult.error) {
    throw new BillingSubscriptionBindingError(
      "BILLING_SUBSCRIPTION_BINDING_READ_FAILED",
      "transient_read",
      { cause: subscriptionsResult.error }
    );
  }

  const profile = profileResult.data;
  const preferred = resolvePreferredBillingSubscription({
    billingProvider: profile?.billing_provider,
    creemSubscriptionId: profile?.creem_subscription_id,
    stripeSubscriptionId: profile?.stripe_subscription_id,
    waffoSubscriptionId: profile?.waffo_subscription_id
  });
  return selectActiveBillingSubscriptionBinding(subscriptionsResult.data ?? [], preferred);
}
