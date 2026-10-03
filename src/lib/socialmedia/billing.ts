import type { AppUser } from "@/lib/auth/app-user";
import { isGuestUserId } from "@/lib/auth/guest";
import { consumeCredits, getCreditSummary, holdCredits, refundCredits } from "@/lib/billing/credits";
import { getStarterPackCreditBalance } from "@/lib/billing/starter-pack";
import { hasActiveBillingSubscriptionForPricingVariant } from "@/lib/billing/subscription-bindings";
import {
  buildClaimedGuestMessage,
  getGuestAccountStatus,
  getGuestCreditBalance,
  holdGuestCredits,
  isClaimedGuestAccountError,
  refundGuestCredits
} from "@/lib/billing/guest-credits";
import { appConfig } from "@/lib/config";
import {
  consumeClaimedGuestUsageBestEffort,
  resolveClaimedGuestJobOwnerId,
  resolveClaimedGuestSettlement,
  runGuestJobCreditMutationWithClaimHandoff
} from "@/lib/socialmedia/claimed-guest-handoff";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseConfig } from "@/lib/supabase/config";
import type {
  SocialmediaAspectRatio,
  SocialmediaGeneratedImage,
  SocialmediaResolution
} from "@/lib/socialmedia/types";

export type SocialmediaImageBillingQuality = "low" | "medium" | "high";

export type SocialmediaImageBillingQuote = {
  resolution: SocialmediaResolution;
  quality: SocialmediaImageBillingQuality;
  imageCount: number;
  creditsPerImage: number;
  totalCredits: number;
  costKey: string;
};

export type SocialmediaImageBillingHold = SocialmediaImageBillingQuote & {
  billedOwnerUserId?: string;
};

export type SocialmediaCreditAvailability =
  | {
      ok: true;
      quote: SocialmediaImageBillingQuote;
      balance?: number;
    }
  | {
      ok: false;
      quote: SocialmediaImageBillingQuote;
      balance: number;
      error: string;
    };

export type SocialmediaGenerationBillingDecision =
  | {
      ok: true;
      mode: "paid_hold";
      quote: SocialmediaImageBillingQuote;
      balance?: number;
    }
  | {
      ok: true;
      mode: "free_watermarked_hold";
      quote: SocialmediaImageBillingQuote;
      balance: number;
    }
  | {
      ok: true;
      mode: "free_locked_preview";
      quote: SocialmediaImageBillingQuote;
      balance: number;
    }
  | {
      ok: false;
      quote: SocialmediaImageBillingQuote;
      balance: number;
      error: string;
    };

const SOCIALMEDIA_BILLING_MAX_ATTEMPTS = Math.max(1, Number(process.env.SOCIALMEDIA_BILLING_MAX_ATTEMPTS ?? 3) || 3);
const SOCIALMEDIA_BILLING_RETRY_DELAY_MS = Math.max(
  0,
  Number(process.env.SOCIALMEDIA_BILLING_RETRY_DELAY_MS ?? 800) || 800
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBillingMutationWithRetry<T>(params: {
  operation: string;
  ownerUserId: string;
  jobId: string;
  run: () => Promise<T>;
}): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= SOCIALMEDIA_BILLING_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await params.run();
    } catch (error) {
      lastError = error;
      console.warn("[socialmedia-billing] mutation attempt failed", {
        operation: params.operation,
        ownerUserId: params.ownerUserId,
        jobId: params.jobId,
        attempt,
        maxAttempts: SOCIALMEDIA_BILLING_MAX_ATTEMPTS,
        message: error instanceof Error ? error.message : String(error)
      });
      if (attempt < SOCIALMEDIA_BILLING_MAX_ATTEMPTS && SOCIALMEDIA_BILLING_RETRY_DELAY_MS > 0) {
        await sleep(SOCIALMEDIA_BILLING_RETRY_DELAY_MS);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "Billing mutation failed"));
}

function normalizeBillingQuality(value?: string | null): SocialmediaImageBillingQuality {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "low" || normalized === "medium") return normalized;
  return "high";
}

function buildCostKey(resolution: SocialmediaResolution, quality: SocialmediaImageBillingQuality): string {
  return `${resolution.toUpperCase()}_${quality}`;
}

function resolveCreditsPerImage(resolution: SocialmediaResolution, quality: SocialmediaImageBillingQuality): {
  creditsPerImage: number;
  costKey: string;
} {
  const costKey = buildCostKey(resolution, quality);
  const configured = appConfig.billing.imageCreditCosts[costKey];
  const fallback = appConfig.billing.imageCostCredits;
  return {
    creditsPerImage: Math.max(0, Math.ceil(Number(configured ?? fallback) || 0)),
    costKey
  };
}

export function buildUpgradeCreditShortfallMessage(params: {
  totalCredits: number;
  balance: number;
}): string {
  const shortfall = Math.max(0, Math.ceil(params.totalCredits - params.balance));
  return `You need ${shortfall} more credits for this generation. Upgrade to keep creating HD, watermark-free images.`;
}

export function buildGuestSignupCreditShortfallMessage(params: {
  totalCredits: number;
  balance: number;
}): string {
  const shortfall = Math.max(0, Math.ceil(params.totalCredits - params.balance));
  return `You need ${shortfall} more credits for this generation.`;
}

export function getSocialmediaImageBillingQuality(
  quality?: string | null
): SocialmediaImageBillingQuality {
  // Quality is not exposed as a billing input. Omitted values always use the
  // low pricing tier; explicit values are only normalized for generation and
  // legacy persisted jobs.
  return normalizeBillingQuality(quality ?? "low");
}

export function resolveSocialmediaImageGenerationQuality(
  params: {
    resolution?: string | null;
    agentQuality?: string | null;
  } = {}
): SocialmediaImageBillingQuality {
  const normalizedResolution = String(params.resolution ?? "").trim().toLowerCase();
  if (normalizedResolution === "2k" || normalizedResolution === "4k") {
    return "low";
  }
  // At 1K, generation stays on the current medium baseline unless an Agent
  // makes an explicit, valid low-quality decision. Missing, malformed, and
  // legacy decisions must never silently downgrade an image.
  return String(params.agentQuality ?? "").trim().toLowerCase() === "low"
    ? "low"
    : "medium";
}

export function calculateSocialmediaImageBillingQuote(params: {
  resolution: SocialmediaResolution;
  imageCount: number;
  quality?: string | null;
  aspectRatio?: SocialmediaAspectRatio;
  pricingVariant?: string | null;
}): SocialmediaImageBillingQuote {
  const imageCount = Math.max(0, Math.ceil(Number(params.imageCount) || 0));
  const quality = normalizeBillingQuality(params.quality ?? getSocialmediaImageBillingQuality());
  const baseCost = resolveCreditsPerImage(params.resolution, quality);
  const usesFixedCreditPricing = params.pricingVariant === "2.1" || params.pricingVariant === "2.2";
  const creditsPerImage = usesFixedCreditPricing ? 10 : baseCost.creditsPerImage;
  const costKey = usesFixedCreditPricing
    ? `${baseCost.costKey}*pricing-${params.pricingVariant}`
    : baseCost.costKey;
  return {
    resolution: params.resolution,
    quality,
    imageCount,
    creditsPerImage,
    totalCredits: imageCount * creditsPerImage,
    costKey
  };
}

export function calculatePersistedSocialmediaImageBillingQuote(params: {
  requestedResolution: SocialmediaResolution;
  /** A server-funded render upgrade must not raise the customer's quoted tier. */
  capAtRequestedResolution?: boolean;
  images: ReadonlyArray<Pick<SocialmediaGeneratedImage, "provider" | "resolution">>;
  quality?: string | null;
}): SocialmediaImageBillingQuote {
  if (!params.images.length) {
    return calculateSocialmediaImageBillingQuote({
      resolution: params.requestedResolution,
      imageCount: 0,
      quality: params.quality
    });
  }

  const imageCountsByResolution = new Map<SocialmediaResolution, number>();
  for (const image of params.images) {
    let resolution = image.provider?.startsWith("openrouter:")
      ? image.resolution ?? "1k"
      : params.requestedResolution;
    const tiers: Record<SocialmediaResolution, number> = { "1k": 1, "2k": 2, "4k": 4 };
    if (params.capAtRequestedResolution && tiers[resolution] > tiers[params.requestedResolution]) {
      resolution = params.requestedResolution;
    }
    imageCountsByResolution.set(resolution, (imageCountsByResolution.get(resolution) ?? 0) + 1);
  }

  const quotes = Array.from(imageCountsByResolution, ([resolution, imageCount]) => (
    calculateSocialmediaImageBillingQuote({
      resolution,
      imageCount,
      quality: params.quality
    })
  ));
  if (quotes.length === 1) return quotes[0];

  const totalCredits = quotes.reduce((total, quote) => total + quote.totalCredits, 0);
  return {
    resolution: params.requestedResolution,
    quality: quotes[0].quality,
    imageCount: params.images.length,
    creditsPerImage: totalCredits / params.images.length,
    totalCredits,
    costKey: `mixed:${quotes.map((quote) => quote.costKey).join("+")}`
  };
}

function calculateStarterPackWatermarkFreeQuote(quote: SocialmediaImageBillingQuote): SocialmediaImageBillingQuote {
  return {
    ...quote,
    costKey: "starter_pack_watermark_free"
  };
}

export function resolveSocialmediaBillingResolution(params: {
  resolution: SocialmediaResolution;
  plan?: string | null;
}): SocialmediaResolution {
  return params.plan === "free"
    ? "1k"
    : params.resolution;
}

export async function ensureSocialmediaImageCreditsAvailable(params: {
  user: AppUser;
  resolution: SocialmediaResolution;
  imageCount: number;
  quality?: string | null;
  knownCreditBalance?: number;
  pricingVariant?: string | null;
}): Promise<SocialmediaCreditAvailability> {
  const quote = calculateSocialmediaImageBillingQuote(params);
  if (quote.totalCredits <= 0 || params.user.authMode === "local-dev" || params.user.authMode === "api-key") {
    return { ok: true, quote };
  }

  let balance: number;
  try {
    const knownBalance = Number(params.knownCreditBalance);
    balance = Number.isFinite(knownBalance) && knownBalance >= 0
      ? Math.max(0, knownBalance)
      : params.user.authMode === "guest" || isGuestUserId(params.user.id)
        ? await getGuestCreditBalance(params.user.id)
        : (await getCreditSummary(params.user.id, 1)).balance;
  } catch (error) {
    if (isClaimedGuestAccountError(error)) {
      return {
        ok: false,
        quote,
        balance: 0,
        error: buildClaimedGuestMessage()
      };
    }
    throw error;
  }

  if (balance < quote.totalCredits) {
    if (params.user.authMode === "supabase" && !isGuestUserId(params.user.id)) {
      const refreshedSummary = await getCreditSummary(params.user.id, 1, {
        requiredCredits: quote.totalCredits
      });
      balance = refreshedSummary.balance;
    }
  }

  if (balance < quote.totalCredits) {
    const isGuest = params.user.authMode === "guest" || isGuestUserId(params.user.id);
    return {
      ok: false,
      quote,
      balance,
      error: (isGuest ? buildGuestSignupCreditShortfallMessage : buildUpgradeCreditShortfallMessage)({
        totalCredits: quote.totalCredits,
        balance
      })
    };
  }

  return { ok: true, quote, balance };
}

function isBillingBypassUser(user: AppUser): boolean {
  return user.authMode === "local-dev" || user.authMode === "api-key";
}

async function getLastCreditCycleStartAt(user: AppUser): Promise<string | null> {
  if (!supabaseConfig.adminEnabled) return null;

  const client = getSupabaseAdminClient();
  if (user.authMode === "guest" || isGuestUserId(user.id)) {
    const { data, error } = await client
      .from("guest_credit_ledger")
      .select("created_at")
      .eq("guest_id", user.id)
      .eq("type", "grant")
      .gt("amount", 0)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn("[socialmedia-billing] failed to read guest credit cycle", {
        guestId: user.id,
        error: error.message
      });
      return null;
    }
    if (typeof data?.created_at === "string") return data.created_at;

    const { data: account, error: accountError } = await client
      .from("guest_accounts")
      .select("created_at")
      .eq("id", user.id)
      .maybeSingle();
    if (accountError) {
      console.warn("[socialmedia-billing] failed to read guest account cycle fallback", {
        guestId: user.id,
        error: accountError.message
      });
      return null;
    }
    return typeof account?.created_at === "string" ? account.created_at : null;
  }

  if (user.authMode !== "supabase") return null;

  const { data, error } = await client
    .from("credit_ledger")
    .select("created_at")
    .eq("user_id", user.id)
    .eq("type", "grant")
    .gt("amount", 0)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("[socialmedia-billing] failed to read credit cycle", {
      userId: user.id,
      error: error.message
    });
    return null;
  }
  if (typeof data?.created_at === "string") return data.created_at;

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("created_at")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.warn("[socialmedia-billing] failed to read credit cycle profile fallback", {
      userId: user.id,
      error: profileError.message
    });
    return null;
  }
  return typeof profile?.created_at === "string" ? profile.created_at : null;
}

async function hasFreeLockedPreviewInCycle(user: AppUser, cycleStartAt: string): Promise<boolean> {
  if (!supabaseConfig.adminEnabled) return false;

  const client = getSupabaseAdminClient();
  const ownerColumn = user.authMode === "guest" || isGuestUserId(user.id) ? "guest_user_id" : "user_id";
  const { data, error } = await client
    .from("jobs")
    .select("id, payload_json")
    .eq(ownerColumn, user.id)
    .in("status", ["queued", "running", "completed"])
    .filter("payload_json->socialmedia->>billingMode", "eq", "free_locked_preview")
    .gte("created_at", cycleStartAt);
  if (error) {
    console.warn("[socialmedia-billing] failed to read free locked preview usage", {
      userId: user.id,
      ownerColumn,
      cycleStartAt,
      error: error.message
    });
    return hasFreeLockedPreviewAssetInCycle({
      ownerColumn,
      ownerUserId: user.id,
      cycleStartAt
    });
  }
  return (data ?? []).some((job) => {
    const socialmedia = (job as { payload_json?: { socialmedia?: Record<string, unknown> } | null }).payload_json?.socialmedia;
    if (typeof socialmedia?.claimed_from_guest_id === "string" && socialmedia.claimed_from_guest_id.trim()) {
      return false;
    }
    if (typeof socialmedia?.free_locked_preview_reset_at === "string" && socialmedia.free_locked_preview_reset_at.trim()) {
      return false;
    }
    return true;
  }) || await hasFreeLockedPreviewAssetInCycle({
    ownerColumn,
    ownerUserId: user.id,
    cycleStartAt
  });
}

async function hasFreeLockedPreviewAssetInCycle(params: {
  ownerColumn: "user_id" | "guest_user_id";
  ownerUserId: string;
  cycleStartAt: string;
}): Promise<boolean> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("job_assets")
    .select("job_id")
    .eq(params.ownerColumn, params.ownerUserId)
    .or("meta_json->>billing_mode.eq.free_locked_preview,meta_json->>preview_variant.eq.masked_blur");
  if (error) {
    console.warn("[socialmedia-billing] failed to read free locked preview asset usage", {
      userId: params.ownerUserId,
      ownerColumn: params.ownerColumn,
      cycleStartAt: params.cycleStartAt,
      error: error.message
    });
    return false;
  }
  const jobIds = [...new Set((data ?? [])
    .map((row) => typeof row.job_id === "string" ? row.job_id.trim() : "")
    .filter(Boolean))];
  if (!jobIds.length) return false;

  // The allowance belongs to the request's credit cycle, not the time its
  // asset eventually finished uploading. A guest job that completes after
  // signup must not consume the newly registered free account's allowance.
  const { data: jobs, error: jobsError } = await client
    .from("jobs")
    .select("id")
    .in("id", jobIds)
    .gte("created_at", params.cycleStartAt)
    .limit(1);
  if (jobsError) {
    console.warn("[socialmedia-billing] failed to read free locked preview asset jobs", {
      userId: params.ownerUserId,
      ownerColumn: params.ownerColumn,
      cycleStartAt: params.cycleStartAt,
      error: jobsError.message
    });
    return false;
  }
  return Boolean(jobs?.length);
}

export async function canUseSocialmediaFreeLockedPreview(user: AppUser, currentJobId?: string): Promise<boolean> {
  if (isBillingBypassUser(user)) return false;
  if (user.authMode !== "supabase" && user.authMode !== "guest" && !isGuestUserId(user.id)) return false;
  if (user.authMode === "guest" || isGuestUserId(user.id)) {
    const guestStatus = await getGuestAccountStatus(user.id).catch((error) => {
      console.warn("[socialmedia-billing] failed to read guest claimed status for free preview", {
        guestId: user.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    });
    if (!guestStatus || guestStatus.isClaimed) return false;
  }

  const cycleStartAt = await getLastCreditCycleStartAt(user);
  if (!cycleStartAt) return false;

  const normalizedJobId = currentJobId?.trim();
  if (!normalizedJobId) {
    return !(await hasFreeLockedPreviewInCycle(user, cycleStartAt));
  }

  const client = getSupabaseAdminClient();
  const guestOwner = user.authMode === "guest" || isGuestUserId(user.id);
  const { data, error } = await client.rpc("claim_socialmedia_free_locked_preview", {
    p_job_id: normalizedJobId,
    p_cycle_start_at: cycleStartAt,
    p_user_id: guestOwner ? null : user.id,
    p_guest_id: guestOwner ? user.id : null
  });
  if (error) {
    throw new Error(`Failed to reserve free locked preview: ${error.message}`);
  }
  return data === true;
}

export async function resolveSocialmediaGenerationBillingDecision(params: {
  user: AppUser;
  resolution: SocialmediaResolution;
  imageCount: number;
  quality?: string | null;
  knownCreditBalance?: number;
  allowFreeLockedPreview?: boolean;
  currentJobId?: string;
}): Promise<SocialmediaGenerationBillingDecision> {
  const hasSupabaseAccount = params.user.authMode === "supabase" && !isGuestUserId(params.user.id);
  const [accountSummary, pricingVariant] = hasSupabaseAccount
    ? await Promise.all([
        getCreditSummary(params.user.id, 1),
        Promise.all([
          hasActiveBillingSubscriptionForPricingVariant(params.user.id, "2.1"),
          hasActiveBillingSubscriptionForPricingVariant(params.user.id, "2.2"),
          hasActiveBillingSubscriptionForPricingVariant(params.user.id, "2.4")
        ]).then(([hasV21, hasV22, hasV24]) => hasV24 ? "2.4" : hasV22 ? "2.2" : hasV21 ? "2.1" : undefined)
      ])
    : [undefined, undefined] as const;
  const isPaidSubscriber = accountSummary?.plan === "basic" || accountSummary?.plan === "pro" || accountSummary?.plan === "max";
  const availability = await ensureSocialmediaImageCreditsAvailable({
    ...params,
    knownCreditBalance: params.knownCreditBalance ?? accountSummary?.balance,
    pricingVariant: isPaidSubscriber ? pricingVariant : undefined
  });
  if (availability.ok) {
    if (isBillingBypassUser(params.user)) {
      return {
        ok: true,
        mode: "paid_hold",
        quote: availability.quote,
        balance: availability.balance
      };
    }

    if (params.user.authMode === "supabase" && !isGuestUserId(params.user.id)) {
      const summary = accountSummary ?? await getCreditSummary(params.user.id, 1);
      if (summary.plan === "basic" || summary.plan === "pro" || summary.plan === "max") {
        return {
          ok: true,
          mode: "paid_hold",
          quote: availability.quote,
          balance: availability.balance
        };
      }

      const starterPackCreditBalance = await getStarterPackCreditBalance(params.user.id);
      const starterPackQuote = calculateStarterPackWatermarkFreeQuote(availability.quote);
      if (starterPackCreditBalance >= starterPackQuote.totalCredits) {
        return {
          ok: true,
          mode: "paid_hold",
          quote: starterPackQuote,
          balance: availability.balance
        };
      }

      const freeCreditBalance = Math.max(0, (availability.balance ?? summary.balance) - starterPackCreditBalance);
      if (freeCreditBalance < availability.quote.totalCredits) {
        return {
          ok: false,
          quote: availability.quote,
          balance: freeCreditBalance,
          error: buildUpgradeCreditShortfallMessage({
            totalCredits: availability.quote.totalCredits,
            balance: freeCreditBalance
          })
        };
      }
    }

    return {
      ok: true,
      mode: "free_watermarked_hold",
      quote: availability.quote,
      balance: availability.balance ?? 0
    };
  }

  // Paid members should be guided straight to a higher plan when their
  // subscription allowance is exhausted. The free blurred-preview fallback
  // is reserved for free and guest accounts.
  if (isPaidSubscriber) return availability;

  const canUseFreeLockedPreview = params.allowFreeLockedPreview !== false
    && availability.balance < availability.quote.totalCredits
    && await canUseSocialmediaFreeLockedPreview(params.user, params.currentJobId);
  if (canUseFreeLockedPreview) {
    return {
      ok: true,
      mode: "free_locked_preview",
      quote: availability.quote,
      balance: availability.balance
    };
  }

  return availability;
}

function buildHoldKey(jobId: string): string {
  return `socialmedia:${jobId}:images:hold`;
}

function buildRefundKey(jobId: string, reason: string): string {
  return `socialmedia:${jobId}:images:refund:${reason}`;
}

export async function holdSocialmediaImageCredits(params: {
  ownerUserId?: string;
  jobId: string;
  resolution: SocialmediaResolution;
  imageCount: number;
  quality?: string | null;
  starterPackWatermarkFree?: boolean;
  quote?: SocialmediaImageBillingQuote;
}): Promise<SocialmediaImageBillingHold> {
  const ownerUserId = params.ownerUserId?.trim();
  const baseQuote = params.quote ?? calculateSocialmediaImageBillingQuote(params);
  const quote = params.starterPackWatermarkFree
    ? calculateStarterPackWatermarkFreeQuote(baseQuote)
    : baseQuote;
  if (!ownerUserId || quote.totalCredits <= 0 || ownerUserId === "local-dev" || ownerUserId.startsWith("api-key:")) {
    return { ...quote, billedOwnerUserId: ownerUserId || undefined };
  }

  const idempotencyKey = buildHoldKey(params.jobId);
  const note = `socialmedia image hold (${quote.imageCount} x ${quote.costKey}, ${quote.totalCredits} credits)`;

  if (isGuestUserId(ownerUserId)) {
    const hold = await runBillingMutationWithRetry({
      operation: "guest_hold",
      ownerUserId,
      jobId: params.jobId,
      run: () => runGuestJobCreditMutationWithClaimHandoff({
        guestId: ownerUserId,
        jobId: params.jobId,
        holdGuest: () => holdGuestCredits({
          guestId: ownerUserId,
          amount: quote.totalCredits,
          note,
          jobId: params.jobId,
          idempotencyKey
        }),
        holdClaimedUser: (claimedUserId) => holdCredits({
          userId: claimedUserId,
          amount: quote.totalCredits,
          note,
          jobId: params.jobId,
          idempotencyKey
        })
      })
    });
    return { ...quote, billedOwnerUserId: hold.billedOwnerUserId };
  }

  await runBillingMutationWithRetry({
    operation: "hold",
    ownerUserId,
    jobId: params.jobId,
    run: () => holdCredits({
      userId: ownerUserId,
      amount: quote.totalCredits,
      note,
      jobId: params.jobId,
      idempotencyKey
    })
  });
  return { ...quote, billedOwnerUserId: ownerUserId };
}

export async function settleSocialmediaImageCredits(params: {
  ownerUserId?: string;
  jobId: string;
  heldCredits?: number;
  actualCredits: number;
  reason?: string;
  starterPackWatermarkFree?: boolean;
}): Promise<{ refundCredits: number }> {
  const ownerUserId = params.ownerUserId?.trim();
  const heldCredits = Math.max(0, Math.ceil(Number(params.heldCredits) || 0));
  const actualCredits = Math.max(0, Math.ceil(Number(params.actualCredits) || 0));
  const refundAmount = Math.max(0, heldCredits - actualCredits);
  if (!ownerUserId || ownerUserId === "local-dev" || ownerUserId.startsWith("api-key:")) {
    return { refundCredits: refundAmount };
  }
  if (refundAmount <= 0 && !isGuestUserId(ownerUserId)) return { refundCredits: 0 };

  const reason = params.reason?.trim() || "settlement";
  const idempotencyKey = buildRefundKey(params.jobId, reason);
  const note = `socialmedia image ${reason} refund (${refundAmount}/${heldCredits} held credits)${params.starterPackWatermarkFree ? " [starter_pack_watermark_free]" : ""}`;

  if (isGuestUserId(ownerUserId)) {
    const settleClaimedGuestUsage = async (claimedUserId: string): Promise<void> => {
      const claimedSettlement = resolveClaimedGuestSettlement({
        heldCredits,
        actualCredits,
        claimedUserId
      });
      if (claimedSettlement.consumeClaimedUserCredits <= 0) return;
      await runBillingMutationWithRetry({
        operation: "claimed_guest_consume",
        ownerUserId: claimedUserId,
        jobId: params.jobId,
        run: () => consumeClaimedGuestUsageBestEffort({
          consume: () => consumeCredits({
            userId: claimedUserId,
            amount: claimedSettlement.consumeClaimedUserCredits,
            note: `socialmedia image usage migrated from guest hold (${params.jobId})`,
            jobId: params.jobId,
            idempotencyKey: `socialmedia:${params.jobId}:images:claimed-guest-consume`
          }),
          onInsufficientCredits: () => {
            console.warn("[socialmedia-billing] claimed guest usage could not be charged after successful generation", {
              jobId: params.jobId,
              claimedUserId,
              actualCredits: claimedSettlement.consumeClaimedUserCredits,
              reason: "INSUFFICIENT_CREDITS"
            });
          }
        })
      });
    };
    let claimedUserId: string | undefined;
    for (const delayMs of [0, 100, 250]) {
      if (delayMs > 0) await sleep(delayMs);
      claimedUserId = await resolveClaimedGuestJobOwnerId({
        guestId: ownerUserId,
        jobId: params.jobId
      });
      if (claimedUserId) break;
    }
    if (claimedUserId) {
      await settleClaimedGuestUsage(claimedUserId);
      return { refundCredits: refundAmount };
    }
    if (refundAmount <= 0) return { refundCredits: 0 };
    await runBillingMutationWithRetry({
      operation: "guest_refund",
      ownerUserId,
      jobId: params.jobId,
      run: () => runGuestJobCreditMutationWithClaimHandoff({
        guestId: ownerUserId,
        jobId: params.jobId,
        holdGuest: () => refundGuestCredits({
          guestId: ownerUserId,
          amount: refundAmount,
          note,
          jobId: params.jobId,
          idempotencyKey
        }),
        holdClaimedUser: settleClaimedGuestUsage
      })
    });
    return { refundCredits: refundAmount };
  }

  await runBillingMutationWithRetry({
    operation: "refund",
    ownerUserId,
    jobId: params.jobId,
    run: () => refundCredits({
      userId: ownerUserId,
      amount: refundAmount,
      note,
      jobId: params.jobId,
      idempotencyKey
    })
  });
  return { refundCredits: refundAmount };
}
