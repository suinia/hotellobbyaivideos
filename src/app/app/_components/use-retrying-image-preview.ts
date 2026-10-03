"use client";

import { useEffect, useRef, useState } from "react";

const IMAGE_PREVIEW_AUTO_RETRY_DELAYS_MS = [600, 1_500, 3_000] as const;

export type ImagePreviewAutomaticRetryPlan = {
  delayMs: number;
  nextAutomaticRetryCount: number;
};

type ImagePreviewRetryState = {
  sourceUrl: string;
  requestVersion: number;
  automaticRetryCount: number;
};

type ImagePreviewRetryTimer = {
  id: number;
  requestKey: string;
};

export type RetryingImagePreview = {
  failed: boolean;
  handleError: () => "retrying" | "failed";
  handleLoad: () => void;
  loaded: boolean;
  requestKey: string;
  retry: () => void;
  retrying: boolean;
  src: string;
};

export function planImagePreviewAutomaticRetry(
  automaticRetryCount: number
): ImagePreviewAutomaticRetryPlan | null {
  const delayMs = IMAGE_PREVIEW_AUTO_RETRY_DELAYS_MS[automaticRetryCount];
  if (delayMs === undefined) return null;
  return {
    delayMs,
    nextAutomaticRetryCount: automaticRetryCount + 1
  };
}

export function buildImagePreviewFailureReason(assetId?: string | null): string {
  const normalizedAssetId = assetId?.trim();
  return normalizedAssetId
    ? `automatic_retries_exhausted;asset_id=${normalizedAssetId}`
    : "automatic_retries_exhausted";
}

function supportsImagePreviewCacheBuster(sourceUrl: string): boolean {
  if (/^(?:\.\.\/|\.\/|\/(?!\/))/i.test(sourceUrl)) return true;
  try {
    const parsed = new URL(sourceUrl);
    return parsed.pathname.startsWith("/storage/v1/object/")
      || parsed.pathname.startsWith("/storage/v1/render/image/");
  } catch {
    return false;
  }
}

export function buildImagePreviewRetryUrl(sourceUrl: string, requestVersion: number): string {
  const normalized = sourceUrl.trim();
  if (
    !normalized
    || requestVersion <= 0
    || /^(?:blob|data):/i.test(normalized)
    || !supportsImagePreviewCacheBuster(normalized)
  ) return normalized;

  const hashIndex = normalized.indexOf("#");
  const urlWithoutHash = hashIndex >= 0 ? normalized.slice(0, hashIndex) : normalized;
  const hash = hashIndex >= 0 ? normalized.slice(hashIndex) : "";
  const separator = urlWithoutHash.includes("?") ? "&" : "?";
  return `${urlWithoutHash}${separator}vismuse_preview_retry=${requestVersion}${hash}`;
}

export function shouldClearImagePreviewRetryTimer(
  timerRequestKey: string,
  currentRequestKey: string
): boolean {
  return timerRequestKey !== currentRequestKey;
}

export function isCurrentImagePreviewRetryTimer(
  activeTimerId: number | null | undefined,
  firingTimerId: number
): boolean {
  return activeTimerId === firingTimerId;
}

export function useRetryingImagePreview(sourceUrl?: string | null): RetryingImagePreview {
  const normalizedSourceUrl = sourceUrl?.trim() ?? "";
  const [retryState, setRetryState] = useState<ImagePreviewRetryState>(() => ({
    sourceUrl: normalizedSourceUrl,
    requestVersion: 0,
    automaticRetryCount: 0
  }));
  const [loadedRequestKey, setLoadedRequestKey] = useState("");
  const [failedRequestKey, setFailedRequestKey] = useState("");
  const [retryingRequestKey, setRetryingRequestKey] = useState("");
  const retryTimerRef = useRef<ImagePreviewRetryTimer | null>(null);

  const effectiveRetryState = retryState.sourceUrl === normalizedSourceUrl
    ? retryState
    : {
        sourceUrl: normalizedSourceUrl,
        requestVersion: 0,
        automaticRetryCount: 0
      };
  const requestKey = `${normalizedSourceUrl}::${effectiveRetryState.requestVersion}`;

  useEffect(() => {
    const retryTimer = retryTimerRef.current;
    if (
      retryTimer
      && shouldClearImagePreviewRetryTimer(retryTimer.requestKey, requestKey)
    ) {
      window.clearTimeout(retryTimer.id);
      retryTimerRef.current = null;
    }
  }, [requestKey]);

  useEffect(() => () => {
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current.id);
  }, []);

  function handleLoad() {
    if (retryTimerRef.current?.requestKey === requestKey) {
      window.clearTimeout(retryTimerRef.current.id);
      retryTimerRef.current = null;
    }
    setLoadedRequestKey(requestKey);
    setFailedRequestKey("");
    setRetryingRequestKey("");
    setRetryState((current) => current.sourceUrl === normalizedSourceUrl
      ? current
      : {
          sourceUrl: normalizedSourceUrl,
          requestVersion: 0,
          automaticRetryCount: 0
        });
  }

  function handleError(): "retrying" | "failed" {
    setLoadedRequestKey("");
    const retryPlan = normalizedSourceUrl
      ? planImagePreviewAutomaticRetry(effectiveRetryState.automaticRetryCount)
      : null;
    if (retryPlan) {
      setFailedRequestKey("");
      setRetryingRequestKey(requestKey);
      if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current.id);
      const retryTimerId = window.setTimeout(() => {
        if (!isCurrentImagePreviewRetryTimer(retryTimerRef.current?.id, retryTimerId)) return;
        retryTimerRef.current = null;
        setRetryState((current) => {
          const currentForSource = current.sourceUrl === normalizedSourceUrl
            ? current
            : {
                sourceUrl: normalizedSourceUrl,
                requestVersion: 0,
                automaticRetryCount: 0
              };
          if (
            currentForSource.requestVersion !== effectiveRetryState.requestVersion
          ) return currentForSource;
          return {
            sourceUrl: normalizedSourceUrl,
            requestVersion: currentForSource.requestVersion + 1,
            automaticRetryCount: retryPlan.nextAutomaticRetryCount
          };
        });
      }, retryPlan.delayMs);
      retryTimerRef.current = {
        id: retryTimerId,
        requestKey
      };
      return "retrying";
    }

    setRetryingRequestKey("");
    setFailedRequestKey(requestKey);
    return "failed";
  }

  function retry() {
    if (!normalizedSourceUrl) return;
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current.id);
      retryTimerRef.current = null;
    }
    setLoadedRequestKey("");
    setFailedRequestKey("");
    setRetryingRequestKey("");
    setRetryState({
      sourceUrl: normalizedSourceUrl,
      requestVersion: effectiveRetryState.requestVersion + 1,
      automaticRetryCount: 0
    });
  }

  return {
    failed: failedRequestKey === requestKey,
    handleError,
    handleLoad,
    loaded: loadedRequestKey === requestKey,
    requestKey,
    retry,
    retrying: retryingRequestKey === requestKey,
    src: buildImagePreviewRetryUrl(normalizedSourceUrl, effectiveRetryState.requestVersion)
  };
}
