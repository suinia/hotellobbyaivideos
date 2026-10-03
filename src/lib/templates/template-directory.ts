import { getCanonicalTemplateHref } from "@/lib/seo/template-canonical";

export type TemplateDirectoryWorkbench = {
  slug: string;
  title: string;
  templateName: string;
  href: string;
  category: "popular" | "inspired";
  displayFormat: "portrait" | "square" | "landscape";
};

export type TemplateDirectoryItem = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  starter_prompt: string;
  tags: string[];
  background_image_url: string;
  thumbnail_image_url: string;
  default_aspect_ratio?: string;
  use_case_slug?: string;
  output_type?: string;
  href: string;
};

export type TemplateDirectorySection = TemplateDirectoryWorkbench & {
  templates: TemplateDirectoryItem[];
};

export type TemplateDirectoryLoadResult = {
  sections: TemplateDirectorySection[];
  complete: boolean;
  failedSlugs: string[];
};

export type TemplateDirectoryResponse = TemplateDirectoryLoadResult & {
  limit: number;
  error?: string;
};

export const TEMPLATE_DIRECTORY_WORKBENCHES: TemplateDirectoryWorkbench[] = [
  { slug: "ai-image-maker", title: "Images", templateName: "Image", href: "/templates/images", category: "popular", displayFormat: "portrait" },
  { slug: "ai-video-generator", title: "Videos", templateName: "Video", href: "/templates/videos", category: "inspired", displayFormat: "landscape" },
  { slug: "ai-flyer-generator", title: "Flyers", templateName: "Flyer", href: "/templates/flyers", category: "popular", displayFormat: "portrait" },
  { slug: "ai-brochure-generator", title: "Brochures", templateName: "Brochure", href: "/templates/brochures", category: "popular", displayFormat: "landscape" },
  { slug: "ai-infographic-generator", title: "Infographics", templateName: "Infographic", href: "/templates/infographics", category: "popular", displayFormat: "portrait" },
  { slug: "ai-comic-generator", title: "Comics", templateName: "Comic", href: "/templates/comics", category: "popular", displayFormat: "portrait" },
  { slug: "ai-anime-generator", title: "Anime", templateName: "Anime", href: "/templates/anime", category: "popular", displayFormat: "portrait" },
  { slug: "playlist-cover-maker", title: "Playlist Covers", templateName: "Playlist Cover", href: "/templates/playlist-covers", category: "popular", displayFormat: "square" },
  { slug: "vision-board-maker", title: "Vision Boards", templateName: "Vision Board", href: "/templates/vision-boards", category: "popular", displayFormat: "portrait" },
  { slug: "ai-menu-generator", title: "Menus", templateName: "Menu", href: "/templates/menus", category: "popular", displayFormat: "portrait" },
  { slug: "ai-album-cover-generator", title: "Album Covers", templateName: "Album Cover", href: "/templates/album-covers", category: "popular", displayFormat: "square" },
  { slug: "ai-product-ad-image-generator", title: "Product Ads", templateName: "Product Ad", href: "/templates/product-ads", category: "popular", displayFormat: "portrait" },
  { slug: "poster-maker", title: "Posters", templateName: "Poster", href: "/templates/posters", category: "popular", displayFormat: "portrait" },
  { slug: "business-card-maker", title: "Business Cards", templateName: "Business Card", href: "/templates/business-cards", category: "popular", displayFormat: "landscape" },
  { slug: "ai-logo-generator", title: "Logos", templateName: "Logo", href: "/templates/logos", category: "popular", displayFormat: "square" },
  { slug: "ai-sticker-generator", title: "Stickers", templateName: "Sticker", href: "/templates/stickers", category: "popular", displayFormat: "square" },
  { slug: "ai-wallpaper-generator", title: "Wallpapers", templateName: "Wallpaper", href: "/templates/wallpapers", category: "popular", displayFormat: "portrait" },
  { slug: "ai-book-cover-generator", title: "Book Covers", templateName: "Book Cover", href: "/templates/book-covers", category: "popular", displayFormat: "portrait" },
  { slug: "baby-shower-invitations", title: "Baby Shower Invitations", templateName: "Baby Shower Invitation", href: "/templates/baby-shower-invitations", category: "popular", displayFormat: "portrait" },
  { slug: "invitation-maker", title: "Invitations", templateName: "Invitation", href: "/templates/invitations", category: "popular", displayFormat: "portrait" },
  { slug: "ai-room-design", title: "Room & Interior Designs", templateName: "Room & Interior Design", href: "/templates/room-designs", category: "popular", displayFormat: "landscape" },
  { slug: "tattoo-generator", title: "Tattoos", templateName: "Tattoo", href: "/templates/tattoos", category: "popular", displayFormat: "square" }
];

export function getTemplateCollectionSlug(workbench: TemplateDirectoryWorkbench) {
  return workbench.href.replace(/^\/templates\//, "");
}

export function getTemplateDirectoryWorkbenchByCollectionSlug(collectionSlug: string) {
  return TEMPLATE_DIRECTORY_WORKBENCHES.find(
    (workbench) => getTemplateCollectionSlug(workbench) === collectionSlug
  );
}

const TEMPLATE_SOURCE_USE_CASE_ALIASES: Record<string, string> = {
  "ai-album-cover": "ai-album-cover-generator",
  "ai-book-cover": "ai-book-cover-generator",
  "room-design": "ai-room-design",
  "ai-interior-design": "ai-room-design",
  "promo-video-maker": "ai-video-generator",
  "hotel-lobby-ai": "ai-video-generator",
  "ai-animation-generator": "ai-video-generator"
};

export function getTemplateDirectoryWorkbenchBySourceUseCase(sourceUseCase?: string) {
  const normalizedSourceUseCase = sourceUseCase
    ? TEMPLATE_SOURCE_USE_CASE_ALIASES[sourceUseCase] ?? sourceUseCase
    : undefined;

  return TEMPLATE_DIRECTORY_WORKBENCHES.find(
    (workbench) => workbench.slug === normalizedSourceUseCase
  );
}

export function getTemplateGeneratorPath(sourceUseCase?: string) {
  const normalizedSourceUseCase = sourceUseCase?.trim() || "ai-album-cover-generator";

  if (normalizedSourceUseCase === "hotel-lobby-ai") return "/hotel-lobby-ai";
  if (normalizedSourceUseCase === "promo-video-maker") return "/promo-video";
  if (normalizedSourceUseCase === "ai-animation-generator") return "/app/ai-animation-generator";
  if (normalizedSourceUseCase === "ai-flyer-generator") return "/ai-flyer-generator";
  if (normalizedSourceUseCase === "ai-clothes-changer") return "/ai-clothes-changer";

  const workbench = getTemplateDirectoryWorkbenchBySourceUseCase(normalizedSourceUseCase);
  return `/app/${workbench?.slug ?? normalizedSourceUseCase}`;
}

export function templateMatchesSearchQuery(
  template: {
    title: string;
    description?: string;
    prompt?: string;
    tags?: string[];
  },
  query: string
) {
  const normalizedQuery = query.normalize("NFKC").trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [template.title, template.description, template.prompt, ...(template.tags ?? [])]
    .filter(Boolean)
    .join(" ")
    .normalize("NFKC")
    .toLowerCase()
    .includes(normalizedQuery);
}

function normalizeTemplateAssetUrl(assetUrl?: string) {
  const normalized = assetUrl?.trim();
  if (!normalized) return "";

  try {
    const url = new URL(normalized, "https://vismuse.local");
    const origin = url.origin === "https://vismuse.local" ? "" : url.origin;
    return `${origin}${url.pathname}`;
  } catch {
    return normalized.split(/[?#]/, 1)[0] || normalized;
  }
}

export function dedupeTemplatesByAsset<T extends { id: string; background_image_url?: string }>(templates: T[]) {
  const seenAssets = new Set<string>();
  return templates.filter((template) => {
    const assetKey = normalizeTemplateAssetUrl(template.background_image_url);
    if (!assetKey) return true;
    if (seenAssets.has(assetKey)) return false;
    seenAssets.add(assetKey);
    return true;
  });
}

export function buildTemplateDirectoryItemHref(template: { slug: string }) {
  return getCanonicalTemplateHref(template.slug);
}
