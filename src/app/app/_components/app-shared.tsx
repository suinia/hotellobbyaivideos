"use client";

import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type AppCheckoutKind } from "@/lib/analytics/app-checkout-recovery";
import { allowsBackgroundPrefetch, type PrefetchConnection } from "@/lib/app/route-prefetch";
import { buildStaticThumbWebpUrl } from "@/lib/socialmedia/static-thumbnails";
import { buildSupabasePublicImageTransformUrl } from "@/lib/socialmedia/storage-url";
import { resolveImageDownloadFileName } from "@/lib/images/download-file";
import { isVideoGenerationSourceUseCase } from "@/lib/videos/source-use-case";
import { ArrowLeft, ArrowRight, Clock, PanelsTopLeft, Sparkles, Trash2, X } from "lucide-react";
import styles from "./app.module.css";
import { appTools, type AppToolCard } from "./app-data";
import { useAppAccountStore } from "./app-account-store";
import { prefetchAppThreadSession, resetAppThreadSessionCache } from "./app-thread-session-loader";
import { APP_EXPLORE_CACHE_TTL_MS, useAppExploreStore, type AppExploreTemplate } from "./app-explore-store";
import { useAppRecentsStore } from "./app-recents-store";
import { isCurrentRecentsAccount, loadAppRecentsPage } from "./app-recents-loader";
import { AppFallbackImage } from "./app-fallback-image";
import { type RechargePackageId } from "./app-subscription-model";
import type { SocialmediaBoardItem } from "./app-workbench-types";
import { type AppComposerOptionChoice, type AppComposerOption, MINIMAX_H3_VIDEO_COMPOSER_DEFAULT_RESOLUTION, APP_VIDEO_COMPOSER_DEFAULT_MODEL_TIER, ResolutionGemIcon, videoAspectRatioChoices, videoDurationChoices, videoModelTierChoices } from "./app-composer";

export function getExploreToolDescription(tool: AppToolCard): string {
  switch (tool.slug) {
    case "ai-image-maker":
      return "Prompt to image";
    case "ai-image-text-editor":
      return "Change or add image text";
    case "ai-product-ad-image-generator":
      return "Ads and product scenes";
    case "ai-flyer-generator":
      return "Events and offers";
    case "ai-brochure-generator":
      return "Brochures and collateral";
    case "ai-infographic-generator":
      return "Data and visual stories";
    case "ai-comic-generator":
      return "Comic strips and story pages";
    case "baby-shower-invitations":
      return "Baby shower invites and event cards";
    case "playlist-cover-maker":
      return "Moods, mixes, and listening moments";
    case "vision-board-maker":
      return "Goals, dreams, and inspiration";
    case "ai-anime-generator":
      return "Anime characters and artwork";
    case "ai-menu-generator":
      return "Restaurant menus and price lists";
    case "ai-album-cover-generator":
      return "Music artwork";
    case "poster-maker":
      return "Events, promotions, movies & notices";
    case "business-card-maker":
      return "Brand contact cards";
    case "ai-logo-generator":
      return "Logos and brand marks";
    case "ai-personal-image-generator":
      return "Portrait styles";
    case "ai-sticker-generator":
      return "Sticker sheets";
    case "ai-wallpaper-generator":
      return "Phone and desktop";
    case "ai-book-cover-generator":
      return "Publishing covers";
    case "invitation-maker":
      return "Invites and cards";
    case "ai-clothes-changer":
      return "Outfit changes";
    case "background-remover":
      return "Clean cutouts";
    case "ai-room-design":
      return "Interior redesign";
    case "ai-video-generator":
      return "Prompt to video";
    case "ai-animation-generator":
      return "Animate ideas and images";
    case "promo-video-maker":
      return "Product and brand promos";
    case "spotify-canvas-generator":
      return "Album cover to 5s Canvas";
    default:
      return tool.eyebrow;
  }
}

export const imageToolFeatures = appTools.map((tool) => ({
  slug: tool.slug,
  title: tool.workbenchTitle,
  compactTitle: tool.title,
  description: getExploreToolDescription(tool),
  href: tool.slug === "promo-video-maker" ? "/promo-video" : `/${tool.slug}`,
  accent: tool.accent,
  icon: tool.icon
}));

const appExploreTemplateRequests = new Map<string, Promise<void>>();
const EMPTY_RECENTS: SocialmediaBoardItem[] = [];

type VisualTemplatesResponse = {
  templates?: AppExploreTemplate[];
  error?: string;
};

export const APP_LAST_CREATE_HREF_UPDATE_EVENT = "vismuse:app-last-create-href";

export function createAppRechargeIdempotencyKey(packageId: string) {
  const randomId = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `app-recharge:${packageId}:${randomId}`;
}

export function getAppCheckoutPlanName(packageId: RechargePackageId, plans: Array<{ packageId: RechargePackageId; name: string }>): string {
  return plans.find((item) => item.packageId === packageId)?.name.toLowerCase() ?? packageId;
}

export function getAppSubscriptionClickScenario(trigger: string, modalVariant: "post_generation_subscription" | "upgrade_pricing_modal") {
  if (modalVariant === "post_generation_subscription") {
    return trigger.includes("download")
      ? "post_generation_download_modal"
      : "post_generation_result_modal";
  }
  return "manual_upgrade_modal";
}

export function getAppOutputType(sourceUseCase?: string | null): "image" | "video" {
  return isVideoGenerationSourceUseCase(sourceUseCase) ? "video" : "image";
}

const miniMaxH3ResolutionChoices: AppComposerOptionChoice[] = [
  { value: "768p", label: "768p", icon: ResolutionGemIcon },
  { value: "2k", label: "2K", icon: ResolutionGemIcon }
];

export const spotifyCanvasComposerOptions: AppComposerOption[] = [
  { id: "model-tier", title: "Quality", defaultValue: APP_VIDEO_COMPOSER_DEFAULT_MODEL_TIER, choices: videoModelTierChoices, icon: Sparkles }
];

export const promoVideoComposerOptions: AppComposerOption[] = [
  { id: "aspect-ratio", title: "Select video ratio", defaultValue: "auto", choices: videoAspectRatioChoices, icon: PanelsTopLeft },
  { id: "duration", title: "Duration", defaultValue: "10s", choices: videoDurationChoices, icon: Clock },
  {
    id: "video-resolution",
    title: "Output resolution",
    defaultValue: MINIMAX_H3_VIDEO_COMPOSER_DEFAULT_RESOLUTION,
    choices: miniMaxH3ResolutionChoices,
    icon: ResolutionGemIcon
  }
];

export const hotelLobbyComposerOptions: AppComposerOption[] = [
  { id: "hotel-lobby-cast", title: "Performance", defaultValue: "duet", icon: Sparkles, choices: [
    { value: "duet", label: "Duet", icon: Sparkles },
    { value: "solo", label: "Solo", icon: Sparkles },
    { value: "pets", label: "Pet duet", icon: Sparkles }
  ] },
  ...promoVideoComposerOptions.map((option) => option.id === "aspect-ratio"
    ? { ...option, defaultValue: "9:16" }
    : option.id === "duration"
      ? { ...option, defaultValue: "5s" }
      : option)
];

export type AppThreadMediaItem = {
  url: string;
  thumbnailUrl?: string;
  firstFrameUrl?: string;
  kind: "image" | "video";
  index: number;
  assetId?: string;
  accessVariant?: "original" | "watermarked";
  previewVariant?: "watermarked" | "masked_blur" | "low_res_clean";
  fileName?: string;
  promptSummary?: string;
  width?: number;
  height?: number;
  originalSizeBytes?: number;
};

export type AppVideoPreviewItem = {
  url: string;
  title: string;
  posterUrl?: string;
  prompt?: string;
  tryHref?: string;
};

export type AppVideoPreviewState = {
  items: AppVideoPreviewItem[];
  index: number;
  autoFullscreen?: boolean;
};

type AppFullscreenVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitSupportsFullscreen?: boolean;
};

export function shouldOpenVideoPreviewFullscreen() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;
}

export function requestAppVideoFullscreen(video: HTMLVideoElement | null) {
  if (!video || !shouldOpenVideoPreviewFullscreen()) return;

  const fullscreenVideo = video as AppFullscreenVideoElement;
  void video.play().catch(() => undefined);

  if (typeof fullscreenVideo.webkitEnterFullscreen === "function" && fullscreenVideo.webkitSupportsFullscreen !== false) {
    try {
      fullscreenVideo.webkitEnterFullscreen();
      return;
    } catch {
      // Fall back to the standard fullscreen API below.
    }
  }

  void video.requestFullscreen?.().catch(() => undefined);
}

function getThreadMediaFileName(media: AppThreadMediaItem, jobId: string): string {
  const explicit = media.fileName?.trim();
  if (explicit) return explicit;
  const assetKey = media.assetId?.trim().slice(0, 8) || jobId.slice(0, 8) || "asset";
  const variant = media.accessVariant === "original" ? "hd" : "preview";
  if (media.kind === "video") return `vismuse-${assetKey}-${variant}.mp4`;
  return `vismuse-${assetKey}-${variant}.png`;
}

export function downloadThreadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function downloadThreadUrl(url: string, fileName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noreferrer";
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function saveThreadMedia(media: AppThreadMediaItem, jobId: string): Promise<number | undefined> {
  let sourceUrl = media.url;
  let fileName = getThreadMediaFileName(media, jobId);

  if (media.kind === "video") {
    try {
      const params = new URLSearchParams();
      if (media.assetId) params.set("assetId", media.assetId);
      const response = await fetch(
        `/api/v1/jobs/${encodeURIComponent(jobId)}/videos/${media.index}/download${params.toString() ? `?${params}` : ""}`,
        { cache: "no-store" }
      );
      if (response.ok) {
        const data = await response.json().catch(() => ({})) as {
          url?: string;
          fileName?: string;
          file_name?: string;
          accessVariant?: "original" | "watermarked";
          access_variant?: "original" | "watermarked";
        };
        const resolvedUrl = data.url?.trim();
        if (resolvedUrl) {
          sourceUrl = resolvedUrl;
          fileName = data.fileName?.trim() || data.file_name?.trim() || fileName;
        }
      }
    } catch {
      // Fall back to the materialized URL below.
    }
  }

  try {
    const response = await fetch(sourceUrl, { credentials: "omit" });
    if (!response.ok) throw new Error("Download failed.");
    const blob = await response.blob();
    const downloadFileName = media.kind === "image"
      ? resolveImageDownloadFileName(fileName, blob.type || response.headers.get("content-type"))
      : fileName;
    downloadThreadBlob(blob, downloadFileName);
    return blob.size;
  } catch {
    downloadThreadUrl(sourceUrl, fileName);
    return undefined;
  }
}

export function createThreadIdempotencyKey(assetId: string): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `app-chat-image-unlock:${assetId}:${random}`;
}

export const THREAD_PENDING_IMAGE_UNLOCK_CHECKOUT_KEY = "vismuse:socialmedia-pending-image-unlock-checkout";

export const APP_PENDING_CHECKOUT_AFTER_AUTH_KEY = "vismuse.app.pendingCheckoutAfterAuth";

export const APP_IMAGE_UNLOCK_PACKAGE_ID = "image_unlock_single";

export const APP_CHECKOUT_START_TIMEOUT_MS = 20_000;

const APP_CHECKOUT_START_TIMEOUT_MESSAGE = "Checkout is taking longer than expected. Please try again.";

export const APP_CHECKOUT_SYNCED_EVENT = "vismuse:app-checkout-synced";

export const APP_TOAST_EVENT = "vismuse:app-toast";

const APP_RECENT_COVER_SIZES =
  "(max-width: 700px) 100vw, (max-width: 1040px) 50vw, (max-width: 1440px) 25vw, 260px";

export type AppToastState = {
  message: string;
  tone: "info" | "success" | "warning" | "error";
  placement?: "center";
};

export function dispatchAppToast(message: string, tone: AppToastState["tone"] = "info", placement?: AppToastState["placement"]) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(APP_TOAST_EVENT, {
    detail: { message, tone, placement }
  }));
}

export type AppCheckoutSyncedEventDetail = {
  checkoutId?: string;
  checkoutSyncOk?: boolean;
  kind?: AppCheckoutKind;
  paymentProvider?: string;
  assetId?: string;
  jobId?: string;
  sessionId?: string;
};

function isAppAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function getAppCheckoutFailureMessage(error: unknown, fallback = "Checkout failed."): string {
  if (isAppAbortError(error)) return APP_CHECKOUT_START_TIMEOUT_MESSAGE;
  return error instanceof Error ? error.message : fallback;
}

export function clearAppPendingCheckoutAfterAuth(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(APP_PENDING_CHECKOUT_AFTER_AUTH_KEY);
    window.sessionStorage.removeItem(THREAD_PENDING_IMAGE_UNLOCK_CHECKOUT_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function isBackForwardPageShow(event: PageTransitionEvent): boolean {
  if (event.persisted) return true;
  const navigationEntry = window.performance
    ?.getEntriesByType("navigation")
    .find((entry): entry is PerformanceNavigationTiming => "type" in entry);
  return navigationEntry?.type === "back_forward";
}

export function useResetCheckoutPendingOnPageShow(resetPending: () => void): void {
  const resetPendingRef = useRef(resetPending);

  useEffect(() => {
    resetPendingRef.current = resetPending;
  }, [resetPending]);

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!isBackForwardPageShow(event)) return;
      resetPendingRef.current();
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);
}

export function AppVideoPreviewOverlay({
  preview,
  onTryPrompt,
  onClose
}: {
  preview: AppVideoPreviewState;
  onTryPrompt?: (prompt: string) => void;
  onClose: () => void;
}) {
  const uiLocale = useUiLocale();
  const item = preview.items[preview.index];
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!preview.autoFullscreen) return;
    requestAppVideoFullscreen(videoRef.current);
  }, [preview.autoFullscreen, item?.url]);

  if (!item) return null;

  return localizeUiTree((
    <div
      className={styles.appVideoPreviewOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Video preview"
      onClick={onClose}
    >
      <button
        className={styles.appVideoPreviewClose}
        type="button"
        aria-label="Close preview"
        title="Close"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        <X size={20} aria-hidden />
      </button>
      <div className={styles.appVideoPreviewStage} onClick={(event) => event.stopPropagation()}>
        <video
          ref={videoRef}
          src={item.url}
          poster={item.posterUrl}
          controls
          autoPlay
          playsInline
          preload="metadata"
        />
        <strong data-i18n-skip>{item.title}</strong>
        {item.prompt ? <p data-i18n-skip>{item.prompt}</p> : null}
        {onTryPrompt && item.prompt ? (
          <button type="button" className={styles.appVideoPreviewTryLink} onClick={() => onTryPrompt(item.prompt!)}>Try this prompt</button>
        ) : item.tryHref ? (
          <Link prefetch={false} className={styles.appVideoPreviewTryLink} href={item.tryHref}>
            Try this prompt
          </Link>
        ) : null}
      </div>
    </div>
  ), uiLocale);
}

export function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  const uiLocale = useUiLocale();
  return localizeUiTree((
    <header className={styles.pageHeading}>
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  ), uiLocale);
}

function getBoardHref(board: SocialmediaBoardItem): string {
  return `/app/chat/${encodeURIComponent(board.session_id)}`;
}

function RecentPreview({ board }: { board: SocialmediaBoardItem }) {
  const uiLocale = useUiLocale();
  const [imageState, setImageState] = useState({
    url: "",
    ready: false
  });
  const imageUrl = board.image?.url;
  const imageReady = imageState.url === imageUrl ? imageState.ready : false;

  if (imageUrl) {
    return (
      <>
        {!imageReady ? <div className={styles.assetImageSkeleton} aria-hidden="true" /> : null}
        <AppFallbackImage
          className={imageReady ? styles.assetImageReady : styles.assetImageLoading}
          src={imageUrl}
          alt={board.image?.promptSummary || board.title}
          fill
          sizes={APP_RECENT_COVER_SIZES}
          onLoad={() => setImageState({
            url: imageUrl,
            ready: true
          })}
          onError={() => {
            setImageState({
              url: imageUrl,
              ready: true
            });
          }}
        />
      </>
    );
  }

  return localizeUiTree((
    <div className={styles.recentEmptyPreview} aria-hidden="true">
      <AppFallbackImage
        src="/assets/app-default-session-cover.png"
        alt=""
        fill
        sizes={APP_RECENT_COVER_SIZES}
      />
    </div>
  ), uiLocale);
}

function RecentMoreButton({
  isOpen,
  isDeleting,
  onToggle,
  onDelete
}: {
  isOpen: boolean;
  isDeleting: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const uiLocale = useUiLocale();
  return localizeUiTree((
    <div className={styles.recentMoreMenuWrap}>
      <button
        className={styles.recentMoreButton}
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <span aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>
      {isOpen ? (
        <div className={styles.recentMoreMenu} role="menu">
          <button
            type="button"
            role="menuitem"
            className={styles.recentDeleteMenuItem}
            onClick={onDelete}
            disabled={isDeleting}
          >
            <Trash2 size={14} aria-hidden />
            <span>{isDeleting ? "Deleting..." : "Delete"}</span>
          </button>
        </div>
      ) : null}
    </div>
  ), uiLocale);
}

export function RecentsSection({ expanded = false }: { expanded?: boolean }) {
  const uiLocale = useUiLocale();
  const account = useAppAccountStore((state) => state.account);
  const accountIdentityKey = `${account.authMode ?? "unknown"}:${account.id}`;
  const accountReady = useAppAccountStore((state) => state.isReady);
  const [selection, setSelection] = useState({ accountKey: accountIdentityKey, page: 1, previousPage: 1 });
  const page = selection.accountKey === accountIdentityKey ? selection.page : 1;
  const requestedPage = expanded ? page : 1;
  const previousPage = expanded && selection.accountKey === accountIdentityKey ? selection.previousPage : 1;
  const cacheVersion = useAppRecentsStore((state) => state.version);
  const pageState = useAppRecentsStore((state) => accountReady && state.pages[requestedPage]?.accountKey === accountIdentityKey ? state.pages[requestedPage] : undefined);
  const previousPageState = useAppRecentsStore((state) => accountReady && state.pages[previousPage]?.accountKey === accountIdentityKey ? state.pages[previousPage] : undefined);
  const setCachedReady = useAppRecentsStore((state) => state.setReady);
  const [openRecentMenuSessionId, setOpenRecentMenuSessionId] = useState<string | null>(null);
  const [deletingRecentSessionId, setDeletingRecentSessionId] = useState<string | null>(null);
  const [deleteConfirmRecent, setDeleteConfirmRecent] = useState<SocialmediaBoardItem | null>(null);

  useEffect(() => {
    if (!accountReady) return;
    let disposed = false;
    void loadAppRecentsPage(accountIdentityKey, requestedPage).then((result) => {
      const totalPages = result?.pagination?.totalPages;
      if (!disposed && expanded && result?.status === "ready" && totalPages && requestedPage > totalPages) {
        setSelection({ accountKey: accountIdentityKey, page: totalPages, previousPage: requestedPage });
      }
    });
    return () => { disposed = true; };
  }, [accountIdentityKey, accountReady, cacheVersion, expanded, requestedPage]);

  const prefetchNextPage = useCallback(() => {
    if (!expanded || !accountReady || deletingRecentSessionId || pageState?.status !== "ready" || !pageState.pagination?.hasNextPage) return;
    const connection = (navigator as Navigator & { connection?: PrefetchConnection }).connection;
    if (document.visibilityState !== "visible" || !allowsBackgroundPrefetch(connection)) return;
    void loadAppRecentsPage(accountIdentityKey, requestedPage + 1);
  }, [accountIdentityKey, accountReady, deletingRecentSessionId, expanded, pageState, requestedPage]);

  useEffect(() => {
    if (!expanded || pageState?.status !== "ready" || !pageState.pagination?.hasNextPage) return;
    let timer: number | undefined;
    let idleId: number | undefined;
    const schedule = () => {
      if (document.visibilityState !== "visible" || timer !== undefined || idleId !== undefined) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        const run = () => { idleId = undefined; prefetchNextPage(); };
        if ("requestIdleCallback" in window) idleId = window.requestIdleCallback(run, { timeout: 1_000 });
        else run();
      }, 250);
    };
    document.addEventListener("visibilitychange", schedule);
    schedule();
    return () => {
      document.removeEventListener("visibilitychange", schedule);
      if (timer !== undefined) window.clearTimeout(timer);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
    };
  }, [expanded, pageState, prefetchNextPage]);

  const status = pageState?.status ?? "idle";
  const isLoading = status === "idle" || status === "loading";
  const isClaimedGuest = status === "claimed_guest";
  const displayState = (isLoading || status === "failed") && previousPageState?.status === "ready"
    ? previousPageState
    : pageState;
  const recents = displayState?.recents ?? EMPTY_RECENTS;
  const pagination = displayState?.pagination ?? null;
  const displayedPage = pagination?.page ?? requestedPage;
  const totalPages = pagination?.totalPages ?? 1;
  const hasPreviousPage = Boolean(pagination?.hasPreviousPage);
  const hasNextPage = Boolean(pagination?.hasNextPage);
  const emptyMessage = status === "failed"
    ? "Failed to load recents."
    : isLoading
      ? "Loading recents..."
      : "No recents yet.";

  const changePage = (nextPage: number) => {
    if (isLoading || deletingRecentSessionId) return;
    setOpenRecentMenuSessionId(null);
    setSelection({ accountKey: accountIdentityKey, page: nextPage, previousPage: displayedPage });
    // Explicit navigation also retries a failed prefetch for the same page.
    void loadAppRecentsPage(accountIdentityKey, nextPage);
  };

  const handleDeleteRecent = useCallback(async (recent: SocialmediaBoardItem) => {
    if (deletingRecentSessionId || isLoading || displayedPage !== requestedPage) return;
    const requestVersion = useAppRecentsStore.getState().version;
    const isCurrentDeletion = () => useAppRecentsStore.getState().version === requestVersion && isCurrentRecentsAccount(accountIdentityKey);

    setDeletingRecentSessionId(recent.session_id);
    setOpenRecentMenuSessionId(null);
    setDeleteConfirmRecent(null);

    const previousRecents = recents;
    const previousPagination = pagination;
    const nextTotal = Math.max(0, (pagination?.total ?? recents.length) - 1);
    const optimisticRecents = recents.filter((item) => item.session_id !== recent.session_id);
    const optimisticPagination = pagination ? {
      ...pagination,
      total: nextTotal,
      totalPages: Math.max(1, Math.ceil(nextTotal / pagination.limit)),
      hasNextPage: requestedPage * pagination.limit < nextTotal
    } : null;
    setCachedReady(requestedPage, accountIdentityKey, optimisticRecents, optimisticPagination);

    try {
      resetAppThreadSessionCache();
      const response = await fetch(`/api/v1/sessions/${encodeURIComponent(recent.session_id)}`, {
        method: "DELETE"
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete conversation.");
      }

      if (!isCurrentDeletion()) return;
      useAppRecentsStore.getState().invalidatePages(requestedPage, accountIdentityKey);
      await loadAppRecentsPage(accountIdentityKey, requestedPage);
      dispatchAppToast("Conversation deleted.", "success");
    } catch (error) {
      if (!isCurrentDeletion()) return;
      setCachedReady(requestedPage, accountIdentityKey, previousRecents, previousPagination);
      dispatchAppToast(error instanceof Error ? error.message : "Failed to delete conversation.", "error");
    } finally {
      setDeletingRecentSessionId(null);
    }
  }, [accountIdentityKey, deletingRecentSessionId, displayedPage, isLoading, pagination, recents, requestedPage, setCachedReady]);

  if (!expanded && (account.authMode === "guest_claimed" || isClaimedGuest || (recents.length === 0 && status === "ready"))) return null;

  return localizeUiTree((
    <section className={styles.recentsSection} aria-busy={isLoading}>
      <div className={styles.sectionHead}>
        <h2>Recents</h2>
        {!expanded ? <Link prefetch={false} href="/app/recents">View all</Link> : null}
      </div>
      {recents.length ? (
        <div className={`${styles.recentGrid} ${expanded ? styles.recentGridExpanded : ""}`}>
          {recents.map((recent) => (
            <article className={styles.recentCard} key={recent.session_id}>
              <Link
                prefetch={false}
                className={styles.recentCardLink}
                href={getBoardHref(recent)}
                onMouseEnter={() => prefetchAppThreadSession(recent.session_id)}
                onFocus={() => prefetchAppThreadSession(recent.session_id)}
                onTouchStart={() => prefetchAppThreadSession(recent.session_id)}
              >
                <div className={styles.recentPreview}>
                  <RecentPreview board={recent} />
                </div>
                <span className={styles.recentTitleWrap}>
                  <span className={styles.recentTitle} title={recent.title}>{recent.title}</span>
                </span>
              </Link>
              <RecentMoreButton
                isOpen={openRecentMenuSessionId === recent.session_id}
                isDeleting={deletingRecentSessionId === recent.session_id}
                onToggle={() => setOpenRecentMenuSessionId((current) => (
                  current === recent.session_id ? null : recent.session_id
                ))}
                onDelete={() => {
                  if (isLoading || displayedPage !== requestedPage) return;
                  setOpenRecentMenuSessionId(null);
                  setDeleteConfirmRecent(recent);
                }}
              />
            </article>
          ))}
        </div>
      ) : (
        <div className={`${styles.listEmpty} ${styles.recentsEmptyState}`} role="status">
          {isClaimedGuest ? (
            <div className={styles.recentsClaimedGuestMessage}>
              <p>Sign in to view your recent creations.</p>
              <button type="button" className={styles.recentsClaimedSigninButton} data-app-auth-trigger>
                Sign in
              </button>
            </div>
          ) : emptyMessage}
        </div>
      )}
      {expanded && displayState?.status === "ready" && totalPages > 1 ? (
        <div className={styles.listPagination} aria-label="Recents pagination">
          <button
            type="button"
            onClick={() => {
              if (hasPreviousPage) changePage(Math.max(1, displayedPage - 1));
            }}
            disabled={!hasPreviousPage || isLoading || Boolean(deletingRecentSessionId)}
            aria-label="Previous page"
            title="Previous page"
          >
            <ArrowLeft size={15} aria-hidden />
          </button>
          <span>{displayedPage} / {totalPages}</span>
          <button
            type="button"
            onClick={() => {
              if (hasNextPage) changePage(displayedPage + 1);
            }}
            onMouseEnter={prefetchNextPage}
            onFocus={prefetchNextPage}
            disabled={!hasNextPage || isLoading || Boolean(deletingRecentSessionId)}
            aria-label="Next page"
            title="Next page"
          >
            <ArrowRight size={15} aria-hidden />
          </button>
        </div>
      ) : null}
      {deleteConfirmRecent && typeof document !== "undefined" ? createPortal(
        localizeUiTree(<div
          className={styles.deleteConfirmOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
          onClick={() => {
            if (!deletingRecentSessionId) setDeleteConfirmRecent(null);
          }}
        >
          <div className={styles.deleteConfirmShell} onClick={(event) => event.stopPropagation()}>
            <h3 id="delete-confirm-title">Confirm deletion</h3>
            <p>Delete this conversation? This removes it from your recents.</p>
            <div className={styles.deleteConfirmActions}>
              <button
                type="button"
                className={styles.deleteConfirmCancel}
                onClick={() => setDeleteConfirmRecent(null)}
                disabled={Boolean(deletingRecentSessionId)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.deleteConfirmSubmit}
                onClick={() => void handleDeleteRecent(deleteConfirmRecent)}
                disabled={Boolean(deletingRecentSessionId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>, uiLocale),
        document.body
      ) : null}
    </section>
  ), uiLocale);
}

function getTemplateCacheKey(params: { sourceUseCase?: string; category?: string; limit: number }) {
  const revision = params.sourceUseCase?.trim() === "poster-maker" ? ":general-poster-20260907" : "";
  return `${params.sourceUseCase?.trim() || "all"}:${params.category?.trim() || "popular"}:${params.limit}${revision}`;
}

export function useTemplateCache({
  sourceUseCase,
  category = "popular",
  limit,
  enabled = true
}: {
  sourceUseCase?: string;
  category?: string;
  limit: number;
  enabled?: boolean;
}) {
  const templateSourceUseCase = sourceUseCase === "ai-album-cover-generator" ? "ai-album-cover" : sourceUseCase;
  const cacheKey = getTemplateCacheKey({ sourceUseCase: templateSourceUseCase, category, limit });
  const entry = useAppExploreStore((state) => state.entries[cacheKey]);
  const setCachedLoading = useAppExploreStore((state) => state.setLoading);
  const setCachedReady = useAppExploreStore((state) => state.setReady);
  const setCachedFailed = useAppExploreStore((state) => state.setFailed);

  useEffect(() => {
    if (!enabled) return;
    const cached = useAppExploreStore.getState().entries[cacheKey];
    const hasReadyCache = cached?.status === "ready";
    const shouldRefresh = hasReadyCache
      && Date.now() - (cached.updatedAt ?? 0) > APP_EXPLORE_CACHE_TTL_MS;
    if (hasReadyCache && !shouldRefresh) {
      return;
    }

    if (appExploreTemplateRequests.has(cacheKey)) {
      return;
    }

    if (!hasReadyCache) {
      setCachedLoading(cacheKey);
    }

    const request = (async () => {
      try {
        const params = new URLSearchParams({
          category,
          limit: String(limit)
        });
        if (templateSourceUseCase) params.set("source", templateSourceUseCase);
        if (sourceUseCase === "poster-maker") params.set("revision", "general-poster-20260907");
        const response = await fetch(`/api/v1/visual-templates?${params.toString()}`);
        const data = (await response.json()) as VisualTemplatesResponse;
        if (!response.ok) throw new Error(data.error || "Failed to load prompt examples");
        setCachedReady(cacheKey, Array.isArray(data.templates) ? data.templates.slice(0, limit) : []);
      } catch {
        if (!hasReadyCache) {
          setCachedFailed(cacheKey);
        }
      }
    })();
    appExploreTemplateRequests.set(cacheKey, request);
    void request.finally(() => {
      appExploreTemplateRequests.delete(cacheKey);
    });
  }, [cacheKey, category, enabled, limit, setCachedFailed, setCachedLoading, setCachedReady, sourceUseCase, templateSourceUseCase]);

  const status = entry?.status ?? "idle";
  return {
    templates: enabled ? entry?.templates ?? [] : [],
    status: enabled ? status : "ready",
    isLoading: enabled && (status === "idle" || status === "loading")
  };
}

export function getTemplateImageUrl(template: AppExploreTemplate): string {
  const thumbUrl = buildStaticThumbWebpUrl(template.background_image_url, { allowRemote: true });
  if (thumbUrl) return thumbUrl;
  return buildSupabasePublicImageTransformUrl(template.background_image_url, {
    width: 420,
    height: 552,
    quality: 72,
    resize: "cover"
  });
}
