"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { allowsBackgroundPrefetch, createRoutePrefetchQueue, type PrefetchConnection } from "@/lib/app/route-prefetch";

const BACKGROUND_ROUTES = ["/app/recents", "/app/assets", "/app/explore"];
const START_DELAY_MS = 1_000;
const ROUTE_SPACING_MS = 2_500;
const INPUT_QUIET_MS = 1_500;

type PrefetchNavigator = Navigator & {
  connection?: PrefetchConnection & Partial<Pick<EventTarget, "addEventListener" | "removeEventListener">>;
  scheduling?: { isInputPending?: () => boolean };
};

/** Warm common destinations only after load, hydration, and an idle interval. */
export function useWorkbenchPrefetch(workbenchReady: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  const requestRef = useRef<(href: string) => void>(() => {});

  useEffect(() => {
    if (!workbenchReady) return;
    const queue = createRoutePrefetchQueue(pathname);
    BACKGROUND_ROUTES.forEach((route) => queue.enqueue(route));
    const nav = navigator as PrefetchNavigator;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idleId: number | undefined;
    let lastInputAt = Number.NEGATIVE_INFINITY;
    let nextSlotAt = Date.now() + START_DELAY_MS;
    let loaded = document.readyState === "complete";

    const recordInput = () => { lastInputAt = Date.now(); };
    const schedule = () => {
      if (disposed || !loaded || !queue.size || timer !== undefined || idleId !== undefined) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (document.visibilityState !== "visible" || !allowsBackgroundPrefetch(nav.connection)) return;
        const run = () => {
          idleId = undefined;
          if (disposed) return;
          if (document.visibilityState !== "visible" || !allowsBackgroundPrefetch(nav.connection)) return;
          if (Date.now() < nextSlotAt || Date.now() - lastInputAt < INPUT_QUIET_MS || nav.scheduling?.isInputPending?.()) {
            schedule();
            return;
          }
          const route = queue.take();
          if (route) {
            // App Router returns void, so space dispatches rather than pretending
            // to await network completion. Its cache serves subsequent navigation.
            nextSlotAt = Date.now() + ROUTE_SPACING_MS;
            try {
              // Next 16 AUTO can stop at a dynamic route boundary; warm the
              // full destination so the later bottom-tab switch uses its cache.
              router.prefetch(route, { kind: PrefetchKind.FULL, onInvalidate: () => queue.invalidate(route) });
            } catch {
              queue.invalidate(route);
            }
          }
          schedule();
        };
        if ("requestIdleCallback" in window) idleId = window.requestIdleCallback(run);
        else run();
      }, Math.max(200, nextSlotAt - Date.now(), INPUT_QUIET_MS - (Date.now() - lastInputAt)));
    };
    const onLoad = () => {
      loaded = true;
      nextSlotAt = Date.now() + START_DELAY_MS;
      schedule();
    };
    const onVisible = () => { if (document.visibilityState === "visible") schedule(); };
    requestRef.current = (href) => {
      queue.enqueue(href, true);
      schedule();
    };
    window.addEventListener("load", onLoad, { once: true });
    document.addEventListener("visibilitychange", onVisible);
    for (const event of ["keydown", "pointerdown", "touchstart", "wheel"]) {
      window.addEventListener(event, recordInput, { passive: true });
    }
    nav.connection?.addEventListener?.("change", schedule);
    schedule();
    return () => {
      disposed = true;
      requestRef.current = () => {};
      if (timer !== undefined) clearTimeout(timer);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      nav.connection?.removeEventListener?.("change", schedule);
      window.removeEventListener("load", onLoad);
      document.removeEventListener("visibilitychange", onVisible);
      for (const event of ["keydown", "pointerdown", "touchstart", "wheel"]) window.removeEventListener(event, recordInput);
    };
  }, [pathname, router, workbenchReady]);

  return useCallback((href: string) => requestRef.current(href), []);
}
