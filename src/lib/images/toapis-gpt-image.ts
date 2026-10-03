import { appConfig, resolveImageFallbackProvider } from "@/lib/config";
import { limitImageModelPrompt } from "@/lib/images/prompt-limit";
import { applyVisibleTextLanguageConstraint } from "@/lib/socialmedia/visible-text-language";

const TOAPIS_DEFAULT_MAX_REFERENCE_IMAGES = 6;
const TOAPIS_GPT_IMAGE_2_VIP_MAX_REFERENCE_IMAGES = 10;
const TOAPIS_GPT_IMAGE_2_OFFICIAL_MAX_REFERENCE_IMAGES = 16;

export type GenerateToapisImagesInput = {
  model?: string;
  prompt: string;
  visibleTextLanguage?: string;
  aspectRatio: string;
  resolution?: string;
  quality?: string;
  imageUrls?: string[];
  /**
   * A known source-image ratio. It is used only by TOAPIS gpt-image-2-vip,
   * whose API does not accept `size: auto`.
   */
  referenceAspectRatio?: string;
  n: number;
  onPayloadBuilt?: (payload: Record<string, unknown>) => void;
  onTaskSubmitted?: (taskId: string) => void;
  onSubmitAttemptFailed?: (failure: ToapisImageSubmitFailure) => void;
};

export type ToapisImageSubmitFailure = {
  provider: "toapis";
  attempt: number;
  maxAttempts: number;
  model: string;
  statusCode?: number;
  errorMessage: string;
  rawErrorMessage: string;
  willRetry: boolean;
  willFallback: boolean;
};

export type SubmittedToapisImageTask = {
  taskId: string;
  provider: string;
  model: string;
};

export type ToapisImageTaskPollResult =
  | { status: "pending"; provider: string; model: string; taskStatus?: string }
  | { status: "completed"; provider: string; model: string; imageUrls: string[]; taskStatus?: string }
  | { status: "failed"; provider: string; model: string; error: string; taskStatus?: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function previewText(value: string, max = 280): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeEnum(value: string | undefined, allowed: string[], fallback: string): string {
  const normalized = value?.trim().toLowerCase();
  return normalized && allowed.includes(normalized) ? normalized : fallback;
}

function isToapisGptImage2VipModel(model: string): boolean {
  return model.trim().toLowerCase() === "gpt-image-2-vip";
}

function maxReferenceImagesForToapisModel(model: string): number {
  const normalized = model.trim().toLowerCase();
  if (normalized === "gpt-image-2-official") return TOAPIS_GPT_IMAGE_2_OFFICIAL_MAX_REFERENCE_IMAGES;
  if (normalized === "gpt-image-2-vip") return TOAPIS_GPT_IMAGE_2_VIP_MAX_REFERENCE_IMAGES;
  return TOAPIS_DEFAULT_MAX_REFERENCE_IMAGES;
}

function previewError(value: string, max = 1000): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorStatusCode(error: unknown): number | undefined {
  const record = asRecord(error);
  const status = Number(record?.status ?? record?.code);
  return Number.isFinite(status) ? status : undefined;
}

function isTransientToapisSubmitError(error: unknown): boolean {
  const status = errorStatusCode(error);
  if (status !== undefined && (status === 408 || status === 409 || status === 425 || status === 429 || status >= 500)) {
    return true;
  }
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("fetch failed")
    || message.includes("timed out")
    || message.includes("network")
    || message.includes("socket hang up")
    || message.includes("econnreset")
    || message.includes("etimedout")
    || message.includes("eai_again")
    || message.includes("enotfound")
  );
}

function normalizeReferenceImageUrls(model: string, imageUrls?: string[]): string[] {
  const selected = (imageUrls ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxReferenceImagesForToapisModel(model));
  if (selected.some((item) => !isPublicHttpUrl(item))) {
    throw new Error("TOAPIS image reference images must be public http(s) URLs; base64 and data URLs are not supported.");
  }
  return selected;
}

function buildHeaders(): Record<string, string> {
  const apiKey = appConfig.image.toapis.apiKey;
  if (!apiKey) throw new Error("TOAPIS_API_KEY is missing");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readTaskStatus(payload: unknown): string | undefined {
  const record = asRecord(payload);
  return readOptionalString(record?.status) ?? readOptionalString(asRecord(record?.data)?.status);
}

function extractTaskId(payload: unknown): string | null {
  const record = asRecord(payload);
  const data = asRecord(record?.data);
  return readOptionalString(record?.id)
    ?? readOptionalString(record?.task_id)
    ?? readOptionalString(data?.id)
    ?? readOptionalString(data?.task_id)
    ?? null;
}

function extractImageUrls(payload: unknown): string[] {
  const record = asRecord(payload);
  const result = asRecord(record?.result) ?? asRecord(asRecord(record?.data)?.result);
  const data = Array.isArray(result?.data) ? result.data : [];
  return Array.from(new Set(data.flatMap((item) => {
    const url = readOptionalString(asRecord(item)?.url);
    return url && isPublicHttpUrl(url) ? [url] : [];
  })));
}

function extractError(payload: unknown): string | undefined {
  const record = asRecord(payload);
  const error = asRecord(record?.error) ?? asRecord(asRecord(record?.data)?.error);
  return readOptionalString(error?.message)
    ?? readOptionalString(record?.message)
    ?? readOptionalString(error?.code);
}

async function readJsonResponse(response: Response): Promise<{ payload: unknown; text: string }> {
  const text = await response.text();
  try {
    return { payload: JSON.parse(text), text };
  } catch {
    return { payload: {}, text };
  }
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number, timeoutMessage: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Math.round(timeoutMs)));
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error(timeoutMessage);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isToapisImageConfigured(): boolean {
  return Boolean(appConfig.image.toapis.apiUrl && appConfig.image.toapis.apiKey);
}

export function isToapisImageTaskId(taskId: string): boolean {
  return taskId.startsWith("toapis:");
}

export function buildToapisImageGenerationPayload(input: GenerateToapisImagesInput): Record<string, unknown> {
  const config = appConfig.image.toapis;
  const prompt = limitImageModelPrompt(input.visibleTextLanguage
    ? applyVisibleTextLanguageConstraint({ prompt: input.prompt, language: input.visibleTextLanguage })
    : input.prompt);
  const model = input.model?.trim() || config.model || "gpt-image-2-official";
  const isVip = isToapisGptImage2VipModel(model);
  const requestedSize = input.aspectRatio.trim() || "1:1";
  const payload: Record<string, unknown> = {
    model,
    prompt,
    // TOAPIS VIP does not accept `auto`. When a reference image's ratio is
    // known, preserve it; otherwise use the provider's documented 1:1 default.
    size: isVip && requestedSize.toLowerCase() === "auto"
      ? (input.referenceAspectRatio?.trim() || "1:1")
      : requestedSize,
    resolution: normalizeEnum(input.resolution ?? config.resolution, ["1k", "2k", "4k"], "1k"),
    n: Math.max(1, Math.min(4, Math.round(input.n)))
  };
  if (isVip) {
    payload.quality = normalizeEnum(input.quality ?? config.quality, ["low", "medium", "high"], "low");
    payload.response_format = "url";
  } else {
    payload.output_format = normalizeEnum(config.outputFormat, ["png", "jpeg"], "png");
  }
  if (model.toLowerCase() === "gpt-image-2-official") {
    payload.quality = normalizeEnum(input.quality ?? config.quality, ["low", "medium", "high"], "low");
  }
  const imageUrls = normalizeReferenceImageUrls(model, input.imageUrls);
  if (imageUrls.length) payload.image_urls = imageUrls;
  return payload;
}

export async function submitToapisGptImages(input: GenerateToapisImagesInput): Promise<SubmittedToapisImageTask> {
  const config = appConfig.image.toapis;
  const payload = buildToapisImageGenerationPayload(input);
  const model = String(payload.model);
  const maxAttempts = 2;
  input.onPayloadBuilt?.(payload);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        `${config.apiUrl}/v1/images/generations`,
        { method: "POST", headers: buildHeaders(), body: JSON.stringify(payload), cache: "no-store" },
        config.submitTimeoutMs,
        `TOAPIS image generation submit timed out after ${config.submitTimeoutMs}ms`
      );
      const { payload: responsePayload, text } = await readJsonResponse(response);
      if (!response.ok) {
        const error = new Error(`TOAPIS image generation failed: ${response.status} ${previewText(text)}`);
        (error as Error & { status?: number }).status = response.status;
        throw error;
      }
      const taskId = extractTaskId(responsePayload);
      if (!taskId) throw new Error(`TOAPIS image generation returned no task ID: ${previewText(text)}`);
      const submitted = { taskId: `toapis:${taskId}`, provider: `toapis:${model}`, model };
      input.onTaskSubmitted?.(submitted.taskId);
      return submitted;
    } catch (error) {
      const willRetry = attempt < maxAttempts && isTransientToapisSubmitError(error);
      const willFallback = !willRetry
        && appConfig.image.primaryProvider === "toapis"
        && resolveImageFallbackProvider(input.resolution) === "apimart";
      const message = errorMessage(error);
      input.onSubmitAttemptFailed?.({
        provider: "toapis",
        attempt,
        maxAttempts,
        model,
        statusCode: errorStatusCode(error),
        errorMessage: previewError(message),
        rawErrorMessage: previewError(message),
        willRetry,
        willFallback
      });
      if (!willRetry) throw error;
      await sleep(Math.min(1600, 400 * attempt));
    }
  }

  throw new Error("TOAPIS image generation submit failed after retries");
}

export async function pollToapisGptImageTask(params: { taskId: string; model?: string; limit?: number }): Promise<ToapisImageTaskPollResult> {
  const config = appConfig.image.toapis;
  const model = params.model?.trim() || config.model || "gpt-image-2";
  const taskId = params.taskId.replace(/^toapis:/, "");
  const maxAttempts = Math.max(1, Math.round(config.pollTransientErrorMaxAttempts) || 8);
  const pollRequestTimeoutMs = Math.max(1000, Math.round(config.pollRequestTimeoutMs) || 20_000);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        `${config.apiUrl}/v1/images/generations/${encodeURIComponent(taskId)}`,
        { method: "GET", headers: buildHeaders(), cache: "no-store" },
        pollRequestTimeoutMs,
        `TOAPIS image task query timed out after ${pollRequestTimeoutMs}ms: ${taskId}`
      );
      const { payload, text } = await readJsonResponse(response);
      if (!response.ok) {
        const error = new Error(`TOAPIS image task query failed: ${response.status} ${previewText(text)}`);
        (error as Error & { status?: number }).status = response.status;
        throw error;
      }
      const taskStatus = readTaskStatus(payload);
      const imageUrls = extractImageUrls(payload);
      if (imageUrls.length) {
        return {
          status: "completed",
          provider: `toapis:${model}`,
          model,
          imageUrls: imageUrls.slice(0, Math.max(1, Math.min(4, Math.round(params.limit ?? imageUrls.length)))),
          taskStatus
        };
      }
      if (taskStatus && ["failed", "error", "cancelled", "canceled"].includes(taskStatus.toLowerCase())) {
        return { status: "failed", provider: `toapis:${model}`, model, error: extractError(payload) || `TOAPIS image task failed: ${taskId}`, taskStatus };
      }
      return { status: "pending", provider: `toapis:${model}`, model, taskStatus };
    } catch (error) {
      const willRetry = attempt < maxAttempts && isTransientToapisSubmitError(error);
      if (!willRetry) throw error;
      console.warn("[TOAPIS] Image task poll transient failure", {
        taskId,
        attempt,
        maxAttempts,
        message: errorMessage(error)
      });
      await sleep(Math.max(1000, config.pollIntervalMs));
    }
  }

  throw new Error(`TOAPIS image task query failed after ${maxAttempts} transient attempts: ${taskId}`);
}

export async function generateToapisGptImages(input: GenerateToapisImagesInput): Promise<{ imageUrls: string[]; provider: string; model: string }> {
  const config = appConfig.image.toapis;
  const submitted = await submitToapisGptImages(input);
  const startedAt = Date.now();
  await sleep(Math.max(0, config.initialPollDelayMs));
  while (Date.now() - startedAt < config.timeoutMs) {
    const result = await pollToapisGptImageTask({ taskId: submitted.taskId, model: submitted.model, limit: input.n });
    if (result.status === "completed") return { imageUrls: result.imageUrls, provider: result.provider, model: result.model };
    if (result.status === "failed") throw new Error(result.error);
    await sleep(Math.max(1000, config.pollIntervalMs));
  }
  throw new Error(`TOAPIS image task timed out after ${config.timeoutMs}ms: ${submitted.taskId}`);
}
