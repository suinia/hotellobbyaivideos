import { appConfig } from "@/lib/config";
import { limitImageModelPrompt } from "@/lib/images/prompt-limit";
import {
  applyHfsyapiVisibleTextLanguageConstraint,
  applyVisibleTextLanguageConstraint
} from "@/lib/socialmedia/visible-text-language";

export type GenerateHfsyapiImagesInput = {
  model?: string;
  prompt: string;
  visibleTextLanguage?: string;
  aspectRatio: string;
  resolution?: string;
  quality?: string;
  imageUrls?: string[];
  n: number;
};

export type SubmittedHfsyapiImageTask = {
  taskId: string;
  provider: string;
  model: string;
};

type DeferredHfsyapiTaskPayload = {
  v: 1;
  model?: string;
  prompt: string;
  aspectRatio: string;
  resolution?: string;
  quality?: string;
  imageUrls?: string[];
  n: number;
};

const HFSYAPI_TASK_PREFIX = "hfsyapi:";
const MAX_REFERENCE_IMAGES = 4;
const DEFAULT_RESPONSE_FORMAT = "b64_json";
const DEFAULT_HFSYAPI_MODEL = "gpt-image-2";
const HFSYAPI_PREMIUM_MODEL = "gpt-image-2pro";

const HFSYAPI_SIZES: Record<string, Record<string, string>> = {
  "1k": {
    "1:1": "1024x1024",
    "5:4": "1040x832",
    "9:16": "720x1280",
    "16:9": "1280x720",
    "4:3": "1024x768",
    "3:2": "1008x672",
    "4:5": "832x1040",
    "3:4": "768x1024",
    "2:3": "672x1008",
    "21:9": "1344x576"
  },
  "2k": {
    "1:1": "2048x2048",
    "5:4": "2080x1664",
    "9:16": "1152x2048",
    "16:9": "2048x1152",
    "4:3": "2048x1536",
    "3:2": "2016x1344",
    "4:5": "1664x2080",
    "3:4": "1536x2048",
    "2:3": "1344x2016",
    "21:9": "2016x864"
  },
  "4k": {
    "1:1": "2880x2880",
    "5:4": "3200x2560",
    "9:16": "2160x3840",
    "16:9": "3840x2160",
    "4:3": "3264x2448",
    "3:2": "3504x2336",
    "4:5": "2560x3200",
    "3:4": "2448x3264",
    "2:3": "2336x3504",
    "21:9": "3696x1584"
  }
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function previewText(value: string, max = 280): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function errorStatusCode(error: unknown): number | undefined {
  const status = Number(asRecord(error)?.status ?? asRecord(error)?.code);
  return Number.isFinite(status) ? status : undefined;
}

function isValidAbsoluteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "data:";
  } catch {
    return false;
  }
}

function normalizeImageUrls(imageUrls?: string[]): string[] {
  return (imageUrls ?? [])
    .map((item) => item.trim())
    .filter(isValidAbsoluteUrl)
    .slice(0, MAX_REFERENCE_IMAGES);
}

function normalizeResponseFormat(value: string | undefined): "b64_json" | "b64_data" {
  const normalized = value?.trim().toLowerCase();
  return normalized === "b64_data" ? "b64_data" : DEFAULT_RESPONSE_FORMAT;
}

function normalizeResolution(value?: string): "1k" | "2k" | "4k" {
  const normalized = value?.trim().toLowerCase();
  return normalized === "2k" || normalized === "4k" ? normalized : "1k";
}

function resolveHfsyapiModel(params: { model?: string; resolution?: string }): string {
  const model = params.model?.trim() || appConfig.image.hfsyapi.model || DEFAULT_HFSYAPI_MODEL;
  const resolution = normalizeResolution(params.resolution);
  if ((resolution === "2k" || resolution === "4k") && model === DEFAULT_HFSYAPI_MODEL) {
    return HFSYAPI_PREMIUM_MODEL;
  }
  return model;
}

function toDataUrl(b64Json: string, format = "png"): string {
  const normalizedFormat = format === "jpeg" || format === "webp" ? format : "png";
  const mimeType = normalizedFormat === "jpeg" ? "image/jpeg" : `image/${normalizedFormat}`;
  return `data:${mimeType};base64,${b64Json.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "").trim()}`;
}

function collectImageUrlsFromUnknown(value: unknown, outputFormat: string, imageUrls: string[]): void {
  if (typeof value === "string") {
    if (isValidAbsoluteUrl(value)) imageUrls.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectImageUrlsFromUnknown(item, outputFormat, imageUrls);
    return;
  }

  const record = asRecord(value);
  if (!record) return;

  const directUrl = record.url ?? record.image_url ?? record.imageUrl;
  if (typeof directUrl === "string" && isValidAbsoluteUrl(directUrl)) imageUrls.push(directUrl);

  const nestedUrl = asRecord(record.image_url)?.url ?? asRecord(record.imageUrl)?.url;
  if (typeof nestedUrl === "string" && isValidAbsoluteUrl(nestedUrl)) imageUrls.push(nestedUrl);

  const base64 = record.b64_json ?? record.b64_data ?? record.base64;
  if (typeof base64 === "string" && base64.trim()) {
    imageUrls.push(toDataUrl(base64, outputFormat));
  }
}

export function extractHfsyapiImageUrls(payload: unknown, outputFormat = "png"): string[] {
  const imageUrls: string[] = [];
  const record = asRecord(payload);

  collectImageUrlsFromUnknown(record?.data, outputFormat, imageUrls);
  collectImageUrlsFromUnknown(record?.images, outputFormat, imageUrls);
  collectImageUrlsFromUnknown(record, outputFormat, imageUrls);

  return Array.from(new Set(imageUrls));
}

export function isHfsyapiImageConfigured(): boolean {
  const { hfsyapi } = appConfig.image;
  return Boolean(hfsyapi.apiKey && hfsyapi.apiUrl);
}

export function hfsyapiSizeForAspectRatio(params: { aspectRatio: string; resolution?: string }): string {
  const normalizedRatio = params.aspectRatio.trim().toLowerCase();
  const resolution = normalizeResolution(params.resolution);
  const sizes = HFSYAPI_SIZES[resolution] ?? HFSYAPI_SIZES["1k"];
  return sizes[normalizedRatio] ?? sizes["1:1"];
}

export function buildHfsyapiGenerationPayload(params: GenerateHfsyapiImagesInput): Record<string, unknown> {
  const { hfsyapi } = appConfig.image;
  const referenceImages = normalizeImageUrls(params.imageUrls);
  const resolution = normalizeResolution(params.resolution);
  const model = resolveHfsyapiModel({
    model: params.model,
    resolution
  });
  const shouldApplyVisibleTextLanguageConstraint = Boolean(params.visibleTextLanguage)
    || params.prompt.includes("Visible text language constraint:");
  const prompt = limitImageModelPrompt(shouldApplyVisibleTextLanguageConstraint
    ? applyHfsyapiVisibleTextLanguageConstraint({
        prompt: params.prompt,
        language: params.visibleTextLanguage,
        model
      })
    : params.prompt);
  const payload: Record<string, unknown> = {
    model,
    prompt,
    size: hfsyapiSizeForAspectRatio({
      aspectRatio: params.aspectRatio,
      resolution
    }),
    n: Math.max(1, Math.min(4, Math.round(params.n))),
    response_format: normalizeResponseFormat(hfsyapi.responseFormat)
  };

  if (referenceImages.length) {
    payload.reference_images = referenceImages;
  }

  return payload;
}

function encodeTaskPayload(payload: DeferredHfsyapiTaskPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function isHfsyapiImageTaskId(taskId: string): boolean {
  return taskId.startsWith(HFSYAPI_TASK_PREFIX);
}

export function createHfsyapiDeferredImageTask(input: GenerateHfsyapiImagesInput): SubmittedHfsyapiImageTask {
  const resolution = normalizeResolution(input.resolution);
  const model = resolveHfsyapiModel({
    model: input.model,
    resolution
  });
  const payload: DeferredHfsyapiTaskPayload = {
    v: 1,
    model,
    prompt: input.visibleTextLanguage
      ? applyVisibleTextLanguageConstraint({
          prompt: input.prompt,
          language: input.visibleTextLanguage
        })
      : input.prompt,
    aspectRatio: input.aspectRatio,
    resolution,
    quality: input.quality,
    imageUrls: normalizeImageUrls(input.imageUrls),
    n: Math.max(1, Math.min(4, Math.round(input.n)))
  };

  return {
    taskId: `${HFSYAPI_TASK_PREFIX}${encodeTaskPayload(payload)}`,
    provider: `hfsyapi:${model}`,
    model
  };
}

export function isHfsyapiErrorEligibleForVectorengineFallback(error: unknown): boolean {
  if (appConfig.image.fallbackProvider !== "vectorengine") return false;

  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  if (
    normalized.includes("moderation_blocked")
    || normalized.includes("safety_violations")
    || normalized.includes("image_generation_user_error")
    || normalized.includes("your request was rejected by the safety system")
    || normalized.includes("sexually explicit")
    || normalized.includes("pornographic")
    || normalized.includes("sexual acts or nudity")
    || normalized.includes("cannot create or modify images with sexual")
    || normalized.includes("cannot create sexually")
    || normalized.includes("invalid_reference_image")
    || normalized.includes("参考图解析失败")
    || normalized.includes("违反平台政策")
  ) {
    return false;
  }

  const status = errorStatusCode(error);
  if (status !== undefined && (status === 408 || status === 409 || status === 425 || status === 429 || status >= 500)) {
    return true;
  }

  return (
    normalized.includes("timed out")
    || normalized.includes("timeout")
    || normalized.includes("fetch failed")
    || normalized.includes("network")
    || normalized.includes("socket hang up")
    || normalized.includes("econnreset")
    || normalized.includes("etimedout")
    || normalized.includes("eai_again")
    || normalized.includes("enotfound")
    || normalized.includes("upstream provider unavailable")
    || normalized.includes("all channels failed")
    || normalized.includes("temporarily unavailable")
    || /\b50[0-9]\b/.test(normalized)
  );
}

function requireHfsyapiConfig(): { apiUrl: string; apiKey: string; model: string; timeoutMs: number } {
  const { hfsyapi } = appConfig.image;
  if (!hfsyapi.apiKey) {
    throw new Error("HFSYAPI_IMAGE_API_KEY is missing");
  }
  return {
    apiUrl: hfsyapi.apiUrl,
    apiKey: hfsyapi.apiKey,
    model: hfsyapi.model || DEFAULT_HFSYAPI_MODEL,
    timeoutMs: Math.max(5000, Number(hfsyapi.timeoutMs) || 240000)
  };
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutMessage: string
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function readJsonResponse(response: Response): Promise<{ payload: unknown; text: string }> {
  const text = await response.text();
  try {
    return { payload: JSON.parse(text), text };
  } catch {
    return { payload: {}, text };
  }
}

export async function generateHfsyapiGptImages(input: GenerateHfsyapiImagesInput): Promise<{
  imageUrls: string[];
  provider: string;
  model: string;
}> {
  const config = requireHfsyapiConfig();
  const model = resolveHfsyapiModel({
    model: input.model || config.model,
    resolution: input.resolution
  });
  const payload = buildHfsyapiGenerationPayload({
    ...input,
    model,
    resolution: input.resolution
  });

  console.info("[HFSYAPI] Image generation start", {
    model,
    aspectRatio: input.aspectRatio,
    size: payload.size,
    n: payload.n,
    referenceImageCount: Array.isArray(payload.reference_images) ? payload.reference_images.length : 0,
    promptPreview: previewText(input.prompt, 220)
  });

  const response = await fetchWithTimeout(
    `${config.apiUrl}/v1/images/generations`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      cache: "no-store"
    },
    config.timeoutMs,
    `HFSYAPI image generation timed out after ${config.timeoutMs}ms`
  );
  const { payload: responsePayload, text } = await readJsonResponse(response);
  if (!response.ok) {
    const error = new Error(`HFSYAPI image generation failed: ${response.status} ${previewText(text)}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  const imageUrls = extractHfsyapiImageUrls(responsePayload);
  if (!imageUrls.length) {
    throw new Error(`HFSYAPI image generation returned no images: ${previewText(text)}`);
  }

  console.info("[HFSYAPI] Image generation success", {
    model,
    imageCount: imageUrls.length,
    provider: `hfsyapi:${model}`
  });

  return {
    imageUrls: imageUrls.slice(0, Math.max(1, Math.min(4, Math.round(input.n)))),
    provider: `hfsyapi:${model}`,
    model
  };
}
