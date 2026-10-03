import { appConfig, resolveImageFallbackProvider } from "@/lib/config";
import { isImageGenerationSafetyErrorMessage } from "@/lib/images/image-safety-error";
import { limitImageModelPrompt } from "@/lib/images/prompt-limit";
import { applyVisibleTextLanguageConstraint } from "@/lib/socialmedia/visible-text-language";

export type GenerateVectorengineImagesInput = {
  model?: string;
  prompt: string;
  visibleTextLanguage?: string;
  aspectRatio: string;
  resolution?: string;
  quality?: string;
  imageUrls?: string[];
  n: number;
};

export type SubmittedVectorengineImageTask = {
  taskId: string;
  provider: string;
  model: string;
};

type DeferredVectorengineTaskPayload = {
  v: 1;
  model?: string;
  prompt: string;
  visibleTextLanguage?: string;
  aspectRatio: string;
  resolution?: string;
  quality?: string;
  imageUrls?: string[];
  n: number;
};

const VECTORENGINE_TASK_PREFIX = "vectorengine:";
const MAX_REFERENCE_IMAGES = 16;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function previewText(value: string, max = 280): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function normalizeEnum(value: string | undefined, allowed: string[], fallback: string): string {
  const normalized = value?.trim().toLowerCase();
  return normalized && allowed.includes(normalized) ? normalized : fallback;
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

function toDataUrl(b64Json: string, format = "png"): string {
  const normalizedFormat = normalizeEnum(format, ["png", "jpeg", "webp"], "png");
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

  if (typeof record.b64_json === "string" && record.b64_json.trim()) {
    imageUrls.push(toDataUrl(record.b64_json, outputFormat));
  }
}

export function extractVectorengineImageUrls(payload: unknown, outputFormat = "png"): string[] {
  const imageUrls: string[] = [];
  const record = asRecord(payload);

  collectImageUrlsFromUnknown(record?.data, outputFormat, imageUrls);
  collectImageUrlsFromUnknown(record?.images, outputFormat, imageUrls);
  collectImageUrlsFromUnknown(record, outputFormat, imageUrls);

  return Array.from(new Set(imageUrls));
}

function parseAspectRatio(aspectRatio: string): { widthRatio: number; heightRatio: number } {
  const normalized = aspectRatio.trim().toLowerCase();
  if (normalized === "auto") return { widthRatio: 1, heightRatio: 1 };

  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  if (!match) return { widthRatio: 1, heightRatio: 1 };

  const widthRatio = Number(match[1]);
  const heightRatio = Number(match[2]);
  if (!Number.isFinite(widthRatio) || !Number.isFinite(heightRatio) || widthRatio <= 0 || heightRatio <= 0) {
    return { widthRatio: 1, heightRatio: 1 };
  }

  return { widthRatio, heightRatio };
}

function roundToMultipleOf16(value: number): number {
  return Math.max(16, Math.round(value / 16) * 16);
}

export function vectorengineSizeForAspectRatio(params: {
  aspectRatio: string;
  resolution?: string;
}): string {
  const normalizedRatio = params.aspectRatio.trim().toLowerCase();
  const normalizedResolution = params.resolution?.trim().toLowerCase() || "1k";

  if (normalizedRatio === "1:1") {
    return normalizedResolution === "2k" || normalizedResolution === "4k" ? "2048x2048" : "1024x1024";
  }
  if (normalizedRatio === "16:9") {
    if (normalizedResolution === "4k") return "3840x2160";
    if (normalizedResolution === "2k") return "2048x1152";
    return "1536x864";
  }
  if (normalizedRatio === "9:16") {
    if (normalizedResolution === "4k") return "2160x3840";
    if (normalizedResolution === "2k") return "1152x2048";
    return "864x1536";
  }
  if (normalizedRatio === "3:2") return normalizedResolution === "2k" ? "1536x1024" : "1536x1024";
  if (normalizedRatio === "2:3") return normalizedResolution === "2k" ? "1024x1536" : "1024x1536";

  const { widthRatio, heightRatio } = parseAspectRatio(params.aspectRatio);
  const useTwoK = normalizedResolution === "2k" || normalizedResolution === "4k";
  const longSide = useTwoK ? 2048 : 1536;
  const ratio = widthRatio / heightRatio;
  const width = ratio >= 1 ? longSide : longSide * ratio;
  const height = ratio >= 1 ? longSide / ratio : longSide;
  return `${roundToMultipleOf16(width)}x${roundToMultipleOf16(height)}`;
}

export function buildVectorengineGenerationPayload(params: GenerateVectorengineImagesInput): Record<string, unknown> {
  const { vectorengine, apimart } = appConfig.image;
  const prompt = limitImageModelPrompt(params.visibleTextLanguage
    ? applyVisibleTextLanguageConstraint({
        prompt: params.prompt,
        language: params.visibleTextLanguage
      })
    : params.prompt);
  return {
    model: params.model?.trim() || vectorengine.model || "gpt-image-2",
    prompt,
    n: Math.max(1, Math.min(4, Math.round(params.n))),
    size: vectorengineSizeForAspectRatio({
      aspectRatio: params.aspectRatio,
      resolution: params.resolution
    }),
    quality: normalizeEnum(params.quality ?? apimart.quality, ["auto", "low", "medium", "high"], "high"),
    format: normalizeEnum(apimart.outputFormat, ["png", "jpeg", "webp"], "png")
  };
}

function requireVectorengineConfig(): { apiUrl: string; apiKey: string; model: string; timeoutMs: number } {
  const { vectorengine } = appConfig.image;
  if (!vectorengine.fallbackEnabled) {
    throw new Error("VECTORENGINE_IMAGE_FALLBACK_ENABLED is disabled");
  }
  if (!vectorengine.apiKey) {
    throw new Error("VECTORENGINE_IMAGE_API_KEY is missing");
  }
  return {
    apiUrl: vectorengine.apiUrl,
    apiKey: vectorengine.apiKey,
    model: vectorengine.model || "gpt-image-2",
    timeoutMs: Math.max(5000, Number(vectorengine.timeoutMs) || 240000)
  };
}

export function isVectorengineImageFallbackConfigured(): boolean {
  const { vectorengine } = appConfig.image;
  return Boolean(vectorengine.fallbackEnabled && vectorengine.apiKey && vectorengine.apiUrl);
}

export function isVectorengineErrorEligibleForHfsyapiFallback(error: unknown): boolean {
  if (appConfig.image.fallbackProvider !== "hfsyapi") return false;
  if (!appConfig.image.hfsyapi.apiKey || !appConfig.image.hfsyapi.apiUrl) return false;

  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  if (
    normalized.includes("moderation_blocked")
    || normalized.includes("safety_violations")
    || normalized.includes("image_generation_user_error")
    || normalized.includes("your request was rejected by the safety system")
    || normalized.includes("invalid_reference_image")
    || normalized.includes("参考图解析失败")
    || normalized.includes("违反平台政策")
  ) {
    return false;
  }

  const status = Number((error as { status?: unknown } | null)?.status);
  if (Number.isFinite(status) && (status === 408 || status === 409 || status === 425 || status === 429 || status >= 500)) {
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

function inferMimeType(response: Response, url: string): string {
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType?.startsWith("image/")) return contentType;
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
    if (pathname.endsWith(".webp")) return "image/webp";
    if (pathname.endsWith(".gif")) return "image/gif";
  } catch {
    // Data URLs normally provide a content-type header through fetch.
  }
  return "image/png";
}

async function downloadReferenceImage(url: string, timeoutMs: number, index: number): Promise<{
  blob: Blob;
  filename: string;
}> {
  const response = await fetchWithTimeout(
    url,
    { method: "GET", cache: "no-store" },
    timeoutMs,
    `VectorEngine reference image download timed out after ${timeoutMs}ms`
  );
  if (!response.ok) {
    throw new Error(`VectorEngine reference image download failed: ${response.status} ${response.statusText}`);
  }

  const mimeType = inferMimeType(response, url);
  const buffer = await response.arrayBuffer();
  if (!buffer.byteLength) {
    throw new Error("VectorEngine reference image download returned an empty file");
  }
  const ext = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1]?.replace(/\+.*/, "") || "png";
  return {
    blob: new Blob([buffer], { type: mimeType }),
    filename: `reference-${index + 1}.${ext}`
  };
}

async function postVectorengineGenerations(input: GenerateVectorengineImagesInput): Promise<{
  imageUrls: string[];
  provider: string;
  model: string;
}> {
  const config = requireVectorengineConfig();
  const payload = buildVectorengineGenerationPayload({
    ...input,
    model: input.model || config.model
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
    `VectorEngine image generation timed out after ${config.timeoutMs}ms`
  );
  const { payload: responsePayload, text } = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(`VectorEngine image generation failed: ${response.status} ${previewText(text)}`);
  }

  const outputFormat = typeof payload.format === "string" ? payload.format : "png";
  const imageUrls = extractVectorengineImageUrls(responsePayload, outputFormat);
  if (!imageUrls.length) {
    throw new Error(`VectorEngine image generation returned no images: ${previewText(text)}`);
  }

  const model = String(payload.model || config.model);
  return {
    imageUrls: imageUrls.slice(0, Math.max(1, Math.min(4, Math.round(input.n)))),
    provider: `vectorengine:${model}`,
    model
  };
}

async function postVectorengineEdits(input: GenerateVectorengineImagesInput, imageUrls: string[]): Promise<{
  imageUrls: string[];
  provider: string;
  model: string;
}> {
  const config = requireVectorengineConfig();
  const payload = buildVectorengineGenerationPayload({
    ...input,
    model: input.model || config.model
  });
  const form = new FormData();
  form.set("model", String(payload.model));
  form.set("prompt", input.prompt);
  form.set("n", String(payload.n));
  form.set("quality", String(payload.quality));
  form.set("size", String(payload.size));

  for (const [index, imageUrl] of imageUrls.entries()) {
    const image = await downloadReferenceImage(imageUrl, config.timeoutMs, index);
    form.append("image", image.blob, image.filename);
  }

  const response = await fetchWithTimeout(
    `${config.apiUrl}/v1/images/edits`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json"
      },
      body: form,
      cache: "no-store"
    },
    config.timeoutMs,
    `VectorEngine image edit timed out after ${config.timeoutMs}ms`
  );
  const { payload: responsePayload, text } = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(`VectorEngine image edit failed: ${response.status} ${previewText(text)}`);
  }

  const outputFormat = typeof payload.format === "string" ? payload.format : "png";
  const outputImageUrls = extractVectorengineImageUrls(responsePayload, outputFormat);
  if (!outputImageUrls.length) {
    throw new Error(`VectorEngine image edit returned no images: ${previewText(text)}`);
  }

  const model = String(payload.model || config.model);
  return {
    imageUrls: outputImageUrls.slice(0, Math.max(1, Math.min(4, Math.round(input.n)))),
    provider: `vectorengine:${model}`,
    model
  };
}

export async function generateVectorengineGptImages(input: GenerateVectorengineImagesInput): Promise<{
  imageUrls: string[];
  provider: string;
  model: string;
}> {
  const imageUrls = normalizeImageUrls(input.imageUrls);
  console.info("[VectorEngine] Fallback image generation start", {
    model: input.model || appConfig.image.vectorengine.model,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
    n: input.n,
    referenceImageCount: imageUrls.length,
    promptPreview: previewText(input.prompt, 220)
  });

  const result = imageUrls.length
    ? await postVectorengineEdits(input, imageUrls)
    : await postVectorengineGenerations(input);

  console.info("[VectorEngine] Fallback image generation success", {
    model: result.model,
    imageCount: result.imageUrls.length,
    provider: result.provider
  });
  return result;
}

function encodeTaskPayload(payload: DeferredVectorengineTaskPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function isVectorengineImageTaskId(taskId: string): boolean {
  return taskId.startsWith(VECTORENGINE_TASK_PREFIX);
}

export function createVectorengineDeferredImageTask(input: GenerateVectorengineImagesInput): SubmittedVectorengineImageTask {
  const model = input.model?.trim() || appConfig.image.vectorengine.model || "gpt-image-2";
  const payload: DeferredVectorengineTaskPayload = {
    v: 1,
    model,
    prompt: input.prompt,
    visibleTextLanguage: input.visibleTextLanguage,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
    quality: input.quality,
    imageUrls: normalizeImageUrls(input.imageUrls),
    n: Math.max(1, Math.min(4, Math.round(input.n)))
  };

  return {
    taskId: `${VECTORENGINE_TASK_PREFIX}${encodeTaskPayload(payload)}`,
    provider: `vectorengine:${model}`,
    model
  };
}

export function isApimartErrorEligibleForVectorengineFallback(error: unknown): boolean {
  if (appConfig.image.fallbackProvider !== "vectorengine") return false;
  if (!isVectorengineImageFallbackConfigured()) return false;

  return isApimartErrorEligibleForImageProviderFallback(error);
}

export function isApimartErrorEligibleForConfiguredImageFallback(error: unknown, resolution?: string): boolean {
  const fallbackProvider = resolveImageFallbackProvider(resolution);
  if (fallbackProvider === "openrouter") {
    if (!appConfig.image.openrouter.apiKey || !appConfig.image.openrouter.apiUrl) return false;
    return isApimartErrorEligibleForImageProviderFallback(error);
  }
  if (fallbackProvider === "vectorengine") {
    if (!isVectorengineImageFallbackConfigured()) return false;
    return isApimartErrorEligibleForImageProviderFallback(error);
  }
  if (fallbackProvider === "hfsyapi") {
    if (!appConfig.image.hfsyapi.apiKey || !appConfig.image.hfsyapi.apiUrl) return false;
    return isApimartErrorEligibleForImageProviderFallback(error);
  }
  if (fallbackProvider === "toapis") {
    if (!appConfig.image.toapis.apiKey || !appConfig.image.toapis.apiUrl) return false;
    return isApimartErrorEligibleForImageProviderFallback(error);
  }
  return false;
}

function isImageSafetyOrPolicyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (isImageGenerationSafetyErrorMessage(message)) return true;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("sexually explicit")
    || normalized.includes("pornographic")
    || normalized.includes("sexual acts or nudity")
    || normalized.includes("cannot create or modify images with sexual")
    || normalized.includes("cannot create sexually")
    || normalized.includes("invalid_reference_image")
    || normalized.includes("reference image safety")
    || normalized.includes("unsafe")
    || normalized.includes("nsfw")
    || normalized.includes("nudity")
    || normalized.includes("nude")
    || normalized.includes("erotic")
    || normalized.includes("参考图解析失败")
    || normalized.includes("违规")
    || normalized.includes("色情")
    || normalized.includes("涉黄")
  );
}

export function isApimartErrorEligibleForImageProviderFallback(error: unknown): boolean {
  if (isImageSafetyOrPolicyError(error)) {
    return false;
  }

  return true;
}
