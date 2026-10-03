"use client";

import { create } from "zustand";
import type { SocialmediaBoardItem } from "./app-workbench-types";

export type AppListPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type AppRecentsStatus = "idle" | "loading" | "ready" | "failed" | "claimed_guest";

export type AppRecentsPage = {
  accountKey: string;
  recents: SocialmediaBoardItem[];
  pagination: AppListPagination | null;
  status: AppRecentsStatus;
  updatedAt: number | null;
  claimedEmail?: string;
  claimedProviders?: string[];
};

type AppRecentsStore = {
  pages: Record<number, AppRecentsPage>;
  version: number;
  setLoading: (page: number, accountKey: string) => void;
  setReady: (page: number, accountKey: string, recents: SocialmediaBoardItem[], pagination: AppListPagination | null) => void;
  setFailed: (page: number, accountKey: string) => void;
  setClaimedGuest: (page: number, accountKey: string, claimedEmail?: string, claimedProviders?: string[]) => void;
  invalidatePages: (visiblePage: number, accountKey: string) => void;
  reset: () => void;
};

function emptyPage(accountKey = ""): AppRecentsPage {
  return {
    accountKey,
    recents: [],
    pagination: null,
    status: "idle",
    updatedAt: null
  };
}

const initialState = {
  pages: {},
  version: 0
};

export const useAppRecentsStore = create<AppRecentsStore>((set) => ({
  ...initialState,
  setLoading: (page, accountKey) => set((state) => {
    const current = state.pages[page]?.accountKey === accountKey ? state.pages[page] : emptyPage(accountKey);
    return {
      pages: {
        ...state.pages,
        [page]: {
          ...current,
          accountKey,
          status: "loading"
        }
      }
    };
  }),
  setReady: (page, accountKey, recents, pagination) => set((state) => ({
    pages: {
      ...state.pages,
      [page]: {
        accountKey,
        recents,
        pagination,
        status: "ready",
        updatedAt: Date.now()
      }
    }
  })),
  setFailed: (page, accountKey) => set((state) => {
    const current = state.pages[page]?.accountKey === accountKey ? state.pages[page] : emptyPage(accountKey);
    return {
      pages: {
        ...state.pages,
        [page]: {
          ...current,
          accountKey,
          status: "failed"
        }
      }
    };
  }),
  setClaimedGuest: (page, accountKey, claimedEmail, claimedProviders) => set((state) => ({
    pages: {
      ...state.pages,
      [page]: {
        accountKey,
        recents: [],
        pagination: null,
        status: "claimed_guest",
        updatedAt: Date.now(),
        claimedEmail,
        claimedProviders
      }
    }
  })),
  invalidatePages: (visiblePage, accountKey) => set((state) => {
    const current = state.pages[visiblePage];
    return {
      // Deletion shifts every subsequent page. Keep the visible optimistic
      // result while reloading, and reject any pre-deletion in-flight results.
      pages: current?.accountKey === accountKey
        ? { [visiblePage]: { ...current, updatedAt: null } }
        : {},
      version: state.version + 1
    };
  }),
  reset: () => set((state) => ({
    ...initialState,
    version: state.version + 1
  }))
}));

export function resetAppRecentsStore() {
  useAppRecentsStore.getState().reset();
}
