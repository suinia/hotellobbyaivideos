"use client";

import { useCallback, useSyncExternalStore } from "react";

type Banner = "annual-offer" | "video";
const changeEvent = "vismuse:session-banner-dismissal";
const fallbackDismissed = new Set<Banner>();

function subscribe(onChange: () => void) {
  window.addEventListener(changeEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(changeEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// Hide until hydration so a dismissed banner does not flash on refresh.
const getServerSnapshot = () => true;

export function useSessionBannerDismissal(banner: Banner) {
  const key = `vismuse:banner-dismissed:${banner}`;
  const getSnapshot = useCallback(() => {
    try {
      return window.sessionStorage.getItem(key) === "1" || fallbackDismissed.has(banner);
    } catch {
      return fallbackDismissed.has(banner);
    }
  }, [banner, key]);
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const dismiss = useCallback(() => {
    try {
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Keep dismissal functional when browser storage is unavailable.
      fallbackDismissed.add(banner);
    }
    window.dispatchEvent(new Event(changeEvent));
  }, [banner, key]);
  return [dismissed, dismiss] as const;
}
