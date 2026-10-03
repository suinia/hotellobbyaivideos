import Link from "next/link";
import { CreditCard, RefreshCw, ReceiptText } from "lucide-react";
import {
  BILLING_SUPPORT_RESPONSE_SUMMARY, CANCELLATION_SUMMARY, PAYMENT_SUMMARY,
  REFUND_ELIGIBILITY_SUMMARY, SUPPORT_EMAIL, SUPPORT_EMAIL_HREF
} from "@/lib/support/content";
import styles from "./payment-support-summary.module.css";
import { localizeSeoTree } from "@/lib/i18n/seo-localization";
import type { SiteLocale } from "@/lib/i18n/site-locales";

export default function PaymentSupportSummary({ locale = "en" }: { locale?: SiteLocale }) {
  return localizeSeoTree((
    <section className={styles.section} aria-labelledby="payment-support-title">
      <h2 id="payment-support-title">Payments & support</h2>
      <p className={styles.intro}>Clear checkout, renewal, and refund information before you subscribe.</p>
      <div className={styles.grid}>
        <article className={styles.card}>
          <CreditCard size={22} aria-hidden="true" />
          <h3>Checkout with Stripe</h3>
          <p>{PAYMENT_SUMMARY}</p>
          <Link href="/help#payments">Payment & billing help →</Link>
        </article>
        <article className={styles.card}>
          <RefreshCw size={22} aria-hidden="true" />
          <h3>Control future renewals</h3>
          <p>{CANCELLATION_SUMMARY}</p>
          <Link href="/help#subscriptions">How to cancel →</Link>
        </article>
        <article className={styles.card}>
          <ReceiptText size={22} aria-hidden="true" />
          <h3>A clear refund policy</h3>
          <p>{REFUND_ELIGIBILITY_SUMMARY} Requests are reviewed under our policy, including its exclusions.</p>
          <Link href="/refund-policy">Read the Refund Policy →</Link>
        </article>
      </div>
      <div className={styles.support}>
        <div>
          <p className={styles.supportTitle}>Need a hand?</p>
          <p>{BILLING_SUPPORT_RESPONSE_SUMMARY}</p>
        </div>
        <div className={styles.supportLinks}>
          <Link href="/help">Visit Help Center</Link>
          <a href={SUPPORT_EMAIL_HREF}>{SUPPORT_EMAIL}</a>
        </div>
      </div>
    </section>
  ), locale);
}
