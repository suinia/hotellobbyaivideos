// The production V3 planner can use up to 90 seconds. Keep the client stream
// alive long enough for routing and persistence to finish around that budget.
// V3 may spend up to 90s planning before the same request restarts through the
// pipeline. Keep the browser alive for both phases and normal route overhead.
export const THREAD_SUBMIT_REQUEST_TIMEOUT_MS = 180_000;

export const THREAD_SUBMIT_RECOVERY_DELAYS_MS = [
  350,
  1_000,
  2_000,
  4_000,
  8_000
] as const;

export type ThreadSubmitRequestIdentity = {
  sessionId: string;
  idempotencyKey: string;
};

export function isSameThreadSubmitRequest<T extends ThreadSubmitRequestIdentity>(
  left: T | null | undefined,
  right: ThreadSubmitRequestIdentity
): left is T {
  return Boolean(
    left
    && left.sessionId === right.sessionId
    && left.idempotencyKey === right.idempotencyKey
  );
}

export function resolveThreadSubmitRetryRequest<T extends ThreadSubmitRequestIdentity>(
  request: ThreadSubmitRequestIdentity | null | undefined,
  retained: T | null | undefined,
  stored: T | null | undefined
): T | null {
  if (!request) return null;
  if (isSameThreadSubmitRequest(retained, request)) return retained;
  if (isSameThreadSubmitRequest(stored, request)) return stored;
  return null;
}

export function shouldRetainPreJobServerFailureForRetry(
  code?: string
): boolean {
  return code === "IMAGE_BUILDER_V4_UNAVAILABLE";
}

export function isForbiddenThreadSessionSubmitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { status, code } = error as { status?: unknown; code?: unknown };
  // SSE reports application errors inside an HTTP 200 stream, so its reader
  // preserves the server code without an HTTP error status. Explicit statuses
  // must still be 403; unrelated stream errors never trigger this redirect.
  return code === "SESSION_FORBIDDEN" && (status === 403 || status === undefined);
}

export function shouldReconcilePreJobServerFailure(
  code?: string
): boolean {
  return code === "IMAGE_BUILDER_V4_EXECUTION_STATE_UNKNOWN";
}

type ThreadSubmitReconciliationJob = {
  job_id: string;
  status: string;
  is_mock?: boolean;
  local_pending_status?: string;
  socialmedia?: {
    submitIdempotencyKey?: string;
  };
};

export function isThreadSubmitRequestCoveredByServerJobs<
  T extends Pick<ThreadSubmitReconciliationJob, "socialmedia">
>(
  serverJobs: readonly T[],
  idempotencyKey: string,
  isLegacyMatch: (job: T) => boolean
): boolean {
  if (serverJobs.some((job) => job.socialmedia?.submitIdempotencyKey === idempotencyKey)) {
    return true;
  }
  return serverJobs.some((job) => (
    !job.socialmedia?.submitIdempotencyKey?.trim()
    && isLegacyMatch(job)
  ));
}

export function findUncoveredRetainedLocalThreadSubmitJobs<
  T extends ThreadSubmitReconciliationJob
>(
  serverJobs: readonly T[],
  currentJobs: readonly T[],
  retainedIdempotencyKeys: ReadonlySet<string>
): T[] {
  const serverIdempotencyKeys = new Set(
    serverJobs.flatMap((job) => {
      const key = job.socialmedia?.submitIdempotencyKey?.trim();
      return key ? [key] : [];
    })
  );

  return currentJobs.filter((job) => {
    if (!job.is_mock || !job.job_id.startsWith("pending-")) return false;
    if (job.status !== "queued" && job.status !== "running" && job.status !== "failed") return false;
    if (
      job.local_pending_status !== "submitting"
      && job.local_pending_status !== "recovering"
      && job.local_pending_status !== "failed"
    ) return false;
    const key = job.socialmedia?.submitIdempotencyKey?.trim();
    return Boolean(
      key
      && retainedIdempotencyKeys.has(key)
      && !serverIdempotencyKeys.has(key)
    );
  });
}

type ThreadSubmitRecoveryOptions<T> = {
  load: () => Promise<T | null>;
  isRecovered: (value: T) => boolean;
  delaysMs?: readonly number[];
  wait?: (delayMs: number) => Promise<void>;
  shouldContinue?: () => boolean;
};

function defaultWait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export function isRecoverableThreadSubmitError(
  error: unknown,
  options: { structuredServerError?: boolean } = {}
): boolean {
  if (options.structuredServerError) return false;
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  const isBrowserNetworkFailure = /^(?:TypeError:\s*)?(?:Fetch is aborted|Fetch failed|Failed to fetch|Network request failed|Load failed)$/i.test(
    message.trim()
  );

  return name === "AbortError"
    || name === "TimeoutError"
    || isBrowserNetworkFailure;
}

export async function recoverThreadSubmit<T>(
  options: ThreadSubmitRecoveryOptions<T>
): Promise<T | null> {
  const wait = options.wait ?? defaultWait;
  const shouldContinue = options.shouldContinue ?? (() => true);

  for (const delayMs of options.delaysMs ?? THREAD_SUBMIT_RECOVERY_DELAYS_MS) {
    if (!shouldContinue()) return null;
    if (delayMs > 0) await wait(delayMs);
    if (!shouldContinue()) return null;

    try {
      const value = await options.load();
      if (!shouldContinue()) return null;
      if (value && options.isRecovered(value)) return value;
    } catch {
      if (!shouldContinue()) return null;
      // Session reads can fail transiently for the same network reason as the
      // submit. Keep trying for the bounded recovery window.
    }
  }

  return null;
}
