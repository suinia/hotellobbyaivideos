import { LOCALE_RESOURCES, getSourceIndex } from "@/locales/catalog.generated";
import config from "@/locales/config.json";
import type { SiteLocale } from "./site-locales";

export type MessageParameters = Record<string, string | number>;
const resources = LOCALE_RESOURCES as Record<SiteLocale, Record<string, unknown>>;

export function normalizeMessageText(value: string) {
  return value.trim().replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
}

function flatten(value: unknown, prefix = ""): Array<[string, string]> {
  if (typeof value === "string") return [[prefix, value]];
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key));
}

let indexedSources: Record<string, string> | undefined;
let indexedEnglish: Record<string, unknown> | undefined;
let aliases = new Map<string, string>();
let foldedAliases = new Map<string, string>();

function ensureAliases() {
  const sourceIndex = getSourceIndex();
  const english = resources[config.defaultLocale as SiteLocale];
  if (indexedSources === sourceIndex && indexedEnglish === english) return;
  aliases = new Map(Object.entries(sourceIndex).map(([source, key]) => [normalizeMessageText(source), key]));
  for (const namespace of Object.keys(english ?? {}).filter((namespace) => namespace !== "home")) {
    for (const [key, value] of flatten(english[namespace])) {
      const text = normalizeMessageText(value);
      if (text && !aliases.has(text)) aliases.set(text, `${namespace}.${key}`);
    }
  }
  foldedAliases = new Map(Array.from(aliases, ([source, key]) => [source.toLowerCase(), key]));
  indexedSources = sourceIndex;
  indexedEnglish = english;
}
const translatedValues = new WeakMap<object, Set<string>>();

export function getLocaleResource<T>(locale: SiteLocale, namespace: string, key: string): T {
  const localized = resources[locale]?.[namespace] as Record<string, unknown> | undefined;
  const fallback = resources[config.defaultLocale as SiteLocale]?.[namespace] as Record<string, unknown> | undefined;
  return (localized?.[key] ?? fallback?.[key]) as T;
}

export function getMessage(locale: SiteLocale, key: string): string | undefined {
  const [namespace, ...parts] = key.split(".");
  const read = (language: SiteLocale) => {
    let value = resources[language]?.[namespace];
    const flatKey = parts.join(".");
    if (value && typeof value === "object" && Object.hasOwn(value, flatKey)) return (value as Record<string, unknown>)[flatKey];
    for (const part of parts) value = value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined;
    return value;
  };
  const value = read(locale) ?? read(config.defaultLocale as SiteLocale);
  return typeof value === "string" ? value : undefined;
}

/** Read a stable message key; all wording and placeholder order live in locale JSON. */
export function t(locale: SiteLocale, key: string, parameters: MessageParameters = {}): string {
  const template = getMessage(locale, key) ?? key;
  return template.replace(/\{(\w+)(?:,\s*(number))?\}/g, (placeholder, name: string, format?: string) => {
    const value = parameters[name];
    if (value === undefined) return placeholder;
    if (format === "number") {
      const number = typeof value === "number" ? value : Number(value.replaceAll(",", ""));
      if (Number.isFinite(number)) return number.toLocaleString(config.languages[locale].htmlLang);
    }
    return String(value);
  });
}

export function isTranslatedMessage(text: string, locale: SiteLocale) {
  const namespaces = resources[locale];
  if (!namespaces) return false;
  let values = translatedValues.get(namespaces);
  if (!values) {
    values = new Set(flatten(namespaces).map(([, value]) => normalizeMessageText(value)));
    translatedValues.set(namespaces, values);
  }
  return values.has(normalizeMessageText(text));
}

/** Compatibility for existing English literals; new controls should use t(locale, key). */
export function findSourceMessage(text: string, locale: SiteLocale): string | undefined {
  ensureAliases();
  const source = normalizeMessageText(text);
  const key = aliases.get(source) ?? foldedAliases.get(source.toLowerCase());
  return key ? getMessage(locale, key) : undefined;
}
