import type { JobRecord, JobStatus } from "@/lib/types/job";
import type { SocialmediaJobPayload } from "@/lib/socialmedia/types";
import { isVideoGenerationSourceUseCase } from "@/lib/videos/source-use-case";

export const CLIENT_FAST_JOB_POLL_INTERVAL_MS = 1_000;
export const CLIENT_APIMART_JOB_POLL_INTERVAL_MS = 5_000;
export const CLIENT_LEGACY_JOB_POLL_INTERVAL_MS = 3_000;
const CLIENT_MIN_JOB_POLL_INTERVAL_MS = 250;
const CLIENT_MAX_JOB_POLL_INTERVAL_MS = 60_000;

type ClientJobPollSnapshot = {
  status: JobStatus;
  stage?: string;
  source_use_case?: string;
  output_type?: string;
  next_poll_after_ms?: number;
};

function isVideoJob(job: {
  sourceUseCase?: string;
  outputType?: string;
}): boolean {
  return job.outputType === "video" || isVideoGenerationSourceUseCase(job.sourceUseCase);
}

function findActiveApimartImageTask(job: Pick<JobRecord, "payload">): {
  firstPollAfter?: string;
} | null {
  const socialmedia = job.payload.socialmedia as SocialmediaJobPayload["socialmedia"] | undefined;
  const tasks = socialmedia?.pendingImageTasks;
  if (!Array.isArray(tasks)) return null;

  const task = tasks.find((item) => (
    (item.status === "submitted" || item.status === "polling")
    && item.provider.startsWith("apimart:")
  ));
  return task ? { firstPollAfter: task.firstPollAfter } : null;
}

/**
 * Tells status clients when another read can provide useful new information.
 * Pre-submit and finalization stages stay responsive; only accepted APIMart
 * image tasks use the provider-aware delay.
 */
export function resolveJobStatusPollDelayMs(
  job: Pick<JobRecord, "status" | "stage" | "payload" | "sourceUseCase" | "outputType">,
  now = Date.now()
): number | undefined {
  if (job.status === "completed" || job.status === "failed") return undefined;
  if (isVideoJob({
    sourceUseCase: job.sourceUseCase ?? job.payload.sourceUseCase,
    outputType: job.outputType ?? job.payload.outputType
  })) {
    return CLIENT_LEGACY_JOB_POLL_INTERVAL_MS;
  }

  if (job.status === "running" && job.stage === "apimart_polling") {
    const task = findActiveApimartImageTask(job);
    if (task) {
      const firstPollAfterMs = Date.parse(task.firstPollAfter ?? "");
      if (Number.isFinite(firstPollAfterMs) && firstPollAfterMs > now) {
        return Math.max(
          CLIENT_FAST_JOB_POLL_INTERVAL_MS,
          Math.min(CLIENT_MAX_JOB_POLL_INTERVAL_MS, firstPollAfterMs - now)
        );
      }
      return CLIENT_APIMART_JOB_POLL_INTERVAL_MS;
    }
  }

  return CLIENT_FAST_JOB_POLL_INTERVAL_MS;
}

export function resolveClientJobPollDelayMs(job: ClientJobPollSnapshot): number | undefined {
  if (job.status === "completed" || job.status === "failed") return undefined;

  const serverHint = Number(job.next_poll_after_ms);
  if (Number.isFinite(serverHint) && serverHint > 0) {
    return Math.max(
      CLIENT_MIN_JOB_POLL_INTERVAL_MS,
      Math.min(CLIENT_MAX_JOB_POLL_INTERVAL_MS, Math.round(serverHint))
    );
  }

  if (isVideoJob({
    sourceUseCase: job.source_use_case,
    outputType: job.output_type
  })) {
    return CLIENT_LEGACY_JOB_POLL_INTERVAL_MS;
  }

  // `apimart_polling` is also used by async TOAPIS image fallbacks. Without
  // the provider-aware server hint, keep the client responsive instead of
  // assuming that every job in this stage belongs to APIMart.
  return CLIENT_FAST_JOB_POLL_INTERVAL_MS;
}
