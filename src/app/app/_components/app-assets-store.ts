"use client";

import { create } from "zustand";
import type { SocialmediaAssetItem } from "./app-workbench-types";
import type { AppListPagination } from "./app-recents-store";

export type AppAssetsStatus = "idle" | "loading" | "ready" | "failed";

export type AppAssetsPage = {
  accountKey: string;
  assets: SocialmediaAssetItem[];
  pagination: AppListPagination | null;
  status: AppAssetsStatus;
  updatedAt: number | null;
};

type AppAssetsStore = {
  pages: Record<number, AppAssetsPage>;
  version: number;
  setLoading: (page: number, accountKey: string) => void;
  setReady: (page: number, accountKey: string, assets: SocialmediaAssetItem[], pagination: AppListPagination | null) => void;
  setFailed: (page: number, accountKey: string) => void;
  reset: () => void;
};

function emptyPage(accountKey = ""): AppAssetsPage {
  return {
    accountKey,
    assets: [],
    pagination: null,
    status: "idle",
    updatedAt: null
  };
}

const initialState = {
  pages: {},
  version: 0
};

export const useAppAssetsStore = create<AppAssetsStore>((set) => ({
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
  setReady: (page, accountKey, assets, pagination) => set((state) => ({
    pages: {
      ...state.pages,
      [page]: {
        accountKey,
        assets,
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
  reset: () => set((state) => ({
    ...initialState,
    version: state.version + 1
  }))
}));

export function resetAppAssetsStore() {
  useAppAssetsStore.getState().reset();
}
