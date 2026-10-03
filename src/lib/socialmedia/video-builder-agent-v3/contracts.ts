import type {
  SocialmediaAspectRatio
} from "@/lib/socialmedia/types";

export const VIDEO_BUILDER_V3_MODES = [
  "t2va",
  "i2va",
  "fl2va",
  "l2va",
  "ref2va"
] as const;

export type VideoBuilderV3Mode = typeof VIDEO_BUILDER_V3_MODES[number];

export const VIDEO_BUILDER_V3_REFERENCE_ROLES = [
  "first_frame",
  "last_frame",
  "reference_image",
  "reference_video",
  "reference_audio"
] as const;

export type VideoBuilderV3ReferenceRole =
  typeof VIDEO_BUILDER_V3_REFERENCE_ROLES[number];

/** Official MiniMax H3 Ref2VA file limits. Every Picture role counts as an image. */
export const VIDEO_BUILDER_V3_PROVIDER_REFERENCE_LIMITS = {
  imageTotal: 9,
  videoTotal: 3,
  audioTotal: 3,
  mixedTotal: 12
} as const;

/** Maximum bound files in one Ref2VA request, retained as a schema-friendly alias. */
export const VIDEO_BUILDER_V3_MAX_BOUND_REFERENCE_ASSETS =
  VIDEO_BUILDER_V3_PROVIDER_REFERENCE_LIMITS.mixedTotal;

export type VideoBuilderV3ConversationTurn = {
  role: "user" | "assistant";
  content: string;
};

export type VideoBuilderV3HistoryIndexEntry = {
  entryId: string;
  kind: "message" | "job";
  ordinal: number;
  createdAt: string;
  preview: string;
  role?: "user" | "assistant";
  jobId?: string;
  turnIndex?: number;
  version?: number;
  versionCount?: number;
  assetIds?: string[];
};

export type VideoBuilderV3HistoryArchiveEntry = VideoBuilderV3HistoryIndexEntry & {
  content?: string;
  request?: string;
  summary?: string;
};

/** A server-verified asset that the V3 Manager may bind into an H3 plan. */
export type ReferenceAsset = {
  assetId: string;
  url: string;
  mediaType: "image" | "video" | "audio";
  role: VideoBuilderV3ReferenceRole;
  originalName?: string;
  mimeType?: string;
  summary?: string;
  currentTurn: boolean;
  pinned: boolean;
  sourceTurnIndex?: number;
  sourceAssetIndex?: number;
};

export type VideoBuilderV3ReferenceAsset = ReferenceAsset;

export type VideoBuilderV3ResolvedReferenceInput = Pick<
  ReferenceAsset,
  "assetId" | "url" | "mediaType"
> & {
  /**
   * Provider transport role. Ref2VA normalizes every image role to
   * reference_image; base I2VA/FL2VA/L2VA preserve first_frame/last_frame.
   */
  role: VideoBuilderV3ReferenceRole;
};

export type VideoBuilderV3Resolution =
  | "auto"
  | "480p"
  | "512p"
  | "720p"
  | "768p"
  | "1080p"
  | "2k";

export type VideoBuilderV3GenerationParameters = {
  aspectRatio: SocialmediaAspectRatio;
  resolution: VideoBuilderV3Resolution;
  durationSeconds: number;
  /**
   * Authoritative upstream audio-generation switch. `false` requires a
   * completely silent H3 prompt, `true` explicitly enables generated audio,
   * and `undefined` preserves the provider/system default.
   */
  audioEnabled?: boolean;
};

/**
 * V3-owned authoritative snapshot. It contains raw/server-verified evidence
 * only; no decision, prompt, parser output, or execution record from Video
 * Agent V1 is admitted at this boundary.
 */
export type VideoBuilderV3Input = {
  /** V4 semantic total-duration decision; null means no user duration change. */
  requestedDurationSeconds?: number | null;
  pendingDurationSeconds?: number;
  sessionId: string;
  latestUserMessage: string;
  responseLanguage: string;
  sourceUseCase?: string;
  currentGenerationParameters: VideoBuilderV3GenerationParameters;
  conversation: VideoBuilderV3ConversationTurn[];
  historyIndex: VideoBuilderV3HistoryIndexEntry[];
  historyArchive: VideoBuilderV3HistoryArchiveEntry[];
  previousVideoState: string | null;
  clarificationAlreadyAsked: boolean;
  /** Server-derived active-request speech facts; exact literals are validation authority. */
  speechRequirements: VideoBuilderV3SpeechRequirement[];
  referenceAssets: ReferenceAsset[];
  preselectedReferenceAssetIds: string[];
};

export type VideoBuilderV3SpeechRequirement = {
  requirementId: string;
  kind: "verbatim" | "speech_act";
  deliveryHint: "on_screen_dialogue" | "off_screen_voiceover" | "singing" | null;
  /** Present only for high-confidence quoted speech that must survive verbatim. */
  text: string | null;
  /** Bounded user-authored evidence for Manager/Critic coverage review. */
  evidence: string;
  source: "latest_user_message" | "active_prior_user_message";
};

/**
 * A semantic shot authored by the Manager. Absolute time is deliberately not
 * part of this contract: the server normalizes these relative weights against
 * the authoritative upstream duration.
 */
export type VideoBuilderV3Shot = {
  durationWeight: "short" | "medium" | "long";
  /** English scene/camera prose only. H3 labels, shot markers and exact-copy markup are compiler-owned. */
  description: string;
};

export type VideoBuilderV3ExactUserTextBinding = {
  text: string;
  delivery:
    | "on_screen_dialogue"
    | "off_screen_voiceover"
    | "singing"
    | "visible_scene_text";
  language: string;
  /** Semantic vocal-source or visible-placement description. */
  context: string;
  /** Stable semantic vocal-source key; null only for visible_scene_text. */
  speakerKey: string | null;
  /** Optional zero-based Ref2VA definition index used to resolve a server-derived Subject label. */
  subjectDefinitionIndex: number | null;
  /** Bound reference-audio assets supplying this vocal occurrence's characteristics. */
  referenceAudioAssetIds: string[];
  /** One-based shot in which this exact occurrence appears. */
  shotNumber: number;
};

export type VideoBuilderV3AudioUse =
  | "soundscape"
  | "music"
  | "both"
  | "timeline"
  | "visual_timing_only";

export type VideoBuilderV3ReferenceBinding = {
  assetId: string;
  /**
   * One-based shots in which the reference directly applies. Required for
   * image/video; audio may be global only when its label appears in an audio
   * output section.
  */
  shotNumbers: number[];
  /** Required for audio bindings; null for image/video bindings. */
  audioUse: VideoBuilderV3AudioUse | null;
};

export const VIDEO_BUILDER_V3_REF_TASK_TYPES = [
  "keyframe completion",
  "reference generation",
  "video editing",
  "video continuation",
  "audio reuse",
  "audio reference"
] as const;

export type VideoBuilderV3RefTaskType =
  typeof VIDEO_BUILDER_V3_REF_TASK_TYPES[number];

export const VIDEO_BUILDER_V3_VISUAL_RETENTION_RELATIONSHIPS = [
  "fully_preserved",
  "partially_preserved",
  "attribute_transfer",
  "weak_reference"
] as const;

export const VIDEO_BUILDER_V3_AUDIO_RETENTION_RELATIONSHIPS = [
  "fully_copy",
  "partially_copy",
  "reference",
  "weak_reference"
] as const;

export type VideoBuilderV3RetentionRelationship =
  | typeof VIDEO_BUILDER_V3_VISUAL_RETENTION_RELATIONSHIPS[number]
  | typeof VIDEO_BUILDER_V3_AUDIO_RETENTION_RELATIONSHIPS[number];

export const VIDEO_BUILDER_V3_VISUAL_RETENTION_INTENTS = [
  "preserve_defined_role",
  "preserve_with_changes",
  "transfer_attributes_to_other_subject",
  "style_or_structure_guidance_only"
] as const;

export const VIDEO_BUILDER_V3_AUDIO_RETENTION_INTENTS = [
  "copy_complete_signal",
  "copy_selected_signal_or_layers",
  "reference_specific_audio_characteristics",
  "broad_audio_inspiration_only"
] as const;

export type VideoBuilderV3RetentionIntent =
  | typeof VIDEO_BUILDER_V3_VISUAL_RETENTION_INTENTS[number]
  | typeof VIDEO_BUILDER_V3_AUDIO_RETENTION_INTENTS[number];

export type VideoBuilderV3EmbeddedRetentionDraft = {
  /** Semantic authoring choice. The server maps this to the fixed H3 marker. */
  intent: VideoBuilderV3RetentionIntent;
  description: string;
};

export type VideoBuilderV3ExecutableRetention =
  VideoBuilderV3EmbeddedRetentionDraft & {
    /** Fixed H3 marker derived only by the server. */
    relationship: VideoBuilderV3RetentionRelationship;
  };

/**
 * One semantic Ref2VA definition. The Manager never allocates H3 labels.
 * `subject` becomes the next `<Subject N>`; `source` uses the server-derived
 * Picture/Video/Audio label for its single source asset.
 */
export type VideoBuilderV3RefDefinitionDraft = {
  kind: "subject" | "source";
  description: string;
  sourceAssetIds: string[];
  retention: VideoBuilderV3EmbeddedRetentionDraft;
};

export type VideoBuilderV3Ref2VADraft = {
  taskTypes: VideoBuilderV3RefTaskType[];
  definitions: VideoBuilderV3RefDefinitionDraft[];
  summary: string;
  /** One or two English sentences placed before [Shot 1]. */
  stylePrelude: string;
};

/**
 * Semantic Manager output. Mode, duration, absolute timing, provider roles,
 * H3 labels, shot markers and exact-copy serialization are all server-owned.
 */
export type VideoBuilderV3PlanDraft = {
  assistantReply: string;
  videoTaskSummary: string;
  shots: VideoBuilderV3Shot[];
  exactUserText: VideoBuilderV3ExactUserTextBinding[];
  referenceBindings: VideoBuilderV3ReferenceBinding[];
  overallSoundscape: string | null;
  nonDiegeticMusic: string | null;
  /** Required only for ref2va; must be null for every base mode. */
  ref2va: VideoBuilderV3Ref2VADraft | null;
};

/** Stable alias for the terminal-tool draft used by existing imports. */
export type VideoBuilderV3Plan = VideoBuilderV3PlanDraft;

export type VideoBuilderV3ExecutableShot = {
  startSeconds: number;
  endSeconds: number;
  description: string;
};

export type VideoBuilderV3ExecutableReferenceBinding =
  VideoBuilderV3ReferenceBinding & {
    label: string;
    role: VideoBuilderV3ReferenceRole;
  };

export type VideoBuilderV3ExecutableRefDefinition =
  Omit<VideoBuilderV3RefDefinitionDraft, "retention"> & {
    label: string;
    sourceLabels: string[];
    shotNumbers: number[];
    retention: VideoBuilderV3ExecutableRetention;
  };

export type VideoBuilderV3ExecutableRef2VASections = Omit<
  VideoBuilderV3Ref2VADraft,
  "definitions"
> & {
  definitions: VideoBuilderV3ExecutableRefDefinition[];
};

export type VideoBuilderV3ExecutableExactUserTextBinding =
  VideoBuilderV3ExactUserTextBinding & {
    /** Server-derived H3 speaker ID; null for visible_scene_text. */
    speakerId: string | null;
    /** Server-derived Ref2VA Subject label when subjectDefinitionIndex is supplied. */
    subjectLabel: string | null;
    referenceAudioLabels: string[];
  };

/** Deterministic server plan consumed by the H3 compiler. */
export type VideoBuilderV3ExecutablePlan = Omit<
  VideoBuilderV3PlanDraft,
  | "shots"
  | "exactUserText"
  | "referenceBindings"
  | "overallSoundscape"
  | "nonDiegeticMusic"
  | "ref2va"
> & {
  mode: VideoBuilderV3Mode;
  durationSeconds: number;
  shots: VideoBuilderV3ExecutableShot[];
  exactUserText: VideoBuilderV3ExecutableExactUserTextBinding[];
  referenceBindings: VideoBuilderV3ExecutableReferenceBinding[];
  overallSoundscape: string;
  nonDiegeticMusic: string;
  ref2va: VideoBuilderV3ExecutableRef2VASections | null;
};

type VideoBuilderV3ResultBase = {
  schemaVersion: 1;
  assistantReply: string;
  videoTaskSummary?: string | null;
};

export type VideoBuilderV3ReadyResult = VideoBuilderV3ResultBase & {
  status: "ready";
  videoTaskSummary: string;
  mode: VideoBuilderV3Mode;
  generationPrompt: string;
  referenceAssetIds: string[];
  /** Provider inputs resolved only from the authoritative server asset snapshot. */
  referenceInputs: VideoBuilderV3ResolvedReferenceInput[];
  durationSeconds: number;
  aspectRatio: SocialmediaAspectRatio;
  resolution: VideoBuilderV3Resolution;
  /** Preserves the upstream false/true/unspecified audio setting for execution. */
  audioEnabled?: boolean;
};

export type VideoBuilderV3ClarificationResult = VideoBuilderV3ResultBase & {
  status: "needs_clarification";
  clarificationQuestion: string;
};

export type VideoBuilderV3ConversationAction =
  | "conversation"
  | "recommend_image_workspace"
  | "recommend_subscription";

export type VideoBuilderV3ConversationResult = VideoBuilderV3ResultBase & {
  status: "conversation";
  action: VideoBuilderV3ConversationAction;
};

export type VideoBuilderV3Result =
  | VideoBuilderV3ReadyResult
  | VideoBuilderV3ClarificationResult
  | VideoBuilderV3ConversationResult;
