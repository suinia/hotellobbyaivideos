// GSC URL Inspection, 2026-09-24: these pairs publish the same creative brief.
// Keep both creation entry points, but consolidate discovery on Google's chosen URL.
export const TEMPLATE_CANONICAL_SLUGS: Readonly<Record<string, string>> = {
  "ai-album-cover-generator-dark-rap-mixtape-case": "ai-image-maker-dark-rap-mixtape-cover",
  "ai-video-extreme-sports-campaign": "promo-extreme-sports-campaign"
};

export function getCanonicalTemplateSlug(slug: string): string {
  return Object.prototype.hasOwnProperty.call(TEMPLATE_CANONICAL_SLUGS, slug)
    ? TEMPLATE_CANONICAL_SLUGS[slug]
    : slug;
}

export function getCanonicalTemplateHref(slug: string): string {
  return `/templates/${getCanonicalTemplateSlug(slug)}`;
}

export function getCanonicalTemplatePath(pathname: string): string {
  const match = /^\/templates\/([^/]+)$/.exec(pathname);
  return match ? getCanonicalTemplateHref(match[1]) : pathname;
}
