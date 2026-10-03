import type { PricingVariant } from "@/lib/billing/catalog";
import { isGuestUserId } from "@/lib/auth/guest";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseConfig } from "@/lib/supabase/config";
import { migrateAnonymousPricingExperimentAssignmentToUser } from "@/lib/billing/pricing-experiment-assignment";
import { migrateAnonymousSocialmediaInputModeExperimentAssignmentToUser } from "@/lib/socialmedia/input-mode-experiment-assignment";
import { migrateAnonymousSocialmediaAgentVersionExperimentAssignmentToUser } from "@/lib/socialmedia/agent-version-experiment-assignment";
import { migrateImageModelExperimentToUser } from "@/lib/socialmedia/image-model-experiment-assignment";

const GUEST_PRICING_TRANSFER_NEW_ACCOUNT_WINDOW_MS = 3 * 60 * 1_000;

export type GuestClaimOutcome =
  | "bound"
  | "already_bound"
  | "login_only"
  | "guest_bound_elsewhere";

type GuestAccountRow = {
  id: string;
  display_name: string | null;
  credit_balance: number | null;
  claimed_user_id: string | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
};

type GuestLedgerRow = {
  id: string;
  guest_id: string;
  type: "grant" | "hold" | "consume" | "refund" | "adjust";
  amount: number;
  balance_after: number;
  note: string | null;
  idempotency_key: string | null;
  created_at: string;
};

export type GuestAccount = {
  id: string;
  displayName: string;
  creditBalance: number;
  claimedUserId?: string;
  claimedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type GuestCreditLedgerEntry = {
  id: string;
  guestId: string;
  type: "grant" | "hold" | "consume" | "refund" | "adjust";
  amount: number;
  balanceAfter: number;
  note: string;
  idempotencyKey?: string;
  createdAt: string;
};

export type GuestAccountStatus = {
  account: GuestAccount;
  isClaimed: boolean;
  claimedEmail?: string;
  claimedProviders?: Array<"google" | "apple" | "email">;
};

export function resolveGuestClaimBalanceAdjustment(params: {
  guestBalance: number;
  accountBalance: number;
}): { type: "refund" | "none"; amount: number } {
  const guestBalance = Math.max(0, Math.ceil(Number(params.guestBalance) || 0));
  const accountBalance = Math.max(0, Math.ceil(Number(params.accountBalance) || 0));
  const delta = Math.max(guestBalance, accountBalance) - accountBalance;
  if (delta > 0) return { type: "refund", amount: delta };
  return { type: "none", amount: 0 };
}

export function resolveGuestClaimBalanceSyncState(params: {
  outcome: GuestClaimOutcome;
  result: Record<string, unknown> | null;
}): { balanceSynced: boolean; pending: boolean } {
  if (params.result?.synced === true) {
    return { balanceSynced: true, pending: false };
  }
  const reason = typeof params.result?.reason === "string" ? params.result.reason : "";
  if (params.outcome === "already_bound" && reason === "no_pending_claim_balance_sync") {
    // Historical claims may already have received their max-balance transfer.
    // Absence of a new durable receipt is an intentional skip, not retry work.
    return { balanceSynced: false, pending: false };
  }
  return { balanceSynced: false, pending: true };
}

function ensureGuestCreditsEnabled(): void {
  if (!supabaseConfig.adminEnabled) {
    throw new Error("GUEST_BILLING_NOT_CONFIGURED");
  }
}

function toGuestAccount(row: GuestAccountRow): GuestAccount {
  return {
    id: row.id,
    displayName: row.display_name?.trim() || "Guest",
    creditBalance: Math.max(0, Number(row.credit_balance ?? 0)),
    claimedUserId: row.claimed_user_id ?? undefined,
    claimedAt: row.claimed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toGuestLedgerEntry(row: GuestLedgerRow): GuestCreditLedgerEntry {
  return {
    id: row.id,
    guestId: row.guest_id,
    type: row.type,
    amount: Number(row.amount ?? 0),
    balanceAfter: Math.max(0, Number(row.balance_after ?? 0)),
    note: row.note ?? "",
    idempotencyKey: row.idempotency_key ?? undefined,
    createdAt: row.created_at
  };
}

export function isInsufficientGuestCreditsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("INSUFFICIENT_GUEST_CREDITS");
}

export function isClaimedGuestAccountError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("GUEST_ACCOUNT_ALREADY_CLAIMED");
}

export function buildClaimedGuestMessage(claimedEmail?: string): string {
  const email = claimedEmail?.trim();
  if (email) {
    return `This guest workspace is already linked to ${email}. Please sign in to continue.`;
  }
  return "This guest workspace is already linked to an existing account. Please sign in to continue.";
}

async function selectGuestAccountById(
  guestId: string,
  options?: { requireSignupGrant?: boolean }
): Promise<GuestAccount | null> {
  const client = getSupabaseAdminClient();
  const columns = options?.requireSignupGrant
    ? "id, display_name, credit_balance, claimed_user_id, claimed_at, created_at, updated_at, signup_grant:guest_credit_ledger(id)"
    : "id, display_name, credit_balance, claimed_user_id, claimed_at, created_at, updated_at";
  let query = client
    .from("guest_accounts")
    .select(columns)
    .eq("id", guestId);
  if (options?.requireSignupGrant) {
    // A left embedded relation keeps partially initialized accounts visible.
    // Check the exact idempotent receipt in the same request as the balance.
    query = query.eq("signup_grant.idempotency_key", `guest-signup-grant-${guestId}`);
  }
  const { data, error } = await query
    .returns<Array<GuestAccountRow & { signup_grant?: Array<{ id: string }> }>>()
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (data && options?.requireSignupGrant) {
    const receipt = data.signup_grant;
    // Missing receipt means initialization failed between the two upserts.
    // Let the caller retry them; neither upsert resets the existing balance.
    if (!receipt?.length) return null;
  }
  return data ? toGuestAccount(data) : null;
}

export async function isGuestAccountClaimedByUser(params: {
  guestId: string;
  userId: string;
}): Promise<boolean> {
  ensureGuestCreditsEnabled();
  const account = await selectGuestAccountById(params.guestId.trim().toLowerCase());
  return account?.claimedUserId === params.userId.trim();
}

async function ensureGuestAccountDirect(guestId: string): Promise<GuestAccount> {
  const client = getSupabaseAdminClient();
  const { error: upsertError } = await client
    .from("guest_accounts")
    .upsert(
      {
        id: guestId,
        display_name: "Guest"
      },
      {
        onConflict: "id",
        ignoreDuplicates: false
      }
    );
  if (upsertError) {
    throw new Error(upsertError.message);
  }

  const { error: grantError } = await client
    .from("guest_credit_ledger")
    .upsert(
      {
        guest_id: guestId,
        type: "grant",
        amount: 20,
        balance_after: 20,
        note: "guest signup bonus",
        idempotency_key: `guest-signup-grant-${guestId}`
      },
      {
        onConflict: "idempotency_key",
        ignoreDuplicates: true
      }
    );
  if (grantError) {
    throw new Error(grantError.message);
  }

  const account = await selectGuestAccountById(guestId);
  if (!account) {
    throw new Error("GUEST_ACCOUNT_NOT_FOUND");
  }
  return account;
}

async function lookupClaimedEmail(claimedUserId?: string): Promise<string | undefined> {
  const userId = claimedUserId?.trim();
  if (!userId) {
    return undefined;
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }

  const email = typeof data?.email === "string" ? data.email.trim() : "";
  return email || undefined;
}

function normalizeClaimedAuthProvider(value: unknown): "google" | "apple" | "email" | undefined {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "google" || normalized === "apple" || normalized === "email") return normalized;
  return undefined;
}

async function lookupClaimedAuthProviders(claimedUserId?: string): Promise<Array<"google" | "apple" | "email">> {
  const userId = claimedUserId?.trim();
  if (!userId) return [];

  const client = getSupabaseAdminClient();
  const { data, error } = await client.auth.admin.getUserById(userId);
  if (error) {
    throw new Error(error.message);
  }

  const providers = new Set<"google" | "apple" | "email">();
  const user = data.user;

  for (const identity of user?.identities ?? []) {
    const provider = normalizeClaimedAuthProvider((identity as { provider?: unknown }).provider);
    if (provider) providers.add(provider);
  }

  const appProviders = Array.isArray(user?.app_metadata?.providers)
    ? user.app_metadata.providers
    : [];
  for (const item of appProviders) {
    const provider = normalizeClaimedAuthProvider(item);
    if (provider) providers.add(provider);
  }

  return [...providers];
}

async function applyGuestCreditDebitDirect(params: {
  guestId: string;
  amount: number;
  note: string;
  type: "consume" | "hold";
  jobId?: string;
  idempotencyKey?: string;
}): Promise<GuestCreditLedgerEntry> {
  const client = getSupabaseAdminClient();
  const amount = Math.max(0, Math.ceil(Number(params.amount) || 0));
  if (amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  if (params.idempotencyKey) {
    const { data: existing, error: existingError } = await client
      .from("guest_credit_ledger")
      .select("id, guest_id, type, amount, balance_after, note, idempotency_key, created_at")
      .eq("guest_id", params.guestId)
      .eq("idempotency_key", params.idempotencyKey)
      .maybeSingle();
    if (existingError) {
      throw new Error(existingError.message);
    }
    if (existing) {
      return toGuestLedgerEntry(existing as GuestLedgerRow);
    }
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const account = await ensureGuestAccountDirect(params.guestId);
    if (account.claimedUserId) {
      throw new Error("GUEST_ACCOUNT_ALREADY_CLAIMED");
    }
    if (account.creditBalance < amount) {
      throw new Error("INSUFFICIENT_GUEST_CREDITS");
    }

    const nextBalance = account.creditBalance - amount;
    const { data: updatedRows, error: updateError } = await client
      .from("guest_accounts")
      .update({ credit_balance: nextBalance })
      .eq("id", params.guestId)
      .eq("credit_balance", account.creditBalance)
      .is("claimed_user_id", null)
      .select("id")
      .limit(1);
    if (updateError) {
      throw new Error(updateError.message);
    }
    if (!updatedRows?.length) {
      continue;
    }

    const { data: inserted, error: insertError } = await client
      .from("guest_credit_ledger")
      .insert({
        guest_id: params.guestId,
        job_id: params.jobId ?? null,
        type: params.type,
        amount,
        balance_after: nextBalance,
        note: params.note,
        idempotency_key: params.idempotencyKey ?? null
      })
      .select("id, guest_id, type, amount, balance_after, note, idempotency_key, created_at")
      .single();
    if (insertError || !inserted) {
      throw new Error(insertError?.message ?? "GUEST_CREDIT_OPERATION_FAILED");
    }
    return toGuestLedgerEntry(inserted as GuestLedgerRow);
  }

  throw new Error("GUEST_CREDIT_OPERATION_FAILED");
}

async function refundGuestCreditsDirect(params: {
  guestId: string;
  amount: number;
  note: string;
  jobId?: string;
  idempotencyKey?: string;
}): Promise<GuestCreditLedgerEntry> {
  const client = getSupabaseAdminClient();
  const amount = Math.max(0, Math.ceil(Number(params.amount) || 0));
  if (amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  if (params.idempotencyKey) {
    const { data: existing, error: existingError } = await client
      .from("guest_credit_ledger")
      .select("id, guest_id, type, amount, balance_after, note, idempotency_key, created_at")
      .eq("guest_id", params.guestId)
      .eq("idempotency_key", params.idempotencyKey)
      .maybeSingle();
    if (existingError) {
      throw new Error(existingError.message);
    }
    if (existing) {
      return toGuestLedgerEntry(existing as GuestLedgerRow);
    }
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const account = await ensureGuestAccountDirect(params.guestId);
    if (account.claimedUserId) {
      throw new Error("GUEST_ACCOUNT_ALREADY_CLAIMED");
    }

    const nextBalance = account.creditBalance + amount;
    const { data: updatedRows, error: updateError } = await client
      .from("guest_accounts")
      .update({ credit_balance: nextBalance })
      .eq("id", params.guestId)
      .eq("credit_balance", account.creditBalance)
      .is("claimed_user_id", null)
      .select("id")
      .limit(1);
    if (updateError) {
      throw new Error(updateError.message);
    }
    if (!updatedRows?.length) {
      continue;
    }

    const { data: inserted, error: insertError } = await client
      .from("guest_credit_ledger")
      .insert({
        guest_id: params.guestId,
        job_id: params.jobId ?? null,
        type: "refund",
        amount,
        balance_after: nextBalance,
        note: params.note,
        idempotency_key: params.idempotencyKey ?? null
      })
      .select("id, guest_id, type, amount, balance_after, note, idempotency_key, created_at")
      .single();
    if (insertError || !inserted) {
      throw new Error(insertError?.message ?? "GUEST_CREDIT_OPERATION_FAILED");
    }

    return toGuestLedgerEntry(inserted as GuestLedgerRow);
  }

  const account = await selectGuestAccountById(params.guestId);
  if (account?.claimedUserId) {
    throw new Error("GUEST_ACCOUNT_ALREADY_CLAIMED");
  }
  throw new Error("GUEST_CREDIT_OPERATION_FAILED");
}

export async function ensureGuestAccount(guestId: string): Promise<GuestAccount> {
  ensureGuestCreditsEnabled();
  return ensureGuestAccountDirect(guestId);
}

export async function getGuestAccountStatus(
  guestId: string,
  options?: { preferExisting?: boolean }
): Promise<GuestAccountStatus> {
  ensureGuestCreditsEnabled();
  const account = options?.preferExisting
    ? await selectGuestAccountById(guestId, { requireSignupGrant: true }) ?? await ensureGuestAccountDirect(guestId)
    : await ensureGuestAccountDirect(guestId);
  const [claimedEmail, claimedProviders] = account.claimedUserId
    ? await Promise.all([
        lookupClaimedEmail(account.claimedUserId),
        lookupClaimedAuthProviders(account.claimedUserId).catch(() => [])
      ])
    : [undefined, []];
  return {
    account,
    isClaimed: Boolean(account.claimedUserId),
    claimedEmail,
    claimedProviders
  };
}

export async function getGuestCreditBalance(guestId: string): Promise<number> {
  const account = await ensureGuestAccount(guestId);
  return account.creditBalance;
}

export async function consumeGuestCredits(params: {
  guestId: string;
  amount: number;
  note: string;
  jobId?: string;
  idempotencyKey?: string;
}): Promise<GuestCreditLedgerEntry> {
  ensureGuestCreditsEnabled();
  return applyGuestCreditDebitDirect({ ...params, type: "consume" });
}

export async function holdGuestCredits(params: {
  guestId: string;
  amount: number;
  note: string;
  jobId?: string;
  idempotencyKey?: string;
}): Promise<GuestCreditLedgerEntry> {
  ensureGuestCreditsEnabled();
  return applyGuestCreditDebitDirect({ ...params, type: "hold" });
}

export async function refundGuestCredits(params: {
  guestId: string;
  amount: number;
  note: string;
  jobId?: string;
  idempotencyKey?: string;
}): Promise<GuestCreditLedgerEntry> {
  ensureGuestCreditsEnabled();
  return refundGuestCreditsDirect(params);
}

export async function claimGuestAccount(params: {
  guestId: string;
  userId: string;
  requireExistingPair?: boolean;
}): Promise<{
  outcome: GuestClaimOutcome;
  guestAccount: GuestAccount;
  balanceSynced: boolean;
  secondarySyncPending: boolean;
  migratedRows: Record<string, number>;
  pricingVariant?: PricingVariant;
}> {
  ensureGuestCreditsEnabled();
  const guestId = params.guestId.trim().toLowerCase();
  const client = getSupabaseAdminClient();
  const guestAccountBeforeClaim = await ensureGuestAccount(guestId);

  const { data: rpcData, error: rpcError } = await client.rpc("claim_guest_workspace", {
    p_guest_id: guestId,
    p_user_id: params.userId,
    p_require_existing_pair: params.requireExistingPair === true
  });
  if (rpcError) {
    const message = rpcError.message || "GUEST_ACCOUNT_CLAIM_FAILED";
    if (message.includes("USER_PROFILE_NOT_FOUND")) {
      throw new Error("GUEST_CLAIM_ACCOUNT_NOT_READY");
    }
    throw new Error(message);
  }

  const rawResult = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as Record<string, unknown> | null;
  const rawOutcome = typeof rawResult?.outcome === "string" ? rawResult.outcome : "";
  if (
    rawOutcome !== "bound"
    && rawOutcome !== "already_bound"
    && rawOutcome !== "login_only"
    && rawOutcome !== "guest_bound_elsewhere"
  ) {
    throw new Error("GUEST_CLAIM_INVALID_DATABASE_RESULT");
  }
  const outcome: GuestClaimOutcome = rawOutcome;

  const migratedRows = Object.fromEntries(
    Object.entries(
      rawResult?.migrated_rows && typeof rawResult.migrated_rows === "object"
        ? rawResult.migrated_rows as Record<string, unknown>
        : {}
    ).map(([key, value]) => [key, Math.max(0, Number(value) || 0)])
  );
  // Do not perform a required read after the RPC: ownership is already
  // committed at that point, so a transient read failure must not turn a
  // successful claim into a reported 500. The RPC does not alter guest credit
  // or profile metadata, and the relationship outcome supplies the only field
  // that can change here.
  const guestAccount: GuestAccount = outcome === "bound"
    ? {
        ...guestAccountBeforeClaim,
        claimedUserId: params.userId,
        claimedAt: new Date().toISOString()
      }
    : guestAccountBeforeClaim;

  const ownsGuestWorkspace = outcome === "bound" || outcome === "already_bound";
  let pricingVariant: PricingVariant | undefined;
  let balanceSynced = false;
  let secondarySyncPending = false;

  if (ownsGuestWorkspace) {
    try {
      const { data: balanceData, error: balanceError } = await client.rpc("sync_guest_claim_balance", {
        p_guest_id: guestId,
        p_user_id: params.userId
      });
      if (balanceError) throw new Error(balanceError.message);

      const balanceResult = (Array.isArray(balanceData) ? balanceData[0] : balanceData) as Record<string, unknown> | null;
      const balanceState = resolveGuestClaimBalanceSyncState({ outcome, result: balanceResult });
      balanceSynced = balanceState.balanceSynced;
      secondarySyncPending ||= balanceState.pending;
    } catch {
      secondarySyncPending = true;
    }

    try {
      const pricingAssignment = await migrateAnonymousPricingExperimentAssignmentToUser({
        anonymousId: guestId,
        userId: params.userId
      });
      if (pricingAssignment.migrated) {
        migratedRows.pricing_experiment_assignment = 1;
        pricingVariant = pricingAssignment.variant;
      }
    } catch {
      secondarySyncPending = true;
    }

    try {
      const inputModeAssignment = await migrateAnonymousSocialmediaInputModeExperimentAssignmentToUser({
        anonymousId: guestId,
        userId: params.userId
      });
      if (inputModeAssignment.migrated) migratedRows.socialmedia_input_mode_experiment_assignment = 1;
    } catch {
      secondarySyncPending = true;
    }

    try {
      const agentVersionAssignment = await migrateAnonymousSocialmediaAgentVersionExperimentAssignmentToUser({
        anonymousId: guestId,
        userId: params.userId
      });
      if (agentVersionAssignment.migrated) {
        migratedRows.socialmedia_agent_version_experiment_assignment = 1;
      }
    } catch {
      secondarySyncPending = true;
    }

    try {
      const assignment = await migrateImageModelExperimentToUser({ anonymousId: guestId, userId: params.userId });
      if (assignment.migrated) migratedRows.image_model_experiment_assignment = 1;
    } catch {
      secondarySyncPending = true;
    }
  }

  return {
    outcome,
    guestAccount,
    balanceSynced,
    secondarySyncPending,
    migratedRows,
    pricingVariant
  };
}

/**
 * Seeds a brand-new signed-in account with its guest pricing assignment before
 * the browser renders an account snapshot. This keeps the first signed-in
 * pricing surface on the same variant the guest just saw, while preserving the
 * existing claim rule that an established account must never inherit a guest
 * experiment assignment.
 *
 * The full guest workspace migration remains asynchronous in claimGuestAccount.
 */
export async function seedNewUserPricingExperimentFromGuest(params: {
  guestId: string;
  userId: string;
  userCreatedAt?: string | null;
}): Promise<PricingVariant | undefined> {
  if (!supabaseConfig.adminEnabled) return undefined;

  const guestId = params.guestId.trim();
  const userId = params.userId.trim();
  if (!isGuestUserId(guestId) || !userId) return undefined;

  // Profile and credit-ledger rows can lag behind auth user creation, so using
  // their readiness here would reopen the assignment race we are trying to
  // prevent. The auth-user creation time keeps established accounts out of
  // this path for both OAuth and email OTP registration.
  if (!isNewGuestPricingTransferAccount(params.userCreatedAt)) {
    return undefined;
  }

  const guestAccount = await selectGuestAccountById(guestId);
  // A claimed guest belongs to another flow/account and must never be merged
  // into a newly signed-in user from the callback.
  if (!guestAccount || guestAccount.claimedUserId) return undefined;

  const assignment = await migrateAnonymousPricingExperimentAssignmentToUser({
    anonymousId: guestId,
    userId,
    source: "signup_guest_transfer"
  });
  return assignment.migrated ? assignment.variant : undefined;
}

export function isNewGuestPricingTransferAccount(userCreatedAt?: string | null): boolean {
  const createdAt = Date.parse(userCreatedAt ?? "");
  const ageMs = Date.now() - createdAt;
  return Number.isFinite(createdAt)
    && ageMs >= 0
    && ageMs <= GUEST_PRICING_TRANSFER_NEW_ACCOUNT_WINDOW_MS;
}
