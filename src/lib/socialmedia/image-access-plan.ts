import { isGuestUserId } from "@/lib/auth/guest";
import { getCreditSummary } from "@/lib/billing/credits";
import { hasStarterPackCreditHoldForJob } from "@/lib/billing/starter-pack";
import { usedPaidCreditsForJob } from "@/lib/billing/subscription-credit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseConfig } from "@/lib/supabase/config";
import type { SocialmediaImageAccessPlan } from "@/lib/socialmedia/types";

const PROFILE_PLAN_CACHE_TTL_MS = Math.max(
  5_000,
  Number(process.env.SOCIALMEDIA_PROFILE_PLAN_CACHE_TTL_MS ?? 15_000) || 15_000
);
const profilePlanCache = new Map<string, { plan: SocialmediaImageAccessPlan; expiresAt: number }>();

function normalizeProfilePlan(plan: unknown): SocialmediaImageAccessPlan {
  return plan === "basic" || plan === "pro" || plan === "max" ? plan : "free";
}

export async function resolveSocialmediaImageAccessPlan(ownerUserId?: string): Promise<SocialmediaImageAccessPlan> {
  const normalized = ownerUserId?.trim();
  if (!normalized || isGuestUserId(normalized)) return "free";
  if (normalized === "local-dev" || normalized.startsWith("api-key:")) return "max";

  const summary = await getCreditSummary(normalized, 1).catch(() => null);
  return normalizeProfilePlan(summary?.plan);
}

export async function resolveSocialmediaProfileImageAccessPlan(ownerUserId?: string): Promise<SocialmediaImageAccessPlan> {
  const normalized = ownerUserId?.trim();
  if (!normalized || isGuestUserId(normalized)) return "free";
  if (normalized === "local-dev" || normalized.startsWith("api-key:")) return "max";
  if (!supabaseConfig.adminEnabled) return "free";

  const cached = profilePlanCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.plan;
  }

  try {
    const { data } = await getSupabaseAdminClient()
      .from("profiles")
      .select("plan")
      .eq("id", normalized)
      .maybeSingle();
    const plan = normalizeProfilePlan((data as { plan?: unknown } | null)?.plan);
    profilePlanCache.set(normalized, { plan, expiresAt: Date.now() + PROFILE_PLAN_CACHE_TTL_MS });
    return plan;
  } catch {
    return "free";
  }
}

export async function resolveSocialmediaGenerationImageAccessPlan(
  ownerUserId?: string,
  options?: { jobId?: string }
): Promise<SocialmediaImageAccessPlan> {
  const normalized = ownerUserId?.trim();
  if (normalized === "local-dev" || normalized?.startsWith("api-key:")) return "max";
  const profilePlan = await resolveSocialmediaImageAccessPlan(normalized);
  if (!normalized || isGuestUserId(normalized)) return profilePlan;

  if (options?.jobId && await usedPaidCreditsForJob(normalized, options.jobId)) {
    // A paid credit pack is watermark-free even if the account is not on an
    // active subscription. Access-plan consumers only need a paid tier here.
    return profilePlan === "free" ? "pro" : profilePlan;
  }

  if (profilePlan !== "free") {
    return options?.jobId ? "free" : profilePlan;
  }

  if (
    options?.jobId
    && await hasStarterPackCreditHoldForJob(normalized, options.jobId)
  ) {
    return "pro";
  }

  return "free";
}
