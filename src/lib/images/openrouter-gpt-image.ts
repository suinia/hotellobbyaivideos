import { flareExperimentQuality } from "@/lib/socialmedia/image-model-experiment";
import { randomUUID } from "node:crypto";

import { appConfig, resolveImageFallbackProvider } from "@/lib/config";
import { limitImageModelPrompt } from "@/lib/images/prompt-limit";
import { applyVisibleTextLanguageConstraint } from "@/lib/socialmedia/visible-text-language";
import { recommendedWorkbenchImageRatio } from "@/lib/workbench/image-canvas";
import { isGptImage25ModelExperiment, type ImageModelExperimentVariant } from "@/lib/socialmedia/image-model-experiment";

export type GenerateOpenrouterImagesInput = {
  experimentModel?: ImageModelExperimentVariant;
  model?: string;
  prompt: string;
  visibleTextLanguage?: string;
  aspectRatio: string;
  resolution?: string;
  quality?: string;
  background?: "auto" | "opaque" | "transparent";
  outputFormat?: "png" | "jpeg" | "webp";
  imageUrls?: string[];
  referenceAspectRatio?: string;
  sourceUseCase?: string;
  n: number;
};

export type SubmittedOpenrouterImageTask = {
  taskId: string;
  provider: string;
  model: string;
};

const OPENROUTER_TASK_PREFIX = "openrouter:";
const DEFAULT_MODEL = "openai/gpt-image-2";
const DEFAULT_MODEL_25 = "openai/gpt-image-2.5-flare";

export function resolveOpenrouterImageModel(input: GenerateOpenrouterImagesInput): string {
  const config = appConfig.image.openrouter;
  if (isGptImage25ModelExperiment(input)) {
    return input.experimentModel === "gpt-image-2.5-sunburst"
      ? "openai/gpt-image-2.5-sunburst"
      : config.model25 || DEFAULT_MODEL_25;
  }
  return config.model || DEFAULT_MODEL;
}
const MAX_REFERENCE_IMAGES = 16;
const MAX_REFERENCE_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_REFERENCE_IMAGE_BYTES = 24 * 1024 * 1024;
type Resolution = "1k" | "2k" | "4k";

// Match APIMart's ratio/tier contract. OpenRouter requires concrete pixels;
// resolution alone is ignored, and 4k does not mean a 4096px square.
const IMAGE_SIZES: Record<string, readonly [string, string, string]> = {
  "1:1": ["1024x1024", "2048x2048", "2880x2880"],
  "3:2": ["1536x1024", "2048x1360", "3520x2336"],
  "2:3": ["1024x1536", "1360x2048", "2336x3520"],
  "4:3": ["1024x768", "2048x1536", "3312x2480"],
  "3:4": ["768x1024", "1536x2048", "2480x3312"],
  "5:4": ["1280x1024", "2560x2048", "3216x2576"],
  "4:5": ["1024x1280", "2048x2560", "2576x3216"],
  "16:9": ["1536x864", "2048x1152", "3840x2160"],
  "9:16": ["864x1536", "1152x2048", "2160x3840"],
  "2:1": ["2048x1024", "2688x1344", "3840x1920"],
  "1:2": ["1024x2048", "1344x2688", "1920x3840"],
  "21:9": ["2016x864", "2688x1152", "3840x1648"],
  "9:21": ["864x2016", "1152x2688", "1648x3840"],
  "3:1": ["1536x512", "3072x1024", "3840x1280"],
  "1:3": ["512x1536", "1024x3072", "1280x3840"]
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function previewText(value: string, max = 500): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function isValidImageUrl(value: string): boolean {
  if (value.startsWith("data:")) {
    return /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(value);
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeImageUrls(imageUrls?: string[]): string[] {
  return Array.from(new Set((imageUrls ?? [])
    .map((item) => item.trim())
    .filter(isValidImageUrl)))
    .slice(0, MAX_REFERENCE_IMAGES);
}

function normalizeQuality(value?: string): "low" | "medium" | "high" | "auto" {
  const normalized = value?.trim().toLowerCase();
  return normalized === "medium" || normalized === "high" || normalized === "auto" ? normalized : "low";
}

export function openrouterAspectRatio(value: string): string {
  const normalized = value.trim().toLowerCase() || "1:1";
  if (normalized === "auto") return "auto";
  if (Object.hasOwn(IMAGE_SIZES, normalized)) return normalized;
  if (normalized === "5:7") return "3:4";
  if (normalized === "7:5") return "4:3";
  return "1:1";
}

function normalizeResolution(value?: string): Resolution {
  const normalized = value?.trim().toLowerCase() || "1k";
  if (normalized !== "1k" && normalized !== "2k" && normalized !== "4k") {
    throw new Error(`OpenRouter GPT Image 2.5 Flare received unsupported resolution: ${normalized}.`);
  }
  return normalized;
}

export function isOpenrouterImageResolutionSupported(value?: string): boolean {
  const normalized = value?.trim().toLowerCase() || "1k";
  return normalized === "1k" || normalized === "2k" || normalized === "4k";
}

export function buildOpenrouterImagePayload(input: GenerateOpenrouterImagesInput): Record<string, unknown> {
  const resolution = normalizeResolution(input.resolution);
  const config = appConfig.image.openrouter;
  const flareExperiment = isGptImage25ModelExperiment(input);
  const model = resolveOpenrouterImageModel(input);
  const prompt = limitImageModelPrompt(input.visibleTextLanguage
    ? applyVisibleTextLanguageConstraint({ prompt: input.prompt, language: input.visibleTextLanguage })
    : input.prompt);
  const imageUrls = normalizeImageUrls(input.imageUrls);
  const requestedRatio = openrouterAspectRatio(input.aspectRatio);
  const referenceRatio = input.referenceAspectRatio?.trim().toLowerCase();
  const aspectRatio = requestedRatio === "auto"
    ? referenceRatio && (Object.hasOwn(IMAGE_SIZES, referenceRatio) || referenceRatio === "5:7" || referenceRatio === "7:5")
      ? openrouterAspectRatio(referenceRatio)
      : recommendedWorkbenchImageRatio(input.sourceUseCase)
    : requestedRatio;
  const payload: Record<string, unknown> = {
    model,
    prompt,
    quality: flareExperiment ? flareExperimentQuality(resolution)
      : /^openai\/gpt-image-2\.5-(?:flare|sunburst)$/.test(model.toLowerCase()) && resolution === "1k"
        ? "medium" : normalizeQuality(input.quality ?? config.quality),
    size: IMAGE_SIZES[aspectRatio][resolution === "4k" ? 2 : resolution === "2k" ? 1 : 0],
    n: Math.max(1, Math.min(4, Math.round(input.n)))
  };

  if (input.background) payload.background = input.background;
  if (input.background === "transparent") payload.output_format = "png";
  else if (input.outputFormat) payload.output_format = input.outputFormat;

  if (imageUrls.length) {
    payload.input_references = imageUrls.map((url) => ({
      type: "image_url",
      image_url: { url }
    }));
  }

  return payload;
}

function toDataUrl(base64: string, mediaType?: string): string {
  const normalized = base64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "").trim();
  return `data:${mediaType?.startsWith("image/") ? mediaType : "image/png"};base64,${normalized}`;
}

export function extractOpenrouterImageUrls(payload: unknown): string[] {
  const record = asRecord(payload);
  const data = Array.isArray(record?.data) ? record.data : [];
  return Array.from(new Set(data.flatMap((item) => {
    const image = asRecord(item);
    const url = typeof image?.url === "string" ? image.url.trim() : "";
    const base64 = typeof image?.b64_json === "string" ? image.b64_json.trim() : "";
    if (url && isValidImageUrl(url)) return [url];
    if (base64) return [toDataUrl(base64, typeof image?.media_type === "string" ? image.media_type : undefined)];
    return [];
  })));
}

export function isOpenrouterImageConfigured(): boolean {
  const config = appConfig.image.openrouter;
  return Boolean(config.apiUrl && config.apiKey && config.model);
}

function isImageSafetyOrPolicyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  return (
    normalized.includes("moderation_blocked")
    || normalized.includes("safety_violations")
    || normalized.includes("image_generation_user_error")
    || normalized.includes("rejected by the safety system")
    || normalized.includes("sexually explicit")
    || normalized.includes("pornographic")
    || normalized.includes("invalid_reference_image")
    || normalized.includes("reference image safety")
    || normalized.includes("nsfw")
    || normalized.includes("nudity")
    || normalized.includes("违反平台政策")
    || normalized.includes("违规")
    || normalized.includes("色情")
  );
}

export function isOpenrouterErrorEligibleForApimartFallback(error: unknown, resolution?: string): boolean {
  return resolveImageFallbackProvider(resolution) === "apimart" && !isImageSafetyOrPolicyError(error);
}

export function isOpenrouterImageTaskId(taskId: string): boolean {
  return taskId.startsWith(OPENROUTER_TASK_PREFIX);
}

export function createOpenrouterDeferredImageTask(input: GenerateOpenrouterImagesInput): SubmittedOpenrouterImageTask {
  const model = resolveOpenrouterImageModel(input);
  normalizeResolution(input.resolution);
  return {
    taskId: `${OPENROUTER_TASK_PREFIX}${randomUUID()}`,
    provider: `openrouter:${model}`,
    model
  };
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5_000, timeoutMs));
  try {
    return await fetch(input, { ...init, signal: controller.signal, cache: "no-store" });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`OpenRouter GPT Image 2 timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function dataUrlSizeBytes(url: string): number {
  const separator = url.indexOf(",");
  if (separator < 0) return 0;
  const payload = url.slice(separator + 1).replace(/\s+/g, "");
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor(payload.length * 3 / 4) - padding);
}

function trustedReferenceImageOrigins(): Set<string> {
  const origins = new Set<string>();
  for (const value of [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL]) {
    if (!value?.trim()) continue;
    try {
      origins.add(new URL(value).origin);
    } catch {
      // Ignore malformed optional configuration.
    }
  }
  return origins;
}

function shouldMaterializeReferenceImageUrl(url: string): boolean {
  try {
    return trustedReferenceImageOrigins().has(new URL(url).origin);
  } catch {
    return false;
  }
}

async function materializeReferenceImageUrl(url: string, timeoutMs: number): Promise<{
  url: string;
  sizeBytes: number;
}> {
  if (url.startsWith("data:")) {
    const sizeBytes = dataUrlSizeBytes(url);
    if (!sizeBytes) throw new Error("OpenRouter reference image data URL is empty or invalid.");
    if (sizeBytes > MAX_REFERENCE_IMAGE_BYTES) {
      throw new Error(`OpenRouter reference image exceeds ${MAX_REFERENCE_IMAGE_BYTES} bytes.`);
    }
    return { url, sizeBytes };
  }

  // Let OpenRouter fetch arbitrary public URLs. Only materialize our own storage URLs
  // server-side so user-controlled URLs cannot reach private or link-local services.
  if (!shouldMaterializeReferenceImageUrl(url)) return { url, sizeBytes: 0 };

  const response = await fetchWithTimeout(url, {
    method: "GET",
    headers: { Accept: "image/*" },
    redirect: "error"
  }, Math.min(Math.max(5_000, timeoutMs), 30_000));
  if (!response.ok) {
    throw new Error(`OpenRouter reference image download failed: ${response.status} ${previewText(await response.text())}`);
  }

  const mediaType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() || "";
  if (!mediaType.startsWith("image/")) {
    throw new Error(`OpenRouter reference image download returned unsupported content type: ${mediaType || "unknown"}`);
  }
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > MAX_REFERENCE_IMAGE_BYTES) {
    throw new Error(`OpenRouter reference image exceeds ${MAX_REFERENCE_IMAGE_BYTES} bytes.`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error("OpenRouter reference image download returned an empty file.");
  if (bytes.length > MAX_REFERENCE_IMAGE_BYTES) {
    throw new Error(`OpenRouter reference image exceeds ${MAX_REFERENCE_IMAGE_BYTES} bytes.`);
  }
  return {
    url: `data:${mediaType};base64,${bytes.toString("base64")}`,
    sizeBytes: bytes.length
  };
}

async function materializeReferenceImageUrls(imageUrls: string[] | undefined, timeoutMs: number): Promise<string[]> {
  const materialized: string[] = [];
  let totalSizeBytes = 0;
  for (const url of normalizeImageUrls(imageUrls)) {
    const image = await materializeReferenceImageUrl(url, timeoutMs);
    totalSizeBytes += image.sizeBytes;
    if (totalSizeBytes > MAX_TOTAL_REFERENCE_IMAGE_BYTES) {
      throw new Error(`OpenRouter reference images exceed ${MAX_TOTAL_REFERENCE_IMAGE_BYTES} total bytes.`);
    }
    materialized.push(image.url);
  }
  return materialized;
}

export async function generateOpenrouterGptImages(input: GenerateOpenrouterImagesInput): Promise<{
  imageUrls: string[];
  provider: string;
  model: string;
}> {
  const config = appConfig.image.openrouter;
  if (!config.apiKey) throw new Error("OPENROUTER_API_KEY is missing");
  if (!config.apiUrl) throw new Error("OPENROUTER_IMAGE_API_URL is missing");

  const materializedImageUrls = await materializeReferenceImageUrls(input.imageUrls, config.timeoutMs);
  const payload = buildOpenrouterImagePayload({ ...input, imageUrls: materializedImageUrls });
  const model = String(payload.model || DEFAULT_MODEL);
  const startedAt = Date.now();
  console.info("[OpenRouter] GPT Image 2 generation start", {
    model,
    aspectRatio: input.aspectRatio,
    size: payload.size,
    resolution: (input.resolution?.trim() || "1k").toUpperCase(),
    quality: payload.quality,
    n: payload.n,
    referenceImageCount: Array.isArray(payload.input_references) ? payload.input_references.length : 0,
    promptPreview: previewText(input.prompt, 220)
  });

  const response = await fetchWithTimeout(
    `${config.apiUrl}/images`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(appConfig.llm.httpReferer ? { "HTTP-Referer": appConfig.llm.httpReferer } : {}),
        ...(appConfig.llm.xTitle ? { "X-Title": appConfig.llm.xTitle } : {})
      },
      body: JSON.stringify(payload)
    },
    config.timeoutMs
  );
  const text = await response.text();
  let responsePayload: unknown = {};
  try {
    responsePayload = JSON.parse(text);
  } catch {
    // Keep the raw response available in the error below.
  }
  if (!response.ok) {
    const errorRecord = asRecord(asRecord(responsePayload)?.error);
    const providerMessage = typeof errorRecord?.message === "string" ? errorRecord.message : text;
    const error = new Error(`OpenRouter GPT Image 2 failed: ${response.status} ${previewText(providerMessage)}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  const imageUrls = extractOpenrouterImageUrls(responsePayload);
  if (!imageUrls.length) {
    throw new Error(`OpenRouter GPT Image 2 returned no images: ${previewText(text)}`);
  }
  const usage = asRecord(asRecord(responsePayload)?.usage);
  console.info("[OpenRouter] GPT Image 2 generation success", {
    model,
    imageCount: imageUrls.length,
    provider: `openrouter:${model}`,
    durationMs: Date.now() - startedAt,
    costUsd: typeof usage?.cost === "number" ? usage.cost : undefined
  });
  return {
    imageUrls: imageUrls.slice(0, Math.max(1, Math.min(4, Math.round(input.n)))),
    provider: `openrouter:${model}`,
    model
  };
}
