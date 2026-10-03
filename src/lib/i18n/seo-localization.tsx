import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import type { Metadata } from "next";
import { VISMUSE_SEO_KEYWORDS } from "@/lib/seo/brand";
import { findSourceMessage, isTranslatedMessage, normalizeMessageText, t } from "./catalog";
import { translateFunctionalPattern } from "./functional-patterns";
import {
  getIndexableSiteLocaleOptions,
  getSiteLocaleOption,
  DEFAULT_SITE_LOCALE,
  isIndexableSiteLocale,
  localizeSitePath,
  type SiteLocale
} from "@/lib/i18n/site-locales";

const BASE_URL = "https://vismuse.com";
const protectedPropNames = new Set([
  "className", "id", "key", "src", "poster", "style", "type", "role", "rel", "target",
  "method", "action", "name", "value", "icon", "slug", "category", "tags", "status", "sourceUseCase",
  "template", "templates", "fallbackTemplates", "visualTemplates", "width", "height", "sizes", "fill", "priority", "loading", "fetchPriority", "crossOrigin"
]);

// Metadata keeps normal string values; protection never adds fields to the HTML head.
const preservedObjectFields = new WeakMap<object, ReadonlySet<string>>();
const fieldTranslations = new WeakMap<object, Readonly<Record<string, (locale: SiteLocale) => unknown>>>();

export function preserveSeoFields<T extends object>(value: T, fields: readonly string[]): T {
  preservedObjectFields.set(value, new Set(fields));
  return value;
}

/** Interpolate static labels around data without translating the data itself. */
export function setSeoFieldTranslations<T extends object>(value: T, fields: Readonly<Record<string, (locale: SiteLocale) => unknown>>): T {
  fieldTranslations.set(value, { ...fieldTranslations.get(value), ...fields });
  return value;
}

function looksStructural(value: string) {
  const trimmed = value.trim();
  return !trimmed
    || /^(https?:|mailto:|tel:|data:|blob:|#)/i.test(trimmed)
    || /^\/?[\w@.-]+(?:\/[\w@.?=&%+#:-]+)+$/.test(trimmed);
}

export function translateSeoText(value: string, locale: SiteLocale): string {
  if (looksStructural(value)) return value;
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const key = normalizeMessageText(value);
  if (locale !== DEFAULT_SITE_LOCALE && isTranslatedMessage(key, locale)) return value;
  const translated = findSourceMessage(key, locale);
  if (translated) return `${leading}${translated}${trailing}`;
  const controlLabel = key.match(/^(Select ratio|Aspect ratio|Resolution|Model|Quality|Duration|Video quality|Video resolution|Video duration|Style|Size|Mood or activity): (.+?)(, fixed)?$/);
  if (controlLabel) {
    const label = translateSeoText(controlLabel[1], locale);
    const value = translateSeoText(controlLabel[2], locale);
    return `${leading}${t(locale, "workbench.controls.parameter", { label, value, fixed: controlLabel[3] ? t(locale, "workbench.controls.fixed") : "" })}${trailing}`;
  }
  const functionalTranslation = translateFunctionalPattern(key, locale);
  if (functionalTranslation) return `${leading}${functionalTranslation}${trailing}`;

  const brandSuffix = key.match(/^(.*?)\s*\|\s*Vismuse$/);
  if (brandSuffix && findSourceMessage(brandSuffix[1], locale)) {
    return `${leading}${findSourceMessage(brandSuffix[1], locale)} | Vismuse${trailing}`;
  }

  const pageMatch = key.match(/^(.*) - Page (\d+)$/);
  if (pageMatch) {
    const prefix = findSourceMessage(pageMatch[1], locale) ?? pageMatch[1];
    return `${leading}${t(locale, "common.pagination.title", { title: prefix, page: pageMatch[2] })}${trailing}`;
  }
  const searchMatch = key.match(/^(.*) on this page$/);
  if (searchMatch) {
    const label = translateSeoText(searchMatch[1], locale);
    return `${leading}${t(locale, "common.search.currentPage", { label })}${trailing}`;
  }
  const templateMatch = key.match(/^(.*) template$/);
  if (templateMatch) {
    const title = translateSeoText(templateMatch[1], locale);
    return `${leading}${t(locale, "common.template.title", { name: title, suffix: "" })}${trailing}`;
  }
  const railMatch = key.match(/^Show (previous|more) (.*) templates$/);
  if (railMatch) {
    const title = translateSeoText(railMatch[2], locale);
    return `${leading}${t(locale, `common.template.${railMatch[1]}`, { title })}${trailing}`;
  }
  return value;
}

function localizeHref(value: string, locale: SiteLocale) {
  if (!value.startsWith("/") || value.startsWith("//")) return value;
  if (/^\/(?:app|api|auth|billing|chat|home|internal|local|share|socialmedia|thread)(?:\/|$)/.test(value)) return value;
  const [pathAndQuery, hash = ""] = value.split("#", 2);
  const [path, query = ""] = pathAndQuery.split("?", 2);
  const localized = localizeSitePath(path, locale);
  return `${localized}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

function translateJsonLd(html: string, locale: SiteLocale, preservedPaths: ReadonlySet<string>) {
  try {
    const translateJsonValue = (value: unknown, key?: string, path = ""): unknown => {
      if (preservedPaths.has(path)) return value;
      if (typeof value === "string") {
        if (key === "url" || key === "item") {
          if (value.startsWith(BASE_URL)) return `${BASE_URL}${localizeHref(value.slice(BASE_URL.length) || "/", locale)}`;
          return value;
        }
        if (key?.startsWith("@")) return value;
        if (key === "keywords") return value.split(", ").map((term) => translateSeoText(term, locale)).join(", ");
        return translateSeoText(value, locale);
      }
      if (Array.isArray(value)) return value.map((item, index) => translateJsonValue(item, key, `${path}.${index}`));
      if (value && typeof value === "object") {
        if ("@type" in value && value["@type"] === "CreativeWork") {
          return Object.fromEntries(Object.entries(value).map(([childKey, item]) => [childKey,
            childKey === "name" || childKey === "description" ? item : translateJsonValue(item, childKey, path ? `${path}.${childKey}` : childKey)]));
        }
        return Object.fromEntries(Object.entries(value).map(([childKey, item]) => [childKey, translateJsonValue(item, childKey, path ? `${path}.${childKey}` : childKey)]));
      }
      return value;
    };
    return JSON.stringify(translateJsonValue(JSON.parse(html)));
  } catch {
    return html;
  }
}

function translateSeoValue(value: unknown, locale: SiteLocale, propName?: string): unknown {
  if (protectedPropNames.has(propName ?? "")) return value;
  if (isValidElement(value)) return localizeSeoTree(value, locale);
  if (typeof value === "string") {
    if (propName === "href") return localizeHref(value, locale);
    if (propName === "url" || propName === "item") {
      if (value.startsWith(BASE_URL)) return `${BASE_URL}${localizeHref(value.slice(BASE_URL.length) || "/", locale)}`;
      return value;
    }
    return translateSeoText(value, locale);
  }
  if (Array.isArray(value)) return value.map((item) => translateSeoValue(item, locale, propName));
  if (value && typeof value === "object" && !isValidElement(value)) {
    const preservedFields = preservedObjectFields.get(value);
    const translations = fieldTranslations.get(value);
    const translated = Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
      translations?.[key] ? translations[key](locale) : preservedFields?.has(key) ? item : translateSeoValue(item, locale, key)]));
    if (preservedFields) preservedObjectFields.set(translated, preservedFields);
    if (translations) fieldTranslations.set(translated, translations);
    return translated;
  }
  return value;
}

export async function resolveLocalizedSeoTree(node: ReactNode, locale: SiteLocale): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map((child) => resolveLocalizedSeoTree(child, locale)));
  if (!isValidElement(node)) return localizeSeoTree(node, locale);
  const element = node as ReactElement<Record<string, unknown>>;
  if (element.props["data-i18n-skip"]) return node;
  const component = element.type;
  const clientReference = (typeof component === "function" || typeof component === "object")
    && component !== null
    && "$$typeof" in component
    && component.$$typeof === Symbol.for("react.client.reference");

  if (typeof component === "function" && !clientReference) {
    const rendered = await (component as CallableFunction)({ ...element.props, locale });
    return resolveLocalizedSeoTree(rendered as ReactNode, locale);
  }

  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(element.props)) {
    if (isValidElement(value) || key === "children") props[key] = await resolveLocalizedSeoTree(value as ReactNode, locale);
    else props[key] = value;
  }
  return localizeSeoTree(cloneElement(element, props), locale);
}

export function localizeSeoTree(node: ReactNode, locale: SiteLocale): ReactNode {
  if (typeof node === "string") return translateSeoText(node, locale);
  if (Array.isArray(node)) return node.map((child) => localizeSeoTree(child, locale));
  if (!isValidElement(node)) return node;

  const element = node as ReactElement<Record<string, unknown>>;
  if (element.props["data-i18n-skip"]) return node;
  const nextProps: Record<string, unknown> = {};
  const preservedProps = new Set(String(element.props["data-i18n-preserve"] ?? "").split(/\s+/).filter(Boolean));
  for (const [key, value] of Object.entries(element.props)) {
    if (preservedProps.has(key)) nextProps[key] = value;
    else if (key === "children") nextProps.children = localizeSeoTree(value as ReactNode, locale);
    else if (key === "dangerouslySetInnerHTML" && value && typeof value === "object" && "__html" in value) {
      nextProps[key] = { __html: translateJsonLd(String((value as { __html: unknown }).__html), locale, preservedProps) };
    } else nextProps[key] = translateSeoValue(value, locale, key);
  }
  if (typeof element.type === "function" || typeof element.type === "object") nextProps.locale = locale;
  return cloneElement(element, nextProps);
}

export function localizeSeoMetadata(metadata: Metadata, path: string, locale: SiteLocale): Metadata {
  const option = getSiteLocaleOption(locale);
  const originalCanonical = metadata.alternates?.canonical;
  const canonicalValue = typeof originalCanonical === "string" ? originalCanonical : originalCanonical instanceof URL ? originalCanonical.toString() : undefined;
  const canonicalPath = canonicalValue?.startsWith(BASE_URL) ? canonicalValue.slice(BASE_URL.length) || "/" : canonicalValue?.startsWith("/") ? canonicalValue : path;
  const localizedPath = localizeSitePath(canonicalPath, locale);
  const isIndexableLocale = isIndexableSiteLocale(canonicalPath, locale);
  const canonicalLocalizedPath = isIndexableLocale ? localizedPath : localizeSitePath(canonicalPath, DEFAULT_SITE_LOCALE);
  const translated = translateSeoValue(metadata, locale) as Metadata;
  const absoluteUrl = `${BASE_URL}${canonicalLocalizedPath}`;
  const title = typeof translated.title === "string"
    ? { absolute: translated.title.endsWith("| Vismuse") ? translated.title : `${translated.title} | Vismuse` }
    : translated.title;

  return {
    ...translated,
    title,
    keywords: translated.keywords ?? VISMUSE_SEO_KEYWORDS.map((keyword) => translateSeoText(keyword, locale)),
    alternates: {
      ...(translated.alternates ?? {}),
      canonical: canonicalLocalizedPath,
      languages: {
        ...Object.fromEntries(getIndexableSiteLocaleOptions(canonicalPath).map((option) => [option.htmlLang, `${BASE_URL}${localizeSitePath(canonicalPath, option.locale)}`])),
        "x-default": `${BASE_URL}${localizeSitePath(canonicalPath, DEFAULT_SITE_LOCALE)}`
      }
    },
    robots: isIndexableLocale ? translated.robots : {
      index: false,
      follow: true,
      googleBot: { index: false, follow: true }
    },
    openGraph: translated.openGraph ? {
      ...translated.openGraph,
      url: absoluteUrl,
      locale: option.openGraphLocale
    } : undefined,
    other: {
      ...((translated.other ?? {}) as Record<string, string | number | Array<string | number>>),
      "content-language": option.htmlLang
    }
  };
}
