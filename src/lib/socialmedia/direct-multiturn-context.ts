import type { JobRecord } from "@/lib/types/job";
import { callGenericLlmJson } from "@/lib/llm/skill-client";
import {
  SOCIALMEDIA_WORKFLOW,
  type SocialmediaGeneratedImage,
  type SocialmediaJobResult,
  type SocialmediaJobPayload,
  type SocialmediaSourceAsset,
  type SocialmediaTargetAsset
} from "@/lib/socialmedia/types";
import { normalizeSupabaseStorageUrl } from "@/lib/socialmedia/storage-url";
import type { SocialmediaMessage } from "@/lib/socialmedia/types";

const DEFAULT_CONTEXT_JOB_LIMIT = 10;
const AGENT_RECENT_MESSAGE_LIMIT = 10;
export const MAX_PIPELINE_AGENT_HANDOFF_REFERENCE_IMAGES = 16;
const ROUTER_TEXT_LIMIT = 700;
const LEGACY_SAFETY_REJECTED_ERROR_PATTERN =
  /reference_image_safety_blocked|moderation_blocked|safety_violations|rejected by the safety system|detected unsafe content|image_generation_user_error|prompt was rejected|violates our content policy|content policy/i;
const AGENT_LOCALIZED_SAFETY_REJECTED_ERROR_PATTERN =
  /不适合(?:继续)?生成|不能按(?:该|这个)?描述(?:修改|生成)|内容(?:安全|审核|政策|违规|不适合)|(?:安全|审核|合规|敏感)限制|违反(?:内容)?(?:安全|政策)|被(?:安全)?(?:审核|拦截)/i;
const ABUSE_MODERATION_TRIGGER_PATTERN =
  /\b(?:f[\W_]*u[\W_]*c[\W_]*k[\W_]*t[\W_]*a[\W_]*r[\W_]*d|r[\W_]*e[\W_]*t[\W_]*a[\W_]*r[\W_]*d(?:e[\W_]*d)?)\b/i;

export type DirectMultiturnUserIntent = {
  action: "create" | "edit";
  confidence: number;
  reason?: string;
  safetyFollowup?: "merge_revision" | "new_request" | "unclear";
  safetyCorrectedPrompt?: string;
};

export type DirectMultiturnConversationTurn = {
  role: "user" | "assistant" | "system";
  kind: "conversation_message" | "image_safety_result";
  content: string;
};

type DirectMultiturnIntentLlmOutput = {
  action?: "create" | "edit";
  confidence?: number;
  reason?: string;
  safety_followup?: "merge_revision" | "new_request" | "unclear" | null;
  generation_prompt_override?: string | null;
};

function asSocialmediaPayload(payload: JobRecord["payload"]): SocialmediaJobPayload["socialmedia"] | null {
  const socialmedia = payload.socialmedia;
  if (!socialmedia || typeof socialmedia !== "object") return null;
  return socialmedia as SocialmediaJobPayload["socialmedia"];
}

function asSocialmediaResult(result: JobRecord["result"]): SocialmediaJobResult | null {
  if (!result || typeof result !== "object") return null;
  const record = result as unknown as Partial<SocialmediaJobResult>;
  return record.kind === "socialmedia_image_generation" && record.socialmedia ? record as SocialmediaJobResult : null;
}

function truncateRouterText(value: unknown, maxChars = ROUTER_TEXT_LIMIT): string {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!text) return "";
  return text.length > maxChars ? `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…` : text;
}

function directContextUseCaseLabel(sourceUseCase?: string): string {
  if (sourceUseCase === "ai-album-cover") return "album-cover";
  if (sourceUseCase === "ai-logo-generator") return "logo";
  if (sourceUseCase === "ai-flyer-generator") return "flyer";
  if (sourceUseCase === "ai-brochure-generator") return "brochure";
  if (sourceUseCase === "ai-infographic-generator") return "infographic";
  if (sourceUseCase === "ai-comic-generator") return "comic";
  if (sourceUseCase === "ai-anime-generator") return "anime illustration";
  if (sourceUseCase === "baby-shower-invitations") return "baby shower invitation";
  if (sourceUseCase === "playlist-cover-maker") return "playlist cover";
  if (sourceUseCase === "vision-board-maker") return "vision board";
  if (sourceUseCase === "ai-menu-generator") return "menu";
  if (sourceUseCase === "ai-certificate-generator") return "certificate";
  if (sourceUseCase === "poster-maker") return "poster";
  if (sourceUseCase === "tattoo-generator") return "tattoo concept";
  if (sourceUseCase === "room-design") return "room design";
  if (sourceUseCase === "ai-clothes-changer") return "clothes-change";
  if (sourceUseCase === "ai-sticker-generator") return "sticker";
  if (sourceUseCase === "ai-wallpaper-generator") return "wallpaper";
  return "image";
}

export function isDirectMultiturnSafetyRejectedJob(
  job: Pick<JobRecord, "status" | "error">,
  options?: { includeLocalizedAgentSignals?: boolean }
): boolean {
  const pattern = options?.includeLocalizedAgentSignals
    ? new RegExp(`${LEGACY_SAFETY_REJECTED_ERROR_PATTERN.source}|${AGENT_LOCALIZED_SAFETY_REJECTED_ERROR_PATTERN.source}`, "i")
    : LEGACY_SAFETY_REJECTED_ERROR_PATTERN;
  return job.status === "failed" && pattern.test(job.error ?? "");
}

export function isDirectMultiturnReferenceSafetyRejectedJob(job: JobRecord): boolean {
  if (job.status !== "failed") return false;
  const socialmedia = asSocialmediaPayload(job.payload);
  const taskErrors = socialmedia?.pendingImageTasks?.flatMap((task) =>
    typeof task.lastError === "string" ? [task.lastError] : []
  ) ?? [];
  return [job.error, ...taskErrors]
    .some((error) => typeof error === "string" && /reference_image_safety_blocked/i.test(error));
}

export function getDirectMultiturnBlockedReferenceImageUrls(job: JobRecord): string[] | null {
  if (job.status !== "failed") return null;
  const socialmedia = asSocialmediaPayload(job.payload);
  const blockedUrls: string[] = [];
  let hasIndexedMarker = false;
  for (const task of socialmedia?.pendingImageTasks ?? []) {
    if (typeof task.lastError !== "string") continue;
    const match = task.lastError.match(/reference_image_safety_blocked\[([\d,\s]+)\]/i);
    if (!match?.[1]) continue;
    hasIndexedMarker = true;
    const imageUrls = task.imageUrls ?? [];
    const indexes = [...new Set(match[1].split(",").map((item) => Number(item.trim())))]
      .filter((item) => Number.isInteger(item) && item >= 1 && item <= imageUrls.length);
    indexes.forEach((index) => {
      const url = imageUrls[index - 1]?.trim();
      if (url && !blockedUrls.includes(url)) blockedUrls.push(url);
    });
  }
  return hasIndexedMarker ? blockedUrls : null;
}

/**
 * Safety recovery messages are user-facing prose and can contain the assistant's
 * suggested substitute.  They must never become creative input for a later turn.
 */
export function summarizeDirectMultiturnSafetyReason(error?: string): string {
  const normalized = error?.replace(/\s+/g, " ").trim() ?? "";
  if (/sexual|sexualized|nudity|nude|色情|性内容|性暗示|裸体|裸露|性感/i.test(normalized)) {
    return "sexual_content";
  }
  if (/violence|graphic|gore|暴力|血腥|伤害/i.test(normalized)) return "violent_or_graphic_content";
  if (/copyright|protected.?ip|trademark|character|受保护.?ip|侵权|商标/i.test(normalized)) {
    return "protected_content";
  }
  return "safety_moderation";
}

/** Pipeline keeps first + ten newest messages and the unresolved question's source. */
export function selectPipelineHistoryMessages(
  messages: SocialmediaMessage[],
  pinnedUserMessageId?: string
): SocialmediaMessage[] {
  const selectedIds = new Set([
    messages[0]?.id,
    ...messages.slice(-10).map((message) => message.id),
    ...messages.filter((message) => message.role === "user" && message.id === pinnedUserMessageId).map((message) => message.id)
  ]);
  const seen = new Set<string>();
  return messages.filter((message) => {
    if (!selectedIds.has(message.id) || seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  });
}

/**
 * Keep the source role with every record sent to an LLM.  In particular, a
 * safety recovery reply can contain suggested alternatives, but that is a
 * system result rather than a user instruction.
 */
export function buildDirectMultiturnConversationContext(params: {
  messages: SocialmediaMessage[];
  latestSafetyRejectedJob?: Pick<JobRecord, "error"> | null;
  maxMessages?: number;
  includeFirstMessage?: boolean;
  preserveMessageContent?: boolean;
  maxTotalChars?: number;
}): DirectMultiturnConversationTurn[] {
  const maxMessages = params.maxMessages ?? 16;
  const selectedMessages = params.includeFirstMessage && params.messages.length > maxMessages
    ? [
        params.messages[0],
        ...params.messages
          .slice(-maxMessages)
          .filter((message) => message.id !== params.messages[0]?.id)
      ]
    : params.messages.slice(-maxMessages);
  const mappedMessages = selectedMessages
    .map((message, index) => ({
      index,
      role: message.role,
      kind: "conversation_message" as const,
      content: params.preserveMessageContent
        ? message.content.trim()
        : truncateRouterText(message.content, 1600)
    }))
    .filter((message) => Boolean(message.content));
  const maxTotalChars = params.maxTotalChars;
  const messages = maxTotalChars !== undefined && Number.isFinite(maxTotalChars)
    ? (() => {
        let remainingChars = Math.max(0, Math.floor(maxTotalChars));
        const retained = new Map<number, DirectMultiturnConversationTurn>();
        const messageGroups = mappedMessages.reduce<typeof mappedMessages[]>((groups, message) => {
          if (message.role === "user" || groups.length === 0) {
            groups.push([message]);
          } else {
            groups.at(-1)!.push(message);
          }
          return groups;
        }, []);
        const prioritizedGroups = messageGroups.length > 1
          ? [messageGroups[0]!, ...messageGroups.slice(1).reverse()]
          : messageGroups;
        const firstTurnBudget = messageGroups.length > 1
          ? Math.max(1, Math.floor(remainingChars / 4))
          : remainingChars;
        for (const [priorityIndex, group] of prioritizedGroups.entries()) {
          if (remainingChars <= 0) break;
          const availableChars = priorityIndex === 0
            ? Math.min(remainingChars, firstTurnBudget)
            : remainingChars;
          if (availableChars < group.length) continue;
          let remainingGroupChars = availableChars;
          const retainedGroup: Array<{
            index: number;
            message: DirectMultiturnConversationTurn;
          }> = [];
          for (const [messageIndex, message] of group.entries()) {
            const remainingMessageCount = group.length - messageIndex;
            const messageBudget = Math.max(1, Math.floor(remainingGroupChars / remainingMessageCount));
            const content = message.content.length <= messageBudget
              ? message.content
              : truncateRouterText(message.content, messageBudget);
            if (!content) break;
            retainedGroup.push({
              index: message.index,
              message: {
                role: message.role,
                kind: message.kind,
                content
              }
            });
            remainingGroupChars -= content.length;
          }
          if (retainedGroup.length !== group.length) continue;
          retainedGroup.forEach(({ index, message }) => retained.set(index, message));
          remainingChars -= retainedGroup.reduce((total, item) => total + item.message.content.length, 0);
        }
        return [...retained.entries()]
          .sort(([left], [right]) => left - right)
          .map(([, message]) => message);
      })()
    : mappedMessages.map((message) => ({
        role: message.role,
        kind: message.kind,
        content: message.content
      }));
  if (!params.latestSafetyRejectedJob?.error) return messages;

  return [
    ...messages,
    {
      role: "system",
      kind: "image_safety_result",
      content: truncateRouterText(params.latestSafetyRejectedJob.error, 1600)
    }
  ];
}

export function findLatestDirectMultiturnSafetyRejectedFollowupJob(
  sessionJobs: JobRecord[],
  options?: { includeLocalizedAgentSignals?: boolean }
): JobRecord | null {
  const latestSocialmediaJob = [...sessionJobs]
    .filter((job) => job.payload.workflow === SOCIALMEDIA_WORKFLOW)
    .sort((left, right) => {
      const updatedAtDelta = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      if (updatedAtDelta !== 0) return updatedAtDelta;
      return right.turnIndex - left.turnIndex;
    })[0];

  return latestSocialmediaJob && isDirectMultiturnSafetyRejectedJob(latestSocialmediaJob, options)
    ? latestSocialmediaJob
    : null;
}

export function sanitizeDirectMultiturnTurnPrompt(params: {
  prompt: string;
  isLatestTurn?: boolean;
  wasSafetyRejected?: boolean;
  wasFailed?: boolean;
  sourceUseCase?: string;
}): string {
  const prompt = params.prompt.replace(/\s+/g, " ").trim();
  if (!prompt) return "";
  if (params.isLatestTurn) return prompt;
  if (!params.wasSafetyRejected && !params.wasFailed && !ABUSE_MODERATION_TRIGGER_PATTERN.test(prompt)) return prompt;

  const useCase = directContextUseCaseLabel(params.sourceUseCase);
  return [
    `Earlier ${useCase} request omitted because it did not produce a usable image result.`,
    "Continue the same task, but use later user requests as the source of truth for exact title, visible text, and wording."
  ].join(" ");
}

export function buildDirectMultiturnSafetyCorrectedContext(params: {
  directContext?: SocialmediaJobPayload["socialmedia"]["directContext"];
  currentInput: string;
}): string {
  const safetyCorrectedPrompt = params.directContext?.safetyCorrectedPrompt?.replace(/\s+/g, " ").trim();
  if (!safetyCorrectedPrompt) return "";

  return [
    "Safety-corrected generation context:",
    "An earlier request in this session was blocked by image safety. The following LLM-merged safe prompt supersedes the raw latest user request for downstream image generation.",
    safetyCorrectedPrompt
  ].join("\n");
}

function clampConfidence(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.5;
  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return parsed;
}

export function normalizeDirectMultiturnUserIntent(value: DirectMultiturnIntentLlmOutput | null | undefined): DirectMultiturnUserIntent {
  const safetyFollowup = value?.safety_followup === "merge_revision"
    || value?.safety_followup === "new_request"
    || value?.safety_followup === "unclear"
    ? value.safety_followup
    : undefined;
  const safetyCorrectedPrompt = (safetyFollowup === "merge_revision" || safetyFollowup === "new_request")
    && typeof value?.generation_prompt_override === "string"
    ? value.generation_prompt_override.replace(/\s+/g, " ").trim()
    : "";

  return {
    action: value?.action === "edit" ? "edit" : "create",
    confidence: clampConfidence(value?.confidence),
    reason: typeof value?.reason === "string" && value.reason.trim() ? value.reason.trim() : undefined,
    ...(safetyFollowup ? { safetyFollowup } : {}),
    ...(safetyCorrectedPrompt ? { safetyCorrectedPrompt } : {})
  };
}

function summarizePreviousImages(images: SocialmediaGeneratedImage[] | undefined) {
  return (images ?? []).slice(0, 4).map((image) => ({
    index: image.imageIndex,
    asset_id: image.assetId,
    prompt_summary: truncateRouterText(image.promptSummary, 220)
  }));
}

function buildDirectIntentJobSummary(job: JobRecord | null | undefined) {
  if (!job) return null;
  const socialmedia = asSocialmediaPayload(job.payload);
  const result = asSocialmediaResult(job.result);
  return {
    job_id: job.id,
    turn_index: job.turnIndex,
    mode: socialmedia?.mode ?? job.mode,
    input_text: truncateRouterText(socialmedia?.inputText ?? job.payload.inputText),
    output_type: socialmedia?.outputType,
    source_use_case: socialmedia?.sourceUseCase,
    result_summary: truncateRouterText(result?.socialmedia.briefSummary, 260),
    generated_images: summarizePreviousImages(result?.socialmedia.images)
  };
}

function assetKeys(asset: SocialmediaSourceAsset): string[] {
  const keys = [
    asset.assetId?.trim(),
    asset.path?.trim(),
    asset.url ? normalizeSupabaseStorageUrl(asset.url).trim() : undefined
  ];
  const fileFingerprint = [
    asset.originalName?.trim().toLowerCase(),
    asset.mimeType?.trim().toLowerCase(),
    asset.sizeBytes,
    asset.width,
    asset.height
  ]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .join(":");
  if (asset.originalName?.trim() && fileFingerprint.includes(":")) {
    keys.push(`file:${fileFingerprint}`);
  }
  return keys.filter((key): key is string => Boolean(key));
}

function stableAgentReferenceId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `agent-ref-${(hash >>> 0).toString(36)}`;
}

export function ensureAgentReferenceAssetId(asset: SocialmediaSourceAsset): SocialmediaSourceAsset {
  if (asset.assetId?.trim()) return asset;
  const key = asset.path?.trim()
    || (asset.url ? normalizeSupabaseStorageUrl(asset.url).trim() : "");
  return key ? { ...asset, assetId: stableAgentReferenceId(key) } : asset;
}

function recentSocialmediaJobs(sessionJobs: JobRecord[], limit: number): JobRecord[] {
  return sessionJobs
    .filter((job) => job.payload.workflow === SOCIALMEDIA_WORKFLOW)
    .sort((left, right) => {
      const createdAtDelta = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      if (createdAtDelta !== 0) return createdAtDelta;
      return right.turnIndex - left.turnIndex;
    })
    .slice(0, limit);
}

export function collectDirectMultiturnOriginalSourceAssets(params: {
  currentSourceAssets: SocialmediaSourceAsset[];
  sessionJobs: JobRecord[];
  contextJobLimit?: number;
}): SocialmediaSourceAsset[] {
  const merged: SocialmediaSourceAsset[] = [];
  const seen = new Set<string>();
  const add = (asset: SocialmediaSourceAsset) => {
    const keys = assetKeys(asset);
    if (!keys.length || keys.some((key) => seen.has(key))) return;
    keys.forEach((key) => seen.add(key));
    merged.push({
      ...asset,
      url: asset.url ? normalizeSupabaseStorageUrl(asset.url) : asset.url
    });
  };

  params.currentSourceAssets.forEach(add);
  const firstSourceJob = recentSocialmediaJobs(params.sessionJobs, params.contextJobLimit ?? DEFAULT_CONTEXT_JOB_LIMIT)
    .reverse()
    .find((job) => {
      const socialmedia = asSocialmediaPayload(job.payload);
      return Boolean(socialmedia?.sourceAssets?.some((asset) => assetKeys(asset).length));
    });

  if (firstSourceJob) {
    asSocialmediaPayload(firstSourceJob.payload)?.sourceAssets?.forEach(add);
  }

  return merged;
}

/**
 * Recover a model-dropped reference without letting stale session history
 * override a newer upload. Current-turn uploads are authoritative, followed by
 * an unconsumed upload-only message, then the first persisted project source.
 */
export function resolveAgentReferenceRecoverySourceAssets(params: {
  currentSourceAssets: SocialmediaSourceAsset[];
  pendingSourceAssets: SocialmediaSourceAsset[];
  sessionJobs: JobRecord[];
  contextJobLimit?: number;
}): SocialmediaSourceAsset[] {
  const directSourceAssets = params.currentSourceAssets.length > 0
    ? params.currentSourceAssets
    : params.pendingSourceAssets;
  if (directSourceAssets.length > 0) {
    return collectDirectMultiturnOriginalSourceAssets({
      currentSourceAssets: directSourceAssets,
      sessionJobs: []
    });
  }
  return collectDirectMultiturnOriginalSourceAssets({
    currentSourceAssets: [],
    sessionJobs: params.sessionJobs,
    contextJobLimit: params.contextJobLimit
  });
}

/**
 * Agent conversations can persist an upload-only turn without creating a job.
 * Recover only the newest such upload when it has not yet been followed by a
 * job; once a job is created, normal job-based source inheritance takes over.
 */
export function collectPendingAgentMessageSourceAssets(params: {
  messages: SocialmediaMessage[];
  sessionJobs: JobRecord[];
  maxAssets?: number;
}): SocialmediaSourceAsset[] {
  const latestJobCreatedAt = params.sessionJobs.reduce((latest, job) => {
    const createdAt = Date.parse(job.createdAt);
    return Number.isFinite(createdAt) ? Math.max(latest, createdAt) : latest;
  }, 0);
  const pendingUploadMessage = [...params.messages]
    .reverse()
    .find((message) => message.role === "user");
  if (pendingUploadMessage?.jobId || !pendingUploadMessage?.sourceAssets?.length) return [];
  const pendingUploadCreatedAt = Date.parse(pendingUploadMessage.createdAt);
  if (!Number.isFinite(pendingUploadCreatedAt) || pendingUploadCreatedAt <= latestJobCreatedAt) return [];

  const assets: SocialmediaSourceAsset[] = [];
  const seen = new Set<string>();
  for (const rawAsset of pendingUploadMessage.sourceAssets) {
    const asset = ensureAgentReferenceAssetId(rawAsset);
    const keys = assetKeys(asset);
    if (!keys.length || keys.some((key) => seen.has(key))) continue;
    keys.forEach((key) => seen.add(key));
    assets.push({
      ...asset,
      url: asset.url ? normalizeSupabaseStorageUrl(asset.url) : asset.url
    });
    if (assets.length >= (params.maxAssets ?? MAX_PIPELINE_AGENT_HANDOFF_REFERENCE_IMAGES)) break;
  }
  return assets;
}

/**
 * Rebuild the last persisted reference selection from structured job/message
 * state. Natural-language intent is deliberately not interpreted here: the
 * semantic Agent chooses the current turn's references, while this function
 * only reconstructs previously committed selections.
 */
export function resolvePinnedAgentReferenceSourceAssets(params: {
  messages: SocialmediaMessage[];
  sessionJobs: JobRecord[];
}): SocialmediaSourceAsset[] {
  const catalog = new Map<string, SocialmediaSourceAsset>();
  const normalizeAssets = (assets: SocialmediaSourceAsset[]): SocialmediaSourceAsset[] => {
    const normalized: SocialmediaSourceAsset[] = [];
    const seen = new Set<string>();
    for (const rawAsset of assets) {
      const asset = ensureAgentReferenceAssetId(rawAsset);
      const assetId = asset.assetId?.trim();
      if (!assetId || seen.has(assetId)) continue;
      seen.add(assetId);
      const resolved = {
        ...asset,
        url: asset.url ? normalizeSupabaseStorageUrl(asset.url) : asset.url
      };
      catalog.set(assetId, resolved);
      normalized.push(resolved);
    }
    return normalized;
  };

  for (const message of params.messages) normalizeAssets(message.sourceAssets ?? []);
  for (const job of params.sessionJobs) {
    const socialmedia = asSocialmediaPayload(job.payload);
    normalizeAssets([
      ...(socialmedia?.userSourceAssets ?? []),
      ...(socialmedia?.sourceAssets ?? [])
    ]);
  }

  type PinEvent = { at: number; order: number; assetIds: string[] };
  const events: PinEvent[] = [];
  let order = 0;
  const addEvent = (createdAt: string, assetIds: string[]) => {
    const parsedAt = Date.parse(createdAt);
    events.push({
      at: Number.isFinite(parsedAt) ? parsedAt : 0,
      order: order += 1,
      assetIds
    });
  };

  for (const job of params.sessionJobs) {
    const socialmedia = asSocialmediaPayload(job.payload);
    if (!socialmedia) continue;
    if (socialmedia.selectedReferenceAssetIds !== undefined) {
      addEvent(
        job.createdAt,
        socialmedia.selectedReferenceAssetIds.filter((assetId) => catalog.has(assetId))
      );
      continue;
    }
    const legacySourceAssets = normalizeAssets([
      ...(socialmedia.userSourceAssets ?? []),
      ...(socialmedia.sourceAssets ?? [])
    ]);
    if (legacySourceAssets.length > 0) {
      addEvent(job.createdAt, legacySourceAssets.map((asset) => asset.assetId!));
    }
  }

  for (const message of params.messages) {
    if (message.role !== "user") continue;
    const messageAssets = normalizeAssets(message.sourceAssets ?? []);
    if (messageAssets.length > 0) {
      addEvent(message.createdAt, messageAssets.map((asset) => asset.assetId!));
    }
  }

  events.sort((left, right) => left.at - right.at || left.order - right.order);
  return (events.at(-1)?.assetIds ?? []).flatMap((assetId) => {
    const asset = catalog.get(assetId);
    return asset ? [asset] : [];
  });
}

/**
 * Build the Agent-only reference catalog. Current uploads are listed first,
 * followed by the first and ten newest persisted user turns and jobs. Normal
 * continuations retain the middle history through previous_response_id.
 */
export function collectAgentReferenceSourceAssets(params: {
  currentSourceAssets: SocialmediaSourceAsset[];
  messages: SocialmediaMessage[];
  sessionJobs: JobRecord[];
  maxAssets?: number;
  historyLimit?: number;
}): SocialmediaSourceAsset[] {
  const assets: SocialmediaSourceAsset[] = [];
  const seen = new Set<string>();
  const maxAssets = params.maxAssets ?? Number.POSITIVE_INFINITY;
  const add = (rawAsset: SocialmediaSourceAsset) => {
    const asset = ensureAgentReferenceAssetId(rawAsset);
    const keys = assetKeys(asset);
    if (!keys.length || keys.some((key) => seen.has(key)) || assets.length >= maxAssets) return;
    keys.forEach((key) => seen.add(key));
    assets.push({
      ...asset,
      url: asset.url ? normalizeSupabaseStorageUrl(asset.url) : asset.url
    });
  };

  params.currentSourceAssets.forEach(add);
  const userMessages = params.messages.filter((message) => message.role === "user");
  const historyLimit = params.historyLimit ?? AGENT_RECENT_MESSAGE_LIMIT;
  const boundedUserMessages = userMessages.length > historyLimit
    ? [
        userMessages[0],
        ...userMessages
          .slice(-historyLimit)
          .filter((message) => message.id !== userMessages[0]?.id)
      ]
    : userMessages;
  [...boundedUserMessages]
    .reverse()
    .forEach((message) => message.sourceAssets?.forEach(add));
  const allJobs = recentSocialmediaJobs(params.sessionJobs, params.sessionJobs.length);
  const boundedJobs = [
    ...allJobs.slice(0, historyLimit),
    ...(allJobs.length > historyLimit ? [allJobs.at(-1)!] : [])
  ].filter((job, index, jobs) => jobs.findIndex((candidate) => candidate.id === job.id) === index);
  boundedJobs.forEach((job) => asSocialmediaPayload(job.payload)?.sourceAssets?.forEach(add));
  return assets;
}

/**
 * The first Responses Agent turn must plan from the same source images that
 * the image generator will receive. Current uploads remain authoritative;
 * Pipeline history fills only the remaining provider-supported capacity.
 */
export function mergePipelineAgentHandoffSourceAssets(params: {
  currentSourceAssets: SocialmediaSourceAsset[];
  pipelineReferenceAssets: SocialmediaSourceAsset[];
}): SocialmediaSourceAsset[] {
  const merged: SocialmediaSourceAsset[] = [];
  const seen = new Set<string>();
  const add = (asset: SocialmediaSourceAsset) => {
    const keys = assetKeys(asset);
    if (!keys.length || keys.some((key) => seen.has(key)) || merged.length >= MAX_PIPELINE_AGENT_HANDOFF_REFERENCE_IMAGES) return;
    keys.forEach((key) => seen.add(key));
    merged.push({
      ...asset,
      url: asset.url ? normalizeSupabaseStorageUrl(asset.url) : asset.url
    });
  };

  params.currentSourceAssets.forEach(add);
  params.pipelineReferenceAssets.forEach(add);
  return merged;
}

export function resolveDirectMultiturnParentJobId(params: {
  revisionParentJobId?: string;
  targetAssets: SocialmediaTargetAsset[];
  latestCompletedJob?: JobRecord | null;
  allowLatestCompletedFallback?: boolean;
}): string | undefined {
  return params.revisionParentJobId
    ?? params.targetAssets[0]?.parentJobId
    ?? (params.allowLatestCompletedFallback ? params.latestCompletedJob?.id : undefined);
}

export function shouldClassifyDirectMultiturnSafetyRecovery(params: {
  isAgentInputMode: boolean;
  isVideoGeneration: boolean;
  directMultiturnEnabled: boolean;
  latestSafetyRejectedJob?: JobRecord | null;
}): boolean {
  return !params.isAgentInputMode
    && !params.isVideoGeneration
    && params.directMultiturnEnabled
    && Boolean(params.latestSafetyRejectedJob);
}

export async function classifyDirectMultiturnSafetyRecovery(params: {
  content: string;
  sessionJobs: JobRecord[];
  conversationContext?: DirectMultiturnConversationTurn[];
  latestCompletedJob?: JobRecord | null;
  latestSafetyRejectedJob: JobRecord;
  outputLanguage?: string;
  roleAwareSafetyResolution?: boolean;
}): Promise<DirectMultiturnUserIntent> {
  const normalizedContent = params.content.trim();
  if (!normalizedContent) {
    return {
      action: "create",
      confidence: 0.5,
      reason: "Empty input defaults away from editing the latest generated image."
    };
  }

  const instruction = [
    "You are the routing judge for a multi-turn AI image generation session.",
    "Decide whether the latest user turn should create a fresh image/concept or edit the latest completed generated image.",
    "Return action=create when the user asks for a new option, another concept, a separate image, a new design, a fresh variant, or a prompt that can stand alone as a new image request.",
    "Return action=edit only when the user clearly asks to modify, fix, continue, restore, or apply a change to the existing/latest/current generated result.",
    "Do not treat the mere existence of a previous completed image as edit intent.",
    "When the wording is ambiguous, prefer create unless the user clearly points at the previous result.",
    "Use the recent turns and latest job summary as context, but classify only the latest user turn.",
    params.roleAwareSafetyResolution
      ? [
        "A recent prior request in this session was rejected by image safety. Reconstruct the complete current downstream generation prompt from the successful session context and the latest user turn.",
        "The rejected raw request is evidence for resolving user intent only. Never copy its blocked details into generation_prompt_override. The supplied safety_reason is a category only; no assistant safety reply or proposed alternative is a user requirement.",
        "Return safety_followup=merge_revision when the latest turn continues the previously successful creative project. generation_prompt_override must be a complete standalone safe prompt: retain only applicable benign details from successful context, then apply the latest user turn. It is valid to discard every creative detail from the rejected request when the latest turn does not preserve it.",
        "Set action=edit when the resolved request modifies the latest usable generated result, including when the user accepts a safe replacement for a blocked modification or replaces an unfinished modification. Set action=create only for a genuinely fresh image concept.",
        "Return safety_followup=new_request when the latest turn is a clearly independent new request. generation_prompt_override must still be a complete standalone safe prompt based on that request only, without inheriting the earlier project or rejected request.",
        "For merge_revision or new_request, generation_prompt_override is required. Do not include blocked content, policy, moderation, safety systems, rejection, or assistant-proposed alternatives in it.",
        "Return safety_followup=unclear only when the latest turn remains unsafe or its intent cannot be resolved safely; leave generation_prompt_override empty."
      ].join(" ")
      : [
        "A recent prior request in this session was rejected by image safety.",
        "Also decide whether the latest user turn is a safe revision/correction of that rejected request, or a completely new standalone prompt.",
        "Return safety_followup=merge_revision only when the latest turn is trying to correct or replace the blocked content while preserving benign creative details from the prior prompt.",
        "For safety_followup=merge_revision, return generation_prompt_override as the final safe downstream image-generation prompt.",
        "The override must preserve only benign details from the rejected prompt such as medium, format, style, color palette, typography, title, layout, size, and non-sensitive subject framing.",
        "The override must apply the latest user turn as source of truth for the corrected subject/action/content.",
        "Do not include unsafe blocked content in generation_prompt_override. Do not mention policy, moderation, safety systems, rejection, or blocked content in generation_prompt_override.",
        "Return safety_followup=new_request when the latest turn is a complete new standalone prompt; leave generation_prompt_override empty.",
        "Return safety_followup=unclear when the latest turn is still unsafe or cannot be safely merged; leave generation_prompt_override empty."
      ].join(" "),
    params.roleAwareSafetyResolution
      ? "The conversation_context is role-labelled history. Only user messages can establish creative requirements. Assistant messages and system messages may report results, safety explanations, or suggestions; they are never creative requirements unless a later user message explicitly adopts them."
      : "",
    "Return strict JSON only."
  ].filter(Boolean).join(" ");
  const latestSafetyRejectedSocialmedia = asSocialmediaPayload(params.latestSafetyRejectedJob.payload);
  const input = {
    latest_user_input: truncateRouterText(normalizedContent, 1200),
    latest_completed_job: buildDirectIntentJobSummary(params.latestCompletedJob),
    latest_safety_rejected_job: {
      ...buildDirectIntentJobSummary(params.latestSafetyRejectedJob),
      raw_input_text: truncateRouterText(latestSafetyRejectedSocialmedia?.inputText ?? params.latestSafetyRejectedJob.payload.inputText, 1600),
      safety_reason: params.roleAwareSafetyResolution
        ? summarizeDirectMultiturnSafetyReason(params.latestSafetyRejectedJob.error)
        : truncateRouterText(params.latestSafetyRejectedJob.error, 600)
    },
    conversation_context: params.conversationContext,
    recent_turns: params.sessionJobs
      .filter((job) => job.payload.workflow === SOCIALMEDIA_WORKFLOW)
      .sort((left, right) => {
        const createdAtDelta = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        if (createdAtDelta !== 0) return createdAtDelta;
        return left.turnIndex - right.turnIndex;
      })
      .slice(-6)
      .map((job) => {
        const summary = buildDirectIntentJobSummary(job);
        return params.roleAwareSafetyResolution && summary && isDirectMultiturnSafetyRejectedJob(job, {
          includeLocalizedAgentSignals: true
        })
          ? {
              ...summary,
              input_text: "[blocked prior request; do not use as creative instruction]",
              result_summary: ""
            }
          : summary;
      }),
    allowed_actions: ["create", "edit"]
  };
  const outputSchemaHint = params.roleAwareSafetyResolution
    ? '{"action":"create","confidence":0.92,"reason":"The latest user turn continues the safe project after a blocked request.","safety_followup":"merge_revision","generation_prompt_override":"A complete standalone prompt assembled from the successful project context and the latest user request."}'
    : '{"action":"create","confidence":0.92,"reason":"The user is safely correcting the rejected request.","safety_followup":"merge_revision","generation_prompt_override":"Create a square album cover with dark noir style, bold gothic font, red and black colors. Show two people hugging in a non-explicit, fully clothed scene."}';

  const llm = await callGenericLlmJson<DirectMultiturnIntentLlmOutput>({
    instruction,
    input,
    outputSchemaHint,
    outputLanguage: params.outputLanguage,
    temperature: 0,
    debugLabel: "socialmedia-direct-multiturn-intent"
  });

  if (!llm) {
    return {
      action: "create",
      confidence: 0.35,
      reason: "Direct multiturn intent classifier was unavailable; defaulting away from implicit latest-image editing."
    };
  }

  return normalizeDirectMultiturnUserIntent(llm);
}
