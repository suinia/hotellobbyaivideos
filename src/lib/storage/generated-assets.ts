import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { appConfig } from "@/lib/config";
import type { ConversionResult } from "@/lib/types/skills";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseConfig } from "@/lib/supabase/config";

const GENERATED_ASSETS_BUCKET = "generated-assets";
const GENERATED_ASSETS_SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 365; // 1 year
let generatedAssetsBucketIsPublic: boolean | null = null;

function isDataImageUrl(value: string): boolean {
  return /^data:image\/[a-zA-Z0-9.+-]+(?:;[^,]*)?,/i.test(value.trim());
}

function formatDateYYYYMMDD(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function mimeToExtension(mimeType: string): string {
  const normalized = mimeType.toLowerCase().trim();
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";
  if (normalized === "image/avif") return "avif";
  if (normalized === "image/svg+xml") return "svg";
  const subtype = normalized.split("/")[1] ?? "bin";
  return subtype.replace(/\+.*/, "").replace(/[^a-z0-9]/gi, "") || "bin";
}

function parseDataImageUrl(dataUrl: string): { mimeType: string; buffer: Buffer } {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+)(;[^,]*)?,([\s\S]+)$/i);
  if (!match) {
    throw new Error("Invalid data image URL");
  }

  const mimeType = (match[1] || "image/png").toLowerCase();
  const meta = match[2] || "";
  const payload = match[3] || "";
  const isBase64 = /;base64/i.test(meta);

  if (isBase64) {
    const normalizedPayload = payload.replace(/\s+/g, "");
    return {
      mimeType,
      buffer: Buffer.from(normalizedPayload, "base64")
    };
  }

  return {
    mimeType,
    buffer: Buffer.from(decodeURIComponent(payload), "utf8")
  };
}

async function stripImageMetadata(params: { mimeType: string; buffer: Buffer }): Promise<{ mimeType: string; buffer: Buffer }> {
  const { mimeType, buffer } = params;
  if (!buffer.length) {
    return params;
  }

  try {
    let pipeline = sharp(buffer, { animated: true });

    if (mimeType === "image/png") {
      pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, palette: false });
    } else if (mimeType === "image/jpeg") {
      pipeline = pipeline.jpeg({ quality: 92, mozjpeg: true });
    } else if (mimeType === "image/webp") {
      pipeline = pipeline.webp({ quality: 92 });
    } else if (mimeType === "image/avif") {
      pipeline = pipeline.avif({ quality: 88 });
    } else {
      return params;
    }

    const stripped = await pipeline.toBuffer();
    return {
      mimeType,
      buffer: stripped
    };
  } catch (error) {
    console.warn("[generated-assets] Failed to strip image metadata; uploading original buffer.", {
      mimeType,
      error: error instanceof Error ? error.message : String(error)
    });
    return params;
  }
}

function buildObjectPath(ownerUserId: string, mimeType: string): string {
  const date = formatDateYYYYMMDD();
  const ext = mimeToExtension(mimeType);
  const fileName = `${date}_${randomUUID().replace(/-/g, "")}.${ext}`;
  return `${ownerUserId}/${fileName}`;
}

function toAbsoluteStorageUrl(url: string): string {
  const normalized = url.trim();
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;

  const base = supabaseConfig.url?.trim();
  if (!base) return normalized;

  try {
    return new URL(normalized, base).toString();
  } catch {
    return normalized;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isGeneratedAssetsBucketPublic(): Promise<boolean> {
  if (generatedAssetsBucketIsPublic !== null) {
    return generatedAssetsBucketIsPublic;
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client.storage.getBucket(GENERATED_ASSETS_BUCKET);
  if (error) {
    throw new Error(`Failed to inspect storage bucket '${GENERATED_ASSETS_BUCKET}': ${error.message}`);
  }

  generatedAssetsBucketIsPublic = Boolean(data?.public);
  return generatedAssetsBucketIsPublic;
}

export async function materializeGeneratedImageUrl(
  imageUrl: string,
  ownerUserId?: string,
  cache?: Map<string, string>
): Promise<string> {
  if (typeof imageUrl !== "string" || !imageUrl.trim()) {
    return imageUrl;
  }

  const normalized = imageUrl.trim();
  if (!isDataImageUrl(normalized)) {
    return normalized;
  }

  if (!ownerUserId?.trim()) {
    throw new Error("ownerUserId is required when persisting generated images");
  }

  if (!supabaseConfig.adminEnabled) {
    throw new Error("Supabase admin client is required to persist generated images");
  }

  if (cache?.has(normalized)) {
    return cache.get(normalized) as string;
  }

  const parsed = parseDataImageUrl(normalized);
  const sanitizedImage = await stripImageMetadata(parsed);
  const objectPath = buildObjectPath(ownerUserId.trim(), sanitizedImage.mimeType);
  const client = getSupabaseAdminClient();
  const bucket = client.storage.from(GENERATED_ASSETS_BUCKET);

  const retryMax = Math.max(0, appConfig.image.generatedAssets.uploadRetryMax);
  const retryBaseDelayMs = Math.max(100, appConfig.image.generatedAssets.uploadRetryBaseDelayMs);
  let uploadError: { message: string } | null = null;
  for (let attempt = 0; attempt <= retryMax; attempt += 1) {
    const { error } = await bucket.upload(objectPath, sanitizedImage.buffer, {
      contentType: sanitizedImage.mimeType,
      upsert: false,
      cacheControl: "31536000"
    });
    uploadError = error;
    if (!uploadError) {
      break;
    }
    if (attempt < retryMax) {
      const backoffMs = retryBaseDelayMs * (2 ** attempt);
      console.warn("[generated-assets] Upload failed, retrying.", {
        bucket: GENERATED_ASSETS_BUCKET,
        objectPath,
        attempt: attempt + 1,
        maxAttempts: retryMax,
        backoffMs,
        error: uploadError.message
      });
      await sleep(backoffMs);
    }
  }
  if (uploadError) {
    if (appConfig.image.generatedAssets.allowDataUrlFallback) {
      console.warn("[generated-assets] Upload failed; returning original data URL because fallback is enabled.", {
        bucket: GENERATED_ASSETS_BUCKET,
        objectPath,
        error: uploadError.message
      });
      return normalized;
    }
    throw new Error(`Failed to upload generated image: ${uploadError.message}`);
  }

  const bucketPublic = await isGeneratedAssetsBucketPublic();
  let resolvedUrl = "";

  if (bucketPublic) {
    const { data } = bucket.getPublicUrl(objectPath);
    resolvedUrl = toAbsoluteStorageUrl(data.publicUrl?.trim() || "");
  } else {
    const { data, error } = await bucket.createSignedUrl(objectPath, GENERATED_ASSETS_SIGNED_URL_TTL_SEC);
    if (error) {
      throw new Error(`Failed to create signed URL for generated image: ${error.message}`);
    }
    resolvedUrl = toAbsoluteStorageUrl(data.signedUrl?.trim() || "");
  }

  if (!resolvedUrl) {
    throw new Error("Failed to resolve URL for generated image");
  }

  if (cache) {
    cache.set(normalized, resolvedUrl);
  }
  return resolvedUrl;
}

export async function materializeDataImageUrlsDeep<T>(value: T, ownerUserId?: string): Promise<T> {
  if (!ownerUserId?.trim()) {
    return value;
  }

  const seen = new Map<string, string>();

  const walk = async (node: unknown): Promise<unknown> => {
    if (typeof node === "string") {
      return materializeGeneratedImageUrl(node, ownerUserId, seen);
    }
    if (Array.isArray(node)) {
      return Promise.all(node.map((item) => walk(item)));
    }
    if (!node || typeof node !== "object") {
      return node;
    }

    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(node as Record<string, unknown>)) {
      output[key] = await walk(item);
    }
    return output;
  };

  return (await walk(value)) as T;
}

export async function materializeConversionResultImages(
  result: ConversionResult,
  ownerUserId?: string
): Promise<ConversionResult> {
  return materializeDataImageUrlsDeep(result, ownerUserId);
}
