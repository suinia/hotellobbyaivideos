import "server-only";
import type { ReactNode } from "react";
import { LOCALE_RESOURCES, getSourceIndex } from "@/locales/catalog.generated";
import { DEFAULT_SITE_LOCALE, type SiteLocale } from "./site-locales";
import { compactSourceIndex } from "./compact-source-index";
import { SiteLocaleProvider as ClientLocaleProvider } from "./ui-locale";

const resourceSnapshots = new Map<string, Record<string, unknown>>();
const indexSnapshots = new Map<string, Record<string, string>>();
// Consider all namespaces so later client navigation cannot change alias precedence.
const compactIndex = compactSourceIndex(getSourceIndex(), LOCALE_RESOURCES[DEFAULT_SITE_LOCALE]);
function selectResources(locale: SiteLocale, namespaces: readonly string[]) {
  const key = `${locale}:${namespaces.join(",")}`;
  let snapshot = resourceSnapshots.get(key);
  if (!snapshot) {
    const resources = LOCALE_RESOURCES[locale] as Record<string, unknown>;
    snapshot = Object.fromEntries(namespaces.map((namespace) => [namespace, resources[namespace]]));
    resourceSnapshots.set(key, snapshot);
  }
  return snapshot;
}
function selectSourceIndex(namespaces: readonly string[]) {
  const key = namespaces.join(",");
  let snapshot = indexSnapshots.get(key);
  if (!snapshot) {
    snapshot = Object.fromEntries(Object.entries(compactIndex).filter(([, value]) => namespaces.includes(value.split(".")[0])));
    indexSnapshots.set(key, snapshot);
  }
  return snapshot;
}

/** Bootstrap selected namespaces synchronously, including their English fallback and aliases. */
export async function SiteLocaleProvider({ locale, children }: { locale: SiteLocale; children: ReactNode }) {
  const namespaces = ["common", "workbench", "home", "seo"] as const;
  return <ClientLocaleProvider
    locale={locale}
    namespaces={namespaces}
    fallbackResources={selectResources(DEFAULT_SITE_LOCALE, namespaces)}
    resources={locale === DEFAULT_SITE_LOCALE ? undefined : selectResources(locale, namespaces)}
    sourceIndex={selectSourceIndex(namespaces)}
  >{children}</ClientLocaleProvider>;
}
