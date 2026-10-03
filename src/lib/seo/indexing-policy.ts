import { INDEXABLE_DOC_SLUGS } from "@/lib/seo/docs";
import { TEMPLATE_DIRECTORY_WORKBENCHES } from "@/lib/templates/template-directory";
import { restoredFlyerMakerPaths, restoredFlyerTemplatePaths } from "./flyer-topic-pages";

export const INDEXABLE_FLYER_TOPIC_PATHS = [...restoredFlyerMakerPaths, ...restoredFlyerTemplatePaths];

export const INDEXABLE_STATIC_PATHS = [
  "/",
  "/de",
  "/fr",
  "/acceptable-use",
  "/pricing",
  "/help",
  "/tools",
  "/tools/album-cover-generator",
  "/tools/ai-flyer-generator",
  "/tools/ai-brochure-generator",
  "/tools/party-flyer-generator",
  "/tools/ai-image-maker",
  "/tools/ai-image-to-video",
  "/tools/hotel-lobby-ai",
  "/tools/ai-image-text-editor",
  "/tools/ai-logo-generator",
  "/tools/ai-sticker-generator",
  "/tools/ai-wallpaper-generator",
  "/tools/tattoo-generator",
  "/tools/background-remover",
  "/tools/ai-product-ad-image-generator",
  "/tools/ai-room-design",
  "/tools/ai-infographic-generator",
  "/tools/ai-comic-generator",
  "/tools/ai-anime-generator",
  "/tools/baby-shower-invitations",
  "/tools/playlist-cover-maker",
  "/tools/vision-board-maker",
  "/tools/ai-menu-generator",
  "/tools/ai-book-cover-generator",
  "/tools/poster-maker",
  "/tools/business-card-maker",
  "/tools/invitation-maker",
  "/templates",
  "/templates/flyers",
  "/templates/flyers/back-to-school",
  "/templates/album-covers",
  "/what-is-vismuse",
  "/docs",
  "/ai-video-generator",
  "/ai-animation-generator",
  "/promo-video",
  "/hotel-lobby-ai",
  "/spotify-canvas-generator",
  "/minimax-h3",
  "/seedance-2-5",
  "/gpt-image-2-5",
  "/privacy",
  "/terms",
  "/refund-policy",
  "/cookies"
] as const;

// HTML routes that redirect or emit noindex must remain crawlable so crawlers can
// observe those directives. Only non-document endpoints stay blocked here.
export const NON_CRAWLABLE_PATHS = ["/api/", "/auth/"] as const;
export const INDEXABLE_TEMPLATE_PATHS = TEMPLATE_DIRECTORY_WORKBENCHES
  .map((workbench) => workbench.href)
  .filter((path) => !INDEXABLE_STATIC_PATHS.some((staticPath) => staticPath === path));

const INDEXABLE_STATIC_PATH_SET = new Set<string>(INDEXABLE_STATIC_PATHS);
const INDEXABLE_TEMPLATE_PATH_SET = new Set<string>(INDEXABLE_TEMPLATE_PATHS);
const INDEXABLE_FLYER_TOPIC_PATH_SET = new Set<string>(INDEXABLE_FLYER_TOPIC_PATHS);
const INDEXABLE_DOC_SLUG_SET = new Set<string>(INDEXABLE_DOC_SLUGS);

export function isIndexableDocSlug(slug: string) {
  return INDEXABLE_DOC_SLUG_SET.has(slug);
}

export function isIndexableStaticPath(path: string) {
  return INDEXABLE_STATIC_PATH_SET.has(path);
}

export function isIndexableHref(href: string) {
  const [path] = href.split("?");

  if (INDEXABLE_STATIC_PATH_SET.has(path)) return true;
  if (INDEXABLE_TEMPLATE_PATH_SET.has(path)) return true;
  if (INDEXABLE_FLYER_TOPIC_PATH_SET.has(path)) return true;

  return path.startsWith("/docs/") && isIndexableDocSlug(path.replace("/docs/", ""));
}

export function getUnlocalizedIndexablePaths() {
  return INDEXABLE_STATIC_PATHS.filter((path) => path !== "/de" && path !== "/fr");
}
