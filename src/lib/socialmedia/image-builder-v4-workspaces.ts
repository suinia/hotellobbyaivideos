/**
 * Canonical image-workbench coverage for the production V4 experiment.
 * Video workbenches intentionally stay on the video pipeline.
 */
export const IMAGE_BUILDER_V4_IMAGE_SOURCE_USE_CASES = [
  "ai-image-maker",
  "ai-image-text-editor",
  "tattoo-generator",
  "room-design",
  "ai-logo-generator",
  "ai-album-cover",
  "ai-book-cover",
  "ai-personal-image-generator",
  "ai-clothes-changer",
  "ai-sticker-generator",
  "ai-wallpaper-generator",
  "background-remover",
  "ai-product-ad-image-generator",
  "ai-flyer-generator",
  "ai-brochure-generator",
  "ai-infographic-generator",
  "ai-comic-generator",
  "ai-anime-generator",
  "baby-shower-invitations",
  "playlist-cover-maker",
  "vision-board-maker",
  "ai-menu-generator",
  "ai-certificate-generator",
  "poster-maker",
  "business-card-maker",
  "invitation-maker"
] as const;

export type ImageBuilderV4ImageSourceUseCase =
  (typeof IMAGE_BUILDER_V4_IMAGE_SOURCE_USE_CASES)[number];

const IMAGE_BUILDER_V4_IMAGE_SOURCE_USE_CASE_SET = new Set<string>(
  IMAGE_BUILDER_V4_IMAGE_SOURCE_USE_CASES
);

export function isImageBuilderV4ImageSourceUseCase(
  sourceUseCase?: string | null
): sourceUseCase is ImageBuilderV4ImageSourceUseCase {
  return IMAGE_BUILDER_V4_IMAGE_SOURCE_USE_CASE_SET.has(sourceUseCase?.trim() ?? "");
}
