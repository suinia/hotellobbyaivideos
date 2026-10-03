"use client";

import { create } from "zustand";
import { appAccountSummary, type AppAccountSummary } from "./app-data";

type AppAccountStore = {
  account: AppAccountSummary;
  isReady: boolean;
  setAccount: (account: AppAccountSummary) => void;
  markAccountReady: () => void;
  resetAccount: () => void;
};

export const useAppAccountStore = create<AppAccountStore>((set) => ({
  account: appAccountSummary,
  isReady: false,
  setAccount: (account) => {
    set({ account, isReady: true });
  },
  markAccountReady: () => {
    set({ isReady: true });
  },
  resetAccount: () => {
    set({ account: appAccountSummary, isReady: false });
  }
}));
