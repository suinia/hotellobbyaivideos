import { readRequestTriggerHostname } from "./trigger-hostname-request";
import { SESSION_DISPLAY_JOB_COLUMNS, isSettledSessionDisplayJob, needsCompleteSessionDisplayRow, restoreSessionDisplayJobRow } from "./session-display-projection";
import { assignQueuedImageModel } from "@/lib/socialmedia/image-model-experiment-job";
import { randomUUID } from "node:crypto";
import { readConsistentPersistedSessionJobs } from "./persisted-session-history";
import type { ChatStreamEvent } from "@/lib/chat/stream";
import { isGuestUserId } from "@/lib/auth/guest";
import { generateCompletionNote } from "@/lib/agent/completion-note";
import { countBillableImages } from "@/lib/billing/usage-pricing";
import { runConversion } from "@/lib/orchestrator";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseConfig } from "@/lib/supabase/config";
import { adoptSocialmediaMessages } from "@/lib/socialmedia/message-store";
import { materializeConversionResultImages, materializeDataImageUrlsDeep } from "@/lib/storage/generated-assets";
import type { UsageSnapshot } from "@/lib/llm/usage-tracker";
import { normalizeContentMode } from "@/lib/types/skills";
import { settleSocialmediaImageCredits } from "@/lib/socialmedia/billing";
import { trackRecoveredImageProviderFallbackStarted } from "@/lib/socialmedia/image-provider-telemetry";
import {
  buildStaleApimartRecoveryJobState,
  triggerImageFallbackAdvanceSoon
} from "@/lib/socialmedia/vectorengine-fallback";
import {
  IMAGE_PROVIDER_GENERATING_STAGE,
  isImageProviderCompletedStage,
  isImageProviderGeneratingStage
} from "@/lib/socialmedia/types";
import {
  hasRecoverableAsyncImageTask,
  isSocialmediaJobRecoveryStale,
  SOCIALMEDIA_IMAGE_FALLBACK_RECOVERY_STALE_AFTER_MS
} from "@/lib/socialmedia/vectorengine-recovery";
import { isVideoPersistenceRetryAllowed } from "@/lib/socialmedia/video-persistence-retry";
import { trackServerEvent } from "@/lib/telemetry/axiom";
import { resolveClaimedSessionOwnerReconciliation } from "@/lib/queue/session-owner-reconciliation";
import type {
  JobEvent,
  JobRecord,
  JobStatus,
  RevisePayload,
  SessionRecord,
  SessionVisibility,
  ShareRecord
} from "@/lib/types/job";
import {
  adoptGuestWorkspaceOwner as adoptLocalGuestWorkspaceOwner,
  chargeUsageForCompletedJob,
  clearAllSessions as clearLocalSessions,
  createConversationJob as createLocalConversationJob,
  createJob as createLocalJob,
  createQueuedJob as createLocalQueuedJob,
  createRevisionJob as createLocalRevisionJob,
  createSession as createLocalSession,
  createShare as createLocalShare,
  deleteSession as deleteLocalSession,
  appendJobEvent as appendLocalJobEvent,
  getJob as getLocalJob,
  getSession as getLocalSession,
  getShareByToken as getLocalShareByToken,
  listSessionJobs as listLocalSessionJobs,
  listSessions as listLocalSessions,
  patchQueuedJob as patchLocalQueuedJob,
  registerJobObserver,
  renameSession as renameLocalSession,
  setSessionAgentResponseId as setLocalSessionAgentResponseId,
  setSessionInputModeOverride as setLocalSessionInputModeOverride,
  saveJobPreflightEvents as saveLocalJobPreflightEvents,
  serializeJob,
  serializePublicJob,
  serializePublicSession,
  serializeSession,
  serializeSessionSummary
} from "@/lib/queue/job-store";
import { buildArtifactsForGenerate } from "@/lib/revision/engine";
import { getStaleJobAutoReplayAuthGateResult } from "@/lib/studio/generation-access";
import { isVideoGenerationSourceUseCase } from "@/lib/videos/source-use-case";

const activeJobSyncLoops = new Map<string, ReturnType<typeof setInterval>>();
const jobSyncSubscriptions = new Map<string, () => void>();
const immediateJobSyncs = new Map<string, Promise<void>>();
const managedLocalPatchSyncs = new Set<string>();
const JOB_SYNC_INTERVAL_MS = Math.max(
  5_000,
  Number(process.env.JOB_SYNC_INTERVAL_MS ?? 5_000) || 5_000
);
const JOB_SYNC_RETRY_DELAY_MS = 650;
const SESSION_AGENT_RESPONSE_ID_PERSIST_MAX_ATTEMPTS = Math.max(
  1,
  Number(process.env.SESSION_AGENT_RESPONSE_ID_PERSIST_MAX_ATTEMPTS ?? 3) || 3
);
const SESSION_AGENT_RESPONSE_ID_PERSIST_RETRY_DELAY_MS = Math.max(
  100,
  Number(process.env.SESSION_AGENT_RESPONSE_ID_PERSIST_RETRY_DELAY_MS ?? 300) || 300
);
const SESSION_INPUT_MODE_OVERRIDE_PERSIST_MAX_ATTEMPTS = Math.max(
  1,
  Number(process.env.SESSION_INPUT_MODE_OVERRIDE_PERSIST_MAX_ATTEMPTS ?? 3) || 3
);
const SESSION_INPUT_MODE_OVERRIDE_PERSIST_RETRY_DELAY_MS = Math.max(
  100,
  Number(process.env.SESSION_INPUT_MODE_OVERRIDE_PERSIST_RETRY_DELAY_MS ?? 300) || 300
);
const QUEUE_STORE_DEBUG_TIMINGS_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.SOCIALMEDIA_DEBUG_TIMINGS === "1" || process.env.QUEUE_STORE_DEBUG_TIMINGS === "1";
const REMOTE_STALE_FINALIZING_MAX_MS = 3 * 60 * 1000;
const REMOTE_STALE_RUNNING_MAX_MS = 10 * 60 * 1000;
const REMOTE_SOCIALMEDIA_STALE_GENERATING_MAX_MS = Math.max(
  60 * 1000,
  Number(process.env.REMOTE_SOCIALMEDIA_STALE_GENERATING_MAX_MS ?? REMOTE_STALE_RUNNING_MAX_MS)
    || REMOTE_STALE_RUNNING_MAX_MS
);
const REMOTE_AUTO_REPLAY_MAX_ATTEMPTS = 1;
const GUEST_OWNER_RESOLUTION_CACHE_TTL_MS = Math.max(
  0,
  Number(process.env.GUEST_OWNER_RESOLUTION_CACHE_TTL_MS ?? 60_000) || 60_000
);

const guestOwnerResolutionCache = new Map<string, { owner: OwnerScope; expiresAt: number }>();

type QueueStoreTiming = {
  name: string;
  durationMs: number;
  rowCount?: number;
};

export type JobSupabaseSyncResult = {
  enabled: boolean;
  ok: boolean;
  attempts: number;
  error?: string;
};

export type PatchQueuedJobSyncOptions = {
  attempts?: number;
  retryDelayMs?: number;
  operation?: string;
  syncSession?: boolean;
  syncSessionLastJob?: boolean;
  assumeNewJob?: boolean;
};

export type PatchQueuedJobResult = {
  job: JobRecord | null;
  sync: JobSupabaseSyncResult;
};

export type ClaimQueuedJobStageTransitionParams = {
  jobId: string;
  ownerUserId?: string;
  fromStatus: JobStatus;
  fromStage: string;
  expectedPendingImageTaskId?: string;
  expectedUpdatedAt?: string;
  toStatus?: JobStatus;
  toStage: string;
  progress?: number;
  payload?: JobRecord["payload"];
  result?: JobRecord["result"];
  error?: string | null;
};

type OwnerScope = {
  id: string;
  column: "user_id" | "guest_user_id";
  userId: string | null;
  guestUserId: string | null;
};

export type JobAssetRecoveryRow = {
  id: string;
  storage_bucket: string | null;
  storage_path: string | null;
  public_url: string | null;
  access_variant: "original" | "watermarked" | null;
  watermarked_storage_path: string | null;
  watermarked_mime_type: string | null;
  watermarked_size_bytes: number | null;
  watermark_brand: string | null;
  meta_json: Record<string, unknown> | null;
  created_at: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveOwnerScope(ownerUserId?: string): OwnerScope | null {
  const normalized = ownerUserId?.trim();
  if (!normalized) return null;
  if (isGuestUserId(normalized)) {
    return {
      id: normalized,
      column: "guest_user_id",
      userId: null,
      guestUserId: normalized
    };
  }
  if (!UUID_PATTERN.test(normalized)) return null;
  return {
    id: normalized,
    column: "user_id",
    userId: normalized,
    guestUserId: null
  };
}

async function resolvePersistOwnerScope(ownerUserId?: string): Promise<OwnerScope | null> {
  const owner = resolveOwnerScope(ownerUserId);
  if (!owner || owner.column !== "guest_user_id" || !owner.guestUserId || !supabaseConfig.adminEnabled) {
    return owner;
  }

  const cached = guestOwnerResolutionCache.get(owner.guestUserId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.owner;
  }

  try {
    const { data, error } = await getSupabaseAdminClient()
      .from("guest_accounts")
      .select("claimed_user_id")
      .eq("id", owner.guestUserId)
      .maybeSingle();

    if (error) {
      console.warn("[store] failed to resolve claimed guest owner", {
        guestUserId: owner.guestUserId,
        error: error.message
      });
      return owner;
    }

    const claimedUserId = readString((data as Record<string, unknown> | null)?.claimed_user_id).trim();
    if (!UUID_PATTERN.test(claimedUserId)) {
      // An unclaimed result is mutable: a concurrent auth request can bind and
      // migrate this guest immediately after this read. Never negative-cache it,
      // or an in-flight generator could write guest ownership back after claim.
      return owner;
    }

    const resolved = resolveOwnerScope(claimedUserId) ?? owner;
    guestOwnerResolutionCache.set(owner.guestUserId, {
      owner: resolved,
      expiresAt: Date.now() + GUEST_OWNER_RESOLUTION_CACHE_TTL_MS
    });
    return resolved;
  } catch (error) {
    console.warn("[store] failed to resolve claimed guest owner", {
      guestUserId: owner.guestUserId,
      error: error instanceof Error ? error.message : String(error)
    });
    return owner;
  }
}

function isSupabaseOwnerSupported(ownerUserId?: string): boolean {
  const normalized = ownerUserId?.trim();
  if (!normalized) return true;
  return Boolean(resolveOwnerScope(normalized));
}

function isSupabaseStoreEnabled(ownerUserId?: string): boolean {
  return supabaseConfig.adminEnabled && isSupabaseOwnerSupported(ownerUserId);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyOwnerFilter<T extends { eq: (column: string, value: string) => T }>(query: T, owner: OwnerScope): T {
  return query.eq(owner.column, owner.id);
}

function applyNotDeletedSessionFilter<T extends { is: (column: string, value: null) => T }>(query: T): T {
  return query.is("deleted_at", null);
}

function isMissingDeletedAtColumnError(error: unknown): boolean {
  const message = error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : String(error ?? "");
  const normalized = message.toLowerCase();
  return normalized.includes("sessions.deleted_at") && normalized.includes("does not exist");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isAgentLifecycleJob(job: JobRecord): boolean {
  const socialmedia = asRecord(job.payload.socialmedia);
  return socialmedia?.agentRequest === true;
}

function agentLifecycleEventTitle(job: JobRecord): string {
  if (job.status === "failed") return "Agent task failed";
  if (job.status === "completed") return "Agent task completed";
  switch (job.stage) {
    case "queued":
      return "Agent task queued";
    case "generating_images":
    case IMAGE_PROVIDER_GENERATING_STAGE:
    case "vectorengine_generating":
      return "Generating image";
    case "apimart_polling":
      return "Waiting for image provider";
    case "persisting_assets":
      return "Saving generated assets";
    case "finalizing_video":
      return "Finalizing generated video";
    default:
      return `Agent task stage: ${job.stage}`;
  }
}

function buildAgentLifecycleEvent(job: JobRecord): Omit<JobEvent, "id" | "index" | "createdAt"> {
  return {
    stage: job.stage,
    title: agentLifecycleEventTitle(job),
    thought: "",
    action: job.status === "failed" ? "Stop generation and report the failure." : "Advance the agent generation workflow.",
    outputPreview: job.status === "failed" ? normalizePreviewText(job.error ?? "Generation failed") : undefined,
    durationSec: 0,
    costUsd: 0
  };
}

function shouldAppendAgentLifecycleEvent(previous: JobRecord | null, next: JobRecord): boolean {
  if (!isAgentLifecycleJob(next)) return false;
  if (!previous) return true;
  return previous.status !== next.status || previous.stage !== next.stage;
}

function appendAgentLifecycleEvent(
  previous: JobRecord | null,
  next: JobRecord,
  ownerUserId?: string
): JobRecord {
  if (!shouldAppendAgentLifecycleEvent(previous, next)) return next;

  const event = buildAgentLifecycleEvent(next);
  const localJob = appendLocalJobEvent(next.id, event, next.ownerUserId ?? ownerUserId);
  if (localJob) return localJob;

  // A serverless worker can advance a job that is not hydrated into the local
  // store. Keep the event on the fetched record so the following Supabase sync
  // persists it rather than silently dropping the lifecycle transition.
  return {
    ...next,
    events: [
      ...next.events,
      {
        ...event,
        id: randomUUID(),
        index: next.events.length + 1,
        createdAt: new Date().toISOString()
      }
    ]
  };
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readOptionalNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizePreviewText(value: string, maxLength = 180): string {
  const normalized = value
    .replace(/[#*_`>\[\]\(\)]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function timeQueueStoreStep<T>(
  timings: QueueStoreTiming[] | undefined,
  name: string,
  fn: () => PromiseLike<T>,
  getRowCount?: (value: T) => number | undefined
): Promise<T> {
  if (!timings) return fn();
  const startedAt = Date.now();
  try {
    const value = await fn();
    timings.push({
      name,
      durationMs: Date.now() - startedAt,
      rowCount: getRowCount?.(value)
    });
    return value;
  } catch (error) {
    timings.push({
      name,
      durationMs: Date.now() - startedAt
    });
    throw error;
  }
}

function logQueueStoreTimings(
  name: string,
  startedAt: number,
  meta: Record<string, unknown>,
  timings: QueueStoreTiming[]
): void {
  if (!QUEUE_STORE_DEBUG_TIMINGS_ENABLED) return;
  const durationMs = Date.now() - startedAt;
  if (durationMs < 500 && process.env.QUEUE_STORE_DEBUG_TIMINGS !== "1") return;
  console.info(`[queue-store] ${name}`, {
    ...meta,
    durationMs,
    timings
  });
}

function extractResultPreview(result: unknown): string {
  const record = asRecord(result);
  if (!record) return "";

  const title = readOptionalString(record.post_title);
  const caption = readOptionalString(record.post_caption);
  const slideQuote = asArray(record.slides)
    .map((item) => asRecord(item))
    .find(Boolean);
  const quote = readOptionalString(slideQuote?.content_quote);

  return normalizePreviewText([title, caption, quote].filter(Boolean).join(" "));
}

function buildJobPreview(job: Pick<JobRecord, "payload" | "result" | "events" | "error">): string {
  const lastEvent = job.events[job.events.length - 1];
  return (
    extractResultPreview(job.result) ||
    normalizePreviewText(job.payload.completionNote ?? "") ||
    normalizePreviewText(job.payload.conversation?.assistantReply ?? "") ||
    normalizePreviewText(job.payload.inputText) ||
    normalizePreviewText(job.payload.sourceInputText ?? "") ||
    normalizePreviewText(lastEvent?.outputPreview ?? "") ||
    normalizePreviewText(job.error ?? "")
  );
}

function buildJobPreviewFromRow(row: Record<string, unknown>): string {
  const payload = asRecord(row.payload_json) ?? {};
  return (
    extractResultPreview(row.result_json) ||
    normalizePreviewText(readString(payload.completionNote)) ||
    normalizePreviewText(readString(asRecord(payload.conversation)?.assistantReply)) ||
    normalizePreviewText(readString(row.input_text, readString(payload.inputText))) ||
    normalizePreviewText(readString(row.source_input_text, readString(payload.sourceInputText))) ||
    normalizePreviewText(readString(row.error_text))
  );
}

function readJobStatus(value: unknown): JobStatus {
  const normalized = readString(value).toLowerCase();
  if (normalized === "queued" || normalized === "running" || normalized === "completed" || normalized === "failed") {
    return normalized;
  }
  return "failed";
}

function normalizeOwnerUserId(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseAspectRatios(value: unknown): Array<"4:5" | "9:16" | "1:1" | "16:9"> {
  if (!Array.isArray(value)) return ["4:5", "1:1"];
  const allowed = new Set(["4:5", "9:16", "1:1", "16:9"]);
  const parsed = value
    .map((item) => String(item))
    .filter((item): item is "4:5" | "9:16" | "1:1" | "16:9" => allowed.has(item));
  return parsed.length ? parsed : ["4:5", "1:1"];
}

function mapSessionRow(row: Record<string, unknown>): SessionRecord {
  return {
    id: readString(row.id),
    ownerUserId: readOptionalString(row.user_id) ?? readOptionalString(row.guest_user_id),
    title: readString(row.title, "Session"),
    sourceUseCase: readOptionalString(row.source_use_case),
    agentResponseId: readOptionalString(row.agent_response_id),
    inputModeOverride: (() => {
      const inputModeOverride = readOptionalString(row.input_mode_override);
      return inputModeOverride === "pipeline" || inputModeOverride === "agent"
        ? inputModeOverride
        : undefined;
    })(),
    createdAt: readString(row.created_at, new Date().toISOString()),
    updatedAt: readString(row.updated_at, new Date().toISOString()),
    lastJobId: readOptionalString(row.last_job_id),
    deletedAt: readOptionalString(row.deleted_at)
  };
}

function mapEventsByJob(rows: Array<Record<string, unknown>>): Map<string, JobEvent[]> {
  const grouped = new Map<string, JobEvent[]>();
  const sorted = [...rows].sort((a, b) => {
    const left = new Date(readString(a.created_at)).getTime();
    const right = new Date(readString(b.created_at)).getTime();
    return left - right;
  });

  for (const row of sorted) {
    const jobId = readString(row.job_id);
    const list = grouped.get(jobId) ?? [];
    list.push({
      id: readString(row.id),
      index: list.length + 1,
      stage: readString(row.stage, "unknown"),
      title: readString(row.title, "step"),
      thought: readString(row.thought),
      action: readString(row.action),
      outputPreview: readOptionalString(row.output_preview),
      durationSec: readNumber(row.duration_sec, 0),
      costUsd: readNumber(row.cost_usd, 0),
      tokenInput: readOptionalNumber(row.token_input),
      tokenOutput: readOptionalNumber(row.token_output),
      tokenTotal: readOptionalNumber(row.token_total),
      createdAt: readString(row.created_at, new Date().toISOString())
    });
    grouped.set(jobId, list);
  }

  return grouped;
}

function mapJobRow(row: Record<string, unknown>, events: JobEvent[]): JobRecord {
  const payloadRaw = asRecord(row.payload_json) ?? {};

  const revisePayloadRaw = asRecord(payloadRaw.revisePayload);
  const revisePayload: RevisePayload | undefined = revisePayloadRaw
    ? {
        intent:
          revisePayloadRaw.intent === "regenerate_cover" || revisePayloadRaw.intent === "regenerate_slides"
            ? revisePayloadRaw.intent
            : "rewrite_copy_style",
        instruction: readString(revisePayloadRaw.instruction, "Revise"),
        sourceText: readString(revisePayloadRaw.sourceText),
        editableFields: Array.isArray(revisePayloadRaw.editableFields)
          ? revisePayloadRaw.editableFields
              .map((item) => String(item))
              .filter((item): item is "post_title" | "post_caption" | "hashtags" | "slides" =>
                item === "post_title" || item === "post_caption" || item === "hashtags" || item === "slides"
              )
          : ["slides"],
        preserveFacts: revisePayloadRaw.preserveFacts !== false,
        preserveSlideStructure: revisePayloadRaw.preserveSlideStructure !== false,
        scope: {
          slideIds: Array.isArray(asRecord(revisePayloadRaw.scope)?.slideIds)
            ? (asRecord(revisePayloadRaw.scope)?.slideIds as unknown[]).map((item) => Number(item)).filter(Number.isFinite)
            : [],
          fields: Array.isArray(asRecord(revisePayloadRaw.scope)?.fields)
            ? (asRecord(revisePayloadRaw.scope)?.fields as unknown[]).map((item) => String(item))
            : []
        },
        options: {
          mode: asRecord(revisePayloadRaw.options)?.mode === "reprompt" ? "reprompt" : "same_prompt_new_seed",
          seed: readOptionalNumber(asRecord(revisePayloadRaw.options)?.seed),
          preserveLayout: asRecord(revisePayloadRaw.options)?.preserveLayout !== false
        }
      }
    : undefined;

  const artifacts = Array.isArray(payloadRaw.artifacts) ? payloadRaw.artifacts : [];
  const changedArtifacts = Array.isArray(payloadRaw.changed_artifacts)
    ? payloadRaw.changed_artifacts.map((item) => String(item))
    : [];
  const rerunPlan = asRecord(payloadRaw.rerun_plan);

  return {
    id: readString(row.id),
    ownerUserId: readOptionalString(row.user_id) ?? readOptionalString(row.guest_user_id),
    triggerHostname: readOptionalString(row.trigger_hostname),
    sessionId: readString(row.session_id),
    turnIndex: Math.max(1, Math.round(readNumber(row.turn_index, 1))),
    revision: Math.max(1, Math.round(readNumber(row.revision, 1))),
    mode: readString(row.mode) === "revise" ? "revise" : "generate",
    baseJobId: readOptionalString(row.base_job_id) ?? readString(row.id),
    parentJobId: readOptionalString(row.parent_job_id),
    revisionIntent:
      payloadRaw.revision_intent === "regenerate_cover" || payloadRaw.revision_intent === "regenerate_slides"
        ? payloadRaw.revision_intent
        : payloadRaw.revision_intent === "rewrite_copy_style"
          ? "rewrite_copy_style"
          : undefined,
    sourceUseCase: readOptionalString(row.source_use_case) ?? readOptionalString(payloadRaw.sourceUseCase),
    outputType: readOptionalString(row.output_type) ?? readOptionalString(payloadRaw.outputType),
    status: readJobStatus(row.status),
    progress: Math.max(0, Math.min(100, Math.round(readNumber(row.progress, 0)))),
    stage: readString(row.stage, "queued"),
    events,
    rerunPlan: rerunPlan
      ? {
          selectedSkills: Array.isArray(rerunPlan.selectedSkills)
            ? rerunPlan.selectedSkills.map((item) => String(item))
            : [],
          reusedSkills: Array.isArray(rerunPlan.reusedSkills)
            ? rerunPlan.reusedSkills.map((item) => String(item))
            : [],
          reason: readString(rerunPlan.reason)
        }
      : undefined,
    changedArtifacts,
    artifacts: artifacts as JobRecord["artifacts"],
    payload: {
      inputText: readString(row.input_text, readString(payloadRaw.inputText)),
      batchId: readOptionalString(payloadRaw.batchId),
      requestVariant:
        payloadRaw.requestVariant === "single_platform" || payloadRaw.requestVariant === "multi_platform_batch"
          ? payloadRaw.requestVariant
          : undefined,
      inputPreprocessed: payloadRaw.inputPreprocessed === true,
      autoReplayCount: readOptionalNumber(payloadRaw.autoReplayCount),
      sourceInputText: readOptionalString(row.source_input_text) ?? readOptionalString(payloadRaw.sourceInputText),
      sourceType: payloadRaw.sourceType === "url" || payloadRaw.sourceType === "text" ? payloadRaw.sourceType : undefined,
      sourceUrl: readOptionalString(payloadRaw.sourceUrl),
      sourceTitle: readOptionalString(payloadRaw.sourceTitle),
      targetSlides: readOptionalNumber(payloadRaw.targetSlides),
      aspectRatios: parseAspectRatios(payloadRaw.aspectRatios),
      platform:
        payloadRaw.platform === "x" ||
        payloadRaw.platform === "instagram" ||
        payloadRaw.platform === "linkedin" ||
        payloadRaw.platform === "tiktok"
          ? payloadRaw.platform
          : undefined,
      format:
        payloadRaw.format === "carousel" || payloadRaw.format === "post" || payloadRaw.format === "thread"
          ? "carousel"
          : undefined,
      imageCount: readOptionalNumber(payloadRaw.imageCount),
      audience: readOptionalString(payloadRaw.audience),
      promptHint: readOptionalString(payloadRaw.promptHint),
      writingPolicy: asRecord(payloadRaw.writingPolicy)
        ? {
            voice: readString(asRecord(payloadRaw.writingPolicy)?.voice),
            opening: readString(asRecord(payloadRaw.writingPolicy)?.opening),
            slideRhythm: readString(asRecord(payloadRaw.writingPolicy)?.slideRhythm),
            caption: readString(asRecord(payloadRaw.writingPolicy)?.caption),
            cta: readString(asRecord(payloadRaw.writingPolicy)?.cta),
            hashtags: readString(asRecord(payloadRaw.writingPolicy)?.hashtags),
            avoid: Array.isArray(asRecord(payloadRaw.writingPolicy)?.avoid)
              ? (asRecord(payloadRaw.writingPolicy)?.avoid as unknown[]).map((item) => String(item)).filter(Boolean)
              : []
          }
        : undefined,
      stylePreset: readString(payloadRaw.stylePreset, "auto"),
      tone: readString(payloadRaw.tone, "auto"),
      outputLanguage: readString(payloadRaw.outputLanguage, "en-US"),
      generationMode: payloadRaw.generationMode === "standard" ? "standard" : "quote_slides",
      contentMode:
        payloadRaw.contentMode === "product_marketing" || payloadRaw.contentMode === "trend_hotspot"
          ? payloadRaw.contentMode
          : "longform_digest",
      reviewMode: payloadRaw.reviewMode === "required" ? "required" : "auto",
      sourceUseCase: readOptionalString(row.source_use_case) ?? readOptionalString(payloadRaw.sourceUseCase),
      outputType: readOptionalString(row.output_type) ?? readOptionalString(payloadRaw.outputType),
      conversation: asRecord(payloadRaw.conversation)
        ? {
            assistantReply: readString(asRecord(payloadRaw.conversation)?.assistantReply),
            suggestedTask: readOptionalString(asRecord(payloadRaw.conversation)?.suggestedTask)
          }
        : undefined,
      preflightEvents: Array.isArray(payloadRaw.preflightEvents)
        ? (payloadRaw.preflightEvents as ChatStreamEvent[])
        : undefined,
      completionNote: readOptionalString(payloadRaw.completionNote),
      revisePayload,
      workflow: readOptionalString(payloadRaw.workflow),
      socialmedia: payloadRaw.socialmedia
    },
    result: (row.result_json as JobRecord["result"]) ?? undefined,
    error: readOptionalString(row.error_text),
    createdAt: readString(row.created_at, new Date().toISOString()),
    updatedAt: readString(row.updated_at, new Date().toISOString())
  };
}

function compareJobs(left: JobRecord, right: JobRecord): number {
  const turnDelta = left.turnIndex - right.turnIndex;
  if (turnDelta !== 0) return turnDelta;
  const revisionDelta = (left.revision ?? 1) - (right.revision ?? 1);
  if (revisionDelta !== 0) return revisionDelta;
  return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
}

function applySessionLimit(items: SessionRecord[], limit?: number): SessionRecord[] {
  if (!Number.isFinite(limit) || !limit || limit < 1) {
    return items;
  }
  return items.slice(0, Math.max(1, Math.floor(limit)));
}

function normalizeSearchQuery(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function mergeJobs(primary: JobRecord[], secondary: JobRecord[]): JobRecord[] {
  const byId = new Map<string, JobRecord>();
  for (const item of secondary) {
    byId.set(item.id, item);
  }
  for (const item of primary) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }
    byId.set(item.id, chooseMergedJob(item, existing));
  }

  return [...byId.values()].sort(compareJobs);
}

function isTerminalJobStatus(status: JobStatus): boolean {
  return status === "completed" || status === "failed";
}

function chooseMergedJob(left: JobRecord, right: JobRecord): JobRecord {
  const leftTerminal = isTerminalJobStatus(left.status);
  const rightTerminal = isTerminalJobStatus(right.status);
  if (leftTerminal !== rightTerminal) {
    return leftTerminal ? left : right;
  }
  const leftUpdatedAt = new Date(left.updatedAt).getTime();
  const rightUpdatedAt = new Date(right.updatedAt).getTime();
  if (!Number.isFinite(leftUpdatedAt)) return right;
  if (!Number.isFinite(rightUpdatedAt)) return left;
  return leftUpdatedAt >= rightUpdatedAt ? left : right;
}

function canAutoReplayGenerateJob(job: JobRecord): boolean {
  return (
    job.mode === "generate" &&
    job.payload.workflow !== "socialmedia" &&
    !job.payload.socialmedia &&
    !job.result &&
    !job.payload.conversation?.assistantReply?.trim() &&
    (job.payload.autoReplayCount ?? 0) < REMOTE_AUTO_REPLAY_MAX_ATTEMPTS
  );
}

function getRemoteStaleRunningMaxMs(job: JobRecord): number {
  if (job.payload.socialmedia && job.stage === "generating_images") {
    return REMOTE_SOCIALMEDIA_STALE_GENERATING_MAX_MS;
  }
  return REMOTE_STALE_RUNNING_MAX_MS;
}

function isSocialmediaAsyncImageStage(stage: string): boolean {
  return (
    stage === "generating_images" ||
    stage === "generating_videos" ||
    stage === "submitting_video" ||
    stage === "apimart_polling" ||
    stage === "apimart_video_keyframe_polling" ||
    stage === "apimart_video_polling" ||
    isImageProviderGeneratingStage(stage) ||
    isImageProviderCompletedStage(stage)
  );
}

function isSocialmediaAsyncVideoStage(stage: string): boolean {
  return (
    stage === "generating_videos" ||
    stage === "submitting_video" ||
    stage === "apimart_video_keyframe_polling" ||
    stage === "apimart_video_polling" ||
    stage === "persisting_assets" ||
    stage === "finalizing_video"
  );
}

function hasSocialmediaPendingImageTask(job: JobRecord): boolean {
  const socialmedia = asRecord(job.payload.socialmedia);
  const tasks = socialmedia?.pendingImageTasks;
  if (!Array.isArray(tasks)) return false;

  return tasks.some((task) => {
    const record = asRecord(task);
    if (!record) return false;
    const status = readString(record.status);
    return status === "submitted" || status === "polling";
  });
}

function hasSocialmediaVideoTask(job: Pick<JobRecord, "payload">): boolean {
  const socialmedia = asRecord(job.payload.socialmedia);
  if (!socialmedia) return false;
  if (asRecord(socialmedia.pendingVideoTask)) return true;
  const keyframeTasks = socialmedia.pendingVideoKeyframeTasks;
  if (Array.isArray(keyframeTasks) && keyframeTasks.length > 0) return true;
  return readString(socialmedia.sourceUseCase) === "ai-video-generator"
    || readString(socialmedia.videoModel).length > 0
    || readString(socialmedia.outputType) === "video";
}

function hasCompletedPendingVideoForPersist(job: JobRecord): boolean {
  if (job.result) return false;
  const socialmedia = asRecord(job.payload.socialmedia);
  const pendingVideoTask = asRecord(socialmedia?.pendingVideoTask);
  const generatedVideos = pendingVideoTask?.generatedVideos;
  const status = readString(pendingVideoTask?.status);
  return Array.isArray(generatedVideos)
    && generatedVideos.length > 0
    && (
      status === "completed"
      || (status === "failed" && isVideoPersistenceRetryAllowed({
        lastError: readString(pendingVideoTask?.lastError),
        persistenceAttempts: Number(pendingVideoTask?.persistenceAttempts) || 0
      }))
    );
}

function buildPendingVideoPersistRecoveryJobState(job: JobRecord, now: number): JobRecord {
  return {
    ...job,
    status: "running",
    stage: "persisting_assets",
    progress: Math.max(job.progress, 95),
    error: undefined,
    updatedAt: new Date(now).toISOString()
  };
}

function toReplayRequest(payload: JobRecord["payload"]) {
  return {
    inputText: payload.sourceInputText ?? payload.inputText,
    inputPreprocessed: payload.inputPreprocessed === true,
    targetSlides: payload.targetSlides,
    aspectRatios: payload.aspectRatios ?? ["4:5"],
    platform: payload.platform,
    format: payload.format,
    imageCount: payload.imageCount,
    tone: payload.tone ?? "auto",
    outputLanguage: payload.outputLanguage ?? "en-US",
    generationMode: payload.generationMode ?? "standard",
    contentMode: normalizeContentMode(payload.contentMode),
    sourceType: payload.sourceType,
    sourceUrl: payload.sourceUrl,
    sourceTitle: payload.sourceTitle,
    reviewMode: payload.reviewMode,
    brand: {
      stylePreset: payload.stylePreset ?? "auto"
    }
  };
}

async function upsertReplayEvent(params: {
  jobId: string;
  ownerUserId?: string;
  stage: string;
  title: string;
  outputPreview?: string;
}) {
  const owner = await resolvePersistOwnerScope(params.ownerUserId);
  if (!owner) return;
  const client = getSupabaseAdminClient();
  await client.from("job_events").insert({
    id: randomUUID(),
    job_id: params.jobId,
    user_id: owner.userId,
    guest_user_id: owner.guestUserId,
    stage: params.stage,
    title: params.title,
    thought: "",
    action: "",
    output_preview: params.outputPreview ?? null,
    duration_sec: 0,
    cost_usd: 0,
    token_input: null,
    token_output: null,
    token_total: null,
    created_at: new Date().toISOString()
  });
}

async function startSupabaseAutoReplay(job: JobRecord): Promise<void> {
  const client = getSupabaseAdminClient();

  await upsertReplayEvent({
    jobId: job.id,
    ownerUserId: job.ownerUserId,
    stage: "auto_replay_pending",
    title: "Auto replay started",
    outputPreview: "Re-running stale generation automatically."
  });

  try {
    const conversion = await runConversion(
      toReplayRequest(job.payload),
      async (stage, progress, outputPreview) => {
        const updatedAt = new Date().toISOString();
        let query = client
          .from("jobs")
          .update({
            status: "running",
            stage,
            progress,
            updated_at: updatedAt
          })
          .eq("id", job.id);
        const owner = resolveOwnerScope(job.ownerUserId);
        if (owner) {
          query = applyOwnerFilter(query, owner);
        }
        await query;

        await upsertReplayEvent({
          jobId: job.id,
          ownerUserId: job.ownerUserId,
          stage,
          title: stage,
          outputPreview
        });
      },
      async (stage, progress) => {
        const updatedAt = new Date().toISOString();
        let query = client
          .from("jobs")
          .update({
            status: "running",
            stage,
            progress,
            updated_at: updatedAt
          })
          .eq("id", job.id);
        const owner = resolveOwnerScope(job.ownerUserId);
        if (owner) {
          query = applyOwnerFilter(query, owner);
        }
        await query;
      }
    );

    const result = await materializeConversionResultImages(conversion.result, job.ownerUserId);
    const artifacts = await materializeDataImageUrlsDeep(
      buildArtifactsForGenerate({
        result,
        inputText: job.payload.sourceInputText ?? job.payload.inputText,
        revision: job.revision ?? 1,
        jobId: job.id,
        baseJobId: job.baseJobId || job.id
      }),
      job.ownerUserId
    );
    const completionNote = await generateCompletionNote({
      changeScope: "initial_delivery",
      userRequest: job.payload.inputText,
      result,
      outputLanguage: job.payload.outputLanguage
    }).catch(() => undefined);
    const finishedAt = new Date().toISOString();

    let completionQuery = client
      .from("jobs")
      .update({
        status: "completed",
        stage: "completed",
        progress: 100,
        result_json: result,
        payload_json: {
          ...encodePayloadForSupabase({
            ...job,
            result,
            payload: {
              ...job.payload,
              completionNote
            },
            artifacts
          }),
          completionNote: completionNote ?? null,
          artifacts,
          autoReplayCount: job.payload.autoReplayCount ?? 0
        },
        error_text: null,
        token_input: conversion.usage.inputTokens,
        token_output: conversion.usage.outputTokens,
        token_total: conversion.usage.totalTokens,
        cost_usd: conversion.usage.costUsd,
        updated_at: finishedAt,
        finished_at: finishedAt
      })
      .eq("id", job.id);
    const owner = resolveOwnerScope(job.ownerUserId);
    if (owner) {
      completionQuery = applyOwnerFilter(completionQuery, owner);
    }
    await completionQuery;

    await chargeUsageForCompletedJob({
      ownerUserId: job.ownerUserId,
      jobId: job.id,
      usage: conversion.usage,
      imageCount: countBillableImages(result),
      note: "generate usage"
    });

    await upsertReplayEvent({
      jobId: job.id,
      ownerUserId: job.ownerUserId,
      stage: "completed",
      title: "Auto replay completed",
      outputPreview: completionNote ?? `Replay completed with ${countBillableImages(result)} images.`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auto replay failed";
    const failedAt = new Date().toISOString();
    let failedQuery = client
      .from("jobs")
      .update({
        status: "failed",
        stage: "failed",
        progress: 100,
        error_text: message,
        updated_at: failedAt,
        finished_at: failedAt
      })
      .eq("id", job.id);
    const owner = resolveOwnerScope(job.ownerUserId);
    if (owner) {
      failedQuery = applyOwnerFilter(failedQuery, owner);
    }
    await failedQuery;

    await upsertReplayEvent({
      jobId: job.id,
      ownerUserId: job.ownerUserId,
      stage: "auto_replay_failed",
      title: "Auto replay failed",
      outputPreview: message
    });
  }
}

function buildRecoveredJobState(job: JobRecord): JobRecord | null {
  const now = Date.now();
  const updatedAtMs = new Date(job.updatedAt).getTime();
  const ageMs = Number.isFinite(updatedAtMs) ? Math.max(0, now - updatedAtMs) : REMOTE_STALE_RUNNING_MAX_MS + 1;
  const isConversationJob = Boolean(job.payload.conversation?.assistantReply?.trim());

  if (job.result) {
    if (job.status !== "completed" || job.stage !== "completed" || job.progress < 100) {
      return {
        ...job,
        status: "completed",
        stage: "completed",
        progress: 100,
        error: undefined,
        updatedAt: new Date(now).toISOString()
      };
    }
    return null;
  }

  if (isConversationJob) {
    if (job.status !== "completed" || job.stage !== "completed" || job.progress < 100 || job.error) {
      return {
        ...job,
        status: "completed",
        stage: "completed",
        progress: 100,
        error: undefined,
        updatedAt: new Date(now).toISOString()
      };
    }
    return null;
  }

  if (hasRecoverableAsyncImageTask(job)) return null;

  if (job.status === "completed") {
    return hasCompletedPendingVideoForPersist(job)
      ? buildPendingVideoPersistRecoveryJobState(job, now)
      : {
          ...job,
          status: "failed",
          stage: "failed",
          progress: 100,
          error: job.error ?? "Task finished without result payload. Likely interrupted before final write.",
          updatedAt: new Date(now).toISOString()
        };
  }

  if (job.status === "failed") {
    const completedVideoRecovery = hasCompletedPendingVideoForPersist(job)
      ? buildPendingVideoPersistRecoveryJobState(job, now)
      : null;
    if (completedVideoRecovery) {
      return completedVideoRecovery;
    }

    const failedApimartRecovery = buildStaleApimartRecoveryJobState(job, now);
    if (failedApimartRecovery) {
      return failedApimartRecovery;
    }
  }

  if ((job.status === "running" || job.status === "queued") && ageMs >= getRemoteStaleRunningMaxMs(job)) {
    const completedVideoRecovery = hasCompletedPendingVideoForPersist(job)
      ? buildPendingVideoPersistRecoveryJobState(job, now)
      : null;
    if (completedVideoRecovery) {
      return completedVideoRecovery;
    }

    const staleApimartRecovery = buildStaleApimartRecoveryJobState(job, now);
    if (staleApimartRecovery) {
      return staleApimartRecovery;
    }

    if (job.payload.socialmedia && isSocialmediaAsyncImageStage(job.stage) && (
      hasSocialmediaPendingImageTask(job)
      || (isSocialmediaAsyncVideoStage(job.stage) && hasSocialmediaVideoTask(job))
    )) {
      return null;
    }

    const staleReplayAuthGate = canAutoReplayGenerateJob(job)
      ? getStaleJobAutoReplayAuthGateResult({
          ownerUserId: job.ownerUserId,
          format: job.payload.format,
          imageCount: job.payload.imageCount
        })
      : null;

    if (staleReplayAuthGate) {
      return {
        ...job,
        status: "failed",
        stage: "failed",
        progress: 100,
        error: staleReplayAuthGate.payload.error,
        updatedAt: new Date(now).toISOString()
      };
    }

    if (canAutoReplayGenerateJob(job)) {
      return {
        ...job,
        status: "running",
        stage: "auto_replay_pending",
        progress: 1,
        error: undefined,
        payload: {
          ...job.payload,
          autoReplayCount: (job.payload.autoReplayCount ?? 0) + 1
        },
        updatedAt: new Date(now).toISOString()
      };
    }

    const finalizingStuck = job.progress >= 100 && ageMs >= REMOTE_STALE_FINALIZING_MAX_MS;
    return {
      ...job,
      status: "failed",
      stage: "failed",
      progress: Math.max(job.progress, finalizingStuck ? 100 : job.progress),
      error: job.error
        ?? (finalizingStuck
          ? "Task was stuck at finalization and has been auto-recovered as failed."
          : job.payload.socialmedia && job.stage === "generating_images"
            ? "Social media image generation was interrupted before a recoverable image task was recorded."
          : "Task exceeded stale timeout and has been auto-recovered as failed."),
      updatedAt: new Date(now).toISOString()
    };
  }

  if (job.payload.socialmedia && isSocialmediaAsyncImageStage(job.stage)) {
    return null;
  }

  return null;
}

function buildSocialmediaResultFromAssetRows(job: JobRecord, assetRows: JobAssetRecoveryRow[]): JobRecord["result"] | null {
  const socialmedia = asRecord(job.payload.socialmedia);
  if (!socialmedia || !assetRows.length) return null;

  const images = assetRows.map((row, index) => {
    const meta = asRecord(row.meta_json) ?? {};
    return {
      assetId: row.id,
      bucket: readString(row.storage_bucket),
      path: readString(row.storage_path),
      url: readString(row.public_url),
      mimeType: readString(meta.served_mime_type, readString(row.watermarked_mime_type, readString(meta.mime_type, "image/png"))),
      width: readOptionalNumber(meta.width) ?? null,
      height: readOptionalNumber(meta.height) ?? null,
      sizeBytes: readOptionalNumber(meta.served_size_bytes)
        ?? readOptionalNumber(row.watermarked_size_bytes)
        ?? readOptionalNumber(meta.size_bytes)
        ?? null,
      imageIndex: readOptionalNumber(meta.image_index) ?? index,
      parentAssetId: readOptionalString(meta.parent_asset_id) ?? null,
      accessVariant: row.access_variant ?? readString(meta.access_variant, "watermarked"),
      previewVariant: readString(meta.preview_variant, "watermarked"),
      watermarkBrand: readOptionalString(row.watermark_brand) ?? readString(meta.watermark_brand, "vismuse"),
      promptSummary: readString(meta.prompt_summary, job.payload.inputText),
      model: readString(meta.model, "gpt-image-2"),
      quality: readString(meta.quality, "low"),
      resolution: readString(meta.resolution, readString(socialmedia.resolution, "1k")),
      outputFormat: readString(meta.output_format, "png")
    };
  });

  const billingHold = asRecord(socialmedia.billingHold);
  const heldCredits = Math.max(0, Math.ceil(readNumber(billingHold?.totalCredits, 0)));
  const creditsPerImage = Math.max(0, Math.ceil(readNumber(billingHold?.creditsPerImage, heldCredits / Math.max(1, images.length))));
  const totalCredits = Math.max(0, creditsPerImage * images.length);

  return ({
    kind: "socialmedia_image_generation",
    socialmedia: {
      platform: readString(socialmedia.platform, readString(job.payload.platform, "instagram")),
      language: readString(socialmedia.language, job.payload.outputLanguage),
      resolution: readString(socialmedia.resolution, "1k"),
      imageCount: images.length,
      briefSummary: readString(
        asRecord(socialmedia.brief)?.uiSummary,
        `Recovered ${images.length} generated image${images.length === 1 ? "" : "s"} from persisted assets.`
      ),
      brief: asRecord(socialmedia.brief),
      reusableContext: {
        sourceSummary: readString(socialmedia.inputText, job.payload.inputText),
        brandOrSubject: readOptionalString(asRecord(socialmedia.brief)?.brandOrSubject),
        styleDirection: "direct multiturn image agent",
        platform: readString(socialmedia.platform, readString(job.payload.platform, "instagram")),
        language: readString(socialmedia.language, job.payload.outputLanguage),
        resolution: readString(socialmedia.resolution, "1k")
      },
      images,
      warnings: [],
      billing: {
        creditsPerImage,
        totalCredits,
        heldCredits,
        refundedCredits: Math.max(0, heldCredits - totalCredits),
        imageCount: images.length,
        costKey: readString(billingHold?.costKey, "unknown"),
        mode: readString(socialmedia.billingMode, "paid_hold")
      }
    }
  } as unknown) as JobRecord["result"];
}

export function isRecoverableSocialmediaImageAssetRow(row: JobAssetRecoveryRow): boolean {
  const meta = asRecord(row.meta_json) ?? {};
  const role = readString(meta.role).trim().toLowerCase();
  if (role === "video_keyframe" || role.startsWith("generated_video")) return false;

  const storagePath = readString(row.storage_path).toLowerCase();
  if (
    storagePath.includes("/video-keyframes/")
    || storagePath.includes("/video-first-frames/")
  ) return false;

  const storageBucket = readString(row.storage_bucket).toLowerCase();
  if (storageBucket.includes("video")) return false;

  const mimeType = readString(meta.mime_type, readString(row.watermarked_mime_type)).toLowerCase();
  if (mimeType && !mimeType.startsWith("image/")) return false;

  return true;
}

export function isSocialmediaVideoJobForAssetRecovery(
  job: Pick<JobRecord, "sourceUseCase" | "outputType" | "payload">
): boolean {
  const socialmedia = asRecord(job.payload.socialmedia);
  const sourceUseCases = [
    job.sourceUseCase,
    job.payload.sourceUseCase,
    readOptionalString(socialmedia?.sourceUseCase)
  ];
  const outputTypes = [
    job.outputType,
    job.payload.outputType,
    readOptionalString(socialmedia?.outputType)
  ];
  return hasSocialmediaVideoTask(job)
    || outputTypes.some((outputType) => outputType === "video")
    || sourceUseCases.some((sourceUseCase) => isVideoGenerationSourceUseCase(sourceUseCase));
}

async function buildRecoveredSocialmediaResultFromAssets(job: JobRecord): Promise<JobRecord["result"] | null> {
  if (!job.payload.socialmedia || isSocialmediaVideoJobForAssetRecovery(job)) return null;

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("job_assets")
    .select([
      "id",
      "storage_bucket",
      "storage_path",
      "public_url",
      "access_variant",
      "watermarked_storage_path",
      "watermarked_mime_type",
      "watermarked_size_bytes",
      "watermark_brand",
      "meta_json",
      "created_at"
    ].join(","))
    .eq("job_id", job.id)
    .order("created_at", { ascending: true });

  if (error || !data?.length) {
    if (error) {
      console.warn("[store] failed to inspect job assets during stale recovery", {
        jobId: job.id,
        ownerUserId: job.ownerUserId,
        error: error.message
      });
    }
    return null;
  }

  const recoverableImageRows = (data as unknown as JobAssetRecoveryRow[]).filter(isRecoverableSocialmediaImageAssetRow);
  if (!recoverableImageRows.length) return null;

  return buildSocialmediaResultFromAssetRows(job, recoverableImageRows);
}

function buildRecoveredSocialmediaPayloadFromAssets(job: JobRecord): JobRecord["payload"] {
  const socialmedia = asRecord(job.payload.socialmedia);
  if (!socialmedia) return job.payload;

  const pendingImageTasks = Array.isArray(socialmedia.pendingImageTasks)
    ? socialmedia.pendingImageTasks.map((task) => (
        task && typeof task === "object" && !Array.isArray(task)
          ? { ...task, status: "completed", lastError: undefined }
          : task
      ))
    : socialmedia.pendingImageTasks;

  return {
    ...job.payload,
    socialmedia: {
      ...socialmedia,
      pendingImageTasks
    }
  };
}

function readSocialmediaBillingHold(payload: JobRecord["payload"]): { totalCredits: number; ownerUserId?: string } | null {
  const socialmedia = payload.socialmedia;
  if (!socialmedia || typeof socialmedia !== "object") return null;
  const billingHold = (socialmedia as { billingHold?: { totalCredits?: unknown; ownerUserId?: unknown } }).billingHold;
  const totalCredits = Number(billingHold?.totalCredits);
  const ownerUserId = typeof billingHold?.ownerUserId === "string" ? billingHold.ownerUserId.trim() : "";
  return Number.isFinite(totalCredits) && totalCredits > 0
    ? { totalCredits, ownerUserId: ownerUserId || undefined }
    : null;
}

async function settleStaleSocialmediaJobIfNeeded(job: JobRecord, next: JobRecord): Promise<void> {
  if (next.status !== "failed" || next.stage !== "failed") return;
  if (job.status !== "running" && job.status !== "queued") return;
  if (job.stage !== "generating_images") return;
  const billingHold = readSocialmediaBillingHold(job.payload);
  if (!billingHold) return;

  try {
    const settlement = await settleSocialmediaImageCredits({
      ownerUserId: billingHold.ownerUserId ?? job.ownerUserId,
      jobId: job.id,
      heldCredits: billingHold.totalCredits,
      actualCredits: 0,
      reason: "stale_recovery"
    });
    trackServerEvent({
      event: "socialmedia.job.stale_recovery.billing_settle.completed",
      status: "success",
      jobId: job.id,
      userId: job.ownerUserId,
      stage: "failed",
      heldCredits: billingHold.totalCredits,
      refundedCredits: settlement.refundCredits
    });
  } catch (error) {
    trackServerEvent({
      event: "socialmedia.job.stale_recovery.billing_settle.failed",
      level: "error",
      status: "failed",
      jobId: job.id,
      userId: job.ownerUserId,
      stage: "failed",
      errorMessage: error instanceof Error ? error.message : String(error)
    });
  }
}

async function recoverSupabaseJobIfNeeded(job: JobRecord): Promise<JobRecord> {
  let next = buildRecoveredJobState(job);

  if (!job.result && job.payload.socialmedia) {
    const recoveredResult = await buildRecoveredSocialmediaResultFromAssets(job);
    if (recoveredResult) {
      next = {
        ...job,
        status: "completed",
        stage: "completed",
        progress: 100,
        payload: buildRecoveredSocialmediaPayloadFromAssets(job),
        result: recoveredResult,
        error: undefined,
        updatedAt: new Date().toISOString()
      };
      console.warn("[store] recovered stale socialmedia job from persisted assets", {
        jobId: job.id,
        ownerUserId: job.ownerUserId
      });
    }
  }

  if (!next) {
    if (
      job.status === "running"
      && isImageProviderGeneratingStage(job.stage)
      && isSocialmediaJobRecoveryStale(
        job.updatedAt,
        Date.now(),
        SOCIALMEDIA_IMAGE_FALLBACK_RECOVERY_STALE_AFTER_MS
      )
    ) {
      triggerImageFallbackAdvanceSoon();
    }
    return job;
  }

  const owner = resolveOwnerScope(job.ownerUserId);
  const client = getSupabaseAdminClient();
  let query = client
    .from("jobs")
    .update({
      status: next.status,
      stage: next.stage,
      progress: next.progress,
      payload_json: encodePayloadForSupabase(next),
      result_json: next.result ?? null,
      error_text: next.error ?? null,
      finished_at: next.status === "completed" || next.status === "failed" ? next.updatedAt : null,
      updated_at: next.updatedAt
    })
    .eq("id", job.id);

  if (owner) {
    query = applyOwnerFilter(query, owner);
  }

  const { data, error } = await query.select("*").maybeSingle();
  if (error || !data) {
    return next;
  }

  console.warn("[store] auto-recovered stale remote job", {
    jobId: job.id,
    fromStatus: job.status,
    toStatus: next.status,
    previousStage: job.stage,
    nextStage: next.stage
  });
  if (next.status === "completed") {
    let sessionQuery = client
      .from("sessions")
      .update({
        last_job_id: job.id,
        updated_at: next.updatedAt
      })
      .eq("id", job.sessionId);
    if (owner) {
      sessionQuery = applyOwnerFilter(sessionQuery, owner);
    }
    await sessionQuery;
  }
  await settleStaleSocialmediaJobIfNeeded(job, next);
  const recovered = mapJobRow(data as Record<string, unknown>, job.events);
  trackRecoveredImageProviderFallbackStarted({ previousJob: job, recoveredJob: recovered });
  if (
    recovered.status === "running"
    && isImageProviderGeneratingStage(recovered.stage)
    && isSocialmediaJobRecoveryStale(
      recovered.updatedAt,
      Date.now(),
      SOCIALMEDIA_IMAGE_FALLBACK_RECOVERY_STALE_AFTER_MS
    )
  ) {
    triggerImageFallbackAdvanceSoon();
  }
  if (recovered.stage === "auto_replay_pending") {
    void startSupabaseAutoReplay(recovered);
  }
  return recovered;
}

async function fetchSupabaseSessionById(
  sessionId: string,
  ownerUserId?: string,
  options?: { requirePersisted?: boolean }
): Promise<SessionRecord | null> {
  const startedAt = Date.now();
  const timings: QueueStoreTiming[] | undefined = QUEUE_STORE_DEBUG_TIMINGS_ENABLED ? [] : undefined;
  const client = getSupabaseAdminClient();
  const owner = resolveOwnerScope(ownerUserId);
  const buildQuery = (includeDeletedAtFilter: boolean) => {
    let query = client.from("sessions").select("*").eq("id", sessionId).limit(1);
    if (includeDeletedAtFilter) {
      query = applyNotDeletedSessionFilter(query);
    }
    if (owner) {
      query = applyOwnerFilter(query, owner);
    }
    return query;
  };
  let result = await timeQueueStoreStep(
    timings,
    "sessions_select",
    () => buildQuery(true).maybeSingle(),
    (value) => value.data ? 1 : 0
  );
  if (isMissingDeletedAtColumnError(result.error)) {
    result = await timeQueueStoreStep(
      timings,
      "sessions_select_legacy_schema",
      () => buildQuery(false).maybeSingle(),
      (value) => value.data ? 1 : 0
    );
  }
  const { data, error } = result;
  if (error && options?.requirePersisted) {
    throw new Error(`Unable to load persisted session: ${error.message}`);
  }
  const session = error || !data ? null : mapSessionRow(data as Record<string, unknown>);
  logQueueStoreTimings("fetch session by id", startedAt, {
    sessionId,
    ownerUserId,
    found: Boolean(session)
  }, timings ?? []);
  return session;
}

async function reconcileClaimedLocalSessionOwner(
  sessionId?: string,
  ownerUserId?: string
): Promise<void> {
  const normalizedSessionId = sessionId?.trim();
  const normalizedOwnerUserId = ownerUserId?.trim();
  if (!normalizedSessionId || !normalizedOwnerUserId || isGuestUserId(normalizedOwnerUserId)) return;

  const localSession = getLocalSession(normalizedSessionId);
  if (!localSession || localSession.ownerUserId === normalizedOwnerUserId) return;

  const remoteSession = await fetchSupabaseSessionById(normalizedSessionId, normalizedOwnerUserId);
  const reconciliation = resolveClaimedSessionOwnerReconciliation({
    sessionId: normalizedSessionId,
    requestedOwnerUserId: normalizedOwnerUserId,
    localSession,
    remoteSession
  });
  if (!reconciliation) return;

  adoptLocalGuestWorkspaceOwner(reconciliation.guestUserId, reconciliation.targetUserId);
}

async function fetchSupabaseJobsBySession(
  sessionId: string,
  ownerUserId?: string,
  options?: {
    recover?: boolean;
    includeEvents?: boolean;
    requirePersisted?: boolean;
    displayOnly?: boolean;
  }
): Promise<JobRecord[]> {
  const startedAt = Date.now();
  const timings: QueueStoreTiming[] | undefined = QUEUE_STORE_DEBUG_TIMINGS_ENABLED ? [] : undefined;
  const client = getSupabaseAdminClient();
  let jobQuery = client
    .from("jobs")
    .select(options?.displayOnly ? SESSION_DISPLAY_JOB_COLUMNS : "*")
    .eq("session_id", sessionId)
    .order("turn_index", { ascending: true })
    .order("revision", { ascending: true })
    .order("created_at", { ascending: true });

  const owner = resolveOwnerScope(ownerUserId);
  if (owner) {
    jobQuery = applyOwnerFilter(jobQuery, owner);
  }

  const { data: jobRows, error: jobError } = await timeQueueStoreStep(
    timings,
    "jobs_select",
    () => jobQuery,
    (value) => value.data?.length
  );
  if (jobError || !jobRows?.length) {
    if (jobError && options?.displayOnly) {
      return fetchSupabaseJobsBySession(sessionId, ownerUserId, { ...options, displayOnly: false });
    }
    logQueueStoreTimings("fetch jobs by session", startedAt, {
      sessionId,
      ownerUserId,
      rowCount: 0,
      error: jobError?.message
    }, timings ?? []);
    if (jobError && options?.requirePersisted) {
      throw new Error(`Unable to load persisted session jobs: ${jobError.message}`);
    }
    return [];
  }

  let rows = jobRows as unknown as Array<Record<string, unknown>>;
  if (options?.displayOnly) {
    const unsettledIds = rows.filter((row) => needsCompleteSessionDisplayRow(row)
      || (options.recover !== false && !isSettledSessionDisplayJob(row))).map((row) => readString(row.id));
    let completeRows = new Map<string, Record<string, unknown>>();
    if (unsettledIds.length) {
      let fullQuery = client.from("jobs").select("*").eq("session_id", sessionId).in("id", unsettledIds);
      if (owner) fullQuery = applyOwnerFilter(fullQuery, owner);
      const full = await timeQueueStoreStep(timings, "recovery_jobs_select", () => fullQuery, (value) => value.data?.length);
      if (full.error || full.data?.length !== unsettledIds.length) {
        return fetchSupabaseJobsBySession(sessionId, ownerUserId, { ...options, displayOnly: false });
      }
      completeRows = new Map(full.data.map((row) => [readString(row.id), row]));
    }
    rows = rows.map((row) => completeRows.get(readString(row.id)) ?? restoreSessionDisplayJobRow(row));
  }
  const jobIds = rows.map((row) => readString(row.id));
  const shouldIncludeEvents = options?.includeEvents !== false;
  const { data: eventRows } = shouldIncludeEvents
    ? await timeQueueStoreStep(
        timings,
        "job_events_select",
        () => client.from("job_events").select("*").in("job_id", jobIds),
        (value) => value.data?.length
      )
    : { data: [] };
  const eventMap = timeQueueStoreStep(
    timings,
    shouldIncludeEvents ? "map_events" : "map_events_skipped",
    async () => mapEventsByJob((eventRows ?? []) as Array<Record<string, unknown>>),
    (value) => value.size
  );
  const mappedEventMap = await eventMap;

  const mappedJobs = await timeQueueStoreStep(timings, "map_jobs", async () => rows.map((row) => {
    const record = row as Record<string, unknown>;
    const id = readString(record.id);
    return mapJobRow(record, mappedEventMap.get(id) ?? []);
  }), (value) => value.length);

  if (options?.recover === false) {
    logQueueStoreTimings("fetch jobs by session", startedAt, {
      sessionId,
      ownerUserId,
      rowCount: mappedJobs.length,
      recover: false,
      includeEvents: shouldIncludeEvents
    }, timings ?? []);
    return mappedJobs;
  }

  const recoveredJobs = await timeQueueStoreStep(timings, "recover_jobs", async () => {
    const items: JobRecord[] = [];
    for (const job of mappedJobs) {
      items.push(await recoverSupabaseJobIfNeeded(job));
    }
    return items;
  }, (value) => value.length);
  logQueueStoreTimings("fetch jobs by session", startedAt, {
    sessionId,
    ownerUserId,
    rowCount: recoveredJobs.length,
    recover: true,
    includeEvents: shouldIncludeEvents
  }, timings ?? []);
  return recoveredJobs;
}

async function fetchSupabaseJobById(
  jobId: string,
  ownerUserId?: string,
  options?: { recover?: boolean }
): Promise<JobRecord | null> {
  const client = getSupabaseAdminClient();
  let jobQuery = client.from("jobs").select("*").eq("id", jobId).limit(1);
  const owner = resolveOwnerScope(ownerUserId);
  if (owner) {
    jobQuery = applyOwnerFilter(jobQuery, owner);
  }
  const { data: jobRow, error: jobError } = await jobQuery.maybeSingle();
  if (jobError || !jobRow) return null;

  const { data: eventRows } = await client.from("job_events").select("*").eq("job_id", jobId);
  const eventMap = mapEventsByJob((eventRows ?? []) as Array<Record<string, unknown>>);
  const mappedJob = mapJobRow(jobRow as Record<string, unknown>, eventMap.get(jobId) ?? []);
  if (options?.recover === false) {
    return mappedJob;
  }
  return recoverSupabaseJobIfNeeded(mappedJob);
}

async function persistSupabaseSession(session: SessionRecord): Promise<void> {
  let owner = await resolvePersistOwnerScope(session.ownerUserId);
  if (!owner) return;

  const client = getSupabaseAdminClient();
  // Session title and creation time are immutable once written. A cold serverless
  // instance can reconstruct a session from a later job, so a normal upsert here
  // would otherwise replace the original title with that later revision's prompt.
  const insertPayload = {
    id: session.id,
    user_id: owner.userId,
    guest_user_id: owner.guestUserId,
    title: session.title,
    source_use_case: session.sourceUseCase ?? null,
    agent_response_id: session.agentResponseId ?? null,
    ...(session.inputModeOverride
      ? { input_mode_override: session.inputModeOverride }
      : {}),
    last_job_id: session.lastJobId ?? null,
    created_at: session.createdAt,
    updated_at: session.updatedAt
  };
  const { error: insertError } = await client.from("sessions").upsert(
    insertPayload,
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (insertError) {
    throw new Error(`Failed to create session ${session.id}: ${insertError.message}`);
  }

  // The canonical-owner trigger can observe a guest claim that committed
  // after the first resolution and rewrite this upsert to the formal owner.
  // Refresh before any guarded follow-up read/update so the stale guest filter
  // cannot hide the row that was just persisted.
  owner = await resolvePersistOwnerScope(session.ownerUserId) ?? owner;

  const { data: persistedSession, error: persistedSessionError } = await client
    .from("sessions")
    .select("title,last_job_id")
    .eq("id", session.id)
    .eq(owner.column, owner.id)
    .maybeSingle();
  if (persistedSessionError) {
    throw new Error(`Failed to read session ${session.id}: ${persistedSessionError.message}`);
  }
  if (!persistedSession) {
    throw new Error(`Session ${session.id} was not found after persistence.`);
  }

  const runtimePatch: Record<string, string | null> = {
    updated_at: session.updatedAt
  };
  if (session.sourceUseCase) runtimePatch.source_use_case = session.sourceUseCase;
  if (session.agentResponseId) runtimePatch.agent_response_id = session.agentResponseId;
  if (session.inputModeOverride) runtimePatch.input_mode_override = session.inputModeOverride;
  if (session.lastJobId) runtimePatch.last_job_id = session.lastJobId;

  // A session endpoint creates the default "Session N" row before its first job
  // is queued. Let that first job supply the automatic title, but never let a
  // later reconstructed job replace an established title.
  const persistedTitle = readString((persistedSession as Record<string, unknown>).title, "");
  const persistedLastJobId = readString((persistedSession as Record<string, unknown>).last_job_id, "");
  const shouldSetInitialTitle = Boolean(session.lastJobId)
    && !persistedLastJobId
    && /^Session\s+\d+$/i.test(persistedTitle.trim());
  if (shouldSetInitialTitle) runtimePatch.title = session.title;

  const updateRuntimeFields = async (patch: Record<string, string | null>, guardInitialTitle = false) => {
    let query = client.from("sessions").update(patch).eq("id", session.id);
    if (guardInitialTitle) {
      // Only one concurrent first-job sync can claim the default title.
      query = query.eq("title", persistedTitle).is("last_job_id", null);
    }
    const { error } = await applyOwnerFilter(
      query,
      owner
    );
    return error;
  };

  let error = await updateRuntimeFields(runtimePatch, shouldSetInitialTitle);
  if (!error && shouldSetInitialTitle) {
    // A concurrent job may have claimed the default title first. Apply the
    // remaining runtime fields without a title write in either case.
    const { title: _title, ...withoutTitle } = runtimePatch;
    error = await updateRuntimeFields(withoutTitle);
  }
  if (!error) return;

  // Multi-job batches can race: one sync may try to point last_job_id at a sibling job
  // that has not been persisted yet. Retry the mutable metadata without last_job_id.
  if (error.code === "23503" && String(error.message).includes("sessions_last_job_fk")) {
    console.warn("[store] session sync fell back without last_job_id", {
      sessionId: session.id,
      ownerUserId: owner.id,
      lastJobId: session.lastJobId ?? null
    });
    const { last_job_id: _lastJobId, title: _title, ...withoutLastJobOrTitle } = runtimePatch;
    const fallbackError = await updateRuntimeFields(withoutLastJobOrTitle);
    if (fallbackError) {
      throw new Error(`Failed to update session ${session.id}: ${fallbackError.message}`);
    }
    return;
  }

  throw new Error(`Failed to upsert session ${session.id}: ${error.message}`);
}

async function persistSupabaseSessionWithoutLastJob(session: SessionRecord): Promise<void> {
  const owner = await resolvePersistOwnerScope(session.ownerUserId);
  if (!owner) return;

  const client = getSupabaseAdminClient();
  const { error } = await client.from("sessions").upsert(
    {
      id: session.id,
      user_id: owner.userId,
      guest_user_id: owner.guestUserId,
      title: session.title,
      source_use_case: session.sourceUseCase ?? null,
      agent_response_id: session.agentResponseId ?? null,
      ...(session.inputModeOverride
        ? { input_mode_override: session.inputModeOverride }
        : {}),
      last_job_id: null,
      created_at: session.createdAt,
      updated_at: session.updatedAt
    },
    // This call only ensures the parent row exists before its job is persisted.
    // Do not overwrite metadata from an existing session reconstructed elsewhere.
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (error) {
    throw new Error(`Failed to ensure session ${session.id}: ${error.message}`);
  }
}

function encodePayloadForSupabase(job: JobRecord): Record<string, unknown> {
  return {
    ...job.payload,
    artifacts: job.artifacts ?? [],
    changed_artifacts: job.changedArtifacts ?? [],
    rerun_plan: job.rerunPlan ?? null,
    revision_intent: job.revisionIntent ?? null
  };
}

function aggregateJobUsage(job: JobRecord): {
  tokenInput: number;
  tokenOutput: number;
  tokenTotal: number;
  costUsd: number;
} {
  const tokenInput = job.events.reduce((sum, item) => sum + (item.tokenInput ?? 0), 0);
  const tokenOutput = job.events.reduce((sum, item) => sum + (item.tokenOutput ?? 0), 0);
  const tokenTotal = job.events.reduce((sum, item) => sum + (item.tokenTotal ?? 0), 0);
  const costUsd = Number(job.events.reduce((sum, item) => sum + (item.costUsd ?? 0), 0).toFixed(4));
  return { tokenInput, tokenOutput, tokenTotal, costUsd };
}

async function persistSupabaseJob(job: JobRecord, options?: { skipExistingGuard?: boolean }): Promise<void> {
  let owner = await resolvePersistOwnerScope(job.ownerUserId);
  if (!owner) return;

  const client = getSupabaseAdminClient();
  if (!options?.skipExistingGuard) {
    const { data: existingRow, error: existingError } = await client
      .from("jobs")
      .select("status,result_json,updated_at")
      .eq("id", job.id)
      .maybeSingle();
    if (!existingError && existingRow) {
      const existingStatus = readString((existingRow as Record<string, unknown>).status);
      const existingResult = (existingRow as Record<string, unknown>).result_json;
      const existingUpdatedAt = Date.parse(readString((existingRow as Record<string, unknown>).updated_at));
      const localUpdatedAt = Date.parse(job.updatedAt);
      const isStaleLocalSync =
        !Number.isFinite(localUpdatedAt)
        || !Number.isFinite(existingUpdatedAt)
        || localUpdatedAt <= existingUpdatedAt;
      const remoteHasCompletedResult = existingStatus === "completed" || Boolean(existingResult);
      const localHasCompletedResult = job.status === "completed" && Boolean(job.result);

      if ((job.status !== "completed" && job.status !== "failed")
        && (remoteHasCompletedResult || existingStatus === "failed")
        && isStaleLocalSync) {
        console.warn("[store] skipped stale non-terminal job sync", {
          jobId: job.id,
          ownerUserId: owner.id,
          localStatus: job.status,
          localStage: job.stage,
          localUpdatedAt: job.updatedAt,
          remoteStatus: existingStatus,
          remoteUpdatedAt: readString((existingRow as Record<string, unknown>).updated_at),
          hasRemoteResult: Boolean(existingResult)
        });
        return;
      }

      if (remoteHasCompletedResult && !localHasCompletedResult) {
        console.warn("[store] skipped stale terminal job sync over completed result", {
          jobId: job.id,
          ownerUserId: owner.id,
          localStatus: job.status,
          localStage: job.stage,
          localUpdatedAt: job.updatedAt,
          remoteStatus: existingStatus,
          remoteUpdatedAt: readString((existingRow as Record<string, unknown>).updated_at),
          hasRemoteResult: Boolean(existingResult),
          isStaleLocalSync
        });
        return;
      }
    }
  }

  const usage = aggregateJobUsage(job);
  const startedAt = job.events[0]?.createdAt ?? job.createdAt;
  const finishedAt = job.status === "completed" || job.status === "failed" ? job.updatedAt : null;

  const { error: jobError } = await client.from("jobs").upsert(
    {
      id: job.id,
      // Omit unknown sources so older/background snapshots cannot clear attribution.
      ...(job.triggerHostname ? { trigger_hostname: job.triggerHostname } : {}),
      user_id: owner.userId,
      guest_user_id: owner.guestUserId,
      session_id: job.sessionId,
      status: job.status,
      mode: job.mode,
      turn_index: job.turnIndex,
      revision: job.revision,
      base_job_id: job.baseJobId ?? job.id,
      parent_job_id: job.parentJobId ?? null,
      progress: job.progress,
      stage: job.stage,
      input_text: job.payload.inputText,
      source_input_text: job.payload.sourceInputText ?? null,
      source_use_case: job.sourceUseCase ?? job.payload.sourceUseCase ?? null,
      output_type: job.outputType ?? job.payload.outputType ?? null,
      payload_json: encodePayloadForSupabase(job),
      result_json: job.result ?? null,
      error_text: job.error ?? null,
      token_input: usage.tokenInput,
      token_output: usage.tokenOutput,
      token_total: usage.tokenTotal,
      cost_usd: usage.costUsd,
      started_at: startedAt,
      finished_at: finishedAt,
      created_at: job.createdAt,
      updated_at: job.updatedAt
    },
    { onConflict: "id" }
  );
  if (jobError) {
    throw new Error(`Failed to upsert job ${job.id}: ${jobError.message}`);
  }

  if (!job.events.length) return;
  // Keep child event ownership aligned when the job trigger canonicalized a
  // concurrently claimed guest during the parent upsert.
  owner = await resolvePersistOwnerScope(job.ownerUserId) ?? owner;
  const { error: eventsError } = await client.from("job_events").upsert(
    job.events.map((item) => ({
      id: item.id,
      job_id: job.id,
      user_id: owner.userId,
      guest_user_id: owner.guestUserId,
      stage: item.stage,
      title: item.title,
      thought: item.thought,
      action: item.action,
      output_preview: item.outputPreview ?? null,
      duration_sec: item.durationSec,
      cost_usd: item.costUsd,
      token_input: item.tokenInput ?? null,
      token_output: item.tokenOutput ?? null,
      token_total: item.tokenTotal ?? null,
      created_at: item.createdAt
    })),
    { onConflict: "id" }
  );
  if (eventsError) {
    throw new Error(`Failed to upsert events for job ${job.id}: ${eventsError.message}`);
  }
}

function isMissingJobSessionForeignKeyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("jobs_session_id_fkey");
}

async function persistSupabaseShare(share: ShareRecord): Promise<void> {
  const owner = await resolvePersistOwnerScope(share.ownerUserId);
  if (!owner) return;
  const client = getSupabaseAdminClient();
  const { error } = await client.from("share_links").upsert(
    {
      id: share.id,
      session_id: share.sessionId,
      user_id: owner.userId,
      guest_user_id: owner.guestUserId,
      token: share.token,
      visibility: share.visibility,
      expires_at: share.expiresAt ?? null,
      created_at: share.createdAt
    },
    { onConflict: "id" }
  );
  if (error) {
    throw new Error(`Failed to upsert share ${share.id}: ${error.message}`);
  }
}

async function syncSupabaseJobAndSession(
  job: JobRecord,
  session?: SessionRecord,
  options?: { syncSession?: boolean; syncSessionLastJob?: boolean; assumeNewJob?: boolean }
): Promise<void> {
  const startedAt = Date.now();
  const timings: Array<{ name: string; durationMs: number }> = [];
  const timeStep = async (name: string, fn: () => Promise<void>) => {
    const stepStartedAt = Date.now();
    await fn();
    timings.push({ name, durationMs: Date.now() - stepStartedAt });
  };
  const owner = normalizeOwnerUserId(job.ownerUserId);
  if (!owner) return;

  const shouldSyncSession = options?.syncSession !== false;
  const localSession = shouldSyncSession
    ? (session ?? getLocalSession(job.sessionId, owner) ?? {
        id: job.sessionId,
        ownerUserId: owner,
        title: job.payload.inputText?.trim() || "AI generation",
        sourceUseCase: job.sourceUseCase ?? job.payload.sourceUseCase,
        lastJobId: job.id,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      } satisfies SessionRecord)
    : undefined;
  if (localSession) {
    // Ensure parent row exists before inserting/updating jobs that reference the session.
    await timeStep("persist_session_without_last_job", () => persistSupabaseSessionWithoutLastJob(localSession));
  }

  try {
    await timeStep("persist_job", () => persistSupabaseJob(job, { skipExistingGuard: options?.assumeNewJob }));
  } catch (error) {
    if (!localSession && shouldSyncSession === false && isMissingJobSessionForeignKeyError(error)) {
      const fallbackSession: SessionRecord = session ?? getLocalSession(job.sessionId, owner) ?? {
        id: job.sessionId,
        ownerUserId: owner,
        title: job.payload.inputText?.trim() || "AI generation",
        sourceUseCase: job.sourceUseCase ?? job.payload.sourceUseCase,
        lastJobId: job.id,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      };
      await timeStep("persist_missing_session_without_last_job", () => persistSupabaseSessionWithoutLastJob(fallbackSession));
      await timeStep("persist_job_after_missing_session", () => persistSupabaseJob(job, { skipExistingGuard: options?.assumeNewJob }));
      if (options?.syncSessionLastJob !== false) {
        await timeStep("persist_missing_session", () => persistSupabaseSession(fallbackSession));
      }
    } else {
      throw error;
    }
  }

  if (localSession && options?.syncSessionLastJob !== false) {
    await timeStep("persist_session", () => persistSupabaseSession(localSession));
  }

  if (QUEUE_STORE_DEBUG_TIMINGS_ENABLED) {
    console.info("[queue-store] supabase job/session sync completed", {
      jobId: job.id,
      sessionId: job.sessionId,
      ownerUserId: owner,
      status: job.status,
      stage: job.stage,
      syncSession: shouldSyncSession,
      durationMs: Date.now() - startedAt,
      timings
    });
  }
}

async function syncSupabaseJobAndSessionWithRetry(
  job: JobRecord,
  session: SessionRecord | undefined,
  options?: PatchQueuedJobSyncOptions
): Promise<JobSupabaseSyncResult> {
  const owner = normalizeOwnerUserId(job.ownerUserId);
  if (!isSupabaseStoreEnabled(owner) || !owner) {
    return { enabled: false, ok: true, attempts: 0 };
  }

  const attempts = Math.max(1, Math.floor(options?.attempts ?? 1));
  const retryDelayMs = Math.max(0, Math.floor(options?.retryDelayMs ?? JOB_SYNC_RETRY_DELAY_MS));
  const operation = options?.operation ?? "syncSupabaseJobAndSession";
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await syncSupabaseJobAndSession(job, session, {
        syncSession: options?.syncSession,
        syncSessionLastJob: options?.syncSessionLastJob,
        assumeNewJob: options?.assumeNewJob
      });
      if (attempt > 1 && QUEUE_STORE_DEBUG_TIMINGS_ENABLED) {
        console.info("[store] job sync recovered", {
          operation,
          jobId: job.id,
          sessionId: job.sessionId,
          ownerUserId: owner,
          status: job.status,
          stage: job.stage,
          attempt,
          attempts
        });
      }
      return { enabled: true, ok: true, attempts: attempt };
    } catch (error) {
      lastError = error;
      console.error("[store] job sync attempt failed", {
        operation,
        jobId: job.id,
        sessionId: job.sessionId,
        ownerUserId: owner,
        status: job.status,
        stage: job.stage,
        attempt,
        attempts,
        message: error instanceof Error ? error.message : String(error)
      });
      if (attempt < attempts && retryDelayMs > 0) {
        await sleep(retryDelayMs);
      }
    }
  }

  return {
    enabled: true,
    ok: false,
    attempts,
    error: lastError instanceof Error ? lastError.message : String(lastError)
  };
}

function stopJobSyncLoop(jobId: string): void {
  const timer = activeJobSyncLoops.get(jobId);
  if (!timer) return;
  clearInterval(timer);
  activeJobSyncLoops.delete(jobId);
}

function stopJobSyncSubscription(jobId: string): void {
  const unsubscribe = jobSyncSubscriptions.get(jobId);
  if (!unsubscribe) return;
  unsubscribe();
  jobSyncSubscriptions.delete(jobId);
}

function shouldUseJobOnlyBackgroundSync(job: JobRecord): boolean {
  if (job.status === "completed" || job.status === "failed") return false;
  return Boolean(job.payload.socialmedia);
}

function shouldStartBackgroundJobSync(job: JobRecord): boolean {
  return !job.payload.socialmedia;
}

function scheduleImmediateJobSync(jobId: string, ownerUserId?: string): void {
  const owner = normalizeOwnerUserId(ownerUserId);
  if (!isSupabaseStoreEnabled(owner) || !owner) return;

  const previous = immediateJobSyncs.get(jobId) ?? Promise.resolve();
  const next = previous
    .catch(() => {
      // Keep the queue alive after individual sync failures.
    })
    .then(async () => {
      const localJob = getLocalJob(jobId, owner);
      if (!localJob) {
        stopJobSyncLoop(jobId);
        stopJobSyncSubscription(jobId);
        return;
      }

      const localSession = getLocalSession(localJob.sessionId, owner);
      let syncSucceeded = false;
      try {
        await syncSupabaseJobAndSession(localJob, localSession ?? undefined, {
          syncSession: !shouldUseJobOnlyBackgroundSync(localJob)
        });
        syncSucceeded = true;
      } catch (error) {
        console.error("[store] immediate job sync failed", {
          jobId,
          ownerUserId: owner,
          message: error instanceof Error ? error.message : String(error)
        });
      }

      if (syncSucceeded && (localJob.status === "completed" || localJob.status === "failed")) {
        stopJobSyncLoop(jobId);
        stopJobSyncSubscription(jobId);
      }
    });

  immediateJobSyncs.set(jobId, next);
  void next.finally(() => {
    if (immediateJobSyncs.get(jobId) === next) {
      immediateJobSyncs.delete(jobId);
    }
  });
}

function startJobSyncLoop(jobId: string, ownerUserId?: string): void {
  const owner = normalizeOwnerUserId(ownerUserId);
  if (!isSupabaseStoreEnabled(owner) || !owner) return;
  if (!jobSyncSubscriptions.has(jobId)) {
    const unsubscribe = registerJobObserver((job) => {
      if (job.id !== jobId) return;
      if (managedLocalPatchSyncs.has(job.id)) return;
      scheduleImmediateJobSync(jobId, owner);
    });
    jobSyncSubscriptions.set(jobId, unsubscribe);
  }

  if (activeJobSyncLoops.has(jobId)) {
    return;
  }

  const run = async () => {
    const localJob = getLocalJob(jobId, owner);
    if (!localJob) {
      stopJobSyncLoop(jobId);
      stopJobSyncSubscription(jobId);
      return;
    }

    const localSession = getLocalSession(localJob.sessionId, owner);
    let syncSucceeded = false;
    try {
      await syncSupabaseJobAndSession(localJob, localSession ?? undefined, {
        syncSession: !shouldUseJobOnlyBackgroundSync(localJob)
      });
      syncSucceeded = true;
    } catch (error) {
      console.error("[store] job sync failed", {
        jobId,
        ownerUserId: owner,
        message: error instanceof Error ? error.message : String(error)
      });
    }

    if (syncSucceeded && (localJob.status === "completed" || localJob.status === "failed")) {
      stopJobSyncLoop(jobId);
      stopJobSyncSubscription(jobId);
    }
  };

  const timer = setInterval(() => {
    void run();
  }, JOB_SYNC_INTERVAL_MS);
  activeJobSyncLoops.set(jobId, timer);
}

function deferJobSyncAfterFailure(job: JobRecord, ownerUserId: string, operation: string, error: unknown): void {
  console.error("[store] supabase sync deferred", {
    operation,
    jobId: job.id,
    sessionId: job.sessionId,
    ownerUserId,
    message: error instanceof Error ? error.message : String(error)
  });
  startJobSyncLoop(job.id, ownerUserId);
  scheduleImmediateJobSync(job.id, ownerUserId);
}

function logSessionSyncFailure(session: SessionRecord, operation: string, error: unknown): void {
  console.error("[store] session sync deferred", {
    operation,
    sessionId: session.id,
    ownerUserId: session.ownerUserId,
    message: error instanceof Error ? error.message : String(error)
  });
}

export async function createSession(options?: { id?: string; title?: string; ownerUserId?: string; sourceUseCase?: string }): Promise<SessionRecord> {
  await reconcileClaimedLocalSessionOwner(options?.id, options?.ownerUserId);
  const session = createLocalSession(options);
  if (isSupabaseStoreEnabled(session.ownerUserId)) {
    try {
      await persistSupabaseSession(session);
    } catch (error) {
      logSessionSyncFailure(session, "createSession", error);
    }
  }
  return session;
}

export async function getSession(
  id: string,
  ownerUserId?: string,
  options?: { requirePersisted?: boolean }
): Promise<SessionRecord | null> {
  const localSession = getLocalSession(id, ownerUserId);
  if (!isSupabaseStoreEnabled(ownerUserId)) {
    return localSession;
  }

  const remoteSession = await fetchSupabaseSessionById(id, ownerUserId, options);
  if (options?.requirePersisted) return remoteSession;
  if (!remoteSession) return localSession;
  if (!localSession) return remoteSession;

  return new Date(localSession.updatedAt).getTime() >= new Date(remoteSession.updatedAt).getTime()
    ? localSession
    : remoteSession;
}

export async function listSessions(ownerUserId?: string, options?: { limit?: number }): Promise<SessionRecord[]> {
  const localSessions = listLocalSessions(ownerUserId);
  if (!isSupabaseStoreEnabled(ownerUserId)) {
    return applySessionLimit(localSessions, options?.limit);
  }

  const owner = resolveOwnerScope(ownerUserId);
  if (!owner) return applySessionLimit(localSessions, options?.limit);

  const client = getSupabaseAdminClient();
  const buildQuery = (includeDeletedAtFilter: boolean) => {
    let query = client
      .from("sessions")
      .select("*");
    if (includeDeletedAtFilter) {
      query = applyNotDeletedSessionFilter(query);
    }
    query = applyOwnerFilter(query, owner).order("updated_at", { ascending: false });

    if (options?.limit && Number.isFinite(options.limit) && options.limit > 0) {
      query = query.limit(Math.max(1, Math.floor(options.limit)));
    }

    return query;
  };

  let result = await buildQuery(true);
  if (isMissingDeletedAtColumnError(result.error)) {
    result = await buildQuery(false);
  }
  const { data, error } = result;

  if (error || !data) return applySessionLimit(localSessions, options?.limit);

  const merged = new Map<string, SessionRecord>();
  for (const row of data as Array<Record<string, unknown>>) {
    const session = mapSessionRow(row);
    merged.set(session.id, session);
  }
  for (const session of localSessions) {
    const existing = merged.get(session.id);
    if (!existing || new Date(session.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
      merged.set(session.id, session);
    }
  }

  const ordered = [...merged.values()].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
  return applySessionLimit(ordered, options?.limit);
}

export async function searchSessions(
  queryText: string,
  ownerUserId?: string,
  options?: { limit?: number }
): Promise<SessionRecord[]> {
  const normalizedQuery = normalizeSearchQuery(queryText);
  const limit = Math.max(1, Math.floor(options?.limit ?? 10));
  if (!normalizedQuery) {
    return listSessions(ownerUserId, { limit });
  }

  const localSessions = listLocalSessions(ownerUserId);
  const localMatches = localSessions.filter((session) => {
    const titleMatch = normalizeSearchQuery(session.title).includes(normalizedQuery);
    if (titleMatch) return true;
    const localJob = session.lastJobId ? getLocalJob(session.lastJobId, ownerUserId) : null;
    const preview = localJob ? buildJobPreview(localJob) : "";
    return normalizeSearchQuery(preview).includes(normalizedQuery);
  });

  if (!isSupabaseStoreEnabled(ownerUserId)) {
    return applySessionLimit(localMatches, limit);
  }

  const owner = resolveOwnerScope(ownerUserId);
  if (!owner) {
    return applySessionLimit(localMatches, limit);
  }

  const client = getSupabaseAdminClient();
  const likeQuery = `%${normalizedQuery}%`;
  const matchedById = new Map<string, SessionRecord>();

  const buildTitleQuery = (includeDeletedAtFilter: boolean) => {
    let query = client
      .from("sessions")
      .select("*")
      .ilike("title", likeQuery);
    if (includeDeletedAtFilter) {
      query = applyNotDeletedSessionFilter(query);
    }
    return applyOwnerFilter(query, owner)
      .order("updated_at", { ascending: false })
      .limit(limit);
  };
  let titleResult = await buildTitleQuery(true);
  if (isMissingDeletedAtColumnError(titleResult.error)) {
    titleResult = await buildTitleQuery(false);
  }
  const { data: titleRows } = titleResult;

  for (const row of (titleRows as Array<Record<string, unknown>> | null) ?? []) {
    const session = mapSessionRow(row);
    matchedById.set(session.id, session);
  }

  if (matchedById.size < limit) {
    let jobSearchQuery = client
      .from("jobs")
      .select("session_id,created_at,input_text,source_input_text,error_text")
      .or(`input_text.ilike.${likeQuery},source_input_text.ilike.${likeQuery},error_text.ilike.${likeQuery}`);
    jobSearchQuery = applyOwnerFilter(jobSearchQuery, owner)
      .order("created_at", { ascending: false })
      .limit(limit * 3);
    const { data: jobRows } = await jobSearchQuery;

    const candidateSessionIds = [...new Set(
      ((jobRows as Array<Record<string, unknown>> | null) ?? [])
        .map((row) => readString(row.session_id))
        .filter(Boolean)
    )].filter((id) => !matchedById.has(id));

    if (candidateSessionIds.length) {
      const buildSessionSearchQuery = (includeDeletedAtFilter: boolean) => {
        let query = client
          .from("sessions")
          .select("*")
          .in("id", candidateSessionIds);
        if (includeDeletedAtFilter) {
          query = applyNotDeletedSessionFilter(query);
        }
        return applyOwnerFilter(query, owner)
          .order("updated_at", { ascending: false })
          .limit(limit);
      };
      let sessionSearchResult = await buildSessionSearchQuery(true);
      if (isMissingDeletedAtColumnError(sessionSearchResult.error)) {
        sessionSearchResult = await buildSessionSearchQuery(false);
      }
      const { data: sessionRows } = sessionSearchResult;

      for (const row of (sessionRows as Array<Record<string, unknown>> | null) ?? []) {
        const session = mapSessionRow(row);
        matchedById.set(session.id, session);
      }
    }
  }

  for (const session of localMatches) {
    const existing = matchedById.get(session.id);
    if (!existing || new Date(session.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
      matchedById.set(session.id, session);
    }
  }

  return [...matchedById.values()]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, limit);
}

export async function renameSession(
  id: string,
  title: string,
  ownerUserId?: string,
  options?: { expectedTitle: string; allowedLocalFallbackTitles?: string[] }
): Promise<SessionRecord | null> {
  // Background naming must win the durable comparison before changing the cache.
  if (options && isSupabaseStoreEnabled(ownerUserId)) {
    const owner = resolveOwnerScope(ownerUserId);
    if (!owner) return null;
    const previousLocalTitle = getLocalSession(id, ownerUserId)?.title;
    if (previousLocalTitle !== undefined
      && previousLocalTitle !== options.expectedTitle
      && !options.allowedLocalFallbackTitles?.includes(previousLocalTitle)) return null;
    const { data, error } = await applyOwnerFilter(
      getSupabaseAdminClient().from("sessions")
        .update({ title: title.trim(), updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("title", options.expectedTitle)
        .is("deleted_at", null),
      owner
    ).select("*").maybeSingle();
    if (error) throw new Error(`Unable to save session title: ${error.message}`);
    if (!data) return null;
    const persisted = mapSessionRow(data as Record<string, unknown>);
    const currentLocalTitle = getLocalSession(id, ownerUserId)?.title;
    if (currentLocalTitle !== undefined
      && (currentLocalTitle === previousLocalTitle
        || options.allowedLocalFallbackTitles?.includes(currentLocalTitle))) {
      renameLocalSession(id, persisted.title, ownerUserId, { expectedTitle: currentLocalTitle });
    }
    return persisted;
  }
  if (options) return renameLocalSession(id, title, ownerUserId, options);
  const updatedLocal = renameLocalSession(id, title, ownerUserId);
  if (!isSupabaseStoreEnabled(ownerUserId)) {
    return updatedLocal;
  }

  const owner = resolveOwnerScope(ownerUserId);
  if (!owner) return updatedLocal;

  const client = getSupabaseAdminClient();
  const updatedAt = new Date().toISOString();
  const updateQuery = client
    .from("sessions")
    .update({
      title: updatedLocal?.title ?? title.trim(),
      updated_at: updatedAt
    })
    .eq("id", id);
  const { data, error } = await applyOwnerFilter(updateQuery, owner)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return updatedLocal;
  }
  return mapSessionRow(data as Record<string, unknown>);
}

export async function setSessionAgentResponseId(
  id: string,
  agentResponseId: string | undefined,
  ownerUserId?: string,
  options?: {
    expectedCurrentResponseId?: string | null;
    requirePersisted?: boolean;
  }
): Promise<SessionRecord | null> {
  const hasExpectedCurrentResponseId = Boolean(
    options && Object.prototype.hasOwnProperty.call(options, "expectedCurrentResponseId")
  );
  const expectedCurrentResponseId = options?.expectedCurrentResponseId?.trim() || undefined;
  const setLocalIfCurrentMatches = () => {
    const current = getLocalSession(id, ownerUserId);
    if (
      hasExpectedCurrentResponseId
      && current?.agentResponseId !== expectedCurrentResponseId
    ) {
      return current;
    }
    return setLocalSessionAgentResponseId(id, agentResponseId, ownerUserId);
  };
  if (!isSupabaseStoreEnabled(ownerUserId)) {
    return setLocalIfCurrentMatches();
  }

  const owner = resolveOwnerScope(ownerUserId);
  if (!owner) return setLocalIfCurrentMatches();

  const updatedAt = new Date().toISOString();
  let lastError: { message?: string } | null = null;
  for (let attempt = 1; attempt <= SESSION_AGENT_RESPONSE_ID_PERSIST_MAX_ATTEMPTS; attempt += 1) {
    let updateQuery = getSupabaseAdminClient()
      .from("sessions")
      .update({
        agent_response_id: agentResponseId?.trim() || null,
        updated_at: updatedAt
      })
      .eq("id", id);
    if (hasExpectedCurrentResponseId) {
      updateQuery = expectedCurrentResponseId
        ? updateQuery.eq("agent_response_id", expectedCurrentResponseId)
        : updateQuery.is("agent_response_id", null);
    }
    const { data, error } = await applyOwnerFilter(updateQuery, owner)
      .select("*")
      .maybeSingle();

    if (!error && data) {
      const persisted = mapSessionRow(data as Record<string, unknown>);
      setLocalSessionAgentResponseId(id, persisted.agentResponseId, ownerUserId);
      return persisted;
    }
    if (!error && hasExpectedCurrentResponseId) {
      const current = await fetchSupabaseSessionById(id, ownerUserId);
      if (current) {
        setLocalSessionAgentResponseId(id, current.agentResponseId, ownerUserId);
        return current;
      }
    }
    lastError = error;
    if (attempt < SESSION_AGENT_RESPONSE_ID_PERSIST_MAX_ATTEMPTS) {
      await sleep(SESSION_AGENT_RESPONSE_ID_PERSIST_RETRY_DELAY_MS * attempt);
    }
  }

  console.warn("[store] failed to persist session agent response id after retries", {
    sessionId: id,
    attempts: SESSION_AGENT_RESPONSE_ID_PERSIST_MAX_ATTEMPTS,
    error: lastError?.message ?? "no row returned"
  });
  if (options?.requirePersisted) {
    if (agentResponseId === undefined) {
      setLocalIfCurrentMatches();
    }
    return null;
  }
  return setLocalIfCurrentMatches();
}

export async function setSessionInputModeOverride(
  id: string,
  inputModeOverride: "pipeline" | "agent" | undefined,
  ownerUserId?: string,
  options?: { requirePersisted?: boolean }
): Promise<SessionRecord | null> {
  const setLocal = () => setLocalSessionInputModeOverride(
    id,
    inputModeOverride,
    ownerUserId
  );
  if (!isSupabaseStoreEnabled(ownerUserId)) return setLocal();

  const owner = resolveOwnerScope(ownerUserId);
  if (!owner) return setLocal();
  let lastError: { message?: string } | null = null;
  for (let attempt = 1; attempt <= SESSION_INPUT_MODE_OVERRIDE_PERSIST_MAX_ATTEMPTS; attempt += 1) {
    const { data, error } = await applyOwnerFilter(
      getSupabaseAdminClient()
        .from("sessions")
        .update({
          input_mode_override: inputModeOverride ?? null,
          updated_at: new Date().toISOString()
        })
        .eq("id", id),
      owner
    ).select("*").maybeSingle();

    if (!error && data) {
      const persisted = mapSessionRow(data as Record<string, unknown>);
      setLocalSessionInputModeOverride(id, persisted.inputModeOverride, ownerUserId);
      return persisted;
    }
    lastError = error;
    if (attempt < SESSION_INPUT_MODE_OVERRIDE_PERSIST_MAX_ATTEMPTS) {
      await sleep(SESSION_INPUT_MODE_OVERRIDE_PERSIST_RETRY_DELAY_MS * attempt);
    }
  }
  console.warn("[store] failed to persist session input mode override after retries", {
    sessionId: id,
    attempts: SESSION_INPUT_MODE_OVERRIDE_PERSIST_MAX_ATTEMPTS,
    error: lastError?.message ?? "no row returned"
  });
  return options?.requirePersisted ? null : setLocal();
}

export async function deleteSession(id: string, ownerUserId?: string): Promise<boolean> {
  const removedLocal = deleteLocalSession(id, ownerUserId);
  if (!isSupabaseStoreEnabled(ownerUserId)) {
    return removedLocal;
  }

  const owner = resolveOwnerScope(ownerUserId);
  if (!owner) return removedLocal;

  const client = getSupabaseAdminClient();
  const deletedAt = new Date().toISOString();
  const { data, error } = await applyOwnerFilter(
    client
      .from("sessions")
      .update({
        deleted_at: deletedAt
      })
      .eq("id", id)
      .is("deleted_at", null),
    owner
  )
    .select("id")
    .maybeSingle();
  if (isMissingDeletedAtColumnError(error)) {
    const { error: legacyDeleteError } = await applyOwnerFilter(client.from("sessions").delete().eq("id", id), owner);
    if (legacyDeleteError) {
      return removedLocal;
    }
    return removedLocal || true;
  }
  if (error || !data) {
    return removedLocal;
  }
  return removedLocal || true;
}

export async function clearAllSessions(ownerUserId?: string): Promise<{ deletedSessions: number; deletedJobs: number }> {
  const localSummary = clearLocalSessions(ownerUserId);
  if (!isSupabaseStoreEnabled(ownerUserId)) {
    return localSummary;
  }

  const owner = resolveOwnerScope(ownerUserId);
  if (!owner) return localSummary;

  const client = getSupabaseAdminClient();
  const { count: sessionCount } = await client
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq(owner.column, owner.id);
  const { count: jobCount } = await client
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq(owner.column, owner.id);

  await client.from("sessions").delete().eq(owner.column, owner.id);
  return {
    deletedSessions: Math.max(localSummary.deletedSessions, sessionCount ?? 0),
    deletedJobs: Math.max(localSummary.deletedJobs, jobCount ?? 0)
  };
}

export async function listSessionJobs(
  sessionId: string,
  ownerUserId?: string,
  options?: {
    includeEvents?: boolean;
    recover?: boolean;
    requirePersisted?: boolean;
  }
): Promise<JobRecord[]> {
  // Durable-history comparison must never recover or replay cached Jobs.
  const localOptions = { recover: options?.requirePersisted ? false : options?.recover };
  const localJobs = listLocalSessionJobs(sessionId, ownerUserId, localOptions);
  if (!isSupabaseStoreEnabled(ownerUserId)) {
    return localJobs;
  }

  if (options?.requirePersisted) {
    return readConsistentPersistedSessionJobs({
      readLocal: () => listLocalSessionJobs(sessionId, ownerUserId, { recover: false }),
      readPersisted: () => fetchSupabaseJobsBySession(sessionId, ownerUserId, options)
    });
  }
  const remoteJobs = await fetchSupabaseJobsBySession(sessionId, ownerUserId, options);
  return mergeJobs(localJobs, remoteJobs);
}

/** Display snapshots must never be used as execution or Agent history inputs. */
export async function listSessionDisplayJobs(
  sessionId: string,
  ownerUserId: string,
  options?: { recover?: boolean }
): Promise<JobRecord[]> {
  const localJobs = listLocalSessionJobs(sessionId, ownerUserId, options);
  if (!isSupabaseStoreEnabled(ownerUserId)) return localJobs;
  const remoteJobs = await fetchSupabaseJobsBySession(sessionId, ownerUserId, {
    includeEvents: false, displayOnly: true, recover: options?.recover
  });
  return mergeJobs(localJobs, remoteJobs);
}

export async function listSessionPreviewTexts(
  sessionIds: string[],
  ownerUserId?: string
): Promise<Record<string, string>> {
  const uniqueSessionIds = [...new Set(sessionIds.map((item) => item.trim()).filter(Boolean))];
  if (!uniqueSessionIds.length) return {};

  const localSessions = listLocalSessions(ownerUserId).filter((item) => uniqueSessionIds.includes(item.id));
  const previews: Record<string, string> = {};

  for (const session of localSessions) {
    const localJob = session.lastJobId ? getLocalJob(session.lastJobId, ownerUserId) : null;
    if (!localJob) continue;
    const preview = buildJobPreview(localJob);
    if (preview) {
      previews[session.id] = preview;
    }
  }

  if (!isSupabaseStoreEnabled(ownerUserId)) {
    return previews;
  }

  const owner = resolveOwnerScope(ownerUserId);
  if (!owner) return previews;

  const client = getSupabaseAdminClient();
  let sessionPreviewQuery = client
    .from("sessions")
    .select("id,last_job_id")
    .in("id", uniqueSessionIds);
  sessionPreviewQuery = applyOwnerFilter(sessionPreviewQuery, owner);
  const { data: sessionRows, error: sessionError } = await sessionPreviewQuery;

  if (sessionError || !sessionRows) {
    return previews;
  }

  const lastJobIds = [...new Set(
    (sessionRows as Array<Record<string, unknown>>)
      .map((item) => readOptionalString(item.last_job_id))
      .filter(Boolean)
  )];

  if (!lastJobIds.length) {
    return previews;
  }

  let jobPreviewQuery = client
    .from("jobs")
    .select("id,session_id,input_text,source_input_text,payload_json,result_json,error_text")
    .in("id", lastJobIds);
  jobPreviewQuery = applyOwnerFilter(jobPreviewQuery, owner);
  const { data: jobRows, error: jobError } = await jobPreviewQuery;

  if (jobError || !jobRows) {
    return previews;
  }

  for (const row of jobRows as Array<Record<string, unknown>>) {
    const sessionId = readString(row.session_id);
    if (!sessionId || previews[sessionId]) continue;
    const preview = buildJobPreviewFromRow(row);
    if (preview) {
      previews[sessionId] = preview;
    }
  }

  return previews;
}

export async function listSessionJobCounts(
  sessionIds: string[],
  ownerUserId?: string
): Promise<Record<string, number>> {
  const uniqueSessionIds = [...new Set(sessionIds.map((item) => item.trim()).filter(Boolean))];
  if (!uniqueSessionIds.length) {
    return {};
  }

  const jobIdsBySession = new Map<string, Set<string>>();
  for (const sessionId of uniqueSessionIds) {
    const localJobIds = new Set(listLocalSessionJobs(sessionId, ownerUserId).map((job) => job.id));
    jobIdsBySession.set(sessionId, localJobIds);
  }

  if (!isSupabaseStoreEnabled(ownerUserId)) {
    return Object.fromEntries(uniqueSessionIds.map((sessionId) => [sessionId, jobIdsBySession.get(sessionId)?.size ?? 0]));
  }

  const owner = resolveOwnerScope(ownerUserId);
  if (!owner) {
    return Object.fromEntries(uniqueSessionIds.map((sessionId) => [sessionId, jobIdsBySession.get(sessionId)?.size ?? 0]));
  }

  const client = getSupabaseAdminClient();
  let jobCountQuery = client
    .from("jobs")
    .select("id, session_id")
    .in("session_id", uniqueSessionIds);
  jobCountQuery = applyOwnerFilter(jobCountQuery, owner);
  const { data, error } = await jobCountQuery;

  if (!error && Array.isArray(data)) {
    for (const row of data as Array<Record<string, unknown>>) {
      const sessionId = readString(row.session_id);
      const jobId = readString(row.id);
      if (!sessionId || !jobId) continue;
      const sessionJobIds = jobIdsBySession.get(sessionId) ?? new Set<string>();
      sessionJobIds.add(jobId);
      jobIdsBySession.set(sessionId, sessionJobIds);
    }
  }

  return Object.fromEntries(uniqueSessionIds.map((sessionId) => [sessionId, jobIdsBySession.get(sessionId)?.size ?? 0]));
}

export async function createJob(
  payload: JobRecord["payload"],
  options?: { sessionId?: string; ownerUserId?: string }
): Promise<JobRecord> {
  await reconcileClaimedLocalSessionOwner(options?.sessionId, options?.ownerUserId);
  const job = createLocalJob(payload, { ...options, triggerHostname: await readRequestTriggerHostname() });
  if (!isSupabaseStoreEnabled(job.ownerUserId ?? options?.ownerUserId)) {
    return job;
  }

  const owner = normalizeOwnerUserId(job.ownerUserId ?? options?.ownerUserId);
  if (!owner) {
    return job;
  }

  const localSession = getLocalSession(job.sessionId, owner);
  if (shouldStartBackgroundJobSync(job)) {
    startJobSyncLoop(job.id, owner);
  }
  try {
    await syncSupabaseJobAndSession(job, localSession ?? undefined, { assumeNewJob: true });
  } catch (error) {
    deferJobSyncAfterFailure(job, owner, "createJob", error);
    return job;
  }
  return job;
}

export async function createQueuedJob(
  payload: JobRecord["payload"],
  options?: {
    sessionId?: string;
    ownerUserId?: string;
    mode?: JobRecord["mode"];
    parentJobId?: string;
    baseJobId?: string;
    syncSession?: boolean;
    syncSessionLastJob?: boolean;
  }
): Promise<JobRecord> {
  await reconcileClaimedLocalSessionOwner(options?.sessionId, options?.ownerUserId);
  payload = await assignQueuedImageModel(payload, options?.ownerUserId);
  let job = createLocalQueuedJob(payload, { ...options, triggerHostname: await readRequestTriggerHostname() });
  job = appendAgentLifecycleEvent(null, job, options?.ownerUserId);
  if (!isSupabaseStoreEnabled(job.ownerUserId ?? options?.ownerUserId)) {
    return job;
  }

  const owner = normalizeOwnerUserId(job.ownerUserId ?? options?.ownerUserId);
  if (!owner) {
    return job;
  }

  const localSession = getLocalSession(job.sessionId, owner);
  if (shouldStartBackgroundJobSync(job)) {
    startJobSyncLoop(job.id, owner);
  }
  try {
    await syncSupabaseJobAndSession(job, localSession ?? undefined, {
      syncSession: options?.syncSession,
      syncSessionLastJob: options?.syncSessionLastJob,
      assumeNewJob: true
    });
  } catch (error) {
    deferJobSyncAfterFailure(job, owner, "createQueuedJob", error);
    return job;
  }
  return job;
}

export async function patchQueuedJob(
  jobId: string,
  patch: Partial<JobRecord>,
  ownerUserId?: string,
  syncOptions?: PatchQueuedJobSyncOptions
): Promise<JobRecord | null> {
  const result = await patchQueuedJobWithSyncResult(jobId, patch, ownerUserId, syncOptions);
  return result.job;
}

export async function claimQueuedJobStageTransition(params: ClaimQueuedJobStageTransitionParams): Promise<boolean> {
  const previousJob = getLocalJob(params.jobId, params.ownerUserId, { recover: false });
  const previousSocialmedia = asRecord(previousJob?.payload.socialmedia);
  const previousPendingImageTasks = previousSocialmedia?.pendingImageTasks;
  const pendingImageTaskMatches = !params.expectedPendingImageTaskId || (
    Array.isArray(previousPendingImageTasks)
    && previousPendingImageTasks.some(
      (task) => readString(asRecord(task)?.taskId) === params.expectedPendingImageTaskId
    )
  );
  const localStageMatches = previousJob?.status === params.fromStatus
    && previousJob.stage === params.fromStage
    && pendingImageTaskMatches
    && (!params.expectedUpdatedAt || previousJob.updatedAt === params.expectedUpdatedAt);
  const targetStatus = params.toStatus ?? params.fromStatus;
  const transitionedAt = new Date().toISOString();
  const localPatch: Partial<JobRecord> = {
    status: targetStatus,
    stage: params.toStage,
    updatedAt: transitionedAt
  };
  if (params.progress !== undefined) {
    localPatch.progress = params.progress;
  }
  if (params.payload) {
    localPatch.payload = params.payload;
  }
  if (Object.prototype.hasOwnProperty.call(params, "result")) {
    localPatch.result = params.result;
  }
  if (Object.prototype.hasOwnProperty.call(params, "error")) {
    localPatch.error = params.error ?? undefined;
  }

  if (!isSupabaseStoreEnabled(params.ownerUserId)) {
    if (!localStageMatches) return false;
    const transitioned = patchLocalQueuedJob(params.jobId, localPatch, params.ownerUserId);
    if (transitioned) appendAgentLifecycleEvent(previousJob, transitioned, params.ownerUserId);
    return true;
  }

  const owner = resolveOwnerScope(params.ownerUserId);
  if (!owner) {
    if (!localStageMatches) return false;
    const transitioned = patchLocalQueuedJob(params.jobId, localPatch, params.ownerUserId);
    if (transitioned) appendAgentLifecycleEvent(previousJob, transitioned, params.ownerUserId);
    return true;
  }

  const updates: Record<string, unknown> = {
    status: targetStatus,
    stage: params.toStage,
    updated_at: localPatch.updatedAt
  };
  if (params.progress !== undefined) {
    updates.progress = params.progress;
  }
  if (params.payload) {
    updates.payload_json = {
      ...params.payload,
      artifacts: [],
      changed_artifacts: [],
      rerun_plan: null,
      revision_intent: null
    };
  }
  if (Object.prototype.hasOwnProperty.call(params, "result")) {
    updates.result_json = params.result ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(params, "error")) {
    updates.error_text = params.error ?? null;
  }
  if (targetStatus === "completed" || targetStatus === "failed") {
    updates.finished_at = transitionedAt;
  }

  const client = getSupabaseAdminClient();
  let query = client
    .from("jobs")
    .update(updates)
    .eq("id", params.jobId)
    .eq("status", params.fromStatus)
    .eq("stage", params.fromStage);
  if (params.expectedUpdatedAt) {
    query = query.eq("updated_at", params.expectedUpdatedAt);
  }
  if (params.expectedPendingImageTaskId) {
    query = query.contains("payload_json", {
      socialmedia: {
        pendingImageTasks: [{ taskId: params.expectedPendingImageTaskId }]
      }
    });
  }
  query = applyOwnerFilter(query, owner);

  const { data, error } = await query.select("id").maybeSingle();
  if (error) {
    throw new Error(`Failed to claim job ${params.jobId} stage ${params.fromStage}->${params.toStage}: ${error.message}`);
  }
  if (!data?.id) {
    return false;
  }

  managedLocalPatchSyncs.add(params.jobId);
  let transitioned: JobRecord | null;
  try {
    transitioned = patchLocalQueuedJob(params.jobId, localPatch, params.ownerUserId);
  } finally {
    managedLocalPatchSyncs.delete(params.jobId);
  }
  transitioned ??= await fetchSupabaseJobById(params.jobId, params.ownerUserId, { recover: false });
  if (!transitioned) return true;

  const eventfulJob = appendAgentLifecycleEvent(previousJob, transitioned, params.ownerUserId);
  if (eventfulJob === transitioned) return true;

  try {
    const session = getLocalSession(eventfulJob.sessionId, owner.id)
      ?? await fetchSupabaseSessionById(eventfulJob.sessionId, eventfulJob.ownerUserId ?? params.ownerUserId);
    const sync = await syncSupabaseJobAndSessionWithRetry(eventfulJob, session ?? undefined, {
      operation: "claimQueuedJobStageTransition"
    });
    if (!sync.ok) {
      console.warn("[store] failed to persist agent lifecycle event after claimed transition", {
        jobId: params.jobId,
        stage: params.toStage,
        error: sync.error ?? "Unknown sync failure"
      });
    }
  } catch (syncError) {
    // The atomic stage claim already succeeded. Keep generation running when
    // observability persistence is temporarily unavailable.
    console.warn("[store] failed to persist agent lifecycle event after claimed transition", {
      jobId: params.jobId,
      stage: params.toStage,
      error: syncError instanceof Error ? syncError.message : String(syncError)
    });
  }
  return true;
}

export async function patchQueuedJobWithSyncResult(
  jobId: string,
  patch: Partial<JobRecord>,
  ownerUserId?: string,
  syncOptions?: PatchQueuedJobSyncOptions
): Promise<PatchQueuedJobResult> {
  const previousJob = getLocalJob(jobId, ownerUserId);
  managedLocalPatchSyncs.add(jobId);
  let job: JobRecord | null;
  try {
    job = patchLocalQueuedJob(jobId, patch, ownerUserId);
  } finally {
    managedLocalPatchSyncs.delete(jobId);
  }
  let localSession: SessionRecord | null | undefined;

  if (!job && isSupabaseStoreEnabled(ownerUserId)) {
    const remoteJob = await fetchSupabaseJobById(jobId, ownerUserId, { recover: false });
    if (remoteJob) {
      job = {
        ...remoteJob,
        ...patch,
        updatedAt: new Date().toISOString()
      };
      localSession = await fetchSupabaseSessionById(job.sessionId, job.ownerUserId ?? ownerUserId);
      if (localSession && job.status === "completed") {
        localSession = {
          ...localSession,
          lastJobId: job.id,
          updatedAt: job.updatedAt
        };
      }
    }
  }

  if (!job) {
    return {
      job: null,
      sync: { enabled: false, ok: false, attempts: 0, error: "JOB_NOT_FOUND" }
    };
  }
  job = appendAgentLifecycleEvent(previousJob, job, ownerUserId);
  if (!isSupabaseStoreEnabled(job.ownerUserId ?? ownerUserId)) {
    return {
      job,
      sync: { enabled: false, ok: true, attempts: 0 }
    };
  }

  const owner = normalizeOwnerUserId(job.ownerUserId ?? ownerUserId);
  if (!owner) {
    return {
      job,
      sync: { enabled: false, ok: true, attempts: 0 }
    };
  }

  localSession ??= getLocalSession(job.sessionId, owner);
  const sync = await syncSupabaseJobAndSessionWithRetry(job, localSession ?? undefined, {
    ...syncOptions,
    operation: syncOptions?.operation ?? "patchQueuedJob"
  });
  if (!sync.ok) {
    deferJobSyncAfterFailure(job, owner, syncOptions?.operation ?? "patchQueuedJob", sync.error ?? "Unknown sync failure");
    return { job, sync };
  }
  if (job.status === "completed" || job.status === "failed") {
    stopJobSyncLoop(job.id);
    stopJobSyncSubscription(job.id);
  }
  return { job, sync };
}

export async function createConversationJob(
  payload: JobRecord["payload"],
  options?: { sessionId?: string; ownerUserId?: string; usageSummary?: UsageSnapshot | null }
): Promise<JobRecord> {
  await reconcileClaimedLocalSessionOwner(options?.sessionId, options?.ownerUserId);
  const job = createLocalConversationJob(payload, { ...options, triggerHostname: await readRequestTriggerHostname() });
  if (!isSupabaseStoreEnabled(job.ownerUserId ?? options?.ownerUserId)) {
    return job;
  }

  const owner = normalizeOwnerUserId(job.ownerUserId ?? options?.ownerUserId);
  if (!owner) {
    return job;
  }

  const localSession = getLocalSession(job.sessionId, owner);
  startJobSyncLoop(job.id, owner);
  try {
    await syncSupabaseJobAndSession(job, localSession ?? undefined);
  } catch (error) {
    deferJobSyncAfterFailure(job, owner, "createConversationJob", error);
    return job;
  }
  scheduleImmediateJobSync(job.id, owner);
  return job;
}

export async function saveJobPreflightEvents(
  jobId: string,
  preflightEvents: JobRecord["payload"]["preflightEvents"],
  ownerUserId?: string
): Promise<JobRecord | null> {
  const localJob = saveLocalJobPreflightEvents(jobId, preflightEvents, ownerUserId);
  if (!localJob) return null;
  if (!isSupabaseStoreEnabled(localJob.ownerUserId ?? ownerUserId)) return localJob;

  const owner = normalizeOwnerUserId(localJob.ownerUserId ?? ownerUserId);
  if (!owner) return localJob;

  const localSession = getLocalSession(localJob.sessionId, owner);
  try {
    await syncSupabaseJobAndSession(localJob, localSession ?? undefined);
  } catch (error) {
    deferJobSyncAfterFailure(localJob, owner, "saveJobPreflightEvents", error);
    return localJob;
  }
  scheduleImmediateJobSync(localJob.id, owner);
  return localJob;
}

export async function createRevisionJob(
  parentJobId: string,
  revisePayload: RevisePayload,
  options?: { ownerUserId?: string }
): Promise<JobRecord | null> {
  const revision = createLocalRevisionJob(parentJobId, revisePayload, { ...options, triggerHostname: await readRequestTriggerHostname() });
  if (!revision) return null;
  if (!isSupabaseStoreEnabled(revision.ownerUserId ?? options?.ownerUserId)) return revision;

  const owner = normalizeOwnerUserId(revision.ownerUserId ?? options?.ownerUserId);
  if (!owner) return revision;

  const localSession = getLocalSession(revision.sessionId, owner);
  startJobSyncLoop(revision.id, owner);
  try {
    await syncSupabaseJobAndSession(revision, localSession ?? undefined);
  } catch (error) {
    deferJobSyncAfterFailure(revision, owner, "createRevisionJob", error);
    return revision;
  }
  scheduleImmediateJobSync(revision.id, owner);
  return revision;
}

export async function getJob(id: string, ownerUserId?: string): Promise<JobRecord | null> {
  const localJob = getLocalJob(id, ownerUserId);
  if (!isSupabaseStoreEnabled(ownerUserId)) return localJob;
  const remoteJob = await fetchSupabaseJobById(id, ownerUserId);
  if (!localJob) return remoteJob;
  if (!remoteJob) return localJob;
  return chooseMergedJob(localJob, remoteJob);
}

export async function getInternalReadonlyJob(
  id: string,
  options?: { preferPersisted?: boolean }
): Promise<JobRecord | null> {
  if (options?.preferPersisted && supabaseConfig.adminEnabled) {
    return fetchSupabaseJobById(id, undefined, { recover: false });
  }
  const localJob = getLocalJob(id, undefined, { recover: false });
  if (localJob) return localJob;
  if (!supabaseConfig.adminEnabled) return null;
  return fetchSupabaseJobById(id, undefined, { recover: false });
}

export async function getInternalReadonlySession(
  id: string,
  options?: { requirePersisted?: boolean }
): Promise<SessionRecord | null> {
  if (options?.requirePersisted) {
    if (!supabaseConfig.adminEnabled) return null;
    return fetchSupabaseSessionById(id, undefined, options);
  }
  const localSession = getLocalSession(id);
  if (localSession) return localSession;
  if (!supabaseConfig.adminEnabled) return null;
  return fetchSupabaseSessionById(id, undefined, options);
}

export async function listInternalReadonlySessionJobs(sessionId: string): Promise<JobRecord[]> {
  const localJobs = listLocalSessionJobs(sessionId);
  if (!supabaseConfig.adminEnabled) return localJobs;
  const remoteJobs = await fetchSupabaseJobsBySession(sessionId, undefined, { recover: false });
  return mergeJobs(localJobs, remoteJobs);
}

export async function createShare(
  sessionId: string,
  options?: { visibility?: SessionVisibility; expiresAt?: string; ownerUserId?: string }
): Promise<ShareRecord | null> {
  let share = createLocalShare(sessionId, options);
  if (!share && isSupabaseStoreEnabled(options?.ownerUserId)) {
    const session = await fetchSupabaseSessionById(sessionId, options?.ownerUserId);
    if (session) {
      share = {
        id: randomUUID(),
        ownerUserId: session.ownerUserId,
        sessionId: session.id,
        token: randomUUID().replace(/-/g, ""),
        visibility: options?.visibility ?? "public",
        expiresAt: options?.expiresAt,
        createdAt: new Date().toISOString()
      };
    }
  }

  if (!share) return null;
  if (isSupabaseStoreEnabled(share.ownerUserId)) {
    await persistSupabaseShare(share);
  }
  return share;
}

export async function adoptGuestWorkspace(
  guestUserId: string,
  targetUserId: string
): Promise<{
  sessions: number;
  jobs: number;
  shares: number;
}> {
  const migrated = adoptLocalGuestWorkspaceOwner(guestUserId, targetUserId);
  if (!migrated.sessions.length && !migrated.jobs.length && !migrated.shares.length) {
    if (isSupabaseStoreEnabled(targetUserId)) {
      await adoptSocialmediaMessages(guestUserId, targetUserId);
    }
    return { sessions: 0, jobs: 0, shares: 0 };
  }

  if (!isSupabaseStoreEnabled(targetUserId)) {
    return {
      sessions: migrated.sessions.length,
      jobs: migrated.jobs.length,
      shares: migrated.shares.length
    };
  }

  for (const session of migrated.sessions) {
    await persistSupabaseSessionWithoutLastJob(session);
  }

  for (const job of migrated.jobs) {
    await persistSupabaseJob(job);
    if ((job.status === "queued" || job.status === "running") && shouldStartBackgroundJobSync(job)) {
      startJobSyncLoop(job.id, targetUserId);
      scheduleImmediateJobSync(job.id, targetUserId);
    }
  }

  for (const session of migrated.sessions) {
    await persistSupabaseSession(session);
  }

  for (const share of migrated.shares) {
    await persistSupabaseShare(share);
  }

  await adoptSocialmediaMessages(guestUserId, targetUserId);

  return {
    sessions: migrated.sessions.length,
    jobs: migrated.jobs.length,
    shares: migrated.shares.length
  };
}

function isShareExpired(share: ShareRecord): boolean {
  if (!share.expiresAt) return false;
  return new Date(share.expiresAt).getTime() < Date.now();
}

export async function getShareByToken(token: string): Promise<ShareRecord | null> {
  const local = getLocalShareByToken(token);
  if (local) return local;
  if (!isSupabaseStoreEnabled()) return null;

  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("share_links")
    .select("*")
    .eq("token", token.trim())
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  const share: ShareRecord = {
    id: readString(row.id),
    ownerUserId: readOptionalString(row.user_id) ?? readOptionalString(row.guest_user_id),
    sessionId: readString(row.session_id),
    token: readString(row.token),
    visibility: readString(row.visibility) === "private" ? "private" : "public",
    expiresAt: readOptionalString(row.expires_at),
    createdAt: readString(row.created_at, new Date().toISOString())
  };
  return isShareExpired(share) ? null : share;
}

export {
  serializeJob,
  serializePublicJob,
  serializePublicSession,
  serializeSession,
  serializeSessionSummary
};
