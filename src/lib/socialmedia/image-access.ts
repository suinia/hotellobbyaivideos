import { isGuestUserId } from "@/lib/auth/guest";
import { IMAGE_ACCESS_DISPLAY_COLUMNS, IMAGE_ACCESS_VARIANT_COLUMNS, restoreImageAccessDisplayRow } from "./image-access-projection";
import { classifyImageUnlockRecord } from "@/lib/billing/image-unlock-access";
import {
  listStarterPackCreditHoldJobIds,
  listStarterPackCreditWindows,
  type StarterPackCreditWindow
} from "@/lib/billing/starter-pack";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseConfig } from "@/lib/supabase/config";
import { resolveSocialmediaImageAccessPlan } from "@/lib/socialmedia/image-access-plan";
import { normalizeSupabaseStorageUrl } from "@/lib/socialmedia/storage-url";
import {
  SOCIALMEDIA_GENERATED_ASSETS_BUCKET,
  SOCIALMEDIA_VIDEO_ASSETS_BUCKET,
  type SocialmediaGeneratedImage,
  type SocialmediaGeneratedVideo,
  type SocialmediaImageAccessPlan,
  type SocialmediaJobResult,
  type SocialmediaTargetAsset
} from "@/lib/socialmedia/types";
import type { JobRecord } from "@/lib/types/job";

const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 365;
const STORAGE_URL_CACHE_TTL_MS = Math.max(
  30_000,
  Number(process.env.SOCIALMEDIA_STORAGE_URL_CACHE_TTL_MS ?? 5 * 60_000) || 5 * 60_000
);
const IMAGE_ACCESS_CACHE_TTL_MS = Math.max(
  5_000,
  Number(process.env.SOCIALMEDIA_IMAGE_ACCESS_CACHE_TTL_MS ?? 15_000) || 15_000
);
const SOCIALMEDIA_IMAGE_ACCESS_DEBUG_TIMINGS_ENABLED =
  process.env.NODE_ENV !== "production"
  || process.env.SOCIALMEDIA_DEBUG_TIMINGS === "1"
  || process.env.SOCIALMEDIA_IMAGE_ACCESS_DEBUG_TIMINGS === "1";
const SOCIALMEDIA_RUNTIME_STARTER_PACK_UNLOCK_FALLBACK_ENABLED =
  process.env.SOCIALMEDIA_RUNTIME_STARTER_PACK_UNLOCK_FALLBACK === "1";

type ImageAccessTiming = {
  name: string;
  durationMs: number;
  rowCount?: number;
};

export type JobAssetVariantRow = {
  id: string;
  job_id?: string | null;
  created_at?: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  public_url: string | null;
  access_variant?: "original" | "watermarked" | null;
  original_storage_bucket: string | null;
  original_storage_path: string | null;
  original_mime_type: string | null;
  original_size_bytes: number | null;
  watermarked_storage_bucket: string | null;
  watermarked_storage_path: string | null;
  watermarked_mime_type: string | null;
  watermarked_size_bytes: number | null;
  meta_json?: Record<string, unknown> | null;
};

export type SocialmediaGeneratedImagesForPlanJobInput = {
  jobId: string;
  images: SocialmediaGeneratedImage[];
};

export type SocialmediaGeneratedVideosForPlanJobInput = {
  jobId: string;
  videos: SocialmediaGeneratedVideo[];
};

type NormalizedGeneratedImagesForPlanJob = {
  jobId: string;
  images: SocialmediaGeneratedImage[];
};

type NormalizedGeneratedVideosForPlanJob = {
  jobId: string;
  videos: SocialmediaGeneratedVideo[];
};

type ImageAccessMaterializeOptions = {
  plan?: SocialmediaImageAccessPlan;
  bypassUnlockCache?: boolean;
  displayOnly?: boolean;
};

const bucketPublicCache = new Map<string, Promise<boolean>>();
const storageUrlCache = new Map<string, { url: string; expiresAt: number }>();
const jobAssetVariantRowsCache = new Map<string, { value: Map<string, JobAssetVariantRow>; expiresAt: number }>();
const imageUnlockAccessCache = new Map<string, { value: ImageUnlockAccess; expiresAt: number }>();
const starterPackUnlockedAssetIdsCache = new Map<string, { value: Set<string>; expiresAt: number }>();
const KNOWN_PUBLIC_STORAGE_BUCKETS = new Set<string>([
  SOCIALMEDIA_GENERATED_ASSETS_BUCKET
]);

async function timeImageAccessStep<T>(
  timings: ImageAccessTiming[] | undefined,
  name: string,
  fn: () => PromiseLike<T>,
  getRowCount?: (value: T) => number | undefined
): Promise<T> {
  if (!timings) return fn();
  const startedAt = Date.now();
  try {
    const value = await fn();
    timings.push({
      name,
      durationMs: Date.now() - startedAt,
      rowCount: getRowCount?.(value)
    });
    return value;
  } catch (error) {
    timings.push({
      name,
      durationMs: Date.now() - startedAt
    });
    throw error;
  }
}

function logImageAccessTimings(
  name: string,
  startedAt: number,
  meta: Record<string, unknown>,
  timings: ImageAccessTiming[]
): void {
  if (!SOCIALMEDIA_IMAGE_ACCESS_DEBUG_TIMINGS_ENABLED) return;
  const durationMs = Date.now() - startedAt;
  if (durationMs < 500 && process.env.SOCIALMEDIA_IMAGE_ACCESS_DEBUG_TIMINGS !== "1") return;
  console.info(`[socialmedia-image-access] ${name}`, {
    ...meta,
    durationMs,
    timings
  });
}

function isMissingJobAssetUnlocksTableError(error: { message?: string; code?: string }): boolean {
  const message = error.message ?? "";
  return (
    error.code === "PGRST205"
    || message.includes("Could not find the table 'public.job_asset_unlocks'")
    || message.includes("relation \"public.job_asset_unlocks\" does not exist")
  );
}

function toAbsoluteStorageUrl(url: string): string {
  const normalized = url.trim();
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalizeSupabaseStorageUrl(normalized);

  const base = supabaseConfig.url?.trim();
  if (!base) return normalized;

  try {
    return normalizeSupabaseStorageUrl(new URL(normalized, base).toString());
  } catch {
    return normalized;
  }
}

function encodeStoragePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildPublicStorageUrl(bucketName: string, path: string): string {
  const base = supabaseConfig.url?.trim().replace(/\/+$/, "");
  if (!base) return path;
  return normalizeSupabaseStorageUrl(`${base}/storage/v1/object/public/${encodeURIComponent(bucketName)}/${encodeStoragePath(path)}`);
}

export function isKnownPublicStorageBucket(bucketName: string): boolean {
  return KNOWN_PUBLIC_STORAGE_BUCKETS.has(bucketName.trim());
}

function getStorageUrlCacheKey(bucketName: string, path: string): string {
  return `${bucketName}:${path}`;
}

function getCachedStorageUrl(bucketName: string, path: string): string | null {
  const cached = storageUrlCache.get(getStorageUrlCacheKey(bucketName, path));
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    storageUrlCache.delete(getStorageUrlCacheKey(bucketName, path));
    return null;
  }
  return cached.url;
}

function setCachedStorageUrl(bucketName: string, path: string, url: string): void {
  if (!url) return;
  storageUrlCache.set(getStorageUrlCacheKey(bucketName, path), {
    url,
    expiresAt: Date.now() + STORAGE_URL_CACHE_TTL_MS
  });
}

function getCachedValue<T>(cache: Map<string, { value: T; expiresAt: number }>, key: string): T | null {
  const cached = cache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedValue<T>(cache: Map<string, { value: T; expiresAt: number }>, key: string, value: T): T {
  cache.set(key, {
    value,
    expiresAt: Date.now() + IMAGE_ACCESS_CACHE_TTL_MS
  });
  return value;
}

function getOwnerAssetCacheKey(ownerUserId: string | undefined, assetIds: string[]): string {
  return `${ownerUserId?.trim() ?? ""}:${[...new Set(assetIds.map((assetId) => assetId.trim()).filter(Boolean))].sort().join(",")}`;
}

export function invalidateImageUnlockAccessCache(params: {
  userId?: string | null;
  assetId?: string | null;
  assetIds?: string[];
} = {}): void {
  const normalizedUserId = params.userId?.trim();
  const assetIds = new Set([
    ...(params.assetIds ?? []),
    params.assetId ?? ""
  ].map((assetId) => assetId.trim()).filter(Boolean));

  if (!normalizedUserId && !assetIds.size) {
    imageUnlockAccessCache.clear();
    starterPackUnlockedAssetIdsCache.clear();
    return;
  }

  const shouldDeleteOwnerAssetKey = (key: string) => {
    const [owner = "", rawAssetIds = ""] = key.split(":", 2);
    if (normalizedUserId && owner !== normalizedUserId) return false;
    if (!assetIds.size) return true;
    const cachedAssetIds = new Set(rawAssetIds.split(",").map((assetId) => assetId.trim()).filter(Boolean));
    return [...assetIds].some((assetId) => cachedAssetIds.has(assetId));
  };

  for (const key of imageUnlockAccessCache.keys()) {
    if (shouldDeleteOwnerAssetKey(key)) imageUnlockAccessCache.delete(key);
  }
  for (const key of starterPackUnlockedAssetIdsCache.keys()) {
    if (normalizedUserId && !key.startsWith(`${normalizedUserId}:`)) continue;
    starterPackUnlockedAssetIdsCache.delete(key);
  }
}

function getJobAssetRowsCacheKey(jobs: Array<{ jobId: string; assetIds: string[] }>): string {
  return jobs
    .map((job) => `${job.jobId}:${[...new Set(job.assetIds.map((assetId) => assetId.trim()).filter(Boolean))].sort().join(",")}`)
    .sort()
    .join("|");
}

async function resolveImageAccessPlan(ownerUserId?: string): Promise<SocialmediaImageAccessPlan> {
  return resolveSocialmediaImageAccessPlan(ownerUserId);
}

function asSocialmediaResult(result: JobRecord["result"]): SocialmediaJobResult | null {
  if (!result || typeof result !== "object") return null;
  const record = result as unknown as Partial<SocialmediaJobResult>;
  return (
    (record.kind === "socialmedia_image_generation" || record.kind === "socialmedia_video_generation")
    && record.socialmedia
  ) ? record as SocialmediaJobResult : null;
}

async function resolveStorageUrl(bucketName: string, path: string): Promise<string> {
  const cached = getCachedStorageUrl(bucketName, path);
  if (cached) return cached;

  if (isKnownPublicStorageBucket(bucketName)) {
    const url = buildPublicStorageUrl(bucketName, path);
    setCachedStorageUrl(bucketName, path, url);
    return url;
  }

  const client = getSupabaseAdminClient();
  const bucket = client.storage.from(bucketName);

  if (await isStorageBucketPublic(bucketName)) {
    const { data } = bucket.getPublicUrl(path);
    const url = toAbsoluteStorageUrl(data.publicUrl?.trim() || "");
    setCachedStorageUrl(bucketName, path, url);
    return url;
  }

  const { data, error } = await bucket.createSignedUrl(path, SIGNED_URL_TTL_SEC);
  if (error) {
    throw new Error(`Failed to create signed URL for generated socialmedia image: ${error.message}`);
  }
  const url = toAbsoluteStorageUrl(data.signedUrl?.trim() || "");
  setCachedStorageUrl(bucketName, path, url);
  return url;
}

async function resolveStorageUrls(
  requests: Array<{ bucketName: string; path: string }>
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  const byBucket = new Map<string, string[]>();

  for (const request of requests) {
    const bucketName = request.bucketName.trim();
    const path = request.path.trim();
    if (!bucketName || !path) continue;
    const key = getStorageUrlCacheKey(bucketName, path);
    const cached = getCachedStorageUrl(bucketName, path);
    if (cached) {
      resolved.set(key, cached);
      continue;
    }
    if (resolved.has(key)) continue;
    const paths = byBucket.get(bucketName) ?? [];
    paths.push(path);
    byBucket.set(bucketName, paths);
  }

  await Promise.all([...byBucket.entries()].map(async ([bucketName, paths]) => {
    if (isKnownPublicStorageBucket(bucketName)) {
      for (const path of paths) {
        const url = buildPublicStorageUrl(bucketName, path);
        resolved.set(getStorageUrlCacheKey(bucketName, path), url);
        setCachedStorageUrl(bucketName, path, url);
      }
      return;
    }

    const bucket = getSupabaseAdminClient().storage.from(bucketName);
    if (await isStorageBucketPublic(bucketName)) {
      for (const path of paths) {
        const { data } = bucket.getPublicUrl(path);
        const url = toAbsoluteStorageUrl(data.publicUrl?.trim() || "");
        resolved.set(getStorageUrlCacheKey(bucketName, path), url);
        setCachedStorageUrl(bucketName, path, url);
      }
      return;
    }

    const uniquePaths = [...new Set(paths)];
    const { data, error } = await bucket.createSignedUrls(uniquePaths, SIGNED_URL_TTL_SEC);
    if (error) {
      console.warn("[socialmedia-image-access] Failed to batch create signed URLs; falling back to per-file signing.", {
        bucketName,
        pathCount: uniquePaths.length,
        error: error.message
      });
      await Promise.all(uniquePaths.map(async (path) => {
        try {
          const url = await resolveStorageUrl(bucketName, path);
          resolved.set(getStorageUrlCacheKey(bucketName, path), url);
          setCachedStorageUrl(bucketName, path, url);
        } catch (innerError) {
          console.warn("[socialmedia-image-access] Failed to create signed URL during fallback.", {
            bucketName,
            path,
            error: innerError instanceof Error ? innerError.message : String(innerError)
          });
        }
      }));
      return;
    }

    for (const item of data ?? []) {
      if (!item.path || !item.signedUrl || item.error) continue;
      const url = toAbsoluteStorageUrl(item.signedUrl);
      resolved.set(getStorageUrlCacheKey(bucketName, item.path), url);
      setCachedStorageUrl(bucketName, item.path, url);
    }
  }));

  return resolved;
}

function isStorageBucketPublic(bucketName: string): Promise<boolean> {
  const cached = bucketPublicCache.get(bucketName);
  if (cached) return cached;

  const promise = getSupabaseAdminClient()
    .storage
    .getBucket(bucketName)
    .then(({ data }) => Boolean(data?.public))
    .catch(() => false);
  bucketPublicCache.set(bucketName, promise);
  return promise;
}

async function listJobAssetVariantRows(jobId: string, assetIds: string[]): Promise<Map<string, JobAssetVariantRow>> {
  if (!supabaseConfig.adminEnabled) return new Map();

  const normalizedAssetIds = [...new Set(assetIds.map((assetId) => assetId.trim()).filter(Boolean))];
  const client = getSupabaseAdminClient();
  let query = client
    .from("job_assets")
    .select([
      "id",
      "job_id",
      "created_at",
      "storage_bucket",
      "storage_path",
      "public_url",
      "access_variant",
      "original_storage_bucket",
      "original_storage_path",
      "original_mime_type",
      "original_size_bytes",
      "watermarked_storage_bucket",
      "watermarked_storage_path",
      "watermarked_mime_type",
      "watermarked_size_bytes",
      "meta_json"
    ].join(","));

  query = query.eq("job_id", jobId);
  if (normalizedAssetIds.length) {
    query = query.in("id", normalizedAssetIds);
  }
  const { data, error } = await query;

  if (error) {
    console.warn("[socialmedia-image-access] Failed to load job asset image variants.", {
      jobId,
      assetIds: normalizedAssetIds,
      error: error.message
    });
    return new Map();
  }

  return new Map((data ?? []).map((row) => {
    const item = row as unknown as JobAssetVariantRow;
    return [item.id, item];
  }));
}

async function listJobAssetVariantRowsForJobs(
  jobs: SocialmediaGeneratedImagesForPlanJobInput[],
  displayOnly = false
): Promise<Map<string, JobAssetVariantRow>> {
  return listJobAssetVariantRowsForJobAssets(jobs.map((job) => ({
    jobId: job.jobId,
    assetIds: job.images.map((image) => image.assetId)
  })), displayOnly);
}

async function listJobAssetVariantRowsForVideoJobs(
  jobs: SocialmediaGeneratedVideosForPlanJobInput[],
  displayOnly = false
): Promise<Map<string, JobAssetVariantRow>> {
  return listJobAssetVariantRowsForJobAssets(jobs.map((job) => ({
    jobId: job.jobId,
    assetIds: job.videos.map((video) => video.assetId)
  })), displayOnly);
}

async function listJobAssetVariantRowsForJobAssets(
  jobs: Array<{ jobId: string; assetIds: Array<string | undefined> }>,
  displayOnly = false
): Promise<Map<string, JobAssetVariantRow>> {
  if (!supabaseConfig.adminEnabled) return new Map();

  const normalizedJobs = jobs
    .map((job) => ({
      jobId: job.jobId.trim(),
      assetIds: [...new Set(job.assetIds.map((assetId) => assetId?.trim()).filter((assetId): assetId is string => Boolean(assetId)))]
    }))
    .filter((job) => job.jobId && job.assetIds.length);
  if (!normalizedJobs.length) return new Map();

  const jobIds = [...new Set(normalizedJobs.map((job) => job.jobId))];
  const assetIds = [...new Set(normalizedJobs.flatMap((job) => job.assetIds))];
  const cacheKey = `${displayOnly ? "display:" : ""}${getJobAssetRowsCacheKey(normalizedJobs)}`;
  const cached = getCachedValue(jobAssetVariantRowsCache, cacheKey);
  if (cached) return cached;

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("job_assets")
    .select(displayOnly ? IMAGE_ACCESS_DISPLAY_COLUMNS : [...IMAGE_ACCESS_VARIANT_COLUMNS, "meta_json"].join(","))
    .in("job_id", jobIds)
    .in("id", assetIds);

  if (error) {
    if (displayOnly) return listJobAssetVariantRowsForJobAssets(jobs);
    console.warn("[socialmedia-image-access] Failed to load batched job asset image variants.", {
      jobIds,
      assetIds,
      error: error.message
    });
    return new Map();
  }

  const rowsByJobAssetId = new Map((data ?? []).map((row) => {
    const item = (displayOnly ? restoreImageAccessDisplayRow(row as unknown as Record<string, unknown>) : row) as unknown as JobAssetVariantRow;
    return [`${item.job_id ?? ""}:${item.id}`, item];
  }));
  if (rowsByJobAssetId.size) {
    setCachedValue(jobAssetVariantRowsCache, cacheKey, rowsByJobAssetId);
  }
  return rowsByJobAssetId;
}

async function listUnlockedAssetIds(assetIds: string[], ownerUserId?: string): Promise<Set<string>> {
  const normalized = ownerUserId?.trim();
  if (!supabaseConfig.adminEnabled || !normalized || isGuestUserId(normalized)) return new Set();
  if (normalized === "local-dev" || normalized.startsWith("api-key:")) return new Set();
  if (!assetIds.length) return new Set();

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("job_asset_unlocks")
    .select("asset_id")
    .eq("user_id", normalized)
    .in("asset_id", assetIds);
  if (error) {
    if (isMissingJobAssetUnlocksTableError(error)) {
      return new Set();
    }
    console.warn("[socialmedia-image-access] Failed to load unlocked job assets.", {
      assetIds,
      ownerUserId: normalized,
      error: error.message
    });
    return new Set();
  }

  return new Set((data ?? [])
    .map((row) => (row as { asset_id?: string | null }).asset_id)
    .filter((assetId): assetId is string => Boolean(assetId)));
}

type ImageUnlockAccess = {
  originalAssetIds: Set<string>;
  watermarkedAssetIds: Set<string>;
};

function createEmptyImageUnlockAccess(): ImageUnlockAccess {
  return { originalAssetIds: new Set<string>(), watermarkedAssetIds: new Set<string>() };
}

async function listImageUnlockAccess(
  assetIds: string[],
  ownerUserId?: string,
  options?: { bypassCache?: boolean }
): Promise<ImageUnlockAccess> {
  const empty = createEmptyImageUnlockAccess();
  const normalized = ownerUserId?.trim();
  if (!supabaseConfig.adminEnabled || !normalized || isGuestUserId(normalized)) return empty;
  if (normalized === "local-dev" || normalized.startsWith("api-key:")) return empty;
  if (!assetIds.length) return empty;

  const cacheKey = getOwnerAssetCacheKey(normalized, assetIds);
  const cached = options?.bypassCache ? null : getCachedValue(imageUnlockAccessCache, cacheKey);
  if (cached) return cached;

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("job_asset_unlocks")
    .select("asset_id, transaction_id, unlock_source")
    .eq("user_id", normalized)
    .in("asset_id", assetIds);
  if (error) {
    if (isMissingJobAssetUnlocksTableError(error)) {
      return empty;
    }
    console.warn("[socialmedia-image-access] Failed to load image unlock access.", {
      assetIds,
      ownerUserId: normalized,
      error: error.message
    });
    return empty;
  }

  const originalAssetIds = new Set<string>();
  const watermarkedAssetIds = new Set<string>();
  for (const item of data ?? []) {
    const row = item as {
      asset_id?: string | null;
      transaction_id?: string | null;
      unlock_source?: string | null;
    };
    const assetId = row.asset_id?.trim();
    if (!assetId) continue;
    const accessKind = classifyImageUnlockRecord(row);
    if (accessKind === "watermarked") {
      watermarkedAssetIds.add(assetId);
    } else if (accessKind === "original") {
      originalAssetIds.add(assetId);
    }
  }
  return setCachedValue(imageUnlockAccessCache, cacheKey, { originalAssetIds, watermarkedAssetIds });
}

async function listStarterPackUnlockedAssetIds(
  rowsByAssetId: Map<string, JobAssetVariantRow>,
  plan: SocialmediaImageAccessPlan,
  ownerUserId?: string
): Promise<Set<string>> {
  if (!SOCIALMEDIA_RUNTIME_STARTER_PACK_UNLOCK_FALLBACK_ENABLED) return new Set();

  const normalized = ownerUserId?.trim();
  if (plan !== "free" || !normalized || isGuestUserId(normalized)) return new Set();
  if (normalized === "local-dev" || normalized.startsWith("api-key:")) return new Set();
  if (!rowsByAssetId.size) return new Set();

  const cacheKey = `${plan}:${getOwnerAssetCacheKey(normalized, [...rowsByAssetId.keys()])}`;
  const cached = getCachedValue(starterPackUnlockedAssetIdsCache, cacheKey);
  if (cached) return cached;

  const windows = await listStarterPackCreditWindows(normalized).catch((error) => {
    console.warn("[socialmedia-image-access] Failed to load starter pack credit windows.", {
      ownerUserId: normalized,
      error: error instanceof Error ? error.message : String(error)
    });
    return [] as StarterPackCreditWindow[];
  });
  if (!windows.length) return setCachedValue(starterPackUnlockedAssetIdsCache, cacheKey, new Set());

  const candidateRowsByAssetId = new Map<string, JobAssetVariantRow>();
  const jobIds = [...new Set([...rowsByAssetId.entries()]
    .flatMap(([assetId, row]) => {
      const jobId = row.job_id?.trim();
      if (!jobId || !isAssetCreatedDuringStarterPackWindow(row.created_at, windows)) return [];
      candidateRowsByAssetId.set(assetId, row);
      return [jobId];
    }))];
  if (!jobIds.length) return setCachedValue(starterPackUnlockedAssetIdsCache, cacheKey, new Set());

  const starterPackHoldJobIds = await listStarterPackCreditHoldJobIds(normalized, jobIds);
  if (!starterPackHoldJobIds.size) return setCachedValue(starterPackUnlockedAssetIdsCache, cacheKey, new Set());

  const unlockedAssetIds = new Set<string>();
  for (const [assetId, row] of candidateRowsByAssetId) {
    if (row.job_id && starterPackHoldJobIds.has(row.job_id)) {
      unlockedAssetIds.add(assetId);
    }
  }
  return setCachedValue(starterPackUnlockedAssetIdsCache, cacheKey, unlockedAssetIds);
}

function filterRowsWithoutOriginalUnlocks(
  rowsByAssetId: Map<string, JobAssetVariantRow>,
  originalUnlockedAssetIds: Set<string>
): Map<string, JobAssetVariantRow> {
  if (!rowsByAssetId.size || !originalUnlockedAssetIds.size) return rowsByAssetId;

  const lockedRowsByAssetId = new Map<string, JobAssetVariantRow>();
  for (const [assetId, row] of rowsByAssetId) {
    if (!originalUnlockedAssetIds.has(assetId)) {
      lockedRowsByAssetId.set(assetId, row);
    }
  }
  return lockedRowsByAssetId;
}

function isAssetCreatedDuringStarterPackWindow(
  assetCreatedAt: string | null | undefined,
  windows: StarterPackCreditWindow[]
): boolean {
  const assetTimeMs = Date.parse(assetCreatedAt ?? "");
  if (!Number.isFinite(assetTimeMs)) return false;

  return windows.some((window) => {
    const startMs = Date.parse(window.createdAt);
    if (!Number.isFinite(startMs) || assetTimeMs < startMs) return false;
    const endMs = window.expiresAt ? Date.parse(window.expiresAt) : Number.POSITIVE_INFINITY;
    return !Number.isFinite(endMs) || assetTimeMs < endMs;
  });
}

function readMetaString(meta: Record<string, unknown> | null | undefined, key: string): string | undefined {
  const value = meta?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readMetaNumber(meta: Record<string, unknown> | null | undefined, key: string): number | undefined {
  const value = meta?.[key];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

type SelectedImageVariant = {
  image: SocialmediaGeneratedImage;
  bucket?: string | null;
  path?: string | null;
  fallbackPublicUrl?: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  originalSizeBytes?: number | null;
  useOriginal: boolean;
  previewVariant: SocialmediaGeneratedImage["previewVariant"];
};

function selectImageVariantForPlan(
  image: SocialmediaGeneratedImage,
  row: JobAssetVariantRow | undefined,
  plan: SocialmediaImageAccessPlan,
  originalUnlockedAssetIds: Set<string>,
  watermarkedUnlockedAssetIds: Set<string>,
  starterPackUnlockedAssetIds: Set<string>,
  ownerUserId?: string
): SelectedImageVariant | null {
  if (!row) return null;

  const hasWatermarkedVariant = Boolean(row.watermarked_storage_bucket && row.watermarked_storage_path);
  const rowPreviewVariant = readMetaString(row.meta_json, "preview_variant");
  const rowBillingMode = readMetaString(row.meta_json, "billing_mode");
  const isLowResCleanPreviewVariant = image.previewVariant === "low_res_clean"
    || rowPreviewVariant === "low_res_clean";
  const isMaskedPreviewVariant = image.previewVariant === "masked_blur"
    || rowPreviewVariant === "masked_blur"
    || rowBillingMode === "free_locked_preview";
  const shouldServePreviewVariant = Boolean(
    ownerUserId?.trim()
    && (isMaskedPreviewVariant || isLowResCleanPreviewVariant)
    && row.storage_path
    && (isLowResCleanPreviewVariant || isGuestUserId(ownerUserId.trim()) || !hasWatermarkedVariant)
  );
  const hasLegacyOriginalOnlyVariant = !isMaskedPreviewVariant && !isLowResCleanPreviewVariant && !hasWatermarkedVariant && Boolean(
    row.original_storage_path
    || row.storage_path
    || row.public_url?.trim()
  ) && row.access_variant !== "watermarked";
  const useWatermarked = watermarkedUnlockedAssetIds.has(image.assetId) && hasWatermarkedVariant;
  const useOriginal = !useWatermarked && (
    row.access_variant === "original"
    || originalUnlockedAssetIds.has(image.assetId)
    || starterPackUnlockedAssetIds.has(image.assetId)
    || hasLegacyOriginalOnlyVariant
  );
  const bucket = useOriginal
    ? row.original_storage_bucket ?? row.storage_bucket
    : useWatermarked
      ? row.watermarked_storage_bucket
    : shouldServePreviewVariant
      ? row.storage_bucket
      : row.watermarked_storage_bucket;
  const path = useOriginal
    ? row.original_storage_path ?? row.storage_path
    : useWatermarked
      ? row.watermarked_storage_path
    : shouldServePreviewVariant
      ? row.storage_path
      : row.watermarked_storage_path;
  const fallbackPublicUrl = useOriginal && !row.original_storage_path ? row.public_url?.trim() : undefined;
  if ((!bucket || !path) && !fallbackPublicUrl) return null;

  const mimeType = useOriginal
    ? row.original_mime_type
    : useWatermarked
      ? row.watermarked_mime_type
    : shouldServePreviewVariant
      ? readMetaString(row.meta_json, "served_mime_type")
        ?? readMetaString(row.meta_json, "low_res_clean_mime_type")
        ?? readMetaString(row.meta_json, "masked_blur_mime_type")
      : row.watermarked_mime_type;
  const sizeBytes = useOriginal
    ? row.original_size_bytes
    : useWatermarked
      ? row.watermarked_size_bytes
    : shouldServePreviewVariant
      ? readMetaNumber(row.meta_json, "served_size_bytes")
        ?? readMetaNumber(row.meta_json, "low_res_clean_size_bytes")
        ?? readMetaNumber(row.meta_json, "masked_blur_size_bytes")
      : row.watermarked_size_bytes;

  return {
    image,
    bucket,
    path,
    fallbackPublicUrl,
    mimeType,
    sizeBytes,
    originalSizeBytes: row.original_size_bytes ?? readMetaNumber(row.meta_json, "size_bytes"),
    useOriginal,
    previewVariant: useOriginal || useWatermarked ? "watermarked" : isLowResCleanPreviewVariant ? "low_res_clean" : shouldServePreviewVariant ? "masked_blur" : "watermarked"
  };
}

function applySelectedImageVariant(
  selected: SelectedImageVariant,
  url: string
): SocialmediaGeneratedImage {
  return {
    ...selected.image,
    bucket: selected.image.bucket,
    path: selected.path ?? selected.image.path,
    url,
    mimeType: selected.mimeType ?? selected.image.mimeType,
    sizeBytes: typeof selected.sizeBytes === "number" ? selected.sizeBytes : selected.image.sizeBytes,
    originalSizeBytes: typeof selected.originalSizeBytes === "number"
      ? selected.originalSizeBytes
      : selected.image.originalSizeBytes,
    accessVariant: selected.useOriginal ? "original" : "watermarked",
    previewVariant: selected.previewVariant
  };
}

type SelectedVideoVariant = {
  video: SocialmediaGeneratedVideo;
  bucket?: string | null;
  path?: string | null;
  fallbackPublicUrl?: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  firstFrameAssetId?: string;
  firstFrameUrl?: string;
  firstFramePath?: string;
  blocked?: boolean;
  useOriginal: boolean;
};

export function isFailedVideoWatermarkOriginalFallback(
  row: Pick<JobAssetVariantRow, "access_variant" | "watermarked_storage_path" | "meta_json">
): boolean {
  return row.access_variant === "original"
    && !row.watermarked_storage_path?.trim()
    && readMetaString(row.meta_json, "requested_access_variant") === "watermarked"
    && readMetaString(row.meta_json, "watermark_status") === "failed_original_fallback";
}

export function failClosedVideoWatermarkFallback(
  video: SocialmediaGeneratedVideo,
  plan: SocialmediaImageAccessPlan
): SocialmediaGeneratedVideo {
  const isBlockedFallback = plan === "free"
    && video.accessVariant === "original"
    && video.requestedAccessVariant === "watermarked"
    && video.watermarkStatus === "failed_original_fallback";
  return isBlockedFallback
    ? { ...video, path: "", url: "", accessVariant: "watermarked" }
    : video;
}

export function selectVideoVariantForPlan(
  video: SocialmediaGeneratedVideo,
  row: JobAssetVariantRow | undefined,
  plan: SocialmediaImageAccessPlan,
  unlockedAssetIds: Set<string>,
  starterPackUnlockedAssetIds: Set<string>
): SelectedVideoVariant | null {
  if (!row) return null;

  const hasWatermarkedVariant = Boolean(row.watermarked_storage_bucket && row.watermarked_storage_path);
  const isOriginalFallback = isFailedVideoWatermarkOriginalFallback(row);
  const hasLegacyOriginalOnlyVariant = !hasWatermarkedVariant && Boolean(
    row.original_storage_path
    || row.storage_path
    || row.public_url?.trim()
  ) && row.access_variant !== "watermarked" && !isOriginalFallback;
  const useOriginal = (row.access_variant === "original" && (!isOriginalFallback || plan !== "free"))
    || unlockedAssetIds.has(video.assetId)
    || starterPackUnlockedAssetIds.has(video.assetId)
    || hasLegacyOriginalOnlyVariant;
  const bucket = useOriginal
    ? row.original_storage_bucket ?? row.storage_bucket
    : row.watermarked_storage_bucket;
  const path = useOriginal
    ? row.original_storage_path ?? row.storage_path
    : row.watermarked_storage_path;
  const fallbackPublicUrl = useOriginal && (!bucket || !path) ? row.public_url?.trim() : undefined;
  if ((!bucket || !path) && !fallbackPublicUrl) {
    return isOriginalFallback
      ? { video, path: "", blocked: true, useOriginal: false }
      : null;
  }

  return {
    video,
    bucket,
    path,
    fallbackPublicUrl,
    mimeType: useOriginal ? row.original_mime_type : row.watermarked_mime_type,
    sizeBytes: useOriginal ? row.original_size_bytes : row.watermarked_size_bytes,
    firstFrameAssetId: readMetaString(row.meta_json, "first_frame_asset_id"),
    firstFrameUrl: readMetaString(row.meta_json, "first_frame_url"),
    firstFramePath: readMetaString(row.meta_json, "first_frame_path"),
    useOriginal
  };
}

function applySelectedVideoVariant(
  selected: SelectedVideoVariant,
  url: string
): SocialmediaGeneratedVideo {
  if (selected.blocked) {
    return {
      ...selected.video,
      path: "",
      url: "",
      accessVariant: "watermarked"
    };
  }
  return {
    ...selected.video,
    bucket: selected.bucket === SOCIALMEDIA_VIDEO_ASSETS_BUCKET
      ? SOCIALMEDIA_VIDEO_ASSETS_BUCKET
      : selected.video.bucket,
    path: selected.path ?? selected.video.path,
    url,
    mimeType: selected.mimeType ?? selected.video.mimeType,
    sizeBytes: typeof selected.sizeBytes === "number" ? selected.sizeBytes : selected.video.sizeBytes,
    firstFrameAssetId: selected.firstFrameAssetId ?? selected.video.firstFrameAssetId,
    firstFrameUrl: selected.firstFrameUrl ?? selected.video.firstFrameUrl,
    firstFramePath: selected.firstFramePath ?? selected.video.firstFramePath,
    accessVariant: selected.useOriginal ? "original" : "watermarked"
  };
}

async function materializeImageForPlan(
  image: SocialmediaGeneratedImage,
  row: JobAssetVariantRow | undefined,
  plan: SocialmediaImageAccessPlan,
  originalUnlockedAssetIds: Set<string>,
  watermarkedUnlockedAssetIds: Set<string>,
  starterPackUnlockedAssetIds: Set<string>,
  ownerUserId?: string
): Promise<SocialmediaGeneratedImage> {
  const selected = selectImageVariantForPlan(image, row, plan, originalUnlockedAssetIds, watermarkedUnlockedAssetIds, starterPackUnlockedAssetIds, ownerUserId);
  if (!selected) return image;

  const url = selected.fallbackPublicUrl
    ? toAbsoluteStorageUrl(selected.fallbackPublicUrl)
    : selected.bucket && selected.path
      ? await resolveStorageUrl(selected.bucket, selected.path)
      : "";
  return url ? applySelectedImageVariant(selected, url) : image;
}

export function selectOriginalGeneratedAssetVariant(row: JobAssetVariantRow | undefined): {
  bucket?: string | null;
  path?: string | null;
  publicUrl?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
} | null {
  if (!row) return null;

  const hasWatermarkedVariant = Boolean(row.watermarked_storage_bucket && row.watermarked_storage_path);
  const bucket = row.original_storage_bucket ?? (!hasWatermarkedVariant ? row.storage_bucket : null);
  const path = row.original_storage_path ?? (!hasWatermarkedVariant ? row.storage_path : null);
  const publicUrl = !hasWatermarkedVariant && !row.original_storage_path ? row.public_url : null;
  if ((!bucket || !path) && !publicUrl?.trim()) return null;

  return {
    bucket,
    path,
    publicUrl,
    mimeType: row.original_mime_type,
    sizeBytes: row.original_size_bytes
  };
}

async function resolveOriginalGeneratedAssetVariantUrl(row: JobAssetVariantRow): Promise<{
  path?: string | null;
  url: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
} | null> {
  const original = selectOriginalGeneratedAssetVariant(row);
  if (!original) return null;

  const url = original.publicUrl?.trim()
    ? toAbsoluteStorageUrl(original.publicUrl)
    : original.bucket && original.path
      ? await resolveStorageUrl(original.bucket, original.path)
      : "";
  if (!url) return null;

  return {
    path: original.path,
    url,
    mimeType: original.mimeType,
    sizeBytes: original.sizeBytes
  };
}

async function materializeTargetAssetOriginalReference(
  asset: SocialmediaTargetAsset,
  row: JobAssetVariantRow | undefined
): Promise<SocialmediaTargetAsset> {
  if (!row) return asset;

  try {
    const original = await resolveOriginalGeneratedAssetVariantUrl(row);
    if (!original) return asset;

    return {
      ...asset,
      bucket: SOCIALMEDIA_GENERATED_ASSETS_BUCKET,
      path: original.path ?? asset.path,
      url: original.url,
      mimeType: original.mimeType ?? asset.mimeType,
      sizeBytes: typeof original.sizeBytes === "number" ? original.sizeBytes : asset.sizeBytes
    };
  } catch (error) {
    console.warn("[socialmedia-image-access] Failed to resolve original target image reference.", {
      assetId: asset.assetId,
      parentJobId: asset.parentJobId,
      error: error instanceof Error ? error.message : String(error)
    });
    return asset;
  }
}

async function materializeGeneratedImageOriginalReference(
  image: SocialmediaGeneratedImage,
  row: JobAssetVariantRow | undefined
): Promise<SocialmediaGeneratedImage> {
  if (!row) return image;

  try {
    const original = await resolveOriginalGeneratedAssetVariantUrl(row);
    if (!original) return image;

    return {
      ...image,
      bucket: SOCIALMEDIA_GENERATED_ASSETS_BUCKET,
      path: original.path ?? image.path,
      url: original.url,
      mimeType: original.mimeType ?? image.mimeType,
      sizeBytes: typeof original.sizeBytes === "number" ? original.sizeBytes : image.sizeBytes,
      accessVariant: "original",
      previewVariant: "watermarked"
    };
  } catch (error) {
    console.warn("[socialmedia-image-access] Failed to resolve original generated image reference.", {
      assetId: image.assetId,
      error: error instanceof Error ? error.message : String(error)
    });
    return image;
  }
}

export async function materializeSocialmediaTargetAssetsForOriginalReference(params: {
  parentJobId?: string;
  targetAssets: SocialmediaTargetAsset[];
}): Promise<SocialmediaTargetAsset[]> {
  if (!params.targetAssets.length) return params.targetAssets;

  const byJobId = new Map<string, SocialmediaTargetAsset[]>();
  for (const asset of params.targetAssets) {
    const jobId = asset.parentJobId ?? params.parentJobId;
    if (!jobId) continue;
    const group = byJobId.get(jobId) ?? [];
    group.push(asset);
    byJobId.set(jobId, group);
  }
  if (!byJobId.size) return params.targetAssets;

  const rowsByAssetId = new Map<string, JobAssetVariantRow>();
  for (const [jobId, assets] of byJobId) {
    const rows = await listJobAssetVariantRows(jobId, assets.map((asset) => asset.assetId));
    rows.forEach((row, assetId) => rowsByAssetId.set(assetId, row));
  }
  if (!rowsByAssetId.size) return params.targetAssets;

  return Promise.all(
    params.targetAssets.map((asset) => materializeTargetAssetOriginalReference(asset, rowsByAssetId.get(asset.assetId)))
  );
}

export async function materializeSocialmediaGeneratedImagesForOriginalReference(params: {
  jobId: string;
  images: SocialmediaGeneratedImage[];
}): Promise<SocialmediaGeneratedImage[]> {
  if (!params.images.length) return params.images;

  const imageAssetIds = params.images.map((image) => image.assetId).filter(Boolean);
  if (!imageAssetIds.length) return params.images;

  const rowsByAssetId = await listJobAssetVariantRows(params.jobId, imageAssetIds);
  if (!rowsByAssetId.size) return params.images;

  return Promise.all(
    params.images.map((image) => materializeGeneratedImageOriginalReference(image, rowsByAssetId.get(image.assetId)))
  );
}

export async function materializeSocialmediaGeneratedImagesForPlan(
  jobId: string,
  images: SocialmediaGeneratedImage[],
  ownerUserId?: string
): Promise<SocialmediaGeneratedImage[]> {
  if (!images.length) return images;

  const imageAssetIds = images.map((image) => image.assetId).filter(Boolean);
  const rowsByAssetId = await listJobAssetVariantRows(jobId, imageAssetIds);
  if (!rowsByAssetId.size) return images;

  const plan = await resolveImageAccessPlan(ownerUserId);
  const unlockAccess = await listImageUnlockAccess(
    imageAssetIds,
    ownerUserId
  );
  const lockedRowsByAssetId = filterRowsWithoutOriginalUnlocks(rowsByAssetId, unlockAccess.originalAssetIds);
  const starterPackUnlockedAssetIds = lockedRowsByAssetId.size
    ? await listStarterPackUnlockedAssetIds(lockedRowsByAssetId, plan, ownerUserId)
    : new Set<string>();
  return Promise.all(
    images.map((image) => materializeImageForPlan(
      image,
      rowsByAssetId.get(image.assetId),
      plan,
      unlockAccess.originalAssetIds,
      unlockAccess.watermarkedAssetIds,
      starterPackUnlockedAssetIds,
      ownerUserId
    ))
  );
}

export async function materializeSocialmediaGeneratedImagesByJobForPlan(
  jobs: SocialmediaGeneratedImagesForPlanJobInput[],
  ownerUserId?: string,
  options?: ImageAccessMaterializeOptions
): Promise<Map<string, SocialmediaGeneratedImage[]>> {
  const startedAt = Date.now();
  const timings: ImageAccessTiming[] | undefined = SOCIALMEDIA_IMAGE_ACCESS_DEBUG_TIMINGS_ENABLED ? [] : undefined;
  const result = new Map<string, SocialmediaGeneratedImage[]>();
  const jobsById = new Map<string, SocialmediaGeneratedImage[]>();
  for (const job of jobs) {
    const jobId = job.jobId.trim();
    if (!jobId || !job.images.length) continue;
    const existing = jobsById.get(jobId) ?? [];
    jobsById.set(jobId, existing.concat(job.images));
  }
  const normalizedJobs: NormalizedGeneratedImagesForPlanJob[] = [...jobsById.entries()].map(([jobId, images]) => ({ jobId, images }));

  for (const job of normalizedJobs) {
    result.set(job.jobId, job.images);
  }
  if (!normalizedJobs.length) return result;

  const imageAssetIds = [...new Set(normalizedJobs.flatMap((job) => (
    job.images.map((image) => image.assetId?.trim()).filter(Boolean)
  )))];
  if (!imageAssetIds.length) {
    logImageAccessTimings("materialize images by job", startedAt, {
      ownerUserId,
      jobCount: normalizedJobs.length,
      assetCount: 0
    }, timings ?? []);
    return result;
  }

  const planPromise = options?.plan
    ? Promise.resolve(options.plan)
    : timeImageAccessStep(timings, "resolve_plan", () => resolveImageAccessPlan(ownerUserId));
  const rowsByJobAssetIdPromise = timeImageAccessStep(
    timings,
    "job_asset_rows",
    () => listJobAssetVariantRowsForJobs(normalizedJobs, options?.displayOnly),
    (value) => value.size
  );
  const plan = await planPromise;
  const unlockAccessPromise = timeImageAccessStep(
    timings,
    "image_unlock_access",
    () => listImageUnlockAccess(imageAssetIds, ownerUserId, { bypassCache: options?.bypassUnlockCache }),
    (value) => value.originalAssetIds.size + value.watermarkedAssetIds.size
  );
  const [rowsByJobAssetId, unlockAccess] = await Promise.all([
    rowsByJobAssetIdPromise,
    unlockAccessPromise
  ]);
  if (!rowsByJobAssetId.size) {
    logImageAccessTimings("materialize images by job", startedAt, {
      ownerUserId,
      jobCount: normalizedJobs.length,
      assetCount: imageAssetIds.length,
      rowCount: 0
    }, timings ?? []);
    return result;
  }

  const materialized = await materializeSocialmediaGeneratedImagesByJobWithRows(
    normalizedJobs,
    rowsByJobAssetId,
    ownerUserId,
    result,
    imageAssetIds,
    { plan },
    timings,
    unlockAccess
  );
  logImageAccessTimings("materialize images by job", startedAt, {
    ownerUserId,
    jobCount: normalizedJobs.length,
    assetCount: imageAssetIds.length,
    rowCount: rowsByJobAssetId.size,
    plan
  }, timings ?? []);
  return materialized;
}

export async function materializeSocialmediaGeneratedImagesByJobForPlanWithRows(
  jobs: SocialmediaGeneratedImagesForPlanJobInput[],
  rows: JobAssetVariantRow[],
  ownerUserId?: string,
  options?: ImageAccessMaterializeOptions
): Promise<Map<string, SocialmediaGeneratedImage[]>> {
  const result = new Map<string, SocialmediaGeneratedImage[]>();
  const jobsById = new Map<string, SocialmediaGeneratedImage[]>();
  for (const job of jobs) {
    const jobId = job.jobId.trim();
    if (!jobId || !job.images.length) continue;
    const existing = jobsById.get(jobId) ?? [];
    jobsById.set(jobId, existing.concat(job.images));
  }
  const normalizedJobs: NormalizedGeneratedImagesForPlanJob[] = [...jobsById.entries()].map(([jobId, images]) => ({ jobId, images }));

  for (const job of normalizedJobs) {
    result.set(job.jobId, job.images);
  }
  if (!normalizedJobs.length) return result;

  const imageAssetIds = [...new Set(normalizedJobs.flatMap((job) => (
    job.images.map((image) => image.assetId?.trim()).filter(Boolean)
  )))];
  if (!imageAssetIds.length) return result;

  const rowsByJobAssetId = new Map<string, JobAssetVariantRow>();
  for (const row of rows) {
    if (!row.id || !row.job_id) continue;
    rowsByJobAssetId.set(`${row.job_id}:${row.id}`, row);
  }
  if (!rowsByJobAssetId.size) return result;

  return materializeSocialmediaGeneratedImagesByJobWithRows(
    normalizedJobs,
    rowsByJobAssetId,
    ownerUserId,
    result,
    imageAssetIds,
    options
  );
}

async function materializeSocialmediaGeneratedImagesByJobWithRows(
  normalizedJobs: NormalizedGeneratedImagesForPlanJob[],
  rowsByJobAssetId: Map<string, JobAssetVariantRow>,
  ownerUserId: string | undefined,
  result: Map<string, SocialmediaGeneratedImage[]>,
  imageAssetIds: string[],
  options?: ImageAccessMaterializeOptions,
  timings?: ImageAccessTiming[],
  prefetchedUnlockAccess?: ImageUnlockAccess
): Promise<Map<string, SocialmediaGeneratedImage[]>> {

  const plan = options?.plan ?? await timeImageAccessStep(timings, "resolve_plan", () => resolveImageAccessPlan(ownerUserId));
  const rowsByAssetId = new Map<string, JobAssetVariantRow>();
  rowsByJobAssetId.forEach((row) => {
    if (row.id) rowsByAssetId.set(row.id, row);
  });
  const unlockAccess = prefetchedUnlockAccess ?? await timeImageAccessStep(
    timings,
    "image_unlock_access",
    () => listImageUnlockAccess(imageAssetIds, ownerUserId, { bypassCache: options?.bypassUnlockCache }),
    (value) => value.originalAssetIds.size + value.watermarkedAssetIds.size
  );
  const lockedRowsByAssetId = filterRowsWithoutOriginalUnlocks(rowsByAssetId, unlockAccess.originalAssetIds);
  const starterPackUnlockedAssetIds = await timeImageAccessStep(
    timings,
    "starter_pack_unlocks",
    () => lockedRowsByAssetId.size
      ? listStarterPackUnlockedAssetIds(lockedRowsByAssetId, plan, ownerUserId)
      : Promise.resolve(new Set<string>()),
    (value) => value.size
  );
  const selectedByJobAssetId = new Map<string, SelectedImageVariant>();
  const storageRequests: Array<{ bucketName: string; path: string }> = [];
  await timeImageAccessStep(timings, "select_variants", async () => {
    for (const job of normalizedJobs) {
      for (const image of job.images) {
        const key = `${job.jobId}:${image.assetId}`;
        const selected = selectImageVariantForPlan(
          image,
          rowsByJobAssetId.get(key),
          plan,
          unlockAccess.originalAssetIds,
          unlockAccess.watermarkedAssetIds,
          starterPackUnlockedAssetIds,
          ownerUserId
        );
        if (!selected) continue;
        selectedByJobAssetId.set(key, selected);
        if (!selected.fallbackPublicUrl && selected.bucket && selected.path) {
          storageRequests.push({ bucketName: selected.bucket, path: selected.path });
        }
      }
    }
    return selectedByJobAssetId;
  }, (value) => value.size);

  const resolvedUrls = await timeImageAccessStep(
    timings,
    "resolve_storage_urls",
    () => resolveStorageUrls(storageRequests),
    (value) => value.size
  );
  for (const job of normalizedJobs) {
    const images = job.images.map((image) => {
      const selected = selectedByJobAssetId.get(`${job.jobId}:${image.assetId}`);
      if (!selected) return image;
      const url = selected.fallbackPublicUrl
        ? toAbsoluteStorageUrl(selected.fallbackPublicUrl)
        : selected.bucket && selected.path
          ? resolvedUrls.get(`${selected.bucket}:${selected.path}`) ?? ""
          : "";
      return url ? applySelectedImageVariant(selected, url) : image;
    });
    result.set(job.jobId, images);
  }

  return result;
}

export async function materializeSocialmediaGeneratedVideosByJobForPlan(
  jobs: SocialmediaGeneratedVideosForPlanJobInput[],
  ownerUserId?: string,
  options?: { plan?: SocialmediaImageAccessPlan; displayOnly?: boolean }
): Promise<Map<string, SocialmediaGeneratedVideo[]>> {
  const startedAt = Date.now();
  const timings: ImageAccessTiming[] | undefined = SOCIALMEDIA_IMAGE_ACCESS_DEBUG_TIMINGS_ENABLED ? [] : undefined;
  const result = new Map<string, SocialmediaGeneratedVideo[]>();
  const jobsById = new Map<string, SocialmediaGeneratedVideo[]>();
  for (const job of jobs) {
    const jobId = job.jobId.trim();
    if (!jobId || !job.videos.length) continue;
    const existing = jobsById.get(jobId) ?? [];
    jobsById.set(jobId, existing.concat(job.videos));
  }
  const normalizedJobs: NormalizedGeneratedVideosForPlanJob[] = [...jobsById.entries()]
    .map(([jobId, videos]) => ({ jobId, videos }));

  if (!normalizedJobs.length) return result;
  const plan = options?.plan ?? await timeImageAccessStep(timings, "resolve_plan", () => resolveImageAccessPlan(ownerUserId));

  for (const job of normalizedJobs) {
    result.set(job.jobId, job.videos.map((video) => failClosedVideoWatermarkFallback(video, plan)));
  }
  const videoAssetIds = [...new Set(normalizedJobs.flatMap((job) => (
    job.videos.map((video) => video.assetId?.trim()).filter(Boolean)
  )))];
  if (!videoAssetIds.length) {
    logImageAccessTimings("materialize videos by job", startedAt, {
      ownerUserId,
      jobCount: normalizedJobs.length,
      assetCount: 0
    }, timings ?? []);
    return result;
  }

  const rowsByJobAssetId = await timeImageAccessStep(
    timings,
    "job_asset_rows",
    () => listJobAssetVariantRowsForVideoJobs(normalizedJobs, options?.displayOnly),
    (value) => value.size
  );
  if (!rowsByJobAssetId.size) {
    logImageAccessTimings("materialize videos by job", startedAt, {
      ownerUserId,
      jobCount: normalizedJobs.length,
      assetCount: videoAssetIds.length,
      rowCount: 0
    }, timings ?? []);
    return result;
  }

  const rowsByAssetId = new Map<string, JobAssetVariantRow>();
  rowsByJobAssetId.forEach((row) => {
    if (row.id) rowsByAssetId.set(row.id, row);
  });
  const unlockedAssetIds = await timeImageAccessStep(
    timings,
    "video_unlock_access",
    () => listUnlockedAssetIds(videoAssetIds, ownerUserId),
    (value) => value.size
  );
  const lockedRowsByAssetId = filterRowsWithoutOriginalUnlocks(rowsByAssetId, unlockedAssetIds);
  const starterPackUnlockedAssetIds = await timeImageAccessStep(
    timings,
    "starter_pack_unlocks",
    () => lockedRowsByAssetId.size
      ? listStarterPackUnlockedAssetIds(lockedRowsByAssetId, plan, ownerUserId)
      : Promise.resolve(new Set<string>()),
    (value) => value.size
  );
  const selectedByJobAssetId = new Map<string, SelectedVideoVariant>();
  const storageRequests: Array<{ bucketName: string; path: string }> = [];
  await timeImageAccessStep(timings, "select_variants", async () => {
    for (const job of normalizedJobs) {
      for (const video of job.videos) {
        const key = `${job.jobId}:${video.assetId}`;
        const selected = selectVideoVariantForPlan(
          video,
          rowsByJobAssetId.get(key),
          plan,
          unlockedAssetIds,
          starterPackUnlockedAssetIds
        );
        if (!selected) continue;
        selectedByJobAssetId.set(key, selected);
        if (!selected.fallbackPublicUrl && selected.bucket && selected.path) {
          storageRequests.push({ bucketName: selected.bucket, path: selected.path });
        }
      }
    }
    return selectedByJobAssetId;
  }, (value) => value.size);

  const resolvedUrls = await timeImageAccessStep(
    timings,
    "resolve_storage_urls",
    () => resolveStorageUrls(storageRequests),
    (value) => value.size
  );
  for (const job of normalizedJobs) {
    const videos = job.videos.map((video) => {
      const selected = selectedByJobAssetId.get(`${job.jobId}:${video.assetId}`);
      if (!selected) return failClosedVideoWatermarkFallback(video, plan);
      if (selected.blocked) return applySelectedVideoVariant(selected, "");
      const url = selected.fallbackPublicUrl
        ? toAbsoluteStorageUrl(selected.fallbackPublicUrl)
        : selected.bucket && selected.path
          ? resolvedUrls.get(`${selected.bucket}:${selected.path}`) ?? ""
          : "";
      return url
        ? applySelectedVideoVariant(selected, url)
        : failClosedVideoWatermarkFallback(video, plan);
    });
    result.set(job.jobId, videos);
  }

  logImageAccessTimings("materialize videos by job", startedAt, {
    ownerUserId,
    jobCount: normalizedJobs.length,
    assetCount: videoAssetIds.length,
    rowCount: rowsByJobAssetId.size,
    plan: options?.plan
  }, timings ?? []);
  return result;
}

export async function materializeSocialmediaJobImageAccess(
  job: JobRecord,
  ownerUserId?: string,
  options?: ImageAccessMaterializeOptions
): Promise<JobRecord> {
  const result = asSocialmediaResult(job.result);
  if (!result) return job;
  const resultVideos = result.socialmedia.videos ?? [];
  if (!result.socialmedia.images.length && !resultVideos.length) return job;

  const [imagesByJobId, videosByJobId] = await Promise.all([
    result.socialmedia.images.length
      ? materializeSocialmediaGeneratedImagesByJobForPlan(
          [{ jobId: job.id, images: result.socialmedia.images }],
          ownerUserId ?? job.ownerUserId,
          options
        )
      : Promise.resolve(new Map<string, SocialmediaGeneratedImage[]>()),
    resultVideos.length
      ? materializeSocialmediaGeneratedVideosByJobForPlan(
          [{ jobId: job.id, videos: resultVideos }],
          ownerUserId ?? job.ownerUserId,
          options
        )
      : Promise.resolve(new Map<string, SocialmediaGeneratedVideo[]>())
  ]);
  const images = imagesByJobId.get(job.id) ?? result.socialmedia.images;
  const videos = videosByJobId.get(job.id) ?? resultVideos;
  if (images === result.socialmedia.images && videos === resultVideos) return job;

  return {
    ...job,
    result: {
      ...result,
      socialmedia: {
        ...result.socialmedia,
        images,
        videos
      }
    } as unknown as JobRecord["result"]
  };
}
