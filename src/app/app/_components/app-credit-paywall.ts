import {
  ACTIVE_ENTITLEMENT_STATUSES,
  hasActiveEntitlementPeriod
} from "@/lib/billing/subscription-expiry";
import type { AppAccountSummary } from "./app-data";

export function canTopUpThreadCredits(account: Pick<AppAccountSummary,
  "isLoggedIn" | "plan" | "subscriptionStatus" | "currentPeriodEndAt"
>, nowMs = Date.now()): boolean {
  return account.isLoggedIn
    && (account.plan === "basic" || account.plan === "pro" || account.plan === "max")
    && ACTIVE_ENTITLEMENT_STATUSES.some((status) => status === account.subscriptionStatus)
    && hasActiveEntitlementPeriod(account.subscriptionStatus, account.currentPeriodEndAt, nowMs);
}
