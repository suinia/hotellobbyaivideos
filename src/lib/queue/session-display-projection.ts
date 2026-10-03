// Only the Chat display reader uses this projection. Execution, recovery and
// Agent history readers continue to load complete persisted jobs.
const payloadFields = ["inputText", "sourceUseCase", "outputType"] as const;
const socialmediaFields = [
  "mode", "submitIdempotencyKey", "sourceUseCase", "outputType", "agentRequest",
  "sourceAssets", "source_assets", "userSourceAssets", "user_source_assets",
  "targetAssets", "target_assets", "renderCountdownDurationMs", "renderStartedAt",
  "render_started_at", "pending_image_tasks", "imageModelExperiment"
] as const;
const taskTimingFields = ["submittedAt", "submitted_at", "model"] as const;
const taskSlots = [0, 1, 2, 3] as const;

export const SESSION_DISPLAY_JOB_COLUMNS = [
  "id", "session_id", "user_id", "guest_user_id", "turn_index", "revision", "mode",
  "base_job_id", "parent_job_id", "source_use_case", "output_type", "input_text",
  "status", "stage", "progress", "error_text", "result_json", "created_at", "updated_at",
  ...payloadFields.map((field) => `display_payload_${field}:payload_json->${field}`),
  ...socialmediaFields.map((field) => `display_socialmedia_${field}:payload_json->socialmedia->${field}`),
  ...taskSlots.flatMap((index) => taskTimingFields.map((field) => (
    `display_task_${index}_${field}:payload_json->socialmedia->pendingImageTasks->${index}->${field}`
  ))),
  "display_task_overflow:payload_json->socialmedia->pendingImageTasks->4"
].join(",");

export function restoreSessionDisplayJobRow(row: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const socialmedia: Record<string, unknown> = {};
  for (const field of payloadFields) {
    if (row[`display_payload_${field}`] != null) payload[field] = row[`display_payload_${field}`];
  }
  for (const field of socialmediaFields) {
    if (row[`display_socialmedia_${field}`] != null) socialmedia[field] = row[`display_socialmedia_${field}`];
  }
  const timings = taskSlots.map((index) => Object.fromEntries(taskTimingFields
    .filter((field) => row[`display_task_${index}_${field}`] != null)
    .map((field) => [field, row[`display_task_${index}_${field}`]])));
  while (timings.length && !Object.keys(timings.at(-1)!).length) timings.pop();
  if (timings.length) socialmedia.pendingImageTasks = timings;
  if (Object.keys(socialmedia).length) payload.socialmedia = socialmedia;
  return { ...row, payload_json: payload };
}

export function needsCompleteSessionDisplayRow(row: Record<string, unknown>): boolean {
  // Legacy video identity may exist only in videoModel/pending video tasks,
  // which the compact image display projection intentionally omits.
  const hasMediaIdentity = [row.source_use_case, row.output_type,
    row.display_payload_sourceUseCase, row.display_payload_outputType,
    row.display_socialmedia_sourceUseCase, row.display_socialmedia_outputType]
    .some(value => typeof value === "string" && value.trim().length > 0);
  // Older jobs may exceed today's four-image limit or carry both timing formats.
  // Read those complete payloads instead of guessing at their historical shape.
  return !hasMediaIdentity || row.display_task_overflow != null || row.display_socialmedia_pending_image_tasks != null;
}

export function isSettledSessionDisplayJob(row: Record<string, unknown>): boolean {
  // All other rows must be hydrated before the existing recovery code can run.
  return row.status === "completed" && row.stage === "completed"
    && Number(row.progress) >= 100 && Boolean(row.result_json);
}
