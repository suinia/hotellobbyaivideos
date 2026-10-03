"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Gem } from "lucide-react";
import { AppAuthModal } from "@/app/app/_components/app-auth-modal";
import { useAppAccountStore } from "@/app/app/_components/app-account-store";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  openMarketingHomeAuthModal,
  refreshMarketingHomeAccount
} from "@/components/marketing-home-account";
// import DiscordInviteLink from "@/components/discord-invite-link";
import SiteLanguageSwitcher from "@/components/site-language-switcher";
import { getHomepageCopy } from "@/lib/i18n/marketing-home";
import type { SiteLocale } from "@/lib/i18n/site-locales";
import { resolveFrontendBillingPlanName } from "@/lib/billing/plan-display";
import styles from "@/components/marketing-home-redesign.module.css";

const planLabels = {
  free: "Free Trial",
  basic: "Basic",
  pro: "Pro",
  max: "Max"
} as const;

type MarketingHomeRedesignAuthActionProps = {
  className?: string;
  locale?: SiteLocale;
};

export default function MarketingHomeRedesignAuthAction({ className, locale = "en" }: MarketingHomeRedesignAuthActionProps = {}) {
  const account = useAppAccountStore((state) => state.account);
  const accountReady = useAppAccountStore((state) => state.isReady);

  useEffect(() => {
    const syncAccount = (force = false) => {
      void refreshMarketingHomeAccount({ force });
    };

    syncAccount();
    const supabase = getSupabaseBrowserClient();
    const authSubscription = supabase?.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        const sessionUserId = session?.user?.id ?? "";
        const currentState = useAppAccountStore.getState();
        if (
          sessionUserId
          && currentState.isReady
          && currentState.account.authMode === "supabase"
          && currentState.account.id === sessionUserId
        ) {
          return;
        }
        window.setTimeout(() => syncAccount(true), 0);
        return;
      }

      if (event === "SIGNED_OUT") {
        const currentState = useAppAccountStore.getState();
        if (currentState.isReady && currentState.account.authMode !== "supabase") return;
        window.setTimeout(() => syncAccount(true), 0);
        return;
      }

      if (event === "USER_UPDATED") {
        window.setTimeout(() => syncAccount(true), 0);
      }
    }).data.subscription;

    return () => {
      authSubscription?.unsubscribe();
    };
  }, []);

  if (className && !(accountReady && account.isLoggedIn)) {
    return (
      <>
        <button type="button" className={className} onClick={openMarketingHomeAuthModal}>
          {getHomepageCopy(locale).nav.signIn}
        </button>
        <AppAuthModal />
      </>
    );
  }

  const accountPlanLabel = resolveFrontendBillingPlanName(
    account.pricingVariant,
    account.plan,
    planLabels[account.plan]
  );
  const copy = getHomepageCopy(locale);

  return (
    <>
      {accountReady && account.isLoggedIn ? (
        <div className={styles.signedInHeaderActions}>
          {!className ? <SiteLanguageSwitcher locale={locale} /> : null}
          {/* Homepage Discord entry is intentionally hidden on desktop and mobile.
          <DiscordInviteLink
            className={styles.homeDiscordLink}
            entry="marketing_home_signed_in"
          /> */}
          <div className={styles.accountSummaryPill} aria-label={`${account.credits} credits, ${accountPlanLabel} plan`}>
            <span className={styles.accountCredits}>
              <Gem size={16} strokeWidth={2.2} aria-hidden="true" />
              <strong>{Math.max(0, Math.floor(account.credits)).toLocaleString()}</strong>
            </span>
            <span className={styles.accountDivider} aria-hidden="true" />
            <span className={styles.accountPlan}>{accountPlanLabel}</span>
          </div>
          <Link
            href="/app/recents"
            prefetch={false}
            className={styles.accountAvatar}
            aria-label={`Open ${account.displayName}'s recent creations`}
            title={account.displayName}
          >
            {account.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.avatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span>{account.initial}</span>
            )}
          </Link>
        </div>
      ) : (
        <div className={styles.signedOutHeaderActions}>
          <SiteLanguageSwitcher locale={locale} />
          {/* Homepage Discord entry is intentionally hidden on desktop and mobile.
          <DiscordInviteLink
            className={styles.homeDiscordLink}
            entry="marketing_home_signed_out"
          /> */}
          <button type="button" className={styles.freeTrialButton} onClick={openMarketingHomeAuthModal}>
            {copy.nav.signIn}
          </button>
        </div>
      )}
      <AppAuthModal />
    </>
  );
}
