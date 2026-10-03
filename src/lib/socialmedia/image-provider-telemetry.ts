import type { SocialmediaJobPayload } from "@/lib/socialmedia/types";
import { trackServerEvent } from "@/lib/telemetry/axiom";
import type { JobRecord } from "@/lib/types/job";

export type ImageProviderAttemptPhase = "started" | "completed" | "failed";
export type ImageProviderAttemptFlow = "request" | "fallback" | "retry";

export function shouldTrackImageProviderAttemptStart(params: {
  synchronous: boolean;
  sourceProvider?: string;
  retry?: boolean;
}): boolean {
  return params.synchronous || Boolean(params.sourceProvider?.trim()) || Boolean(params.retry);
}

export function buildImageProviderAttemptTelemetry(params: {
  phase: ImageProviderAttemptPhase;
  attemptProvider: string;
  sourceProvider?: string;
  resultProvider?: string;
  retry?: boolean;
}): {
  event: `socialmedia.image_provider.${ImageProviderAttemptFlow}.${ImageProviderAttemptPhase}`;
  reason: string;
} {
  const sourceProvider = params.sourceProvider?.trim();
  const attemptProvider = params.attemptProvider.trim() || "unknown";
  const resultProvider = params.resultProvider?.trim();
  const flow: ImageProviderAttemptFlow = sourceProvider
    ? "fallback"
    : params.retry
      ? "retry"
      : "request";
  return {
    event: `socialmedia.image_provider.${flow}.${params.phase}`,
    reason: [
      `attempt_type=${flow}`,
      params.retry ? "retry=1" : undefined,
      sourceProvider ? `source_provider=${sourceProvider}` : undefined,
      `attempt_provider=${attemptProvider}`,
      resultProvider ? `result_provider=${resultProvider}` : undefined
    ].filter(Boolean).join(";")
  };
}

export function buildRecoveredImageProviderFallbackStartedTelemetry(params: {
  previousStage: string;
  nextStage: string;
  task?: {
    provider?: string;
    fallbackSourceProvider?: string;
    safetyRewriteCount?: number;
  };
}): ReturnType<typeof buildImageProviderAttemptTelemetry> | null {
  const attemptProvider = params.task?.provider?.trim();
  const sourceProvider = params.task?.fallbackSourceProvider?.trim();
  if (
    params.previousStage === params.nextStage
    || params.nextStage !== "image_provider_generating"
    || !attemptProvider
    || !sourceProvider
  ) {
    return null;
  }
  return buildImageProviderAttemptTelemetry({
    phase: "started",
    sourceProvider,
    attemptProvider,
    retry: (params.task?.safetyRewriteCount ?? 0) > 0
  });
}

type ImageProviderRecoveryTask = {
  imageIndex: number;
  status: string;
  taskId: string;
  provider: string;
  fallbackSourceProvider?: string;
};

export function findRecoveredImageProviderFallbackTask<T extends ImageProviderRecoveryTask>(params: {
  previousTasks?: readonly T[];
  recoveredTasks?: readonly T[];
}): T | undefined {
  const previousTasks = new Map(
    (params.previousTasks ?? []).map((item) => [item.imageIndex, item])
  );
  return params.recoveredTasks?.find((item) => {
    if (
      (item.status !== "submitted" && item.status !== "polling")
      || !item.fallbackSourceProvider
    ) return false;
    const previous = previousTasks.get(item.imageIndex);
    return !previous
      || previous.taskId !== item.taskId
      || previous.provider !== item.provider
      || previous.fallbackSourceProvider !== item.fallbackSourceProvider;
  });
}

export function trackRecoveredImageProviderFallbackStarted(params: {
  previousJob: JobRecord;
  recoveredJob: JobRecord;
}): void {
  const rawSocialmedia = params.recoveredJob.payload.socialmedia;
  const socialmedia = rawSocialmedia && typeof rawSocialmedia === "object" && !Array.isArray(rawSocialmedia)
    ? rawSocialmedia as SocialmediaJobPayload["socialmedia"]
    : undefined;
  const rawPreviousSocialmedia = params.previousJob.payload.socialmedia;
  const previousSocialmedia = rawPreviousSocialmedia
    && typeof rawPreviousSocialmedia === "object"
    && !Array.isArray(rawPreviousSocialmedia)
    ? rawPreviousSocialmedia as SocialmediaJobPayload["socialmedia"]
    : undefined;
  const task = findRecoveredImageProviderFallbackTask({
    previousTasks: previousSocialmedia?.pendingImageTasks,
    recoveredTasks: socialmedia?.pendingImageTasks
  });
  const telemetry = buildRecoveredImageProviderFallbackStartedTelemetry({
    previousStage: params.previousJob.stage,
    nextStage: params.recoveredJob.stage,
    task
  });
  if (!telemetry || !task) return;

  trackServerEvent({
    event: telemetry.event,
    status: "started",
    route: "socialmedia-stale-recovery",
    stage: params.recoveredJob.stage,
    jobId: params.recoveredJob.id,
    userId: params.recoveredJob.ownerUserId,
    sessionId: socialmedia?.telemetry?.clientSessionId,
    traceId: socialmedia?.telemetry?.traceId,
    requestId: socialmedia?.telemetry?.requestId,
    agentVariant: socialmedia?.telemetry?.agentVersionExperimentVariant,
    agentRuntimeVersion: socialmedia?.telemetry?.agentRuntimeVersion,
    imageBuilderRequestedRuntime: socialmedia?.telemetry?.imageBuilderRequestedRuntime,
    imageBuilderExecutedRuntime: socialmedia?.telemetry?.imageBuilderExecutedRuntime,
    imageBuilderMode: socialmedia?.telemetry?.imageBuilderMode,
    imageBuilderFallbackKind: socialmedia?.telemetry?.imageBuilderFallbackKind,
    imageBuilderRequestedProvider: socialmedia?.telemetry?.imageBuilderRequestedProvider,
    imageBuilderExecutedProvider: socialmedia?.telemetry?.imageBuilderExecutedProvider,
    imageBuilderProviderFallbackKind: socialmedia?.telemetry?.imageBuilderProviderFallbackKind,
    imageBuilderProviderFallbackStatus: socialmedia?.telemetry?.imageBuilderProviderFallbackStatus,
    imageIndex: task.imageIndex,
    apimartTaskId: task.taskId,
    apimartModel: task.model,
    reason: telemetry.reason
  });
}
