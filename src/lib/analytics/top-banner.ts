import { captureAnalyticsEvent } from "./posthog";

type TopBannerInteraction = {
  action: "claim" | "video" | "close";
  banner: "annual_offer" | "video";
  surface: "homepage" | "workbench";
  accountPlan: string;
  isLoggedIn: boolean;
  pricingVariant?: string;
  locale: string;
};

const eventNames = {
  claim: "top_banner_claim_clicked",
  video: "top_banner_video_clicked",
  close: "top_banner_closed"
} as const;

export function trackTopBannerInteraction(context: TopBannerInteraction): void {
  captureAnalyticsEvent(eventNames[context.action], {
    action: context.action,
    banner_type: context.banner,
    surface: context.surface,
    account_plan: context.accountPlan,
    is_logged_in: context.isLoggedIn,
    pricing_variant: context.pricingVariant,
    locale: context.locale,
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
    ...(context.action === "claim" ? { billing_interval: "year" } : {}),
    ...(context.action === "video" ? { destination: "/ai-video-generator" } : {})
  });
}
