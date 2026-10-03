import { t } from "./catalog";
import type { SiteLocale } from "./site-locales";

export type AnnualOfferMessageParts = {
  before: string;
  discount: string;
  after: string;
};

/** Translate the annual-offer copy while keeping the percentage separately styled. */
export function getAnnualOfferMessageParts(
  locale: SiteLocale,
  saveLabel?: string
): AnnualOfferMessageParts {
  const percent = saveLabel?.match(/\d+/)?.[0] ?? "50";
  const messageKey = saveLabel?.includes("up to")
    ? "workbench.annualOffer.saveUpTo"
    : "workbench.annualOffer.save";
  const message = t(locale, messageKey, { percent });
  const match = message.match(new RegExp(`${percent}\\s*%`));

  if (!match || match.index === undefined) {
    return { before: message, discount: "", after: "" };
  }

  const start = match.index;
  const end = start + match[0].length;
  return {
    before: message.slice(0, start),
    discount: message.slice(start, end),
    after: message.slice(end)
  };
}
