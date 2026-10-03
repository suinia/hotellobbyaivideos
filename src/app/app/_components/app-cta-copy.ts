type AppCtaTemplateValue = string | number | null | undefined;

type AppCtaTemplateContext<TKey extends string> = Record<TKey, AppCtaTemplateValue>;

function appCtaTemplate<TKey extends string>(
  strings: TemplateStringsArray,
  ...keys: TKey[]
): (context: AppCtaTemplateContext<TKey>) => string {
  return (context) => strings.reduce((copy, chunk, index) => {
    const key = keys[index];
    const value = key ? context[key] : "";
    return `${copy}${chunk}${value ?? ""}`;
  }, "");
}

const SIGNUP_CREDIT_COUNT = 50;
const SIGNUP_APPROX_GENERATION_COUNT = 5;

type GuestSignupCtaTemplateContext = {
  freeCredits: number;
  approxGenerations: number;
};

type GuestSignupCtaText = {
  previewBadge: string;
  title: string;
  copy: string;
  inlineTitle: string;
  inlineCopy: string;
  primaryAction: string;
};

type GuestCreditLimitCtaText = {
  statusCopy: string;
  guestTitle: string;
  signedInTitle: string;
  guestCopy: string;
  modalTitle: string;
  modalCopy: string;
  modalNotice: string;
  guestPrimaryAction: string;
  signedInPrimaryAction: string;
};

type FreeImageUpgradeCtaText = {
  inlineTitle: string;
  inlineCopy: string;
  inlinePrimaryAction: string;
  previewTitle: string;
  previewCopy: string;
  previewPrimaryAction: string;
};

type FreeCreditLimitCtaText = {
  statusCopy: string;
  title: string;
  minimumCreditCopy: string;
  depletedCopy: string;
  primaryAction: string;
};

type FreeAssetPreviewUpgradeCtaText = {
  title: string;
  copy: string;
  primaryAction: string;
};

const guestSignupCtaTemplateContext: GuestSignupCtaTemplateContext = {
  freeCredits: SIGNUP_CREDIT_COUNT,
  approxGenerations: SIGNUP_APPROX_GENERATION_COUNT
};

// guest用户生成水印图引导注册CTA
export const guestGeneratedImageSignupCta: GuestSignupCtaText = {
  previewBadge: "Watermarked preview",
  title: appCtaTemplate`Save this image and get ${"freeCredits"} free credits`(guestSignupCtaTemplateContext),
  copy: appCtaTemplate`Create a free account to save it to your workspace and get ${"freeCredits"} credits—enough for up to ${"approxGenerations"} more generations.`(guestSignupCtaTemplateContext),
  inlineTitle: appCtaTemplate`Keep creating with ${"freeCredits"} free credits`(guestSignupCtaTemplateContext),
  inlineCopy: appCtaTemplate`${"freeCredits"} free credits • Save your creations • Access them anytime`(guestSignupCtaTemplateContext),
  primaryAction: "Create free account"
};

// guest用户生成模糊图引导注册CTA
export const guestGeneratedBlurredImageSignupCta: GuestSignupCtaText = {
  previewBadge: "Preview Locked",
  title: appCtaTemplate`Unlock this preview and get ${"freeCredits"} free credits`(guestSignupCtaTemplateContext),
  copy: "Create a free account to remove the blur and save the clear, watermarked version.",
  inlineTitle: "Unlock this preview and get 50 free credits",
  inlineCopy: "You have no free generations left. Create a free account to remove the blur and save the clear, watermarked version.",
  primaryAction: "Sign up to unlock preview"
};

// guest用户积分耗尽引导注册CTA
export const guestCreditLimitSignupCta: GuestCreditLimitCtaText = {
  statusCopy: "You’re out of free guest generations.",
  guestTitle: appCtaTemplate`Get ${"freeCredits"} free credits to keep creating`(guestSignupCtaTemplateContext),
  signedInTitle: "Continue creating from here",
  guestCopy: "Create a free account to continue generating images.",
  modalTitle: "Create a free account to save your work",
  modalCopy: "Sign in or create an account",
  modalNotice: appCtaTemplate`You're out of free credits. Create a free account to get ${"freeCredits"} free credits and keep generating this project. No credit card required.`(guestSignupCtaTemplateContext),
  guestPrimaryAction: "Sign up for free",
  signedInPrimaryAction: "Upgrade plan"
};

// free用户生成模糊图解锁CTA
export const freeGeneratedBlurredImageUpgradeCta: FreeImageUpgradeCtaText = {
  inlineTitle: "Unlock this image in HD",
  inlineCopy: "This result is locked as a preview. Upgrade to download the HD, watermark-free version.",
  inlinePrimaryAction: "Upgrade to unlock",
  previewTitle: "Unlock this image in HD",
  previewCopy: "This result is locked as a preview. Upgrade to download the HD, watermark-free version.",
  previewPrimaryAction: "Upgrade to unlock"
};

// free用户生成水印图解锁CTA
export const freeGeneratedWatermarkedImageUpgradeCta: FreeImageUpgradeCtaText = {
  inlineTitle: "Download without a watermark",
  inlineCopy: "HD downloads • No watermarks • Commercial uses",
  inlinePrimaryAction: "Upgrade to Pro",
  previewTitle: "Export without watermarks",
  previewCopy: "Upgrade to export generated images without watermarks.",
  previewPrimaryAction: "Upgrade to remove watermark"
};

// free用户生成低清预览图下载高清CTA
export const freeGeneratedLowResImageUpgradeCta: FreeImageUpgradeCtaText = {
  inlineTitle: "Download the HD original image",
  inlineCopy: "Upgrade to download the HD original image, then keep refining with Vismuse and create more versions.",
  inlinePrimaryAction: "Upgrade plan",
  previewTitle: "Download the HD original",
  previewCopy: "This is an ultra-low-res clean preview. Upgrade to download the HD original image.",
  previewPrimaryAction: "Download HD original"
};

// free用户积分耗尽升级CTA
export const freeCreditLimitUpgradeCta: FreeCreditLimitCtaText = {
  statusCopy: "You’re out of free credits.",
  title: "Upgrade to keep creating",
  minimumCreditCopy: "Get more credits to continue generating and refining images, plus HD exports without watermarks.",
  depletedCopy: "You've used your free credits. Pro gives you more room to refine, generate variations, and unlock watermark-free results.",
  primaryAction: "Upgrade to continue"
};

// free用户资产模糊图预览解锁CTA
export const freeAssetBlurredImageUpgradeCta: FreeAssetPreviewUpgradeCtaText = {
  title: "Unlock the original image",
  copy: "This is a locked preview. Subscribe to unlock the clear original image.",
  primaryAction: "Subscribe to unlock"
};

// free用户资产水印图预览解锁CTA
export const freeAssetWatermarkedImageUpgradeCta: FreeAssetPreviewUpgradeCtaText = {
  title: "Unlock the original image",
  copy: "Subscribe to export this image without the preview limit.",
  primaryAction: "Subscribe to unlock"
};

// free用户资产低清预览图下载高清CTA
export const freeAssetLowResImageUpgradeCta: FreeAssetPreviewUpgradeCtaText = {
  title: "Download the HD original",
  copy: "Subscribe to export this image without the preview limit.",
  primaryAction: "Subscribe for HD"
};
