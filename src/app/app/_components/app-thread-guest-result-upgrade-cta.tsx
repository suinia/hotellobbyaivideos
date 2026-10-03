"use client";

import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";
import {
  guestGeneratedBlurredImageSignupCta,
  guestGeneratedImageSignupCta
} from "./app-cta-copy";

type AppThreadGuestResultUpgradeCtaProps = {
  variant: "watermarked" | "blurred";
  className?: string;
  copyClassName?: string;
  actionsClassName?: string;
  onAction: () => void;
};

export function AppThreadGuestResultUpgradeCta({
  variant,
  className,
  copyClassName,
  actionsClassName,
  onAction
}: AppThreadGuestResultUpgradeCtaProps) {
  const uiLocale = useUiLocale();
  const copy = variant === "blurred"
    ? guestGeneratedBlurredImageSignupCta
    : guestGeneratedImageSignupCta;

  return localizeUiTree((
    <div className={className}>
      <div key="copy" className={copyClassName}>
        <strong key="title">{copy.inlineTitle}</strong>
        <p key="description">{copy.inlineCopy}</p>
      </div>
      <div key="actions" className={actionsClassName}>
        <button key="primary-action" type="button" onClick={onAction}>
          {copy.primaryAction}
        </button>
      </div>
    </div>
  ), uiLocale);
}
