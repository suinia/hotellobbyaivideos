export type AppCtaMockAccountMode = "guest" | "free";
export type AppCtaMockUi = "completed" | "failed";
export type AppCtaMockImagePreviewVariant = "watermarked" | "masked_blur" | "low_res_clean";
export type AppCtaMockImageAccessVariant = "watermarked" | "original";

export type AppCtaMockScene = {
  key: string;
  label: string;
  accountMode: AppCtaMockAccountMode;
  credits: number;
  ui: AppCtaMockUi;
  sourceUseCase: string;
  error?: string;
  image?: {
    accessVariant: AppCtaMockImageAccessVariant;
    previewVariant: AppCtaMockImagePreviewVariant;
  };
};

export const APP_CTA_MOCK_SCENES: Record<string, AppCtaMockScene> = {
  guestGeneratedImageSignupCta: {
    key: "guestGeneratedImageSignupCta",
    label: "guest用户生成水印图引导注册CTA",
    accountMode: "guest",
    credits: 50,
    ui: "completed",
    sourceUseCase: "ai-image-maker",
    image: {
      accessVariant: "watermarked",
      previewVariant: "watermarked"
    }
  },
  guestGeneratedBlurredImageSignupCta: {
    key: "guestGeneratedBlurredImageSignupCta",
    label: "guest用户生成模糊图引导注册CTA",
    accountMode: "guest",
    credits: 50,
    ui: "completed",
    sourceUseCase: "ai-image-maker",
    image: {
      accessVariant: "watermarked",
      previewVariant: "masked_blur"
    }
  },
  guestCreditLimitSignupCta: {
    key: "guestCreditLimitSignupCta",
    label: "guest用户积分耗尽引导注册CTA",
    accountMode: "guest",
    credits: 0,
    ui: "failed",
    sourceUseCase: "ai-image-maker",
    error: "You've used your current image generation credits."
  },
  freeGeneratedWatermarkedImageUpgradeCta: {
    key: "freeGeneratedWatermarkedImageUpgradeCta",
    label: "free用户生成水印图解锁CTA",
    accountMode: "free",
    credits: 50,
    ui: "completed",
    sourceUseCase: "ai-image-maker",
    image: {
      accessVariant: "watermarked",
      previewVariant: "watermarked"
    }
  },
  freeGeneratedBlurredImageUpgradeCta: {
    key: "freeGeneratedBlurredImageUpgradeCta",
    label: "free用户生成模糊图解锁CTA",
    accountMode: "free",
    credits: 50,
    ui: "completed",
    sourceUseCase: "ai-image-maker",
    image: {
      accessVariant: "watermarked",
      previewVariant: "masked_blur"
    }
  },
  freeGeneratedLowResImageUpgradeCta: {
    key: "freeGeneratedLowResImageUpgradeCta",
    label: "free用户生成低清预览图下载高清CTA",
    accountMode: "free",
    credits: 50,
    ui: "completed",
    sourceUseCase: "ai-image-maker",
    image: {
      accessVariant: "watermarked",
      previewVariant: "low_res_clean"
    }
  },
  freeUnlockedImageUpgradeCta: {
    key: "freeUnlockedImageUpgradeCta",
    label: "free用户已解锁图片继续升级CTA",
    accountMode: "free",
    credits: 50,
    ui: "completed",
    sourceUseCase: "ai-image-maker",
    image: {
      accessVariant: "original",
      previewVariant: "watermarked"
    }
  },
  freeCreditLimitUpgradeCta: {
    key: "freeCreditLimitUpgradeCta",
    label: "free用户积分耗尽升级CTA",
    accountMode: "free",
    credits: 50,
    ui: "failed",
    sourceUseCase: "ai-image-maker",
    error: "You've used your free credits."
  },
  freeCreditMinimumUpgradeCta: {
    key: "freeCreditMinimumUpgradeCta",
    label: "free用户积分不足升级CTA",
    accountMode: "free",
    credits: 3,
    ui: "failed",
    sourceUseCase: "ai-image-maker",
    error: "Insufficient credits: you need watermark-free images."
  }
};

export function resolveAppCtaMockScene(value?: string | null): AppCtaMockScene | null {
  const key = value?.trim();
  if (!key) return null;
  return APP_CTA_MOCK_SCENES[key] ?? null;
}
