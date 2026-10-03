import type { ImageModelExperimentSnapshot, ImageModelExperimentVariant } from "./image-model-experiment";
import type { SocialmediaRequestedOutputSize } from "@/lib/socialmedia/output-size";

export const SOCIALMEDIA_WORKFLOW = "socialmedia" as const;
export const SOCIALMEDIA_INPUT_ASSETS_BUCKET = "socialmedia-input-assets" as const;
export const SOCIALMEDIA_GENERATED_ASSETS_BUCKET = "generated-assets" as const;
export const SOCIALMEDIA_VIDEO_ASSETS_BUCKET = "video-assets" as const;
export const SOCIALMEDIA_FEEDBACK_ASSETS_BUCKET = "socialmedia-feedback-assets" as const;

export type SocialmediaWorkflow = typeof SOCIALMEDIA_WORKFLOW;
export type SocialmediaInputAssetsBucket = typeof SOCIALMEDIA_INPUT_ASSETS_BUCKET;
export type SocialmediaGeneratedAssetsBucket = typeof SOCIALMEDIA_GENERATED_ASSETS_BUCKET;
export type SocialmediaVideoAssetsBucket = typeof SOCIALMEDIA_VIDEO_ASSETS_BUCKET;
export type SocialmediaFeedbackAssetsBucket = typeof SOCIALMEDIA_FEEDBACK_ASSETS_BUCKET;
export type SocialmediaImageAgentMode = "briefed" | "direct_multiturn";
export type SocialmediaBillingMode = "paid_hold" | "free_watermarked_hold" | "free_locked_preview" | "first_video_grant";
export type SocialmediaPreviewVariant = "watermarked" | "masked_blur" | "low_res_clean";

export type SocialPlatform = "instagram" | "x";
export type SocialmediaDestination =
  | "auto"
  | "product_listing"
  | "website_hero"
  | "social_ad"
  | SocialPlatform
  | "story_reel_cover"
  | "custom";
export type SocialmediaJobMode = "generate" | "revise";
export type SocialmediaMessageRole = "user" | "assistant" | "system";
export type SocialmediaMessageIntent = "chat" | "generate" | "revise" | "clarify" | "upload";
export type SocialmediaLanguageCode = string;
export type SocialmediaImageCount = "auto" | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type SocialmediaAspectRatio =
  | "auto"
  | "1:1"
  | "3:2"
  | "2:3"
  | "4:3"
  | "3:4"
  | "5:4"
  | "4:5"
  | "16:9"
  | "9:16"
  | "2:1"
  | "1:2"
  | "21:9"
  | "9:21";
export type SocialmediaResolution = "1k" | "2k" | "4k";
export type SocialmediaOutputFormat = "png" | "jpeg";
export type SocialmediaBackground = "auto" | "transparent";
export type SocialmediaImageAction = "generate" | "edit";
export type SocialmediaResultAction = "variant" | "resize" | "placement_preview" | "upgrade_4k";
export type SocialmediaImageAccessPlan = "free" | "basic" | "pro" | "max";
export type SocialmediaPendingImageTaskStatus = "submitted" | "polling" | "completed" | "failed";
export type SocialmediaPendingVideoKeyframeTaskStatus = "submitted" | "polling" | "completed" | "failed";
export type SocialmediaPendingVideoTaskStatus = "submitted" | "polling" | "completed" | "failed";
export const IMAGE_PROVIDER_GENERATING_STAGE = "image_provider_generating" as const;
export const IMAGE_PROVIDER_COMPLETED_STAGE = "image_provider_completed" as const;

export function isImageProviderGeneratingStage(stage: string): boolean {
  return stage === IMAGE_PROVIDER_GENERATING_STAGE || stage === "vectorengine_generating";
}

export function isImageProviderCompletedStage(stage: string): boolean {
  return stage === IMAGE_PROVIDER_COMPLETED_STAGE || stage === "vectorengine_completed";
}

export type SocialmediaJobStage =
  | "queued"
  | "preparing"
  | "briefing"
  | "generating_images"
  | "generating_videos"
  | "submitting_video"
  | "apimart_polling"
  | "apimart_video_keyframe_polling"
  | "apimart_video_polling"
  | typeof IMAGE_PROVIDER_GENERATING_STAGE
  | typeof IMAGE_PROVIDER_COMPLETED_STAGE
  // Legacy persisted stages retained so in-flight jobs survive the rename.
  | "vectorengine_generating"
  | "vectorengine_completed"
  | "persisting_assets"
  | "finalizing_video"
  | "completed"
  | "failed";

export type SocialmediaSourceAssetRole =
  | "reference_image"
  | "product_image"
  | "screenshot"
  | "logo"
  | "brand_asset"
  | "other";

export interface SocialmediaStorageObject {
  bucket: string;
  path?: string;
  url?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
}

export interface SocialmediaSourceAsset extends SocialmediaStorageObject {
  assetId?: string;
  /** Original crawled image URL, retained when a web GIF is materialized as JPEG. */
  webSourceUrl?: string;
  bucket: SocialmediaInputAssetsBucket;
  role: SocialmediaSourceAssetRole;
  originalName?: string;
  summary?: string;
}

export interface SocialmediaTargetAsset extends SocialmediaStorageObject {
  assetId: string;
  bucket: SocialmediaGeneratedAssetsBucket;
  imageIndex?: number;
  parentJobId?: string;
}

export interface SocialmediaGeneratedImage extends SocialmediaStorageObject {
  assetId: string;
  bucket: SocialmediaGeneratedAssetsBucket;
  imageIndex: number;
  originalSizeBytes?: number;
  parentAssetId?: string | null;
  accessVariant?: "original" | "watermarked";
  previewVariant?: SocialmediaPreviewVariant;
  watermarkBrand?: string;
  promptSummary?: string;
  provider?: string;
  model?: string;
  quality?: string;
  aspectRatio?: SocialmediaAspectRatio | string;
  resolution?: SocialmediaResolution;
  outputFormat?: SocialmediaOutputFormat;
}

export interface SocialmediaPlatformSpec {
  platform: SocialPlatform;
  aspectRatio: SocialmediaAspectRatio;
  resolution: SocialmediaResolution;
  size: string;
  requestedOutputSize?: SocialmediaRequestedOutputSize;
  outputFormat: SocialmediaOutputFormat;
  quality: string;
}

export interface SocialmediaSharedContext {
  sourceSummary: string;
  brandOrSubject?: string;
  audience?: string;
  language: SocialmediaLanguageCode;
  platform: SocialPlatform;
  mustKeep: string[];
  mustAvoid: string[];
  styleDirection?: string;
}

export interface SocialmediaImageBrief {
  index: number;
  action: SocialmediaImageAction;
  instruction: string;
  textOverlay?: string;
  composition?: string;
  referenceAssetIds: string[];
  targetAssetId?: string;
  preserve?: string[];
  change?: string[];
}

export interface SocialmediaVisualBrief {
  action: SocialmediaImageAction;
  sharedContext: SocialmediaSharedContext;
  spec: SocialmediaPlatformSpec;
  imageBriefs: SocialmediaImageBrief[];
  uiSummary?: string;
  compileSource?: "llm" | "fallback" | "agent";
  fallbackReason?: "llm_timeout_or_empty";
}

export interface SocialmediaAgentOutputInstruction {
  label: string;
  prompt: string;
  /** Optional per-output revision target used by V2 full-set edits. */
  targetAssetId?: string;
  /** V2-only historical generated visual base paired to this exact output target. */
  sourceGeneratedAssetId?: string;
  /** Server-verified references for this output; omitted by legacy/V1 callers. */
  referenceAssetIds?: string[];
}

export interface SocialmediaPendingImageTask {
  experimentModel?: ImageModelExperimentVariant;
  maskUrl?: string;
  imageIndex: number;
  action: SocialmediaImageAction;
  taskId: string;
  provider: string;
  model: string;
  prompt: string;
  visibleTextLanguage?: SocialmediaLanguageCode;
  promptSummary?: string;
  imageUrls?: string[];
  referenceAspectRatio?: SocialmediaAspectRatio;
  aspectRatio: SocialmediaAspectRatio | string;
  resolution?: SocialmediaResolution;
  quality?: string;
  outputFormat?: SocialmediaOutputFormat;
  background?: SocialmediaBackground;
  width?: number;
  height?: number;
  exactSizeRequested?: boolean;
  restoreSourceDimensions?: boolean;
  resizeMode?: "fill" | "cover";
  submittedAt: string;
  firstPollAfter: string;
  lastPolledAt?: string;
  pollAttempts: number;
  status: SocialmediaPendingImageTaskStatus;
  mode: SocialmediaImageAgentMode;
  safetyRewriteCount?: number;
  allowDroppingReferenceImages?: boolean;
  referenceImageCount?: number;
  lastError?: string;
  generatedImageUrls?: string[];
  fallbackSourceTaskId?: string;
  fallbackSourceProvider?: string;
  fallbackSourceError?: string;
  fallbackSourceStatusCode?: number;
}

export interface SocialmediaGeneratedVideo extends SocialmediaStorageObject {
  assetId: string;
  bucket: SocialmediaVideoAssetsBucket | SocialmediaGeneratedAssetsBucket | "external-video";
  videoIndex: number;
  accessVariant?: "original" | "watermarked";
  requestedAccessVariant?: "original" | "watermarked";
  watermarkBrand?: string;
  watermarkStatus?: "applied" | "not_required" | "failed_original_fallback";
  watermarkError?: string;
  firstFrameAssetId?: string;
  firstFrameUrl?: string;
  firstFramePath?: string;
  thumbnailUrl?: string;
  duration?: number;
  promptSummary?: string;
  model?: string;
  provider?: string;
  quality?: string;
}

export interface SocialmediaPendingVideoTask {
  videoIndex: number;
  taskId: string;
  provider: string;
  model: string;
  prompt: string;
  promptSummary?: string;
  imageUrls?: string[];
  imageWithRoles?: Array<{ url: string; role: "first_frame" | "last_frame" | "reference" | "reference_image" }>;
  videoUrls?: string[];
  audioUrls?: string[];
  audioEnabled?: boolean;
  size?: string;
  duration?: number;
  quality?: string;
  submittedAt: string;
  firstPollAfter: string;
  lastPolledAt?: string;
  pollAttempts: number;
  status: SocialmediaPendingVideoTaskStatus;
  lastError?: string;
  lastPersistenceAttemptAt?: string;
  persistenceAttempts?: number;
  lockContentionAttempts?: number;
  lockContentionStartedAt?: string;
  recoveredFromFailedPersistence?: boolean;
  generatedVideos?: SocialmediaGeneratedVideo[];
  fallbackSubmissionAttemptedAt?: string;
  fallbackSourceTaskId?: string;
  fallbackSourceProvider?: string;
  fallbackSourceError?: string;
}

export interface SocialmediaPendingVideoKeyframeTask {
  keyframeIndex: number;
  role: "first_frame" | "last_frame";
  taskId: string;
  provider: string;
  model: string;
  prompt: string;
  promptSummary?: string;
  imageUrls?: string[];
  aspectRatio: SocialmediaAspectRatio | string;
  resolution?: SocialmediaResolution;
  quality?: string;
  submittedAt: string;
  firstPollAfter: string;
  lastPolledAt?: string;
  pollAttempts: number;
  status: SocialmediaPendingVideoKeyframeTaskStatus;
  lastError?: string;
  generatedImageUrls?: string[];
  storageAssetId?: string;
  storageBucket?: SocialmediaGeneratedAssetsBucket;
  storagePath?: string;
  storageUrl?: string;
  storageMimeType?: string;
  storageSizeBytes?: number;
  storageWidth?: number;
  storageHeight?: number;
}


export interface SocialmediaJobRequest {
  mode: SocialmediaJobMode;
  inputText: string;
  platform: SocialPlatform;
  imageCount: SocialmediaImageCount;
  language: SocialmediaLanguageCode;
  resolution: SocialmediaResolution;
  sessionId?: string;
  parentJobId?: string;
  sourceAssets?: SocialmediaSourceAsset[];
  targetAssets?: SocialmediaTargetAsset[];
}

export interface SocialmediaMessage {
  id: string;
  sessionId: string;
  userId: string;
  role: SocialmediaMessageRole;
  content: string;
  intent: SocialmediaMessageIntent;
  jobId?: string | null;
  sourceAssets?: SocialmediaSourceAsset[];
  targetAssets?: SocialmediaTargetAsset[];
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface SocialmediaMessageRequest {
  sessionId?: string;
  parentJobId?: string;
  content: string;
  platform: SocialPlatform;
  imageCount: SocialmediaImageCount;
  language: SocialmediaLanguageCode;
  resolution: SocialmediaResolution;
  sourceAssets?: SocialmediaSourceAsset[];
  targetAssets?: SocialmediaTargetAsset[];
}

export interface SocialmediaMessageResponse {
  sessionId: string;
  message: SocialmediaMessage;
  assistantMessage?: SocialmediaMessage;
  intent: SocialmediaMessageIntent;
  job?: SocialmediaCreateJobResponse;
}

export interface SocialmediaJobPayload {
  workflow: SocialmediaWorkflow;
  socialmedia: {
    mode: SocialmediaJobMode;
    sourceUseCase?: string;
    outputType?: string;
    videoModel?: string;
    videoDuration?: number;
    videoResolution?: string;
    videoSize?: string;
    /** V3-only upstream audio policy; absent on all legacy V1 jobs. */
    videoAudioEnabled?: boolean;
    promoVideoScriptPlan?: {
      durationSeconds: number;
      referenceAnalysis?: {
        subjectSummary: string;
        visualStyle: string;
        composition: string;
        protectedElements: string[];
      };
      beats: Array<{
        startSeconds: number;
        endSeconds: number;
        framing: string;
        camera: string;
        action: string;
        effects?: string;
      }>;
      audio?: string;
      constraints: string[];
    };
    inputText: string;
    platform: SocialPlatform;
    destination?: SocialmediaDestination;
    aspectRatio?: SocialmediaAspectRatio;
    requestedOutputSize?: SocialmediaRequestedOutputSize;
    imageCount: SocialmediaImageCount;
    language: SocialmediaLanguageCode;
    resolution: SocialmediaResolution;
    outputFormat?: SocialmediaOutputFormat;
    background?: SocialmediaBackground;
    billingResolution?: SocialmediaResolution;
    imageQuality?: "low" | "medium" | "high";
    billingQuality?: "low" | "medium" | "high";
    requestedResolution?: SocialmediaResolution;
    /** Server-owned auto-resolution content evidence, before provider quality normalization. */
    autoTextHeavy?: boolean;
    generationQualityExperimentKey?: string;
    generationQualityExperimentVariant?: string;
    generationQualityExperimentSource?: string;
    generationQualityExperimentId?: string;
    /** Server-owned assignment frozen at job creation, including for retries. */
    imageModelExperiment?: ImageModelExperimentSnapshot;
    generationResolutionExperimentKey?: string;
    generationResolutionExperimentVariant?: string;
    generationResolutionExperimentSource?: string;
    sourceAssets: SocialmediaSourceAsset[];
    userSourceAssets?: SocialmediaSourceAsset[];
    targetAssets: SocialmediaTargetAsset[];
    attributionSnapshot?: unknown;
    parentJobId?: string;
    /** V2 Image Builder set semantics; absent for Legacy jobs. */
    imageBuilderSetRelationship?: "new_independent" | "same_set_remaining" | "same_set_full";
    /** Server-owned; never accepted from a client or inferred from prompt text. */
    imagePromptMode?: "first_create_original";
    /** Visuals-owned natural-language state persisted for the next Visuals turn. */
    visualTaskSummary?: string;
    /** Server-owned V4 feedback/checkpoint state; never supplied by the client. */
    imageBuilderPlanningFeedback?: {
      disposition:
        | "none"
        | "approve_current"
        | "targeted_revision"
        | "approve_current_with_revision"
        | "global_rejection";
      targetJobId: string | null;
      /** Added after initial V4 rollout; absent on historical Jobs means unknown. */
      targetAssetId?: string | null;
      approvedCheckpointJobId: string | null;
      /** Added after initial V4 rollout; absent on historical Jobs means all legacy outputs. */
      approvedCheckpointAssetId?: string | null;
      globalRejectionStreak: number;
      /** Added after initial V4 rollout; absent on historical Jobs means false. */
      resetFeedbackState?: boolean;
    };
    resultAction?: SocialmediaResultAction;
    imageAgentMode?: SocialmediaImageAgentMode;
    agentRequest?: boolean;
    /** Historical recovery count: still prevents a second handoff. */
    pipelineSafetyAgentV3RetryCount?: number;
    /** Historical one-shot V4 replan marker; retained only for persisted-Job compatibility. */
    pipelineSafetyAgentV4RetryCount?: number;
    /** Independent Video Builder V3 execution contract; absent for V1. */
    videoBuilderV3Mode?: "t2va" | "i2va" | "fl2va" | "l2va" | "ref2va";
    /** Server-resolved V3 inputs persisted independently of legacy source-asset inference. */
    videoBuilderV3References?: Array<{
      assetId: string;
      url: string;
      mediaType: "image" | "video" | "audio";
      role: "first_frame" | "last_frame" | "reference_image" | "reference_video" | "reference_audio";
    }>;
    videoTaskSummary?: string;
    selectedReferenceAssetIds?: string[];
    directContext?: {
      safetyCorrectedPrompt?: string;
      turns: Array<{
        index: number;
        role?: SocialmediaMessageRole;
        prompt: string;
        rawPrompt?: string;
        wasSafetyRejected?: boolean;
        safetyReason?: string;
      }>;
    };
    brief?: SocialmediaVisualBrief;
    submitIdempotencyKey?: string;
    /** First accepted image-provider submission for stable client-side render timing. */
    renderStartedAt?: string;
    pendingImageTasks?: SocialmediaPendingImageTask[];
    pendingVideoKeyframeTasks?: SocialmediaPendingVideoKeyframeTask[];
    pendingVideoTask?: SocialmediaPendingVideoTask;
    failureKind?: "agent_safety_response";
    billingMode?: SocialmediaBillingMode;
    billingHold?: {
      ownerUserId?: string;
      creditsPerImage: number;
      creditsPerSecond?: number;
      totalCredits: number;
      imageCount: number;
      durationSeconds?: number;
      costKey: string;
    };
    telemetry?: {
      traceId?: string;
      clientSessionId?: string;
      requestId?: string;
      ui_version?: "2.0";
      agentVersionExperimentKey?: string;
      agentVersionExperimentId?: string;
      agentVersionExperimentVariant?: string;
      agentVersionExperimentSource?: string;
      agentVersionSessionLocked?: boolean;
      agentVersionEmergencyRollback?: boolean;
      agentRuntimeVersion?: "v1" | "v2" | "v3" | "v4";
      imageBuilderRequestedRuntime?: "v2" | "v3" | "v4";
      imageBuilderExecutedRuntime?: "v2" | "v3" | "v4";
      imageBuilderMode?: "disabled" | "shadow" | "active";
      imageBuilderFallbackKind?: "configuration" | "transport" | "semantic" | "unknown";
      imageBuilderRequestedProvider?: "openai" | "openrouter" | "apimart";
      imageBuilderExecutedProvider?: "openai" | "openrouter" | "apimart";
      imageBuilderProviderFallbackKind?: "configuration" | "transport";
      imageBuilderProviderFallbackStatus?: "success" | "failed" | "deadline_exhausted";
    };
  };
}

export interface SocialmediaResultWarning {
  imageIndex?: number;
  videoIndex?: number;
  code: string;
  message: string;
}

export interface SocialmediaReusableContext {
  sourceSummary: string;
  brandOrSubject?: string;
  styleDirection?: string;
  platform: SocialPlatform;
  language: SocialmediaLanguageCode;
  resolution?: SocialmediaResolution;
}

export interface SocialmediaJobResult {
  kind: "socialmedia_image_generation" | "socialmedia_video_generation";
  socialmedia: {
    platform: SocialPlatform;
    language: SocialmediaLanguageCode;
    resolution?: SocialmediaResolution;
    imageCount: number;
    briefSummary?: string;
    brief?: SocialmediaVisualBrief;
    reusableContext?: SocialmediaReusableContext;
    images: SocialmediaGeneratedImage[];
    videos?: SocialmediaGeneratedVideo[];
    warnings: SocialmediaResultWarning[];
    billing?: {
      creditsPerImage: number;
      creditsPerSecond?: number;
      totalCredits: number;
      heldCredits?: number;
      refundedCredits?: number;
      imageCount: number;
      durationSeconds?: number;
      costKey: string;
      mode?: SocialmediaBillingMode;
    };
  };
}

export interface SocialmediaCreateJobResponse {
  jobId: string;
  sessionId: string;
  status: "queued";
  statusUrl: string;
}
