"use client";
import { resolveSocialmediaSubmissionLanguage } from "@/lib/socialmedia/submission-language";

import { t } from "@/lib/i18n/catalog";
import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";
import { canTopUpThreadCredits } from "./app-credit-paywall";
import ClarificationCard from "./clarification-card";
import { readClarificationCard, supportsClarificationCard, type ClarificationCardData } from "@/lib/chat/clarification-card";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { captureAnalyticsEvent, getStoredAttribution, startAnalyticsSessionRecording } from "@/lib/analytics/posthog";
import { buildCreditPromptAnalyticsEvent } from "@/lib/analytics/credit-prompt";
import { buildCheckoutAnalyticsProperties } from "@/lib/analytics/checkout";
import { rememberAppCheckoutContext, type AppCheckoutKind } from "@/lib/analytics/app-checkout-recovery";
import { clearGuestClaimIntent, createGuestClaimAttemptCoordinator, prepareGuestClaimIntent } from "@/lib/auth/guest-claim";
import { buildOAuthCallbackPath, oauthFailureFromError, resetOAuthFailureReportDedupe } from "@/lib/auth/oauth-failure-reporting";
import { createGoogleAdsCheckoutIntentDedupeKey, trackGoogleAdsBeginCheckoutConversion, trackGoogleAdsSubscriptionModalViewConversion } from "@/lib/analytics/google-ads";
import { resolveThreadSubmitSessionRedirect } from "@/lib/app/thread-session-continuity";
import { resolveViewportPopoverPosition, type ViewportPopoverPosition } from "@/lib/app/viewport-popover-position";
import { resolveImageRenderCountdown, resolveImageRenderDurationMs, resolveImageRenderStartedAtMs, resolveServerAdjustedNowMs, resolveServerClockOffsetMs, type ImageRenderCountdown, type ImageRenderPendingTaskTiming } from "@/lib/app/image-render-countdown";
import { isChatStreamResponse, type ChatStreamIntent } from "@/lib/chat/stream";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { requestCheckoutWithAuthRecovery } from "@/lib/auth/checkout-request";
import { formatVismuseTitle } from "@/lib/metadata/vismuse-title";
import { DEFAULT_PRICING_VARIANT, PRICING_EXPERIMENT_KEY, normalizePricingVariant, type PricingVariant } from "@/lib/billing/catalog";
import { resolveBillingOffer } from "@/lib/billing/offers";
import { readClientPricingVariantOverride, resolveClientPricingExperimentVariant } from "@/lib/billing/pricing-experiment-client";
import { resolveClientGuestSubscriptionPopupExperimentFallback, resolveClientGuestSubscriptionPopupExperimentFromServer, resolveClientGuestSubscriptionPopupExperimentInitial, type ClientGuestSubscriptionPopupExperimentAssignment } from "@/lib/socialmedia/guest-subscription-popup-experiment-client";
import { SOCIALMEDIA_COMPOSER_MAX_CHARS } from "@/lib/socialmedia/input-limits";
import { resolveSocialmediaApiErrorMessage } from "@/lib/socialmedia/api-error";
import { resolveClientJobPollDelayMs } from "@/lib/socialmedia/job-polling";
import { isChineseSocialmediaResponseLanguage } from "@/lib/socialmedia/language";
import type { ImageExportFormat } from "@/lib/images/export";
import { resolveTaskTitle } from "@/lib/socialmedia/task-title";
import { buildImageGenerationCompletionReply } from "@/lib/socialmedia/completion-copy";
import { findUncoveredRetainedLocalThreadSubmitJobs, isForbiddenThreadSessionSubmitError, isRecoverableThreadSubmitError, isSameThreadSubmitRequest, isThreadSubmitRequestCoveredByServerJobs, recoverThreadSubmit, resolveThreadSubmitRetryRequest, shouldRetainPreJobServerFailureForRetry, shouldReconcilePreJobServerFailure, THREAD_SUBMIT_REQUEST_TIMEOUT_MS } from "@/lib/socialmedia/thread-submit-recovery";
import { GENERATION_SAFETY_BLOCKED_CODE, isGenerationCreditPaywallError as isThreadCreditPaywallMessage, isInternalGenerationError, toUserFacingGenerationError } from "@/lib/socialmedia/user-facing-error";
import { stripInternalSubmittedInputForDisplay } from "@/lib/socialmedia/user-visible-input";
import { buildGuestUserRequestHeaders, createTraceId, getClientSessionId, isAccountRequestIdentityReady, trackClientEvent, truncateTelemetryText } from "@/lib/telemetry/client";
import { isMiniMaxH3VideoFlowSourceUseCase, isSpotifyCanvasSourceUseCase, isVideoGenerationSourceUseCase } from "@/lib/videos/source-use-case";
import { hasActiveVideoGenerationJob } from "@/lib/videos/submission-guard";
import { Bot, Check, ChevronLeft, ChevronDown, Download, Film, FileImage, FileText, LoaderCircle, Music2, Plus, RefreshCw, WandSparkles, X } from "lucide-react";
import commonStyles from "./app.module.css";
import pageStyles from "./app-thread.module.css";
import { freeCreditLimitUpgradeCta, freeGeneratedBlurredImageUpgradeCta, freeGeneratedLowResImageUpgradeCta, freeGeneratedWatermarkedImageUpgradeCta, guestCreditLimitSignupCta } from "./app-cta-copy";
import { DEFAULT_APP_TOOL_SLUG, isAlbumCoverAnimateMenuResult, SOURCE_USE_CASE_APP_TOOL_SLUG_MAP } from "./constants";
import { findAppTool, findAppToolByPathname, resolveAppToolPublicHref, type AppAccountSummary } from "./app-data";
import { useAppAccountStore } from "./app-account-store";
import { AppThreadSessionFetchError, AppThreadSessionSupersededError, fetchAppThreadSession, getThreadSessionAccountKey } from "./app-thread-session-loader";
import { AppImagePreviewOverlay, type AppImagePreviewItem, type AppImagePreviewState } from "./app-image-preview";
import { AppFallbackImage } from "./app-fallback-image";
import { buildSubscriptionModalPlans, isGuestWatermarkedSignupImage, isLowResCleanPreviewImage, type GeneratedImage as SocialmediaGeneratedImage, type RechargePackageId, type SubscriptionSuccessModalPlan } from "./app-subscription-model";
import { AppThreadAccessModals } from "./app-thread-access-modals";
import { AppThreadGuestResultUpgradeCta } from "./app-thread-guest-result-upgrade-cta";
import type { SubscriptionCta } from "./subscription-gate-modal";
import VideoSubscriptionModal, { type VideoPricingDefaultView } from "@/app/ai-video-generator/_components/video-subscription-modal";
import { VIDEO_CREDIT_PACK_CHECKOUT_TYPE, isVideoCreditPackPackageId } from "@/lib/billing/video-credit-packs";
import { IMAGE_CREDIT_PACK_CHECKOUT_TYPE, isImageCreditPackPackageId, isV24ImageCreditPackPackageId } from "@/lib/billing/image-credit-packs";
import { resolveAppResponseLanguage, getAppComposerPlaceholder, type AppComposerPlatform, type AppComposerDestination, type AppVideoModelTier, type AppComposerRoomDesignAssetRole, type AppComposerSourceAsset, type AppComposerTargetAsset, type AppComposerResultAction, type AppComposerSubmitResponse, AppComposerSubmitError, type AppPendingThreadSubmit, getPendingThreadSubmitKey, createAppSubmitIdempotencyKey, bucketAppInputLength, summarizeAppSubmitPayload, summarizeAppSubmitResponse, APP_ANALYTICS_WORKFLOW, buildAppGenerationAnalyticsProperties, writePendingThreadSubmit, APP_VIDEO_COMPOSER_DEFAULT_RESOLUTION, SPOTIFY_CANVAS_DEFAULT_DISPLAY_PROMPT, APP_VIDEO_COMPOSER_DEFAULT_MODEL_TIER, videoComposerOptions, buildSpotifyCanvasSubmittedInputText, isPaidAppVideoPlan, resolveSpotifyCanvasVideoResolution, inferAppVideoOrientation, AppComposer, type AppThreadConversationCta, readAppComposerSubmitStream, openThreadAuthModal, openThreadClaimedGuestAuthModal } from "./app-composer";
import { APP_LAST_CREATE_HREF_UPDATE_EVENT, createAppRechargeIdempotencyKey, getAppCheckoutPlanName, getAppSubscriptionClickScenario, getAppOutputType, spotifyCanvasComposerOptions, promoVideoComposerOptions, type AppThreadMediaItem, downloadThreadBlob, saveThreadMedia, createThreadIdempotencyKey, THREAD_PENDING_IMAGE_UNLOCK_CHECKOUT_KEY, APP_PENDING_CHECKOUT_AFTER_AUTH_KEY, APP_IMAGE_UNLOCK_PACKAGE_ID, APP_CHECKOUT_START_TIMEOUT_MS, APP_CHECKOUT_SYNCED_EVENT, dispatchAppToast, type AppCheckoutSyncedEventDetail, getAppCheckoutFailureMessage, clearAppPendingCheckoutAfterAuth, useResetCheckoutPendingOnPageShow } from "./app-shared";

const styles = { ...commonStyles, ...pageStyles };

const APP_THREAD_IMAGE_PREVIEW_SIZES = "(max-width: 640px) 100vw, 460px";

const APP_JOB_POLL_TIMEOUT_MS = 720_000;

function isPricingPageHref(href: string): boolean {
  return /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?pricing(?:\/|[?#]|$)/i.test(href.trim());
}

// Status recovery can legitimately finish asset persistence in this request,
// so keep the bound above those server-side budgets while preventing a fetch
// from occupying the per-job dedupe slot forever.
const APP_JOB_POLL_REQUEST_TIMEOUT_MS = 180_000;

type AppImageAnimationKind = "spotify_canvas" | "video";

type AppImageAnimationSource = "album_cover" | "image";

type AppImageVideoDuration = 5 | 10 | 15;

type AppImageAnimationDraft = {
  job: AppThreadJob;
  image: SocialmediaGeneratedImage;
  selectableImages: SocialmediaGeneratedImage[];
  source: AppImageAnimationSource;
};

const APP_PENDING_THREAD_SUBMIT_AUTO_RETRIES = 0;

const APP_PENDING_THREAD_SUBMIT_RECOVERING_MESSAGE = "Connection interrupted. Checking your task status…";

const APP_PENDING_THREAD_SUBMIT_RECOVERY_FAILED_MESSAGE = "We couldn’t confirm that the task started. Please retry.";

const APP_LAST_CREATE_HREF_STORAGE_KEY = "vismuse.app.lastCreateHref";

const pendingThreadSubmitRequests = new Map<string, Promise<AppComposerSubmitResponse>>();

const THREAD_AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 160;

function getAppDateDeltaMs(start?: string | null, end?: string | null): number | undefined {
  const startMs = Date.parse(start ?? "");
  const endMs = Date.parse(end ?? "");
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return undefined;
  return Math.max(0, endMs - startMs);
}

function readPendingThreadSubmit(sessionId: string): AppPendingThreadSubmit | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(getPendingThreadSubmitKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppPendingThreadSubmit>;
    if (parsed.version !== 1 || parsed.sessionId !== sessionId || !parsed.sourceUseCase) return null;
    if (
      parsed.status === "failed"
      && !isVideoGenerationSourceUseCase(parsed.sourceUseCase)
      && shouldRetainPreJobServerFailureForRetry(parsed.lastErrorCode)
    ) {
      parsed.lastError = THREAD_GENERATION_SERVICE_ISSUE_MESSAGE;
    }
    return {
      version: 1,
      sessionId,
      idempotencyKey: parsed.idempotencyKey || `app-submit:${sessionId}:legacy`,
      traceId: typeof parsed.traceId === "string" && parsed.traceId.trim() ? parsed.traceId : createTraceId(),
      toolSlug: parsed.toolSlug || resolveAppThreadToolSlug(parsed.sourceUseCase),
      sourceUseCase: parsed.sourceUseCase,
      outputType: parsed.outputType === "video" ? "video" : parsed.outputType === "image" ? "image" : undefined,
      status: parsed.status === "failed"
        ? "failed"
        : parsed.status === "recovering"
          ? "recovering"
          : "submitting",
      content: stripInternalSubmittedInputForDisplay(parsed.content || ""),
      language: typeof parsed.language === "string" && parsed.language.trim() ? parsed.language : undefined,
      aspectRatio: parsed.aspectRatio || "auto",
      resolution: parsed.resolution || "auto",
      videoModel: typeof parsed.videoModel === "string" && parsed.videoModel.trim() ? parsed.videoModel : undefined,
      videoModelTier: parsed.videoModelTier === "pro" || parsed.videoModelTier === "max" ? parsed.videoModelTier : parsed.videoModelTier === "lite" ? "lite" : undefined,
      videoDuration: typeof parsed.videoDuration === "number" && Number.isFinite(parsed.videoDuration) ? parsed.videoDuration : undefined,
      videoResolution: typeof parsed.videoResolution === "string" && parsed.videoResolution.trim() ? parsed.videoResolution : undefined,
      videoSize: typeof parsed.videoSize === "string" && parsed.videoSize.trim() ? parsed.videoSize : undefined,
      requiredVideoReferenceAssetIds: Array.isArray(parsed.requiredVideoReferenceAssetIds)
        ? [...new Set(parsed.requiredVideoReferenceAssetIds.filter((assetId): assetId is string => typeof assetId === "string" && Boolean(assetId.trim())).map((assetId) => assetId.trim()))]
        : undefined,
      platform: parsed.platform,
      destination: parsed.destination,
      sourceAssets: Array.isArray(parsed.sourceAssets) ? parsed.sourceAssets : [],
      displaySourceAssets: Array.isArray(parsed.displaySourceAssets)
        ? parsed.displaySourceAssets
        : Array.isArray(parsed.sourceAssets) ? parsed.sourceAssets : [],
      targetAssets: Array.isArray(parsed.targetAssets) ? parsed.targetAssets : undefined,
      parentJobId: typeof parsed.parentJobId === "string" && parsed.parentJobId.trim() ? parsed.parentJobId : undefined,
      resultAction: parsed.resultAction === "variant" || parsed.resultAction === "resize" || parsed.resultAction === "placement_preview" || parsed.resultAction === "upgrade_4k"
        ? parsed.resultAction
        : undefined,
      generationInputText: typeof parsed.generationInputText === "string" && parsed.generationInputText.trim()
        ? parsed.generationInputText
        : parsed.content && stripInternalSubmittedInputForDisplay(parsed.content) !== parsed.content.trim()
          ? parsed.content.trim()
          : undefined,
      attributionSnapshot: parsed.attributionSnapshot,
      createdAt: parsed.createdAt || new Date().toISOString(),
      attemptCount: Math.max(0, Number(parsed.attemptCount) || 0),
      submittedAt: parsed.submittedAt,
      failedAt: parsed.failedAt,
      lastError: parsed.lastError,
      lastErrorCode: parsed.lastErrorCode,
      resumeAfterAuth: parsed.resumeAfterAuth === true
    };
  } catch {
    return null;
  }
}

function updatePendingThreadSubmit(
  pending: Pick<AppPendingThreadSubmit, "sessionId" | "idempotencyKey">,
  patch: Partial<AppPendingThreadSubmit>
): AppPendingThreadSubmit | null {
  const current = readPendingThreadSubmit(pending.sessionId);
  if (!isSameThreadSubmitRequest(current, pending)) return null;
  const next = {
    ...current,
    ...patch,
    sessionId: current.sessionId,
    version: 1 as const
  };
  return writePendingThreadSubmit(next) ? next : current;
}

function removePendingThreadSubmit(
  pending: Pick<AppPendingThreadSubmit, "sessionId" | "idempotencyKey">
) {
  if (typeof window === "undefined") return;
  try {
    const current = readPendingThreadSubmit(pending.sessionId);
    if (!isSameThreadSubmitRequest(current, pending)) return;
    window.sessionStorage.removeItem(getPendingThreadSubmitKey(pending.sessionId));
  } catch {
    // Ignore storage cleanup failures.
  }
}

const ALBUM_COVER_VIDEO_PROMPT_PLACEHOLDER = "Describe the motion, camera movement, and mood you want…";

type AppThreadJobStatus = "queued" | "running" | "completed" | "failed";

type AppThreadImagePreviewData = {
  job?: AppThreadJob;
  media?: AppThreadMediaItem;
  sourceAsset?: AppThreadSourceAsset;
};

const IMAGE_EXPORT_CLICK_ANALYTICS = {
  jpeg: { event: "jpg_export_clicked", pointName: "jpg导出" },
  pdf: { event: "pdf_export_clicked", pointName: "pdf导出" }
} as const;

type AppThreadSourceAsset = {
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
  originalName?: string;
  original_name?: string;
  roomDesignRole?: AppComposerRoomDesignAssetRole;
  room_design_role?: AppComposerRoomDesignAssetRole;
  imageIndex?: number;
  image_index?: number;
};

type AppThreadJob = {
  job_id: string;
  session_id: string;
  owner_user_id?: string;
  owner_auth_mode?: "guest" | "supabase" | "anonymous";
  source_use_case?: string;
  output_type?: string;
  poll_token?: string;
  input_text?: string;
  conversation_reply?: string;
  /** Local-only acknowledgement shown while the associated generation is active. */
  generation_progress_reply?: string;
  parent_job_id?: string;
  created_at?: string;
  updated_at?: string;
  status: AppThreadJobStatus;
  stage?: string;
  progress?: number;
  next_poll_after_ms?: number;
  error?: string;
  error_code?: string;
  is_mock?: boolean;
  // Client-only display floor; server stage/progress remain authoritative.
  generation_intent_confirmed?: boolean;
  mock_ui?: "thinking" | "generating" | "completed" | "failed" | "gated" | "video" | "empty";
  local_pending_status?: AppPendingThreadSubmit["status"];
  socialmedia?: {
    submitIdempotencyKey?: string;
    sourceAssets?: AppThreadSourceAsset[];
    source_assets?: AppThreadSourceAsset[];
    userSourceAssets?: AppThreadSourceAsset[];
    user_source_assets?: AppThreadSourceAsset[];
    targetAssets?: AppThreadSourceAsset[];
    target_assets?: AppThreadSourceAsset[];
    renderCountdownDurationMs?: number;
    renderStartedAt?: string;
    render_started_at?: string;
    pendingImageTasks?: ImageRenderPendingTaskTiming[];
    pending_image_tasks?: ImageRenderPendingTaskTiming[];
  };
  result?: {
    kind?: string;
    socialmedia?: {
      images?: Array<Record<string, unknown>>;
      videos?: Array<Record<string, unknown>>;
      warnings?: Array<{ message?: string }>;
      language?: string;
      briefSummary?: string;
      brief_summary?: string;
    };
  };
};

type AppThreadSession = {
  session_id: string;
  server_now?: string;
  agent_mode?: boolean;
  owner_user_id?: string;
  owner_auth_mode?: "guest" | "supabase" | "anonymous";
  title?: string;
  source_use_case?: string;
  created_at?: string;
  updated_at?: string;
  last_job_id?: string;
  jobs?: AppThreadJob[];
  conversation_turns?: AppThreadConversationTurn[];
  error?: string;
};

type AppThreadConversationTurn = {
  id: string;
  user_content: string;
  assistant_content: string;
  clarification?: ClarificationCardData;
  clarification_stream_error?: string;
  created_at: string;
  source_assets?: AppThreadSourceAsset[];
  cta?: AppThreadConversationCta;
};

function appendAppThreadConversationTurn(
  current: AppThreadConversationTurn[] | undefined,
  pending: AppPendingThreadSubmit,
  assistantContent: string,
  cta?: AppThreadConversationCta,
  clarification?: ClarificationCardData
): AppThreadConversationTurn[] {
  const id = `conversation-${pending.idempotencyKey}`;
  const next = (current ?? []).filter((turn) => turn.id !== id);
  return [...next, {
    id,
    user_content: pending.content,
    assistant_content: assistantContent,
    created_at: pending.createdAt || new Date().toISOString(),
    source_assets: pending.displaySourceAssets ?? pending.sourceAssets,
    clarification,
    cta
  }];
}

function isAppGuestOwnerUserId(ownerUserId?: string): boolean {
  return /^guest:[a-f0-9-]{36}$/i.test(ownerUserId?.trim() ?? "");
}

function normalizeAppThreadJobStatus(status: unknown): AppThreadJobStatus {
  return status === "queued" || status === "running" || status === "completed" || status === "failed"
    ? status
    : "queued";
}

function getPendingThreadJobId(pending: Pick<AppPendingThreadSubmit, "idempotencyKey">): string {
  return `pending-${pending.idempotencyKey}`;
}

function buildPendingThreadJob(pending: AppPendingThreadSubmit, patch?: Partial<AppThreadJob>): AppThreadJob {
  const now = new Date().toISOString();
  const createdAt = pending.createdAt || now;
  const isFailed = pending.status === "failed";
  const isRecovering = pending.status === "recovering";
  return {
    job_id: getPendingThreadJobId(pending),
    session_id: pending.sessionId,
    source_use_case: pending.sourceUseCase,
    output_type: pending.outputType ?? getAppOutputType(pending.sourceUseCase),
    status: isFailed ? "failed" : "running",
    stage: isFailed ? "failed" : "starting",
    progress: isFailed ? 100 : 3,
    error: isFailed ? pending.lastError || "Failed to start generation." : undefined,
    error_code: isFailed ? pending.lastErrorCode : undefined,
    input_text: pending.content || (pending.sourceAssets.length ? "Create from uploaded reference image" : "Untitled request"),
    created_at: createdAt,
    updated_at: now,
    is_mock: true,
    mock_ui: isFailed ? undefined : "thinking",
    local_pending_status: pending.status,
    generation_progress_reply: isRecovering ? APP_PENDING_THREAD_SUBMIT_RECOVERING_MESSAGE : undefined,
    socialmedia: {
      submitIdempotencyKey: pending.idempotencyKey,
      sourceAssets: pending.sourceAssets,
      userSourceAssets: pending.displaySourceAssets ?? pending.sourceAssets
    },
    ...patch
  };
}

function buildPendingThreadSession(pending: AppPendingThreadSubmit, patch?: Partial<AppThreadJob>): AppThreadSession {
  const now = new Date().toISOString();
  const job = buildPendingThreadJob(pending, patch);
  return {
    session_id: pending.sessionId,
    title: pending.content || "New chat",
    source_use_case: pending.sourceUseCase,
    created_at: pending.createdAt || now,
    updated_at: now,
    last_job_id: job.job_id,
    jobs: [job]
  };
}

function mergePendingThreadSubmitIntoSession(
  session: AppThreadSession,
  pending: AppPendingThreadSubmit,
  patch?: Partial<AppThreadJob>
): AppThreadSession {
  const pendingJob = preserveConfirmedThreadGenerationIntent(
    buildPendingThreadJob(pending, patch),
    session.jobs?.find((job) => job.job_id === getPendingThreadJobId(pending))
  );
  const jobsWithoutPending = (session.jobs ?? []).filter((job) => job.job_id !== pendingJob.job_id);
  return {
    ...session,
    session_id: session.session_id || pending.sessionId,
    title: session.title || pending.content || "New chat",
    source_use_case: session.source_use_case || pending.sourceUseCase,
    updated_at: session.updated_at || new Date().toISOString(),
    last_job_id: pendingJob.job_id,
    jobs: sortThreadJobs([...jobsWithoutPending, pendingJob])
  };
}

function normalizePendingMatchText(value?: string | null): string {
  return stripInternalSubmittedInputForDisplay(value || "").replace(/\s+/g, " ").trim();
}

function isPendingCoveredByServerJob(jobs: AppThreadJob[] | undefined, pending: AppPendingThreadSubmit): boolean {
  if (!jobs?.length) return false;
  const serverJobs = jobs.filter((job) => !job.is_mock && !job.job_id.startsWith("pending-"));
  if (!serverJobs.length) return false;
  const pendingCreatedAt = Date.parse(pending.createdAt);
  const pendingInput = normalizePendingMatchText(pending.content);
  const pendingOutputType = pending.outputType ?? getAppOutputType(pending.sourceUseCase);
  return isThreadSubmitRequestCoveredByServerJobs(serverJobs, pending.idempotencyKey, (job) => {
    const jobCreatedAt = Date.parse(job.created_at ?? job.updated_at ?? "");
    if (Number.isFinite(pendingCreatedAt) && Number.isFinite(jobCreatedAt) && jobCreatedAt + 2_000 < pendingCreatedAt) {
      return false;
    }
    const jobSourceUseCase = job.source_use_case || "";
    if (pending.sourceUseCase !== "general" && jobSourceUseCase && pending.sourceUseCase && jobSourceUseCase !== pending.sourceUseCase) return false;
    const jobOutputType = job.output_type === "video" || isVideoGenerationSourceUseCase(job.source_use_case) ? "video" : "image";
    if (pending.sourceUseCase !== "general" && pendingOutputType !== jobOutputType) return false;
    const jobInput = normalizePendingMatchText(job.input_text);
    return Boolean(pendingInput && jobInput && pendingInput === jobInput);
  });
}

function readPollTokenFromStatusUrl(statusUrl?: string): string | undefined {
  if (!statusUrl) return undefined;
  try {
    return new URL(statusUrl, "https://vismuse.local").searchParams.get("poll_token") ?? undefined;
  } catch {
    return undefined;
  }
}

function buildSubmittedThreadJob(
  pending: AppPendingThreadSubmit,
  data: AppComposerSubmitResponse
): AppThreadJob | null {
  if (!data.job?.job_id) return null;
  const now = new Date().toISOString();
  const status = normalizeAppThreadJobStatus(data.job.status);
  return {
    job_id: data.job.job_id,
    session_id: data.job.session_id || data.session_id || pending.sessionId,
    source_use_case: pending.sourceUseCase === "general" ? data.source_use_case ?? pending.sourceUseCase : pending.sourceUseCase,
    output_type: (pending.sourceUseCase === "general" ? data.output_type : undefined) ?? pending.outputType ?? getAppOutputType(pending.sourceUseCase),
    poll_token: readPollTokenFromStatusUrl(data.job.status_url),
    input_text: pending.content || (pending.sourceAssets.length ? "Create from uploaded reference image" : "Untitled request"),
    created_at: pending.createdAt || now,
    updated_at: now,
    status,
    generation_intent_confirmed: status === "queued" || status === "running",
    stage: status === "failed" ? "failed" : "starting",
    progress: status === "failed" ? 100 : 3,
    error: data.error,
    generation_progress_reply: data.assistant_message?.content?.trim() || undefined,
    socialmedia: {
      sourceAssets: pending.sourceAssets,
      userSourceAssets: pending.displaySourceAssets ?? pending.sourceAssets
    }
  };
}

async function submitPendingThreadSubmit(
  pending: AppPendingThreadSubmit,
  options?: {
    signal?: AbortSignal;
    onAssistantContent?: (content: string) => void;
    onClarification?: (result: AppComposerSubmitResponse) => void;
    onGenerationIntent?: (
      intent: Extract<ChatStreamIntent, "generate" | "revise">,
      outputKind?: "image" | "video"
    ) => void;
  }
): Promise<AppComposerSubmitResponse> {
  const traceId = pending.traceId || createTraceId();
  const payload = {
    session_id: pending.sessionId,
    content: pending.content,
    aspect_ratio: pending.aspectRatio,
    image_count: "auto" as const,
    language: pending.language ?? resolveSocialmediaSubmissionLanguage({ userInput: pending.content, outputType: pending.outputType }),
    resolution: pending.resolution,
    output_format: "png",
    ratio: pending.videoSize,
    orientation: isVideoGenerationSourceUseCase(pending.sourceUseCase) ? inferAppVideoOrientation(pending.aspectRatio) : undefined,
    duration: pending.videoDuration,
    video_model_tier: pending.videoModelTier,
    video_resolution: pending.videoResolution,
    required_video_reference_asset_ids: pending.requiredVideoReferenceAssetIds,
    platform: pending.platform,
    destination: pending.destination,
    source_assets: pending.sourceAssets,
    user_source_assets: pending.displaySourceAssets ?? pending.sourceAssets,
    target_assets: pending.targetAssets,
    parent_job_id: pending.parentJobId,
    result_action: pending.resultAction,
    generation_input_text: pending.generationInputText,
    source_use_case: pending.sourceUseCase,
    submit_idempotency_key: pending.idempotencyKey,
    attribution_snapshot: pending.attributionSnapshot,
    // Intent-driven pending cards require SSE for both image and standalone
    // video workbenches. Keep this explicit instead of relying on the Accept header.
    prefer_stream: true
  };
  const requestStartedAt = Date.now();
  const requestSummary = summarizeAppSubmitPayload(payload);
  trackClientEvent("socialmedia.create.request.started", {
    traceId,
    appSessionId: pending.sessionId,
    action: "request",
    stage: "request",
    status: "started",
    workflow: APP_ANALYTICS_WORKFLOW,
    sourceUseCase: pending.sourceUseCase,
    source_use_case: pending.sourceUseCase,
    outputType: pending.outputType,
    output_type: pending.outputType,
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
        "x-idempotency-key": pending.idempotencyKey,
        "x-trace-id": traceId,
        "x-session-id": getClientSessionId()
      },
      body: JSON.stringify(payload),
      signal: options?.signal
    });
    const data = isChatStreamResponse(response)
      ? await readAppComposerSubmitStream(response, {
          traceId
        }, options?.onAssistantContent, options?.onClarification, options?.onGenerationIntent)
      : await response.json().catch(() => ({})) as AppComposerSubmitResponse;
    if (!response.ok) {
      throw new AppComposerSubmitError(resolveSocialmediaApiErrorMessage(data.error, "Failed to start generation."), {
        code: data.code,
        details: data.details,
        status: response.status
      });
    }
    trackClientEvent("socialmedia.create.request.completed", {
      traceId,
      appSessionId: pending.sessionId,
      action: "request",
      stage: "request",
      status: "success",
      workflow: APP_ANALYTICS_WORKFLOW,
      sourceUseCase: pending.sourceUseCase,
      source_use_case: pending.sourceUseCase,
      outputType: pending.outputType,
      output_type: pending.outputType,
      jobId: data.job?.job_id,
      statusCode: response.status,
      durationMs: Date.now() - requestStartedAt,
      requestSummary,
      responseSummary: summarizeAppSubmitResponse(data)
    });
    if (data.job?.job_id) {
      captureAnalyticsEvent("generation_task_created", buildAppGenerationAnalyticsProperties({
        trace_id: traceId,
        job_id: data.job.job_id,
        session_id: data.job.session_id || data.session_id || pending.sessionId,
        action: "job_create",
        stage: "job_create",
        status: "success",
        image_count: "auto",
        input_length_bucket: bucketAppInputLength(pending.content.length),
        source_kind: pending.sourceAssets.length > 0 ? "image" : "text",
        mode: pending.parentJobId ? "revise" : "generate"
      }));
    }
    return data;
  } catch (error) {
    captureAnalyticsEvent("generation_failed", buildAppGenerationAnalyticsProperties({
      trace_id: traceId,
      session_id: pending.sessionId,
      action: "generate_failed",
      stage: "request",
      status: "failed",
      failure_kind: "request_failed",
      error_message: error instanceof Error ? error.message : String(error)
    }));
    trackClientEvent("socialmedia.create.request.failed", {
      traceId,
      appSessionId: pending.sessionId,
      action: "request",
      stage: "request",
      status: "failed",
      level: "error",
      durationMs: Date.now() - requestStartedAt,
      requestSummary,
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

function isAppComposerInsufficientCreditsError(error: unknown): boolean {
  return error instanceof AppComposerSubmitError && error.code === "INSUFFICIENT_CREDITS";
}

function isRetryablePreJobSubmitError(
  error: unknown,
  pending: Pick<AppPendingThreadSubmit, "sourceUseCase">
): boolean {
  return error instanceof AppComposerSubmitError
    && !isVideoGenerationSourceUseCase(pending.sourceUseCase)
    && shouldRetainPreJobServerFailureForRetry(error.code);
}

function shouldReconcilePendingThreadSubmitError(
  error: unknown,
  pending: Pick<AppPendingThreadSubmit, "sourceUseCase">
): boolean {
  if (error instanceof AppComposerSubmitError) {
    return !isVideoGenerationSourceUseCase(pending.sourceUseCase)
      && shouldReconcilePreJobServerFailure(error.code);
  }
  return isRecoverableThreadSubmitError(error);
}

async function submitPendingThreadSubmitAttempt(
  pending: AppPendingThreadSubmit,
  options?: {
    onAssistantContent?: (content: string) => void;
    onClarification?: (result: AppComposerSubmitResponse) => void;
    onGenerationIntent?: (
      intent: Extract<ChatStreamIntent, "generate" | "revise">,
      outputKind?: "image" | "video"
    ) => void;
  }
): Promise<AppComposerSubmitResponse> {
  return submitPendingThreadSubmit(pending, {
    signal: AbortSignal.timeout(THREAD_SUBMIT_REQUEST_TIMEOUT_MS),
    onAssistantContent: options?.onAssistantContent,
    onClarification: options?.onClarification,
    onGenerationIntent: options?.onGenerationIntent
  });
}

function startPendingThreadSubmit(
  pending: AppPendingThreadSubmit,
  options?: {
    onAssistantContent?: (content: string) => void;
    onClarification?: (result: AppComposerSubmitResponse) => void;
    onGenerationIntent?: (
      intent: Extract<ChatStreamIntent, "generate" | "revise">,
      outputKind?: "image" | "video"
    ) => void;
  }
): Promise<AppComposerSubmitResponse> {
  const requestKey = pending.idempotencyKey;
  const existingRequest = pendingThreadSubmitRequests.get(requestKey);
  if (existingRequest) return existingRequest;
  const request: Promise<AppComposerSubmitResponse> = (async () => {
    let lastError: unknown;
    const firstAttemptNumber = pending.attemptCount + 1;

    for (let retryIndex = 0; retryIndex <= APP_PENDING_THREAD_SUBMIT_AUTO_RETRIES; retryIndex += 1) {
      const attemptPending = updatePendingThreadSubmit(pending, {
        status: "submitting",
        submittedAt: new Date().toISOString(),
        failedAt: undefined,
        lastError: undefined,
        lastErrorCode: undefined,
        attemptCount: firstAttemptNumber + retryIndex
      }) ?? {
        ...pending,
        status: "submitting" as const,
        submittedAt: new Date().toISOString(),
        failedAt: undefined,
        lastError: undefined,
        lastErrorCode: undefined,
        attemptCount: firstAttemptNumber + retryIndex
      };

      try {
        const data = await submitPendingThreadSubmitAttempt(attemptPending, options);
        removePendingThreadSubmit(attemptPending);
        return data;
      } catch (error) {
        lastError = error;
        if (isAppComposerInsufficientCreditsError(error)
          || (pending.sourceUseCase === "general" && error instanceof AppComposerSubmitError && error.code === "VIDEO_SIGNUP_REQUIRED")) break;
      }
    }

    updatePendingThreadSubmit(pending, {
      status: "failed",
      failedAt: new Date().toISOString(),
      lastError: lastError instanceof Error ? lastError.message : "Failed to start generation.",
      lastErrorCode: lastError instanceof AppComposerSubmitError ? lastError.code : undefined,
      resumeAfterAuth: lastError instanceof AppComposerSubmitError && lastError.code === "VIDEO_SIGNUP_REQUIRED"
    });
    throw lastError instanceof Error ? lastError : new Error("Failed to start generation.");
  })().finally(() => {
    if (pendingThreadSubmitRequests.get(requestKey) === request) {
      pendingThreadSubmitRequests.delete(requestKey);
    }
  });
  pendingThreadSubmitRequests.set(requestKey, request);
  return request;
}

function normalizeAppThreadToolSlug(sourceUseCase?: string): string {
  const normalized = sourceUseCase?.trim().toLowerCase();
  if (!normalized) return DEFAULT_APP_TOOL_SLUG;
  return SOURCE_USE_CASE_APP_TOOL_SLUG_MAP[normalized] ?? normalized;
}

function resolveAppThreadToolSlug(sourceUseCase?: string): string {
  const normalized = normalizeAppThreadToolSlug(sourceUseCase);
  if (findAppTool(normalized)) return normalized;
  return DEFAULT_APP_TOOL_SLUG;
}

function prefersPublicToolRoutes(): boolean {
  return true;
}

function buildAppThreadNewTaskHref(toolSlug: string, preferPublicToolRoutes = prefersPublicToolRoutes()): string {
  // Every new task in this standalone site starts in its Hotel Lobby studio.
  return "/";
}

function normalizeAppThreadWorkbenchHref(href: string, preferPublicToolRoutes = prefersPublicToolRoutes()): string | null {
  const pathname = href.split("?")[0] ?? "";
  const tool = findAppToolByPathname(pathname);
  if (!tool) return null;
  const suffix = href.includes("?") ? `?${href.split("?").slice(1).join("?")}` : "";
  return `${buildAppThreadNewTaskHref(tool.slug, preferPublicToolRoutes)}${suffix}`;
}

function resolveAppThreadNewTaskHref(sourceUseCase?: string, preferPublicToolRoutes = prefersPublicToolRoutes()): string {
  if (sourceUseCase === "general") return "/app";
  const toolSlug = resolveAppThreadToolSlug(sourceUseCase);
  return buildAppThreadNewTaskHref(toolSlug, preferPublicToolRoutes);
}

function readAppThreadFallbackWorkbenchHref(preferPublicToolRoutes = prefersPublicToolRoutes()): string {
  const defaultHref = resolveAppThreadNewTaskHref(DEFAULT_APP_TOOL_SLUG, preferPublicToolRoutes);
  if (typeof window === "undefined") return defaultHref;
  try {
    const storedHref = window.localStorage.getItem(APP_LAST_CREATE_HREF_STORAGE_KEY)?.trim();
    if (!storedHref || storedHref.startsWith("/app/chat/")) return defaultHref;
    return normalizeAppThreadWorkbenchHref(storedHref, preferPublicToolRoutes) ?? defaultHref;
  } catch {
    // Fall back to the default image maker workspace when storage is unavailable.
  }
  return defaultHref;
}

function readThreadString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function readThreadNumber(record: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function readThreadAccessVariant(record: Record<string, unknown>): AppThreadMediaItem["accessVariant"] {
  const value = readThreadString(record, "accessVariant", "access_variant");
  return value === "original" || value === "watermarked" ? value : undefined;
}

function readThreadPreviewVariant(record: Record<string, unknown>): AppThreadMediaItem["previewVariant"] {
  const value = readThreadString(record, "previewVariant", "preview_variant");
  return value === "watermarked" || value === "masked_blur" || value === "low_res_clean" ? value : undefined;
}

function getThreadJobSourceUseCase(session?: AppThreadSession | null): string | undefined {
  return (
    session?.source_use_case
    ?? session?.jobs?.find((job) => job.source_use_case)?.source_use_case
  );
}

function getThreadJobSummary(job: AppThreadJob): string {
  const conversationReply = job.conversation_reply?.trim();
  if (conversationReply) return conversationReply;
  const socialmedia = job.result?.socialmedia;
  const summary = socialmedia?.briefSummary ?? socialmedia?.brief_summary ?? "";
  return /^Recovered \d+ generated image(?:s)? from persisted assets\.$/i.test(summary.trim())
    ? ""
    : summary;
}

function getThreadCompletionMessage(job: AppThreadJob): string {
  if (!isThreadVideoJob(job)) {
    return buildImageGenerationCompletionReply({
      inputText: job.input_text,
      language: job.result?.socialmedia?.language,
      sourceUseCase: job.source_use_case,
      outputType: job.output_type
    });
  }
  const media = getThreadJobMedia(job);
  const noun = media.length > 1 ? "videos" : "video";
  const responseLanguage = job.result?.socialmedia?.language ?? resolveAppResponseLanguage(job.input_text);
  if (isChineseSocialmediaResponseLanguage(responseLanguage)) {
    return media.length > 1
      ? `已经根据你的需求生成 ${media.length} 个视频。你可以继续编辑、下载，或描述新的生成需求。`
      : "已经根据你的需求生成视频。你可以继续编辑、下载，或描述新的生成需求。";
  }
  return `I've generated the ${noun} based on your request. You can keep editing it, download it, or describe something new to generate.`;
}

function getThreadJobUserSourceAssets(job: AppThreadJob): AppThreadSourceAsset[] {
  const socialmedia = job.socialmedia;
  const hasExplicitUserSourceAssets =
    Array.isArray(socialmedia?.userSourceAssets)
    || Array.isArray(socialmedia?.user_source_assets);
  const assets = hasExplicitUserSourceAssets
    ? [
        ...(socialmedia?.userSourceAssets ?? []),
        ...(socialmedia?.user_source_assets ?? [])
      ]
    : job.is_mock
    ? [
        ...(socialmedia?.sourceAssets ?? []),
        ...(socialmedia?.source_assets ?? [])
      ]
    : [];
  const seen = new Set<string>();
  return assets.filter((asset) => {
    const url = asset.url?.trim();
    if (!url) return false;
    const key = asset.assetId || asset.asset_id || url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toAppComposerContinuationSourceAsset(asset: AppThreadSourceAsset): AppComposerSourceAsset | null {
  const assetId = asset.assetId ?? asset.asset_id;
  if (!assetId) return null;
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
    original_name: asset.originalName ?? asset.original_name,
    roomDesignRole: asset.roomDesignRole ?? asset.room_design_role,
    room_design_role: asset.room_design_role ?? asset.roomDesignRole
  };
}

function getThreadJobMedia(job: AppThreadJob): AppThreadMediaItem[] {
  const socialmedia = job.result?.socialmedia;
  const images = Array.isArray(socialmedia?.images) ? socialmedia.images : [];
  const videos = Array.isArray(socialmedia?.videos) ? socialmedia.videos : [];
  const imageItems = images
    .map((item, fallbackIndex): AppThreadMediaItem | null => {
      const url = readThreadString(item, "url");
      if (!url) return null;
      return {
        url,
        kind: "image" as const,
        index: readThreadNumber(item, "imageIndex", "image_index") ?? fallbackIndex,
        assetId: readThreadString(item, "assetId", "asset_id"),
        accessVariant: readThreadAccessVariant(item),
        previewVariant: readThreadPreviewVariant(item),
        fileName: readThreadString(item, "fileName", "file_name", "originalName", "original_name"),
        promptSummary: readThreadString(item, "promptSummary", "prompt_summary"),
        width: readThreadNumber(item, "width"),
        height: readThreadNumber(item, "height"),
        originalSizeBytes: readThreadNumber(item, "originalSizeBytes", "original_size_bytes")
      };
    })
    .filter((item): item is AppThreadMediaItem => Boolean(item));
  const seenImageIndexes = new Set<number>();
  const uniqueImageItems = imageItems.filter((item) => {
    if (seenImageIndexes.has(item.index)) return false;
    seenImageIndexes.add(item.index);
    return true;
  });
  const videoItems = videos
    .map((item, fallbackIndex): AppThreadMediaItem | null => {
      const url = readThreadString(item, "url");
      if (!url) return null;
      return {
        url,
        thumbnailUrl: readThreadString(item, "thumbnailUrl", "thumbnail_url"),
        firstFrameUrl: readThreadString(item, "firstFrameUrl", "first_frame_url"),
        kind: "video" as const,
        index: readThreadNumber(item, "videoIndex", "video_index") ?? fallbackIndex,
        assetId: readThreadString(item, "assetId", "asset_id"),
        accessVariant: readThreadAccessVariant(item),
        fileName: readThreadString(item, "fileName", "file_name", "originalName", "original_name"),
        promptSummary: readThreadString(item, "promptSummary", "prompt_summary"),
        width: readThreadNumber(item, "width"),
        height: readThreadNumber(item, "height")
      };
    })
    .filter((item): item is AppThreadMediaItem => Boolean(item));
  return [...uniqueImageItems, ...videoItems].sort((left, right) => left.index - right.index);
}

function sortThreadJobs(jobs: AppThreadJob[]): AppThreadJob[] {
  return [...jobs].sort((left, right) => {
    const leftTime = Date.parse(left.created_at ?? left.updated_at ?? "");
    const rightTime = Date.parse(right.created_at ?? right.updated_at ?? "");
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return left.job_id.localeCompare(right.job_id);
  });
}

function preserveConfirmedThreadGenerationIntent(nextJob: AppThreadJob, previousJob?: AppThreadJob): AppThreadJob {
  if (!previousJob?.generation_intent_confirmed || !isThreadJobActive(nextJob)
    || !isThreadJobActive(previousJob) || nextJob.local_pending_status === "recovering") return nextJob;
  return {
    ...nextJob,
    generation_intent_confirmed: true,
    ...(nextJob.is_mock ? {
      output_type: previousJob.output_type ?? nextJob.output_type,
      mock_ui: "generating" as const,
      stage: "preparing",
      generation_progress_reply: nextJob.generation_progress_reply ?? previousJob.generation_progress_reply
    } : {})
  };
}

function mergeThreadJob(jobs: AppThreadJob[], nextJob: AppThreadJob): AppThreadJob[] {
  const index = jobs.findIndex((job) => job.job_id === nextJob.job_id);
  if (index < 0) return sortThreadJobs([...jobs, nextJob]);
  const cloned = [...jobs];
  cloned[index] = preserveConfirmedThreadGenerationIntent({
    ...cloned[index],
    ...nextJob
  }, cloned[index]);
  return sortThreadJobs(cloned);
}

function isThreadJobActive(job: AppThreadJob): boolean {
  return job.status === "queued" || job.status === "running";
}

function isThreadPaidAccount(account: AppAccountSummary): boolean {
  return account.isLoggedIn && (account.plan === "basic" || account.plan === "pro" || account.plan === "max");
}

function shouldGateThreadMediaDownload(media: AppThreadMediaItem): boolean {
  if (!media.url) return false;
  return media.accessVariant !== "original";
}

function getExportResponseFileName(response: Response, fallback: string): string {
  const disposition = response.headers.get("content-disposition") ?? "";
  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch) {
    try {
      return decodeURIComponent(encodedMatch[1].replace(/^"|"$/g, ""));
    } catch {
      // Fall through to the regular filename or fallback.
    }
  }
  const regularMatch = disposition.match(/filename="?([^";]+)"?/i);
  return regularMatch?.[1]?.trim() || fallback;
}

async function requestThreadImageExport(
  jobId: string,
  images: AppThreadMediaItem[],
  format: ImageExportFormat
): Promise<number> {
  const response = await fetch(`/api/v1/jobs/${encodeURIComponent(jobId)}/images/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      format,
      asset_ids: images.map((item) => item.assetId).filter((assetId): assetId is string => Boolean(assetId)),
      image_indexes: images.map((item) => item.index)
    })
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || "Unable to export this result.");
  }

  const blob = await response.blob();
  const extension = format === "jpeg" ? "jpg" : format;
  const fallback = `vismuse-${jobId.slice(0, 8) || "export"}.${extension}`;
  downloadThreadBlob(blob, getExportResponseFileName(response, fallback));
  return blob.size;
}

async function saveThreadImagesAsFormat(
  jobId: string,
  media: AppThreadMediaItem[],
  format: ImageExportFormat
): Promise<number> {
  const images = media.filter((item) => item.kind === "image");
  if (!images.length) throw new Error("No images are available to export.");
  if (format === "pdf") return requestThreadImageExport(jobId, images, format);

  let totalBytes = 0;
  for (const image of images) {
    totalBytes += await requestThreadImageExport(jobId, [image], format);
    await new Promise((resolve) => window.setTimeout(resolve, 120));
  }
  return totalBytes;
}

function openThreadGuestCreditSignupModal() {
  openThreadAuthModal({ promptCase: "guest_depleted_signup_bonus" });
}

const THREAD_FREE_GENERATION_CREDIT_COST = 10;

const THREAD_VIDEO_REQUIRED_CREDITS = 200;

const THREAD_GENERATION_SERVICE_ISSUE_MESSAGE = "We ran into a service issue. Please try again.";

const THREAD_GENERATION_SERVICE_BUSY_MESSAGE = "The generation service is busy. Please try again in a moment.";

const THREAD_GENERATION_NETWORK_ISSUE_MESSAGE = "The request could not reach the generation service. Please try again in a moment.";

const THREAD_VIDEO_GENERATION_SAFETY_BLOCKED_MESSAGE = "The system detected sensitive information, so the video generation failed. Please adjust your prompt or input assets and try again.";

const THREAD_VIDEO_GENERATION_POLICY_BLOCKED_MESSAGE = "We couldn't generate this video because the result may violate safety or copyright policies. Please remove protected references or assets, then try again.";

const THREAD_VIDEO_GENERATION_REAL_PERSON_BLOCKED_MESSAGE = "Generation failed. The system detected a safety issue and declined the request.";

const THREAD_PENDING_SIGNUP_IMAGE_UNLOCK_KEY = "vismuse:socialmedia-pending-signup-image-unlock";

const APP_GUEST_CLAIM_CHECKOUT_READY_KEY = "vismuse.app.guestClaimCheckoutReady";

const APP_SESSION_TRANSIENT_404_RETRY_DELAY_MS = 650;

const APP_GUEST_CLAIM_STARTED_EVENT = "vismuse:app-guest-claim-started";

const APP_GUEST_CLAIM_COMPLETED_EVENT = "vismuse:app-guest-claim-completed";

const APP_GUEST_CLAIM_ENDED_EVENT = "vismuse:app-guest-claim-ended";

type AppPendingCheckoutAfterAuth = {
  packageId?: RechargePackageId;
  kind: AppCheckoutKind;
  assetId?: string;
  jobId?: string;
  sessionId?: string;
  guestId?: string;
  createdAt: string;
};

type AppGuestClaimCheckoutReady = {
  guestId?: string;
  createdAt?: string;
};

function isFreshAppCheckoutTimestamp(createdAt?: string): boolean {
  const createdMs = Date.parse(createdAt ?? "");
  return !Number.isFinite(createdMs) || Date.now() - createdMs <= 60 * 60 * 1000;
}

function writeAppPendingCheckoutAfterAuth(context: Omit<AppPendingCheckoutAfterAuth, "createdAt">): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(APP_PENDING_CHECKOUT_AFTER_AUTH_KEY, JSON.stringify({
      ...context,
      createdAt: new Date().toISOString()
    }));
  } catch {
    // The user can still retry checkout manually after sign-in.
  }
}

function readAppPendingCheckoutAfterAuth(): AppPendingCheckoutAfterAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(APP_PENDING_CHECKOUT_AFTER_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppPendingCheckoutAfterAuth>;
    if (!parsed.kind || !isFreshAppCheckoutTimestamp(parsed.createdAt)) {
      window.sessionStorage.removeItem(APP_PENDING_CHECKOUT_AFTER_AUTH_KEY);
      return null;
    }
    return {
      kind: parsed.kind === "image_unlock"
        ? "image_unlock"
        : parsed.kind === "video_unlock"
          ? "video_unlock"
          : "subscription",
      packageId: parsed.packageId,
      assetId: parsed.assetId?.trim() || undefined,
      jobId: parsed.jobId?.trim() || undefined,
      sessionId: parsed.sessionId?.trim() || undefined,
      guestId: parsed.guestId?.trim() || undefined,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString()
    };
  } catch {
    return null;
  }
}

function readAppGuestClaimCheckoutReadyGuestId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(APP_GUEST_CLAIM_CHECKOUT_READY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppGuestClaimCheckoutReady;
    if (!isFreshAppCheckoutTimestamp(parsed.createdAt)) {
      window.sessionStorage.removeItem(APP_GUEST_CLAIM_CHECKOUT_READY_KEY);
      return null;
    }
    return parsed.guestId?.trim() || null;
  } catch {
    return null;
  }
}

function clearAppGuestClaimCheckoutReady(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(APP_GUEST_CLAIM_CHECKOUT_READY_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

type ThreadPendingSignupImageUnlock = {
  assetId: string;
  jobId?: string;
  sessionId?: string;
  guestId?: string;
  createdAt: string;
};

type ThreadPendingImageUnlockCheckout = {
  assetId: string;
  jobId?: string;
  trigger: string;
  returnPath: string;
  billingSurface: "result" | "error";
  guestId?: string;
  createdAt: string;
};

function isThreadVideoJob(job: Pick<AppThreadJob, "output_type" | "source_use_case">): boolean {
  return job.output_type === "video" || isVideoGenerationSourceUseCase(job.source_use_case);
}

function isThreadRawProviderErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return isInternalGenerationError(message)
    || normalized.includes("apimart")
    || normalized.includes("video generation failed")
    || normalized.includes("image generation failed")
    || normalized.includes("api key")
    || normalized.includes("does not have access to model")
    || normalized.includes("grok-imagine")
    || normalized.includes("doubao-seedance")
    || normalized.includes("\"error\"")
    || normalized.includes("{\"")
    || normalized.includes("403")
    || normalized.includes("429")
    || /\b5\d{2}\b/.test(message);
}

function normalizeThreadUserFacingMessage(value?: string | null): string {
  return String(value ?? "")
    // Failed jobs created before the recovery reply normalization can contain
    // escaped newlines. Decode them here so the existing Markdown renderer can
    // display paragraphs and lists as intended.
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n|\\r/g, "\n")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getThreadUserFacingErrorMessage(
  value?: string | null,
  code?: string | null,
  options?: { isVideo?: boolean }
): string {
  const message = normalizeThreadUserFacingMessage(value);
  if (code === "VIDEO_SIGNUP_REQUIRED") return toUserFacingGenerationError(message, { code });
  if (!message) return "This generation could not be completed.";

  const normalized = message.toLowerCase();
  const isVideo = Boolean(options?.isVideo);
  if (code === GENERATION_SAFETY_BLOCKED_CODE && !isVideo) {
    return isThreadRawProviderErrorMessage(message)
      ? THREAD_GENERATION_SERVICE_ISSUE_MESSAGE
      : toUserFacingGenerationError(message, { isVideo, code });
  }
  if (normalized.includes("guest_account_already_claimed")) {
    return "This guest workspace is already linked to an existing account. Please sign in to continue.";
  }
  if (isThreadCreditPaywallMessage(message, code)) {
    if (isVideo) {
      return normalized.includes("free video generation")
        ? "You’ve used your free video generation."
        : "You’re out of video credits.";
    }
    if (!isVideo && (normalized.includes("insufficient credits") || /you need \d+ more credits/i.test(message))) {
      return "You’re out of image credits.";
    }
    return message.replace(/\s*Create a free account to get 50 free credits and keep creating\./i, "").trim() || message;
  }
  if (code === "RATE_LIMIT_EXCEEDED" || normalized.includes("rate_limit_exceeded") || normalized.includes("no available tokens")) {
    return THREAD_GENERATION_SERVICE_BUSY_MESSAGE;
  }
  if (isRecoverableThreadSubmitError(message)) {
    return isVideo ? THREAD_GENERATION_NETWORK_ISSUE_MESSAGE : "The request could not reach the image service. Please try again in a moment.";
  }
  if (
    normalized.includes("copyright restrictions")
    || normalized.includes("related to copyright")
    || normalized.includes("copyrighted")
    || normalized.includes("intellectual property")
  ) {
    return isVideo ? THREAD_VIDEO_GENERATION_POLICY_BLOCKED_MESSAGE : THREAD_GENERATION_SERVICE_ISSUE_MESSAGE;
  }
  if (
    normalized.includes("privacyinformation")
    || normalized.includes("input image may contain real person")
    || normalized.includes("input image") && normalized.includes("real person")
  ) {
    return isVideo ? THREAD_VIDEO_GENERATION_REAL_PERSON_BLOCKED_MESSAGE : THREAD_GENERATION_SERVICE_ISSUE_MESSAGE;
  }
  if (
    normalized.includes("sensitive information")
    || normalized.includes("moderation_blocked")
    || normalized.includes("provider_moderation_error")
    || normalized.includes("safety_violations")
    || normalized.includes("rejected by the safety system")
  ) {
    return isVideo ? THREAD_VIDEO_GENERATION_SAFETY_BLOCKED_MESSAGE : THREAD_GENERATION_SERVICE_ISSUE_MESSAGE;
  }
  if (isThreadRawProviderErrorMessage(message)) {
    return THREAD_GENERATION_SERVICE_ISSUE_MESSAGE;
  }

  return toUserFacingGenerationError(message, { isVideo });
}

function getThreadUserFacingSummary(summary?: string, options?: { isVideo?: boolean }): string | undefined {
  // A job's safety code only classifies its error, never its result summary.
  return summary && isThreadRawProviderErrorMessage(summary)
    ? getThreadUserFacingErrorMessage(summary, undefined, options)
    : summary;
}

function shouldUseThreadErrorAlertStyle(params: {
  agentMode: boolean;
  message: string;
}): boolean {
  // Agent safety responses are guidance from the assistant, not an application
  // failure. Keep the existing error treatment only for a generic service issue.
  return !params.agentMode || params.message === THREAD_GENERATION_SERVICE_ISSUE_MESSAGE;
}

function buildThreadImageCreditUpgradePromptCopy(params: {
  plan?: string | null;
  creditBalance?: number;
}): string {
  const balance = typeof params.creditBalance === "number" && Number.isFinite(params.creditBalance)
    ? Math.max(0, Math.floor(params.creditBalance))
    : undefined;
  const minimumCredits = THREAD_FREE_GENERATION_CREDIT_COST;
  const upgradeCopy = params.plan === "free"
    ? freeCreditLimitUpgradeCta.minimumCreditCopy
    : "Upgrade for more room to create batches, revisions, and finished images.";

  if (typeof balance === "number" && balance < minimumCredits) {
    return upgradeCopy;
  }

  return params.plan === "free"
    ? freeCreditLimitUpgradeCta.depletedCopy
    : "You've used the available credits on your current plan. Upgrade for more room to create batches, revisions, and finished images.";
}

function formatThreadCreditBalance(value: number): string {
  const credits = Math.max(0, Math.floor(value));
  return `${credits.toLocaleString()} ${credits === 1 ? "credit" : "credits"}`;
}

function buildThreadVideoCreditUpgradePromptCopy(params: {
  message?: string | null;
  creditBalance?: number;
}): string {
  const normalized = params.message?.toLowerCase() ?? "";
  if (normalized.includes("free video generation") || normalized.includes("subscribe to keep generating videos")) {
    return "Get more video credits to continue generating and refining videos.";
  }

  const balance = typeof params.creditBalance === "number" && Number.isFinite(params.creditBalance)
    ? Math.max(0, Math.floor(params.creditBalance))
    : undefined;
  const message = params.message ?? "";
  const explicitRequiredMatch = message.match(/(?:this video needs|current generation needs|requires)\s+([\d,]+)\s+credits/i);
  const explicitRequiredCredits = explicitRequiredMatch?.[1]
    ? Number.parseInt(explicitRequiredMatch[1].replace(/,/g, ""), 10)
    : undefined;
  const shortfallMatch = message.match(/you need\s+([\d,]+)\s+more credits/i);
  const shortfall = shortfallMatch?.[1] ? Number.parseInt(shortfallMatch[1].replace(/,/g, ""), 10) : undefined;
  const inferredRequiredCredits = typeof balance === "number" && typeof shortfall === "number" && Number.isFinite(shortfall)
    ? balance + shortfall
    : undefined;
  const requiredCredits = typeof explicitRequiredCredits === "number" && Number.isFinite(explicitRequiredCredits)
    ? explicitRequiredCredits
    : inferredRequiredCredits ?? THREAD_VIDEO_REQUIRED_CREDITS;

  if (typeof balance === "number" && typeof requiredCredits === "number") {
    return `You have ${formatThreadCreditBalance(balance)} left. This video needs ${formatThreadCreditBalance(requiredCredits)} to generate. Subscribe to keep generating videos.`;
  }
  if (typeof balance === "number") {
    return `You have ${formatThreadCreditBalance(balance)} left. Subscribe to keep generating videos.`;
  }
  return "Subscribe to keep generating videos.";
}

function getThreadFreeImageUpgradeCta(image: SocialmediaGeneratedImage) {
  if (isLowResCleanPreviewImage(image)) return freeGeneratedLowResImageUpgradeCta;
  if (image.previewVariant === "masked_blur") return freeGeneratedBlurredImageUpgradeCta;
  return freeGeneratedWatermarkedImageUpgradeCta;
}

function getThreadImageUpgradeCta(account: AppAccountSummary, image: SocialmediaGeneratedImage) {
  if (account.plan === "basic") {
    return {
      inlineTitle: "Upgrade to Pro",
      inlineCopy: "Your subscription credits are exhausted. Get more credits to keep creating and download this image without a watermark.",
      inlinePrimaryAction: "Upgrade to Pro",
      previewTitle: "Upgrade to Pro",
      previewCopy: "Your subscription credits are exhausted. Get more credits and download this image without a watermark.",
      previewPrimaryAction: "Upgrade to Pro"
    };
  }

  if (account.plan === "pro") {
    return {
      inlineTitle: "Upgrade to Max",
      inlineCopy: "Your subscription credits are exhausted. Get more credits to keep creating and download this image without a watermark.",
      inlinePrimaryAction: "Upgrade to Max",
      previewTitle: "Upgrade to Max",
      previewCopy: "Your subscription credits are exhausted. Get more credits and download this image without a watermark.",
      previewPrimaryAction: "Upgrade to Max"
    };
  }

  if (account.plan === "max") {
    return {
      inlineTitle: "Get more credits",
      inlineCopy: "Your subscription credits are exhausted. Get more credits to keep creating and download this image without a watermark.",
      inlinePrimaryAction: "Get more credits",
      previewTitle: "Get more credits",
      previewCopy: "Your subscription credits are exhausted. Get more credits and download this image without a watermark.",
      previewPrimaryAction: "Get more credits"
    };
  }

  return getThreadFreeImageUpgradeCta(image);
}

function toSocialmediaGeneratedImage(media: AppThreadMediaItem): SocialmediaGeneratedImage | null {
  if (media.kind !== "image" || !media.url) return null;
  return {
    assetId: media.assetId ?? "",
    imageIndex: media.index,
    url: media.url,
    accessVariant: media.accessVariant,
    previewVariant: media.previewVariant,
    width: media.width,
    height: media.height,
    originalSizeBytes: media.originalSizeBytes,
    promptSummary: media.promptSummary,
    previewFileName: media.fileName
  };
}

function getThreadJobImages(job: AppThreadJob): SocialmediaGeneratedImage[] {
  return getThreadJobMedia(job)
    .map(toSocialmediaGeneratedImage)
    .filter((image): image is SocialmediaGeneratedImage => Boolean(image));
}

function writeThreadPendingSignupImageUnlock(context: ThreadPendingSignupImageUnlock): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(THREAD_PENDING_IMAGE_UNLOCK_CHECKOUT_KEY);
    window.sessionStorage.setItem(THREAD_PENDING_SIGNUP_IMAGE_UNLOCK_KEY, JSON.stringify(context));
  } catch {
    // Ignore storage failures; the user can still retry from the result.
  }
}

function readThreadPendingSignupImageUnlock(): ThreadPendingSignupImageUnlock | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(THREAD_PENDING_SIGNUP_IMAGE_UNLOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ThreadPendingSignupImageUnlock>;
    if (typeof parsed.assetId !== "string" || !parsed.assetId.trim()) return null;
    const createdMs = Date.parse(parsed.createdAt ?? "");
    if (Number.isFinite(createdMs) && Date.now() - createdMs > 30 * 60 * 1000) {
      window.sessionStorage.removeItem(THREAD_PENDING_SIGNUP_IMAGE_UNLOCK_KEY);
      return null;
    }
    return {
      assetId: parsed.assetId.trim(),
      jobId: typeof parsed.jobId === "string" && parsed.jobId.trim() ? parsed.jobId.trim() : undefined,
      sessionId: typeof parsed.sessionId === "string" && parsed.sessionId.trim() ? parsed.sessionId.trim() : undefined,
      guestId: typeof parsed.guestId === "string" && parsed.guestId.trim() ? parsed.guestId.trim() : undefined,
      createdAt: typeof parsed.createdAt === "string" && parsed.createdAt.trim() ? parsed.createdAt : new Date().toISOString()
    };
  } catch {
    return null;
  }
}

function clearThreadPendingSignupImageUnlock(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(THREAD_PENDING_SIGNUP_IMAGE_UNLOCK_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function writeThreadPendingImageUnlockCheckout(context: ThreadPendingImageUnlockCheckout): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(THREAD_PENDING_IMAGE_UNLOCK_CHECKOUT_KEY, JSON.stringify(context));
  } catch {
    // Ignore storage failures; the user can retry checkout after sign-in.
  }
}

async function claimThreadGuestAccountForSignedInUser(
  guestId?: string,
  options?: { unlockAssetId?: string; unlockJobId?: string; requireCookieMatch?: boolean }
): Promise<void> {
  const response = await fetch("/api/v1/account/claim-guest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(guestId?.trim() ? { guest_id: guestId.trim() } : {}),
      ...(options?.unlockAssetId?.trim() ? { unlock_asset_id: options.unlockAssetId.trim() } : {}),
      ...(options?.unlockJobId?.trim() ? { unlock_job_id: options.unlockJobId.trim() } : {}),
      ...(options?.requireCookieMatch ? { require_cookie_match: true } : {})
    })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error || "Failed to link your guest work to this account.");
  }
}

function AppThreadMediaImage({
  item,
  onOpenPreview,
  onOpenLockedPreview
}: {
  item: AppThreadMediaItem;
  onOpenPreview: (thumbnailUrl: string) => void;
  onOpenLockedPreview: () => void;
}) {
  const uiLocale = useUiLocale();
  const [loaded, setLoaded] = useState(false);
  const [useOriginalFallback, setUseOriginalFallback] = useState(false);
  const alt = item.promptSummary || `Generated image ${item.index + 1}`;
  const itemWidth = item.width;
  const itemHeight = item.height;
  const hasDimensions =
    typeof itemWidth === "number" && itemWidth > 0 && typeof itemHeight === "number" && itemHeight > 0;
  const shouldOptimizePreview = item.accessVariant === "original";
  const renderOptimizedPreview = shouldOptimizePreview && !useOriginalFallback;
  const optimizedPreviewWidth = 1024;
  const optimizedPreviewHeight = hasDimensions
    ? Math.max(1, Math.round(optimizedPreviewWidth * (itemHeight / itemWidth)))
    : 1024;
  const previewAspectRatio = hasDimensions ? `${itemWidth} / ${itemHeight}` : "1 / 1";
  const isLockedBlurredPreview = item.previewVariant === "masked_blur" && item.accessVariant !== "original";

  return localizeUiTree((
    <button
      type="button"
      className={styles.threadMediaImageButton}
      onClick={(event) => {
        if (isLockedBlurredPreview) {
          onOpenLockedPreview();
          return;
        }
        const image = event.currentTarget.querySelector("img");
        onOpenPreview(image?.currentSrc || image?.src || item.thumbnailUrl || item.url);
      }}
    >
      <span
        className={`${styles.threadMediaImageFrame} ${
          shouldOptimizePreview ? styles.threadMediaImageFrameOptimized : ""
        } ${loaded ? styles.threadMediaImageFrameLoaded : ""}`}
        style={{ "--thread-media-preview-aspect-ratio": previewAspectRatio } as CSSProperties}
      >
        {!loaded ? <span className={styles.threadMediaImageSkeleton} aria-hidden /> : null}
        {renderOptimizedPreview ? (
          <Image
            src={item.url}
            data-i18n-preserve={item.promptSummary ? "alt" : undefined}
            alt={alt}
            width={optimizedPreviewWidth}
            height={optimizedPreviewHeight}
            sizes={APP_THREAD_IMAGE_PREVIEW_SIZES}
            quality={72}
            onLoad={() => setLoaded(true)}
            onError={() => {
              setUseOriginalFallback(true);
              setLoaded(false);
            }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            data-i18n-preserve={item.promptSummary ? "alt" : undefined}
            alt={alt}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        )}
      </span>
    </button>
  ), uiLocale);
}

function AppThreadMediaGrid({
  media,
  onOpenImagePreview,
  onOpenLockedPreview
}: {
  media: AppThreadMediaItem[];
  onOpenImagePreview: (items: AppThreadMediaItem[], startIndex: number, thumbnailUrl?: string) => void;
  onOpenLockedPreview: (item: AppThreadMediaItem) => void;
}) {
  const uiLocale = useUiLocale();
  if (!media.length) return null;
  const imageMedia = media.filter((item) => item.kind === "image");

  return localizeUiTree((
    <div className={styles.threadMediaGrid}>
      {media.map((item) => {
        const previewIndex = imageMedia.findIndex((candidate) => (
          candidate.index === item.index && candidate.url === item.url
        ));
        return (
          <figure className={styles.threadMediaCard} key={`${item.kind}-${item.index}-${item.url}`}>
            {item.kind === "video" ? (
              <video src={item.url} poster={item.firstFrameUrl ?? item.thumbnailUrl} controls preload="metadata" />
            ) : (
              <AppThreadMediaImage
                item={item}
                onOpenPreview={(thumbnailUrl) => (
                  onOpenImagePreview(imageMedia, Math.max(0, previewIndex), thumbnailUrl)
                )}
                onOpenLockedPreview={() => onOpenLockedPreview(item)}
              />
            )}
          </figure>
        );
      })}
    </div>
  ), uiLocale);
}

function AppThreadUserSourceAssets({
  assets,
  onOpenImagePreview
}: {
  assets: AppThreadSourceAsset[];
  onOpenImagePreview: (assets: AppThreadSourceAsset[], startIndex: number, thumbnailUrl?: string) => void;
}) {
  const uiLocale = useUiLocale();
  if (!assets.length) return null;

  return localizeUiTree((
    <div className={styles.userSourceAssets} aria-label="Uploaded images">
      {assets.map((asset, index) => {
        const url = asset.url?.trim();
        if (!url) return null;
        const name = asset.originalName || asset.original_name || `Uploaded image ${index + 1}`;
        return (
          <button
            className={styles.userSourceAssetPreviewButton}
            type="button"
            aria-label={`Preview ${name}`}
            title={`Preview ${name}`}
            key={asset.assetId || asset.asset_id || url}
            onClick={(event) => {
              const image = event.currentTarget.querySelector("img");
              onOpenImagePreview(assets, index, image?.currentSrc || image?.src || url);
            }}
          >
            <AppFallbackImage
              src={url}
              data-i18n-preserve={asset.originalName || asset.original_name ? "alt" : undefined}
              alt={name}
              width={168}
              height={168}
              sizes="84px"
              quality={65}
              loading="lazy"
            />
          </button>
        );
      })}
    </div>
  ), uiLocale);
}

function AppThreadMockThinking() {
  const uiLocale = useUiLocale();
  return localizeUiTree((
    <div className={styles.threadMockThinking} role="status" aria-live="polite">
      <Bot className={styles.threadThinkingBot} size={18} aria-hidden />
      <span className={styles.threadMockThinkingText}>Thinking</span>
      <span className={styles.threadMockThinkingDots} aria-hidden>
        <i />
        <i />
        <i />
      </span>
    </div>
  ), uiLocale);
}

type AppThreadExecutingStep = {
  key: string;
  label: string;
  title: string;
  statusLabel: string;
  previewLabel: string;
};

const appThreadExecutingSteps: AppThreadExecutingStep[] = [
  {
    key: "understanding",
    label: "Input",
    title: "Understanding request",
    statusLabel: "Reading request",
    previewLabel: "Reading inputs"
  },
  {
    key: "preparing",
    label: "Prompt",
    title: "Building prompt",
    statusLabel: "Building prompt",
    previewLabel: "Building prompt"
  },
  {
    key: "rendering",
    label: "Render",
    title: "Preview building",
    statusLabel: "Rendering preview",
    previewLabel: "Preview forming"
  },
  {
    key: "saving",
    label: "Saving",
    title: "Saving result",
    statusLabel: "Saving result",
    previewLabel: "Finalizing image"
  }
];

const appThreadExecutingProgressByStep = [20, 40, 60, 80] as const;

function getAppThreadExecutingStep(job: AppThreadJob): AppThreadExecutingStep & { index: number } {
  const stage = (job.stage ?? "").trim();
  const progress = Number.isFinite(job.progress) ? Math.max(0, Math.min(100, Number(job.progress))) : 0;
  const isVideoJob = isThreadVideoJob(job);
  const stepIndex = (() => {
    if (stage === "persisting_assets" || stage === "billing_settle" || stage === "finalizing" || progress >= 90) return 3;
    if (
      stage === "apimart_polling" ||
      stage === "apimart_recovery_poll" ||
      stage === "image_provider_generating" ||
      stage === "image_provider_completed" ||
      stage === "vectorengine_generating" ||
      stage === "vectorengine_completed" ||
      stage === "apimart_video_polling" ||
      stage === "apimart_video_keyframe_polling" ||
      stage === "generating_videos" ||
      progress >= 30
    ) {
      return 2;
    }
    if (
      stage === "preparing"
      || stage === "generating_images"
      || stage === "image_generate"
      || stage === "submitting_video"
      || progress >= 12
      || (job.generation_intent_confirmed && isThreadJobActive(job))
    ) return 1;
    return 0;
  })();
  const step = appThreadExecutingSteps[stepIndex];
  if (isVideoJob && step.key === "rendering") {
    return {
      ...step,
      title: "Generating video",
      statusLabel: "Generating video",
      previewLabel: "Video forming",
      index: stepIndex
    };
  }
  if (isVideoJob && step.key === "saving") {
    return {
      ...step,
      title: "Saving video",
      statusLabel: "Saving video",
      previewLabel: "Finalizing video",
      index: stepIndex
    };
  }
  return {
    ...step,
    index: stepIndex
  };
}

function getAppThreadExecutingProgress(job: AppThreadJob, stepIndex: number): number {
  if (job.status === "completed") return 100;
  return appThreadExecutingProgressByStep[stepIndex] ?? appThreadExecutingProgressByStep[0];
}

function useAppThreadImageRenderCountdown(
  job: AppThreadJob,
  serverNow?: string
): ImageRenderCountdown {
  const renderStartedAtMs = resolveImageRenderStartedAtMs(job.socialmedia);
  const [clock, setClock] = useState<{
    jobId: string;
    serverNow?: string;
    serverClockOffsetMs: number;
    startedAtMs: number;
    nowMs: number;
  }>(() => {
    const clientNowMs = Date.now();
    const serverClockOffsetMs = resolveServerClockOffsetMs(serverNow, clientNowMs);
    const nowMs = resolveServerAdjustedNowMs(clientNowMs, serverClockOffsetMs);
    return {
      jobId: job.job_id,
      serverNow,
      serverClockOffsetMs,
      startedAtMs: renderStartedAtMs ?? nowMs,
      nowMs
    };
  });

  useEffect(() => {
    const updateClock = () => {
      const clientNowMs = Date.now();
      setClock((current) => {
        const shouldResyncServerClock = current.serverNow !== serverNow;
        const serverClockOffsetMs = shouldResyncServerClock
          ? resolveServerClockOffsetMs(serverNow, clientNowMs)
          : current.serverClockOffsetMs;
        const nowMs = resolveServerAdjustedNowMs(clientNowMs, serverClockOffsetMs);
        if (current.jobId !== job.job_id) {
          return {
            jobId: job.job_id,
            serverNow,
            serverClockOffsetMs,
            startedAtMs: renderStartedAtMs ?? nowMs,
            nowMs
          };
        }
        const adjustedFallbackStartedAtMs = shouldResyncServerClock
          ? current.startedAtMs + serverClockOffsetMs - current.serverClockOffsetMs
          : current.startedAtMs;
        return {
          ...current,
          serverNow,
          serverClockOffsetMs,
          startedAtMs: renderStartedAtMs ?? adjustedFallbackStartedAtMs,
          nowMs
        };
      });
    };
    const intervalId = window.setInterval(updateClock, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [job.job_id, renderStartedAtMs, serverNow]);

  return resolveImageRenderCountdown(clock.startedAtMs, clock.nowMs, resolveImageRenderDurationMs(job.socialmedia));
}

function AppThreadImageRenderingSkeleton({
  job,
  serverNow,
  step,
  progress
}: {
  job: AppThreadJob;
  serverNow?: string;
  step: AppThreadExecutingStep;
  progress: number;
}) {
  const uiLocale = useUiLocale();
  const renderCountdown = useAppThreadImageRenderCountdown(job, serverNow);

  return localizeUiTree((
    <>
      <AppThreadExecutingSkeleton
        isVideoJob={false}
        progress={progress}
        renderCountdown={renderCountdown}
        step={step}
      />
      <span className={styles.threadExecutingScreenReaderStatus}>
        {renderCountdown.kind === "almost_there"
          ? "Rendering is taking a little longer. Almost there."
          : "Rendering preview."}
      </span>
    </>
  ), uiLocale);
}

function AppThreadExecutingSkeleton({
  isVideoJob,
  progress,
  renderCountdown,
  step
}: {
  isVideoJob: boolean;
  progress: number;
  renderCountdown?: ImageRenderCountdown;
  step: AppThreadExecutingStep;
}) {
  const uiLocale = useUiLocale();
  return localizeUiTree((
    <div className={styles.threadExecutingSkeleton} aria-hidden>
      <div className={styles.threadExecutingCanvas}>
        {isVideoJob ? (
          <span className={styles.threadExecutingEta}>Usually 5–10 min</span>
        ) : (
          <span className={styles.threadExecutingStatusPill}>
            <i />
            {renderCountdown ? (
              <span
                className={`${styles.threadExecutingCountdown} ${renderCountdown.kind === "almost_there" ? styles.threadExecutingCountdownAlmostThere : ""}`}
                suppressHydrationWarning
              >
                {renderCountdown.label}
              </span>
            ) : <span>{step.statusLabel}</span>}
          </span>
        )}
        <span className={styles.threadExecutingAtmosphere} />
        <span className={styles.threadExecutingStructure} />
        <span className={styles.threadExecutingScan} />
        <div className={styles.threadExecutingProgress}>
          <div className={styles.threadExecutingProgressMeta}>
            <span>
              <i />
              {step.previewLabel}...
            </span>
            <span>{progress}%</span>
          </div>
          <div className={styles.threadExecutingProgressTrack}>
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </div>
  ), uiLocale);
}

function AppThreadExecutingPreview({ job, serverNow }: { job: AppThreadJob; serverNow?: string }) {
  const uiLocale = useUiLocale();
  const step = getAppThreadExecutingStep(job);
  const progress = getAppThreadExecutingProgress(job, step.index);
  const isVideoJob = isThreadVideoJob(job);
  return localizeUiTree((
    <div className={styles.threadExecutingPreview} role="status" aria-live="polite">
      <div className={styles.threadExecutingHeader}>
        {isVideoJob ? <i className={styles.threadExecutingHeaderSpinner} aria-hidden /> : null}
        <strong>{step.title}</strong>
        <i className={styles.threadExecutingHeaderDivider} aria-hidden />
        <span>Step {step.index + 1} of {appThreadExecutingSteps.length}</span>
      </div>
      {!isVideoJob && step.key === "rendering" ? (
        <AppThreadImageRenderingSkeleton
          key={job.job_id}
          job={job}
          progress={progress}
          serverNow={serverNow}
          step={step}
        />
      ) : (
        <AppThreadExecutingSkeleton
          isVideoJob={isVideoJob}
          progress={progress}
          step={step}
        />
      )}
    </div>
  ), uiLocale);
}

function AppThreadResultUpgradePrompt({
  account,
  images,
  onOpenWatermarkedSignupModal,
  onOpenSubscriptionModal,
  onOpenUpgradePricingModal
}: {
  account: AppAccountSummary;
  images: SocialmediaGeneratedImage[];
  onOpenWatermarkedSignupModal: (image: SocialmediaGeneratedImage, selectableImages: SocialmediaGeneratedImage[]) => void;
  onOpenSubscriptionModal: (params: {
    plan: SubscriptionSuccessModalPlan;
    image: SocialmediaGeneratedImage;
    trigger: string;
    selectableImages: SocialmediaGeneratedImage[];
  }) => void;
  onOpenUpgradePricingModal: () => void;
}) {
  const uiLocale = useUiLocale();
  const promptImages = images.filter((image) => image.url);
  if (!promptImages.length) return null;
  const gatedImages = promptImages.filter((image) => image.accessVariant !== "original");
  const upgradeImage = gatedImages.find((image) => image.previewVariant !== "masked_blur") ?? gatedImages[0];
  if (!upgradeImage) return null;

  if (!account.isLoggedIn) {
    const lockedPreviewImage = promptImages.find((image) => image.previewVariant === "masked_blur" && image.accessVariant !== "original");
    const watermarkedSignupImages = promptImages.filter(isGuestWatermarkedSignupImage);
    const watermarkedSignupImage = watermarkedSignupImages[0];
    if (!lockedPreviewImage && !watermarkedSignupImage) return null;

    if (watermarkedSignupImage && !lockedPreviewImage) {
      return (
        <AppThreadGuestResultUpgradeCta
          variant="watermarked"
          className={styles.threadResultCta}
          copyClassName={styles.threadResultCtaCopy}
          actionsClassName={styles.threadResultCtaActions}
          onAction={() => {
            onOpenWatermarkedSignupModal(
              watermarkedSignupImage,
              watermarkedSignupImages.length ? watermarkedSignupImages : [watermarkedSignupImage]
            );
          }}
        />
      );
    }

    if (!lockedPreviewImage) return null;

    return (
      <AppThreadGuestResultUpgradeCta
        variant="blurred"
        className={styles.threadResultCta}
        copyClassName={styles.threadResultCtaCopy}
        actionsClassName={styles.threadResultCtaActions}
        onAction={() => onOpenSubscriptionModal({
          plan: "guest",
          image: lockedPreviewImage,
          trigger: "guest_locked_preview_prompt",
          selectableImages: [lockedPreviewImage]
        })}
      />
    );
  }

  const imageUpgradeCta = getThreadImageUpgradeCta(account, upgradeImage);

  return localizeUiTree((
    <div className={styles.threadResultCta}>
      <div className={styles.threadResultCtaCopy}>
        <strong>{imageUpgradeCta.inlineTitle}</strong>
        <p>{imageUpgradeCta.inlineCopy}</p>
      </div>
      <div className={styles.threadResultCtaActions}>
        <button
          type="button"
          onClick={() => {
            if (upgradeImage) {
              onOpenSubscriptionModal({
                plan: "free",
                image: upgradeImage,
                trigger: "quality_upgrade_prompt",
                selectableImages: gatedImages.length ? gatedImages : [upgradeImage]
              });
            } else {
              onOpenUpgradePricingModal();
            }
          }}
        >
          {imageUpgradeCta.inlinePrimaryAction}
        </button>
      </div>
    </div>
  ), uiLocale);
}

function AppThreadConversationWatermarkUpgradeCta({
  account,
  cta,
  jobs,
  onOpenSubscriptionModal,
  onOpenUpgradePricingModal
}: {
  account: AppAccountSummary;
  cta: Extract<AppThreadConversationCta, { kind: "watermark_upgrade" }>;
  jobs: AppThreadJob[];
  onOpenSubscriptionModal: (params: {
    plan: SubscriptionSuccessModalPlan;
    image: SocialmediaGeneratedImage;
    trigger: string;
    selectableImages: SocialmediaGeneratedImage[];
  }) => void;
  onOpenUpgradePricingModal: () => void;
}) {
  const uiLocale = useUiLocale();
  const targetJob = jobs.find((job) => job.job_id === cta.targetJobId);
  const targetImage = targetJob
    ? getThreadJobImages(targetJob).find((image) => image.assetId === cta.targetAssetId)
    : undefined;
  const copy = targetImage
    ? getThreadImageUpgradeCta(account, targetImage)
    : freeGeneratedWatermarkedImageUpgradeCta;

  return localizeUiTree((
    <div className={`${styles.threadResultCta} ${styles.threadConversationResultCta}`}>
      <div className={styles.threadResultCtaCopy}>
        <strong>{copy.inlineTitle}</strong>
        <p>{copy.inlineCopy}</p>
      </div>
      <div className={styles.threadResultCtaActions}>
        {targetImage ? (
          <button
            type="button"
            onClick={() => onOpenSubscriptionModal({
              plan: "free",
              image: targetImage,
              trigger: "agent_watermark_upgrade_request",
              selectableImages: [targetImage]
            })}
          >
            {cta.label || copy.inlinePrimaryAction}
          </button>
        ) : (
          <button type="button" onClick={onOpenUpgradePricingModal}>
            {cta.label || copy.inlinePrimaryAction}
          </button>
        )}
      </div>
    </div>
  ), uiLocale);
}

function AppThreadConversationVideoSubscriptionCta({
  cta,
  onOpenSubscriptionModal
}: {
  cta: Extract<AppThreadConversationCta, { kind: "video_subscription" }>;
  onOpenSubscriptionModal: () => void;
}) {
  const uiLocale = useUiLocale();
  return localizeUiTree((
    <div className={`${styles.threadResultCta} ${styles.threadConversationResultCta}`}>
      <div className={styles.threadResultCtaCopy}>
        <strong>Download without a watermark</strong>
        <p>HD downloads · No watermarks · Video credits</p>
      </div>
      <div className={styles.threadResultCtaActions}>
        <button type="button" onClick={onOpenSubscriptionModal}>
          {cta.label}
        </button>
      </div>
    </div>
  ), uiLocale);
}

function AppThreadVideoResultUpgradePrompt({
  account,
  videos,
  onOpenVideoSubscriptionModal
}: {
  account: AppAccountSummary;
  videos: AppThreadMediaItem[];
  onOpenVideoSubscriptionModal: (video: AppThreadMediaItem) => void;
}) {
  const uiLocale = useUiLocale();
  if (isThreadPaidAccount(account)) return null;
  const upgradeVideo = videos.find((video) => (
    video.kind === "video"
    && video.url
    && video.accessVariant === "watermarked"
  ));
  if (!upgradeVideo) return null;

  return localizeUiTree((
    <div className={styles.threadResultCta}>
      <div className={styles.threadResultCtaCopy}>
        <span>HD video</span>
        <strong>Unlock the clean HD video</strong>
        <p>Remove the watermark from this result, or choose a video plan for more generations.</p>
      </div>
      <div className={styles.threadResultCtaActions}>
        <button type="button" onClick={() => onOpenVideoSubscriptionModal(upgradeVideo)}>
          Unlock video
        </button>
      </div>
    </div>
  ), uiLocale);
}

function AppThreadActionCta({ title, description, actionLabel, onAction }: {
  title?: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const uiLocale = useUiLocale();
  return localizeUiTree((
    <div className={`${styles.threadResultCta} ${styles.threadCreditErrorCta}`}>
      <div key="copy" className={styles.threadResultCtaCopy}>
        {title ? <strong key="title">{title}</strong> : null}
        <p key="description">{description}</p>
      </div>
      <div key="actions" className={styles.threadResultCtaActions}>
        <button type="button" onClick={onAction}>{actionLabel}</button>
      </div>
    </div>
  ), uiLocale);
}

function AppThreadCreditErrorCta({
  account,
  errorMessage,
  isVideoJob,
  onOpenGuestSignupModal,
  onOpenUpgradePricingModal,
  onOpenCreditTopupModal,
  onOpenVideoSubscriptionModal
}: {
  account: AppAccountSummary;
  errorMessage?: string | null;
  isVideoJob: boolean;
  onOpenGuestSignupModal: () => void;
  onOpenUpgradePricingModal: () => void;
  onOpenCreditTopupModal: () => void;
  onOpenVideoSubscriptionModal: () => void;
}) {
  const uiLocale = useUiLocale();
  const isGuest = !account.isLoggedIn;
  const isPaid = canTopUpThreadCredits(account);
  const shouldShowVideoSubscription = !isGuest && !isPaid && isVideoJob;
  const statusCopy = isGuest
    ? guestCreditLimitSignupCta.statusCopy
    : isPaid
      ? "You’re out of credits."
      : shouldShowVideoSubscription
        ? getThreadUserFacingErrorMessage(errorMessage, null, { isVideo: true })
        : freeCreditLimitUpgradeCta.statusCopy;
  return localizeUiTree((
    <div className={styles.threadCreditError}>
      <p>{statusCopy}</p>
      <AppThreadActionCta
        title={isGuest
            ? guestCreditLimitSignupCta.guestTitle
            : isPaid
              ? "Add credits to keep creating"
              : shouldShowVideoSubscription
                ? "Upgrade to keep creating"
                : freeCreditLimitUpgradeCta.title}
        description={isGuest
            ? guestCreditLimitSignupCta.guestCopy
            : isPaid
              ? `Add credits without changing your current plan. Purchased credits are valid for ${account.pricingVariant === "2.4" ? "90 days" : "one year"}.`
              : shouldShowVideoSubscription
                ? buildThreadVideoCreditUpgradePromptCopy({
                    message: errorMessage,
                    creditBalance: account.credits
                  })
                : buildThreadImageCreditUpgradePromptCopy({
                    plan: "free",
                    creditBalance: account.credits
                  })}
        onAction={isGuest
            ? onOpenGuestSignupModal
            : isPaid
              ? onOpenCreditTopupModal
              : shouldShowVideoSubscription
                ? onOpenVideoSubscriptionModal
                : onOpenUpgradePricingModal}
        actionLabel={isGuest
            ? guestCreditLimitSignupCta.guestPrimaryAction
            : isPaid
              ? "Add credits"
              : shouldShowVideoSubscription
                ? freeCreditLimitUpgradeCta.primaryAction
                : freeCreditLimitUpgradeCta.primaryAction}
      />
    </div>
  ), uiLocale);
}

function AppThreadAnimateToVideoDialog({
  draft,
  onClose,
  onSubmit
}: {
  draft: AppImageAnimationDraft;
  onClose: () => void;
  onSubmit: (prompt: string, duration: AppImageVideoDuration, image: SocialmediaGeneratedImage) => Promise<void>;
}) {
  const uiLocale = useUiLocale();
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState<AppImageVideoDuration>(10);
  const [selectedAssetId, setSelectedAssetId] = useState(draft.image.assetId ?? "");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectedImage = draft.selectableImages.find((image) => image.assetId === selectedAssetId)
    ?? draft.image;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    textareaRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isSubmitting, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    localizeUiTree(<div
      className={styles.albumCoverAnimateDialogOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <form
        className={styles.albumCoverAnimateDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="album-cover-animate-dialog-title"
        onSubmit={(event) => {
          event.preventDefault();
          const nextPrompt = prompt.trim();
          if (!nextPrompt || isSubmitting) return;
          setIsSubmitting(true);
          setError("");
          void onSubmit(nextPrompt, duration, selectedImage)
            .catch((submitError) => {
              setError(submitError instanceof Error ? submitError.message : "Unable to start the video task.");
              setIsSubmitting(false);
            });
        }}
      >
        <button
          className={styles.albumCoverAnimateDialogClose}
          type="button"
          aria-label="Close"
          onClick={onClose}
          disabled={isSubmitting}
        >
          <X size={18} aria-hidden />
        </button>
        <div className={styles.albumCoverAnimateDialogHeader}>
          <span className={styles.albumCoverAnimateDialogIcon}>
            <WandSparkles size={18} aria-hidden />
          </span>
          <div>
            <h2 id="album-cover-animate-dialog-title">Animate to Video</h2>
            <p>Describe how you want this image to move.</p>
          </div>
        </div>
        {draft.selectableImages.length > 1 ? (
          <>
            <label className={styles.albumCoverAnimatePromptLabel} htmlFor="image-animation-source">
              Image
            </label>
            <span className={styles.albumCoverAnimateDurationSelectWrap}>
              <select
                id="image-animation-source"
                className={styles.albumCoverAnimateDurationSelect}
                value={selectedImage.assetId}
                onChange={(event) => setSelectedAssetId(event.target.value)}
                disabled={isSubmitting}
              >
                {draft.selectableImages.map((image, index) => (
                  <option key={image.assetId} value={image.assetId}>{`Image ${index + 1}`}</option>
                ))}
              </select>
              <ChevronDown size={16} aria-hidden />
            </span>
          </>
        ) : null}
        <div className={styles.albumCoverAnimatePreview}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selectedImage.url} alt="Image to animate" />
        </div>
        <label className={styles.albumCoverAnimatePromptLabel} htmlFor="album-cover-animation-prompt">
          Motion prompt
        </label>
        <textarea
          id="album-cover-animation-prompt"
          ref={textareaRef}
          rows={4}
          maxLength={SOCIALMEDIA_COMPOSER_MAX_CHARS}
          placeholder={ALBUM_COVER_VIDEO_PROMPT_PLACEHOLDER}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          disabled={isSubmitting}
        />
        <label className={styles.albumCoverAnimatePromptLabel} htmlFor="album-cover-animation-duration">
          Duration
        </label>
        <span className={styles.albumCoverAnimateDurationSelectWrap}>
          <select
            id="album-cover-animation-duration"
            className={styles.albumCoverAnimateDurationSelect}
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value) as AppImageVideoDuration)}
            disabled={isSubmitting}
          >
            <option value={5}>5s</option>
            <option value={10}>10s</option>
            <option value={15}>15s</option>
          </select>
          <ChevronDown size={16} aria-hidden />
        </span>
        {error ? <p className={styles.albumCoverAnimateDialogError} role="alert">{error}</p> : null}
        <div className={styles.albumCoverAnimateDialogActions}>
          <button type="button" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button type="submit" disabled={!prompt.trim() || isSubmitting}>
            {isSubmitting ? <LoaderCircle size={16} className={styles.threadActionSpinner} aria-hidden /> : <Film size={16} aria-hidden />}
            <span>{isSubmitting ? "Starting…" : "Create Video"}</span>
          </button>
        </div>
      </form>
    </div>, uiLocale),
    document.body
  );
}

function AppThreadAssistantMessage({
  account,
  agentMode,
  downloading,
  downloaded,
  job,
  workbenchSourceUseCase,
  serverNow,
  onDownload,
  onOpenImagePreview,
  onOpenGuestSignupModal,
  onOpenUpgradePricingModal,
  onOpenCreditTopupModal,
  onOpenVideoSubscriptionPricingModal,
  onOpenWatermarkedSignupModal,
  onOpenSubscriptionModal,
  onOpenVideoSubscriptionModal,
  onResultMenuOpen,
  onAnimateImage,
  onRetryPendingSubmit
}: {
  account: AppAccountSummary;
  agentMode: boolean;
  downloading: boolean;
  downloaded: boolean;
  job: AppThreadJob;
  workbenchSourceUseCase: string;
  serverNow?: string;
  onDownload: (job: AppThreadJob, media: AppThreadMediaItem[], format?: ImageExportFormat) => void;
  onOpenImagePreview: (
    job: AppThreadJob,
    items: AppThreadMediaItem[],
    startIndex: number,
    thumbnailUrl?: string
  ) => void;
  onOpenGuestSignupModal: () => void;
  onOpenUpgradePricingModal: () => void;
  onOpenCreditTopupModal: () => void;
  onOpenVideoSubscriptionPricingModal: () => void;
  onOpenWatermarkedSignupModal: (image: SocialmediaGeneratedImage, selectableImages: SocialmediaGeneratedImage[]) => void;
  onOpenSubscriptionModal: (params: {
    plan: SubscriptionSuccessModalPlan;
    image: SocialmediaGeneratedImage;
    trigger: string;
    selectableImages: SocialmediaGeneratedImage[];
  }) => void;
  onOpenVideoSubscriptionModal: (media: AppThreadMediaItem, job: AppThreadJob, trigger: string) => void;
  onResultMenuOpen: (job: AppThreadJob, menu: "export" | "animate") => void;
  onAnimateImage: (
    job: AppThreadJob,
    image: SocialmediaGeneratedImage,
    kind: AppImageAnimationKind,
    source: AppImageAnimationSource,
    selectableImages?: SocialmediaGeneratedImage[]
  ) => Promise<void>;
  onRetryPendingSubmit: (job: AppThreadJob) => void;
}) {
  const uiLocale = useUiLocale();
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [animateMenuOpen, setAnimateMenuOpen] = useState(false);
  const [animateError, setAnimateError] = useState("");
  const [selectedAnimateAssetId, setSelectedAnimateAssetId] = useState("");
  const [animateMenuPosition, setAnimateMenuPosition] = useState<ViewportPopoverPosition | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const animateMenuRef = useRef<HTMLDivElement | null>(null);
  const animateMenuPanelRef = useRef<HTMLDivElement | null>(null);
  const media = getThreadJobMedia(job);
  const images = getThreadJobImages(job);
  const isVideoJob = isThreadVideoJob(job);
  const animatableImages = job.status === "completed" && !isVideoJob
    ? images.filter((image) => image.assetId && image.url)
    : [];
  const isAlbumCoverResult = isAlbumCoverAnimateMenuResult({
    workbenchSourceUseCase,
    jobSourceUseCase: job.source_use_case
  });
  const animatableAlbumCovers = isAlbumCoverResult
    ? animatableImages
    : [];
  const animatableAlbumCover = animatableAlbumCovers.find((image) => image.assetId === selectedAnimateAssetId)
    ?? animatableAlbumCovers[0];
  const directAnimateImage = isAlbumCoverResult
    ? undefined
    : animatableImages[0];
  const videos = media.filter((item) => item.kind === "video");
  const summary = getThreadJobSummary(job);
  const warnings = job.result?.socialmedia?.warnings ?? [];
  const generationProgressReply = isThreadJobActive(job) || (agentMode && !isVideoJob && job.status === "completed")
    ? job.generation_progress_reply?.trim() || job.conversation_reply?.trim()
    : undefined;
  // Direct-generation threads render their progress in the generation preview.
  // Assistant prose is reserved for agent-mode threads.
  // A brand-new session does not know agent_mode until the response finishes,
  // so also render result deltas on its local submitting placeholder.
  const streamingReply = agentMode || (job.local_pending_status && job.local_pending_status !== "failed")
    ? generationProgressReply ?? (job.is_mock ? job.conversation_reply?.trim() : undefined)
    : undefined;
  const showMockThinking = job.is_mock && job.mock_ui === "thinking" && !streamingReply;
  // Agent-mode jobs begin as a local pending card. Keep the thinking state until
  // either user-visible reply content or the structured generation intent arrives.
  const showAgentPendingThinking = agentMode
    && Boolean(job.local_pending_status && job.local_pending_status !== "failed")
    && job.mock_ui !== "generating"
    && !generationProgressReply;
  // A confirmed generation intent may reveal the local card before task creation.
  // Polling and render countdown still begin only after the real Job replaces it.
  const showExecutingPreview = isThreadJobActive(job)
    && (!job.is_mock || job.mock_ui === "generating")
    && !showAgentPendingThinking;
  const showCreditErrorCta = job.status === "failed" && isThreadCreditPaywallMessage(job.error, job.error_code);
  const canChooseImageExportFormat = !job.is_mock
    && media.length > 0
    && media.every((item) => item.kind === "image");
  const failedErrorMessage = getThreadUserFacingErrorMessage(job.error, job.error_code, {
    isVideo: isVideoJob
  });
  const signupRequired = job.error_code === "VIDEO_SIGNUP_REQUIRED";
  const showFailureAlertStyle = job.status === "failed" && !signupRequired && !showCreditErrorCta && shouldUseThreadErrorAlertStyle({
    agentMode,
    message: failedErrorMessage
  });
  const displaySummary = getThreadUserFacingSummary(summary, { isVideo: isVideoJob });
  const handleLockedPreviewClick = (item: AppThreadMediaItem) => {
    const image = toSocialmediaGeneratedImage(item);
    if (!image || item.previewVariant !== "masked_blur" || item.accessVariant === "original") return;
    const lockedImages = images.filter((candidate) => (
      candidate.previewVariant === "masked_blur"
      && candidate.accessVariant !== "original"
    ));
    onOpenSubscriptionModal({
      plan: account.isLoggedIn ? "free" : "guest",
      image,
      trigger: "locked_preview_click",
      selectableImages: lockedImages.length ? lockedImages : [image]
    });
  };

  useEffect(() => {
    if (!exportMenuOpen && !animateMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!exportMenuRef.current?.contains(event.target)) {
        setExportMenuOpen(false);
      }
      if (
        !animateMenuRef.current?.contains(event.target)
        && !animateMenuPanelRef.current?.contains(event.target)
      ) setAnimateMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setExportMenuOpen(false);
      setAnimateMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [animateMenuOpen, exportMenuOpen]);

  const updateAnimateMenuPosition = useCallback(() => {
    if (typeof window === "undefined") return;
    const anchor = animateMenuRef.current?.querySelector<HTMLButtonElement>(":scope > button");
    const panel = animateMenuPanelRef.current;
    if (!anchor || !panel) return;

    const anchorRect = anchor.getBoundingClientRect();
    const visualViewport = window.visualViewport;
    setAnimateMenuPosition(resolveViewportPopoverPosition({
      anchor: anchorRect,
      viewport: {
        width: visualViewport?.width ?? window.innerWidth,
        height: visualViewport?.height ?? window.innerHeight,
        offsetTop: visualViewport?.offsetTop ?? 0,
        offsetLeft: visualViewport?.offsetLeft ?? 0
      },
      preferredWidth: window.innerWidth <= 760 ? 252 : 300,
      preferredHeight: panel.scrollHeight,
      gutter: window.innerWidth <= 760 ? 16 : 12,
      gap: 6
    }));
  }, []);

  useLayoutEffect(() => {
    if (!animateMenuOpen) return;

    updateAnimateMenuPosition();
    const handleReposition = () => updateAnimateMenuPosition();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, { capture: true, passive: true });
    window.visualViewport?.addEventListener("resize", handleReposition);
    window.visualViewport?.addEventListener("scroll", handleReposition);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, { capture: true });
      window.visualViewport?.removeEventListener("resize", handleReposition);
      window.visualViewport?.removeEventListener("scroll", handleReposition);
    };
  }, [animateMenuOpen, updateAnimateMenuPosition]);

  return localizeUiTree((
    <article className={`${styles.assistantCard} ${showFailureAlertStyle ? styles.assistantCardError : ""}`}>
      {showMockThinking || showAgentPendingThinking ? (
        <AppThreadMockThinking />
      ) : null}
      {streamingReply ? (
        <div className={`${styles.threadStreamingMarkdown} ${styles.assistantBubble}`} aria-live="polite">
          <ReactMarkdown>{streamingReply}</ReactMarkdown>
        </div>
      ) : null}
      {showExecutingPreview && isVideoJob && !job.is_mock ? (
        <p className={styles.threadVideoWaitHint}>
          You can leave anytime—check the result later in <Link prefetch={false} href="/app/recents">Recents</Link>.
        </p>
      ) : null}
      {showExecutingPreview ? (
        <AppThreadExecutingPreview job={job} serverNow={serverNow} />
      ) : null}
      {showMockThinking || showAgentPendingThinking || streamingReply ? null : job.status === "failed" ? (
        showCreditErrorCta ? (
          <AppThreadCreditErrorCta
            account={account}
            errorMessage={job.error}
            isVideoJob={isVideoJob}
            onOpenGuestSignupModal={onOpenGuestSignupModal}
            onOpenUpgradePricingModal={onOpenUpgradePricingModal}
            onOpenCreditTopupModal={onOpenCreditTopupModal}
            onOpenVideoSubscriptionModal={onOpenVideoSubscriptionPricingModal}
          />
        ) : signupRequired ? (
          <div className={styles.threadCreditError}>
            <AppThreadActionCta
              description={failedErrorMessage}
              actionLabel={account.isLoggedIn ? "Retry" : "Sign in"}
              onAction={() => onRetryPendingSubmit(job)}
            />
          </div>
        ) : (
          <div
            className={`${styles.threadErrorMarkdown} ${showFailureAlertStyle ? styles.assistantErrorBubble : styles.assistantBubble}`}
            role={showFailureAlertStyle ? "alert" : undefined}
          >
            <ReactMarkdown>{failedErrorMessage}</ReactMarkdown>
          </div>
        )
      ) : displaySummary ? (
        <p className={agentMode ? styles.assistantBubble : undefined}>{displaySummary}</p>
      ) : !showExecutingPreview ? (
        <p className={agentMode ? styles.assistantBubble : undefined}>{getThreadCompletionMessage(job)}</p>
      ) : null}
      <AppThreadMediaGrid
        media={media}
        onOpenImagePreview={(items, startIndex, thumbnailUrl) => (
          onOpenImagePreview(job, items, startIndex, thumbnailUrl)
        )}
        onOpenLockedPreview={handleLockedPreviewClick}
      />
      {media.length ? (
        <div className={`${styles.threadActions} ${styles.threadDownloadActions}`}>
          <button
            type="button"
            onClick={() => onDownload(job, media, canChooseImageExportFormat ? "png" : undefined)}
            disabled={downloading || downloaded}
          >
            {downloading ? <LoaderCircle size={15} className={styles.threadActionSpinner} aria-hidden /> : downloaded ? <Check size={15} aria-hidden /> : <Download size={15} aria-hidden />}
            <span>{downloading ? "Processing..." : downloaded ? "Done" : "Download"}</span>
          </button>
          {canChooseImageExportFormat ? (
            <div className={styles.threadExportMenuWrap} ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => {
                  const nextOpen = !exportMenuOpen;
                  setAnimateMenuOpen(false);
                  setExportMenuOpen(nextOpen);
                  if (nextOpen) onResultMenuOpen(job, "export");
                }}
                disabled={downloading || downloaded}
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
              >
                <FileText size={15} aria-hidden />
                <span>Export</span>
                {account.plan === "free" ? <span className={styles.threadExportProBadge}>Pro</span> : null}
                <ChevronDown
                  className={exportMenuOpen ? styles.threadExportChevronOpen : undefined}
                  size={14}
                  aria-hidden
                />
              </button>
              {exportMenuOpen ? (
                <div className={styles.threadExportMenu} role="menu" aria-label="Export other formats">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setExportMenuOpen(false);
                      onDownload(job, media, "jpeg");
                    }}
                  >
                    <span className={`${styles.threadExportMenuIcon} ${styles.threadExportMenuIconJpg}`}>
                      <FileImage size={17} aria-hidden />
                    </span>
                    <span className={styles.threadExportMenuLabel}>JPG image</span>
                    {account.plan === "free" ? <span className={styles.threadExportProBadge}>Pro</span> : null}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setExportMenuOpen(false);
                      onDownload(job, media, "pdf");
                    }}
                  >
                    <span className={`${styles.threadExportMenuIcon} ${styles.threadExportMenuIconPdf}`}>
                      <FileText size={17} aria-hidden />
                    </span>
                    <span className={styles.threadExportMenuLabel}>
                      {media.length > 1 ? `PDF · ${media.length} pages` : "PDF document"}
                    </span>
                    {account.plan === "free" ? <span className={styles.threadExportProBadge}>Pro</span> : null}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {animatableAlbumCover ? (
            <div className={styles.threadExportMenuWrap} ref={animateMenuRef}>
              <button
                type="button"
                onClick={() => {
                  const nextOpen = !animateMenuOpen;
                  setExportMenuOpen(false);
                  setAnimateMenuPosition(null);
                  setAnimateMenuOpen(nextOpen);
                  if (nextOpen) onResultMenuOpen(job, "animate");
                }}
                aria-haspopup="menu"
                aria-expanded={animateMenuOpen}
              >
                <WandSparkles size={15} aria-hidden />
                <span>Animate</span>
                {account.plan === "free" ? <span className={styles.threadExportProBadge}>Pro</span> : null}
                <ChevronDown
                  className={animateMenuOpen ? styles.threadExportChevronOpen : undefined}
                  size={14}
                  aria-hidden
                />
              </button>
              {animateMenuOpen && typeof document !== "undefined" ? createPortal(
                localizeUiTree(<div
                  ref={animateMenuPanelRef}
                  className={`${styles.threadExportMenu} ${styles.threadAnimateMenu}`}
                  role="menu"
                  aria-label="Animate album cover"
                  style={animateMenuPosition
                    ? {
                        left: `${animateMenuPosition.left}px`,
                        top: `${animateMenuPosition.top}px`,
                        width: `${animateMenuPosition.width}px`,
                        maxHeight: `${animateMenuPosition.maxHeight}px`
                      }
                    : { visibility: "hidden" }}
                >
                  {animatableAlbumCovers.length > 1 ? (
                    <label className={styles.threadAnimateImagePicker}>
                      <span>Animate cover</span>
                      <select
                        value={animatableAlbumCover.assetId}
                        onChange={(event) => setSelectedAnimateAssetId(event.target.value)}
                        aria-label="Choose album cover to animate"
                      >
                        {animatableAlbumCovers.map((image, index) => (
                          <option key={image.assetId} value={image.assetId}>
                            {`Cover ${index + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAnimateMenuOpen(false);
                      setAnimateError("");
                      void onAnimateImage(job, animatableAlbumCover, "spotify_canvas", "album_cover")
                        .catch((animationError) => {
                          setAnimateError(animationError instanceof Error ? animationError.message : "Unable to start Spotify Canvas.");
                        });
                    }}
                  >
                    <span className={`${styles.threadExportMenuIcon} ${styles.threadAnimateMenuIconSpotify}`}>
                      <Music2 size={17} aria-hidden />
                    </span>
                    <span className={styles.threadAnimateMenuCopy}>
                      <strong>Spotify Canvas</strong>
                      <small>Tailored 5-second vertical loop</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAnimateMenuOpen(false);
                      setAnimateError("");
                      void onAnimateImage(job, animatableAlbumCover, "video", "album_cover")
                        .catch((animationError) => {
                          setAnimateError(animationError instanceof Error ? animationError.message : "Unable to prepare the video.");
                        });
                    }}
                  >
                    <span className={`${styles.threadExportMenuIcon} ${styles.threadAnimateMenuIconVideo}`}>
                      <Film size={17} aria-hidden />
                    </span>
                    <span className={styles.threadAnimateMenuCopy}>
                      <strong>Animate to Video</strong>
                      <small>Describe custom motion and camera</small>
                    </span>
                  </button>
                </div>, uiLocale),
                document.body
              ) : null}
            </div>
          ) : null}
          {directAnimateImage ? (
            <button
              type="button"
              onClick={() => {
                setExportMenuOpen(false);
                setAnimateError("");
                void onAnimateImage(job, directAnimateImage, "video", "image", animatableImages)
                  .catch((animationError) => {
                    setAnimateError(animationError instanceof Error ? animationError.message : "Unable to prepare the video.");
                  });
              }}
            >
              <WandSparkles size={15} aria-hidden />
              <span>Animate</span>
              {account.plan === "free" ? <span className={styles.threadExportProBadge}>Pro</span> : null}
            </button>
          ) : null}
        </div>
      ) : null}
      {animateError ? <p className={styles.threadActionError} role="alert">{animateError}</p> : null}
      {warnings.length ? (
        <div className={styles.threadWarnings}>
          {warnings.slice(0, 2).map((warning, index) => (
            <span key={`${job.job_id}-warning-${index}`}>{warning.message || "Generation warning"}</span>
          ))}
        </div>
      ) : null}
      <AppThreadResultUpgradePrompt
        account={account}
        images={images}
        onOpenWatermarkedSignupModal={onOpenWatermarkedSignupModal}
        onOpenSubscriptionModal={onOpenSubscriptionModal}
        onOpenUpgradePricingModal={onOpenUpgradePricingModal}
      />
      {isVideoJob ? (
        <AppThreadVideoResultUpgradePrompt
          account={account}
          videos={videos}
          onOpenVideoSubscriptionModal={(video) => onOpenVideoSubscriptionModal(video, job, "watermarked_video_result_cta")}
        />
      ) : null}
      {job.local_pending_status === "failed" && !signupRequired ? (
        <div className={styles.threadActions}>
          <button type="button" onClick={() => onRetryPendingSubmit(job)}>
            <RefreshCw size={15} aria-hidden />
            <span>Retry</span>
          </button>
        </div>
      ) : null}
    </article>
  ), uiLocale);
}

export function AppThread({
  slug,
  sessionId,
  preferPublicToolRoutes
}: {
  slug?: string;
  sessionId: string;
  preferPublicToolRoutes?: boolean;
}) {
  const uiLocale = useUiLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const account = useAppAccountStore((state) => state.account);
  const accountReady = useAppAccountStore((state) => state.isReady);
  const requestedPricingVariant =
    searchParams.get("pricing_variant")
    ?? searchParams.get("variant");
  const [session, setSession] = useState<AppThreadSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionNotFound, setSessionNotFound] = useState(false);
  const [sessionForbiddenRedirect, setSessionForbiddenRedirect] = useState<{ sessionId: string; href: string } | null>(null);
  const sessionRef = useRef<AppThreadSession | null>(null);
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);
  const [downloadedJobId, setDownloadedJobId] = useState<string | null>(null);
  const downloadResetTimeoutRef = useRef<number | null>(null);
  const [unlockingAssetId, setUnlockingAssetId] = useState<string | null>(null);
  const [pricingVariant, setPricingVariant] = useState<PricingVariant>(() => (
    resolveClientPricingExperimentVariant({ requestedVariant: requestedPricingVariant }).variant
  ));
  const assignedPricingVariant = account.pricingVariant
    ? normalizePricingVariant(account.pricingVariant)
    : undefined;
  const pricingVariantOverride = readClientPricingVariantOverride();
  // `accountReady` only means the account request has settled. A failed request
  // deliberately still marks the store ready, so do not render a paid offer from
  // the client-side fallback until the server has supplied its assignment. An
  // explicit build-time override is the intentional exception for QA.
  const pricingAssignmentReady = Boolean(pricingVariantOverride || assignedPricingVariant);
  const [guestSubscriptionPopupExperiment, setGuestSubscriptionPopupExperiment] =
    useState<ClientGuestSubscriptionPopupExperimentAssignment>(() => (
      resolveClientGuestSubscriptionPopupExperimentInitial()
    ));
  const [guestSubscriptionPopupReady, setGuestSubscriptionPopupReady] = useState(false);
  const [upgradePricingModalOpen, setUpgradePricingModalOpen] = useState(false);
  const [upgradePricingModalPresentation, setUpgradePricingModalPresentation] = useState<{
    sourceUseCase: string;
    title: string;
    subtitle: string;
  } | null>(null);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [subscriptionModalPlan, setSubscriptionModalPlan] = useState<SubscriptionSuccessModalPlan>("guest");
  const [subscriptionModalImage, setSubscriptionModalImage] = useState<SocialmediaGeneratedImage | null>(null);
  const [subscriptionSelectableImages, setSubscriptionSelectableImages] = useState<SocialmediaGeneratedImage[]>([]);
  const [subscriptionTrigger, setSubscriptionTrigger] = useState("quality_upgrade_prompt");
  const [rechargePendingPackage, setRechargePendingPackage] = useState<"" | RechargePackageId>("");
  const [upgradeError, setUpgradeError] = useState("");
  const [pendingSubmitRetryKey, setPendingSubmitRetryKey] = useState(0);
  const [guestClaimCheckoutReadyToken, setGuestClaimCheckoutReadyToken] = useState(0);
  const [watermarkedSignupModalImage, setWatermarkedSignupModalImage] = useState<SocialmediaGeneratedImage | null>(null);
  const [watermarkedSignupImages, setWatermarkedSignupImages] = useState<SocialmediaGeneratedImage[]>([]);
  const [videoSubscriptionModalOpen, setVideoSubscriptionModalOpen] = useState(false);
  const [videoPricingDefaultView, setVideoPricingDefaultView] = useState<VideoPricingDefaultView>("subscription");
  const [videoSubscriptionMedia, setVideoSubscriptionMedia] = useState<AppThreadMediaItem | null>(null);
  const [videoSubscriptionJobId, setVideoSubscriptionJobId] = useState<string | undefined>();
  const [imageAnimationDraft, setImageAnimationDraft] = useState<AppImageAnimationDraft | null>(null);
  const [checkoutUnlockRefreshPending, setCheckoutUnlockRefreshPending] = useState(false);
  const [imagePreview, setImagePreview] = useState<AppImagePreviewState<AppThreadImagePreviewData> | null>(null);
  const threadBodyRef = useRef<HTMLElement | null>(null);
  const threadComposerDockRef = useRef<HTMLDivElement | null>(null);
  const initialScrollSessionRef = useRef("");
  const shouldAutoScrollThreadRef = useRef(true);
  const pendingSubmitStartedRef = useRef<Set<string>>(new Set());
  const pendingSubmitPayloadsRef = useRef<Map<string, AppPendingThreadSubmit>>(new Map());
  const pendingSubmitRetryRequestRef = useRef<AppPendingThreadSubmit | null>(null);
  const activeThreadSessionIdRef = useRef(sessionId);
  const sessionLoadRequestRef = useRef(0);
  const autoThreadGuestSignupPromptKeyRef = useRef("");
  const autoThreadLockedPreviewPromptKeyRef = useRef("");
  const autoThreadGuestCreditPromptKeyRef = useRef("");
  const autoThreadSignedInCreditPromptKeyRef = useRef("");
  const autoThreadSignedInUpgradePromptKeyRef = useRef("");
  const autoThreadVideoSubscriptionPromptKeyRef = useRef("");
  const checkoutAutoDownloadKeyRef = useRef("");
  const guestClaimCheckoutReadyRef = useRef<string | null>(null);
  const threadGuestClaimCoordinatorRef = useRef(createGuestClaimAttemptCoordinator());
  const finalizedThreadGuestClaimKeysRef = useRef(new Set<string>());
  const missingVideoMediaRecoveryJobIdsRef = useRef<Set<string>>(new Set());
  useResetCheckoutPendingOnPageShow(() => setRechargePendingPackage(""));
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    for (const [requestKey, pending] of pendingSubmitPayloadsRef.current) {
      if (pending.sessionId !== sessionId) pendingSubmitPayloadsRef.current.delete(requestKey);
    }
    if (pendingSubmitRetryRequestRef.current?.sessionId !== sessionId) {
      pendingSubmitRetryRequestRef.current = null;
    }
  }, [sessionId]);
  const updatePendingAssistantContent = useCallback((pendingJobId: string, content: string) => {
    setSession((current) => current ? {
      ...current,
      jobs: (current.jobs ?? []).map((job) => job.job_id === pendingJobId
        ? { ...job, generation_progress_reply: content }
        : job)
    } : current);
  }, []);
  const showPendingGenerationIntent = useCallback((pendingJobId: string, outputKind?: "image" | "video") => {
    setSession((current) => {
      if (!current) return current;
      const nextSession: AppThreadSession = {
        ...current,
        jobs: (current.jobs ?? []).map((job) => job.job_id === pendingJobId && job.is_mock
          ? { ...job, generation_intent_confirmed: true, output_type: outputKind ?? job.output_type, mock_ui: "generating", stage: "preparing", progress: 3 }
          : job)
      };
      sessionRef.current = nextSession;
      return nextSession;
    });
  }, []);
  const jobs = useMemo(() => sortThreadJobs(session?.jobs ?? []), [session?.jobs]);
  const hasActiveVideoJob = useMemo(
    () => hasActiveVideoGenerationJob(jobs),
    [jobs]
  );
  const conversationTurns = useMemo(() => session?.conversation_turns ?? [], [session?.conversation_turns]);
  const threadItems = useMemo(() => [
    ...jobs.map((job) => ({ kind: "job" as const, id: job.job_id, createdAt: job.created_at ?? "", job })),
    ...conversationTurns.map((turn) => ({ kind: "conversation" as const, id: turn.id, createdAt: turn.created_at, turn }))
  ].sort((left, right) => left.createdAt.localeCompare(right.createdAt)), [conversationTurns, jobs]);
  const threadContentSignature = useMemo(() => threadItems.map((item) => item.kind === "conversation"
    ? [item.id, item.turn.user_content, item.turn.assistant_content].join(":")
    : [
        item.job.job_id,
        item.job.status,
        item.job.stage,
        item.job.progress,
        item.job.error,
        item.job.mock_ui,
        item.job.local_pending_status,
        item.job.generation_progress_reply,
        getThreadJobSummary(item.job),
        item.job.result?.socialmedia?.images?.length ?? 0,
        item.job.result?.socialmedia?.videos?.length ?? 0,
        item.job.result?.socialmedia?.warnings?.length ?? 0
      ].join(":")).join("|"), [threadItems]);
  const usesGuestSubscriptionPopupExperiment =
    account.authMode === "guest"
    && guestSubscriptionPopupExperiment.variant === "subscription";
  const taskTitle = useMemo(() => resolveTaskTitle(
    jobs.map((job) => ({ text: job.input_text, createdAt: job.created_at })),
    session?.title === "Social media generation" ? undefined : session?.title,
    session?.conversation_turns?.map((turn) => ({ text: turn.user_content, createdAt: turn.created_at }))
  ), [jobs, session?.title, session?.conversation_turns]);
  useEffect(() => {
    if (!session) return;
    document.title = formatVismuseTitle(taskTitle);
  }, [session, taskTitle]);
  const effectivePricingVariant = pricingVariantOverride
    ?? assignedPricingVariant
    ?? (requestedPricingVariant ? normalizePricingVariant(requestedPricingVariant) : undefined)
    ?? pricingVariant;
  const sourceUseCase = getThreadJobSourceUseCase(session) ?? slug ?? "ai-image-maker";
  const subscriptionModalPlans = useMemo(() => {
    const billingContext = {
      market: account.billingMarket ?? "default",
      currency: account.billingCurrency ?? "USD"
    } as const;
    const plans = buildSubscriptionModalPlans(effectivePricingVariant, billingContext, {
      includeImageTextEditorCreditPacks: sourceUseCase === "ai-image-text-editor",
      imageTextEditorCreditPackAudience: account.plan === "free" ? "free" : "subscriber"
    });
    return plans.length ? plans : buildSubscriptionModalPlans(DEFAULT_PRICING_VARIANT, billingContext);
  }, [account.billingCurrency, account.billingMarket, account.plan, effectivePricingVariant, sourceUseCase]);
  const continuationSourceAssets = useMemo(() => {
    if (
      sourceUseCase !== "ai-room-design"
      && sourceUseCase !== "room-design"
      && sourceUseCase !== "background-remover"
      && sourceUseCase !== "ai-image-text-editor"
    ) return [];
    for (let index = threadItems.length - 1; index >= 0; index -= 1) {
      const item = threadItems[index];
      const itemSourceAssets = item.kind === "conversation"
        ? item.turn.source_assets ?? []
        : getThreadJobUserSourceAssets(item.job);
      const normalizedAssets = itemSourceAssets
        .map(toAppComposerContinuationSourceAsset)
        .filter((asset): asset is AppComposerSourceAsset => Boolean(asset));
      if (normalizedAssets.length) return normalizedAssets;
    }
    return [];
  }, [sourceUseCase, threadItems]);
  const toolSlug = resolveAppThreadToolSlug(sourceUseCase);
  const returnHref = resolveAppThreadNewTaskHref(sourceUseCase, preferPublicToolRoutes);
  const billingRefreshKey = `${searchParams.get("billing") ?? ""}:${searchParams.get("asset_id") ?? ""}`;
  const refreshKey = searchParams.get("refresh") ?? searchParams.get("job_id") ?? billingRefreshKey;
  const billingParam = searchParams.get("billing") ?? "";
  const pendingParam = searchParams.get("pending") ?? "";
  const packageIdParam = searchParams.get("package_id") ?? "";
  const isBillingReturn = billingParam === "success" || packageIdParam === APP_IMAGE_UNLOCK_PACKAGE_ID;
  const mockUiParam = searchParams.get("ui") || "generating";
  const mockSceneParam = searchParams.get("scene") || searchParams.get("sence") || "";
  const mockUseCaseParam = searchParams.get("use_case") || searchParams.get("source_use_case") || "";
  const mockAssetsParam = searchParams.get("assets") || "";
  const mockPromptParam = searchParams.get("prompt") || "";
  const mockRenderElapsedSecondsParam = searchParams.get("render_elapsed_seconds") || "";
  const guestSubscriptionPopupRequestedVariant =
    searchParams.get("guest_subscription_popup")
    ?? searchParams.get("guest_subscription_popup_variant");
  const isMockThread = sessionId === "mock";
  const requestIdentityReady = isAccountRequestIdentityReady(accountReady, { allowMock: isMockThread });
  const sessionAccountKey = getThreadSessionAccountKey();
  useEffect(() => {
    if (isMockThread || !session?.session_id) return;
    startAnalyticsSessionRecording();
  }, [isMockThread, session?.session_id]);
  const pollStartedJobIdsRef = useRef<Set<string>>(new Set());
  const pollStartedAtByJobIdRef = useRef<Map<string, number>>(new Map());
  const pollTimedOutJobIdsRef = useRef<Set<string>>(new Set());
  const jobRefreshPromisesByJobIdRef = useRef<Map<string, Promise<AppThreadJob>>>(new Map());
  const jobPollSchedulerRef = useRef<((job: AppThreadJob, overrideDelayMs?: number) => void) | null>(null);
  const resultViewedJobIdsRef = useRef<Set<string>>(new Set());
  const completedAnalyticsJobIdsRef = useRef<Set<string>>(new Set());
  const failedAnalyticsJobIdsRef = useRef<Set<string>>(new Set());
  const showSessionForbiddenAndRedirect = useCallback((pending: AppPendingThreadSubmit) => {
    removePendingThreadSubmit(pending);
    pendingSubmitPayloadsRef.current.delete(pending.idempotencyKey);
    if (pendingSubmitRetryRequestRef.current?.idempotencyKey === pending.idempotencyKey) {
      pendingSubmitRetryRequestRef.current = null;
    }
    if (activeThreadSessionIdRef.current === pending.sessionId) {
      setError("");
      setIsLoading(false);
      setSession((current) => {
        if (!current || current.session_id !== pending.sessionId) return current;
        const pendingJobId = getPendingThreadJobId(pending);
        const jobs = current.jobs?.filter((job) => job.job_id !== pendingJobId);
        if (jobs?.length === current.jobs?.length) return current;
        return {
          ...current,
          jobs,
          last_job_id: current.last_job_id === pendingJobId ? jobs?.at(-1)?.job_id : current.last_job_id
        };
      });
      setSessionForbiddenRedirect({
        sessionId: pending.sessionId,
        href: resolveAppThreadNewTaskHref(pending.sourceUseCase, preferPublicToolRoutes)
      });
      window.setTimeout(() => {
        if (activeThreadSessionIdRef.current === pending.sessionId) {
          dispatchAppToast(`${t(uiLocale, "workbench.thread.sessionForbidden")} ${t(uiLocale, "workbench.thread.returningToWorkbench")}`, "warning", "center");
        }
      }, 0);
    }
  }, [preferPublicToolRoutes, uiLocale]);
  useEffect(() => {
    if (!sessionForbiddenRedirect || sessionForbiddenRedirect.sessionId !== sessionId) return;
    const timeoutId = window.setTimeout(() => {
      if (activeThreadSessionIdRef.current === sessionForbiddenRedirect.sessionId) {
        router.replace(sessionForbiddenRedirect.href);
      }
    }, 2500);
    return () => window.clearTimeout(timeoutId);
  }, [router, sessionForbiddenRedirect, sessionId]);
  const buildThreadGenerationAnalyticsProperties = useCallback((overrides: Record<string, unknown> = {}) => (
    buildAppGenerationAnalyticsProperties({
      appSessionId: sessionId,
      session_id: sessionId,
      sourceUseCase,
      source_use_case: sourceUseCase,
      ...overrides
    })
  ), [sessionId, sourceUseCase]);
  const buildThreadBillingAnalyticsProperties = useCallback((overrides: Record<string, unknown> = {}) => (
    buildThreadGenerationAnalyticsProperties({
      action: "billing",
      stage: "billing",
      credit_balance: account.credits,
      entry: APP_ANALYTICS_WORKFLOW,
      pricing_variant: effectivePricingVariant,
      pricing_experiment_key: PRICING_EXPERIMENT_KEY,
      checkout_scenario: subscriptionTrigger,
      billing_surface: "result",
      ...overrides
    })
  ), [account.credits, buildThreadGenerationAnalyticsProperties, effectivePricingVariant, subscriptionTrigger]);
  const findThreadJobForImage = useCallback((image?: SocialmediaGeneratedImage | null): AppThreadJob | undefined => {
    const assetId = image?.assetId?.trim();
    if (!assetId) return undefined;
    return jobs.find((job) => getThreadJobImages(job).some((item) => item.assetId === assetId));
  }, [jobs]);
  const captureThreadCreditPromptInteraction = useCallback((params: {
    promptCase: string;
    action: "add_credits" | "create_account" | "upgrade" | "unlock";
    surface: "result" | "error" | "thread";
    trigger: "auto_open" | "manual_click";
    job?: AppThreadJob;
  }) => {
    const targetJob = params.job ?? jobs[jobs.length - 1];
    const analyticsEvent = buildCreditPromptAnalyticsEvent({
      userId: account.id,
      promptCase: params.promptCase,
      action: params.action,
      surface: params.surface,
      trigger: params.trigger,
      authMode: account.authMode,
      plan: account.plan,
      creditBalance: account.credits,
      generationStatus: targetJob?.status,
      jobId: targetJob?.job_id
    });
    captureAnalyticsEvent(analyticsEvent.event, analyticsEvent.properties);
  }, [account.authMode, account.credits, account.id, account.plan, jobs]);

  const openThreadUpgradePricingModal = useCallback((
    surface: "result" | "error" | "thread" = "error",
    trigger: "auto_open" | "manual_click" = "auto_open",
    job?: AppThreadJob
  ) => {
    if (!pricingAssignmentReady) return;
    const signedInCreditPromptCase =
      account.plan === "basic" || account.plan === "pro" || account.plan === "max"
        ? "pro_depleted_upgrade"
        : "free_depleted_upgrade";
    captureThreadCreditPromptInteraction({
      promptCase: signedInCreditPromptCase,
      action: "upgrade",
      surface,
      trigger,
      job
    });
    setWatermarkedSignupModalImage(null);
    setWatermarkedSignupImages([]);
    setSubscriptionModalOpen(false);
    setVideoSubscriptionModalOpen(false);
    setVideoSubscriptionMedia(null);
    setVideoSubscriptionJobId(undefined);
    setUpgradePricingModalPresentation(null);
    setUpgradeError("");
    setSubscriptionTrigger("credit_empty_dialog");
    setUpgradePricingModalOpen(true);
    trackGoogleAdsSubscriptionModalViewConversion({
      userId: account.authMode === "supabase" ? account.id : undefined
    });
    captureAnalyticsEvent("pricing_modal_opened", buildThreadBillingAnalyticsProperties({
      action: "pricing_open",
      status: "started",
      trigger: "credit_empty_dialog",
      checkout_scenario: "credit_empty_dialog",
      billing_surface: "error",
      surface: "error",
      modal_variant: "upgrade_pricing_modal",
      job_id: job?.job_id,
      session_id: job?.session_id || sessionId
    }));
  }, [account.authMode, account.id, account.plan, buildThreadBillingAnalyticsProperties, captureThreadCreditPromptInteraction, pricingAssignmentReady, sessionId]);

  const openThreadVideoPricingModal = useCallback((
    surface: "result" | "error" | "thread" = "error",
    trigger: "auto_open" | "manual_click" = "auto_open",
    job?: AppThreadJob,
    presentation: "animate" | "video" = "video"
  ) => {
    if (!pricingAssignmentReady) return;
    captureThreadCreditPromptInteraction({
      promptCase: "video_credit_or_subscription_required",
      action: "upgrade",
      surface,
      trigger,
      job
    });
    setWatermarkedSignupModalImage(null);
    setWatermarkedSignupImages([]);
    setSubscriptionModalOpen(false);
    setVideoSubscriptionModalOpen(false);
    setVideoSubscriptionMedia(null);
    setVideoSubscriptionJobId(undefined);
    setUpgradeError("");
    setSubscriptionTrigger("video_credit_or_subscription_required");
    setUpgradePricingModalPresentation({
      sourceUseCase: "ai-video-generator",
      title: presentation === "animate" ? "Bring your image to life" : "Upgrade your video plan",
      subtitle: presentation === "animate"
        ? "Upgrade to turn this image into a video."
        : "Subscribe with video credits and keep creating directly from this workspace."
    });
    setUpgradePricingModalOpen(true);
    trackGoogleAdsSubscriptionModalViewConversion({
      userId: account.authMode === "supabase" ? account.id : undefined
    });
    captureAnalyticsEvent("pricing_modal_opened", buildThreadBillingAnalyticsProperties({
      action: "pricing_open",
      status: "started",
      trigger: "video_credit_or_subscription_required",
      checkout_scenario: "video_credit_or_subscription_required",
      billing_surface: surface,
      surface,
      modal_variant: "upgrade_pricing_modal",
      job_id: job?.job_id,
      session_id: job?.session_id || sessionId
    }));
  }, [account.authMode, account.id, buildThreadBillingAnalyticsProperties, captureThreadCreditPromptInteraction, pricingAssignmentReady, sessionId]);

  const openThreadGuestCreditSignupModalWithTelemetry = useCallback((
    surface: "result" | "error" | "thread" = "error",
    trigger: "auto_open" | "manual_click" = "auto_open",
    job?: AppThreadJob
  ) => {
    captureThreadCreditPromptInteraction({
      promptCase: "guest_depleted_signup_bonus",
      action: "create_account",
      surface,
      trigger,
      job
    });
    openThreadGuestCreditSignupModal();
  }, [captureThreadCreditPromptInteraction]);

  const recordThreadJobTerminalAnalytics = useCallback((
    job: AppThreadJob,
    captureSource: "initial_load" | "client_poll" | "focus_recovery" = "client_poll"
  ) => {
    const media = getThreadJobMedia(job);
    const imageCount = media.filter((item) => item.kind === "image" && item.url).length;
    const warningCount = job.result?.socialmedia?.warnings?.length ?? 0;
    const generationDurationMs = getAppDateDeltaMs(job.created_at, job.updated_at);
    const shouldCaptureGenerationTerminalEvent = captureSource !== "initial_load";

    if (job.status === "completed") {
      if (!resultViewedJobIdsRef.current.has(job.job_id)) {
        resultViewedJobIdsRef.current.add(job.job_id);
        trackClientEvent("socialmedia.result.viewed", {
          userId: account.id,
          jobId: job.job_id,
          action: "view_result",
          stage: "result",
          status: "success",
          durationMs: generationDurationMs,
          imageCount,
          warningCount,
          messagePreview: truncateTelemetryText(
            job.result?.socialmedia?.briefSummary ?? job.result?.socialmedia?.brief_summary,
            300
          )
        });
      }
      if (shouldCaptureGenerationTerminalEvent && !completedAnalyticsJobIdsRef.current.has(job.job_id)) {
        completedAnalyticsJobIdsRef.current.add(job.job_id);
        captureAnalyticsEvent("generation_completed", buildThreadGenerationAnalyticsProperties({
          capture_source: captureSource,
          job_id: job.job_id,
          session_id: job.session_id || sessionId,
          action: "generate_complete",
          stage: "result",
          status: "success",
          mode: (job.socialmedia as { mode?: string } | undefined)?.mode,
          image_count: imageCount,
          has_images: imageCount > 0,
          warning_count: warningCount,
          job_created_at: job.created_at,
          job_updated_at: job.updated_at,
          generation_duration_ms: generationDurationMs,
          generation_duration_seconds: typeof generationDurationMs === "number"
            ? Number((generationDurationMs / 1000).toFixed(2))
            : undefined
        }));
      }
    } else if (job.status === "failed" && shouldCaptureGenerationTerminalEvent && !failedAnalyticsJobIdsRef.current.has(job.job_id)) {
      failedAnalyticsJobIdsRef.current.add(job.job_id);
      captureAnalyticsEvent("generation_failed", buildThreadGenerationAnalyticsProperties({
        capture_source: captureSource,
        job_id: job.job_id,
        session_id: job.session_id || sessionId,
        action: "generate_failed",
        stage: job.stage || "result",
        status: "failed",
        failure_kind: job.error_code || "job_failed",
        error_message: job.error
      }));
    }
  }, [account.id, buildThreadGenerationAnalyticsProperties, sessionId, sourceUseCase]);

  useEffect(() => {
    if (!session && !isMockThread) return;
    try {
      window.localStorage.setItem(APP_LAST_CREATE_HREF_STORAGE_KEY, returnHref);
      window.dispatchEvent(new CustomEvent(APP_LAST_CREATE_HREF_UPDATE_EVENT, {
        detail: { href: returnHref, sourceUseCase }
      }));
    } catch {
      // The New task button still uses the resolved href if storage is unavailable.
    }
  }, [isMockThread, returnHref, session, sourceUseCase]);

  useEffect(() => {
    const requestedVariant = requestedPricingVariant;
    const initialAssignment = resolveClientPricingExperimentVariant({
      assignedVariant: account.pricingVariant,
      requestedVariant
    });
    setPricingVariant(initialAssignment.variant);
  }, [account.pricingVariant, requestedPricingVariant]);

  useEffect(() => {
    const requestedVariant = guestSubscriptionPopupRequestedVariant;
    let active = true;
    const initialAssignment = resolveClientGuestSubscriptionPopupExperimentInitial({
      requestedVariant
    });
    setGuestSubscriptionPopupReady(initialAssignment.source !== "default");
    setGuestSubscriptionPopupExperiment(initialAssignment);
    void resolveClientGuestSubscriptionPopupExperimentFromServer({ requestedVariant })
      .then((assignment) => {
        if (active) {
          setGuestSubscriptionPopupExperiment(assignment);
          setGuestSubscriptionPopupReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setGuestSubscriptionPopupExperiment(resolveClientGuestSubscriptionPopupExperimentFallback({
            requestedVariant
          }));
          setGuestSubscriptionPopupReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [guestSubscriptionPopupRequestedVariant]);

  const loadSession = useCallback(async (options: {
    freshUnlocks?: boolean;
    requestTimeoutMs?: number;
    suppressError?: boolean;
    bypassRequestDedupe?: boolean;
    useCache?: boolean;
  } = {}) => {
    if (!sessionId) return null;
    if (!requestIdentityReady) return null;
    const requestedSessionId = sessionId;
    const requestedAccountKey = sessionAccountKey;
    const isCurrentIdentity = () => activeThreadSessionIdRef.current === requestedSessionId
      && getThreadSessionAccountKey() === requestedAccountKey;
    if (!isCurrentIdentity()) return null;
    const requestId = ++sessionLoadRequestRef.current;
    const isCurrentRequest = () => isCurrentIdentity() && sessionLoadRequestRef.current === requestId;
    setError("");
    setSessionNotFound(false);
    const fetchAndApplySession = async (): Promise<AppThreadSession | null> => {
      if (!isCurrentIdentity()) return null;
      const params = new URLSearchParams();
      if (isMockThread) {
        if (mockSceneParam) params.set("scene", mockSceneParam);
        params.set("ui", mockUiParam);
        if (mockUseCaseParam) params.set("use_case", mockUseCaseParam);
        if (mockAssetsParam) params.set("assets", mockAssetsParam);
        if (mockPromptParam) params.set("prompt", mockPromptParam);
        if (mockRenderElapsedSecondsParam) params.set("render_elapsed_seconds", mockRenderElapsedSecondsParam);
      } else if (options.freshUnlocks || isBillingReturn) {
        params.set("fresh_unlocks", "1");
      }
      const url = isMockThread
        ? `/api/chat/mock?${params}`
        : `/api/v1/sessions/${encodeURIComponent(sessionId)}${params.toString() ? `?${params}` : ""}`;
      const data = await fetchAppThreadSession<AppThreadSession>(url, {
        useCache: options.useCache,
        signal: options.requestTimeoutMs ? AbortSignal.timeout(options.requestTimeoutMs) : undefined,
        dedupe: options.bypassRequestDedupe ? false : undefined
      });
      if (!isCurrentIdentity()) return null;
      // Recovery callers sharing a valid read still need its result, while
      // only the latest caller owns the loading/error state and visible view.
      if (!isCurrentRequest()) return data;
      const existingProgressReplies = new Map(
        (sessionRef.current?.jobs ?? [])
          .filter((job) => job.generation_progress_reply?.trim())
          .map((job) => [job.job_id, job.generation_progress_reply!.trim()])
      );
      const serverSession = {
        ...data,
        jobs: sortThreadJobs((data.jobs ?? []).map((job) => {
          const previousJob = sessionRef.current?.jobs?.find((previous) => previous.job_id === job.job_id
            || Boolean(job.socialmedia?.submitIdempotencyKey
              && previous.socialmedia?.submitIdempotencyKey === job.socialmedia.submitIdempotencyKey));
          const reconciledJob = preserveConfirmedThreadGenerationIntent(job, previousJob);
          const progressReply = existingProgressReplies.get(job.job_id);
          return progressReply && (isThreadJobActive(job)
            || (data.agent_mode && !isThreadVideoJob(job) && job.status === "completed"))
            ? { ...reconciledJob, generation_progress_reply: progressReply }
            : reconciledJob;
        }))
      };
      const serverSubmitIdempotencyKeys = new Set(
        serverSession.jobs.flatMap((job) => {
          const key = job.socialmedia?.submitIdempotencyKey?.trim();
          return key ? [key] : [];
        })
      );
      for (const requestKey of serverSubmitIdempotencyKeys) {
        pendingSubmitPayloadsRef.current.delete(requestKey);
      }
      const activeLocalPendingJobs = findUncoveredRetainedLocalThreadSubmitJobs(
        serverSession.jobs,
        sessionRef.current?.session_id === requestedSessionId
          ? sessionRef.current.jobs ?? []
          : [],
        new Set(pendingSubmitPayloadsRef.current.keys())
      );
      const nextJobs = sortThreadJobs([...serverSession.jobs, ...activeLocalPendingJobs]);
      const nextSession = {
        ...serverSession,
        last_job_id: activeLocalPendingJobs.length > 0
          ? nextJobs.at(-1)?.job_id ?? serverSession.last_job_id
          : serverSession.last_job_id,
        jobs: nextJobs
      };
      const pending = readPendingThreadSubmit(sessionId);
      if (pending && isPendingCoveredByServerJob(nextSession.jobs, pending)) {
        removePendingThreadSubmit(pending);
        pendingSubmitStartedRef.current.delete(pending.idempotencyKey);
      }
      const currentPending = pending && !isPendingCoveredByServerJob(nextSession.jobs, pending)
        ? readPendingThreadSubmit(sessionId)
        : null;
      const mergedSession = currentPending ? mergePendingThreadSubmitIntoSession(nextSession, currentPending) : nextSession;
      sessionRef.current = mergedSession;
      setError("");
      setSessionNotFound(false);
      setSession(mergedSession);
      return mergedSession;
    };

    try {
      return await fetchAndApplySession();
    } catch (caughtError) {
      if (caughtError instanceof AppThreadSessionSupersededError) return null;
      let loadError: unknown = caughtError;
      if (loadError instanceof AppThreadSessionFetchError && loadError.status === 404) {
        const pending = readPendingThreadSubmit(sessionId);
        const currentSession = sessionRef.current;
        const shouldRetryTransientNotFound = Boolean(
          pending
          || currentSession?.session_id === sessionId
          || options.freshUnlocks
          || isBillingReturn
          || Boolean(guestClaimCheckoutReadyRef.current)
        );
        if (shouldRetryTransientNotFound) {
          await new Promise((resolve) => window.setTimeout(resolve, APP_SESSION_TRANSIENT_404_RETRY_DELAY_MS));
          try {
            return await fetchAndApplySession();
          } catch (retryError) {
            if (retryError instanceof AppThreadSessionSupersededError) return null;
            loadError = retryError;
          }
        }
      }
      if (!isCurrentRequest()) return null;
      // A failed refresh must not replace an already loaded thread with the
      // full-page error (or redirect it on a transient 404). Return null so
      // callers still know that fresh data, including unlocks, was not fetched.
      if (sessionRef.current?.session_id === requestedSessionId) return null;
      if (loadError instanceof AppThreadSessionFetchError && loadError.status === 404) {
        const pending = readPendingThreadSubmit(sessionId);
        if (pending) {
          const pendingSession = buildPendingThreadSession(pending);
          sessionRef.current = pendingSession;
          setSession(pendingSession);
          setSessionNotFound(false);
          setError("");
          return pendingSession;
        }
        if (!options.suppressError) setSessionNotFound(true);
      }
      if (!options.suppressError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load this chat.");
      }
      return null;
    } finally {
      if (isCurrentRequest()) setIsLoading(false);
    }
  }, [isBillingReturn, isMockThread, mockAssetsParam, mockPromptParam, mockRenderElapsedSecondsParam, mockSceneParam, mockUiParam, mockUseCaseParam, requestIdentityReady, sessionAccountKey, sessionId]);

  const recoverPendingThreadSubmit = useCallback(async (pending: AppPendingThreadSubmit): Promise<boolean> => {
    trackClientEvent("socialmedia.create.request.recovery.started", {
      traceId: pending.traceId,
      userId: account.id,
      appSessionId: pending.sessionId,
      action: "request_recover",
      stage: "request",
      status: "started"
    });
    const recoveredSession = await recoverThreadSubmit({
      load: () => loadSession({
        requestTimeoutMs: 10_000,
        suppressError: true,
        bypassRequestDedupe: true
      }),
      isRecovered: (loadedSession) => isPendingCoveredByServerJob(loadedSession.jobs, pending),
      shouldContinue: () => activeThreadSessionIdRef.current === pending.sessionId
    });
    const recovered = Boolean(recoveredSession);
    if (recovered) pendingSubmitPayloadsRef.current.delete(pending.idempotencyKey);
    if (activeThreadSessionIdRef.current === pending.sessionId) {
      trackClientEvent(recovered
        ? "socialmedia.create.request.recovered"
        : "socialmedia.create.request.recovery.failed", {
        traceId: pending.traceId,
        userId: account.id,
        appSessionId: pending.sessionId,
        action: "request_recover",
        stage: "request",
        status: recovered ? "success" : "failed",
        level: recovered ? "info" : "warn",
        durationMs: Number.isFinite(Date.parse(pending.createdAt)) ? Date.now() - Date.parse(pending.createdAt) : undefined,
        errorMessage: pending.lastError
      });
    }
    return recovered;
  }, [account.id, loadSession]);

  useEffect(() => {
    if (!sessionNotFound || !accountReady || !account.isLoggedIn) return;
    router.replace(readAppThreadFallbackWorkbenchHref(preferPublicToolRoutes));
  }, [account.isLoggedIn, accountReady, preferPublicToolRoutes, router, sessionNotFound]);

  const refreshSessionForUnlocks = useCallback(async (): Promise<AppThreadSession | null> => {
    if (!sessionId) return null;
    if (isMockThread) return session;
    const requestedAccountKey = getThreadSessionAccountKey();
    const isCurrentRequest = () => activeThreadSessionIdRef.current === sessionId
      && getThreadSessionAccountKey() === requestedAccountKey;
    // SIGNED_IN closes the identity barrier until the shell finishes the
    // account handoff. Its completion event will refresh the current chat.
    if (!requestedAccountKey || !isCurrentRequest()) return null;
    try {
      const data = await fetchAppThreadSession<AppThreadSession>(`/api/v1/sessions/${encodeURIComponent(sessionId)}?fresh_unlocks=1`);
      if (!isCurrentRequest()) return null;
      const nextSession = {
        ...data,
        jobs: sortThreadJobs(data.jobs ?? [])
      };
      sessionRef.current = nextSession;
      setError("");
      setSessionNotFound(false);
      setIsLoading(false);
      setSession(nextSession);
      return nextSession;
    } catch (caughtError) {
      // Leave the newer request in charge of updating the view. Real network
      // and API failures still propagate to the action that requested them.
      if (caughtError instanceof AppThreadSessionSupersededError || !isCurrentRequest()) return null;
      throw caughtError;
    }
  }, [isMockThread, session, sessionId]);

  const blockCheckoutForForeignThreadOwner = useCallback(async (params: {
    packageId?: string;
    assetId?: string;
    jobId?: string;
    targetSessionId?: string;
    checkoutScenario?: string;
    surface?: "subscription" | "image_unlock";
  }): Promise<boolean> => {
    if (account.authMode !== "supabase") return false;
    if (!session || (params.targetSessionId && params.targetSessionId !== session.session_id)) return false;

    let checkedSession = session;
    let ownerUserId = checkedSession.owner_user_id?.trim();
    let guestOwned = checkedSession.owner_auth_mode === "guest" || isAppGuestOwnerUserId(ownerUserId);
    let failureReason: string | undefined;
    let claimSucceeded = false;

    if (guestOwned && ownerUserId) {
      try {
        await claimThreadGuestAccountForSignedInUser(ownerUserId);
        claimSucceeded = true;
        window.dispatchEvent(new Event("vismuse:account-updated"));
        let refreshedSession: AppThreadSession | null = null;
        let refreshError: unknown;
        for (const delayMs of [0, 250, 750, 1500]) {
          if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
          try {
            refreshedSession = await refreshSessionForUnlocks();
            refreshError = undefined;
            const refreshedOwnerUserId = refreshedSession?.owner_user_id?.trim();
            if (
              refreshedSession?.owner_auth_mode === "supabase"
              && refreshedOwnerUserId === account.id
              && !isAppGuestOwnerUserId(refreshedOwnerUserId)
            ) {
              break;
            }
          } catch (error) {
            refreshError = error;
          }
        }
        if (refreshedSession) checkedSession = refreshedSession;
        ownerUserId = checkedSession.owner_user_id?.trim();
        guestOwned = checkedSession.owner_auth_mode === "guest" || isAppGuestOwnerUserId(ownerUserId);
        if (
          checkedSession.owner_auth_mode === "supabase"
          && Boolean(account.id)
          && ownerUserId === account.id
          && !guestOwned
        ) {
          return false;
        }
        failureReason = refreshError ? "session_refresh_failed" : "session_owner_not_updated";
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error ?? "");
        failureReason = message.includes("GUEST_ACCOUNT_ALREADY_CLAIMED")
          ? "claimed_by_other_user"
          : message.includes("GUEST_CLAIM_REQUIRES_NEW_ACCOUNT")
            ? "claim_window_expired"
            : message.includes("GUEST_CLAIM_COOKIE")
              ? "guest_cookie_mismatch"
              : "guest_claim_failed";
      }
    }

    const otherSignedInOwner =
      checkedSession.owner_auth_mode === "supabase"
      && Boolean(ownerUserId)
      && Boolean(account.id)
      && ownerUserId !== account.id;
    if (!guestOwned && !otherSignedInOwner) return false;

    const reason = failureReason ?? (guestOwned ? "pending_claim_missing" : "session_owner_mismatch");
    captureAnalyticsEvent("guest_claim_checkout_blocked", buildThreadBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(params.packageId ?? APP_IMAGE_UNLOCK_PACKAGE_ID, {
      action: "guest_claim",
      status: "failed",
      reason,
      checkout_scenario: params.checkoutScenario ?? subscriptionTrigger,
      billing_surface: "result",
      modal_variant: params.surface === "image_unlock" ? "image_unlock" : "post_generation_subscription",
      asset_id: params.assetId,
      job_id: params.jobId,
      session_id: params.targetSessionId ?? checkedSession.session_id,
      owner_user_id: ownerUserId,
      owner_auth_mode: checkedSession.owner_auth_mode,
      user_id: account.id,
      auth_mode: account.authMode
    })));

    const irrecoverableOwnerConflict = failureReason === "claimed_by_other_user"
      || failureReason === "claim_window_expired"
      || otherSignedInOwner;
    if (!irrecoverableOwnerConflict) {
      dispatchAppToast(
        claimSucceeded
          ? "Your guest workspace was linked, but it is still syncing. Please try checkout again."
          : "We could not link this guest workspace yet. Please try checkout again.",
        "warning"
      );
      return true;
    }

    setRechargePendingPackage("");
    setUnlockingAssetId(null);
    setSubscriptionModalOpen(false);
    setUpgradePricingModalOpen(false);
    setUpgradeError("");
    clearAppPendingCheckoutAfterAuth();
    dispatchAppToast("This guest result could not be linked to this account. Starting a fresh workspace for your account.", "warning");
    router.replace(readAppThreadFallbackWorkbenchHref(preferPublicToolRoutes));
    return true;
  }, [
    account.authMode,
    account.id,
    buildThreadBillingAnalyticsProperties,
    preferPublicToolRoutes,
    refreshSessionForUnlocks,
    router,
    session,
    subscriptionTrigger
  ]);

  useEffect(() => {
    if (!sessionId || isMockThread) return;
    const handleCheckoutSynced = (event: Event) => {
      const detail = event instanceof CustomEvent && event.detail && typeof event.detail === "object"
        ? event.detail as AppCheckoutSyncedEventDetail
        : {};
      const isUnlockCheckout = detail.kind === "image_unlock" || detail.kind === "video_unlock";
      if (isUnlockCheckout) setCheckoutUnlockRefreshPending(true);
      void loadSession({ freshUnlocks: true }).finally(() => {
        if (isUnlockCheckout) setCheckoutUnlockRefreshPending(false);
      });
    };
    window.addEventListener(APP_CHECKOUT_SYNCED_EVENT, handleCheckoutSynced);
    return () => {
      window.removeEventListener(APP_CHECKOUT_SYNCED_EVENT, handleCheckoutSynced);
    };
  }, [isMockThread, loadSession, sessionId]);

  useEffect(() => {
    if (!sessionId || isMockThread) return;
    const handleGuestClaimStarted = () => {
      setError("");
      setSessionNotFound(false);
      setIsLoading(true);
    };
    const handleGuestClaimCompleted = () => {
      guestClaimCheckoutReadyRef.current = readAppGuestClaimCheckoutReadyGuestId();
      setGuestClaimCheckoutReadyToken((current) => current + 1);
      setIsLoading(true);
      void loadSession({ freshUnlocks: true });
    };
    const handleGuestClaimEnded = (event: Event) => {
      guestClaimCheckoutReadyRef.current = null;
      clearAppPendingCheckoutAfterAuth();
      clearAppGuestClaimCheckoutReady();
      const outcome = event instanceof CustomEvent && typeof event.detail?.outcome === "string"
        ? event.detail.outcome
        : undefined;
      const claimFailed = event instanceof CustomEvent && event.detail?.ok === false;
      if (claimFailed || outcome === "login_only" || outcome === "guest_bound_elsewhere") {
        // The current URL still identifies the guest workspace. The shell
        // either navigates away, asks for the linked account, or keeps the
        // barrier closed for retry. Never race that with a signed-in request.
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      void loadSession({ freshUnlocks: true });
    };
    window.addEventListener(APP_GUEST_CLAIM_STARTED_EVENT, handleGuestClaimStarted);
    window.addEventListener(APP_GUEST_CLAIM_COMPLETED_EVENT, handleGuestClaimCompleted);
    window.addEventListener(APP_GUEST_CLAIM_ENDED_EVENT, handleGuestClaimEnded);
    return () => {
      window.removeEventListener(APP_GUEST_CLAIM_STARTED_EVENT, handleGuestClaimStarted);
      window.removeEventListener(APP_GUEST_CLAIM_COMPLETED_EVENT, handleGuestClaimCompleted);
      window.removeEventListener(APP_GUEST_CLAIM_ENDED_EVENT, handleGuestClaimEnded);
    };
  }, [isMockThread, loadSession, sessionId]);

  const resolveFreshThreadMedia = useCallback(async (job: AppThreadJob, media: AppThreadMediaItem[]) => {
    if (!isThreadPaidAccount(account) && !media.some((item) => item.accessVariant === "original")) {
      return media;
    }
    if (!media.some((item) => item.accessVariant !== "original")) {
      return media;
    }

    const freshSession = await refreshSessionForUnlocks();
    const freshJob = freshSession?.jobs?.find((item) => item.job_id === job.job_id);
    if (!freshJob) return media;
    const freshMedia = getThreadJobMedia(freshJob);
    return media.map((item) => {
      const match = freshMedia.find((candidate) => (
        candidate.kind === item.kind
        && (
          Boolean(item.assetId && candidate.assetId === item.assetId)
          || candidate.index === item.index
        )
      ));
      return match ?? item;
    });
  }, [account, refreshSessionForUnlocks]);

  const openThreadWatermarkedSignupModal = useCallback((
    image: SocialmediaGeneratedImage,
    selectableImages: SocialmediaGeneratedImage[] = [image],
    context: { job?: AppThreadJob } = {}
  ) => {
    const targetJob = context.job ?? findThreadJobForImage(image);
    setSubscriptionModalOpen(false);
    setUpgradePricingModalOpen(false);
    setUpgradeError("");
    setWatermarkedSignupModalImage(image);
    setWatermarkedSignupImages(selectableImages.filter((item) => item.url));
    captureAnalyticsEvent("pricing_modal_opened", buildThreadBillingAnalyticsProperties({
      action: "pricing_open",
      status: "started",
      trigger: "watermarked_signup_modal",
      checkout_scenario: "watermarked_signup_modal",
      billing_surface: "result",
      modal_variant: "watermarked_signup_modal",
      asset_id: image.assetId,
      image_index: image.imageIndex,
      job_id: targetJob?.job_id,
      session_id: targetJob?.session_id || sessionId,
      displayed_image_access_variant: image.accessVariant,
      gated_image_count: selectableImages.length
    }));
  }, [buildThreadBillingAnalyticsProperties, findThreadJobForImage, sessionId]);

  const handleDownloadThreadMedia = useCallback(async (
    job: AppThreadJob,
    media: AppThreadMediaItem[],
    options: {
      allowPreview?: boolean;
      downloadSource?: "group" | "preview" | "image_unlock" | "image_unlock_checkout_success" | "video_unlock_checkout_success";
      format?: ImageExportFormat;
    } = {}
  ) => {
    const downloadableMedia = media.filter((item) => item.url);
    if (!downloadableMedia.length || downloadingJobId) return false;
    const downloadTriggerPrefix = options.downloadSource === "preview" ? "preview_download" : "thread_group_download";
    const exportClickAnalytics = options.format === "jpeg" || options.format === "pdf"
      ? IMAGE_EXPORT_CLICK_ANALYTICS[options.format]
      : undefined;
    if (exportClickAnalytics) {
      captureAnalyticsEvent(exportClickAnalytics.event, buildThreadGenerationAnalyticsProperties({
        job_id: job.job_id,
        session_id: job.session_id || sessionId,
        action: "export",
        stage: "asset",
        status: "clicked",
        trigger: "thread_export_menu",
        download_source: options.downloadSource ?? "group",
        export_format: options.format,
        point_name: exportClickAnalytics.pointName,
        image_count: downloadableMedia.filter((item) => item.kind === "image").length,
        requires_unlock: downloadableMedia.some((item) => shouldGateThreadMediaDownload(item))
      }));
    }

    if (!options.allowPreview) {
      const gatedMedia = downloadableMedia.filter((item) => shouldGateThreadMediaDownload(item));
      if (gatedMedia.length) {
        const gatedImages = gatedMedia
          .map(toSocialmediaGeneratedImage)
          .filter((image): image is SocialmediaGeneratedImage => Boolean(image));
        const firstGatedImage = gatedImages[0];
        if (firstGatedImage) {
          captureAnalyticsEvent("generation_download_gate_shown", buildThreadGenerationAnalyticsProperties({
            job_id: job.job_id,
            session_id: job.session_id || sessionId,
            action: "download_gate_open",
            status: "started",
            trigger: account.isLoggedIn ? `${downloadTriggerPrefix}_subscription` : `${downloadTriggerPrefix}_signup`,
            checkout_scenario: account.isLoggedIn ? `${downloadTriggerPrefix}_subscription` : `${downloadTriggerPrefix}_signup`,
            modal_variant: !account.isLoggedIn && isGuestWatermarkedSignupImage(firstGatedImage)
              ? "watermarked_signup_modal"
              : "post_generation_subscription",
            download_source: options.downloadSource ?? "group",
            image_count: gatedImages.length,
            asset_id: firstGatedImage.assetId,
            image_index: firstGatedImage.imageIndex
          }));
          if (!account.isLoggedIn && isGuestWatermarkedSignupImage(firstGatedImage)) {
            openThreadWatermarkedSignupModal(firstGatedImage, gatedImages, { job });
          } else {
            if (!pricingAssignmentReady) {
              if (!account.isLoggedIn) openThreadAuthModal();
              return false;
            }
            const checkoutScenario = account.isLoggedIn ? `${downloadTriggerPrefix}_subscription` : `${downloadTriggerPrefix}_signup`;
            setSubscriptionModalPlan(account.isLoggedIn ? "free" : "guest");
            setSubscriptionModalImage(firstGatedImage);
            setSubscriptionSelectableImages(gatedImages.length ? gatedImages : [firstGatedImage]);
            setSubscriptionTrigger(checkoutScenario);
            setUpgradeError("");
            setSubscriptionModalOpen(true);
            captureAnalyticsEvent("pricing_modal_opened", buildThreadBillingAnalyticsProperties({
              action: "pricing_open",
              status: "started",
              trigger: checkoutScenario,
              checkout_scenario: checkoutScenario,
              billing_surface: "result",
              surface: "result",
              modal_variant: account.isLoggedIn ? "post_generation_subscription" : "guest_signup_unlock",
              image_unlock_available: Boolean(firstGatedImage.assetId),
              download_source: options.downloadSource ?? "group",
              asset_id: firstGatedImage.assetId,
              image_index: firstGatedImage.imageIndex,
              job_id: job.job_id,
              session_id: job.session_id || sessionId,
              displayed_image_access_variant: firstGatedImage.accessVariant,
              gated_image_count: gatedImages.length
            }));
            trackGoogleAdsSubscriptionModalViewConversion({
              userId: account.authMode === "supabase" ? account.id : undefined
            });
          }
        } else {
          const firstGatedVideo = gatedMedia.find((item) => item.kind === "video" && item.url);
          if (firstGatedVideo) {
            if (!pricingAssignmentReady) {
              if (!account.isLoggedIn) openThreadAuthModal();
              return false;
            }
            captureAnalyticsEvent("generation_download_gate_shown", buildThreadGenerationAnalyticsProperties({
              job_id: job.job_id,
              session_id: job.session_id || sessionId,
              action: "download_gate_open",
              status: "started",
              trigger: "video_download_subscription",
              checkout_scenario: "video_download_subscription",
              modal_variant: "post_generation_video_subscription",
              download_source: options.downloadSource ?? "group",
              asset_id: firstGatedVideo.assetId,
              video_index: firstGatedVideo.index
            }));
            captureAnalyticsEvent("pricing_modal_opened", buildThreadBillingAnalyticsProperties({
              action: "pricing_open",
              status: "started",
              trigger: "video_download_subscription",
              checkout_scenario: "video_download_subscription",
              billing_surface: "result",
              surface: "result",
              modal_variant: "post_generation_video_subscription",
              asset_id: firstGatedVideo.assetId,
              video_index: firstGatedVideo.index,
              displayed_video_access_variant: firstGatedVideo.accessVariant ?? "none",
              download_source: options.downloadSource ?? "group",
              job_id: job.job_id,
              session_id: job.session_id || sessionId
            }));
            trackGoogleAdsSubscriptionModalViewConversion({
              userId: account.authMode === "supabase" ? account.id : undefined
            });
            setVideoPricingDefaultView("subscription");
            setVideoSubscriptionModalOpen(true);
            setVideoSubscriptionMedia(firstGatedVideo);
            setVideoSubscriptionJobId(job.job_id);
          } else if (!account.isLoggedIn) {
            openThreadAuthModal();
          } else {
            openThreadVideoPricingModal("result", "manual_click", job);
          }
        }
        return false;
      }
    }

    if (downloadResetTimeoutRef.current !== null) {
      window.clearTimeout(downloadResetTimeoutRef.current);
      downloadResetTimeoutRef.current = null;
    }
    setDownloadedJobId(null);
    setDownloadingJobId(job.job_id);
    try {
      const resolvedMedia = options.allowPreview
        ? downloadableMedia
        : await resolveFreshThreadMedia(job, downloadableMedia);
      const exportingImages = Boolean(options.format) && resolvedMedia.every((item) => item.kind === "image");
      trackClientEvent("socialmedia.download.started", {
        userId: account.id,
        sessionId,
        jobId: job.job_id,
        action: "download",
        stage: "asset",
        status: "started",
        imageCount: resolvedMedia.filter((item) => item.kind === "image").length,
        videoCount: resolvedMedia.filter((item) => item.kind === "video").length,
        downloadSource: options.downloadSource ?? "group",
        exportFormat: options.format
      });
      if (options.format && exportingImages) {
        await saveThreadImagesAsFormat(job.job_id, resolvedMedia, options.format);
      }
      for (const item of resolvedMedia) {
        if (!exportingImages) {
          await saveThreadMedia(item, job.job_id);
        }
        captureAnalyticsEvent("generation_downloaded", buildThreadGenerationAnalyticsProperties({
          job_id: job.job_id,
          session_id: job.session_id || sessionId,
          action: "download",
          stage: "asset",
          status: "success",
          asset_id: item.assetId,
          image_index: item.kind === "image" ? item.index : undefined,
          video_index: item.kind === "video" ? item.index : undefined,
          download_source: options.downloadSource ?? "group",
          export_format: options.format
        }));
        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }
      setDownloadedJobId(job.job_id);
      downloadResetTimeoutRef.current = window.setTimeout(() => {
        setDownloadedJobId((current) => current === job.job_id ? null : current);
        downloadResetTimeoutRef.current = null;
      }, 3000);
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to download this result.");
      return false;
    } finally {
      setDownloadingJobId(null);
    }
  }, [
    account,
    buildThreadBillingAnalyticsProperties,
    buildThreadGenerationAnalyticsProperties,
    downloadingJobId,
    openThreadVideoPricingModal,
    openThreadWatermarkedSignupModal,
    pricingAssignmentReady,
    resolveFreshThreadMedia,
    sessionId,
  ]);

  const handleResultMenuOpen = useCallback((job: AppThreadJob, menu: "export" | "animate") => {
    captureAnalyticsEvent(`${menu}_menu_opened`, buildThreadGenerationAnalyticsProperties({
      job_id: job.job_id,
      session_id: job.session_id || sessionId,
      source_use_case: job.source_use_case,
      action: `${menu}_menu_open`,
      stage: "result",
      status: "opened",
      trigger: "result_action_button",
      menu,
      point_name: menu === "export" ? "Export菜单展开" : "Animate菜单展开",
      image_count: getThreadJobImages(job).length
    }));
  }, [buildThreadGenerationAnalyticsProperties, sessionId]);

  useEffect(() => () => {
    if (downloadResetTimeoutRef.current !== null) {
      window.clearTimeout(downloadResetTimeoutRef.current);
    }
  }, []);

  const downloadUnlockedThreadImageFromCheckout = useCallback(async (params: {
    checkoutId?: string;
    checkoutSyncOk?: boolean;
    jobId?: string;
    assetId?: string;
    downloadSource?: "image_unlock" | "image_unlock_checkout_success";
  }): Promise<boolean> => {
    const assetId = params.assetId?.trim();
    const jobId = params.jobId?.trim();
    const baseProperties = buildThreadBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(APP_IMAGE_UNLOCK_PACKAGE_ID, {
      uid: account.id?.trim() || account.authMode || "anonymous",
      user_id: account.id?.trim() || account.authMode || "anonymous",
      workflow: APP_ANALYTICS_WORKFLOW,
      auth_state: account.authMode === "supabase" ? "signed_in" : account.authMode ?? "guest",
      auth_mode: account.authMode ?? "guest",
      account_plan: account.plan,
      job_id: jobId,
      session_id: sessionId,
      asset_id: assetId,
      checkout_id: params.checkoutId,
      action: "download_unlocked_image",
      stage: "download"
    }));

    captureAnalyticsEvent("image_unlock_download_prepare_started", {
      ...baseProperties,
      status: "started"
    });

    if (!assetId || params.checkoutSyncOk === false) {
      captureAnalyticsEvent("image_unlock_original_fetch_failed", {
        ...baseProperties,
        status: "failed",
        reason: params.checkoutSyncOk === false ? "checkout_sync_not_ready" : "missing_synced_unlock_context"
      });
      return false;
    }

    const freshSession = await refreshSessionForUnlocks();
    const freshJob = jobId
      ? freshSession?.jobs?.find((item) => item.job_id === jobId)
      : freshSession?.jobs?.find((item) => getThreadJobMedia(item).some((media) => media.assetId === assetId));
    if (!freshJob) {
      captureAnalyticsEvent("image_unlock_original_fetch_failed", {
        ...baseProperties,
        status: "failed",
        reason: "missing_synced_unlock_context"
      });
      return false;
    }

    const unlockedImages = getThreadJobMedia(freshJob).filter((item) => (
      item.kind === "image"
      && item.assetId === assetId
      && item.accessVariant === "original"
      && item.url
    ));
    const firstImage = unlockedImages[0];
    if (!firstImage) {
      captureAnalyticsEvent("image_unlock_original_fetch_failed", {
        ...baseProperties,
        status: "failed",
        reason: "original_variant_not_ready"
      });
      return false;
    }

    captureAnalyticsEvent("image_unlock_download_started", {
      ...baseProperties,
      status: "started",
      image_index: firstImage.index
    });
    try {
      for (const image of unlockedImages) {
        await saveThreadMedia(image, freshJob.job_id);
        captureAnalyticsEvent("generation_downloaded", buildThreadGenerationAnalyticsProperties({
          job_id: freshJob.job_id,
          session_id: freshJob.session_id || sessionId,
          action: "download",
          stage: "asset",
          status: "success",
          asset_id: image.assetId,
          image_index: image.index,
          download_source: params.downloadSource ?? "image_unlock_checkout_success",
          is_watermarked_download: false
        }));
        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }
    } catch (error) {
      captureAnalyticsEvent("image_unlock_download_failed", {
        ...baseProperties,
        status: "failed",
        image_index: firstImage.index,
        reason: error instanceof Error ? error.message : "download_failed"
      });
      return false;
    }

    captureAnalyticsEvent("image_unlock_downloaded", {
      ...baseProperties,
      status: "success",
      image_index: firstImage.index,
      access_variant: firstImage.accessVariant,
      download_source: params.downloadSource ?? "image_unlock_checkout_success"
    });
    return true;
  }, [
    account.authMode,
    account.id,
    account.plan,
    buildThreadBillingAnalyticsProperties,
    buildThreadGenerationAnalyticsProperties,
    refreshSessionForUnlocks,
    sessionId
  ]);

  useEffect(() => {
    const handleCheckoutSyncedDownload = (event: Event) => {
      const detail = event instanceof CustomEvent && event.detail && typeof event.detail === "object"
        ? event.detail as AppCheckoutSyncedEventDetail
        : {};
      if (detail.kind !== "image_unlock" || !detail.assetId) return;
      const eventSessionId = detail.sessionId?.trim();
      if (eventSessionId && eventSessionId !== sessionId) return;
      const downloadKey = `${detail.checkoutId ?? ""}:${detail.assetId}:${detail.jobId ?? ""}`;
      if (checkoutAutoDownloadKeyRef.current === downloadKey) return;
      checkoutAutoDownloadKeyRef.current = downloadKey;
      if (detail.checkoutSyncOk === false) return;

      setSubscriptionModalOpen(false);
      setUpgradePricingModalOpen(false);
      setUpgradeError("");
      window.setTimeout(() => {
        void downloadUnlockedThreadImageFromCheckout({
          checkoutId: detail.checkoutId,
          checkoutSyncOk: detail.checkoutSyncOk,
          jobId: detail.jobId,
          assetId: detail.assetId,
          downloadSource: "image_unlock_checkout_success"
        }).then((downloaded) => {
          if (!downloaded) {
            setUpgradeError("Payment completed. Please click download again in a moment.");
          }
        });
      }, 250);
    };

    window.addEventListener(APP_CHECKOUT_SYNCED_EVENT, handleCheckoutSyncedDownload);
    return () => window.removeEventListener(APP_CHECKOUT_SYNCED_EVENT, handleCheckoutSyncedDownload);
  }, [downloadUnlockedThreadImageFromCheckout, sessionId]);

  const downloadUnlockedThreadVideoFromCheckout = useCallback(async (params: {
    checkoutSyncOk?: boolean;
    jobId?: string;
    assetId?: string;
  }): Promise<boolean> => {
    const assetId = params.assetId?.trim();
    const jobId = params.jobId?.trim();
    if (!assetId || params.checkoutSyncOk === false) return false;

    const freshSession = await refreshSessionForUnlocks();
    const freshJob = jobId
      ? freshSession?.jobs?.find((item) => item.job_id === jobId)
      : freshSession?.jobs?.find((item) => getThreadJobMedia(item).some((media) => media.assetId === assetId));
    if (!freshJob) return false;

    const unlockedVideo = getThreadJobMedia(freshJob).find((item) => (
      item.kind === "video"
      && item.assetId === assetId
      && item.accessVariant === "original"
      && item.url
    ));
    if (!unlockedVideo) return false;

    return handleDownloadThreadMedia(freshJob, [unlockedVideo], {
      downloadSource: "video_unlock_checkout_success"
    });
  }, [handleDownloadThreadMedia, refreshSessionForUnlocks]);

  useEffect(() => {
    const handleVideoCheckoutSyncedDownload = (event: Event) => {
      const detail = event instanceof CustomEvent && event.detail && typeof event.detail === "object"
        ? event.detail as AppCheckoutSyncedEventDetail
        : {};
      if (detail.kind !== "video_unlock" || !detail.assetId) return;
      const eventSessionId = detail.sessionId?.trim();
      if (eventSessionId && eventSessionId !== sessionId) return;
      const downloadKey = `video:${detail.checkoutId ?? ""}:${detail.assetId}:${detail.jobId ?? ""}`;
      if (checkoutAutoDownloadKeyRef.current === downloadKey) return;
      checkoutAutoDownloadKeyRef.current = downloadKey;
      if (detail.checkoutSyncOk === false) return;

      setVideoSubscriptionModalOpen(false);
      setVideoSubscriptionMedia(null);
      setVideoSubscriptionJobId(undefined);
      setUpgradeError("");
      window.setTimeout(() => {
        void downloadUnlockedThreadVideoFromCheckout({
          checkoutSyncOk: detail.checkoutSyncOk,
          jobId: detail.jobId,
          assetId: detail.assetId
        }).then((downloaded) => {
          if (!downloaded) {
            dispatchAppToast("Payment completed. Please click download again in a moment.", "warning");
          }
        });
      }, 250);
    };

    window.addEventListener(APP_CHECKOUT_SYNCED_EVENT, handleVideoCheckoutSyncedDownload);
    return () => window.removeEventListener(APP_CHECKOUT_SYNCED_EVENT, handleVideoCheckoutSyncedDownload);
  }, [downloadUnlockedThreadVideoFromCheckout, sessionId]);

  const handleUnlockThreadImage = useCallback(async (jobId: string, image: SocialmediaGeneratedImage) => {
    const assetId = image.assetId?.trim();
    captureAnalyticsEvent("pricing_modal_image_unlock_clicked", buildThreadBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(APP_IMAGE_UNLOCK_PACKAGE_ID, {
      action: "image_unlock_click",
      status: "started",
      trigger: subscriptionTrigger,
      checkout_scenario: subscriptionTrigger,
      modal_variant: "post_generation_subscription",
      asset_id: assetId,
      image_index: image.imageIndex,
      job_id: jobId,
      session_id: sessionId
    })));
    if (!account.isLoggedIn) {
      if (assetId) {
        writeAppPendingCheckoutAfterAuth({
          kind: "image_unlock",
          assetId,
          jobId,
          sessionId,
          guestId: account.authMode === "guest" ? account.id : undefined
        });
        writeThreadPendingImageUnlockCheckout({
          assetId,
          jobId,
          trigger: subscriptionTrigger,
          returnPath: `${window.location.pathname}${window.location.search}`,
          billingSurface: "result",
          guestId: account.authMode === "guest" ? account.id : undefined,
          createdAt: new Date().toISOString()
        });
      }
      captureAnalyticsEvent("guest_image_unlock_requires_auth", buildThreadBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(APP_IMAGE_UNLOCK_PACKAGE_ID, {
        action: "auth_required",
        status: "started",
        checkout_scenario: subscriptionTrigger,
        auth_mode: account.authMode ?? "guest",
        asset_id: assetId,
        job_id: jobId,
        session_id: sessionId
      })));
      openThreadAuthModal({ promptCase: "checkout_auth_required" });
      return;
    }
    if (!assetId) {
      openThreadUpgradePricingModal("result", "manual_click");
      return;
    }

    if (await blockCheckoutForForeignThreadOwner({
      packageId: APP_IMAGE_UNLOCK_PACKAGE_ID,
      assetId,
      jobId,
      targetSessionId: sessionId,
      checkoutScenario: subscriptionTrigger,
      surface: "image_unlock"
    })) {
      return;
    }

    setUnlockingAssetId(assetId);
    const imageUnlockOffer = resolveBillingOffer({
      packageId: APP_IMAGE_UNLOCK_PACKAGE_ID,
      market: account.billingMarket ?? "default",
      pricingVariant: effectivePricingVariant
    });
    const imageUnlockCheckoutAnalytics = buildCheckoutAnalyticsProperties(APP_IMAGE_UNLOCK_PACKAGE_ID, {
      action: "checkout_start",
      status: "started",
      checkout_scenario: subscriptionTrigger,
      billing_surface: "result",
      asset_id: assetId,
      job_id: jobId,
      session_id: sessionId,
      pricing_variant: effectivePricingVariant,
      billing_market: account.billingMarket,
      value: imageUnlockOffer.amount,
      currency: imageUnlockOffer.currency
    });
    const checkoutContext = buildThreadBillingAnalyticsProperties(imageUnlockCheckoutAnalytics);
    captureAnalyticsEvent("checkout_started_web", checkoutContext);
    captureAnalyticsEvent("image_unlock_checkout_requested", checkoutContext);
    const googleAdsBeginCheckout = trackGoogleAdsBeginCheckoutConversion({
      dedupeKey: createGoogleAdsCheckoutIntentDedupeKey(APP_IMAGE_UNLOCK_PACKAGE_ID),
      packageId: APP_IMAGE_UNLOCK_PACKAGE_ID,
      value: typeof imageUnlockCheckoutAnalytics.value === "number" ? imageUnlockCheckoutAnalytics.value : undefined,
      currency: typeof imageUnlockCheckoutAnalytics.currency === "string" ? imageUnlockCheckoutAnalytics.currency : undefined
    });
    const checkoutController = new AbortController();
    const checkoutTimeoutId = window.setTimeout(() => checkoutController.abort(), APP_CHECKOUT_START_TIMEOUT_MS);
    try {
      const response = await requestCheckoutWithAuthRecovery("/api/v1/socialmedia/assets/unlock", {
        method: "POST",
        signal: checkoutController.signal,
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": createThreadIdempotencyKey(assetId)
        },
        body: JSON.stringify({
          asset_id: assetId,
          return_to: `${window.location.pathname}${window.location.search}`,
          pricing_variant: effectivePricingVariant,
          checkout_theme: "default",
          attribution: getStoredAttribution()
        })
      }, account.id);
      const data = await response.json().catch(() => ({})) as {
        already_unlocked?: boolean;
        checkout_url?: string;
        transaction_id?: string;
        payment_provider?: string;
        package_id?: string;
        asset_id?: string;
        job_id?: string;
        pricing_variant?: string;
        value?: number;
        currency?: string;
        error?: string;
      };
      if (response.status === 401 || response.status === 403) {
        captureAnalyticsEvent("image_unlock_checkout_failed", buildThreadBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(APP_IMAGE_UNLOCK_PACKAGE_ID, {
          action: "checkout_failed",
          status: "failed",
          statusCode: response.status,
          reason: typeof data.error === "string" ? data.error : "auth_required",
          checkout_scenario: subscriptionTrigger,
          asset_id: assetId,
          job_id: jobId,
          session_id: sessionId
        })));
        captureAnalyticsEvent("checkout_failed", buildThreadBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(APP_IMAGE_UNLOCK_PACKAGE_ID, {
          action: "checkout_failed",
          status: "failed",
          statusCode: response.status,
          reason: typeof data.error === "string" ? data.error : "auth_required",
          asset_id: assetId,
          job_id: jobId,
          session_id: sessionId
        })));
        setSubscriptionModalOpen(false);
        setUpgradePricingModalOpen(false);
        openThreadAuthModal({ promptCase: "checkout_auth_required" });
        return;
      }
      if (!response.ok) {
        throw new Error(data.error || "Unable to start HD unlock.");
      }
      if (data.already_unlocked) {
        captureAnalyticsEvent("image_unlock_already_unlocked", buildThreadBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(APP_IMAGE_UNLOCK_PACKAGE_ID, {
          action: "already_unlocked",
          status: "success",
          checkout_scenario: subscriptionTrigger,
          asset_id: data.asset_id ?? assetId,
          job_id: data.job_id ?? jobId,
          session_id: sessionId
        })));
        await downloadUnlockedThreadImageFromCheckout({
          jobId: data.job_id ?? jobId,
          assetId: data.asset_id ?? assetId,
          downloadSource: "image_unlock"
        });
        setSubscriptionModalOpen(false);
        return;
      }
      if (data.checkout_url) {
        if (data.transaction_id?.trim()) {
          captureAnalyticsEvent("image_unlock_checkout_created", buildThreadBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(APP_IMAGE_UNLOCK_PACKAGE_ID, {
            action: "checkout_created",
            status: "success",
            checkout_scenario: subscriptionTrigger,
            checkout_id: data.transaction_id.trim(),
            asset_id: assetId,
            job_id: jobId,
            session_id: sessionId,
            pricing_variant: data.pricing_variant,
            value: data.value,
            currency: data.currency
          })));
        }
        rememberAppCheckoutContext({
          checkoutId: data.transaction_id,
          packageId: data.package_id || APP_IMAGE_UNLOCK_PACKAGE_ID,
          kind: "image_unlock",
          paymentProvider: data.payment_provider,
          assetId,
          jobId,
          sessionId,
          pricingVariant: data.pricing_variant,
          value: data.value,
          currency: data.currency
        });
        await googleAdsBeginCheckout;
        window.location.href = data.checkout_url;
      }
    } catch (caughtError) {
      const failureMessage = getAppCheckoutFailureMessage(caughtError, "Unable to start HD unlock.");
      captureAnalyticsEvent("image_unlock_checkout_failed", buildThreadBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(APP_IMAGE_UNLOCK_PACKAGE_ID, {
        action: "checkout_failed",
        status: "failed",
        reason: failureMessage,
        checkout_scenario: subscriptionTrigger,
        asset_id: assetId,
        job_id: jobId,
        session_id: sessionId
      })));
      captureAnalyticsEvent("checkout_failed", buildThreadBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(APP_IMAGE_UNLOCK_PACKAGE_ID, {
        action: "checkout_failed",
        status: "failed",
        reason: failureMessage,
        asset_id: assetId,
        job_id: jobId,
        session_id: sessionId
      })));
      setError(getAppCheckoutFailureMessage(caughtError, "Unable to start HD unlock."));
    } finally {
      window.clearTimeout(checkoutTimeoutId);
      setUnlockingAssetId(null);
    }
  }, [
    account.authMode,
    account.billingMarket,
    account.id,
    account.isLoggedIn,
    blockCheckoutForForeignThreadOwner,
    buildThreadBillingAnalyticsProperties,
    downloadUnlockedThreadImageFromCheckout,
    effectivePricingVariant,
    openThreadUpgradePricingModal,
    sessionId,
    subscriptionTrigger
  ]);

  const openThreadSubscriptionModal = useCallback((params: {
    plan: SubscriptionSuccessModalPlan;
    image: SocialmediaGeneratedImage;
    trigger: string;
    selectableImages: SocialmediaGeneratedImage[];
    job?: AppThreadJob;
  }) => {
    if (!pricingAssignmentReady) return;
    const targetJob = params.job ?? findThreadJobForImage(params.image);
    setWatermarkedSignupModalImage(null);
    setWatermarkedSignupImages([]);
    setSubscriptionModalPlan(params.plan);
    setSubscriptionModalImage(params.image);
    setSubscriptionSelectableImages(params.selectableImages.filter((image) => image.url));
    setSubscriptionTrigger(params.trigger);
    setUpgradeError("");
    setSubscriptionModalOpen(true);
    trackGoogleAdsSubscriptionModalViewConversion({
      userId: account.authMode === "supabase" ? account.id : undefined
    });
    captureAnalyticsEvent("pricing_modal_opened", buildThreadBillingAnalyticsProperties({
      action: "pricing_open",
      status: "started",
      trigger: params.trigger,
      checkout_scenario: params.trigger,
      billing_surface: "result",
      surface: "result",
      modal_variant: params.plan === "guest" ? "guest_signup_unlock" : "post_generation_subscription",
      image_unlock_available: Boolean(params.image.assetId),
      asset_id: params.image.assetId,
      image_index: params.image.imageIndex,
      job_id: targetJob?.job_id,
      session_id: targetJob?.session_id || sessionId,
      displayed_image_access_variant: params.image.accessVariant,
      gated_image_count: params.selectableImages.length
    }));
  }, [
    account.authMode,
    account.id,
    buildThreadBillingAnalyticsProperties,
    findThreadJobForImage,
    pricingAssignmentReady,
    sessionId
  ]);

  const openThreadVideoSubscriptionModal = useCallback((
    media: AppThreadMediaItem | undefined,
    job: AppThreadJob | undefined,
    trigger: string
  ) => {
    if (!pricingAssignmentReady || (media && (media.kind !== "video" || !media.url))) return;
    setWatermarkedSignupModalImage(null);
    setWatermarkedSignupImages([]);
    setSubscriptionModalOpen(false);
    setUpgradePricingModalOpen(false);
    setUpgradeError("");
    setVideoPricingDefaultView("subscription");
    setVideoSubscriptionModalOpen(true);
    setVideoSubscriptionMedia(media ?? null);
    setVideoSubscriptionJobId(job?.job_id);
    trackGoogleAdsSubscriptionModalViewConversion({
      userId: account.authMode === "supabase" ? account.id : undefined
    });
    captureAnalyticsEvent("pricing_modal_opened", buildThreadBillingAnalyticsProperties({
      action: "pricing_open",
      status: "started",
      trigger,
      checkout_scenario: trigger,
      billing_surface: "result",
      surface: "result",
      modal_variant: "post_generation_video_subscription",
      asset_id: media?.assetId,
      video_index: media?.index,
      displayed_video_access_variant: media?.accessVariant ?? "none",
      job_id: job?.job_id,
      session_id: job?.session_id || sessionId
    }));
  }, [account.authMode, account.id, buildThreadBillingAnalyticsProperties, pricingAssignmentReady, sessionId]);

  useEffect(() => {
    if (isLoading || error) return;
    if (!accountReady) return;
    if (!pricingAssignmentReady) return;
    if (isBillingReturn) return;
    if (checkoutUnlockRefreshPending) return;
    if (isThreadPaidAccount(account)) return;
    if (subscriptionModalOpen || upgradePricingModalOpen || watermarkedSignupModalImage || videoSubscriptionModalOpen) return;

    const latestVideoJob = [...jobs].reverse().find((job) => (
      job.status === "completed"
      && isThreadVideoJob(job)
      && getThreadJobMedia(job).some((media) => (
        media.kind === "video"
        && media.url
        && media.accessVariant === "watermarked"
      ))
    ));
    if (!latestVideoJob) return;

    const watermarkedVideos = getThreadJobMedia(latestVideoJob).filter((media) => (
      media.kind === "video"
      && media.url
      && media.accessVariant === "watermarked"
    ));
    const firstWatermarkedVideo = watermarkedVideos[0];
    if (!firstWatermarkedVideo) return;

    const promptKey = `video:${latestVideoJob.job_id}:${watermarkedVideos.map((video) => video.assetId || video.url).join("|")}`;
    if (autoThreadVideoSubscriptionPromptKeyRef.current === promptKey) return;

    const timer = window.setTimeout(() => {
      openThreadVideoSubscriptionModal(firstWatermarkedVideo, latestVideoJob, "watermarked_video_result_auto_open");
      autoThreadVideoSubscriptionPromptKeyRef.current = promptKey;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    account.authMode,
    account.id,
    account.isLoggedIn,
    account.plan,
    accountReady,
    checkoutUnlockRefreshPending,
    error,
    isBillingReturn,
    isLoading,
    jobs,
    openThreadVideoSubscriptionModal,
    pricingAssignmentReady,
    subscriptionModalOpen,
    upgradePricingModalOpen,
    videoSubscriptionModalOpen,
    watermarkedSignupModalImage
  ]);

  useEffect(() => {
    if (isLoading || error) return;
    if (!accountReady) return;
    if (isBillingReturn) return;
    if (subscriptionModalOpen || upgradePricingModalOpen || watermarkedSignupModalImage || videoSubscriptionModalOpen) return;
    if (account.authMode === "guest" && !guestSubscriptionPopupReady) return;

    const latestJob = jobs[jobs.length - 1];
    if (!latestJob || latestJob.status !== "completed") return;

    const latestImages = getThreadJobImages(latestJob);
    if (readThreadPendingSignupImageUnlock()) return;
    if (latestImages.length > 0 && latestImages.every((image) => image.accessVariant === "original")) return;

    const lockedPreviewImages = latestImages.filter((image) => (
      image.url
      && image.accessVariant !== "original"
      && image.previewVariant === "masked_blur"
    ));
    const firstLockedPreview = lockedPreviewImages[0];
    if (firstLockedPreview) {
      if (!pricingAssignmentReady) return;
      const promptKey = `locked:${latestJob.job_id}:${lockedPreviewImages.map((image) => image.assetId || image.url).join("|")}`;
      if (autoThreadLockedPreviewPromptKeyRef.current === promptKey) return;

      const timer = window.setTimeout(() => {
        openThreadSubscriptionModal({
          plan: account.authMode === "guest" ? "guest" : "free",
          image: firstLockedPreview,
          trigger: "locked_preview_result",
          selectableImages: lockedPreviewImages,
          job: latestJob
        });
        autoThreadLockedPreviewPromptKeyRef.current = promptKey;
      }, 0);
      return () => window.clearTimeout(timer);
    }

    if (account.isLoggedIn || account.authMode !== "guest") return;

    const watermarkedSignupImages = latestImages.filter(isGuestWatermarkedSignupImage);
    const firstWatermarkedImage = watermarkedSignupImages[0];
    if (!firstWatermarkedImage) return;

    const promptKey = `watermarked:${latestJob.job_id}:${watermarkedSignupImages.map((image) => image.assetId || image.url).join("|")}`;
    if (autoThreadGuestSignupPromptKeyRef.current === promptKey) return;
    autoThreadGuestSignupPromptKeyRef.current = promptKey;

    const timer = window.setTimeout(() => {
      openThreadWatermarkedSignupModal(firstWatermarkedImage, watermarkedSignupImages, { job: latestJob });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    accountReady,
    account.authMode,
    account.isLoggedIn,
    error,
    guestSubscriptionPopupReady,
    isBillingReturn,
    isLoading,
    jobs,
    openThreadSubscriptionModal,
    openThreadWatermarkedSignupModal,
    pricingAssignmentReady,
    subscriptionModalOpen,
    upgradePricingModalOpen,
    videoSubscriptionModalOpen,
    watermarkedSignupModalImage
  ]);

  useEffect(() => {
    if (isLoading || error) return;
    if (!accountReady) return;
    if (!pricingAssignmentReady) return;
    if (isBillingReturn) return;
    if (
      account.authMode !== "supabase"
      || !["free", "basic", "pro"].includes(account.plan)
    ) return;
    if (subscriptionModalOpen || upgradePricingModalOpen || watermarkedSignupModalImage || videoSubscriptionModalOpen) return;

    const latestJob = jobs[jobs.length - 1];
    if (!latestJob || latestJob.status !== "completed") return;

    const latestImages = getThreadJobImages(latestJob).filter((image) => image.url);
    if (!latestImages.length || latestImages.every((image) => image.accessVariant === "original")) return;

    const watermarkedImages = latestImages.filter((image) => (
      image.accessVariant !== "original"
      && image.previewVariant !== "masked_blur"
    ));
    const firstWatermarkedImage = watermarkedImages[0];
    if (!firstWatermarkedImage) return;

    const promptKey = `${account.plan}:${latestJob.job_id}:${watermarkedImages.map((image) => image.assetId || image.url).join("|")}`;
    if (autoThreadSignedInUpgradePromptKeyRef.current === promptKey) return;

    const timer = window.setTimeout(() => {
      openThreadSubscriptionModal({
        plan: "free",
        image: firstWatermarkedImage,
        trigger: "watermark_result_auto_open",
        selectableImages: watermarkedImages,
        job: latestJob
      });
      autoThreadSignedInUpgradePromptKeyRef.current = promptKey;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    accountReady,
    account.authMode,
    account.plan,
    error,
    isBillingReturn,
    isLoading,
    jobs,
    openThreadSubscriptionModal,
    pricingAssignmentReady,
    subscriptionModalOpen,
    upgradePricingModalOpen,
    videoSubscriptionModalOpen,
    watermarkedSignupModalImage
  ]);

  useEffect(() => {
    if (isLoading || error) return;
    if (!accountReady) return;
    if (isBillingReturn) return;
    if (account.isLoggedIn || account.authMode !== "guest") return;
    if (!guestSubscriptionPopupReady) return;
    if (subscriptionModalOpen || upgradePricingModalOpen || watermarkedSignupModalImage || videoSubscriptionModalOpen) return;

    const failedCreditJob = jobs[jobs.length - 1];
    if (
      !failedCreditJob
      || failedCreditJob.status !== "failed"
      || !isThreadCreditPaywallMessage(failedCreditJob.error, failedCreditJob.error_code)
    ) return;

    const promptKey = `credit:${failedCreditJob.job_id}:${failedCreditJob.error || failedCreditJob.error_code || ""}`;
    if (autoThreadGuestCreditPromptKeyRef.current === promptKey) return;
    autoThreadGuestCreditPromptKeyRef.current = promptKey;

    const timer = window.setTimeout(() => {
      openThreadGuestCreditSignupModalWithTelemetry("error", "auto_open", failedCreditJob);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    accountReady,
    account.authMode,
    account.isLoggedIn,
    error,
    guestSubscriptionPopupReady,
    isBillingReturn,
    isLoading,
    jobs,
    openThreadGuestCreditSignupModalWithTelemetry,
    subscriptionModalOpen,
    upgradePricingModalOpen,
    videoSubscriptionModalOpen,
    watermarkedSignupModalImage
  ]);

  const startImageAnimationTask = useCallback(async (params: {
    sourceJob: AppThreadJob;
    image: SocialmediaGeneratedImage;
    kind: AppImageAnimationKind;
    source: AppImageAnimationSource;
    prompt?: string;
    videoDuration?: AppImageVideoDuration;
  }) => {
    const assetId = params.image.assetId?.trim();
    if (!assetId) {
      throw new Error("This image is missing its original asset. Generate or refresh the image, then try again.");
    }
    if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
      throw new Error("Unable to create a new video task in this browser.");
    }

    const isSpotifyCanvas = params.kind === "spotify_canvas";
    const content = isSpotifyCanvas
      ? SPOTIFY_CANVAS_DEFAULT_DISPLAY_PROMPT
      : params.prompt?.trim() ?? "";
    if (!content) throw new Error("Describe how you want the image to move.");

    const nextSessionId = crypto.randomUUID();
    const targetSourceUseCase = isSpotifyCanvas ? "spotify-canvas-generator" : "ai-video-generator";
    const duration = isSpotifyCanvas ? 5 : params.videoDuration ?? 10;
    if (!isSpotifyCanvas && duration !== 5 && duration !== 10 && duration !== 15) {
      throw new Error("Choose a 5s, 10s, or 15s video duration.");
    }
    const aspectRatio = isSpotifyCanvas ? "9:16" : "auto";
    const videoResolution = isSpotifyCanvas
      ? resolveSpotifyCanvasVideoResolution(account)
      : APP_VIDEO_COMPOSER_DEFAULT_RESOLUTION;
    const isAlbumCoverSource = params.source === "album_cover";
    const animationEntryPoint = isAlbumCoverSource
      ? "album_cover_result_animate_menu"
      : "image_result_animate_button";
    const displaySourceAsset: AppComposerSourceAsset = {
      assetId,
      asset_id: assetId,
      bucket: "socialmedia-input-assets",
      url: params.image.url,
      mimeType: "image/*",
      width: params.image.width,
      height: params.image.height,
      role: "reference_image",
      originalName: isAlbumCoverSource ? "Album cover" : "Generated image",
      original_name: isAlbumCoverSource ? "Album cover" : "Generated image"
    };
    const pending: AppPendingThreadSubmit = {
      version: 1,
      sessionId: nextSessionId,
      idempotencyKey: createAppSubmitIdempotencyKey(nextSessionId),
      traceId: createTraceId(),
      toolSlug: targetSourceUseCase,
      sourceUseCase: targetSourceUseCase,
      outputType: "video",
      status: "submitting",
      content,
      language: resolveAppResponseLanguage(content, uiLocale),
      aspectRatio,
      resolution: "1k",
      videoDuration: duration,
      videoModelTier: APP_VIDEO_COMPOSER_DEFAULT_MODEL_TIER,
      videoResolution,
      videoSize: aspectRatio,
      requiredVideoReferenceAssetIds: isSpotifyCanvas ? undefined : [assetId],
      sourceAssets: [displaySourceAsset],
      displaySourceAssets: [displaySourceAsset],
      targetAssets: [{
        assetId,
        asset_id: assetId,
        imageIndex: params.image.imageIndex,
        image_index: params.image.imageIndex,
        parent_job_id: params.sourceJob.job_id
      }],
      parentJobId: params.sourceJob.job_id,
      generationInputText: isSpotifyCanvas
        ? buildSpotifyCanvasSubmittedInputText(content)
        : content,
      attributionSnapshot: getStoredAttribution(),
      createdAt: new Date().toISOString(),
      attemptCount: 0
    };
    const analyticsProperties = {
      userId: account.id,
      user_id: account.id,
      appSessionId: params.sourceJob.session_id,
      session_id: params.sourceJob.session_id,
      source_session_id: params.sourceJob.session_id,
      target_session_id: nextSessionId,
      jobId: params.sourceJob.job_id,
      job_id: params.sourceJob.job_id,
      sourceUseCase: params.sourceJob.source_use_case,
      source_use_case: params.sourceJob.source_use_case,
      targetSourceUseCase,
      target_source_use_case: targetSourceUseCase,
      animation_type: params.kind,
      outputType: "video",
      output_type: "video",
      sourceAssetCount: 1,
      source_asset_count: 1,
      duration,
      video_duration: duration,
      aspectRatio,
      aspect_ratio: aspectRatio,
      resolution: videoResolution,
      video_resolution: videoResolution,
      entry_point: animationEntryPoint,
      plan: account.plan,
      action: "create",
      stage: "result",
      status: "started"
    };
    trackClientEvent(isAlbumCoverSource ? "album_cover.animate.started" : "image_result.animate.started", analyticsProperties);
    captureAnalyticsEvent(isAlbumCoverSource ? "album_cover_animate_started" : "image_result_animate_started", analyticsProperties);
    if (isSpotifyCanvas) {
      trackClientEvent("spotify_canvas.album_cover_cta.clicked", analyticsProperties);
      captureAnalyticsEvent("spotify_canvas_album_cover_cta_clicked", analyticsProperties);
    }

    if (!writePendingThreadSubmit(pending)) {
      throw new Error("Unable to prepare the video task. Please try again.");
    }

    setImageAnimationDraft(null);
    router.push(`/app/chat/${encodeURIComponent(nextSessionId)}?pending=1&refresh=${Date.now()}`);
  }, [account, router, uiLocale]);

  const handleImageAnimate = useCallback(async (
    sourceJob: AppThreadJob,
    image: SocialmediaGeneratedImage,
    kind: AppImageAnimationKind,
    source: AppImageAnimationSource,
    selectableImages: SocialmediaGeneratedImage[] = [image]
  ) => {
    const isAlbumCoverSource = source === "album_cover";
    const animationEntryPoint = isAlbumCoverSource
      ? "album_cover_result_animate_menu"
      : "image_result_animate_button";
    trackClientEvent(isAlbumCoverSource ? "album_cover.animate.clicked" : "image_result.animate.clicked", {
      userId: account.id,
      appSessionId: sourceJob.session_id,
      jobId: sourceJob.job_id,
      sourceUseCase: sourceJob.source_use_case,
      animationType: kind,
      entryPoint: animationEntryPoint,
      plan: account.plan
    });

    if (account.authMode === "guest_claimed") {
      openThreadClaimedGuestAuthModal(account);
      return;
    }
    if (!account.isLoggedIn) {
      openThreadAuthModal();
      return;
    }
    if (!isPaidAppVideoPlan(account)) {
      openThreadVideoPricingModal("result", "manual_click", sourceJob, "animate");
      return;
    }
    if (kind === "video") {
      setImageAnimationDraft({ job: sourceJob, image, selectableImages, source });
      captureAnalyticsEvent(isAlbumCoverSource ? "album_cover_animate_prompt_opened" : "image_result_animate_prompt_opened", {
        job_id: sourceJob.job_id,
        session_id: sourceJob.session_id,
        source_use_case: sourceJob.source_use_case,
        entry_point: animationEntryPoint,
        plan: account.plan
      });
      return;
    }
    await startImageAnimationTask({ sourceJob, image, kind, source });
  }, [account, openThreadVideoPricingModal, startImageAnimationTask]);

  const openThreadPaidCreditTopupModal = useCallback((
    surface: "result" | "error" | "thread" = "error",
    trigger: "auto_open" | "manual_click" = "manual_click",
    job?: AppThreadJob
  ) => {
    if (!pricingAssignmentReady) return;
    if (!canTopUpThreadCredits(account)) {
      if (job && isThreadVideoJob(job)) {
        openThreadVideoPricingModal(surface, trigger, job);
      } else {
        openThreadUpgradePricingModal(surface, trigger, job);
      }
      return;
    }
    captureThreadCreditPromptInteraction({
      promptCase: "paid_depleted_add_credits",
      action: "add_credits",
      surface,
      trigger,
      job
    });
    setWatermarkedSignupModalImage(null);
    setWatermarkedSignupImages([]);
    setSubscriptionModalOpen(false);
    setUpgradePricingModalOpen(false);
    setUpgradeError("");
    setSubscriptionTrigger("paid_credit_topup");
    setVideoPricingDefaultView("credit_pack");
    setVideoSubscriptionMedia(null);
    setVideoSubscriptionJobId(job?.job_id);
    setVideoSubscriptionModalOpen(true);
    captureAnalyticsEvent("pricing_modal_opened", buildThreadBillingAnalyticsProperties({
      action: "pricing_open",
      status: "started",
      trigger: "paid_credit_topup",
      checkout_scenario: "paid_credit_topup",
      billing_surface: surface,
      surface,
      modal_variant: "credit_pack",
      job_id: job?.job_id,
      session_id: job?.session_id || sessionId
    }));
  }, [account, buildThreadBillingAnalyticsProperties, captureThreadCreditPromptInteraction, openThreadUpgradePricingModal, openThreadVideoPricingModal, pricingAssignmentReady, sessionId]);

  useEffect(() => {
    if (isLoading || error) return;
    if (!accountReady) return;
    if (!pricingAssignmentReady) return;
    if (isBillingReturn) return;
    if (account.authMode !== "supabase" || canTopUpThreadCredits(account)) return;
    if (subscriptionModalOpen || upgradePricingModalOpen || watermarkedSignupModalImage || videoSubscriptionModalOpen) return;

    const failedCreditJob = jobs[jobs.length - 1];
    if (
      !failedCreditJob
      || failedCreditJob.status !== "failed"
      || !isThreadCreditPaywallMessage(failedCreditJob.error, failedCreditJob.error_code)
    ) return;

    const creditState = account.credits <= 0 ? "depleted" : "available";
    const promptKey = `signed-in-credit:${creditState}:${failedCreditJob.job_id}:${failedCreditJob.error || failedCreditJob.error_code || ""}`;
    if (autoThreadSignedInCreditPromptKeyRef.current === promptKey) return;

    const timer = window.setTimeout(() => {
      if (isThreadVideoJob(failedCreditJob)) {
        openThreadVideoPricingModal("error", "auto_open", failedCreditJob);
      } else {
        openThreadUpgradePricingModal("error", "auto_open", failedCreditJob);
      }
      autoThreadSignedInCreditPromptKeyRef.current = promptKey;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    account,
    accountReady,
    error,
    isBillingReturn,
    isLoading,
    jobs,
    openThreadUpgradePricingModal,
    openThreadVideoPricingModal,
    pricingAssignmentReady,
    subscriptionModalOpen,
    upgradePricingModalOpen,
    videoSubscriptionModalOpen,
    watermarkedSignupModalImage
  ]);

  const completedClarificationIdsRef = useRef(new Map<string, string>());
  const showCompletedClarification = useCallback((pending: AppPendingThreadSubmit, data: AppComposerSubmitResponse) => {
    if (activeThreadSessionIdRef.current !== pending.sessionId) return;
    const card = readClarificationCard(data.assistant_message?.metadata?.clarificationCard, pending.sourceUseCase);
    if (!card) return;
    completedClarificationIdsRef.current.set(pending.idempotencyKey, card.id);
    pendingSubmitStartedRef.current.delete(pending.idempotencyKey);
    removePendingThreadSubmit(pending);
    setSession((current) => {
      const base = current ?? buildPendingThreadSession(pending);
      return { ...base, agent_mode: data.agent_mode ?? base.agent_mode,
        jobs: (base.jobs ?? []).filter((job) => job.job_id !== getPendingThreadJobId(pending)),
        conversation_turns: appendAppThreadConversationTurn(base.conversation_turns, pending,
          data.assistant_message?.content || card.question, data.cta, card)
      };
    });
  }, []);

  const handleCompletedClarificationError = useCallback((pending: AppPendingThreadSubmit, error: unknown) => {
    const cardId = completedClarificationIdsRef.current.get(pending.idempotencyKey);
    if (!cardId) return false;
    completedClarificationIdsRef.current.delete(pending.idempotencyKey);
    pendingSubmitPayloadsRef.current.delete(pending.idempotencyKey);
    pendingSubmitStartedRef.current.delete(pending.idempotencyKey);
    if (activeThreadSessionIdRef.current === pending.sessionId) {
      const message = error instanceof Error ? error.message : "The connection reported an error after this question was saved.";
      setSession((current) => current ? {
        ...current,
        conversation_turns: current.conversation_turns?.map((turn) => turn.clarification?.id === cardId
          ? { ...turn, clarification_stream_error: message } : turn)
      } : current);
    }
    return true;
  }, []);

  const handleThreadComposerSubmit = useCallback((params: {
    clarificationId?: string;
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
  }) => {
    const now = new Date().toISOString();
    const traceId = createTraceId();
    const pending: AppPendingThreadSubmit = {
      version: 1,
      sessionId,
      idempotencyKey: params.clarificationId ? `clarification-${params.clarificationId}` : createAppSubmitIdempotencyKey(sessionId),
      traceId,
      toolSlug,
      sourceUseCase,
      outputType: params.outputType,
      status: "submitting",
      content: params.content,
      language: resolveSocialmediaSubmissionLanguage({ userInput: params.content, selectedLanguage: uiLocale, outputType: params.outputType }),
      aspectRatio: params.aspectRatio,
      resolution: params.resolution,
      videoModel: params.videoModel,
      videoModelTier: params.videoModelTier,
      videoDuration: params.videoDuration,
      videoResolution: params.videoResolution,
      videoSize: params.videoSize,
      platform: params.platform,
      destination: params.destination,
      sourceAssets: params.sourceAssets,
      displaySourceAssets: params.displaySourceAssets ?? params.sourceAssets,
      targetAssets: params.targetAssets,
      parentJobId: params.parentJobId,
      resultAction: params.resultAction,
      generationInputText: params.generationInputText,
      attributionSnapshot: getStoredAttribution(),
      createdAt: now,
      attemptCount: 0
    };
    const pendingJobId = getPendingThreadJobId(pending);
    const pendingJob = buildPendingThreadJob(pending);

    setError("");
    setIsLoading(false);
    writePendingThreadSubmit(pending);
    pendingSubmitPayloadsRef.current.set(pending.idempotencyKey, pending);
    pendingSubmitStartedRef.current.add(pending.idempotencyKey);
    setSession((current) => {
      const jobsWithoutPending = (current?.jobs ?? []).filter((job) => job.job_id !== pendingJobId);
      return {
        session_id: current?.session_id || sessionId,
        title: current?.title || params.content || "New chat",
        source_use_case: current?.source_use_case || sourceUseCase,
        created_at: current?.created_at || now,
        updated_at: now,
        last_job_id: pendingJob.job_id,
        jobs: sortThreadJobs([...jobsWithoutPending, pendingJob]),
        // The agent can have completed conversational turns before the next
        // request becomes a generation job. Keep those turns visible while the
        // pending job is being submitted; the server refresh will reconcile
        // them once it returns.
        conversation_turns: current?.conversation_turns
      };
    });

    void startPendingThreadSubmit(pending, {
      onClarification: (data) => showCompletedClarification(pending, data),
      onGenerationIntent: (_intent, outputKind) => showPendingGenerationIntent(pendingJobId, outputKind),
      onAssistantContent: (assistantContent) => {
        updatePendingAssistantContent(pendingJobId, assistantContent);
      }
    })
      .then((data) => {
        if (completedClarificationIdsRef.current.delete(pending.idempotencyKey)) {
          pendingSubmitPayloadsRef.current.delete(pending.idempotencyKey);
          return;
        }
        pendingSubmitPayloadsRef.current.delete(pending.idempotencyKey);
        pendingSubmitStartedRef.current.delete(pending.idempotencyKey);
        if (activeThreadSessionIdRef.current !== pending.sessionId) return;
        const sessionRedirect = resolveThreadSubmitSessionRedirect(pending.sessionId, data);
        if (sessionRedirect) {
          removePendingThreadSubmit(pending);
          pendingSubmitStartedRef.current.delete(pending.idempotencyKey);
          router.replace(sessionRedirect);
          return;
        }
        const submittedJob = buildSubmittedThreadJob(pending, data);
        setError("");
        setIsLoading(false);
        setSession((current) => {
          const base = current ?? buildPendingThreadSession(pending);
          const jobsWithoutPending = (base.jobs ?? []).filter((job) => (
            job.job_id !== pendingJobId
            && (!submittedJob || job.job_id !== submittedJob.job_id)
          ));
          if (!submittedJob) {
            const assistantContent = data.assistant_message?.content?.trim();
            return {
              ...base,
              // The message endpoint has already resolved the experiment for
              // this turn. Use that explicit result instead of relying on the
              // cookie that may only be written after the first session load.
              agent_mode: data.agent_mode ?? base.agent_mode,
              updated_at: new Date().toISOString(),
              jobs: jobsWithoutPending,
              conversation_turns: assistantContent
                ? appendAppThreadConversationTurn(base.conversation_turns, pending, assistantContent, data.cta, readClarificationCard(data.assistant_message?.metadata?.clarificationCard, pending.sourceUseCase))
                : base.conversation_turns
            };
          }
          return {
            ...base,
            agent_mode: data.agent_mode ?? base.agent_mode,
            session_id: data.job?.session_id || data.session_id || pending.sessionId,
            source_use_case: base.source_use_case || pending.sourceUseCase,
            updated_at: new Date().toISOString(),
            last_job_id: submittedJob.job_id,
            jobs: sortThreadJobs([...jobsWithoutPending, submittedJob])
          };
        });
        if (submittedJob) {
          window.setTimeout(() => {
            if (activeThreadSessionIdRef.current === pending.sessionId) void loadSession();
          }, 350);
        }
      })
      .catch(async (caughtError) => {
        if (isForbiddenThreadSessionSubmitError(caughtError)) {
          showSessionForbiddenAndRedirect(pending);
          return;
        }
        if (handleCompletedClarificationError(pending, caughtError)) return;
        const rawMessage = caughtError instanceof Error ? caughtError.message : "Failed to start generation.";
        const message = isRetryablePreJobSubmitError(caughtError, pending)
          ? THREAD_GENERATION_SERVICE_ISSUE_MESSAGE
          : rawMessage;
        const errorCode = caughtError instanceof AppComposerSubmitError ? caughtError.code : undefined;
        if (pending.sourceUseCase === "general" && errorCode === "VIDEO_SIGNUP_REQUIRED" && activeThreadSessionIdRef.current === pending.sessionId) openThreadAuthModal();
        const recoveringPending = shouldReconcilePendingThreadSubmitError(caughtError, pending)
          ? updatePendingThreadSubmit(pending, {
              status: "recovering",
              failedAt: undefined,
              lastError: message,
              lastErrorCode: errorCode
            }) ?? {
              ...pending,
              status: "recovering" as const,
              failedAt: undefined,
              lastError: message,
              lastErrorCode: errorCode
            }
          : null;
        if (activeThreadSessionIdRef.current !== pending.sessionId) {
          pendingSubmitPayloadsRef.current.delete(pending.idempotencyKey);
          pendingSubmitStartedRef.current.delete(pending.idempotencyKey);
          return;
        }
        if (recoveringPending) {
          pendingSubmitPayloadsRef.current.set(pending.idempotencyKey, recoveringPending);
          const recoveringJob = buildPendingThreadJob(recoveringPending);
          setIsLoading(false);
          setSession((current) => {
            const base = current ?? buildPendingThreadSession(recoveringPending);
            const jobsWithoutPending = (base.jobs ?? []).filter((job) => job.job_id !== pendingJobId);
            return {
              ...base,
              updated_at: new Date().toISOString(),
              last_job_id: recoveringJob.job_id,
              jobs: sortThreadJobs([...jobsWithoutPending, recoveringJob])
            };
          });

          const recovered = await recoverPendingThreadSubmit(recoveringPending);
          if (recovered) return;
          if (activeThreadSessionIdRef.current !== pending.sessionId) {
            pendingSubmitStartedRef.current.delete(pending.idempotencyKey);
            return;
          }

          const failedPending = updatePendingThreadSubmit(pending, {
            status: "failed",
            failedAt: new Date().toISOString(),
            lastError: APP_PENDING_THREAD_SUBMIT_RECOVERY_FAILED_MESSAGE,
            lastErrorCode: errorCode
          }) ?? {
            ...recoveringPending,
            status: "failed" as const,
            failedAt: new Date().toISOString(),
            lastError: APP_PENDING_THREAD_SUBMIT_RECOVERY_FAILED_MESSAGE,
            lastErrorCode: errorCode
          };
          const failedJob = buildPendingThreadJob(failedPending);
          pendingSubmitPayloadsRef.current.set(pending.idempotencyKey, failedPending);
          setSession((current) => {
            const base = current ?? buildPendingThreadSession(failedPending);
            const jobsWithoutPending = (base.jobs ?? []).filter((job) => job.job_id !== pendingJobId);
            return {
              ...base,
              updated_at: new Date().toISOString(),
              last_job_id: failedJob.job_id,
              jobs: sortThreadJobs([...jobsWithoutPending, failedJob])
            };
          });
          return;
        }
        const storedPending = readPendingThreadSubmit(pending.sessionId);
        const failedPending = storedPending?.idempotencyKey === pending.idempotencyKey
          ? storedPending
          : {
              ...pending,
              status: "failed" as const,
              failedAt: new Date().toISOString(),
              lastError: message,
              lastErrorCode: errorCode
            };
        const failedJob = buildPendingThreadJob(failedPending);
        pendingSubmitPayloadsRef.current.set(pending.idempotencyKey, failedPending);
        setIsLoading(false);
        setSession((current) => {
          const base = current ?? buildPendingThreadSession(pending);
          const jobsWithoutPending = (base.jobs ?? []).filter((job) => job.job_id !== pendingJobId);
          return {
            ...base,
            updated_at: new Date().toISOString(),
            last_job_id: failedJob.job_id,
            jobs: sortThreadJobs([...jobsWithoutPending, failedJob])
          };
        });
        window.setTimeout(() => {
          if (activeThreadSessionIdRef.current === pending.sessionId) void loadSession();
        }, 350);
      })
      .finally(() => {
        pendingSubmitStartedRef.current.delete(pending.idempotencyKey);
      });
  }, [loadSession, recoverPendingThreadSubmit, router, sessionId, showSessionForbiddenAndRedirect, sourceUseCase, toolSlug, uiLocale, updatePendingAssistantContent, showPendingGenerationIntent, showCompletedClarification, handleCompletedClarificationError]);

  const downloadThreadWatermarkedImages = useCallback(async (image: SocialmediaGeneratedImage) => {
    const imagesToDownload = subscriptionSelectableImages.length ? subscriptionSelectableImages : [image];
    const targetJob = findThreadJobForImage(image)
      ?? imagesToDownload.map((item) => findThreadJobForImage(item)).find(Boolean);
    trackClientEvent("socialmedia.download.started", {
      sessionId: targetJob?.session_id || sessionId,
      userId: account.id,
      jobId: targetJob?.job_id,
      action: "download",
      stage: "asset",
      status: "started",
      imageCount: imagesToDownload.length,
      downloadSource: "subscription_modal_watermarked",
      trigger: subscriptionTrigger
    });
    setDownloadingJobId(subscriptionTrigger);
    let downloadedBytes: number | undefined;
    try {
      for (const item of imagesToDownload) {
        const itemJob = findThreadJobForImage(item) ?? targetJob;
        const itemDownloadedBytes = await saveThreadMedia({
          url: item.url,
          kind: "image",
          index: item.imageIndex,
          assetId: item.assetId,
          accessVariant: item.accessVariant,
          previewVariant: item.previewVariant,
          fileName: item.previewFileName,
          promptSummary: item.promptSummary,
          width: item.width,
          height: item.height
        }, item.assetId || subscriptionTrigger);
        if (downloadedBytes === undefined) downloadedBytes = itemDownloadedBytes;
        captureAnalyticsEvent("generation_downloaded", buildThreadGenerationAnalyticsProperties({
          job_id: itemJob?.job_id,
          session_id: itemJob?.session_id || sessionId,
          action: "download",
          stage: "asset",
          status: "success",
          asset_id: item.assetId,
          image_index: item.imageIndex,
          download_source: "subscription_modal_watermarked",
          trigger: subscriptionTrigger,
          checkout_scenario: subscriptionTrigger,
          modal_variant: "post_generation_subscription",
          is_watermarked_download: true
        }));
        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }
      captureAnalyticsEvent("pricing_modal_watermarked_download_clicked", buildThreadBillingAnalyticsProperties({
        action: "download_watermarked",
        status: "success",
        trigger: subscriptionTrigger,
        checkout_scenario: subscriptionTrigger,
        billing_surface: "result",
        surface: "result",
        modal_variant: "post_generation_subscription",
        displayed_plan: subscriptionModalPlan,
        displayed_image_access_variant: image.accessVariant,
        asset_id: image.assetId,
        image_index: image.imageIndex,
        job_id: targetJob?.job_id,
        session_id: targetJob?.session_id || sessionId,
        download_image_count: imagesToDownload.length
      }));
      return { downloadedBytes };
    } finally {
      setDownloadingJobId(null);
    }
  }, [
    account.id,
    buildThreadBillingAnalyticsProperties,
    buildThreadGenerationAnalyticsProperties,
    findThreadJobForImage,
    sessionId,
    subscriptionModalPlan,
    subscriptionSelectableImages,
    subscriptionTrigger
  ]);

  const closeThreadWatermarkedSignupModal = useCallback(() => {
    setWatermarkedSignupModalImage(null);
    setWatermarkedSignupImages([]);
  }, []);

  const downloadThreadWatermarkedSignupImages = useCallback(async () => {
    if (!watermarkedSignupModalImage) return;
    const imagesToDownload = watermarkedSignupImages.length ? watermarkedSignupImages : [watermarkedSignupModalImage];
    const targetJob = findThreadJobForImage(watermarkedSignupModalImage)
      ?? imagesToDownload.map((item) => findThreadJobForImage(item)).find(Boolean);
    trackClientEvent("socialmedia.download.started", {
      sessionId: targetJob?.session_id || sessionId,
      userId: account.id,
      jobId: targetJob?.job_id,
      action: "download",
      stage: "asset",
      status: "started",
      imageCount: imagesToDownload.length,
      downloadSource: "watermarked_signup_modal",
      trigger: "watermarked_signup_modal"
    });
    for (const item of imagesToDownload) {
      const itemJob = findThreadJobForImage(item) ?? targetJob;
      await saveThreadMedia({
        url: item.url,
        kind: "image",
        index: item.imageIndex,
        assetId: item.assetId,
        accessVariant: item.accessVariant,
        previewVariant: item.previewVariant,
        fileName: item.previewFileName,
        promptSummary: item.promptSummary,
        width: item.width,
        height: item.height
      }, item.assetId || sessionId);
      captureAnalyticsEvent("generation_downloaded", buildThreadGenerationAnalyticsProperties({
        job_id: itemJob?.job_id,
        session_id: itemJob?.session_id || sessionId,
        action: "download",
        stage: "asset",
        status: "success",
        image_index: item.imageIndex,
        asset_id: item.assetId,
        download_source: "watermarked_signup_modal",
        trigger: "watermarked_signup_modal",
        checkout_scenario: "watermarked_signup_modal",
        modal_variant: "watermarked_signup_modal",
        is_watermarked_download: true
      }));
      await new Promise((resolve) => window.setTimeout(resolve, 120));
    }
    captureAnalyticsEvent("pricing_modal_watermarked_download_clicked", buildThreadBillingAnalyticsProperties({
      action: "download_watermarked",
      status: "success",
      trigger: "watermarked_signup_modal",
      checkout_scenario: "watermarked_signup_modal",
      billing_surface: "result",
      surface: "result",
      modal_variant: "watermarked_signup_modal",
      displayed_plan: "guest",
      displayed_image_access_variant: watermarkedSignupModalImage.accessVariant,
      asset_id: watermarkedSignupModalImage.assetId,
      image_index: watermarkedSignupModalImage.imageIndex,
      job_id: targetJob?.job_id,
      session_id: targetJob?.session_id || sessionId,
      download_image_count: imagesToDownload.length
    }));
  }, [
    account.id,
    buildThreadBillingAnalyticsProperties,
    buildThreadGenerationAnalyticsProperties,
    findThreadJobForImage,
    sessionId,
    watermarkedSignupImages,
    watermarkedSignupModalImage
  ]);

  const openThreadImagePreview = useCallback((
    job: AppThreadJob,
    items: AppThreadMediaItem[],
    startIndex: number,
    thumbnailUrl?: string
  ) => {
    const previewItems: AppImagePreviewItem<AppThreadImagePreviewData>[] = items
      .filter((item) => item.kind === "image" && item.url)
      .map((item, index) => ({
        url: item.url,
        alt: item.promptSummary || `Generated image ${item.index + 1}`,
        // Keep the chat thumbnail optimized, but show the full source file in the preview dialog.
        unoptimized: item.accessVariant === "original",
        ...(index === startIndex && thumbnailUrl ? { placeholderUrl: thumbnailUrl } : {}),
        data: { job, media: item }
      }));
    if (!previewItems.length) return;
    setImagePreview({
      items: previewItems,
      index: Math.max(0, Math.min(startIndex, previewItems.length - 1))
    });
  }, []);

  const openThreadSourceImagePreview = useCallback((
    assets: AppThreadSourceAsset[],
    startIndex: number,
    thumbnailUrl?: string
  ) => {
    const validAssets = assets
      .map((asset, index) => ({ asset, index }))
      .filter(({ asset }) => Boolean(asset.url?.trim()));
    const previewIndex = validAssets.findIndex(({ index }) => index === startIndex);
    const previewItems: AppImagePreviewItem<AppThreadImagePreviewData>[] = validAssets
      .map(({ asset, index }) => ({
        url: asset.url!.trim(),
        alt: asset.originalName || asset.original_name || `Uploaded image ${index + 1}`,
        ...(index === startIndex && thumbnailUrl ? { placeholderUrl: thumbnailUrl } : {}),
        data: { sourceAsset: asset }
      }));
    if (!previewItems.length) return;
    setImagePreview({
      items: previewItems,
      index: Math.max(0, Math.min(previewIndex, previewItems.length - 1))
    });
  }, []);

  const closeThreadImagePreview = useCallback(() => {
    setImagePreview(null);
  }, []);

  const subscribeFromThreadSubscriptionModal = useCallback(async (
    packageId: RechargePackageId,
    checkoutContext?: { assetId?: string; jobId?: string; sessionId?: string },
    requestedCta?: SubscriptionCta
  ) => {
    const selectedPlan = subscriptionModalPlans.find((item) => item.packageId === packageId);
    const plan = getAppCheckoutPlanName(packageId, subscriptionModalPlans);
    const targetAssetId = checkoutContext?.assetId ?? subscriptionModalImage?.assetId;
    const jobId = checkoutContext?.jobId
      ?? jobs.find((job) => getThreadJobImages(job).some((image) => image.assetId === targetAssetId))?.job_id;
    const targetSessionId = checkoutContext?.sessionId ?? sessionId;
    const isPostGenerationSubscriptionModal = subscriptionModalOpen;
    const ctaPosition = isPostGenerationSubscriptionModal
      ? requestedCta?.position ?? "primary_button"
      : "upgrade_pricing";
    const ctaLabel = isPostGenerationSubscriptionModal ? requestedCta?.label : undefined;
    const modalVariant = isPostGenerationSubscriptionModal ? "post_generation_subscription" : "upgrade_pricing_modal";
    const subscriptionClickScenario = ctaPosition === "watermarked_tips_button"
      ? "watermarked_tips_subscription"
      : getAppSubscriptionClickScenario(subscriptionTrigger, modalVariant);
    const clickContext = buildThreadBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(packageId, {
      action: "subscribe_click",
      status: "started",
      package_id: packageId,
      checkout_plan: plan,
      plan,
      pricing_variant: effectivePricingVariant,
      pricing_experiment_key: PRICING_EXPERIMENT_KEY,
      trigger: subscriptionTrigger,
      checkout_scenario: subscriptionTrigger,
      modal_variant: modalVariant,
      cta_position: ctaPosition,
      cta_label: ctaLabel,
      subscription_click_scenario: subscriptionClickScenario,
      billing_surface: isPostGenerationSubscriptionModal ? "result" : "upgrade_modal",
      asset_id: targetAssetId,
      job_id: jobId,
      session_id: targetSessionId
    }));
    captureAnalyticsEvent("pricing_modal_subscribe_clicked", clickContext);
    captureAnalyticsEvent("checkout_plan_selected", clickContext);
    if (!account.isLoggedIn) {
      writeAppPendingCheckoutAfterAuth({
        kind: "subscription",
        packageId,
        assetId: targetAssetId,
        jobId,
        sessionId: targetSessionId,
        guestId: account.authMode === "guest" ? account.id : undefined
      });
      captureAnalyticsEvent("guest_upgrade_requires_auth", buildThreadBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(packageId, {
        action: "auth_required",
        status: "started",
        checkout_scenario: subscriptionTrigger,
        cta_position: ctaPosition,
        cta_label: ctaLabel,
        auth_mode: account.authMode ?? "guest",
        asset_id: targetAssetId,
        job_id: jobId,
        session_id: targetSessionId
      })));
      openThreadAuthModal({ promptCase: "checkout_auth_required" });
      return;
    }

    if (await blockCheckoutForForeignThreadOwner({
      packageId,
      assetId: targetAssetId,
      jobId,
      targetSessionId,
      checkoutScenario: subscriptionTrigger,
      surface: "subscription"
    })) {
      return;
    }

    setRechargePendingPackage(packageId);
    setUpgradeError("");
    captureAnalyticsEvent("checkout_started_web", buildThreadBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(packageId, {
      action: "checkout_start",
      status: "started",
      package_id: packageId,
      checkout_plan: plan,
      plan,
      pricing_variant: effectivePricingVariant,
      pricing_experiment_key: PRICING_EXPERIMENT_KEY,
      trigger: subscriptionTrigger,
      checkout_scenario: subscriptionTrigger,
      modal_variant: modalVariant,
      cta_position: ctaPosition,
      cta_label: ctaLabel,
      subscription_click_scenario: subscriptionClickScenario,
      billing_surface: isPostGenerationSubscriptionModal ? "result" : "upgrade_modal",
      asset_id: targetAssetId,
      job_id: jobId,
      session_id: targetSessionId,
      value: selectedPlan?.value,
      currency: selectedPlan?.currency
    })));
    const checkoutIntentKey = createGoogleAdsCheckoutIntentDedupeKey(packageId);
    const googleAdsBeginCheckout = trackGoogleAdsBeginCheckoutConversion({
      dedupeKey: checkoutIntentKey,
      packageId,
      value: selectedPlan?.value,
      currency: selectedPlan?.currency
    });
    const checkoutController = new AbortController();
    const checkoutTimeoutId = window.setTimeout(() => checkoutController.abort(), APP_CHECKOUT_START_TIMEOUT_MS);
    try {
      const response = await requestCheckoutWithAuthRecovery("/api/v1/credits/recharge", {
        method: "POST",
        signal: checkoutController.signal,
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": createAppRechargeIdempotencyKey(packageId)
        },
        body: JSON.stringify({
          package_id: packageId,
          pricing_variant: effectivePricingVariant,
          checkout_context: effectivePricingVariant === "2.4"
            && isV24ImageCreditPackPackageId(packageId)
              ? IMAGE_CREDIT_PACK_CHECKOUT_TYPE
              : sourceUseCase === "ai-image-text-editor"
                && (effectivePricingVariant === "1.9" || effectivePricingVariant === "2.5")
                && isImageCreditPackPackageId(packageId)
                  ? IMAGE_CREDIT_PACK_CHECKOUT_TYPE
                  : isVideoCreditPackPackageId(packageId)
                    ? VIDEO_CREDIT_PACK_CHECKOUT_TYPE
                    : undefined,
          asset_id: targetAssetId,
          job_id: jobId,
          session_id: targetSessionId,
          return_to: `${window.location.pathname}${window.location.search}`,
          discount_code: selectedPlan?.discountRequestCode,
          checkout_theme: "default",
          attribution: getStoredAttribution()
        })
      }, account.id);
      const data = await response.json().catch(() => ({})) as {
        checkout_url?: string;
        transaction_id?: string;
        payment_provider?: string;
        package_id?: string;
        pricing_variant?: string;
        value?: number;
        currency?: string;
        error?: string;
      };
      if (response.status === 401 || response.status === 403) {
        captureAnalyticsEvent("checkout_failed", buildThreadBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(packageId, {
          action: "checkout_failed",
          status: "failed",
          statusCode: response.status,
          reason: typeof data.error === "string" ? data.error : "auth_required",
          asset_id: targetAssetId,
          job_id: jobId,
          session_id: targetSessionId
        })));
        setSubscriptionModalOpen(false);
        setUpgradePricingModalOpen(false);
        openThreadAuthModal({ promptCase: "checkout_auth_required" });
        return;
      }
      if (!response.ok) {
        throw new Error(data.error || "Checkout failed.");
      }
      if (!data.checkout_url) {
        throw new Error("Checkout link is missing.");
      }
      rememberAppCheckoutContext({
        checkoutId: data.transaction_id,
        packageId: data.package_id || packageId,
        kind: "subscription",
        paymentProvider: data.payment_provider,
        pricingVariant: data.pricing_variant ?? effectivePricingVariant,
        assetId: targetAssetId,
        jobId,
        sessionId: targetSessionId,
        value: data.value ?? selectedPlan?.value,
        currency: data.currency ?? selectedPlan?.currency
      });
      await googleAdsBeginCheckout;
      window.location.href = data.checkout_url;
    } catch (caughtError) {
      const failureMessage = getAppCheckoutFailureMessage(caughtError);
      captureAnalyticsEvent("checkout_failed", buildThreadBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(packageId, {
        action: "checkout_failed",
        status: "failed",
        reason: failureMessage,
        asset_id: targetAssetId,
        job_id: jobId,
        session_id: targetSessionId
      })));
      setUpgradeError(failureMessage);
    } finally {
      window.clearTimeout(checkoutTimeoutId);
      setRechargePendingPackage("");
    }
  }, [
    account.authMode,
    account.id,
    account.isLoggedIn,
    blockCheckoutForForeignThreadOwner,
    buildThreadBillingAnalyticsProperties,
    effectivePricingVariant,
    jobs,
    sessionId,
    sourceUseCase,
    subscriptionModalImage?.assetId,
    subscriptionModalOpen,
    subscriptionModalPlans,
    subscriptionTrigger
  ]);

  const closeThreadSubscriptionModal = useCallback(() => {
    captureAnalyticsEvent("pricing_modal_closed", buildThreadBillingAnalyticsProperties({
      action: "pricing_close",
      status: "dismissed",
      trigger: subscriptionTrigger,
      checkout_scenario: subscriptionTrigger,
      billing_surface: "result",
      surface: "result",
      modal_variant: subscriptionModalPlan === "guest" ? "guest_signup_unlock" : "post_generation_subscription",
      close_method: "x_button",
      displayed_plan: subscriptionModalPlan,
      displayed_image_access_variant: subscriptionModalImage?.accessVariant,
      asset_id: subscriptionModalImage?.assetId,
      image_index: subscriptionModalImage?.imageIndex
    }));
    setSubscriptionModalOpen(false);
  }, [
    buildThreadBillingAnalyticsProperties,
    subscriptionModalImage?.accessVariant,
    subscriptionModalImage?.assetId,
    subscriptionModalImage?.imageIndex,
    subscriptionModalPlan,
    subscriptionTrigger
  ]);

  const closeThreadUpgradePricingModal = useCallback(() => {
    captureAnalyticsEvent("pricing_modal_closed", buildThreadBillingAnalyticsProperties({
      action: "pricing_close",
      status: "dismissed",
      trigger: subscriptionTrigger,
      checkout_scenario: subscriptionTrigger,
      billing_surface: "upgrade_modal",
      surface: "upgrade_modal",
      modal_variant: "upgrade_pricing_modal",
      close_method: "x_button"
    }));
    setUpgradePricingModalOpen(false);
    setUpgradePricingModalPresentation(null);
  }, [buildThreadBillingAnalyticsProperties, subscriptionTrigger]);

  const selectThreadUpgradePricingModalPlan = useCallback((
    packageId: RechargePackageId,
    previousPackageId: RechargePackageId
  ) => {
    const selectedPlan = subscriptionModalPlans.find((item) => item.packageId === packageId);
    const plan = getAppCheckoutPlanName(packageId, subscriptionModalPlans);
    const previousPlan = getAppCheckoutPlanName(previousPackageId, subscriptionModalPlans);
    captureAnalyticsEvent("pricing_modal_plan_selected", buildThreadBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(packageId, {
      action: "plan_select",
      status: "started",
      package_id: packageId,
      selected_package_id: packageId,
      checkout_plan: plan,
      plan,
      selected_plan: plan,
      previous_package_id: previousPackageId,
      previous_plan: previousPlan,
      pricing_variant: effectivePricingVariant,
      pricing_experiment_key: PRICING_EXPERIMENT_KEY,
      trigger: subscriptionTrigger,
      checkout_scenario: "manual_upgrade_modal",
      modal_variant: "upgrade_pricing_modal",
      billing_surface: "upgrade_modal",
      surface: "upgrade_modal",
      value: selectedPlan?.value,
      currency: selectedPlan?.currency
    })));
  }, [
    buildThreadBillingAnalyticsProperties,
    effectivePricingVariant,
    subscriptionModalPlans,
    subscriptionTrigger
  ]);

  const selectThreadSubscriptionModalPlan = useCallback((
    packageId: RechargePackageId,
    previousPackageId: RechargePackageId
  ) => {
    const selectedPlan = subscriptionModalPlans.find((item) => item.packageId === packageId);
    const plan = getAppCheckoutPlanName(packageId, subscriptionModalPlans);
    const previousPlan = getAppCheckoutPlanName(previousPackageId, subscriptionModalPlans);
    captureAnalyticsEvent("pricing_modal_plan_selected", buildThreadBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(packageId, {
      action: "plan_select",
      status: "started",
      package_id: packageId,
      selected_package_id: packageId,
      checkout_plan: plan,
      plan,
      selected_plan: plan,
      previous_package_id: previousPackageId,
      previous_plan: previousPlan,
      pricing_variant: effectivePricingVariant,
      pricing_experiment_key: PRICING_EXPERIMENT_KEY,
      trigger: subscriptionTrigger,
      checkout_scenario: subscriptionTrigger,
      modal_variant: "post_generation_subscription",
      billing_surface: "result",
      surface: "result",
      asset_id: subscriptionModalImage?.assetId,
      image_index: subscriptionModalImage?.imageIndex,
      displayed_image_access_variant: subscriptionModalImage?.accessVariant,
      selection_method: "manual_select",
      value: selectedPlan?.value,
      currency: selectedPlan?.currency
    })));
  }, [
    buildThreadBillingAnalyticsProperties,
    effectivePricingVariant,
    subscriptionModalImage?.accessVariant,
    subscriptionModalImage?.assetId,
    subscriptionModalImage?.imageIndex,
    subscriptionModalPlans,
    subscriptionTrigger
  ]);

  const trackThreadCreditPackModalOpened = useCallback((
    packageIds: RechargePackageId[],
    image: SocialmediaGeneratedImage
  ) => {
    const targetJob = findThreadJobForImage(image);
    captureAnalyticsEvent("pricing_modal_opened", buildThreadBillingAnalyticsProperties({
      action: "pricing_open",
      status: "started",
      trigger: subscriptionTrigger,
      checkout_scenario: subscriptionTrigger,
      billing_surface: "result",
      surface: "result",
      modal_variant: "credit_pack",
      credit_pack_package_ids: packageIds,
      image_unlock_available: Boolean(image.assetId),
      asset_id: image.assetId,
      image_index: image.imageIndex,
      job_id: targetJob?.job_id,
      session_id: targetJob?.session_id || sessionId,
      displayed_image_access_variant: image.accessVariant,
      gated_image_count: subscriptionSelectableImages.length
    }));
  }, [
    buildThreadBillingAnalyticsProperties,
    findThreadJobForImage,
    sessionId,
    subscriptionSelectableImages.length,
    subscriptionTrigger
  ]);

  const selectThreadCreditPackModalPlan = useCallback((
    packageId: RechargePackageId,
    previousPackageId: RechargePackageId,
    image: SocialmediaGeneratedImage
  ) => {
    const selectedPlan = subscriptionModalPlans.find((item) => item.packageId === packageId);
    const plan = getAppCheckoutPlanName(packageId, subscriptionModalPlans);
    const previousPlan = getAppCheckoutPlanName(previousPackageId, subscriptionModalPlans);
    const targetJob = findThreadJobForImage(image);
    captureAnalyticsEvent("pricing_modal_plan_selected", buildThreadBillingAnalyticsProperties(buildCheckoutAnalyticsProperties(packageId, {
      action: "plan_select",
      status: "started",
      package_id: packageId,
      selected_package_id: packageId,
      checkout_plan: plan,
      plan,
      selected_plan: plan,
      previous_package_id: previousPackageId,
      previous_plan: previousPlan,
      pricing_variant: effectivePricingVariant,
      pricing_experiment_key: PRICING_EXPERIMENT_KEY,
      trigger: subscriptionTrigger,
      checkout_scenario: subscriptionTrigger,
      modal_variant: "credit_pack",
      billing_surface: "result",
      surface: "result",
      asset_id: image.assetId,
      image_index: image.imageIndex,
      job_id: targetJob?.job_id,
      session_id: targetJob?.session_id || sessionId,
      displayed_image_access_variant: image.accessVariant,
      selection_method: "manual_select",
      value: selectedPlan?.value,
      currency: selectedPlan?.currency
    })));
  }, [
    buildThreadBillingAnalyticsProperties,
    effectivePricingVariant,
    findThreadJobForImage,
    sessionId,
    subscriptionModalPlans,
    subscriptionTrigger
  ]);

  useEffect(() => {
    if (!account.isLoggedIn) return;
    const pending = readAppPendingCheckoutAfterAuth();
    if (!pending) return;
    if (pending.sessionId && pending.sessionId !== sessionId) return;

    clearAppPendingCheckoutAfterAuth();
    clearAppGuestClaimCheckoutReady();
    if (pending.kind === "subscription" && pending.packageId) {
      void subscribeFromThreadSubscriptionModal(pending.packageId, {
        assetId: pending.assetId,
        jobId: pending.jobId,
        sessionId: pending.sessionId ?? sessionId
      });
      return;
    }
    if (pending.kind === "image_unlock" && pending.assetId) {
      void handleUnlockThreadImage(pending.jobId ?? "", {
        assetId: pending.assetId,
        imageIndex: 0,
        url: "",
        accessVariant: "watermarked",
        previewVariant: "watermarked"
      });
    }
  }, [
    account.isLoggedIn,
    account.id,
    guestClaimCheckoutReadyToken,
    handleUnlockThreadImage,
    sessionId,
    subscribeFromThreadSubscriptionModal
  ]);

  const rememberThreadGuestSignupUnlock = useCallback((image: SocialmediaGeneratedImage, provider?: "google" | "apple" | "email"): boolean => {
    if (!image.assetId) return false;
    const jobId = jobs.find((job) => getThreadJobImages(job).some((item) => item.assetId === image.assetId))?.job_id;
    writeThreadPendingSignupImageUnlock({
      assetId: image.assetId,
      jobId,
      sessionId,
      guestId: account.authMode === "guest" ? account.id : undefined,
      createdAt: new Date().toISOString()
    });
    captureAnalyticsEvent("guest_download_signup_unlock_clicked", buildThreadBillingAnalyticsProperties({
      action: "signup_unlock_click",
      status: "started",
      provider,
      trigger: subscriptionTrigger,
      checkout_scenario: subscriptionTrigger,
      modal_variant: "guest_signup_unlock",
      asset_id: image.assetId,
      image_index: image.imageIndex,
      job_id: jobId,
      auth_mode: account.authMode ?? "guest"
    }));
    return true;
  }, [account.authMode, account.id, buildThreadBillingAnalyticsProperties, jobs, sessionId, subscriptionTrigger]);

  const handleThreadGuestSignupUnlock = useCallback((image: SocialmediaGeneratedImage) => {
    rememberThreadGuestSignupUnlock(image);
    setSubscriptionModalOpen(false);
    openThreadAuthModal();
  }, [rememberThreadGuestSignupUnlock]);

  const startThreadGuestSignupProvider = useCallback(async (provider: "google" | "apple", image: SocialmediaGeneratedImage) => {
    if (!rememberThreadGuestSignupUnlock(image, provider)) return;
    resetOAuthFailureReportDedupe();
    await prepareGuestClaimIntent();
    setSubscriptionModalOpen(false);
    setWatermarkedSignupModalImage(null);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      openThreadAuthModal();
      return;
    }
    const redirectTo = `${window.location.origin}${buildOAuthCallbackPath(`${window.location.pathname}${window.location.search}`, provider)}`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo }
    });
    if (authError) {
      captureAnalyticsEvent("oauth_failed", {
        ...oauthFailureFromError(authError, provider, "oauth_start"),
        status: "failed"
      });
      void clearGuestClaimIntent();
      setUpgradeError(t(uiLocale, "workbench.auth.errors.signInFailed"));
    }
  }, [rememberThreadGuestSignupUnlock, uiLocale]);

  const startThreadGuestSignupEmail = useCallback(async (image: SocialmediaGeneratedImage): Promise<boolean> => {
    if (!rememberThreadGuestSignupUnlock(image, "email")) return false;
    await prepareGuestClaimIntent();
    return true;
  }, [rememberThreadGuestSignupUnlock]);

  const trackThreadExistingAccountGuestClaimSkipped = useCallback((pending: ThreadPendingSignupImageUnlock) => {
    captureAnalyticsEvent("guest_claim_skipped", buildThreadBillingAnalyticsProperties({
      action: "guest_claim",
      status: "skipped",
      reason: "existing_account_no_merge",
      guest_id: pending.guestId,
      asset_id: pending.assetId,
      job_id: pending.jobId,
      session_id: pending.sessionId ?? sessionId,
      auth_mode: account.authMode
    }));
  }, [account.authMode, buildThreadBillingAnalyticsProperties, sessionId]);

  const finalizePendingThreadGuestClaim = useCallback(async (pending: ThreadPendingSignupImageUnlock): Promise<void> => {
    const pendingKey = [pending.guestId, pending.assetId, pending.jobId, pending.createdAt].join(":");
    const outcome = await threadGuestClaimCoordinatorRef.current.run(() => (
      claimThreadGuestAccountForSignedInUser(pending.guestId, {
        unlockAssetId: pending.assetId,
        unlockJobId: pending.jobId
      })
    ));
    if (finalizedThreadGuestClaimKeysRef.current.has(pendingKey)) return;
    finalizedThreadGuestClaimKeysRef.current.add(pendingKey);

    if (outcome === "existing_account") {
      trackThreadExistingAccountGuestClaimSkipped(pending);
      clearThreadPendingSignupImageUnlock();
      window.dispatchEvent(new Event("vismuse:account-updated"));
      return;
    }

    clearThreadPendingSignupImageUnlock();
    window.dispatchEvent(new Event("vismuse:account-updated"));
    await refreshSessionForUnlocks();
  }, [refreshSessionForUnlocks, trackThreadExistingAccountGuestClaimSkipped]);

  const completeThreadGuestSignupEmailAuth = useCallback(async () => {
    const pending = readThreadPendingSignupImageUnlock();
    setSubscriptionModalOpen(false);
    setWatermarkedSignupModalImage(null);
    try {
      if (pending) {
        await finalizePendingThreadGuestClaim(pending);
        return;
      }
      window.dispatchEvent(new Event("vismuse:account-updated"));
      await refreshSessionForUnlocks();
    } catch {
      // The sign-up dialog is already closed, so report post-auth failures on
      // the current page instead of rejecting the form's fire-and-forget task.
      const message = "You're signed in, but we couldn't refresh this image. Please reload the chat.";
      setUpgradeError(message);
      dispatchAppToast(message, "warning");
    }
  }, [finalizePendingThreadGuestClaim, refreshSessionForUnlocks]);

  const retryPendingThreadSubmit = useCallback((job: AppThreadJob) => {
    const requestKey = job.socialmedia?.submitIdempotencyKey?.trim();
    const retainedPending = requestKey
      ? pendingSubmitPayloadsRef.current.get(requestKey)
      : undefined;
    const storedPending = readPendingThreadSubmit(job.session_id);
    const pending = resolveThreadSubmitRetryRequest(
      requestKey ? { sessionId: job.session_id, idempotencyKey: requestKey } : null,
      retainedPending,
      storedPending
    );
    if (!pending || getPendingThreadJobId(pending) !== job.job_id) {
      void loadSession();
      return;
    }
    if (pending.lastErrorCode === "VIDEO_SIGNUP_REQUIRED" && !account.isLoggedIn) {
      const waiting = updatePendingThreadSubmit(pending, { resumeAfterAuth: true })
        ?? { ...pending, resumeAfterAuth: true };
      pendingSubmitPayloadsRef.current.set(waiting.idempotencyKey, waiting);
      openThreadAuthModal();
      return;
    }
    const retryPending: AppPendingThreadSubmit = {
      ...pending,
      resumeAfterAuth: false,
      status: "submitting",
      failedAt: undefined,
      lastError: undefined,
      lastErrorCode: undefined
    };
    updatePendingThreadSubmit(pending, retryPending);
    pendingSubmitPayloadsRef.current.set(retryPending.idempotencyKey, retryPending);
    pendingSubmitRetryRequestRef.current = retryPending;
    pendingSubmitStartedRef.current.delete(retryPending.idempotencyKey);
    setError("");
    setIsLoading(false);
    setSession((current) => {
      const retryJob = buildPendingThreadJob(retryPending);
      const jobsWithoutPending = (current?.jobs ?? []).filter((item) => item.job_id !== retryJob.job_id);
      return {
        session_id: current?.session_id || retryPending.sessionId,
        title: current?.title || retryPending.content || "New chat",
        source_use_case: current?.source_use_case || retryPending.sourceUseCase,
        created_at: current?.created_at || retryPending.createdAt,
        updated_at: new Date().toISOString(),
        last_job_id: retryJob.job_id,
        jobs: sortThreadJobs([...jobsWithoutPending, retryJob])
      };
    });
    setPendingSubmitRetryKey((current) => current + 1);
  }, [account.isLoggedIn, loadSession]);

  useEffect(() => {
    const cancelAuthResume = () => {
      const pending = readPendingThreadSubmit(sessionId);
      if (!pending || pending.lastErrorCode !== "VIDEO_SIGNUP_REQUIRED") return;
      const cancelled = updatePendingThreadSubmit(pending, { resumeAfterAuth: false });
      if (cancelled) pendingSubmitPayloadsRef.current.set(cancelled.idempotencyKey, cancelled);
    };
    window.addEventListener("vismuse:auth-modal-closed", cancelAuthResume);
    return () => window.removeEventListener("vismuse:auth-modal-closed", cancelAuthResume);
  }, [sessionId]);

  useEffect(() => {
    if (!account.isLoggedIn || !requestIdentityReady) return;
    const pending = readPendingThreadSubmit(sessionId);
    if (!pending || pending.status !== "failed" || pending.lastErrorCode !== "VIDEO_SIGNUP_REQUIRED" || !pending.resumeAfterAuth) return;
    // Reuse the retained request and idempotency key once the claimed identity is ready.
    retryPendingThreadSubmit(buildPendingThreadJob(pending));
  }, [account.isLoggedIn, account.id, requestIdentityReady, sessionId, pendingSubmitRetryKey, retryPendingThreadSubmit]);

  useLayoutEffect(() => {
    activeThreadSessionIdRef.current = sessionId;
    return () => { activeThreadSessionIdRef.current = ""; };
  }, [sessionId]);

  useEffect(() => {
    if (!requestIdentityReady) return;
    const retryPending = pendingSubmitRetryRequestRef.current;
    const pending = retryPending?.sessionId === sessionId
      ? retryPending
      : readPendingThreadSubmit(sessionId);
    if (!pending) return;
    if (pending.status === "failed" && pending.lastErrorCode === "SESSION_FORBIDDEN") {
      showSessionForbiddenAndRedirect(pending);
      return;
    }
    if (retryPending === pending) pendingSubmitRetryRequestRef.current = null;
    pendingSubmitPayloadsRef.current.set(pending.idempotencyKey, pending);

    const currentJobs = sessionRef.current?.session_id === pending.sessionId ? sessionRef.current.jobs : undefined;
    if (isPendingCoveredByServerJob(currentJobs, pending)) {
      pendingSubmitPayloadsRef.current.delete(pending.idempotencyKey);
      removePendingThreadSubmit(pending);
      pendingSubmitStartedRef.current.delete(pending.idempotencyKey);
      return;
    }

    const pendingJobId = getPendingThreadJobId(pending);
    const pendingSession = buildPendingThreadSession(pending);
    const pendingJob = pendingSession.jobs![0];
    setError("");
    setSessionNotFound(false);
    setIsLoading(false);
    setSession((current) => {
      if (!current || current.session_id !== pending.sessionId) {
        sessionRef.current = pendingSession;
        return pendingSession;
      }
      const jobsWithoutPending = (current.jobs ?? []).filter((job) => job.job_id !== pendingJobId);
      const nextSession = {
        ...current,
        session_id: current.session_id || pending.sessionId,
        title: current.title || pendingSession.title,
        source_use_case: current.source_use_case || pending.sourceUseCase,
        updated_at: new Date().toISOString(),
        last_job_id: current.last_job_id || pendingJobId,
        jobs: sortThreadJobs([...jobsWithoutPending, preserveConfirmedThreadGenerationIntent(
          pendingJob, current.jobs?.find((job) => job.job_id === pendingJobId)
        )])
      };
      sessionRef.current = nextSession;
      return nextSession;
    });

    const replacePendingJob = (nextPending: AppPendingThreadSubmit) => {
      pendingSubmitPayloadsRef.current.set(nextPending.idempotencyKey, nextPending);
      const nextJob = buildPendingThreadJob(nextPending);
      setIsLoading(false);
      setSession((current) => {
        if (!current) return current;
        const jobsWithoutPending = (current.jobs ?? []).filter((job) => job.job_id !== pendingJobId);
        return {
          ...current,
          updated_at: new Date().toISOString(),
          last_job_id: nextJob.job_id,
          jobs: sortThreadJobs([...jobsWithoutPending, nextJob])
        };
      });
    };

    const markPendingSubmitFailed = (
      sourcePending: AppPendingThreadSubmit,
      message: string,
      errorCode?: string
    ) => {
      const failedPending = updatePendingThreadSubmit(sourcePending, {
        status: "failed",
        failedAt: new Date().toISOString(),
        lastError: message,
        lastErrorCode: errorCode
      }) ?? {
        ...sourcePending,
        status: "failed" as const,
        failedAt: new Date().toISOString(),
        lastError: message,
        lastErrorCode: errorCode
      };
      replacePendingJob(failedPending);
    };

    const recoverInterruptedSubmit = async (recoveringPending: AppPendingThreadSubmit) => {
      try {
        const recovered = await recoverPendingThreadSubmit(recoveringPending);
        if (recovered) return;
        if (activeThreadSessionIdRef.current !== recoveringPending.sessionId) return;
        markPendingSubmitFailed(
          recoveringPending,
          APP_PENDING_THREAD_SUBMIT_RECOVERY_FAILED_MESSAGE,
          recoveringPending.lastErrorCode
        );
      } finally {
        pendingSubmitStartedRef.current.delete(recoveringPending.idempotencyKey);
      }
    };

    if (pendingSubmitStartedRef.current.has(pending.idempotencyKey)) return;
    if (pending.status === "failed") return;
    pendingSubmitStartedRef.current.add(pending.idempotencyKey);

    if (pending.status === "recovering") {
      void recoverInterruptedSubmit(pending);
      return;
    }

    void startPendingThreadSubmit(pending, {
      onClarification: (data) => showCompletedClarification(pending, data),
      onGenerationIntent: (_intent, outputKind) => showPendingGenerationIntent(pendingJobId, outputKind),
      onAssistantContent: (assistantContent) => {
        updatePendingAssistantContent(pendingJobId, assistantContent);
      }
    })
      .then((data) => {
        if (completedClarificationIdsRef.current.delete(pending.idempotencyKey)) {
          pendingSubmitPayloadsRef.current.delete(pending.idempotencyKey);
          return;
        }
        pendingSubmitPayloadsRef.current.delete(pending.idempotencyKey);
        pendingSubmitStartedRef.current.delete(pending.idempotencyKey);
        if (activeThreadSessionIdRef.current !== pending.sessionId) return;
        const sessionRedirect = resolveThreadSubmitSessionRedirect(pending.sessionId, data);
        if (sessionRedirect) {
          removePendingThreadSubmit(pending);
          pendingSubmitStartedRef.current.delete(pending.idempotencyKey);
          router.replace(sessionRedirect);
          return;
        }
        removePendingThreadSubmit(pending);
        const submittedJob = buildSubmittedThreadJob(pending, data);
        if (submittedJob && pendingParam !== "1") {
          const media = getThreadJobMedia(submittedJob);
          trackClientEvent("socialmedia.create.request.recovered", {
            traceId: pending.traceId,
            userId: account.id,
            appSessionId: pending.sessionId,
            action: "request_recover",
            stage: "request",
            status: submittedJob.status,
            level: "info",
            jobId: submittedJob.job_id,
            durationMs: Number.isFinite(Date.parse(pending.createdAt)) ? Date.now() - Date.parse(pending.createdAt) : undefined,
            requestSummary: summarizeAppSubmitPayload({
              session_id: pending.sessionId,
              content: pending.content,
              aspect_ratio: pending.aspectRatio,
              image_count: "auto",
              language: pending.language ?? resolveSocialmediaSubmissionLanguage({ userInput: pending.content, outputType: pending.outputType }),
              resolution: pending.resolution,
              platform: pending.platform,
              source_use_case: pending.sourceUseCase,
              source_assets: pending.sourceAssets,
              target_assets: pending.targetAssets,
              parent_job_id: pending.parentJobId
            }),
            errorMessage: pending.lastError,
            imageCount: media.filter((item) => item.kind === "image" && item.url).length,
            warningCount: submittedJob.result?.socialmedia?.warnings?.length ?? 0
          });
        }
        setError("");
        setIsLoading(false);
        setSession((current) => {
          if (!current) return current;
          const base = current;
          const nextSessionId = data.job?.session_id || data.session_id || pending.sessionId;
          const jobsWithoutPending = (base.jobs ?? []).filter((job) => (
            job.job_id !== pendingJobId
            && (!submittedJob || job.job_id !== submittedJob.job_id)
          ));
          return {
            ...base,
            agent_mode: data.agent_mode ?? base.agent_mode,
            session_id: nextSessionId,
            source_use_case: base.source_use_case || pending.sourceUseCase,
            updated_at: new Date().toISOString(),
            last_job_id: submittedJob?.job_id ?? base.last_job_id,
            jobs: submittedJob ? sortThreadJobs([...jobsWithoutPending, submittedJob]) : jobsWithoutPending,
            conversation_turns: !submittedJob && data.assistant_message?.content?.trim()
              ? appendAppThreadConversationTurn(
                  base.conversation_turns,
                  pending,
                  data.assistant_message.content.trim(),
                  data.cta,
                  readClarificationCard(data.assistant_message?.metadata?.clarificationCard, pending.sourceUseCase)
                )
              : base.conversation_turns
          };
        });
        if (submittedJob) {
          window.setTimeout(() => {
            if (activeThreadSessionIdRef.current === pending.sessionId) void loadSession();
          }, 350);
        }
      })
      .catch(async (caughtError) => {
        if (isForbiddenThreadSessionSubmitError(caughtError)) {
          showSessionForbiddenAndRedirect(pending);
          return;
        }
        if (handleCompletedClarificationError(pending, caughtError)) return;
        const rawMessage = caughtError instanceof Error ? caughtError.message : "Failed to start generation.";
        const message = isRetryablePreJobSubmitError(caughtError, pending)
          ? THREAD_GENERATION_SERVICE_ISSUE_MESSAGE
          : rawMessage;
        const errorCode = caughtError instanceof AppComposerSubmitError ? caughtError.code : undefined;
        if (pending.sourceUseCase === "general" && errorCode === "VIDEO_SIGNUP_REQUIRED" && activeThreadSessionIdRef.current === pending.sessionId) openThreadAuthModal();
        const recoveringPending = shouldReconcilePendingThreadSubmitError(caughtError, pending)
          ? updatePendingThreadSubmit(pending, {
              status: "recovering",
              failedAt: undefined,
              lastError: message,
              lastErrorCode: errorCode
            }) ?? {
              ...pending,
              status: "recovering" as const,
              failedAt: undefined,
              lastError: message,
              lastErrorCode: errorCode
            }
          : null;
        if (activeThreadSessionIdRef.current !== pending.sessionId) {
          pendingSubmitPayloadsRef.current.delete(pending.idempotencyKey);
          pendingSubmitStartedRef.current.delete(pending.idempotencyKey);
          return;
        }
        if (recoveringPending) {
          replacePendingJob(recoveringPending);
          await recoverInterruptedSubmit(recoveringPending);
          return;
        }
        markPendingSubmitFailed(pending, message, errorCode);
      })
      .finally(() => {
        pendingSubmitStartedRef.current.delete(pending.idempotencyKey);
      });
  }, [account.id, loadSession, pendingParam, pendingSubmitRetryKey, recoverPendingThreadSubmit, requestIdentityReady, router, sessionId, showSessionForbiddenAndRedirect, updatePendingAssistantContent, showPendingGenerationIntent, showCompletedClarification, handleCompletedClarificationError]);

  useEffect(() => {
    if (!requestIdentityReady) return;
    setIsLoading(true);
    void loadSession({ useCache: !sessionRef.current && !isBillingReturn && !pendingParam && !searchParams.get("refresh") && !searchParams.get("job_id") });
  }, [isBillingReturn, loadSession, pendingParam, refreshKey, requestIdentityReady, searchParams, sessionId]);

  useEffect(() => {
    initialScrollSessionRef.current = "";
    shouldAutoScrollThreadRef.current = true;
  }, [sessionId]);

  useEffect(() => {
    if (isLoading || error || !sessionId) return;
    if (initialScrollSessionRef.current === sessionId) return;
    initialScrollSessionRef.current = sessionId;

    const scrollToBottom = () => {
      const threadBody = threadBodyRef.current;
      if (!threadBody) return;
      threadBody.scrollTop = threadBody.scrollHeight;
    };

    const timeoutIds: number[] = [];
    const frameId = window.requestAnimationFrame(() => {
      scrollToBottom();
      timeoutIds.push(window.setTimeout(scrollToBottom, 120));
      timeoutIds.push(window.setTimeout(scrollToBottom, 360));
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [error, isLoading, jobs.length, sessionId]);

  useEffect(() => {
    if (isLoading || error || !sessionId || !threadContentSignature) return;
    if (!shouldAutoScrollThreadRef.current) return;

    const scrollToBottom = () => {
      const threadBody = threadBodyRef.current;
      if (!threadBody) return;
      threadBody.scrollTop = threadBody.scrollHeight;
    };

    const timeoutIds: number[] = [];
    const frameId = window.requestAnimationFrame(() => {
      scrollToBottom();
      timeoutIds.push(window.setTimeout(scrollToBottom, 120));
      timeoutIds.push(window.setTimeout(scrollToBottom, 360));
      timeoutIds.push(window.setTimeout(scrollToBottom, 900));
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [error, isLoading, sessionId, threadContentSignature]);

  const handleThreadBodyScroll = useCallback(() => {
    const threadBody = threadBodyRef.current;
    if (!threadBody) return;
    const distanceFromBottom = threadBody.scrollHeight - threadBody.scrollTop - threadBody.clientHeight;
    shouldAutoScrollThreadRef.current = distanceFromBottom <= THREAD_AUTO_SCROLL_BOTTOM_THRESHOLD_PX;
  }, []);

  useEffect(() => {
    const body = threadBodyRef.current;
    const dock = threadComposerDockRef.current;
    if (!body || !dock) return;
    // Keyboard/viewport resizing and multiline input change the visible message
    // area even when no message has arrived. Preserve the existing bottom anchor.
    const observer = new ResizeObserver(() => {
      body.style.paddingBottom = `${dock.getBoundingClientRect().height + 16}px`;
      if (shouldAutoScrollThreadRef.current) body.scrollTop = body.scrollHeight;
    });
    observer.observe(body);
    observer.observe(dock);
    return () => {
      observer.disconnect();
      body.style.removeProperty("padding-bottom");
    };
  }, []);

  useEffect(() => {
    if (!account.isLoggedIn) return;
    const pending = readThreadPendingSignupImageUnlock();
    if (!pending) return;
    void (async () => {
      try {
        await finalizePendingThreadGuestClaim(pending);
      } catch (caughtError) {
        setUpgradeError(caughtError instanceof Error ? caughtError.message : "Failed to unlock this image after sign-up.");
      }
    })();
  }, [account.isLoggedIn, account.id, finalizePendingThreadGuestClaim]);

  const refreshThreadJob = useCallback(async (
    job: AppThreadJob,
    captureSource: "client_poll" | "focus_recovery" = "client_poll"
  ) => {
    const usesAdaptiveImagePolling = !isThreadVideoJob(job);
    if (usesAdaptiveImagePolling) {
      const existingRequest = jobRefreshPromisesByJobIdRef.current.get(job.job_id);
      if (existingRequest) return existingRequest;
    }

    const refreshRequest = (async () => {
      const pollTokenQuery = job.poll_token ? `?poll_token=${encodeURIComponent(job.poll_token)}` : "";
      const response = await fetch(`/api/v1/jobs/${encodeURIComponent(job.job_id)}${pollTokenQuery}`, {
        cache: "no-store",
        ...(usesAdaptiveImagePolling
          ? { signal: AbortSignal.timeout(APP_JOB_POLL_REQUEST_TIMEOUT_MS) }
          : {})
      });
      const data = await response.json().catch(() => ({})) as AppThreadJob & {
        error?: string;
        server_now?: string;
      };
      if (!response.ok) throw new Error(data.error || "Unable to refresh job.");
      const telemetryJob = {
        ...data,
        session_id: data.session_id || job.session_id || sessionId,
        status: data.status ?? job.status
      };
      const media = getThreadJobMedia(telemetryJob);
      trackClientEvent("socialmedia.poll.tick", {
        userId: account.id,
        jobId: telemetryJob.job_id,
        action: "poll",
        status: telemetryJob.status,
        stage: telemetryJob.stage,
        progress: telemetryJob.progress,
        imageCount: media.filter((item) => item.kind === "image" && item.url).length,
        videoCount: media.filter((item) => item.kind === "video" && item.url).length,
        warningCount: telemetryJob.result?.socialmedia?.warnings?.length ?? 0
      });
      setSession((current) => current ? {
        ...current,
        server_now: data.server_now ?? current.server_now,
        updated_at: new Date().toISOString(),
        jobs: mergeThreadJob(current.jobs ?? [], {
          ...data,
          session_id: data.session_id || current.session_id,
          status: data.status ?? job.status
        })
      } : current);
      if (data.status === "completed" || data.status === "failed") {
        recordThreadJobTerminalAnalytics(telemetryJob, captureSource);
        pollStartedAtByJobIdRef.current.delete(job.job_id);
        pollTimedOutJobIdsRef.current.delete(job.job_id);
        window.dispatchEvent(new Event("vismuse:account-updated"));
      }
      return telemetryJob;
    })();

    if (!usesAdaptiveImagePolling) return refreshRequest;

    jobRefreshPromisesByJobIdRef.current.set(job.job_id, refreshRequest);
    try {
      return await refreshRequest;
    } finally {
      if (jobRefreshPromisesByJobIdRef.current.get(job.job_id) === refreshRequest) {
        jobRefreshPromisesByJobIdRef.current.delete(job.job_id);
      }
    }
  }, [account.id, recordThreadJobTerminalAnalytics, sessionId]);

  const activeJobPollSignature = useMemo(() => jobs
    .filter((job) => !job.is_mock && isThreadJobActive(job) && !isThreadVideoJob(job))
    .map((job) => job.job_id)
    .sort()
    .join(":"), [jobs]);

  useEffect(() => {
    const activeJobs = (sessionRef.current?.jobs ?? [])
      .filter((job) => !job.is_mock && isThreadJobActive(job) && !isThreadVideoJob(job));
    if (!activeJobs.length) return;

    let cancelled = false;
    const timeoutIds = new Map<string, number>();

    for (const job of activeJobs) {
      if (pollStartedJobIdsRef.current.has(job.job_id)) continue;
      pollStartedJobIdsRef.current.add(job.job_id);
      pollStartedAtByJobIdRef.current.set(job.job_id, Date.now());
      trackClientEvent("socialmedia.poll.started", {
        userId: account.id,
        jobId: job.job_id,
        action: "poll",
        stage: "poll",
        status: "started"
      });
    }

    function scheduleJobPoll(job: AppThreadJob, overrideDelayMs?: number) {
      if (cancelled || isThreadVideoJob(job)) return;
      const delayMs = overrideDelayMs ?? resolveClientJobPollDelayMs(job);
      if (delayMs === undefined) return;

      const existingTimeoutId = timeoutIds.get(job.job_id);
      if (existingTimeoutId !== undefined) window.clearTimeout(existingTimeoutId);
      const timeoutId = window.setTimeout(() => {
        timeoutIds.delete(job.job_id);
        void pollJob(job.job_id);
      }, delayMs);
      timeoutIds.set(job.job_id, timeoutId);
    }

    async function pollJob(jobId: string) {
      if (cancelled) return;
      const job = sessionRef.current?.jobs?.find((item) => item.job_id === jobId);
      if (!job || job.is_mock || !isThreadJobActive(job) || isThreadVideoJob(job)) return;

      if (document.visibilityState === "hidden") {
        scheduleJobPoll(job, 5_000);
        return;
      }

      const startedAt = pollStartedAtByJobIdRef.current.get(job.job_id) ?? Date.now();
      if (!pollStartedAtByJobIdRef.current.has(job.job_id)) {
        pollStartedAtByJobIdRef.current.set(job.job_id, startedAt);
      }
      if (Date.now() - startedAt >= APP_JOB_POLL_TIMEOUT_MS && !pollTimedOutJobIdsRef.current.has(job.job_id)) {
        pollTimedOutJobIdsRef.current.add(job.job_id);
        trackClientEvent("socialmedia.poll.timeout", {
          userId: account.id,
          level: "warn",
          jobId: job.job_id,
          action: "poll",
          stage: "poll",
          status: "failed",
          durationMs: Date.now() - startedAt
        });
      }

      try {
        const latestJob = await refreshThreadJob(job);
        scheduleJobPoll(latestJob);
      } catch {
        // Retry quickly before provider submission, or at the APIMart cadence
        // after submission. Focus/visibility recovery shares the in-flight request.
        scheduleJobPoll({ ...job, next_poll_after_ms: undefined });
      }
    }

    jobPollSchedulerRef.current = scheduleJobPoll;
    for (const job of activeJobs) scheduleJobPoll(job);

    return () => {
      cancelled = true;
      if (jobPollSchedulerRef.current === scheduleJobPoll) {
        jobPollSchedulerRef.current = null;
      }
      for (const timeoutId of timeoutIds.values()) window.clearTimeout(timeoutId);
      timeoutIds.clear();
    };
  }, [account.id, activeJobPollSignature, refreshThreadJob]);

  useEffect(() => {
    const activeVideoJobs = jobs.filter((job) => (
      !job.is_mock
      && isThreadJobActive(job)
      && isThreadVideoJob(job)
    ));
    if (!activeVideoJobs.length) return;

    for (const job of activeVideoJobs) {
      if (pollStartedJobIdsRef.current.has(job.job_id)) continue;
      pollStartedJobIdsRef.current.add(job.job_id);
      pollStartedAtByJobIdRef.current.set(job.job_id, Date.now());
      trackClientEvent("socialmedia.poll.started", {
        userId: account.id,
        jobId: job.job_id,
        action: "poll",
        stage: "poll",
        status: "started"
      });
    }

    const timer = window.setInterval(() => {
      for (const job of activeVideoJobs) {
        const startedAt = pollStartedAtByJobIdRef.current.get(job.job_id) ?? Date.now();
        if (!pollStartedAtByJobIdRef.current.has(job.job_id)) {
          pollStartedAtByJobIdRef.current.set(job.job_id, startedAt);
        }
        if (Date.now() - startedAt >= APP_JOB_POLL_TIMEOUT_MS && !pollTimedOutJobIdsRef.current.has(job.job_id)) {
          pollTimedOutJobIdsRef.current.add(job.job_id);
          trackClientEvent("socialmedia.poll.timeout", {
            userId: account.id,
            level: "warn",
            jobId: job.job_id,
            action: "poll",
            stage: "poll",
            status: "failed",
            durationMs: Date.now() - startedAt
          });
        }
        void refreshThreadJob(job).catch(() => {
          // Preserve the legacy video polling path; focus/visibility recovery can still refresh it.
        });
      }
    }, 3_000);

    return () => window.clearInterval(timer);
  }, [account.id, jobs, refreshThreadJob]);

  useEffect(() => {
    if (!sessionId || isMockThread) return;
    const missingVideoMediaJob = jobs.find((job) => (
      !job.is_mock
      && job.status === "completed"
      && isThreadVideoJob(job)
      && (job.result?.socialmedia?.videos?.length ?? 0) > 0
      && !getThreadJobMedia(job).some((item) => item.kind === "video" && item.url)
    ));
    if (!missingVideoMediaJob) return;

    const recoveryKey = `${sessionId}:${missingVideoMediaJob.job_id}:${missingVideoMediaJob.updated_at ?? ""}`;
    if (missingVideoMediaRecoveryJobIdsRef.current.has(recoveryKey)) return;
    missingVideoMediaRecoveryJobIdsRef.current.add(recoveryKey);
    void loadSession({ freshUnlocks: true });
  }, [isMockThread, jobs, loadSession, sessionId]);

  useEffect(() => {
    for (const job of jobs) {
      if (job.is_mock || (job.status !== "completed" && job.status !== "failed")) continue;
      recordThreadJobTerminalAnalytics(job, "initial_load");
    }
  }, [jobs, recordThreadJobTerminalAnalytics, threadContentSignature]);

  useEffect(() => {
    const refreshActiveJobs = (event?: Event) => {
      if (document.visibilityState === "hidden") return;
      const activeJobs = jobs.filter((job) => !job.is_mock && isThreadJobActive(job));
      for (const job of activeJobs) {
        void refreshThreadJob(job, "focus_recovery")
          .then((telemetryJob) => {
            jobPollSchedulerRef.current?.(telemetryJob);
            const media = getThreadJobMedia(telemetryJob);
            trackClientEvent("socialmedia.poll.foreground_recovered", {
              userId: account.id,
              jobId: telemetryJob.job_id,
              action: "poll",
              stage: "poll",
              status: telemetryJob.status,
              trigger: event?.type ?? "focus",
              imageCount: media.filter((item) => item.kind === "image" && item.url).length,
              warningCount: telemetryJob.result?.socialmedia?.warnings?.length ?? 0
            });
          })
          .catch(() => {
            // The regular interval will retry.
          });
      }
    };
    window.addEventListener("focus", refreshActiveJobs);
    window.addEventListener("pageshow", refreshActiveJobs);
    document.addEventListener("visibilitychange", refreshActiveJobs);
    return () => {
      window.removeEventListener("focus", refreshActiveJobs);
      window.removeEventListener("pageshow", refreshActiveJobs);
      document.removeEventListener("visibilitychange", refreshActiveJobs);
    };
  }, [account.id, jobs, refreshThreadJob]);

  const handleMockThreadSubmit = useCallback((params: {
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
  }) => {
    const now = new Date().toISOString();
    const mockJob: AppThreadJob = {
      job_id: `mock-${Date.now()}`,
      session_id: sessionId,
      source_use_case: sourceUseCase,
      output_type: params.outputType ?? getAppOutputType(sourceUseCase),
      status: "running",
      stage: "apimart_polling",
      progress: 46,
      input_text: params.content || (params.sourceAssets.length ? "Create from uploaded reference image" : "Untitled request"),
      created_at: now,
      updated_at: now,
      is_mock: true,
      mock_ui: "generating",
      socialmedia: {
        sourceAssets: params.sourceAssets,
        userSourceAssets: params.displaySourceAssets ?? params.sourceAssets
      },
      result: {
        socialmedia: {
          briefSummary: ""
        }
      }
    };

    setError("");
    setIsLoading(false);
    setSession((current) => ({
      session_id: current?.session_id || sessionId,
      title: current?.title || params.content || "New chat",
      source_use_case: current?.source_use_case || sourceUseCase,
      created_at: current?.created_at || now,
      updated_at: now,
      last_job_id: mockJob.job_id,
      conversation_turns: current?.conversation_turns,
      jobs: sortThreadJobs([...(current?.jobs ?? []), mockJob])
    }));
  }, [sessionId, sourceUseCase]);

  const imagePreviewData = imagePreview?.items[imagePreview.index]?.data;
  const imagePreviewJob = imagePreviewData?.job;
  const imagePreviewMedia = imagePreviewData?.media;
  const imagePreviewImage = imagePreviewMedia ? toSocialmediaGeneratedImage(imagePreviewMedia) : null;
  const imagePreviewShouldGate = imagePreviewMedia ? shouldGateThreadMediaDownload(imagePreviewMedia) : false;
  const imagePreviewUpgradeCtaCopy = imagePreviewImage && account.authMode !== "guest"
    ? getThreadImageUpgradeCta(account, imagePreviewImage)
    : null;
  const imagePreviewUpgradeCta = imagePreviewImage && imagePreviewShouldGate ? {
    title: imagePreviewUpgradeCtaCopy?.previewTitle ?? freeGeneratedWatermarkedImageUpgradeCta.previewTitle,
    body: imagePreviewUpgradeCtaCopy?.previewCopy
      ?? (account.authMode === "guest"
        ? "Unlock this image and continue toward watermark-free exports."
        : freeGeneratedWatermarkedImageUpgradeCta.previewCopy),
    buttonLabel: imagePreviewUpgradeCtaCopy?.previewPrimaryAction
      ?? (account.authMode === "guest" ? "Unlock watermark-free" : freeGeneratedWatermarkedImageUpgradeCta.previewPrimaryAction),
    onClick: () => {
      if (!imagePreviewImage) return;
      const usesWatermarkedSignupModal = account.authMode === "guest"
        && isGuestWatermarkedSignupImage(imagePreviewImage);
      closeThreadImagePreview();
      if (usesWatermarkedSignupModal) {
        openThreadWatermarkedSignupModal(imagePreviewImage, [imagePreviewImage], { job: imagePreviewJob });
        return;
      }
      openThreadSubscriptionModal({
        plan: account.isLoggedIn ? "free" : "guest",
        image: imagePreviewImage,
        trigger: "preview_watermark_upgrade",
        selectableImages: [imagePreviewImage],
        job: imagePreviewJob
      });
    }
  } : undefined;
  const redirectingAfterForbiddenSubmit = sessionForbiddenRedirect?.sessionId === sessionId;

  return localizeUiTree((
    <div data-i18n-skip className={`${styles.threadView} ${isVideoGenerationSourceUseCase(sourceUseCase) ? styles.videoThreadView : ""}`.trim()}>
      <header className={styles.threadHeader}>
        <button
          className={`${styles.appTopBackButton} ${styles.threadHeaderBackButton}`}
          type="button"
          aria-label={t(uiLocale, "workbench.thread.back")}
          onClick={() => router.push(returnHref)}
        >
          <ChevronLeft size={17} aria-hidden />
          <span>{t(uiLocale, "workbench.thread.back")}</span>
        </button>
        <Link prefetch={false} className={styles.threadNewButton} href={returnHref}>
          <Plus size={14} aria-hidden />
          <span>{t(uiLocale, "workbench.thread.newTask")}</span>
        </Link>
      </header>

      <section data-i18n-skip data-chat-thread-body ref={threadBodyRef} className={styles.threadBody} aria-live="polite" onScroll={handleThreadBodyScroll}>
        {!redirectingAfterForbiddenSubmit && isLoading ? (
          <div className={styles.threadState}>
            <span className={styles.threadStateSpinner} aria-hidden />
            <p>{t(uiLocale, "workbench.thread.loading")}</p>
          </div>
        ) : !redirectingAfterForbiddenSubmit && error ? (
          <div className={styles.threadState}>
            <p>{error}</p>
            <button type="button" onClick={() => void loadSession()}>
              <RefreshCw size={16} aria-hidden />
              <span>{t(uiLocale, "workbench.thread.retry")}</span>
            </button>
          </div>
        ) : threadItems.length ? (
          <div data-i18n-skip className={styles.threadMessages}>
            {threadItems.map((item) => item.kind === "conversation" ? (
              <div className={styles.threadTurn} key={item.id}>
                <article className={styles.userBubble}>
                  <p data-i18n-skip>{item.turn.user_content}</p>
                </article>
                <AppThreadUserSourceAssets
                  assets={item.turn.source_assets ?? []}
                  onOpenImagePreview={openThreadSourceImagePreview}
                />
                <article data-i18n-skip className={styles.assistantCard}>
                  {item.turn.clarification && supportsClarificationCard(sourceUseCase) ? (
                    <ClarificationCard
                      key={item.turn.clarification.id}
                      card={item.turn.clarification}
                      active={threadItems.at(-1)?.id === item.id}
                      busy={pendingSubmitStartedRef.current.size > 0}
                      onAnswer={(answer) => {
                        const submit = {
                          clarificationId: item.turn.clarification!.id,
                          content: answer,
                          sourceAssets: [],
                          aspectRatio: item.turn.clarification!.aspectRatio,
                          resolution: item.turn.clarification!.resolution,
                          outputType: "image" as const
                        };
                        if (isMockThread) {
                          handleMockThreadSubmit(submit);
                          return true;
                        }
                        if (pendingSubmitStartedRef.current.size > 0) return false;
                        handleThreadComposerSubmit(submit);
                        return true;
                      }}
                    />
                  ) : <div className={styles.assistantBubble}>
                    <ReactMarkdown
                      components={{
                        a: ({ children, href }) => (
                          <a href={href} target="_blank" rel="noreferrer">
                            {children}
                          </a>
                        )
                      }}
                    >
                      {item.turn.assistant_content}
                    </ReactMarkdown>
                  </div>}
                  {item.turn.clarification_stream_error ? <p role="status">{item.turn.clarification_stream_error}</p> : null}
                  {item.turn.cta?.kind === "watermark_upgrade" ? (
                    <AppThreadConversationWatermarkUpgradeCta
                      account={account}
                      cta={item.turn.cta}
                      jobs={session?.jobs ?? []}
                      onOpenSubscriptionModal={openThreadSubscriptionModal}
                      onOpenUpgradePricingModal={() => openThreadUpgradePricingModal("thread", "manual_click")}
                    />
                  ) : item.turn.cta?.kind === "video_subscription" ? (
                    <AppThreadConversationVideoSubscriptionCta
                      cta={item.turn.cta}
                      onOpenSubscriptionModal={() => openThreadVideoPricingModal("thread", "manual_click")}
                    />
                  ) : item.turn.cta?.kind === "subscription_plans" ? (
                    <div className={styles.threadConversationCta}>
                      <button
                        type="button"
                        onClick={() => openThreadUpgradePricingModal("thread", "manual_click")}
                      >
                        {item.turn.cta.label}
                      </button>
                    </div>
                  ) : item.turn.cta?.kind === "workspace" && isPricingPageHref(item.turn.cta.href) ? (
                    <div className={styles.threadConversationCta}>
                      <button
                        type="button"
                        onClick={() => openThreadUpgradePricingModal("thread", "manual_click")}
                      >
                        {item.turn.cta.label}
                      </button>
                    </div>
                  ) : item.turn.cta ? (
                    <div className={styles.threadConversationCta}>
                      <Link prefetch={false} href={item.turn.cta.href}>{item.turn.cta.label}</Link>
                    </div>
                  ) : null}
                </article>
              </div>
            ) : (() => {
              const job = item.job;
              return (
                <div className={styles.threadTurn} key={job.job_id}>
                  <article className={styles.userBubble}>
                    <p data-i18n-skip>{stripInternalSubmittedInputForDisplay(job.input_text || "") || t(uiLocale, "workbench.thread.untitledRequest")}</p>
                  </article>
                  <AppThreadUserSourceAssets
                    assets={getThreadJobUserSourceAssets(job)}
                    onOpenImagePreview={openThreadSourceImagePreview}
                  />
                  <AppThreadAssistantMessage
                    account={account}
                    agentMode={session?.agent_mode === true}
                    downloading={downloadingJobId === job.job_id}
                    downloaded={downloadedJobId === job.job_id}
                    job={job}
                    workbenchSourceUseCase={sourceUseCase}
                    serverNow={session?.server_now}
                    onDownload={(threadJob, media, format) => void handleDownloadThreadMedia(threadJob, media, { format })}
                    onOpenImagePreview={openThreadImagePreview}
                    onOpenGuestSignupModal={() => openThreadGuestCreditSignupModalWithTelemetry("error", "manual_click", job)}
                    onOpenUpgradePricingModal={() => openThreadUpgradePricingModal("error", "manual_click", job)}
                    onOpenCreditTopupModal={() => openThreadPaidCreditTopupModal("error", "manual_click", job)}
                    onOpenVideoSubscriptionPricingModal={() => openThreadVideoPricingModal("error", "manual_click", job)}
                    onOpenSubscriptionModal={openThreadSubscriptionModal}
                    onOpenWatermarkedSignupModal={openThreadWatermarkedSignupModal}
                    onOpenVideoSubscriptionModal={openThreadVideoSubscriptionModal}
                    onResultMenuOpen={handleResultMenuOpen}
                    onAnimateImage={handleImageAnimate}
                    onRetryPendingSubmit={retryPendingThreadSubmit}
                  />
                </div>
              );
            })())}
          </div>
        ) : !redirectingAfterForbiddenSubmit ? (
          <div className={styles.threadState}>
            <p>{t(uiLocale, "workbench.thread.empty")}</p>
          </div>
        ) : null}
      </section>

      {!redirectingAfterForbiddenSubmit ? <div ref={threadComposerDockRef} className={styles.threadComposerDock}>
        <AppComposer
          compact
          className={`${styles.composer} ${styles.workbenchToolbarComposer}`}
          uploadButtonClassName={styles.workbenchUploadButton}
          uploadInToolbar
          hideOptions={sourceUseCase === "general"}
          options={isSpotifyCanvasSourceUseCase(sourceUseCase)
            ? spotifyCanvasComposerOptions
            : isMiniMaxH3VideoFlowSourceUseCase(sourceUseCase)
              ? promoVideoComposerOptions
            : isVideoGenerationSourceUseCase(sourceUseCase)
              ? videoComposerOptions
              : undefined}
          placeholder={sourceUseCase === "general" ? "Ask a question, or describe an image or video to create." : getAppComposerPlaceholder(sourceUseCase, "thread")}
          submitPathSlug={toolSlug}
          sourceUseCase={sourceUseCase}
          sessionId={sessionId}
          hasActiveVideoJob={hasActiveVideoJob}
          continuationSourceAssets={continuationSourceAssets}
          redirectMode="chat"
          onChatSubmit={!isMockThread ? handleThreadComposerSubmit : undefined}
          onMockSubmit={isMockThread ? handleMockThreadSubmit : undefined}
        />
      </div> : null}
      <AppThreadAccessModals
        accountPlan={account.plan}
        sourceUseCase={sourceUseCase}
        pricingVariant={effectivePricingVariant}
        plans={subscriptionModalPlans}
        pendingPackage={rechargePendingPackage}
        error={upgradeError}
        guestId={account.authMode === "guest" ? account.id : undefined}
        isSignedIn={account.isLoggedIn}
        upgradeModalOpen={pricingAssignmentReady && upgradePricingModalOpen}
        upgradeSourceUseCase={upgradePricingModalPresentation?.sourceUseCase}
        upgradeTitle={upgradePricingModalPresentation?.title}
        upgradeSubtitle={upgradePricingModalPresentation?.subtitle}
        onUpgradeClose={closeThreadUpgradePricingModal}
        onSubscribe={(packageId, cta) => void subscribeFromThreadSubscriptionModal(packageId, undefined, cta)}
        onUpgradePlanSelect={selectThreadUpgradePricingModalPlan}
        watermarkedSignupImage={watermarkedSignupModalImage}
        onWatermarkedSignupClose={closeThreadWatermarkedSignupModal}
        onWatermarkedSignupProviderSelect={(provider, image) => void startThreadGuestSignupProvider(provider, image)}
        onWatermarkedSignupEmailStart={startThreadGuestSignupEmail}
        onWatermarkedSignupEmailSuccess={completeThreadGuestSignupEmailAuth}
        onWatermarkedSignupContinue={downloadThreadWatermarkedSignupImages}
        imageModalOpen={pricingAssignmentReady && subscriptionModalOpen}
        imageModalPlan={subscriptionModalPlan}
        imageModalImage={subscriptionModalImage}
        imageModalSelectableImages={subscriptionSelectableImages}
        onImageModalClose={closeThreadSubscriptionModal}
        onImageModalSelect={setSubscriptionModalImage}
        onImageModalPlanSelect={selectThreadSubscriptionModalPlan}
        onImageCreditPackViewOpen={trackThreadCreditPackModalOpened}
        onImageCreditPackPlanSelect={selectThreadCreditPackModalPlan}
        onImageUnlock={(image) => void handleUnlockThreadImage(
          jobs.find((job) => getThreadJobImages(job).some((item) => item.assetId === image.assetId))?.job_id ?? "",
          image
        )}
        onImageCreditPackSubscribe={(packageId, image) => {
          const targetJob = findThreadJobForImage(image);
          void subscribeFromThreadSubscriptionModal(packageId, {
            assetId: image.assetId,
            jobId: targetJob?.job_id,
            sessionId: targetJob?.session_id || sessionId
          });
        }}
        onImageGuestSignupUnlock={handleThreadGuestSignupUnlock}
        onImageDownloadWatermarked={downloadThreadWatermarkedImages}
        onImageGuestProviderSelect={(provider, image) => void startThreadGuestSignupProvider(provider, image)}
        onImageGuestEmailStart={startThreadGuestSignupEmail}
        onImageGuestEmailSuccess={completeThreadGuestSignupEmailAuth}
        unlockPending={unlockingAssetId === subscriptionModalImage?.assetId}
      />
      {imageAnimationDraft ? (
        <AppThreadAnimateToVideoDialog
          draft={imageAnimationDraft}
          onClose={() => setImageAnimationDraft(null)}
          onSubmit={(prompt, videoDuration, image) => startImageAnimationTask({
            sourceJob: imageAnimationDraft.job,
            image,
            kind: "video",
            source: imageAnimationDraft.source,
            prompt,
            videoDuration
          })}
        />
      ) : null}
      {imagePreview ? (
        <AppImagePreviewOverlay
          preview={imagePreview}
          upgradeCta={imagePreviewUpgradeCta}
          onDownload={imagePreviewJob && imagePreviewMedia
            ? () => handleDownloadThreadMedia(imagePreviewJob, [imagePreviewMedia], { downloadSource: "preview" })
            : undefined}
          onClose={closeThreadImagePreview}
        />
      ) : null}
      {pricingAssignmentReady && videoSubscriptionModalOpen ? (
        <VideoSubscriptionModal
          open={videoSubscriptionModalOpen}
          presentation="app"
          pricingVariant={effectivePricingVariant}
          defaultView={videoPricingDefaultView}
          initialAccountPlan={account.plan}
          initialCreditBalance={account.credits}
          video={videoSubscriptionMedia ? {
            assetId: videoSubscriptionMedia.assetId,
            videoIndex: videoSubscriptionMedia.index,
            url: videoSubscriptionMedia.url,
            thumbnailUrl: videoSubscriptionMedia.thumbnailUrl,
            width: videoSubscriptionMedia.width,
            height: videoSubscriptionMedia.height,
            promptSummary: videoSubscriptionMedia.promptSummary,
            accessVariant: videoSubscriptionMedia.accessVariant
          } : null}
          jobId={videoSubscriptionJobId}
          sessionId={sessionId}
          onCheckoutCreated={(context) => {
            rememberAppCheckoutContext({
              checkoutId: context.checkoutId,
              packageId: context.packageId,
              kind: context.isUnlockCheckout ? "video_unlock" : "subscription",
              paymentProvider: context.paymentProvider,
              assetId: context.assetId,
              jobId: context.jobId,
              sessionId: context.sessionId,
              pricingVariant: context.pricingVariant
            });
          }}
          onClose={() => {
            setVideoSubscriptionModalOpen(false);
            setVideoSubscriptionMedia(null);
            setVideoSubscriptionJobId(undefined);
          }}
        />
      ) : null}
    </div>
  ), uiLocale);
}
