export const EXPIRING_PROFILE_STATUSES = [
  "active",
  "paid",
  "trialing",
  "unpaid",
  "scheduled_cancel"
] as const;

export const ACTIVE_ENTITLEMENT_STATUSES = [
  "active",
  "paid",
  "trialing",
  "scheduled_cancel",
  "canceled"
] as const;

export type ExpiringProfileStatus = typeof EXPIRING_PROFILE_STATUSES[number];
export type ActiveEntitlementStatus = typeof ACTIVE_ENTITLEMENT_STATUSES[number];

export type SubscriptionExpiryProfile = {
  plan?: string | null;
  subscription_status?: string | null;
  current_period_end_at?: string | null;
};

function parseTime(value?: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function shouldDowngradeStripeRenewalFailure(params: {
  billingProvider?: string | null;
  storedSubscriptionId?: string | null;
  eventSubscriptionId: string;
  failedPeriodStartAt?: string | null;
  successfulRenewalRecorded: boolean;
  nowMs?: number;
}): boolean {
  const storedSubscriptionId = params.storedSubscriptionId?.trim();
  const isStripeProfile = params.billingProvider === "stripe"
    || (!params.billingProvider && Boolean(storedSubscriptionId));
  if (
    !isStripeProfile
    || !storedSubscriptionId
    || storedSubscriptionId !== params.eventSubscriptionId.trim()
    || params.successfulRenewalRecorded
  ) {
    return false;
  }

  const startsAt = parseTime(params.failedPeriodStartAt);
  const nowMs = params.nowMs ?? Date.now();
  return typeof startsAt === "number" && startsAt <= nowMs;
}

export function hasExpiredPeriod(currentPeriodEndAt: string | null | undefined, nowMs = Date.now()): boolean {
  const endsAt = parseTime(currentPeriodEndAt);
  return typeof endsAt === "number" && endsAt <= nowMs;
}

export function hasFutureEntitlementPeriod(currentPeriodEndAt: string | null | undefined, nowMs = Date.now()): boolean {
  const endsAt = parseTime(currentPeriodEndAt);
  return !endsAt || endsAt > nowMs;
}

export function hasActiveEntitlementPeriod(
  status: string | null | undefined,
  currentPeriodEndAt: string | null | undefined,
  nowMs = Date.now()
): boolean {
  const endsAt = parseTime(currentPeriodEndAt);
  if (status === "canceled") {
    return typeof endsAt === "number" && endsAt > nowMs;
  }
  return typeof endsAt !== "number" || endsAt > nowMs;
}

export function shouldExpireBillingProfile(
  profile: SubscriptionExpiryProfile,
  nowMs = Date.now()
): boolean {
  const plan = profile.plan;
  const status = profile.subscription_status;
  const hasPaidPlan = plan === "basic" || plan === "pro" || plan === "max";
  const hasExpiringStatus = EXPIRING_PROFILE_STATUSES.includes(status as ExpiringProfileStatus);

  return (hasPaidPlan || hasExpiringStatus)
    && hasExpiredPeriod(profile.current_period_end_at, nowMs);
}
