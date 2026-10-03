"use client";
import { HOTEL_LOBBY_DIRECTION_OPTIONS, getHotelLobbySelectedDirections, buildHotelLobbySubmittedInputText, getHotelLobbyUploadError, normalizeHotelLobbyCast } from "@/lib/socialmedia/hotel-lobby-input";
import { buildBabyShowerInvitationSubmittedInputText } from "@/lib/socialmedia/baby-shower-invitation-input";
import { buildPlaylistCoverSubmittedInputText } from "@/lib/socialmedia/playlist-cover-input";
import { buildVisionBoardSubmittedInputText } from "@/lib/socialmedia/vision-board-input";

import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";
import { t } from "@/lib/i18n/catalog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent, type ClipboardEvent as ReactClipboardEvent, type ComponentType, type CSSProperties, type DragEvent as ReactDragEvent, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";
import { captureAnalyticsEvent, getStoredAttribution, startAnalyticsSessionRecording } from "@/lib/analytics/posthog";
import { isChatStreamResponse, parseChatStreamChunk, type ChatStreamEvent, type ChatStreamIntent } from "@/lib/chat/stream";
import { SOCIALMEDIA_COMPOSER_MAX_CHARS } from "@/lib/socialmedia/input-limits";
import { resolveSocialmediaApiErrorMessage } from "@/lib/socialmedia/api-error";
import { resolveSocialmediaResponseLanguage } from "@/lib/socialmedia/language";
import { resolveSocialmediaSubmissionLanguage } from "@/lib/socialmedia/submission-language";
import { isLikelyImageFile, prepareUploadImageFile } from "@/lib/socialmedia/client-upload";
import { collectImageFilesFromTransfer, enqueueReservedComposerUploads, hasFileTransfer, resolveComposerSubmissionSourceAssets } from "@/lib/socialmedia/composer-image-input";
import { buildFlyerSubmittedInputText } from "@/lib/socialmedia/flyer-input";
import { buildBackgroundRemoverSubmittedInputText } from "@/lib/socialmedia/background-remover-input";
import { buildInfographicSubmittedInputText } from "@/lib/socialmedia/infographic-input";
import { buildComicSubmittedInputText, resolveComicSubmissionAspectRatio, resolveComicSubmissionStyleLabel } from "@/lib/socialmedia/comic-input";
import { buildAnimeSubmittedInputText, resolveAnimeSubmissionAspectRatio, resolveAnimeSubmissionStyleLabel } from "@/lib/socialmedia/anime-input";
import { buildMenuSubmittedInputText, resolveMenuSubmissionStyleLabel } from "@/lib/socialmedia/menu-input";
import { buildCertificateSubmittedInputText, resolveCertificateSubmissionStyleLabel } from "@/lib/socialmedia/certificate-input";
import { isRecoverableThreadSubmitError } from "@/lib/socialmedia/thread-submit-recovery";
import { resolveUserVisibleAndGenerationInput } from "@/lib/socialmedia/user-visible-input";
import { buildGuestUserRequestHeaders, createTraceId, getClientSessionId, isAccountRequestIdentityReady, trackClientEvent, truncateTelemetryText } from "@/lib/telemetry/client";
import { resolveGeneratorUseCaseContext } from "@/lib/use-cases/generator-context";
import { CLOTHES_CHANGER_DEFAULT_PROMPT, resolveImageWorkbenchDisplayContent } from "@/lib/workbench/composer-submission-content";
import { isMiniMaxH3VideoFlowSourceUseCase, isSpotifyCanvasSourceUseCase, isVideoGenerationSourceUseCase } from "@/lib/videos/source-use-case";
import { VIDEO_GENERATION_IN_PROGRESS_MESSAGE } from "@/lib/videos/submission-guard";
import { VIDEO_BUILDER_V3_PROVIDER_REFERENCE_LIMITS } from "@/lib/socialmedia/video-builder-agent-v3/contracts";
import { ArrowUp, ChevronDown, Clock, Crown, FileImage, ImagePlus, Lock, PanelsTopLeft, Plus, Sparkles, X, Zap } from "lucide-react";
import styles from "./app.module.css";
import { SOURCE_USE_CASE_APP_TOOL_SLUG_MAP } from "./constants";
import { type AppAccountSummary } from "./app-data";
import { useAppAccountStore } from "./app-account-store";

const APP_AUTH_MODAL_CLOSED_EVENT = "vismuse:auth-modal-closed";

const MOBILE_COMPOSER_QUERY = "(max-width: 760px)";
function subscribeMobileComposer(onChange: () => void) {
  const media = window.matchMedia(MOBILE_COMPOSER_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
function getMobileComposerSnapshot() {
  return window.matchMedia(MOBILE_COMPOSER_QUERY).matches;
}
function getServerMobileComposerSnapshot() { return false; }

export function resolveAppResponseLanguage(input?: string, selectedLanguage = "en-US"): string {
  return resolveSocialmediaResponseLanguage({
    userInput: input,
    selectedLanguage
  });
}

export function getAppComposerPlaceholder(sourceUseCase?: string, variant: "hero" | "thread" = "hero") {
  const toolSlug = SOURCE_USE_CASE_APP_TOOL_SLUG_MAP[sourceUseCase?.trim().toLowerCase() || ""] ?? sourceUseCase;
  if (variant === "thread") {
    if (toolSlug === "ai-image-text-editor") return "Describe the next text change or addition.";
    if (toolSlug === "background-remover") {
      return "Describe the background removal or replacement you want.";
    }
    if (toolSlug === "spotify-canvas-generator") return "Describe the subtle motion change you want.";
    if (toolSlug === "hotel-lobby-ai") return "Describe the performance, camera, or scene change you want.";
    if (toolSlug === "promo-video-maker") return "Describe the next promo variation, edit, or call to action.";
    if (toolSlug === "ai-video-generator" || toolSlug === "ai-image-to-video") return "Describe the next video edit, or upload reference images.";
    if (toolSlug === "ai-animation-generator") return "Describe the next animation or motion change, or upload a reference.";
    if (toolSlug === "ai-clothes-changer") return "Describe the outfit edit you want.";
    return "Describe an edit or generate another version.";
  }

  switch (toolSlug) {
    case "ai-image-text-editor":
      return "Upload an image, then describe the text you want to change or add.";
    case "ai-personal-image-generator":
      return "Upload a selfie and describe the headshot, profile picture, makeup, hairstyle, outfit, or retouch you want...";
    case "ai-book-cover-generator":
      return "Describe the book title, author, genre, mood, key visual, and cover style...";
    case "invitation-maker":
      return "Describe the event, names, date, time, location, theme, and RSVP details...";
    case "ai-sticker-generator":
      return "Describe a sticker subject, expression, pose, border style, and whether it is single or a sheet...";
    case "ai-wallpaper-generator":
      return "Describe a phone or desktop wallpaper scene, mood, colors, focal point, and icon-friendly space...";
    case "ai-video-generator":
      return "Describe your video, or upload a reference image.";
    case "ai-image-to-video":
      return "Describe how you want your image to move.";
    case "ai-animation-generator":
      return "Describe the animated scene, character action, art style, camera motion, or upload an image to animate.";
    case "hotel-lobby-ai":
      return "Optional: describe outfits, energy, or a change to the orange-studio preset.";
    case "promo-video-maker":
      return "Describe the product, offer, audience, key benefit, visual style, and call to action—or add a product image.";
    case "spotify-canvas-generator":
      return "Upload an album cover and describe subtle motion such as fog, rain, light, or particles.";
    case "background-remover":
      return "Describe the background removal or replacement you want.";
    case "ai-clothes-changer":
      return "Upload a person and clothing reference, then describe the outfit change...";
    case "ai-room-design":
      return "Describe the furniture, storage, layout, lighting, or style changes you want.";
    case "business-card-maker":
      return "Describe the card with a name, contact detail, industry, and style.";
    case "ai-logo-generator":
      return "Describe the brand name, industry, audience, logo type, and visual style...";
    case "tattoo-generator":
      return "Describe the tattoo idea, symbolism, placement, style, linework, and level of detail...";
    case "poster-maker":
      return "Describe the event, product promotion, movie, lost-and-found notice, or other poster you need. Add your text and visual style...";
    case "ai-brochure-generator":
      return "Describe the brochure you need—its audience, format, sections, text, brand details, and visual style...";
    case "ai-infographic-generator":
      return "Describe the topic, audience, key facts or data, and the visual story you want to explain...";
    case "ai-comic-generator":
      return "Describe the characters, story beats, panel count, dialogue, and comic style—or add character references...";
    case "baby-shower-invitations":
      return "Describe the baby shower theme. Add exact honoree, date, time, venue, RSVP, and registry wording if you want them shown...";
    case "playlist-cover-maker":
      return "Describe the mood, genre, or activity. Add an optional title or reference photo...";
    case "vision-board-maker":
      return "Describe your goals, dreams, colors, and collage style—or upload personal photos...";
    case "ai-anime-generator":
      return "Describe an original anime character, portrait, scene, mood, and style—or add a character reference...";
    case "ai-menu-generator":
      return "Add your restaurant name, menu sections, item names, descriptions, prices, and preferred style...";
    case "ai-certificate-generator":
      return "Add the recipient name, certificate title, achievement, issuer, date, and preferred style...";
    default:
      return "Describe what you want to create, or add a reference.";
  }
}

function ComposerSettingsIcon({ size = 18, "aria-hidden": ariaHidden }: { size?: number; "aria-hidden"?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden={ariaHidden}>
      <path
        d="M9.074 5.1a2.1 2.1 0 0 1-4.2 0m4.2 0a2.1 2.1 0 0 0-4.2 0m4.2 0H15.9m-11.024 0H2.25m6.824 7.349a2.1 2.1 0 0 0 4.2 0m-4.2 0a2.1 2.1 0 1 1 4.2 0m-4.2 0H2.25m11.024 0h2.625"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const APP_UPGRADE_MODAL_EVENT = "vismuse:app-upgrade-modal";

export type AppComposerProps = {
  options?: AppComposerOption[];
  placeholder?: string;
  initialPrompt?: string;
  inspirationPrompt?: { text: string };
  promptSuggestion?: { text: string; selection: number };
  compact?: boolean;
  className?: string;
  actionsClassName?: string;
  uploadRowClassName?: string;
  uploadButtonClassName?: string;
  uploadInToolbar?: boolean;
  requireSourceImage?: boolean;
  allowImageOnlySubmit?: boolean;
  submitClassName?: string;
  leadingAction?: ReactNode;
  hideOptions?: boolean;
  hideSafetyNotice?: boolean;
  deferClaimedGuestAuthToSession?: boolean;
  draftStorageKey?: string;
  submitAfterAuthStorageKey?: string;
  onBeforeAuth?: () => void;
  onAuthCancelled?: () => void;
  suppressAuthRequiredError?: boolean;
  submitLabel?: string;
  submitPathSlug?: string;
  sourceUseCase?: string;
  sessionId?: string;
  hasActiveVideoJob?: boolean;
  continuationSourceAssets?: AppComposerSourceAsset[];
  redirectMode?: "tool" | "chat";
  onChatSubmit?: (params: {
    content: string;
    sourceAssets: AppComposerSourceAsset[];
    displaySourceAssets?: AppComposerSourceAsset[];
    targetAssets?: AppComposerTargetAsset[];
    parentJobId?: string;
    resultAction?: AppComposerResultAction;
    generationInputText?: string;
    aspectRatio: string;
    resolution: string;
    outputType?: "image" | "video";
    videoModel?: string;
    videoModelTier?: AppVideoModelTier;
    videoDuration?: number;
    videoResolution?: string;
    videoSize?: string;
    platform?: AppComposerPlatform;
    destination?: AppComposerDestination;
  }) => void;
  onMockSubmit?: (params: {
    content: string;
    sourceAssets: AppComposerSourceAsset[];
    displaySourceAssets?: AppComposerSourceAsset[];
    aspectRatio: string;
    resolution: string;
    outputType?: "image" | "video";
    videoModel?: string;
    videoModelTier?: AppVideoModelTier;
    videoDuration?: number;
    videoResolution?: string;
    videoSize?: string;
  }) => void;
};

export type AppComposerOptionChoice = {
  value: string;
  label: string;
  icon?: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  locked?: boolean;
  lockLabel?: string;
};

type AppComposerSettingsChoice = {
  value: string;
  label: string;
};

type AppComposerSettingsSelectId =
  | "resolution"
  | "flyer-type"
  | "flyer-style"
  | "product-ad-use"
  | "business-card-industry"
  | "business-card-style"
  | "business-card-output"
  | "logo-type"
  | "logo-style"
  | "logo-industry"
  | "personal-image-template"
  | "tattoo-style"
  | "tattoo-placement"
  | "tattoo-complexity"
  | "tattoo-output"
  | "room-design-room"
  | "room-design-style"
  | "room-design-colors"
  | "room-design-size";

type AppComposerSettingsSelectPlacement = "up" | "down";

type AppComposerSettingsMenuPosition = {
  placement: AppComposerSettingsSelectPlacement;
  left: number;
  top?: number;
  bottom?: number;
  width: number;
  maxHeight: number;
};

export type AppComposerPlatform = "instagram" | "x";

export type AppComposerDestination =
  | "auto"
  | "product_listing"
  | "website_hero"
  | "social_ad"
  | AppComposerPlatform
  | "story_reel_cover"
  | "custom";

export type AppVideoModelTier = "lite" | "pro" | "max";

export type AppComposerRoomDesignAssetRole = "room_photo" | "furniture_reference" | "style_reference";

export type AppComposerOption = {
  id: string;
  title: string;
  defaultValue: string;
  choices: AppComposerOptionChoice[];
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  readOnly?: boolean;
};

export type AppComposerSourceAsset = {
  assetId: string;
  asset_id?: string;
  bucket: "socialmedia-input-assets";
  path?: string;
  url?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  role: "reference_image";
  originalName?: string;
  original_name?: string;
  roomDesignRole?: AppComposerRoomDesignAssetRole;
  room_design_role?: AppComposerRoomDesignAssetRole;
};

type AppComposerClothesChangerUploadSlot = "person" | "clothes";

export type AppComposerTargetAsset = {
  asset_id?: string;
  assetId?: string;
  image_index?: number;
  imageIndex?: number;
  url?: string;
  width?: number;
  height?: number;
  parent_job_id?: string;
};

export type AppComposerResultAction = "variant" | "resize" | "placement_preview" | "upgrade_4k";

type AppComposerUploadResponse = {
  asset?: {
    assetId?: string;
    asset_id?: string;
    bucket?: string;
    path?: string;
    url?: string;
    mimeType?: string;
    mime_type?: string;
    width?: number;
    height?: number;
    sizeBytes?: number;
    size_bytes?: number;
    role?: string;
    originalName?: string;
    original_name?: string;
  };
  error?: string;
};

export type AppComposerSubmitResponse = {
  source_use_case?: string;
  output_type?: "image" | "video";
  session_id?: string;
  agent_mode?: boolean;
  job?: {
    job_id: string;
    session_id: string;
    status: string;
    status_url?: string;
  };
  assistant_message?: {
    metadata?: { clarificationCard?: unknown };
    content?: string;
  };
  cta?: AppThreadConversationCta;
  error?: string;
  code?: string;
  details?: Record<string, unknown>;
};

export class AppComposerSubmitError extends Error {
  code?: string;
  details?: Record<string, unknown>;
  status?: number;

  constructor(message: string, params?: { code?: string; details?: Record<string, unknown>; status?: number }) {
    super(message);
    this.name = "AppComposerSubmitError";
    this.code = params?.code;
    this.details = params?.details;
    this.status = params?.status;
  }
}

type AppComposerUploadedImage = {
  requestId: number;
  name: string;
  previewUrl?: string;
  status: "uploading" | "uploaded" | "failed";
  error?: string;
  uploadSlot?: AppComposerClothesChangerUploadSlot;
  sourceAsset?: AppComposerSourceAsset;
};

export type AppPendingThreadSubmit = {
  version: 1;
  sessionId: string;
  idempotencyKey: string;
  traceId?: string;
  toolSlug: string;
  sourceUseCase: string;
  outputType?: "image" | "video";
  status: "submitting" | "recovering" | "failed";
  content: string;
  language?: string;
  aspectRatio: string;
  resolution: string;
  videoModel?: string;
  videoModelTier?: AppVideoModelTier;
  videoDuration?: number;
  videoResolution?: string;
  videoSize?: string;
  requiredVideoReferenceAssetIds?: string[];
  platform?: AppComposerPlatform;
  destination?: AppComposerDestination;
  sourceAssets: AppComposerSourceAsset[];
  displaySourceAssets?: AppComposerSourceAsset[];
  targetAssets?: AppComposerTargetAsset[];
  parentJobId?: string;
  resultAction?: AppComposerResultAction;
  generationInputText?: string;
  attributionSnapshot?: Record<string, unknown>;
  createdAt: string;
  attemptCount: number;
  submittedAt?: string;
  failedAt?: string;
  lastError?: string;
  lastErrorCode?: string;
  resumeAfterAuth?: boolean;
};

const APP_PENDING_THREAD_SUBMIT_PREFIX = "vismuse_app_pending_submit:";

export function getPendingThreadSubmitKey(sessionId: string) {
  return `${APP_PENDING_THREAD_SUBMIT_PREFIX}${sessionId}`;
}

export function createAppSubmitIdempotencyKey(sessionId: string) {
  const randomId = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `app-submit:${sessionId}:${randomId}`;
}

export function bucketAppInputLength(length: number): string {
  if (length <= 0) return "empty";
  if (length < 40) return "short";
  if (length < 160) return "medium";
  if (length < 500) return "long";
  return "very_long";
}

export function summarizeAppSubmitPayload(payload: Record<string, unknown>) {
  return {
    contentLength: typeof payload.content === "string" ? payload.content.length : undefined,
    aspectRatio: typeof payload.aspect_ratio === "string" ? payload.aspect_ratio : undefined,
    imageCount: typeof payload.image_count === "string" || typeof payload.image_count === "number" ? payload.image_count : undefined,
    language: typeof payload.language === "string" ? payload.language : undefined,
    resolution: typeof payload.resolution === "string" ? payload.resolution : undefined,
    platform: typeof payload.platform === "string" ? payload.platform : undefined,
    sourceUseCase: typeof payload.source_use_case === "string" ? payload.source_use_case : undefined,
    sourceAssetCount: Array.isArray(payload.source_assets) ? payload.source_assets.length : undefined,
    targetAssetCount: Array.isArray(payload.target_assets) ? payload.target_assets.length : undefined,
    parentJobId: typeof payload.parent_job_id === "string" ? payload.parent_job_id : undefined,
    hasSessionId: typeof payload.session_id === "string" && payload.session_id.length > 0
  };
}

export function summarizeAppSubmitResponse(data: AppComposerSubmitResponse) {
  return {
    hasJob: Boolean(data.job),
    jobId: data.job?.job_id,
    jobStatus: data.job?.status,
    sessionId: data.job?.session_id || data.session_id,
    intent: typeof (data as { intent?: unknown }).intent === "string" ? (data as { intent?: string }).intent : undefined,
    hasAssistantMessage: Boolean(data.assistant_message?.content),
    assistantMessagePreview: truncateTelemetryText(data.assistant_message?.content, 240)
  };
}

export const APP_ANALYTICS_WORKFLOW = "app_chat";

export function buildAppGenerationAnalyticsProperties(overrides: Record<string, unknown> = {}) {
  return {
    workflow: APP_ANALYTICS_WORKFLOW,
    generation_entry: APP_ANALYTICS_WORKFLOW,
    ...overrides
  };
}

export function writePendingThreadSubmit(pending: AppPendingThreadSubmit): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.setItem(getPendingThreadSubmitKey(pending.sessionId), JSON.stringify(pending));
    return true;
  } catch {
    return false;
  }
}

function normalizeAppComposerSourceAsset(asset: AppComposerUploadResponse["asset"]): AppComposerSourceAsset | null {
  const assetId = asset?.assetId ?? asset?.asset_id;
  if (!assetId || asset?.bucket !== "socialmedia-input-assets") return null;
  return {
    assetId,
    asset_id: assetId,
    bucket: "socialmedia-input-assets",
    path: asset.path,
    url: asset.url,
    mimeType: asset.mimeType ?? asset.mime_type,
    width: asset.width,
    height: asset.height,
    sizeBytes: asset.sizeBytes ?? asset.size_bytes,
    role: "reference_image",
    originalName: asset.originalName ?? asset.original_name,
    original_name: asset.originalName ?? asset.original_name
  };
}

const APP_COMPOSER_MAX_UPLOADS = 8;

const APP_VIDEO_COMPOSER_MAX_UPLOADS = VIDEO_BUILDER_V3_PROVIDER_REFERENCE_LIMITS.imageTotal;

export const APP_VIDEO_COMPOSER_DEFAULT_RESOLUTION = "480p";

export const MINIMAX_H3_VIDEO_COMPOSER_DEFAULT_RESOLUTION = "768p";

const SPOTIFY_CANVAS_COMPOSER_MAX_UPLOADS = 1;

const SPOTIFY_CANVAS_PAID_VIDEO_RESOLUTION = "720p";

export const SPOTIFY_CANVAS_DEFAULT_DISPLAY_PROMPT = "Animate this album cover into a subtle 5-second Spotify Canvas.";

export const APP_VIDEO_COMPOSER_DEFAULT_MODEL_TIER: AppVideoModelTier = "lite";

const clothesChangerUploadSlots: Array<{ id: AppComposerClothesChangerUploadSlot; label: string; helper: string }> = [
  { id: "person", label: "Upload Person", helper: "Face, pose, and body source" },
  { id: "clothes", label: "Upload Clothes", helper: "Garment reference" }
];

type FixedAspectRatio = "1:1" | "3:2" | "2:3" | "4:3" | "3:4" | "5:4" | "4:5" | "16:9" | "9:16" | "2:1" | "1:2" | "21:9" | "9:21";

const fixedAspectRatioDimensions: Record<FixedAspectRatio, { width: number; height: number }> = {
  "1:1": { width: 1, height: 1 },
  "3:2": { width: 3, height: 2 },
  "2:3": { width: 2, height: 3 },
  "4:3": { width: 4, height: 3 },
  "3:4": { width: 3, height: 4 },
  "5:4": { width: 5, height: 4 },
  "4:5": { width: 4, height: 5 },
  "16:9": { width: 16, height: 9 },
  "9:16": { width: 9, height: 16 },
  "2:1": { width: 2, height: 1 },
  "1:2": { width: 1, height: 2 },
  "21:9": { width: 21, height: 9 },
  "9:21": { width: 9, height: 21 }
};

function AspectRatioShapeIcon({ size = 16, ratio }: { size?: number; ratio: FixedAspectRatio }) {
  const dimensions = fixedAspectRatioDimensions[ratio];
  const ratioValue = dimensions.width / dimensions.height;
  const maxSide = 18;
  const rectWidth = ratioValue >= 1 ? maxSide : maxSide * ratioValue;
  const rectHeight = ratioValue >= 1 ? maxSide / ratioValue : maxSide;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x={(24 - rectWidth) / 2}
        y={(24 - rectHeight) / 2}
        width={rectWidth}
        height={rectHeight}
        rx={2.6}
        stroke="currentColor"
        strokeWidth={2.8}
      />
    </svg>
  );
}

function createAspectRatioIcon(ratio: FixedAspectRatio) {
  function FixedAspectRatioIcon({ size = 16 }: { size?: number }) {
    return <AspectRatioShapeIcon size={size} ratio={ratio} />;
  }

  FixedAspectRatioIcon.displayName = `AppAspectRatio${ratio.replace(":", "x")}Icon`;
  return FixedAspectRatioIcon;
}

export function ResolutionGemIcon({ size = 14, "aria-hidden": ariaHidden }: { size?: number; "aria-hidden"?: boolean }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" aria-hidden={ariaHidden}>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m9.999 11.638-2-2.243M6 4.5h12l3 5.099-8.5 9.687a.7.7 0 0 1-.5.214.69.69 0 0 1-.5-.214L3 9.599z"
      />
    </svg>
  );
}

const appAspectRatioIcons: Record<FixedAspectRatio, ReturnType<typeof createAspectRatioIcon>> = {
  "1:1": createAspectRatioIcon("1:1"),
  "3:2": createAspectRatioIcon("3:2"),
  "2:3": createAspectRatioIcon("2:3"),
  "4:3": createAspectRatioIcon("4:3"),
  "3:4": createAspectRatioIcon("3:4"),
  "5:4": createAspectRatioIcon("5:4"),
  "4:5": createAspectRatioIcon("4:5"),
  "16:9": createAspectRatioIcon("16:9"),
  "9:16": createAspectRatioIcon("9:16"),
  "2:1": createAspectRatioIcon("2:1"),
  "1:2": createAspectRatioIcon("1:2"),
  "21:9": createAspectRatioIcon("21:9"),
  "9:21": createAspectRatioIcon("9:21")
};

const aspectRatioChoices: AppComposerOptionChoice[] = [
  { value: "auto", label: "Auto", icon: PanelsTopLeft },
  { value: "1:1", label: "1:1", icon: appAspectRatioIcons["1:1"] },
  { value: "3:2", label: "3:2", icon: appAspectRatioIcons["3:2"] },
  { value: "2:3", label: "2:3", icon: appAspectRatioIcons["2:3"] },
  { value: "4:3", label: "4:3", icon: appAspectRatioIcons["4:3"] },
  { value: "3:4", label: "3:4", icon: appAspectRatioIcons["3:4"] },
  { value: "5:4", label: "5:4", icon: appAspectRatioIcons["5:4"] },
  { value: "4:5", label: "4:5", icon: appAspectRatioIcons["4:5"] },
  { value: "16:9", label: "16:9", icon: appAspectRatioIcons["16:9"] },
  { value: "9:16", label: "9:16", icon: appAspectRatioIcons["9:16"] },
  { value: "2:1", label: "2:1", icon: appAspectRatioIcons["2:1"] },
  { value: "1:2", label: "1:2", icon: appAspectRatioIcons["1:2"] },
  { value: "21:9", label: "21:9", icon: appAspectRatioIcons["21:9"] },
  { value: "9:21", label: "9:21", icon: appAspectRatioIcons["9:21"] }
];

const resolutionChoices: AppComposerOptionChoice[] = [
  { value: "auto", label: "Auto" },
  { value: "1k", label: "1K (10 credits)" },
  { value: "2k", label: "2K (20 credits)" },
  { value: "4k", label: "4K (40 credits)" }
];

const flyerTypeSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" },
  { value: "real_estate", label: "Real Estate" },
  { value: "birthday", label: "Birthday" },
  { value: "event", label: "Event" },
  { value: "sale", label: "Sale" },
  { value: "business", label: "Business" }
];

const brochureTypeSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" },
  { value: "tri_fold", label: "Tri-fold" },
  { value: "bi_fold", label: "Bi-fold" },
  { value: "z_fold", label: "Z-fold" },
  { value: "one_page", label: "One-page" }
];

const infographicTypeSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" },
  { value: "statistical", label: "Statistical" },
  { value: "comparison", label: "Comparison" },
  { value: "process", label: "Process" },
  { value: "timeline", label: "Timeline" },
  { value: "list", label: "List" },
  { value: "informational", label: "Informational" }
];

const comicFormatSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" },
  { value: "single_panel", label: "Single panel" },
  { value: "four_panel", label: "4-panel strip" },
  { value: "six_panel", label: "6-panel page" },
  { value: "comic_page", label: "Comic page" },
  { value: "webtoon", label: "Webtoon" }
];

const babyShowerThemeSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" }, { value: "floral", label: "Floral" },
  { value: "woodland", label: "Woodland" }, { value: "safari", label: "Safari" },
  { value: "moon_stars", label: "Moon & stars" }, { value: "butterfly", label: "Butterfly" },
  { value: "minimal", label: "Minimal" }, { value: "sprinkle", label: "Baby sprinkle" },
  { value: "twins", label: "Twins" }
];
const babyShowerStyleSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" }, { value: "watercolor", label: "Watercolor" },
  { value: "modern", label: "Modern" }, { value: "classic", label: "Classic" },
  { value: "playful", label: "Playful" }, { value: "typographic", label: "Typographic" }
];

const playlistMoodSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" }, { value: "chill", label: "Chill" },
  { value: "study", label: "Study and focus" }, { value: "workout", label: "Workout" },
  { value: "night_drive", label: "Night drive" }, { value: "party", label: "Party" },
  { value: "romantic", label: "Romantic" }, { value: "sad", label: "Sad" },
  { value: "travel", label: "Road trip" }, { value: "sleep", label: "Sleep and ambient" }
];
const playlistStyleSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" }, { value: "photographic", label: "Photographic" },
  { value: "illustration", label: "Illustration" }, { value: "collage", label: "Collage" },
  { value: "typographic", label: "Bold typography" }, { value: "minimal", label: "Minimal" },
  { value: "retro", label: "Retro" }, { value: "abstract", label: "Abstract" }
];

const visionBoardThemeSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" }, { value: "annual", label: "Annual goals" },
  { value: "travel", label: "Travel" }, { value: "career", label: "Career and study" },
  { value: "health", label: "Health and wellbeing" }, { value: "lifestyle", label: "Dream lifestyle" }
];
const visionBoardStyleSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" }, { value: "magazine", label: "Magazine collage" },
  { value: "minimal", label: "Minimal grid" }, { value: "scrapbook", label: "Scrapbook" },
  { value: "photo_wall", label: "Photo wall" }
];

const animeTypeSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" },
  { value: "character", label: "Character" },
  { value: "portrait", label: "Portrait / PFP" },
  { value: "scene", label: "Scene" },
  { value: "group", label: "Couple / group" },
  { value: "creature", label: "Creature / pet" }
];

const menuCategorySettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" },
  { value: "breakfast", label: "Breakfast" },
  { value: "cafe", label: "Cafe" },
  { value: "diner", label: "Diner" },
  { value: "drink", label: "Drink" },
  { value: "wine", label: "Wine" }
];

const certificateTypeSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" },
  { value: "achievement", label: "Achievement" },
  { value: "appreciation", label: "Appreciation" },
  { value: "completion", label: "Completion" },
  { value: "participation", label: "Participation" },
  { value: "award", label: "Award" }
];

const flyerStyleSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "modern", label: "Modern" },
  { value: "luxury", label: "Luxury" },
  { value: "bold", label: "Bold" },
  { value: "minimal", label: "Minimal" }
];

const infographicStyleSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "modern", label: "Modern" },
  { value: "editorial", label: "Editorial" },
  { value: "bold", label: "Bold" },
  { value: "minimal", label: "Minimal" },
  { value: "illustrated", label: "Illustrated" }
];

const comicStyleSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" },
  { value: "modern", label: "Modern" },
  { value: "american", label: "American comic" },
  { value: "manga", label: "Manga" },
  { value: "webtoon", label: "Webtoon" },
  { value: "newspaper", label: "Newspaper" },
  { value: "kids", label: "Kids" }
];

const animeStyleSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" },
  { value: "cinematic", label: "Cinematic anime" },
  { value: "cel_shaded", label: "Cel-shaded" },
  { value: "retro_90s", label: "Retro 90s" },
  { value: "chibi", label: "Chibi" },
  { value: "manga_bw", label: "Manga B&W" },
  { value: "fantasy", label: "Fantasy anime" }
];

const menuStyleSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "modern", label: "Modern" },
  { value: "classic", label: "Classic" },
  { value: "rustic", label: "Rustic" },
  { value: "minimal", label: "Minimal" },
  { value: "illustrated", label: "Illustrated" }
];

const certificateStyleSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "modern", label: "Modern" },
  { value: "elegant", label: "Elegant" },
  { value: "classic", label: "Classic" },
  { value: "minimal", label: "Minimal" },
  { value: "playful", label: "Playful" }
];

const productAdUseSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" },
  { value: "product_listing", label: "Product listing" },
  { value: "website_hero", label: "Website hero" },
  { value: "social_ad", label: "Social ad" },
  { value: "instagram", label: "Instagram" },
  { value: "x", label: "X / Twitter" },
  { value: "story_reel_cover", label: "Story / Reel cover" },
  { value: "custom", label: "Custom" }
];

const businessCardIndustrySettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" },
  { value: "real_estate", label: "Real estate" },
  { value: "consultant", label: "Consultant" },
  { value: "founder", label: "Founder" },
  { value: "beauty", label: "Beauty" },
  { value: "restaurant", label: "Restaurant" },
  { value: "healthcare", label: "Healthcare" },
  { value: "legal", label: "Legal" },
  { value: "creative", label: "Creative" }
];

const businessCardStyleSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" },
  { value: "modern", label: "Modern" },
  { value: "luxury", label: "Luxury" },
  { value: "minimal", label: "Minimal" },
  { value: "bold", label: "Bold" },
  { value: "creative", label: "Creative" }
];

const businessCardOutputSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "front_back", label: "Front + back" },
  { value: "front_only", label: "Front only" }
];

const logoTypeSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" },
  { value: "wordmark", label: "Wordmark" },
  { value: "symbol", label: "Symbol" },
  { value: "monogram", label: "Monogram" },
  { value: "mascot", label: "Mascot" },
  { value: "badge", label: "Badge" },
  { value: "brand_system", label: "Brand system" }
];

const logoStyleSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" },
  { value: "minimal", label: "Minimal" },
  { value: "modern", label: "Modern" },
  { value: "luxury", label: "Luxury" },
  { value: "playful", label: "Playful" },
  { value: "tech", label: "Tech" },
  { value: "retro", label: "Retro" },
  { value: "organic", label: "Organic" }
];

const logoIndustrySettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" },
  { value: "startup", label: "Startup" },
  { value: "saas", label: "SaaS" },
  { value: "restaurant", label: "Restaurant" },
  { value: "wellness", label: "Wellness" },
  { value: "real_estate", label: "Real estate" },
  { value: "beauty", label: "Beauty" },
  { value: "local_business", label: "Local business" }
];

const personalImageTemplateSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" },
  { value: "headshot", label: "Headshot" },
  { value: "profile_picture", label: "Profile picture" },
  { value: "makeup", label: "Makeup" },
  { value: "hairstyle", label: "Hairstyle" },
  { value: "outfit", label: "Outfit" },
  { value: "color_analysis", label: "Color analysis" },
  { value: "retouch", label: "Retouch" }
];

const personalImageTemplateInstructions: Record<string, string> = {
  auto: "Create a polished personal image result from the uploaded selfie, choosing the best mix of portrait polish, style direction, and visual presentation.",
  headshot: "Create a professional headshot for LinkedIn, resumes, founder bios, or company profile pages.",
  profile_picture: "Create a clean social profile picture or PFP that works well as a square avatar.",
  makeup: "Apply a realistic virtual makeup look while preserving the person's facial identity and natural features.",
  hairstyle: "Preview a realistic hairstyle, haircut, bangs, texture, or hair color while keeping the face consistent.",
  outfit: "Generate a styled outfit look from the portrait, matching the requested occasion and personal image direction.",
  color_analysis: "Create a personal color analysis board with flattering clothing colors, makeup shades, hair color ideas, and a palette.",
  retouch: "Retouch the portrait for lighting, skin clarity, sharpness, and polish while keeping the person recognizable."
};

const tattooPlacementSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "arm", label: "Arm" },
  { value: "forearm", label: "Forearm" },
  { value: "sleeve", label: "Sleeve" },
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "leg", label: "Leg" },
  { value: "wrist", label: "Wrist" }
];

const tattooStyleSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "black_grey", label: "Black & Grey" },
  { value: "fine_line", label: "Fine Line" },
  { value: "minimalist", label: "Minimalist" },
  { value: "traditional", label: "Traditional" },
  { value: "japanese", label: "Japanese" },
  { value: "geometric", label: "Geometric" },
  { value: "stencil", label: "Stencil" }
];

const tattooComplexitySettingsChoices: AppComposerSettingsChoice[] = [
  { value: "simple", label: "Simple" },
  { value: "medium", label: "Medium" },
  { value: "detailed", label: "Detailed" }
];

const tattooOutputSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "concept", label: "Concept" },
  { value: "stencil", label: "Stencil" },
  { value: "placement_preview", label: "Placement Preview" }
];

const roomDesignRoomSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "auto", label: "Auto" },
  { value: "living_room", label: "Living Room" },
  { value: "bedroom", label: "Bedroom" },
  { value: "kitchen", label: "Kitchen" },
  { value: "bathroom", label: "Bathroom" },
  { value: "dining_room", label: "Dining Room" },
  { value: "home_office", label: "Home Office" },
  { value: "kids_room", label: "Kids Room" },
  { value: "basement", label: "Basement" },
  { value: "outdoor_patio", label: "Outdoor Patio" },
  { value: "gaming_room", label: "Gaming Room" }
];

const roomDesignStyleSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "modern", label: "Modern" },
  { value: "scandinavian", label: "Scandinavian" },
  { value: "minimalist", label: "Minimalist" },
  { value: "industrial", label: "Industrial" },
  { value: "bohemian", label: "Bohemian" },
  { value: "traditional", label: "Traditional" },
  { value: "contemporary", label: "Contemporary" },
  { value: "mid_century", label: "Mid-century" },
  { value: "coastal", label: "Coastal" },
  { value: "luxury", label: "Luxury" }
];

const roomDesignColorSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "neutral", label: "Neutral" },
  { value: "warm", label: "Warm" },
  { value: "cool", label: "Cool" },
  { value: "earth", label: "Earth" },
  { value: "white", label: "White" },
  { value: "dark", label: "Dark" },
  { value: "pastel", label: "Pastel" },
  { value: "bold", label: "Bold" }
];

const roomDesignSizeSettingsChoices: AppComposerSettingsChoice[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" }
];

const imageComposerOptions: AppComposerOption[] = [
  { id: "aspect-ratio", title: "Select ratio", defaultValue: "auto", choices: aspectRatioChoices, icon: PanelsTopLeft },
  { id: "resolution", title: "Resolution", defaultValue: "auto", choices: resolutionChoices, icon: ResolutionGemIcon }
];

export const videoAspectRatioChoices: AppComposerOptionChoice[] = [
  { value: "auto", label: "Auto", icon: Sparkles },
  { value: "9:16", label: "9:16", icon: createAspectRatioIcon("9:16") },
  { value: "16:9", label: "16:9", icon: createAspectRatioIcon("16:9") },
  { value: "1:1", label: "1:1", icon: createAspectRatioIcon("1:1") },
  { value: "4:3", label: "4:3", icon: createAspectRatioIcon("4:3") },
  { value: "3:4", label: "3:4", icon: createAspectRatioIcon("3:4") },
  { value: "21:9", label: "21:9", icon: createAspectRatioIcon("21:9") }
];

export const videoDurationChoices: AppComposerOptionChoice[] = [
  { value: "5s", label: "5s", icon: Clock },
  { value: "10s", label: "10s", icon: Clock },
  { value: "15s", label: "15s", icon: Clock }
];

const hotelLobbyDirectionComposerOptions: AppComposerOption[] = HOTEL_LOBBY_DIRECTION_OPTIONS.map((option) => ({
  id: option.id,
  title: option.title,
  defaultValue: "auto",
  icon: Sparkles,
  choices: [{ value: "auto", label: "Auto" }, ...option.choices]
}));

export const videoModelTierChoices: AppComposerOptionChoice[] = [
  { value: "lite", label: "Lite", icon: Sparkles },
  { value: "pro", label: "Pro", icon: Zap },
  { value: "max", label: "Max", icon: Crown }
];

export const videoComposerOptions: AppComposerOption[] = [
  { id: "model-tier", title: "Quality", defaultValue: APP_VIDEO_COMPOSER_DEFAULT_MODEL_TIER, choices: videoModelTierChoices, icon: Sparkles },
  { id: "aspect-ratio", title: "Select video ratio", defaultValue: "auto", choices: videoAspectRatioChoices, icon: PanelsTopLeft },
  { id: "duration", title: "Duration", defaultValue: "10s", choices: videoDurationChoices, icon: Clock }
];

function getComposerSettingsChoiceLabel(choices: AppComposerSettingsChoice[], value: string) {
  return choices.find((choice) => choice.value === value)?.label;
}

function resolveAppComposerDestinationPlatform(destination: AppComposerDestination, aspectRatio: string): AppComposerPlatform {
  if (destination === "instagram" || destination === "x") return destination;
  if (destination === "website_hero") return "x";
  return aspectRatio === "16:9" ? "x" : "instagram";
}

function getAppComposerDestinationDefaultAspectRatio(destination: AppComposerDestination): string | undefined {
  if (destination === "product_listing") return "1:1";
  if (destination === "website_hero" || destination === "x") return "16:9";
  if (destination === "story_reel_cover") return "9:16";
  if (destination === "social_ad" || destination === "instagram") return "4:5";
  return undefined;
}

function buildBusinessCardSubmittedInputText({
  inputText,
  styleLabel,
  industryLabel,
  outputLabel
}: {
  inputText: string;
  styleLabel: string;
  industryLabel: string;
  outputLabel: string;
}) {
  return [
    inputText,
    "",
    "Business card maker attributes:",
    `Style preference: ${styleLabel}.`,
    `Industry / use case: ${industryLabel}.`,
    `Output mode: ${outputLabel}.`,
    "Card size: Standard 3.5 x 2 inch landscape business card.",
    "Create flat 2D print-layout artwork, not a mockup. No perspective, no shadows, no desk, no paper texture, no photographed scene.",
    "Default to complete front and back business card outputs with safe margins and readable typography.",
    "Use only contact details supplied by the user. Do not invent phone numbers, emails, websites, addresses, titles, license numbers, QR codes, or claims."
  ].join("\n");
}

function buildLogoSubmittedInputText({
  inputText,
  logoTypeLabel,
  logoStyleLabel,
  logoIndustryLabel,
  aspectRatio
}: {
  inputText: string;
  logoTypeLabel: string;
  logoStyleLabel: string;
  logoIndustryLabel: string;
  aspectRatio: string;
}) {
  return [
    inputText,
    "",
    "AI logo generator attributes:",
    `Logo type: ${logoTypeLabel}.`,
    `Brand style: ${logoStyleLabel}.`,
    `Industry: ${logoIndustryLabel}.`,
    `Aspect ratio: ${aspectRatio}.`,
    "Create logo concepts and brand visual directions. Prioritize a clean scalable mark, readable composition, simple shapes, limited colors, and practical brand usage. Avoid copying existing brands or trademarked logos."
  ].join("\n");
}

function buildPersonalImageSubmittedInputText({
  inputText,
  templateLabel,
  templateInstruction,
  aspectRatio
}: {
  inputText: string;
  templateLabel: string;
  templateInstruction: string;
  aspectRatio: string;
}) {
  return [
    inputText || "Use the uploaded selfie to create a polished personal image result.",
    "",
    "Personal image production intent: Treat the uploaded portrait or selfie as the source of truth for identity, facial structure, and styling context. Preserve the person's identity while generating a realistic personal image concept.",
    `Template: ${templateLabel}.`,
    templateInstruction,
    `Format: ${aspectRatio}.`
  ].join("\n");
}

function buildTattooSubmittedInputText({
  inputText,
  styleLabel,
  placementLabel,
  complexityLabel,
  outputTypeLabel,
  outputType,
  aspectRatio
}: {
  inputText: string;
  styleLabel: string;
  placementLabel: string;
  complexityLabel: string;
  outputTypeLabel: string;
  outputType: string;
  aspectRatio: string;
}) {
  return [
    inputText,
    "",
    "Tattoo generator attributes:",
    `Style: ${styleLabel}.`,
    `Placement / body part: ${placementLabel}.`,
    `Complexity: ${complexityLabel}.`,
    `Output type: ${outputTypeLabel}.`,
    `Aspect ratio: ${aspectRatio}.`,
    "Treat this as a tattoo concept reference. Prioritize skin-readable composition, linework, scale, and negative space.",
    outputType === "stencil"
      ? "Make the result stencil-style: clean black linework, limited shading, strong negative space, and tattoo-transfer-friendly edges."
      : outputType === "placement_preview"
        ? "Show the tattoo as a body placement preview so scale, body flow, and fit are easy to judge."
        : "Create a concept direction that can be refined into stencil-style or placement-preview variants."
  ].join("\n");
}

function getRoomDesignSourceAssetRoleLines(assets: AppComposerSourceAsset[]) {
  const counts = assets.reduce<Record<AppComposerRoomDesignAssetRole, number>>((accumulator, asset) => {
    const role = asset.roomDesignRole ?? asset.room_design_role;
    if (role) accumulator[role] += 1;
    return accumulator;
  }, {
    room_photo: 0,
    furniture_reference: 0,
    style_reference: 0
  });
  const lines: string[] = [];
  if (counts.room_photo > 0) {
    lines.push("Uploaded room photo(s): use as the source of truth for architecture, camera angle, perspective, window and door placement, ceiling height, wall boundaries, and room proportions.");
  }
  if (counts.furniture_reference > 0) {
    lines.push("Uploaded furniture reference(s): use only as visual references for furniture type, shape, material, or color. Integrate naturally into the room; do not create a product collage.");
  }
  if (counts.style_reference > 0) {
    lines.push("Uploaded style reference(s): borrow mood, palette, materials, and decor direction only. Keep the actual room layout grounded in the room photo.");
  }
  return lines;
}

function buildRoomDesignSubmittedInputText({
  inputText,
  roomType,
  roomTypeLabel,
  styleLabel,
  colorLabel,
  sizeLabel,
  aspectRatio,
  sourceAssets
}: {
  inputText: string;
  roomType: string;
  roomTypeLabel: string;
  styleLabel: string;
  colorLabel: string;
  sizeLabel: string;
  aspectRatio: string;
  sourceAssets: AppComposerSourceAsset[];
}) {
  const roomTypePromptLine = roomType === "auto"
    ? "Room type: Auto-detect from the uploaded image and user request."
    : `Room type: ${roomTypeLabel}.`;
  const sourceRoleLines = getRoomDesignSourceAssetRoleLines(sourceAssets);
  return [
    inputText || "Use the uploaded room photo to create a polished AI room redesign.",
    "",
    "You are a professional interior design visualizer creating practical room makeover previews.",
    "AI room design attributes:",
    roomTypePromptLine,
    `Design style: ${styleLabel}.`,
    `Color scheme: ${colorLabel}.`,
    `Space size: ${sizeLabel}.`,
    `Aspect ratio: ${aspectRatio}.`,
    ...sourceRoleLines,
    sourceRoleLines.length
      ? "If role instructions conflict, prioritize the uploaded room photo for geometry and use other references only for design direction."
      : "Use the uploaded room photo as the source of truth for architecture, camera angle, perspective, window and door placement, ceiling height, wall boundaries, and room proportions.",
    "Redesign the interior with realistic furniture, decor, lighting, materials, and color choices. Preserve the room layout unless the user explicitly asks for structural changes.",
    "When multiple outputs are requested, create two distinct options: Option A keeps the existing layout very close; Option B explores a stronger makeover while preserving the real architecture.",
    "This is a visual planning preview, not a measurement-accurate CAD plan. Avoid impossible architecture, fake windows, distorted walls, unreadable labels, watermarks, people, brand logos, or real estate staging text."
  ].join("\n");
}

function buildClothesChangerSubmittedInputText({
  inputText,
  aspectRatio
}: {
  inputText: string;
  aspectRatio: string;
}) {
  return [
    inputText || CLOTHES_CHANGER_DEFAULT_PROMPT,
    "",
    "AI clothes changer attributes:",
    "Use uploaded image 1 as the person source of truth: preserve the exact identity, face, hairstyle, expression, head size, body height, body proportions, limb length, pose, camera angle, perspective, and framing.",
    "Use uploaded image 2 as the clothes source: transfer the garment design, color, fabric, graphic, neckline, sleeve shape, fit, and styling onto the same person.",
    "Fit the clothing to the person's original body scale. Do not resize the person to match the garment. Do not make the person shorter, wider, older, younger, heavier, thinner, or change leg length.",
    "If the user asks to change the background, replace only the environment while keeping the same person geometry, pose, camera perspective, and natural contact shadows. Otherwise preserve the original background.",
    "Make the clothing look naturally worn with realistic scale, fabric folds, shadows, occlusion, sleeve openings, hem placement, neckline, and lighting consistency.",
    "Do not replace the person, do not beautify into a different face, do not invent a different model, and do not turn the output into a fashion catalog collage.",
    `Aspect ratio: ${aspectRatio}.`
  ].join("\n");
}

function getVideoSubmittedInputText(inputText: string, sourceAssets: AppComposerSourceAsset[]) {
  if (inputText.trim()) return inputText;
  return sourceAssets.length > 1
    ? "Create a short AI video that uses the uploaded reference images for visual direction."
    : sourceAssets.length
      ? "Animate this uploaded image into a short AI video."
      : "";
}

export function buildSpotifyCanvasSubmittedInputText(inputText: string) {
  return [
    inputText.trim() || SPOTIFY_CANVAS_DEFAULT_DISPLAY_PROMPT,
    "",
    "Spotify Canvas production intent:",
    "Create a seamless-feeling 5-second vertical 9:16 Spotify Canvas video from the uploaded album cover.",
    "Preserve the album identity, subject identity, composition, color palette, and all visible typography exactly. Keep every title, artist name, logo, and label static, sharp, correctly spelled, and in its original position.",
    "Animate only subtle environmental motion such as drifting fog, falling rain, moving light, reflections, particles, fabric, hair, or a very gentle camera float.",
    "Avoid strong push-ins, zooms, face changes, body changes, morphing, scene cuts, new objects, new text, subtitles, watermarks, and abrupt motion.",
    "Keep the first and last moments visually compatible so the result can loop cleanly.",
    "Output constraints: 5 seconds, 9:16 portrait."
  ].join("\n");
}

function buildPromoVideoSubmittedInputText(params: {
  inputText: string;
  aspectRatio: string;
  duration: number;
}) {
  return [
    params.inputText,
    "",
    "Promo video production intent:",
    "Create a concise, polished promotional video for a product, service, offer, event, launch, or brand campaign.",
    "Establish the subject immediately, communicate one clear benefit, and finish with a confident campaign-ready visual beat.",
    "Use uploaded images as the source of truth for the product, packaging, logo, people, brand colors, and visual identity.",
    "Keep visible brand names, logos, packaging details, and product shapes stable and recognizable. Do not invent claims, prices, discounts, testimonials, contact details, or legal copy.",
    "Favor deliberate product motion, cinematic lighting, purposeful camera movement, clean transitions, and composition that remains readable on social feeds.",
    "Avoid random scene changes, distracting morphing, duplicate products, distorted hands or faces, misspelled text, new watermarks, and unrequested subtitles.",
    `Output constraints: ${params.duration} seconds, ${params.aspectRatio === "auto" ? "platform-flexible framing" : params.aspectRatio}.`
  ].join("\n");
}

function parseAppVideoDurationSeconds(value?: string) {
  const seconds = Number.parseInt(value ?? "", 10);
  return Number.isFinite(seconds) ? Math.max(5, Math.min(15, seconds)) : 10;
}

function normalizeAppVideoModelTier(value?: string): AppVideoModelTier {
  if (value === "pro" || value === "max") return value;
  return APP_VIDEO_COMPOSER_DEFAULT_MODEL_TIER;
}

export function isPaidAppVideoPlan(account: AppAccountSummary): boolean {
  return account.isLoggedIn
    && (account.plan === "pro" || account.plan === "max" || (account.plan === "basic" && !isV22BasicVideoRestricted(account)));
}

export function resolveSpotifyCanvasVideoResolution(account: AppAccountSummary): string {
  return isPaidAppVideoPlan(account)
    ? SPOTIFY_CANVAS_PAID_VIDEO_RESOLUTION
    : APP_VIDEO_COMPOSER_DEFAULT_RESOLUTION;
}

function isV22BasicVideoRestricted(account: AppAccountSummary): boolean {
  return account.isLoggedIn
    && (
      account.subscriptionPackageId === "basic_monthly_v22"
      || account.subscriptionPackageId === "basic_annual_v22"
    );
}

export function dispatchAppUpgradeModal(params: { trigger?: string; billingSurface?: string } = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(APP_UPGRADE_MODAL_EVENT, { detail: params }));
}

function buildAppVideoComposerOptions(
  account: AppAccountSummary,
  baseOptions: AppComposerOption[] = videoComposerOptions,
  freeDurationLimit = 10
): AppComposerOption[] {
  if (isPaidAppVideoPlan(account)) return baseOptions;
  return baseOptions.map((option) => (
    option.id === "duration"
      ? {
          ...option,
          choices: option.choices.map((choice) => (
            parseAppVideoDurationSeconds(choice.value) > freeDurationLimit
              ? { ...choice, locked: true, lockLabel: "Upgrade to unlock longer videos" }
              : choice
          ))
        }
      : option.id === "model-tier"
        ? {
            ...option,
            choices: option.choices.map((choice) => (
              choice.value === APP_VIDEO_COMPOSER_DEFAULT_MODEL_TIER
                ? choice
                : { ...choice, locked: true, lockLabel: "Upgrade to unlock higher quality video models" }
            ))
          }
      : option.id === "video-resolution"
        ? {
            ...option,
            choices: option.choices.map((choice) => (
              choice.value === "2k"
                ? { ...choice, locked: true, lockLabel: "Upgrade to unlock 2K video generation" }
                : choice
            ))
          }
      : option
  ));
}

export function inferAppVideoOrientation(aspectRatio: string): "landscape" | "portrait" {
  return aspectRatio === "16:9" || aspectRatio === "4:3" || aspectRatio === "21:9" ? "landscape" : "portrait";
}

export function AppComposer({
  options,
  placeholder,
  initialPrompt = "",
  inspirationPrompt,
  promptSuggestion,
  compact = false,
  className,
  actionsClassName,
  uploadRowClassName,
  uploadButtonClassName,
  uploadInToolbar = false,
  requireSourceImage = false,
  allowImageOnlySubmit = false,
  submitClassName,
  leadingAction,
  hideOptions = false,
  hideSafetyNotice = false,
  deferClaimedGuestAuthToSession = false,
  draftStorageKey,
  submitAfterAuthStorageKey,
  onBeforeAuth,
  onAuthCancelled,
  suppressAuthRequiredError = false,
  submitLabel,
  submitPathSlug = "ai-image-maker",
  sourceUseCase = submitPathSlug,
  sessionId,
  hasActiveVideoJob = false,
  continuationSourceAssets = [],
  redirectMode = "chat",
  onChatSubmit,
  onMockSubmit
}: AppComposerProps) {
  const uiLocale = useUiLocale();
  const isMobileComposer = useSyncExternalStore(subscribeMobileComposer, getMobileComposerSnapshot, getServerMobileComposerSnapshot);
  const router = useRouter();
  const account = useAppAccountStore((state) => state.account);
  const isVideoComposer = isVideoGenerationSourceUseCase(sourceUseCase) || isVideoGenerationSourceUseCase(submitPathSlug);
  const resolvedOptions = options ?? (isVideoComposer ? videoComposerOptions : imageComposerOptions);
  const accountReady = useAppAccountStore((state) => state.isReady);
  const requestIdentityReady = isAccountRequestIdentityReady(accountReady);
  const composerRef = useRef<HTMLElement | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const threadTouchStartRef = useRef<{ action: HTMLElement | null; startedAt: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadedImageUrlsRef = useRef<Map<number, string>>(new Map());
  const uploadRequestIdRef = useRef(0);
  const activeUploadRequestIdsRef = useRef<Set<number>>(new Set());
  const clothesUploadRequestIdsRef = useRef<Map<AppComposerClothesChangerUploadSlot, number>>(new Map());
  const imageDragDepthRef = useRef(0);
  const pendingClothesUploadSlotRef = useRef<AppComposerClothesChangerUploadSlot | null>(null);
  const pendingAuthSubmitRef = useRef(false);
  const submitAfterAuthRef = useRef<() => void>(() => undefined);
  const [promptText, setPromptText] = useState("");
  const [isThreadComposerExpanded, setIsThreadComposerExpanded] = useState(false);
  const [draftReady, setDraftReady] = useState(!draftStorageKey);
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);
  const [isAspectRatioExpanded, setIsAspectRatioExpanded] = useState(false);
  const [openSettingsSelectId, setOpenSettingsSelectId] = useState<AppComposerSettingsSelectId | null>(null);
  const [settingsSelectPlacements, setSettingsSelectPlacements] = useState<Partial<Record<AppComposerSettingsSelectId, AppComposerSettingsSelectPlacement>>>({});
  const [settingsSelectMenuPosition, setSettingsSelectMenuPosition] = useState<AppComposerSettingsMenuPosition | null>(null);
  const [flyerType, setFlyerType] = useState("auto");
  const [flyerStyle, setFlyerStyle] = useState("modern");
  const [comicStyle, setComicStyle] = useState("auto");
  const [comicAspectRatioWasExplicitlySelected, setComicAspectRatioWasExplicitlySelected] = useState(false);
  const [babyShowerTheme, setBabyShowerTheme] = useState("auto");
  const [babyShowerStyle, setBabyShowerStyle] = useState("auto");
  const [babyShowerThemeSelected, setBabyShowerThemeSelected] = useState(false);
  const [babyShowerStyleSelected, setBabyShowerStyleSelected] = useState(false);
  const [babyShowerRatioSelected, setBabyShowerRatioSelected] = useState(false);
  const [playlistMood, setPlaylistMood] = useState("auto");
  const [playlistStyle, setPlaylistStyle] = useState("auto");
  const [playlistMoodSelected, setPlaylistMoodSelected] = useState(false);
  const [playlistStyleSelected, setPlaylistStyleSelected] = useState(false);
  const [playlistRatioSelected, setPlaylistRatioSelected] = useState(false);
  const [visionBoardStyle, setVisionBoardStyle] = useState("auto");
  const [visionBoardRatioSelected, setVisionBoardRatioSelected] = useState(false);
  const [animeStyle, setAnimeStyle] = useState("auto");
  const [animeAspectRatioWasExplicitlySelected, setAnimeAspectRatioWasExplicitlySelected] = useState(false);
  const [menuStyleWasExplicitlySelected, setMenuStyleWasExplicitlySelected] = useState(false);
  const [certificateStyleWasExplicitlySelected, setCertificateStyleWasExplicitlySelected] = useState(false);
  const [productAdUse, setProductAdUse] = useState<AppComposerDestination>("auto");
  const [businessCardIndustry, setBusinessCardIndustry] = useState("auto");
  const [businessCardStyle, setBusinessCardStyle] = useState("auto");
  const [businessCardOutput, setBusinessCardOutput] = useState("front_back");
  const [logoType, setLogoType] = useState("auto");
  const [logoStyle, setLogoStyle] = useState("auto");
  const [logoIndustry, setLogoIndustry] = useState("auto");
  const [personalImageTemplate, setPersonalImageTemplate] = useState("auto");
  const [tattooPlacement, setTattooPlacement] = useState("forearm");
  const [tattooStyle, setTattooStyle] = useState("black_grey");
  const [tattooComplexity, setTattooComplexity] = useState("medium");
  const [tattooOutputType, setTattooOutputType] = useState("concept");
  const [roomDesignRoom, setRoomDesignRoom] = useState("auto");
  const [roomDesignStyle, setRoomDesignStyle] = useState("modern");
  const [roomDesignColor, setRoomDesignColor] = useState("neutral");
  const [roomDesignSize, setRoomDesignSize] = useState("medium");
  const [uploadedImages, setUploadedImages] = useState<AppComposerUploadedImage[]>([]);
  const [isImageDragActive, setIsImageDragActive] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showPromptError, setShowPromptError] = useState(false);
  const promptErrorId = useId();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => (
    {
      ...Object.fromEntries(resolvedOptions.map((option) => [option.id, option.defaultValue])),
      ...(
        sourceUseCase === "poster-maker" || submitPathSlug === "poster-maker"
          ? { "aspect-ratio": "2:3" }
          : isSpotifyCanvasSourceUseCase(sourceUseCase) || isSpotifyCanvasSourceUseCase(submitPathSlug)
            ? { "aspect-ratio": "9:16", duration: "5s" }
          : sourceUseCase === "hotel-lobby-ai" || submitPathSlug === "hotel-lobby-ai"
            ? { "aspect-ratio": "9:16", duration: "5s" }
          : isMiniMaxH3VideoFlowSourceUseCase(sourceUseCase) || isMiniMaxH3VideoFlowSourceUseCase(submitPathSlug)
            ? { "aspect-ratio": "auto", duration: "10s" }
          : sourceUseCase === "ai-brochure-generator" || submitPathSlug === "ai-brochure-generator"
            ? { "aspect-ratio": "4:3" }
            : sourceUseCase === "ai-comic-generator" || submitPathSlug === "ai-comic-generator"
              ? { "aspect-ratio": "2:3" }
            : sourceUseCase === "baby-shower-invitations" || submitPathSlug === "baby-shower-invitations"
              ? { "aspect-ratio": "4:5" }
            : sourceUseCase === "playlist-cover-maker" || submitPathSlug === "playlist-cover-maker"
              ? { "aspect-ratio": "1:1" }
            : sourceUseCase === "vision-board-maker" || submitPathSlug === "vision-board-maker"
              ? { "aspect-ratio": "1:1" }
            : sourceUseCase === "ai-anime-generator" || submitPathSlug === "ai-anime-generator"
              ? { "aspect-ratio": "1:1" }
            : sourceUseCase === "ai-infographic-generator" || submitPathSlug === "ai-infographic-generator"
              ? { "aspect-ratio": "2:3" }
            : sourceUseCase === "ai-menu-generator" || submitPathSlug === "ai-menu-generator"
              ? { "aspect-ratio": "2:3" }
            : sourceUseCase === "ai-certificate-generator" || submitPathSlug === "ai-certificate-generator"
              ? { "aspect-ratio": "4:3" }
            : sourceUseCase === "ai-flyer-generator" || submitPathSlug === "ai-flyer-generator"
              ? { "aspect-ratio": "3:4" }
              : sourceUseCase === "ai-room-design"
                || sourceUseCase === "room-design"
                || submitPathSlug === "ai-room-design"
                || submitPathSlug === "room-design"
                ? { "aspect-ratio": "16:9" }
                : {}
      )
    }
  ));
  const isBrochureComposer = sourceUseCase === "ai-brochure-generator" || submitPathSlug === "ai-brochure-generator";
  const isInfographicComposer = sourceUseCase === "ai-infographic-generator" || submitPathSlug === "ai-infographic-generator";
  const isComicComposer = sourceUseCase === "ai-comic-generator" || submitPathSlug === "ai-comic-generator";
  const isBabyShowerInvitationComposer = sourceUseCase === "baby-shower-invitations" || submitPathSlug === "baby-shower-invitations";
  const isPlaylistCoverComposer = sourceUseCase === "playlist-cover-maker" || submitPathSlug === "playlist-cover-maker";
  const isVisionBoardComposer = sourceUseCase === "vision-board-maker" || submitPathSlug === "vision-board-maker";
  const isAnimeComposer = sourceUseCase === "ai-anime-generator" || submitPathSlug === "ai-anime-generator";
  const isMenuComposer = sourceUseCase === "ai-menu-generator" || submitPathSlug === "ai-menu-generator";
  const isCertificateComposer = sourceUseCase === "ai-certificate-generator" || submitPathSlug === "ai-certificate-generator";
  const isImageTextEditorComposer = sourceUseCase === "ai-image-text-editor" || submitPathSlug === "ai-image-text-editor";
  const isFlyerComposer = sourceUseCase === "ai-flyer-generator" || submitPathSlug === "ai-flyer-generator" || sourceUseCase === "poster-maker" || submitPathSlug === "poster-maker" || isBrochureComposer || isInfographicComposer || isComicComposer || isAnimeComposer || isPlaylistCoverComposer || isBabyShowerInvitationComposer || isVisionBoardComposer || isMenuComposer || isCertificateComposer;
  const isPosterComposer = sourceUseCase === "poster-maker" || submitPathSlug === "poster-maker";
  const isProductAdComposer = sourceUseCase === "ai-product-ad-image-generator" || submitPathSlug === "ai-product-ad-image-generator";
  const isBusinessCardComposer = sourceUseCase === "business-card-maker" || submitPathSlug === "business-card-maker";
  const isLogoComposer = sourceUseCase === "ai-logo-generator" || submitPathSlug === "ai-logo-generator";
  const isPersonalImageComposer = sourceUseCase === "ai-personal-image-generator" || submitPathSlug === "ai-personal-image-generator";
  const isTattooComposer = sourceUseCase === "tattoo-generator" || submitPathSlug === "tattoo-generator";
  const isClothesChangerComposer = sourceUseCase === "ai-clothes-changer" || submitPathSlug === "ai-clothes-changer";
  const isClothesChangerFixedComposer = isClothesChangerComposer && !compact;
  const isSpotifyCanvasComposer = isSpotifyCanvasSourceUseCase(sourceUseCase) || isSpotifyCanvasSourceUseCase(submitPathSlug);
  const isHotelLobbyComposer = sourceUseCase === "hotel-lobby-ai" || submitPathSlug === "hotel-lobby-ai";
  const hotelLobbyCast = normalizeHotelLobbyCast(selectedOptions["hotel-lobby-cast"]);
  const isPromoVideoComposer = sourceUseCase === "promo-video-maker" || submitPathSlug === "promo-video-maker";
  const isMiniMaxH3VideoComposer = isMiniMaxH3VideoFlowSourceUseCase(sourceUseCase)
    || isMiniMaxH3VideoFlowSourceUseCase(submitPathSlug);
  const requiresSpotifyCanvasCover = isSpotifyCanvasComposer && !compact;
  const isV22BasicVideoUser = isVideoComposer && isV22BasicVideoRestricted(account);
  const hasPaidVideoPlan = isPaidAppVideoPlan(account);
  const selectedVideoModelTier = normalizeAppVideoModelTier(selectedOptions["model-tier"]);
  const selectedVideoResolution = selectedOptions["video-resolution"] ?? MINIMAX_H3_VIDEO_COMPOSER_DEFAULT_RESOLUTION;
  const isRoomDesignComposer = sourceUseCase === "ai-room-design" || sourceUseCase === "room-design" || submitPathSlug === "ai-room-design" || submitPathSlug === "room-design";
  const isBackgroundRemoverComposer = sourceUseCase === "background-remover" || submitPathSlug === "background-remover";
  const effectiveOptions = useMemo(() => (
    isVideoComposer
      ? buildAppVideoComposerOptions(account, isHotelLobbyComposer ? [...resolvedOptions, ...hotelLobbyDirectionComposerOptions] : resolvedOptions, isHotelLobbyComposer ? 5 : 10)
      : resolvedOptions
  ), [account, isVideoComposer, isHotelLobbyComposer, resolvedOptions]);
  const hasSpecializedSettings = isFlyerComposer || isProductAdComposer || isBusinessCardComposer || isLogoComposer || isPersonalImageComposer || isTattooComposer || isRoomDesignComposer;
  const showsComposerOptionsInSettings = !hideOptions && effectiveOptions.length > 0;
  const hasSettingsSheet = hasSpecializedSettings || showsComposerOptionsInSettings;
  const settingsComposerOptions = useMemo(() => {
    const priorities: Record<string, number> = {
      resolution: 0,
      "model-tier": 0,
      "video-resolution": 1,
      "aspect-ratio": 2
    };
    return effectiveOptions.filter((option) => option.id !== "hotel-lobby-cast").sort((left, right) => (
      (priorities[left.id] ?? 3) - (priorities[right.id] ?? 3)
    ));
  }, [effectiveOptions]);
  const composerPlaceholder = placeholder ?? getAppComposerPlaceholder(sourceUseCase);
  const uploadedSourceAssets = uploadedImages
    .filter((image) => image.status === "uploaded")
    .map((image) => image.sourceAsset)
    .filter((asset): asset is AppComposerSourceAsset => Boolean(asset));
  const {
    availableSourceAssets,
    usesContinuationSourceAssets
  } = resolveComposerSubmissionSourceAssets({
    supportsContinuation: isRoomDesignComposer || isBackgroundRemoverComposer || isImageTextEditorComposer,
    uploadedSourceAssets,
    continuationSourceAssets
  });
  const hasUploadedImage = uploadedSourceAssets.length > 0;
  const hasPendingUpload = uploadedImages.some((image) => image.status === "uploading");
  const isEditingSession = Boolean(sessionId?.trim());
  const isThreadComposer = compact && isEditingSession;
  const usesResponsiveComposer = !isHotelLobbyComposer && (isThreadComposer || (uploadInToolbar && !isClothesChangerFixedComposer));
  const isExpandableComposer = isThreadComposer || usesResponsiveComposer;
  const allowsTextlessSubmission = !isEditingSession
    && (isHotelLobbyComposer || (allowImageOnlySubmit && sourceUseCase === "general")
      || resolveGeneratorUseCaseContext(sourceUseCase || submitPathSlug).sourceUseCase === "ai-album-cover");
  const hasRequiredSubmissionText = Boolean(promptText.trim()) || (allowsTextlessSubmission && hasUploadedImage);
  const promptErrorVisible = showPromptError && !hasRequiredSubmissionText;
  const threadComposerIsExpanded = !isExpandableComposer
    || isThreadComposerExpanded
    || Boolean(promptText.trim())
    || uploadedImages.length > 0
    || isImageDragActive
    || Boolean(submitError)
    || promptErrorVisible
    || isSettingsSheetOpen;
  const visibleComposerPlaceholder = usesResponsiveComposer && isMobileComposer && !threadComposerIsExpanded
    ? t(uiLocale, sourceUseCase === "general"
      ? "workbench.composer.placeholder.mobile.general"
      : isThreadComposer
        ? "workbench.composer.placeholder.mobile.edit"
        : "workbench.composer.placeholder.mobile.create")
    : composerPlaceholder;

  useEffect(() => {
    if (!isExpandableComposer || !isThreadComposerExpanded) return;
    // Resizing the dock as the keyboard closes can move another result under
    // the finger before the browser dispatches click.
    const recordThreadTouchStart = (event: PointerEvent) => {
      threadTouchStartRef.current = null;
      // Mobile browsers can adjust a touch target to a nearby control. Use the
      // element actually painted at the initial coordinate instead.
      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (
        event.pointerType !== "touch"
        || !(target instanceof Element)
        || composerRef.current?.contains(target)
        || !target.closest("[data-chat-thread-body]")
      ) return;
      const action = target.closest("button, a, [role='button']");
      threadTouchStartRef.current = {
        action: action instanceof HTMLElement ? action : null,
        startedAt: Date.now()
      };
    };
    const clearThreadTouchStart = () => {
      threadTouchStartRef.current = null;
    };
    const dismissOnThreadTouch = (event: MouseEvent) => {
      const start = threadTouchStartRef.current;
      threadTouchStartRef.current = null;
      if (!start || Date.now() - start.startedAt > 2000) return;
      const clickedAction = event.target instanceof Element
        ? event.target.closest("button, a, [role='button']")
        : null;
      if (start.action && clickedAction === start.action) {
        promptTextareaRef.current?.blur();
        setIsThreadComposerExpanded(false);
        return;
      }
      // Consume the browser's retargeted click, then activate the control that
      // was under the finger before the keyboard and composer moved the thread.
      event.preventDefault();
      event.stopPropagation();
      promptTextareaRef.current?.blur();
      setIsThreadComposerExpanded(false);
      if (start.action?.isConnected) start.action.click();
    };
    const collapseOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !composerRef.current?.contains(event.target)) {
        setIsThreadComposerExpanded(false);
      }
    };
    document.addEventListener("pointerdown", recordThreadTouchStart, true);
    document.addEventListener("pointercancel", clearThreadTouchStart, true);
    document.addEventListener("click", dismissOnThreadTouch, true);
    document.addEventListener("click", collapseOnOutsideClick);
    return () => {
      document.removeEventListener("pointerdown", recordThreadTouchStart, true);
      document.removeEventListener("pointercancel", clearThreadTouchStart, true);
      document.removeEventListener("click", dismissOnThreadTouch, true);
      document.removeEventListener("click", collapseOnOutsideClick);
      threadTouchStartRef.current = null;
    };
  }, [isExpandableComposer, isThreadComposerExpanded]);

  useEffect(() => {
    if (hasRequiredSubmissionText) setShowPromptError(false);
  }, [hasRequiredSubmissionText]);
  const clothesChangerUploadedSlots = new Set(
    uploadedImages
      .filter((image) => image.status === "uploaded" && image.sourceAsset && image.uploadSlot)
      .map((image) => image.uploadSlot)
  );
  const hasRequiredClothesChangerImages = !isClothesChangerFixedComposer
    || (clothesChangerUploadedSlots.has("person") && clothesChangerUploadedSlots.has("clothes"));
  const maxUploads = isHotelLobbyComposer
    ? hotelLobbyCast === "solo" ? 1 : 2
    : isBackgroundRemoverComposer || isImageTextEditorComposer
    ? 1
    : isClothesChangerFixedComposer
      ? 2
      : isSpotifyCanvasComposer
        ? SPOTIFY_CANVAS_COMPOSER_MAX_UPLOADS
      : isVideoComposer
        ? APP_VIDEO_COMPOSER_MAX_UPLOADS
        : APP_COMPOSER_MAX_UPLOADS;
  // Restoring a draft must not run again when the cast's upload limit changes.
  const draftMaxUploads = isHotelLobbyComposer ? 2 : maxUploads;
  const canAddUploads = isImageTextEditorComposer
    ? uploadedImages.length === 0
    : uploadedImages.length < maxUploads;
  const uploadButtonLabel = isRoomDesignComposer
    ? "Add room photo"
    : isBackgroundRemoverComposer
      ? "Upload image to remove background"
      : isImageTextEditorComposer
        ? "Upload image to edit text"
      : isSpotifyCanvasComposer
        ? "Add album cover"
      : isClothesChangerFixedComposer
        ? "Add person and clothes images"
        : isVideoComposer
          ? "Add video reference image"
          : "Upload image";
  const hasRequiredSubmissionInput = allowsTextlessSubmission
    ? promptText.trim().length > 0 || hasUploadedImage
    : hasRequiredSubmissionText;
  const canSubmit = requestIdentityReady
    && (!isHotelLobbyComposer || isEditingSession || !getHotelLobbyUploadError(hotelLobbyCast, uploadedSourceAssets.length))
    && hasRequiredSubmissionInput && (
    requireSourceImage
      ? hasUploadedImage
      : requiresSpotifyCanvasCover
      ? hasUploadedImage
      : isClothesChangerFixedComposer
        ? hasRequiredClothesChangerImages
        : isImageTextEditorComposer
          ? availableSourceAssets.length > 0
        : true
  ) && !hasPendingUpload && !isSubmitting;
  const activeVideoSubmitMessage = isVideoComposer && hasActiveVideoJob
    ? VIDEO_GENERATION_IN_PROGRESS_MESSAGE
    : undefined;
  const draftAssetsStorageKey = draftStorageKey ? `${draftStorageKey}.assets` : undefined;

  useEffect(() => {
    if (activeVideoSubmitMessage) return;
    setSubmitError((current) => current === VIDEO_GENERATION_IN_PROGRESS_MESSAGE ? "" : current);
  }, [activeVideoSubmitMessage]);

  useEffect(() => {
    if (!isVideoComposer || hasPaidVideoPlan) return;
    const freeDurationLimit = isHotelLobbyComposer ? 5 : 10;
    if (parseAppVideoDurationSeconds(selectedOptions.duration) <= freeDurationLimit) return;
    setSelectedOptions((current) => ({ ...current, duration: `${freeDurationLimit}s` }));
  }, [hasPaidVideoPlan, isVideoComposer, isHotelLobbyComposer, selectedOptions.duration]);

  useEffect(() => {
    if (!isVideoComposer || hasPaidVideoPlan) return;
    if (selectedVideoModelTier === APP_VIDEO_COMPOSER_DEFAULT_MODEL_TIER) return;
    setSelectedOptions((current) => ({ ...current, "model-tier": APP_VIDEO_COMPOSER_DEFAULT_MODEL_TIER }));
  }, [hasPaidVideoPlan, isVideoComposer, selectedVideoModelTier]);

  useEffect(() => {
    if (!isMiniMaxH3VideoComposer || hasPaidVideoPlan) return;
    if (selectedVideoResolution !== "2k") return;
    setSelectedOptions((current) => ({
      ...current,
      "video-resolution": MINIMAX_H3_VIDEO_COMPOSER_DEFAULT_RESOLUTION
    }));
  }, [hasPaidVideoPlan, isMiniMaxH3VideoComposer, selectedVideoResolution]);

  const submitDisabledReason = hasPendingUpload
    ? "Wait for your image upload to finish before generating."
    : isSubmitting
      ? "Starting generation..."
      : isClothesChangerFixedComposer && !hasRequiredClothesChangerImages
        ? "Upload a person image and a clothes reference before generating."
      : requiresSpotifyCanvasCover && !hasUploadedImage
        ? "Upload an album cover before generating a Spotify Canvas."
      : isHotelLobbyComposer && !isEditingSession && getHotelLobbyUploadError(hotelLobbyCast, uploadedSourceAssets.length)
        ? getHotelLobbyUploadError(hotelLobbyCast, uploadedSourceAssets.length)
      : requireSourceImage && !hasUploadedImage
        ? "Upload an image before generating a video."
      : isImageTextEditorComposer && availableSourceAssets.length === 0
        ? "Upload an image before editing its text."
      : isV22BasicVideoUser
        ? "Basic includes images only. Upgrade to generate videos."
      : !hasRequiredSubmissionText
        ? allowsTextlessSubmission
          ? "Enter an instruction or upload a reference image."
          : "Enter an instruction before submitting."
      : undefined;

  const resizePromptTextarea = useCallback(() => {
    const textarea = promptTextareaRef.current;
    if (!textarea || typeof window === "undefined") return;

    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 24;
    const paddingBlock =
      (Number.parseFloat(computedStyle.paddingTop) || 0)
      + (Number.parseFloat(computedStyle.paddingBottom) || 0);
    const borderBlock =
      (Number.parseFloat(computedStyle.borderTopWidth) || 0)
      + (Number.parseFloat(computedStyle.borderBottomWidth) || 0);
    const minHeight = lineHeight * 2 + paddingBlock + borderBlock;
    const maxHeight = lineHeight * 4 + paddingBlock + borderBlock;

    textarea.style.height = `${minHeight}px`;
    const nextHeight = Math.min(Math.max(textarea.scrollHeight + borderBlock, minHeight), maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight + borderBlock > maxHeight ? "auto" : "hidden";
  }, []);

  useLayoutEffect(() => {
    resizePromptTextarea();
  }, [promptText, resizePromptTextarea]);

  useLayoutEffect(() => {
    if (!usesResponsiveComposer) return;
    resizePromptTextarea();
    window.addEventListener("resize", resizePromptTextarea);
    return () => window.removeEventListener("resize", resizePromptTextarea);
  }, [threadComposerIsExpanded, resizePromptTextarea, usesResponsiveComposer]);

  useEffect(() => {
    let nextPrompt = initialPrompt.trim().slice(0, SOCIALMEDIA_COMPOSER_MAX_CHARS);
    if (draftStorageKey) {
      try {
        const storedPrompt = window.sessionStorage.getItem(draftStorageKey);
        if (storedPrompt !== null && (storedPrompt || sourceUseCase === "general")) {
          nextPrompt = storedPrompt.trim().slice(0, SOCIALMEDIA_COMPOSER_MAX_CHARS);
        }
      } catch {
        // Fall back to the supplied prompt when session storage is unavailable.
      }
    }
    setPromptText(nextPrompt);

    if (draftAssetsStorageKey) {
      try {
        const storedAssets = JSON.parse(window.sessionStorage.getItem(draftAssetsStorageKey) ?? "[]") as unknown;
        const restoredAssets = Array.isArray(storedAssets)
          ? storedAssets.flatMap((storedAsset): AppComposerSourceAsset[] => {
            const sourceAsset = normalizeAppComposerSourceAsset(
              storedAsset && typeof storedAsset === "object"
                ? storedAsset as AppComposerUploadResponse["asset"]
                : undefined
            );
            if (!sourceAsset?.url) return [];
            return [sourceAsset];
          })
          : [];
        const boundedRestoredImages = restoredAssets
          .slice(0, draftMaxUploads)
          .map((sourceAsset, index): AppComposerUploadedImage => ({
            requestId: index + 1,
            name: sourceAsset.originalName || "Uploaded image",
            status: "uploaded",
            sourceAsset
          }));
        revokeAllUploadedImageUrls();
        uploadRequestIdRef.current = boundedRestoredImages.length;
        activeUploadRequestIdsRef.current.clear();
        boundedRestoredImages.forEach((image) => activeUploadRequestIdsRef.current.add(image.requestId));
        clothesUploadRequestIdsRef.current.clear();
        boundedRestoredImages.forEach((image) => {
          if (image.uploadSlot) clothesUploadRequestIdsRef.current.set(image.uploadSlot, image.requestId);
        });
        setUploadedImages(boundedRestoredImages);
      } catch {
        revokeAllUploadedImageUrls();
        activeUploadRequestIdsRef.current.clear();
        clothesUploadRequestIdsRef.current.clear();
        setUploadedImages([]);
      }
    }
    setDraftReady(true);
  }, [draftAssetsStorageKey, draftStorageKey, initialPrompt, draftMaxUploads, sourceUseCase]);

  useEffect(() => {
    if (!promptSuggestion) return;
    setPromptText(promptSuggestion.text.slice(0, SOCIALMEDIA_COMPOSER_MAX_CHARS));
    promptTextareaRef.current?.focus({ preventScroll: true });
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [promptSuggestion]);

  useEffect(() => {
    if (!inspirationPrompt) return;
    setPromptText(inspirationPrompt.text.trim().slice(0, SOCIALMEDIA_COMPOSER_MAX_CHARS));
    const frame = requestAnimationFrame(() => {
      promptTextareaRef.current?.focus({ preventScroll: true });
      promptTextareaRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "center"
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [inspirationPrompt]);

  useEffect(() => {
    if (!draftStorageKey || !draftReady) return;
    try {
      if (promptText || sourceUseCase === "general") {
        window.sessionStorage.setItem(draftStorageKey, promptText);
      } else {
        window.sessionStorage.removeItem(draftStorageKey);
      }
    } catch {
      // The current page still retains the draft in component state.
    }
  }, [draftReady, draftStorageKey, promptText, sourceUseCase]);

  useEffect(() => {
    if (!draftAssetsStorageKey || !draftReady) return;
    try {
      const sourceAssets = uploadedImages.flatMap((image) => image.status === "uploaded" && image.sourceAsset
        ? [image.sourceAsset]
        : []);
      if (sourceAssets.length) {
        window.sessionStorage.setItem(draftAssetsStorageKey, JSON.stringify(sourceAssets));
      } else {
        window.sessionStorage.removeItem(draftAssetsStorageKey);
      }
    } catch {
      // The current page still retains uploaded references in component state.
    }
  }, [draftAssetsStorageKey, draftReady, uploadedImages]);

  useEffect(() => {
    if (!submitAfterAuthStorageKey) {
      pendingAuthSubmitRef.current = false;
      return;
    }

    try {
      pendingAuthSubmitRef.current = window.sessionStorage.getItem(submitAfterAuthStorageKey) === "1";
    } catch {
      pendingAuthSubmitRef.current = false;
    }

    const cancelPendingSubmit = () => {
      pendingAuthSubmitRef.current = false;
      onAuthCancelled?.();
      try {
        window.sessionStorage.removeItem(submitAfterAuthStorageKey);
      } catch {
        // The in-memory cancellation is enough for the current page.
      }
    };

    window.addEventListener(APP_AUTH_MODAL_CLOSED_EVENT, cancelPendingSubmit);
    return () => window.removeEventListener(APP_AUTH_MODAL_CLOSED_EVENT, cancelPendingSubmit);
  }, [submitAfterAuthStorageKey, onAuthCancelled]);

  function revokeUploadedImageUrl(requestId: number) {
    const previewUrl = uploadedImageUrlsRef.current.get(requestId);
    if (!previewUrl) return;
    URL.revokeObjectURL(previewUrl);
    uploadedImageUrlsRef.current.delete(requestId);
  }

  function revokeAllUploadedImageUrls() {
    uploadedImageUrlsRef.current.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
    uploadedImageUrlsRef.current.clear();
  }

  function releaseActiveUploadRequest(requestId: number) {
    activeUploadRequestIdsRef.current.delete(requestId);
    clothesUploadRequestIdsRef.current.forEach((slotRequestId, slot) => {
      if (slotRequestId === requestId) clothesUploadRequestIdsRef.current.delete(slot);
    });
  }

  function clearComposerUploads() {
    revokeAllUploadedImageUrls();
    activeUploadRequestIdsRef.current.clear();
    clothesUploadRequestIdsRef.current.clear();
    setUploadedImages([]);
  }

  function replaceUploadedImagePreview(requestId: number, file: File) {
    const previousPreviewUrl = uploadedImageUrlsRef.current.get(requestId);
    if (!previousPreviewUrl) return;

    const nextPreviewUrl = URL.createObjectURL(file);
    uploadedImageUrlsRef.current.set(requestId, nextPreviewUrl);
    setUploadedImages((current) => current.map((image) => image.requestId === requestId ? {
      ...image,
      previewUrl: nextPreviewUrl
    } : image));
    URL.revokeObjectURL(previousPreviewUrl);
  }

  function handleUploadedImagePreviewError(requestId: number) {
    revokeUploadedImageUrl(requestId);
    setUploadedImages((current) => current.map((image) => image.requestId === requestId ? {
      ...image,
      previewUrl: undefined
    } : image));
  }

  function promptClaimedGuestLogin() {
    setSubmitError("");
    pendingClothesUploadSlotRef.current = null;
    openThreadClaimedGuestAuthModal(account);
  }

  function handleUploadClick() {
    // Only gate after the account snapshot resolves as claimed; keeping the initial guest state open avoids blocking real guests while /api/v1/account loads.
    if (account.authMode === "guest_claimed") {
      promptClaimedGuestLogin();
      return;
    }
    if (isV22BasicVideoUser) {
      setSubmitError("Basic includes images only. Upgrade to generate videos.");
      dispatchAppUpgradeModal({ trigger: "video_basic_v22_upgrade", billingSurface: "video_generation" });
      return;
    }
    pendingClothesUploadSlotRef.current = null;
    fileInputRef.current?.click();
  }

  function handleClothesChangerSlotClick(slot: AppComposerClothesChangerUploadSlot) {
    if (account.authMode === "guest_claimed") {
      promptClaimedGuestLogin();
      return;
    }
    pendingClothesUploadSlotRef.current = slot;
    fileInputRef.current?.click();
  }

  async function uploadComposerImage(file: File, requestId: number) {
    const uploadStartedAt = Date.now();
    let requestStartedAt: number | null = null;
    let requestDurationRecorded = false;
    const uploadUseCaseContext = resolveGeneratorUseCaseContext(sourceUseCase);
    const uploadSourceUseCase = uploadUseCaseContext.sourceUseCase;
    const analyticsOutputType = isVideoComposer ? "video" : "image";
    trackClientEvent("socialmedia.upload.started", {
      userId: account.id,
      appSessionId: sessionId,
      action: "upload",
      stage: "asset",
      status: "started",
      sourceUseCase: uploadSourceUseCase,
      source_use_case: uploadSourceUseCase,
      outputType: analyticsOutputType,
      output_type: analyticsOutputType,
      fileSizeBytes: file.size,
      fileType: file.type || undefined
    });

    try {
      const prepareStartedAt = Date.now();
      const uploadFile = await prepareUploadImageFile(file);
      if (uploadFile !== file) {
        replaceUploadedImagePreview(requestId, uploadFile);
      }
      trackClientEvent("socialmedia.upload.prepare.completed", {
        userId: account.id,
        appSessionId: sessionId,
        action: "upload",
        stage: "upload_prepare",
        status: "success",
        sourceUseCase: uploadSourceUseCase,
        source_use_case: uploadSourceUseCase,
        outputType: analyticsOutputType,
        output_type: analyticsOutputType,
        durationMs: Date.now() - prepareStartedAt,
        reason: uploadFile !== file ? "normalized" : "original"
      });
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("role", "reference_image");
      if (isVideoComposer) {
        formData.append("source_use_case", uploadSourceUseCase);
        formData.append("output_type", "video");
      }

      requestStartedAt = Date.now();
      const response = await fetch(isVideoComposer ? "/api/v1/vision/assets" : "/api/v1/socialmedia/assets", {
        method: "POST",
        headers: {
          ...buildGuestUserRequestHeaders(),
          "x-trace-id": createTraceId(),
          "x-session-id": getClientSessionId()
        },
        body: formData
      });
      const data = await response.json() as AppComposerUploadResponse;
      requestDurationRecorded = true;
      trackClientEvent("socialmedia.upload.request.completed", {
        userId: account.id,
        appSessionId: sessionId,
        action: "upload",
        stage: "upload_request",
        status: response.ok ? "success" : "failed",
        sourceUseCase: uploadSourceUseCase,
        source_use_case: uploadSourceUseCase,
        outputType: analyticsOutputType,
        output_type: analyticsOutputType,
        durationMs: Date.now() - requestStartedAt,
        statusCode: response.status
      });
      if (!response.ok) {
        throw new Error(data.error || "Failed to upload image.");
      }
      const sourceAsset = normalizeAppComposerSourceAsset(data.asset);
      if (!sourceAsset) {
        throw new Error("Upload response did not include an image asset.");
      }
      setUploadedImages((current) => current.map((image) => image.requestId === requestId ? {
        ...image,
        sourceAsset,
        status: "uploaded"
      } : image));
      // Keep the local object URL for the immediate preview. The remote asset URL
      // is still retained in sourceAsset for generation, while preview rendering
      // no longer waits on a second Storage request after upload succeeds.
      trackClientEvent("socialmedia.upload.completed", {
        userId: account.id,
        appSessionId: sessionId,
        action: "upload",
        stage: "asset",
        status: "success",
        sourceUseCase: uploadSourceUseCase,
        source_use_case: uploadSourceUseCase,
        outputType: analyticsOutputType,
        output_type: analyticsOutputType,
        assetId: sourceAsset.assetId,
        asset_id: sourceAsset.assetId,
        durationMs: Date.now() - uploadStartedAt,
        sizeBytes: sourceAsset.sizeBytes,
        fileType: sourceAsset.mimeType,
        originalFileSizeBytes: file.size,
        preparedFileSizeBytes: uploadFile.size,
        preparedFileType: uploadFile.type || undefined,
        normalizedBeforeUpload: uploadFile !== file
      });
    } catch (error) {
      if (requestStartedAt !== null && !requestDurationRecorded) {
        trackClientEvent("socialmedia.upload.request.failed", {
          userId: account.id,
          appSessionId: sessionId,
          action: "upload",
          stage: "upload_request",
          status: "failed",
          sourceUseCase: uploadSourceUseCase,
          source_use_case: uploadSourceUseCase,
          outputType: analyticsOutputType,
          output_type: analyticsOutputType,
          durationMs: Date.now() - requestStartedAt,
          errorMessage: error instanceof Error ? error.message : "Failed to upload image"
        });
      } else if (requestStartedAt === null) {
        trackClientEvent("socialmedia.upload.prepare.failed", {
          userId: account.id,
          appSessionId: sessionId,
          action: "upload",
          stage: "upload_prepare",
          status: "failed",
          sourceUseCase: uploadSourceUseCase,
          source_use_case: uploadSourceUseCase,
          outputType: analyticsOutputType,
          output_type: analyticsOutputType,
          durationMs: Date.now() - uploadStartedAt,
          errorMessage: error instanceof Error ? error.message : "Failed to prepare image"
        });
      }
      setUploadedImages((current) => current.map((image) => image.requestId === requestId ? {
        ...image,
        status: "failed",
        error: error instanceof Error ? error.message : "Failed to upload image."
      } : image));
      trackClientEvent("socialmedia.upload.failed", {
        userId: account.id,
        appSessionId: sessionId,
        action: "upload",
        stage: "asset",
        status: "failed",
        sourceUseCase: uploadSourceUseCase,
        source_use_case: uploadSourceUseCase,
        outputType: analyticsOutputType,
        output_type: analyticsOutputType,
        durationMs: Date.now() - uploadStartedAt,
        fileSizeBytes: file.size,
        fileType: file.type || undefined,
        errorMessage: error instanceof Error ? error.message : "Failed to upload image"
      });
    }
  }

  function enqueueComposerImages(
    files: File[],
    requestedClothesUploadSlot?: AppComposerClothesChangerUploadSlot,
    replaceHotelLobbySoloPhoto = false
  ) {
    const imageFiles = files.filter(isLikelyImageFile);
    if (!imageFiles.length) {
      setSubmitError("Only image files can be uploaded.");
      return;
    }
    if (account.authMode === "guest_claimed") {
      promptClaimedGuestLogin();
      return;
    }
    if (isV22BasicVideoUser) {
      setSubmitError("Basic includes images only. Upgrade to generate videos.");
      dispatchAppUpgradeModal({ trigger: "video_basic_v22_upgrade", billingSurface: "video_generation" });
      return;
    }
    if (isSubmitting) {
      setSubmitError("Wait for the current request to finish before adding images.");
      return;
    }

    if (replaceHotelLobbySoloPhoto && isHotelLobbyComposer && hotelLobbyCast === "solo") {
      uploadedImages.forEach((image) => handleRemoveUploadedImage(image.requestId));
    }

    const clothesUploadSlot = isClothesChangerFixedComposer
      ? requestedClothesUploadSlot
        ?? clothesChangerUploadSlots.find((slot) => !clothesUploadRequestIdsRef.current.has(slot.id))?.id
      : undefined;
    if (isClothesChangerFixedComposer && !clothesUploadSlot) {
      setSubmitError(
        "Both image slots are full. Choose a slot to replace its image."
      );
      return;
    }

    let replacedRequestId: number | undefined;
    if (clothesUploadSlot) {
      replacedRequestId = clothesUploadRequestIdsRef.current.get(clothesUploadSlot)
        ?? uploadedImages.find((image) => image.uploadSlot === clothesUploadSlot)?.requestId;
      if (replacedRequestId !== undefined) {
        revokeUploadedImageUrl(replacedRequestId);
        releaseActiveUploadRequest(replacedRequestId);
      }
    }

    const candidateFiles = isClothesChangerFixedComposer ? imageFiles.slice(0, 1) : imageFiles;
    const candidateUploads = candidateFiles.map((file) => {
      const requestId = uploadRequestIdRef.current + 1;
      uploadRequestIdRef.current = requestId;
      return { file, requestId };
    });
    const acceptedUploads = enqueueReservedComposerUploads(
      activeUploadRequestIdsRef.current,
      candidateUploads,
      maxUploads,
      (acceptedCandidates) => {
        const nextUploads = acceptedCandidates.map(({ file, requestId }) => {
          const previewUrl = URL.createObjectURL(file);
          uploadedImageUrlsRef.current.set(requestId, previewUrl);
          if (clothesUploadSlot) clothesUploadRequestIdsRef.current.set(clothesUploadSlot, requestId);
          return {
            file,
            requestId,
            name: file.name,
            previewUrl,
            status: "uploading" as const,
            uploadSlot: clothesUploadSlot
          };
        });

        setUploadedImages((current) => {
          const nextImages = nextUploads.map(({ requestId, name, previewUrl, status, uploadSlot }) => ({
            requestId,
            name,
            previewUrl,
            status,
            uploadSlot
          }));
          if (isClothesChangerFixedComposer && clothesUploadSlot) {
            return [
              ...current.filter((image) => (
                image.uploadSlot !== clothesUploadSlot
                && image.requestId !== replacedRequestId
              )),
              ...nextImages
            ].slice(0, maxUploads);
          }
          return [
            ...current,
            ...nextImages
          ].slice(0, maxUploads);
        });
        nextUploads.forEach(({ file, requestId }) => {
          void uploadComposerImage(file, requestId);
        });
      }
    );

    if (!acceptedUploads.length) {
      setSubmitError(`You can upload up to ${maxUploads} image${maxUploads === 1 ? "" : "s"}.`);
      return;
    }

    setSubmitError(imageFiles.length > acceptedUploads.length
      ? `Only ${acceptedUploads.length} of ${imageFiles.length} images were added (maximum ${maxUploads}).`
      : "");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    const clothesUploadSlot = pendingClothesUploadSlotRef.current ?? undefined;
    pendingClothesUploadSlotRef.current = null;
    enqueueComposerImages(files, clothesUploadSlot, true);
  }

  function supportsDesktopImageTransfer() {
    return typeof window !== "undefined" && window.matchMedia("(min-width: 761px)").matches;
  }

  function handleComposerPaste(event: ReactClipboardEvent<HTMLElement>) {
    if (!supportsDesktopImageTransfer()) return;
    const imageFiles = collectImageFilesFromTransfer(event.clipboardData);
    if (!imageFiles.length) return;
    event.preventDefault();
    enqueueComposerImages(imageFiles);
  }

  function handleComposerDragEnter(event: ReactDragEvent<HTMLElement>) {
    if (!supportsDesktopImageTransfer() || !hasFileTransfer(event.dataTransfer)) return;
    event.preventDefault();
    imageDragDepthRef.current += 1;
    setIsImageDragActive(true);
  }

  function handleComposerDragOver(event: ReactDragEvent<HTMLElement>) {
    if (!supportsDesktopImageTransfer() || !hasFileTransfer(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleComposerDragLeave(event: ReactDragEvent<HTMLElement>) {
    if (!supportsDesktopImageTransfer() || imageDragDepthRef.current === 0) return;
    event.preventDefault();
    imageDragDepthRef.current = Math.max(0, imageDragDepthRef.current - 1);
    if (imageDragDepthRef.current === 0) setIsImageDragActive(false);
  }

  function handleComposerDrop(event: ReactDragEvent<HTMLElement>) {
    if (!supportsDesktopImageTransfer() || !hasFileTransfer(event.dataTransfer)) return;
    event.preventDefault();
    imageDragDepthRef.current = 0;
    setIsImageDragActive(false);
    enqueueComposerImages(collectImageFilesFromTransfer(event.dataTransfer));
  }

  function handleRemoveUploadedImage(requestId: number) {
    revokeUploadedImageUrl(requestId);
    releaseActiveUploadRequest(requestId);
    setUploadedImages((current) => current.filter((image) => image.requestId !== requestId));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleHotelLobbyCastChange(cast: "solo" | "duet" | "pets") {
    if (cast === "solo") {
      uploadedImages.slice(1).forEach((image) => handleRemoveUploadedImage(image.requestId));
    }
    setSubmitError("");
    setSelectedOptions((current) => ({ ...current, "hotel-lobby-cast": cast }));
  }

  async function handleSubmit() {
    // The ready transition publishes the canonical guest request identity.
    // Keep programmatic submits behind the same barrier as the submit button.
    if (!requestIdentityReady) return;
    if (!hasRequiredSubmissionText) {
      setShowPromptError(true);
      setSubmitError("");
      promptTextareaRef.current?.focus();
      return;
    }
    if (isHotelLobbyComposer && !isEditingSession) {
      const error = getHotelLobbyUploadError(hotelLobbyCast, uploadedSourceAssets.length);
      if (error) { setSubmitError(error); return; }
    }
    if (requireSourceImage && !uploadedSourceAssets.length) {
      setSubmitError("Upload an image before generating a video.");
      fileInputRef.current?.focus();
      return;
    }

    // Marketing entry points can preserve the submitted prompt by creating the
    // optimistic session first; the app shell will prompt the claimed guest to
    // sign in after navigation. In-app composers keep the immediate guard.
    if (account.authMode === "guest_claimed" && !deferClaimedGuestAuthToSession) {
      if (isVideoComposer && submitAfterAuthStorageKey) {
        pendingAuthSubmitRef.current = true;
        onBeforeAuth?.();
        try {
          window.sessionStorage.setItem(submitAfterAuthStorageKey, "1");
        } catch {
          // The same-page email sign-in flow can still use the in-memory flag.
        }
      }
      promptClaimedGuestLogin();
      return;
    }
    const content = promptText.trim();
    const context = resolveGeneratorUseCaseContext(sourceUseCase);
    const traceId = createTraceId();
    const aspectRatio = isSpotifyCanvasComposer ? "9:16" : selectedOptions["aspect-ratio"] ?? "auto";
    const requestedSessionId = sessionId?.trim();
    const submissionAspectRatio = isComicComposer
      ? resolveComicSubmissionAspectRatio({
        aspectRatio,
        isContinuation: Boolean(requestedSessionId),
        wasExplicitlySelected: comicAspectRatioWasExplicitlySelected
      })
      : isBabyShowerInvitationComposer
      ? resolveAnimeSubmissionAspectRatio({ aspectRatio, isContinuation: Boolean(requestedSessionId), wasExplicitlySelected: babyShowerRatioSelected })
      : isPlaylistCoverComposer
      ? resolveAnimeSubmissionAspectRatio({ aspectRatio, isContinuation: Boolean(requestedSessionId), wasExplicitlySelected: playlistRatioSelected })
      : isVisionBoardComposer
      ? resolveAnimeSubmissionAspectRatio({ aspectRatio, isContinuation: Boolean(requestedSessionId), wasExplicitlySelected: visionBoardRatioSelected })
      : isAnimeComposer
      ? resolveAnimeSubmissionAspectRatio({
        aspectRatio,
        isContinuation: Boolean(requestedSessionId),
        wasExplicitlySelected: animeAspectRatioWasExplicitlySelected
      })
      : aspectRatio;
    const resolution = selectedOptions.resolution ?? "auto";
    const requestedVideoDuration = isSpotifyCanvasComposer
      ? 5
      : parseAppVideoDurationSeconds(selectedOptions.duration);
    const videoDuration = isVideoComposer && !isSpotifyCanvasComposer && !isPaidAppVideoPlan(account)
      ? Math.min(requestedVideoDuration, isHotelLobbyComposer ? 5 : 10)
      : requestedVideoDuration;
    const videoModelTier = isVideoComposer && !isMiniMaxH3VideoComposer
      ? isPaidAppVideoPlan(account)
        ? normalizeAppVideoModelTier(selectedOptions["model-tier"])
        : APP_VIDEO_COMPOSER_DEFAULT_MODEL_TIER
      : undefined;
    const videoSize = aspectRatio === "auto" ? "auto" : aspectRatio;
    const videoResolution = isSpotifyCanvasComposer
      ? resolveSpotifyCanvasVideoResolution(account)
      : isMiniMaxH3VideoComposer
        ? selectedVideoResolution
      : APP_VIDEO_COMPOSER_DEFAULT_RESOLUTION;
    const analyticsOutputType = isVideoComposer ? "video" : "image";
    const submittedPlatform = resolveAppComposerDestinationPlatform(productAdUse, aspectRatio);
    const trackValidationFailed = (reason: string, message?: string) => {
      if (message) setSubmitError(message);
      trackClientEvent("socialmedia.create.validation_failed", {
        traceId,
        userId: account.id,
        appSessionId: sessionId?.trim(),
        action: "validate",
        stage: "validation",
        status: "failed",
        reason
      });
    };

    trackClientEvent("socialmedia.create.clicked", {
      traceId,
      userId: account.id,
      appSessionId: sessionId?.trim(),
      action: "submit",
      stage: "composer",
      status: "started",
      workflow: APP_ANALYTICS_WORKFLOW,
      sourceUseCase: context.sourceUseCase,
      source_use_case: context.sourceUseCase,
      outputType: analyticsOutputType,
      output_type: analyticsOutputType,
      platform: submittedPlatform,
      platform_destination: productAdUse,
      aspectRatio: submissionAspectRatio,
      imageCount: "auto",
      resolution,
      inputLength: content.length,
      sourceAssetCount: availableSourceAssets.length,
      renderSourceAssetCount: uploadedSourceAssets.length,
      hasEditTarget: false
    });

    if (activeVideoSubmitMessage) {
      trackValidationFailed("video_generation_in_progress", activeVideoSubmitMessage);
      return;
    }

    if (
      isVideoComposer
      && !account.isLoggedIn
      && !(account.authMode === "guest_claimed" && deferClaimedGuestAuthToSession)
    ) {
      setSubmitError("");
      if (submitAfterAuthStorageKey) {
        pendingAuthSubmitRef.current = true;
        onBeforeAuth?.();
        try {
          window.sessionStorage.setItem(submitAfterAuthStorageKey, "1");
        } catch {
          // The same-page email sign-in flow can still use the in-memory flag.
        }
      }
      openThreadAuthModal();
      trackValidationFailed(
        "auth_required",
        suppressAuthRequiredError ? undefined : "Sign in to create video tasks."
      );
      return;
    }
    if (hasPendingUpload) {
      trackValidationFailed("assets_uploading", "Wait for your image upload to finish before generating.");
      return;
    }
    if (isRoomDesignComposer && !availableSourceAssets.length) {
      trackValidationFailed("missing_required_source_image", "Upload a room photo before starting a room redesign.");
      return;
    }
    if (isBackgroundRemoverComposer && !availableSourceAssets.length) {
      trackValidationFailed("missing_required_source_image", "Upload an image before removing the background.");
      return;
    }
    if (isImageTextEditorComposer && !availableSourceAssets.length) {
      trackValidationFailed("missing_required_source_image", "Upload an image before editing its text.");
      return;
    }
    if (requiresSpotifyCanvasCover && !uploadedSourceAssets.length) {
      trackValidationFailed("missing_required_source_image", "Upload an album cover before generating a Spotify Canvas.");
      return;
    }
    if (isClothesChangerFixedComposer && !hasRequiredClothesChangerImages) {
      trackValidationFailed("missing_clothes_changer_images", "Upload a person image and a clothes reference before generating.");
      return;
    }
    if (!content && !availableSourceAssets.length) {
      trackValidationFailed("empty_input");
      return;
    }
    if (isSubmitting) {
      trackValidationFailed("already_generating");
      return;
    }
    const sourceAssets = isRoomDesignComposer
      ? availableSourceAssets.map((asset, index) => {
        const role: AppComposerRoomDesignAssetRole = index === 0 ? "room_photo" : "furniture_reference";
        return {
          ...asset,
          roomDesignRole: asset.roomDesignRole ?? asset.room_design_role ?? role,
          room_design_role: asset.room_design_role ?? asset.roomDesignRole ?? role
        };
      })
      : isClothesChangerFixedComposer
        ? clothesChangerUploadSlots
          .map((slot) => uploadedImages.find((image) => image.uploadSlot === slot.id && image.sourceAsset)?.sourceAsset)
          .filter((asset): asset is AppComposerSourceAsset => Boolean(asset))
      : availableSourceAssets;
    const displaySourceAssets = usesContinuationSourceAssets
      ? []
      : sourceAssets;

    startAnalyticsSessionRecording();

    const businessCardStyleLabel = getComposerSettingsChoiceLabel(businessCardStyleSettingsChoices, businessCardStyle) ?? "Auto";
    const businessCardIndustryLabel = getComposerSettingsChoiceLabel(businessCardIndustrySettingsChoices, businessCardIndustry) ?? "Auto";
    const businessCardOutputLabel = getComposerSettingsChoiceLabel(businessCardOutputSettingsChoices, businessCardOutput) ?? "Front + back";
    const logoTypeLabel = getComposerSettingsChoiceLabel(logoTypeSettingsChoices, logoType) ?? "Auto";
    const logoStyleLabel = getComposerSettingsChoiceLabel(logoStyleSettingsChoices, logoStyle) ?? "Auto";
    const logoIndustryLabel = getComposerSettingsChoiceLabel(logoIndustrySettingsChoices, logoIndustry) ?? "Auto";
    const personalImageTemplateLabel = getComposerSettingsChoiceLabel(personalImageTemplateSettingsChoices, personalImageTemplate) ?? "Auto";
    const personalImageTemplateInstruction = personalImageTemplateInstructions[personalImageTemplate] ?? personalImageTemplateInstructions.auto;
    const tattooStyleLabel = getComposerSettingsChoiceLabel(tattooStyleSettingsChoices, tattooStyle) ?? "Auto";
    const tattooPlacementLabel = getComposerSettingsChoiceLabel(tattooPlacementSettingsChoices, tattooPlacement) ?? "Auto";
    const tattooComplexityLabel = getComposerSettingsChoiceLabel(tattooComplexitySettingsChoices, tattooComplexity) ?? "Medium";
    const tattooOutputTypeLabel = getComposerSettingsChoiceLabel(tattooOutputSettingsChoices, tattooOutputType) ?? "Concept";
    const roomDesignRoomLabel = getComposerSettingsChoiceLabel(roomDesignRoomSettingsChoices, roomDesignRoom) ?? "Auto";
    const roomDesignStyleLabel = getComposerSettingsChoiceLabel(roomDesignStyleSettingsChoices, roomDesignStyle) ?? "Modern";
    const roomDesignColorLabel = getComposerSettingsChoiceLabel(roomDesignColorSettingsChoices, roomDesignColor) ?? "Neutral";
    const roomDesignSizeLabel = getComposerSettingsChoiceLabel(roomDesignSizeSettingsChoices, roomDesignSize) ?? "Medium";
    const babyShowerThemeLabel = babyShowerTheme === "auto" || (requestedSessionId && !babyShowerThemeSelected)
      ? undefined : getComposerSettingsChoiceLabel(babyShowerThemeSettingsChoices, babyShowerTheme);
    const babyShowerStyleLabel = babyShowerStyle === "auto" || (requestedSessionId && !babyShowerStyleSelected)
      ? undefined : getComposerSettingsChoiceLabel(babyShowerStyleSettingsChoices, babyShowerStyle);
    const playlistMoodLabel = playlistMood === "auto" || (requestedSessionId && !playlistMoodSelected)
      ? undefined : getComposerSettingsChoiceLabel(playlistMoodSettingsChoices, playlistMood);
    const playlistStyleLabel = playlistStyle === "auto" || (requestedSessionId && !playlistStyleSelected)
      ? undefined : getComposerSettingsChoiceLabel(playlistStyleSettingsChoices, playlistStyle);
    const displayContent = isHotelLobbyComposer
      ? buildHotelLobbySubmittedInputText({ inputText: content, cast: hotelLobbyCast, isContinuation: Boolean(requestedSessionId), selectedOptions })
      : isSpotifyCanvasComposer
      ? content || "Animate this album cover into a subtle 5-second Spotify Canvas."
      : isBabyShowerInvitationComposer
        ? buildBabyShowerInvitationSubmittedInputText({ inputText: content, themeLabel: babyShowerThemeLabel, styleLabel: babyShowerStyleLabel, aspectRatio: "auto" })
      : isPlaylistCoverComposer
        // Explicit user choices belong in the visible request: Agent reads this
        // as its authority, while generationInputText is Pipeline-only context.
        ? buildPlaylistCoverSubmittedInputText({
          inputText: content, moodLabel: playlistMoodLabel, styleLabel: playlistStyleLabel, aspectRatio: "auto"
        })
      : isVideoComposer
        ? getVideoSubmittedInputText(content, sourceAssets)
        : resolveImageWorkbenchDisplayContent({
            content,
            sourceUseCase,
            submitPathSlug,
            compact
          });
    const submittedContent = isBackgroundRemoverComposer
      ? buildBackgroundRemoverSubmittedInputText(displayContent)
      : isCertificateComposer
      ? buildCertificateSubmittedInputText({
        inputText: displayContent,
        certificateTypeLabel: flyerType === "auto"
          ? undefined
          : getComposerSettingsChoiceLabel(certificateTypeSettingsChoices, flyerType),
        certificateStyleLabel: resolveCertificateSubmissionStyleLabel({
          selectedStyleLabel: getComposerSettingsChoiceLabel(certificateStyleSettingsChoices, flyerStyle) ?? "Modern",
          isContinuation: Boolean(sessionId),
          styleWasExplicitlySelected: certificateStyleWasExplicitlySelected
        }),
        aspectRatio: submissionAspectRatio
      })
      : isMenuComposer
      ? buildMenuSubmittedInputText({
        inputText: displayContent,
        menuCategoryLabel: flyerType === "auto"
          ? undefined
          : getComposerSettingsChoiceLabel(menuCategorySettingsChoices, flyerType),
        menuStyleLabel: resolveMenuSubmissionStyleLabel({
          selectedStyleLabel: getComposerSettingsChoiceLabel(menuStyleSettingsChoices, flyerStyle) ?? "Modern",
          isContinuation: Boolean(sessionId),
          styleWasExplicitlySelected: menuStyleWasExplicitlySelected
        }),
        aspectRatio: submissionAspectRatio
      })
      : isInfographicComposer
      ? buildInfographicSubmittedInputText({
        inputText: displayContent,
        infographicTypeLabel: flyerType === "auto"
          ? undefined
          : getComposerSettingsChoiceLabel(infographicTypeSettingsChoices, flyerType),
        infographicStyleLabel: getComposerSettingsChoiceLabel(infographicStyleSettingsChoices, flyerStyle) ?? "Modern",
        aspectRatio: submissionAspectRatio
      })
      : isComicComposer
      ? buildComicSubmittedInputText({
        inputText: displayContent,
        comicFormatLabel: flyerType === "auto"
          ? undefined
          : getComposerSettingsChoiceLabel(comicFormatSettingsChoices, flyerType),
        comicStyleLabel: resolveComicSubmissionStyleLabel({
          selectedStyleValue: comicStyle,
          selectedStyleLabel: getComposerSettingsChoiceLabel(comicStyleSettingsChoices, comicStyle)
        }),
        aspectRatio: submissionAspectRatio,
        isContinuation: Boolean(requestedSessionId)
      })
      : isBabyShowerInvitationComposer
      ? buildBabyShowerInvitationSubmittedInputText({ inputText: displayContent, aspectRatio: submissionAspectRatio, isContinuation: Boolean(requestedSessionId) })
      : isPlaylistCoverComposer
      ? buildPlaylistCoverSubmittedInputText({
        inputText: displayContent,
        aspectRatio: submissionAspectRatio, isContinuation: Boolean(requestedSessionId)
      })
      : isVisionBoardComposer
      ? buildVisionBoardSubmittedInputText({ inputText: displayContent, themeLabel: flyerType === "auto" ? undefined : getComposerSettingsChoiceLabel(visionBoardThemeSettingsChoices, flyerType), styleLabel: visionBoardStyle === "auto" ? undefined : getComposerSettingsChoiceLabel(visionBoardStyleSettingsChoices, visionBoardStyle), aspectRatio: submissionAspectRatio, isContinuation: Boolean(requestedSessionId) })
      : isAnimeComposer
      ? buildAnimeSubmittedInputText({
        inputText: displayContent,
        animeTypeLabel: flyerType === "auto"
          ? undefined
          : getComposerSettingsChoiceLabel(animeTypeSettingsChoices, flyerType),
        animeStyleLabel: resolveAnimeSubmissionStyleLabel({
          selectedStyleValue: animeStyle,
          selectedStyleLabel: getComposerSettingsChoiceLabel(animeStyleSettingsChoices, animeStyle)
        }),
        aspectRatio: submissionAspectRatio,
        isContinuation: Boolean(requestedSessionId)
      })
      : isFlyerComposer
      ? buildFlyerSubmittedInputText({
        inputText: displayContent,
        flyerTypeLabel: flyerType === "auto"
          ? undefined
          : getComposerSettingsChoiceLabel(
            isBrochureComposer ? brochureTypeSettingsChoices : flyerTypeSettingsChoices,
            flyerType
          ),
        flyerStyleLabel: getComposerSettingsChoiceLabel(flyerStyleSettingsChoices, flyerStyle) ?? "Modern",
        assetLabel: isPosterComposer ? "Poster" : isBrochureComposer ? "Brochure" : "Flyer",
        aspectRatio: submissionAspectRatio
      })
      : isBusinessCardComposer
        ? buildBusinessCardSubmittedInputText({
          inputText: displayContent,
          styleLabel: businessCardStyleLabel,
          industryLabel: businessCardIndustryLabel,
          outputLabel: businessCardOutputLabel
        })
        : isLogoComposer
          ? buildLogoSubmittedInputText({
            inputText: displayContent,
            logoTypeLabel,
            logoStyleLabel,
            logoIndustryLabel,
            aspectRatio: submissionAspectRatio
          })
          : isPersonalImageComposer
            ? buildPersonalImageSubmittedInputText({
              inputText: displayContent,
              templateLabel: personalImageTemplateLabel,
              templateInstruction: personalImageTemplateInstruction,
              aspectRatio: submissionAspectRatio
            })
            : isTattooComposer
              ? buildTattooSubmittedInputText({
                inputText: displayContent,
                styleLabel: tattooStyleLabel,
                placementLabel: tattooPlacementLabel,
                complexityLabel: tattooComplexityLabel,
                outputTypeLabel: tattooOutputTypeLabel,
                outputType: tattooOutputType,
                aspectRatio: submissionAspectRatio
              })
              : isRoomDesignComposer
                ? buildRoomDesignSubmittedInputText({
                  inputText: displayContent,
                  roomType: roomDesignRoom,
                  roomTypeLabel: roomDesignRoomLabel,
                  styleLabel: roomDesignStyleLabel,
                  colorLabel: roomDesignColorLabel,
                  sizeLabel: roomDesignSizeLabel,
                  aspectRatio: submissionAspectRatio,
                  sourceAssets
                })
                : isClothesChangerFixedComposer
                  ? buildClothesChangerSubmittedInputText({
                    inputText: displayContent,
                    aspectRatio: submissionAspectRatio
                  })
                  : isSpotifyCanvasComposer
                    ? buildSpotifyCanvasSubmittedInputText(displayContent)
                  : isPromoVideoComposer
                    ? buildPromoVideoSubmittedInputText({
                      inputText: displayContent,
                      aspectRatio: submissionAspectRatio,
                      duration: videoDuration
                    })
                  : isVideoComposer
                    ? displayContent
              : displayContent;
    const effectiveSubmittedContent = submittedContent;
    const visibleAndGenerationInput = resolveUserVisibleAndGenerationInput({
      displayInputText: displayContent,
      submittedInputText: effectiveSubmittedContent
    });
    const effectiveDisplayContent = visibleAndGenerationInput.displayInputText;
    const generationInputText = visibleAndGenerationInput.generationInputText;

    captureAnalyticsEvent("generation_started", buildAppGenerationAnalyticsProperties({
      trace_id: traceId,
      action: "generate_start",
      stage: "composer",
      status: "started",
      image_count: "auto",
      input_length_bucket: bucketAppInputLength(effectiveDisplayContent.length),
      source_kind: sourceAssets.length > 0 ? "image" : "text",
      mode: "generate"
    }));

    if (onMockSubmit) {
      setIsSubmitting(true);
      setSubmitError("");
      onMockSubmit({
        content: effectiveDisplayContent,
        sourceAssets,
        displaySourceAssets,
        aspectRatio: submissionAspectRatio,
        resolution,
        outputType: isVideoComposer ? "video" : "image",
        videoModelTier,
        videoDuration: isVideoComposer ? videoDuration : undefined,
        videoResolution: isVideoComposer ? videoResolution : undefined,
        videoSize: isVideoComposer ? videoSize : undefined
      });
      clearComposerUploads();
      setPromptText("");
      setPlaylistMoodSelected(false);
      setPlaylistStyleSelected(false);
      setPlaylistRatioSelected(false);
      setIsSettingsSheetOpen(false);
      setIsSubmitting(false);
      if (isThreadComposer) {
        setIsThreadComposerExpanded(false);
        promptTextareaRef.current?.blur();
      }
      return;
    }

    if (onChatSubmit) {
      setIsSubmitting(true);
      setSubmitError("");
      onChatSubmit({
        content: effectiveDisplayContent,
        sourceAssets,
        displaySourceAssets,
        aspectRatio: submissionAspectRatio,
        resolution,
        outputType: isVideoComposer ? "video" : "image",
        videoModelTier,
        videoDuration: isVideoComposer ? videoDuration : undefined,
        videoResolution: isVideoComposer ? videoResolution : undefined,
        videoSize: isVideoComposer ? videoSize : undefined,
        platform: isProductAdComposer ? submittedPlatform : undefined,
        destination: isProductAdComposer ? productAdUse : undefined,
        generationInputText
      });
      clearComposerUploads();
      setPromptText("");
      setPlaylistMoodSelected(false);
      setPlaylistStyleSelected(false);
      setPlaylistRatioSelected(false);
      setIsSettingsSheetOpen(false);
      setIsSubmitting(false);
      if (isThreadComposer) {
        setIsThreadComposerExpanded(false);
        promptTextareaRef.current?.blur();
      }
      return;
    }

    if (!requestedSessionId && redirectMode === "chat" && typeof crypto !== "undefined" && crypto.randomUUID) {
      const optimisticSessionId = crypto.randomUUID();
      const pending: AppPendingThreadSubmit = {
        version: 1,
        sessionId: optimisticSessionId,
        idempotencyKey: createAppSubmitIdempotencyKey(optimisticSessionId),
        traceId,
        toolSlug: submitPathSlug,
        sourceUseCase: context.sourceUseCase,
        outputType: isVideoComposer ? "video" : "image",
        status: "submitting",
        content: effectiveDisplayContent,
        language: resolveSocialmediaSubmissionLanguage({ userInput: effectiveDisplayContent, selectedLanguage: uiLocale, outputType: isVideoComposer ? "video" : "image" }),
        aspectRatio: submissionAspectRatio,
        resolution: isVideoComposer ? "1k" : resolution,
        videoDuration: isVideoComposer ? videoDuration : undefined,
        videoModelTier,
        videoResolution: isVideoComposer ? videoResolution : undefined,
        videoSize: isVideoComposer ? videoSize : undefined,
        platform: isProductAdComposer ? submittedPlatform : undefined,
        destination: isProductAdComposer ? productAdUse : undefined,
        sourceAssets,
        displaySourceAssets: sourceAssets,
        generationInputText,
        attributionSnapshot: getStoredAttribution(),
        createdAt: new Date().toISOString(),
        attemptCount: 0
      };

      if (writePendingThreadSubmit(pending)) {
        flushSync(() => {
          setIsSubmitting(true);
          setSubmitError("");
        });
        const nextUrl = `/app/chat/${encodeURIComponent(optimisticSessionId)}?pending=1&refresh=${Date.now()}`;
        router.push(nextUrl);
        clearComposerUploads();
        setPromptText("");
        setPlaylistMoodSelected(false);
        setPlaylistStyleSelected(false);
        setPlaylistRatioSelected(false);
        setIsSettingsSheetOpen(false);
        return;
      }
    }

    const payload = {
      session_id: requestedSessionId || undefined,
      content: effectiveDisplayContent,
      aspect_ratio: submissionAspectRatio,
      image_count: "auto" as const,
      language: resolveSocialmediaSubmissionLanguage({ userInput: effectiveDisplayContent, selectedLanguage: uiLocale, outputType: isVideoComposer ? "video" : "image" }),
      resolution: isVideoComposer ? "1k" : resolution,
      output_format: "png",
      ratio: isVideoComposer ? videoSize : undefined,
      orientation: isVideoComposer ? inferAppVideoOrientation(aspectRatio) : undefined,
      duration: isVideoComposer ? videoDuration : undefined,
      video_model_tier: videoModelTier,
      video_resolution: isVideoComposer ? videoResolution : undefined,
      platform: isProductAdComposer ? submittedPlatform : undefined,
      destination: isProductAdComposer ? productAdUse : undefined,
      source_assets: sourceAssets,
      user_source_assets: sourceAssets,
      generation_input_text: generationInputText,
      source_use_case: context.sourceUseCase,
      attribution_snapshot: getStoredAttribution(),
      prefer_stream: isVideoComposer ? false : true
    };

    setIsSubmitting(true);
    setSubmitError("");
    const requestStartedAt = Date.now();
    const requestSummary = summarizeAppSubmitPayload(payload);
    trackClientEvent("socialmedia.create.request.started", {
      traceId,
      userId: account.id,
      appSessionId: requestedSessionId,
      action: "request",
      stage: "request",
      status: "started",
      workflow: APP_ANALYTICS_WORKFLOW,
      sourceUseCase: context.sourceUseCase,
      source_use_case: context.sourceUseCase,
      outputType: analyticsOutputType,
      output_type: analyticsOutputType,
      endpoint: "/api/v1/socialmedia/messages",
      requestSummary
    });
    try {
      const response = await fetch("/api/v1/socialmedia/messages", {
        method: "POST",
        headers: {
          Accept: "text/event-stream, application/json",
          "Content-Type": "application/json",
          ...buildGuestUserRequestHeaders(),
          "x-trace-id": traceId,
          "x-session-id": getClientSessionId()
        },
        body: JSON.stringify(payload)
      });
      const data = isChatStreamResponse(response)
        ? await readAppComposerSubmitStream(response, {
            traceId,
            userId: account.id
          })
        : await response.json().catch(() => ({})) as AppComposerSubmitResponse;
      if (!response.ok) {
        throw new Error(resolveSocialmediaApiErrorMessage(data.error, "Failed to start generation."));
      }
      trackClientEvent("socialmedia.create.request.completed", {
        traceId,
        userId: account.id,
        appSessionId: requestedSessionId,
        action: "request",
        stage: "request",
        status: "success",
        workflow: APP_ANALYTICS_WORKFLOW,
        sourceUseCase: context.sourceUseCase,
        source_use_case: context.sourceUseCase,
        outputType: analyticsOutputType,
        output_type: analyticsOutputType,
        jobId: data.job?.job_id,
        statusCode: response.status,
        durationMs: Date.now() - requestStartedAt,
        requestSummary,
        responseSummary: summarizeAppSubmitResponse(data)
      });

      const sessionId = data.job?.session_id || data.session_id;
      if (!sessionId) {
        throw new Error("Generation session was created, but no session was returned.");
      }
      if (data.job?.job_id) {
        captureAnalyticsEvent("generation_task_created", buildAppGenerationAnalyticsProperties({
          trace_id: traceId,
          job_id: data.job.job_id,
          session_id: sessionId,
          action: "job_create",
          stage: "job_create",
          status: "success",
          image_count: "auto",
          input_length_bucket: bucketAppInputLength(effectiveDisplayContent.length),
          source_kind: sourceAssets.length > 0 ? "image" : "text",
          mode: "generate"
        }));
      }
      const nextBaseUrl = redirectMode === "chat"
        ? `/app/chat/${encodeURIComponent(sessionId)}`
        : `/app/${encodeURIComponent(submitPathSlug)}/${encodeURIComponent(sessionId)}`;
      const nextUrl = data.job?.job_id
        ? `${nextBaseUrl}?job_id=${encodeURIComponent(data.job.job_id)}&refresh=${Date.now()}`
        : `${nextBaseUrl}?refresh=${Date.now()}`;
      router.push(nextUrl);
      if (redirectMode === "chat") {
        clearComposerUploads();
        setPromptText("");
        setPlaylistMoodSelected(false);
        setPlaylistStyleSelected(false);
        setPlaylistRatioSelected(false);
        setIsSettingsSheetOpen(false);
        setIsSubmitting(false);
      }
    } catch (error) {
      captureAnalyticsEvent("generation_failed", buildAppGenerationAnalyticsProperties({
        trace_id: traceId,
        session_id: requestedSessionId,
        action: "generate_failed",
        stage: "request",
        status: "failed",
        failure_kind: "request_failed",
        error_message: error instanceof Error ? error.message : String(error)
      }));
      trackClientEvent("socialmedia.create.request.failed", {
        traceId,
        userId: account.id,
        appSessionId: requestedSessionId,
        action: "request",
        stage: "request",
        status: "failed",
        level: "error",
        durationMs: Date.now() - requestStartedAt,
        requestSummary,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      setSubmitError(error instanceof Error ? error.message : "Failed to start generation.");
      setIsSubmitting(false);
    }
  }

  submitAfterAuthRef.current = () => {
    void handleSubmit();
  };

  useEffect(() => {
    if (
      !draftReady
      || !requestIdentityReady
      || !account.isLoggedIn
      || !pendingAuthSubmitRef.current
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      // Consume only when executing: effect cleanup may cancel a scheduled resume.
      if (!pendingAuthSubmitRef.current) return;
      pendingAuthSubmitRef.current = false;
      if (submitAfterAuthStorageKey) {
        try {
          window.sessionStorage.removeItem(submitAfterAuthStorageKey);
        } catch {
          // The ref prevents a duplicate submit for the current page.
        }
      }
      submitAfterAuthRef.current();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [account.isLoggedIn, draftReady, requestIdentityReady, submitAfterAuthStorageKey]);

  useEffect(() => () => {
    revokeAllUploadedImageUrls();
    activeUploadRequestIdsRef.current.clear();
    clothesUploadRequestIdsRef.current.clear();
  }, []);

  const updateSettingsSelectMenuPosition = useCallback((id: AppComposerSettingsSelectId): AppComposerSettingsSelectPlacement => {
    if (typeof window === "undefined") return "down";
    const field = document.querySelector(`[data-composer-settings-select-id="${id}"]`);
    const control = field?.querySelector<HTMLButtonElement>("[data-composer-settings-select-control]");
    if (!field || !control) return "down";

    const controlRect = control.getBoundingClientRect();
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const viewportOffsetTop = window.visualViewport?.offsetTop ?? 0;
    const viewportOffsetLeft = window.visualViewport?.offsetLeft ?? 0;
    const gutter = 12;
    const menuGap = 8;
    const preferredMenuHeight = Math.min(232, viewportHeight * 0.38);
    const availableBelow = viewportOffsetTop + viewportHeight - gutter - controlRect.bottom - menuGap;
    const availableAbove = controlRect.top - viewportOffsetTop - gutter - menuGap;
    const placement: AppComposerSettingsSelectPlacement = availableBelow < preferredMenuHeight && availableAbove > availableBelow ? "up" : "down";
    const availableSpace = placement === "up" ? availableAbove : availableBelow;
    const width = Math.min(216, Math.max(180, viewportWidth - gutter * 2));
    const left = Math.min(
      viewportOffsetLeft + viewportWidth - gutter - width,
      Math.max(viewportOffsetLeft + gutter, controlRect.right - width)
    );
    const maxHeight = Math.floor(Math.max(132, Math.min(232, availableSpace)));

    setSettingsSelectMenuPosition({
      placement,
      left,
      width,
      maxHeight,
      ...(placement === "up"
        ? { bottom: viewportOffsetTop + viewportHeight - controlRect.top + menuGap }
        : { top: controlRect.bottom + menuGap })
    });
    setSettingsSelectPlacements((current) => ({ ...current, [id]: placement }));
    return placement;
  }, []);

  useEffect(() => {
    if (!isSettingsSheetOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (openSettingsSelectId) {
        setOpenSettingsSelectId(null);
        return;
      }
      setIsSettingsSheetOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSettingsSheetOpen, openSettingsSelectId]);

  useEffect(() => {
    if (!isSettingsSheetOpen) setOpenSettingsSelectId(null);
  }, [isSettingsSheetOpen]);

  useEffect(() => {
    if (!openSettingsSelectId) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Element
        && (
          target.closest(`[data-composer-settings-select-id="${openSettingsSelectId}"]`)
          || target.closest(`[data-composer-settings-select-menu-id="${openSettingsSelectId}"]`)
        )
      ) {
        return;
      }
      setOpenSettingsSelectId(null);
    }

    document.addEventListener("pointerdown", handlePointerDown, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, { capture: true });
    };
  }, [openSettingsSelectId]);

  useLayoutEffect(() => {
    if (!isSettingsSheetOpen || !openSettingsSelectId) return;

    function handleReposition() {
      updateSettingsSelectMenuPosition(openSettingsSelectId as AppComposerSettingsSelectId);
    }

    handleReposition();
    const field = document.querySelector(`[data-composer-settings-select-id="${openSettingsSelectId}"]`);
    const settingsSheet = field?.closest('[role="dialog"][data-prompt-settings]');
    window.addEventListener("resize", handleReposition);
    window.visualViewport?.addEventListener("resize", handleReposition);
    window.visualViewport?.addEventListener("scroll", handleReposition);
    settingsSheet?.addEventListener("scroll", handleReposition, { passive: true });
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.visualViewport?.removeEventListener("resize", handleReposition);
      window.visualViewport?.removeEventListener("scroll", handleReposition);
      settingsSheet?.removeEventListener("scroll", handleReposition);
    };
  }, [isSettingsSheetOpen, openSettingsSelectId, updateSettingsSelectMenuPosition]);

  useEffect(() => {
    if (!hasSettingsSheet) {
      setIsSettingsSheetOpen(false);
      setOpenSettingsSelectId(null);
    }
  }, [hasSettingsSheet]);

  function renderSettingsSelect({
    id,
    label,
    value,
    choices,
    onChange
  }: {
    id: AppComposerSettingsSelectId;
    label: string;
    value: string;
    choices: AppComposerSettingsChoice[];
    onChange: (value: string) => void;
  }) {
    const selectedChoice = choices.find((choice) => choice.value === value) ?? choices[0];
    const isOpen = openSettingsSelectId === id;
    const placement = settingsSelectPlacements[id] ?? "down";
    const menuPosition = isOpen ? settingsSelectMenuPosition : null;
    const menuStyle: CSSProperties | undefined = menuPosition
      ? {
        left: `${menuPosition.left}px`,
        width: `${menuPosition.width}px`,
        maxHeight: `${menuPosition.maxHeight}px`,
        ...(menuPosition.placement === "up"
          ? { bottom: `${menuPosition.bottom ?? 12}px` }
          : { top: `${menuPosition.top ?? 12}px` })
      }
      : undefined;
    const menu = isOpen && typeof document !== "undefined" ? createPortal(
      localizeUiTree(<div
        className={`${styles.composerSettingsSelectMenu} ${placement === "up" ? styles.composerSettingsSelectMenuUp : ""}`}
        role="listbox"
        aria-label={label}
        data-composer-settings-select-menu-id={id}
        style={menuStyle}
      >
        {choices.map((choice) => {
          const isSelected = choice.value === value;
          return (
            <button
              className={isSelected ? styles.composerSettingsSelectMenuItemActive : ""}
              type="button"
              role="option"
              aria-selected={isSelected}
              key={choice.value}
              onClick={() => {
                onChange(choice.value);
                setOpenSettingsSelectId(null);
              }}
            >
              <span>{choice.label}</span>
            </button>
          );
        })}
      </div>, uiLocale),
      document.body
    ) : null;

    return (
      <div className={styles.composerSettingsSelectField} data-composer-settings-select-id={id}>
        <span>{label}</span>
        <div className={styles.composerSettingsSelectWrap}>
          <button
            className={styles.composerSettingsSelectControl}
            type="button"
            data-composer-settings-select-control
            aria-label={`${label}: ${selectedChoice.label}`}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            onClick={() => {
              if (isOpen) {
                setOpenSettingsSelectId(null);
                return;
              }
              updateSettingsSelectMenuPosition(id);
              setOpenSettingsSelectId(id);
            }}
          >
            <span>{selectedChoice.label}</span>
            <ChevronDown size={18} aria-hidden />
          </button>
          {menu}
        </div>
      </div>
    );
  }

  function handleComposerOptionChoice(option: AppComposerOption, choice: AppComposerOptionChoice) {
    if (choice.locked) {
      const trigger = option.id === "model-tier"
        ? "video_quality_locked"
        : option.id === "video-resolution"
          ? "video_resolution_locked"
          : "video_duration_locked";
      const billingSurface = option.id === "model-tier"
        ? "video_quality"
        : option.id === "video-resolution"
          ? "video_resolution"
          : "video_duration";
      setIsSettingsSheetOpen(false);
      setOpenSettingsSelectId(null);
      dispatchAppUpgradeModal({ trigger, billingSurface });
      return;
    }

    setSelectedOptions((current) => ({ ...current, [option.id]: choice.value }));
    if (isComicComposer && option.id === "aspect-ratio") {
      setComicAspectRatioWasExplicitlySelected(true);
    }
    if (isBabyShowerInvitationComposer && option.id === "aspect-ratio") setBabyShowerRatioSelected(true);
    if (isPlaylistCoverComposer && option.id === "aspect-ratio") setPlaylistRatioSelected(true);
    if (isVisionBoardComposer && option.id === "aspect-ratio") setVisionBoardRatioSelected(true);
    if (isAnimeComposer && option.id === "aspect-ratio") {
      setAnimeAspectRatioWasExplicitlySelected(true);
    }
  }

  function renderExpandedComposerOption(option: AppComposerOption) {
    const selectedValue = selectedOptions[option.id] ?? option.defaultValue;
    const isAspectRatio = option.id === "aspect-ratio";
    const isImageSize = !isVideoComposer && option.id === "resolution";
    const label = isImageSize
      ? "Image size"
      : isAspectRatio
        ? "Aspect ratio"
        : option.title;
    const imageSizeChoices = isImageSize
      ? [
          { value: "auto", label: "Auto" },
          { value: "1k", label: "1K" },
          { value: "2k", label: "2K" },
          { value: "4k", label: "4K" }
        ]
      : [];
    const commonAspectRatioValues = ["auto", "1:1", "3:4", "4:3", "9:16", "16:9"];
    const orderedAspectRatioChoices = isAspectRatio
      ? [
          ...commonAspectRatioValues
            .map((value) => option.choices.find((choice) => choice.value === value))
            .filter((choice): choice is AppComposerOptionChoice => Boolean(choice)),
          ...option.choices.filter((choice) => !commonAspectRatioValues.includes(choice.value))
        ]
      : option.choices;
    const compactAspectRatioChoices = isAspectRatio
      ? orderedAspectRatioChoices.filter((choice) => (
          commonAspectRatioValues.includes(choice.value) || choice.value === selectedValue
        ))
      : option.choices;
    const visibleChoices = isAspectRatio && !isAspectRatioExpanded
      ? compactAspectRatioChoices
      : orderedAspectRatioChoices;

    return (
      <section className={styles.composerSettingsOptionGroup} aria-label={label} key={option.id}>
        <div className={styles.composerSettingsOptionHeader}>
          <h3>{label}</h3>
          {isAspectRatio && option.choices.length > commonAspectRatioValues.length ? (
            <div className={styles.composerSettingsDisplayMode} role="group" aria-label="Aspect ratio display mode">
              <button
                className={!isAspectRatioExpanded ? styles.composerSettingsDisplayModeActive : ""}
                type="button"
                aria-pressed={!isAspectRatioExpanded}
                onClick={() => setIsAspectRatioExpanded(false)}
              >
                Compact
              </button>
              <button
                className={isAspectRatioExpanded ? styles.composerSettingsDisplayModeActive : ""}
                type="button"
                aria-pressed={isAspectRatioExpanded}
                onClick={() => setIsAspectRatioExpanded(true)}
              >
                All
              </button>
            </div>
          ) : null}
        </div>
        {isImageSize ? (
          <div className={styles.composerSettingsQualityTabs} role="radiogroup" aria-label={label}>
            {imageSizeChoices.map((sizeChoice) => {
              const sourceChoice = option.choices.find((choice) => choice.value === sizeChoice.value);
              if (!sourceChoice) return null;
              const isSelected = sourceChoice.value === selectedValue;
              return (
                <button
                  className={isSelected ? styles.composerSettingsQualityTabActive : ""}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`${label}: ${sizeChoice.label}`}
                  title={sourceChoice.label}
                  key={sourceChoice.value}
                  onClick={() => handleComposerOptionChoice(option, sourceChoice)}
                >
                  {sizeChoice.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div
            className={[
              styles.composerSettingsChoiceGrid,
              isAspectRatio ? styles.composerSettingsChoiceGridRatio : ""
            ].filter(Boolean).join(" ")}
            role="radiogroup"
            aria-label={label}
          >
            {visibleChoices.map((choice) => {
              const ChoiceIcon = choice.icon ?? option.icon;
              const isSelected = choice.value === selectedValue;
              const labelParts = choice.label.match(/^(.+?)\s+\((.+)\)$/);
              return (
                <button
                  className={[
                    styles.composerSettingsChoice,
                    isSelected ? styles.composerSettingsChoiceActive : "",
                    choice.locked ? styles.composerSettingsChoiceLocked : ""
                  ].filter(Boolean).join(" ")}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`${label}: ${choice.label}`}
                  aria-disabled={choice.locked || option.readOnly || undefined}
                  disabled={option.readOnly}
                  title={choice.lockLabel}
                  key={choice.value}
                  onClick={() => handleComposerOptionChoice(option, choice)}
                >
                  <ChoiceIcon size={isAspectRatio ? 16 : 17} aria-hidden />
                  <span>{labelParts?.[1] ?? choice.label}</span>
                  {labelParts?.[2] ? <small>{labelParts[2]}</small> : null}
                  {choice.locked ? <Lock className={styles.composerSettingsChoiceLock} size={13} aria-hidden /> : null}
                </button>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  function handleProductAdUseChange(nextUse: string) {
    const nextDestination = nextUse as AppComposerDestination;
    setProductAdUse(nextDestination);
    const nextAspectRatio = getAppComposerDestinationDefaultAspectRatio(nextDestination);
    if (nextAspectRatio) {
      setSelectedOptions((current) => ({ ...current, "aspect-ratio": nextAspectRatio }));
    }
  }

  function handleTattooPlacementChange(nextPlacement: string) {
    setTattooPlacement(nextPlacement);
    const currentAspectRatio = selectedOptions["aspect-ratio"] ?? "auto";
    if (currentAspectRatio !== "auto") return;
    if (["arm", "forearm", "sleeve", "leg"].includes(nextPlacement)) {
      setSelectedOptions((current) => ({ ...current, "aspect-ratio": "2:3" }));
      return;
    }
    if (["chest", "back"].includes(nextPlacement)) {
      setSelectedOptions((current) => ({ ...current, "aspect-ratio": "4:3" }));
    }
  }

  const settingsSheet = hasSettingsSheet && isSettingsSheetOpen && typeof document !== "undefined"
    ? createPortal(
      localizeUiTree(<div className={styles.composerSettingsOverlay} role="presentation" onClick={() => setIsSettingsSheetOpen(false)}>
        <div
          className={styles.composerSettingsSheet}
          role="dialog"
          aria-modal="true"
          data-prompt-settings
          aria-label="Advanced settings"
          onClick={(event) => event.stopPropagation()}
        >
          <header className={styles.composerSettingsHeader}>
            <div>
              <h2>Advanced settings</h2>
              <p>Fine-tune the output before you create.</p>
            </div>
            <button type="button" aria-label="Close advanced settings" onClick={() => setIsSettingsSheetOpen(false)}>
              <X size={22} aria-hidden />
            </button>
          </header>
          <div className={styles.composerSettingsGroups}>
            {isHotelLobbyComposer ? <p className={styles.hotelLobbySettingsHint}>All creative settings are optional. Auto keeps the preset or current video direction. Your written description takes priority over selected settings.</p> : null}
            {showsComposerOptionsInSettings ? settingsComposerOptions.map(renderExpandedComposerOption) : null}
            {showsComposerOptionsInSettings && hasSpecializedSettings ? <div className={styles.composerSettingsDivider} aria-hidden /> : null}
            {isFlyerComposer ? (
              <>
                {renderSettingsSelect({
                  id: "flyer-type",
                  label: isPosterComposer
                    ? "Poster type"
                    : isBrochureComposer
                      ? "Brochure format"
                      : isInfographicComposer
                        ? "Infographic type"
                      : isComicComposer
                        ? "Comic format"
                      : isBabyShowerInvitationComposer
                        ? "Baby shower theme"
                      : isPlaylistCoverComposer
                        ? "Mood or activity"
                      : isVisionBoardComposer
                        ? "Goal theme"
                      : isAnimeComposer
                        ? "Anime image type"
                      : isMenuComposer
                        ? "Menu category"
                      : isCertificateComposer
                        ? "Certificate type"
                        : "Flyer type",
                  value: isBabyShowerInvitationComposer ? babyShowerTheme : isPlaylistCoverComposer ? playlistMood : flyerType,
                  choices: isBrochureComposer
                    ? brochureTypeSettingsChoices
                    : isInfographicComposer
                      ? infographicTypeSettingsChoices
                    : isComicComposer
                      ? comicFormatSettingsChoices
                    : isBabyShowerInvitationComposer
                      ? babyShowerThemeSettingsChoices
                    : isPlaylistCoverComposer
                      ? playlistMoodSettingsChoices
                    : isVisionBoardComposer
                      ? visionBoardThemeSettingsChoices
                    : isAnimeComposer
                      ? animeTypeSettingsChoices
                    : isMenuComposer
                      ? menuCategorySettingsChoices
                    : isCertificateComposer
                      ? certificateTypeSettingsChoices
                      : flyerTypeSettingsChoices,
                  onChange: (value) => {
                    if (isBabyShowerInvitationComposer) { setBabyShowerTheme(value); setBabyShowerThemeSelected(true); }
                    else if (isPlaylistCoverComposer) { setPlaylistMood(value); setPlaylistMoodSelected(true); }
                    else setFlyerType(value);
                  }
                })}
                {renderSettingsSelect({
                  id: "flyer-style",
                  label: "Style",
                  value: isBabyShowerInvitationComposer ? babyShowerStyle : isPlaylistCoverComposer ? playlistStyle : isVisionBoardComposer ? visionBoardStyle : isComicComposer ? comicStyle : isAnimeComposer ? animeStyle : flyerStyle,
                  choices: isMenuComposer
                    ? menuStyleSettingsChoices
                    : isCertificateComposer
                      ? certificateStyleSettingsChoices
                    : isInfographicComposer
                      ? infographicStyleSettingsChoices
                    : isComicComposer
                      ? comicStyleSettingsChoices
                    : isBabyShowerInvitationComposer
                      ? babyShowerStyleSettingsChoices
                    : isPlaylistCoverComposer
                      ? playlistStyleSettingsChoices
                    : isVisionBoardComposer
                      ? visionBoardStyleSettingsChoices
                    : isAnimeComposer
                      ? animeStyleSettingsChoices
                      : flyerStyleSettingsChoices,
                  onChange: (nextStyle) => {
                    if (isBabyShowerInvitationComposer) { setBabyShowerStyle(nextStyle); setBabyShowerStyleSelected(true); }
                    else if (isPlaylistCoverComposer) { setPlaylistStyle(nextStyle); setPlaylistStyleSelected(true); }
                    else if (isVisionBoardComposer) setVisionBoardStyle(nextStyle);
                    else if (isComicComposer) setComicStyle(nextStyle);
                    else if (isAnimeComposer) setAnimeStyle(nextStyle);
                    else setFlyerStyle(nextStyle);
                    if (isMenuComposer) setMenuStyleWasExplicitlySelected(true);
                    if (isCertificateComposer) setCertificateStyleWasExplicitlySelected(true);
                  }
                })}
              </>
            ) : null}
            {isProductAdComposer ? renderSettingsSelect({
              id: "product-ad-use",
              label: "Use",
              value: productAdUse,
              choices: productAdUseSettingsChoices,
              onChange: handleProductAdUseChange
            }) : null}
            {isBusinessCardComposer ? (
              <>
                {renderSettingsSelect({
                  id: "business-card-industry",
                  label: "Industry",
                  value: businessCardIndustry,
                  choices: businessCardIndustrySettingsChoices,
                  onChange: setBusinessCardIndustry
                })}
                {renderSettingsSelect({
                  id: "business-card-style",
                  label: "Style",
                  value: businessCardStyle,
                  choices: businessCardStyleSettingsChoices,
                  onChange: setBusinessCardStyle
                })}
                {renderSettingsSelect({
                  id: "business-card-output",
                  label: "Output",
                  value: businessCardOutput,
                  choices: businessCardOutputSettingsChoices,
                  onChange: setBusinessCardOutput
                })}
              </>
            ) : null}
            {isLogoComposer ? (
              <>
                {renderSettingsSelect({
                  id: "logo-type",
                  label: "Logo type",
                  value: logoType,
                  choices: logoTypeSettingsChoices,
                  onChange: setLogoType
                })}
                {renderSettingsSelect({
                  id: "logo-style",
                  label: "Style",
                  value: logoStyle,
                  choices: logoStyleSettingsChoices,
                  onChange: setLogoStyle
                })}
                {renderSettingsSelect({
                  id: "logo-industry",
                  label: "Industry",
                  value: logoIndustry,
                  choices: logoIndustrySettingsChoices,
                  onChange: setLogoIndustry
                })}
              </>
            ) : null}
            {isPersonalImageComposer ? renderSettingsSelect({
              id: "personal-image-template",
              label: "Template",
              value: personalImageTemplate,
              choices: personalImageTemplateSettingsChoices,
              onChange: setPersonalImageTemplate
            }) : null}
            {isTattooComposer ? (
              <>
                {renderSettingsSelect({
                  id: "tattoo-style",
                  label: "Style",
                  value: tattooStyle,
                  choices: tattooStyleSettingsChoices,
                  onChange: setTattooStyle
                })}
                {renderSettingsSelect({
                  id: "tattoo-placement",
                  label: "Placement",
                  value: tattooPlacement,
                  choices: tattooPlacementSettingsChoices,
                  onChange: handleTattooPlacementChange
                })}
                {renderSettingsSelect({
                  id: "tattoo-complexity",
                  label: "Complexity",
                  value: tattooComplexity,
                  choices: tattooComplexitySettingsChoices,
                  onChange: setTattooComplexity
                })}
                {renderSettingsSelect({
                  id: "tattoo-output",
                  label: "Output",
                  value: tattooOutputType,
                  choices: tattooOutputSettingsChoices,
                  onChange: setTattooOutputType
                })}
              </>
            ) : null}
            {isRoomDesignComposer ? (
              <>
                {renderSettingsSelect({
                  id: "room-design-room",
                  label: "Room",
                  value: roomDesignRoom,
                  choices: roomDesignRoomSettingsChoices,
                  onChange: setRoomDesignRoom
                })}
                {renderSettingsSelect({
                  id: "room-design-style",
                  label: "Style",
                  value: roomDesignStyle,
                  choices: roomDesignStyleSettingsChoices,
                  onChange: setRoomDesignStyle
                })}
                {renderSettingsSelect({
                  id: "room-design-colors",
                  label: "Colors",
                  value: roomDesignColor,
                  choices: roomDesignColorSettingsChoices,
                  onChange: setRoomDesignColor
                })}
                {renderSettingsSelect({
                  id: "room-design-size",
                  label: "Size",
                  value: roomDesignSize,
                  choices: roomDesignSizeSettingsChoices,
                  onChange: setRoomDesignSize
                })}
              </>
            ) : null}
          </div>
        </div>
      </div>, uiLocale),
      document.body
    )
    : null;

  const clothesChangerUploadSlotControls = isClothesChangerFixedComposer ? (
    <div className={styles.clothesChangerUploadSlots} aria-label="AI clothes changer uploads">
      {clothesChangerUploadSlots.map((slot) => {
        const uploadedImage = uploadedImages.find((image) => image.uploadSlot === slot.id);
        const isFailed = uploadedImage?.status === "failed";
        const isUploading = uploadedImage?.status === "uploading";
        return (
          <button
            className={[
              styles.clothesChangerUploadSlot,
              uploadedImage ? styles.clothesChangerUploadSlotFilled : "",
              isFailed ? styles.clothesChangerUploadSlotFailed : ""
            ].filter(Boolean).join(" ")}
            type="button"
            aria-label={uploadedImage ? `Replace ${slot.label}` : slot.label}
            title={uploadedImage ? `Replace ${slot.label}` : slot.helper}
            disabled={isSubmitting}
            key={slot.id}
            onClick={() => handleClothesChangerSlotClick(slot.id)}
          >
            {uploadedImage && uploadedImage.status !== "uploading" && uploadedImage.previewUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={styles.clothesChangerUploadPreview}
                  src={uploadedImage.previewUrl}
                  alt={uploadedImage.name || slot.label}
                  onError={() => handleUploadedImagePreviewError(uploadedImage.requestId)}
                />
                <span className={styles.clothesChangerUploadScrim} aria-hidden />
              </>
            ) : isUploading ? (
              <span className={styles.uploadSpinner} aria-hidden />
            ) : uploadedImage ? (
              <FileImage size={18} aria-hidden />
            ) : (
              <ImagePlus size={18} aria-hidden />
            )}
            <span className={styles.clothesChangerUploadCopy}>
              <strong>{slot.label}</strong>
              <small title={uploadedImage?.error}>
                {isUploading ? "Uploading..." : isFailed ? uploadedImage?.error || "Failed" : uploadedImage ? "Replace" : slot.helper}
              </small>
            </span>
          </button>
        );
      })}
    </div>
  ) : null;

  return localizeUiTree((
    <>
      <section
        ref={composerRef}
        className={[
          className ?? styles.composer,
          compact ? styles.compactComposer : "",
          usesResponsiveComposer ? styles.responsiveComposer : "",
          isExpandableComposer ? (threadComposerIsExpanded ? styles.threadComposerExpanded : styles.threadComposerCollapsed) : "",
          promptErrorVisible ? styles.composerPromptInvalid : "",
          uploadedImages.length ? styles.composerWithUploads : "",
          uploadInToolbar && !isClothesChangerFixedComposer && uploadedImages.length
            ? styles.workbenchToolbarComposerWithUploads
            : "",
          isClothesChangerFixedComposer ? styles.clothesChangerComposer : "",
          isVideoComposer ? styles.videoComposer : "",
          isImageDragActive ? styles.composerImageDropActive : ""
        ].filter(Boolean).join(" ")}
        aria-label={isThreadComposer ? "Message composer" : "Create"}
        onDragEnter={handleComposerDragEnter}
        onDragLeave={handleComposerDragLeave}
        onDragOver={handleComposerDragOver}
        onDrop={handleComposerDrop}
        onPaste={handleComposerPaste}
        onKeyDownCapture={(event) => {
          if (!isExpandableComposer || event.key !== "Tab") return;
          window.requestAnimationFrame(() => {
            if (!composerRef.current?.contains(document.activeElement)) {
              setIsThreadComposerExpanded(false);
            }
          });
        }}
        onClick={(event) => {
          if (isExpandableComposer && !threadComposerIsExpanded && event.target === event.currentTarget) {
            promptTextareaRef.current?.focus();
          }
        }}
      >
      {isImageDragActive ? (
        <div className={styles.composerImageDropOverlay} role="status" aria-live="polite">
          <ImagePlus size={26} aria-hidden />
          <strong>Drop images to upload</strong>
          <span>They will be added as references.</span>
        </div>
      ) : null}
      {isHotelLobbyComposer && !compact ? <div className={styles.hotelLobbyCast} role="group" aria-label="Performance type">
        {([{ value: "duet", label: "Duet", note: "2 photos" }, { value: "solo", label: "Solo", note: "1 photo" }, { value: "pets", label: "Pet duet", note: "2 photos" }] as const).map((cast) => <button key={cast.value} type="button" aria-pressed={hotelLobbyCast === cast.value} disabled={isSubmitting || hasPendingUpload} onClick={() => handleHotelLobbyCastChange(cast.value)}><strong>{cast.label}</strong><span>{cast.note}</span></button>)}
      </div> : null}
      {clothesChangerUploadSlotControls}
      {!isClothesChangerFixedComposer && (uploadedImages.length > 0 || (!uploadInToolbar && (!compact || isVideoComposer))) ? (
        <div className={uploadRowClassName ?? styles.composerUploadRow}>
          {uploadedImages.map((uploadedImage, uploadIndex) => (
            <div
              className={`${styles.composerUploadPreview} ${uploadedImage.status === "uploading" ? styles.composerUploadPreviewUploading : ""} ${uploadedImage.status === "failed" ? styles.composerUploadPreviewFailed : ""} ${uploadedImage.status !== "uploading" && !uploadedImage.previewUrl ? styles.composerUploadPreviewRestored : ""}`}
              title={uploadedImage.status === "failed" ? uploadedImage.error : uploadedImage.name}
              key={uploadedImage.requestId}
            >
              {uploadedImage.status === "uploading" ? (
                <span className={styles.uploadSpinner} aria-hidden />
              ) : uploadedImage.previewUrl ? (
                <img
                  src={uploadedImage.previewUrl}
                  alt={uploadedImage.name || "Uploaded image"}
                  onError={() => handleUploadedImagePreviewError(uploadedImage.requestId)}
                />
              ) : (
                <FileImage size={22} aria-hidden />
              )}
              <button className={styles.removeUploadButton} type="button" aria-label="Remove uploaded image" onClick={() => handleRemoveUploadedImage(uploadedImage.requestId)}>
                <X size={12} aria-hidden />
              </button>
              {uploadedImage.status === "failed" ? <span className={styles.uploadStatusBadge}>Failed</span> : isHotelLobbyComposer && !compact ? <span className={styles.uploadStatusBadge}>{hotelLobbyCast === "solo" ? "Solo" : uploadIndex === 0 ? "Left" : "Right"}</span> : null}
            </div>
          ))}
          {isHotelLobbyComposer && hotelLobbyCast === "solo" && uploadedImages.length === 1 ? (
            <button className={styles.hotelLobbyReplacePhoto} type="button" onClick={handleUploadClick} disabled={isSubmitting || hasPendingUpload}>Replace photo</button>
          ) : null}
          {canAddUploads && !uploadInToolbar ? (
            <button
              className={uploadButtonClassName ?? styles.uploadButton}
              type="button"
              aria-label={uploadButtonLabel}
              title={uploadButtonLabel}
              onClick={handleUploadClick}
              disabled={isSubmitting}
            >
              <ImagePlus size={22} aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
      <input
        ref={fileInputRef}
        className={styles.fileInput}
        type="file"
        accept="image/*"
        multiple={maxUploads > 1 && !isClothesChangerFixedComposer && !isSpotifyCanvasComposer}
        onChange={handleFileChange}
      />
      {isExpandableComposer && canAddUploads ? (
        <button
          className={styles.threadComposerQuickUpload}
          type="button"
          aria-label={uploadButtonLabel}
          title={uploadButtonLabel}
          onClick={() => {
            setIsThreadComposerExpanded(true);
            handleUploadClick();
          }}
          disabled={isSubmitting}
        >
          {isHotelLobbyComposer ? <Plus size={21} aria-hidden /> : <ImagePlus size={18} aria-hidden />}
        </button>
      ) : null}
      <textarea
        ref={promptTextareaRef}
        aria-label={isThreadComposer ? "Message" : undefined}
        aria-invalid={promptErrorVisible || undefined}
        aria-describedby={promptErrorVisible ? promptErrorId : undefined}
        placeholder={visibleComposerPlaceholder}
        rows={isExpandableComposer && !threadComposerIsExpanded ? 1 : compact ? 2 : 4}
        maxLength={SOCIALMEDIA_COMPOSER_MAX_CHARS}
        value={promptText}
        onFocus={() => {
          if (isExpandableComposer) setIsThreadComposerExpanded(true);
        }}
        onChange={(event) => setPromptText(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key !== "Enter"
            || event.shiftKey
            || event.repeat
            || event.nativeEvent.isComposing
            || !window.matchMedia("(min-width: 761px)").matches
            || !canSubmit
          ) {
            return;
          }
          event.preventDefault();
          void handleSubmit();
        }}
        disabled={isSubmitting}
      />
      {isHotelLobbyComposer && getHotelLobbySelectedDirections(selectedOptions).length > 0 ? (
        <div className={styles.hotelLobbyDirectionTags} aria-label="Selected video settings">
          {getHotelLobbySelectedDirections(selectedOptions).map((direction) => (
            <span className={styles.hotelLobbyDirectionTag} key={direction.id}>
              <button type="button" aria-label={`Change ${direction.title}: ${direction.label}`} onClick={() => setIsSettingsSheetOpen(true)} disabled={isSubmitting}>{direction.label}</button>
              <button type="button" aria-label={`Remove ${direction.title}: ${direction.label}`} onClick={() => setSelectedOptions((current) => ({ ...current, [direction.id]: "auto" }))} disabled={isSubmitting}><X size={13} aria-hidden /></button>
            </span>
          ))}
        </div>
      ) : null}
      {promptErrorVisible ? (
        <p id={promptErrorId} className={styles.composerError} role="alert">
          {isEditingSession
            ? "Please describe how you want to modify the image."
            : "Please describe what you want to create or change."}
        </p>
      ) : null}
      <div className={actionsClassName ?? styles.composerActions}>
        {leadingAction}
        {uploadInToolbar && canAddUploads && !isClothesChangerFixedComposer ? (
          <button
            className={uploadButtonClassName ?? styles.uploadButton}
            type="button"
            aria-label={uploadButtonLabel}
            title={uploadButtonLabel}
            onClick={handleUploadClick}
            disabled={isSubmitting}
          >
            {isHotelLobbyComposer && isThreadComposer ? <Plus size={21} aria-hidden /> : <ImagePlus size={18} aria-hidden />}
          </button>
        ) : null}
        {compact && !uploadInToolbar && canAddUploads && !isClothesChangerFixedComposer && !isVideoComposer ? (
          <button
            className={styles.composerIconButton}
            type="button"
            aria-label={uploadButtonLabel}
            title={uploadButtonLabel}
            onClick={handleUploadClick}
            disabled={isSubmitting}
          >
            <ImagePlus size={16} aria-hidden />
          </button>
        ) : null}
        <span className={styles.composerSpacer} />
        {hasSettingsSheet ? (
          <button
            className={styles.composerSettingsButton}
            type="button"
            data-prompt-settings
            aria-label="Advanced settings"
            aria-haspopup="dialog"
            aria-expanded={isSettingsSheetOpen}
            onClick={() => setIsSettingsSheetOpen((current) => !current)}
          >
            <ComposerSettingsIcon size={16} aria-hidden />
          </button>
        ) : null}
        <button
          className={[
            submitClassName ?? styles.submitButton,
            submitLabel && !submitClassName ? styles.submitButtonLabeled : ""
          ].filter(Boolean).join(" ")}
          type="button"
          aria-label={submitDisabledReason ?? submitLabel ?? "Create"}
          title={activeVideoSubmitMessage ?? submitDisabledReason}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {isSubmitting ? (
            <span className={styles.submitButtonSpinner} aria-hidden />
          ) : submitLabel ? (
            <span>{submitLabel}</span>
          ) : (
            <ArrowUp size={20} aria-hidden />
          )}
        </button>
      </div>
      {settingsSheet}
      {submitError ? <p className={styles.composerError} role="alert">{submitError}</p> : null}
      </section>
      {!hideSafetyNotice && (sourceUseCase === "ai-image-maker" || sourceUseCase === "ai-image-text-editor" || isVideoComposer) && !compact ? (
        <p className={styles.composerSafetyNotice}>
          {sourceUseCase === "ai-image-text-editor" ? (
            <>
              Official IDs, financial records, and fabricated messages are prohibited and blocked. By submitting,
              you confirm you have permission to edit this image.{" "}
              <Link href="/acceptable-use">See Acceptable Use.</Link>
            </>
          ) : (
            <>
              {isVideoComposer
                ? "We do not support adult, explicit, privacy-invasive, or unsafe video generation. Blocked requests do not use credits."
                : "We do not support adult, explicit, privacy-invasive, or unsafe image generation. Blocked requests do not use credits."}
              {sourceUseCase === "ai-image-maker" ? <> <Link href="/acceptable-use">See Acceptable Use.</Link></> : null}
            </>
          )}
        </p>
      ) : null}
    </>
  ), uiLocale);
}

export type AppThreadConversationCta =
  | {
      kind?: "workspace";
      href: string;
      label: string;
    }
  | {
      kind: "watermark_upgrade";
      targetJobId: string;
      targetAssetId: string;
      label: string;
    }
  | {
      kind: "subscription_plans";
      label: string;
    }
  | {
      kind: "video_subscription";
      label: string;
    };

type AppComposerTelemetryContext = {
  traceId: string;
  userId?: string;
};

function getAppStreamEventMessage(event: ChatStreamEvent): string | undefined {
  if (event.type === "assistant_delta") return event.delta.trim();
  if (event.type === "assistant_result" || event.type === "assistant_next") return event.text;
  if (event.type === "tool_started" || event.type === "tool_result") {
    return event.detail || event.title;
  }
  if (event.type === "task_created") {
    return event.payload.output_kind === "video"
      ? "Generation started. Waiting for the generated video..."
      : "Generation started. Waiting for generated images...";
  }
  if (event.type === "error") return event.message;
  return undefined;
}

export async function readAppComposerSubmitStream(
  response: Response,
  telemetry?: AppComposerTelemetryContext,
  onAssistantContent?: (content: string) => void,
  onClarification?: (result: AppComposerSubmitResponse) => void,
  onGenerationIntent?: (
    intent: Extract<ChatStreamIntent, "generate" | "revise">,
    outputKind?: "image" | "video"
  ) => void
): Promise<AppComposerSubmitResponse> {
  if (!response.body) return {};
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: AppComposerSubmitResponse = {};
  let streamError = "";
  let streamErrorCode: string | undefined;
  let streamErrorDetails: Record<string, unknown> | undefined;
  let assistantContent = "";
  let assistantContentChanged = false;
  let lastAssistantPaintAt = 0;
  let hasPlanningTerminal = false;

  const publishAssistantContent = async () => {
    if (!assistantContentChanged || !onAssistantContent) return;
    assistantContentChanged = false;
    onAssistantContent(assistantContent);

    // A fetch reader may already have several SSE chunks buffered. Without a
    // task/frame boundary, React can batch every pending-message update until
    // assistant_result, leaving the card on Thinking even though deltas arrived.
    // Yield at most once per 50 ms so the draft paints without slowing token
    // consumption to one token per animation frame.
    const now = Date.now();
    if (now - lastAssistantPaintAt < 50) return;
    lastAssistantPaintAt = now;
    if (typeof window === "undefined" || document.visibilityState !== "visible") return;
    await new Promise<void>((resolve) => {
      const timeoutId = window.setTimeout(resolve, 32);
      window.requestAnimationFrame(() => {
        window.clearTimeout(timeoutId);
        resolve();
      });
    });
  };

  function handleEvent(event: ChatStreamEvent) {
    if (telemetry) {
      const message = getAppStreamEventMessage(event);
      trackClientEvent("socialmedia.create.stream.event", {
        traceId: telemetry.traceId,
        userId: telemetry.userId,
        jobId: event.type === "task_created" ? event.payload.job_id : undefined,
        action: "stream",
        stage: "stream",
        status: event.type === "error" ? "failed" : "active",
        streamEventType: event.type,
        streamStage: event.type === "tool_started" || event.type === "tool_result" ? event.stage : undefined,
        messagePreview: truncateTelemetryText(message, 300),
        messageLength: message?.length
      });
    }
    if (event.type === "assistant_delta") {
      if (event.channel !== "result" || !event.delta) return;
      assistantContent += event.delta;
      assistantContentChanged = true;
      return;
    }
    if (event.type === "assistant_reset") {
      assistantContent = "";
      assistantContentChanged = true;
      return;
    }
    if (event.type === "assistant_result") {
      assistantContent = event.text;
      assistantContentChanged = true;
      return;
    }
    if (
      event.type === "tool_result"
      && event.tool_name === "socialmedia_intent"
      && event.stage === "intent"
      && (event.intent === "generate" || event.intent === "revise")
    ) {
      onGenerationIntent?.(event.intent, event.output_kind);
      return;
    }
    if (event.type === "task_created") {
      result = {
        session_id: event.payload.session_id,
        agent_mode: event.payload.agent_mode,
        error: event.payload.error,
        source_use_case: event.payload.source_use_case,
        output_type: event.payload.output_kind,
        assistant_message: assistantContent ? { content: assistantContent } : undefined,
        job: {
          job_id: event.payload.job_id,
          session_id: event.payload.session_id ?? "",
          status: event.payload.status ?? "queued",
          status_url: event.payload.status_url
        }
      };
      if (result.job?.job_id) hasPlanningTerminal = true;
      return;
    }
    if (event.type === "conversation_done") {
      if (event.payload.clarification_card) {
        assistantContent = event.payload.clarification_card.question;
        assistantContentChanged = false;
      }
      result = {
        ...result,
        session_id: event.payload.session_id ?? result.session_id,
        agent_mode: event.payload.agent_mode ?? result.agent_mode,
        assistant_message: assistantContent ? {
          content: assistantContent,
          ...(event.payload.clarification_card ? { metadata: { clarificationCard: event.payload.clarification_card } } : {})
        } : result.assistant_message,
        cta: event.payload.cta ?? result.cta
      };
      hasPlanningTerminal = true;
      if (event.payload.clarification_card) onClarification?.(result);
      return;
    }
    if (event.type === "error") {
      streamError = event.message;
      streamErrorCode = event.code;
      streamErrorDetails = event.details;
    }
  }

  while (true) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch (error) {
      // A complete product terminal remains authoritative after transport loss.
      // Discard incomplete SSE frames, but preserve any complete structured error.
      if (!hasPlanningTerminal || !isRecoverableThreadSubmitError(error)) throw error;
      buffer = "";
      break;
    }
    const { done, value } = chunk;
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      for (const event of parseChatStreamChunk(`${block}\n\n`)) {
        handleEvent(event);
      }
    }
    await publishAssistantContent();
  }

  if (buffer.trim()) {
    for (const event of parseChatStreamChunk(`${buffer}\n\n`)) {
      handleEvent(event);
    }
    await publishAssistantContent();
  }

  if (streamError && result.job) {
    return {
      ...result,
      job: {
        ...result.job,
        status: "failed"
      },
      error: streamError,
      code: streamErrorCode,
      details: streamErrorDetails
    };
  }

  if (streamError) {
    throw new AppComposerSubmitError(streamError, {
      code: streamErrorCode,
      details: streamErrorDetails
    });
  }

  return assistantContent && result.job && !result.assistant_message?.content
    ? { ...result, assistant_message: { content: assistantContent } }
    : result;
}

export function openThreadAuthModal(options?: { promptCase?: "guest_depleted_signup_bonus" | "checkout_auth_required" | "guest_account_already_claimed" }) {
  window.dispatchEvent(new CustomEvent("vismuse:open-auth-modal", {
    detail: options?.promptCase ? { promptCase: options.promptCase } : undefined
  }));
}

export function openThreadClaimedGuestAuthModal(account: AppAccountSummary) {
  window.dispatchEvent(new CustomEvent("vismuse:open-auth-modal", {
    detail: {
      promptCase: "guest_account_already_claimed",
      claimedGuest: true,
      claimedEmail: account.claimedEmail,
      claimedProviders: account.claimedProviders
    }
  }));
}
