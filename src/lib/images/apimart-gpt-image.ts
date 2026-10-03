import { flareExperimentQuality, isGptImage25ModelExperiment, parseImageModelExperimentVariant, type ImageModelExperimentVariant } from "@/lib/socialmedia/image-model-experiment";
import { appConfig, resolveImageFallbackProvider } from "@/lib/config";
import { isImageGenerationSafetyErrorMessage } from "@/lib/images/image-safety-error";
import { buildFallbackGradientUrl } from "@/lib/images/nano-banana.openrouter";
import { limitImageModelPrompt } from "@/lib/images/prompt-limit";
import {
  createVectorengineDeferredImageTask,
  generateVectorengineGptImages,
  isApimartErrorEligibleForConfiguredImageFallback,
  isApimartErrorEligibleForImageProviderFallback,
  isApimartErrorEligibleForVectorengineFallback,
  isVectorengineErrorEligibleForHfsyapiFallback,
  isVectorengineImageFallbackConfigured,
  isVectorengineImageTaskId
} from "@/lib/images/vectorengine-gpt-image";
import {
  createHfsyapiDeferredImageTask,
  generateHfsyapiGptImages,
  isHfsyapiImageConfigured,
  isHfsyapiErrorEligibleForVectorengineFallback,
  isHfsyapiImageTaskId
} from "@/lib/images/hfsyapi-gpt-image";
import {
  generateToapisGptImages,
  isToapisImageConfigured,
  isToapisImageTaskId,
  pollToapisGptImageTask,
  submitToapisGptImages
} from "@/lib/images/toapis-gpt-image";
import {
  createOpenrouterDeferredImageTask,
  resolveOpenrouterImageModel,
  generateOpenrouterGptImages,
  isOpenrouterErrorEligibleForApimartFallback,
  isOpenrouterImageConfigured,
  isOpenrouterImageResolutionSupported,
  isOpenrouterImageTaskId
} from "@/lib/images/openrouter-gpt-image";
import { applyVisibleTextLanguageConstraint } from "@/lib/socialmedia/visible-text-language";
import type { AspectRatio } from "@/lib/types/skills";

const APIMART_DEBUG_TIMINGS_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.SOCIALMEDIA_DEBUG_TIMINGS === "1";
const APIMART_GPT_IMAGE_2_OFFICIAL_MODEL = "gpt-image-2-official";
export const APIMART_GPT_IMAGE_25_FLARE_MODEL = "gpt-image-2.5-flare";
function isGptImage25Model(model?: string): boolean { return /^gpt-image-2\.5-(?:flare|sunburst)$/.test(model?.trim().toLowerCase() ?? ""); }
const APIMART_NANO_BANANA_PRO_MODELS = new Set([
  "nano-banana-pro-ext",
  "nano-banana-pro",
  "gemini-3-pro-image-preview",
  "gemini-3-pro-image-preview-official"
]);

type GenerateApimartImageInput = {
  prompt: string;
  aspectRatio: AspectRatio;
  negativePrompt: string;
  seed?: number;
  textOnImage?: boolean;
  lockedTexts?: string[];
};

export type GenerateApimartImagesInput = {
  experimentModel?: ImageModelExperimentVariant;
  sourceUseCase?: string;
  requireAllReferenceImages?: boolean;
  maskUrl?: string;
  model?: string;
  prompt: string;
  background?: "auto" | "transparent";
  /** Optional per-request override; omitted callers keep the configured format. */
  outputFormat?: "png" | "jpeg";
  visibleTextLanguage?: string;
  aspectRatio: string;
  resolution?: string;
  allowResolutionDowngrade?: boolean;
  quality?: string;
  imageUrls?: string[];
  /** Passed through only when TOAPIS VIP is selected as the active provider. */
  referenceAspectRatio?: string;
  n: number;
  onPayloadBuilt?: (payload: Record<string, unknown>) => void;
  onTaskSubmitted?: (taskId: string) => void;
  onSubmitAttemptFailed?: (failure: {
    provider?: "apimart" | "toapis";
    attempt: number;
    maxAttempts: number;
    model: string;
    statusCode?: number;
    errorMessage: string;
    rawErrorMessage: string;
    willRetry: boolean;
    willFallback: boolean;
  }) => void;
};

export type SubmittedApimartImageTask = {
  taskId: string;
  provider: string;
  model: string;
  fallbackSourceProvider?: string;
  fallbackSourceError?: string;
  fallbackSourceStatusCode?: number;
};

export type ApimartImageTaskPollResult =
  | {
      status: "pending";
      provider: string;
      model: string;
      taskStatus?: string;
    }
  | {
      status: "completed";
      provider: string;
      model: string;
      imageUrls: string[];
      taskStatus?: string;
    }
  | {
      status: "failed";
      provider: string;
      model: string;
      error: string;
      taskStatus?: string;
    };

type ImageGenerationResult = {
  imageUrl: string;
  usedFallback: boolean;
  provider: string;
  error?: string;
};

type SubmitApimartGenerationParams = {
  experimentModel?: ImageModelExperimentVariant;
  model: string;
  prompt: string;
  background?: "auto" | "transparent";
  outputFormat?: "png" | "jpeg";
  visibleTextLanguage?: string;
  aspectRatio: string;
  resolution?: string;
  quality?: string;
  imageUrls?: string[];
  n: number;
  headers: Record<string, string>;
  onPayloadBuilt?: (payload: Record<string, unknown>) => void;
  onTaskSubmitted?: (taskId: string) => void;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function previewPrompt(prompt: string, max = 220): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function assertApimartImageUrlsAreStrings(payload: Record<string, unknown>): void {
  if (payload.image_urls === undefined) return;
  if (!Array.isArray(payload.image_urls) || payload.image_urls.some((item) => typeof item !== "string")) {
    throw new Error("APIMart image_urls must be an array of URL strings.");
  }
}

function normalizeLockedTexts(values: string[]): string[] {
  const normalized = values
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length > 0)
    .filter((item) => /[\p{L}\p{N}]/u.test(item));
  return Array.from(new Set(normalized)).slice(0, 12);
}

function inferLockedTextsFromPrompt(prompt: string): string[] {
  const candidates: string[] = [];
  const quotedPatterns = [/"([^"\n]{2,280})"/g, /“([^”\n]{2,280})”/g, /'([^'\n]{2,280})'/g];

  for (const pattern of quotedPatterns) {
    let match: RegExpExecArray | null = pattern.exec(prompt);
    while (match) {
      if (match[1]) {
        candidates.push(match[1]);
      }
      match = pattern.exec(prompt);
    }
  }

  return normalizeLockedTexts(candidates);
}

function buildFinalPrompt({
  prompt,
  aspectRatio,
  negativePrompt,
  textOnImage = false,
  lockedTexts = []
}: GenerateApimartImageInput): string {
  const effectiveLockedTexts = textOnImage
    ? normalizeLockedTexts([...lockedTexts, ...inferLockedTextsFromPrompt(prompt)])
    : [];

  const textLockRequirement = textOnImage && effectiveLockedTexts.length
    ? [
        "Text lock requirement: render each exact text line exactly character-by-character.",
        "Do not translate, paraphrase, summarize, truncate, add, delete, normalize punctuation, or change capitalization/line order.",
        "Do not render any extra text beyond the exact text lines provided below.",
        "Use each exact text line at most once within the image; never duplicate a locked text line on multiple cards or regions.",
        "Never render labels like LOCKED_TEXT, LOCKED_TEXT_1, TEXT_LOCK, or any placeholder token names.",
        "Never render hexadecimal color strings (for example #22d3ee) or palette legend labels.",
        "Exact text lines:",
        ...effectiveLockedTexts.map((item) => `- ${item}`)
      ].join("\n")
    : "";

  const outputRequirement = textOnImage
    ? "Render exact text lines prominently when they are provided."
    : "Output requirement: image-only background for text overlay. Include clean copy space in composition.";

  return [
    prompt,
    `Aspect ratio: ${aspectRatio}.`,
    outputRequirement,
    textLockRequirement,
    `Negative constraints: ${negativePrompt}.`
  ].filter(Boolean).join("\n");
}

function isValidAbsoluteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "data:";
  } catch {
    return false;
  }
}

function previewError(value: string, max = 1000): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorStatusCode(error: unknown): number | undefined {
  const status = Number(asRecord(error)?.status ?? asRecord(error)?.code);
  return Number.isFinite(status) ? status : undefined;
}

function isFetchFailedError(error: unknown): boolean {
  return /^(typeerror:\s*)?fetch failed$/i.test(errorMessage(error).trim());
}

function createImageProviderFallbackFailureError(params: {
  primaryProvider: string;
  primaryError: unknown;
  fallbackProvider: string;
  fallbackError: unknown;
}): Error {
  const error = new Error(
    `${params.primaryProvider} image submission failed after retries: ${previewError(errorMessage(params.primaryError), 1000)}; `
    + `${params.fallbackProvider} fallback also failed: ${previewError(errorMessage(params.fallbackError), 1000)}`
  );
  const status = errorStatusCode(params.fallbackError) ?? errorStatusCode(params.primaryError);
  if (status !== undefined) (error as Error & { status?: number }).status = status;
  (error as Error & { cause?: unknown }).cause = params.fallbackError;
  return error;
}

function isBillingLimitProviderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  return (
    normalized.includes("billing_hard_limit_reached")
    || normalized.includes("billing_limit_user_error")
    || normalized.includes("billing hard limit has been reached")
  );
}

export function isToapisErrorEligibleForApimartFallback(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (isImageGenerationSafetyErrorMessage(message)) return false;
  return !message.toLowerCase().includes("违规");
}

function isTransientApimartError(error: unknown): boolean {
  const record = asRecord(error);
  const status = Number(record?.status ?? record?.code);
  if (Number.isFinite(status) && (status === 408 || status === 409 || status === 425 || status === 429 || status >= 500)) {
    return true;
  }

  const message = String(record?.message ?? error ?? "").toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("socket hang up") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("eai_again") ||
    message.includes("enotfound")
  );
}

export function isTransientApimartTaskError(error: unknown): boolean {
  return isTransientApimartError(error);
}

function extractApimartErrorMessage(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  const record = asRecord(value);
  if (!record) return undefined;

  const nestedError = extractApimartErrorMessage(record.error);
  const nestedMessage = extractApimartErrorMessage(record.message);
  const parts = [
    nestedError,
    nestedMessage,
    typeof record.code === "string" ? record.code : undefined,
    typeof record.type === "string" ? record.type : undefined,
    Array.isArray(record.safety_violations) ? `safety_violations=${record.safety_violations.join(",")}` : undefined
  ].filter((item): item is string => Boolean(item?.trim()));

  if (parts.length) {
    return Array.from(new Set(parts)).join(" ");
  }

  try {
    return previewError(JSON.stringify(record));
  } catch {
    return undefined;
  }
}

export function extractApimartTaskId(payload: unknown): string | null {
  const record = asRecord(payload);
  const data = record?.data;
  const first = Array.isArray(data) ? asRecord(data[0]) : asRecord(data);
  const taskId = first?.task_id ?? first?.taskId ?? first?.id;
  return typeof taskId === "string" && taskId.trim() ? taskId.trim() : null;
}

export function extractApimartCompletedImageUrl(payload: unknown): {
  imageUrl?: string;
  status?: string;
  error?: string;
} {
  const imageUrls = extractApimartCompletedImageUrls(payload).imageUrls;
  const base = extractApimartCompletedImageUrls(payload);
  return {
    imageUrl: imageUrls[0],
    status: base.status,
    error: base.error
  };
}

export function extractApimartCompletedImageUrls(payload: unknown): {
  imageUrls: string[];
  status?: string;
  error?: string;
} {
  const record = asRecord(payload);
  const data = asRecord(record?.data);
  const status = typeof data?.status === "string" ? data.status : undefined;
  const message = extractApimartErrorMessage(data?.error)
    ?? extractApimartErrorMessage(data?.message)
    ?? extractApimartErrorMessage(record?.error)
    ?? extractApimartErrorMessage(record?.message);

  const images = asRecord(data?.result)?.images;
  const imageUrls: string[] = [];
  if (Array.isArray(images)) {
    for (const image of images) {
      const imageRecord = asRecord(image);
      const urls = imageRecord?.url;
      if (Array.isArray(urls)) {
        imageUrls.push(...urls.filter((item): item is string => typeof item === "string" && isValidAbsoluteUrl(item)));
      }
      if (typeof urls === "string" && isValidAbsoluteUrl(urls)) {
        imageUrls.push(urls);
      }
    }
  }

  return {
    imageUrls: Array.from(new Set(imageUrls)),
    status,
    error: message
  };
}

function normalizeResolutionForAspectRatio(resolution: string, aspectRatio: string, model?: string): string {
  if (resolution !== "4k") return resolution || "2k";
  if (model?.trim().toLowerCase() === APIMART_GPT_IMAGE_2_OFFICIAL_MODEL || isGptImage25Model(model)) return "4k";
  return ["auto", "16:9", "9:16", "2:1", "1:2", "21:9", "9:21"].includes(aspectRatio) ? "4k" : "2k";
}

function normalizeQwenImageResolution(resolution?: string): string {
  const normalized = (resolution || "1K").trim().toUpperCase();
  return ["1K", "2K", "4K"].includes(normalized) ? normalized : "1K";
}

function normalizeEnum(value: string, allowed: string[], fallback: string): string {
  return allowed.includes(value) ? value : fallback;
}

function isQwenImage2Model(model: string): boolean {
  return model.trim().toLowerCase() === "qwen-image-2.0";
}

function isStandardGptImage2Model(model: string): boolean {
  return model.trim().toLowerCase() === "gpt-image-2";
}

function isNanoBananaProModel(model: string): boolean {
  return APIMART_NANO_BANANA_PRO_MODELS.has(model.trim().toLowerCase());
}

function isPremiumResolution(resolution?: string): boolean {
  const normalized = String(resolution ?? "").trim().toLowerCase();
  return normalized === "2k" || normalized === "4k";
}

function isFourKilopixelResolution(resolution?: string): boolean {
  return String(resolution ?? "").trim().toLowerCase() === "4k";
}

function resolveApimartModelForResolution(input: GenerateApimartImagesInput): string {
  if (input.model?.trim() && isNanoBananaProModel(input.model)) return input.model.trim();
  const experimentModel = parseImageModelExperimentVariant(input.experimentModel);
  if (experimentModel) return experimentModel;
  if (isGptImage25Model(input.model)) return input.model!.trim().toLowerCase();
  if (appConfig.image.apimart.forceOfficial) return APIMART_GPT_IMAGE_2_OFFICIAL_MODEL;
  if (isPremiumResolution(input.resolution)) return APIMART_GPT_IMAGE_2_OFFICIAL_MODEL;
  return input.model?.trim() || appConfig.image.apimart.model || "gpt-image-2";
}

function resolveConfiguredApimartModel(): string {
  return appConfig.image.apimart.forceOfficial
    ? APIMART_GPT_IMAGE_2_OFFICIAL_MODEL
    : appConfig.image.apimart.model || "gpt-image-2";
}

function canUseConfiguredFallbackForInput(input: GenerateApimartImagesInput): boolean {
  const resolution = input.resolution;
  if (isGptImage25ModelExperiment(input)) return appConfig.image.gptImage25.fallbackProvider === "openrouter"
    && isOpenrouterImageConfigured() && isOpenrouterImageResolutionSupported(resolution);
  if (!isPremiumResolution(resolution)) return true;
  const fallbackProvider = resolveImageFallbackProvider(resolution);
  return (fallbackProvider === "openrouter"
      && isOpenrouterImageConfigured()
      && isOpenrouterImageResolutionSupported(resolution))
    || (fallbackProvider === "hfsyapi" && isHfsyapiImageConfigured())
    || (fallbackProvider === "toapis" && isToapisImageConfigured());
}

export function isFlareExperimentTechnicalFallbackEligible(error: unknown, resolution?: string, source: "apimart" | "openrouter" = "apimart"): boolean {
  const target = appConfig.image.gptImage25.fallbackProvider;
  if (target === "none" || target === source || !isApimartErrorEligibleForImageProviderFallback(error)) return false;
  return target === "apimart" ? Boolean(appConfig.image.apimart.apiKey)
    : isOpenrouterImageConfigured() && isOpenrouterImageResolutionSupported(resolution);
}

function isInputFallbackEligible(error: unknown, input: { experimentModel?: ImageModelExperimentVariant; model?: string; resolution?: string }): boolean {
  return isGptImage25ModelExperiment(input)
    ? isFlareExperimentTechnicalFallbackEligible(error, input.resolution)
    : isApimartErrorEligibleForConfiguredImageFallback(error, input.resolution);
}

async function readJsonResponse(response: Response): Promise<{ payload: unknown; text: string }> {
  const text = await response.text();
  try {
    return { payload: JSON.parse(text), text };
  } catch {
    return { payload: {}, text };
  }
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutMessage: string
): Promise<Response> {
  const effectiveTimeoutMs = Math.max(1000, Math.round(timeoutMs));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), effectiveTimeoutMs);
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

async function pollApimartTask(taskId: string, headers: Record<string, string>): Promise<string> {
  const imageUrls = await pollApimartTaskImages(taskId, headers);
  const imageUrl = imageUrls[0];
  if (!imageUrl) {
    throw new Error(`APIMart image task completed without images: ${taskId}`);
  }
  return imageUrl;
}

async function pollApimartTaskImages(taskId: string, headers: Record<string, string>): Promise<string[]> {
  const { apimart } = appConfig.image;
  const startedAt = Date.now();
  const initialDelayMs = Math.max(0, apimart.initialPollDelayMs);
  const pollIntervalMs = Math.max(1000, apimart.pollIntervalMs);
  const timeoutMs = Math.max(30000, apimart.timeoutMs);
  const transientErrorMaxAttempts = Math.max(1, Number(apimart.pollTransientErrorMaxAttempts) || 8);
  let transientErrorAttempts = 0;
  let pollAttempts = 0;

  if (initialDelayMs > 0) {
    await sleep(initialDelayMs);
  }

  while (Date.now() - startedAt < timeoutMs) {
    try {
      pollAttempts += 1;
      const pollStartedAt = Date.now();
      const response = await fetch(`${apimart.apiUrl}/v1/tasks/${encodeURIComponent(taskId)}`, {
        method: "GET",
        headers,
        cache: "no-store"
      });
      const { payload, text } = await readJsonResponse(response);

      if (!response.ok) {
        const error = new Error(`APIMart task query failed: ${response.status} ${previewPrompt(text, 280)}`);
        (error as Error & { status?: number }).status = response.status;
        throw error;
      }

      transientErrorAttempts = 0;
      const extracted = extractApimartCompletedImageUrls(payload);
      if (extracted.imageUrls.length) {
        if (APIMART_DEBUG_TIMINGS_ENABLED) {
          console.info("[APIMart] Task poll loop completed", {
            taskId,
            durationMs: Date.now() - startedAt,
            pollAttempts,
            lastPollDurationMs: Date.now() - pollStartedAt,
            imageCount: extracted.imageUrls.length,
            taskStatus: extracted.status
          });
        }
        return extracted.imageUrls;
      }
      if (extracted.status && ["failed", "error", "cancelled", "canceled"].includes(extracted.status.toLowerCase())) {
        throw new Error(extracted.error || `APIMart image task failed: ${taskId}`);
      }
      if (APIMART_DEBUG_TIMINGS_ENABLED) {
        console.info("[APIMart] Task poll loop pending", {
          taskId,
          durationMs: Date.now() - startedAt,
          pollAttempts,
          lastPollDurationMs: Date.now() - pollStartedAt,
          taskStatus: extracted.status,
          nextPollInMs: pollIntervalMs
        });
      }
    } catch (error) {
      if (!isTransientApimartError(error)) {
        throw error;
      }
      transientErrorAttempts += 1;
      console.warn("[APIMart] Task poll transient failure", {
        taskId,
        attempt: transientErrorAttempts,
        maxAttempts: transientErrorMaxAttempts,
        message: error instanceof Error ? error.message : String(error)
      });
      if (transientErrorAttempts >= transientErrorMaxAttempts) {
        throw error;
      }
    }

    await sleep(pollIntervalMs);
  }

  if (APIMART_DEBUG_TIMINGS_ENABLED) {
    console.warn("[APIMart] Task poll loop timed out", {
      taskId,
      durationMs: Date.now() - startedAt,
      pollAttempts,
      timeoutMs
    });
  }
  throw new Error(`APIMart image task timed out after ${timeoutMs}ms: ${taskId}`);
}

export function buildApimartGenerationPayload(params: {
  model: string;
  prompt: string;
  background?: "auto" | "transparent";
  outputFormat?: "png" | "jpeg";
  visibleTextLanguage?: string;
  aspectRatio: string;
  resolution?: string;
  quality?: string;
  imageUrls?: string[];
  n: number;
}): Record<string, unknown> {
  const { apimart } = appConfig.image;
  const imageUrls = (params.imageUrls ?? []).map((item) => item.trim()).filter(isValidAbsoluteUrl).slice(0, 16);
  const n = Math.max(1, Math.min(4, Math.round(params.n)));
  const prompt = limitImageModelPrompt(params.visibleTextLanguage
    ? applyVisibleTextLanguageConstraint({
        prompt: params.prompt,
        language: params.visibleTextLanguage
      })
    : params.prompt);

  if (isNanoBananaProModel(params.model)) {
    const payload: Record<string, unknown> = {
      model: params.model,
      prompt,
      size: params.aspectRatio,
      resolution: normalizeQwenImageResolution(params.resolution ?? apimart.resolution),
      n: 1
    };
    if (imageUrls.length) payload.image_urls = imageUrls.slice(0, 14);
    return payload;
  }

  if (isQwenImage2Model(params.model)) {
    const payload: Record<string, unknown> = {
      model: params.model,
      prompt,
      resolution: normalizeQwenImageResolution(params.resolution ?? apimart.resolution),
      aspect_ratio: params.aspectRatio,
      n
    };

    if (imageUrls.length) {
      payload.image_urls = imageUrls;
    }

    return payload;
  }

  const outputFormat = params.background === "transparent"
    ? "png"
    : normalizeEnum(params.outputFormat ?? apimart.outputFormat, ["png", "jpeg", "webp"], "png");
  const payload: Record<string, unknown> = {
    model: params.model,
    prompt,
    size: params.aspectRatio,
    resolution: normalizeResolutionForAspectRatio(params.resolution ?? apimart.resolution, params.aspectRatio, params.model),
    background: normalizeEnum(params.background ?? apimart.background, ["auto", "opaque", "transparent"], "auto"),
    moderation: (params.model.trim().toLowerCase() === APIMART_GPT_IMAGE_2_OFFICIAL_MODEL || isGptImage25Model(params.model))
      ? "low"
      : normalizeEnum(apimart.moderation, ["auto", "low"], "auto"),
    output_format: outputFormat,
    n
  };

  if (!isStandardGptImage2Model(params.model)) {
    payload.quality = normalizeEnum(params.quality ?? apimart.quality, ["auto", "low", "medium", "high"], "high");
  }

  if ((outputFormat === "jpeg" || outputFormat === "webp") && apimart.outputCompression > 0) {
    payload.output_compression = Math.min(100, Math.max(0, Math.round(apimart.outputCompression)));
  }

  if (imageUrls.length) {
    payload.image_urls = imageUrls;
  }

  return payload;
}

async function submitApimartGeneration(params: SubmitApimartGenerationParams): Promise<string> {
  const { apimart } = appConfig.image;
  const startedAt = Date.now();
  const submitTimeoutMs = Math.max(1, Number(apimart.submitTimeoutMs) || 60000);
  const payload = buildApimartGenerationPayload(params);
  assertApimartImageUrlsAreStrings(payload);
  params.onPayloadBuilt?.(payload);

  if (APIMART_DEBUG_TIMINGS_ENABLED) {
    console.info("[APIMart] Generate start", {
      apiUrl: `${apimart.apiUrl}/v1/images/generations`,
      model: params.model,
      aspectRatio: params.aspectRatio,
      n: payload.n,
      submitTimeoutMs,
      resolution: payload.resolution,
      quality: payload.quality,
      referenceImageCount: Array.isArray(payload.image_urls) ? payload.image_urls.length : 0,
      promptPreview: previewPrompt(params.prompt)
    });
  }

  const response = await fetchWithTimeout(
    `${apimart.apiUrl}/v1/images/generations`,
    {
      method: "POST",
      headers: params.headers,
      body: JSON.stringify(payload),
      cache: "no-store"
    },
    submitTimeoutMs,
    `APIMart image generation submit timed out after ${submitTimeoutMs}ms`
  );
  const { payload: responsePayload, text } = await readJsonResponse(response);

  if (!response.ok) {
    const error = new Error(`APIMart image generation failed: ${response.status} ${previewPrompt(text, 280)}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  const taskId = extractApimartTaskId(responsePayload);
  if (!taskId) {
    throw new Error(`APIMart image generation returned no task_id: ${previewPrompt(text, 280)}`);
  }
  if (APIMART_DEBUG_TIMINGS_ENABLED) {
    console.info("[APIMart] Task submitted", {
      model: params.model,
      taskId,
      aspectRatio: params.aspectRatio,
      n: payload.n,
      durationMs: Date.now() - startedAt
    });
  }
  params.onTaskSubmitted?.(taskId);
  return taskId;
}

async function submitApimartGenerationWithRetry(params: SubmitApimartGenerationParams & {
  maxAttempts?: number;
  disableConfiguredFallback?: boolean;
  retryFetchFailuresOnly?: boolean;
  onSubmitAttemptFailed?: GenerateApimartImagesInput["onSubmitAttemptFailed"];
}): Promise<string> {
  const maxAttempts = Math.max(1, Math.round(params.maxAttempts ?? 2));
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await submitApimartGeneration(params);
    } catch (error) {
      lastError = error;
      const fallbackEligible = !params.disableConfiguredFallback
        && isInputFallbackEligible(error, params);
      // A dropped connection can happen before APIMart returns an HTTP response. Retry it once
      // even when no fallback is configured; if it fails again, the caller can still defer to
      // IMAGE_FALLBACK_PROVIDER when one is available.
      const willRetry = attempt < maxAttempts && (
        isFetchFailedError(error) || (!params.retryFetchFailuresOnly && fallbackEligible)
      );
      const willFallback = fallbackEligible && !willRetry;
      const message = errorMessage(error);
      params.onSubmitAttemptFailed?.({
        provider: "apimart",
        attempt,
        maxAttempts,
        model: params.model,
        statusCode: errorStatusCode(error),
        errorMessage: previewError(message, 1000),
        rawErrorMessage: previewError(message, 1000),
        willRetry,
        willFallback
      });

      if (!willRetry) {
        throw error;
      }

      await sleep(Math.min(1600, 400 * attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(errorMessage(lastError));
}

async function submitApimartGenerationWithFourKilopixelFallback(params: SubmitApimartGenerationParams & {
  maxAttempts?: number;
  disableConfiguredFallback?: boolean;
  onSubmitAttemptFailed?: GenerateApimartImagesInput["onSubmitAttemptFailed"];
  preferConfiguredFallback?: boolean;
  allowResolutionDowngrade?: boolean;
}): Promise<{ taskId: string; model: string }> {
  const shouldFallbackToOneKilopixel = isFourKilopixelResolution(params.resolution)
    && !isNanoBananaProModel(params.model);
  try {
    return {
      taskId: await submitApimartGenerationWithRetry({
        ...params,
        maxAttempts: shouldFallbackToOneKilopixel
          ? 2
          : params.maxAttempts,
        retryFetchFailuresOnly: shouldFallbackToOneKilopixel
      }),
      model: params.model
    };
  } catch (error) {
    if (!shouldFallbackToOneKilopixel) {
      throw error;
    }
    if (isBillingLimitProviderError(error)) {
      throw error;
    }
    // A second connection failure should reach the configured provider fallback instead of
    // silently changing the requested 4k image into a 1k APIMart request.
    if (isFetchFailedError(error)) {
      throw error;
    }
    if (params.preferConfiguredFallback && isInputFallbackEligible(error, params)) {
      throw error;
    }
    if (params.allowResolutionDowngrade === false) {
      throw error;
    }

    const fallbackModel = "gpt-image-2";
    console.warn("[APIMart] 4k submit failed; retrying once at 1k", {
      fromModel: params.model,
      fallbackModel,
      requestedResolution: params.resolution,
      aspectRatio: params.aspectRatio,
      message: errorMessage(error)
    });
    return {
      taskId: await submitApimartGenerationWithRetry({
        ...params,
        model: fallbackModel,
        resolution: "1k",
        maxAttempts: 1,
        disableConfiguredFallback: true
      }),
      model: fallbackModel
    };
  }
}

function buildApimartAuthHeaders(): Record<string, string> {
  const { apimart } = appConfig.image;
  const apiKey = apimart.apiKey;
  if (!apiKey) {
    throw new Error("APIMART_API_KEY is missing");
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };
}

async function createConfiguredDeferredImageFallbackTask(input: GenerateApimartImagesInput): Promise<SubmittedApimartImageTask | null> {
  if (isGptImage25ModelExperiment(input)) {
    if (!isOpenrouterImageConfigured() || !isOpenrouterImageResolutionSupported(input.resolution)) return null;
    return createOpenrouterDeferredImageTask({ ...input, model: `openai/${input.experimentModel}`, quality: flareExperimentQuality(input.resolution) });
  }
  const fallbackProvider = resolveImageFallbackProvider(input.resolution);
  if (
    fallbackProvider === "openrouter"
    && isOpenrouterImageConfigured()
    && isOpenrouterImageResolutionSupported(input.resolution)
  ) {
    return createOpenrouterDeferredImageTask({
      ...input,
      model: appConfig.image.openrouter.model
    });
  }

  if (fallbackProvider === "hfsyapi" && isHfsyapiImageConfigured()) {
    return createHfsyapiDeferredImageTask({
      ...input,
      model: appConfig.image.hfsyapi.model || input.model
    });
  }

  if (fallbackProvider === "vectorengine" && isVectorengineImageFallbackConfigured()) {
    return createVectorengineDeferredImageTask(input);
  }

  if (fallbackProvider === "toapis" && isToapisImageConfigured()) {
    return submitToapisGptImages({
      ...input,
      model: appConfig.image.toapis.model || input.model
    });
  }

  return null;
}

async function generateConfiguredImageFallback(input: GenerateApimartImagesInput): Promise<{
  imageUrls: string[];
  provider: string;
}> {
  if (isGptImage25ModelExperiment(input)) {
    return generateOpenrouterGptImages({ ...input, model: `openai/${input.experimentModel}`, quality: flareExperimentQuality(input.resolution) });
  }
  const fallbackProvider = resolveImageFallbackProvider(input.resolution);
  if (
    fallbackProvider === "openrouter"
    && isOpenrouterImageConfigured()
    && isOpenrouterImageResolutionSupported(input.resolution)
  ) {
    return generateOpenrouterGptImages({
      ...input,
      model: appConfig.image.openrouter.model
    });
  }
  if (fallbackProvider === "hfsyapi" && isHfsyapiImageConfigured()) {
    return generateHfsyapiGptImages({
      ...input,
      model: appConfig.image.hfsyapi.model || input.model
    });
  }
  if (fallbackProvider === "toapis" && isToapisImageConfigured()) {
    return generateToapisGptImages({
      ...input,
      model: appConfig.image.toapis.model || input.model
    });
  }
  if (fallbackProvider === "vectorengine" && isVectorengineImageFallbackConfigured()) {
    return generateVectorengineGptImages(input);
  }
  throw new Error(`No configured image fallback is available for ${input.resolution || "1k"}.`);
}

export async function submitApimartGptImages(
  input: GenerateApimartImagesInput,
  options: { forceApimart?: boolean; disableConfiguredFallback?: boolean } = {}
): Promise<SubmittedApimartImageTask> {
  if (isGptImage25ModelExperiment(input) && !options.forceApimart && appConfig.image.gptImage25.primaryProvider === "openrouter") {
    if (input.maskUrl) throw new Error("GPT Image 2.5 does not support masked edits.");
    if (input.requireAllReferenceImages && (input.imageUrls?.length ?? 0) > 16) throw new Error("Comic continuity requires more reference images than this provider supports.");
    try {
      if (!isOpenrouterImageConfigured()) throw new Error("OPENROUTER_API_KEY is missing");
      const task = createOpenrouterDeferredImageTask({ ...input, model: `openai/${input.experimentModel}` });
      input.onTaskSubmitted?.(task.taskId);
      return task;
    } catch (error) {
      if (options.disableConfiguredFallback || !isFlareExperimentTechnicalFallbackEligible(error, input.resolution, "openrouter")) throw error;
      const fallback = await submitApimartGptImages(input, { forceApimart: true, disableConfiguredFallback: true });
      return { ...fallback, fallbackSourceProvider: `openrouter:${resolveOpenrouterImageModel(input)}`, fallbackSourceError: previewError(errorMessage(error), 1000) };
    }
  }
  if (parseImageModelExperimentVariant(input.experimentModel) && !isNanoBananaProModel(input.model ?? "")) {
    input = { ...input, model: input.experimentModel, ...(isGptImage25ModelExperiment(input) ? { quality: flareExperimentQuality(input.resolution), allowResolutionDowngrade: false } : {}) };
    if (isGptImage25ModelExperiment(input)) options = { ...options, forceApimart: true };
  }
  const model = resolveApimartModelForResolution(input);
  const disableConfiguredFallback = options.disableConfiguredFallback === true
    || !canUseConfiguredFallbackForInput(input);
  if (!options.forceApimart && appConfig.image.primaryProvider === "openrouter") {
    try {
      if (disableConfiguredFallback) {
        throw new Error(`OpenRouter GPT Image 2 primary supports 1k only; received ${input.resolution || "unknown"}.`);
      }
      if (!isOpenrouterImageConfigured()) {
        throw new Error("OPENROUTER_API_KEY is missing");
      }
      const submitted = createOpenrouterDeferredImageTask({
        ...input,
        model: appConfig.image.openrouter.model
      });
      input.onTaskSubmitted?.(submitted.taskId);
      return submitted;
    } catch (error) {
      if (!isOpenrouterErrorEligibleForApimartFallback(error)) throw error;
      console.warn("[OpenRouter] Submit setup failed; using APIMart image fallback", {
        message: errorMessage(error)
      });
      try {
        const fallback = await submitApimartGptImages(input, { forceApimart: true });
        return {
          ...fallback,
          fallbackSourceProvider: `openrouter:${appConfig.image.openrouter.model}`,
          fallbackSourceError: previewError(errorMessage(error), 1000),
          fallbackSourceStatusCode: errorStatusCode(error)
        };
      } catch (fallbackError) {
        throw createImageProviderFallbackFailureError({
          primaryProvider: "OpenRouter",
          primaryError: error,
          fallbackProvider: "APIMart",
          fallbackError
        });
      }
    }
  }
  if (!options.forceApimart && appConfig.image.primaryProvider === "toapis") {
    try {
      const submitted = await submitToapisGptImages({
        ...input,
        model: appConfig.image.toapis.model || input.model || model
      });
      return submitted;
    } catch (error) {
      if (resolveImageFallbackProvider(input.resolution) !== "apimart" || !isToapisErrorEligibleForApimartFallback(error)) {
        throw error;
      }
      console.warn("[TOAPIS] Submit failed; using APIMart image fallback", {
        message: errorMessage(error)
      });
      let fallback: SubmittedApimartImageTask;
      try {
        fallback = await submitApimartGptImages(input, { forceApimart: true });
      } catch (fallbackError) {
        throw createImageProviderFallbackFailureError({
          primaryProvider: "TOAPIS",
          primaryError: error,
          fallbackProvider: "APIMart",
          fallbackError
        });
      }
      return {
        ...fallback,
        fallbackSourceProvider: `toapis:${appConfig.image.toapis.model || input.model || model}`,
        fallbackSourceError: previewError(errorMessage(error), 1000),
        fallbackSourceStatusCode: errorStatusCode(error)
      };
    }
  }
  if (!options.forceApimart && !disableConfiguredFallback && appConfig.image.primaryProvider === "hfsyapi") {
    const submitted = createHfsyapiDeferredImageTask({
      ...input,
      model: appConfig.image.hfsyapi.model || input.model?.trim() || model
    });
    if (APIMART_DEBUG_TIMINGS_ENABLED) {
      console.info("[APIMart] Primary image provider is HFSYAPI; deferred APIMart submit", {
        model: submitted.model,
        provider: submitted.provider
      });
    }
    input.onTaskSubmitted?.(submitted.taskId);
    return submitted;
  }
  if (!options.forceApimart && !disableConfiguredFallback && appConfig.image.primaryProvider === "vectorengine") {
    const submitted = createVectorengineDeferredImageTask({ ...input, model });
    if (APIMART_DEBUG_TIMINGS_ENABLED) {
      console.info("[APIMart] Primary image provider is VectorEngine; deferred APIMart submit", {
        model,
        provider: submitted.provider
      });
    }
    input.onTaskSubmitted?.(submitted.taskId);
    return submitted;
  }

  let submitted: { taskId: string; model: string };
  try {
    submitted = await submitApimartGenerationWithFourKilopixelFallback({
      experimentModel: input.experimentModel,
      model,
      prompt: input.prompt,
      background: input.background,
      outputFormat: input.outputFormat,
      visibleTextLanguage: input.visibleTextLanguage,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      quality: input.quality,
      imageUrls: input.imageUrls,
      n: input.n,
      headers: buildApimartAuthHeaders(),
      onPayloadBuilt: input.onPayloadBuilt,
      onTaskSubmitted: input.onTaskSubmitted,
      onSubmitAttemptFailed: input.onSubmitAttemptFailed,
      disableConfiguredFallback,
      preferConfiguredFallback: isPremiumResolution(input.resolution) && canUseConfiguredFallbackForInput(input),
      allowResolutionDowngrade: input.allowResolutionDowngrade
    });
  } catch (error) {
    const allowConfiguredFallback = options.disableConfiguredFallback !== true
      && (!disableConfiguredFallback || isBillingLimitProviderError(error));
    if (!allowConfiguredFallback || !isInputFallbackEligible(error, input)) {
      throw error;
    }
    const fallbackTask = await createConfiguredDeferredImageFallbackTask(input);
    if (!fallbackTask) throw error;
    console.warn("[APIMart] Submit failed; deferred to configured image fallback", {
      fromModel: model,
      fallbackProvider: fallbackTask.provider,
      message: errorMessage(error)
    });
    input.onTaskSubmitted?.(fallbackTask.taskId);
    return {
      ...fallbackTask,
      fallbackSourceProvider: `apimart:${model}`,
      fallbackSourceError: previewError(errorMessage(error), 1000),
      fallbackSourceStatusCode: errorStatusCode(error)
    };
  }

  return {
    taskId: submitted.taskId,
    provider: `apimart:${submitted.model}`,
    model: submitted.model
  };
}

export async function pollApimartGptImageTask(params: {
  taskId: string;
  model?: string;
  limit?: number;
}): Promise<ApimartImageTaskPollResult> {
  const startedAt = Date.now();
  if (isOpenrouterImageTaskId(params.taskId)) {
    const model = params.model?.trim() || appConfig.image.openrouter.model || "openai/gpt-image-2";
    return {
      status: "pending",
      provider: `openrouter:${model}`,
      model,
      taskStatus: "deferred"
    };
  }
  if (isHfsyapiImageTaskId(params.taskId)) {
    const model = params.model?.trim() || appConfig.image.hfsyapi.model || "gpt-image-2";
    const result: ApimartImageTaskPollResult = {
      status: "pending",
      provider: `hfsyapi:${model}`,
      model,
      taskStatus: "deferred"
    };
    if (APIMART_DEBUG_TIMINGS_ENABLED) {
      console.info("[APIMart] Task poll result", {
        taskId: params.taskId,
        status: result.status,
        taskStatus: result.taskStatus,
        provider: result.provider,
        durationMs: Date.now() - startedAt
      });
    }
    return result;
  }
  if (isVectorengineImageTaskId(params.taskId)) {
    const result: ApimartImageTaskPollResult = {
      status: "pending",
      provider: `vectorengine:${params.model?.trim() || appConfig.image.vectorengine.model || "gpt-image-2"}`,
      model: params.model?.trim() || appConfig.image.vectorengine.model || "gpt-image-2",
      taskStatus: "deferred"
    };
    if (APIMART_DEBUG_TIMINGS_ENABLED) {
      console.info("[APIMart] Task poll result", {
        taskId: params.taskId,
        status: result.status,
        taskStatus: result.taskStatus,
        provider: result.provider,
        durationMs: Date.now() - startedAt
      });
    }
    return result;
  }
  if (isToapisImageTaskId(params.taskId)) {
    return pollToapisGptImageTask(params);
  }

  const { apimart } = appConfig.image;
  const model = params.model?.trim() || apimart.model || "gpt-image-2";
  const response = await fetch(`${apimart.apiUrl}/v1/tasks/${encodeURIComponent(params.taskId)}`, {
    method: "GET",
    headers: buildApimartAuthHeaders(),
    cache: "no-store"
  });
  const { payload, text } = await readJsonResponse(response);

  if (!response.ok) {
    const error = new Error(`APIMart task query failed: ${response.status} ${previewPrompt(text, 280)}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  const extracted = extractApimartCompletedImageUrls(payload);
  const taskStatus = extracted.status;
  if (extracted.imageUrls.length) {
    const limit = Math.max(1, Math.min(4, Math.round(params.limit ?? extracted.imageUrls.length)));
    const result: ApimartImageTaskPollResult = {
      status: "completed",
      provider: `apimart:${model}`,
      model,
      imageUrls: extracted.imageUrls.slice(0, limit),
      taskStatus
    };
    if (APIMART_DEBUG_TIMINGS_ENABLED) {
      console.info("[APIMart] Task poll result", {
        taskId: params.taskId,
        status: result.status,
        taskStatus: result.taskStatus,
        provider: result.provider,
        durationMs: Date.now() - startedAt,
        imageCount: result.imageUrls.length
      });
    }
    return result;
  }

  if (taskStatus && ["failed", "error", "cancelled", "canceled"].includes(taskStatus.toLowerCase())) {
    const result: ApimartImageTaskPollResult = {
      status: "failed",
      provider: `apimart:${model}`,
      model,
      error: extracted.error || `APIMart image task failed: ${params.taskId}`,
      taskStatus
    };
    if (APIMART_DEBUG_TIMINGS_ENABLED) {
      console.info("[APIMart] Task poll result", {
        taskId: params.taskId,
        status: result.status,
        taskStatus: result.taskStatus,
        provider: result.provider,
        durationMs: Date.now() - startedAt,
        error: result.error
      });
    }
    return result;
  }

  const result: ApimartImageTaskPollResult = {
    status: "pending",
    provider: `apimart:${model}`,
    model,
    taskStatus
  };
  if (APIMART_DEBUG_TIMINGS_ENABLED) {
    console.info("[APIMart] Task poll result", {
      taskId: params.taskId,
      status: result.status,
      taskStatus: result.taskStatus,
      provider: result.provider,
      durationMs: Date.now() - startedAt
    });
  }
  return result;
}

export async function generateApimartGptImages(
  input: GenerateApimartImagesInput,
  options: { forceApimart?: boolean; disableConfiguredFallback?: boolean } = {}
): Promise<{
  imageUrls: string[];
  provider: string;
}> {
  if (isGptImage25ModelExperiment(input) && !options.forceApimart && appConfig.image.gptImage25.primaryProvider === "openrouter") {
    if (input.maskUrl) throw new Error("GPT Image 2.5 does not support masked edits.");
    if (input.requireAllReferenceImages && (input.imageUrls?.length ?? 0) > 16) throw new Error("Comic continuity requires more reference images than this provider supports.");
    try {
      return await generateOpenrouterGptImages({ ...input, model: `openai/${input.experimentModel}` });
    } catch (error) {
      if (options.disableConfiguredFallback || !isFlareExperimentTechnicalFallbackEligible(error, input.resolution, "openrouter")) throw error;
      return generateApimartGptImages(input, { forceApimart: true, disableConfiguredFallback: true });
    }
  }
  if (parseImageModelExperimentVariant(input.experimentModel) && !isNanoBananaProModel(input.model ?? "")) {
    input = { ...input, model: input.experimentModel, ...(isGptImage25ModelExperiment(input) ? { quality: flareExperimentQuality(input.resolution), allowResolutionDowngrade: false } : {}) };
    if (isGptImage25ModelExperiment(input)) options = { ...options, forceApimart: true };
  }
  const startedAt = Date.now();
  const disableConfiguredFallback = options.disableConfiguredFallback === true
    || !canUseConfiguredFallbackForInput(input);
  if (!options.forceApimart && appConfig.image.primaryProvider === "openrouter") {
    try {
      const generated = await generateOpenrouterGptImages({
        ...input,
        model: appConfig.image.openrouter.model
      });
      return { imageUrls: generated.imageUrls, provider: generated.provider };
    } catch (error) {
      if (!isOpenrouterErrorEligibleForApimartFallback(error)) throw error;
      console.warn("[OpenRouter] Generate failed; using APIMart image fallback", {
        aspectRatio: input.aspectRatio,
        durationMs: Date.now() - startedAt,
        message: errorMessage(error)
      });
      try {
        return await generateApimartGptImages(input, { forceApimart: true });
      } catch (fallbackError) {
        throw createImageProviderFallbackFailureError({
          primaryProvider: "OpenRouter",
          primaryError: error,
          fallbackProvider: "APIMart",
          fallbackError
        });
      }
    }
  }
  if (!options.forceApimart && appConfig.image.primaryProvider === "toapis") {
    try {
      const generated = await generateToapisGptImages({
        ...input,
        model: appConfig.image.toapis.model || input.model
      });
      return { imageUrls: generated.imageUrls, provider: generated.provider };
    } catch (error) {
      if (resolveImageFallbackProvider(input.resolution) !== "apimart" || !isToapisErrorEligibleForApimartFallback(error)) {
        throw error;
      }
      console.warn("[TOAPIS] Generate failed; using APIMart image fallback", {
        aspectRatio: input.aspectRatio,
        durationMs: Date.now() - startedAt,
        message: errorMessage(error)
      });
      try {
        return await generateApimartGptImages(input, { forceApimart: true });
      } catch (fallbackError) {
        throw createImageProviderFallbackFailureError({
          primaryProvider: "TOAPIS",
          primaryError: error,
          fallbackProvider: "APIMart",
          fallbackError
        });
      }
    }
  }
  if (!options.forceApimart && !disableConfiguredFallback && appConfig.image.primaryProvider === "hfsyapi") {
    try {
      const generated = await generateHfsyapiGptImages({
        ...input,
        model: appConfig.image.hfsyapi.model || input.model
      });
      return {
        imageUrls: generated.imageUrls,
        provider: generated.provider
      };
    } catch (error) {
      if (!isHfsyapiErrorEligibleForVectorengineFallback(error) || !isVectorengineImageFallbackConfigured()) {
        throw error;
      }
      console.warn("[HFSYAPI] Generate failed; using VectorEngine fallback", {
        aspectRatio: input.aspectRatio,
        durationMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : String(error)
      });
      const fallback = await generateVectorengineGptImages(input);
      return {
        imageUrls: fallback.imageUrls,
        provider: fallback.provider
      };
    }
  }
  if (!options.forceApimart && !disableConfiguredFallback && appConfig.image.primaryProvider === "vectorengine") {
    try {
      const generated = await generateVectorengineGptImages(input);
      return {
        imageUrls: generated.imageUrls,
        provider: generated.provider
      };
    } catch (error) {
      if (!isVectorengineErrorEligibleForHfsyapiFallback(error)) {
        throw error;
      }
      console.warn("[VectorEngine] Generate failed; using HFSYAPI fallback", {
        aspectRatio: input.aspectRatio,
        durationMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : String(error)
      });
      const fallback = await generateHfsyapiGptImages({
        ...input,
        model: appConfig.image.hfsyapi.model || input.model
      });
      return {
        imageUrls: fallback.imageUrls,
        provider: fallback.provider
      };
    }
  }
  const model = resolveApimartModelForResolution(input);
  const headers = buildApimartAuthHeaders();
  try {
    const submitted = await submitApimartGenerationWithFourKilopixelFallback({
      experimentModel: input.experimentModel,
      model,
      prompt: input.prompt,
      background: input.background,
      outputFormat: input.outputFormat,
      visibleTextLanguage: input.visibleTextLanguage,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      quality: input.quality,
      imageUrls: input.imageUrls,
      n: input.n,
      headers,
      onPayloadBuilt: input.onPayloadBuilt,
      onTaskSubmitted: input.onTaskSubmitted,
      onSubmitAttemptFailed: input.onSubmitAttemptFailed,
      disableConfiguredFallback,
      preferConfiguredFallback: isPremiumResolution(input.resolution) && canUseConfiguredFallbackForInput(input),
      allowResolutionDowngrade: input.allowResolutionDowngrade
    });
    const imageUrls = await pollApimartTaskImages(submitted.taskId, headers);
    if (APIMART_DEBUG_TIMINGS_ENABLED) {
      console.info("[APIMart] Generate success", {
        model: submitted.model,
        taskId: submitted.taskId,
        aspectRatio: input.aspectRatio,
        requestedN: input.n,
        imageCount: imageUrls.length,
        durationMs: Date.now() - startedAt
      });
    }
    return {
      imageUrls: imageUrls.slice(0, Math.max(1, Math.min(4, Math.round(input.n)))),
      provider: `apimart:${submitted.model}`
    };
  } catch (error) {
    const allowConfiguredFallback = options.disableConfiguredFallback !== true && (!disableConfiguredFallback || isBillingLimitProviderError(error));
    if (!allowConfiguredFallback || !isInputFallbackEligible(error, input)) {
      throw error;
    }
    console.warn("[APIMart] Generate failed; using configured image fallback", {
      fromModel: model,
      aspectRatio: input.aspectRatio,
      durationMs: Date.now() - startedAt,
      message: errorMessage(error)
    });
    const fallback = await generateConfiguredImageFallback(input);
    return {
      imageUrls: fallback.imageUrls,
      provider: fallback.provider
    };
  }
}

export async function generateApimartGptImage(input: GenerateApimartImageInput): Promise<ImageGenerationResult> {
  const fallback = buildFallbackGradientUrl(input.seed ?? 1, input.aspectRatio);
  const { apimart } = appConfig.image;
  const model = resolveConfiguredApimartModel();
  const apiKey = apimart.apiKey;

  if (!apiKey) {
    return {
      imageUrl: fallback,
      usedFallback: true,
      provider: "fallback-gradient",
      error: "APIMART_API_KEY is missing"
    };
  }

  const finalPrompt = buildFinalPrompt(input);
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };

  try {
    const submitted = {
      taskId: await submitApimartGeneration({
        model,
        prompt: finalPrompt,
        aspectRatio: input.aspectRatio,
        n: 1,
        headers,
      }),
      model
    };
    const imageUrl = await pollApimartTask(submitted.taskId, headers);
    if (APIMART_DEBUG_TIMINGS_ENABLED) {
      console.info("[APIMart] Generate success", {
        model: submitted.model,
        taskId: submitted.taskId,
        aspectRatio: input.aspectRatio
      });
    }

    return {
      imageUrl,
      usedFallback: false,
      provider: `apimart:${submitted.model}`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isApimartErrorEligibleForVectorengineFallback(error)) {
      try {
        const fallbackResult = await generateVectorengineGptImages({
          prompt: finalPrompt,
          aspectRatio: input.aspectRatio,
          n: 1
        });
        const imageUrl = fallbackResult.imageUrls[0];
        if (imageUrl) {
          return {
            imageUrl,
            usedFallback: false,
            provider: fallbackResult.provider
          };
        }
      } catch (fallbackError) {
        console.error("[VectorEngine] Fallback after APIMart failure failed", {
          model,
          aspectRatio: input.aspectRatio,
          message: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        });
      }
    }
    console.error("[APIMart] Generate failed", {
      model,
      aspectRatio: input.aspectRatio,
      message
    });
    return {
      imageUrl: fallback,
      usedFallback: true,
      provider: "fallback-gradient",
      error: message || "Unknown APIMart image generation error"
    };
  }
}
