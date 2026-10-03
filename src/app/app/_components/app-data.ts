import {
  AudioLines,
  Clapperboard,
  Compass,
  Folder,
  ImageIcon,
  LayoutGrid,
  MailOpen,
  PanelsTopLeft,
  Sparkles,
  Type,
  Utensils,
  WandSparkles
} from "lucide-react";
import type { ComponentType } from "react";

export type AppNavId = "agent" | "create" | "recents" | "assets" | "explore";

export type AppNavItem = {
  id: AppNavId;
  label: string;
  href: string;
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
};

export const appNavItems: AppNavItem[] = [
  { id: "agent", label: "Agent", href: "/app", icon: Sparkles },
  { id: "create", label: "Create", href: "/app/create", icon: WandSparkles },
  { id: "recents", label: "Recents", href: "/app/recents", icon: PanelsTopLeft },
  { id: "assets", label: "Assets", href: "/app/assets", icon: Folder },
  { id: "explore", label: "Explore", href: "/app/explore", icon: LayoutGrid }
];

export type AppAnnouncementConfig = {
  enabled: boolean;
  lead: string;
  message: string;
  timer?: string;
  cta: string;
};

export const appAnnouncement: AppAnnouncementConfig = {
  enabled: true,
  lead: "Save 50%",
  message: "with yearly billing",
  cta: "Claim offer"
};

export type AppAccountPlan = "free" | "basic" | "pro" | "max";

export type AppAccountSummary = {
  id: string;
  isLoggedIn: boolean;
  plan: AppAccountPlan;
  credits: number;
  creditBreakdownAvailable?: boolean;
  paidCredits?: number;
  freeCredits?: number;
  paidCreditTotal?: number;
  freeCreditTotal?: number;
  paidExpiringCredits?: number;
  freeExpiringCredits?: number;
  paidExpiringCreditTotal?: number;
  freeExpiringCreditTotal?: number;
  paidPackExpiringCredits?: number;
  paidPackExpiringCreditTotal?: number;
  paidPermanentCredits?: number;
  freePermanentCredits?: number;
  paidCreditExpiresAt?: string;
  paidPackCreditExpiresAt?: string;
  freeCreditExpiresAt?: string;
  starterAccess?: boolean;
  pricingVariant?: string;
  billingMarket?: "default" | "gb" | "ca";
  billingCurrency?: "USD" | "GBP" | "CAD";
  billingProvider?: "creem" | "stripe" | "waffo";
  subscriptionPackageId?: string;
  subscriptionStatus?: string;
  subscriptionStartedAt?: string;
  currentPeriodStartAt?: string;
  currentPeriodEndAt?: string;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string;
  initial: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  authMode?: "supabase" | "guest" | "guest_claimed";
  claimedEmail?: string;
  claimedProviders?: string[];
};

export const appAccountSummary: AppAccountSummary = {
  id: "",
  isLoggedIn: false,
  plan: "free",
  credits: 0,
  creditBreakdownAvailable: true,
  paidCredits: 0,
  freeCredits: 0,
  paidCreditTotal: 0,
  freeCreditTotal: 0,
  paidExpiringCredits: 0,
  freeExpiringCredits: 0,
  paidExpiringCreditTotal: 0,
  freeExpiringCreditTotal: 0,
  paidPackExpiringCredits: 0,
  paidPackExpiringCreditTotal: 0,
  paidPermanentCredits: 0,
  freePermanentCredits: 0,
  paidCreditExpiresAt: undefined,
  paidPackCreditExpiresAt: undefined,
  freeCreditExpiresAt: undefined,
  starterAccess: false,
  pricingVariant: undefined,
  billingMarket: "default",
  billingCurrency: "USD",
  billingProvider: undefined,
  subscriptionPackageId: undefined,
  subscriptionStatus: "none",
  subscriptionStartedAt: undefined,
  currentPeriodStartAt: undefined,
  currentPeriodEndAt: undefined,
  cancelAtPeriodEnd: false,
  canceledAt: undefined,
  initial: "G",
  displayName: "Guest",
  email: "",
  avatarUrl: "",
  authMode: "guest"
};

export type AppToolCard = {
  slug: string;
  title: string;
  workbenchTitle: string;
  eyebrow: string;
  description: string;
  href: string;
  accent: "lime" | "blue" | "pink" | "violet";
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  imageSrc: string;
  heroImages: string[];
};

export const appTools: AppToolCard[] = [
  {
    slug: "ai-image-maker",
    title: "Image",
    workbenchTitle: "AI Image Generator",
    eyebrow: "Text to image",
    description: "Create product visuals, portraits, covers, posters, and social graphics from one prompt.",
    href: "/app/ai-image-maker",
    accent: "lime",
    icon: ImageIcon,
    imageSrc: "/assets/socialmedia/reference-wide.png",
    heroImages: [
      "/assets/visual-templates/ai-image-maker/ai-portrait.png",
      "/assets/visual-templates/ai-image-maker/product-ad.png",
      "/assets/visual-templates/ai-image-maker/fantasy-scene.png",
      "/assets/visual-templates/ai-image-maker/luxury-interior.png",
      "/assets/visual-templates/ai-image-maker/party-flyer.png",
      "/assets/visual-templates/ai-image-maker/birthday-poster.png"
    ]
  },
  {
    slug: "ai-image-text-editor",
    title: "Image Text Editor",
    workbenchTitle: "AI Image Text Editor",
    eyebrow: "Change or add image text",
    description: "Upload an image and describe the exact text to change, replace, or add while preserving its design.",
    href: "/app/ai-image-text-editor",
    accent: "violet",
    icon: Type,
    imageSrc: "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-image-text-editor/launch-20260821-before-after/ai-image-text-editor-poster-date-change_thumb.webp",
    heroImages: [
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-image-text-editor/launch-20260821-before-after/ai-image-text-editor-poster-date-change_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-image-text-editor/launch-20260821-before-after/ai-image-text-editor-sale-discount-replace_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-image-text-editor/launch-20260821-before-after/ai-image-text-editor-menu-price-update_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-image-text-editor/launch-20260821-before-after/ai-image-text-editor-packaging-flavor-label_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-image-text-editor/launch-20260821-before-after/ai-image-text-editor-storefront-sign-change_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-image-text-editor/launch-20260821-before-after/ai-image-text-editor-app-localization_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-image-text-editor/launch-20260821-before-after/ai-image-text-editor-garbled-text-fix_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-image-text-editor/launch-20260821-before-after/ai-image-text-editor-thumbnail-headline_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-image-text-editor/launch-20260821-before-after/ai-image-text-editor-product-cta-add_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-image-text-editor/launch-20260821-before-after/ai-image-text-editor-travel-caption-add_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-image-text-editor/launch-20260821-before-after/ai-image-text-editor-social-quote-add_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-image-text-editor/launch-20260821-before-after/ai-image-text-editor-event-lower-third-add_thumb.webp"
    ]
  },
  {
    slug: "ai-video-generator",
    title: "Video",
    workbenchTitle: "AI Video Generator",
    eyebrow: "Text and image to video",
    description: "Create short AI videos from prompts, product photos, references, and visual ideas.",
    href: "/app/ai-video-generator",
    accent: "blue",
    icon: Clapperboard,
    imageSrc: "/assets/socialmedia/product-ad-og.png",
    heroImages: [
      "/assets/socialmedia/product-ad-og.png",
      "/assets/socialmedia/reference-wide.png",
      "/assets/socialmedia/reference-portrait.png",
      "/assets/visual-templates/ai-image-maker/fantasy-scene.png",
      "/assets/visual-templates/ai-image-maker/product-ad.png",
      "/assets/home/after.png"
    ]
  },
  {
    slug: "ai-animation-generator",
    title: "Animation",
    workbenchTitle: "AI Animation Generator",
    eyebrow: "Text and image to animation",
    description: "Create animated clips from prompts, illustrations, character art, sketches, and reference images.",
    href: "/app/ai-animation-generator",
    accent: "violet",
    icon: Clapperboard,
    imageSrc: "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/ai-animation-generator/demos/anime-skyway-sprint_thumb.webp",
    heroImages: [
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/ai-animation-generator/demos/anime-skyway-sprint_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/ai-animation-generator/demos/clay-garden-party_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/ai-animation-generator/demos/watercolor-fox-trail_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/ai-animation-generator/demos/paper-ocean-parade_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/ai-animation-generator/demos/tiny-robot-greenhouse_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/ai-animation-generator/demos/felt-frog-tea-time_thumb.webp"
    ]
  },
  {
    slug: "hotel-lobby-ai",
    title: "Hotel Lobby",
    workbenchTitle: "Hotel Lobby AI Video",
    eyebrow: "Your cast. One orange stage.",
    description: "Turn photos of friends, characters, or pets into an orange-studio performance video.",
    href: "/app/hotel-lobby-ai",
    accent: "pink",
    icon: AudioLines,
    imageSrc: "/assets/hotel-lobby-ai/pets_thumb.webp",
    heroImages: ["/assets/hotel-lobby-ai/pets_thumb.webp"]
  },
  {
    slug: "promo-video-maker",
    title: "Promo Video",
    workbenchTitle: "Promo Video Maker",
    eyebrow: "Product and brand promos",
    description: "Turn a product, offer, launch, or brand idea into a short social-ready promo video.",
    href: "/promo-video",
    accent: "pink",
    icon: Clapperboard,
    imageSrc: "/assets/socialmedia/product-ad-og.png",
    heroImages: [
      "/assets/socialmedia/product-ad-og.png",
      "/assets/visual-templates/ai-image-maker/product-ad.png",
      "/assets/socialmedia/reference-portrait.png",
      "/assets/socialmedia/reference-wide.png",
      "/assets/visual-templates/ai-image-maker/luxury-interior.png",
      "/assets/home/before.png"
    ]
  },
  {
    slug: "spotify-canvas-generator",
    title: "Spotify Canvas",
    workbenchTitle: "Spotify Canvas",
    eyebrow: "Album cover to video",
    description: "Turn album artwork into a subtle 5-second vertical Spotify Canvas video.",
    href: "/app/spotify-canvas-generator",
    accent: "violet",
    icon: AudioLines,
    imageSrc: "/assets/visual-templates/ai-album-cover/artist-portrait-cover.png",
    heroImages: [
      "/assets/visual-templates/ai-album-cover/artist-portrait-cover.png",
      "/assets/visual-templates/ai-album-cover/electronic-single-art.png",
      "/assets/visual-templates/ai-album-cover/indie-film-cover.png",
      "/assets/visual-templates/ai-album-cover/lofi-playlist-cover.png",
      "/assets/visual-templates/ai-album-cover/rap-mixtape-cover.png",
      "/assets/visual-templates/ai-album-cover/rnb-minimal-cover.png"
    ]
  },
  {
    slug: "ai-flyer-generator",
    title: "Flyer",
    workbenchTitle: "Flyer Generator",
    eyebrow: "Campaign maker",
    description: "Turn event, sale, service, or local business details into ready-to-edit flyer directions.",
    href: "/app/ai-flyer-generator",
    accent: "blue",
    icon: Clapperboard,
    imageSrc: "/assets/socialmedia/product-ad-og.png",
    heroImages: [
      "/assets/visual-templates/ai-flyer-generator/business-flyer.png",
      "/assets/visual-templates/ai-flyer-generator/sweet-16-invitation.png",
      "/assets/visual-templates/ai-flyer-generator/for-sale-flyer.png",
      "/assets/visual-templates/ai-flyer-generator/open-house-flyer.png",
      "/assets/visual-templates/ai-flyer-generator/real-estate-templates.png",
      "/assets/visual-templates/ai-image-maker/party-flyer.png"
    ]
  },
  {
    slug: "ai-brochure-generator",
    title: "Brochure",
    workbenchTitle: "Brochure Generator",
    eyebrow: "Marketing collateral",
    description: "Turn company, product, service, property, or travel details into structured brochure designs.",
    href: "/app/ai-brochure-generator",
    accent: "violet",
    icon: PanelsTopLeft,
    imageSrc: "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-brochure-generator/flat-graphics-20260729/ai-brochure-generator-swiss-consulting-trifold_thumb.webp",
    heroImages: [
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-brochure-generator/flat-graphics-20260729/ai-brochure-generator-swiss-consulting-trifold_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-brochure-generator/flat-graphics-20260729/ai-brochure-generator-cybersecurity-dark-trifold_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-brochure-generator/flat-graphics-20260729/ai-brochure-generator-japan-travel-zfold_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-brochure-generator/flat-graphics-20260729/ai-brochure-generator-restaurant-menu-trifold_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-brochure-generator/flat-graphics-20260729/ai-brochure-generator-fashion-lookbook-bifold_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-brochure-generator/flat-graphics-20260729/ai-brochure-generator-nonprofit-impact-onepage_thumb.webp"
    ]
  },
  {
    slug: "ai-infographic-generator",
    title: "Infographic",
    workbenchTitle: "Infographic Generator",
    eyebrow: "Visual storytelling",
    description: "Turn data, processes, comparisons, timelines, and key facts into clear visual stories.",
    href: "/app/ai-infographic-generator",
    accent: "lime",
    icon: LayoutGrid,
    imageSrc: "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-infographic-generator/launch-20260812/ai-infographic-generator-quarterly-marketing-statistics_thumb.webp",
    heroImages: [
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-infographic-generator/launch-20260812/ai-infographic-generator-quarterly-marketing-statistics_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-infographic-generator/launch-20260812/ai-infographic-generator-remote-vs-office-comparison_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-infographic-generator/launch-20260812/ai-infographic-generator-design-thinking-process_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-infographic-generator/launch-20260812/ai-infographic-generator-startup-journey-timeline_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-infographic-generator/launch-20260812/ai-infographic-generator-cybersecurity-checklist_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-infographic-generator/launch-20260812/ai-infographic-generator-water-cycle-education_thumb.webp"
    ]
  },
  {
    slug: "ai-comic-generator",
    title: "Comic",
    workbenchTitle: "AI Comic Generator",
    eyebrow: "Stories into panels",
    description: "Turn a story, script, dialogue, or character references into a coherent comic strip or page.",
    href: "/app/ai-comic-generator",
    accent: "pink",
    icon: PanelsTopLeft,
    imageSrc: "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-comic-generator/launch-20260831/ai-comic-generator-night-signal-four-panel_thumb.webp",
    heroImages: [
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-comic-generator/launch-20260831/ai-comic-generator-night-signal-four-panel_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-comic-generator/launch-20260831/ai-comic-generator-moon-train-manga_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-comic-generator/launch-20260831/ai-comic-generator-rainy-reunion-webtoon_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-comic-generator/launch-20260831/ai-comic-generator-neon-detective-noir_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-comic-generator/launch-20260831/ai-comic-generator-garden-robot-wordless_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-comic-generator/launch-20260831/ai-comic-generator-space-chef-webtoon_thumb.webp"
    ]
  },
  {
    "slug": "playlist-cover-maker",
    "title": "Playlist Cover",
    "workbenchTitle": "AI Playlist Cover Maker",
    "eyebrow": "Set the mood",
    "description": "Create playlist covers for your favorite moods, genres, and moments.",
    "href": "/app/playlist-cover-maker",
    "accent": "violet",
    "imageSrc": "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/playlist-cover-maker/launch-20260923/playlist-cover-maker-late-night-drive_thumb.webp",
    "heroImages": [
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/playlist-cover-maker/launch-20260923/playlist-cover-maker-late-night-drive_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/playlist-cover-maker/launch-20260923/playlist-cover-maker-lofi-study_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/playlist-cover-maker/launch-20260923/playlist-cover-maker-workout-energy_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/playlist-cover-maker/launch-20260923/playlist-cover-maker-summer-road-trip_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/playlist-cover-maker/launch-20260923/playlist-cover-maker-sad-hours_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/playlist-cover-maker/launch-20260923/playlist-cover-maker-morning-coffee_thumb.webp"
    ],
    icon: AudioLines
  },
  {
    slug: "vision-board-maker",
    title: "Vision Board",
    workbenchTitle: "AI Vision Board Maker",
    eyebrow: "Your next chapter",
    description: "Turn your dreams, goals, and photos into a personal vision board.",
    href: "/app/vision-board-maker",
    accent: "violet",
    icon: Sparkles,
    imageSrc: "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/vision-board-maker/launch-20260922/vision-board-maker-year-ahead_thumb.webp",
    heroImages: [
        "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/vision-board-maker/launch-20260922/vision-board-maker-year-ahead_thumb.webp",
        "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/vision-board-maker/launch-20260922/vision-board-maker-japan-dreams_thumb.webp",
        "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/vision-board-maker/launch-20260922/vision-board-maker-creative-career_thumb.webp",
        "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/vision-board-maker/launch-20260922/vision-board-maker-healthy-rhythm_thumb.webp",
        "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/vision-board-maker/launch-20260922/vision-board-maker-dream-home_thumb.webp",
        "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/vision-board-maker/launch-20260922/vision-board-maker-study-focus_thumb.webp"
    ]
  },
  {
    slug: "ai-anime-generator",
    title: "Anime",
    workbenchTitle: "AI Anime Generator",
    eyebrow: "Characters and anime art",
    description: "Create original anime characters, portraits, scenes, avatars, and polished artwork from prompts or references.",
    href: "/app/ai-anime-generator",
    accent: "violet",
    icon: Sparkles,
    imageSrc: "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-anime-generator/launch-20260904/ai-anime-generator-starlight-courier-portrait_thumb.webp",
    heroImages: [
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-anime-generator/launch-20260904/ai-anime-generator-starlight-courier-portrait_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-anime-generator/launch-20260904/ai-anime-generator-neon-courier-city_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-anime-generator/launch-20260904/ai-anime-generator-chibi-bakery-mascot_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-anime-generator/launch-20260904/ai-anime-generator-floating-valley-train_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-anime-generator/launch-20260904/ai-anime-generator-retro-night-cafe_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-anime-generator/launch-20260904/ai-anime-generator-fox-spirit-companion_thumb.webp"
    ]
  },
  {
    slug: "ai-menu-generator",
    title: "Menu",
    workbenchTitle: "AI Menu Generator",
    eyebrow: "Restaurant design",
    description: "Turn restaurant names, sections, dishes, drinks, descriptions, and prices into polished printable menus.",
    href: "/app/ai-menu-generator",
    accent: "pink",
    icon: Utensils,
    imageSrc: "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-menu-generator/launch-20260817/ai-menu-generator-breakfast-sunrise-bistro_thumb.webp",
    heroImages: [
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-menu-generator/launch-20260817/ai-menu-generator-breakfast-sunrise-bistro_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-menu-generator/launch-20260817/ai-menu-generator-breakfast-botanical-brunch_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-menu-generator/launch-20260817/ai-menu-generator-cafe-specialty-coffee_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-menu-generator/launch-20260817/ai-menu-generator-cafe-patisserie_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-menu-generator/launch-20260817/ai-menu-generator-diner-retro-classic_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-menu-generator/launch-20260817/ai-menu-generator-diner-modern-roadside_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-menu-generator/launch-20260817/ai-menu-generator-drink-tropical-mocktails_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-menu-generator/launch-20260817/ai-menu-generator-drink-evening-cocktails_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-menu-generator/launch-20260817/ai-menu-generator-wine-minimal-list_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-menu-generator/launch-20260817/ai-menu-generator-wine-vineyard-cellar_thumb.webp"
    ]
  },
  {
    slug: "ai-album-cover-generator",
    title: "Album Cover",
    workbenchTitle: "Album Cover Generator",
    eyebrow: "Music artwork",
    description: "Start from a photo, title, genre, mood, or release concept and shape square cover art.",
    href: "/app/ai-album-cover-generator",
    accent: "pink",
    icon: AudioLines,
    imageSrc: "/assets/home/after.png",
    heroImages: [
      "/assets/visual-templates/ai-album-cover/artist-portrait-cover.png",
      "/assets/visual-templates/ai-album-cover/electronic-single-art.png",
      "/assets/visual-templates/ai-album-cover/indie-film-cover.png",
      "/assets/visual-templates/ai-album-cover/lofi-playlist-cover.png",
      "/assets/visual-templates/ai-album-cover/parental-advisory-cover.png",
      "/assets/visual-templates/ai-album-cover/rap-mixtape-cover.png",
      "/assets/visual-templates/ai-album-cover/spotify-playlist-cover.png",
      "/assets/visual-templates/ai-album-cover/rock-vinyl-cover.png",
      "/assets/visual-templates/ai-album-cover/rnb-minimal-cover.png",
      "/assets/visual-templates/ai-album-cover/country-ep-cover.png",
      "/assets/visual-templates/ai-album-cover/metal-cover-art.png",
      "/assets/visual-templates/ai-album-cover/jazz-cover-design.png"
    ]
  },
  {
    slug: "ai-product-ad-image-generator",
    title: "Product Ad",
    workbenchTitle: "Product Ad Generator",
    eyebrow: "Commerce visuals",
    description: "Generate product scenes, ads, banners, and campaign concepts for social and stores.",
    href: "/app/ai-product-ad-image-generator",
    accent: "violet",
    icon: Compass,
    imageSrc: "/assets/home/before.png",
    heroImages: [
      "/assets/socialmedia/product-ad-og.png",
      "/assets/socialmedia/reference-wide.png",
      "/assets/socialmedia/reference-portrait.png",
      "/assets/visual-templates/ai-image-maker/product-ad.png",
      "/assets/visual-templates/ai-image-maker/luxury-interior.png",
      "/assets/home/before.png"
    ]
  },
  {
    slug: "poster-maker",
    title: "Poster",
    workbenchTitle: "Poster Maker",
    eyebrow: "Posters for every purpose",
    description: "Create posters for events, product promotions, movies, lost-and-found notices, and more.",
    href: "/app/poster-maker",
    accent: "blue",
    icon: PanelsTopLeft,
    imageSrc: "/assets/visual-templates/poster-maker/poster-maker-soundwave-concert_thumb.webp",
    heroImages: [
      "/assets/visual-templates/poster-maker/poster-maker-soundwave-concert_thumb.webp",
      "/assets/visual-templates/poster-maker/poster-maker-flash-sale-fashion_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/poster-maker/movie-poster-maker-20260820/poster-maker-movie-neon-frontier-ensemble_thumb.webp",
      "/assets/visual-templates/poster-maker/poster-maker-science-fair_thumb.webp"
    ]
  },
  {
    slug: "business-card-maker",
    title: "Business Card",
    workbenchTitle: "Business Card Generator",
    eyebrow: "Brand cards",
    description: "Generate business card concepts, identity cards, contact cards, and brand stationery directions.",
    href: "/app/business-card-maker",
    accent: "violet",
    icon: LayoutGrid,
    imageSrc: "/assets/home/after.png",
    heroImages: [
      "/assets/home/after.png",
      "/assets/socialmedia/reference-wide.png",
      "/assets/visual-templates/ai-image-maker/luxury-interior.png",
      "/assets/socialmedia/product-ad-og.png",
      "/assets/home/before.png",
      "/assets/visual-templates/ai-image-maker/product-ad.png"
    ]
  },
  {
    slug: "ai-logo-generator",
    title: "Logo",
    workbenchTitle: "Logo Generator",
    eyebrow: "Brand marks",
    description: "Create logo concepts, brand marks, monograms, badges, and visual identity directions.",
    href: "/app/ai-logo-generator",
    accent: "lime",
    icon: Sparkles,
    imageSrc: "/assets/visual-templates/ai-image-maker/product-ad.png",
    heroImages: [
      "/assets/visual-templates/ai-image-maker/product-ad.png",
      "/assets/socialmedia/reference-wide.png",
      "/assets/home/after.png",
      "/assets/visual-templates/ai-image-maker/fantasy-scene.png",
      "/assets/home/before.png",
      "/assets/socialmedia/product-ad-og.png"
    ]
  },
  {
    slug: "ai-sticker-generator",
    title: "Sticker",
    workbenchTitle: "Sticker Generator",
    eyebrow: "Sticker art",
    description: "Create sticker sheets, reaction stickers, mascot art, character stickers, and merch-ready concepts.",
    href: "/app/ai-sticker-generator",
    accent: "lime",
    icon: Sparkles,
    imageSrc: "/assets/visual-templates/ai-image-maker/fantasy-scene.png",
    heroImages: [
      "/assets/visual-templates/ai-image-maker/fantasy-scene.png",
      "/assets/visual-templates/ai-image-maker/ai-portrait.png",
      "/assets/home/after.png",
      "/assets/socialmedia/reference-portrait.png",
      "/assets/visual-templates/ai-image-maker/product-ad.png",
      "/assets/socialmedia/product-ad-og.png"
    ]
  },
  {
    slug: "ai-wallpaper-generator",
    title: "Wallpaper",
    workbenchTitle: "Wallpaper Generator",
    eyebrow: "Screens",
    description: "Generate phone wallpapers, desktop backgrounds, lock screens, and aesthetic visual scenes.",
    href: "/app/ai-wallpaper-generator",
    accent: "blue",
    icon: ImageIcon,
    imageSrc: "/assets/visual-templates/ai-image-maker/fantasy-scene.png",
    heroImages: [
      "/assets/visual-templates/ai-image-maker/fantasy-scene.png",
      "/assets/visual-templates/ai-album-cover/electronic-single-art.png",
      "/assets/visual-templates/ai-image-maker/luxury-interior.png",
      "/assets/socialmedia/reference-wide.png",
      "/assets/home/before.png",
      "/assets/home/after.png"
    ]
  },
  {
    slug: "ai-book-cover-generator",
    title: "Book Cover",
    workbenchTitle: "Book Cover Generator",
    eyebrow: "Publishing",
    description: "Create book covers for ebooks, Kindle, paperbacks, fiction, nonfiction, and self-publishing.",
    href: "/app/ai-book-cover-generator",
    accent: "pink",
    icon: Folder,
    imageSrc: "/assets/visual-templates/ai-album-cover/rock-vinyl-cover.png",
    heroImages: [
      "/assets/visual-templates/ai-album-cover/rock-vinyl-cover.png",
      "/assets/visual-templates/ai-album-cover/indie-film-cover.png",
      "/assets/visual-templates/ai-image-maker/fantasy-scene.png",
      "/assets/home/after.png",
      "/assets/socialmedia/reference-wide.png",
      "/assets/socialmedia/product-ad-og.png"
    ]
  },
  {
    slug: "baby-shower-invitations",
    title: "Baby Shower Invitations",
    workbenchTitle: "Baby Shower Invitations",
    eyebrow: "Celebrate the little one",
    description: "Create an original baby shower invitation with your theme and exact event details.",
    href: "/app/baby-shower-invitations",
    accent: "violet",
    icon: MailOpen,
    imageSrc: "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/baby-shower-invitations/launch-20260929/baby-shower-invitations-floral-garden_thumb.webp",
    heroImages: [
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/baby-shower-invitations/launch-20260929/baby-shower-invitations-floral-garden_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/baby-shower-invitations/launch-20260929/baby-shower-invitations-woodland-animals_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/baby-shower-invitations/launch-20260929/baby-shower-invitations-twinkle-little-star_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/baby-shower-invitations/launch-20260929/baby-shower-invitations-safari-adventure_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/baby-shower-invitations/launch-20260929/baby-shower-invitations-neutral-minimal_thumb.webp",
      "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/baby-shower-invitations/launch-20260929/baby-shower-invitations-butterfly-tea_thumb.webp"
    ]
  },
  {
    slug: "invitation-maker",
    title: "Invitation",
    workbenchTitle: "Invitation Generator",
    eyebrow: "Event cards",
    description: "Turn event details into birthday invites, party cards, wedding invitations, and digital invitations.",
    href: "/app/invitation-maker",
    accent: "blue",
    icon: PanelsTopLeft,
    imageSrc: "/assets/visual-templates/ai-flyer-generator/sweet-16-invitation.png",
    heroImages: [
      "/assets/visual-templates/ai-flyer-generator/sweet-16-invitation.png",
      "/assets/visual-templates/ai-flyer-generator/business-flyer.png",
      "/assets/visual-templates/ai-image-maker/party-flyer.png",
      "/assets/socialmedia/reference-wide.png",
      "/assets/home/after.png",
      "/assets/socialmedia/product-ad-og.png"
    ]
  },
  {
    slug: "background-remover",
    title: "Background Remover",
    workbenchTitle: "Background Remover",
    eyebrow: "Cutouts",
    description: "Remove image backgrounds and create transparent, white, color, or product-ready cutouts.",
    href: "/app/background-remover",
    accent: "violet",
    icon: ImageIcon,
    imageSrc: "/assets/background-remover/better-workflow-product-cutout.png",
    heroImages: [
      "/assets/background-remover/better-workflow-product-cutout.png",
      "/assets/socialmedia/product-ad-og.png",
      "/assets/socialmedia/reference-wide.png",
      "/assets/visual-templates/ai-image-maker/product-ad.png",
      "/assets/home/before.png",
      "/assets/home/after.png"
    ]
  },
  {
    slug: "ai-room-design",
    title: "Room Design",
    workbenchTitle: "Room Design Generator",
    eyebrow: "Interior",
    description: "Upload a room photo and create realistic redesigns with room type, style, palette, and layout direction.",
    href: "/app/ai-room-design",
    accent: "blue",
    icon: LayoutGrid,
    imageSrc: "/assets/home/after.png",
    heroImages: [
      "/assets/home/after.png",
      "/assets/home/before.png",
      "/assets/visual-templates/ai-image-maker/luxury-interior.png",
      "/assets/socialmedia/reference-wide.png",
      "/assets/visual-templates/ai-image-maker/product-ad.png",
      "/assets/socialmedia/product-ad-og.png"
    ]
  },
  {
    slug: "ai-interior-design",
    title: "Interior Design",
    workbenchTitle: "Interior Design Generator",
    eyebrow: "Interior",
    description: "Create interior design concepts from a room photo with style, palette, furniture, decor, and lighting direction.",
    href: "/app/ai-interior-design",
    accent: "violet",
    icon: LayoutGrid,
    imageSrc: "/assets/home/after.png",
    heroImages: [
      "/assets/home/after.png",
      "/assets/home/before.png",
      "/assets/visual-templates/ai-image-maker/luxury-interior.png",
      "/assets/socialmedia/reference-wide.png",
      "/assets/visual-templates/ai-image-maker/product-ad.png",
      "/assets/socialmedia/product-ad-og.png"
    ]
  },
  {
    slug: "tattoo-generator",
    title: "Tattoo",
    workbenchTitle: "Tattoo Generator",
    eyebrow: "Tattoo ideas",
    description: "Create tattoo concepts, stencil ideas, flash art, sleeve layouts, and artist-ready visual references.",
    href: "/app/tattoo-generator",
    accent: "lime",
    icon: Sparkles,
    imageSrc: "/assets/visual-templates/ai-image-maker/fantasy-scene.png",
    heroImages: [
      "/assets/visual-templates/ai-image-maker/fantasy-scene.png",
      "/assets/visual-templates/ai-album-cover/metal-cover-art.png",
      "/assets/socialmedia/reference-portrait.png",
      "/assets/home/before.png",
      "/assets/home/after.png",
      "/assets/socialmedia/product-ad-og.png"
    ]
  }
];

export const recentSessions = [
  {
    title: "美女广告图",
    meta: "Image project",
    href: "/app/ai-image-maker/demo-beauty-ad",
    imageSrc: "/assets/socialmedia/product-ad-og.png"
  },
  {
    title: "Album launch concept",
    meta: "Cover artwork",
    href: "/app/ai-album-cover-generator/demo-album",
    imageSrc: "/assets/home/after.png"
  }
];

export const inspirationItems = [
  {
    title: "Fashion campaign",
    href: "/app/ai-image-maker?prompt=fashion-campaign",
    imageSrc: "/assets/socialmedia/reference-portrait.png"
  },
  {
    title: "Product ad scene",
    href: "/app/ai-product-ad-image-generator?prompt=product-ad",
    imageSrc: "/assets/socialmedia/reference-wide.png"
  },
  {
    title: "Before and after story",
    href: "/app/ai-image-maker?prompt=before-after",
    imageSrc: "/assets/home/before.png"
  },
  {
    title: "Visual remix",
    href: "/app/ai-image-maker?prompt=visual-remix",
    imageSrc: "/assets/home/after.png"
  }
];

// Keep this workbench routable for chat return links without adding another Create card.
const routableAppTools: AppToolCard[] = [
  ...appTools,
  {
    ...appTools.find((tool) => tool.slug === "ai-video-generator")!,
    slug: "ai-image-to-video",
    title: "Image to Video",
    workbenchTitle: "AI Image to Video",
    eyebrow: "Image to video",
    description: "Turn a photo or illustration into a short AI video.",
    href: "/ai-image-to-video"
  }
];

export function findAppTool(slug: string) {
  return routableAppTools.find((tool) => tool.slug === slug);
}

function getAppToolConfiguredPathname(tool: AppToolCard) {
  return tool.href.split(/[?#]/, 1)[0]?.replace(/\/+$/, "") || "/";
}

export function hasDedicatedAppToolRoute(tool: AppToolCard) {
  return getAppToolConfiguredPathname(tool).startsWith("/app/");
}

export function resolveAppToolPublicHref(slug: string) {
  const tool = findAppTool(slug);
  if (!tool) return null;

  const queryIndex = tool.href.indexOf("?");
  const query = queryIndex >= 0 ? tool.href.slice(queryIndex) : "";
  const configuredPathname = getAppToolConfiguredPathname(tool);
  const publicPathname = hasDedicatedAppToolRoute(tool)
    ? `/${encodeURIComponent(tool.slug)}`
    : configuredPathname;
  return `${publicPathname}${query}`;
}

export function findAppToolByPathname(pathname: string) {
  if (pathname === "/") return findAppTool("hotel-lobby-ai");
  const normalizedPathname = pathname.split(/[?#]/, 1)[0]?.replace(/\/+$/, "") || "/";
  return routableAppTools.find((tool) => {
    const configuredPathname = getAppToolConfiguredPathname(tool);
    const publicPathname = resolveAppToolPublicHref(tool.slug)?.split("?", 1)[0];
    return normalizedPathname === publicPathname
      || (hasDedicatedAppToolRoute(tool) && normalizedPathname === configuredPathname);
  });
}

export type AppThreadMessage = {
  role: "user" | "assistant";
  text: string;
  state?: "working" | "complete";
  imageSrc?: string;
};

export const sampleThreadMessages: AppThreadMessage[] = [
  {
    role: "user",
    text: "为我为同一风格生成多张变体图，并按相似度或质量自动排序给我选择。"
  },
  {
    role: "assistant",
    text: "Generating and ranking new style variants",
    state: "complete",
    imageSrc: "/assets/socialmedia/product-ad-og.png"
  }
];
