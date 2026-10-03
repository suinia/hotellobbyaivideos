"use client";

import { useAppAccountStore } from "./app-account-store";
import { useAppRecentsStore, type AppListPagination, type AppRecentsPage } from "./app-recents-store";
import type { SocialmediaBoardItem } from "./app-workbench-types";

const PAGE_SIZE = 10;
const CACHE_TTL_MS = 30_000;
const requests = new Map<string, Promise<AppRecentsPage | undefined>>();

type BoardsResponse = {
  boards?: SocialmediaBoardItem[];
  pagination?: AppListPagination;
  error?: string;
  code?: string;
  claimed_email?: string;
  claimed_providers?: string[];
};

export function isCurrentRecentsAccount(accountKey: string): boolean {
  const { account, isReady } = useAppAccountStore.getState();
  return isReady && `${account.authMode ?? "unknown"}:${account.id}` === accountKey;
}

/** Visible loads and next-page prefetches share the same account-scoped request. */
export function loadAppRecentsPage(accountKey: string, page: number): Promise<AppRecentsPage | undefined> {
  if (!isCurrentRecentsAccount(accountKey)) return Promise.resolve(undefined);

  const store = useAppRecentsStore.getState();
  const { account } = useAppAccountStore.getState();
  const cached = store.pages[page]?.accountKey === accountKey ? store.pages[page] : undefined;
  if (account.authMode === "guest_claimed") {
    if (cached?.status !== "claimed_guest") {
      store.setClaimedGuest(page, accountKey, account.claimedEmail, account.claimedProviders);
    }
    return Promise.resolve(useAppRecentsStore.getState().pages[page]);
  }
  if (cached?.status === "claimed_guest"
    || (cached?.status === "ready" && cached.updatedAt !== null && Date.now() - cached.updatedAt < CACHE_TTL_MS)) {
    return Promise.resolve(cached);
  }

  const version = store.version;
  const requestKey = `${version}:${accountKey}:${page}`;
  const pending = requests.get(requestKey);
  if (pending) return pending;

  const hasReadyCache = cached?.status === "ready";
  if (!hasReadyCache) store.setLoading(page, accountKey);
  const isCurrentRequest = () => useAppRecentsStore.getState().version === version && isCurrentRecentsAccount(accountKey);

  const request = Promise.resolve().then(async () => {
    try {
      if (!isCurrentRequest()) return undefined;
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page) });
      const response = await fetch(`/api/v1/socialmedia/boards?${params.toString()}`, { cache: "no-store" });
      const data = await response.json() as BoardsResponse;
      if (!isCurrentRequest()) return undefined;
      if (!response.ok) {
        if (data.code === "GUEST_ACCOUNT_ALREADY_CLAIMED"
          || data.error?.toLowerCase().includes("guest workspace is already linked")) {
          store.setClaimedGuest(
            page,
            accountKey,
            data.claimed_email?.trim() || data.error?.match(/guest workspace is already linked to\s+(.+?)\.\s+Please sign in/i)?.[1]?.trim(),
            data.claimed_providers?.map((provider) => provider.trim()).filter(Boolean)
          );
          return useAppRecentsStore.getState().pages[page];
        }
        throw new Error(data.error || "Failed to load recents");
      }
      store.setReady(page, accountKey, Array.isArray(data.boards) ? data.boards.slice(0, PAGE_SIZE) : [], data.pagination ?? null);
      return useAppRecentsStore.getState().pages[page];
    } catch {
      if (isCurrentRequest() && !hasReadyCache) store.setFailed(page, accountKey);
      return undefined;
    } finally {
      requests.delete(requestKey);
    }
  });
  requests.set(requestKey, request);
  return request;
}
