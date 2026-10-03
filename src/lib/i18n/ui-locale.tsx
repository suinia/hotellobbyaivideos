"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getLocaleNamespacesForPath } from "./locale-namespaces";
import { cloneElement, createContext, isValidElement, useContext, use, Suspense, type ReactElement, type ReactNode } from "react";
import { localizeSitePath, type SiteLocale } from "./site-locales";
import { translateSeoText } from "./seo-localization";

import { hasLocaleResources, loadLocaleResources, registerLocaleResources, registerSourceIndex } from "@/locales/catalog.generated";

const LocaleContext = createContext<SiteLocale | undefined>(undefined);

function LocaleResourcesReady({ locale, namespaces, children }: { locale: SiteLocale; namespaces: readonly string[]; children: ReactNode }) {
  if (!hasLocaleResources("en", namespaces) || !hasLocaleResources(locale, namespaces)) {
    // Suspense preserves the previous page during a client navigation while its
    // new namespace downloads. Initial hydration is already seeded by the server.
    use(loadLocaleResources(locale, namespaces));
  }
  return children;
}

export function SiteLocaleProvider({ locale, resources, fallbackResources, sourceIndex, namespaces, children }: {
  locale: SiteLocale;
  resources?: Record<string, unknown>;
  fallbackResources?: Record<string, unknown>;
  sourceIndex?: Record<string, string>;
  namespaces?: readonly string[];
  children: ReactNode;
}) {
  if (fallbackResources) registerLocaleResources("en", fallbackResources);
  if (resources) registerLocaleResources(locale, resources);
  if (sourceIndex && namespaces) registerSourceIndex(sourceIndex, namespaces);
  const pathname = usePathname();
  const required = getLocaleNamespacesForPath(pathname ?? "/");
  return <LocaleContext.Provider value={locale}>
    <Suspense fallback={null}>
      <LocaleResourcesReady locale={locale} namespaces={required}>{children}</LocaleResourcesReady>
    </Suspense>
  </LocaleContext.Provider>;
}

/** The standalone launch currently publishes an English product surface. */
export function useUiLocale(): SiteLocale {
  return useContext(LocaleContext) ?? "en";
}

const translatedAttributes = new Set(["label", "title", "alt", "placeholder", "aria-label", "submitLabel", "searchLabel", "heading", "description", "data-tooltip"]);

/** Translate rendered controls without rewriting their data, event handlers or generated content. */
export function localizeUiTree(node: ReactNode, locale: SiteLocale): ReactNode {
  if (locale === "en") return node;
  if (typeof node === "string") return translateSeoText(node, locale);
  if (Array.isArray(node)) return node.map((child) => localizeUiTree(child, locale));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<Record<string, unknown>>;
  if (element.props["data-i18n-skip"]) return node;
  const nativeElement = typeof element.type === "string";
  const preservedProps = new Set(String(element.props["data-i18n-preserve"] ?? "").split(/\s+/).filter(Boolean));
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(element.props)) {
    if (preservedProps.has(key)) continue;
    if (key === "children") {
      props.children = !nativeElement && element.type !== Link && typeof value === "string" ? value : localizeUiTree(value as ReactNode, locale);
    } else if (translatedAttributes.has(key) && typeof value === "string") {
      props[key] = translateSeoText(value, locale);
    } else if (key === "href" && typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
      const match = value.match(/^([^?#]*)(.*)$/);
      props.href = match ? `${localizeSitePath(match[1], locale)}${match[2]}` : value;
    }
  }
  return cloneElement(element, props);
}
