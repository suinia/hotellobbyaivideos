"use client";

import { useCallback, useEffect } from "react";
import { allowsBackgroundPrefetch, type PrefetchConnection } from "@/lib/app/route-prefetch";

type ModalKind = "image" | "video";
const pendingLoads: Partial<Record<ModalKind, Promise<unknown>>> = {};

function preloadModal(kind: ModalKind): Promise<unknown> {
  if (!pendingLoads[kind]) {
    const load = kind === "video"
      ? import("@/app/ai-video-generator/_components/video-subscription-modal")
      : import("./subscription-gate-modal");
    pendingLoads[kind] = load.catch(() => {
      // A failed background request must not prevent the normal click from retrying.
      delete pendingLoads[kind];
    });
  }
  return pendingLoads[kind]!;
}

/** Fetch modal code after page load without mounting it or starting billing requests. */
export function useSubscriptionModalPreload(enabled: boolean, kind: ModalKind = "image") {
  const warm = useCallback(() => {
    if (enabled) void preloadModal(kind);
  }, [enabled, kind]);

  useEffect(() => {
    if (!enabled) return;
    const connection = (navigator as Navigator & { connection?: PrefetchConnection }).connection;
    let disposed = false;
    let idleId: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (disposed || document.readyState !== "complete" || document.visibilityState !== "visible"
        || !allowsBackgroundPrefetch(connection) || idleId !== undefined || timer !== undefined) return;
      const run = () => {
        idleId = undefined;
        timer = undefined;
        if (!disposed && document.visibilityState === "visible") warm();
      };
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(run, { timeout: 2_000 });
      } else {
        timer = setTimeout(run, 1_000);
      }
    };
    window.addEventListener("load", schedule, { once: true });
    document.addEventListener("visibilitychange", schedule);
    schedule();
    return () => {
      disposed = true;
      window.removeEventListener("load", schedule);
      document.removeEventListener("visibilitychange", schedule);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [enabled, warm]);

  return warm;
}
