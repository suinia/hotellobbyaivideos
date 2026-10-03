import type { AppUser } from "@/lib/auth/app-user";
import { isGuestUserId } from "@/lib/auth/guest";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseConfig } from "@/lib/supabase/config";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ClaimedGuestJobOwnership = {
  claimedUserId?: string | null;
  jobUserId?: string | null;
  jobGuestUserId?: string | null;
  jobSessionId?: string | null;
};

export function resolveClaimedGuestJobHandoffUser(params: {
  user: AppUser;
  expectedSessionId?: string;
  ownership: ClaimedGuestJobOwnership;
}): AppUser | null {
  const guestId = params.user.id.trim();
  if (params.user.authMode !== "guest" || !isGuestUserId(guestId)) return null;

  const claimedUserId = params.ownership.claimedUserId?.trim() ?? "";
  const jobUserId = params.ownership.jobUserId?.trim() ?? "";
  const jobGuestUserId = params.ownership.jobGuestUserId?.trim() ?? "";
  const jobSessionId = params.ownership.jobSessionId?.trim() ?? "";
  const expectedSessionId = params.expectedSessionId?.trim() ?? "";

  if (!UUID_PATTERN.test(claimedUserId) || jobUserId !== claimedUserId || jobGuestUserId) return null;
  if (expectedSessionId && jobSessionId !== expectedSessionId) return null;

  return {
    id: claimedUserId,
    authMode: "supabase"
  };
}

export async function resolveClaimedGuestJobUser(params: {
  user: AppUser;
  jobId: string;
  sessionId?: string;
}): Promise<AppUser> {
  const guestId = params.user.id.trim();
  const jobId = params.jobId.trim();
  if (
    params.user.authMode !== "guest"
    || !isGuestUserId(guestId)
    || !jobId
    || !supabaseConfig.adminEnabled
  ) {
    return params.user;
  }

  try {
    const [guestResult, jobResult] = await Promise.all([
      getSupabaseAdminClient()
        .from("guest_accounts")
        .select("claimed_user_id")
        .eq("id", guestId)
        .maybeSingle(),
      getSupabaseAdminClient()
        .from("jobs")
        .select("user_id,guest_user_id,session_id")
        .eq("id", jobId)
        .maybeSingle()
    ]);

    if (guestResult.error || jobResult.error) {
      console.warn("[socialmedia] failed to resolve claimed guest job handoff", {
        guestId,
        jobId,
        guestError: guestResult.error?.message,
        jobError: jobResult.error?.message
      });
      return params.user;
    }

    return resolveClaimedGuestJobHandoffUser({
      user: params.user,
      expectedSessionId: params.sessionId,
      ownership: {
        claimedUserId: guestResult.data?.claimed_user_id,
        jobUserId: jobResult.data?.user_id,
        jobGuestUserId: jobResult.data?.guest_user_id,
        jobSessionId: jobResult.data?.session_id
      }
    }) ?? params.user;
  } catch (error) {
    console.warn("[socialmedia] failed to resolve claimed guest job handoff", {
      guestId,
      jobId,
      error: error instanceof Error ? error.message : String(error)
    });
    return params.user;
  }
}

export async function resolveClaimedGuestJobOwnerId(params: {
  guestId: string;
  jobId: string;
  sessionId?: string;
}): Promise<string | undefined> {
  const user = await resolveClaimedGuestJobUser({
    user: { id: params.guestId, authMode: "guest" },
    jobId: params.jobId,
    sessionId: params.sessionId
  });
  return user.authMode === "supabase" ? user.id : undefined;
}

export async function runGuestJobCreditMutationWithClaimHandoff(params: {
  guestId: string;
  jobId: string;
  holdGuest: () => Promise<unknown>;
  holdClaimedUser: (claimedUserId: string) => Promise<unknown>;
  resolveClaimedOwner?: (params: { guestId: string; jobId: string }) => Promise<string | undefined>;
}): Promise<{ billedOwnerUserId: string }> {
  try {
    await params.holdGuest();
    return { billedOwnerUserId: params.guestId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (!message.includes("GUEST_ACCOUNT_ALREADY_CLAIMED")) throw error;

    const resolveOwner = params.resolveClaimedOwner ?? resolveClaimedGuestJobOwnerId;
    const claimedUserId = await resolveOwner({
      guestId: params.guestId,
      jobId: params.jobId
    });
    if (!claimedUserId) throw error;

    await params.holdClaimedUser(claimedUserId);
    return { billedOwnerUserId: claimedUserId };
  }
}

export function resolveClaimedGuestSettlement(params: {
  heldCredits: number;
  actualCredits: number;
  claimedUserId?: string;
}): {
  consumeClaimedUserCredits: number;
  refundOriginalOwnerCredits: number;
} {
  const heldCredits = Math.max(0, Math.ceil(Number(params.heldCredits) || 0));
  const actualCredits = Math.min(heldCredits, Math.max(0, Math.ceil(Number(params.actualCredits) || 0)));
  if (params.claimedUserId?.trim()) {
    return {
      consumeClaimedUserCredits: actualCredits,
      refundOriginalOwnerCredits: 0
    };
  }
  return {
    consumeClaimedUserCredits: 0,
    refundOriginalOwnerCredits: Math.max(0, heldCredits - actualCredits)
  };
}

export async function consumeClaimedGuestUsageBestEffort(params: {
  consume: () => Promise<unknown>;
  onInsufficientCredits?: () => void;
}): Promise<"consumed" | "insufficient_credits"> {
  try {
    await params.consume();
    return "consumed";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (!message.includes("INSUFFICIENT_CREDITS")) throw error;
    params.onInsufficientCredits?.();
    return "insufficient_credits";
  }
}
