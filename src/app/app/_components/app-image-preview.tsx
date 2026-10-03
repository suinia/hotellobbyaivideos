"use client";

import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Check, Crown, Download, ImagePlus, LoaderCircle, X, ZoomIn, ZoomOut } from "lucide-react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { AppFallbackImage } from "./app-fallback-image";
import commonStyles from "./app.module.css";
import pageStyles from "./app-thread.module.css";

const styles = { ...commonStyles, ...pageStyles };

export type AppImagePreviewItem<TData = unknown> = {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  sizes?: string;
  quality?: number;
  unoptimized?: boolean;
  placeholderUrl?: string;
  data?: TData;
};

export type AppImagePreviewState<TData = unknown> = {
  items: AppImagePreviewItem<TData>[];
  index: number;
};

export function AppImagePreviewOverlay<TData = unknown>({
  preview,
  variant = "default",
  upgradeCta,
  actionBar,
  onEdit,
  onDownload,
  onClose,
}: {
  preview: AppImagePreviewState<TData>;
  variant?: "default" | "subscription";
  upgradeCta?: {
    title: string;
    body: string;
    buttonLabel: string;
    onClick: () => void;
  };
  actionBar?: {
    primary?: {
      label: string;
      pendingLabel?: string;
      pending?: boolean;
      onClick: () => void;
    };
    secondary: {
      label: string;
      disabled?: boolean;
      onClick: () => void;
    };
  };
  onEdit?: (item: AppImagePreviewItem<TData>) => void;
  onDownload?: (item: AppImagePreviewItem<TData>) => void | boolean | Promise<void | boolean>;
  onClose: () => void;
}) {
  const uiLocale = useUiLocale();
  const item = preview.items[preview.index];
  const [zoomState, setZoomState] = useState({ itemUrl: item?.url ?? "", scale: 1 });
  const [imageLoadState, setImageLoadState] = useState<{
    itemUrl: string;
    status: "loading" | "ready" | "failed";
  }>({ itemUrl: item?.url ?? "", status: "loading" });
  const [downloadState, setDownloadState] = useState<"idle" | "loading" | "success">("idle");
  const downloadResetTimeoutRef = useRef<number | null>(null);
  const suppressNextCloseRef = useRef(false);
  const zoom = zoomState.itemUrl === (item?.url ?? "") ? zoomState.scale : 1;
  const imageStateMatchesItem = imageLoadState.itemUrl === (item?.url ?? "");
  const imageReady = imageStateMatchesItem && imageLoadState.status === "ready";
  const imageFailed = imageStateMatchesItem && imageLoadState.status === "failed";
  const imageLoading = !imageReady && !imageFailed;
  const setImageStatus = (status: "ready" | "failed") => {
    setImageLoadState({ itemUrl: item?.url ?? "", status });
  };
  const setZoom = (scale: number) => {
    setZoomState({ itemUrl: item?.url ?? "", scale });
  };
  const downloading = downloadState === "loading";
  const downloaded = downloadState === "success";

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => () => {
    if (downloadResetTimeoutRef.current !== null) {
      window.clearTimeout(downloadResetTimeoutRef.current);
    }
  }, []);

  if (!item) return null;

  const hasImageDimensions =
    typeof item.width === "number" && item.width > 0
    && typeof item.height === "number" && item.height > 0;
  const handleOverlayClick = () => {
    if (suppressNextCloseRef.current) {
      suppressNextCloseRef.current = false;
      return;
    }
    onClose();
  };
  const suppressNextClose = () => {
    suppressNextCloseRef.current = true;
    window.setTimeout(() => {
      suppressNextCloseRef.current = false;
    }, 160);
  };
  const stopIfClickHitsContainedImage = (event: MouseEvent<HTMLElement>) => {
    const image = event.currentTarget.querySelector("img");
    if (!(image instanceof HTMLImageElement)) return;

    const { naturalWidth, naturalHeight } = image;
    const frame = image.getBoundingClientRect();
    if (naturalWidth <= 0 || naturalHeight <= 0 || frame.width <= 0 || frame.height <= 0) {
      event.stopPropagation();
      return;
    }

    const imageRatio = naturalWidth / naturalHeight;
    const frameRatio = frame.width / frame.height;
    const renderedWidth = frameRatio > imageRatio ? frame.height * imageRatio : frame.width;
    const renderedHeight = frameRatio > imageRatio ? frame.height : frame.width / imageRatio;
    const renderedLeft = frame.left + (frame.width - renderedWidth) / 2;
    const renderedTop = frame.top + (frame.height - renderedHeight) / 2;
    const hitsImage =
      event.clientX >= renderedLeft
      && event.clientX <= renderedLeft + renderedWidth
      && event.clientY >= renderedTop
      && event.clientY <= renderedTop + renderedHeight;

    if (hitsImage) {
      event.stopPropagation();
    }
  };
  const downloadImage = async () => {
    if (!onDownload || downloadState !== "idle") return;
    setDownloadState("loading");
    try {
      const didDownload = await onDownload(item);
      if (didDownload === false) {
        setDownloadState("idle");
        return;
      }
      setDownloadState("success");
      downloadResetTimeoutRef.current = window.setTimeout(() => {
        setDownloadState("idle");
        downloadResetTimeoutRef.current = null;
      }, 3000);
    } catch {
      setDownloadState("idle");
    }
  };

  return localizeUiTree((
    <div
      className={[
        styles.appImagePreviewOverlay,
        variant === "subscription" ? styles.appImagePreviewOverlaySubscription : "",
        upgradeCta || actionBar ? styles.appImagePreviewOverlayWithUpgrade : ""
      ].filter(Boolean).join(" ")}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={handleOverlayClick}
    >
      <TransformWrapper
        key={item.url}
        initialScale={1}
        minScale={0.5}
        maxScale={4}
        centerOnInit
        centerZoomedOut
        wheel={{ step: 0.12 }}
        pinch={{ step: 0.08 }}
        doubleClick={{ mode: "toggle", step: 1.25, animationTime: 180 }}
        velocityAnimation={{ animationTime: 180 }}
        onTransform={(_, state) => {
          setZoom(state.scale);
        }}
        onPanning={suppressNextClose}
        onPinchStart={suppressNextClose}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className={styles.appImagePreviewToolbar}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  zoomOut(0.25, 120);
                }}
                aria-label="Zoom out"
                title="Zoom out"
              >
                <ZoomOut size={20} aria-hidden />
              </button>
              <button
                type="button"
                className={styles.appImagePreviewZoomReset}
                onClick={(event) => {
                  event.stopPropagation();
                  resetTransform(140);
                  setZoom(1);
                }}
                aria-label="Reset zoom"
                title="Reset zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  zoomIn(0.25, 120);
                }}
                aria-label="Zoom in"
                title="Zoom in"
              >
                <ZoomIn size={20} aria-hidden />
              </button>
              {onEdit ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit(item);
                  }}
                  aria-label="Edit image"
                  title="Edit image"
                >
                  <ImagePlus size={20} aria-hidden />
                </button>
              ) : null}
              {onDownload ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void downloadImage();
                  }}
                  disabled={downloading || downloaded}
                  aria-label={downloading ? "Downloading image" : downloaded ? "Image downloaded" : "Download image"}
                  title={downloading ? "Downloading" : downloaded ? "Downloaded" : "Download"}
                >
                  {downloading ? <LoaderCircle size={20} className={styles.appImagePreviewActionSpinner} aria-hidden /> : downloaded ? <Check size={20} aria-hidden /> : <Download size={20} aria-hidden />}
                </button>
              ) : null}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onClose();
                }}
                aria-label="Close preview"
                title="Close"
              >
                <X size={20} aria-hidden />
              </button>
            </div>

            <div className={styles.appImagePreviewStage}>
              <TransformComponent
                wrapperClass={styles.appImagePreviewZoomWrapper}
                contentClass={styles.appImagePreviewZoomContent}
                wrapperStyle={{ width: "100%", height: "100%" }}
                contentStyle={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                {hasImageDimensions ? (
                  <span className={styles.appImagePreviewSizedFrame} onClick={stopIfClickHitsContainedImage}>
                    {!imageReady && item.placeholderUrl ? (
                      <AppFallbackImage
                        className={styles.appImagePreviewPlaceholder}
                        src={item.placeholderUrl}
                        alt=""
                        aria-hidden="true"
                        fill
                        sizes="100vw"
                        unoptimized
                        loading="eager"
                        style={{ pointerEvents: "none" }}
                        draggable={false}
                      />
                    ) : null}
                    <AppFallbackImage
                      src={item.url}
                      alt={item.alt || "Preview image"}
                      width={item.width}
                      height={item.height}
                      sizes={item.sizes ?? "100vw"}
                      quality={item.quality ?? 90}
                      unoptimized={item.unoptimized}
                      loading="eager"
                      fetchPriority="high"
                      className={imageReady ? styles.appImagePreviewMainImage : styles.appImagePreviewMainImageLoading}
                      style={{ pointerEvents: "auto" }}
                      draggable={false}
                      onLoad={() => setImageStatus("ready")}
                      onError={() => setImageStatus("failed")}
                    />
                    {imageLoading ? (
                      <span className={styles.appImagePreviewImageLoadingIndicator} role="status">
                        <LoaderCircle size={22} className={styles.appImagePreviewActionSpinner} aria-hidden="true" />
                        <span className={styles.appImagePreviewVisuallyHidden}>Loading preview image</span>
                      </span>
                    ) : null}
                    {imageFailed ? <span className={styles.appImagePreviewImageError} role="status">Image preview unavailable</span> : null}
                  </span>
                ) : (
                  <span
                    className={styles.appImagePreviewFillFrame}
                    onClick={stopIfClickHitsContainedImage}
                  >
                    {!imageReady && item.placeholderUrl ? (
                      <AppFallbackImage
                        className={styles.appImagePreviewPlaceholder}
                        src={item.placeholderUrl}
                        alt=""
                        aria-hidden="true"
                        fill
                        sizes="100vw"
                        unoptimized
                        loading="eager"
                        style={{ pointerEvents: "none" }}
                        draggable={false}
                      />
                    ) : null}
                    <AppFallbackImage
                      src={item.url}
                      alt={item.alt || "Preview image"}
                      fill
                      sizes={item.sizes ?? "(max-width: 768px) 100vw, 92vw"}
                      quality={item.quality ?? 90}
                      unoptimized={item.unoptimized}
                      loading="eager"
                      fetchPriority="high"
                      className={imageReady ? styles.appImagePreviewMainImage : styles.appImagePreviewMainImageLoading}
                      style={{ pointerEvents: "auto" }}
                      draggable={false}
                      onLoad={() => setImageStatus("ready")}
                      onError={() => setImageStatus("failed")}
                    />
                    {imageLoading ? (
                      <span className={styles.appImagePreviewImageLoadingIndicator} role="status">
                        <LoaderCircle size={22} className={styles.appImagePreviewActionSpinner} aria-hidden="true" />
                        <span className={styles.appImagePreviewVisuallyHidden}>Loading preview image</span>
                      </span>
                    ) : null}
                    {imageFailed ? <span className={styles.appImagePreviewImageError} role="status">Image preview unavailable</span> : null}
                  </span>
                )}
              </TransformComponent>
            </div>
          </>
        )}
      </TransformWrapper>

      {upgradeCta ? (
        <div className={styles.appImagePreviewUpgradeCta} onClick={(event) => event.stopPropagation()}>
          <div className={styles.appImagePreviewUpgradeCopy}>
            <strong>
              <Crown size={14} aria-hidden />
              {upgradeCta.title}
            </strong>
            <span>{upgradeCta.body}</span>
          </div>
          <button type="button" onClick={upgradeCta.onClick}>
            {upgradeCta.buttonLabel}
          </button>
        </div>
      ) : null}
      {actionBar ? (
        <div className={styles.appImagePreviewActionBar} onClick={(event) => event.stopPropagation()}>
          {actionBar.primary ? (
            <button
              type="button"
              className={styles.appImagePreviewPrimaryAction}
              onClick={actionBar.primary.onClick}
              disabled={actionBar.primary.pending}
            >
              {actionBar.primary.pending ? actionBar.primary.pendingLabel ?? "Processing..." : actionBar.primary.label}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.appImagePreviewSecondaryAction}
            onClick={actionBar.secondary.onClick}
            disabled={actionBar.secondary.disabled}
          >
            {actionBar.secondary.label}
          </button>
        </div>
      ) : null}
    </div>
  ), uiLocale);
}
