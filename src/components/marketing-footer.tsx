
import { getLocaleResource } from "@/lib/i18n/catalog";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { ChevronDown, Globe2, Mail } from "lucide-react";
import MarketingFooterContact from "@/components/marketing-footer-contact";
import { getIndexableSiteLocaleOptions, getSiteLocaleOption, isLocaleNeutralSitePath, localizeSitePath, type SiteLocale } from "@/lib/i18n/site-locales";
import { translateSeoText } from "@/lib/i18n/seo-localization";
import { SUPPORT_EMAIL_HREF } from "@/lib/support/content";
import styles from "@/components/marketing-footer.module.css";

const footerPrimaryLinks = [
  { href: "/tools", label: "Tools" },
  { href: "/tools/album-cover-generator", label: "Album Cover Maker" },
  { href: "/templates", label: "Templates" },
  { href: "/docs", label: "Docs" },
  { href: "/help", label: "Help Center" },
  { href: "/pricing", label: "Pricing" },
  { href: "/what-is-vismuse", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/refund-policy", label: "Refund Policy" }
] as const;

const footerColumns = [
  {
    title: "Product",
    links: [
      { href: "/tools/ai-image-maker", label: "AI Image Generator" },
      { href: "/ai-video-generator", label: "AI Video Generator" },
      { href: "/tools/ai-image-to-video", label: "AI Image to Video Generator" },
      { href: "/ai-animation-generator", label: "AI Animation Generator" },
      { href: "/tools/album-cover-generator", label: "Album Cover Maker" },
      { href: "/tools/ai-product-ad-image-generator", label: "Product Ad Maker" },
      { href: "/tools/ai-flyer-generator", label: "AI Flyer Maker" }
    ]
  },
  {
    title: "Templates",
    links: [
      { href: "/templates", label: "All Templates" },
      { href: "/templates/flyers", label: "Flyer Templates" },
      { href: "/templates/album-covers", label: "Album Covers" }
    ]
  },
  {
    title: "Resources",
    links: [
      { href: "/help", label: "Help Center" },
      { href: "/docs", label: "Docs" },
      { href: "/tools", label: "Tools" },
      { href: "/pricing", label: "Pricing" }
    ]
  },
  {
    title: "Company",
    links: [
      { href: SUPPORT_EMAIL_HREF, label: "Contact support" },
      { href: "/what-is-vismuse", label: "About Vismuse" },
      { href: "/acceptable-use", label: "Acceptable Use" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/refund-policy", label: "Refund Policy" },
      { href: "/cookies", label: "Cookies" }
    ]
  }
] as const;

function SellWithBoostBadge() {
  return (
    <a
      className={styles.boostBadge}
      href="https://sellwithboost.com"
      target="_blank"
      rel="nofollow noopener noreferrer"
    >
      <img
        src="https://sellwithboost.com/badge/listing.svg"
        loading="lazy"
        decoding="async"
        alt="Listed on Sell With boost"
        width="160"
        height="40"
        style={{ height: "40px", width: "auto" }}
      />
    </a>
  );
}

function FindlyToolsBadge() {
  return (
    <a
      href="https://findly.tools/vismuse?utm_source=vismuse"
      target="_blank"
      rel="nofollow noopener noreferrer"
    >
      <img
        src="https://findly.tools/badges/findly-tools-badge-light.svg"
        loading="lazy"
        decoding="async"
        alt="Featured on Findly.tools"
        width="175"
        height="55"
      />
    </a>
  );
}

function StartupFameBadge() {
  return (
    <a
      className={styles.startupFameBadge}
      href="https://startupfa.me/s/vismuse?utm_source=vismuse.com"
      target="_blank"
      rel="nofollow noopener noreferrer"
    >
      <img
        src="https://startupfa.me/badges/featured-badge-small.webp"
        loading="lazy"
        decoding="async"
        alt="Vismuse - Featured on Startup Fame"
        width="224"
        height="36"
      />
    </a>
  );
}

function AIBestTopBadge() {
  return (
    <a href="https://aibesttop.com" target="_blank" rel="nofollow noopener noreferrer">
      <img
        src="https://aibesttop.com/badges/light.svg"
        loading="lazy"
        decoding="async"
        alt="Listed on AIBestTop"
        width="120"
        height="40"
      />
    </a>
  );
}

function StartupFastBadge() {
  return (
    <a
      href="https://startupfa.st"
      target="_blank"
      rel="nofollow noopener noreferrer"
      title="Powered by Startup Fast"
    >
      <img
        src="https://startupfa.st/images/badges/powered-by-light.svg"
        loading="lazy"
        decoding="async"
        alt="Powered by Startup Fast"
        width="150"
        height="44"
        style={{ width: "150px", height: "44px" }}
      />
    </a>
  );
}

function AlternBadge() {
  return (
    <a href="https://altern.ai/ai/vismuse" target="_blank" rel="nofollow noopener noreferrer">
      <img
        src="https://data.altern.ai/alternbadge.png"
        loading="lazy"
        decoding="async"
        alt="Featured on Altern"
        width="150"
        height="32"
        style={{ width: "150px", height: "32px" }}
      />
    </a>
  );
}

function PublishYourSaasBadge() {
  return (
    <a
      className={styles.publishYourSaasBadge}
      href="https://publishyoursaas.com/listing/vismuse-com"
      target="_blank"
      rel="noopener noreferrer"
      data-publishyoursaas-badge="vismuse-com"
    >
      <img
        src="https://publishyoursaas.com/publishyoursaas-badge.svg"
        loading="lazy"
        decoding="async"
        alt="AI Image & Video Generator — Create Through Chat | Vismuse is listed on publishyoursaas"
        width="160"
        height="40"
      />
    </a>
  );
}

export function FeaturedListingBadges() {
  return (
    <div className={styles.footerBadges} aria-label="External listings">
      <SellWithBoostBadge />
      <FindlyToolsBadge />
      <StartupFameBadge />
      <TwelveToolsBadge />
      <AIBestTopBadge />
      <StartupFastBadge />
      <AlternBadge />
      <PublishYourSaasBadge />
    </div>
  );
}

function SaaSHubBadge() {
  return (
    <a
      className={styles.saashubBadge}
      href="https://www.saashub.com/vismuse?utm_source=badge&utm_campaign=badge&utm_content=vismuse&badge_variant=color&badge_kind=approved"
      target="_blank"
      rel="nofollow noopener noreferrer"
    >
      <img
        src="https://cdn-b.saashub.com/img/badges/approved-color.png?v=1"
        loading="lazy"
        decoding="async"
        alt="Vismuse badge"
        width="300"
        height="100"
        style={{ maxWidth: "150px" }}
      />
    </a>
  );
}

function ThereIsAnAiForThatBadge() {
  return (
    <a
      className={styles.taaftBadge}
      href="https://theresanaiforthat.com/ai/vismuse/?ref=featured&v=10588062"
      target="_blank"
      rel="nofollow noopener noreferrer"
    >
      <img
        src="https://media.theresanaiforthat.com/featured-on-taaft.png?width=600"
        loading="lazy"
        decoding="async"
        alt="Featured on There’s An AI For That"
        width="599"
        height="125"
      />
    </a>
  );
}

function DangBadge() {
  return (
    <a
      className={styles.dangBadge}
      href="https://dang.ai"
      target="_blank"
      rel="nofollow noopener noreferrer"
    >
      <img
        src="https://assets.dang.ai/badges/dang-verified-light.png"
        loading="lazy"
        decoding="async"
        alt="Verified on DANG!"
        width="260"
        height="94"
      />
    </a>
  );
}

function IaInsightsBadge() {
  return (
    <a
      className={styles.iaInsightsBadge}
      href="https://www.ia-insights.fr/"
      target="_blank"
      rel="nofollow noopener noreferrer"
    >
      <span className={styles.iaInsightsMark}>IA</span>
      <span>
        Listé sur <strong>IA-Insights</strong>
      </span>
    </a>
  );
}

function BuildlistBadge() {
  return (
    <a
      className={styles.buildlistBadge}
      href="https://buildlist.io"
      target="_blank"
      rel="nofollow noopener noreferrer"
    >
      <img
        src="https://buildlist.io/badge.svg"
        loading="lazy"
        decoding="async"
        alt="Featured on Buildlist"
        width="160"
        height="40"
        style={{ height: "40px", width: "auto" }}
      />
    </a>
  );
}

function StartupInspireBadge() {
  return (
    <a
      href="https://www.startupinspire.com"
      target="_blank"
      rel="nofollow noopener noreferrer"
    >
      <img
        src="https://www.startupinspire.com/images/badge_1.svg"
        loading="lazy"
        decoding="async"
        alt="Featured on Startup Inspire"
        width="149"
        height="43"
      />
    </a>
  );
}

function TwelveToolsBadge() {
  return (
    <a
      href="https://twelve.tools"
      target="_blank"
      rel="nofollow noopener noreferrer"
    >
      <img
        src="https://twelve.tools/badge0-white.svg"
        loading="lazy"
        decoding="async"
        alt="Featured on Twelve Tools"
        width="148"
        height="40"
      />
    </a>
  );
}

function WiredBusinessBadge() {
  return (
    <a
      href="https://wired.business"
      target="_blank"
      rel="nofollow noopener noreferrer"
    >
      <img
        src="https://wired.business/badge1-white.svg"
        loading="lazy"
        decoding="async"
        alt="Featured on Wired Business"
        width="200"
        height="54"
      />
    </a>
  );
}

type MarketingFooterProps = {
  locale?: SiteLocale;
  variant?: "default" | "home";
  showBuildlistBadge?: boolean;
  showListingBadges?: boolean;
};

function FooterLanguageLinks({ locale, pathname }: { locale: SiteLocale; pathname: string }) {
  const options = getIndexableSiteLocaleOptions(pathname);
  if (options.length <= 1) return null;
  return (
    <nav
      className={styles.languageLinks}
      aria-label={translateSeoText("Choose language", locale)}
      data-i18n-skip
    >
      {options.map((option) => (
        <a
          key={option.locale}
          href={localizeSitePath(pathname, option.locale)}
          hrefLang={option.htmlLang}
          lang={option.htmlLang}
          aria-current={option.locale === locale ? "page" : undefined}
        >
          {option.label}
        </a>
      ))}
    </nav>
  );
}

function FooterLanguageMenu({ locale, pathname }: { locale: SiteLocale; pathname: string }) {
  if (getIndexableSiteLocaleOptions(pathname).length <= 1) return null;
  return (
    <details className={styles.footerLanguageMenu}>
      <summary>
        <Globe2 size={16} aria-hidden="true" />
        <span>{getSiteLocaleOption(locale).label}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </summary>
      <FooterLanguageLinks locale={locale} pathname={pathname} />
    </details>
  );
}

export default async function MarketingFooter({
  locale = "en",
  variant = "default",
  showBuildlistBadge = false,
  showListingBadges = false
}: MarketingFooterProps) {
  const year = new Date().getFullYear();
  const pathname = (await headers()).get("x-vismuse-pathname") ?? "/";
  const languagePathname = isLocaleNeutralSitePath(pathname) ? "/" : pathname;
  const copy = getLocaleResource<{ tagline: string; rights: string; columns: string[]; labels: Record<string, string> }>(locale, "common", "marketingFooter");
  const localizedLabel = (label: string) => copy.labels[label] ?? label;

  if (variant !== "home") {
    return (
      <footer className={styles.footer}>
        <div className={styles.defaultInner}>
          <span className={styles.defaultBrand}>Copyright © {year} vismuse.com</span>
          <nav className={styles.links} aria-label="Footer">
            <MarketingFooterContact locale={locale} />
            {footerPrimaryLinks.map((link) => (
              <Link key={link.href} href={localizeSitePath(link.href, locale)} prefetch={false}>
                {localizedLabel(link.label)}
              </Link>
            ))}
          </nav>
          <FooterLanguageLinks locale={locale} pathname={languagePathname} />
          {showListingBadges ? (
            <div className={styles.listingBadges}>
              <SellWithBoostBadge />
              <ThereIsAnAiForThatBadge />
              <DangBadge />
              <IaInsightsBadge />
              <StartupInspireBadge />
              <TwelveToolsBadge />
              <WiredBusinessBadge />
              {showBuildlistBadge ? <BuildlistBadge /> : null}
            </div>
          ) : null}
        </div>
      </footer>
    );
  }

  return (
    <footer className={`${styles.footer} ${styles.homeFooter}`}>
      <div className={styles.inner}>
        <div className={styles.brandBlock}>
          <Link href={localizeSitePath("/", locale)} prefetch={false} className={styles.brand} aria-label="Hotel Lobby AI home">
            <Image src="/brand/icon-192.png" alt="" width={34} height={34} />
            <span>Hotel Lobby AI</span>
          </Link>
          <p className={styles.tagline}>
            {copy.tagline}
          </p>
        </div>

        <nav className={styles.footerNav} aria-label="Footer">
          {footerColumns.map((column, columnIndex) => (
            <section key={column.title} className={styles.footerColumn}>
              <h2>{copy.columns[columnIndex]}</h2>
              <div className={styles.footerColumnLinks}>
                {column.links.map((link) => (
                  <Link
                    key={`${column.title}-${link.label}`}
                    href={localizeSitePath(link.href, locale)}
                    prefetch={false}
                    className={link.href === SUPPORT_EMAIL_HREF ? styles.contactLink : undefined}
                  >
                    {link.href === SUPPORT_EMAIL_HREF ? <Mail size={16} aria-hidden="true" /> : null}
                    {localizedLabel(link.label)}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </nav>
      </div>
      <div className={styles.homeFooterBottom}>
        <span>© {year} Vismuse. {copy.rights}</span>
        {showListingBadges ? (
          <div className={styles.footerBadges} aria-label="External listings">
            <SellWithBoostBadge />
            <FindlyToolsBadge />
            <SaaSHubBadge />
            <ThereIsAnAiForThatBadge />
            <DangBadge />
            <IaInsightsBadge />
            <StartupInspireBadge />
            <TwelveToolsBadge />
            <WiredBusinessBadge />
            <a className={styles.listingTextLink} href="https://mossai.org" rel="nofollow" title="MossAI Tools">MossAI Tools</a>
            <AIBestTopBadge />
            <StartupFastBadge />
            <AlternBadge />
            <PublishYourSaasBadge />
            {showBuildlistBadge ? <BuildlistBadge /> : null}
          </div>
        ) : null}
        <FooterLanguageMenu locale={locale} pathname={languagePathname} />
      </div>
    </footer>
  );
}
