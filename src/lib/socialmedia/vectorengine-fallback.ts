import { flareExperimentQuality } from "@/lib/socialmedia/image-model-experiment";
import {
  createVectorengineDeferredImageTask,
  isApimartErrorEligibleForConfiguredImageFallback,
  isVectorengineImageFallbackConfigured
} from "@/lib/images/vectorengine-gpt-image";
import { appConfig, resolveImageFallbackProvider } from "@/lib/config";
import { isGptImage25ModelExperiment } from "@/lib/socialmedia/image-model-experiment";
import { isFlareExperimentTechnicalFallbackEligible } from "@/lib/images/apimart-gpt-image";
import {
  createHfsyapiDeferredImageTask,
  isHfsyapiImageConfigured
} from "@/lib/images/hfsyapi-gpt-image";
import {
  isImageGenerationSafetyBlocked,
  toUserFacingImageGenerationError
} from "@/lib/socialmedia/image-safety";
import {
  createOpenrouterDeferredImageTask,
  isOpenrouterImageConfigured,
  isOpenrouterImageResolutionSupported
} from "@/lib/images/openrouter-gpt-image";
import { stripTargetAssetStorageReferences } from "@/lib/socialmedia/reference-assets";
import {
  IMAGE_PROVIDER_GENERATING_STAGE,
  type SocialmediaJobPayload,
  type SocialmediaPendingImageTask
} from "@/lib/socialmedia/types";
import type { JobRecord } from "@/lib/types/job";

const APIMART_STALE_VECTORENGINE_TRIGGER_ERROR =
  "APIMart image task timed out before returning a result during stale recovery.";
const RECOVERABLE_APIMART_STALE_STAGES = new Set(["generating_images", "apimart_polling", "failed"]);

export function isVectorengineImageProvider(provider: string): boolean {
  return provider.startsWith("vectorengine:");
}

export function isHfsyapiImageProvider(provider: string): boolean {
  return provider.startsWith("hfsyapi:");
}

export function isOpenrouterImageProvider(provider: string): boolean {
  return provider.startsWith("openrouter:");
}

export function isSynchronousImageProvider(provider: string): boolean {
  return isVectorengineImageProvider(provider) || isHfsyapiImageProvider(provider) || isOpenrouterImageProvider(provider);
}

export function buildSocialmediaJobPayloadPatch(
  payload: JobRecord["payload"],
  socialmedia: SocialmediaJobPayload["socialmedia"]
): JobRecord["payload"] {
  const renderStartedAt = resolveImageRenderStartedAt(
    payload.socialmedia,
    socialmedia
  );
  return {
    ...payload,
    workflow: "socialmedia",
    socialmedia: {
      ...socialmedia,
      ...(renderStartedAt ? { renderStartedAt } : {}),
      targetAssets: stripTargetAssetStorageReferences(socialmedia.targetAssets)
    }
  };
}

function resolveImageRenderStartedAt(
  ...sources: Array<JobRecord["payload"]["socialmedia"] | undefined>
): string | undefined {
  let earliest: { value: string; time: number } | undefined;

  for (const source of sources) {
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;
    const record = source as Partial<SocialmediaJobPayload["socialmedia"]>;
    const tasks = Array.isArray(record.pendingImageTasks) ? record.pendingImageTasks : [];
    const candidates = [
      record.renderStartedAt,
      ...tasks.map((task) => task?.submittedAt)
    ];
    for (const candidate of candidates) {
      if (typeof candidate !== "string") continue;
      const time = Date.parse(candidate);
      if (!Number.isFinite(time)) continue;
      if (!earliest || time < earliest.time) earliest = { value: candidate, time };
    }
  }

  return earliest?.value;
}

export function patchPendingImageTask(
  socialmedia: SocialmediaJobPayload["socialmedia"],
  imageIndex: number,
  patch: Partial<SocialmediaPendingImageTask>
): SocialmediaJobPayload["socialmedia"] {
  return {
    ...socialmedia,
    pendingImageTasks: (socialmedia.pendingImageTasks ?? []).map((task) => (
      task.imageIndex === imageIndex ? { ...task, ...patch } : task
    ))
  };
}

function asSocialmediaPayload(payload: JobRecord["payload"]): SocialmediaJobPayload["socialmedia"] | null {
  const socialmedia = payload.socialmedia;
  if (!socialmedia || typeof socialmedia !== "object" || Array.isArray(socialmedia)) return null;
  return socialmedia as SocialmediaJobPayload["socialmedia"];
}

function isRecoverableApimartTask(task: SocialmediaPendingImageTask): boolean {
  if (task.provider.startsWith("vectorengine:")) return false;
  if (isGptImage25ModelExperiment(task) && (task.fallbackSourceTaskId || task.fallbackSourceProvider)) return false;
  if (!task.provider.startsWith("apimart:")) return false;
  return task.status === "submitted" || task.status === "polling" || task.status === "failed";
}

function getRecoverableApimartTask(
  socialmedia: SocialmediaJobPayload["socialmedia"]
): SocialmediaPendingImageTask | undefined {
  return socialmedia.pendingImageTasks?.find(isRecoverableApimartTask);
}

function readRecoveryTriggerError(job: JobRecord, task: SocialmediaPendingImageTask): string {
  return task.lastError?.trim()
    || job.error?.trim()
    || APIMART_STALE_VECTORENGINE_TRIGGER_ERROR;
}

function fallbackResolutionForTask(task: SocialmediaPendingImageTask): SocialmediaPendingImageTask["resolution"] {
  if (isGptImage25ModelExperiment(task)) return task.resolution;
  const fallbackProvider = resolveImageFallbackProvider(task.resolution);
  if (fallbackProvider === "openrouter" || fallbackProvider === "hfsyapi") return task.resolution;
  return task.resolution === "2k" || task.resolution === "4k" ? "1k" : task.resolution;
}

function createConfiguredDeferredImageFallbackTask(task: SocialmediaPendingImageTask) {
  const fallbackProvider = resolveImageFallbackProvider(task.resolution);
  const input = {
    background: task.background,
    outputFormat: task.outputFormat,
    experimentModel: task.experimentModel,
    prompt: task.prompt,
    visibleTextLanguage: task.visibleTextLanguage,
    aspectRatio: task.aspectRatio,
    resolution: fallbackResolutionForTask(task),
    quality: task.quality,
    imageUrls: task.imageUrls,
    n: 1
  };

  if (isGptImage25ModelExperiment(task)) {
    return createOpenrouterDeferredImageTask({ ...input, model: `openai/${task.experimentModel}`, quality: flareExperimentQuality(task.resolution) });
  }

  if (
    fallbackProvider === "openrouter"
    && isOpenrouterImageConfigured()
    && isOpenrouterImageResolutionSupported(task.resolution)
  ) {
    return createOpenrouterDeferredImageTask({
      ...input,
      model: appConfig.image.openrouter.model
    });
  }

  if (fallbackProvider === "hfsyapi" && isHfsyapiImageConfigured()) {
    return createHfsyapiDeferredImageTask({
      ...input,
      model: appConfig.image.hfsyapi.model || task.model
    });
  }

  if (fallbackProvider === "vectorengine" && isVectorengineImageFallbackConfigured()) {
    return createVectorengineDeferredImageTask(input);
  }

  return null;
}

function buildSafetyBlockedApimartJobState(
  job: JobRecord,
  socialmedia: SocialmediaJobPayload["socialmedia"],
  task: SocialmediaPendingImageTask,
  error: string,
  nowMs: number
): JobRecord | null {
  if (job.status === "failed" && job.stage === "failed") return null;
  const failedSocialmedia: SocialmediaJobPayload["socialmedia"] = {
    ...patchPendingImageTask(socialmedia, task.imageIndex, {
      status: "failed",
      lastError: error
    }),
    failureKind: "agent_safety_response"
  };
  return {
    ...job,
    status: "failed",
    stage: "failed",
    progress: 100,
    error: toUserFacingImageGenerationError(error),
    payload: buildSocialmediaJobPayloadPatch(job.payload, failedSocialmedia),
    updatedAt: new Date(nowMs).toISOString()
  };
}

export function buildStaleApimartRecoveryJobState(job: JobRecord, nowMs = Date.now()): JobRecord | null {
  if (job.result || job.status === "completed") return null;
  if (!RECOVERABLE_APIMART_STALE_STAGES.has(job.stage)) return null;

  const socialmedia = asSocialmediaPayload(job.payload);
  if (!socialmedia) return null;

  const task = getRecoverableApimartTask(socialmedia);
  if (!task) return null;

  const triggerError = readRecoveryTriggerError(job, task);
  if (isImageGenerationSafetyBlocked(triggerError)) {
    return buildSafetyBlockedApimartJobState(job, socialmedia, task, triggerError, nowMs);
  }

  // A submitted async task must be queried before deciding to generate again.
  // The APIMart runner owns timeout/failure fallback after that query.
  if (job.status === "running" && job.stage === "apimart_polling") return null;

  if (!(isGptImage25ModelExperiment(task)
    ? isFlareExperimentTechnicalFallbackEligible(new Error(triggerError), task.resolution)
    : isApimartErrorEligibleForConfiguredImageFallback(new Error(triggerError), task.resolution))) {
    return null;
  }

  const submitted = createConfiguredDeferredImageFallbackTask(task);
  if (!submitted) return null;
  const nowIso = new Date(nowMs).toISOString();
  const vectorengineSocialmedia = patchPendingImageTask(socialmedia, task.imageIndex, {
    taskId: submitted.taskId,
    provider: submitted.provider,
    model: submitted.model,
    quality: isGptImage25ModelExperiment(task) ? flareExperimentQuality(task.resolution) : task.quality,
    resolution: fallbackResolutionForTask(task),
    status: "submitted",
    submittedAt: nowIso,
    firstPollAfter: nowIso,
    lastPolledAt: undefined,
    pollAttempts: 0,
    lastError: triggerError,
    generatedImageUrls: undefined,
    fallbackSourceTaskId: task.taskId,
    fallbackSourceProvider: task.provider,
    fallbackSourceError: triggerError
  });

  return {
    ...job,
    status: "running",
    stage: IMAGE_PROVIDER_GENERATING_STAGE,
    progress: Math.max(job.progress, 35),
    error: undefined,
    payload: buildSocialmediaJobPayloadPatch(job.payload, vectorengineSocialmedia),
    updatedAt: nowIso
  };
}

function internalAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercelUrl = process.env.VERCEL_URL?.trim();
  return vercelUrl ? `https://${vercelUrl.replace(/\/+$/, "")}` : "";
}

function internalImageFallbackAdvanceToken(): string {
  return process.env.INTERNAL_JOB_VIEWER_TOKEN?.trim()
    || process.env.SOCIALMEDIA_LIBRARY_ADMIN_TOKEN?.trim()
    || "";
}

export function triggerImageFallbackAdvanceSoon(): void {
  const baseUrl = internalAppBaseUrl();
  const token = internalImageFallbackAdvanceToken();
  if (!baseUrl || !token) return;

  void fetch(`${baseUrl}/api/internal/socialmedia/image-fallback/advance?limit=1`, {
    method: "POST",
    headers: {
      "x-internal-token": token
    },
    cache: "no-store"
  }).catch((error) => {
    console.warn("[ImageFallback] Failed to trigger fallback advance route", {
      message: error instanceof Error ? error.message : String(error)
    });
  });
}
