"use client";

import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { captureAnalyticsEvent, getStoredAttribution } from "@/lib/analytics/posthog";
import { buildCheckoutAnalyticsProperties } from "@/lib/analytics/checkout";
import { rememberAppCheckoutContext } from "@/lib/analytics/app-checkout-recovery";
import { createGoogleAdsCheckoutIntentDedupeKey, trackGoogleAdsBeginCheckoutConversion, trackGoogleAdsSubscriptionModalViewConversion } from "@/lib/analytics/google-ads";
import { DEFAULT_PRICING_VARIANT, PRICING_EXPERIMENT_KEY, normalizePricingVariant, type PricingVariant } from "@/lib/billing/catalog";
import { readClientPricingVariantOverride, resolveClientPricingExperimentVariant } from "@/lib/billing/pricing-experiment-client";
import { ArrowLeft, ArrowRight, ImagePlus } from "lucide-react";
import commonStyles from "./app.module.css";
import pageStyles from "./app-library.module.css";
import { useAppAccountStore } from "./app-account-store";
import { useAppAssetsStore } from "./app-assets-store";
import { type AppListPagination } from "./app-recents-store";
import { type AppImagePreviewItem } from "./app-image-preview";
import { AppAssetPreviewOverlay, buildAppAssetPreviewItems, isLockedBlurredAsset, type AppAssetPreviewState } from "./app-asset-preview";
import { AppFallbackImage } from "./app-fallback-image";
import { buildSubscriptionModalPlans, type RechargePackageId } from "./app-subscription-model";
import { SubscriptionGateModal } from "./subscription-gate-modal";
import type { SocialmediaAssetItem } from "./app-workbench-types";
import { APP_ANALYTICS_WORKFLOW, buildAppGenerationAnalyticsProperties, openThreadAuthModal } from "./app-composer";
import { getAppCheckoutPlanName, type AppThreadMediaItem, saveThreadMedia, createThreadIdempotencyKey, APP_CHECKOUT_START_TIMEOUT_MS, getAppCheckoutFailureMessage, useResetCheckoutPendingOnPageShow } from "./app-shared";

const styles = { ...commonStyles, ...pageStyles };

type AssetsResponse = {
  assets?: SocialmediaAssetItem[];
  asset?: SocialmediaAssetItem;
  pagination?: AppListPagination;
  error?: string;
};

const ASSETS_SILENT_REFRESH_INTERVAL_MS = 30_000;

const EMPTY_APP_ASSETS: SocialmediaAssetItem[] = [];

const appAssetsPageRequests = new Map<string, Promise<void>>();

const APP_ASSET_THUMBNAIL_SIZES =
  "(max-width: 700px) 50vw, (max-width: 1040px) 33vw, (max-width: 1440px) 20vw, 220px";

export function AppAssets() {
  const uiLocale = useUiLocale();
  return localizeUiTree((
    <div className={styles.pageView}>
      <AssetsSection />
    </div>
  ), uiLocale);
}

function getAssetHref(asset: SocialmediaAssetItem): string {
  const sessionId = asset.session_id?.trim();
  if (!sessionId) return "/app/assets";

  return `/app/chat/${encodeURIComponent(sessionId)}`;
}

function assetToThreadMedia(asset: SocialmediaAssetItem): AppThreadMediaItem {
  return {
    url: asset.image.url,
    kind: "image",
    index: asset.image.imageIndex ?? 0,
    assetId: asset.asset_id || asset.assetId || asset.image.assetId,
    accessVariant: asset.image.accessVariant,
    previewVariant: asset.image.previewVariant,
    promptSummary: asset.image.promptSummary || asset.input_text,
    width: asset.image.width,
    height: asset.image.height
  };
}

function AssetPreview({ asset }: { asset: SocialmediaAssetItem }) {
  const uiLocale = useUiLocale();
  const [imageState, setImageState] = useState({
    url: "",
    ready: false
  });
  const imageUrl = asset.image?.url;
  const imageReady = imageState.url === imageUrl ? imageState.ready : false;

  if (imageUrl) {
    return (
      <>
        {!imageReady ? <div className={styles.assetImageSkeleton} aria-hidden="true" /> : null}
        <AppFallbackImage
          className={imageReady ? styles.assetImageReady : styles.assetImageLoading}
          src={imageUrl}
          alt={asset.image.promptSummary || asset.input_text || "Generated asset"}
          fill
          sizes={APP_ASSET_THUMBNAIL_SIZES}
          onLoad={() => setImageState({
            url: imageUrl,
            ready: true
          })}
          onError={() => {
            setImageState({
              url: imageUrl,
              ready: true
            });
          }}
        />
      </>
    );
  }

  return localizeUiTree((
    <div className={styles.assetEmptyPreview} aria-hidden="true">
      <ImagePlus size={28} />
    </div>
  ), uiLocale);
}

function AssetsSection() {
  const uiLocale = useUiLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedPricingVariant =
    searchParams.get("pricing_variant")
    ?? searchParams.get("variant");
  const account = useAppAccountStore((state) => state.account);
  const accountIdentityKey = useAppAccountStore((state) => (
    `${state.account.authMode ?? "unknown"}:${state.account.id}`
  ));
  const accountReady = useAppAccountStore((state) => state.isReady);
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<AppAssetPreviewState | null>(null);
  const [pricingVariant, setPricingVariant] = useState<PricingVariant>(() => (
    resolveClientPricingExperimentVariant({ requestedVariant: requestedPricingVariant }).variant
  ));
  const assignedPricingVariant = account.pricingVariant
    ? normalizePricingVariant(account.pricingVariant)
    : undefined;
  const pricingVariantOverride = readClientPricingVariantOverride();
  const pricingAssignmentReady = Boolean(pricingVariantOverride || assignedPricingVariant);
  const effectivePricingVariant = pricingVariantOverride
    ?? assignedPricingVariant
    ?? (requestedPricingVariant ? normalizePricingVariant(requestedPricingVariant) : undefined)
    ?? pricingVariant;
  const [upgradeAsset, setUpgradeAsset] = useState<SocialmediaAssetItem | null>(null);
  const [upgradePricingModalOpen, setUpgradePricingModalOpen] = useState(false);
  const [rechargePendingPackage, setRechargePendingPackage] = useState<"" | RechargePackageId>("");
  const [upgradeError, setUpgradeError] = useState("");
  useResetCheckoutPendingOnPageShow(() => setRechargePendingPackage(""));
  const pageState = useAppAssetsStore((state) => state.pages[page]?.accountKey === accountIdentityKey ? state.pages[page] : undefined);
  const assetsVersion = useAppAssetsStore((state) => state.version);
  const setCachedLoading = useAppAssetsStore((state) => state.setLoading);
  const setCachedReady = useAppAssetsStore((state) => state.setReady);
  const setCachedFailed = useAppAssetsStore((state) => state.setFailed);
  const subscriptionModalPlans = useMemo(() => {
    const billingContext = {
      market: account.billingMarket ?? "default",
      currency: account.billingCurrency ?? "USD"
    } as const;
    const plans = buildSubscriptionModalPlans(effectivePricingVariant, billingContext);
    return plans.length ? plans : buildSubscriptionModalPlans(DEFAULT_PRICING_VARIANT, billingContext);
  }, [account.billingCurrency, account.billingMarket, effectivePricingVariant]);
  const buildAssetsBillingAnalyticsProperties = useCallback((
    asset: SocialmediaAssetItem | null | undefined,
    overrides: Record<string, unknown> = {}
  ) => {
    const sourceUseCase = asset?.source_use_case?.trim() || "ai-image-maker";
    return buildAppGenerationAnalyticsProperties({
      product_area: "socialmedia",
      generation_entry: "app_assets",
      entry: APP_ANALYTICS_WORKFLOW,
      auth_state: account.authMode === "supabase" ? "signed_in" : account.authMode ?? "guest",
      auth_mode: account.authMode ?? "guest",
      account_plan: account.plan,
      credit_balance: account.credits,
      source_use_case: sourceUseCase,
      sourceUseCase,
      asset_id: asset?.asset_id,
      job_id: asset?.job_id,
      session_id: asset?.session_id,
      stage: "billing",
      billing_surface: "assets",
      surface: "assets",
      pricing_variant: effectivePricingVariant,
      pricing_experiment_key: PRICING_EXPERIMENT_KEY,
      ...overrides
    });
  }, [account.authMode, account.credits, account.plan, effectivePricingVariant]);

  useEffect(() => {
    const initialAssignment = resolveClientPricingExperimentVariant({
      assignedVariant: account.pricingVariant,
      requestedVariant: requestedPricingVariant
    });
    setPricingVariant(initialAssignment.variant);
  }, [account.pricingVariant, requestedPricingVariant]);

  useEffect(() => {
    if (!accountReady) return;

    const cached = useAppAssetsStore.getState().pages[page];
    const hasMatchingCache = cached?.accountKey === accountIdentityKey;
    const hasReadyCache = hasMatchingCache && cached?.status === "ready";
    const hasLoadingCache = hasMatchingCache && cached?.status === "loading";
    const shouldSilentlyRefresh = hasReadyCache
      && Date.now() - (cached.updatedAt ?? 0) > ASSETS_SILENT_REFRESH_INTERVAL_MS;
    if (hasLoadingCache) {
      return;
    }
    if (hasReadyCache && !shouldSilentlyRefresh) {
      return;
    }

    const requestKey = `${assetsVersion}:${accountIdentityKey}:${page}`;
    if (appAssetsPageRequests.has(requestKey)) {
      return;
    }

    if (!hasReadyCache) {
      setCachedLoading(page, accountIdentityKey);
    }

    const request = (async () => {
      try {
        const params = new URLSearchParams({
          limit: "10",
          page: String(page)
        });
        const response = await fetch(`/api/v1/socialmedia/assets?${params.toString()}`, {
          cache: "no-store"
        });
        const data = (await response.json()) as AssetsResponse;
        if (!response.ok) throw new Error(data.error || "Failed to load assets");
        const nextPagination = data.pagination ?? null;
        if (nextPagination && page > nextPagination.totalPages) {
          setPage(Math.max(1, nextPagination.totalPages));
          return;
        }
        setCachedReady(page, accountIdentityKey, Array.isArray(data.assets) ? data.assets : [], nextPagination);
      } catch {
        if (!hasReadyCache) {
          setCachedFailed(page, accountIdentityKey);
        }
      }
    })();
    appAssetsPageRequests.set(requestKey, request);
    void request.finally(() => {
      appAssetsPageRequests.delete(requestKey);
    });
  }, [accountIdentityKey, accountReady, assetsVersion, page, setCachedFailed, setCachedLoading, setCachedReady]);

  const assets = pageState?.assets ?? EMPTY_APP_ASSETS;
  const pagination = pageState?.pagination ?? null;
  const status = pageState?.status ?? "idle";
  const isLoading = status === "idle" || status === "loading";
  const totalPages = pagination?.totalPages ?? 1;
  const hasPreviousPage = Boolean(pagination?.hasPreviousPage);
  const hasNextPage = Boolean(pagination?.hasNextPage);
  const previewItems = useMemo(() => buildAppAssetPreviewItems(assets), [assets]);
  const selectedUpgradeSourceUseCase = upgradeAsset?.source_use_case?.trim() || "ai-image-maker";

  const openAssetSubscriptionModal = useCallback((asset: SocialmediaAssetItem) => {
    setUpgradeAsset(asset);
    setUpgradeError("");
    if (!account.isLoggedIn) {
      setPreview(null);
      openThreadAuthModal();
      return;
    }
    if (!pricingAssignmentReady) return;
    setPreview(null);
    setUpgradePricingModalOpen(true);
    trackGoogleAdsSubscriptionModalViewConversion({
      userId: account.authMode === "supabase" ? account.id : undefined
    });
    captureAnalyticsEvent("pricing_modal_opened", buildAssetsBillingAnalyticsProperties(asset, {
      action: "pricing_open",
      status: "started",
      trigger: "assets_preview_subscription",
      checkout_scenario: "assets_preview_subscription",
      modal_variant: "upgrade_pricing_modal",
      image_unlock_available: Boolean(asset.asset_id),
      displayed_image_access_variant: asset.image.accessVariant,
      image_index: asset.image.imageIndex
    }));
  }, [account.authMode, account.id, account.isLoggedIn, buildAssetsBillingAnalyticsProperties, pricingAssignmentReady]);

  const handleAssetPreviewDownload = useCallback(async (item: AppImagePreviewItem<SocialmediaAssetItem>) => {
    const asset = item.data;
    if (!asset) return;
    await saveThreadMedia(assetToThreadMedia(asset), asset.job_id || asset.asset_id);
  }, []);

  const subscribeFromAssetsUpgradeModal = useCallback(async (packageId: RechargePackageId) => {
    const selectedPlan = subscriptionModalPlans.find((item) => item.packageId === packageId);
    const plan = getAppCheckoutPlanName(packageId, subscriptionModalPlans);
    if (!account.isLoggedIn) {
      openThreadAuthModal();
      return;
    }

    const subscribeContext = buildAssetsBillingAnalyticsProperties(upgradeAsset, buildCheckoutAnalyticsProperties(packageId, {
      action: "subscribe_click",
      status: "started",
      package_id: packageId,
      checkout_plan: plan,
      plan,
      pricing_variant: effectivePricingVariant,
      pricing_experiment_key: PRICING_EXPERIMENT_KEY,
      trigger: "assets_preview_subscription",
      checkout_scenario: "assets_preview_subscription",
      modal_variant: "upgrade_pricing_modal",
      subscription_click_scenario: "manual_upgrade_modal"
    }));
    captureAnalyticsEvent("pricing_modal_subscribe_clicked", subscribeContext);
    captureAnalyticsEvent("checkout_plan_selected", subscribeContext);

    setRechargePendingPackage(packageId);
    setUpgradeError("");
    captureAnalyticsEvent("checkout_started_web", buildAssetsBillingAnalyticsProperties(upgradeAsset, buildCheckoutAnalyticsProperties(packageId, {
      action: "checkout_start",
      status: "started",
      package_id: packageId,
      checkout_plan: plan,
      plan,
      pricing_variant: effectivePricingVariant,
      pricing_experiment_key: PRICING_EXPERIMENT_KEY,
      trigger: "assets_preview_subscription",
      checkout_scenario: "assets_preview_subscription",
      value: selectedPlan?.value,
      currency: selectedPlan?.currency
    })));
    const checkoutIntentKey = createGoogleAdsCheckoutIntentDedupeKey(packageId);
    const googleAdsBeginCheckout = trackGoogleAdsBeginCheckoutConversion({
      dedupeKey: checkoutIntentKey,
      packageId,
      value: selectedPlan?.value,
      currency: selectedPlan?.currency
    });
    const checkoutController = new AbortController();
    const checkoutTimeoutId = window.setTimeout(() => checkoutController.abort(), APP_CHECKOUT_START_TIMEOUT_MS);
    try {
      const response = await fetch("/api/v1/credits/recharge", {
        method: "POST",
        signal: checkoutController.signal,
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": createThreadIdempotencyKey(packageId)
        },
        body: JSON.stringify({
          package_id: packageId,
          pricing_variant: effectivePricingVariant,
          asset_id: upgradeAsset?.asset_id,
          job_id: upgradeAsset?.job_id,
          session_id: upgradeAsset?.session_id,
          return_to: `${window.location.pathname}${window.location.search}`,
          discount_code: selectedPlan?.discountRequestCode,
          checkout_theme: "default",
          attribution: getStoredAttribution()
        })
      });
      const data = await response.json().catch(() => ({})) as {
        checkout_url?: string;
        transaction_id?: string;
        payment_provider?: string;
        package_id?: string;
        pricing_variant?: string;
        value?: number;
        currency?: string;
        error?: string;
      };
      if (response.status === 401 || response.status === 403) {
        openThreadAuthModal();
        return;
      }
      if (!response.ok) {
        throw new Error(data.error || "Checkout failed.");
      }
      if (!data.checkout_url) {
        throw new Error("Checkout link is missing.");
      }
      rememberAppCheckoutContext({
        checkoutId: data.transaction_id,
        packageId: data.package_id || packageId,
        kind: "subscription",
        paymentProvider: data.payment_provider,
        pricingVariant: data.pricing_variant ?? effectivePricingVariant,
        assetId: upgradeAsset?.asset_id,
        jobId: upgradeAsset?.job_id,
        sessionId: upgradeAsset?.session_id,
        value: data.value ?? selectedPlan?.value,
        currency: data.currency ?? selectedPlan?.currency
      });
      await googleAdsBeginCheckout;
      window.location.href = data.checkout_url;
    } catch (caughtError) {
      setUpgradeError(getAppCheckoutFailureMessage(caughtError));
    } finally {
      window.clearTimeout(checkoutTimeoutId);
      setRechargePendingPackage("");
    }
  }, [account.isLoggedIn, buildAssetsBillingAnalyticsProperties, effectivePricingVariant, subscriptionModalPlans, upgradeAsset]);

  return localizeUiTree((
    <section className={styles.assetsSection} aria-busy={isLoading}>
      <div className={styles.sectionHead}>
        <h2>Assets</h2>
      </div>
      {isLoading ? (
        <div className={styles.assetGrid} aria-hidden="true">
          {Array.from({ length: 10 }).map((_, index) => (
            <div className={`${styles.assetCard} ${styles.assetSkeletonCard}`} key={index} />
          ))}
        </div>
      ) : assets.length ? (
        <div className={styles.assetGrid}>
          {assets.map((asset) => (
            <button
              className={styles.assetCard}
              type="button"
              key={asset.asset_id}
              onClick={(event) => {
                if (isLockedBlurredAsset(asset)) {
                  setPreview(null);
                  openAssetSubscriptionModal(asset);
                  return;
                }
                const index = previewItems.findIndex((item) => item.data?.asset_id === asset.asset_id);
                if (index >= 0) {
                  const thumbnail = event.currentTarget.querySelector("img");
                  const thumbnailUrl = thumbnail?.currentSrc || thumbnail?.src;
                  const items = thumbnailUrl
                    ? previewItems.map((item, itemIndex) => itemIndex === index
                      ? { ...item, placeholderUrl: thumbnailUrl }
                      : item)
                    : previewItems;
                  setPreview({ items, index });
                }
              }}
              aria-label="Preview generated asset"
            >
              <AssetPreview asset={asset} />
            </button>
          ))}
        </div>
      ) : (
        <div className={`${styles.listEmpty} ${styles.recentsEmptyState}`} role="status">
          {status === "failed" ? "Failed to load assets." : "No assets yet."}
        </div>
      )}
      {status === "ready" && totalPages > 1 ? (
        <div className={styles.listPagination} aria-label="Assets pagination">
          <button
            type="button"
            onClick={() => {
              if (hasPreviousPage) setPage((currentPage) => Math.max(1, currentPage - 1));
            }}
            disabled={!hasPreviousPage}
            aria-label="Previous page"
            title="Previous page"
          >
            <ArrowLeft size={15} aria-hidden />
          </button>
          <span>{pagination?.page ?? page} / {totalPages}</span>
          <button
            type="button"
            onClick={() => {
              if (hasNextPage) setPage((currentPage) => currentPage + 1);
            }}
            disabled={!hasNextPage}
            aria-label="Next page"
            title="Next page"
          >
            <ArrowRight size={15} aria-hidden />
          </button>
        </div>
      ) : null}
      {preview ? (
        <AppAssetPreviewOverlay
          preview={preview}
          onClose={() => setPreview(null)}
          onDownload={handleAssetPreviewDownload}
          onOpenConversation={(asset) => router.push(getAssetHref(asset))}
          onOpenSubscription={openAssetSubscriptionModal}
        />
      ) : null}
      {pricingAssignmentReady && upgradePricingModalOpen ? (
        <SubscriptionGateModal
          mode="upgrade"
          accountPlan={account.plan}
          sourceUseCase={selectedUpgradeSourceUseCase}
          pricingVariant={effectivePricingVariant}
          plans={subscriptionModalPlans}
          pendingPackage={rechargePendingPackage}
          error={upgradeError}
          onClose={() => setUpgradePricingModalOpen(false)}
          onSubscribe={(packageId) => void subscribeFromAssetsUpgradeModal(packageId)}
        />
      ) : null}
    </section>
  ), uiLocale);
}
