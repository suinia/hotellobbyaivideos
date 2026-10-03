"use client";

import { create } from "zustand";

export const APP_EXPLORE_CACHE_TTL_MS = 60 * 60 * 1000;

export type AppExploreTemplate = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  example_prompt?: string;
  starter_prompt: string;
  tags: string[];
  background_image_url: string;
  category: string;
  sort_order: number;
  default_aspect_ratio?: string;
  use_case_slug?: string;
  output_type?: string;
};

export type AppExploreStatus = "idle" | "loading" | "ready" | "failed";

export type AppExploreCacheEntry = {
  templates: AppExploreTemplate[];
  status: AppExploreStatus;
  updatedAt: number | null;
};

type AppExploreStore = {
  entries: Record<string, AppExploreCacheEntry>;
  setLoading: (key: string) => void;
  setReady: (key: string, templates: AppExploreTemplate[]) => void;
  setFailed: (key: string) => void;
};

const emptyEntry: AppExploreCacheEntry = {
  templates: [],
  status: "idle",
  updatedAt: null
};

export const useAppExploreStore = create<AppExploreStore>((set) => ({
  entries: {},
  setLoading: (key) => set((state) => {
    const current = state.entries[key] ?? emptyEntry;
    return {
      entries: {
        ...state.entries,
        [key]: {
          ...current,
          status: "loading"
        }
      }
    };
  }),
  setReady: (key, templates) => set((state) => ({
    entries: {
      ...state.entries,
      [key]: {
        templates,
        status: "ready",
        updatedAt: Date.now()
      }
    }
  })),
  setFailed: (key) => set((state) => {
    const current = state.entries[key] ?? emptyEntry;
    return {
      entries: {
        ...state.entries,
        [key]: {
          ...current,
          status: "failed"
        }
      }
    };
  })
}));
