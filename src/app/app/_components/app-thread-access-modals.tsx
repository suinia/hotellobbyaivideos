"use client";

import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";

import type { PricingVariant } from "@/lib/billing/catalog";
import {
  type GeneratedImage,
  type RechargePackageId,
  type SubscriptionModalPlanOption,
  type SubscriptionSuccessModalPlan
} from "./app-subscription-model";
import {
  guestGeneratedBlurredImageSignupCta,
  guestGeneratedImageSignupCta
} from "./app-cta-copy";
import { SignupGateModal } from "./signup-gate-modal";
import { SubscriptionGateModal, type SubscriptionCta } from "./subscription-gate-modal";

type AppThreadAccessModalsProps = {
  accountPlan: string;
  sourceUseCase: string;
  pricingVariant: PricingVariant;
  plans: SubscriptionModalPlanOption[];
  pendingPackage: "" | RechargePackageId;
  error?: string;
  guestId?: string;
  isSignedIn: boolean;
  upgradeModalOpen: boolean;
  upgradeSourceUseCase?: string;
  upgradeTitle?: string;
  upgradeSubtitle?: string;
  onUpgradeClose: () => void;
  onSubscribe: (packageId: RechargePackageId, cta?: SubscriptionCta) => void;
  onUpgradePlanSelect?: (packageId: RechargePackageId, previousPackageId: RechargePackageId) => void;
  watermarkedSignupImage: GeneratedImage | null;
  onWatermarkedSignupClose: () => void;
  onWatermarkedSignupProviderSelect: (provider: "google" | "apple", image: GeneratedImage) => void;
  onWatermarkedSignupEmailStart: (image: GeneratedImage) => boolean | Promise<boolean>;
  onWatermarkedSignupEmailSuccess: () => Promise<void> | void;
  onWatermarkedSignupContinue: () => Promise<void>;
  imageModalOpen: boolean;
  imageModalPlan: SubscriptionSuccessModalPlan;
  imageModalImage: GeneratedImage | null;
  imageModalSelectableImages: GeneratedImage[];
  onImageModalClose: () => void;
  onImageModalSelect: (image: GeneratedImage) => void;
  onImageModalPlanSelect?: (packageId: RechargePackageId, previousPackageId: RechargePackageId) => void;
  onImageUnlock: (image: GeneratedImage) => void;
  onImageCreditPackViewOpen?: (packageIds: RechargePackageId[], image: GeneratedImage) => void;
  onImageCreditPackPlanSelect?: (packageId: RechargePackageId, previousPackageId: RechargePackageId, image: GeneratedImage) => void;
  onImageCreditPackSubscribe?: (packageId: RechargePackageId, image: GeneratedImage) => void;
  onImageGuestSignupUnlock: (image: GeneratedImage) => void;
  onImageDownloadWatermarked: (image: GeneratedImage) => Promise<{ downloadedBytes?: number } | void>;
  onImageGuestProviderSelect: (provider: "google" | "apple", image: GeneratedImage) => void;
  onImageGuestEmailStart: (image: GeneratedImage) => boolean | Promise<boolean>;
  onImageGuestEmailSuccess: () => Promise<void> | void;
  unlockPending: boolean;
};

export function AppThreadAccessModals({
  accountPlan,
  sourceUseCase,
  pricingVariant,
  plans,
  pendingPackage,
  error,
  guestId,
  isSignedIn,
  upgradeModalOpen,
  upgradeSourceUseCase,
  upgradeTitle,
  upgradeSubtitle,
  onUpgradeClose,
  onSubscribe,
  onUpgradePlanSelect,
  watermarkedSignupImage,
  onWatermarkedSignupClose,
  onWatermarkedSignupProviderSelect,
  onWatermarkedSignupEmailStart,
  onWatermarkedSignupEmailSuccess,
  onWatermarkedSignupContinue,
  imageModalOpen,
  imageModalPlan,
  imageModalImage,
  imageModalSelectableImages,
  onImageModalClose,
  onImageModalSelect,
  onImageModalPlanSelect,
  onImageUnlock,
  onImageCreditPackViewOpen,
  onImageCreditPackPlanSelect,
  onImageCreditPackSubscribe,
  onImageGuestSignupUnlock,
  onImageDownloadWatermarked,
  onImageGuestProviderSelect,
  onImageGuestEmailStart,
  onImageGuestEmailSuccess,
  unlockPending
}: AppThreadAccessModalsProps) {
  const uiLocale = useUiLocale();
  return localizeUiTree((
    <>
      {watermarkedSignupImage ? (
        <SignupGateModal
          image={watermarkedSignupImage}
          selectableImages={[watermarkedSignupImage]}
          previewBadge={guestGeneratedImageSignupCta.previewBadge}
          title={guestGeneratedImageSignupCta.title}
          copy={guestGeneratedImageSignupCta.copy}
          onClose={onWatermarkedSignupClose}
          onProviderSelect={(provider) => onWatermarkedSignupProviderSelect(provider, watermarkedSignupImage)}
          onEmailStart={() => onWatermarkedSignupEmailStart(watermarkedSignupImage)}
          onEmailSuccess={onWatermarkedSignupEmailSuccess}
          onContinueWithWatermark={onWatermarkedSignupContinue}
        />
      ) : null}
      {imageModalOpen && imageModalImage && imageModalPlan === "guest" ? (
        <SignupGateModal
          image={imageModalImage}
          selectableImages={imageModalSelectableImages.length ? imageModalSelectableImages : [imageModalImage]}
          onImageSelect={onImageModalSelect}
          previewBadge={guestGeneratedBlurredImageSignupCta.previewBadge}
          title={guestGeneratedBlurredImageSignupCta.title}
          copy={guestGeneratedBlurredImageSignupCta.copy}
          onClose={onImageModalClose}
          onProviderSelect={(provider) => onImageGuestProviderSelect(provider, imageModalImage)}
          onEmailStart={() => onImageGuestEmailStart(imageModalImage)}
          onEmailSuccess={onImageGuestEmailSuccess}
          onFallbackSignup={() => onImageGuestSignupUnlock(imageModalImage)}
        />
      ) : null}
      {upgradeModalOpen ? (
        <SubscriptionGateModal
          mode="upgrade"
          accountPlan={accountPlan}
          sourceUseCase={upgradeSourceUseCase ?? sourceUseCase}
          title={upgradeTitle}
          subtitle={upgradeSubtitle}
          pricingVariant={pricingVariant}
          plans={plans}
          pendingPackage={pendingPackage}
          error={error}
          onClose={onUpgradeClose}
          onSubscribe={onSubscribe}
          onPlanSelect={onUpgradePlanSelect}
        />
      ) : null}
      {imageModalOpen && imageModalImage && imageModalPlan !== "guest" ? (
        <SubscriptionGateModal
          mode="image"
          sourceUseCase={sourceUseCase}
          pricingVariant={pricingVariant}
          plan={imageModalPlan}
          image={imageModalImage}
          selectableImages={imageModalSelectableImages.length ? imageModalSelectableImages : [imageModalImage]}
          onImageSelect={onImageModalSelect}
          plans={plans}
          subscribePendingPackage={pendingPackage}
          unlockPending={unlockPending}
          error={error}
          onClose={onImageModalClose}
          onSubscribe={onSubscribe}
          onPlanSelect={onImageModalPlanSelect}
          onCreditPackViewOpen={(packageIds) => onImageCreditPackViewOpen?.(packageIds, imageModalImage)}
          onCreditPackPlanSelect={(packageId, previousPackageId) => onImageCreditPackPlanSelect?.(packageId, previousPackageId, imageModalImage)}
          onCreditPackSubscribe={onImageCreditPackSubscribe}
          onUnlock={() => onImageUnlock(imageModalImage)}
          onDownloadWatermarked={onImageDownloadWatermarked}
          isSignedIn={isSignedIn}
          accountPlan={accountPlan}
          guestId={guestId}
          onGuestProviderSelect={onImageGuestProviderSelect}
          onGuestEmailStart={onImageGuestEmailStart}
          onGuestEmailSuccess={onImageGuestEmailSuccess}
        />
      ) : null}
    </>
  ), uiLocale);
}
