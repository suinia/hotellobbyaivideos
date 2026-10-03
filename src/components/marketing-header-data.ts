
import { getLocaleResource } from "@/lib/i18n/catalog";
import { getHomepageCopy } from "@/lib/i18n/marketing-home";
import { localizeSitePath, type SiteLocale } from "@/lib/i18n/site-locales";

export type MarketingCreateIcon =
  | "book-open"
  | "calendar-days"
  | "clapperboard"
  | "credit-card"
  | "disc"
  | "heart-handshake"
  | "house"
  | "image"
  | "megaphone"
  | "panels"
  | "scissors"
  | "shirt"
  | "sparkles";

export type MarketingCreateItemId =
  | "ai-video-generator"
  | "ai-flyer-generator"
  | "ai-brochure-generator"
  | "ai-album-cover-generator"
  | "ai-image-maker"
  | "ai-product-ad-image-generator"
  | "ai-room-design"
  | "background-remover"
  | "business-card-maker"
  | "ai-logo-generator"
  | "tattoo-generator"
  | "poster-maker"
  | "invitation-maker"
  | "ai-book-cover-generator"
  | "ai-clothes-changer"
  | "ai-sticker-generator"
  | "ai-wallpaper-generator";

export type MarketingNavItem = {
  label: string;
  href: string;
};

export type MarketingCreateMenuItem = {
  id: MarketingCreateItemId;
  href: string;
  title: string;
  description: string;
  icon: MarketingCreateIcon;
};

export const marketingNavItems: MarketingNavItem[] = [
  { label: "Video", href: "/ai-video-generator" },
  { label: "Tools", href: "/tools" },
  { label: "Templates", href: "/templates" },
  { label: "Resources", href: "/docs" },
  { label: "Pricing", href: "/pricing" }
];

export const homepageNavItems: MarketingNavItem[] = [
  { label: "AI Video", href: "/promo-video" },
  { label: "AI Image", href: "/tools/ai-image-maker" },
  { label: "Tools", href: "/tools" },
  { label: "Templates", href: "/templates" },
  { label: "Resources", href: "/docs" },
  { label: "Pricing", href: "/pricing" }
];

export function resolveHomepageNavItems(locale: SiteLocale): MarketingNavItem[] {
  const nav = getHomepageCopy(locale).nav;
  return [
    { label: nav.aiVideo, href: "/promo-video" },
    { label: nav.aiImage, href: "/tools/ai-image-maker" },
    { label: nav.tools, href: "/tools" },
    { label: nav.templates, href: "/templates" },
    { label: nav.resources, href: "/docs" },
    { label: nav.pricing, href: "/pricing" }
  ];
}

const marketingCreateMenuItems: MarketingCreateMenuItem[] = [
  {
    id: "ai-video-generator",
    href: "/ai-video-generator",
    title: "AI Video Generator",
    description: "Create short AI videos from prompts, references, and briefs.",
    icon: "clapperboard"
  },
  {
    id: "ai-flyer-generator",
    href: "/tools/ai-flyer-generator",
    title: "AI Flyer Generator",
    description: "Turn events, offers, and listings into flyers.",
    icon: "panels"
  },
  {
    id: "ai-brochure-generator",
    href: "/ai-brochure-generator",
    title: "AI Brochure Generator",
    description: "Structure company, product, and service content into brochures.",
    icon: "panels"
  },
  {
    id: "ai-album-cover-generator",
    href: "/tools/album-cover-generator",
    title: "AI Album Cover Generator",
    description: "Design album covers, mixtape art, and single artwork.",
    icon: "disc"
  },
  {
    id: "ai-image-maker",
    href: "/ai-image-maker",
    title: "AI Image Maker",
    description: "Create any image from a prompt, link, or reference.",
    icon: "image"
  },
  {
    id: "ai-product-ad-image-generator",
    href: "/ai-product-ad-image-generator",
    title: "Product Ad Generator",
    description: "Generate product promo images and ad creatives.",
    icon: "megaphone"
  },
  {
    id: "ai-room-design",
    href: "/ai-room-design",
    title: "AI Room Design",
    description: "Upload a room photo and redesign interiors with AI.",
    icon: "house"
  },
  {
    id: "background-remover",
    href: "/background-remover",
    title: "Background Remover",
    description: "Remove backgrounds for clean cutouts and product images.",
    icon: "scissors"
  },
  {
    id: "business-card-maker",
    href: "/business-card-maker",
    title: "Business Card Maker",
    description: "Create print-ready front and back business card designs.",
    icon: "credit-card"
  },
  {
    id: "ai-logo-generator",
    href: "/ai-logo-generator",
    title: "AI Logo Generator",
    description: "Create logo concepts, brand marks, badges, and monograms.",
    icon: "sparkles"
  },
  {
    id: "tattoo-generator",
    href: "/tattoo-generator",
    title: "Tattoo Generator",
    description: "Create tattoo concepts, stencil ideas, flash art, and sleeve layouts.",
    icon: "sparkles"
  },
  {
    id: "poster-maker",
    href: "/poster-maker",
    title: "AI Poster Maker",
    description: "Create posters for events, product promotions, movies, lost-and-found notices, and more.",
    icon: "panels"
  },
  {
    id: "invitation-maker",
    href: "/invitation-maker",
    title: "Invitation Maker",
    description: "Create birthday invitations, party invites, and event cards.",
    icon: "calendar-days"
  },
  {
    id: "ai-book-cover-generator",
    href: "/ai-book-cover-generator",
    title: "AI Book Cover Generator",
    description: "Create ebook, Kindle, and paperback cover concepts.",
    icon: "book-open"
  },
  {
    id: "ai-sticker-generator",
    href: "/ai-sticker-generator",
    title: "AI Sticker Generator",
    description: "Create stickers, reactions, and sticker sheets.",
    icon: "image"
  },
  {
    id: "ai-wallpaper-generator",
    href: "/ai-wallpaper-generator",
    title: "AI Wallpaper Generator",
    description: "Generate phone and desktop wallpapers.",
    icon: "image"
  }
];

export function resolveMarketingCreateMenuItems(
  hrefOverrides: Partial<Record<MarketingCreateItemId, string>> = {},
  locale: SiteLocale = "en"
): MarketingCreateMenuItem[] {
  const localizedTitles = getLocaleResource<Record<string, string>>(locale, "common", "headerTitles");
  return marketingCreateMenuItems.map((item) => ({
    ...item,
    href: localizeSitePath(hrefOverrides[item.id] ?? item.href, locale),
    title: localizedTitles[item.title] ?? item.title
  }));
}
