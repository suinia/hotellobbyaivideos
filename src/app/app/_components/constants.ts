export const DEFAULT_APP_TOOL_SLUG = "ai-image-maker";

export const SOURCE_USE_CASE_APP_TOOL_SLUG_MAP: Record<string, string> = {
  "ai-image": "ai-image-maker",
  "ai-image-maker": "ai-image-maker",
  image: "ai-image-maker",
  "image-maker": "ai-image-maker",

  "ai-image-text-editor": "ai-image-text-editor",
  "image-text-editor": "ai-image-text-editor",
  "edit-text-in-image": "ai-image-text-editor",
  "change-text-in-image": "ai-image-text-editor",

  "ai-video": "ai-video-generator",
  "ai-video-generator": "ai-video-generator",
  "ai-image-to-video": "ai-image-to-video",
  video: "ai-video-generator",
  "video-generator": "ai-video-generator",

  "ai-animation": "ai-animation-generator",
  "ai-animation-generator": "ai-animation-generator",
  "animation-generator": "ai-animation-generator",
  "ai-animated-video-generator": "ai-animation-generator",

  "hotel-lobby-ai": "hotel-lobby-ai",
  "promo-video": "promo-video-maker",
  "promo-video-maker": "promo-video-maker",
  "promotional-video": "promo-video-maker",
  "promotional-video-maker": "promo-video-maker",

  "spotify-canvas": "spotify-canvas-generator",
  "spotify-canvas-generator": "spotify-canvas-generator",
  "spotify-canvas-video": "spotify-canvas-generator",

  "ai-product-ad": "ai-product-ad-image-generator",
  "ai-product-ad-image-generator": "ai-product-ad-image-generator",
  "product-ad": "ai-product-ad-image-generator",
  "product-ad-generator": "ai-product-ad-image-generator",

  "ai-flyer": "ai-flyer-generator",
  "ai-flyer-generator": "ai-flyer-generator",
  flyer: "ai-flyer-generator",
  "flyer-generator": "ai-flyer-generator",

  "ai-brochure": "ai-brochure-generator",
  "ai-brochure-generator": "ai-brochure-generator",
  brochure: "ai-brochure-generator",
  "brochure-generator": "ai-brochure-generator",

  "ai-infographic": "ai-infographic-generator",
  "ai-infographic-generator": "ai-infographic-generator",
  infographic: "ai-infographic-generator",
  "infographic-generator": "ai-infographic-generator",
  "infographic-maker": "ai-infographic-generator",

  "ai-comic": "ai-comic-generator",
  "ai-comic-generator": "ai-comic-generator",
  "ai-comic-maker": "ai-comic-generator",
  comic: "ai-comic-generator",
  "comic-generator": "ai-comic-generator",
  "comic-maker": "ai-comic-generator",
  "comic-strip-maker": "ai-comic-generator",

  "playlist-cover-maker": "playlist-cover-maker",
  "playlist-cover": "playlist-cover-maker",
  "ai-playlist-cover-generator": "playlist-cover-maker",
  "vision-board-maker": "vision-board-maker",
  "ai-vision-board-maker": "vision-board-maker",
  "vision-board": "vision-board-maker",
  "ai-anime": "ai-anime-generator",
  "ai-anime-generator": "ai-anime-generator",
  "anime-ai-generator": "ai-anime-generator",
  anime: "ai-anime-generator",
  "anime-generator": "ai-anime-generator",
  "anime-image-generator": "ai-anime-generator",
  "anime-art-generator": "ai-anime-generator",

  "ai-menu": "ai-menu-generator",
  "ai-menu-generator": "ai-menu-generator",
  menu: "ai-menu-generator",
  "menu-generator": "ai-menu-generator",
  "menu-maker": "ai-menu-generator",
  "restaurant-menu-maker": "ai-menu-generator",

  "ai-album-cover": "ai-album-cover-generator",
  "ai-album-cover-generator": "ai-album-cover-generator",
  "ai-album-cover-maker": "ai-album-cover-generator",
  "album-cover": "ai-album-cover-generator",
  "album-cover-generator": "ai-album-cover-generator",
  "album-cover-maker": "ai-album-cover-generator",

  "ai-book-cover": "ai-book-cover-generator",
  "ai-book-cover-generator": "ai-book-cover-generator",
  "ai-book-cover-maker": "ai-book-cover-generator",
  "book-cover": "ai-book-cover-generator",
  "book-cover-generator": "ai-book-cover-generator",
  "book-cover-maker": "ai-book-cover-generator",

  "ai-logo-generator": "ai-logo-generator",
  logo: "ai-logo-generator",
  "logo-generator": "ai-logo-generator",
  "logo-maker": "ai-logo-generator",

  "ai-personal-image-generator": "ai-personal-image-generator",
  "personal-image": "ai-personal-image-generator",
  "personal-image-generator": "ai-personal-image-generator",
  "profile-picture": "ai-personal-image-generator",
  "profile-picture-maker": "ai-personal-image-generator",

  "ai-sticker-generator": "ai-sticker-generator",
  sticker: "ai-sticker-generator",
  "sticker-generator": "ai-sticker-generator",
  "sticker-maker": "ai-sticker-generator",

  "ai-wallpaper-generator": "ai-wallpaper-generator",
  wallpaper: "ai-wallpaper-generator",
  "wallpaper-generator": "ai-wallpaper-generator",
  "wallpaper-maker": "ai-wallpaper-generator",

  "background-remover": "background-remover",
  "remove-background": "background-remover",

  "ai-clothes-changer": "ai-clothes-changer",
  "clothes-changer": "ai-clothes-changer",

  "ai-room-design": "ai-room-design",
  "room-design": "ai-room-design",

  "ai-interior-design": "ai-interior-design",
  "interior-design": "ai-interior-design",

  "business-card": "business-card-maker",
  "business-card-maker": "business-card-maker",

  "baby-shower-invitations": "baby-shower-invitations",
  "baby-shower-invitation": "baby-shower-invitations",
  invitation: "invitation-maker",
  "invitation-maker": "invitation-maker",

  poster: "poster-maker",
  "poster-maker": "poster-maker",

  tattoo: "tattoo-generator",
  "tattoo-generator": "tattoo-generator"
};

export function isAlbumCoverAnimateMenuResult(params: {
  workbenchSourceUseCase?: string;
  jobSourceUseCase?: string;
}): boolean {
  const normalize = (sourceUseCase?: string) => {
    const normalized = sourceUseCase?.trim().toLowerCase();
    if (!normalized) return DEFAULT_APP_TOOL_SLUG;
    return SOURCE_USE_CASE_APP_TOOL_SLUG_MAP[normalized] ?? normalized;
  };
  return normalize(params.workbenchSourceUseCase) === "ai-album-cover-generator"
    && normalize(params.jobSourceUseCase) === "ai-album-cover-generator";
}
