import config from "@/locales/config.json";
import publicPaths from "@/locales/seo-paths.json";

export type SiteLocale = keyof typeof config.languages;
export const SITE_LOCALES = Object.keys(config.languages) as SiteLocale[];
export const DEFAULT_SITE_LOCALE = config.defaultLocale as SiteLocale;
export const SITE_LOCALE_COOKIE = "vismuse_locale";
export const SITE_LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const SITE_LOCALE_OPTIONS = SITE_LOCALES.map((locale) => ({ locale, ...config.languages[locale], href: locale === DEFAULT_SITE_LOCALE ? "/" : `/${locale}` }));

const SEO_PATH_LOCALE_LIMITS: Record<string, readonly SiteLocale[]> = {
  "/ai-image-to-video": ["en"],
  "/tools/ai-image-to-video": ["en"],
  "/tools/hotel-lobby-ai": ["en"],
  "/docs/how-to-remove-background-from-image-on-iphone": ["en"],
  "/docs/how-to-remove-people-from-pictures-on-iphone": ["en"],
  "/tools/ai-room-design": ["en"],
  "/tools/ai-anime-generator": ["en"],
  "/tools/baby-shower-invitations": ["en"],
  "/tools/playlist-cover-maker": ["en"],
  "/tools/vision-board-maker": ["en"],
  "/tools/ai-menu-generator": ["en"],
  "/tools/ai-book-cover-generator": ["en"],
  "/tools/poster-maker": ["en"],
  "/tools/business-card-maker": ["en"],
  "/tools/invitation-maker": ["en"]
};

export function getIndexableSiteLocaleOptions(pathname: string) {
  const supportedLocales = SEO_PATH_LOCALE_LIMITS[stripSiteLocaleFromPath(pathname)];
  return supportedLocales
    ? SITE_LOCALE_OPTIONS.filter((option) => supportedLocales.includes(option.locale))
    : SITE_LOCALE_OPTIONS;
}

export function isIndexableSiteLocale(pathname: string, locale: SiteLocale) {
  return getIndexableSiteLocaleOptions(pathname).some((option) => option.locale === locale);
}

export function isSiteLocale(value?: string | null): value is SiteLocale {
  return SITE_LOCALES.includes(value as SiteLocale);
}
export function resolveSiteLocale(value?: string | null): SiteLocale {
  return isSiteLocale(value) ? value : DEFAULT_SITE_LOCALE;
}
export function getSiteLocaleOption(locale: SiteLocale) {
  return SITE_LOCALE_OPTIONS.find((option) => option.locale === locale) ?? SITE_LOCALE_OPTIONS[0];
}
export function getSiteLocaleFromPath(pathname: string): SiteLocale | undefined {
  const value = pathname.split("/")[1];
  return isSiteLocale(value) ? value : undefined;
}
export function stripSiteLocaleFromPath(pathname: string) {
  const locale = getSiteLocaleFromPath(pathname);
  return locale ? pathname.slice(locale.length + 1) || "/" : pathname || "/";
}
export function isLocaleNeutralSitePath(pathname: string) {
  const unlocalizedPath = stripSiteLocaleFromPath(pathname);
  return /^\/(?:app|api|auth|billing|chat|home|internal|local|_local|r|share|socialmedia|thread|boards|assets|studio|guides|flyers)(?:\/|$)/.test(unlocalizedPath)
    || /^\/ai-product-ad-image-generator\/boards(?:\/|$)/.test(unlocalizedPath);
}
export function localizeSitePath(pathname: string, locale: SiteLocale) {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return pathname;
  const path = stripSiteLocaleFromPath(pathname);
  if (isLocaleNeutralSitePath(path) || locale === DEFAULT_SITE_LOCALE) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** English uses the same resource renderer behind an internal rewrite; its public URL stays unchanged. */
export function isResourceSeoPath(pathname: string) {
  return pathname === "/" || publicPaths.includes(pathname)
    || /^\/docs\/[^/]+\/?$/.test(pathname)
    || /^\/templates\/flyers\/[^/]+\/?$/.test(pathname)
    || /^\/templates\/[^/]+(?:\/page\/[^/]+)?\/?$/.test(pathname);
}
export function resolveSiteLocaleFromGeo(countryValue?: string | null, regionValue?: string | null): SiteLocale {
  const country = countryValue?.trim().toUpperCase() ?? "";
  const region = regionValue?.trim().toUpperCase().replace(/^[A-Z]{2}-/, "") ?? "";
  for (const [locale, countries] of Object.entries(config.geo.countries)) if (countries.includes(country) && isSiteLocale(locale)) return locale;
  const regions = config.geo.regions as Record<string, { defaultLocale: string; locales: Record<string, string[]> }>;
  const market = regions[country];
  if (market) {
    for (const [locale, regions] of Object.entries(market.locales)) if (regions.includes(region) && isSiteLocale(locale)) return locale;
    return resolveSiteLocale(market.defaultLocale);
  }
  return DEFAULT_SITE_LOCALE;
}
