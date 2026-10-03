export type GeneratorUseCaseContext = {
  sourceUseCase: string;
  publicPath: string;
  brandHomePath: string;
  analyticsWorkflow: string;
  outputType: "product_ad" | "flyer" | "poster" | "movie_poster" | "brochure" | "infographic" | "comic" | "anime_art" | "playlist_cover" | "baby_shower_invitation" | "vision_board" | "menu" | "certificate" | "image_text_edit" | "generic_visual" | "video";
};

const DEFAULT_GENERATOR_CONTEXT: GeneratorUseCaseContext = {
  sourceUseCase: "ai-product-ad-image-generator",
  publicPath: "/ai-product-ad-image-generator",
  brandHomePath: "/home",
  analyticsWorkflow: "ai_product_ad_image_generator",
  outputType: "product_ad"
};

const GENERATOR_CONTEXTS: Record<string, GeneratorUseCaseContext> = {
  general: {
    sourceUseCase: "general", publicPath: "/", brandHomePath: "/home",
    analyticsWorkflow: "general_agent", outputType: "generic_visual"
  },
  "ai-image-maker": {
    sourceUseCase: "ai-image-maker",
    publicPath: "/ai-image-maker",
    brandHomePath: "/home",
    analyticsWorkflow: "ai_image_maker",
    outputType: "generic_visual"
  },
  "ai-image-text-editor": {
    sourceUseCase: "ai-image-text-editor",
    publicPath: "/ai-image-text-editor",
    brandHomePath: "/home",
    analyticsWorkflow: "ai_image_text_editor",
    outputType: "image_text_edit"
  },
  "ai-video-generator": {
    sourceUseCase: "ai-video-generator",
    publicPath: "/ai-video-generator",
    brandHomePath: "/home",
    analyticsWorkflow: "ai_video_generator",
    outputType: "video"
  },
  "ai-image-to-video": {
    sourceUseCase: "ai-image-to-video",
    publicPath: "/ai-image-to-video",
    brandHomePath: "/home",
    analyticsWorkflow: "ai_image_to_video",
    outputType: "video"
  },
  "ai-animation-generator": {
    sourceUseCase: "ai-animation-generator",
    publicPath: "/ai-animation-generator",
    brandHomePath: "/home",
    analyticsWorkflow: "ai_animation_generator",
    outputType: "video"
  },
  "hotel-lobby-ai": {
    sourceUseCase: "hotel-lobby-ai", publicPath: "/hotel-lobby-ai", brandHomePath: "/home",
    analyticsWorkflow: "hotel_lobby_ai", outputType: "video"
  },
  "promo-video-maker": {
    sourceUseCase: "promo-video-maker",
    publicPath: "/promo-video",
    brandHomePath: "/home",
    analyticsWorkflow: "promo_video_maker",
    outputType: "video"
  },
  "promo-video": {
    sourceUseCase: "promo-video-maker",
    publicPath: "/promo-video",
    brandHomePath: "/home",
    analyticsWorkflow: "promo_video_maker",
    outputType: "video"
  },
  "promotional-video-maker": {
    sourceUseCase: "promo-video-maker",
    publicPath: "/promo-video",
    brandHomePath: "/home",
    analyticsWorkflow: "promo_video_maker",
    outputType: "video"
  },
  "spotify-canvas-generator": {
    sourceUseCase: "spotify-canvas-generator",
    publicPath: "/spotify-canvas-generator",
    brandHomePath: "/home",
    analyticsWorkflow: "spotify_canvas_generator",
    outputType: "video"
  },
  "spotify-canvas": {
    sourceUseCase: "spotify-canvas-generator",
    publicPath: "/spotify-canvas-generator",
    brandHomePath: "/home",
    analyticsWorkflow: "spotify_canvas_generator",
    outputType: "video"
  },
  "spotify-canvas-video": {
    sourceUseCase: "spotify-canvas-generator",
    publicPath: "/spotify-canvas-generator",
    brandHomePath: "/home",
    analyticsWorkflow: "spotify_canvas_generator",
    outputType: "video"
  },
  "tattoo-generator": {
    sourceUseCase: "tattoo-generator",
    publicPath: "/tattoo-generator",
    brandHomePath: "/home",
    analyticsWorkflow: "tattoo_generator",
    outputType: "generic_visual"
  },
  "room-design": {
    sourceUseCase: "room-design",
    publicPath: "/ai-room-design",
    brandHomePath: "/home",
    analyticsWorkflow: "room_design",
    outputType: "generic_visual"
  },
  "ai-room-design": {
    sourceUseCase: "room-design",
    publicPath: "/ai-room-design",
    brandHomePath: "/home",
    analyticsWorkflow: "room_design",
    outputType: "generic_visual"
  },
  "ai-interior-design": {
    sourceUseCase: "room-design",
    publicPath: "/ai-interior-design",
    brandHomePath: "/home",
    analyticsWorkflow: "ai_interior_design",
    outputType: "generic_visual"
  },
  "ai-logo-generator": {
    sourceUseCase: "ai-logo-generator",
    publicPath: "/ai-logo-generator",
    brandHomePath: "/home",
    analyticsWorkflow: "ai_logo_generator",
    outputType: "generic_visual"
  },
  "ai-album-cover": {
    sourceUseCase: "ai-album-cover",
    publicPath: "/ai-album-cover-generator",
    brandHomePath: "/home",
    analyticsWorkflow: "ai_album_cover_generator",
    outputType: "generic_visual"
  },
  "ai-album-cover-generator": {
    sourceUseCase: "ai-album-cover",
    publicPath: "/ai-album-cover-generator",
    brandHomePath: "/home",
    analyticsWorkflow: "ai_album_cover_generator",
    outputType: "generic_visual"
  },
  "ai-book-cover": {
    sourceUseCase: "ai-book-cover",
    publicPath: "/ai-book-cover-generator",
    brandHomePath: "/home",
    analyticsWorkflow: "ai_book_cover_generator",
    outputType: "generic_visual"
  },
  "ai-book-cover-generator": {
    sourceUseCase: "ai-book-cover",
    publicPath: "/ai-book-cover-generator",
    brandHomePath: "/home",
    analyticsWorkflow: "ai_book_cover_generator",
    outputType: "generic_visual"
  },
  "ai-personal-image-generator": {
    sourceUseCase: "ai-personal-image-generator",
    publicPath: "/ai-personal-image-generator",
    brandHomePath: "/home",
    analyticsWorkflow: "ai_personal_image_generator",
    outputType: "generic_visual"
  },
  "ai-clothes-changer": {
    sourceUseCase: "ai-clothes-changer",
    publicPath: "/ai-clothes-changer",
    brandHomePath: "/home",
    analyticsWorkflow: "ai_clothes_changer",
    outputType: "generic_visual"
  },
  "ai-sticker-generator": {
    sourceUseCase: "ai-sticker-generator",
    publicPath: "/ai-sticker-generator",
    brandHomePath: "/home",
    analyticsWorkflow: "ai_sticker_generator",
    outputType: "generic_visual"
  },
  "ai-wallpaper-generator": {
    sourceUseCase: "ai-wallpaper-generator",
    publicPath: "/ai-wallpaper-generator",
    brandHomePath: "/home",
    analyticsWorkflow: "ai_wallpaper_generator",
    outputType: "generic_visual"
  },
  "background-remover": {
    sourceUseCase: "background-remover",
    publicPath: "/background-remover",
    brandHomePath: "/home",
    analyticsWorkflow: "background_remover",
    outputType: "generic_visual"
  },
  "ai-product-ad-image-generator": DEFAULT_GENERATOR_CONTEXT,
  "ai-flyer-generator": {
    sourceUseCase: "ai-flyer-generator",
    publicPath: "/ai-flyer-generator",
    brandHomePath: "/home",
    analyticsWorkflow: "ai_flyer_generator",
    outputType: "flyer"
  },
  "ai-brochure-generator": {
    sourceUseCase: "ai-brochure-generator",
    publicPath: "/ai-brochure-generator",
    brandHomePath: "/home",
    analyticsWorkflow: "ai_brochure_generator",
    outputType: "brochure"
  },
  "ai-infographic-generator": {
    sourceUseCase: "ai-infographic-generator",
    publicPath: "/ai-infographic-generator",
    brandHomePath: "/home",
    analyticsWorkflow: "ai_infographic_generator",
    outputType: "infographic"
  },
  "ai-comic-generator": {
    sourceUseCase: "ai-comic-generator",
    publicPath: "/ai-comic-generator",
    brandHomePath: "/home",
    analyticsWorkflow: "ai_comic_generator",
    outputType: "comic"
  },
  "playlist-cover-maker": { sourceUseCase: "playlist-cover-maker", publicPath: "/playlist-cover-maker", brandHomePath: "/home", analyticsWorkflow: "playlist_cover_maker", outputType: "playlist_cover" },
  "vision-board-maker": { sourceUseCase: "vision-board-maker", publicPath: "/vision-board-maker", brandHomePath: "/home", analyticsWorkflow: "vision_board_maker", outputType: "vision_board" },
  "ai-anime-generator": {
    sourceUseCase: "ai-anime-generator",
    publicPath: "/ai-anime-generator",
    brandHomePath: "/home",
    analyticsWorkflow: "ai_anime_generator",
    outputType: "anime_art"
  },
  "ai-menu-generator": {
    sourceUseCase: "ai-menu-generator",
    publicPath: "/ai-menu-generator",
    brandHomePath: "/home",
    analyticsWorkflow: "ai_menu_generator",
    outputType: "menu"
  },
  "ai-certificate-generator": {
    sourceUseCase: "ai-certificate-generator",
    publicPath: "/ai-certificate-generator",
    brandHomePath: "/home",
    analyticsWorkflow: "ai_certificate_generator",
    outputType: "certificate"
  },
  "poster-maker": {
    sourceUseCase: "poster-maker",
    publicPath: "/poster-maker",
    brandHomePath: "/home",
    analyticsWorkflow: "poster_maker",
    outputType: "poster"
  },
  "business-card-maker": {
    sourceUseCase: "business-card-maker",
    publicPath: "/business-card-maker",
    brandHomePath: "/home",
    analyticsWorkflow: "business_card_maker",
    outputType: "generic_visual"
  },
  "baby-shower-invitations": { sourceUseCase: "baby-shower-invitations", publicPath: "/baby-shower-invitations", brandHomePath: "/home", analyticsWorkflow: "baby_shower_invitations", outputType: "baby_shower_invitation" },
  "invitation-maker": {
    sourceUseCase: "invitation-maker",
    publicPath: "/invitation-maker",
    brandHomePath: "/home",
    analyticsWorkflow: "invitation_maker",
    outputType: "generic_visual"
  }
};

export function resolveGeneratorUseCaseContext(source?: string | null): GeneratorUseCaseContext {
  const normalized = source?.trim();
  if (!normalized) return DEFAULT_GENERATOR_CONTEXT;
  return GENERATOR_CONTEXTS[normalized] ?? DEFAULT_GENERATOR_CONTEXT;
}

export const ALBUM_COVER_REFERENCE_ONLY_PROMPT =
  "Use the uploaded reference images to create an album cover.";

export function buildReferenceOnlyClarification(responseLanguage?: string | null): string {
  return responseLanguage?.trim().toLowerCase().startsWith("zh")
    ? "你希望我基于这张参考图创建或修改什么？"
    : "What would you like me to create or change using the reference image?";
}

export function allowsTextlessWorkbenchSubmission(source?: string | null): boolean {
  const outputType = resolveGeneratorUseCaseContext(source).outputType;
  return outputType !== "video" && outputType !== "image_text_edit";
}

export function hasRequiredWorkbenchSubmissionText(params: {
  sourceUseCase?: string | null;
  content?: string | null;
}): boolean {
  return allowsTextlessWorkbenchSubmission(params.sourceUseCase)
    || Boolean(params.content?.trim());
}

export function resolveGeneratorUseCaseContextFromPath(path?: string | null): GeneratorUseCaseContext | null {
  const normalized = path?.trim();
  if (!normalized) return null;

  let pathname = normalized;
  let source: string | null = null;

  try {
    const url = new URL(normalized, "https://vismuse.com");
    pathname = url.pathname;
    source = url.searchParams.get("source");
  } catch {
    const [pathPart = "", queryPart = ""] = normalized.split("?");
    pathname = pathPart || "/";
    source = new URLSearchParams(queryPart).get("source");
  }

  if (source?.trim()) {
    return resolveGeneratorUseCaseContext(source);
  }

  const matchedContext = Object.values(GENERATOR_CONTEXTS).find((context) => (
    pathname === context.publicPath || pathname.startsWith(`${context.publicPath}/`)
  ));

  return matchedContext ?? null;
}

export function resolveLibrarySourceForCategory(category?: string | null): string {
  if (category === "Album Covers") return "ai-album-cover";
  if (category === "Book Covers") return "ai-book-cover";
  if (category === "Personal Image") return "ai-personal-image-generator";
  if (category === "Clothes Changer") return "ai-clothes-changer";
  if (category === "Tattoos") return "tattoo-generator";
  if (category === "Interior Design") return "room-design";
  if (category === "Logos") return "ai-logo-generator";
  if (category === "Business Cards") return "business-card-maker";
  if (category === "Stickers") return "ai-sticker-generator";
  if (category === "Product Ads") return "ai-product-ad-image-generator";
  if (category === "Posters") return "poster-maker";
  if (category === "Flyers") return "ai-flyer-generator";
  if (category === "Brochures") return "ai-brochure-generator";
  if (category === "Infographics") return "ai-infographic-generator";
  if (category === "Comics") return "ai-comic-generator";
  if (category === "Baby Shower Invitations") return "baby-shower-invitations";
  if (category === "Playlist Covers") return "playlist-cover-maker";
  if (category === "Vision Boards") return "vision-board-maker";
  if (category === "Anime") return "ai-anime-generator";
  if (category === "Menus") return "ai-menu-generator";
  if (category === "Certificates") return "ai-certificate-generator";
  if (category === "Image Text Editing") return "ai-image-text-editor";
  return "ai-image-maker";
}
