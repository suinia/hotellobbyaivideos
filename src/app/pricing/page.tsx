import { Suspense } from "react";
import { publicPageMetadata } from "@/lib/page-metadata";
import { headers } from "next/headers";
import PricingPage from "@/components/pricing-page";
import { DEFAULT_PRICING_VARIANT } from "@/lib/billing/catalog";
import { resolveBillingContext } from "@/lib/billing/market";

const PRICING_TITLE = "Hotel Lobby AI Pricing | Video Plans & Credits";
const PRICING_DESCRIPTION =
  "Compare Hotel Lobby AI monthly and annual plans. Explore video generation credits, shared Vismuse billing, and plan features.";

export const metadata = publicPageMetadata("/pricing", PRICING_TITLE, PRICING_DESCRIPTION);

export default async function Page() {
  const requestHeaders = await headers();
  const billingContext = resolveBillingContext({
    headers: requestHeaders,
    assignedPricingVariant: DEFAULT_PRICING_VARIANT
  });

  return (
    <Suspense>
      <PricingPage initialBillingContext={billingContext} />
    </Suspense>
  );
}
