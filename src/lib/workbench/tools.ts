import { resolveGeneratorUseCaseContext } from "@/lib/use-cases/generator-context";

export type WorkbenchToolSlug =
  | "ai-image-maker"
  | "ai-image-text-editor"
  | "ai-video-generator"
  | "ai-animation-generator"
  | "ai-flyer-generator"
  | "ai-brochure-generator"
  | "ai-infographic-generator"
  | "ai-comic-generator"
  | "ai-anime-generator"
  | "baby-shower-invitations"
  | "playlist-cover-maker"
  | "vision-board-maker"
  | "ai-menu-generator"
  | "ai-certificate-generator"
  | "ai-album-cover-generator"
  | "ai-product-ad-image-generator"
  | "poster-maker"
  | "business-card-maker"
  | "ai-logo-generator"
  | "ai-personal-image-generator"
  | "ai-sticker-generator"
  | "ai-wallpaper-generator"
  | "ai-book-cover-generator"
  | "invitation-maker"
  | "background-remover"
  | "ai-clothes-changer"
  | "ai-room-design"
  | "ai-interior-design"
  | "tattoo-generator";

export type PublicWorkbenchToolSlug = Exclude<
  WorkbenchToolSlug,
  "ai-video-generator" | "ai-animation-generator" | "ai-personal-image-generator" | "ai-certificate-generator"
>;

export type WorkbenchComposerMode = "image" | "flyer" | "social";

export type WorkbenchToolConfig = {
  slug: WorkbenchToolSlug;
  sourceUseCase: string;
  publicPath: string;
  brandHomePath: string;
  analyticsWorkflow: string;
  composerMode: WorkbenchComposerMode;
  heroTitle: string;
  heroAccentWord: string;
  heroInputPlaceholder: string;
  promptInspirationsTitle?: string;
  defaultAspectRatio?: "auto" | "1:1" | "3:2" | "2:3" | "4:3" | "4:5" | "9:16" | "16:9";
  routes: {
    homePath: string;
    sessionPathPrefix: string;
    boardsPath: string;
    assetsPath: string;
    libraryPath: string;
    feedbackPath: string;
  };
};

export const defaultWorkbenchToolSlug: WorkbenchToolSlug = "ai-image-maker";

export const workbenchToolSlugs: WorkbenchToolSlug[] = [
  "ai-image-maker",
  "ai-image-text-editor",
  "ai-video-generator",
  "ai-animation-generator",
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
  "ai-album-cover-generator",
  "ai-product-ad-image-generator",
  "poster-maker",
  "business-card-maker",
  "ai-logo-generator",
  "ai-personal-image-generator",
  "ai-sticker-generator",
  "ai-wallpaper-generator",
  "ai-book-cover-generator",
  "invitation-maker",
  "background-remover",
  "ai-clothes-changer",
  "ai-room-design",
  "ai-interior-design",
  "tattoo-generator"
];

export const publicWorkbenchToolSlugs: PublicWorkbenchToolSlug[] = workbenchToolSlugs
  .filter(
    (slug): slug is PublicWorkbenchToolSlug =>
      slug !== "ai-video-generator"
      && slug !== "ai-animation-generator"
      && slug !== "ai-personal-image-generator"
      && slug !== "ai-certificate-generator"
  );

function toolRoutes(slug: WorkbenchToolSlug) {
  return {
    homePath: `/${slug}`,
    sessionPathPrefix: `/${slug}`,
    boardsPath: "/boards",
    assetsPath: "/assets",
    libraryPath: "/library",
    feedbackPath: `/${slug}/feedback`
  };
}

function resolveWorkbenchComposerMode(slug: WorkbenchToolSlug): WorkbenchComposerMode {
  const outputType = resolveGeneratorUseCaseContext(slug).outputType;
  if (outputType === "flyer" || outputType === "poster" || outputType === "movie_poster" || outputType === "brochure" || outputType === "infographic" || outputType === "comic" || outputType === "anime_art" || outputType === "baby_shower_invitation" || outputType === "playlist_cover" || outputType === "vision_board" || outputType === "menu" || outputType === "certificate") return "flyer";
  if (outputType === "product_ad") return "social";
  return "image";
}

function toolBase(slug: WorkbenchToolSlug) {
  const context = resolveGeneratorUseCaseContext(slug);

  return {
    slug,
    sourceUseCase: context.sourceUseCase,
    publicPath: context.publicPath,
    brandHomePath: context.brandHomePath,
    analyticsWorkflow: context.analyticsWorkflow,
    composerMode: resolveWorkbenchComposerMode(slug),
    routes: toolRoutes(slug)
  };
}

export const workbenchTools: Record<WorkbenchToolSlug, WorkbenchToolConfig> = {
  "ai-image-maker": {
    ...toolBase("ai-image-maker"),
    heroTitle: "AI Image",
    heroAccentWord: "Maker",
    promptInspirationsTitle: "PFP, Banner, and Image Ideas",
    heroInputPlaceholder: "Describe what you want to create, or add a reference."
  },
  "ai-image-text-editor": {
    ...toolBase("ai-image-text-editor"),
    heroTitle: "AI Image Text",
    heroAccentWord: "Editor",
    promptInspirationsTitle: "Ideas for Changing and Adding Text in Images",
    heroInputPlaceholder: "Upload an image, then describe the text you want to change or add.",
    defaultAspectRatio: "auto"
  },
  "ai-video-generator": {
    ...toolBase("ai-video-generator"),
    heroTitle: "AI Video",
    heroAccentWord: "Generator",
    heroInputPlaceholder: "Describe the video you want to create, or upload images for motion."
  },
  "ai-animation-generator": {
    ...toolBase("ai-animation-generator"),
    heroTitle: "AI Animation",
    heroAccentWord: "Generator",
    promptInspirationsTitle: "Animation Ideas for Characters, Anime, Art, and Stories",
    heroInputPlaceholder: "Describe an animated scene, or upload an image and explain how it should move."
  },
  "ai-flyer-generator": {
    ...toolBase("ai-flyer-generator"),
    heroTitle: "AI Flyer",
    heroAccentWord: "Generator",
    heroInputPlaceholder: "Describe the flyer goal, audience, event details, offer, and visual style."
  },
  "ai-brochure-generator": {
    ...toolBase("ai-brochure-generator"),
    heroTitle: "AI Brochure",
    heroAccentWord: "Generator",
    heroInputPlaceholder: "Describe the brochure you need—its audience, format, sections, text, brand details, and visual style.",
    defaultAspectRatio: "4:3"
  },
  "ai-infographic-generator": {
    ...toolBase("ai-infographic-generator"),
    heroTitle: "AI Infographic",
    heroAccentWord: "Generator",
    promptInspirationsTitle: "Infographic Ideas for Data, Processes, and Timelines",
    heroInputPlaceholder: "Describe the topic, audience, key facts or data, and visual story you want to explain.",
    defaultAspectRatio: "2:3"
  },
  "ai-comic-generator": {
    ...toolBase("ai-comic-generator"),
    heroTitle: "AI Comic",
    heroAccentWord: "Generator",
    promptInspirationsTitle: "Comic Ideas for Strips, Pages, Manga, and Webtoons",
    heroInputPlaceholder: "Describe the story, characters, panel beats, dialogue, and comic style—or add character references.",
    defaultAspectRatio: "2:3"
  },
  "baby-shower-invitations": {
    ...toolBase("baby-shower-invitations"),
    heroTitle: "Baby Shower", heroAccentWord: "Invitations",
    heroInputPlaceholder: "Describe your baby shower theme and add any exact name, date, venue, and RSVP wording you want shown.",
    promptInspirationsTitle: "Baby Shower Invitation Ideas", defaultAspectRatio: "4:5"
  },
  "playlist-cover-maker": {
    ...toolBase("playlist-cover-maker"),
    heroTitle: "AI Playlist Cover", heroAccentWord: "Maker",
    heroInputPlaceholder: "Describe the mood, genre, or activity. Add an optional title or reference photo.",
    promptInspirationsTitle: "Playlist Cover Ideas for Every Mood", defaultAspectRatio: "1:1"
  },
  "vision-board-maker": {
    ...toolBase("vision-board-maker"),
    heroTitle: "AI Vision Board", heroAccentWord: "Maker",
    heroInputPlaceholder: "Describe your goals, dreams, favorite colors, and collage style—or upload personal photos.",
    promptInspirationsTitle: "Vision Board Ideas for Your Next Chapter", defaultAspectRatio: "1:1"
  },
  "ai-anime-generator": {
    ...toolBase("ai-anime-generator"),
    heroTitle: "AI Anime",
    heroAccentWord: "Generator",
    promptInspirationsTitle: "Anime Ideas for Characters, Portraits, Scenes, and Original Art",
    heroInputPlaceholder: "Describe an original anime character, portrait, scene, mood, and style—or add a character reference.",
    defaultAspectRatio: "1:1"
  },
  "ai-menu-generator": {
    ...toolBase("ai-menu-generator"),
    heroTitle: "AI Menu",
    heroAccentWord: "Generator",
    promptInspirationsTitle: "Menu Ideas for Restaurants, Cafes, Drinks, and Wine",
    heroInputPlaceholder: "Add your restaurant name, menu sections, items, prices, and preferred style.",
    defaultAspectRatio: "2:3"
  },
  "ai-certificate-generator": {
    ...toolBase("ai-certificate-generator"),
    heroTitle: "AI Certificate",
    heroAccentWord: "Generator",
    promptInspirationsTitle: "Certificate Ideas for Achievement, Appreciation, Completion, Participation, and Awards",
    heroInputPlaceholder: "Add the recipient, achievement, issuer, date, certificate type, and preferred style.",
    defaultAspectRatio: "4:3"
  },
  "ai-album-cover-generator": {
    ...toolBase("ai-album-cover-generator"),
    heroTitle: "AI Album Cover",
    heroAccentWord: "Maker",
    promptInspirationsTitle: "Album Cover Ideas from Photos, Titles, and Genres",
    heroInputPlaceholder: "Upload a photo or describe the title, genre, mood, and cover style.",
    defaultAspectRatio: "auto"
  },
  "ai-product-ad-image-generator": {
    ...toolBase("ai-product-ad-image-generator"),
    heroTitle: "AI Product Ad Image",
    heroAccentWord: "Generator",
    heroInputPlaceholder: "Paste a product, website, brand, or idea...",
    routes: {
      ...toolRoutes("ai-product-ad-image-generator"),
      boardsPath: "/ai-product-ad-image-generator/boards",
      libraryPath: "/ai-product-ad-image-generator/library"
    }
  },
  "poster-maker": {
    ...toolBase("poster-maker"),
    heroTitle: "Poster",
    heroAccentWord: "Maker",
    promptInspirationsTitle: "Poster Ideas for Events, Product Promotions, Movies, and Lost-and-Found Notices",
    heroInputPlaceholder: "Describe your poster: event promotion, product offer, movie, lost-and-found notice, or another purpose. Add your text and style.",
    defaultAspectRatio: "2:3"
  },
  "business-card-maker": {
    ...toolBase("business-card-maker"),
    heroTitle: "Business Card",
    heroAccentWord: "Maker",
    heroInputPlaceholder: "Describe the brand, name, role, contact details, and business card style."
  },
  "ai-logo-generator": {
    ...toolBase("ai-logo-generator"),
    heroTitle: "AI Logo",
    heroAccentWord: "Maker",
    heroInputPlaceholder: "Describe the brand name, industry, symbol, palette, and logo style."
  },
  "ai-personal-image-generator": {
    ...toolBase("ai-personal-image-generator"),
    heroTitle: "Personal Image",
    heroAccentWord: "Maker",
    heroInputPlaceholder: "Upload a selfie or describe the portrait, profile image, or style you want."
  },
  "ai-sticker-generator": {
    ...toolBase("ai-sticker-generator"),
    heroTitle: "AI Sticker",
    heroAccentWord: "Maker",
    heroInputPlaceholder: "Describe the sticker subject, expression, outline, color, and style."
  },
  "ai-wallpaper-generator": {
    ...toolBase("ai-wallpaper-generator"),
    heroTitle: "AI Wallpaper",
    heroAccentWord: "Maker",
    heroInputPlaceholder: "Describe the wallpaper mood, subject, colors, device, and style.",
    defaultAspectRatio: "9:16"
  },
  "ai-book-cover-generator": {
    ...toolBase("ai-book-cover-generator"),
    heroTitle: "AI Book Cover",
    heroAccentWord: "Maker",
    heroInputPlaceholder: "Describe the book title, genre, audience, mood, and cover style."
  },
  "invitation-maker": {
    ...toolBase("invitation-maker"),
    heroTitle: "Invitation",
    heroAccentWord: "Maker",
    heroInputPlaceholder: "Describe the event, date, names, venue, tone, and invitation style."
  },
  "background-remover": {
    ...toolBase("background-remover"),
    heroTitle: "Background",
    heroAccentWord: "Remover",
    heroInputPlaceholder: "Upload an image, then describe any background cleanup or replacement.",
    promptInspirationsTitle: "Background Removal Ideas for Products, People, Pets, Cars, and Graphics"
  },
  "ai-clothes-changer": {
    ...toolBase("ai-clothes-changer"),
    heroTitle: "AI Clothes",
    heroAccentWord: "Changer",
    heroInputPlaceholder: "Upload a person and clothing reference, then describe the outfit change."
  },
  "ai-room-design": {
    ...toolBase("ai-room-design"),
    heroTitle: "AI Room",
    heroAccentWord: "Design",
    heroInputPlaceholder: "Upload a room photo and describe the redesign style, furniture, and mood.",
    defaultAspectRatio: "16:9"
  },
  "ai-interior-design": {
    ...toolBase("ai-interior-design"),
    heroTitle: "AI Interior",
    heroAccentWord: "Design",
    heroInputPlaceholder: "Upload a room photo and describe the interior style, palette, and decor.",
    defaultAspectRatio: "16:9"
  },
  "tattoo-generator": {
    ...toolBase("tattoo-generator"),
    heroTitle: "Tattoo",
    heroAccentWord: "Maker",
    heroInputPlaceholder: "Describe the tattoo subject, placement, linework, symbolism, and style."
  }
};

export function isWorkbenchToolSlug(slug: string): slug is WorkbenchToolSlug {
  return workbenchToolSlugs.includes(slug as WorkbenchToolSlug);
}

export function isPublicWorkbenchToolSlug(slug: string): slug is PublicWorkbenchToolSlug {
  return publicWorkbenchToolSlugs.includes(slug as PublicWorkbenchToolSlug);
}

export function getWorkbenchTool(slug: WorkbenchToolSlug): WorkbenchToolConfig {
  return workbenchTools[slug];
}
