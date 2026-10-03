import type { BillingPackageId } from "@/lib/billing/catalog";
import {
  IMAGE_CREDIT_PACK_CHECKOUT_TYPE,
  isImageCreditPackPackageId
} from "@/lib/billing/image-credit-packs";
import {
  VIDEO_CREDIT_PACK_CHECKOUT_TYPE,
  isVideoCreditPackPackageId
} from "@/lib/billing/video-credit-packs";
import { isVideoGenerationSourceUseCase } from "@/lib/videos/source-use-case";

export type CreditPackCheckoutType =
  | typeof IMAGE_CREDIT_PACK_CHECKOUT_TYPE
  | typeof VIDEO_CREDIT_PACK_CHECKOUT_TYPE;

export function resolveCreditPackCheckoutType(params: {
  checkoutType?: string;
  packageId: BillingPackageId;
  allowUnambiguousPackageInference?: boolean;
}): CreditPackCheckoutType | undefined {
  if (
    params.checkoutType === IMAGE_CREDIT_PACK_CHECKOUT_TYPE
    && isImageCreditPackPackageId(params.packageId)
  ) {
    return IMAGE_CREDIT_PACK_CHECKOUT_TYPE;
  }
  if (
    params.checkoutType === VIDEO_CREDIT_PACK_CHECKOUT_TYPE
    && isVideoCreditPackPackageId(params.packageId)
  ) {
    return VIDEO_CREDIT_PACK_CHECKOUT_TYPE;
  }
  if (!params.allowUnambiguousPackageInference) return undefined;

  const isImagePack = isImageCreditPackPackageId(params.packageId);
  const isVideoPack = isVideoCreditPackPackageId(params.packageId);
  if (isImagePack === isVideoPack) return undefined;
  return isImagePack ? IMAGE_CREDIT_PACK_CHECKOUT_TYPE : VIDEO_CREDIT_PACK_CHECKOUT_TYPE;
}

export function creditPackCheckoutTypeMatchesOutput(params: {
  checkoutType: CreditPackCheckoutType;
  outputType?: string;
  sourceUseCase?: string;
}): boolean {
  const isVideoOutput = params.outputType === "video"
    || isVideoGenerationSourceUseCase(params.sourceUseCase);
  return params.checkoutType === VIDEO_CREDIT_PACK_CHECKOUT_TYPE
    ? isVideoOutput
    : !isVideoOutput;
}
