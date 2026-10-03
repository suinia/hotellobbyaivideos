import { retryBillingRead } from "@/lib/billing/read-retry";
import { randomUUID } from "node:crypto";
import { appConfig } from "@/lib/config";
import {
  BILLING_PACKAGES,
  requireBillingPackage,
  type BillingPackage,
  type BillingPackageId,
  type UserPlan
} from "@/lib/billing/catalog";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseConfig } from "@/lib/supabase/config";
import { ACTIVE_ENTITLEMENT_STATUSES } from "@/lib/billing/subscription-expiry";

type LedgerType = "grant" | "hold" | "consume" | "refund" | "adjust";

export type CreditLedgerEntry = {
  id: string;
  userId: string;
  type: LedgerType;
  amount: number;
  balanceAfter: number;
  note: string;
  idempotencyKey?: string;
  expiresAt?: string;
  createdAt: string;
};

export type CreditSummary = {
  plan: UserPlan;
  balance: number;
  ledger: CreditLedgerEntry[];
};

export type BillingSettlementQueueEntry = {
  id: string;
  settlementKey: string;
  userId: string;
  jobId?: string;
  note: string;
  targetCredits: number;
  settledCredits: number;
  outstandingCredits: number;
  tokenCredits: number;
  imageCredits: number;
  status: "pending" | "resolved";
  lastError?: string;
  lastAttemptAt: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type RechargePackage = BillingPackage;

export const RECHARGE_PACKAGES: RechargePackage[] = BILLING_PACKAGES.filter((item) => item.activeForNewCheckout);

export const STARTER_PACK_PACKAGE_IDS = BILLING_PACKAGES
  .filter((item) => item.kind === "one_time" && item.checkoutPlan === "starter" && item.id.startsWith("starter_pack"))
  .map((item) => item.id);

const ONE_YEAR_CREDIT_PACK_PACKAGE_IDS = new Set<BillingPackageId>([
  "image_credit_pack_1500_v25",
  "image_credit_pack_5000_v25",
  "video_credit_pack_1500_v25",
  "video_credit_pack_5000_v25",
  "image_credit_pack_1000_v19",
  "image_credit_pack_3000_v19",
  "starter_pack_1_v20",
  "starter_pack_10_v20",
  "starter_pack_100_v20",
  "starter_pack_1000_v20",
  "video_credit_pack_2000_v20",
  "video_credit_pack_6000_v20",
  "video_credit_pack_20000_v20"
]);

const NINETY_DAY_CREDIT_PACK_PACKAGE_IDS = new Set<BillingPackageId>([
  "image_credit_pack_500_v24",
  "image_credit_pack_2000_v24",
  "image_credit_pack_10000_v24"
]);

export function isOneYearCreditPackPackageId(packageId: BillingPackageId): boolean {
  return ONE_YEAR_CREDIT_PACK_PACKAGE_IDS.has(packageId);
}

export function isExpiringCreditPackPackageId(packageId: BillingPackageId): boolean {
  return isOneYearCreditPackPackageId(packageId)
    || NINETY_DAY_CREDIT_PACK_PACKAGE_IDS.has(packageId);
}

export function resolveRechargeCreditAmount(
  pkg: Pick<BillingPackage, "id" | "kind" | "interval" | "pricingVariant" | "checkoutPlan" | "name" | "credits">
): number {
  if (pkg.kind === "subscription" && pkg.interval === "year") {
    const isVideoPackage = pkg.id.startsWith("video_");
    const monthlyPeer = BILLING_PACKAGES.find((item) => (
      item.kind === "subscription"
      && item.pricingVariant === pkg.pricingVariant
      && item.checkoutPlan === pkg.checkoutPlan
      && item.interval === "month"
      && item.name === pkg.name
      && item.id.startsWith("video_") === isVideoPackage
    ));
    return monthlyPeer?.credits ?? pkg.credits;
  }
  return pkg.credits;
}

export function resolveRechargeBonusFreeCreditAmount(packageId: BillingPackageId): number {
  if (packageId === "starter_pack_1_v20") return 100;
  if (packageId === "starter_pack_10_v20") return 100;
  if (packageId === "starter_pack_100_v20") return 200;
  if (packageId === "starter_pack_1000_v20") return 500;
  return 0;
}

function readDate(value?: string | Date | null): Date | undefined {
  const date = value instanceof Date ? value : value ? new Date(value) : undefined;
  if (!date || Number.isNaN(date.getTime())) return undefined;
  return date;
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function addUtcMonths(date: Date, months: number): Date {
  const targetMonthIndex = date.getUTCMonth() + months;
  const targetYear = date.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const targetDay = Math.min(date.getUTCDate(), daysInUtcMonth(targetYear, targetMonth));
  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    targetDay,
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds()
  ));
}

function utcMonthIndex(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function formatUtcDateKey(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
}

export function resolveAnnualSubscriptionMonthlyEntitlementAt(params: {
  packageId: BillingPackageId;
  currentPeriodStartAt?: string | Date | null;
  currentPeriodEndAt?: string | Date | null;
  now?: string | Date | null;
}): Date | undefined {
  const pkg = requireBillingPackage(params.packageId);
  if (pkg.kind !== "subscription" || pkg.interval !== "year") return undefined;

  const periodStart = readDate(params.currentPeriodStartAt);
  const now = readDate(params.now) ?? new Date();
  const periodEnd = readDate(params.currentPeriodEndAt);
  if (!periodStart || periodStart.getTime() > now.getTime()) return undefined;
  if (periodEnd && periodEnd.getTime() <= now.getTime()) return undefined;

  let elapsedMonths = utcMonthIndex(now) - utcMonthIndex(periodStart);
  let entitlementAt = addUtcMonths(periodStart, elapsedMonths);
  if (entitlementAt.getTime() > now.getTime()) {
    elapsedMonths -= 1;
    entitlementAt = addUtcMonths(periodStart, elapsedMonths);
  }
  return elapsedMonths >= 0 ? entitlementAt : undefined;
}

export function buildSubscriptionMonthlyEntitlementKey(params: {
  packageId: BillingPackageId;
  userId: string;
  subscriptionId?: string;
  at?: string | Date | null;
}): string | undefined {
  const pkg = requireBillingPackage(params.packageId);
  if (pkg.kind !== "subscription" || pkg.interval !== "year") return undefined;

  const date = readDate(params.at) ?? new Date();
  const subscriptionScope = params.subscriptionId?.trim() || params.userId;
  return `subscription-monthly-entitlement:${subscriptionScope}:${pkg.id}:${formatUtcDateKey(date)}`;
}

export function resolveRechargeIdempotencyKey(params: {
  packageId: BillingPackageId;
  userId: string;
  fallbackKey?: string;
  subscriptionId?: string;
  currentPeriodStartAt?: string | null;
  monthlyEntitlementAt?: string | Date | null;
}): string | undefined {
  return buildSubscriptionMonthlyEntitlementKey({
    packageId: params.packageId,
    userId: params.userId,
    subscriptionId: params.subscriptionId,
    at: params.monthlyEntitlementAt ?? params.currentPeriodStartAt
  }) ?? params.fallbackKey;
}

export function resolveSubscriptionCreditExpiry(params: {
  packageId: BillingPackageId;
  currentPeriodStartAt?: string | Date | null;
  currentPeriodEndAt?: string | Date | null;
  monthlyEntitlementAt?: string | Date | null;
}): string | undefined {
  const pkg = requireBillingPackage(params.packageId);
  if (pkg.kind !== "subscription") return undefined;

  const periodEnd = readDate(params.currentPeriodEndAt);
  if (pkg.interval === "month") return periodEnd?.toISOString();

  const entitlementStart = readDate(params.monthlyEntitlementAt) ?? readDate(params.currentPeriodStartAt);
  if (!entitlementStart) return undefined;

  const nextEntitlementAt = addUtcMonths(entitlementStart, 1);
  const expiresAt = periodEnd && periodEnd.getTime() < nextEntitlementAt.getTime()
    ? periodEnd
    : nextEntitlementAt;
  return expiresAt.toISOString();
}

export function resolveRechargeCreditExpiry(params: {
  packageId: BillingPackageId;
  expiresAt?: string | null;
  purchasedAt?: string | Date;
}): string | null {
  const pkg = requireBillingPackage(params.packageId);
  if (pkg.kind === "one_time" && isOneYearCreditPackPackageId(pkg.id)) {
    const purchasedAt = readDate(params.purchasedAt) ?? new Date();
    const expiresAt = new Date(purchasedAt);
    expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1);
    return expiresAt.toISOString();
  }

  if (pkg.kind === "one_time" && NINETY_DAY_CREDIT_PACK_PACKAGE_IDS.has(pkg.id)) {
    const purchasedAt = readDate(params.purchasedAt) ?? new Date();
    const expiresAt = new Date(purchasedAt);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 90);
    return expiresAt.toISOString();
  }

  return params.expiresAt ?? resolveExpiryTimestamp(appConfig.billing.rechargeCreditValidityDays);
}

export type AnnualSubscriptionEntitlementRow = {
  provider: "creem" | "stripe" | "waffo" | null;
  provider_subscription_id: string;
  package_id: string;
  status: string | null;
  current_period_start_at: string | null;
  current_period_end_at: string | null;
};

export type AnnualSubscriptionProfilePeriodRow = {
  billing_provider: "creem" | "stripe" | "waffo" | null;
  creem_subscription_id: string | null;
  stripe_subscription_id: string | null;
  waffo_subscription_id: string | null;
  current_period_start_at: string | null;
  current_period_end_at: string | null;
};

export type CurrentAnnualSubscriptionEntitlement = {
  subscription: AnnualSubscriptionEntitlementRow;
  currentPeriodStartAt: string | null;
  currentPeriodEndAt: string | null;
};

/**
 * Resolves the one annual entitlement that the billing profile currently
 * points at. Provider-specific ids are retained for audit history, so an id
 * from a non-current provider must never authorize a credit grant.
 */
export function selectCurrentAnnualSubscriptionEntitlement(
  candidates: AnnualSubscriptionEntitlementRow[],
  profile: AnnualSubscriptionProfilePeriodRow | null | undefined,
  nowMs = Date.now()
): CurrentAnnualSubscriptionEntitlement | undefined {
  if (!profile) return undefined;
  const provider = profile?.billing_provider;
  if (provider !== "creem" && provider !== "stripe" && provider !== "waffo") {
    return undefined;
  }

  const currentSubscriptionId = provider === "stripe"
    ? profile.stripe_subscription_id
    : provider === "waffo"
      ? profile.waffo_subscription_id
      : profile.creem_subscription_id;
  if (!currentSubscriptionId?.trim()) return undefined;

  const subscription = candidates.find((row) => {
    const pkg = BILLING_PACKAGES.find((item) => item.id === row.package_id);
    return (
      row.provider === provider
      && row.provider_subscription_id === currentSubscriptionId
      && pkg?.kind === "subscription"
      && pkg.interval === "year"
    );
  });
  if (!subscription) return undefined;

  const currentPeriodStartAt = subscription.current_period_start_at
    ?? profile.current_period_start_at;
  const currentPeriodEndAt = subscription.current_period_end_at
    ?? profile.current_period_end_at;
  const startsAtMs = currentPeriodStartAt ? Date.parse(currentPeriodStartAt) : Number.NaN;
  const endsAtMs = currentPeriodEndAt ? Date.parse(currentPeriodEndAt) : Number.NaN;
  const hasEligibleStatus = ACTIVE_ENTITLEMENT_STATUSES.includes(
    subscription.status as (typeof ACTIVE_ENTITLEMENT_STATUSES)[number]
  );
  if (
    !hasEligibleStatus
    || !Number.isFinite(startsAtMs)
    || !Number.isFinite(endsAtMs)
    || startsAtMs > nowMs
    || endsAtMs <= nowMs
    || endsAtMs <= startsAtMs
  ) {
    return undefined;
  }

  return { subscription, currentPeriodStartAt, currentPeriodEndAt };
}

export type AnnualSubscriptionEntitlementEnsureResult = {
  issued: boolean;
  packageId?: BillingPackageId;
  credits?: number;
  entitlementAt?: string;
  balance?: number;
  reason?: "not_annual_subscription" | "not_due" | "already_issued";
};

/**
 * Lazily materializes the active annual subscription's allowance for the
 * current monthly anniversary. This intentionally grants only the current
 * allowance when a user returns after several inactive months.
 */
export async function ensureAnnualSubscriptionMonthlyCredits(params: {
  userId: string;
  plan?: string | null;
  now?: Date;
}): Promise<AnnualSubscriptionEntitlementEnsureResult> {
  if (!supabaseConfig.adminEnabled || !params.userId.trim()) {
    return { issued: false, reason: "not_annual_subscription" };
  }
  if (!params.plan || params.plan === "free") {
    return { issued: false, reason: "not_annual_subscription" };
  }

  const client = getSupabaseAdminClient();
  const now = params.now ?? new Date();
  const [{ data, error }, { data: profilePeriod, error: profilePeriodError }] = await Promise.all([
    client
      .from("billing_subscriptions")
      .select("provider, provider_subscription_id, package_id, status, current_period_start_at, current_period_end_at")
      .eq("user_id", params.userId)
      .in("status", [...ACTIVE_ENTITLEMENT_STATUSES])
      .order("updated_at", { ascending: false })
      .limit(10),
    client
      .from("profiles")
      .select("billing_provider, creem_subscription_id, stripe_subscription_id, waffo_subscription_id, current_period_start_at, current_period_end_at")
      .eq("id", params.userId)
      .maybeSingle()
  ]);

  if (error) throw new Error(error.message);
  if (profilePeriodError) throw new Error(profilePeriodError.message);

  const candidates = (data ?? []) as AnnualSubscriptionEntitlementRow[];
  const profile = profilePeriod as AnnualSubscriptionProfilePeriodRow | null;
  const entitlement = selectCurrentAnnualSubscriptionEntitlement(
    candidates,
    profile,
    now.getTime()
  );
  if (!entitlement) {
    return { issued: false, reason: "not_annual_subscription" };
  }

  const { subscription, currentPeriodStartAt, currentPeriodEndAt } = entitlement;

  const packageId = subscription.package_id as BillingPackageId;
  const entitlementAt = resolveAnnualSubscriptionMonthlyEntitlementAt({
    packageId,
    currentPeriodStartAt,
    currentPeriodEndAt,
    now
  });
  if (!entitlementAt) {
    return { issued: false, packageId, reason: "not_due" };
  }

  const idempotencyKey = resolveRechargeIdempotencyKey({
    userId: params.userId,
    packageId,
    subscriptionId: subscription.provider_subscription_id,
    currentPeriodStartAt,
    monthlyEntitlementAt: entitlementAt
  });
  if (!idempotencyKey) {
    return { issued: false, packageId, reason: "not_annual_subscription" };
  }

  const ledgerKey = `recharge:${params.userId}:${idempotencyKey}`;
  const { data: existingLedger, error: existingLedgerError } = await client
    .from("credit_ledger")
    .select("id")
    .eq("user_id", params.userId)
    .eq("idempotency_key", ledgerKey)
    .maybeSingle();
  if (existingLedgerError) throw new Error(existingLedgerError.message);
  if (existingLedger) {
    return {
      issued: false,
      packageId,
      entitlementAt: entitlementAt.toISOString(),
      reason: "already_issued"
    };
  }

  const result = await rechargeCredits({
    userId: params.userId,
    packageId,
    idempotencyKey,
    expiresAt: resolveSubscriptionCreditExpiry({
      packageId,
      currentPeriodStartAt,
      currentPeriodEndAt,
      monthlyEntitlementAt: entitlementAt
    })
  });

  return {
    issued: true,
    packageId,
    credits: result.grantedCredits,
    entitlementAt: entitlementAt.toISOString(),
    balance: result.balance
  };
}

type RpcLedgerRow = {
  id: string;
  user_id: string;
  type: LedgerType;
  amount: number;
  balance_after: number;
  note: string | null;
  idempotency_key: string | null;
  expires_at: string | null;
  created_at: string;
};

type CreditPackPurchaseRpcRow = {
  grant_id: string;
  grant_amount: number;
  grant_balance_after: number;
  grant_note: string | null;
  grant_idempotency_key: string | null;
  grant_created_at: string;
  consume_id: string;
  consume_amount: number;
  balance_after: number;
  consume_note: string | null;
  consume_idempotency_key: string | null;
  consume_created_at: string;
};

type BillingSettlementQueueRow = {
  id: string;
  settlement_key: string;
  user_id: string;
  job_id: string | null;
  note: string;
  target_credits: number;
  settled_credits: number;
  outstanding_credits: number;
  token_credits: number;
  image_credits: number;
  status: "pending" | "resolved";
  last_error: string | null;
  last_attempt_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

function ensureBillingEnabled(): void {
  if (!supabaseConfig.adminEnabled) {
    throw new Error("BILLING_NOT_CONFIGURED");
  }
}

function toLedgerEntry(row: RpcLedgerRow): CreditLedgerEntry {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    amount: Number(row.amount ?? 0),
    balanceAfter: Number(row.balance_after ?? 0),
    note: row.note ?? "",
    idempotencyKey: row.idempotency_key ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    createdAt: row.created_at
  };
}

function toBillingSettlementQueueEntry(row: BillingSettlementQueueRow): BillingSettlementQueueEntry {
  return {
    id: row.id,
    settlementKey: row.settlement_key,
    userId: row.user_id,
    jobId: row.job_id ?? undefined,
    note: row.note,
    targetCredits: Number(row.target_credits ?? 0),
    settledCredits: Number(row.settled_credits ?? 0),
    outstandingCredits: Number(row.outstanding_credits ?? 0),
    tokenCredits: Number(row.token_credits ?? 0),
    imageCredits: Number(row.image_credits ?? 0),
    status: row.status === "resolved" ? "resolved" : "pending",
    lastError: row.last_error ?? undefined,
    lastAttemptAt: row.last_attempt_at,
    resolvedAt: row.resolved_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function resolveExpiryTimestamp(validityDays: number): string {
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + Math.max(1, Math.round(validityDays)));
  return expiresAt.toISOString();
}

function resolveIdempotencyKey(params: {
  userId: string;
  prefix: string;
  key?: string;
}): string {
  const normalized = params.key?.trim() || randomUUID();
  return `${params.prefix}:${params.userId}:${normalized}`;
}

function classifyCreditError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "UNKNOWN");
  if (message.includes("INSUFFICIENT_CREDITS")) return "INSUFFICIENT_CREDITS";
  if (message.includes("PROFILE_NOT_FOUND")) return "PROFILE_NOT_FOUND";
  if (message.includes("BILLING_NOT_CONFIGURED")) return "BILLING_NOT_CONFIGURED";
  return "CREDIT_OPERATION_FAILED";
}

function isMissingRpcFunctionError(error: { message?: string | null } | null, functionName: string): boolean {
  return Boolean(error?.message?.includes(`Could not find the function public.${functionName}`));
}

async function applyCreditLedger(params: {
  userId: string;
  type: LedgerType;
  amount: number;
  note: string;
  idempotencyKey?: string;
  jobId?: string;
  expiresAt?: string | null;
  refundForLedgerId?: string;
}): Promise<CreditLedgerEntry> {
  ensureBillingEnabled();
  const client = getSupabaseAdminClient();

  const applyV2 = () => client.rpc("apply_credit_ledger_v2", {
    p_user_id: params.userId,
    p_type: params.type,
    p_amount: params.amount,
    p_note: params.note,
    p_job_id: params.jobId ?? null,
    p_idempotency_key: params.idempotencyKey ?? null,
    p_expires_at: params.expiresAt ?? null,
    p_refund_for_ledger_id: params.refundForLedgerId ?? null
  });
  const applyLegacy = () => client.rpc("apply_credit_ledger", {
    p_user_id: params.userId,
    p_type: params.type,
    p_amount: params.amount,
    p_note: params.note,
    p_job_id: params.jobId ?? null,
    p_idempotency_key: params.idempotencyKey ?? null,
    p_expires_at: params.expiresAt ?? null
  });
  let { data, error } = await applyV2();

  // Deploys remain compatible while the additive v2 migration is rolling out.
  // A source-ledger refund is intentionally not downgraded to the legacy path.
  if (!params.refundForLedgerId && isMissingRpcFunctionError(error, "apply_credit_ledger_v2")) {
    ({ data, error } = await applyLegacy());
  }

  if (
    error
    && (params.type === "consume" || params.type === "hold")
    && classifyCreditError(error) === "INSUFFICIENT_CREDITS"
  ) {
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("plan")
      .eq("id", params.userId)
      .maybeSingle();
    if (!profileError && profile?.plan && profile.plan !== "free") {
      const entitlement = await ensureAnnualSubscriptionMonthlyCredits({
        userId: params.userId,
        plan: profile.plan
      }).catch((entitlementError) => {
        console.warn("[billing] failed to lazily refresh annual subscription credits after debit shortfall", {
          userId: params.userId,
          type: params.type,
          error: entitlementError instanceof Error ? entitlementError.message : String(entitlementError)
        });
        return { issued: false };
      });
      if (entitlement.issued) {
        ({ data, error } = await applyV2());
        if (!params.refundForLedgerId && isMissingRpcFunctionError(error, "apply_credit_ledger_v2")) {
          ({ data, error } = await applyLegacy());
        }
      }
    }
  }

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? (data[0] as RpcLedgerRow | undefined) : undefined;
  if (!row) {
    throw new Error("CREDIT_OPERATION_FAILED");
  }

  return toLedgerEntry(row);
}

export function isInsufficientCreditsError(error: unknown): boolean {
  return classifyCreditError(error) === "INSUFFICIENT_CREDITS";
}

export async function syncCreditBalance(userId: string): Promise<number> {
  ensureBillingEnabled();
  const client = getSupabaseAdminClient();
  const { data, error } = await client.rpc("refresh_credit_balance", {
    p_user_id: userId
  });
  if (error) {
    throw new Error(error.message);
  }
  return Math.max(0, Number(data ?? 0));
}

export async function getCreditSummary(
  userId: string,
  limit = 30,
  options?: { requiredCredits?: number }
): Promise<CreditSummary> {
  ensureBillingEnabled();
  const client = getSupabaseAdminClient();

  const { data: profile, error: profileError } = await retryBillingRead(() => client
    .from("profiles")
    .select("plan, credit_balance")
    .eq("id", userId)
    .maybeSingle());
  if (profileError || !profile) {
    throw new Error(profileError?.message ?? "PROFILE_NOT_FOUND");
  }

  let balance = await syncCreditBalance(userId).catch(() => Number(profile.credit_balance ?? 0));
  const requiredCredits = Math.max(0, Math.ceil(Number(options?.requiredCredits) || 0));
  if (
    requiredCredits > balance
    && profile.plan
    && profile.plan !== "free"
  ) {
    await ensureAnnualSubscriptionMonthlyCredits({ userId, plan: profile.plan }).catch((error) => {
      console.warn("[billing] failed to lazily refresh annual subscription credits after balance shortfall", {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
    });
    balance = await syncCreditBalance(userId).catch(() => balance);
  }

  const { data: ledgerRows, error: ledgerError } = await retryBillingRead(() => client
    .from("credit_ledger")
    .select("id, user_id, type, amount, balance_after, note, idempotency_key, expires_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(100, Math.round(limit)))));
  if (ledgerError) {
    throw new Error(ledgerError.message);
  }

  return {
    plan: (profile.plan as UserPlan) ?? "free",
    balance: Math.max(0, Number(balance ?? 0)),
    ledger: (ledgerRows ?? []).map((item) => toLedgerEntry(item as RpcLedgerRow))
  };
}

export async function consumeConvertCredits(params: {
  userId: string;
  idempotencyKey?: string;
}): Promise<CreditLedgerEntry> {
  const finalIdempotencyKey = resolveIdempotencyKey({
    userId: params.userId,
    prefix: "convert-consume",
    key: params.idempotencyKey
  });

  return applyCreditLedger({
    userId: params.userId,
    type: "consume",
    amount: appConfig.billing.convertCostCredits,
    note: `convert request (${appConfig.billing.convertCostCredits} credits)`,
    idempotencyKey: finalIdempotencyKey
  });
}

export async function consumeCredits(params: {
  userId: string;
  amount: number;
  idempotencyKey?: string;
  jobId?: string;
  note: string;
}): Promise<CreditLedgerEntry> {
  const amount = Math.max(0, Math.ceil(Number(params.amount) || 0));
  if (amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  return applyCreditLedger({
    userId: params.userId,
    type: "consume",
    amount,
    note: params.note,
    idempotencyKey: params.idempotencyKey,
    jobId: params.jobId
  });
}

export async function holdCredits(params: {
  userId: string;
  amount: number;
  idempotencyKey?: string;
  jobId?: string;
  note: string;
}): Promise<CreditLedgerEntry> {
  const amount = Math.max(0, Math.ceil(Number(params.amount) || 0));
  if (amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  return applyCreditLedger({
    userId: params.userId,
    type: "hold",
    amount,
    note: params.note,
    idempotencyKey: params.idempotencyKey,
    jobId: params.jobId
  });
}

export async function refundConvertCredits(params: {
  userId: string;
  debitLedgerId: string;
  idempotencyKey?: string;
  note?: string;
}): Promise<CreditLedgerEntry> {
  const debitLedgerId = params.debitLedgerId.trim();
  if (!debitLedgerId) {
    throw new Error("REFUND_SOURCE_REQUIRED");
  }
  ensureBillingEnabled();
  const client = getSupabaseAdminClient();
  const { data: debit, error: debitError } = await client
    .from("credit_ledger")
    .select("type, amount")
    .eq("id", debitLedgerId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (debitError) {
    throw new Error(debitError.message);
  }

  const debitAmount = Number((debit as { amount?: number | null } | null)?.amount ?? 0);
  const debitType = (debit as { type?: LedgerType | null } | null)?.type;
  if ((debitType !== "consume" && debitType !== "hold") || !Number.isFinite(debitAmount) || debitAmount >= 0) {
    throw new Error("REFUND_SOURCE_NOT_FOUND");
  }

  const finalIdempotencyKey = resolveIdempotencyKey({
    userId: params.userId,
    prefix: "convert-refund",
    key: params.idempotencyKey
  });

  return applyCreditLedger({
    userId: params.userId,
    type: "refund",
    amount: Math.abs(debitAmount),
    note: params.note ?? `convert auto-refund (${Math.abs(debitAmount)} credits)`,
    idempotencyKey: finalIdempotencyKey,
    refundForLedgerId: debitLedgerId
  });
}

export async function refundCredits(params: {
  userId: string;
  amount: number;
  idempotencyKey?: string;
  jobId?: string;
  refundForLedgerId?: string;
  note: string;
  expiresAt?: string | null;
}): Promise<CreditLedgerEntry> {
  const amount = Math.max(0, Math.ceil(Number(params.amount) || 0));
  if (amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  return applyCreditLedger({
    userId: params.userId,
    type: "refund",
    amount,
    note: params.note,
    idempotencyKey: params.idempotencyKey,
    jobId: params.jobId,
    expiresAt: params.expiresAt ?? null,
    refundForLedgerId: params.refundForLedgerId
  });
}

export async function grantCredits(params: {
  userId: string;
  amount: number;
  idempotencyKey?: string;
  jobId?: string;
  note: string;
  expiresAt?: string | null;
}): Promise<CreditLedgerEntry> {
  const amount = Math.max(0, Math.ceil(Number(params.amount) || 0));
  if (amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  return applyCreditLedger({
    userId: params.userId,
    type: "grant",
    amount,
    note: params.note,
    idempotencyKey: params.idempotencyKey,
    jobId: params.jobId,
    // Product-granted free credits are permanent unless the caller attaches
    // them to an expiring paid bundle, such as a one-year credit pack.
    expiresAt: params.expiresAt ?? null
  });
}

export async function rechargeCredits(params: {
  userId: string;
  packageId: BillingPackageId;
  idempotencyKey?: string;
  testMode?: boolean;
  expiresAt?: string | null;
  creditAmount?: number;
  paymentAmount?: number;
  paymentCurrency?: string;
}): Promise<{
  package: RechargePackage;
  grantedCredits: number;
  ledger: CreditLedgerEntry;
  balance: number;
  plan: UserPlan;
}> {
  ensureBillingEnabled();
  const pkg = requireBillingPackage(params.packageId);
  const grantedCredits = params.creditAmount === undefined
    ? resolveRechargeCreditAmount(pkg)
    : Math.max(0, Math.ceil(Number(params.creditAmount) || 0));
  if (grantedCredits <= 0) {
    throw new Error("INVALID_RECHARGE_CREDIT_AMOUNT");
  }
  const paymentCurrency = params.paymentCurrency?.trim().toUpperCase();
  const paymentAmount = Number(params.paymentAmount);
  const paymentLabel = (paymentCurrency === "GBP" || paymentCurrency === "CAD") && Number.isFinite(paymentAmount) && paymentAmount > 0
    ? `${paymentCurrency === "GBP" ? "£" : "C$"}${paymentAmount.toFixed(2)}`
    : `$${pkg.usdAmount}`;

  const ledger = await applyCreditLedger({
    userId: params.userId,
    type: "grant",
    amount: grantedCredits,
    note: `recharge ${pkg.id} (${grantedCredits} credits, ${paymentLabel})${params.testMode ? " [test payment]" : ""}`,
    // Credit-pack grants use the validity period configured for their package.
    // Existing ledger rows are intentionally left unchanged.
    expiresAt: resolveRechargeCreditExpiry({
      packageId: params.packageId,
      expiresAt: params.expiresAt
    }),
    idempotencyKey: resolveIdempotencyKey({
      userId: params.userId,
      prefix: "recharge",
      key: params.idempotencyKey
    })
  });

  if (pkg.kind === "subscription") {
    const client = getSupabaseAdminClient();
    const { error: updateError } = await client
      .from("profiles")
      .update({ plan: pkg.plan })
      .eq("id", params.userId);
    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  return {
    package: pkg,
    grantedCredits,
    ledger,
    balance: ledger.balanceAfter,
    plan: pkg.plan
  };
}

export async function rechargeCreditsAndConsumeFromPurchase(params: {
  userId: string;
  packageId: BillingPackageId;
  idempotencyKey: string;
  testMode?: boolean;
  expiresAt?: string | null;
  creditAmount?: number;
  paymentAmount?: number;
  paymentCurrency?: string;
  consumption: {
    amount: number;
    idempotencyKey: string;
    jobId: string;
    note: string;
  };
}): Promise<{
  package: RechargePackage;
  grantedCredits: number;
  ledger: CreditLedgerEntry;
  consumptionLedger: CreditLedgerEntry;
  balance: number;
  plan: UserPlan;
}> {
  ensureBillingEnabled();
  const pkg = requireBillingPackage(params.packageId);
  if (pkg.kind !== "one_time" || pkg.pricingVariant !== "2.4" || !isExpiringCreditPackPackageId(pkg.id)) {
    throw new Error("INVALID_GUIDED_CREDIT_PACK");
  }

  const grantedCredits = params.creditAmount === undefined
    ? resolveRechargeCreditAmount(pkg)
    : Math.max(0, Math.ceil(Number(params.creditAmount) || 0));
  const consumedCredits = Math.max(0, Math.ceil(Number(params.consumption.amount) || 0));
  if (grantedCredits <= 0 || consumedCredits <= 0 || consumedCredits > grantedCredits) {
    throw new Error("INVALID_GUIDED_CREDIT_PACK_AMOUNT");
  }

  const grantIdempotencyKey = resolveIdempotencyKey({
    userId: params.userId,
    prefix: "recharge",
    key: params.idempotencyKey
  });
  const consumptionIdempotencyKey = params.consumption.idempotencyKey.trim();
  if (!consumptionIdempotencyKey || !params.consumption.jobId.trim()) {
    throw new Error("GUIDED_CREDIT_PACK_CONTEXT_REQUIRED");
  }

  const paymentCurrency = params.paymentCurrency?.trim().toUpperCase();
  const paymentAmount = Number(params.paymentAmount);
  const paymentLabel = (paymentCurrency === "GBP" || paymentCurrency === "CAD") && Number.isFinite(paymentAmount) && paymentAmount > 0
    ? `${paymentCurrency === "GBP" ? "£" : "C$"}${paymentAmount.toFixed(2)}`
    : `$${pkg.usdAmount}`;
  const grantNote = `recharge ${pkg.id} (${grantedCredits} credits, ${paymentLabel})${params.testMode ? " [test payment]" : ""}`;
  const expiresAt = resolveRechargeCreditExpiry({
    packageId: params.packageId,
    expiresAt: params.expiresAt
  });
  if (!expiresAt) {
    throw new Error("GUIDED_CREDIT_PACK_EXPIRY_REQUIRED");
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client.rpc("purchase_credit_pack_and_consume", {
    p_user_id: params.userId,
    p_grant_amount: grantedCredits,
    p_grant_note: grantNote,
    p_grant_idempotency_key: grantIdempotencyKey,
    p_expires_at: expiresAt,
    p_consume_amount: consumedCredits,
    p_consume_note: params.consumption.note,
    p_consume_job_id: params.consumption.jobId,
    p_consume_idempotency_key: consumptionIdempotencyKey
  });
  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data)
    ? data[0] as CreditPackPurchaseRpcRow | undefined
    : undefined;
  if (!row?.grant_id || !row.consume_id) {
    throw new Error("GUIDED_CREDIT_PACK_PURCHASE_FAILED");
  }

  return {
    package: pkg,
    grantedCredits,
    ledger: {
      id: row.grant_id,
      userId: params.userId,
      type: "grant",
      amount: Number(row.grant_amount ?? grantedCredits),
      balanceAfter: Number(row.grant_balance_after ?? 0),
      note: row.grant_note ?? grantNote,
      idempotencyKey: row.grant_idempotency_key ?? grantIdempotencyKey,
      expiresAt,
      createdAt: row.grant_created_at
    },
    consumptionLedger: {
      id: row.consume_id,
      userId: params.userId,
      type: "consume",
      amount: Number(row.consume_amount ?? -consumedCredits),
      balanceAfter: Number(row.balance_after ?? 0),
      note: row.consume_note ?? params.consumption.note,
      idempotencyKey: row.consume_idempotency_key ?? consumptionIdempotencyKey,
      createdAt: row.consume_created_at
    },
    balance: Number(row.balance_after ?? 0),
    plan: pkg.plan
  };
}

export async function grantRechargeBonusFreeCredits(params: {
  userId: string;
  packageId: BillingPackageId;
  idempotencyKey?: string;
  jobId?: string;
  testMode?: boolean;
}): Promise<{ grantedCredits: number; ledger?: CreditLedgerEntry; balance?: number }> {
  const bonusCredits = resolveRechargeBonusFreeCreditAmount(params.packageId);
  if (bonusCredits <= 0) return { grantedCredits: 0 };

  const ledger = await grantCredits({
    userId: params.userId,
    amount: bonusCredits,
    jobId: params.jobId,
    note: `credit pack free bonus ${params.packageId} (${bonusCredits} credits)${params.testMode ? " [test payment]" : ""}`,
    expiresAt: resolveRechargeCreditExpiry({ packageId: params.packageId }),
    idempotencyKey: resolveIdempotencyKey({
      userId: params.userId,
      prefix: "credit-pack-free-bonus",
      key: `${params.packageId}:${params.idempotencyKey?.trim() || randomUUID()}`
    })
  });

  return {
    grantedCredits: bonusCredits,
    ledger,
    balance: ledger.balanceAfter
  };
}

export async function recordCreditLedgerMarker(params: {
  userId: string;
  note: string;
  idempotencyKey?: string;
  jobId?: string;
}): Promise<CreditLedgerEntry> {
  ensureBillingEnabled();
  const client = getSupabaseAdminClient();
  const finalIdempotencyKey = params.idempotencyKey?.trim() || randomUUID();

  const { data: existingRow, error: existingError } = await client
    .from("credit_ledger")
    .select("id, user_id, type, amount, balance_after, note, idempotency_key, expires_at, created_at")
    .eq("user_id", params.userId)
    .eq("idempotency_key", finalIdempotencyKey)
    .maybeSingle();
  if (existingError) {
    throw new Error(existingError.message);
  }
  if (existingRow) {
    return toLedgerEntry(existingRow as RpcLedgerRow);
  }

  await syncCreditBalance(params.userId).catch(() => null);

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("credit_balance")
    .eq("id", params.userId)
    .maybeSingle();
  if (profileError || !profile) {
    throw new Error(profileError?.message ?? "PROFILE_NOT_FOUND");
  }

  const balance = Math.max(0, Number(profile.credit_balance ?? 0));
  const insertPayload = {
    user_id: params.userId,
    job_id: params.jobId ?? null,
    type: "adjust" as const,
    amount: 0,
    balance_after: balance,
    note: params.note,
    idempotency_key: finalIdempotencyKey,
    expires_at: null
  };

  const { data, error } = await client
    .from("credit_ledger")
    .insert(insertPayload)
    .select("id, user_id, type, amount, balance_after, note, idempotency_key, expires_at, created_at")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "CREDIT_OPERATION_FAILED");
  }

  return toLedgerEntry(data as RpcLedgerRow);
}

export async function recordBillingSettlementQueueEntry(params: {
  userId: string;
  settlementKey: string;
  note: string;
  targetCredits: number;
  settledCredits?: number;
  tokenCredits?: number;
  imageCredits?: number;
  lastError?: string | null;
  jobId?: string;
}): Promise<BillingSettlementQueueEntry> {
  ensureBillingEnabled();
  const client = getSupabaseAdminClient();

  const targetCredits = Math.max(1, Math.ceil(Number(params.targetCredits) || 0));
  const settledCredits = Math.max(0, Math.min(targetCredits, Math.ceil(Number(params.settledCredits) || 0)));
  const outstandingCredits = Math.max(0, targetCredits - settledCredits);
  const tokenCredits = Math.max(0, Math.ceil(Number(params.tokenCredits) || 0));
  const imageCredits = Math.max(0, Math.ceil(Number(params.imageCredits) || 0));

  const { data, error } = await client
    .from("billing_settlement_queue")
    .upsert(
      {
        settlement_key: params.settlementKey,
        user_id: params.userId,
        job_id: params.jobId ?? null,
        note: params.note,
        target_credits: targetCredits,
        settled_credits: settledCredits,
        outstanding_credits: outstandingCredits,
        token_credits: tokenCredits,
        image_credits: imageCredits,
        status: "pending",
        last_error: params.lastError?.trim() || null,
        last_attempt_at: new Date().toISOString(),
        resolved_at: null
      },
      { onConflict: "settlement_key" }
    )
    .select(
      "id, settlement_key, user_id, job_id, note, target_credits, settled_credits, outstanding_credits, " +
        "token_credits, image_credits, status, last_error, last_attempt_at, resolved_at, created_at, updated_at"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "BILLING_SETTLEMENT_QUEUE_WRITE_FAILED");
  }

  const row = data as unknown as BillingSettlementQueueRow;
  return toBillingSettlementQueueEntry(row);
}

export async function resolveBillingSettlementQueueEntry(params: {
  userId: string;
  settlementKey: string;
}): Promise<BillingSettlementQueueEntry | null> {
  ensureBillingEnabled();
  const client = getSupabaseAdminClient();
  const timestamp = new Date().toISOString();

  const { data: existing, error: existingError } = await client
    .from("billing_settlement_queue")
    .select(
      "id, settlement_key, user_id, job_id, note, target_credits, settled_credits, outstanding_credits, " +
        "token_credits, image_credits, status, last_error, last_attempt_at, resolved_at, created_at, updated_at"
    )
    .eq("user_id", params.userId)
    .eq("settlement_key", params.settlementKey)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (!existing) return null;
  const existingRow = existing as unknown as BillingSettlementQueueRow;

  const { data, error } = await client
    .from("billing_settlement_queue")
    .update({
      status: "resolved",
      settled_credits: Number(existingRow.target_credits ?? 0),
      outstanding_credits: 0,
      last_error: null,
      last_attempt_at: timestamp,
      resolved_at: timestamp
    })
    .eq("user_id", params.userId)
    .eq("settlement_key", params.settlementKey)
    .select(
      "id, settlement_key, user_id, job_id, note, target_credits, settled_credits, outstanding_credits, " +
        "token_credits, image_credits, status, last_error, last_attempt_at, resolved_at, created_at, updated_at"
    )
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;
  const row = data as unknown as BillingSettlementQueueRow;
  return toBillingSettlementQueueEntry({
    ...row,
    settled_credits: Number(row.target_credits ?? 0),
    outstanding_credits: 0,
    status: "resolved",
    last_error: null,
    last_attempt_at: timestamp,
    resolved_at: timestamp
  });
}
