export const AI_VIDEO_GENERATOR_SOURCE_USE_CASE = "ai-video-generator";
export const AI_IMAGE_TO_VIDEO_SOURCE_USE_CASE = "ai-image-to-video";
export const AI_ANIMATION_GENERATOR_SOURCE_USE_CASE = "ai-animation-generator";
export const HOTEL_LOBBY_SOURCE_USE_CASE = "hotel-lobby-ai";
export const PROMO_VIDEO_MAKER_SOURCE_USE_CASE = "promo-video-maker";
export const SPOTIFY_CANVAS_SOURCE_USE_CASE = "spotify-canvas-generator";
export const VIDEO_GENERATION_SOURCE_USE_CASES = [
  AI_VIDEO_GENERATOR_SOURCE_USE_CASE,
  AI_IMAGE_TO_VIDEO_SOURCE_USE_CASE,
  AI_ANIMATION_GENERATOR_SOURCE_USE_CASE,
  PROMO_VIDEO_MAKER_SOURCE_USE_CASE,
  HOTEL_LOBBY_SOURCE_USE_CASE,
  SPOTIFY_CANVAS_SOURCE_USE_CASE
] as const;
export type VideoModelTier = "lite" | "pro" | "max";
export type MiniMaxH3Provider = "minimax" | "apimart";

export function isVideoGenerationSourceUseCase(sourceUseCase?: string | null): boolean {
  return VIDEO_GENERATION_SOURCE_USE_CASES.some((candidate) => candidate === sourceUseCase);
}

export function isMiniMaxH3VideoFlowSourceUseCase(sourceUseCase?: string | null): boolean {
  return sourceUseCase === AI_VIDEO_GENERATOR_SOURCE_USE_CASE
    || sourceUseCase === AI_IMAGE_TO_VIDEO_SOURCE_USE_CASE
    || sourceUseCase === AI_ANIMATION_GENERATOR_SOURCE_USE_CASE
    || sourceUseCase === PROMO_VIDEO_MAKER_SOURCE_USE_CASE
    || sourceUseCase === HOTEL_LOBBY_SOURCE_USE_CASE;
}

export function isSpotifyCanvasSourceUseCase(sourceUseCase?: string | null): boolean {
  return sourceUseCase === SPOTIFY_CANVAS_SOURCE_USE_CASE;
}

export function resolveVideoGenerationProviderForSourceUseCase(
  sourceUseCase: string | null | undefined,
  defaultProvider: string,
  miniMaxH3Provider: MiniMaxH3Provider = "minimax"
): string {
  return isMiniMaxH3VideoFlowSourceUseCase(sourceUseCase)
    ? miniMaxH3Provider
    : defaultProvider;
}

export function resolveMiniMaxH3VideoProvider(params: {
  provider: string;
  model?: string | null;
  miniMaxH3Provider: MiniMaxH3Provider;
}): string {
  return params.model?.trim().toLowerCase() === "minimax-h3"
    ? params.miniMaxH3Provider
    : params.provider;
}

export function resolveMiniMaxH3VideoResolutionForPlan(params: {
  requestedResolution?: string | null;
  plan?: string | null;
}): string {
  const canUse2K = params.plan === "basic" || params.plan === "pro" || params.plan === "max";
  return canUse2K && params.requestedResolution?.trim().toLowerCase() === "2k"
    ? "2K"
    : "768P";
}

export function resolveAllowedVideoModelTierForPlan(
  requestedTier: VideoModelTier | undefined,
  plan?: string | null
): VideoModelTier | undefined {
  return plan === "free" ? "lite" : requestedTier;
}

export function shouldUsePresetSpotifyCanvasGeneration(params: {
  sourceUseCase?: string | null;
  generationInputText?: string | null;
  targetAssetCount: number;
  parentJobId?: string | null;
}): boolean {
  return isSpotifyCanvasSourceUseCase(params.sourceUseCase)
    && Boolean(params.generationInputText?.trim())
    && (
      params.targetAssetCount > 0
      || Boolean(params.parentJobId?.trim())
    );
}

export function resolveSpotifyCanvasGenerationSourceAssets<T>(params: {
  sourceUseCase?: string | null;
  currentSourceAssets: T[];
  historicalSourceAssets: T[];
}): T[] {
  if (!isSpotifyCanvasSourceUseCase(params.sourceUseCase) || params.currentSourceAssets.length > 0) {
    return params.currentSourceAssets;
  }
  return params.historicalSourceAssets;
}
