import type { SocialmediaPendingVideoTask } from "@/lib/socialmedia/types";

export const SOCIALMEDIA_VIDEO_PERSIST_MAX_ATTEMPTS = Math.max(
  1,
  Number(process.env.SOCIALMEDIA_VIDEO_PERSIST_MAX_ATTEMPTS ?? 5) || 5
);

export const SOCIALMEDIA_VIDEO_LOCK_CONTENTION_MAX_ATTEMPTS = Math.max(
  2,
  Number(process.env.SOCIALMEDIA_VIDEO_LOCK_CONTENTION_MAX_ATTEMPTS ?? 4) || 4
);

export const SOCIALMEDIA_VIDEO_LOCK_CONTENTION_MAX_AGE_MS = Math.max(
  60_000,
  Number(process.env.SOCIALMEDIA_VIDEO_LOCK_CONTENTION_MAX_AGE_MS ?? 5 * 60_000) || 5 * 60_000
);

export function getNextVideoLockContentionState(
  task: Pick<SocialmediaPendingVideoTask, "lockContentionAttempts" | "lockContentionStartedAt">,
  nowMs = Date.now()
): {
  attempts: number;
  startedAt: string;
  retryAllowed: boolean;
} {
  const attempts = Math.max(0, Number(task.lockContentionAttempts) || 0) + 1;
  const parsedStartedAt = Date.parse(task.lockContentionStartedAt ?? "");
  const startedAtMs = Number.isFinite(parsedStartedAt) ? parsedStartedAt : nowMs;
  return {
    attempts,
    startedAt: new Date(startedAtMs).toISOString(),
    retryAllowed: attempts < SOCIALMEDIA_VIDEO_LOCK_CONTENTION_MAX_ATTEMPTS
      && Math.max(0, nowMs - startedAtMs) < SOCIALMEDIA_VIDEO_LOCK_CONTENTION_MAX_AGE_MS
  };
}

export function isGeneratedVideoVariantLockRetryableError(errorMessage: string): boolean {
  const normalized = errorMessage.toLowerCase();
  return normalized.includes("generated video") && normalized.includes("variant lock");
}

function isGeneratedVideoStorageControlPlaneError(errorMessage: string): boolean {
  return errorMessage.startsWith("failed to inspect storage bucket 'video-assets':")
    || errorMessage.startsWith("failed to create signed url for generated socialmedia video:");
}

function isTransientGeneratedVideoDownloadError(errorMessage: string): boolean {
  if (!errorMessage.startsWith("failed to download generated video:")) return false;
  const detail = errorMessage.slice("failed to download generated video:".length).trim();
  const httpStatus = Number(detail.match(/^(\d{3})\b/)?.[1]);
  if ([408, 425, 429].includes(httpStatus) || (httpStatus >= 500 && httpStatus <= 599)) return true;
  return [
    "network error",
    "fetch failed",
    "failed to fetch",
    "connection reset",
    "econnreset",
    "econnrefused",
    "etimedout",
    "socket hang up",
    "temporarily unavailable"
  ].some((marker) => detail.includes(marker));
}

export function isRecoverableVideoPersistenceError(errorMessage?: string): boolean {
  const normalized = (errorMessage ?? "").toLowerCase();
  return isGeneratedVideoVariantLockRetryableError(normalized)
    // These operations run after the generated video has been uploaded. Retrying
    // persistence can reuse/upsert that object after a transient Storage API failure.
    // Keep this scoped to video URL resolution so unrelated auth, bucket, and image
    // storage errors do not turn into video persistence retries.
    || isGeneratedVideoStorageControlPlaneError(normalized)
    || isTransientGeneratedVideoDownloadError(normalized)
    || normalized.includes("video watermark")
    || normalized.includes("video persistence deadline")
    || normalized.includes("downloading generated video")
    || normalized.includes("persist generated video")
    || normalized.includes("persist generated socialmedia video")
    || normalized.includes("upload generated socialmedia video")
    || normalized.includes("uploading generated socialmedia video")
    || normalized.includes("video billing settlement")
    || normalized.includes("video asset");
}

export function isVideoPersistenceRetryAllowed(
  task: Pick<SocialmediaPendingVideoTask, "lastError" | "persistenceAttempts">
): boolean {
  return isRecoverableVideoPersistenceError(task.lastError)
    && Math.max(0, Number(task.persistenceAttempts) || 0) < SOCIALMEDIA_VIDEO_PERSIST_MAX_ATTEMPTS;
}

export function isFailedVideoPersistenceRecoveryAllowed(
  task: {
    status?: string;
    generatedVideos?: readonly unknown[];
    lastError?: string;
    persistenceAttempts?: number;
    lockContentionAttempts?: number;
    lockContentionStartedAt?: string;
  },
  nowMs = Date.now()
): boolean {
  if (!task.generatedVideos?.length) return false;
  if (task.status !== "completed" && task.status !== "failed") return false;

  const lastError = task.lastError?.trim() ?? "";
  if (task.status === "completed" && !lastError) return true;
  if (
    /^video persistence failed after \d+ attempts\b/i.test(lastError)
    || /^video persistence stopped after \d+ generated-video lock conflicts\b/i.test(lastError)
  ) return false;
  if (!isVideoPersistenceRetryAllowed(task)) return false;
  if (!isGeneratedVideoVariantLockRetryableError(lastError)) return true;

  return getNextVideoLockContentionState(task, nowMs).retryAllowed;
}
