export type GuestSubscriptionPopupExperimentVariant = "signup" | "subscription";

export const GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_KEY = "guest_subscription_popup_experiment_v1";
export const GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_COOKIE = "vismuse_guest_subscription_popup_experiment_v1";
export const DEFAULT_GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_VARIANT: GuestSubscriptionPopupExperimentVariant = "signup";

const SUPPORTED_GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_VARIANTS: GuestSubscriptionPopupExperimentVariant[] = [
  "signup",
  "subscription"
];

export const GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_VARIANTS =
  SUPPORTED_GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_VARIANTS;

export function normalizeGuestSubscriptionPopupExperimentVariant(
  value?: string | null
): GuestSubscriptionPopupExperimentVariant {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "control") return "signup";
  if (normalized === "checkout" || normalized === "paid") return "subscription";
  return SUPPORTED_GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_VARIANTS.includes(
    normalized as GuestSubscriptionPopupExperimentVariant
  )
    ? normalized as GuestSubscriptionPopupExperimentVariant
    : DEFAULT_GUEST_SUBSCRIPTION_POPUP_EXPERIMENT_VARIANT;
}
