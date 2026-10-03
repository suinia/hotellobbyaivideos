import { BABY_SHOWER_INVITATION_CONSTRAINT } from "./baby-shower-invitation-guidance";
import { PLAYLIST_COVER_CONSTRAINT } from "./playlist-cover-guidance";
import { VISION_BOARD_CONSTRAINT } from "./vision-board-guidance";
import { POSTER_DESIGN_GUIDANCE, POSTER_READINESS_GUIDANCE } from "./poster-guidance";
import { appConfig } from "@/lib/config";
import type { AgentIntentRoute } from "@/lib/agent/dialogue-types";
import type { JobRecord } from "@/lib/types/job";
import type {
  SocialmediaAspectRatio,
  SocialmediaAgentOutputInstruction,
  SocialmediaBackground,
  SocialmediaGeneratedImage,
  SocialmediaImageCount,
  SocialmediaJobResult,
  SocialmediaOutputFormat,
  SocialmediaResolution
} from "@/lib/socialmedia/types";
import type { DirectMultiturnConversationTurn } from "@/lib/socialmedia/direct-multiturn-context";
import type { SocialmediaRequestedOutputSize } from "@/lib/socialmedia/output-size";
import { SOCIALMEDIA_IMAGE_GENERATION_CAPABILITIES } from "@/lib/socialmedia/image-generation-capabilities";
import {
  AgentContentPolicyError,
  isAgentContentPolicyErrorMessage,
  isRetryableAgentProviderFailure,
  readAgentProviderStatusCode,
  normalizeAgentProviderErrorField
} from "@/lib/socialmedia/agent-error-policy";
import {
  classifyCreativeScope,
  creativeScopeRedirect,
  isUnrelatedTechnicalAgentReply,
  type CreativeScopeDiagnostic,
  type CreativeScopeProviderConfig
} from "@/lib/socialmedia/creative-scope";

const MAX_TOOL_ROUNDS = 6;
const MAX_RESPONSE_HTTP_ATTEMPTS = 3;
const MAX_RESPONSE_NETWORK_ATTEMPTS = 2;
const RESPONSE_RETRY_BASE_DELAY_MS = 400;
const MAX_EMPTY_RESPONSE_RECOVERIES = 1;
const MAX_MISSING_CREATION_STATE_RECOVERIES = 1;
const MAX_MISSING_MUTATION_TOOL_RECOVERIES = 1;
const MAX_LEAKED_COMMAND_JSON_RECOVERIES = 1;
const MAX_MISSING_SUBSCRIPTION_QUERY_RECOVERIES = 1;
const MAX_AGENT_INPUT_IMAGES = 16;
const ASPECT_RATIOS = new Set<SocialmediaAspectRatio>(SOCIALMEDIA_IMAGE_GENERATION_CAPABILITIES.aspectRatios);
const STANDALONE_ASPECT_RATIOS = [...ASPECT_RATIOS].filter((aspectRatio) => aspectRatio !== "auto");
const RESOLUTIONS = new Set<SocialmediaResolution>(SOCIALMEDIA_IMAGE_GENERATION_CAPABILITIES.resolutions);
const IMAGE_COUNTS = new Set<SocialmediaImageCount>(SOCIALMEDIA_IMAGE_GENERATION_CAPABILITIES.imageCounts);
const OUTPUT_FORMATS = new Set<SocialmediaOutputFormat>(SOCIALMEDIA_IMAGE_GENERATION_CAPABILITIES.outputFormats);

export type ToapisAgentRequestFailure = {
  reason:
    | "toapis_http_error"
    | "toapis_timeout"
    | "toapis_stream_error"
    | "toapis_network_error"
    | "toapis_agent_error";
  statusCode?: number;
  providerCode?: string;
  providerType?: string;
  previousResponseUnavailable?: boolean;
  attemptCount: number;
  retryable: boolean;
  errorName: string;
  safeMessage: string;
};

type ResponsesOutputItem = {
  type?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: Array<{ type?: string; text?: string }>;
};

type ResponsesEnvelope = {
  id?: string;
  status?: string;
  incomplete_details?: {
    reason?: string;
  };
  error?: {
    code?: string;
    type?: string;
    message?: string;
    status_code?: number | string;
    statusCode?: number | string;
    status?: number | string;
  };
  output?: ResponsesOutputItem[];
  output_text?: string;
};

type ResponsesAgentProviderConfig = CreativeScopeProviderConfig & {
  enabled: boolean;
};

export type ResponsesAgentRouteOptions = {
  provider?: ResponsesAgentProviderConfig;
  contextStrategy?: "previous_response_id" | "client_history";
  maxRequestAttempts?: number;
  onMetrics?: (metrics: {
    logicalRequestCount: number;
    httpAttemptCount: number;
    correctionCount: number;
    durationMs: number;
  }) => void;
};

type MissingCreationToolDecision = "conversation" | "clarify" | "must_create";
type HistoricalMaterialHandoffDecision = {
  decision: "continue_multi" | "new_request";
  expectedOutputCount?: SocialmediaImageCount;
};

export type ToapisSubscriptionPlan = {
  packageId: string;
  plan: string;
  title: string;
  name: string;
  usdAmount: number;
  currency: "USD";
  interval?: "month" | "year";
  credits: number;
  description: string;
  note: string;
  features: string[];
  featured?: boolean;
  label?: string;
};

export type ToapisSubscriptionPlanCatalog = {
  pricingVariant: string;
  currentPlan?: string;
  plans: ToapisSubscriptionPlan[];
  pricingUrl: string;
};

type SessionAsset = {
  jobId: string;
  assetId: string;
  imageIndex: number;
  accessVariant?: "original" | "watermarked";
  url?: string;
};

export type ToapisSelectedTargetAsset = {
  targetJobId: string;
  targetAssetId: string;
  imageIndex?: number;
};

type GenerateCommand = {
  kind: "generate";
  prompt: string;
  referenceAssetIds: string[];
  sessionTitle?: string;
  aspectRatio?: SocialmediaAspectRatio;
  resolution?: SocialmediaResolution;
  imageCount?: SocialmediaImageCount;
  outputFormat?: SocialmediaOutputFormat;
  background?: SocialmediaBackground;
  imageQuality?: "low" | "medium";
  assistantReply?: string;
};

type ReviseCommand = {
  kind: "revise";
  prompt: string;
  targetJobId: string;
  targetAssetId: string;
  referenceAssetIds: string[];
  aspectRatio?: SocialmediaAspectRatio;
  resolution?: SocialmediaResolution;
  imageCount?: SocialmediaImageCount;
  outputFormat?: SocialmediaOutputFormat;
  background?: SocialmediaBackground;
  imageQuality?: "low" | "medium";
  assistantReply?: string;
};

type MultiOutputRevisionCommand = {
  kind: "revise_outputs";
  targetJobId: string;
  targetAssetId: string;
  referenceAssetIds: string[];
  outputs: SocialmediaAgentOutputInstruction[];
  aspectRatio?: SocialmediaAspectRatio;
  resolution?: SocialmediaResolution;
  outputFormat?: SocialmediaOutputFormat;
  background?: SocialmediaBackground;
  imageQuality?: "low" | "medium";
  assistantReply?: string;
};

type MultiOutputGenerationCommand = {
  kind: "generate_outputs";
  outputs: SocialmediaAgentOutputInstruction[];
  referenceAssetIds: string[];
  sessionTitle?: string;
  aspectRatio?: SocialmediaAspectRatio;
  resolution?: SocialmediaResolution;
  outputFormat?: SocialmediaOutputFormat;
  background?: SocialmediaBackground;
  imageQuality?: "low" | "medium";
  assistantReply?: string;
};

type AgentCommand = GenerateCommand | ReviseCommand | MultiOutputGenerationCommand | MultiOutputRevisionCommand;

type WorkspaceHandoffTarget = "video_generator";

export type ToapisWorkspaceCta = {
  target: WorkspaceHandoffTarget;
  href: string;
  label: string;
};

export type ToapisWatermarkUpgradeCta = {
  kind: "watermark_upgrade";
  targetJobId: string;
  targetAssetId: string;
  label: string;
};

export type ToapisSubscriptionPlansCta = {
  kind: "subscription_plans";
  label: string;
};

type WorkspaceHandoffCommand = {
  assistantReply?: string;
  cta: ToapisWorkspaceCta;
};

type WatermarkUpgradeCommand = {
  assistantReply?: string;
  targetJobId: string;
  targetAssetId: string;
};

type AgentWorkspaceContext = {
  sourceUseCase?: string;
  name: string;
  specialty: string;
  isGeneralImageMaker: boolean;
};

export type ToapisImageIntentDecision = {
  intentRoute: AgentIntentRoute;
  assistantReply: string;
  requiresImageOperation?: boolean;
  sessionTitle?: string;
  workspaceCta?: ToapisWorkspaceCta;
  watermarkUpgradeCta?: ToapisWatermarkUpgradeCta;
  subscriptionPlansCta?: ToapisSubscriptionPlansCta;
  generationPrompt?: string;
  targetJobId?: string;
  targetAssetId?: string;
  aspectRatio?: SocialmediaAspectRatio;
  resolution?: SocialmediaResolution;
  requestedOutputSize?: SocialmediaRequestedOutputSize;
  imageCount?: SocialmediaImageCount;
  outputFormat?: SocialmediaOutputFormat;
  background?: SocialmediaBackground;
  imageQuality?: "low" | "medium";
  outputInstructions?: SocialmediaAgentOutputInstruction[];
  referenceAssetIds?: string[];
  responseId?: string;
};

type AgentGenerationParameters = {
  aspectRatio: SocialmediaAspectRatio;
  resolution: SocialmediaResolution;
  imageCount: SocialmediaImageCount;
  outputFormat: SocialmediaOutputFormat;
  requestedOutputSize?: SocialmediaRequestedOutputSize;
};

type AgentInput = {
  sessionId: string;
  previousResponseId?: string;
  content: string;
  safetyFollowupPrompt?: string;
  safetyFollowupAction?: "create" | "edit";
  conversationContext?: DirectMultiturnConversationTurn[];
  responseLanguage: string;
  sessionJobs: JobRecord[];
  /**
   * The one-time Pipeline -> Agent handoff can supply a deliberately bounded
   * history. Agent continuations rely on previous_response_id instead.
   */
  historySessionJobs?: JobRecord[];
  includeSessionHistory?: boolean;
  currentHasReferenceAssets: boolean;
  currentReferenceAssets?: Array<{
    assetId?: string;
    url: string;
    originalName?: string;
  }>;
  availableReferenceAssets?: Array<{
    assetId: string;
    url: string;
    originalName?: string;
  }>;
  pinnedReferenceAssets?: Array<{
    assetId: string;
    originalName?: string;
  }>;
  blockedReferenceAssets?: Array<{
    assetId: string;
    originalName?: string;
  }>;
  bootstrapReferenceAssets?: Array<{
    assetId?: string;
    url: string;
    originalName?: string;
    label?: string;
  }>;
  currentGenerationParameters?: AgentGenerationParameters;
  requestedOutputSize?: SocialmediaRequestedOutputSize;
  currentTargetAssets?: ToapisSelectedTargetAsset[];
  explicitParentJobId?: string;
  sourceUseCase?: string;
  loadSubscriptionPlans?: () => Promise<ToapisSubscriptionPlanCatalog>;
  onScopeDiagnostic?: (diagnostic: CreativeScopeDiagnostic) => void;
  onAssistantDelta?: (delta: string) => void;
  onAssistantReset?: () => void;
};

const tools = [
  {
    type: "function",
    name: "query_session_assets",
    description: "Read the generated image assets in the current session. Use when the user refers to an earlier image, version, ordinal image, or current result.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "query_subscription_plans",
    description: "Read the exact subscription plans currently available to this user under their assigned pricing experiment. Call this before answering questions about available plans, subscription prices, billing intervals, included credits, plan comparisons, or which plan the user can subscribe to. Never answer those details from memory.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "create_image_generation",
    description: "Create a new image generation job. Also use this for a direct edit of a reference image uploaded in the current turn. Call only when the user wants the image operation to start now and the request is actionable.",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "A short, direct expression of the user's intent. When the attached design is the edit target, say so explicitly, preserve its non-conflicting content and layout, and state only the requested change; never reduce it to style inspiration. From a content source, bring in only the subject, identity, or content the request depends on—not its unrelated background, layout, or copy. From a style source, transfer only requested visual qualities. Because the image model also receives selected references, refer to their content semantically instead of transcribing it. Do not add unrequested details or prompt-engineering prose." },
        reference_asset_ids: {
          type: "array",
          items: { type: "string" },
          maxItems: MAX_AGENT_INPUT_IMAGES,
          description: "Exact uploaded-reference asset IDs from request_context.available_reference_assets to use for this job. Return an empty array when no uploaded reference should be used."
        },
        aspect_ratio: { type: "string", enum: [...ASPECT_RATIOS] },
        resolution: { type: "string", enum: [...RESOLUTIONS], description: "Actual output resolution. Set this whenever the user explicitly requests 1K, 2K, 4K, or equivalent exact pixel dimensions." },
        force_single_output: { type: "boolean", description: "Set true only when the latest user text explicitly requests exactly one output and this must override a different numeric count selected in the input controls." },
        output_format: { type: "string", enum: [...OUTPUT_FORMATS], description: "Set only when the user explicitly asks to change the file format." },
        background: { type: "string", enum: ["transparent"], description: "Set to transparent only when the user explicitly requests transparency, no background, or background removal." },
        generation_quality: { type: "string", enum: ["low", "medium"], description: "Internal generation-quality decision based on the final canvas. Use medium when the result contains substantial visible text such as multiple text blocks, body copy, lists, prices, dates, addresses, contact details, or other exact-copy-heavy content. Use low for primarily visual results with no visible text or only minimal short copy. Judge the complete resulting image, including text preserved from an edit target, not just the latest user message. When uncertain, use medium." },
        session_title: { type: "string", description: "Concise name for this new session, 20 characters or fewer. Describe the user's overall creative goal, not a revision detail." },
        assistant_reply: { type: "string", description: "Short message shown while the job starts." }
      },
      required: ["prompt", "reference_asset_ids", "generation_quality", "session_title", "assistant_reply"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "create_image_revision",
    description: "Create a revision of one exact generated image. Use an exact selected target from request_context when present; otherwise query session assets and use only an asset returned there.",
    parameters: {
      type: "object",
      properties: {
        target_job_id: { type: "string" },
        target_asset_id: { type: "string" },
        reference_asset_ids: {
          type: "array",
          items: { type: "string" },
          maxItems: MAX_AGENT_INPUT_IMAGES,
          description: "Exact uploaded-reference asset IDs from request_context.available_reference_assets to use in addition to the target image. Return an empty array when the target image alone is sufficient."
        },
        prompt: { type: "string", description: "A short, direct statement of the user's requested change. Preserve non-conflicting content in the edit target. From each additional content source, use only what the request depends on; from each style source, use only requested visual qualities. Refer to selected references semantically instead of transcribing them. Do not add unrequested details or prompt-engineering prose." },
        aspect_ratio: { type: "string", enum: [...ASPECT_RATIOS] },
        resolution: { type: "string", enum: [...RESOLUTIONS], description: "Actual output resolution. Set this whenever the user explicitly requests 1K, 2K, 4K, or equivalent exact pixel dimensions." },
        force_single_output: { type: "boolean", description: "Set true only when the latest user text explicitly requests exactly one output and this must override a different numeric count selected in the input controls." },
        output_format: { type: "string", enum: [...OUTPUT_FORMATS], description: "Set only when the user explicitly asks to change the file format." },
        background: { type: "string", enum: ["transparent"], description: "Set to transparent only when the user explicitly requests transparency, no background, or background removal." },
        generation_quality: { type: "string", enum: ["low", "medium"], description: "Internal generation-quality decision based on the complete edited canvas. Use medium for substantial visible text or exact-copy-heavy content; use low for no visible text or only minimal short copy. Include text preserved from the target when judging. When uncertain, use medium." },
        assistant_reply: { type: "string", description: "Short message shown while the revision starts." }
      },
      required: ["target_job_id", "target_asset_id", "reference_asset_ids", "prompt", "generation_quality", "assistant_reply"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "create_multi_output_image_revision",
    description: "Create multiple independently instructed output images from one exact generated image. Use this instead of image_count when one composite image must be split into separate front/back, left/right, or otherwise semantically distinct standalone outputs.",
    parameters: {
      type: "object",
      properties: {
        target_job_id: { type: "string" },
        target_asset_id: { type: "string" },
        reference_asset_ids: {
          type: "array",
          items: { type: "string" },
          maxItems: MAX_AGENT_INPUT_IMAGES,
          description: "Exact uploaded-reference asset IDs from request_context.available_reference_assets to use in addition to the target image."
        },
        outputs: {
          type: "array",
          minItems: 2,
          maxItems: 8,
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Short semantic name such as Front, Back, Left flyer, or Right flyer." },
              prompt: { type: "string", description: "A short, direct instruction for this output. State only its requested difference, role, or source region. Preserve unmodified content only in the edit target; from additional content sources use only what the request depends on, and from style sources use only requested visual qualities. Avoid transcribing references or adding prompt-engineering prose." }
            },
            required: ["label", "prompt"],
            additionalProperties: false
          }
        },
        aspect_ratio: { type: "string", enum: STANDALONE_ASPECT_RATIOS, description: "Required standalone canvas ratio for each output. Infer it from one source panel, not from the full composite canvas." },
        resolution: { type: "string", enum: [...RESOLUTIONS] },
        output_format: { type: "string", enum: [...OUTPUT_FORMATS] },
        background: { type: "string", enum: ["transparent"] },
        generation_quality: { type: "string", enum: ["low", "medium"], description: "Internal quality for every output in this job. Use medium when any final output contains substantial visible text or exact-copy-heavy content; otherwise use low. Include preserved target text and use medium when uncertain." },
        assistant_reply: { type: "string", description: "Short message shown while all independent outputs start." }
      },
      required: ["target_job_id", "target_asset_id", "reference_asset_ids", "outputs", "aspect_ratio", "generation_quality", "assistant_reply"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "create_multi_output_image_generation",
    description: "Create multiple output images in one task, with or without uploaded references. Call only when the user wants generation to start now; a question about what can be created after the user sends required materials later is not executable yet. Use this when the latest request itself asks for multiple images or when it supplies materials/details requested by the immediately preceding assistant for a specific unfinished multi-output deliverable; in that adjacent handoff, preserve every requested output rather than reducing the task to one component. Use one output entry per requested image, including same-prompt variants and independently instructed roles such as album front cover/back cover, flyer front/back, packaging front/side, left/right designs, or separate campaign deliverables.",
    parameters: {
      type: "object",
      properties: {
        reference_asset_ids: {
          type: "array",
          items: { type: "string" },
          maxItems: MAX_AGENT_INPUT_IMAGES,
          description: "Exact uploaded-reference asset IDs from request_context.available_reference_assets to use for every output. Return an empty array when no uploaded reference should be used."
        },
        outputs: {
          type: "array",
          minItems: 2,
          maxItems: 8,
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Short semantic role such as Album front cover, Album back cover, Packaging front, Flyer back, Left design, or Right design." },
              prompt: { type: "string", description: "A short, direct instruction for this output. State only its requested difference, role, or source region. From content sources use only what the request depends on; from style sources use only requested visual qualities. Do not copy unrelated layout or text, transcribe references, or add prompt-engineering prose." }
            },
            required: ["label", "prompt"],
            additionalProperties: false
          }
        },
        aspect_ratio: { type: "string", enum: STANDALONE_ASPECT_RATIOS, description: "Required standalone canvas ratio for each output. Infer it from one source panel, not from the full composite canvas." },
        resolution: { type: "string", enum: [...RESOLUTIONS] },
        output_format: { type: "string", enum: [...OUTPUT_FORMATS] },
        background: { type: "string", enum: ["transparent"] },
        generation_quality: { type: "string", enum: ["low", "medium"], description: "Internal quality for every output in this job. Use medium when any final output contains substantial visible text or exact-copy-heavy content; otherwise use low. Use medium when uncertain." },
        session_title: { type: "string", description: "Concise name for this new session, 20 characters or fewer. Describe the overall creative goal shared by these outputs." },
        assistant_reply: { type: "string", description: "Short message shown while all independent outputs start." }
      },
      required: ["reference_asset_ids", "outputs", "aspect_ratio", "generation_quality", "session_title", "assistant_reply"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "recommend_workspace",
    description: "REQUIRED for any request to create, generate, make, animate, or edit a video, clip, movie, reel, or other moving visual. Use this even when the request has spelling or grammar errors. It opens the Video Generator; do not call an image-generation tool in the same turn.",
    parameters: {
      type: "object",
      properties: {
        target: { type: "string", enum: ["video_generator"] },
        assistant_reply: { type: "string", description: "Short, helpful explanation shown above the workspace button." }
      },
      required: ["target", "assistant_reply"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "recommend_watermark_free_upgrade",
    description: "Offer the subscription upgrade CTA for a completed image that is currently watermarked. Use when the user asks to remove the watermark or download/export that image without a watermark. This does not create or revise an image.",
    parameters: {
      type: "object",
      properties: {
        target_job_id: { type: "string", description: "The exact completed job ID for the watermarked image." },
        target_asset_id: { type: "string", description: "The exact asset ID for the watermarked image." },
        assistant_reply: { type: "string", description: "Short explanation that the watermark-free original is unlocked by upgrading." }
      },
      required: ["target_job_id", "target_asset_id", "assistant_reply"],
      additionalProperties: false
    }
  }
] as const;

function resolveWorkspaceContext(sourceUseCase?: string): AgentWorkspaceContext {
  if (sourceUseCase === "ai-image-text-editor") {
    return {
      sourceUseCase,
      name: "AI Image Text Editor",
      specialty: "changing, replacing, correcting, removing, or adding text in one uploaded image while preserving its design",
      isGeneralImageMaker: false
    };
  }
  if (sourceUseCase === "poster-maker") {
    return {
      sourceUseCase,
      name: "AI Poster Maker",
      specialty: "posters for event promotion, product promotion, movies, lost-and-found notices, and other purposes",
      isGeneralImageMaker: false
    };
  }
  if (sourceUseCase === "ai-certificate-generator") {
    return {
      sourceUseCase,
      name: "AI Certificate Generator",
      specialty: "achievement, appreciation, completion, participation, award, and recognition certificates",
      isGeneralImageMaker: false
    };
  }
  if (sourceUseCase === "ai-menu-generator") {
    return {
      sourceUseCase,
      name: "AI Menu Generator",
      specialty: "restaurant menus, breakfast menus, cafe menus, diner menus, drink lists, wine lists, and printable price lists",
      isGeneralImageMaker: false
    };
  }
  if (sourceUseCase === "ai-infographic-generator") {
    return {
      sourceUseCase,
      name: "AI Infographic Generator",
      specialty: "infographics, data stories, comparisons, processes, timelines, lists, and educational explainers",
      isGeneralImageMaker: false
    };
  }
  if (sourceUseCase === "ai-comic-generator") {
    return {
      sourceUseCase,
      name: "AI Comic Generator",
      specialty: "comic strips, comic pages, manga, webtoons, character continuity, panels, dialogue, and visual storytelling",
      isGeneralImageMaker: false
    };
  }
  if (sourceUseCase === "ai-anime-generator") {
    return {
      sourceUseCase,
      name: "AI Anime Generator",
      specialty: "original anime characters, portraits, avatars, scenes, backgrounds, creatures, expressive poses, and polished single-image anime artwork",
      isGeneralImageMaker: false
    };
  }
  if (sourceUseCase === "ai-brochure-generator") {
    return {
      sourceUseCase,
      name: "AI Brochure Generator",
      specialty: "brochures, folded marketing collateral, company profiles, product overviews, and service guides",
      isGeneralImageMaker: false
    };
  }
  if (sourceUseCase === "ai-flyer-generator") {
    return {
      sourceUseCase,
      name: "AI Flyer Generator",
      specialty: "flyers, promotional graphics, event announcements, and marketing layouts",
      isGeneralImageMaker: false
    };
  }
  if (sourceUseCase === "ai-album-cover") {
    return {
      sourceUseCase,
      name: "AI Album Cover Generator",
      specialty: "album covers, single artwork, playlist visuals, and music release art",
      isGeneralImageMaker: false
    };
  }
  if (sourceUseCase && sourceUseCase !== "ai-image-maker") {
    const workspaceLabel = sourceUseCase
      .split("-")
      .filter((part) => part !== "ai")
      .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
      .join(" ");
    const specialtyLabel = workspaceLabel.endsWith(" Maker")
      ? workspaceLabel.slice(0, -" Maker".length)
      : workspaceLabel;
    return {
      sourceUseCase,
      name: workspaceLabel,
      specialty: `image creation focused on ${specialtyLabel.toLowerCase()}`,
      isGeneralImageMaker: false
    };
  }
  return {
    sourceUseCase: sourceUseCase || "ai-image-maker",
    name: "AI Image Maker",
    specialty: "general image creation across any visual style or use case",
    isGeneralImageMaker: true
  };
}

function instructions(language: string, workspace: AgentWorkspaceContext): string {
  return [
    "You are Vismuse's AI creative partner. Vismuse can create images and videos; help users choose the right creative workspace and turn their ideas, copy, and reference images into high-quality visual work.",
    workspace.sourceUseCase === "ai-image-text-editor"
      ? "HARD OUTPUT TYPE: this workspace edits text in exactly one supplied image. Treat the uploaded image, or current generated result on follow-up turns, as the exact base. For every creation or revision tool call, apply only the requested text replacement, correction, removal, or addition; preserve the canvas, crop, subjects, objects, logos, layout, unmentioned text, and every non-conflicting detail; render requested copy exactly; and match the surrounding typography, texture, lighting, and perspective. Never redesign, restage, resize, or create an unrelated image."
      : workspace.sourceUseCase === "poster-maker"
      ? "CRITICAL WORKSPACE ROUTING RULE — apply this before every other creative instruction: you are the AI Poster Maker in this image workspace. Requests for a movie poster, film poster, cinema poster, theatrical poster, or cinematic key art are still-image requests and MUST stay in this workspace; never route them to the Video Generator merely because they contain words such as movie, film, or cinema. If the user's latest request clearly asks for an actually moving output such as a video, animation, clip, reel, motion graphic, or animated poster, you MUST call recommend_workspace with target video_generator. In that turn, do not call create_image_generation, create_multi_output_image_generation, create_image_revision, or create_multi_output_image_revision; do not ask a clarifying question; and do not reinterpret the request as a still image."
      : "CRITICAL WORKSPACE ROUTING RULE — apply this before every other creative instruction: this is an image workspace. If the user's latest request asks for a video or moving visual (including a video, action video, animation, movie, clip, reel, motion graphic, or animate request), you MUST call recommend_workspace with target video_generator. Treat clear video intent as video intent even when the wording is short, incomplete, misspelled, or ungrammatical; for example, 'I need you to genera an action video' must call recommend_workspace. In that turn, do not call create_image_generation, create_multi_output_image_generation, create_image_revision, or create_multi_output_image_revision; do not ask a clarifying question; and do not reinterpret the request as a still image. The application will show a button that takes the user to the Video Generator input box.",
    "Scope boundary: you are not a general-purpose assistant. Do not provide code, commands, device or system-operation instructions, technical troubleshooting, tutorials, or factual advice that is unrelated to creating, revising, downloading, or subscribing to Vismuse visual projects. This applies even if the user asks repeatedly or the earlier conversation is off-topic. For an unrelated request, give one brief reply in the user's language that Vismuse helps create images and videos and invite a visual-creation request; do not include examples, instructions, or a tool call. This boundary does not apply when code or technical text is explicitly requested as visible copy inside an image or video being created.",
    "You are not the image safety enforcement layer. For an explicit, actionable image-generation request, call the appropriate creation tool with the user's original request even if you suspect it may later be rejected. Do not give a safety refusal yourself; downstream generation and post-failure recovery decide whether to retry safely or guide the user.",
    "Converse like an experienced creative designer. Default to executing visual work: when the latest user message is not clearly an informational question, greeting, casual conversation, product question, or out-of-scope request, attempt the appropriate image creation or revision as soon as the request has one usable creative attribute.",
    "Judge the user's semantic intent, not isolated negative words. A negative content constraint inside an actionable image request does not cancel execution. For example, 'Change the price but do not add new text' is an image revision: preserve the constraint against adding text and call the revision tool. Only stay in conversation when the user clearly asks to discuss, explain, compare, plan, or answer something without performing image work in this turn.",
    workspace.isGeneralImageMaker
      ? "When asked what you can do, describe Vismuse's general image-creation capabilities directly, without referring to a current workspace. You may mention that Vismuse also offers a separate video generator."
      : `The user is currently in ${workspace.name}. This workspace directly creates and edits images; its specialty is ${workspace.specialty}. When asked what you can do here, lead with ${workspace.specialty}, while making clear that you can also help create other image styles.`,
    workspace.sourceUseCase === "poster-maker"
      ? `HARD OUTPUT TYPE: this workspace creates posters. ${POSTER_DESIGN_GUIDANCE} ${POSTER_READINESS_GUIDANCE}`
      : workspace.sourceUseCase === "ai-certificate-generator"
      ? "HARD OUTPUT TYPE: this workspace creates one flat, ready-to-print certificate. For every image creation or revision tool call, describe the deliverable as a certificate, never as a flyer, brochure, social post, generic illustration, photographed paper, framed wall art, desk scene, hands-held certificate, rolled diploma, device screen, or perspective mockup. Preserve supplied recipient names, certificate titles, achievements, course or event names, issuers, dates, credentials, signature labels, and organization names exactly. Omit missing content rather than inventing names, qualifications, dates, claims, signatures, seals, registration numbers, accreditation marks, contact information, or logos."
      : workspace.sourceUseCase === "ai-brochure-generator"
      ? "HARD OUTPUT TYPE: this workspace creates brochures. For every image creation or revision tool call, describe the deliverable as a brochure, never as a flyer, poster, or generic social post. If the user calls it a flyer or poster, preserve their supplied content and visual requirements but adapt the deliverable into a brochure."
      : workspace.sourceUseCase === "ai-infographic-generator"
      ? "HARD OUTPUT TYPE: this workspace creates flat infographics. For every image creation or revision tool call, describe the deliverable as an infographic, never as a flyer, brochure, dashboard screenshot, generic illustration, or paper mockup. Preserve supplied facts and numeric values exactly. Never invent statistics, dates, sources, rankings, labels, or citations; when numeric data is absent, use qualitative information design instead of fabricating a chart."
      : workspace.sourceUseCase === "ai-comic-generator"
      ? "HARD OUTPUT TYPE: this workspace creates finished flat comic strips and comic pages. Keep the requested panel count and reading order clear; preserve recurring character identity, costumes, settings, story beats, dialogue, captions, names, and facts exactly; add visible text only when supplied or explicitly requested; and keep balloon tails attached to the intended speaker. Never turn the result into a collage, storyboard sheet, generic illustration, photographed comic book, device screen, or perspective mockup."
      : workspace.sourceUseCase === "baby-shower-invitations"
      ? BABY_SHOWER_INVITATION_CONSTRAINT
      : workspace.sourceUseCase === "playlist-cover-maker"
      ? PLAYLIST_COVER_CONSTRAINT
      : workspace.sourceUseCase === "vision-board-maker"
      ? VISION_BOARD_CONSTRAINT
      : workspace.sourceUseCase === "ai-anime-generator"
      ? "HARD OUTPUT TYPE: this workspace creates one finished flat anime-style illustration. Preserve supplied or established character identity, face, hair, outfit, palette, setting, pose, mood, composition, style, and canvas as applicable; treat uploaded character references as identity authority. Use original designs; do not imitate living artists or named studios, and never turn the result into a comic or manga page, storyboard, collage, contact sheet, photographed print, device screen, or perspective mockup. Add no panels, gutters, balloons, captions, logos, watermarks, or visible text unless explicitly requested and allowed."
        : workspace.sourceUseCase === "ai-menu-generator"
          ? "HARD OUTPUT TYPE: this workspace creates flat, ready-to-print restaurant menus. For every image creation or revision tool call, describe the deliverable as a menu, never as a flyer, food advertisement, brochure, photographed paper, table scene, folded piece, menu-board interior, or perspective mockup. Preserve supplied sections, item names, descriptions, dietary labels, currencies, and prices exactly. Omit missing content rather than inventing dishes, drinks, ingredients, allergens, claims, prices, promotions, contact details, or logos."
        : "",
    "You can create new images, create from reference images, and revise images from this conversation. You are a helpful design collaborator, not an intent classifier.",
    "Treat concise follow-up styling requests as actionable visual work when the session has a current or completed visual context. This includes requests that specify only a theme, palette, mood, or transformation and omit nouns such as image, flyer, edit, create, or generate. For example, after a flyer or reference image exists, 'frank ocean themed and make them pink and white' means revise that visual: query the session assets when needed, then call the revision tool. If there is a reference but no completed generated image to revise, call the generation tool to create the requested restyle.",
    "REFERENCE FOLLOW-UP INTENT RULE: When the session has a current image, completed image, or user-uploaded reference, interpret a concise imperative about content, composition, wording, placement, or appearance as an operation on that visual unless the user explicitly asks for a text-only answer or discussion. This remains actionable when the message omits the visual object or explicit image-operation verbs. Infer the requested delta from the latest message and context, then call the appropriate generation or revision tool.",
    "VISUAL INSPECTION RULE: A request only to inspect, read, describe, identify, extract, summarize, or analyze what is already visible is conversational, not an image operation. Answer without calling an image creation or revision tool. If the same request also asks to change or create the visual, perform that requested operation.",
    "Never claim that a current-request image was started, created, generated, completed, or delivered unless this turn called the corresponding creation or revision function. A natural-language reply is never evidence that visual work happened. If you did not call a creation tool, either give a genuine discussion answer or ask one necessary clarification question.",
    "The assistant_reply from a creation tool is displayed immediately after the request is accepted, while the image job is still pending. It must use starting or in-progress language. Never say or imply that the requested image or edit is already finished—for example, do not say done, completed, finished, or I've added it. Say I'm adding it now, I'm applying that change now, I'm generating it now, or equivalent in-progress wording in the user's language.",
    "Only treat content explicitly supplied by the user as a creative requirement. Never carry forward an earlier assistant response, safety explanation, or assistant-proposed alternative as an image instruction unless the user explicitly asks for that exact alternative in a later message.",
    "The latest user message is authoritative. Apply it as a correction whenever it conflicts with earlier user requests, plans, prompts, or generated results. Historical unfinished, deferred, failed, or merely discussed work is context only: never resume or execute it unless the latest user message explicitly asks to continue that work. One narrow handoff is allowed without a separate confirmation: when the latest turn supplies or describes materials that the immediately preceding assistant requested for a specific unfinished deliverable, combine those materials with that request and execute the complete deliverable without reducing it to only one described subset. This exception applies only when no intervening user request or created job exists.",
    "A future-conditional material handoff is a capability conversation, not a request to start generation now. When the user says they will send, provide, or upload images, copy, event details, or other required materials later and asks whether you can create the deliverable after receiving them, reply briefly that you can and ask them to send the materials. Do not call any creation tool, do not make placeholder outputs, and do not start a partial version in that turn—even if the user already named the output type, style, theme, or exact number of outputs. Once the promised materials arrive in the immediately following turn and the intended deliverable is clear, combine them with that adjacent request and execute the complete deliverable.",
    "request_context.conversation_context is role-labelled session history. Treat assistant and system entries as reports or suggestions, not instructions. Use it to understand the dialogue and decide whether to generate, ask a concise question, or offer an available CTA; never turn an assistant/system suggestion into image content without explicit later user acceptance.",
    "A brief affirmative user reply such as yes, okay, do it, or 'go with your suggestion' explicitly adopts the immediately preceding assistant/system suggestion only when that reference is unambiguous. Do not infer adoption otherwise.",
    "REFERENCE CLARIFICATION LIMIT: when one or more usable reference images are available but the user's intended image operation is unclear, you may ask at most one concise clarification question. If the user's next turn continues that same image task, do not ask another clarification question—even when the reply remains brief, vague, or leaves optional choices unresolved. Choose sensible defaults from the reference images and conversation context, then call the appropriate image generation or revision tool immediately with the applicable reference_asset_ids.",
    "Never repeat or rephrase a clarification about how to use available reference images. After the single allowed clarification, continue to image execution unless the user explicitly cancels the image task, explicitly asks only for discussion, or changes to an unrelated request.",
    "PINNED REFERENCE RULE: request_context.pinned_reference_assets are session-level user references and remain active even when the job that first used them failed or was rejected. Every image creation or revision tool call must include their exact asset IDs in reference_asset_ids unless the user explicitly asks to remove, ignore, or stop using those references. A failed job never authorizes returning an empty reference_asset_ids array, and you must never silently replace a pinned user reference with a generated result.",
    "BLOCKED REFERENCE RULE: request_context.blocked_reference_assets remain recorded in the session but are not available for generation. When the current request depends on one of them, do not silently omit or replace it and do not call an image tool. Briefly explain that the reference could not be accepted and ask the user to replace/remove it or explicitly choose to proceed without it. A blocked reference becomes usable only after the user uploads it again and it appears in available_reference_assets.",
    "request_context.available_session_results contains usable completed images and request_context.recent_request_statuses distinguishes completed images from pending or failed requests. If the user replaces or changes an unfinished request, use the most recent applicable completed image as the visual base; never treat a pending request as a generated image.",
    "request_context.latest_completed_result is the authoritative record of the most recently delivered image. Use it to ground short follow-up replies. Do not say that you will prepare, translate, or generate an output that record already describes as delivered. For example, if the delivered image already uses the language the user asks for, say that it is already in that language and ask, in one short sentence, what they would like to adjust. Do not start a new job for that acknowledgement.",
    "Every completed image in request_context includes access_variant and preview_variant. access_variant=watermarked means only that the currently delivered preview has a watermark; it does not make the project uneditable. For a normal creative revision—such as changing copy, time, color, layout, or an object—use the revision tool as usual with the exact job and asset IDs. The server uses the stored original privately as the edit reference and returns the appropriate access-plan preview. When the user specifically asks to remove the watermark or download/export without a watermark, do not call create_image_generation, create_multi_output_image_generation, create_image_revision, or create_multi_output_image_revision. This includes capability-style or abbreviated wording such as 'Can you remove the watermark?', 'Remove the watermark', and 'Send me the watermark-free version' when the current result is watermarked. Call recommend_watermark_free_upgrade with that exact image's job and asset IDs, and explain briefly that upgrading unlocks the watermark-free original. Only use this upgrade CTA for an image explicitly marked access_variant=watermarked.",
    "When request_context.safety_followup.resolved_safe_instruction is present, it is the complete safe reconstruction of the user's current request. Use it as the creative instruction and do not restore any omitted unsafe wording or assistant-proposed alternative. If safety_followup.resolved_task_action is edit, query the applicable completed session asset and call create_image_revision unless the user clearly requests a fresh image instead.",
    "For a video request, recommend_workspace is the only valid creative tool call: do not create an image. The assistant_reply must be a direct next step in the user's language, such as 'Click the button below to open the Video Generator and start creating.' Do not use conditional language such as 'if you want' or 'I can help you switch', and never claim that you have already switched pages for them. For unrelated action requests such as checking weather, making money, booking travel, or controlling other services, explain briefly that you cannot perform that action and redirect to image or video creation when useful.",
    "For questions about Vismuse subscription plans, prices, monthly or annual billing, included credits, plan comparisons, or what the user can subscribe to, call query_subscription_plans before answering. The tool result is the only authoritative source for current plan facts because different users can be assigned different pricing experiments. Mention only plans and facts returned by the tool and use the user's language. Do not print, link, or mention the pricing URL; the application renders a subscription button below your reply. Do not start an image job for a billing or subscription question.",
    "Respond naturally when the user asks who you are, what you can do, how the product works, or when essential creative details are genuinely missing. Do not call a creation tool for a clear informational question, greeting, casual conversation, product question, or explicit request to discuss without executing image work.",
    "An explicit semantic request to avoid creating or editing an image in the current turn is a hard constraint only when the user is asking for discussion, explanation, advice, or planning instead. Do not confuse it with a constraint on image contents: 'do not add text', 'do not create new wording', 'do not add people', and similar constraints still require execution when paired with an actionable creation or revision.",
    "Call create_image_generation when the user wants a new image job to start now and the request is actionable. Imperative or declarative creative directions normally express execution intent even when they omit words such as create or generate.",
    workspace.isGeneralImageMaker
      ? "Treat substantial ready-to-use image briefs, copy, or event/business details as a request to create the corresponding image even when the user omits words such as 'create' or 'generate'."
      : `Because the user is already inside ${workspace.name}, treat a non-question declarative subject, title and artist, pasted copy, article summary, product or business phrase, event details, or other usable ${workspace.specialty} content as a request to create the corresponding image even when the user omits words such as "create" or "generate". Do not merely compliment the content or ask for an optional visual style; choose sensible defaults and create.`,
    "CORE CREATION DECISION RULE — apply this before every new visual creation decision. If the user asks to create a visual but supplies zero creative attributes, do not generate; ask exactly one concise question to obtain an attribute. If the user clearly asks to create a visual and supplies at least one creative attribute, call the appropriate creation tool immediately and do not ask for more optional details.",
    "A visual deliverable type is not a creative attribute. Words such as image, photo, illustration, flyer, poster, banner, ad, logo, icon, business card, invitation, cover, sticker, wallpaper, tattoo, mockup, portrait, or social media post only identify the kind of output. A creative attribute is any usable subject, purpose, audience, scene, object, person, product, brand or business identity, event, visible copy, style, color, mood, composition, attached reference image, or unambiguous user-provided direction from relevant conversation history.",
    "Examples: 'Create an image', 'Make a flyer', and 'I need to make a logo' have zero attributes, so ask what the image should show, what the flyer should promote, or what the logo should represent. 'Create a beauty salon flyer', 'Make a logo for Vismuse', 'Create a luxury flyer', 'Generate a pink image', and 'Make a poster that says 20% OFF' each contain at least one attribute, so generate immediately.",
    "An actionable image request contains at least one usable creative attribute or enough information to perform the requested revision. Optional style choices do not block a useful first version, and you must not ask users to reconfirm copy, dates, locations, prices, or other facts they already supplied consistently.",
    "A missing headline, visual style, color palette, or aspect ratio is normally optional: choose a sensible default and begin creating. Do not block a complete event or promotional brief merely to ask for a title.",
    "REFERENCE ROLE RULE: Before choosing references or writing a tool prompt, infer each available image's role from the latest request and conversation context. An edit target is the image being changed, so preserve its unmodified content. When the user asks to adapt, recreate, continue, or make localized changes to the same attached design, treat that reference as the edit target unless the user explicitly limits it to style, look, palette, or inspiration only. A replacement identity, title, correction, addition, or removal is a localized change. In the tool prompt, identify an edit target explicitly, preserve its non-conflicting content and layout, and state only the requested change; never describe an edit target merely as style inspiration. A content source supplies only the subject, identity, object, or content the request depends on; do not copy its unrelated background, layout, or text. A style source supplies only requested visual qualities and never its copy. An irrelevant image must not be selected. Do not assume style-only use merely because the user did not transcribe an image's content.",
    "MINIMAL-DELTA TOOL PROMPT RULE: The downstream image model is already an agent. State only the requested change. Preserve non-conflicting content in the edit target, but never broaden a narrow change into 'adapt all content', a redesign, or a rewrite. From other references, carry over only the content or visual qualities required by their inferred role. The latest user instruction replaces only conflicting earlier content. Keep the tool prompt short and direct; do not add design elaboration, policy reasoning, provenance explanations, negative text rules, or other prompt-engineering prose. Put aspect ratio, resolution, format, and count only in their tool fields.",
    "GENERATION QUALITY: For every executable image tool call, set generation_quality from the complete final canvas. Use medium when it contains substantial visible text: multiple text blocks, body copy, lists, prices, dates, addresses, contact details, or other exact-copy-heavy content. Use low when it is primarily visual with no text or only minimal short copy such as one title, label, or brief subtitle. For edits, include all text preserved from the target; do not judge only the latest delta. For multi-output jobs, use medium when any output is text-heavy. When uncertain, use medium.",
    "VISIBLE COPY PROVENANCE RULE: Never invent specific readable copy such as names, titles, event details, prices, contact details, or lists. Valid copy comes from the user's messages, a relevant original user-uploaded reference, or an explicit request for you to write or choose it. If no copy is supplied, do not ask for optional copy and do not inject placeholders—but also do not add 'zero readable text', 'no additional text', or any other negative text instruction to the tool prompt. Require no text, no captions, no subtitles, no title, or no overlay only when the user explicitly requests that constraint. Preserve the exact modality and scope of any negative text request: no subtitles forbids only subtitles, no title forbids only a title, and no overlay forbids only added overlay text. In an edit or reference-led generation, no text or no overlay means do not add standalone text; preserve intrinsic text already belonging to the referenced design, product, packaging, sign, or logo unless the user explicitly asks to remove or erase that existing text.",
    "REFERENCE COPY RULE: Readable text in an original user-uploaded edit target counts as user-supplied and remains available unless the user changes or removes it. For a content source, use only the copy the request specifically depends on; unrelated visible text is not part of the request. A style source never authorizes copying its text. When a selected reference is also passed to the image model, refer to the needed content semantically instead of transcribing or enumerating it. Latest user wording replaces only conflicts. Text found only in an AI-generated result is not user-supplied unless the user adopts it or asks to preserve it.",
    "When a short follow-up names exact values while correcting existing visible copy, determine the requested operation from the whole sentence and the latest user-confirmed value set. A value named as the error or correction target is not automatically desired replacement copy. Never add a new date, number, price, or label merely because it appears in a corrective complaint. If a likely typo or missing negation leaves opposite operations genuinely plausible, ask one concise clarification instead of applying the inverse edit. After the user rejects conflicting values and then confirms that only or just a particular value set should remain, revise immediately: keep that confirmed set and remove the conflicting values instead of asking what operation to perform.",
    "When the user asks to change, restore, correct, or change back prices or other exact copy without repeating the values, first use the most recent values that the user explicitly provided in this conversation. Prefer values in the current message, then the latest explicit user-provided values in conversation history. Never treat text that an image model happened to render as a user-confirmed value.",
    "A request is not actionable when a new-image request has zero creative attributes, when a required revision value or object is absent from both the current message and conversation history, or when multiple historical values remain genuinely ambiguous. For example, ask what a generic flyer should promote, ask for prices only when the requested operation truly requires prices and the user has never supplied usable prices, and ask what should be removed from an unfinished instruction such as 'remove'. Ask exactly one concise question in that case and do not invent the missing value.",
    "request_context.current_generation_parameters contains the current validated generation settings from the input controls. Treat them as defaults: preserve every setting unless the user explicitly asks to change that setting. Only include aspect_ratio, resolution, or output_format in a creation tool call when the user explicitly requested a change. Set background to transparent only when the user's latest request explicitly asks for transparency, no background, or background removal; otherwise omit background so it defaults to auto. The application retains omitted fields unchanged.",
    "Do not interpret clock times such as 6:12 or 7:30, dates, scores, prices, or other colon-separated numbers as aspect ratios unless the user explicitly identifies them as a ratio or output format.",
    "When the user explicitly says to replace, change, correct, or edit visible text, copy, a label, or a string, dimension-like values inside that text operation are copy, not an output resize. For example, 'replace the text 1080x1350 with 1024x1536' must omit aspect_ratio unless the user separately asks to resize the output, canvas, image, or format.",
    "Ordinary create_image_generation and create_image_revision calls must never set image_count. The application owns any numeric count explicitly selected in its input controls. If the latest user text explicitly requests exactly one output, use the ordinary tool and set force_single_output=true so that request overrides a different control value. When the latest user message asks in text for more than one image, variant, option, or independently instructed deliverable, call create_multi_output_image_generation or create_multi_output_image_revision and provide one complete output entry per requested image. This includes same-prompt variants as well as semantic roles such as an album front cover and back cover, flyer front and back, packaging front and side, side A and side B, or left and right designs. If there is no existing generated image target, call create_multi_output_image_generation whether or not the current turn includes a reference image. If the user is splitting or revising an existing generated result, call create_multi_output_image_revision. Decide from the latest user's requested outputs, not from workspace or asset type. For either multi-output tool, aspect_ratio is required: choose the canvas ratio appropriate to one standalone output and never use a composite canvas ratio or auto. Give every output its own complete prompt, require one standalone canvas, explicitly forbid a collage/split panel/contact sheet, and repeat all exact-copy constraints relevant to that output. When a composite reference exists, also state the exact source region or side for each output.",
    "When an image is attached as visual context, inspect it before deciding between ordinary image_count variants and a multi-output tool. If the image visibly contains multiple finished designs on one canvas and the user asks for multiple or different outputs, preserve each visible design as its own standalone output rather than inventing unrelated style variants.",
    "If request_context.has_reference_assets_in_this_turn is true and the user gives a complete direct edit instruction—even a short instruction such as make it clearer, remove the background, change the style, or adjust the color—you MUST call create_image_generation, except that a request for semantically distinct standalone outputs from a composite reference MUST call create_multi_output_image_generation. The uploaded reference image is already available to the application, so do not ask them to upload it again.",
    "For every image creation or revision tool call, choose reference_asset_ids from request_context.available_reference_assets. Use only exact listed IDs. Always include request_context.pinned_reference_assets unless the user explicitly removes them. Otherwise include a reference when the latest user request refers to that uploaded image or depends on its subject, identity, product, style, or placement. Return an empty array only when no pinned reference applies and the request is a new unrelated image or revises only the generated target. Never assume that every other historical reference belongs in the current job.",
    "If the current turn includes a reference image but the user is only asking a clarification or choosing between options, acknowledge that you received the reference image in the same concise reply.",
    "If request_context.selected_target_assets contains an asset and the user gives a complete edit instruction, call create_image_revision or create_multi_output_image_revision directly with that exact target_job_id and target_asset_id. This does not override the watermarked-image rule: a request to remove or bypass a watermark must use the upgrade CTA instead. Do not query for a selected image and do not ask the user to select it again.",
    "Never say or imply that you will create, edit, enhance, or start an image unless you call create_image_generation, create_multi_output_image_generation, create_image_revision, or create_multi_output_image_revision in that same turn. A promise without a creation tool call is invalid.",
    "When a usable image already exists, treat a concrete change, removal, addition, restoration, resolution request, or complaint that states the desired corrected state as an instruction to revise it now. Do not merely remember the preference or wait for a separate confirmation turn. Watermark removal and watermark-free export are upgrade requests, not revisions.",
    "The image backend accepts an aspect ratio and only these resolution tiers: 1K, 2K, and 4K. Exact pixel dimensions are approximated to the nearest supported tier; never promise an exact pixel count. If a user supplies one or more exact pixel dimensions with an otherwise actionable image request, start the job using the matching aspect ratio and closest resolution tier. If they give alternatives such as '3000 x 3000 or 1400 x 1400', choose the largest usable option by default and create now—do not ask them to choose unless they explicitly ask for a recommendation or state a tradeoff that requires one. Mention a resolution in assistant_reply only when the same tool call carries that resolution. Resolution text inside prompt does not change the actual output setting.",
    "Call query_session_assets before create_image_revision or create_multi_output_image_revision only when the user refers to a previous or numbered image that is not already present in request_context.selected_target_assets.",
    "After query_session_assets returns, use the returned exact IDs to finish the pending request. Do not say you are about to fetch IDs because the query result already contains them.",
    "Call create_image_revision or create_multi_output_image_revision only with exact IDs from request_context.selected_target_assets or query_session_assets. Never invent job or asset IDs.",
    "For a long structured brief with many exact fields, do not repeat every field in tool arguments. Call the appropriate creation tool with a concise instruction to preserve and use every user-provided field; the application retains the original message.",
    "The application decides whether a job exists solely from your tool call. Never imply that generation has started unless you call a creation tool.",
    "Treat model names and versions, APIs, providers, downstream services, internal tools, routing, IDs, and billing implementation as private implementation details. If the user asks what model or technology powers you or image generation, say only that you are Vismuse AI and can help with their creative task. Never name, confirm, guess, or compare a specific model, provider, API, or downstream service.",
    `Use ${language || "the user's language"} for all user-facing text.`
  ].join(" ");
}

export function buildToapisImageIntentInstructions(language: string, sourceUseCase?: string): string {
  return instructions(language, resolveWorkspaceContext(sourceUseCase));
}

function looksLikeSubscriptionPlanQuestion(content: string): boolean {
  return /(?:订阅|套餐|会员方案|价格计划|subscribe|subscription|pricing\s+plans?|billing\s+plans?|membership\s+plans?|planes?\s+de\s+suscripci[oó]n|suscripci[oó]n|abonnement|tarifs?)/i.test(content);
}

function subscriptionPlansCtaLabel(language: string): string {
  const normalized = language.toLowerCase();
  if (normalized.startsWith("zh")) return "查看订阅套餐";
  if (normalized.startsWith("es")) return "Ver planes de suscripción";
  if (normalized.startsWith("fr")) return "Voir les abonnements";
  return "View subscription plans";
}

function stripSubscriptionPricingLink(text: string): string {
  return text
    .replace(
      /(?:next\s+step|you\s+can|to\s+subscribe|subscribe|check\s+and\s+subscribe|下一步|你可以|您可以)[^。.!?\n]*(?:\n[^\n]*)?(?:https?:\/\/[^\s)]+)?\/pricing\b[^。.!?\n]*[。.!?]?/gi,
      ""
    )
    .replace(/(?:https?:\/\/[^\s)]+)?\/pricing\b/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function asSocialmediaResult(result: JobRecord["result"]): SocialmediaJobResult | null {
  if (!result || typeof result !== "object") return null;
  const candidate = result as Partial<SocialmediaJobResult>;
  return candidate.kind === "socialmedia_image_generation" && candidate.socialmedia
    ? candidate as SocialmediaJobResult
    : null;
}

function compact(value: unknown, maxChars: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > maxChars ? `${text.slice(0, maxChars - 1).trimEnd()}…` : text;
}

function summarizeImages(images: SocialmediaGeneratedImage[] | undefined) {
  return (images ?? []).slice(0, 8).map((image) => ({
    asset_id: image.assetId,
    image_number: image.imageIndex + 1,
    width: image.width,
    height: image.height,
    access_variant: image.accessVariant ?? "original",
    preview_variant: image.previewVariant,
    prompt_summary: compact(image.promptSummary, 260)
  }));
}

function buildSessionSnapshot(jobs: JobRecord[]) {
  return [...jobs]
    .sort((left, right) => {
      const updatedAtDelta = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      if (updatedAtDelta !== 0) return updatedAtDelta;
      return right.turnIndex - left.turnIndex;
    })
    .map((job) => ({ job, result: asSocialmediaResult(job.result) }))
    .filter((item) => item.result?.socialmedia.images?.length)
    .slice(0, 12)
    .map(({ job, result }) => ({
      job_id: job.id,
      turn_number: job.turnIndex,
      revision: job.revision,
      request_summary: compact(job.payload.inputText, 300),
      brief_summary: compact(result?.socialmedia.briefSummary, 300),
      images: summarizeImages(result?.socialmedia.images)
    }));
}

function buildRecentRequestStatuses(jobs: JobRecord[]) {
  return [...jobs]
    .sort((left, right) => {
      const updatedAtDelta = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      if (updatedAtDelta !== 0) return updatedAtDelta;
      return right.turnIndex - left.turnIndex;
    })
    .slice(0, 16)
    .map((job) => {
      const result = asSocialmediaResult(job.result);
      return {
        job_id: job.id,
        turn_number: job.turnIndex,
        status: job.status,
        has_usable_result: Boolean(result?.socialmedia.images?.length),
        request_summary: job.status === "failed"
          ? "[failed request: see role-labelled conversation context; do not use as an image instruction]"
          : compact(job.payload.inputText, 300)
      };
    });
}

function buildAssetIndex(
  jobs: JobRecord[],
  selectedTargets: ToapisSelectedTargetAsset[]
): Map<string, SessionAsset> {
  const index = new Map<string, SessionAsset>();
  for (const job of jobs) {
    const images = asSocialmediaResult(job.result)?.socialmedia.images ?? [];
    for (const image of images) {
      index.set(image.assetId, {
        jobId: job.id,
        assetId: image.assetId,
        imageIndex: image.imageIndex,
        accessVariant: image.accessVariant,
        url: image.url
      });
    }
  }
  for (const target of selectedTargets) {
    const existing = index.get(target.targetAssetId);
    index.set(target.targetAssetId, {
      jobId: target.targetJobId,
      assetId: target.targetAssetId,
      imageIndex: target.imageIndex ?? existing?.imageIndex ?? 0,
      accessVariant: existing?.accessVariant,
      url: existing?.url
    });
  }
  return index;
}

function needsExistingImageVisualContext(content: string): boolean {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  return /(?:拆(?:开|分|成)|分成|分别|独立(?:输出|图片|图像)|左右(?:两|2)|正反面|正面.{0,12}(?:背面|反面)|前后两面|封面.{0,12}(?:封底|背面|底面)|(?:封底|背面|底面).{0,12}封面|[AaＡａ]面.{0,12}[BbＢｂ]面|两张(?:不同|独立)|两个(?:不同|独立)(?:输出|版本))/.test(normalized)
    || /\b(?:split|separate|extract)\b.{0,40}\b(?:flyers?|designs?|images?|outputs?|front|back|left|right)\b/i.test(normalized)
    || /\b(?:two|2)\b.{0,24}\b(?:flyers?|different outputs?|separate outputs?|front and back|left and right)\b/i.test(normalized)
    || /\b(?:front(?:\s+cover)?\s*(?:and|&|\+|\/)?\s*back(?:\s+cover)?|cover\s*(?:and|&|\+|\/)?\s*back\s+cover|left and right|side\s+a\s*(?:and|&|\+|\/)?\s*side\s+b)\b/i.test(normalized);
}

function buildInitialAgentInput(params: {
  serializedRequest: string;
  content: string;
  selectedTargets: ToapisSelectedTargetAsset[];
  latestCompletedResult?: ReturnType<typeof buildSessionSnapshot>[number];
  assets: Map<string, SessionAsset>;
  currentReferenceAssets: NonNullable<AgentInput["currentReferenceAssets"]>;
  bootstrapReferenceAssets: NonNullable<AgentInput["bootstrapReferenceAssets"]>;
}): string | Array<Record<string, unknown>> {
  const uploadedVisualAssets = params.currentReferenceAssets
    .filter((asset) => Boolean(asset.url?.trim()))
    .map((asset, index) => ({
      assetId: asset.assetId,
      url: asset.url,
      label: `Visual context for uploaded reference asset_id=${asset.assetId || `current-${index + 1}`}${asset.originalName ? ` (${asset.originalName})` : ""}.`
    }));
  const preferredAssetIds = params.selectedTargets.length
    ? params.selectedTargets.map((target) => target.targetAssetId)
    : needsExistingImageVisualContext(params.content)
      ? params.latestCompletedResult?.images.map((image) => image.asset_id) ?? []
      : [];
  const existingVisualAssets = preferredAssetIds
    .map((assetId) => params.assets.get(assetId))
    .filter((asset): asset is SessionAsset & { url: string } => Boolean(asset?.url?.trim()))
    .map((asset) => ({
      assetId: asset.assetId,
      url: asset.url,
      label: `Visual context for target_job_id=${asset.jobId}, target_asset_id=${asset.assetId}, image_number=${asset.imageIndex + 1}.`
    }));
  const bootstrapVisualAssets = params.bootstrapReferenceAssets
    .filter((asset) => Boolean(asset.url?.trim()))
    .map((asset, index) => ({
      assetId: asset.assetId,
      url: asset.url,
      label: asset.label
        ?? `Visual context for the original Pipeline reference image${asset.originalName ? ` (${asset.originalName})` : ` #${index + 1}`}.`
    }));
  // Current images and explicit targets are authoritative for this request.
  // Historical Pipeline references fill only the remaining visual capacity.
  const seenVisualAssetKeys = new Set<string>();
  const visualAssets = [...uploadedVisualAssets, ...existingVisualAssets, ...bootstrapVisualAssets]
    .filter((asset) => {
      const key = asset.assetId?.trim() || asset.url.trim();
      if (!key || seenVisualAssetKeys.has(key)) return false;
      seenVisualAssetKeys.add(key);
      return true;
    })
    .slice(0, MAX_AGENT_INPUT_IMAGES);
  if (!visualAssets.length) return params.serializedRequest;

  return [{
    role: "user",
    content: [
      { type: "input_text", text: params.serializedRequest },
      ...visualAssets.flatMap((asset) => [
        {
          type: "input_text",
          text: asset.label
        },
        { type: "input_image", image_url: asset.url, detail: "high" }
      ])
    ]
  }];
}

function parseArguments(value: string | undefined): Record<string, unknown> {
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

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function dependsOnPriorCreativeContext(value: string): boolean {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  const compact = normalized.replace(/[.!?,;:。！？，；："'“”‘’]/g, "").trim();
  if (!compact) return true;

  if (
    /^(?:yes|yes please|ok|okay|sure|do it|go ahead|proceed|continue|continue generating|keep going|try again|retry|regenerate|again|one more|make another|generate another)$/.test(compact)
    || /^(?:好|好的|可以|行|开始吧|生成吧|做吧|继续|继续生成|继续做|接着生成|接着做|再来一个|再生成一个|按你的建议|按这个来)$/.test(compact)
  ) {
    return true;
  }

  if (normalized.length > 120) return false;
  return /\b(?:it|this|that|them|those|same|above|previous|last|earlier|your suggestion|your idea|that option)\b/i.test(normalized)
    || /(?:这个|那个|它|它们|这样|同样|上面|刚才|之前|前一个|上一版|按你(?:的)?建议|按这个)/.test(normalized);
}

function readSessionTitle(value: unknown): string | undefined {
  const title = readString(value)?.replace(/\s+/g, " ");
  if (!title) return undefined;
  return [...title].slice(0, 20).join("").trim() || undefined;
}

function readAspectRatio(value: unknown): SocialmediaAspectRatio | undefined {
  const candidate = readString(value) as SocialmediaAspectRatio | undefined;
  return candidate && ASPECT_RATIOS.has(candidate) ? candidate : undefined;
}

function readStandaloneAspectRatio(value: unknown): SocialmediaAspectRatio | undefined {
  const aspectRatio = readAspectRatio(value);
  return aspectRatio && aspectRatio !== "auto" ? aspectRatio : undefined;
}

function readResolution(value: unknown): SocialmediaResolution | undefined {
  const candidate = readString(value) as SocialmediaResolution | undefined;
  return candidate && RESOLUTIONS.has(candidate) ? candidate : undefined;
}

function readImageCount(value: unknown): SocialmediaImageCount | undefined {
  return typeof value === "number" && IMAGE_COUNTS.has(value as SocialmediaImageCount)
    ? value as SocialmediaImageCount
    : undefined;
}

function readOutputFormat(value: unknown): SocialmediaOutputFormat | undefined {
  const candidate = readString(value) as SocialmediaOutputFormat | undefined;
  return candidate && OUTPUT_FORMATS.has(candidate) ? candidate : undefined;
}

function readBackground(value: unknown): SocialmediaBackground | undefined {
  return value === "transparent" ? "transparent" : undefined;
}

function readImageQuality(value: unknown): "low" | "medium" | undefined {
  return value === "low" || value === "medium" ? value : undefined;
}

function readReferenceAssetIds(value: unknown, availableReferenceAssetIds: Set<string>): string[] | null {
  // With no candidates, omission is safely equivalent to an empty selection.
  // Otherwise require the model to repair the tool call instead of dropping
  // an intended reference silently.
  if (value === undefined) return availableReferenceAssetIds.size === 0 ? [] : null;
  if (!Array.isArray(value)) return null;
  const ids = Array.from(new Set(value.map(readString).filter((item): item is string => Boolean(item))));
  return ids.length === value.length
    && ids.length <= MAX_AGENT_INPUT_IMAGES
    && ids.every((id) => availableReferenceAssetIds.has(id))
    ? ids
    : null;
}

function textFrom(response: ResponsesEnvelope): string {
  const outputText = response.output
    ?.flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
  return outputText || response.output_text?.trim() || "";
}

/**
 * A model occasionally writes the arguments intended for a function call as
 * regular output. Those fields are implementation details, never chat copy.
 */
function isLeakedCommandJson(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
    const record = parsed as Record<string, unknown>;
    return [
      "prompt",
      "assistant_reply",
      "aspect_ratio",
      "resolution",
      "image_count",
      "output_format",
      "background",
      "generation_quality",
      "target_job_id",
      "target_asset_id"
    ].some((key) => key in record);
  } catch {
    return false;
  }
}

function userVisibleReply(value: string | undefined): string | undefined {
  const reply = value?.trim();
  return reply && !isLeakedCommandJson(reply) ? reply : undefined;
}

function commandJsonFallback(language: string): string {
  return language.toLowerCase().startsWith("zh")
    ? "刚才的回复没有正常生成，请再试一次。"
    : "That response did not complete correctly. Please try again.";
}

function isExplicitImageGenerationRequest(content: string): boolean {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  if (/\b(?:can you|could you|what(?:\s+kind)?\s+images?|who are you)\b/i.test(normalized) || /(你能|能不能|可以不可以|什么图片|你是谁)/.test(normalized)) {
    return false;
  }
  return /(生成|创建|制作|做(?:一张|个)?|画(?:一张|个)?|出图|设计).{0,48}(图|海报|插画|广告|封面|图片|image|poster|illustration|ad|cover)/i.test(normalized)
    || /\b(?:generate|create|make|design|draw)\b.{0,48}\b(?:image|poster|illustration|advert|ad|cover|picture)\b/i.test(normalized);
}

function isConcreteExistingImageMutationRequest(content: string): boolean {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  if (/(?:能不能|可以吗|可不可以|能否|你会不会).{0,12}(?:修改|调整|编辑|改图)/.test(normalized)
    || /\b(?:can you|could you|are you able to)\b.{0,24}\b(?:edit|change|revise)\b/i.test(normalized)) {
    return false;
  }
  return /(?:不要|去掉|移除|删除|加入|添加|加上|恢复|补回|改成|换成|修改|调整|重做|重新|居中|放到|移到|清晰|分辨率|(?:1|2|4)k|3840\s*[×x*]\s*2160)/i.test(normalized)
    || /\b(?:remove|delete|add|restore|replace|change|revise|redo|regenerate|center|move|resolution|(?:1|2|4)k|3840\s*[×x*]\s*2160)\b/i.test(normalized);
}

function isPrematureSafetyRefusal(reply: string): boolean {
  const normalized = reply.replace(/\s+/g, " ").trim();
  return /(不能帮助|无法帮助|不能生成|无法生成|不能创建|无法创建|不能制作|无法制作|不可以生成|不支持生成|内容我不能)/.test(normalized)
    || /\b(?:i can(?:not|'t)|i'm unable to|cannot help|can't help|unable to)\b.{0,48}\b(?:generate|create|make|design|produce)\b/i.test(normalized);
}

function isRetryableResponseError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "TimeoutError") return true;
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) return true;
  return false;
}

function isRetryableResponseTransportError(error: unknown): boolean {
  return isRetryableResponseError(error) || error instanceof TypeError;
}

class ResponsesStreamError extends Error {
  readonly emittedText: boolean;
  readonly retryable: boolean;
  readonly providerCode?: string;
  readonly providerType?: string;
  readonly providerStatusCode?: number;

  constructor(
    message: string,
    emittedText: boolean,
    retryable: boolean,
    provider?: {
      code?: string;
      type?: string;
      statusCode?: number;
    }
  ) {
    super(message);
    this.name = "ResponsesStreamError";
    this.emittedText = emittedText;
    this.retryable = retryable;
    this.providerCode = provider?.code;
    this.providerType = provider?.type;
    this.providerStatusCode = provider?.statusCode;
  }
}

function isRetryableResponsesStreamEvent(errorRecord: Record<string, unknown> | undefined): boolean {
  return isRetryableAgentProviderFailure(errorRecord);
}

type ResponsesEnvelopeFailure = {
  message: string;
  providerCode?: string;
  providerType?: string;
  statusCode?: number;
  retryable: boolean;
  previousResponseUnavailable?: boolean;
};

function isPreviousResponseUnavailable(errorRecord: Record<string, unknown> | undefined): boolean {
  if (!errorRecord) return false;
  const providerParam = normalizeAgentProviderErrorField(errorRecord.param);
  const providerCode = normalizeAgentProviderErrorField(errorRecord.code);
  const message = typeof errorRecord.message === "string"
    ? errorRecord.message.replace(/\s+/g, " ").trim()
    : "";
  return providerParam === "previous_response_id"
    || Boolean(providerCode && /previous_response(?:_id)?_(?:not_found|expired|invalid|unavailable)/.test(providerCode))
    || /previous[_\s-]*response(?:[_\s-]*id)?.{0,80}(?:not found|expired|invalid|unavailable|does not exist)/i.test(message);
}

function readResponsesEnvelopeFailure(body: unknown): ResponsesEnvelopeFailure | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const bodyRecord = body as Record<string, unknown>;
  const status = normalizeAgentProviderErrorField(bodyRecord.status);
  if (status === "incomplete") {
    const incompleteDetails = bodyRecord.incomplete_details
      && typeof bodyRecord.incomplete_details === "object"
      && !Array.isArray(bodyRecord.incomplete_details)
      ? bodyRecord.incomplete_details as Record<string, unknown>
      : undefined;
    const reason = normalizeAgentProviderErrorField(incompleteDetails?.reason) ?? "unknown";
    const errorRecord = {
      code: reason,
      type: "response_incomplete",
      message: `Response incomplete: ${reason}`
    };
    return {
      message: `ToAPIs Responses request ended with an incomplete response (${reason}).`,
      providerCode: reason,
      providerType: "response_incomplete",
      retryable: isRetryableResponsesStreamEvent(errorRecord)
    };
  }

  const nestedError = bodyRecord.error
    && typeof bodyRecord.error === "object"
    && !Array.isArray(bodyRecord.error)
    ? bodyRecord.error as Record<string, unknown>
    : undefined;
  if (status !== "failed" && !nestedError) return undefined;
  const errorRecord = nestedError ?? bodyRecord;
  const providerCode = normalizeAgentProviderErrorField(errorRecord.code)
    ?? (isAgentContentPolicyErrorMessage(errorRecord.message) ? "content_policy" : undefined);
  const providerType = normalizeAgentProviderErrorField(errorRecord.type);
  const statusCode = readAgentProviderStatusCode(errorRecord);
  return {
    message: typeof errorRecord.message === "string"
      ? `ToAPIs Responses request failed: ${errorRecord.message}`
      : "ToAPIs Responses request returned a failed response.",
    ...(providerCode ? { providerCode } : {}),
    ...(providerType ? { providerType } : {}),
    ...(statusCode !== undefined ? { statusCode } : {}),
    retryable: isRetryableResponsesStreamEvent(errorRecord),
    ...(isPreviousResponseUnavailable(errorRecord) ? { previousResponseUnavailable: true } : {})
  };
}

class ResponsesRequestError extends Error {
  readonly failure: ToapisAgentRequestFailure;

  constructor(message: string, failure: ToapisAgentRequestFailure) {
    super(message);
    this.name = "ResponsesRequestError";
    this.failure = failure;
  }
}

function buildSafeFailureMessage(params: {
  reason: ToapisAgentRequestFailure["reason"];
  statusCode?: number;
  attemptCount: number;
}): string {
  const attemptLabel = `${params.attemptCount} attempt${params.attemptCount === 1 ? "" : "s"}`;
  if (params.reason === "toapis_http_error") {
    return `ToAPIs Responses request failed with HTTP ${params.statusCode ?? "unknown"} after ${attemptLabel}.`;
  }
  if (params.reason === "toapis_timeout") {
    return `ToAPIs Responses request timed out after ${attemptLabel}.`;
  }
  if (params.reason === "toapis_stream_error") {
    return `ToAPIs Responses stream failed after ${attemptLabel}.`;
  }
  if (params.reason === "toapis_network_error") {
    return `ToAPIs Responses network request failed after ${attemptLabel}.`;
  }
  return `ToAPIs Responses agent failed after ${attemptLabel}.`;
}

function wrapResponsesRequestError(
  error: unknown,
  attemptCount: number,
  phase?: "fetch" | "response_body"
): ResponsesRequestError {
  if (error instanceof ResponsesRequestError) return error;
  const reason: ToapisAgentRequestFailure["reason"] = error instanceof AgentContentPolicyError
    ? "toapis_http_error"
    : isRetryableResponseError(error)
    ? "toapis_timeout"
    : error instanceof ResponsesStreamError
      ? "toapis_stream_error"
      : phase && error instanceof TypeError
        ? "toapis_network_error"
        : "toapis_agent_error";
  const failure: ToapisAgentRequestFailure = {
    reason,
    ...(error instanceof AgentContentPolicyError
      ? { statusCode: error.statusCode }
      : {}),
    ...(error instanceof AgentContentPolicyError && error.providerCode
      ? { providerCode: error.providerCode }
      : {}),
    ...(error instanceof AgentContentPolicyError && error.providerType
      ? { providerType: error.providerType }
      : {}),
    ...(error instanceof ResponsesStreamError && error.providerStatusCode !== undefined
      ? { statusCode: error.providerStatusCode }
      : {}),
    ...(error instanceof ResponsesStreamError && error.providerCode
      ? { providerCode: error.providerCode }
      : {}),
    ...(error instanceof ResponsesStreamError && error.providerType
      ? { providerType: error.providerType }
      : {}),
    attemptCount,
    retryable: error instanceof AgentContentPolicyError
      ? false
      : phase
      ? isRetryableResponseTransportError(error)
      : isRetryableResponseError(error)
        || (error instanceof ResponsesStreamError && error.retryable),
    errorName: error instanceof Error ? error.name : "UnknownError",
    safeMessage: buildSafeFailureMessage({
      reason,
      statusCode: error instanceof AgentContentPolicyError ? error.statusCode : undefined,
      attemptCount
    })
  };
  return new ResponsesRequestError(
    error instanceof Error ? error.message : String(error),
    failure
  );
}

export function describeToapisAgentRequestFailure(error: unknown): ToapisAgentRequestFailure {
  if (error instanceof ResponsesRequestError) return error.failure;
  const structuredFailure = error
    && typeof error === "object"
    && "failure" in error
    ? (error as { failure?: unknown }).failure
    : undefined;
  if (
    structuredFailure
    && typeof structuredFailure === "object"
    && !Array.isArray(structuredFailure)
    && typeof (structuredFailure as Partial<ToapisAgentRequestFailure>).reason === "string"
    && typeof (structuredFailure as Partial<ToapisAgentRequestFailure>).attemptCount === "number"
    && typeof (structuredFailure as Partial<ToapisAgentRequestFailure>).retryable === "boolean"
    && typeof (structuredFailure as Partial<ToapisAgentRequestFailure>).errorName === "string"
    && typeof (structuredFailure as Partial<ToapisAgentRequestFailure>).safeMessage === "string"
  ) {
    return structuredFailure as ToapisAgentRequestFailure;
  }
  return wrapResponsesRequestError(error, 1).failure;
}

async function waitBeforeResponseRetry(attempt: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, RESPONSE_RETRY_BASE_DELAY_MS * (2 ** attempt)));
}

async function readStreamingResponse(
  response: Response,
  onAssistantDelta: (delta: string) => void,
  deferDeltasUntilComplete = true
): Promise<ResponsesEnvelope> {
  if (!response.body) throw new ResponsesStreamError("ToAPIs Responses stream returned no body.", false, true);
  const reader = response.body.getReader();
  const cancelReader = () => {
    try {
      void reader.cancel().catch(() => undefined);
    } catch {
      // Best-effort cleanup must not replace the stream result or failure.
    }
  };
  const decoder = new TextDecoder();
  let buffer = "";
  let completedResponse: ResponsesEnvelope | undefined;
  let emittedText = false;
  const pendingDeltas: string[] = [];

  const handleBlock = (block: string) => {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
      .trim();
    if (!data || data === "[DONE]") return;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(data) as Record<string, unknown>;
    } catch {
      return;
    }
    if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
      emittedText = true;
      if (deferDeltasUntilComplete) {
        pendingDeltas.push(event.delta);
      } else if (
        pendingDeltas.length > 0
        || /^[\s]*[\[{]/.test(event.delta)
      ) {
        // A JSON-looking first chunk may be an internal command leaked as text.
        // Hold the whole reply until the completed response can be validated.
        pendingDeltas.push(event.delta);
      } else {
        onAssistantDelta(event.delta);
      }
      return;
    }
    if (event.type === "response.completed" && event.response && typeof event.response === "object") {
      completedResponse = event.response as ResponsesEnvelope;
      return;
    }
    if (event.type === "response.incomplete") {
      const responseRecord = event.response && typeof event.response === "object"
        ? event.response as Record<string, unknown>
        : undefined;
      const incompleteDetails = responseRecord?.incomplete_details
        && typeof responseRecord.incomplete_details === "object"
        ? responseRecord.incomplete_details as Record<string, unknown>
        : undefined;
      const incompleteReason = typeof incompleteDetails?.reason === "string"
        ? incompleteDetails.reason
        : "unknown";
      throw new ResponsesStreamError(
        `ToAPIs Responses stream ended with an incomplete terminal response (${incompleteReason}).`,
        emittedText,
        false,
        {
          code: normalizeAgentProviderErrorField(incompleteReason),
          type: "response_incomplete"
        }
      );
    }
    if (event.type === "error" || event.type === "response.failed") {
      const responseRecord = event.response && typeof event.response === "object"
        ? event.response as Record<string, unknown>
        : undefined;
      const eventError = event.error && typeof event.error === "object"
        ? event.error as Record<string, unknown>
        : undefined;
      const responseError = responseRecord?.error && typeof responseRecord.error === "object"
        ? responseRecord.error as Record<string, unknown>
        : undefined;
      const errorRecord = eventError
        ? { ...event, ...eventError }
        : responseError
          ? { ...responseRecord, ...responseError }
          : event.type === "error"
            ? event
            : responseRecord;
      throw new ResponsesStreamError(
        typeof errorRecord?.message === "string"
          ? `ToAPIs Responses stream failed: ${errorRecord.message}`
          : "ToAPIs Responses stream failed.",
        emittedText,
        isRetryableResponsesStreamEvent(errorRecord),
        {
          code: normalizeAgentProviderErrorField(errorRecord?.code)
            ?? (isAgentContentPolicyErrorMessage(errorRecord?.message) ? "content_policy" : undefined),
          type: normalizeAgentProviderErrorField(errorRecord?.type),
          statusCode: readAgentProviderStatusCode(errorRecord)
        }
      );
    }
  };

  try {
    while (!completedResponse) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        handleBlock(block);
        if (completedResponse) break;
      }
    }
    if (!completedResponse && buffer.trim()) handleBlock(buffer);
  } catch (error) {
    cancelReader();
    if (error instanceof ResponsesStreamError) throw error;
    throw new ResponsesStreamError(
      error instanceof Error
        ? `ToAPIs Responses stream transport failed: ${error.message}`
        : "ToAPIs Responses stream transport failed.",
      emittedText,
      true
    );
  }
  if (!completedResponse) {
    throw new ResponsesStreamError("ToAPIs Responses stream ended before completion.", emittedText, true);
  }
  // A terminal response is authoritative. Do not wait for the transport to
  // close because an upstream reset after response.completed must not discard
  // an otherwise successful result.
  cancelReader();
  // Wait for the completed response before exposing streamed text. This keeps
  // malformed command JSON from briefly flashing in the conversation UI.
  if (
    (deferDeltasUntilComplete || pendingDeltas.length > 0)
    && !isLeakedCommandJson(textFrom(completedResponse))
  ) {
    for (const delta of pendingDeltas) onAssistantDelta(delta);
  }
  return completedResponse;
}

async function createResponse(
  payload: Record<string, unknown>,
  onAssistantDelta?: (delta: string) => void,
  options?: {
    deferDeltasUntilComplete?: boolean;
    onAssistantReset?: () => void;
    onHttpAttempt?: () => void;
  },
  provider: ResponsesAgentProviderConfig = appConfig.toapisResponses,
  maxAttempts = MAX_RESPONSE_HTTP_ATTEMPTS
): Promise<ResponsesEnvelope> {
  const config = provider;
  const requestAttempts = Math.max(1, Math.round(maxAttempts));
  const networkAttempts = Math.min(MAX_RESPONSE_NETWORK_ATTEMPTS, requestAttempts);
  let lastError: unknown;
  let streamEnabled = Boolean(onAssistantDelta);
  let networkFailureCount = 0;
  for (let attempt = 0; attempt < requestAttempts; attempt += 1) {
    let requestBody: string;
    try {
      requestBody = JSON.stringify(streamEnabled ? { ...payload, stream: true } : payload);
    } catch (error) {
      throw wrapResponsesRequestError(error, attempt + 1);
    }
    let response: Response;
    try {
      options?.onHttpAttempt?.();
      response = await fetch(config.apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: requestBody,
        cache: "no-store",
        signal: AbortSignal.timeout(config.timeoutMs)
      });
    } catch (error) {
      lastError = error;
      networkFailureCount += 1;
      if (
        !isRetryableResponseTransportError(error)
        || networkFailureCount >= networkAttempts
        || attempt + 1 >= requestAttempts
      ) {
        throw wrapResponsesRequestError(error, attempt + 1, "fetch");
      }
      continue;
    }

    if (response.ok && streamEnabled && onAssistantDelta) {
      try {
        return await readStreamingResponse(
          response,
          onAssistantDelta,
          options?.deferDeltasUntilComplete !== false
        );
      } catch (error) {
        lastError = error;
        if (
          error instanceof ResponsesStreamError
          && error.emittedText
          && options?.deferDeltasUntilComplete === false
        ) {
          options.onAssistantReset?.();
        }
        if (
          error instanceof ResponsesStreamError
          && error.retryable
          && attempt + 1 < requestAttempts
        ) {
          streamEnabled = false;
          continue;
        }
        throw wrapResponsesRequestError(error, attempt + 1);
      }
    }

    let rawBody: string;
    try {
      rawBody = await response.text();
    } catch (error) {
      lastError = error;
      networkFailureCount += 1;
      if (
        isRetryableResponseTransportError(error)
        && networkFailureCount < networkAttempts
        && attempt + 1 < requestAttempts
      ) {
        continue;
      }
      throw wrapResponsesRequestError(error, attempt + 1, "response_body");
    }
    let body: unknown = {};
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      body = { raw: rawBody };
    }
    if (!response.ok) {
      const bodyRecord = body && typeof body === "object" && !Array.isArray(body)
        ? body as Record<string, unknown>
        : undefined;
      const nestedError = bodyRecord?.error && typeof bodyRecord.error === "object" && !Array.isArray(bodyRecord.error)
        ? bodyRecord.error as Record<string, unknown>
        : undefined;
      const providerError = nestedError ?? bodyRecord;
      const providerCode = normalizeAgentProviderErrorField(providerError?.code)
        ?? (isAgentContentPolicyErrorMessage(providerError?.message) ? "content_policy" : undefined);
      const providerType = normalizeAgentProviderErrorField(providerError?.type);
      const retryable = isRetryableResponsesStreamEvent({
        ...providerError,
        status: response.status
      });
      const failure: ToapisAgentRequestFailure = {
        reason: "toapis_http_error",
        statusCode: response.status,
        ...(providerCode ? { providerCode } : {}),
        ...(providerType ? { providerType } : {}),
        attemptCount: attempt + 1,
        retryable,
        ...(isPreviousResponseUnavailable(providerError) ? { previousResponseUnavailable: true } : {}),
        errorName: "ResponsesHttpError",
        safeMessage: buildSafeFailureMessage({
          reason: "toapis_http_error",
          statusCode: response.status,
          attemptCount: attempt + 1
        })
      };
      const error = new ResponsesRequestError(
        `ToAPIs Responses request failed: ${response.status} ${JSON.stringify(body)}`,
        failure
      );
      if (retryable && attempt + 1 < requestAttempts) {
        lastError = error;
        await waitBeforeResponseRetry(attempt);
        continue;
      }
      throw error;
    }
    const envelopeFailure = readResponsesEnvelopeFailure(body);
    if (envelopeFailure) {
      const failure: ToapisAgentRequestFailure = {
        reason: "toapis_agent_error",
        ...(envelopeFailure.statusCode !== undefined
          ? { statusCode: envelopeFailure.statusCode }
          : {}),
        ...(envelopeFailure.providerCode
          ? { providerCode: envelopeFailure.providerCode }
          : {}),
        ...(envelopeFailure.providerType
          ? { providerType: envelopeFailure.providerType }
          : {}),
        attemptCount: attempt + 1,
        retryable: envelopeFailure.retryable,
        ...(envelopeFailure.previousResponseUnavailable ? { previousResponseUnavailable: true } : {}),
        errorName: "ResponsesEnvelopeError",
        safeMessage: buildSafeFailureMessage({
          reason: "toapis_agent_error",
          attemptCount: attempt + 1
        })
      };
      const error = new ResponsesRequestError(envelopeFailure.message, failure);
      if (envelopeFailure.retryable && attempt + 1 < requestAttempts) {
        lastError = error;
        await waitBeforeResponseRetry(attempt);
        continue;
      }
      throw error;
    }
    return body as ResponsesEnvelope;
  }
  throw wrapResponsesRequestError(lastError, requestAttempts);
}

function parseMissingCreationToolDecision(value: string): MissingCreationToolDecision | undefined {
  const decision = readString(parseArguments(value).decision);
  return decision === "conversation" || decision === "clarify" || decision === "must_create"
    ? decision
    : undefined;
}

async function judgeMissingCreationTool(params: {
  input: AgentInput;
  reply: string;
  completedImageCount: number;
  selectedTargetCount: number;
  provider: ResponsesAgentProviderConfig;
  maxRequestAttempts: number;
}): Promise<MissingCreationToolDecision | undefined> {
  const response = await createResponse({
    model: params.provider.model,
    instructions: [
      "You are an internal state validator for an image-creation assistant.",
      "The main assistant has finished a turn with conversation_done and made no function call. Decide whether the turn must create or revise an image before it can be considered complete.",
      "CORE CREATION DECISION RULE: if the user asks to create a visual but supplies zero creative attributes, return clarify; if the user clearly asks to create a visual and supplies at least one creative attribute, return must_create. Never require more than one attribute before creation.",
      "A visual deliverable type is not an attribute. Image, photo, illustration, flyer, poster, banner, ad, logo, icon, business card, invitation, cover, sticker, wallpaper, tattoo, mockup, portrait, and social media post only name the output type. A usable subject, purpose, audience, scene, object, product, brand or business identity, event, visible copy, style, color, mood, composition, attached reference, or unambiguous user-provided conversation direction counts as an attribute. Thus 'Make a flyer' and 'I need to make a logo' are clarify, while 'Make a beauty salon flyer' and 'Make a logo for Vismuse' are must_create.",
      "Use semantic intent, not keyword matching. A concise follow-up that supplies a visual style, color palette, theme, or transformation for an existing visual is an actionable image operation even when it omits words such as create, generate, edit, image, or flyer. For example, 'frank ocean themed and make them pink and white' is a must_create request when the session has a prior visual or reference context.",
      "REFERENCE CLARIFICATION LIMIT: when usable reference images are present, the assistant may clarify their intended use at most once. If the current user turn is a brief confirmation or otherwise continues the same reference-image task, return must_create even when optional choices remain unresolved. The assistant must choose sensible defaults and execute; never return clarify merely to repeat or rephrase how the reference images should be used.",
      "A brief confirmation such as yes, okay, do it, go ahead, sure, or an equivalent reply is sufficient continuation of the reference-image task when current_turn_has_reference_assets is true. In that state, an assistant reply that asks another question about what to create or how to use the reference is invalid; return must_create.",
      "When blocked_reference_asset_count is greater than zero, a reply that explains the selected reference cannot currently be used and asks the user to replace/remove it or explicitly proceed without it is a valid conversation. Do not force creation from that blocked reference and do not treat silently dropping it as must_create.",
      "Return must_create when the user requested an actionable image operation now, or when the assistant claims that an image was started, made, generated, created, completed, or delivered. Return clarify only when a concise question is genuinely needed before an image operation. Return conversation only for ordinary discussion, capability questions, or a valid non-execution reply.",
      "Return conversation for a future-conditional material handoff: the user says they will send, provide, or upload required images, copy, event details, or other materials later and asks whether the deliverable can be created after receiving them. That turn must only confirm capability and request the materials, even if the user already specified the number or type of outputs. A later turn that actually supplies those materials can be actionable.",
      "This validator is called only after the semantic scope router found image-execution intent. Treat that execution intent as authoritative: return must_create unless the request genuinely lacks one necessary creative attribute or a required revision value, in which case return clarify. Do not downgrade a declarative brief to conversation merely because it omits create/generate wording.",
      "Use the actual state as ground truth: no image creation or revision tool was called in this turn. A reply must never claim that the current request was started, made, generated, created, completed, or delivered without choosing must_create.",
      "Return exactly one JSON object and no other text: {\"decision\":\"conversation\"}, {\"decision\":\"clarify\"}, or {\"decision\":\"must_create\"}."
    ].join(" "),
    input: JSON.stringify({
      user_request: params.input.content,
      assistant_reply: params.reply,
      conversation_context: params.input.conversationContext,
      actual_state: {
        terminal_event: "conversation_done",
        creation_or_revision_tool_called: false,
        completed_image_count: params.completedImageCount,
        selected_target_count: params.selectedTargetCount,
        has_reference_assets_in_this_turn: params.input.currentHasReferenceAssets
      },
      request_signals: {
        current_turn_has_reference_assets: params.input.currentHasReferenceAssets,
        blocked_reference_asset_count: params.input.blockedReferenceAssets?.length ?? 0,
        session_has_completed_images: params.completedImageCount > 0,
        selected_target_count: params.selectedTargetCount
      }
    })
  }, undefined, undefined, params.provider, params.maxRequestAttempts);
  return parseMissingCreationToolDecision(textFrom(response));
}

async function judgeHistoricalMaterialHandoff(params: {
  input: AgentInput;
  priorResult?: ReturnType<typeof buildSessionSnapshot>[number];
  provider: ResponsesAgentProviderConfig;
  maxRequestAttempts: number;
}): Promise<HistoricalMaterialHandoffDecision | undefined> {
  const response = await createResponse({
    model: params.provider.model,
    instructions: [
      "You are an internal context-boundary validator for an image-creation assistant.",
      "Decide whether the latest user turn is supplying missing materials or details for the immediately prior unfinished multi-image deliverable, or is instead a new request.",
      "Return continue_multi only when the latest turn semantically continues that prior deliverable and the prior result count does not fulfill all requested outputs. For continue_multi, calculate the exact total requested output count, including every individual design plus any combined/master design.",
      "Return new_request for a fresh design, a new style/reference replacement, an unrelated task, an ambiguous relationship, or any stale historical plan. The latest user message is authoritative; never revive an old plan merely because it exists.",
      "Use semantic intent, not keyword matching.",
      "Return exactly one JSON object and no other text: {\"decision\":\"continue_multi\",\"expected_output_count\":2} or {\"decision\":\"new_request\"}. expected_output_count must be the exact integer total from 2 through 8."
    ].join(" "),
    input: JSON.stringify({
      prior_request: params.priorResult?.request_summary,
      prior_result_count: params.priorResult?.images.length ?? 0,
      latest_user_request: params.input.content,
      current_upload_count: params.input.currentReferenceAssets?.length ?? 0
    })
  }, undefined, undefined, params.provider, params.maxRequestAttempts);
  const parsed = parseArguments(textFrom(response));
  const decision = readString(parsed.decision);
  if (decision === "new_request") return { decision };
  const expectedOutputCount = readImageCount(parsed.expected_output_count);
  return decision === "continue_multi"
    && typeof expectedOutputCount === "number"
    && expectedOutputCount > 1
    ? { decision, expectedOutputCount }
    : undefined;
}

function creationNotStartedFallback(language: string): string {
  return language.toLowerCase().startsWith("zh")
    ? "图片任务没有成功启动，请再试一次。"
    : "The image job did not start successfully. Please try again.";
}

function conversationValidationUnavailableFallback(language: string): string {
  return language.toLowerCase().startsWith("zh")
    ? "我暂时无法确认这次请求的处理状态，请再试一次。"
    : "I couldn't verify the state of this request. Please try again.";
}

function replyRoute(): AgentIntentRoute {
  return {
    intent: "smalltalk",
    inputType: "text",
    confidence: 1,
    reason: "agent_replied_without_creation_tool",
    replyMode: "discussion",
    taskAction: "none",
    targetScope: "none",
    executionState: "none"
  };
}

function clarifyRoute(): AgentIntentRoute {
  return {
    intent: "unclear",
    inputType: "text",
    confidence: 1,
    reason: "agent_requested_missing_creative_attribute",
    replyMode: "clarify",
    taskAction: "none",
    targetScope: "none",
    executionState: "none"
  };
}

function commandRoute(command: AgentCommand): AgentIntentRoute {
  return command.kind === "generate" || command.kind === "generate_outputs"
    ? {
        intent: "content_task",
        inputType: "text",
        confidence: 1,
        reason: command.kind === "generate_outputs"
          ? "agent_called_create_multi_output_image_generation"
          : "agent_called_create_image_generation",
        replyMode: "execution",
        taskAction: "create_task",
        targetScope: "none",
        executionState: "none"
      }
    : {
        intent: "content_task",
        inputType: "text",
        confidence: 1,
        reason: command.kind === "revise_outputs"
          ? "agent_called_create_multi_output_image_revision"
          : "agent_called_create_image_revision",
        replyMode: "execution",
        taskAction: "revise_latest",
        targetScope: "mixed",
        executionState: "none"
      };
}

function parseGenerateCommand(
  args: Record<string, unknown>,
  availableReferenceAssetIds: Set<string>
): GenerateCommand | null {
  const prompt = readString(args.prompt);
  const referenceAssetIds = readReferenceAssetIds(args.reference_asset_ids, availableReferenceAssetIds);
  if (!prompt || !referenceAssetIds) return null;
  return {
    kind: "generate",
    prompt,
    referenceAssetIds,
    sessionTitle: readSessionTitle(args.session_title),
    aspectRatio: readAspectRatio(args.aspect_ratio),
    resolution: readResolution(args.resolution),
    imageCount: args.force_single_output === true ? 1 : undefined,
    outputFormat: readOutputFormat(args.output_format),
    background: readBackground(args.background),
    imageQuality: readImageQuality(args.generation_quality),
    assistantReply: readString(args.assistant_reply)
  };
}

function parseRevisionCommand(
  args: Record<string, unknown>,
  assets: Map<string, SessionAsset>,
  availableReferenceAssetIds: Set<string>
): ReviseCommand | null {
  const prompt = readString(args.prompt);
  const targetJobId = readString(args.target_job_id);
  const targetAssetId = readString(args.target_asset_id);
  const referenceAssetIds = readReferenceAssetIds(args.reference_asset_ids, availableReferenceAssetIds);
  if (!prompt || !targetJobId || !targetAssetId || !referenceAssetIds) return null;
  const asset = assets.get(targetAssetId);
  if (!asset || asset.jobId !== targetJobId) return null;
  return {
    kind: "revise",
    prompt,
    targetJobId,
    targetAssetId,
    referenceAssetIds,
    aspectRatio: readAspectRatio(args.aspect_ratio),
    resolution: readResolution(args.resolution),
    imageCount: args.force_single_output === true ? 1 : undefined,
    outputFormat: readOutputFormat(args.output_format),
    background: readBackground(args.background),
    imageQuality: readImageQuality(args.generation_quality),
    assistantReply: readString(args.assistant_reply)
  };
}

function parseMultiOutputInstructions(value: unknown): SocialmediaAgentOutputInstruction[] | null {
  if (!Array.isArray(value)) return null;
  const outputs = value
    .map((item): SocialmediaAgentOutputInstruction | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const label = readString(record.label);
      const prompt = readString(record.prompt);
      return label && prompt ? { label, prompt } : null;
    })
    .filter((item): item is SocialmediaAgentOutputInstruction => Boolean(item))
    .slice(0, 8);
  return outputs.length >= 2 && outputs.length === value.length ? outputs : null;
}

function parseMultiOutputGenerationCommand(
  args: Record<string, unknown>,
  availableReferenceAssetIds: Set<string>
): MultiOutputGenerationCommand | null {
  const outputs = parseMultiOutputInstructions(args.outputs);
  const aspectRatio = readStandaloneAspectRatio(args.aspect_ratio);
  const referenceAssetIds = readReferenceAssetIds(args.reference_asset_ids, availableReferenceAssetIds);
  if (!outputs || !aspectRatio || !referenceAssetIds) return null;
  return {
    kind: "generate_outputs",
    outputs,
    referenceAssetIds,
    sessionTitle: readSessionTitle(args.session_title),
    aspectRatio,
    resolution: readResolution(args.resolution),
    outputFormat: readOutputFormat(args.output_format),
    background: readBackground(args.background),
    imageQuality: readImageQuality(args.generation_quality),
    assistantReply: readString(args.assistant_reply)
  };
}

function parseMultiOutputRevisionCommand(
  args: Record<string, unknown>,
  assets: Map<string, SessionAsset>,
  availableReferenceAssetIds: Set<string>
): MultiOutputRevisionCommand | null {
  const targetJobId = readString(args.target_job_id);
  const targetAssetId = readString(args.target_asset_id);
  if (!targetJobId || !targetAssetId) return null;
  const asset = assets.get(targetAssetId);
  if (!asset || asset.jobId !== targetJobId) return null;
  const outputs = parseMultiOutputInstructions(args.outputs);
  const aspectRatio = readStandaloneAspectRatio(args.aspect_ratio);
  const referenceAssetIds = readReferenceAssetIds(args.reference_asset_ids, availableReferenceAssetIds);
  if (!outputs || !aspectRatio || !referenceAssetIds) return null;

  return {
    kind: "revise_outputs",
    targetJobId,
    targetAssetId,
    referenceAssetIds,
    outputs,
    aspectRatio,
    resolution: readResolution(args.resolution),
    outputFormat: readOutputFormat(args.output_format),
    background: readBackground(args.background),
    imageQuality: readImageQuality(args.generation_quality),
    assistantReply: readString(args.assistant_reply)
  };
}

function parseWorkspaceHandoffCommand(args: Record<string, unknown>): WorkspaceHandoffCommand | null {
  if (args.target !== "video_generator") return null;
  return {
    assistantReply: readString(args.assistant_reply),
    cta: {
      target: "video_generator",
      href: "/ai-video-generator",
      label: "Open AI Video Generator"
    }
  };
}

function parseWatermarkUpgradeCommand(
  args: Record<string, unknown>,
  assets: Map<string, SessionAsset>
): WatermarkUpgradeCommand | null {
  const targetJobId = readString(args.target_job_id);
  const targetAssetId = readString(args.target_asset_id);
  if (!targetJobId || !targetAssetId) return null;
  const asset = assets.get(targetAssetId);
  if (!asset || asset.jobId !== targetJobId || asset.accessVariant !== "watermarked") return null;
  return {
    targetJobId,
    targetAssetId,
    assistantReply: readString(args.assistant_reply)
  };
}

async function closeCommandToolCall(params: {
  response: ResponsesEnvelope;
  callId: string;
  model: string;
  language: string;
  workspace: AgentWorkspaceContext;
  output: Record<string, unknown>;
  onAssistantDelta?: (delta: string) => void;
  onAssistantReset?: () => void;
  createAgentResponse: (
    payload: Record<string, unknown>,
    options?: {
      onAssistantDelta?: (delta: string) => void;
      deferDeltasUntilComplete?: boolean;
      onAssistantReset?: () => void;
    }
  ) => Promise<ResponsesEnvelope>;
}): Promise<ResponsesEnvelope> {
  return params.createAgentResponse({
    model: params.model,
    instructions: instructions(params.language, params.workspace),
    previous_response_id: params.response.id,
    input: [{
      type: "function_call_output",
      call_id: params.callId,
      output: JSON.stringify(params.output)
    }]
  }, {
    onAssistantDelta: params.onAssistantDelta,
    // Once a command tool has been accepted there is no longer an unvalidated
    // image action to hide. Stream the closing user-facing reply immediately;
    // the API will still send assistant_result as the authoritative final text.
    deferDeltasUntilComplete: !params.onAssistantReset,
    onAssistantReset: params.onAssistantReset
  });
}

function toClientHistoryItems(input: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(input)) {
    return input.filter(
      (item): item is Record<string, unknown> => Boolean(item)
        && typeof item === "object"
        && !Array.isArray(item)
    );
  }
  return typeof input === "string"
    ? [{
        role: "user",
        content: [{ type: "input_text", text: input }]
      }]
    : [];
}

export async function routeToapisImageIntent(
  input: AgentInput,
  options: ResponsesAgentRouteOptions = {}
): Promise<ToapisImageIntentDecision | null> {
  const config = options.provider ?? appConfig.toapisResponses;
  const contextStrategy = options.contextStrategy ?? "previous_response_id";
  const maxRequestAttempts = options.maxRequestAttempts ?? MAX_RESPONSE_HTTP_ATTEMPTS;
  if (!config.enabled || !config.apiKey) return null;
  const metricsStartedAt = Date.now();
  let logicalRequestCount = 0;
  let httpAttemptCount = 0;
  let correctionCount = 0;
  try {
  const scopeDecision = await classifyCreativeScope({
    content: input.content,
    previousResponseId: contextStrategy === "previous_response_id"
      ? input.previousResponseId
      : undefined,
    conversationContext: input.conversationContext,
    workspace: "image_generator",
    onDiagnostic: input.onScopeDiagnostic,
    provider: config
  });
  if (scopeDecision?.scope === "out_of_scope") {
    return {
      intentRoute: replyRoute(),
      assistantReply: creativeScopeRedirect(input.responseLanguage),
      requiresImageOperation: false
    };
  }

  const includeSessionHistory = input.includeSessionHistory ?? !input.previousResponseId;
  const snapshot = buildSessionSnapshot(input.sessionJobs);
  const latestCompletedResult = snapshot[0];
  const historyJobs = input.historySessionJobs ?? input.sessionJobs;
  const historySnapshot = includeSessionHistory ? buildSessionSnapshot(historyJobs) : undefined;
  const selectedTargets = input.currentTargetAssets ?? [];
  const assetIndex = buildAssetIndex(input.sessionJobs, selectedTargets);
  const availableReferenceAssets = input.availableReferenceAssets ?? [];
  const availableReferenceAssetIds = new Set(availableReferenceAssets.map((asset) => asset.assetId));
  const workspace = resolveWorkspaceContext(input.sourceUseCase);
  const currentGenerationParameters = input.currentGenerationParameters ?? {
    aspectRatio: "auto" as const,
    resolution: "1k" as const,
    imageCount: "auto" as const,
    outputFormat: "png" as const
  };
  const serializedAgentRequest = JSON.stringify({
      user_message: input.content,
      request_context: {
        session_id: input.sessionId,
        has_reference_assets_in_this_turn: input.currentHasReferenceAssets,
        available_reference_assets: availableReferenceAssets.map((asset) => ({
          asset_id: asset.assetId,
          original_name: asset.originalName
        })),
        pinned_reference_assets: (input.pinnedReferenceAssets ?? []).map((asset) => ({
          asset_id: asset.assetId,
          original_name: asset.originalName
        })),
        blocked_reference_assets: (input.blockedReferenceAssets ?? []).map((asset) => ({
          asset_id: asset.assetId,
          original_name: asset.originalName
        })),
        current_generation_parameters: {
          aspect_ratio: currentGenerationParameters.aspectRatio,
          resolution: currentGenerationParameters.resolution,
          image_count: currentGenerationParameters.imageCount,
          output_format: currentGenerationParameters.outputFormat,
          requested_output_size: currentGenerationParameters.requestedOutputSize
            ? {
                width: currentGenerationParameters.requestedOutputSize.width,
                height: currentGenerationParameters.requestedOutputSize.height
              }
            : undefined
        },
        image_generation_capabilities: {
          supported_aspect_ratios: [...ASPECT_RATIOS],
          supported_resolution_tiers: [...RESOLUTIONS],
          supported_image_counts: [...IMAGE_COUNTS],
          supported_output_formats: [...OUTPUT_FORMATS],
          exact_dimension_policy: "Map an exact pixel request to the closest supported tier. For user-provided alternatives, select the largest usable option by default and generate without asking a clarification question."
        },
        requested_output_size: input.requestedOutputSize
          ? {
              width: input.requestedOutputSize.width,
              height: input.requestedOutputSize.height,
              aspect_ratio: input.requestedOutputSize.aspectRatio
            }
          : undefined,
        selected_target_assets: selectedTargets.map((target) => ({
          target_job_id: target.targetJobId,
          target_asset_id: target.targetAssetId,
          image_number: (target.imageIndex ?? 0) + 1
        })),
        explicit_parent_job_id: input.explicitParentJobId,
        safety_followup: input.safetyFollowupPrompt
          ? {
              resolved_safe_instruction: input.safetyFollowupPrompt,
              resolved_task_action: input.safetyFollowupAction,
              source: "role_aware_session_resolution"
            }
          : undefined,
        conversation_context: includeSessionHistory ? input.conversationContext : undefined,
        latest_completed_result: latestCompletedResult,
        available_session_results: historySnapshot,
        recent_request_statuses: includeSessionHistory ? buildRecentRequestStatuses(historyJobs) : undefined,
        workspace: {
          name: workspace.name,
          specialty: workspace.specialty,
          directly_available_capability: "image_creation",
          available_handoffs: [{ target: "video_generator", label: "Open AI Video Generator" }]
        }
      }
    });
  const agentTools = tools;
  const initialRequest = {
    model: config.model,
    instructions: instructions(input.responseLanguage, workspace),
    ...(contextStrategy === "previous_response_id" && input.previousResponseId
      ? { previous_response_id: input.previousResponseId }
      : {}),
    input: buildInitialAgentInput({
      serializedRequest: serializedAgentRequest,
      content: input.content,
      selectedTargets,
      latestCompletedResult,
      assets: assetIndex,
      currentReferenceAssets: input.currentReferenceAssets ?? [],
      bootstrapReferenceAssets: input.bootstrapReferenceAssets ?? []
    }),
    tools: agentTools,
    tool_choice: "auto"
  };
  const pendingAssistantDeltas: string[] = [];
  const canStreamConversationImmediately = Boolean(
    input.onAssistantDelta
    && input.onAssistantReset
    && scopeDecision
    && !scopeDecision.requiresImageOperation
    && !looksLikeSubscriptionPlanQuestion(input.content)
  );
  let streamedConversationText = "";
  let conversationStreamReset = false;
  let suppressConversationStream = false;
  const resetStreamedConversation = () => {
    if (conversationStreamReset || !streamedConversationText) return;
    conversationStreamReset = true;
    input.onAssistantReset?.();
  };
  const streamValidatedConversationDelta = (delta: string) => {
    if (!input.onAssistantDelta || suppressConversationStream) return;
    const nextText = `${streamedConversationText}${delta}`;
    if (isUnrelatedTechnicalAgentReply(input.content, nextText)) {
      suppressConversationStream = true;
      resetStreamedConversation();
      return;
    }
    streamedConversationText = nextText;
    input.onAssistantDelta(delta);
  };
  const bufferAssistantDelta = input.onAssistantDelta
    ? canStreamConversationImmediately
      ? streamValidatedConversationDelta
      : (delta: string) => pendingAssistantDeltas.push(delta)
    : undefined;
  const flushAssistantDeltas = () => {
    if (!input.onAssistantDelta) return;
    for (const delta of pendingAssistantDeltas.splice(0)) input.onAssistantDelta(delta);
  };
  let clientHistory: Array<Record<string, unknown>> = [];
  let clientHistoryStarted = false;
  const createAgentResponse = async (
    payload: Record<string, unknown>,
    requestOptions?: {
      onAssistantDelta?: (delta: string) => void;
      deferDeltasUntilComplete?: boolean;
      onAssistantReset?: () => void;
    }
  ) => {
    logicalRequestCount += 1;
    const nextInputItems = contextStrategy === "client_history"
      ? toClientHistoryItems(payload.input)
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
    const hasCustomDeltaHandler = Boolean(
      requestOptions && Object.prototype.hasOwnProperty.call(requestOptions, "onAssistantDelta")
    );
    const response = await createResponse(
      requestPayload,
      hasCustomDeltaHandler ? requestOptions?.onAssistantDelta : bufferAssistantDelta,
      {
        deferDeltasUntilComplete: requestOptions?.deferDeltasUntilComplete
          ?? !canStreamConversationImmediately,
        onAssistantReset: requestOptions?.onAssistantReset ?? input.onAssistantReset,
        onHttpAttempt: () => {
          httpAttemptCount += 1;
        }
      },
      config,
      maxRequestAttempts
    );
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
  let response = await createAgentResponse(initialRequest);

  let emptyResponseRecoveries = 0;
  let missingCreationStateRecoveries = 0;
  let missingMutationToolRecoveries = 0;
  let leakedCommandJsonRecoveries = 0;
  let missingSubscriptionQueryRecoveries = 0;
  let adjacentHandoffCoverageRecoveries = 0;
  let multiOutputCoverageRecoveries = 0;
  let historicalMaterialHandoffDecision: HistoricalMaterialHandoffDecision | undefined;
  let historicalMaterialHandoffJudged = false;
  let subscriptionCatalogQueried = false;
  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const calls = (response.output ?? []).filter(
      (item) => item.type === "function_call" && item.call_id && item.name
    );

    if (!calls.length) {
      const reply = textFrom(response);
      if (
        reply
        && looksLikeSubscriptionPlanQuestion(input.content)
        && !subscriptionCatalogQueried
        && missingSubscriptionQueryRecoveries < MAX_MISSING_SUBSCRIPTION_QUERY_RECOVERIES
      ) {
        missingSubscriptionQueryRecoveries += 1;
        correctionCount += 1;
        response = await createAgentResponse(response.id
          ? {
              model: config.model,
              instructions: instructions(input.responseLanguage, workspace),
              previous_response_id: response.id,
              input: "You must call query_subscription_plans before answering this subscription or pricing question. Do not use plan names, prices, credits, or billing intervals from memory.",
              tools: agentTools,
              tool_choice: "auto"
            }
          : initialRequest);
        continue;
      }
      if (reply && isLeakedCommandJson(reply)) {
        if (leakedCommandJsonRecoveries < MAX_LEAKED_COMMAND_JSON_RECOVERIES) {
          leakedCommandJsonRecoveries += 1;
          correctionCount += 1;
          response = await createAgentResponse(response.id
            ? {
                model: config.model,
                instructions: instructions(input.responseLanguage, workspace),
                previous_response_id: response.id,
                input: "Your previous output exposed internal command JSON. Do not return JSON, tool arguments, prompts, aspect ratios, or resolution fields as assistant text. For an actionable image request, call the appropriate function now; otherwise reply in one short natural-language sentence.",
                tools: agentTools,
                tool_choice: "auto"
              }
            : initialRequest);
          continue;
        }
        return {
          intentRoute: replyRoute(),
          assistantReply: commandJsonFallback(input.responseLanguage),
          responseId: response.id
        };
      }
      if (
        reply
        && snapshot.length > 0
        && scopeDecision?.requiresImageOperation
        && isConcreteExistingImageMutationRequest(input.content)
        && missingMutationToolRecoveries < MAX_MISSING_MUTATION_TOOL_RECOVERIES
      ) {
        missingMutationToolRecoveries += 1;
        correctionCount += 1;
        response = await createAgentResponse(response.id
          ? {
              model: config.model,
              instructions: instructions(input.responseLanguage, workspace),
              previous_response_id: response.id,
              input: "The user gave an actionable image request. Do not merely acknowledge, remember it for later, ask them to say generate, or wait for confirmation. When the request has multiple independently instructed semantic roles, call create_multi_output_image_generation, including when there is no uploaded reference. For an existing generated image, query session assets if needed, then call create_image_revision or create_multi_output_image_revision. If the request specifies a resolution, pass it in the resolution argument.",
              tools: agentTools,
              tool_choice: "auto"
            }
          : initialRequest);
        continue;
      }
      if (!reply && emptyResponseRecoveries < MAX_EMPTY_RESPONSE_RECOVERIES) {
        emptyResponseRecoveries += 1;
        correctionCount += 1;
        response = await createAgentResponse(response.id
          ? {
              model: config.model,
              instructions: instructions(input.responseLanguage, workspace),
              previous_response_id: response.id,
              input: "Complete the pending user turn now. Return a useful reply or call the appropriate tool; do not return an empty response.",
              tools: agentTools,
              tool_choice: "auto"
            }
          : initialRequest);
        continue;
      }
      if (!reply) {
        if (!scopeDecision) {
          pendingAssistantDeltas.splice(0);
          input.onScopeDiagnostic?.({
            event: "fallback",
            reason: "empty_agent_reply",
            durationMs: 0,
            retryable: false,
            workspace: "image_generator"
          });
          return {
            intentRoute: replyRoute(),
            assistantReply: conversationValidationUnavailableFallback(input.responseLanguage),
            responseId: response.id
          };
        }
        return null;
      }
      if (isUnrelatedTechnicalAgentReply(input.content, reply)) {
        pendingAssistantDeltas.splice(0);
        resetStreamedConversation();
        return {
          intentRoute: replyRoute(),
          assistantReply: creativeScopeRedirect(input.responseLanguage),
          requiresImageOperation: false,
          responseId: response.id
        };
      }
      if (!scopeDecision) {
        pendingAssistantDeltas.splice(0);
        input.onScopeDiagnostic?.({
          event: "fallback",
          reason: "tool_free_agent_reply",
          durationMs: 0,
          retryable: false,
          workspace: "image_generator"
        });
        return {
          intentRoute: replyRoute(),
          assistantReply: conversationValidationUnavailableFallback(input.responseLanguage),
          responseId: response.id
        };
      }
      if (scopeDecision.requiresImageOperation && isExplicitImageGenerationRequest(input.content) && isPrematureSafetyRefusal(reply)) {
        if (missingCreationStateRecoveries >= MAX_MISSING_CREATION_STATE_RECOVERIES) {
          return {
            intentRoute: replyRoute(),
            assistantReply: creationNotStartedFallback(input.responseLanguage),
            responseId: response.id
          };
        }
        missingCreationStateRecoveries += 1;
        correctionCount += 1;
        response = await createAgentResponse({
          model: config.model,
          instructions: instructions(input.responseLanguage, workspace),
          previous_response_id: response.id,
          input: "Do not make the downstream image provider's safety decision yourself. Call the appropriate image creation tool now and explicitly choose reference_asset_ids from the available reference catalog. Use an empty array only when the request does not depend on an uploaded reference.",
          tools: agentTools,
          tool_choice: "auto"
        });
        continue;
      }
      let missingCreationToolDecision: MissingCreationToolDecision | undefined;
      if (scopeDecision.requiresImageOperation) {
        try {
          // The scope router already found an actionable image operation. Use a
          // second semantic LLM check only for this tool-free terminal path.
          missingCreationToolDecision = await judgeMissingCreationTool({
            input,
            reply,
            completedImageCount: snapshot.length,
            selectedTargetCount: selectedTargets.length,
            provider: config,
            maxRequestAttempts
          });
        } catch (error) {
          // The validator is part of the Conversation Agent request. Preserve
          // its structured failure so the route can apply the same retry,
          // Pipeline fallback, or content-policy behavior as the main turn.
          pendingAssistantDeltas.splice(0);
          throw error;
        }
      }
      if (missingCreationToolDecision === "must_create") {
        if (missingCreationStateRecoveries >= MAX_MISSING_CREATION_STATE_RECOVERIES) {
          return {
            intentRoute: replyRoute(),
            assistantReply: creationNotStartedFallback(input.responseLanguage),
            responseId: response.id
          };
        }
        missingCreationStateRecoveries += 1;
        correctionCount += 1;
        response = await createAgentResponse(response.id
          ? {
              model: config.model,
              instructions: instructions(input.responseLanguage, workspace),
              previous_response_id: response.id,
              input: "A state validator determined that this finished reply requires an image operation, but no creation or revision tool was called. Correct the state now: call create_image_generation, create_multi_output_image_generation, create_image_revision, or create_multi_output_image_revision for the actionable user request, using the applicable available reference_asset_ids. The reference-image task has already had its allowed clarification; choose sensible defaults and do not ask another question. Do not send a user-facing status reply without the matching tool call.",
              tools: agentTools,
              tool_choice: "auto"
            }
          : initialRequest);
        continue;
      }
      flushAssistantDeltas();
      const visibleReply = userVisibleReply(reply) || commandJsonFallback(input.responseLanguage);
      return {
        intentRoute: missingCreationToolDecision === "clarify" ? clarifyRoute() : replyRoute(),
        assistantReply: subscriptionCatalogQueried
          ? stripSubscriptionPricingLink(visibleReply)
          : visibleReply,
        requiresImageOperation: scopeDecision.requiresImageOperation,
        subscriptionPlansCta: subscriptionCatalogQueried
          ? { kind: "subscription_plans", label: subscriptionPlansCtaLabel(input.responseLanguage) }
          : undefined,
        responseId: response.id
      };
    }

    const queryCalls = calls.filter((call) => call.name === "query_session_assets");
    if (queryCalls.length) {
      response = await createAgentResponse({
        model: config.model,
        instructions: instructions(input.responseLanguage, workspace),
        previous_response_id: response.id,
        input: queryCalls.map((call) => ({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify({
            session_id: input.sessionId,
            selected_target_assets: selectedTargets.map((target) => ({
              target_job_id: target.targetJobId,
              target_asset_id: target.targetAssetId,
              image_number: (target.imageIndex ?? 0) + 1
            })),
            jobs: snapshot,
            next_step: "The exact asset data is now available. Complete the pending request now; do not describe another lookup."
          })
        })),
        tools: agentTools,
        tool_choice: "auto"
      });
      continue;
    }

    const subscriptionPlanCalls = calls.filter((call) => call.name === "query_subscription_plans");
    if (subscriptionPlanCalls.length) {
      subscriptionCatalogQueried = true;
      let catalog: ToapisSubscriptionPlanCatalog | undefined;
      let catalogError: string | undefined;
      try {
        catalog = await input.loadSubscriptionPlans?.();
        if (!catalog) catalogError = "Subscription plan data is temporarily unavailable.";
      } catch (error) {
        catalogError = error instanceof Error ? error.message : String(error);
      }
      response = await createAgentResponse({
        model: config.model,
        instructions: instructions(input.responseLanguage, workspace),
        previous_response_id: response.id,
        input: subscriptionPlanCalls.map((call) => ({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(catalog
            ? {
                status: "available",
                pricing_variant: catalog.pricingVariant,
                current_plan: catalog.currentPlan,
                pricing_url: catalog.pricingUrl,
                plans: catalog.plans.map((plan) => ({
                  package_id: plan.packageId,
                  plan: plan.plan,
                  title: plan.title,
                  name: plan.name,
                  price: {
                    amount: plan.usdAmount,
                    currency: plan.currency,
                    interval: plan.interval
                  },
                  credits: plan.credits,
                  description: plan.description,
                  note: plan.note,
                  features: plan.features,
                  featured: plan.featured ?? false,
                  label: plan.label
                })),
                next_step: "Answer the user's subscription question using only this catalog. Do not print or mention pricing_url; the application will render the subscription CTA. Do not call an image creation tool."
              }
            : {
                status: "temporarily_unavailable",
                error: catalogError,
                pricing_url: "/pricing",
                next_step: "Tell the user briefly that live plan details are temporarily unavailable and direct them to the pricing page. Do not invent plans or prices."
              })
        })),
        tools: agentTools,
        tool_choice: "auto"
      });
      continue;
    }

    const upgradeCall = calls.find((call) => call.name === "recommend_watermark_free_upgrade");
    if (upgradeCall?.call_id) {
      const upgrade = parseWatermarkUpgradeCommand(parseArguments(upgradeCall.arguments), assetIndex);
      if (!upgrade) return null;
      const finalResponse = await closeCommandToolCall({
        response,
        callId: upgradeCall.call_id,
        model: config.model,
        language: input.responseLanguage,
        workspace,
        output: { accepted: true, status: "watermark_upgrade_ready" },
        onAssistantDelta: input.onAssistantDelta,
        onAssistantReset: input.onAssistantReset,
        createAgentResponse
      });
      return {
        intentRoute: replyRoute(),
        assistantReply: userVisibleReply(upgrade.assistantReply)
          || userVisibleReply(textFrom(finalResponse))
          || (input.responseLanguage.toLowerCase().startsWith("zh")
            ? "当前图片为水印预览。升级后即可解锁无水印原图。"
            : "This image is a watermarked preview. Upgrade to unlock the watermark-free original."),
        watermarkUpgradeCta: {
          kind: "watermark_upgrade",
          targetJobId: upgrade.targetJobId,
          targetAssetId: upgrade.targetAssetId,
          label: "Upgrade to Pro"
        },
        requiresImageOperation: scopeDecision?.requiresImageOperation,
        responseId: finalResponse.id ?? response.id
      };
    }

    const commandCall = calls.find(
      (call) => call.name === "create_image_generation"
        || call.name === "create_multi_output_image_generation"
        || call.name === "create_image_revision"
        || call.name === "create_multi_output_image_revision"
    );
    const handoffCall = calls.find((call) => call.name === "recommend_workspace");
    if (handoffCall?.call_id) {
      const handoff = parseWorkspaceHandoffCommand(parseArguments(handoffCall.arguments));
      if (!handoff) return null;
      const finalResponse = await closeCommandToolCall({
        response,
        callId: handoffCall.call_id,
        model: config.model,
        language: input.responseLanguage,
        workspace,
        output: { accepted: true, status: "workspace_recommendation_ready" },
        onAssistantDelta: input.onAssistantDelta,
        onAssistantReset: input.onAssistantReset,
        createAgentResponse
      });
      return {
        intentRoute: replyRoute(),
        assistantReply: userVisibleReply(handoff.assistantReply)
          || userVisibleReply(textFrom(finalResponse))
          || "Use the Video Generator to create that video.",
        workspaceCta: handoff.cta,
        requiresImageOperation: scopeDecision?.requiresImageOperation,
        responseId: finalResponse.id ?? response.id
      };
    }
    if (!commandCall?.call_id) return null;
    const args = parseArguments(commandCall.arguments);
    const command = commandCall.name === "create_image_generation"
      ? parseGenerateCommand(args, availableReferenceAssetIds)
      : commandCall.name === "create_multi_output_image_generation"
        ? parseMultiOutputGenerationCommand(args, availableReferenceAssetIds)
      : commandCall.name === "create_multi_output_image_revision"
        ? parseMultiOutputRevisionCommand(args, assetIndex, availableReferenceAssetIds)
        : parseRevisionCommand(args, assetIndex, availableReferenceAssetIds);
    const isLegacyMaterialHandoffCandidate = Boolean(
      (command?.kind === "generate" || command?.kind === "generate_outputs")
      && includeSessionHistory
      && input.currentHasReferenceAssets
      && historyJobs.length === 1
    );
    if (isLegacyMaterialHandoffCandidate && !historicalMaterialHandoffJudged) {
      historicalMaterialHandoffJudged = true;
      historicalMaterialHandoffDecision = await judgeHistoricalMaterialHandoff({
        input,
        priorResult: historySnapshot?.[0],
        provider: config,
        maxRequestAttempts
      });
    }
    if (
      command?.kind === "generate"
      && historicalMaterialHandoffDecision?.decision === "continue_multi"
      && historicalMaterialHandoffDecision.expectedOutputCount
      && adjacentHandoffCoverageRecoveries < 1
    ) {
      adjacentHandoffCoverageRecoveries += 1;
      correctionCount += 1;
      response = await createAgentResponse({
        model: config.model,
        instructions: instructions(input.responseLanguage, workspace),
        previous_response_id: response.id,
        input: [{
          type: "function_call_output",
          call_id: commandCall.call_id,
          output: JSON.stringify({
            accepted: false,
            error: `Historical material-handoff coverage check required. This continued deliverable requires exactly ${historicalMaterialHandoffDecision.expectedOutputCount} output images in total. Replace this ordinary generation call with create_multi_output_image_generation and provide exactly ${historicalMaterialHandoffDecision.expectedOutputCount} output entries, including every individual and combined/master deliverable.`
          })
        }],
        tools: agentTools,
        tool_choice: "auto"
      });
      continue;
    }
    if (
      command?.kind === "generate_outputs"
      && historicalMaterialHandoffDecision?.decision === "continue_multi"
      && historicalMaterialHandoffDecision.expectedOutputCount !== undefined
      && command.outputs.length !== historicalMaterialHandoffDecision.expectedOutputCount
      && multiOutputCoverageRecoveries < 1
    ) {
      multiOutputCoverageRecoveries += 1;
      correctionCount += 1;
      response = await createAgentResponse({
        model: config.model,
        instructions: instructions(input.responseLanguage, workspace),
        previous_response_id: response.id,
        input: [{
          type: "function_call_output",
          call_id: commandCall.call_id,
          output: JSON.stringify({
            accepted: false,
            error: `Historical multi-output coverage check failed. The validated deliverable requires exactly ${historicalMaterialHandoffDecision.expectedOutputCount} outputs, but this call supplied ${command.outputs.length}. Reissue create_multi_output_image_generation with exactly ${historicalMaterialHandoffDecision.expectedOutputCount} output entries; do not omit or add outputs.`
          })
        }],
        tools: agentTools,
        tool_choice: "auto"
      });
      continue;
    }
    if (!command) {
      response = await createAgentResponse({
        model: config.model,
        instructions: instructions(input.responseLanguage, workspace),
        previous_response_id: response.id,
        input: [{
          type: "function_call_output",
          call_id: commandCall.call_id,
          output: JSON.stringify({ accepted: false, error: "Invalid command or unknown session asset." })
        }],
        tools: agentTools,
        tool_choice: "auto"
      });
      continue;
    }

    const finalResponse = await closeCommandToolCall({
      response,
      callId: commandCall.call_id,
      model: config.model,
      language: input.responseLanguage,
      workspace,
      output: { accepted: true, status: "creation_request_received" },
      onAssistantDelta: input.onAssistantDelta,
      onAssistantReset: input.onAssistantReset,
      createAgentResponse
    });
    const finalText = textFrom(finalResponse);
    const multiOutputInstructions = command.kind === "generate_outputs" || command.kind === "revise_outputs"
      ? command.outputs
      : undefined;
    const hasPriorConversation = Boolean(input.previousResponseId || input.conversationContext?.length);
    const preserveOriginalGenerationPrompt = command.kind === "generate"
      && command.referenceAssetIds.length === 0
      && input.sessionJobs.length === 0
      && !(input.historySessionJobs?.length)
      && !input.currentHasReferenceAssets
      && !(hasPriorConversation && dependsOnPriorCreativeContext(input.content))
      && !input.safetyFollowupPrompt;
    const generationPrompt = command.kind === "generate_outputs" || command.kind === "revise_outputs"
      ? command.outputs
          .map((output, index) => `Output ${index + 1} (${output.label}): ${output.prompt}`)
          .join("\n\n")
      : preserveOriginalGenerationPrompt
        ? input.content.trim()
        : command.prompt;
    return {
      intentRoute: commandRoute(command),
      assistantReply: userVisibleReply(command.assistantReply)
        || userVisibleReply(finalText)
        || (input.responseLanguage.toLowerCase().startsWith("zh") ? "我现在开始生成。" : "I’m starting that now."),
      generationPrompt,
      targetJobId: command.kind === "revise" || command.kind === "revise_outputs" ? command.targetJobId : undefined,
      targetAssetId: command.kind === "revise" || command.kind === "revise_outputs" ? command.targetAssetId : undefined,
      aspectRatio: command.aspectRatio,
      resolution: command.resolution,
      imageCount: command.kind === "generate_outputs" || command.kind === "revise_outputs"
        ? readImageCount(command.outputs.length)
        : command.imageCount
          ?? (typeof currentGenerationParameters.imageCount === "number"
            ? currentGenerationParameters.imageCount
            : 1),
      outputFormat: command.outputFormat,
      background: command.background,
      imageQuality: command.imageQuality,
      outputInstructions: multiOutputInstructions,
      referenceAssetIds: command.referenceAssetIds,
      sessionTitle: command.kind === "generate" || command.kind === "generate_outputs"
        ? command.sessionTitle
        : undefined,
      requiresImageOperation: scopeDecision?.requiresImageOperation,
      responseId: finalResponse.id ?? response.id
    };
  }

  return null;
  } finally {
    try {
      options.onMetrics?.({
        logicalRequestCount,
        httpAttemptCount,
        correctionCount,
        durationMs: Date.now() - metricsStartedAt
      });
    } catch (error) {
      console.warn("[socialmedia intent agent] metrics callback failed", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
