import { isImageGenerationSafetyBlocked } from "@/lib/socialmedia/image-safety";
import type { JobRecord } from "@/lib/types/job";

export const SOCIALMEDIA_IMAGE_FALLBACK_RECOVERY_STALE_AFTER_MS = Math.max(
  10 * 60_000,
  Number(process.env.IMAGE_FALLBACK_RECOVERY_STALE_AFTER_MS ?? 10 * 60_000) || 10 * 60_000
);

export const SOCIALMEDIA_VIDEO_RECOVERY_STALE_AFTER_MS = Math.max(
  60_000,
  Number(process.env.VIDEO_RECOVERY_STALE_AFTER_MS ?? 90_000) || 90_000
);

export const SOCIALMEDIA_VIDEO_SUBMIT_RECOVERY_STALE_AFTER_MS = Math.max(
  10 * 60_000,
  Number(process.env.VIDEO_SUBMIT_RECOVERY_STALE_AFTER_MS ?? 10 * 60_000) || 10 * 60_000
);

export const SOCIALMEDIA_WATERMARK_RECOVERY_INTERVAL_MS = Math.max(
  5 * 60_000,
  Number(process.env.VIDEO_WATERMARK_RECOVERY_INTERVAL_MS ?? 30 * 60_000) || 30 * 60_000
);

export const SOCIALMEDIA_ASSET_PERSIST_RECOVERY_DELAY_MS = Math.max(
  360_000,
  Number(process.env.SOCIALMEDIA_ASSET_PERSIST_RECOVERY_DELAY_MS ?? 360_000) || 360_000
);

export const SOCIALMEDIA_VIDEO_FINALIZATION_RECOVERY_DELAY_MS = Math.max(
  60_000,
  Number(process.env.SOCIALMEDIA_VIDEO_FINALIZATION_RECOVERY_DELAY_MS ?? 60_000) || 60_000
);

export const SOCIALMEDIA_VIDEO_PERSISTENCE_RETRY_DELAY_MS = Math.max(
  30_000,
  Number(process.env.SOCIALMEDIA_VIDEO_PERSISTENCE_RETRY_DELAY_MS ?? 90_000) || 90_000
);

export function isSocialmediaJobRecoveryStale(
  updatedAt?: string | null,
  nowMs = Date.now(),
  staleAfterMs = SOCIALMEDIA_IMAGE_FALLBACK_RECOVERY_STALE_AFTER_MS
): boolean {
  const updatedAtMs = Date.parse(updatedAt ?? "");
  if (!Number.isFinite(updatedAtMs)) return false;
  return nowMs - updatedAtMs >= staleAfterMs;
}

export function getSocialmediaVideoRecoveryStaleAfterMs(stage?: string | null): number {
  return stage === "submitting_video" || stage === "submitting_video_fallback"
    ? SOCIALMEDIA_VIDEO_SUBMIT_RECOVERY_STALE_AFTER_MS
    : SOCIALMEDIA_VIDEO_RECOVERY_STALE_AFTER_MS;
}

export function isSocialmediaWatermarkRecoveryWindow(
  nowMs = Date.now(),
  intervalMs = SOCIALMEDIA_WATERMARK_RECOVERY_INTERVAL_MS,
  windowMs = 2 * 60_000
): boolean {
  const safeIntervalMs = Math.max(1, Math.floor(intervalMs));
  const safeWindowMs = Math.max(1, Math.min(safeIntervalMs, Math.floor(windowMs)));
  const positionMs = ((Math.floor(nowMs) % safeIntervalMs) + safeIntervalMs) % safeIntervalMs;
  return positionMs < safeWindowMs;
}

export function isSocialmediaPersistingAssetsRecoveryDue(
  updatedAt?: string | null,
  nowMs = Date.now(),
  delayMs = SOCIALMEDIA_ASSET_PERSIST_RECOVERY_DELAY_MS
): boolean {
  return isSocialmediaJobRecoveryStale(updatedAt, nowMs, delayMs);
}

export function isSocialmediaVideoFinalizationRecoveryDue(
  updatedAt?: string | null,
  nowMs = Date.now(),
  delayMs = SOCIALMEDIA_VIDEO_FINALIZATION_RECOVERY_DELAY_MS
): boolean {
  return isSocialmediaPersistingAssetsRecoveryDue(updatedAt, nowMs, delayMs);
}

export function isSocialmediaVideoPersistenceRetryDue(
  updatedAt?: string | null,
  nowMs = Date.now(),
  delayMs = SOCIALMEDIA_VIDEO_PERSISTENCE_RETRY_DELAY_MS
): boolean {
  return isSocialmediaPersistingAssetsRecoveryDue(updatedAt, nowMs, delayMs);
}

/** Async completion belongs to the provider/persistence worker, not stale-read replay. */
export function hasRecoverableAsyncImageTask(job: Pick<JobRecord, "status" | "stage" | "payload" | "error">): boolean {
  if (job.status !== "running") return false;
  const socialmedia = job.payload.socialmedia as { pendingImageTasks?: Array<{
    status?: string; lastError?: string; generatedImageUrls?: unknown[];
  }> } | undefined;
  return Array.isArray(socialmedia?.pendingImageTasks) && socialmedia.pendingImageTasks.some(task => {
    if (!task) return false;
    if (job.stage === "apimart_polling") return !isImageGenerationSafetyBlocked(task.lastError || job.error || "")
      && (task.status === "submitted" || task.status === "polling");
    return job.stage === "persisting_assets" && task.status === "completed"
      && Array.isArray(task.generatedImageUrls) && task.generatedImageUrls.length > 0;
  });
}
