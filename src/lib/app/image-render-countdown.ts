export const IMAGE_RENDER_COUNTDOWN_DURATION_MS = 20_000;
export const IMAGE_2_RENDER_COUNTDOWN_DURATION_MS = 60_000;
export const IMAGE_2_5_RENDER_COUNTDOWN_DURATION_MS = 30_000;

export type ImageRenderPendingTaskTiming = {
  submittedAt?: string;
  submitted_at?: string;
};

export type ImageRenderTimingSource = {
  renderCountdownDurationMs?: number;
  renderStartedAt?: string;
  render_started_at?: string;
  pendingImageTasks?: ImageRenderPendingTaskTiming[];
  pending_image_tasks?: ImageRenderPendingTaskTiming[];
};

function asTimingRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function resolveTrimmedTimingString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function pickPendingTaskTimings(value: unknown): ImageRenderPendingTaskTiming[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const timings = value.map((task) => {
    const record = asTimingRecord(task);
    const submittedAt = resolveTrimmedTimingString(record.submittedAt);
    const submitted_at = resolveTrimmedTimingString(record.submitted_at);
    return {
      ...(submittedAt ? { submittedAt } : {}),
      ...(submitted_at ? { submitted_at } : {})
    };
  }).filter((task) => Boolean(task.submittedAt || task.submitted_at));
  return timings.length ? timings : undefined;
}

export function pickImageRenderTimingSource(value: unknown): ImageRenderTimingSource {
  const record = asTimingRecord(value);
  const durationMs = pickImageRenderDurationMs(record);
  const renderStartedAt = resolveTrimmedTimingString(record.renderStartedAt);
  const render_started_at = resolveTrimmedTimingString(record.render_started_at);
  const pendingImageTasks = pickPendingTaskTimings(record.pendingImageTasks);
  const pending_image_tasks = pickPendingTaskTimings(record.pending_image_tasks);
  return {
    ...(durationMs ? { renderCountdownDurationMs: durationMs } : {}),
    ...(renderStartedAt ? { renderStartedAt } : {}),
    ...(render_started_at ? { render_started_at } : {}),
    ...(pendingImageTasks ? { pendingImageTasks } : {}),
    ...(pending_image_tasks ? { pending_image_tasks } : {})
  };
}

export type ImageRenderCountdown =
  | {
      kind: "countdown";
      label: string;
      remainingSeconds: number;
    }
  | {
      kind: "almost_there";
      label: "Almost there";
      remainingSeconds: 0;
    };

export function resolveServerClockOffsetMs(
  serverNow: string | undefined,
  clientNowMs: number
): number {
  const serverNowMs = Date.parse(serverNow ?? "");
  return Number.isFinite(serverNowMs) ? serverNowMs - clientNowMs : 0;
}

export function resolveServerAdjustedNowMs(
  clientNowMs: number,
  serverClockOffsetMs: number
): number {
  return clientNowMs + serverClockOffsetMs;
}

export function resolveImageRenderSubmittedAtMs(
  tasks: ImageRenderPendingTaskTiming[] | undefined
): number | null {
  if (!tasks?.length) return null;

  let earliestSubmittedAtMs: number | null = null;
  for (const task of tasks) {
    const submittedAtMs = Date.parse(task.submittedAt ?? task.submitted_at ?? "");
    if (!Number.isFinite(submittedAtMs)) continue;
    if (earliestSubmittedAtMs === null || submittedAtMs < earliestSubmittedAtMs) {
      earliestSubmittedAtMs = submittedAtMs;
    }
  }
  return earliestSubmittedAtMs;
}

export function resolveImageRenderStartedAtMs(
  source: ImageRenderTimingSource | undefined
): number | null {
  if (!source) return null;
  const persistedStartedAtMs = Date.parse(
    source.renderStartedAt ?? source.render_started_at ?? ""
  );
  if (Number.isFinite(persistedStartedAtMs)) return persistedStartedAtMs;
  return resolveImageRenderSubmittedAtMs(
    source.pendingImageTasks ?? source.pending_image_tasks
  );
}

export function resolveImageRenderCountdown(
  startedAtMs: number,
  nowMs: number,
  durationMs = IMAGE_RENDER_COUNTDOWN_DURATION_MS
): ImageRenderCountdown {
  const remainingMs = Math.max(0, startedAtMs + durationMs - nowMs);
  if (remainingMs <= 0) {
    return {
      kind: "almost_there",
      label: "Almost there",
      remainingSeconds: 0
    };
  }

  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return {
    kind: "countdown",
    label: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
    remainingSeconds
  };
}

function pickImageRenderDurationMs(value: unknown): number | undefined {
  const record = asTimingRecord(value);
  const tasks = record.pendingImageTasks ?? record.pending_image_tasks;
  const models = (Array.isArray(tasks) ? tasks : []).map(task => asTimingRecord(task).model);
  models.push(asTimingRecord(record.imageModelExperiment).variant);
  for (const model of models) {
    if (typeof model !== "string") continue;
    const normalized = model.trim().toLowerCase();
    if (/^(?:openai\/)?gpt-image-2\.5(?:-|$)/.test(normalized)) return IMAGE_2_5_RENDER_COUNTDOWN_DURATION_MS;
    if (/^(?:openai\/)?gpt-image-2(?:-|$)/.test(normalized)) return IMAGE_2_RENDER_COUNTDOWN_DURATION_MS;
  }
  const persisted = record.renderCountdownDurationMs;
  return persisted === 20_000 || persisted === 30_000 || persisted === 60_000 ? persisted : undefined;
}

export function resolveImageRenderDurationMs(source: unknown): number {
  return pickImageRenderDurationMs(source) ?? IMAGE_RENDER_COUNTDOWN_DURATION_MS;
}
