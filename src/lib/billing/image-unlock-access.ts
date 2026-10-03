export type ImageUnlockSource =
  | "image_purchase"
  | "video_purchase"
  | "subscription_history"
  | "paid_credits"
  | "starter_pack";

const ORIGINAL_IMAGE_UNLOCK_SOURCES = new Set<ImageUnlockSource>([
  "image_purchase",
  "video_purchase",
  "subscription_history",
  "paid_credits",
  "starter_pack"
]);

export type ImageUnlockRecord = {
  transaction_id?: string | null;
  unlock_source?: string | null;
};

export type ImageUnlockAccessKind = "original" | "watermarked" | "none";

export const PAID_PLAN_HISTORY_ASSET_ROLES = ["generated_image", "generated_video"] as const;

export function resolvePurchasedAssetUnlockSource(
  packageId: string
): Extract<ImageUnlockSource, "video_purchase" | "starter_pack"> {
  return packageId === "video_unlock_single" ? "video_purchase" : "starter_pack";
}

export function isSignupWatermarkedUnlockTransactionId(transactionId?: string | null): boolean {
  return typeof transactionId === "string" && transactionId.startsWith("guest-signup-unlock:");
}

export function classifyImageUnlockRecord(row: ImageUnlockRecord): ImageUnlockAccessKind {
  const transactionId = row.transaction_id?.trim();
  if (isSignupWatermarkedUnlockTransactionId(transactionId)) return "watermarked";

  const unlockSource = row.unlock_source?.trim() as ImageUnlockSource | undefined;
  if (unlockSource && ORIGINAL_IMAGE_UNLOCK_SOURCES.has(unlockSource)) return "original";
  if (transactionId) return "original";
  return "none";
}

export function isOriginalImageUnlock(row: ImageUnlockRecord): boolean {
  return classifyImageUnlockRecord(row) === "original";
}

export function hasOriginalImageUnlockRecord(rows?: ImageUnlockRecord[] | null): boolean {
  return Boolean(rows?.some(isOriginalImageUnlock));
}
