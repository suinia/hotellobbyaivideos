export function resolveFrontendBillingPlanName(
  pricingVariant: string | null | undefined,
  checkoutPlan: string | null | undefined,
  fallbackName: string
): string {
  return pricingVariant === "2.4" && checkoutPlan === "basic" ? "Starter" : fallbackName;
}

export function resolveFrontendBillingPlanCta(
  pricingVariant: string | null | undefined,
  checkoutPlan: string | null | undefined,
  interval: "month" | "year" | undefined,
  fallbackCta: string
): string {
  if (pricingVariant !== "2.4" || checkoutPlan !== "basic") return fallbackCta;
  return interval === "year" ? "Get Starter annual" : "Get Starter";
}
