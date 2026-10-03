"use client";

import { Check, ChevronDown, Globe2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_SITE_LOCALE,
  SITE_LOCALE_COOKIE,
  SITE_LOCALE_COOKIE_MAX_AGE,
  SITE_LOCALE_OPTIONS,
  getIndexableSiteLocaleOptions,
  isSiteLocale,
  localizeSitePath,
  type SiteLocale
} from "@/lib/i18n/site-locales";
import { useUiLocale } from "@/lib/i18n/ui-locale";
import { translateSeoText } from "@/lib/i18n/seo-localization";
import { t } from "@/lib/i18n/catalog";
import styles from "@/components/site-language-switcher.module.css";

type SiteLanguageSwitcherProps = {
  locale?: SiteLocale;
  variant?: "marketing" | "app-sidebar" | "app-mobile";
};

function readStoredLocale(): SiteLocale {
  if (typeof document === "undefined") return DEFAULT_SITE_LOCALE;
  const value = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SITE_LOCALE_COOKIE}=`))
    ?.slice(SITE_LOCALE_COOKIE.length + 1);
  return isSiteLocale(value) ? value : DEFAULT_SITE_LOCALE;
}

function persistSiteLocale(locale: SiteLocale) {
  document.cookie = `${SITE_LOCALE_COOKIE}=${locale}; path=/; max-age=${SITE_LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}

function applyDocumentLocale(locale: SiteLocale) {
  const htmlLang = SITE_LOCALE_OPTIONS.find((option) => option.locale === locale)?.htmlLang ?? "en-US";
  document.documentElement.setAttribute("lang", htmlLang);
}

export default function SiteLanguageSwitcher({
  locale,
  variant = "marketing"
}: SiteLanguageSwitcherProps) {
  const pathname = usePathname();
  const requestLocale = useUiLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState<SiteLocale>(locale ?? requestLocale);
  const availableOptions = getIndexableSiteLocaleOptions(pathname);

  useEffect(() => {
    if (locale) {
      persistSiteLocale(locale);
      applyDocumentLocale(locale);
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const storedLocale = readStoredLocale();
      const supportedLocale = getIndexableSiteLocaleOptions(pathname).some((option) => option.locale === storedLocale)
        ? storedLocale
        : DEFAULT_SITE_LOCALE;
      setSelectedLocale(supportedLocale);
      applyDocumentLocale(supportedLocale);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [locale, pathname]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const requestedLocale = locale ?? selectedLocale;
  const selectedOption = availableOptions.find((option) => option.locale === requestedLocale)
    ?? availableOptions[0];
  const activeLocale = selectedOption.locale;
  const variantClass = variant === "app-sidebar"
    ? styles.sidebar
    : variant === "app-mobile"
      ? styles.mobile
      : styles.marketing;

  function selectLocale(nextLocale: SiteLocale) {
    persistSiteLocale(nextLocale);
    setSelectedLocale(nextLocale);
    setOpen(false);

    if (!pathname.startsWith("/app")) {
      const destination = `${localizeSitePath(pathname, nextLocale)}${window.location.search}${window.location.hash}`;
      window.location.assign(destination);
      return;
    }
    window.location.reload();
  }

  if (availableOptions.length <= 1) return null;

  return (
    <div ref={rootRef} className={`${styles.root} ${variantClass}`} data-open={open ? "true" : "false"}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={t(activeLocale, "common.language.selected", { name: selectedOption.label })}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Globe2 size={17} strokeWidth={2} aria-hidden="true" />
        <span className={styles.triggerLabel}>{selectedOption.label}</span>
        <ChevronDown className={styles.chevron} size={13} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {open ? (
        <div className={styles.menu} role="menu" aria-label={translateSeoText("Choose language", activeLocale)}>
          {availableOptions.map((option) => (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={option.locale === activeLocale}
              className={`${styles.option} ${option.locale === activeLocale ? styles.active : ""}`}
              key={option.locale}
              lang={option.htmlLang}
              onClick={() => selectLocale(option.locale)}
            >
              <span>{option.label}</span>
              {option.locale === activeLocale ? <Check size={15} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
