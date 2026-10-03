import { isGuestUserId } from "@/lib/auth/guest";
import type { ReviseIntent } from "@/lib/types/job";

export type ComposerAuthMode = "supabase" | "guest" | "guest_claimed" | null | undefined;
export type RequestAuthMode = "supabase" | "guest" | "api-key" | "local-dev";
export type RequestFormat = "carousel" | undefined;
export type ImageRevisionIntent = Extract<ReviseIntent, "regenerate_cover" | "regenerate_slides">;

export const IMAGE_GENERATION_LOGIN_REQUIRED_MESSAGE =
  "Sign in to unlock image generation. Guest quick generate stays text-only.";
export const IMAGE_GENERATION_LOGIN_REQUIRED_CODE = "IMAGE_GENERATION_REQUIRES_LOGIN";

export function canGenerateImagesForAuth(authMode: ComposerAuthMode): boolean {
  return authMode === "supabase" || authMode === "guest";
}

export function coerceImageSelectionForAuth(selection: string, authMode: ComposerAuthMode): string {
  if (canGenerateImagesForAuth(authMode)) {
    return selection;
  }
  return "0";
}

export function isImageGenerationRequested(params: {
  format?: RequestFormat;
  imageCountInput?: string | null;
  forceConversation?: boolean;
}): boolean {
  if (params.forceConversation) return false;

  const normalizedSelection = params.imageCountInput?.trim().toLowerCase() || "";
  if (normalizedSelection === "0") return false;
  if (normalizedSelection === "auto") return true;
  if (normalizedSelection) {
    const parsed = Number(normalizedSelection);
    if (Number.isFinite(parsed)) {
      return parsed > 0;
    }
  }

  return (params.format ?? "carousel") === "carousel";
}

export function shouldRequireLoginForImageGeneration(params: {
  authMode: RequestAuthMode;
  format?: RequestFormat;
  imageCount?: number;
  forceConversation?: boolean;
}): boolean {
  void params;
  return false;
}

export function buildImageGenerationLoginRequiredResult() {
  return {
    status: 403 as const,
    payload: {
      error: IMAGE_GENERATION_LOGIN_REQUIRED_MESSAGE,
      code: IMAGE_GENERATION_LOGIN_REQUIRED_CODE
    }
  };
}

export function getDirectImageGenerationAuthGateResult(authMode: RequestAuthMode) {
  if (
    !shouldRequireLoginForImageGeneration({
      authMode,
      format: "carousel",
      imageCount: 1,
      forceConversation: false
    })
  ) {
    return null;
  }

  return buildImageGenerationLoginRequiredResult();
}

export function isImageRevisionIntent(intent: ReviseIntent | null | undefined): intent is ImageRevisionIntent {
  return intent === "regenerate_cover" || intent === "regenerate_slides";
}

export function getImageRevisionAuthGateResult(params: {
  authMode: RequestAuthMode;
  intent: ReviseIntent | null | undefined;
}) {
  if (!isImageRevisionIntent(params.intent)) {
    return null;
  }

  return getDirectImageGenerationAuthGateResult(params.authMode);
}

export function getStaleJobAutoReplayAuthGateResult(params: {
  ownerUserId?: string;
  format?: RequestFormat;
  imageCount?: number;
}) {
  const authMode: RequestAuthMode = params.ownerUserId && !isGuestUserId(params.ownerUserId) ? "supabase" : "guest";
  if (
    !shouldRequireLoginForImageGeneration({
      authMode,
      format: params.format,
      imageCount: params.imageCount,
      forceConversation: false
    })
  ) {
    return null;
  }

  return buildImageGenerationLoginRequiredResult();
}
