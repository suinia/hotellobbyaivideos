export const GUEST_CLAIM_REQUIRES_NEW_ACCOUNT = "GUEST_CLAIM_REQUIRES_NEW_ACCOUNT";
export const GUEST_ACCOUNT_ALREADY_CLAIMED = "GUEST_ACCOUNT_ALREADY_CLAIMED";
// Deliberately not a valid guest id. Old claim routes reject this instead of
// stripping the new intent fields and accidentally claiming a residual cookie.
export const GUEST_CLAIM_INTENT_RECOVERY_SENTINEL = "guest-claim-intent-v1";

export type GuestClaimAttemptOutcome = "claimed" | "existing_account";
export type GuestClaimOutcome = "bound" | "already_bound" | "login_only" | "guest_bound_elsewhere";

const GUEST_CLAIM_OUTCOMES = new Set<GuestClaimOutcome>([
  "bound",
  "already_bound",
  "login_only",
  "guest_bound_elsewhere"
]);

/**
 * Normalizes the relationship outcome while old and new claim endpoints are
 * both live. A legacy successful response meant the workspace was migrated;
 * the two legacy relationship errors map to their non-exceptional v1 states.
 */
export function resolveGuestClaimOutcome(input: {
  ok: boolean;
  outcome?: unknown;
  error?: unknown;
}): GuestClaimOutcome | undefined {
  if (typeof input.outcome === "string" && GUEST_CLAIM_OUTCOMES.has(input.outcome as GuestClaimOutcome)) {
    return input.outcome as GuestClaimOutcome;
  }

  const error = typeof input.error === "string" ? input.error : "";
  if (error.includes(GUEST_CLAIM_REQUIRES_NEW_ACCOUNT)) return "login_only";
  if (error.includes(GUEST_ACCOUNT_ALREADY_CLAIMED)) return "guest_bound_elsewhere";
  return input.ok ? "bound" : undefined;
}

export function guestClaimKeepsCurrentWorkspace(outcome: GuestClaimOutcome | undefined): boolean {
  return outcome === "bound" || outcome === "already_bound";
}

export function shouldResolveGuestClaimForAuthMode(authMode: unknown): boolean {
  return authMode === "guest" || authMode === "guest_claimed";
}

/** Best-effort server-side intent handoff for OAuth/OTP flows. */
export async function prepareGuestClaimIntent(): Promise<boolean> {
  try {
    const response = await fetch("/api/v1/account/guest-claim-intent", {
      method: "POST",
      cache: "no-store"
    });
    return response.ok;
  } catch {
    // Older servers and temporary network failures must not block sign-in.
    return false;
  }
}

export async function clearGuestClaimIntent(): Promise<boolean> {
  try {
    const response = await fetch("/api/v1/account/guest-claim-intent", {
      method: "DELETE",
      cache: "no-store"
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function reconcilePendingGuestClaimIdentity<T extends { guestId?: string }>(
  pending: T,
  canonicalGuestId: string
): T {
  return pending.guestId === canonicalGuestId
    ? pending
    : { ...pending, guestId: canonicalGuestId };
}

export function isExistingAccountGuestClaimSkip(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes(GUEST_CLAIM_REQUIRES_NEW_ACCOUNT);
}

export async function resolveGuestClaimAttempt(
  attempt: () => Promise<void>
): Promise<GuestClaimAttemptOutcome> {
  try {
    await attempt();
    return "claimed";
  } catch (error) {
    if (isExistingAccountGuestClaimSkip(error)) return "existing_account";
    throw error;
  }
}

export function createGuestClaimAttemptCoordinator(): {
  run: (attempt: () => Promise<void>) => Promise<GuestClaimAttemptOutcome>;
} {
  let request: Promise<GuestClaimAttemptOutcome> | null = null;

  return {
    run(attempt) {
      if (request) return request;

      const nextRequest = resolveGuestClaimAttempt(attempt);
      request = nextRequest;
      void nextRequest.then(
        () => {
          if (request === nextRequest) request = null;
        },
        () => {
          if (request === nextRequest) request = null;
        }
      );
      return nextRequest;
    }
  };
}
