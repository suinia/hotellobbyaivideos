import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseConfig } from "@/lib/supabase/config";
import { getBillingPackage, type BillingPackageId } from "@/lib/billing/catalog";
import {
  isExpiringCreditPackPackageId,
  resolveAnnualSubscriptionMonthlyEntitlementAt,
  resolveSubscriptionCreditExpiry
} from "@/lib/billing/credits";

type CreditLotConsumptionRow = {
  ledger_id?: string | null;
  lot_id?: string | null;
};

type CreditLotKindRow = {
  id?: string | null;
  credit_kind?: "free" | "paid" | null;
};

type CreditLotBalanceRow = {
  source_ledger_id?: string | null;
  source_type?: "grant" | "refund" | null;
  source_package_id?: BillingPackageId | null;
  credit_kind?: "free" | "paid" | null;
  original_amount?: number | null;
  remaining_amount?: number | null;
  expires_at?: string | null;
  created_at?: string | null;
};

export type SubscriptionCreditWindow = {
  packageId: BillingPackageId;
  startsAt: string;
  endsAt: string;
};

export type CreditKindBalances = {
  paid: number;
  free: number;
  paidTotal: number;
  freeTotal: number;
  paidExpiring: number;
  freeExpiring: number;
  paidExpiringTotal: number;
  freeExpiringTotal: number;
  paidPackExpiring: number;
  paidPackExpiringTotal: number;
  paidPermanent: number;
  freePermanent: number;
  paidExpiresAt?: string;
  paidPackExpiresAt?: string;
  freeExpiresAt?: string;
};

export function isPaidCreditKind(value?: string | null): boolean {
  return value === "paid";
}

export function resolveCurrentSubscriptionCreditWindow(params: {
  packageId?: BillingPackageId;
  currentPeriodStartAt?: string | null;
  currentPeriodEndAt?: string | null;
  now?: number;
}): SubscriptionCreditWindow | undefined {
  const billingPackage = params.packageId ? getBillingPackage(params.packageId) : undefined;
  const periodStart = params.currentPeriodStartAt
    ? new Date(params.currentPeriodStartAt)
    : undefined;
  const periodEnd = params.currentPeriodEndAt
    ? new Date(params.currentPeriodEndAt)
    : undefined;
  const now = params.now ?? Date.now();
  if (
    !billingPackage
    || billingPackage.kind !== "subscription"
    || !periodStart
    || !periodEnd
    || !Number.isFinite(periodStart.getTime())
    || !Number.isFinite(periodEnd.getTime())
    || periodStart.getTime() > now
    || periodEnd.getTime() <= now
  ) {
    return undefined;
  }

  if (billingPackage.interval !== "year") {
    return {
      packageId: billingPackage.id,
      startsAt: periodStart.toISOString(),
      endsAt: periodEnd.toISOString()
    };
  }

  const monthlyEntitlementAt = resolveAnnualSubscriptionMonthlyEntitlementAt({
    packageId: billingPackage.id,
    currentPeriodStartAt: periodStart,
    currentPeriodEndAt: periodEnd,
    now: new Date(now)
  });
  const monthlyExpiry = monthlyEntitlementAt
    ? resolveSubscriptionCreditExpiry({
        packageId: billingPackage.id,
        currentPeriodStartAt: periodStart,
        currentPeriodEndAt: periodEnd,
        monthlyEntitlementAt
      })
    : undefined;
  if (!monthlyEntitlementAt || !monthlyExpiry) return undefined;

  return {
    packageId: billingPackage.id,
    startsAt: monthlyEntitlementAt.toISOString(),
    endsAt: monthlyExpiry
  };
}

const SUBSCRIPTION_CREDIT_TIME_TOLERANCE_MS = 5 * 60 * 1_000;

function matchesSubscriptionCreditWindowTime(
  row: CreditLotBalanceRow,
  window?: SubscriptionCreditWindow
): boolean {
  if (!window || !row.created_at || !row.expires_at) return false;
  const createdAt = new Date(row.created_at).getTime();
  const expiresAt = new Date(row.expires_at).getTime();
  const windowStart = new Date(window.startsAt).getTime();
  const windowEnd = new Date(window.endsAt).getTime();
  if (![createdAt, expiresAt, windowStart, windowEnd].every(Number.isFinite)) return false;

  return (
    createdAt >= windowStart - SUBSCRIPTION_CREDIT_TIME_TOLERANCE_MS
    && createdAt < windowEnd + SUBSCRIPTION_CREDIT_TIME_TOLERANCE_MS
    && Math.abs(expiresAt - windowEnd) <= SUBSCRIPTION_CREDIT_TIME_TOLERANCE_MS
  );
}

export function summarizeCreditKindBalances(
  rows: CreditLotBalanceRow[],
  now = Date.now(),
  subscriptionWindow?: SubscriptionCreditWindow
): CreditKindBalances {
  const currentPackageGrantExpiries = rows
    .filter((row) => (
      row.source_type === "grant"
      && row.source_package_id === subscriptionWindow?.packageId
      && matchesSubscriptionCreditWindowTime(row, subscriptionWindow)
      && row.expires_at
    ))
    .map((row) => new Date(row.expires_at!).getTime());

  const belongsToCurrentSubscription = (row: CreditLotBalanceRow): boolean => {
    if (!matchesSubscriptionCreditWindowTime(row, subscriptionWindow)) return false;
    if (row.source_type === "grant") {
      return row.source_package_id === subscriptionWindow?.packageId;
    }
    if (row.source_type !== "refund" || !row.expires_at) return false;

    const refundExpiry = new Date(row.expires_at).getTime();
    return currentPackageGrantExpiries.some((grantExpiry) => (
      Math.abs(grantExpiry - refundExpiry) <= SUBSCRIPTION_CREDIT_TIME_TOLERANCE_MS
    ));
  };

  return rows.reduce<CreditKindBalances>((balances, row) => {
    const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : undefined;
    if (expiresAt !== undefined && (!Number.isFinite(expiresAt) || expiresAt <= now)) {
      return balances;
    }

    const remaining = Math.max(0, Math.floor(Number(row.remaining_amount) || 0));
    const original = Math.max(
      remaining,
      Math.floor(Number(row.original_amount ?? row.remaining_amount) || 0)
    );
    const paidKind = isPaidCreditKind(row.credit_kind);
    if (paidKind) {
      balances.paid += remaining;
    } else {
      balances.free += remaining;
    }

    if (expiresAt !== undefined) {
      if (paidKind) {
        if (row.source_type === "grant") {
          balances.paidTotal += original;
        }
        if (belongsToCurrentSubscription(row)) {
          balances.paidExpiring += remaining;
          if (
            row.source_type === "grant"
            && row.source_package_id === subscriptionWindow?.packageId
          ) {
            balances.paidExpiringTotal += original;
          }
          if (!balances.paidExpiresAt || expiresAt < new Date(balances.paidExpiresAt).getTime()) {
            balances.paidExpiresAt = row.expires_at ?? undefined;
          }
        } else if (row.source_package_id && isExpiringCreditPackPackageId(row.source_package_id)) {
          balances.paidPackExpiring += remaining;
          if (row.source_type === "grant") {
            balances.paidPackExpiringTotal += original;
          }
          if (!balances.paidPackExpiresAt || expiresAt < new Date(balances.paidPackExpiresAt).getTime()) {
            balances.paidPackExpiresAt = row.expires_at ?? undefined;
          }
        }
      } else {
        balances.freeExpiring += remaining;
        balances.freeExpiringTotal += original;
        balances.freeTotal += original;
        if (!balances.freeExpiresAt || expiresAt < new Date(balances.freeExpiresAt).getTime()) {
          balances.freeExpiresAt = row.expires_at ?? undefined;
        }
      }
    } else if (remaining > 0) {
      if (paidKind) {
        balances.paidPermanent += remaining;
        balances.paidTotal += remaining;
      } else {
        balances.freePermanent += remaining;
        balances.freeTotal += remaining;
      }
    }
    return balances;
  }, {
    paid: 0,
    free: 0,
    paidTotal: 0,
    freeTotal: 0,
    paidExpiring: 0,
    freeExpiring: 0,
    paidExpiringTotal: 0,
    freeExpiringTotal: 0,
    paidPackExpiring: 0,
    paidPackExpiringTotal: 0,
    paidPermanent: 0,
    freePermanent: 0
  });
}

export async function getCreditKindBalances(
  userId: string,
  subscriptionWindow?: SubscriptionCreditWindow
): Promise<CreditKindBalances> {
  const normalizedUserId = userId.trim();
  if (!supabaseConfig.adminEnabled || !normalizedUserId) {
    return {
      paid: 0,
      free: 0,
      paidTotal: 0,
      freeTotal: 0,
      paidExpiring: 0,
      freeExpiring: 0,
      paidExpiringTotal: 0,
      freeExpiringTotal: 0,
      paidPackExpiring: 0,
      paidPackExpiringTotal: 0,
      paidPermanent: 0,
      freePermanent: 0
    };
  }

  const admin = getSupabaseAdminClient();
  const now = Date.now();
  const { data, error } = await admin
    .from("credit_lots")
    .select("source_ledger_id, credit_kind, original_amount, remaining_amount, expires_at, created_at")
    .eq("user_id", normalizedUserId)
    .or(`expires_at.is.null,expires_at.gt.${new Date(now).toISOString()}`);
  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as CreditLotBalanceRow[]).filter((row) => (
    row.expires_at !== null || Math.max(0, Number(row.remaining_amount) || 0) > 0
  ));
  const sourceLedgerIds = [...new Set(rows
    .map((row) => row.source_ledger_id?.trim())
    .filter((id): id is string => Boolean(id)))];
  const sourceByLedgerId = new Map<string, {
    type: "grant" | "refund";
    packageId?: BillingPackageId;
  }>();
  if (sourceLedgerIds.length > 0) {
    const { data: ledgerData, error: ledgerError } = await admin
      .from("credit_ledger")
      .select("id, type, note")
      .in("id", sourceLedgerIds);
    if (ledgerError) throw new Error(ledgerError.message);
    for (const ledger of ledgerData ?? []) {
      const id = typeof ledger.id === "string" ? ledger.id : "";
      const type = ledger.type === "grant" || ledger.type === "refund" ? ledger.type : undefined;
      if (!id || !type) continue;
      const packageMatch = typeof ledger.note === "string"
        ? ledger.note.match(/^recharge\s+([^\s(]+)/i)
        : null;
      const billingPackage = packageMatch?.[1]
        ? getBillingPackage(packageMatch[1])
        : undefined;
      sourceByLedgerId.set(id, {
        type,
        packageId: billingPackage?.id
      });
    }
  }

  return summarizeCreditKindBalances(
    rows.map((row) => ({
      ...row,
      source_type: row.source_ledger_id
        ? sourceByLedgerId.get(row.source_ledger_id)?.type ?? null
        : null,
      source_package_id: row.source_ledger_id
        ? sourceByLedgerId.get(row.source_ledger_id)?.packageId ?? null
        : null
    })),
    now,
    subscriptionWindow
  );
}

/**
 * A generated asset is watermark-free when at least one of the credits held
 * for it came from the paid bucket. This deliberately permits mixed holds:
 * paid credits are consumed first and a paid/free split still unlocks the
 * finished asset.
 */
export async function usedPaidCreditsForJob(userId: string, jobId: string): Promise<boolean> {
  const normalizedUserId = userId.trim();
  const normalizedJobId = jobId.trim();
  if (!supabaseConfig.adminEnabled || !normalizedUserId || !normalizedJobId) return false;

  const admin = getSupabaseAdminClient();
  const { data: holdRows, error: holdError } = await admin
    .from("credit_ledger")
    .select("id")
    .eq("user_id", normalizedUserId)
    .eq("job_id", normalizedJobId)
    .in("type", ["hold", "consume"]);
  if (holdError) throw new Error(holdError.message);

  const holdIds = (holdRows ?? [])
    .map((row) => (row as { id?: string | null }).id?.trim())
    .filter((id): id is string => Boolean(id));
  if (!holdIds.length) return false;

  const { data: consumptionRows, error: consumptionError } = await admin
    .from("credit_lot_consumptions")
    .select("ledger_id, lot_id")
    .in("ledger_id", holdIds);
  if (consumptionError) throw new Error(consumptionError.message);

  const lotIds = [...new Set((consumptionRows ?? [])
    .map((row) => (row as CreditLotConsumptionRow).lot_id?.trim())
    .filter((id): id is string => Boolean(id)))];
  if (!lotIds.length) return false;

  const { data: lotRows, error: lotError } = await admin
    .from("credit_lots")
    .select("id, credit_kind")
    .in("id", lotIds);
  if (lotError) throw new Error(lotError.message);

  return (lotRows ?? []).some((row) => isPaidCreditKind(
    (row as CreditLotKindRow).credit_kind
  ));
}
