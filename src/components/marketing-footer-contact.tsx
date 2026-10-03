import { SUPPORT_EMAIL_HREF } from "@/lib/support/content";
import { t } from "@/lib/i18n/catalog";
import type { SiteLocale } from "@/lib/i18n/site-locales";
import styles from "@/components/marketing-footer.module.css";

type MarketingFooterContactProps = { label?: string; locale?: SiteLocale };

export default function MarketingFooterContact({ label, locale = "en" }: MarketingFooterContactProps) {
  return <a href={SUPPORT_EMAIL_HREF} className={styles.linkButton}>{label ?? t(locale, "common.support.contact")}</a>;
}
