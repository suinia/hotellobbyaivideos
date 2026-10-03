import HomeAnnualOffer from "@/components/home-annual-offer";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import MarketingHeaderCreateMenu from "@/components/marketing-header-create-menu";
import MarketingHeaderMobileMenu from "@/components/marketing-header-mobile-menu";
import {
  homepageNavItems,
  resolveHomepageNavItems,
  resolveMarketingCreateMenuItems,
  type MarketingCreateItemId
} from "@/components/marketing-header-data";
import MarketingHomeRedesignAuthAction from "@/components/marketing-home-redesign-auth-action";
import { getHomepageCopy } from "@/lib/i18n/marketing-home";
import type { SiteLocale } from "@/lib/i18n/site-locales";
import { localizeSitePath } from "@/lib/i18n/site-locales";
import SiteLanguageSwitcher from "@/components/site-language-switcher";
import styles from "@/components/marketing-home-redesign.module.css";

type MarketingHeaderProps = {
  activeNavHref?: string;
  createHrefOverrides?: Partial<Record<MarketingCreateItemId, string>>;
  headerAction?: ReactNode;
  homeHref?: string;
  locale?: SiteLocale;
  variant?: "default" | "home";
};

export default function MarketingHeader({
  activeNavHref,
  createHrefOverrides,
  headerAction,
  homeHref = "/",
  locale = "en",
  variant = "default"
}: MarketingHeaderProps) {
  const createMenuItems = resolveMarketingCreateMenuItems(createHrefOverrides, locale);
  const isHomeHeader = variant === "home";
  const localizedHomepageNavItems = isHomeHeader ? resolveHomepageNavItems(locale) : homepageNavItems;
  const localizedNav = getHomepageCopy(locale).nav;
  const defaultNavItems = [
    { label: localizedNav.aiVideo, href: "/ai-video-generator" },
    { label: localizedNav.tools, href: "/tools" },
    { label: localizedNav.templates, href: "/templates" },
    { label: localizedNav.resources, href: "/docs" },
    { label: localizedNav.pricing, href: "/pricing" }
  ];
  const mobileNavItems = (isHomeHeader ? localizedHomepageNavItems : defaultNavItems).map((item) => ({
    ...item,
    href: localizeSitePath(item.href, locale)
  }));
  const homeCopy = getHomepageCopy(locale);

  return (
    <header className={styles.header}>
      {isHomeHeader ? <HomeAnnualOffer locale={locale} /> : null}
      <div className={styles.headerInner}>
        <MarketingHeaderMobileMenu
          createLabel={homeCopy.nav.create}
          createMenuItems={createMenuItems}
          homeHref={localizeSitePath(homeHref, locale)}
          navItems={mobileNavItems}
          signInLabel={homeCopy.nav.signIn}
        />

        <Link
          href={localizeSitePath(homeHref, locale)}
          prefetch={isHomeHeader ? false : undefined}
          className={styles.brand}
          aria-label="Hotel Lobby AI home"
        >
          <Image src="/brand/icon-192.png" alt="" width={34} height={34} priority />
          <span>Hotel Lobby AI</span>
        </Link>

        {isHomeHeader ? (
          <nav className={styles.nav} aria-label="Main navigation">
            {localizedHomepageNavItems.map((item) => (
              <Link
                href={localizeSitePath(item.href, locale)}
                prefetch={false}
                key={item.label}
                aria-current={activeNavHref === item.href ? "page" : undefined}
              >
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        ) : (
          <nav className={styles.nav} aria-label="Main navigation">
            <MarketingHeaderCreateMenu items={createMenuItems} />
            {defaultNavItems.map((item) => (
              <Link
                href={localizeSitePath(item.href, locale)}
                key={item.label}
                aria-current={activeNavHref === item.href ? "page" : undefined}
              >
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        )}

        <div className={styles.headerActions}>
          {!isHomeHeader ? <SiteLanguageSwitcher locale={locale} /> : null}
          {headerAction ?? (
            <MarketingHomeRedesignAuthAction
              className={isHomeHeader ? undefined : styles.loginLink}
              locale={locale}
            />
          )}
        </div>
      </div>
    </header>
  );
}
