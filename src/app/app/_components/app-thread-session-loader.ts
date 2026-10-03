"use client";

import { createThreadSessionLoader } from "@/lib/app/thread-session-loader";
import { allowsBackgroundPrefetch, type PrefetchConnection } from "@/lib/app/route-prefetch";
import { buildGuestUserRequestHeaders } from "@/lib/telemetry/client";
import { useAppAccountStore } from "./app-account-store";

export { AppThreadSessionFetchError, AppThreadSessionSupersededError } from "@/lib/app/thread-session-loader";

export function getThreadSessionAccountKey() {
  const { account, isReady } = useAppAccountStore.getState();
  if (!isReady || !account.id || account.authMode === "guest_claimed") return null;
  return JSON.stringify([account.id, account.authMode, account.isLoggedIn, account.plan, account.starterAccess]);
}

const loader = createThreadSessionLoader({
  identity: getThreadSessionAccountKey,
  fetch: (url, options) => fetch(url, {
    ...options,
    headers: { ...buildGuestUserRequestHeaders(), ...options?.headers }
  })
});

let previousIdentity = getThreadSessionAccountKey();
useAppAccountStore.subscribe(() => {
  const nextIdentity = getThreadSessionAccountKey();
  if (nextIdentity !== previousIdentity) {
    previousIdentity = nextIdentity;
    loader.reset();
  }
});

export const fetchAppThreadSession = loader.load;
export const resetAppThreadSessionCache = loader.reset;

export function prefetchAppThreadSession(sessionId: string) {
  if (document.visibilityState !== "visible") return;
  const connection = (navigator as Navigator & { connection?: PrefetchConnection }).connection;
  if (!allowsBackgroundPrefetch(connection)) return;
  void loader.prefetch(`/api/v1/sessions/${encodeURIComponent(sessionId)}`);
}
