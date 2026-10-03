import { hasRecoverableAsyncImageTask } from "@/lib/socialmedia/vectorengine-recovery";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { isGuestUserId } from "@/lib/auth/guest";
import type { ConversionRequest } from "@/lib/types/skills";
import { callGenericLlmJson } from "@/lib/llm/skill-client";
import { issueJobPollToken } from "@/lib/auth/job-poll-token";
import type {
  JobEvent,
  JobRecord,
  JobStatus,
  RevisePayload,
  SessionRecord,
  SessionVisibility,
  ShareRecord
} from "@/lib/types/job";
import { runConversion } from "@/lib/orchestrator";
import { buildArtifactsForGenerate, planRerun, runRevisionEngine } from "@/lib/revision/engine";
import { recordStyleHookMemory } from "@/lib/memory/style-hook-memory";
import { beginUsageScope, snapshotUsage, type UsageSnapshot } from "@/lib/llm/usage-tracker";
import { getAssistantStageNarration } from "@/lib/chat/block-registry";
import { normalizeContentMode } from "@/lib/types/skills";
import { generateCompletionNote } from "@/lib/agent/completion-note";
import {
  consumeCredits,
  getCreditSummary,
  isInsufficientCreditsError,
  recordBillingSettlementQueueEntry,
  recordCreditLedgerMarker,
  resolveBillingSettlementQueueEntry
} from "@/lib/billing/credits";
import { consumeGuestCredits, isInsufficientGuestCreditsError } from "@/lib/billing/guest-credits";
import { calculateUsageCharge, countBillableImages } from "@/lib/billing/usage-pricing";
import { materializeConversionResultImages, materializeDataImageUrlsDeep } from "@/lib/storage/generated-assets";
import { getStaleJobAutoReplayAuthGateResult } from "@/lib/studio/generation-access";
import { NeedsMoreSourceError } from "@/lib/skills/input-processor";
import { captureServerAnalyticsEventSoon } from "@/lib/analytics/posthog-server";
import { buildStaleApimartRecoveryJobState } from "@/lib/socialmedia/vectorengine-fallback";
import { trackRecoveredImageProviderFallbackStarted } from "@/lib/socialmedia/image-provider-telemetry";
import { GENERATION_SAFETY_BLOCKED_CODE, toUserFacingGenerationError } from "@/lib/socialmedia/user-facing-error";
import { isVideoGenerationSourceUseCase } from "@/lib/videos/source-use-case";
import { isVideoPersistenceRetryAllowed } from "@/lib/socialmedia/video-persistence-retry";

type PersistedState = {
  sessions: Record<string, SessionRecord>;
  jobs: Record<string, JobRecord>;
  sessionJobs: Record<string, string[]>;
  shares: Record<string, ShareRecord>;
};

type SessionPayload = JobRecord["payload"];
type JobObserver = (job: JobRecord) => void | Promise<void>;

declare global {
  // Process-local singleton maps for dev/runtime environments where modules can reload.
  var __CLAWVISUAL_SESSIONS__: Map<string, SessionRecord> | undefined;
  var __CLAWVISUAL_JOBS__: Map<string, JobRecord> | undefined;
  var __CLAWVISUAL_SESSION_JOBS__: Map<string, string[]> | undefined;
  var __CLAWVISUAL_SHARES__: Map<string, ShareRecord> | undefined;
  var __CLAWVISUAL_JOB_OBSERVERS__: Set<JobObserver> | undefined;
  var __CLAWVISUAL_STATE_LOADED__: boolean | undefined;
}

const sessions = globalThis.__CLAWVISUAL_SESSIONS__ ?? new Map<string, SessionRecord>();
if (!globalThis.__CLAWVISUAL_SESSIONS__) {
  globalThis.__CLAWVISUAL_SESSIONS__ = sessions;
}

const jobs = globalThis.__CLAWVISUAL_JOBS__ ?? new Map<string, JobRecord>();
if (!globalThis.__CLAWVISUAL_JOBS__) {
  globalThis.__CLAWVISUAL_JOBS__ = jobs;
}

const sessionJobs = globalThis.__CLAWVISUAL_SESSION_JOBS__ ?? new Map<string, string[]>();
if (!globalThis.__CLAWVISUAL_SESSION_JOBS__) {
  globalThis.__CLAWVISUAL_SESSION_JOBS__ = sessionJobs;
}

const shares = globalThis.__CLAWVISUAL_SHARES__ ?? new Map<string, ShareRecord>();
if (!globalThis.__CLAWVISUAL_SHARES__) {
  globalThis.__CLAWVISUAL_SHARES__ = shares;
}

const jobObservers = globalThis.__CLAWVISUAL_JOB_OBSERVERS__ ?? new Set<JobObserver>();
if (!globalThis.__CLAWVISUAL_JOB_OBSERVERS__) {
  globalThis.__CLAWVISUAL_JOB_OBSERVERS__ = jobObservers;
}

const STORE_DIR = join(process.cwd(), ".data");
const STORE_PATH = join(STORE_DIR, "clawvisual-store.json");
const STALE_FINALIZING_MAX_MS = 3 * 60 * 1000;
const STALE_RUNNING_MAX_MS = 10 * 60 * 1000;
const RUNNING_HEARTBEAT_INTERVAL_MS = 15 * 1000;
const AUTO_REPLAY_MAX_ATTEMPTS = 1;
const BILLING_SETTLEMENT_MAX_ATTEMPTS = 3;
const BILLING_SETTLEMENT_RETRY_DELAYS_MS = [250, 1000];
const STORE_PERSIST_DEBOUNCE_MS = Math.max(
  0,
  Number(process.env.CLAWVISUAL_STORE_PERSIST_DEBOUNCE_MS ?? 250) || 250
);
const STORE_PERSIST_SYNC =
  process.env.CLAWVISUAL_STORE_PERSIST_SYNC === "1"
  || process.env.NODE_ENV === "test";
let pendingPersistStateTimer: ReturnType<typeof setTimeout> | undefined;

function nowIso(): string {
  return new Date().toISOString();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, ms));
  });
}

function getDateDeltaMs(start?: string | null, end?: string | null): number | undefined {
  const startMs = Date.parse(start ?? "");
  const endMs = Date.parse(end ?? "");
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return undefined;
  return Math.max(0, endMs - startMs);
}

function normalizeOwnerUserId(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function isOwnedBy(recordOwnerUserId?: string, requestedOwnerUserId?: string): boolean {
  const requested = normalizeOwnerUserId(requestedOwnerUserId);
  if (!requested) return true;

  const recordOwner = normalizeOwnerUserId(recordOwnerUserId);
  if (!recordOwner) {
    return requested === "local-dev";
  }

  return recordOwner === requested;
}

function buildDefaultSessionTitle(index: number): string {
  return `Session ${index}`;
}

function isDefaultSessionTitle(title: string): boolean {
  return /^Session\s+\d+$/i.test(title.trim());
}

function sanitizeTitle(value: string, maxLength = 40): string {
  const normalized = value
    .replace(/\s+/g, " ")
    .replace(/\[[^\]]*]/g, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("timeout"));
    }, timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export function buildFallbackIntentTitle(inputText: string): string {
  const withoutUrl = inputText
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[#*_>`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!withoutUrl) {
    const urlMatch = inputText.match(/https?:\/\/\S+/i)?.[0] ?? "";
    if (urlMatch) {
      try {
        const host = new URL(urlMatch).hostname.replace(/^www\./, "");
        return sanitizeTitle(`Analyze ${host}`);
      } catch {
        return "Content Session";
      }
    }
    return "Content Session";
  }

  return sanitizeTitle(withoutUrl, 34);
}

async function inferIntentTitleWithLlm(inputText: string, outputLanguage: string): Promise<string | null> {
  const inferred = await callGenericLlmJson<{ title?: string }>({
    instruction:
      "Infer user intent and generate one concise session title for conversation history. Keep it specific and actionable, 3-8 words, no punctuation at end.",
    input: {
      user_input: inputText
    },
    outputSchemaHint: '{"title":"AI Skills for Content Transformation"}',
    outputLanguage,
    temperature: 0
  });

  const title = sanitizeTitle(String(inferred?.title ?? ""), 40);
  return title || null;
}

async function inferStageNarrationWithLlm(params: {
  stage: string;
  userInput: string;
  outputLanguage: string;
  outputPreview?: string;
  fallback: { title: string; thought: string; action: string };
}): Promise<{ title: string; thought: string; action: string }> {
  const { stage, userInput, outputLanguage, outputPreview, fallback } = params;
  try {
    const inferred = await withTimeout(
      callGenericLlmJson<{ title?: string; thought?: string; action?: string }>({
        instruction:
          "You generate assistant execution-step narration for progress logs. Keep it factual and concise. Return JSON only.",
        input: {
          user_goal: userInput,
          current_stage: stage,
          stage_output_preview: outputPreview ?? "",
          fallback
        },
        outputSchemaHint:
          '{"title":"分析用户需求","thought":"用户要求用中文输出博客文章。我正在识别可用素材与目标结构。","action":"读取素材并提炼可复用观点。"}',
        outputLanguage,
        temperature: 0
      }),
      700
    );

    const title = sanitizeTitle(String(inferred?.title ?? ""), 40) || fallback.title;
    const thought = String(inferred?.thought ?? "").replace(/\s+/g, " ").trim() || fallback.thought;
    const action = String(inferred?.action ?? "").replace(/\s+/g, " ").trim() || fallback.action;
    return { title, thought, action };
  } catch {
    return fallback;
  }
}

function toRequest(payload: SessionPayload): ConversionRequest {
  return {
    inputText: payload.sourceInputText ?? payload.inputText,
    inputPreprocessed: payload.inputPreprocessed,
    targetSlides: payload.targetSlides,
    aspectRatios: payload.aspectRatios ?? ["4:5"],
    platform: payload.platform,
    format: payload.format,
    imageCount: payload.imageCount,
    audience: payload.audience,
    promptHint: payload.promptHint,
    writingPolicy: payload.writingPolicy,
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

function toObject<T>(map: Map<string, T>): Record<string, T> {
  return Object.fromEntries(map.entries());
}

function fromObject<T>(value: Record<string, T> | undefined): Map<string, T> {
  if (!value) return new Map<string, T>();
  return new Map<string, T>(Object.entries(value));
}

function writePersistedState(): boolean {
  // Best-effort persistence: failures are non-fatal and should not crash request handling.
  try {
    mkdirSync(STORE_DIR, { recursive: true });
    const payload: PersistedState = {
      sessions: toObject(sessions),
      jobs: toObject(jobs),
      sessionJobs: toObject(sessionJobs),
      shares: toObject(shares)
    };
    writeFileSync(STORE_PATH, JSON.stringify(payload), "utf-8");
    return true;
  } catch (error) {
    console.warn("[job-store] persistState failed:", error instanceof Error ? error.message : String(error));
    return false;
  }
}

function persistState(): boolean {
  if (STORE_PERSIST_SYNC) {
    return writePersistedState();
  }

  if (pendingPersistStateTimer) {
    return true;
  }

  pendingPersistStateTimer = setTimeout(() => {
    pendingPersistStateTimer = undefined;
    writePersistedState();
  }, STORE_PERSIST_DEBOUNCE_MS);
  pendingPersistStateTimer.unref?.();
  return true;
}

function loadStateIfNeeded(): void {
  // Idempotent bootstrap from disk into in-memory maps.
  if (globalThis.__CLAWVISUAL_STATE_LOADED__) {
    return;
  }
  globalThis.__CLAWVISUAL_STATE_LOADED__ = true;

  try {
    const raw = readFileSync(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as PersistedState;

    for (const [id, session] of fromObject(parsed.sessions)) {
      sessions.set(id, session);
    }
    for (const [id, job] of fromObject(parsed.jobs)) {
      jobs.set(id, job);
    }
    for (const [id, list] of fromObject(parsed.sessionJobs)) {
      sessionJobs.set(id, Array.isArray(list) ? list : []);
    }
    for (const [id, share] of fromObject(parsed.shares)) {
      shares.set(id, share);
    }

    for (const [id, job] of jobs.entries()) {
      let changed = false;
      const normalized: JobRecord = { ...job };

      if (!normalized.baseJobId) {
        normalized.baseJobId = id;
        changed = true;
      }
      if (!normalized.revision || normalized.revision < 1) {
        normalized.revision = 1;
        changed = true;
      }
      if (!normalized.mode) {
        normalized.mode = "generate";
        changed = true;
      }
      if (!Array.isArray(normalized.artifacts)) {
        normalized.artifacts = [];
        changed = true;
      }
      if (!normalized.payload.contentMode) {
        normalized.payload.contentMode = "longform_digest";
        changed = true;
      }
      if (!normalized.ownerUserId) {
        const sessionOwnerUserId = sessions.get(normalized.sessionId)?.ownerUserId;
        if (sessionOwnerUserId) {
          normalized.ownerUserId = sessionOwnerUserId;
          changed = true;
        }
      }

      if (changed) {
        jobs.set(id, normalized);
      }
    }

    for (const [id, share] of shares.entries()) {
      if (share.ownerUserId) continue;
      const sessionOwnerUserId = sessions.get(share.sessionId)?.ownerUserId;
      if (!sessionOwnerUserId) continue;
      shares.set(id, {
        ...share,
        ownerUserId: sessionOwnerUserId
      });
    }
  } catch {
    // Ignore missing or malformed persisted file and start fresh.
  }
}

loadStateIfNeeded();

function patchJob(id: string, patch: Partial<JobRecord>): void {
  const current = jobs.get(id);
  if (!current) return;
  const next = { ...current, ...patch, updatedAt: nowIso() };
  jobs.set(id, next);
  persistState();
  notifyJobObservers(next);
}

export function patchQueuedJob(id: string, patch: Partial<JobRecord>, ownerUserId?: string): JobRecord | null {
  const current = getJob(id, ownerUserId);
  if (!current) return null;
  patchJob(id, patch);
  return getJob(id, ownerUserId);
}

function isCompletedConversationJob(job: JobRecord): boolean {
  return Boolean(job.payload.conversation?.assistantReply?.trim());
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function hasCompletedPendingVideoForPersist(job: JobRecord): boolean {
  if (job.result) return false;
  const socialmedia = asRecord(job.payload.socialmedia);
  const pendingVideoTask = asRecord(socialmedia?.pendingVideoTask);
  const generatedVideos = pendingVideoTask?.generatedVideos;
  const status = String(pendingVideoTask?.status ?? "").trim();
  return Array.isArray(generatedVideos)
    && generatedVideos.length > 0
    && (
      status === "completed"
      || (status === "failed" && isVideoPersistenceRetryAllowed({
        lastError: String(pendingVideoTask?.lastError ?? ""),
        persistenceAttempts: Number(pendingVideoTask?.persistenceAttempts) || 0
      }))
    );
}

function buildPendingVideoPersistRecoveryJobState(job: JobRecord): JobRecord {
  return {
    ...job,
    status: "running",
    stage: "persisting_assets",
    progress: Math.max(job.progress, 95),
    error: undefined,
    updatedAt: nowIso()
  };
}

export function recoverLocalJobState(current: JobRecord, nowMs = Date.now()): JobRecord | null {
  const updatedAtMs = new Date(current.updatedAt).getTime();
  const ageMs = Number.isFinite(updatedAtMs) ? Math.max(0, nowMs - updatedAtMs) : STALE_RUNNING_MAX_MS + 1;

  let next: JobRecord | null = null;

  if (current.result) {
    if (current.status !== "completed" || current.stage !== "completed" || current.progress < 100) {
      next = {
        ...current,
        status: "completed",
        stage: "completed",
        progress: 100,
        error: undefined,
        updatedAt: nowIso()
      };
    }
  } else if (isCompletedConversationJob(current)) {
    if (current.status !== "completed" || current.stage !== "completed" || current.progress < 100 || current.error) {
      next = {
        ...current,
        status: "completed",
        stage: "completed",
        progress: 100,
        error: undefined,
        updatedAt: nowIso()
      };
    }
  } else if (current.status === "completed") {
    next = hasCompletedPendingVideoForPersist(current)
      ? buildPendingVideoPersistRecoveryJobState(current)
      : {
          ...current,
          status: "failed",
          stage: "failed",
          progress: 100,
          error: current.error ?? "Task finished without result payload. Likely interrupted before final write.",
          updatedAt: nowIso()
        };
  } else if (current.status === "failed") {
    next = hasCompletedPendingVideoForPersist(current)
      ? buildPendingVideoPersistRecoveryJobState(current)
      : buildStaleApimartRecoveryJobState(current, nowMs);
  }

  if (!next && hasRecoverableAsyncImageTask(current)) return null;

  if (!next && (current.status === "running" || current.status === "queued") && ageMs >= STALE_RUNNING_MAX_MS) {
    next = hasCompletedPendingVideoForPersist(current)
      ? buildPendingVideoPersistRecoveryJobState(current)
      : buildStaleApimartRecoveryJobState(current, nowMs);
  }

  if (!next && (current.status === "running" || current.status === "queued") && ageMs >= STALE_RUNNING_MAX_MS) {
    const staleReplayAuthGate = canAutoReplayGenerateJob(current)
      ? getStaleJobAutoReplayAuthGateResult({
          ownerUserId: current.ownerUserId,
          format: current.payload.format,
          imageCount: current.payload.imageCount
        })
      : null;

    if (staleReplayAuthGate) {
      next = {
        ...current,
        status: "failed",
        stage: "failed",
        progress: 100,
        error: staleReplayAuthGate.payload.error,
        updatedAt: nowIso()
      };
    } else if (canAutoReplayGenerateJob(current)) {
      next = {
        ...current,
        status: "running",
        stage: "auto_replay_pending",
        progress: 1,
        error: undefined,
        payload: {
          ...current.payload,
          autoReplayCount: (current.payload.autoReplayCount ?? 0) + 1
        },
        updatedAt: nowIso()
      };
    } else {
      const finalizingStuck = current.progress >= 100 && ageMs >= STALE_FINALIZING_MAX_MS;
      next = {
        ...current,
        status: "failed",
        stage: "failed",
        progress: Math.max(current.progress, finalizingStuck ? 100 : current.progress),
        error: current.error
          ?? (finalizingStuck
            ? "Task was stuck at finalization and has been auto-recovered as failed."
            : "Task exceeded stale timeout and has been auto-recovered as failed."),
        updatedAt: nowIso()
      };
    }
  }

  return next;
}

function recoverJobStateIfNeeded(id: string): JobRecord | null {
  // Auto-heal stale/inconsistent jobs (e.g. process restart during finalization).
  const current = jobs.get(id);
  if (!current) return null;

  const next = recoverLocalJobState(current) ?? current;

  jobs.set(id, next);
  trackRecoveredImageProviderFallbackStarted({ previousJob: current, recoveredJob: next });
  if (next.stage === "auto_replay_pending") {
    scheduleGenerateJobRun({
      jobId: id,
      payload: next.payload,
      ownerUserId: next.ownerUserId,
      kickoffStage: "auto_replay_pending",
      kickoffProgress: 1
    });
  }
  return next;
}

function appendEvent(id: string, event: JobEvent): void {
  const current = jobs.get(id);
  if (!current) return;
  const next = { ...current, events: [...current.events, event], updatedAt: nowIso() };
  jobs.set(id, next);
  persistState();
  notifyJobObservers(next);
}

export function appendJobEvent(
  id: string,
  event: Omit<JobEvent, "id" | "index" | "createdAt">,
  ownerUserId?: string
): JobRecord | null {
  const job = getJob(id, ownerUserId);
  if (!job) return null;

  appendEvent(id, {
    ...event,
    id: randomUUID(),
    index: job.events.length + 1,
    createdAt: nowIso()
  });
  return jobs.get(id) ?? null;
}

function notifyJobObservers(job: JobRecord): void {
  for (const observer of jobObservers) {
    void Promise.resolve(observer(job)).catch((error) => {
      console.warn("[job-store] job observer failed:", error instanceof Error ? error.message : String(error));
    });
  }
}

function ensureSession(ownerUserId?: string, sessionId?: string, title?: string, sourceUseCase?: string): SessionRecord {
  const normalizedOwnerUserId = normalizeOwnerUserId(ownerUserId);
  const normalizedSourceUseCase = sourceUseCase?.trim() || undefined;
  const id = sessionId?.trim() || randomUUID();
  const existing = sessions.get(id);
  if (existing) {
    if (isOwnedBy(existing.ownerUserId, normalizedOwnerUserId)) {
      if (normalizedSourceUseCase && !existing.sourceUseCase) {
        const updated = {
          ...existing,
          sourceUseCase: normalizedSourceUseCase,
          updatedAt: nowIso()
        };
        sessions.set(id, updated);
        persistState();
        return updated;
      }
      return existing;
    }
    return ensureSession(normalizedOwnerUserId, undefined, title, normalizedSourceUseCase);
  }

  const sessionIndex = sessions.size + 1;
  const created: SessionRecord = {
    id,
    ownerUserId: normalizedOwnerUserId,
    title: title?.trim() || buildDefaultSessionTitle(sessionIndex),
    sourceUseCase: normalizedSourceUseCase,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  sessions.set(id, created);
  persistState();
  return created;
}

function updateSessionMeta(sessionId: string, patch: Partial<SessionRecord>): void {
  const existing = sessions.get(sessionId);
  if (!existing) return;
  sessions.set(sessionId, {
    ...existing,
    ...patch,
    updatedAt: nowIso()
  });
  persistState();
}

function updateSessionTitleFromIntent(sessionId: string, title: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  const nextTitle = sanitizeTitle(title, 40);
  if (!nextTitle) return;
  if (session.title === nextTitle) return;

  updateSessionMeta(sessionId, { title: nextTitle });
}

function maybeApplyFallbackTitle(sessionId: string, inputText: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  const fallback = buildFallbackIntentTitle(inputText);
  if (!fallback) return;
  if (!isDefaultSessionTitle(session.title) && session.title.trim().length > 0) {
    return;
  }
  updateSessionTitleFromIntent(sessionId, fallback);
}

function describeStage(stage: string): { title: string; thought: string; action: string } {
  return getAssistantStageNarration(stage);
}

function inferGenerateKickoffStage(payload: SessionPayload): {
  stage: string;
  progress: number;
} {
  const trimmedInput = String(payload.inputText ?? "").trim();
  const explicitSourceType = String(payload.sourceType ?? "").trim().toLowerCase();
  const looksLikeUrl = explicitSourceType === "url" || /^https?:\/\/\S+/i.test(trimmedInput) || /^www\.\S+/i.test(trimmedInput);

  if (looksLikeUrl && payload.inputPreprocessed !== true) {
    return {
      stage: "resolving_source",
      progress: 3
    };
  }

  return {
    stage: "starting",
    progress: 2
  };
}

export function createSession(options?: { id?: string; title?: string; ownerUserId?: string; sourceUseCase?: string }): SessionRecord {
  return ensureSession(options?.ownerUserId, options?.id, options?.title, options?.sourceUseCase);
}

export function registerJobObserver(observer: JobObserver): () => void {
  jobObservers.add(observer);
  return () => {
    jobObservers.delete(observer);
  };
}

export function getSession(id: string, ownerUserId?: string): SessionRecord | null {
  const session = sessions.get(id) ?? null;
  if (!session) return null;
  if (session.deletedAt) return null;
  return isOwnedBy(session.ownerUserId, ownerUserId) ? session : null;
}

export function listSessions(ownerUserId?: string): SessionRecord[] {
  return [...sessions.values()]
    .filter((item) => !item.deletedAt && isOwnedBy(item.ownerUserId, ownerUserId))
    .sort((a, b) => {
    const left = new Date(a.updatedAt).getTime();
    const right = new Date(b.updatedAt).getTime();
    return right - left;
  });
}

export function renameSession(id: string, title: string, ownerUserId?: string, options?: { expectedTitle: string }): SessionRecord | null {
  const existing = getSession(id, ownerUserId);
  if (!existing) return null;
  if (options && existing.title !== options.expectedTitle) return null;

  const nextTitle = sanitizeTitle(title, 80);
  if (!nextTitle) return null;

  const updated: SessionRecord = {
    ...existing,
    title: nextTitle,
    updatedAt: nowIso()
  };
  sessions.set(id, updated);
  persistState();
  return updated;
}

export function setSessionAgentResponseId(
  id: string,
  agentResponseId: string | undefined,
  ownerUserId?: string
): SessionRecord | null {
  const existing = getSession(id, ownerUserId);
  if (!existing) return null;

  const normalized = agentResponseId?.trim() || undefined;
  const updated: SessionRecord = {
    ...existing,
    agentResponseId: normalized,
    updatedAt: nowIso()
  };
  sessions.set(id, updated);
  persistState();
  return updated;
}

export function setSessionInputModeOverride(
  id: string,
  inputModeOverride: "pipeline" | "agent" | undefined,
  ownerUserId?: string
): SessionRecord | null {
  const existing = getSession(id, ownerUserId);
  if (!existing) return null;

  const updated: SessionRecord = {
    ...existing,
    inputModeOverride,
    updatedAt: nowIso()
  };
  sessions.set(id, updated);
  persistState();
  return updated;
}

export function deleteSession(id: string, ownerUserId?: string): boolean {
  const session = getSession(id, ownerUserId);
  if (!session) return false;

  const deletedAt = nowIso();
  sessions.set(id, {
    ...session,
    deletedAt,
    updatedAt: deletedAt
  });

  persistState();
  return true;
}

export function clearAllSessions(ownerUserId?: string): { deletedSessions: number; deletedJobs: number } {
  if (!ownerUserId) {
    const deletedSessions = sessions.size;
    const deletedJobs = jobs.size;

    sessions.clear();
    sessionJobs.clear();
    jobs.clear();
    shares.clear();

    persistState();
    return { deletedSessions, deletedJobs };
  }

  const ownedSessions = listSessions(ownerUserId);
  const deletedSessions = ownedSessions.length;
  let deletedJobs = 0;

  for (const session of ownedSessions) {
    const relatedJobIds = listSessionJobs(session.id, ownerUserId).map((job) => job.id);
    deletedJobs += relatedJobIds.length;
    for (const jobId of relatedJobIds) {
      jobs.delete(jobId);
    }
    sessionJobs.delete(session.id);
    sessions.delete(session.id);
  }

  for (const [shareId, share] of shares.entries()) {
    if (isOwnedBy(share.ownerUserId, ownerUserId)) {
      shares.delete(shareId);
    }
  }

  persistState();
  return { deletedSessions, deletedJobs };
}

export function listSessionJobs(
  sessionId: string,
  ownerUserId?: string,
  options?: { recover?: boolean }
): JobRecord[] {
  const ids = sessionJobs.get(sessionId) ?? [];
  const collected = ids
    .map((id) => options?.recover === false ? (jobs.get(id) ?? null) : recoverJobStateIfNeeded(id))
    .filter((item): item is JobRecord => item !== null && isOwnedBy(item.ownerUserId, ownerUserId))
    .sort((a, b) => {
      const turnDelta = a.turnIndex - b.turnIndex;
      if (turnDelta !== 0) return turnDelta;
      const revisionDelta = (a.revision ?? 1) - (b.revision ?? 1);
      if (revisionDelta !== 0) return revisionDelta;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  return collected;
}

function pushProgressEventFactory(jobId: string, options: { outputLanguage: string; userInput: string }) {
  let lastTick = Date.now();
  let eventIndex = 0;
  let previousProgress = 0;
  let previousTokenInput = 0;
  let previousTokenOutput = 0;
  let previousTokenTotal = 0;

  return async (stage: string, progress: number, outputPreview?: string) => {
    // Emit timeline events with rough cost/token deltas for UI observability.
    const now = Date.now();
    const durationSec = Math.max(1, Math.round((now - lastTick) / 1000));
    lastTick = now;
    eventIndex += 1;
    const fallback = describeStage(stage);
    const details = await inferStageNarrationWithLlm({
      stage,
      userInput: options.userInput,
      outputLanguage: options.outputLanguage,
      outputPreview,
      fallback
    });
    const delta = Math.max(1, progress - previousProgress);
    previousProgress = progress;
    const costUsd = Number((0.002 + delta * 0.0006).toFixed(3));
    const usage = snapshotUsage();
    const tokenInput = Math.max(0, usage.inputTokens - previousTokenInput);
    const tokenOutput = Math.max(0, usage.outputTokens - previousTokenOutput);
    const tokenTotal = Math.max(0, usage.totalTokens - previousTokenTotal);
    previousTokenInput = usage.inputTokens;
    previousTokenOutput = usage.outputTokens;
    previousTokenTotal = usage.totalTokens;

    appendEvent(jobId, {
      id: randomUUID(),
      index: eventIndex,
      stage,
      title: details.title,
      thought: details.thought,
      action: details.action,
      outputPreview: outputPreview?.trim() || undefined,
      durationSec,
      costUsd,
      tokenInput: tokenTotal > 0 ? tokenInput : undefined,
      tokenOutput: tokenTotal > 0 ? tokenOutput : undefined,
      tokenTotal: tokenTotal > 0 ? tokenTotal : undefined,
      createdAt: nowIso()
    });
  };
}

function parseFinalAuditScore(result: JobRecord["result"]): number | undefined {
  if (!result) return undefined;
  const log = [...result.skill_logs].reverse().find((item) =>
    item.skill_name === "skill_quality_final_audit" || item.skill_name === "quality_final_audit"
  );
  if (!log) return undefined;
  const text = String(log.output_preview ?? "");
  const matches = Array.from(text.matchAll(/avg=(\d{1,3})/g));
  if (!matches.length) return undefined;
  const last = matches[matches.length - 1];
  const score = Number(last?.[1]);
  if (!Number.isFinite(score)) return undefined;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export async function chargeUsageForCompletedJob(params: {
  ownerUserId?: string;
  jobId: string;
  usage?: UsageSnapshot | null;
  imageCount?: number;
  note: string;
}): Promise<{ ok: true; settledCredits: number } | { ok: false; errorMessage: string }> {
  if (!params.ownerUserId) {
    return { ok: true, settledCredits: 0 };
  }

  if (isGuestUserId(params.ownerUserId)) {
    const charge = calculateUsageCharge({
      usage: params.usage,
      imageCount: params.imageCount
    });
    console.info("[guest billing] settling usage", {
      ownerUserId: params.ownerUserId,
      jobId: params.jobId,
      note: params.note,
      imageCount: params.imageCount ?? 0,
      tokenCredits: charge.tokenCredits,
      imageCredits: charge.imageCredits,
      totalCredits: charge.totalCredits
    });
    if (charge.totalCredits <= 0) {
      return { ok: true, settledCredits: 0 };
    }
    try {
      const ledger = await consumeGuestCredits({
        guestId: params.ownerUserId,
        amount: charge.totalCredits,
        jobId: params.jobId,
        idempotencyKey: `guest-usage-charge:${params.jobId}:${params.note}`,
        note: `${params.note} (${charge.tokenCredits} token credits + ${charge.imageCredits} image credits)`
      });
      console.info("[guest billing] usage settled", {
        ownerUserId: params.ownerUserId,
        jobId: params.jobId,
        note: params.note,
        balanceAfter: ledger.balanceAfter,
        amount: ledger.amount
      });
      return { ok: true, settledCredits: ledger.balanceAfter >= 0 ? charge.totalCredits : 0 };
    } catch (error) {
      console.error("[guest billing] usage settlement failed", {
        ownerUserId: params.ownerUserId,
        jobId: params.jobId,
        note: params.note,
        message: error instanceof Error ? error.message : String(error)
      });
      if (isInsufficientGuestCreditsError(error)) {
        return { ok: false, errorMessage: "Insufficient guest credits." };
      }
      return {
        ok: false,
        errorMessage: error instanceof Error ? error.message : "Failed to deduct guest credits."
      };
    }
  }

  const charge = calculateUsageCharge({
    usage: params.usage,
    imageCount: params.imageCount
  });
  const settlementKey = `usage-charge:${params.jobId}:${params.note}`;
  if (charge.totalCredits <= 0) {
    return { ok: true, settledCredits: 0 };
  }

  let lastErrorMessage = "Unknown billing settlement failure";

  for (let attempt = 1; attempt <= BILLING_SETTLEMENT_MAX_ATTEMPTS; attempt += 1) {
    try {
      await consumeCredits({
        userId: params.ownerUserId,
        amount: charge.totalCredits,
        jobId: params.jobId,
        idempotencyKey: settlementKey,
        note: `${params.note} (${charge.tokenCredits} token credits + ${charge.imageCredits} image credits)`
      });
      try {
        await resolveBillingSettlementQueueEntry({
          userId: params.ownerUserId,
          settlementKey
        });
      } catch (queueError) {
        console.error("[billing] failed to resolve settlement queue entry", {
          jobId: params.jobId,
          ownerUserId: params.ownerUserId,
          note: params.note,
          settlementKey,
          message: queueError instanceof Error ? queueError.message : String(queueError)
        });
      }
      return { ok: true, settledCredits: charge.totalCredits };
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : String(error);

      if (isInsufficientCreditsError(error)) {
        const summary = await getCreditSummary(params.ownerUserId, 1).catch(() => null);
        const availableBalance = Math.max(0, summary?.balance ?? 0);

        if (availableBalance > 0) {
          await consumeCredits({
            userId: params.ownerUserId,
            amount: availableBalance,
            jobId: params.jobId,
            idempotencyKey: `usage-charge-capped:${params.jobId}:${params.note}`,
            note:
              `${params.note} (capped at available balance: ${availableBalance}/${charge.totalCredits} credits; ` +
              `${charge.tokenCredits} token credits + ${charge.imageCredits} image credits)`
          });
          try {
            await recordBillingSettlementQueueEntry({
              userId: params.ownerUserId,
              jobId: params.jobId,
              settlementKey,
              note: params.note,
              targetCredits: charge.totalCredits,
              settledCredits: availableBalance,
              tokenCredits: charge.tokenCredits,
              imageCredits: charge.imageCredits,
              lastError: "INSUFFICIENT_CREDITS"
            });
          } catch (queueError) {
            console.error("[billing] failed to record capped settlement queue entry", {
              jobId: params.jobId,
              ownerUserId: params.ownerUserId,
              note: params.note,
              settlementKey,
              message: queueError instanceof Error ? queueError.message : String(queueError)
            });
          }
          console.warn("[billing] usage charge capped by available balance", {
            jobId: params.jobId,
            ownerUserId: params.ownerUserId,
            note: params.note,
            attemptedCredits: charge.totalCredits,
            chargedCredits: availableBalance,
            tokenCredits: charge.tokenCredits,
            imageCredits: charge.imageCredits
          });
          return { ok: true, settledCredits: availableBalance };
        }
      }

      console.error("[billing] usage charge attempt failed", {
        jobId: params.jobId,
        ownerUserId: params.ownerUserId,
        note: params.note,
        attempt,
        maxAttempts: BILLING_SETTLEMENT_MAX_ATTEMPTS,
        attemptedCredits: charge.totalCredits,
        tokenCredits: charge.tokenCredits,
        imageCredits: charge.imageCredits,
        message: lastErrorMessage
      });

      if (attempt < BILLING_SETTLEMENT_MAX_ATTEMPTS) {
        await delay(BILLING_SETTLEMENT_RETRY_DELAYS_MS[attempt - 1] ?? BILLING_SETTLEMENT_RETRY_DELAYS_MS.at(-1) ?? 1000);
      }
    }
  }

  try {
    await recordBillingSettlementQueueEntry({
      userId: params.ownerUserId,
      jobId: params.jobId,
      settlementKey,
      note: params.note,
      targetCredits: charge.totalCredits,
      settledCredits: 0,
      tokenCredits: charge.tokenCredits,
      imageCredits: charge.imageCredits,
      lastError: lastErrorMessage
    });
  } catch (queueError) {
    console.error("[billing] failed to record settlement queue entry", {
      jobId: params.jobId,
      ownerUserId: params.ownerUserId,
      note: params.note,
      settlementKey,
      message: queueError instanceof Error ? queueError.message : String(queueError)
    });
  }

  try {
    await recordCreditLedgerMarker({
      userId: params.ownerUserId,
      jobId: params.jobId,
      idempotencyKey: `usage-charge-failed:${params.jobId}:${params.note}`,
      note:
        `billing settlement failed after ${BILLING_SETTLEMENT_MAX_ATTEMPTS} attempts; ` +
        `attempted=${charge.totalCredits}; token=${charge.tokenCredits}; image=${charge.imageCredits}; ` +
        `reason=${lastErrorMessage}`
    });
  } catch (markerError) {
    console.error("[billing] failed to record settlement failure marker", {
      jobId: params.jobId,
      ownerUserId: params.ownerUserId,
      note: params.note,
      message: markerError instanceof Error ? markerError.message : String(markerError)
    });
  }

  return {
    ok: false,
    errorMessage: `Billing settlement failed after ${BILLING_SETTLEMENT_MAX_ATTEMPTS} attempts: ${lastErrorMessage}`
  };
}

function createJobRecord(params: {
  id: string;
  triggerHostname?: string;
  ownerUserId?: string;
  sessionId: string;
  turnIndex: number;
  revision: number;
  mode: JobRecord["mode"];
  payload: SessionPayload;
  baseJobId: string;
  parentJobId?: string;
  revisionIntent?: JobRecord["revisionIntent"];
}): JobRecord {
  return {
    id: params.id,
    triggerHostname: params.triggerHostname,
    ownerUserId: normalizeOwnerUserId(params.ownerUserId),
    sessionId: params.sessionId,
    turnIndex: params.turnIndex,
    revision: params.revision,
    mode: params.mode,
    baseJobId: params.baseJobId,
    parentJobId: params.parentJobId,
    revisionIntent: params.revisionIntent,
    sourceUseCase: params.payload.sourceUseCase,
    outputType: params.payload.outputType,
    payload: params.payload,
    status: "queued",
    progress: 0,
    stage: "queued",
    events: [],
    rerunPlan: undefined,
    changedArtifacts: [],
    artifacts: [],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

function getBaseSourceText(job: JobRecord): string {
  return job.payload.sourceInputText ?? job.payload.inputText;
}

function shouldExposeSerializedSourceInput(job: JobRecord): boolean {
  const sourceInput = job.payload.sourceInputText?.trim();
  if (!sourceInput) return false;
  if (sourceInput === job.payload.inputText.trim()) return true;
  return job.payload.sourceType !== "url";
}

function startRunningHeartbeat(params: {
  jobId: string;
  readSnapshot: () => { stage: string; progress: number };
}): () => void {
  const timer = setInterval(() => {
    const current = jobs.get(params.jobId);
    if (!current || current.status !== "running") return;

    const snapshot = params.readSnapshot();
    patchJob(params.jobId, {
      status: "running",
      stage: snapshot.stage,
      progress: snapshot.progress
    });
  }, RUNNING_HEARTBEAT_INTERVAL_MS);

  timer.unref?.();
  return () => clearInterval(timer);
}

function buildConversationCompletionEvent(reply: string): JobEvent {
  return {
    id: randomUUID(),
    index: 1,
    stage: "agent_conversation",
    title: "assistant reply",
    thought: "The source needs more detail before a high-quality draft can be generated.",
    action: "Ask the user to add more source material or context.",
    outputPreview: reply,
    durationSec: 1,
    costUsd: 0,
    createdAt: nowIso()
  };
}

function canAutoReplayGenerateJob(job: JobRecord): boolean {
  return (
    job.mode === "generate" &&
    job.payload.workflow !== "socialmedia" &&
    !job.payload.socialmedia &&
    !job.result &&
    !isCompletedConversationJob(job) &&
    (job.payload.autoReplayCount ?? 0) < AUTO_REPLAY_MAX_ATTEMPTS
  );
}

function captureCompletedJobServerAnalytics(job: JobRecord): void {
  if (!job.result) return;
  const generationDurationMs = getDateDeltaMs(job.createdAt, job.updatedAt);
  const slides = Array.isArray(job.result.slides) ? job.result.slides : [];
  const authState = job.ownerUserId ? (isGuestUserId(job.ownerUserId) ? "guest" : "signed_in") : "anonymous";
  captureServerAnalyticsEventSoon("generation_completed", job.ownerUserId ?? `session:${job.sessionId}`, {
    capture_source: "server",
    uid: job.ownerUserId ?? "",
    user_id: job.ownerUserId ?? "",
    is_guest: authState === "guest",
    job_id: job.id,
    session_id: job.sessionId,
    auth_state: authState,
    auth_mode: authState,
    mode: job.mode,
    platform: job.payload.platform ?? job.result.platform_type?.toLowerCase?.() ?? "unknown",
    format: job.payload.format ?? "carousel",
    batch_id: job.payload.batchId,
    request_variant: job.payload.requestVariant,
    revision: job.revision,
    parent_job_id: job.parentJobId,
    base_job_id: job.baseJobId,
    slides_count: slides.length,
    has_images: slides.some((slide) => Boolean(slide.image_url)),
    aspect_ratio: job.result.aspect_ratio,
    job_created_at: job.createdAt,
    job_updated_at: job.updatedAt,
    generation_duration_ms: generationDurationMs,
    generation_duration_seconds: typeof generationDurationMs === "number"
      ? Number((generationDurationMs / 1000).toFixed(2))
      : undefined
  });
}

function scheduleGenerateJobRun(params: {
  jobId: string;
  payload: SessionPayload;
  ownerUserId?: string;
  kickoffStage?: string;
  kickoffProgress?: number;
}): void {
  const kickoffStage = params.kickoffStage ?? "starting";
  const kickoffProgress = params.kickoffProgress ?? 2;

  setTimeout(async () => {
    const pushStageEvent = pushProgressEventFactory(params.jobId, {
      outputLanguage: params.payload.outputLanguage ?? "en-US",
      userInput: params.payload.sourceInputText ?? params.payload.inputText
    });
    let heartbeatStage = kickoffStage;
    let heartbeatProgress = kickoffProgress;
    const stopHeartbeat = startRunningHeartbeat({
      jobId: params.jobId,
      readSnapshot: () => ({
        stage: heartbeatStage,
        progress: heartbeatProgress
      })
    });

    patchJob(params.jobId, {
      status: "running",
      stage: kickoffStage,
      progress: kickoffProgress,
      error: undefined,
      payload: params.payload
    });

    try {
      const conversion = await runConversion(
        toRequest(params.payload),
        async (stage, progress, outputPreview) => {
          heartbeatStage = stage;
          heartbeatProgress = progress;
          patchJob(params.jobId, { status: "running", stage, progress });
          await pushStageEvent(stage, progress, outputPreview);
        },
        async (stage, progress) => {
          heartbeatStage = stage;
          heartbeatProgress = progress;
          patchJob(params.jobId, { status: "running", stage, progress });
        }
      );
      heartbeatStage = "finalizing";
      heartbeatProgress = 99;
      const result = await materializeConversionResultImages(conversion.result, params.ownerUserId);

      const rawArtifacts = buildArtifactsForGenerate({
        result,
        inputText: params.payload.sourceInputText ?? params.payload.inputText,
        revision: 1,
        jobId: params.jobId,
        baseJobId: params.jobId
      });
      const artifacts = await materializeDataImageUrlsDeep(rawArtifacts, params.ownerUserId);
      patchJob(params.jobId, {
        status: "running",
        stage: "finalizing",
        progress: 99,
        result,
        artifacts
      });
      await pushStageEvent("finalizing", 99, "Result generated. Finalizing state and usage.");
      const billingSettlement = await chargeUsageForCompletedJob({
        ownerUserId: params.ownerUserId,
        jobId: params.jobId,
        usage: conversion.usage,
        imageCount: countBillableImages(result),
        note: "generate usage"
      });
      if (!billingSettlement.ok) {
        throw new Error(billingSettlement.errorMessage);
      }
      const completionNote = await generateCompletionNote({
        changeScope: "initial_delivery",
        userRequest: params.payload.inputText,
        result,
        outputLanguage: params.payload.outputLanguage
      }).catch(() => undefined);

      patchJob(params.jobId, {
        status: "completed",
        stage: "completed",
        progress: 100,
        result,
        artifacts,
        payload: {
          ...params.payload,
          completionNote
        }
      });
      const completedJob = jobs.get(params.jobId);
      if (completedJob) {
        captureCompletedJobServerAnalytics(completedJob);
      }

      recordStyleHookMemory({
        sourceTitle: params.payload.inputText.slice(0, 90),
        sourceText: params.payload.sourceInputText ?? params.payload.inputText,
        hook: result.post_title,
        stylePreset: result.slides.find((slide) => slide.slide_id === 1)?.style_tag ?? params.payload.stylePreset,
        tone: params.payload.tone,
        score: parseFinalAuditScore(result)
      });
    } catch (error) {
      if (error instanceof NeedsMoreSourceError) {
        patchJob(params.jobId, {
          status: "completed",
          stage: "completed",
          progress: 100,
          error: undefined,
          payload: {
            ...params.payload,
            conversation: {
              assistantReply: error.message,
              suggestedTask: error.suggestedTask
            }
          },
          events: [buildConversationCompletionEvent(error.message)]
        });
        return;
      }

      const errorMessage = error instanceof Error ? error.message : "Unknown processing error";
      patchJob(params.jobId, {
        status: "failed",
        stage: "failed",
        progress: 100,
        error: errorMessage
      });
    } finally {
      stopHeartbeat();
    }
  }, 30);
}

function findLastRevisionForBase(
  sessionId: string,
  baseJobId: string,
  turnIndex: number,
  ownerUserId?: string
): JobRecord | null {
  const all = listSessionJobs(sessionId, ownerUserId).filter(
    (item) => (item.baseJobId || item.id) === baseJobId && item.turnIndex === turnIndex
  );
  if (!all.length) return null;
  const sorted = all.sort((a, b) => (b.revision ?? 1) - (a.revision ?? 1));
  return sorted.find((item) => Boolean(item.result)) ?? sorted[0] ?? null;
}

export function createJob(payload: SessionPayload, options?: { sessionId?: string; ownerUserId?: string; triggerHostname?: string }): JobRecord {
  // Create queued job record synchronously, then execute conversion asynchronously.
  const session = ensureSession(options?.ownerUserId, options?.sessionId, undefined, payload.sourceUseCase);
  const existingIds = sessionJobs.get(session.id) ?? [];
  const turnIndex = existingIds.length + 1;
  const id = randomUUID();

  const job = createJobRecord({
    id,
    triggerHostname: options?.triggerHostname,
    ownerUserId: session.ownerUserId,
    sessionId: session.id,
    turnIndex,
    revision: 1,
    mode: "generate",
    payload,
    baseJobId: id
  });

  jobs.set(id, job);
  sessionJobs.set(session.id, [...existingIds, id]);
  updateSessionMeta(session.id, { lastJobId: id, sourceUseCase: session.sourceUseCase ?? payload.sourceUseCase });
  maybeApplyFallbackTitle(session.id, payload.inputText);
  persistState();

  void inferIntentTitleWithLlm(payload.inputText, payload.outputLanguage ?? "en-US")
    .then((title) => {
      if (!title) return;
      updateSessionTitleFromIntent(session.id, title);
    })
    .catch(() => {
      // Ignore title inference failures and keep fallback title.
    });

  const kickoff = inferGenerateKickoffStage(payload);
  scheduleGenerateJobRun({
    jobId: id,
    payload,
    ownerUserId: session.ownerUserId,
    kickoffStage: kickoff.stage,
    kickoffProgress: kickoff.progress
  });

  return job;
}

export function createQueuedJob(
  payload: SessionPayload,
  options?: {
    sessionId?: string;
    ownerUserId?: string;
    triggerHostname?: string;
    mode?: JobRecord["mode"];
    parentJobId?: string;
    baseJobId?: string;
  }
): JobRecord {
  const session = ensureSession(options?.ownerUserId, options?.sessionId, undefined, payload.sourceUseCase);
  const existingIds = sessionJobs.get(session.id) ?? [];
  const turnIndex = existingIds.length + 1;
  const id = randomUUID();

  const job = createJobRecord({
    id,
    triggerHostname: options?.triggerHostname,
    ownerUserId: session.ownerUserId,
    sessionId: session.id,
    turnIndex,
    revision: 1,
    mode: options?.mode ?? "generate",
    payload,
    baseJobId: options?.baseJobId ?? id,
    parentJobId: options?.parentJobId
  });

  jobs.set(id, job);
  sessionJobs.set(session.id, [...existingIds, id]);
  updateSessionMeta(session.id, { lastJobId: id, sourceUseCase: session.sourceUseCase ?? payload.sourceUseCase });
  maybeApplyFallbackTitle(session.id, payload.inputText);
  persistState();

  return job;
}

export function createConversationJob(
  payload: SessionPayload,
  options?: { sessionId?: string; ownerUserId?: string; triggerHostname?: string; usageSummary?: UsageSnapshot | null }
): JobRecord {
  // Persist a completed conversational turn when input is not a generation task.
  const session = ensureSession(options?.ownerUserId, options?.sessionId, undefined, payload.sourceUseCase);
  const existingIds = sessionJobs.get(session.id) ?? [];
  const turnIndex = existingIds.length + 1;
  const id = randomUUID();

  const job = createJobRecord({
    id,
    triggerHostname: options?.triggerHostname,
    ownerUserId: session.ownerUserId,
    sessionId: session.id,
    turnIndex,
    revision: 1,
    mode: "generate",
    payload,
    baseJobId: id
  });

  jobs.set(id, {
    ...job,
    status: "completed",
    progress: 100,
    stage: "completed",
    events: [
      {
        id: randomUUID(),
        index: 1,
        stage: "agent_conversation",
        title: "assistant reply",
        thought: "No generation task was created. Returning conversational guidance.",
        action: "Respond with guidance and suggested next task.",
        outputPreview: payload.conversation?.assistantReply,
        durationSec: 1,
        costUsd: 0,
        tokenInput: options?.usageSummary?.inputTokens ? options.usageSummary.inputTokens : undefined,
        tokenOutput: options?.usageSummary?.outputTokens ? options.usageSummary.outputTokens : undefined,
        tokenTotal: options?.usageSummary?.totalTokens ? options.usageSummary.totalTokens : undefined,
        createdAt: nowIso()
      }
    ],
    updatedAt: nowIso()
  });
  sessionJobs.set(session.id, [...existingIds, id]);
  updateSessionMeta(session.id, { lastJobId: id, sourceUseCase: session.sourceUseCase ?? payload.sourceUseCase });
  maybeApplyFallbackTitle(session.id, payload.inputText);
  persistState();

  return jobs.get(id) ?? job;
}

export function saveJobPreflightEvents(
  jobId: string,
  preflightEvents: JobRecord["payload"]["preflightEvents"],
  ownerUserId?: string
): JobRecord | null {
  const job = getJob(jobId, ownerUserId);
  if (!job) return null;

  patchJob(jobId, {
    payload: {
      ...job.payload,
      preflightEvents: Array.isArray(preflightEvents) ? preflightEvents : []
    }
  });

  return jobs.get(jobId) ?? null;
}

export function createRevisionJob(
  parentJobId: string,
  revisePayload: RevisePayload,
  options?: { ownerUserId?: string; triggerHostname?: string }
): JobRecord | null {
  // Revisions keep the same turn index and increment revision number under the same base job.
  const parentJob = jobs.get(parentJobId);
  const parentResult = parentJob?.result;
  if (!parentJob || !parentResult || !isOwnedBy(parentJob.ownerUserId, options?.ownerUserId)) return null;

  const sourceText = getBaseSourceText(parentJob);
  const session = ensureSession(parentJob.ownerUserId, parentJob.sessionId, undefined, parentJob.sourceUseCase ?? parentJob.payload.sourceUseCase);
  const baseJobId = parentJob.baseJobId || parentJob.id;
  const latest = findLastRevisionForBase(session.id, baseJobId, parentJob.turnIndex, parentJob.ownerUserId) ?? parentJob;
  const nextRevision = (latest.revision ?? 1) + 1;
  const id = randomUUID();

  const normalizedRevisePayload: RevisePayload = {
    ...revisePayload,
    sourceText,
    instruction: revisePayload.instruction.trim() || "Revise previous result",
    editableFields: revisePayload.editableFields,
    preserveFacts: revisePayload.preserveFacts,
    preserveSlideStructure: revisePayload.preserveSlideStructure,
    scope: {
      slideIds: revisePayload.scope.slideIds ?? [],
      fields: revisePayload.scope.fields ?? []
    },
    options: {
      ...revisePayload.options,
      preserveLayout: revisePayload.options.preserveLayout
    }
  };

  const displayInput = normalizedRevisePayload.instruction || `Revise ${normalizedRevisePayload.intent}`;
  const payload: SessionPayload = {
    ...parentJob.payload,
    inputText: displayInput,
    sourceInputText: sourceText,
    revisePayload: normalizedRevisePayload
  };

  const job = createJobRecord({
    id,
    triggerHostname: options?.triggerHostname,
    ownerUserId: parentJob.ownerUserId,
    sessionId: session.id,
    turnIndex: parentJob.turnIndex,
    revision: nextRevision,
    mode: "revise",
    payload,
    baseJobId,
    parentJobId: latest.id,
    revisionIntent: normalizedRevisePayload.intent
  });

  jobs.set(id, job);
  sessionJobs.set(session.id, [...(sessionJobs.get(session.id) ?? []), id]);
  updateSessionMeta(session.id, { lastJobId: id, sourceUseCase: session.sourceUseCase ?? payload.sourceUseCase });
  persistState();

  const rerunPlan = planRerun(normalizedRevisePayload.intent, normalizedRevisePayload.options.preserveLayout);
  const pushStageEvent = pushProgressEventFactory(id, {
    outputLanguage: payload.outputLanguage ?? "en-US",
    userInput: payload.sourceInputText ?? payload.inputText
  });
  patchJob(id, {
    status: "running",
    stage: "revision_planning",
    progress: 0,
    rerunPlan
  });
  void pushStageEvent("revision_planning", 0, rerunPlan.reason);

  setTimeout(async () => {
    const revisionUsageScope = beginUsageScope();
    let heartbeatStage = "revision_planning";
    let heartbeatProgress = 0;
    const stopHeartbeat = startRunningHeartbeat({
      jobId: id,
      readSnapshot: () => ({
        stage: heartbeatStage,
        progress: heartbeatProgress
      })
    });
    try {
      heartbeatStage = "revision_executing";
      heartbeatProgress = 12;
      patchJob(id, {
        status: "running",
        stage: "revision_executing",
        progress: 12
      });
      await pushStageEvent("revision_executing", 12, rerunPlan.selectedSkills.join(", "));

      const previousResult = latest.result ?? parentResult;
      const engine = await runRevisionEngine({
        jobId: id,
        baseJobId,
        parentJobId: latest.id,
        revision: nextRevision,
        revise: normalizedRevisePayload,
        previousResult,
        previousArtifacts: latest.artifacts ?? [],
        outputLanguage: latest.payload.outputLanguage ?? "en-US",
        generationMode: latest.payload.generationMode ?? "standard"
      });
      heartbeatStage = "finalizing";
      heartbeatProgress = 99;
      const materializedResult = await materializeConversionResultImages(engine.result, session.ownerUserId);
      const materializedArtifacts = await materializeDataImageUrlsDeep(engine.artifacts, session.ownerUserId);
      patchJob(id, {
        status: "running",
        stage: "finalizing",
        progress: 99,
        result: materializedResult,
        artifacts: materializedArtifacts,
        changedArtifacts: engine.changedArtifacts,
        rerunPlan: engine.rerunPlan
      });
      await pushStageEvent("finalizing", 99, "Revision output generated. Finalizing state and usage.");
      const revisionUsage = snapshotUsage(revisionUsageScope);
      const billingSettlement = await chargeUsageForCompletedJob({
        ownerUserId: session.ownerUserId,
        jobId: id,
        usage: revisionUsage,
        imageCount: 0,
        note: "revision usage"
      });
      if (!billingSettlement.ok) {
        throw new Error(billingSettlement.errorMessage);
      }
      const changeScopeByIntent: Record<RevisePayload["intent"], "copy_revision" | "image_revision"> = {
        rewrite_copy_style: "copy_revision",
        regenerate_cover: "image_revision",
        regenerate_slides: "image_revision"
      };
      const completionNote = await generateCompletionNote({
        changeScope: changeScopeByIntent[normalizedRevisePayload.intent],
        userRequest: normalizedRevisePayload.instruction,
        result: materializedResult,
        previousResult,
        baseJob: latest,
        outputLanguage: latest.payload.outputLanguage
      }).catch(() => undefined);

      patchJob(id, {
        status: "completed",
        stage: "completed",
        progress: 100,
        result: materializedResult,
        artifacts: materializedArtifacts,
        changedArtifacts: engine.changedArtifacts,
        rerunPlan: engine.rerunPlan,
        payload: {
          ...payload,
          completionNote
        }
      });
      const completedJob = jobs.get(id);
      if (completedJob) {
        captureCompletedJobServerAnalytics(completedJob);
      }
      stopHeartbeat();
    } catch (error) {
      stopHeartbeat();
      patchJob(id, {
        status: "failed",
        stage: "failed",
        progress: 100,
        error: error instanceof Error ? error.message : "Revision failed"
      });
    }
  }, 30);

  return jobs.get(id) ?? job;
}

export function getJob(id: string, ownerUserId?: string, options?: { recover?: boolean }): JobRecord | null {
  const job = options?.recover === false ? jobs.get(id) : recoverJobStateIfNeeded(id);
  if (!job) return null;
  return isOwnedBy(job.ownerUserId, ownerUserId) ? job : null;
}

function isShareExpired(share: ShareRecord): boolean {
  if (!share.expiresAt) return false;
  return new Date(share.expiresAt).getTime() < Date.now();
}

export function createShare(
  sessionId: string,
  options?: { visibility?: SessionVisibility; expiresAt?: string; ownerUserId?: string }
): ShareRecord | null {
  const session = getSession(sessionId, options?.ownerUserId);
  if (!session) return null;

  const token = randomUUID().replace(/-/g, "");
  const share: ShareRecord = {
    id: randomUUID(),
    ownerUserId: session.ownerUserId,
    sessionId: session.id,
    token,
    visibility: options?.visibility ?? "public",
    expiresAt: options?.expiresAt,
    createdAt: nowIso()
  };

  shares.set(share.id, share);
  persistState();
  return share;
}

export function getShareByToken(token: string): ShareRecord | null {
  const normalized = token.trim();
  for (const share of shares.values()) {
    if (share.token !== normalized) continue;
    if (isShareExpired(share)) return null;
    return share;
  }
  return null;
}

export function adoptGuestWorkspaceOwner(
  guestUserId: string,
  targetUserId: string
): {
  sessions: SessionRecord[];
  jobs: JobRecord[];
  shares: ShareRecord[];
} {
  const sourceOwner = normalizeOwnerUserId(guestUserId);
  const nextOwner = normalizeOwnerUserId(targetUserId);
  if (!sourceOwner || !nextOwner || sourceOwner === nextOwner) {
    return {
      sessions: [],
      jobs: [],
      shares: []
    };
  }

  const migratedSessions: SessionRecord[] = [];
  const migratedJobs: JobRecord[] = [];
  const migratedShares: ShareRecord[] = [];

  for (const [sessionId, session] of sessions.entries()) {
    if (normalizeOwnerUserId(session.ownerUserId) !== sourceOwner) continue;
    const nextSession: SessionRecord = {
      ...session,
      ownerUserId: nextOwner
    };
    sessions.set(sessionId, nextSession);
    migratedSessions.push(nextSession);
  }

  for (const [jobId, job] of jobs.entries()) {
    if (normalizeOwnerUserId(job.ownerUserId) !== sourceOwner) continue;
    const nextJob: JobRecord = {
      ...job,
      ownerUserId: nextOwner
    };
    jobs.set(jobId, nextJob);
    migratedJobs.push(nextJob);
  }

  for (const [shareId, share] of shares.entries()) {
    if (normalizeOwnerUserId(share.ownerUserId) !== sourceOwner) continue;
    const nextShare: ShareRecord = {
      ...share,
      ownerUserId: nextOwner
    };
    shares.set(shareId, nextShare);
    migratedShares.push(nextShare);
  }

  if (migratedSessions.length || migratedJobs.length || migratedShares.length) {
    persistState();
  }

  return {
    sessions: migratedSessions,
    jobs: migratedJobs,
    shares: migratedShares
  };
}

function omitGeneratedImageUrls<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => omitGeneratedImageUrls(item)) as T;
  }
  if (!value || typeof value !== "object") return value;

  const record = value as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) {
    // Provider output URLs are only an internal hand-off to asset persistence.
    // Never return them from a job/status endpoint, where they could bypass
    // the selected watermarked or preview asset variant.
    if (key === "generatedImageUrls") continue;
    sanitized[key] = omitGeneratedImageUrls(item);
  }
  return sanitized as T;
}

function sanitizeSocialmediaPayloadForClient(
  job: JobRecord,
  value: JobRecord["payload"]["socialmedia"]
): JobRecord["payload"]["socialmedia"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;

  const sourceUseCase = job.sourceUseCase
    ?? job.payload.sourceUseCase
    ?? (typeof record.sourceUseCase === "string" ? record.sourceUseCase : undefined);
  if (sourceUseCase !== "spotify-canvas-generator") return value;

  const sanitized: Record<string, unknown> = { ...record };
  const displaySourceAssets = Array.isArray(record.userSourceAssets)
    ? record.userSourceAssets
    : Array.isArray(record.user_source_assets)
      ? record.user_source_assets
      : [];

  // Spotify Canvas may use a locked album cover's original variant internally.
  // Client payloads must expose only the plan-safe display variant; the original
  // reference remains available to server-side continuation and generation.
  sanitized.sourceAssets = displaySourceAssets;
  delete sanitized.source_assets;
  delete sanitized.pendingImageTasks;
  delete sanitized.pendingVideoKeyframeTasks;
  delete sanitized.pendingVideoTask;

  return sanitized;
}

function omitInternalFailureDetails<T>(value: T, options?: { isVideo?: boolean }): T {
  if (Array.isArray(value)) {
    return value.map((item) => omitInternalFailureDetails(item, options)) as T;
  }
  if (!value || typeof value !== "object") return value;

  const sanitized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    // These fields hold verbatim provider responses. Diagnostics stay in the
    // persisted job and telemetry, never in a browser-facing status payload.
    if (
      key === "lastError"
      || key === "rawError"
      || key === "rawErrorMessage"
      || key === "pipelineSafetyAgentV3RetryCount"
      || key === "pipelineSafetyAgentV4RetryCount"
      || key === "failureKind"
    ) continue;
    if (key === "errorMessage") {
      sanitized[key] = toUserFacingGenerationError(item, options);
      continue;
    }
    sanitized[key] = omitInternalFailureDetails(item, options);
  }
  return sanitized as T;
}

function serializeJobEventsForClient(events: JobEvent[], failed: boolean, options?: { isVideo?: boolean }): JobEvent[] {
  if (!failed) return events;
  return events.map((event) => event.outputPreview
    ? { ...event, outputPreview: toUserFacingGenerationError(event.outputPreview, options) }
    : event
  );
}

function sanitizeResultWarnings<T>(value: T, options?: { isVideo?: boolean }): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  const socialmedia = record.socialmedia;
  if (!socialmedia || typeof socialmedia !== "object" || Array.isArray(socialmedia)) return value;
  const socialmediaRecord = socialmedia as Record<string, unknown>;
  if (!Array.isArray(socialmediaRecord.warnings)) return value;

  return {
    ...record,
    socialmedia: {
      ...socialmediaRecord,
      warnings: socialmediaRecord.warnings.map((warning) => {
        if (!warning || typeof warning !== "object" || Array.isArray(warning)) return warning;
        const warningRecord = warning as Record<string, unknown>;
        return typeof warningRecord.message === "string"
          ? { ...warningRecord, message: toUserFacingGenerationError(warningRecord.message, options) }
          : warning;
      })
    }
  } as T;
}

export function serializeJob(job: JobRecord): {
  job_id: string;
  session_id: string;
  source_use_case?: string;
  output_type?: string;
  batch_id?: string;
  request_variant?: "single_platform" | "multi_platform_batch";
  platform?: "x" | "instagram" | "linkedin" | "tiktok";
  format?: "carousel";
  poll_token?: string;
  turn_index: number;
  revision: number;
  mode: JobRecord["mode"];
  base_job_id: string;
  parent_job_id?: string;
  revision_intent?: JobRecord["revisionIntent"];
  input_text: string;
  source_input_text?: string;
  source_input_text_preview?: string;
  conversation_reply?: string;
  conversation_suggested_task?: string;
  preflight_events?: JobRecord["payload"]["preflightEvents"];
  completion_note?: string;
  content_mode: JobRecord["payload"]["contentMode"];
  socialmedia?: JobRecord["payload"]["socialmedia"];
  status: JobStatus;
  progress: number;
  stage: string;
  events: JobEvent[];
  rerun_plan?: JobRecord["rerunPlan"];
  changed_artifacts?: string[];
  artifacts: JobRecord["artifacts"];
  error?: string;
  error_code?: string;
  created_at: string;
  updated_at: string;
  result?: JobRecord["result"];
} {
  const sourceUseCase = job.sourceUseCase ?? job.payload.sourceUseCase;
  const outputType = job.outputType ?? job.payload.outputType;
  const isVideo = outputType === "video" || isVideoGenerationSourceUseCase(sourceUseCase);
  const errorCode = job.status === "failed" && !isVideo
    && (job.payload.socialmedia as { failureKind?: string } | undefined)?.failureKind === "agent_safety_response"
    ? GENERATION_SAFETY_BLOCKED_CODE
    : undefined;

  return {
    job_id: job.id,
    session_id: job.sessionId,
    source_use_case: sourceUseCase,
    output_type: outputType,
    batch_id: job.payload.batchId,
    request_variant: job.payload.requestVariant,
    platform: job.payload.platform,
    format: job.payload.format,
    poll_token: issueJobPollToken(job.id, job.ownerUserId),
    turn_index: job.turnIndex,
    revision: job.revision ?? 1,
    mode: job.mode ?? "generate",
    base_job_id: job.baseJobId || job.id,
    parent_job_id: job.parentJobId,
    revision_intent: job.revisionIntent,
    input_text: job.payload.inputText,
    source_input_text: shouldExposeSerializedSourceInput(job) ? job.payload.sourceInputText : undefined,
    source_input_text_preview: job.payload.sourceInputText
      ? job.payload.sourceInputText.replace(/\s+/g, " ").trim().slice(0, 240)
      : undefined,
    conversation_reply: job.payload.conversation?.assistantReply,
    conversation_suggested_task: job.payload.conversation?.suggestedTask,
    preflight_events: job.payload.preflightEvents,
    completion_note: job.payload.completionNote,
    content_mode: job.payload.contentMode,
    socialmedia: sanitizeSocialmediaPayloadForClient(
      job,
      omitInternalFailureDetails(omitGeneratedImageUrls(job.payload.socialmedia), { isVideo })
    ),
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    events: serializeJobEventsForClient(job.events, job.status === "failed", { isVideo }),
    rerun_plan: job.rerunPlan,
    changed_artifacts: job.changedArtifacts,
    artifacts: job.artifacts ?? [],
    error: job.error ? toUserFacingGenerationError(job.error, { isVideo, code: errorCode }) : undefined,
    error_code: errorCode,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
    result: sanitizeResultWarnings(job.result, { isVideo })
  };
}

function sanitizePublicResult(result: JobRecord["result"]): JobRecord["result"] {
  if (!result) return undefined;
  const sanitized = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;

  sanitized.skill_logs = [];

  if (Array.isArray(sanitized.slides)) {
    sanitized.slides = sanitized.slides.map((slide) => {
      if (!slide || typeof slide !== "object" || Array.isArray(slide)) return slide;
      const next = { ...(slide as Record<string, unknown>) };
      next.visual_prompt = "";
      delete next.prompt_logs;
      delete next.ai_reasoning;
      return next;
    });
  }

  const review = sanitized.review;
  if (review && typeof review === "object" && !Array.isArray(review)) {
    const reviewRecord = { ...(review as Record<string, unknown>) };
    if (Array.isArray(reviewRecord.cover_candidates)) {
      reviewRecord.cover_candidates = reviewRecord.cover_candidates.map((candidate) => {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return candidate;
        const next = { ...(candidate as Record<string, unknown>) };
        next.visual_prompt = "";
        return next;
      });
    }
    sanitized.review = reviewRecord;
  }

  return sanitized as unknown as JobRecord["result"];
}

export function serializePublicJob(job: JobRecord): ReturnType<typeof serializeJob> {
  const serialized = serializeJob(job);
  return {
    ...serialized,
    poll_token: undefined,
    preflight_events: undefined,
    events: [],
    rerun_plan: undefined,
    changed_artifacts: undefined,
    artifacts: [],
    result: sanitizePublicResult(job.result)
  };
}

export function serializeSession(session: SessionRecord): {
  session_id: string;
  title: string;
  source_use_case?: string;
  created_at: string;
  updated_at: string;
  last_job_id?: string;
  jobs: ReturnType<typeof serializeJob>[];
}

export function serializeSession(
  session: SessionRecord,
  options: { jobs?: JobRecord[] }
): {
  session_id: string;
  title: string;
  source_use_case?: string;
  created_at: string;
  updated_at: string;
  last_job_id?: string;
  jobs: ReturnType<typeof serializeJob>[];
}

export function serializeSession(
  session: SessionRecord,
  options: { jobs?: JobRecord[] } = {}
): {
  session_id: string;
  title: string;
  source_use_case?: string;
  created_at: string;
  updated_at: string;
  last_job_id?: string;
  jobs: ReturnType<typeof serializeJob>[];
} {
  const jobs = options.jobs ?? listSessionJobs(session.id, session.ownerUserId);
  return {
    session_id: session.id,
    title: session.title,
    source_use_case: session.sourceUseCase,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
    last_job_id: session.lastJobId,
    jobs: jobs.map((job) => serializeJob(job))
  };
}

export function serializePublicSession(
  session: SessionRecord,
  options: { jobs?: JobRecord[] } = {}
): ReturnType<typeof serializeSession> {
  const jobs = options.jobs ?? listSessionJobs(session.id, session.ownerUserId);
  return {
    session_id: session.id,
    title: session.title,
    source_use_case: session.sourceUseCase,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
    last_job_id: session.lastJobId,
    jobs: jobs.map((job) => serializePublicJob(job))
  };
}

export function serializeSessionSummary(session: SessionRecord): {
  session_id: string;
  title: string;
  source_use_case?: string;
  created_at: string;
  updated_at: string;
  last_job_id?: string;
  job_count: number;
  preview_text?: string;
}

export function serializeSessionSummary(
  session: SessionRecord,
  options: { jobCount?: number; previewText?: string }
): {
  session_id: string;
  title: string;
  source_use_case?: string;
  created_at: string;
  updated_at: string;
  last_job_id?: string;
  job_count: number;
  preview_text?: string;
}

export function serializeSessionSummary(
  session: SessionRecord,
  options: { jobCount?: number; previewText?: string } = {}
): {
  session_id: string;
  title: string;
  source_use_case?: string;
  created_at: string;
  updated_at: string;
  last_job_id?: string;
  job_count: number;
  preview_text?: string;
} {
  const jobCount = options.jobCount ?? listSessionJobs(session.id, session.ownerUserId).length;
  return {
    session_id: session.id,
    title: session.title,
    source_use_case: session.sourceUseCase,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
    last_job_id: session.lastJobId,
    job_count: jobCount,
    preview_text: options.previewText?.trim() || undefined
  };
}
