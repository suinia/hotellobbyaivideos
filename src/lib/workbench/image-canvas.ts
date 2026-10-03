import { workbenchTools, type WorkbenchToolSlug } from "@/lib/workbench/tools";

/** Output recommendations for providers that require a concrete auto canvas.
 * These do not change composer selections or derive dimensions from input assets.
 */
export const recommendedWorkbenchImageRatios = {
  "ai-image-maker": "9:16",
  "ai-image-text-editor": "1:1",
  "ai-video-generator": "9:16",
  "ai-animation-generator": "9:16",
  "ai-flyer-generator": "3:4",
  "ai-brochure-generator": "4:3",
  "ai-infographic-generator": "2:3",
  "ai-comic-generator": "3:4",
  "baby-shower-invitations": "4:5",
  "playlist-cover-maker": "1:1",
  "vision-board-maker": "1:1",
  "ai-anime-generator": "1:1",
  "ai-menu-generator": "2:3",
  "ai-certificate-generator": "4:3",
  "ai-album-cover-generator": "1:1",
  "ai-product-ad-image-generator": "4:5",
  "poster-maker": "3:4",
  "business-card-maker": "16:9",
  "ai-logo-generator": "1:1",
  "ai-personal-image-generator": "3:4",
  "ai-sticker-generator": "1:1",
  "ai-wallpaper-generator": "9:16",
  "ai-book-cover-generator": "2:3",
  "invitation-maker": "3:4",
  "background-remover": "1:1",
  "ai-clothes-changer": "2:3",
  "ai-room-design": "16:9",
  "ai-interior-design": "16:9",
  "tattoo-generator": "3:4"
} as const satisfies Record<WorkbenchToolSlug, string>;

export function recommendedWorkbenchImageRatio(sourceUseCase?: string): string {
  const workbench = Object.values(workbenchTools).find((tool) =>
    tool.sourceUseCase === sourceUseCase || tool.slug === sourceUseCase);
  return workbench ? recommendedWorkbenchImageRatios[workbench.slug] : "9:16";
}
