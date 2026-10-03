import { appConfig } from "@/lib/config";
import type { JobRecord } from "@/lib/types/job";
import {
  SOCIALMEDIA_WORKFLOW,
  type SocialmediaJobPayload,
  type SocialmediaMessage,
  type SocialmediaSourceAsset
} from "@/lib/socialmedia/types";
import { ensureAgentReferenceAssetId } from "@/lib/socialmedia/direct-multiturn-context";
import {
  classifyCreativeScope,
  creativeScopeRedirect,
  hasExplicitImageCreationSignal,
  hasExplicitImageEditSignal,
  hasExplicitTechnicalOperationSignal,
  isUnrelatedTechnicalAgentReply,
  type CreativeScopeProviderConfig,
  type CreativeScopeDiagnostic
} from "@/lib/socialmedia/creative-scope";
import {
  AgentContentPolicyError,
  isRetryableAgentProviderFailure,
  normalizeAgentProviderErrorField,
  readAgentProviderStatusCode,
  readAgentContentPolicyError
} from "@/lib/socialmedia/agent-error-policy";
import type { ToapisAgentRequestFailure } from "@/lib/socialmedia/intent-agent";
import { VIDEO_BUILDER_V3_PROVIDER_REFERENCE_LIMITS } from "@/lib/socialmedia/video-builder-agent-v3/contracts";
import {
  compilePromoVideoScriptPrompt,
  getPromoVideoScriptPlannerInstructions,
  getPromoVideoScriptToolProperty,
  isPromoVideoScriptPlanningSourceUseCase,
  normalizePromoVideoScriptPlan,
  PROMO_VIDEO_MAX_PROMPT_LENGTH,
  type PromoVideoScriptPlan
} from "@/lib/socialmedia/promo-video-script-planner";

const MAX_VIDEO_VISUAL_REFERENCE_IMAGES = 16;
const MAX_VIDEO_SELECTED_REFERENCE_IMAGES = VIDEO_BUILDER_V3_PROVIDER_REFERENCE_LIMITS.imageTotal;
const MAX_RESPONSE_ATTEMPTS = 2;
const MAX_COMMAND_RECOVERIES = 1;

const VIDEO_FALLBACK_PRODUCT_REQUEST_PATTERN = /(?:\b(?:subscription|subscribe|plan|pricing|price|cost|credit|credits|billing|upgrade|watermark|download|export|account)\b|订阅|套餐|价格|多少钱|费用|积分|额度|账单|付费|升级|水印|下载|导出|账户|账号)/i;
const VIDEO_FALLBACK_ACTION_PATTERN = /(?:\b(?:create|generate|make|produce|render|animate|regenerate|retry|continue|extend|change|modify|edit|restyle|shorten|turn)\b|创建|生成|制作|做一个|做成|渲染|动画化|让.+动|重试|重新生成|继续|延续|修改|更改|调整|改成|缩短)/i;
const VIDEO_FALLBACK_GENERATION_ACTION_PATTERN = /(?:\b(?:create|generate|make|produce|render|animate|regenerate)\b|创建|生成|制作|做一个|做成|渲染|动画化|让.+动|重新生成)/i;
const VIDEO_FALLBACK_CREATIVE_PATTERN = /(?:\b(?:video|clip|animation|cinematic|scene|shot|camera|storyboard|motion|film|trailer|sequence|transition|timelapse|time-lapse)\b|视频|短片|动画|电影感|镜头|场景|分镜|运镜|动态|预告片|转场|延时摄影)/i;
const VIDEO_FALLBACK_STILL_IMAGE_ANIMATE_PATTERN = /^(?:please\s+|(?:can|could|would|will)\s+you\s+|i\s+(?:want|would\s+like|'d\s+like)\s+you\s+to\s+)?animate\s+(?:(?:the|this|that|my|our|a|an)\s+)?(?:(?:uploaded|supplied)\s+)?(?:picture|image|photo|portrait|person|people|subject|character|figure|dancer|singer|man|woman|child|animal|dog|cat|car|vehicle|object)\b/iu;
const VIDEO_FALLBACK_STILL_IMAGE_MAKE_MOTION_PATTERN = /^(?:please\s+|(?:can|could|would|will)\s+you\s+|i\s+(?:want|would\s+like|'d\s+like)\s+you\s+to\s+)?make\s+(?:(?:(?:the|this|that|my|our|a|an)\s+)?(?:picture|image|photo|portrait)|(?:(?:the|this|that|my|our|a|an)\s+)?(?:person|people|subject|character|figure|dancer|singer|man|woman|child|animal|dog|cat|car|vehicle|object)\b.{0,72}?\b(?:in|from|on)\s+(?:(?:the|this|that|my|our|a|an)\s+)?(?:(?:uploaded|supplied)\s+)?(?:picture|image|photo|portrait))\s+(?:(?:slowly|gently|subtly|naturally)\s+)?(?:move\b(?=$|[.!?,;:]|\s+(?:and|while|with|using|naturally|gently|slowly|subtly)\b|\s+in\s+(?:a|the|this)\s+(?:video|clip|animation)\b)|come\s+(?:to\s+life|alive)\b)/iu;
const VIDEO_FALLBACK_STILL_IMAGE_LAYOUT_MOTION_PATTERN = /(?:\bmove\s+(?:to|into|towards?|left|right|up|down)\b|\b(?:in|on|within|as)\s+(?:(?:the|a|this|that)\s+)?(?:still|static)\s+(?:poster|flyer|image|picture|photo|cover|graphic|artwork)\b)/iu;
const VIDEO_FALLBACK_EXPLICIT_STILL_OUTPUT_PATTERN = /(?:\b(?:keep|remain|result|output|final)\b.{0,48}\b(?:still|static)\b|\b(?:as|in|on|within)\s+(?:(?:a|the|this|that)\s+)?(?:still|static)\s+(?:poster|flyer|image|picture|photo|cover|graphic|artwork|edit)\b)/iu;
const VIDEO_FALLBACK_REFERENCE_ONLY_PATTERN = /(?:\b(?:add|remove|replace|select|use|keep|clear)\b.{0,32}\b(?:reference|image|photo|frame)\b|(?:添加|移除|删除|替换|选择|使用|保留|清空).{0,16}(?:参考|图片|照片|首帧|尾帧))/i;
const VIDEO_FALLBACK_QUESTION_PATTERN = /^(?:\s*(?:how|what|why|when|where|who|which|is|are|do|does|can|could|would|should)\b|\s*(?:怎么|如何|为什么|什么|何时|哪里|谁|是否|能否|可以介绍|请问))/i;
const VIDEO_FALLBACK_ACTION_QUESTION_PATTERN = /^(?:\s*(?:can|could|would|will)\s+you\b|\s*(?:能否|能不能|可以|可不可以).{0,12}(?:创建|生成|制作|修改|更改|调整))/i;
const VIDEO_FALLBACK_INFORMATION_REQUEST_PATTERN = /(?:\b(?:explain|teach|show me how|tell me how)\b|解释|教我|告诉我怎么|介绍一下)/i;
const VIDEO_FALLBACK_GREETING_PATTERN = /^(?:hi|hello|hey|thanks|thank you|你好|您好|嗨|谢谢)[.!。！\s]*$/i;

type MissingVideoToolDecision = "conversation" | "clarify" | "must_create";

type ResponsesEnvelope = {
  id?: string;
  output?: Array<{
    type?: string;
    name?: string;
    call_id?: string;
    arguments?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  output_text?: string;
};

export type VideoAgentConversationTurn = {
  role: "user" | "assistant" | "system";
  kind: "conversation_message";
  content: string;
};

export type VideoAgentProviderConfig = CreativeScopeProviderConfig & {
  enabled: boolean;
};

export type VideoAgentRouteOptions = {
  provider?: VideoAgentProviderConfig;
  contextStrategy?: "previous_response_id" | "client_history";
  maxRequestAttempts?: number;
};

export type VideoWorkspaceCta = {
  target: "image_maker";
  href: string;
  label: string;
};

export type VideoSubscriptionCta = {
  kind: "video_subscription";
  label: string;
};

export type VideoIntentDecision = {
  taskAction: "none" | "create_video";
  assistantReply: string;
  generationPrompt?: string;
  referenceAssetIds?: string[];
  generationDurationSeconds?: number;
  promoVideoScriptPlan?: PromoVideoScriptPlan;
  workspaceCta?: VideoWorkspaceCta;
  videoSubscriptionCta?: VideoSubscriptionCta;
  responseId?: string;
};

const VIDEO_REFERENCE_SELECTION_METADATA_KEY = "videoReferenceAssetIds";

type VideoAgentInput = {
  sessionId: string;
  sourceUseCase?: string;
  content: string;
  responseLanguage: string;
  previousResponseId?: string;
  sessionJobs: JobRecord[];
  historySessionJobs?: JobRecord[];
  includeSessionHistory: boolean;
  conversationContext?: VideoAgentConversationTurn[];
  currentReferenceAssets: SocialmediaSourceAsset[];
  availableReferenceAssets?: SocialmediaSourceAsset[];
  pinnedReferenceAssets?: SocialmediaSourceAsset[];
  bootstrapReferenceAssets?: SocialmediaSourceAsset[];
  requestedDurationSeconds?: number;
  onScopeDiagnostic?: (diagnostic: CreativeScopeDiagnostic) => void;
};

function isWatermarkFreeDownloadRequest(content: string): boolean {
  return /(?:去(?:掉|除)?水印|无水印(?:导出|下载)?|水印.*(?:导出|下载)|(?:导出|下载).*水印|watermark(?:-free| free)?\s*(?:export|download)|(?:export|download).*watermark|remove.*watermark)/i.test(content);
}

export function hasPositiveStillImageMotionSignal(content: string): boolean {
  const normalized = content.replace(/\s+/g, " ").trim();
  return !VIDEO_FALLBACK_EXPLICIT_STILL_OUTPUT_PATTERN.test(normalized)
    && !VIDEO_FALLBACK_STILL_IMAGE_LAYOUT_MOTION_PATTERN.test(normalized)
    && (
      VIDEO_FALLBACK_STILL_IMAGE_ANIMATE_PATTERN.test(normalized)
      || VIDEO_FALLBACK_STILL_IMAGE_MAKE_MOTION_PATTERN.test(normalized)
    );
}

export function shouldDirectGenerateVideoAfterAgentFailure(params: {
  content: string;
  hasPriorVideoJob: boolean;
  hasCurrentReferences: boolean;
  allowCurrentImageMotion?: boolean;
}): boolean {
  const content = params.content.replace(/\s+/g, " ").trim();
  if (!content || VIDEO_FALLBACK_GREETING_PATTERN.test(content)) return false;
  if (VIDEO_FALLBACK_EXPLICIT_STILL_OUTPUT_PATTERN.test(content)) return false;

  const hasAction = VIDEO_FALLBACK_ACTION_PATTERN.test(content);
  const hasCreativeSignal = VIDEO_FALLBACK_CREATIVE_PATTERN.test(content)
    || Boolean(
      params.allowCurrentImageMotion
      && params.hasCurrentReferences
      && hasPositiveStillImageMotionSignal(content)
    );
  if (
    VIDEO_FALLBACK_PRODUCT_REQUEST_PATTERN.test(content)
    && !(
      VIDEO_FALLBACK_GENERATION_ACTION_PATTERN.test(content)
      && hasCreativeSignal
    )
  ) return false;
  if (
    VIDEO_FALLBACK_REFERENCE_ONLY_PATTERN.test(content)
    && !VIDEO_FALLBACK_GENERATION_ACTION_PATTERN.test(content)
  ) return false;
  if (
    hasExplicitTechnicalOperationSignal(content)
    && !hasCreativeSignal
  ) return false;
  if (
    hasExplicitImageCreationSignal(content)
    && !hasCreativeSignal
  ) return false;

  // Question-shaped execution requests such as "Can you create a video?"
  // remain actionable; informational questions fail closed.
  if (
    VIDEO_FALLBACK_QUESTION_PATTERN.test(content)
    && VIDEO_FALLBACK_INFORMATION_REQUEST_PATTERN.test(content)
  ) return false;
  if (
    VIDEO_FALLBACK_QUESTION_PATTERN.test(content)
    && !(hasAction && VIDEO_FALLBACK_ACTION_QUESTION_PATTERN.test(content))
  ) return false;
  if (hasAction || hasCreativeSignal) return true;
  if (params.hasPriorVideoJob && hasExplicitImageEditSignal(content)) return true;
  if (params.hasCurrentReferences && content.length >= 20) return true;

  // A detailed narrative or storyboard is an actionable brief in the Video
  // Generator even when it omits words such as "video" or "generate".
  return content.length >= 80;
}

function latestCompletedVideoAccessVariant(jobs: JobRecord[]): "original" | "watermarked" | null {
  const latestJobs = jobs
    .filter((job) => isVideoAgentJob(job) && job.status === "completed")
    .sort((left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime());
  for (const job of latestJobs) {
    const result = job.result as { socialmedia?: { videos?: Array<{ url?: string; accessVariant?: "original" | "watermarked" }> } } | undefined;
    const video = result?.socialmedia?.videos?.find((item) => item.url);
    if (video?.accessVariant === "original" || video?.accessVariant === "watermarked") return video.accessVariant;
  }
  return null;
}

export function getVideoWatermarkDownloadDecision(params: {
  content: string;
  responseLanguage: string;
  sessionJobs: JobRecord[];
}): VideoIntentDecision | null {
  if (!isWatermarkFreeDownloadRequest(params.content)) return null;
  const chinese = params.responseLanguage.toLowerCase().startsWith("zh");
  const accessVariant = latestCompletedVideoAccessVariant(params.sessionJobs);
  if (accessVariant === "watermarked") {
    return {
      taskAction: "none",
      assistantReply: chinese
        ? "当前视频为水印预览。升级后即可解锁无水印下载。"
        : "This video is a watermarked preview. Upgrade to unlock the watermark-free download.",
      videoSubscriptionCta: { kind: "video_subscription", label: "Upgrade to Pro" }
    };
  }
  if (accessVariant === "original") {
    return {
      taskAction: "none",
      assistantReply: chinese
        ? "当前视频可直接点击结果上的 Download 按钮下载无水印版本。"
        : "Click Download on the video result to save the watermark-free version."
    };
  }
  return {
    taskAction: "none",
    assistantReply: chinese
      ? "这段对话里还没有可下载的视频。告诉我想生成的画面和动作，我可以帮你生成视频；如需静态图片，也可以使用 Image Generator。生成完成后可直接下载。"
      : "There is no completed video to download in this chat yet. Tell me the scene and action and I can generate a video; for a still image, use Image Generator. You can download the result when it is ready."
  };
}

function textFrom(response: ResponsesEnvelope): string {
  const output = response.output
    ?.flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
  return output || response.output_text?.trim() || "";
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readVideoReferenceAssetIds(
  value: unknown,
  availableReferenceAssetIds: Set<string>
): string[] | null {
  if (value === undefined) return availableReferenceAssetIds.size === 0 ? [] : null;
  if (!Array.isArray(value)) return null;
  const ids = Array.from(new Set(value.map(readString).filter((item): item is string => Boolean(item))));
  return ids.length === value.length
    && ids.length <= MAX_VIDEO_SELECTED_REFERENCE_IMAGES
    && ids.every((id) => availableReferenceAssetIds.has(id))
    ? ids
    : null;
}

function parseArguments(value?: string): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function parseMissingVideoToolDecision(value: string): MissingVideoToolDecision | undefined {
  const decision = readString(parseArguments(value).decision);
  return decision === "conversation" || decision === "clarify" || decision === "must_create"
    ? decision
    : undefined;
}

function jobVideoSummary(job: JobRecord): Record<string, unknown> {
  const socialmedia = job.payload.socialmedia as { inputText?: string } | undefined;
  return {
    job_id: job.id,
    turn_number: job.turnIndex,
    status: job.status,
    user_instruction: job.payload.sourceInputText ?? job.payload.inputText,
    executed_video_prompt: socialmedia?.inputText ?? job.payload.inputText,
    error: job.error || undefined
  };
}

function videoJobStatus(job: JobRecord): "completed" | "failed" | "safety_rejected" | "in_progress" {
  if (job.status === "completed") return "completed";
  if (/content policy|moderation|safety|unsafe|rejected/i.test(job.error ?? "")) return "safety_rejected";
  if (job.status === "failed") return "failed";
  return "in_progress";
}

function isVideoAgentJob(job: JobRecord): boolean {
  const socialmedia = job.payload.socialmedia as Partial<SocialmediaJobPayload["socialmedia"]> | undefined;
  return job.payload.workflow === SOCIALMEDIA_WORKFLOW
    && (
      socialmedia?.sourceUseCase === "ai-video-generator"
      || socialmedia?.sourceUseCase === "ai-image-to-video"
      || socialmedia?.sourceUseCase === "ai-animation-generator"
      || socialmedia?.sourceUseCase === "hotel-lobby-ai"
      || socialmedia?.sourceUseCase === "promo-video-maker"
      || socialmedia?.sourceUseCase === "spotify-canvas-generator"
    );
}

export function selectVideoAgentBootstrapJobs(jobs: JobRecord[]): JobRecord[] {
  const videoJobs = jobs
    .filter(isVideoAgentJob)
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  return videoJobs.length <= 6 ? videoJobs : [videoJobs[0], ...videoJobs.slice(-5)];
}

export function buildVideoAgentBootstrapContext(jobs: JobRecord[]): VideoAgentConversationTurn[] {
  return jobs.flatMap((job) => {
    const socialmedia = job.payload.socialmedia as Partial<SocialmediaJobPayload["socialmedia"]> | undefined;
    const sources = socialmedia?.userSourceAssets?.length
      ? socialmedia.userSourceAssets
      : socialmedia?.sourceAssets ?? [];
    const referenceSummary = sources.length
      ? ` Reference images: ${sources.map((asset) => asset.summary || asset.originalName || asset.role).join(", ")}.`
      : "";
    const outcome = videoJobStatus(job);
    const outcomeDetail = outcome === "completed"
      ? "Video completed successfully."
      : outcome === "safety_rejected"
        ? `Safety rejection: ${job.error ?? "The request was blocked by policy."}`
        : outcome === "failed"
          ? `Video failed: ${job.error ?? "Unknown error."}`
          : "Video generation was still in progress when this context was recorded.";
    return [
      {
        role: "user" as const,
        kind: "conversation_message" as const,
        content: `User video instruction: ${job.payload.sourceInputText ?? job.payload.inputText}.${referenceSummary}`
      },
      {
        role: "system" as const,
        kind: "conversation_message" as const,
        content: `Video execution record. Executed prompt: ${socialmedia?.inputText ?? job.payload.inputText}. State: ${outcome}. ${outcomeDetail}`
      }
    ];
  });
}

export function collectVideoAgentBootstrapReferences(jobs: JobRecord[]): SocialmediaSourceAsset[] {
  const references = jobs.flatMap((job) => {
    const socialmedia = job.payload.socialmedia as Partial<SocialmediaJobPayload["socialmedia"]> | undefined;
    if (
      socialmedia?.sourceUseCase === "spotify-canvas-generator"
      && socialmedia.sourceAssets?.length
    ) {
      return socialmedia.sourceAssets;
    }
    return socialmedia?.userSourceAssets?.length
      ? socialmedia.userSourceAssets
      : socialmedia?.sourceAssets ?? [];
  });
  return references.filter((asset, index, all) => Boolean(asset.url?.trim())
    && all.findIndex((candidate) => (candidate.assetId || candidate.url) === (asset.assetId || asset.url)) === index);
}

export function resolveVideoAgentPinnedReferenceSourceAssets(params: {
  currentSourceAssets: SocialmediaSourceAsset[];
  messages: SocialmediaMessage[];
  sessionJobs: JobRecord[];
}): SocialmediaSourceAsset[] {
  const catalog = new Map<string, SocialmediaSourceAsset>();
  const normalizeAssets = (assets: SocialmediaSourceAsset[]): SocialmediaSourceAsset[] => assets.flatMap((rawAsset) => {
    const asset = ensureAgentReferenceAssetId(rawAsset);
    const assetId = asset.assetId?.trim();
    if (!assetId) return [];
    catalog.set(assetId, asset);
    return [asset];
  });

  params.messages.forEach((message) => normalizeAssets(message.sourceAssets ?? []));
  params.sessionJobs.filter(isVideoAgentJob).forEach((job) => {
    const socialmedia = job.payload.socialmedia as Partial<SocialmediaJobPayload["socialmedia"]> | undefined;
    normalizeAssets([
      ...(socialmedia?.userSourceAssets ?? []),
      ...(socialmedia?.sourceAssets ?? [])
    ]);
  });
  const currentAssets = normalizeAssets(params.currentSourceAssets);
  if (currentAssets.length > 0) return currentAssets;

  type SelectionEvent = { at: number; order: number; assetIds: string[] };
  const events: SelectionEvent[] = [];
  let order = 0;
  const addEvent = (createdAt: string, assetIds: string[]) => {
    const parsedAt = Date.parse(createdAt);
    events.push({
      at: Number.isFinite(parsedAt) ? parsedAt : 0,
      order: order += 1,
      assetIds: [...new Set(assetIds)]
    });
  };

  params.sessionJobs.filter(isVideoAgentJob).forEach((job) => {
    const socialmedia = job.payload.socialmedia as Partial<SocialmediaJobPayload["socialmedia"]> | undefined;
    if (!socialmedia) return;
    if (socialmedia.selectedReferenceAssetIds !== undefined) {
      addEvent(job.createdAt, socialmedia.selectedReferenceAssetIds);
      return;
    }
    const legacyAssetIds = normalizeAssets([
      ...(socialmedia.userSourceAssets ?? []),
      ...(socialmedia.sourceAssets ?? [])
    ]).flatMap((asset) => asset.assetId?.trim() ? [asset.assetId.trim()] : []);
    if (legacyAssetIds.length > 0) addEvent(job.createdAt, legacyAssetIds);
  });
  params.messages
    .filter((message) => message.role === "user")
    .forEach((message) => {
      const persistedSelection = message.metadata?.[VIDEO_REFERENCE_SELECTION_METADATA_KEY];
      if (
        Array.isArray(persistedSelection)
        && persistedSelection.every((assetId) => typeof assetId === "string")
      ) {
        addEvent(message.createdAt, persistedSelection);
        return;
      }
      if ((message.sourceAssets?.length ?? 0) > 0) {
        addEvent(
          message.createdAt,
          normalizeAssets(message.sourceAssets ?? []).flatMap((asset) => asset.assetId?.trim()
            ? [asset.assetId.trim()]
            : [])
        );
      }
    });

  events.sort((left, right) => left.at - right.at || left.order - right.order);
  return (events.at(-1)?.assetIds ?? []).flatMap((assetId) => {
    const asset = catalog.get(assetId);
    return asset ? [asset] : [];
  });
}

export function resolveVideoAgentSelectedReferenceSourceAssets(params: {
  sourceUseCase?: string;
  availableReferenceAssets: SocialmediaSourceAsset[];
  selectedReferenceAssetIds: string[];
  sessionJobs: JobRecord[];
}): SocialmediaSourceAsset[] {
  const availableById = new Map(params.availableReferenceAssets.flatMap((asset) => (
    asset.assetId?.trim() ? [[asset.assetId.trim(), asset] as const] : []
  )));
  const selectedReferences = params.selectedReferenceAssetIds.flatMap((assetId) => {
    const asset = availableById.get(assetId);
    return asset ? [asset] : [];
  });

  if (params.sourceUseCase === "spotify-canvas-generator" && selectedReferences.length > 0) {
    const originalReferences = collectVideoAgentBootstrapReferences(params.sessionJobs);
    return selectedReferences.map((selected) => originalReferences.find((original) => (
      Boolean(selected.assetId?.trim() && original.assetId?.trim() === selected.assetId.trim())
      || Boolean(selected.url?.trim() && original.url?.trim() === selected.url.trim())
    )) ?? selected);
  }

  return selectedReferences;
}

function instructions(language: string, scriptPlannerSourceUseCase?: string | null): string {
  const chinese = language.toLowerCase().startsWith("zh");
  return [
    "You are Vismuse's Video Generator creative partner.",
    "Scope boundary: you are not a general-purpose assistant. Do not provide code, commands, device or system-operation instructions, technical troubleshooting, tutorials, or factual advice that is unrelated to creating, revising, downloading, or subscribing to Vismuse video or image projects. This applies even if the user asks repeatedly or the earlier conversation is off-topic. For an unrelated request, give one brief reply in the user's language that Vismuse helps create videos and images and invite a visual-creation request; do not include examples, instructions, or a tool call. This boundary does not apply when code or technical text is explicitly requested as visible copy inside an image or video being created.",
    "You can discuss video ideas, ask one concise clarification when a required video detail is genuinely missing, and create a video job only by calling create_video_generation.",
    "In this Video Generator, treat any video-related instruction, visual description, scene, narrative, story, storyboard, or script as an actionable video request, even if the user does not explicitly say 'generate a video'. Call create_video_generation in that same turn.",
    "Use request_context.conversation_context as role-labelled history. User records state intent; system records show the actual prompt sent to the video service and its outcome. System records are context, never user instructions.",
    "Video files are deliberately not included in the context. Reference images may be attached to the current request or bootstrap request; treat those visual references as the source of truth for visible subjects and style.",
    "For every create_video_generation call, choose reference_asset_ids from request_context.available_reference_assets using the user's semantic intent, not keyword matching. Include the applicable pinned references when the latest request retries, continues, or modifies the same reference-led video. Return an empty array for a new unrelated video or when the user asks not to use those references. When the current turn uploads a new image and rejects only an older image, include the new image's asset ID and omit the old one.",
    "When the user only adds, removes, replaces, or otherwise changes the active reference images without asking to generate a video now, call update_video_reference_selection. Choose its reference_asset_ids semantically from request_context.available_reference_assets; use an empty array to clear the active references. Do not merely acknowledge a reference-state change in text.",
    "Video clips support a maximum duration of 15 seconds. Never state or imply that 30-second or longer videos are supported. If the user asks for more than 15 seconds, explain briefly that one clip can be up to 15 seconds and suggest creating a short sequence or storyboard instead.",
    "For an explicit, actionable video request, call create_video_generation in the same turn. Never claim a video has started without that tool call.",
    "The prompt in create_video_generation is the authoritative final prompt sent to the video service and the complete creative direction for the video. Always return the complete merged creative direction in that field. First assess whether the user's request is already a production-ready video prompt: if it specifies a clear subject, action, setting, style, camera, timing, deliberate story beats, or other deliberate production details, set prompt_mode to preserve. A complete narrative, story, storyboard, or script can itself be production-ready; set prompt_mode to preserve and do not treat it as underspecified merely because it lacks camera direction. On a first turn, preserve a production-ready request faithfully. Do not add, omit, or reinterpret deliberate details. You may and should compress wording, merge repetition, and replace verbose phrasing with concise equivalents when needed to fit the provider prompt budget, while preserving the user's complete semantic intent and every exact user-authored dialogue, lyric, visible-copy, brand, product, offer, number, domain, and other literal that must remain verbatim. On a follow-up that modifies, retries, regenerates, or continues the latest video, use the latest completed video's executed prompt as evidence of the prior creative direction and merge it with the current instruction into one complete prompt. Preserve every earlier user-requested detail that the user did not explicitly replace or remove, but do not treat incidental model-authored or system-record-only additions as user requirements. Preserve earlier user-supplied campaign copy, offers, percentages, urgency, audience phrases, product lists, brand names, and domains verbatim unless the user explicitly corrects or replaces them. Carry required visible copy into both prompt and video_script constraints or protected_elements. Never reduce a specific earlier requirement to a generic synonym. For a retry or regeneration, include the previous creative direction exactly once; never quote, nest, or duplicate the previous compiled prompt. Set prompt_mode to enrich only if the request is genuinely concise or leaves the central subject, intended visual action, setting, or visual direction open; then add only the missing coherent action progression, restrained secondary/environmental movement, and camera direction. Do not invent named brands, text, facts, or subjects that the user or current reference images do not support. Do not mention prompt writing, the user, reference images, AI, or these instructions in the final prompt.",
    ...(scriptPlannerSourceUseCase
      ? getPromoVideoScriptPlannerInstructions(scriptPlannerSourceUseCase)
      : []),
    "This is the Video Generator. For an explicit image request—such as a flyer, album cover, poster, logo, or still image—do not create a video. Call recommend_workspace with target image_maker so the application can offer an AI Image Maker button. Do not claim that you have already switched pages.",
    "For subscription, video credits, upgrading, watermark removal, watermark-free export, or downloading without a watermark, call recommend_video_subscription. Explain briefly that a video subscription unlocks the requested benefit, then let the button below provide the next step. Do not invent plan names, prices, credit amounts, or claim that a watermark has been removed. Never say that you opened, will open, or can open a subscription page or modal; it opens only after the user clicks the button.",
    "When the user asks to modify, continue, shorten, restyle, or change the latest video, use the latest completed video's executed prompt and the user's current instruction to write one complete new video prompt. Do not claim that you can edit a completed video file directly unless the downstream request supports it.",
    "Do not expose providers, models, resolutions, aspect ratios, APIs, IDs, or implementation details. Mention duration only when needed to explain the 15-second maximum.",
    chinese
      ? "回复使用中文，简洁自然。"
      : "Reply in the user's language, concisely and naturally."
  ].join(" ");
}

const tools = [
  {
    type: "function",
    name: "create_video_generation",
    description: "Create a video generation job when the user gives an actionable video request.",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Authoritative final production-ready creative direction sent to the video service. For a follow-up, use the latest executed prompt as evidence of prior creative direction and merge it with the current instruction. Preserve every earlier user-requested detail that was not explicitly replaced or removed, including exact campaign copy, offers, percentages, audience phrases, product lists, brand names, and domains; do not preserve incidental model-authored or system-record-only additions as user requirements. Include the previous creative direction only once; do not paste or nest compiled sections such as Visible product or subject, Duration, Video timeline, Audio direction, or Constraints because video_script supplies those sections. Enrich a short request with coherent action, natural motion, and camera direction without inventing unsupported subjects or facts." },
        prompt_mode: { type: "string", enum: ["preserve", "enrich"], description: "Use preserve when the original user message is already a complete, deliberate video prompt, narrative, story, storyboard, or script. Use enrich only when essential visual details are genuinely missing." },
        reference_asset_ids: {
          type: "array",
          items: { type: "string" },
          maxItems: MAX_VIDEO_SELECTED_REFERENCE_IMAGES,
          description: "Exact uploaded-reference asset IDs from request_context.available_reference_assets to use for this video. Return an empty array when no reference should be used."
        },
        assistant_reply: { type: "string", description: "Short user-facing confirmation displayed while the video job starts." }
      },
      required: ["prompt", "prompt_mode", "reference_asset_ids", "assistant_reply"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "update_video_reference_selection",
    description: "Persist the active video reference-image selection without creating a video job.",
    parameters: {
      type: "object",
      properties: {
        reference_asset_ids: {
          type: "array",
          items: { type: "string" },
          maxItems: MAX_VIDEO_SELECTED_REFERENCE_IMAGES,
          description: "Exact asset IDs from request_context.available_reference_assets that should remain active. Use an empty array to clear the selection."
        },
        assistant_reply: { type: "string", description: "Short confirmation of the reference-image state change." }
      },
      required: ["reference_asset_ids", "assistant_reply"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "recommend_workspace",
    description: "Recommend the AI Image Maker workspace for an explicit image-generation request. This does not start a video job.",
    parameters: {
      type: "object",
      properties: {
        target: { type: "string", enum: ["image_maker"] },
        assistant_reply: { type: "string", description: "Short, helpful explanation shown above the workspace button." }
      },
      required: ["target", "assistant_reply"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "recommend_video_subscription",
    description: "Offer a Video subscription CTA for plans, credits, watermark removal, or watermark-free export. The user must click the button to open it. This does not create a video.",
    parameters: {
      type: "object",
      properties: {
        assistant_reply: { type: "string", description: "Short explanation shown above the Video subscription button. State the upgrade benefit; never promise to open anything." }
      },
      required: ["assistant_reply"],
      additionalProperties: false
    }
  }
] as const;

function buildVideoAgentTools(includePromoVideoScriptPlanner: boolean) {
  if (!includePromoVideoScriptPlanner) return tools;
  const [createVideoTool, ...otherTools] = tools;
  return [
    {
      ...createVideoTool,
      parameters: {
        ...createVideoTool.parameters,
        properties: {
          ...createVideoTool.parameters.properties,
          prompt: {
            ...createVideoTool.parameters.properties.prompt,
            maxLength: PROMO_VIDEO_MAX_PROMPT_LENGTH,
            description: `${createVideoTool.parameters.properties.prompt.description} The final compiled prompt must be at most ${PROMO_VIDEO_MAX_PROMPT_LENGTH} characters, so keep this field and video_script concise and non-redundant without dropping any explicit user requirement.`
          },
          video_script: getPromoVideoScriptToolProperty()
        },
        required: ["prompt", "prompt_mode", "reference_asset_ids", "video_script", "assistant_reply"]
      }
    },
    ...otherTools
  ];
}

function buildInput(params: VideoAgentInput): string | Array<Record<string, unknown>> {
  const availableReferenceAssets = params.availableReferenceAssets ?? params.currentReferenceAssets;
  const visualReferenceCandidates = [
    ...params.currentReferenceAssets,
    ...(params.pinnedReferenceAssets ?? []),
    ...(params.bootstrapReferenceAssets ?? [])
  ];
  const seenVisualReferenceKeys = new Set<string>();
  const visualReferences = visualReferenceCandidates
    .filter((asset) => Boolean(asset.url?.trim()))
    .filter((asset) => {
      const keys = [asset.assetId?.trim(), asset.url?.trim()].filter((key): key is string => Boolean(key));
      if (keys.some((key) => seenVisualReferenceKeys.has(key))) return false;
      keys.forEach((key) => seenVisualReferenceKeys.add(key));
      return true;
    })
    .slice(0, MAX_VIDEO_VISUAL_REFERENCE_IMAGES)
    .map((asset, index) => ({
      asset,
      label: `Visual context for uploaded video reference asset_id=${asset.assetId || `reference-${index + 1}`}${asset.originalName ? ` (${asset.originalName})` : ""}.`
    }));
  const serialized = JSON.stringify({
    user_message: params.content,
    request_context: {
      session_id: params.sessionId,
      source_use_case: params.sourceUseCase,
      requested_duration_seconds: isPromoVideoScriptPlanningSourceUseCase(params.sourceUseCase)
        ? params.requestedDurationSeconds
        : undefined,
      has_reference_assets_in_this_turn: params.currentReferenceAssets.length > 0,
      available_reference_assets: availableReferenceAssets.flatMap((asset) => asset.assetId?.trim()
        ? [{ asset_id: asset.assetId, original_name: asset.originalName }]
        : []),
      pinned_reference_assets: (params.pinnedReferenceAssets ?? []).flatMap((asset) => asset.assetId?.trim()
        ? [{ asset_id: asset.assetId, original_name: asset.originalName }]
        : []),
      current_reference_images: params.currentReferenceAssets
        .filter((asset) => Boolean(asset.url?.trim()))
        .slice(0, MAX_VIDEO_VISUAL_REFERENCE_IMAGES)
        .map((asset, index) => ({
          index: index + 1,
          asset_id: asset.assetId,
          role: asset.role,
          original_name: asset.originalName,
          summary: asset.summary,
          dimensions: asset.width && asset.height
            ? `${asset.width}x${asset.height}`
            : undefined
        })),
      conversation_context: params.includeSessionHistory ? params.conversationContext : undefined,
      recent_video_jobs: params.includeSessionHistory
        ? (params.historySessionJobs ?? params.sessionJobs).map(jobVideoSummary)
        : undefined,
      latest_video_job: params.sessionJobs
        .filter((job) => job.status === "completed")
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0]
        ? jobVideoSummary(params.sessionJobs
          .filter((job) => job.status === "completed")
          .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0])
        : undefined
    }
  });
  return visualReferences.length
    ? [{
        role: "user",
        content: [
          { type: "input_text", text: serialized },
          ...visualReferences.flatMap(({ asset, label }) => [
            { type: "input_text", text: label },
            { type: "input_image", image_url: asset.url, detail: "auto" }
          ])
        ]
      }]
    : serialized;
}

function buildHistoryRecoveryInput(input: VideoAgentInput): string | Array<Record<string, unknown>> {
  const historyJobs = selectVideoAgentBootstrapJobs(
    input.historySessionJobs ?? input.sessionJobs
  );
  return buildInput({
    ...input,
    includeSessionHistory: true,
    conversationContext: input.conversationContext?.length
      ? input.conversationContext
      : buildVideoAgentBootstrapContext(historyJobs),
    historySessionJobs: historyJobs,
    bootstrapReferenceAssets: collectVideoAgentBootstrapReferences(historyJobs)
  });
}

function toVideoClientHistoryItems(input: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(input)) {
    return input.filter((item): item is Record<string, unknown> => Boolean(item)
      && typeof item === "object"
      && !Array.isArray(item));
  }
  return typeof input === "string"
    ? [{ role: "user", content: [{ type: "input_text", text: input }] }]
    : [];
}

class VideoResponsesEnvelopeError extends Error {
  readonly failure: ToapisAgentRequestFailure;
  readonly retryable: boolean;

  constructor(message: string, failure: ToapisAgentRequestFailure) {
    super(message);
    this.name = "VideoResponsesEnvelopeError";
    this.failure = failure;
    this.retryable = failure.retryable;
  }
}

function isPreviousVideoResponseUnavailable(errorRecord: Record<string, unknown>): boolean {
  const providerParam = normalizeAgentProviderErrorField(errorRecord.param);
  const providerCode = normalizeAgentProviderErrorField(errorRecord.code);
  const message = typeof errorRecord.message === "string"
    ? errorRecord.message.replace(/\s+/g, " ").trim()
    : "";
  return providerParam === "previous_response_id"
    || Boolean(providerCode && /previous_response(?:_id)?_(?:not_found|expired|invalid|unavailable)/.test(providerCode))
    || /previous[_\s-]*response(?:[_\s-]*id)?.{0,80}(?:not found|expired|invalid|unavailable|does not exist)/i.test(message);
}

function buildVideoAgentRequestFailure(params: {
  reason: ToapisAgentRequestFailure["reason"];
  errorName: string;
  attemptCount?: number;
  errorRecord?: Record<string, unknown>;
  statusCode?: number;
}): ToapisAgentRequestFailure {
  const providerCode = normalizeAgentProviderErrorField(params.errorRecord?.code);
  const providerType = normalizeAgentProviderErrorField(params.errorRecord?.type);
  const statusCode = params.statusCode ?? readAgentProviderStatusCode(params.errorRecord);
  const attemptCount = params.attemptCount ?? 1;
  const retryable = params.reason === "toapis_timeout"
    || params.reason === "toapis_network_error"
    || isRetryableAgentProviderFailure({
      ...(params.errorRecord ?? {}),
      ...(statusCode !== undefined ? { status: statusCode } : {})
    });
  return {
    reason: params.reason,
    ...(statusCode !== undefined ? { statusCode } : {}),
    ...(providerCode ? { providerCode } : {}),
    ...(providerType ? { providerType } : {}),
    ...(params.errorRecord && isPreviousVideoResponseUnavailable(params.errorRecord)
      ? { previousResponseUnavailable: true }
      : {}),
    attemptCount,
    retryable,
    errorName: params.errorName,
    safeMessage: params.reason === "toapis_http_error"
      ? `ToAPIs Responses request failed with HTTP ${statusCode ?? "unknown"} after ${attemptCount} attempt${attemptCount === 1 ? "" : "s"}.`
      : params.reason === "toapis_timeout"
        ? `ToAPIs Responses request timed out after ${attemptCount} attempt${attemptCount === 1 ? "" : "s"}.`
        : params.reason === "toapis_network_error"
          ? `ToAPIs Responses network request failed after ${attemptCount} attempt${attemptCount === 1 ? "" : "s"}.`
          : `ToAPIs Responses agent failed after ${attemptCount} attempt${attemptCount === 1 ? "" : "s"}.`
  };
}

function readResponseEnvelopeFailure(body: unknown): VideoResponsesEnvelopeError | undefined {
  const bodyRecord = body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : undefined;
  if (bodyRecord?.status !== "failed" && bodyRecord?.status !== "incomplete") {
    return undefined;
  }
  const nestedError = bodyRecord.error
    && typeof bodyRecord.error === "object"
    && !Array.isArray(bodyRecord.error)
    ? bodyRecord.error as Record<string, unknown>
    : undefined;
  const incompleteDetails = bodyRecord.incomplete_details
    && typeof bodyRecord.incomplete_details === "object"
    && !Array.isArray(bodyRecord.incomplete_details)
    ? bodyRecord.incomplete_details as Record<string, unknown>
    : undefined;
  const providerFailure = nestedError
    ? { ...nestedError }
    : {
        code: incompleteDetails?.reason,
        type: bodyRecord.status === "incomplete" ? "response_incomplete" : undefined
      };
  const message = typeof nestedError?.message === "string"
    ? nestedError.message
    : undefined;
  const errorMessage = message
    ? `ToAPIs Responses request failed: ${message}`
    : `ToAPIs Responses request returned a ${bodyRecord.status} response.`;
  return new VideoResponsesEnvelopeError(errorMessage, buildVideoAgentRequestFailure({
    reason: "toapis_agent_error",
    errorName: "VideoResponsesEnvelopeError",
    errorRecord: providerFailure
  }));
}

async function createResponse(
  payload: Record<string, unknown>,
  config: VideoAgentProviderConfig,
  maxAttempts = MAX_RESPONSE_ATTEMPTS
): Promise<ResponsesEnvelope> {
  let lastError: unknown;
  const requestAttempts = Math.max(1, Math.round(maxAttempts));
  // Serialize outside the provider transport retry boundary. A programming or
  // payload-construction bug must not be mislabeled as a provider outage.
  const requestBody = JSON.stringify(payload);
  for (let attempt = 0; attempt < requestAttempts; attempt += 1) {
    try {
      const response = await fetch(config.apiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: requestBody,
        cache: "no-store",
        signal: AbortSignal.timeout(config.timeoutMs)
      });
      const body = await response.json().catch(() => ({}));
      const contentPolicyError = readAgentContentPolicyError(body, response.status);
      if (contentPolicyError) throw contentPolicyError;
      if (response.ok) {
        const envelopeFailure = readResponseEnvelopeFailure(body);
        if (envelopeFailure) throw envelopeFailure;
        return body as ResponsesEnvelope;
      }
      const bodyRecord = body && typeof body === "object" && !Array.isArray(body)
        ? body as Record<string, unknown>
        : undefined;
      const nestedError = bodyRecord?.error
        && typeof bodyRecord.error === "object"
        && !Array.isArray(bodyRecord.error)
        ? bodyRecord.error as Record<string, unknown>
        : undefined;
      const providerFailure = {
        ...(nestedError ?? bodyRecord ?? {}),
        status: response.status
      };
      throw new VideoResponsesEnvelopeError(
        `ToAPIs Responses request failed: ${response.status} ${JSON.stringify(body)}`,
        buildVideoAgentRequestFailure({
          reason: "toapis_http_error",
          errorName: "VideoResponsesEnvelopeError",
          attemptCount: attempt + 1,
          errorRecord: providerFailure,
          statusCode: response.status
        })
      );
    } catch (error) {
      if (error instanceof AgentContentPolicyError) throw error;
      const providerError = error instanceof VideoResponsesEnvelopeError
        ? error
        : error instanceof TypeError
          ? new VideoResponsesEnvelopeError(error.message, buildVideoAgentRequestFailure({
              reason: "toapis_network_error",
              errorName: error.name,
              attemptCount: attempt + 1
            }))
          : error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
            ? new VideoResponsesEnvelopeError(error.message, buildVideoAgentRequestFailure({
                reason: "toapis_timeout",
                errorName: error.name,
                attemptCount: attempt + 1
              }))
            : error;
      if (!(providerError instanceof VideoResponsesEnvelopeError)) throw providerError;
      if (!providerError.retryable) throw providerError;
      lastError = providerError;
      if (attempt + 1 < requestAttempts) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("ToAPIs Responses request failed.");
}

async function judgeMissingVideoTool(params: {
  input: VideoAgentInput;
  reply: string;
  provider: VideoAgentProviderConfig;
  maxRequestAttempts: number;
}): Promise<MissingVideoToolDecision | undefined> {
  const response = await createResponse({
    model: params.provider.model,
    instructions: [
      "You are an internal state validator for a video-creation assistant.",
      "The main assistant finished a turn without calling a function. Decide whether the turn must create a video before it can be considered complete.",
      "Use semantic intent, not keywords or phrase matching.",
      "Return must_create when the user supplied an actionable video brief, requested a video creation or variation now, or attached usable references with an instruction that expects execution.",
      "Return clarify only when one genuinely necessary creative detail is missing and the assistant's reply asks for that detail.",
      "Return conversation only for discussion, capability questions, future-conditional requests, product questions, or other valid non-execution replies.",
      "The actual state is authoritative: no video creation tool was called. If the assistant reply says or implies that work started, was submitted, or was completed, the decision must be must_create.",
      "The semantic scope router already found execution intent when requires_video_operation is true. Treat that signal as authoritative unless the request genuinely requires clarification.",
      "Return exactly one JSON object and no other text: {\"decision\":\"conversation\"}, {\"decision\":\"clarify\"}, or {\"decision\":\"must_create\"}."
    ].join(" "),
    input: JSON.stringify({
      user_request: params.input.content,
      assistant_reply: params.reply,
      actual_state: {
        terminal_event: "conversation_done",
        video_creation_tool_called: false,
        source_use_case: params.input.sourceUseCase,
        current_reference_count: params.input.currentReferenceAssets.length,
        requested_duration_seconds: params.input.requestedDurationSeconds
      },
      request_signals: {
        requires_video_operation: true,
        current_turn_has_reference_assets: params.input.currentReferenceAssets.length > 0,
        session_has_video_jobs: params.input.sessionJobs.some(isVideoAgentJob)
      }
    })
  }, params.provider, params.maxRequestAttempts);
  return parseMissingVideoToolDecision(textFrom(response));
}

export async function routeVideoIntentAgent(
  input: VideoAgentInput,
  options: VideoAgentRouteOptions = {}
): Promise<VideoIntentDecision | null> {
  const config = options.provider ?? appConfig.toapisResponses;
  const contextStrategy = options.contextStrategy ?? "previous_response_id";
  const maxRequestAttempts = options.maxRequestAttempts ?? MAX_RESPONSE_ATTEMPTS;
  if (!config.enabled || !config.apiKey) return null;
  let clientHistory: Array<Record<string, unknown>> = [];
  let clientHistoryStarted = false;
  const requestResponse = async (payload: Record<string, unknown>) => {
    const nextInputItems = contextStrategy === "client_history"
      ? toVideoClientHistoryItems(payload.input)
      : [];
    const requestPayload = contextStrategy === "client_history"
      ? {
          ...payload,
          input: clientHistoryStarted
            ? [...clientHistory, ...nextInputItems]
            : payload.input
        }
      : payload;
    if (contextStrategy === "client_history") {
      delete requestPayload.previous_response_id;
    }
    const response = await createResponse(requestPayload, config, maxRequestAttempts);
    if (contextStrategy === "client_history") {
      clientHistory = [
        ...(clientHistoryStarted ? clientHistory : []),
        ...nextInputItems,
        ...((response.output ?? []) as Array<Record<string, unknown>>)
      ];
      clientHistoryStarted = true;
    }
    return response;
  };
  const usesPromoVideoScriptPlanner = isPromoVideoScriptPlanningSourceUseCase(input.sourceUseCase);
  const agentInstructions = instructions(
    input.responseLanguage,
    usesPromoVideoScriptPlanner ? input.sourceUseCase : undefined
  );
  const agentTools = buildVideoAgentTools(usesPromoVideoScriptPlanner);
  const scopeDecision = await classifyCreativeScope({
    content: input.content,
    previousResponseId: contextStrategy === "previous_response_id"
      ? input.previousResponseId
      : undefined,
    conversationContext: input.conversationContext,
    workspace: "video_generator",
    onDiagnostic: input.onScopeDiagnostic,
    provider: config
  });
  if (scopeDecision?.scope === "out_of_scope") {
    return { taskAction: "none", assistantReply: creativeScopeRedirect(input.responseLanguage) };
  }
  const availableReferenceAssetIds = new Set(
    (input.availableReferenceAssets ?? input.currentReferenceAssets).flatMap((asset) => (
    asset.assetId?.trim() ? [asset.assetId.trim()] : []
    ))
  );
  const initialRequest = {
    model: config.model,
    instructions: agentInstructions,
    ...(contextStrategy === "previous_response_id" && input.previousResponseId
      ? { previous_response_id: input.previousResponseId }
      : {}),
    input: buildInput(input),
    tools: agentTools,
    tool_choice: "auto"
  };
  let response = await requestResponse(initialRequest);
  for (let recovery = 0; recovery <= MAX_COMMAND_RECOVERIES; recovery += 1) {
    const commandCall = response.output?.find((item) => item.type === "function_call" && item.name === "create_video_generation" && item.call_id);
    const referenceSelectionCall = response.output?.find((item) => item.type === "function_call" && item.name === "update_video_reference_selection" && item.call_id);
    const handoffCall = response.output?.find((item) => item.type === "function_call" && item.name === "recommend_workspace" && item.call_id);
    const subscriptionCall = response.output?.find((item) => item.type === "function_call" && item.name === "recommend_video_subscription" && item.call_id);
    if (subscriptionCall?.call_id) {
      const args = parseArguments(subscriptionCall.arguments);
      const finalResponse = await requestResponse({
        model: config.model, instructions: agentInstructions, previous_response_id: response.id,
        input: [{ type: "function_call_output", call_id: subscriptionCall.call_id, output: JSON.stringify({ accepted: true, status: "video_subscription_ready" }) }], tools: agentTools, tool_choice: "auto"
      });
      return {
        taskAction: "none",
        assistantReply: readString(args.assistant_reply) || textFrom(finalResponse) || (input.responseLanguage.toLowerCase().startsWith("zh") ? "视频订阅可解锁无水印导出和更多生成额度。" : "A Video subscription unlocks watermark-free exports and more generation credits."),
        videoSubscriptionCta: { kind: "video_subscription", label: "Upgrade to Pro" },
        responseId: finalResponse.id ?? response.id
      };
    }
    if (handoffCall?.call_id) {
      const args = parseArguments(handoffCall.arguments);
      if (args.target !== "image_maker") return null;
      const finalResponse = await requestResponse({
        model: config.model, instructions: agentInstructions, previous_response_id: response.id,
        input: [{ type: "function_call_output", call_id: handoffCall.call_id, output: JSON.stringify({ accepted: true, status: "workspace_recommendation_ready" }) }], tools: agentTools, tool_choice: "auto"
      });
      return { taskAction: "none", assistantReply: readString(args.assistant_reply) || textFrom(finalResponse) || (input.responseLanguage.toLowerCase().startsWith("zh") ? "请使用 AI Image Maker 创建这张图片。" : "Use AI Image Maker to create that image."), workspaceCta: { target: "image_maker", href: "/ai-image-maker", label: "Image Generator" }, responseId: finalResponse.id ?? response.id };
    }
    if (commandCall?.call_id) {
      const args = parseArguments(commandCall.arguments);
      const referenceAssetIds = readVideoReferenceAssetIds(
        args.reference_asset_ids,
        availableReferenceAssetIds
      );
      const promoVideoScriptPlan = usesPromoVideoScriptPlanner
        ? normalizePromoVideoScriptPlan(args.video_script, {
            requestedDurationSeconds: input.requestedDurationSeconds
          })
        : null;
      const creativeDirection = readString(args.prompt) ?? input.content.trim();
      const prompt = usesPromoVideoScriptPlanner
        ? promoVideoScriptPlan
          ? compilePromoVideoScriptPrompt({
              plan: promoVideoScriptPlan,
              creativeDirection,
              sourceUseCase: input.sourceUseCase
            })
          : undefined
        : creativeDirection;
      const promptExceedsLimit = Boolean(
        usesPromoVideoScriptPlanner
        && prompt
        && prompt.length > PROMO_VIDEO_MAX_PROMPT_LENGTH
      );
      if (prompt && !promptExceedsLimit && referenceAssetIds) {
        const finalResponse = await requestResponse({
          model: config.model, instructions: agentInstructions, previous_response_id: response.id,
          input: [{ type: "function_call_output", call_id: commandCall.call_id, output: JSON.stringify({ accepted: true, status: "video_generation_request_received" }) }], tools: agentTools, tool_choice: "auto"
        });
        return {
          taskAction: "create_video",
          assistantReply: readString(args.assistant_reply) || textFrom(finalResponse) || (input.responseLanguage.toLowerCase().startsWith("zh") ? "我现在开始生成视频。" : "I’m starting the video now."),
          generationPrompt: prompt,
          referenceAssetIds,
          generationDurationSeconds: promoVideoScriptPlan?.durationSeconds,
          promoVideoScriptPlan: promoVideoScriptPlan ?? undefined,
          responseId: finalResponse.id ?? response.id
        };
      }
      if (recovery < MAX_COMMAND_RECOVERIES && response.id) {
        response = await requestResponse({
          model: config.model, instructions: agentInstructions, previous_response_id: response.id,
          input: [{
            type: "function_call_output",
            call_id: commandCall.call_id,
            output: JSON.stringify({
              accepted: false,
              error: referenceAssetIds === null
                ? "create_video_generation requires reference_asset_ids containing only exact IDs from request_context.available_reference_assets. Use an empty array when no reference applies."
                : promptExceedsLimit
                  ? `The compiled video prompt is ${prompt?.length ?? 0} characters, exceeding the ${PROMO_VIDEO_MAX_PROMPT_LENGTH}-character limit. Rewrite prompt and video_script more concisely, removing repetition but preserving every explicit user requirement, exact campaign copy, offer, product, brand, domain, audience, and staging constraint. Do not truncate the prompt.`
                : usesPromoVideoScriptPlanner
                  ? "MiniMax H3 video generation requires a valid video_script matching the requested duration."
                  : "create_video_generation requires a non-empty prompt"
            })
          }],
          tools: agentTools,
          tool_choice: "auto"
        });
        continue;
      }
      return null;
    }
    if (referenceSelectionCall?.call_id) {
      const args = parseArguments(referenceSelectionCall.arguments);
      const referenceAssetIds = readVideoReferenceAssetIds(
        args.reference_asset_ids,
        availableReferenceAssetIds
      );
      if (referenceAssetIds) {
        const finalResponse = await requestResponse({
          model: config.model,
          instructions: agentInstructions,
          previous_response_id: response.id,
          input: [{
            type: "function_call_output",
            call_id: referenceSelectionCall.call_id,
            output: JSON.stringify({ accepted: true, status: "video_reference_selection_updated" })
          }],
          tools: agentTools,
          tool_choice: "auto"
        });
        return {
          taskAction: "none",
          assistantReply: readString(args.assistant_reply)
            || textFrom(finalResponse)
            || (input.responseLanguage.toLowerCase().startsWith("zh") ? "已更新视频参考图。" : "Updated the video references."),
          referenceAssetIds,
          responseId: finalResponse.id ?? response.id
        };
      }
      if (recovery < MAX_COMMAND_RECOVERIES && response.id) {
        response = await requestResponse({
          model: config.model,
          instructions: agentInstructions,
          previous_response_id: response.id,
          input: [{
            type: "function_call_output",
            call_id: referenceSelectionCall.call_id,
            output: JSON.stringify({
              accepted: false,
              error: "update_video_reference_selection requires reference_asset_ids containing only exact IDs from request_context.available_reference_assets. Use an empty array to clear the selection."
            })
          }],
          tools: agentTools,
          tool_choice: "auto"
        });
        continue;
      }
      return null;
    }
    const reply = textFrom(response);
    if (!reply && recovery < MAX_COMMAND_RECOVERIES) {
      response = await requestResponse({
        model: config.model,
        instructions: agentInstructions,
        ...(response.id ? { previous_response_id: response.id } : {}),
        input: response.id
          ? "Your last response was empty. Complete this actionable video turn now. Call create_video_generation with one complete merged prompt, a valid video_script, the exact reference_asset_ids selection, and a concise assistant_reply. Preserve every earlier requirement that the user did not explicitly replace."
          : buildHistoryRecoveryInput(input),
        tools: agentTools,
        tool_choice: "auto"
      });
      continue;
    }
    if (reply && isUnrelatedTechnicalAgentReply(input.content, reply)) {
      return { taskAction: "none", assistantReply: creativeScopeRedirect(input.responseLanguage), responseId: response.id };
    }
    if (reply && scopeDecision?.requiresImageOperation) {
      const missingVideoToolDecision = await judgeMissingVideoTool({
        input,
        reply,
        provider: config,
        maxRequestAttempts
      });
      if (missingVideoToolDecision === "must_create") {
        if (recovery < MAX_COMMAND_RECOVERIES && response.id) {
          response = await requestResponse({
            model: config.model,
            instructions: agentInstructions,
            previous_response_id: response.id,
            input: "A state validator determined that this finished reply requires a video operation, but create_video_generation was not called. Correct the state now by calling create_video_generation with the complete actionable request. Do not send another user-facing status reply without the matching tool call.",
            tools: agentTools,
            tool_choice: "auto"
          });
          continue;
        }
        return null;
      }
      if (!missingVideoToolDecision) return null;
    }
    return reply ? { taskAction: "none", assistantReply: reply, responseId: response.id } : null;
  }
  return null;
}
