"use client";

import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";

import { useMemo } from "react";
import type { SocialmediaAssetItem } from "./app-workbench-types";
import { AppImagePreviewOverlay, type AppImagePreviewItem, type AppImagePreviewState } from "./app-image-preview";
import {
  freeAssetBlurredImageUpgradeCta,
  freeAssetLowResImageUpgradeCta,
  freeAssetWatermarkedImageUpgradeCta
} from "./app-cta-copy";

export type AppAssetPreviewState = AppImagePreviewState<SocialmediaAssetItem>;

function isAssetUnlocked(asset?: SocialmediaAssetItem | null): boolean {
  return Boolean(asset?.unlocked || asset?.image?.accessVariant === "original");
}

export function isLockedBlurredAsset(asset?: SocialmediaAssetItem | null): boolean {
  return Boolean(
    asset
    && !isAssetUnlocked(asset)
    && asset.image.previewVariant === "masked_blur"
  );
}

function getAssetAlt(asset: SocialmediaAssetItem): string {
  return asset.image.promptSummary || asset.input_text || "Generated asset";
}

export function buildAppAssetPreviewItems(assets: SocialmediaAssetItem[]): AppImagePreviewItem<SocialmediaAssetItem>[] {
  return assets
    .filter((asset) => asset.image?.url)
    .map((asset) => ({
      url: asset.image.url,
      alt: getAssetAlt(asset),
      width: asset.image.width,
      height: asset.image.height,
      sizes: "(max-width: 768px) 100vw, 92vw",
      unoptimized: true,
      data: asset
    }));
}

function getAssetPreviewUpgradeCta(asset: SocialmediaAssetItem) {
  if (asset.image.previewVariant === "low_res_clean") return freeAssetLowResImageUpgradeCta;
  if (asset.image.previewVariant === "masked_blur") return freeAssetBlurredImageUpgradeCta;
  return freeAssetWatermarkedImageUpgradeCta;
}

export function AppAssetPreviewOverlay({
  preview,
  onClose,
  onDownload,
  onOpenConversation,
  onOpenSubscription
}: {
  preview: AppAssetPreviewState;
  onClose: () => void;
  onDownload: (item: AppImagePreviewItem<SocialmediaAssetItem>) => void | Promise<void>;
  onOpenConversation?: (asset: SocialmediaAssetItem) => void;
  onOpenSubscription: (asset: SocialmediaAssetItem) => void;
}) {
  const uiLocale = useUiLocale();
  const currentAsset = preview.items[preview.index]?.data ?? null;
  const locked = !isAssetUnlocked(currentAsset);
  const assetPreviewUpgradeCta = currentAsset ? getAssetPreviewUpgradeCta(currentAsset) : null;
  const upgradeCta = currentAsset && locked ? {
    title: assetPreviewUpgradeCta?.title ?? freeAssetWatermarkedImageUpgradeCta.title,
    body: assetPreviewUpgradeCta?.copy ?? freeAssetWatermarkedImageUpgradeCta.copy,
    buttonLabel: assetPreviewUpgradeCta?.primaryAction ?? freeAssetWatermarkedImageUpgradeCta.primaryAction,
    onClick: () => onOpenSubscription(currentAsset)
  } : undefined;
  const actionBar = useMemo(() => {
    if (locked || !currentAsset?.session_id || !onOpenConversation) return undefined;
    return {
      secondary: {
        label: "Back to conversation",
        onClick: () => onOpenConversation(currentAsset)
      }
    };
  }, [currentAsset, locked, onOpenConversation]);

  return localizeUiTree((
    <AppImagePreviewOverlay
      preview={preview}
      upgradeCta={upgradeCta}
      actionBar={actionBar}
      onDownload={onDownload}
      onClose={onClose}
    />
  ), uiLocale);
}
