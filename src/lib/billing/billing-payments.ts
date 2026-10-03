import { requireBillingPackage, type BillingPackageId, type PricingVariant } from "@/lib/billing/catalog";
import type { CreditLedgerEntry } from "@/lib/billing/credits";
import type { CompletedRechargePayload, VerifiedCreemRechargePayment } from "@/lib/billing/creem";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseConfig } from "@/lib/supabase/config";

export type BillingPaymentProvider = "creem" | "stripe" | "waffo";

export type BillingPaymentRecord = {
  id: string;
  userId: string;
  providerTransactionId: string;
  providerOrderId?: string;
  entitlementStatus: "pending" | "granted" | "failed" | "ignored";
  entitlementLedgerId?: string;
};

function paymentEnvironment(testMode?: boolean): "test" | "live" {
  return testMode ? "test" : "live";
}

export function normalizeImageUnlockPaymentAmount(params: {
  amountPaid: number;
  taxAmount?: number;
  currency: string;
}): { amountPaidMinor: number; taxAmountMinor: number | null; currency: string } {
  if (!Number.isFinite(params.amountPaid) || params.amountPaid <= 0) {
    throw new Error("IMAGE_UNLOCK_PAYMENT_AMOUNT_INVALID");
  }
  const currency = params.currency.trim().toUpperCase();
  if (!currency) {
    throw new Error("IMAGE_UNLOCK_PAYMENT_CURRENCY_MISSING");
  }
  return {
    amountPaidMinor: Math.round(params.amountPaid * 100),
    taxAmountMinor: typeof params.taxAmount === "number"
      ? Math.round(params.taxAmount * 100)
      : null,
    currency
  };
}

function toPaymentRecord(row: Record<string, unknown>): BillingPaymentRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    providerTransactionId: String(row.provider_transaction_id),
    providerOrderId: typeof row.provider_order_id === "string" ? row.provider_order_id : undefined,
    entitlementStatus: (
      row.entitlement_status === "granted"
      || row.entitlement_status === "failed"
      || row.entitlement_status === "ignored"
        ? row.entitlement_status
        : "pending"
    ),
    entitlementLedgerId: typeof row.entitlement_ledger_id === "string" ? row.entitlement_ledger_id : undefined
  };
}

export async function readBillingPaymentByProviderTransaction(
  provider: BillingPaymentProvider,
  transactionId: string
): Promise<BillingPaymentRecord | null> {
  if (!supabaseConfig.adminEnabled) return null;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("billing_payments")
    .select("id,user_id,provider_transaction_id,provider_order_id,entitlement_status,entitlement_ledger_id")
    .eq("provider", provider)
    .eq("provider_transaction_id", transactionId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data ? toPaymentRecord(data as Record<string, unknown>) : null;
}

export type VerifiedRechargePaymentUpsertParams = {
  provider?: BillingPaymentProvider;
  userId: string;
  packageId: BillingPackageId;
  pricingVariant?: PricingVariant;
  paymentKind?: "recharge" | "subscription";
  completed: CompletedRechargePayload;
  verifiedPayment: VerifiedCreemRechargePayment;
  seenSource: "webhook" | "sync_checkout";
  rawEventId?: string;
  rawEventType?: string;
  rawPayload?: unknown;
};

export function buildVerifiedRechargePaymentWritePayload(
  params: VerifiedRechargePaymentUpsertParams,
  seenAt: string,
  existing: boolean
): Record<string, unknown> {
  const checkoutId = params.completed.checkoutId
    ?? (params.seenSource === "sync_checkout" ? params.completed.eventId : undefined);
  const payload: Record<string, unknown> = {
    provider_order_id: params.verifiedPayment.orderId ?? params.completed.orderId ?? null,
    provider_customer_id: params.verifiedPayment.customerId ?? params.completed.customerId ?? null,
    package_id: params.packageId,
    pricing_variant: params.pricingVariant ?? null,
    payment_kind: params.paymentKind ?? "recharge",
    status: params.verifiedPayment.status,
    amount: params.verifiedPayment.amount,
    amount_paid: params.verifiedPayment.amountPaid,
    tax_amount: params.verifiedPayment.taxAmount,
    currency: params.verifiedPayment.currency,
    verified_payload: params.verifiedPayment.raw,
    verified_at: seenAt,
    last_seen_source: params.seenSource,
    last_seen_at: seenAt
  };
  if (checkoutId) payload.provider_checkout_id = checkoutId;
  // A browser sync verifies the charge but only carries reduced event context.
  // Once the signed webhook has supplied the original provider event, retain it.
  if (!existing || params.seenSource === "webhook") {
    payload.raw_event_id = params.rawEventId ?? params.completed.eventId;
    payload.raw_event_type = params.rawEventType ?? null;
    payload.raw_payload = params.rawPayload ?? {};
  }
  return payload;
}

export async function upsertVerifiedRechargePayment(
  params: VerifiedRechargePaymentUpsertParams
): Promise<BillingPaymentRecord | null> {
  if (!supabaseConfig.adminEnabled) return null;

  const provider = params.provider ?? "creem";
  const seenAt = new Date().toISOString();
  const checkoutId = params.completed.checkoutId
    ?? (params.seenSource === "sync_checkout" ? params.completed.eventId : undefined);
  const admin = getSupabaseAdminClient();
  const updateExisting = async (existing: BillingPaymentRecord): Promise<BillingPaymentRecord> => {
    if (existing.userId !== params.userId) {
      throw new Error("BILLING_PAYMENT_USER_MISMATCH");
    }
    const { data, error } = await admin
      .from("billing_payments")
      .update(buildVerifiedRechargePaymentWritePayload(params, seenAt, true))
      .eq("id", existing.id)
      .select("id,user_id,provider_transaction_id,provider_order_id,entitlement_status,entitlement_ledger_id")
      .single();
    if (error) throw new Error(error.message);
    return toPaymentRecord(data as Record<string, unknown>);
  };
  const existing = await readBillingPaymentByProviderTransaction(provider, params.verifiedPayment.transactionId);
  if (existing) {
    return updateExisting(existing);
  }

  const { data, error } = await admin
    .from("billing_payments")
    .insert({
      provider,
      provider_environment: paymentEnvironment(params.completed.testMode),
      provider_transaction_id: params.verifiedPayment.transactionId,
      provider_checkout_id: checkoutId ?? null,
      user_id: params.userId,
      entitlement_status: "pending",
      first_seen_source: params.seenSource,
      first_seen_at: seenAt,
      ...buildVerifiedRechargePaymentWritePayload(params, seenAt, false)
    })
    .select("id,user_id,provider_transaction_id,provider_order_id,entitlement_status,entitlement_ledger_id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const conflicted = await readBillingPaymentByProviderTransaction(provider, params.verifiedPayment.transactionId);
      return conflicted ? updateExisting(conflicted) : null;
    }
    throw new Error(error.message);
  }
  return toPaymentRecord(data as Record<string, unknown>);
}

export type ObservedRechargePaymentUpsertParams = {
  provider?: BillingPaymentProvider;
  userId: string;
  packageId: BillingPackageId;
  pricingVariant?: PricingVariant;
  paymentKind: "recharge" | "subscription";
  completed: CompletedRechargePayload;
  seenSource: "webhook" | "sync_checkout";
  rawEventId?: string;
  rawEventType?: string;
  rawPayload?: unknown;
};

export function resolveObservedPaymentTransactionId(
  params: ObservedRechargePaymentUpsertParams
): string | undefined {
  const provider = params.provider ?? "creem";
  if (provider === "stripe" && params.paymentKind === "subscription") {
    return params.completed.orderId?.trim() || params.completed.transactionId?.trim() || undefined;
  }
  if (provider === "waffo" && params.paymentKind === "subscription") {
    return params.completed.idempotencyKey?.trim() || params.completed.transactionId?.trim() || undefined;
  }
  return params.completed.transactionId?.trim() || undefined;
}

export function buildObservedRechargePaymentWritePayload(
  params: ObservedRechargePaymentUpsertParams,
  seenAt: string,
  existing: boolean
): Record<string, unknown> {
  const billingPackage = requireBillingPackage(params.packageId);
  const currency = params.completed.currency?.trim().toUpperCase() || billingPackage.currency;
  const amountPaidMinor = typeof params.completed.amountPaid === "number"
    ? Math.round(params.completed.amountPaid * 100)
    : null;
  const payload: Record<string, unknown> = {
    package_id: params.packageId,
    pricing_variant: params.pricingVariant ?? null,
    payment_kind: params.paymentKind,
    status: "paid",
    amount: amountPaidMinor,
    amount_paid: amountPaidMinor,
    currency,
    last_seen_source: params.seenSource,
    last_seen_at: seenAt
  };
  if (!existing || params.completed.orderId) {
    payload.provider_order_id = params.completed.orderId ?? null;
  }
  if (!existing || params.completed.checkoutId) {
    payload.provider_checkout_id = params.completed.checkoutId ?? null;
  }
  if (!existing || params.completed.customerId) {
    payload.provider_customer_id = params.completed.customerId ?? null;
  }

  if (!existing || params.seenSource === "webhook") {
    payload.raw_event_id = params.rawEventId ?? params.completed.eventId;
    payload.raw_event_type = params.rawEventType ?? null;
    payload.raw_payload = params.rawPayload ?? {};
  }
  return payload;
}

export async function upsertObservedRechargePayment(
  params: ObservedRechargePaymentUpsertParams
): Promise<BillingPaymentRecord | null> {
  if (!supabaseConfig.adminEnabled) return null;

  const provider = params.provider ?? "creem";
  const transactionId = resolveObservedPaymentTransactionId(params);
  if (!transactionId) return null;

  const seenAt = new Date().toISOString();
  const admin = getSupabaseAdminClient();
  const updateExisting = async (existing: BillingPaymentRecord): Promise<BillingPaymentRecord> => {
    if (existing.userId !== params.userId) throw new Error("BILLING_PAYMENT_USER_MISMATCH");
    const { data, error } = await admin
      .from("billing_payments")
      .update(buildObservedRechargePaymentWritePayload(params, seenAt, true))
      .eq("id", existing.id)
      .select("id,user_id,provider_transaction_id,provider_order_id,entitlement_status,entitlement_ledger_id")
      .single();
    if (error) throw new Error(error.message);
    return toPaymentRecord(data as Record<string, unknown>);
  };

  const existing = await readBillingPaymentByProviderTransaction(provider, transactionId);
  if (existing) {
    return updateExisting(existing);
  }

  const { data, error } = await admin
    .from("billing_payments")
    .insert({
      provider,
      provider_environment: paymentEnvironment(params.completed.testMode),
      provider_transaction_id: transactionId,
      user_id: params.userId,
      entitlement_status: "pending",
      tax_amount: null,
      verified_payload: {},
      verified_at: null,
      first_seen_source: params.seenSource,
      first_seen_at: seenAt,
      ...buildObservedRechargePaymentWritePayload(params, seenAt, false)
    })
    .select("id,user_id,provider_transaction_id,provider_order_id,entitlement_status,entitlement_ledger_id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const conflicted = await readBillingPaymentByProviderTransaction(provider, transactionId);
      return conflicted ? updateExisting(conflicted) : null;
    }
    throw new Error(error.message);
  }
  return toPaymentRecord(data as Record<string, unknown>);
}

export type ImageUnlockPaymentUpsertParams = {
  provider: BillingPaymentProvider;
  userId: string;
  transactionId?: string;
  orderId?: string;
  checkoutId?: string;
  customerId?: string;
  amountPaid: number;
  taxAmount?: number;
  currency: string;
  pricingVariant?: PricingVariant;
  testMode?: boolean;
  seenSource: "webhook" | "sync_checkout";
  rawEventId?: string;
  rawEventType?: string;
  rawPayload?: unknown;
};

export function buildImageUnlockPaymentWritePayload(
  params: ImageUnlockPaymentUpsertParams,
  seenAt: string,
  existing: boolean
): Record<string, unknown> {
  const { amountPaidMinor, taxAmountMinor, currency } = normalizeImageUnlockPaymentAmount(params);
  const payload: Record<string, unknown> = {
    package_id: "image_unlock_single",
    pricing_variant: params.pricingVariant ?? null,
    payment_kind: "image_unlock",
    status: "paid",
    amount: amountPaidMinor,
    amount_paid: amountPaidMinor,
    tax_amount: taxAmountMinor,
    currency,
    last_seen_source: params.seenSource,
    last_seen_at: seenAt
  };
  if (!existing || params.orderId) payload.provider_order_id = params.orderId ?? null;
  if (!existing || params.checkoutId) payload.provider_checkout_id = params.checkoutId ?? null;
  if (!existing || params.customerId) payload.provider_customer_id = params.customerId ?? null;

  // Once a webhook has supplied authoritative event evidence, a later browser
  // checkout sync must not replace it with a reduced checkout payload.
  if (!existing || params.seenSource === "webhook") {
    payload.raw_event_id = params.rawEventId ?? null;
    payload.raw_event_type = params.rawEventType ?? null;
    payload.raw_payload = params.rawPayload ?? {};
    payload.verified_payload = params.rawPayload ?? {};
    payload.verified_at = seenAt;
  }

  return payload;
}

export async function upsertImageUnlockPayment(
  params: ImageUnlockPaymentUpsertParams
): Promise<BillingPaymentRecord | null> {
  if (!supabaseConfig.adminEnabled) return null;

  const transactionId = params.transactionId?.trim()
    || params.orderId?.trim()
    || params.checkoutId?.trim()
    || params.rawEventId?.trim();
  if (!transactionId) {
    throw new Error("IMAGE_UNLOCK_PAYMENT_ID_MISSING");
  }
  const seenAt = new Date().toISOString();
  const admin = getSupabaseAdminClient();
  const updateExisting = async (existing: BillingPaymentRecord): Promise<BillingPaymentRecord> => {
    if (existing.userId !== params.userId) throw new Error("BILLING_PAYMENT_USER_MISMATCH");
    const { data, error } = await admin
      .from("billing_payments")
      .update(buildImageUnlockPaymentWritePayload(params, seenAt, true))
      .eq("id", existing.id)
      .select("id,user_id,provider_transaction_id,provider_order_id,entitlement_status,entitlement_ledger_id")
      .single();
    if (error) throw new Error(error.message);
    return toPaymentRecord(data as Record<string, unknown>);
  };

  const existing = await readBillingPaymentByProviderTransaction(params.provider, transactionId);
  if (existing) {
    return updateExisting(existing);
  }

  const { data, error } = await admin
    .from("billing_payments")
    .insert({
      provider: params.provider,
      provider_environment: paymentEnvironment(params.testMode),
      provider_transaction_id: transactionId,
      user_id: params.userId,
      entitlement_status: "pending",
      first_seen_source: params.seenSource,
      first_seen_at: seenAt,
      ...buildImageUnlockPaymentWritePayload(params, seenAt, false)
    })
    .select("id,user_id,provider_transaction_id,provider_order_id,entitlement_status,entitlement_ledger_id")
    .single();
  if (error) {
    if (error.code === "23505") {
      const conflicted = await readBillingPaymentByProviderTransaction(params.provider, transactionId);
      return conflicted ? updateExisting(conflicted) : null;
    }
    throw new Error(error.message);
  }
  return toPaymentRecord(data as Record<string, unknown>);
}

export async function markBillingPaymentEntitlementGranted(params: {
  paymentId?: string;
  ledger?: CreditLedgerEntry | { id: string };
}): Promise<void> {
  if (!supabaseConfig.adminEnabled || !params.paymentId) return;

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("billing_payments")
    .update({
      entitlement_status: "granted",
      entitlement_ledger_id: params.ledger?.id ?? null,
      entitlement_error: null
    })
    .eq("id", params.paymentId);
  if (error) {
    throw new Error(error.message);
  }

  const { error: grantedAtError } = await admin
    .from("billing_payments")
    .update({ entitlement_granted_at: new Date().toISOString() })
    .eq("id", params.paymentId)
    .is("entitlement_granted_at", null);
  if (grantedAtError) {
    throw new Error(grantedAtError.message);
  }
}

export async function markBillingPaymentEntitlementFailed(params: {
  paymentId?: string;
  error: unknown;
}): Promise<void> {
  if (!supabaseConfig.adminEnabled || !params.paymentId) return;

  const message = params.error instanceof Error ? params.error.message : String(params.error);
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("billing_payments")
    .update({
      entitlement_status: "failed",
      entitlement_error: message.slice(0, 2000)
    })
    .eq("id", params.paymentId)
    .neq("entitlement_status", "granted");
  if (error) {
    throw new Error(error.message);
  }
}
