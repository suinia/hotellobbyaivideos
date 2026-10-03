import type { ChatStreamEvent } from "@/lib/chat/stream";
import type { ConversionResult, PublishFormat, PublishPlatform } from "@/lib/types/skills";

export type JobStatus = "queued" | "running" | "completed" | "failed";
export type SessionVisibility = "private" | "public";
export type JobMode = "generate" | "revise";
export type ReviseIntent = "rewrite_copy_style" | "regenerate_cover" | "regenerate_slides";
export type ReviseImageMode = "same_prompt_new_seed" | "reprompt";
export type ReviseEditableField = "post_title" | "post_caption" | "hashtags" | "slides";

export interface RerunPlan {
  selectedSkills: string[];
  reusedSkills: string[];
  reason: string;
}

export interface SkillArtifact {
  artifactId: string;
  skillName: string;
  inputHash: string;
  output: unknown;
  version: number;
  dependsOn: string[];
  revision: number;
  updatedAt: string;
  provenance: {
    jobId: string;
    baseJobId: string;
    parentJobId?: string;
    intent?: ReviseIntent;
  };
}

export interface RevisePayload {
  intent: ReviseIntent;
  instruction: string;
  sourceText: string;
  editableFields: ReviseEditableField[];
  preserveFacts: boolean;
  preserveSlideStructure: boolean;
  scope: {
    slideIds?: number[];
    fields?: string[];
  };
  options: {
    mode: ReviseImageMode;
    seed?: number;
    preserveLayout: boolean;
  };
}

export interface SessionRecord {
  id: string;
  ownerUserId?: string;
  title: string;
  sourceUseCase?: string;
  /** Last successful ToAPIs Responses turn for the session-level intent agent. */
  agentResponseId?: string;
  /** Sticky per-session routing override after a runtime or safety fallback. */
  inputModeOverride?: "pipeline" | "agent";
  createdAt: string;
  updatedAt: string;
  lastJobId?: string;
  deletedAt?: string;
}

export interface ShareRecord {
  id: string;
  ownerUserId?: string;
  sessionId: string;
  token: string;
  visibility: SessionVisibility;
  expiresAt?: string;
  createdAt: string;
}

export interface JobEvent {
  id: string;
  index: number;
  stage: string;
  title: string;
  thought: string;
  action: string;
  outputPreview?: string;
  durationSec: number;
  elapsedMs?: number;
  costUsd: number;
  tokenInput?: number;
  tokenOutput?: number;
  tokenTotal?: number;
  llmCalls?: number;
  llmModel?: string;
  llmModels?: string[];
  llmAttemptCount?: number;
  usedFallbackModel?: boolean;
  timeoutHit?: boolean;
  inputChars?: number;
  createdAt: string;
}

export interface JobRecord {
  id: string;
  /** Website that submitted this job; analytics metadata only. */
  triggerHostname?: string;
  ownerUserId?: string;
  sessionId: string;
  turnIndex: number;
  revision: number;
  mode: JobMode;
  baseJobId: string;
  parentJobId?: string;
  revisionIntent?: ReviseIntent;
  sourceUseCase?: string;
  outputType?: string;
  status: JobStatus;
  progress: number;
  stage: string;
  events: JobEvent[];
  rerunPlan?: RerunPlan;
  changedArtifacts?: string[];
  artifacts: SkillArtifact[];
  payload: {
    inputText: string;
    batchId?: string;
    requestVariant?: "single_platform" | "multi_platform_batch";
    inputPreprocessed?: boolean;
    autoReplayCount?: number;
    sourceInputText?: string;
    sourceType?: "url" | "text";
    sourceUrl?: string;
    sourceTitle?: string;
    targetSlides?: number;
    aspectRatios?: Array<"4:5" | "9:16" | "1:1" | "16:9">;
    platform?: PublishPlatform;
    format?: PublishFormat;
    imageCount?: number;
    audience?: string;
    promptHint?: string;
    writingPolicy?: {
      voice: string;
      opening: string;
      slideRhythm: string;
      caption: string;
      cta: string;
      hashtags: string;
      avoid: string[];
    };
    stylePreset?: string;
    tone?: string;
    outputLanguage?: string;
    generationMode?: "standard" | "quote_slides";
    contentMode?: "longform_digest" | "product_marketing" | "trend_hotspot";
    reviewMode?: "auto" | "required";
    sourceUseCase?: string;
    outputType?: string;
    conversation?: {
      assistantReply: string;
      suggestedTask?: string;
    };
    preflightEvents?: ChatStreamEvent[];
    completionNote?: string;
    revisePayload?: RevisePayload;
    workflow?: string;
    socialmedia?: unknown;
  };
  result?: ConversionResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
