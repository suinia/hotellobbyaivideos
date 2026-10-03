import { grantCredits } from "@/lib/billing/credits";
import {
  hasOriginalImageUnlockRecord,
  isOriginalImageUnlock,
  PAID_PLAN_HISTORY_ASSET_ROLES,
  type ImageUnlockSource
} from "@/lib/billing/image-unlock-access";
import { invalidateImageUnlockAccessCache } from "@/lib/socialmedia/image-access";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseConfig } from "@/lib/supabase/config";
import { SOCIALMEDIA_GENERATED_ASSETS_BUCKET } from "@/lib/socialmedia/types";

export const IMAGE_UNLOCK_PACKAGE_ID = "image_unlock_single";
export const IMAGE_UNLOCK_PRICE_USD = 6.99;
export const IMAGE_UNLOCK_V14_PRICE_USD = 2.99;
export const IMAGE_UNLOCK_V19_PRICE_USD = 9.99;
export const IMAGE_UNLOCK_CURRENCY = "USD";
export const IMAGE_UNLOCK_STARTER_CREDITS = 100;
export const IMAGE_UNLOCK_V14_STARTER_CREDITS = 100;

export function resolveImageUnlockPriceUsd(pricingVariant?: string | null): number {
  if (pricingVariant === "1.9" || pricingVariant === "2.3" || pricingVariant === "2.4" || pricingVariant === "2.5") return IMAGE_UNLOCK_V19_PRICE_USD;
  return pricingVariant === "1.4" ? IMAGE_UNLOCK_V14_PRICE_USD : IMAGE_UNLOCK_PRICE_USD;
}

export function resolveImageUnlockStarterCredits(pricingVariant?: string | null): number {
  return pricingVariant === "1.4" ? IMAGE_UNLOCK_V14_STARTER_CREDITS : IMAGE_UNLOCK_STARTER_CREDITS;
}

type JobAssetOwnerRow = {
  id: string;
  job_id: string;
  user_id: string | null;
};

type JobAssetUnlockStateRow = JobAssetOwnerRow & {
  job_asset_unlocks?: Array<{
    id?: string | null;
    transaction_id?: string | null;
    unlock_source?: string | null;
  }> | null;
};

type UnlockableJobAssetRow = {
  id?: string | null;
  job_id?: string | null;
};

type GuestSignupUnlockCandidateRow = {
  id?: string | null;
  job_id?: string | null;
};

function isMissingJobAssetUnlocksTableError(error: { message?: string; code?: string }): boolean {
  const message = error.message ?? "";
  return (
    error.code === "PGRST205"
    || message.includes("Could not find the table 'public.job_asset_unlocks'")
    || message.includes("relation \"public.job_asset_unlocks\" does not exist")
  );
}

function imageUnlockMigrationError(): Error {
  return new Error("IMAGE_UNLOCK_MIGRATION_NOT_APPLIED");
}

function isEmbeddedUnlockRelationError(error: { message?: string; code?: string }): boolean {
  const message = error.message ?? "";
  return (
    error.code === "PGRST200"
    || error.code === "PGRST201"
    || message.includes("Could not find a relationship")
    || message.includes("job_asset_unlocks_asset_id_fkey")
  );
}

function debugGeneratedImageUnlocks(message: string, meta: Record<string, unknown>): void {
  if (process.env.SOCIALMEDIA_DEBUG_TIMINGS !== "1" && process.env.SOCIALMEDIA_IMAGE_ACCESS_DEBUG_TIMINGS !== "1") return;
  console.info(`[image-unlocks] ${message}`, meta);
}

export {
  hasOriginalImageUnlockRecord,
  isSignupWatermarkedUnlockTransactionId,
  type ImageUnlockSource
} from "@/lib/billing/image-unlock-access";

export async function getOwnedJobAssetForUnlock(params: {
  userId: string;
  assetId: string;
}): Promise<{ assetId: string; jobId: string } | null> {
  if (!supabaseConfig.adminEnabled) {
    throw new Error("Supabase admin is not configured.");
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("job_assets")
    .select("id, job_id, user_id")
    .eq("id", params.assetId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) return null;

  const row = data as JobAssetOwnerRow;
  return {
    assetId: row.id,
    jobId: row.job_id
  };
}

export async function getOwnedJobAssetUnlockState(params: {
  userId: string;
  assetId: string;
}): Promise<{ assetId: string; jobId: string; alreadyUnlocked: boolean } | null> {
  if (!supabaseConfig.adminEnabled) {
    throw new Error("Supabase admin is not configured.");
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("job_assets")
    .select("id, job_id, user_id, job_asset_unlocks!job_asset_unlocks_asset_id_fkey(id, transaction_id, unlock_source)")
    .eq("id", params.assetId)
    .eq("user_id", params.userId)
    .eq("job_asset_unlocks.user_id", params.userId)
    .maybeSingle();
  if (error) {
    if (isEmbeddedUnlockRelationError(error)) {
      const asset = await getOwnedJobAssetForUnlock(params);
      if (!asset) return null;
      return {
        ...asset,
        alreadyUnlocked: await hasImageUnlock(params)
      };
    }
    throw new Error(error.message);
  }
  if (!data) return null;

  const row = data as JobAssetUnlockStateRow;
  return {
    assetId: row.id,
    jobId: row.job_id,
    alreadyUnlocked: hasOriginalImageUnlockRecord(row.job_asset_unlocks)
  };
}

export async function hasImageUnlock(params: {
  userId: string;
  assetId: string;
}): Promise<boolean> {
  if (!supabaseConfig.adminEnabled) return false;

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("job_asset_unlocks")
    .select("id, transaction_id, unlock_source")
    .eq("user_id", params.userId)
    .eq("asset_id", params.assetId)
    .maybeSingle();
  if (error) {
    if (isMissingJobAssetUnlocksTableError(error)) {
      throw imageUnlockMigrationError();
    }
    throw new Error(error.message);
  }
  return Boolean(data && isOriginalImageUnlock(data as {
    transaction_id?: string | null;
    unlock_source?: string | null;
  }));
}

export async function recordImageUnlock(params: {
  userId: string;
  jobId: string;
  assetId: string;
  checkoutId?: string;
  transactionId?: string;
  billingPaymentId?: string;
  unlockSource?: Extract<ImageUnlockSource, "image_purchase" | "video_purchase" | "starter_pack">;
  grantStarterCredits?: boolean;
  starterCredits?: number;
  testMode?: boolean;
}): Promise<void> {
  if (!supabaseConfig.adminEnabled) {
    throw new Error("Supabase admin is not configured.");
  }

  const asset = await getOwnedJobAssetForUnlock({
    userId: params.userId,
    assetId: params.assetId
  });
  if (!asset || asset.jobId !== params.jobId) {
    throw new Error("IMAGE_UNLOCK_ASSET_NOT_FOUND");
  }

  const client = getSupabaseAdminClient();
  const canonicalUnlock = {
    user_id: params.userId,
    job_id: params.jobId,
    asset_id: params.assetId,
    checkout_id: null,
    transaction_id: null,
    amount_usd: null,
    currency: null,
    unlock_source: params.unlockSource ?? "image_purchase",
    billing_payment_id: params.billingPaymentId ?? null
  };
  const { error: insertError } = await client
    .from("job_asset_unlocks")
    .upsert(canonicalUnlock, {
      onConflict: "user_id,asset_id",
      ignoreDuplicates: true
    });
  if (insertError) {
    if (isMissingJobAssetUnlocksTableError(insertError)) {
      throw imageUnlockMigrationError();
    }
    throw new Error(insertError.message);
  }
  const { error: upgradeError } = await client
    .from("job_asset_unlocks")
    .update(canonicalUnlock)
    .eq("user_id", params.userId)
    .eq("asset_id", params.assetId)
    .like("transaction_id", "guest-signup-unlock:%");
  if (upgradeError) {
    if (isMissingJobAssetUnlocksTableError(upgradeError)) {
      throw imageUnlockMigrationError();
    }
    throw new Error(upgradeError.message);
  }
  invalidateImageUnlockAccessCache({
    userId: params.userId,
    assetId: params.assetId
  });

  const starterCredits = params.starterCredits ?? IMAGE_UNLOCK_STARTER_CREDITS;
  if (params.grantStarterCredits !== false && starterCredits > 0) {
    const paymentKey = params.checkoutId?.trim() || params.transactionId?.trim() || params.assetId;
    const baseIdempotencyKey = `image-unlock-starter:${params.userId}:${paymentKey}`;
    const ledger = await grantCredits({
      userId: params.userId,
      amount: starterCredits,
      jobId: params.jobId,
      note: `image unlock starter credits (${params.assetId})${params.testMode ? " [test payment]" : ""}`,
      idempotencyKey: baseIdempotencyKey
    });
    const alreadyGrantedCredits = Math.max(0, Number(ledger.amount ?? 0));
    const topUpCredits = Math.max(0, starterCredits - alreadyGrantedCredits);
    if (topUpCredits > 0) {
      await grantCredits({
        userId: params.userId,
        amount: topUpCredits,
        jobId: params.jobId,
        note: `image unlock starter credits top-up (${params.assetId})${params.testMode ? " [test payment]" : ""}`,
        idempotencyKey: `${baseIdempotencyKey}:topup:${starterCredits}`
      });
    }
  }
}

export async function recordPaidPlanImageUnlocksForUser(params: {
  userId: string;
  billingPaymentId?: string | null;
}): Promise<number> {
  if (!supabaseConfig.adminEnabled) {
    throw new Error("Supabase admin is not configured.");
  }

  const client = getSupabaseAdminClient();
  const batchSize = 500;
  let attemptedUnlocks = 0;

  for (const role of PAID_PLAN_HISTORY_ASSET_ROLES) {
    let offset = 0;
    while (true) {
      const query = client
        .from("job_assets")
        .select("id, job_id")
        .eq("user_id", params.userId)
        .eq("storage_bucket", SOCIALMEDIA_GENERATED_ASSETS_BUCKET)
        .contains("meta_json", {
          workflow: "socialmedia",
          role
        })
        .order("created_at", { ascending: true })
        .range(offset, offset + batchSize - 1);
      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }

      const rows = ((data ?? []) as UnlockableJobAssetRow[])
        .map((row) => ({
          assetId: row.id?.trim(),
          jobId: row.job_id?.trim()
        }))
        .filter((row): row is { assetId: string; jobId: string } => Boolean(row.assetId && row.jobId));
      if (rows.length) {
        const unlockRows = rows.map((row) => ({
          user_id: params.userId,
          job_id: row.jobId,
          asset_id: row.assetId,
          checkout_id: null,
          transaction_id: null,
          amount_usd: null,
          currency: null,
          unlock_source: "subscription_history" satisfies ImageUnlockSource,
          billing_payment_id: params.billingPaymentId?.trim() || null
        }));
        const { error: unlockError } = await client
          .from("job_asset_unlocks")
          .upsert(unlockRows, {
            onConflict: "user_id,asset_id",
            ignoreDuplicates: true
          });
        if (unlockError) {
          if (isMissingJobAssetUnlocksTableError(unlockError)) {
            throw imageUnlockMigrationError();
          }
          throw new Error(unlockError.message);
        }
        if (role === "generated_image") {
          const { error: upgradeError } = await client
            .from("job_asset_unlocks")
            .update({
              checkout_id: null,
              transaction_id: null,
              amount_usd: null,
              currency: null,
              unlock_source: "subscription_history" satisfies ImageUnlockSource,
              billing_payment_id: params.billingPaymentId?.trim() || null
            })
            .eq("user_id", params.userId)
            .in("asset_id", rows.map((row) => row.assetId))
            .like("transaction_id", "guest-signup-unlock:%");
          if (upgradeError) {
            if (isMissingJobAssetUnlocksTableError(upgradeError)) {
              throw imageUnlockMigrationError();
            }
            throw new Error(upgradeError.message);
          }
        }
        attemptedUnlocks += rows.length;
        invalidateImageUnlockAccessCache({
          userId: params.userId,
          assetIds: rows.map((row) => row.assetId)
        });
      }

      if ((data ?? []).length < batchSize) break;
      offset += batchSize;
    }
  }

  return attemptedUnlocks;
}

export async function recordGeneratedImageAssetUnlocksForUser(params: {
  userId: string;
  jobId: string;
  assetIds: string[];
  unlockSource: Extract<ImageUnlockSource, "paid_credits" | "starter_pack">;
}): Promise<number> {
  const userId = params.userId.trim();
  const jobId = params.jobId.trim();
  if (!supabaseConfig.adminEnabled || !userId || !jobId) {
    debugGeneratedImageUnlocks("generated unlock skipped before asset normalization", {
      adminEnabled: supabaseConfig.adminEnabled,
      userId,
      jobId,
      assetCount: params.assetIds.length
    });
    return 0;
  }

  const assetIds = [...new Set(params.assetIds.map((assetId) => assetId.trim()).filter(Boolean))];
  if (!assetIds.length) {
    debugGeneratedImageUnlocks("generated unlock skipped without asset ids", {
      userId,
      jobId,
      rawAssetCount: params.assetIds.length
    });
    return 0;
  }

  const client = getSupabaseAdminClient();
  const { error } = await client
    .from("job_asset_unlocks")
    .upsert(assetIds.map((assetId) => ({
      user_id: userId,
      job_id: jobId,
      asset_id: assetId,
      checkout_id: null,
      transaction_id: null,
      amount_usd: null,
      currency: null,
      unlock_source: params.unlockSource,
      billing_payment_id: null
    })), {
      onConflict: "user_id,asset_id",
      ignoreDuplicates: true
    });
  if (error) {
    if (isMissingJobAssetUnlocksTableError(error)) {
      throw imageUnlockMigrationError();
    }
    throw new Error(error.message);
  }

  debugGeneratedImageUnlocks("generated unlock upsert completed", {
    userId,
    jobId,
    assetIds,
    unlockSource: params.unlockSource,
    attemptedUnlocks: assetIds.length
  });
  return assetIds.length;
}

export async function listGuestSignupWatermarkedUnlockCandidates(guestId: string): Promise<Array<{ assetId: string; jobId: string }>> {
  const normalizedGuestId = guestId.trim();
  if (!supabaseConfig.adminEnabled || !normalizedGuestId) return [];

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("job_assets")
    .select("id, job_id")
    .eq("guest_user_id", normalizedGuestId)
    .eq("storage_bucket", SOCIALMEDIA_GENERATED_ASSETS_BUCKET)
    .contains("meta_json", {
      workflow: "socialmedia",
      role: "generated_image"
    })
    .or("meta_json->>billing_mode.eq.free_locked_preview,meta_json->>preview_variant.eq.masked_blur");
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as GuestSignupUnlockCandidateRow[])
    .map((row) => ({
      assetId: row.id?.trim(),
      jobId: row.job_id?.trim()
    }))
    .filter((row): row is { assetId: string; jobId: string } => Boolean(row.assetId && row.jobId));
}

export async function recordGuestSignupWatermarkedUnlocks(params: {
  userId: string;
  guestId: string;
  assets: Array<{ assetId: string; jobId: string }>;
}): Promise<number> {
  const userId = params.userId.trim();
  const guestId = params.guestId.trim();
  const assets = params.assets
    .map((asset) => ({
      assetId: asset.assetId.trim(),
      jobId: asset.jobId.trim()
    }))
    .filter((asset) => asset.assetId && asset.jobId);
  if (!supabaseConfig.adminEnabled || !userId || !guestId || !assets.length) return 0;

  const uniqueAssets = [...new Map(assets.map((asset) => [asset.assetId, asset])).values()];
  const client = getSupabaseAdminClient();
  const { error } = await client
    .from("job_asset_unlocks")
    .upsert(uniqueAssets.map((asset) => ({
      user_id: userId,
      job_id: asset.jobId,
      asset_id: asset.assetId,
      checkout_id: null,
      transaction_id: `guest-signup-unlock:${userId}:${guestId}:${asset.assetId}`,
      amount_usd: 0,
      currency: IMAGE_UNLOCK_CURRENCY
    })), {
      onConflict: "user_id,asset_id",
      ignoreDuplicates: true
    });
  if (error) {
    if (isMissingJobAssetUnlocksTableError(error)) {
      throw imageUnlockMigrationError();
    }
    throw new Error(error.message);
  }

  invalidateImageUnlockAccessCache({
    userId,
    assetIds: uniqueAssets.map((asset) => asset.assetId)
  });
  return uniqueAssets.length;
}

export async function recordSignupImageUnlock(params: {
  userId: string;
  assetId: string;
  jobId?: string;
}): Promise<{ assetId: string; jobId: string }> {
  if (!supabaseConfig.adminEnabled) {
    throw new Error("Supabase admin is not configured.");
  }

  const asset = await getOwnedJobAssetForUnlock({
    userId: params.userId,
    assetId: params.assetId
  });
  if (!asset || (params.jobId && asset.jobId !== params.jobId)) {
    throw new Error("IMAGE_UNLOCK_ASSET_NOT_FOUND");
  }

  const client = getSupabaseAdminClient();
  const { error } = await client
    .from("job_asset_unlocks")
    .upsert({
      user_id: params.userId,
      job_id: asset.jobId,
      asset_id: asset.assetId,
      checkout_id: null,
      transaction_id: `guest-signup-unlock:${params.userId}:${asset.assetId}`,
      amount_usd: 0,
      currency: IMAGE_UNLOCK_CURRENCY
    }, {
      onConflict: "user_id,asset_id",
      ignoreDuplicates: true
    });
  if (error) {
    if (isMissingJobAssetUnlocksTableError(error)) {
      throw imageUnlockMigrationError();
    }
    throw new Error(error.message);
  }

  return asset;
}
