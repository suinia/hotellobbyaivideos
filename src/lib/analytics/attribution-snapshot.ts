export type AttributionSnapshot = {
  source?: string;
  creative?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  googleAdsKeyword?: string;
  googleAdsMatchType?: string;
  googleAdsNetwork?: string;
  googleAdsDevice?: string;
  googleAdsCampaignId?: string;
  googleAdsAdGroupId?: string;
  googleAdsCreativeId?: string;
  content?: string;
  gclid?: string;
  landingPath?: string;
  landingUrl?: string;
  referrer?: string;
  referralSource?: string;
  referralInviterEmail?: string;
  referralCampaign?: string;
  firstTouchSource?: string;
  firstTouchCreative?: string;
  firstTouchMedium?: string;
  firstTouchCampaign?: string;
  firstTouchTerm?: string;
  firstTouchGoogleAdsKeyword?: string;
  firstTouchGoogleAdsMatchType?: string;
  firstTouchGoogleAdsNetwork?: string;
  firstTouchGoogleAdsDevice?: string;
  firstTouchGoogleAdsCampaignId?: string;
  firstTouchGoogleAdsAdGroupId?: string;
  firstTouchGoogleAdsCreativeId?: string;
  firstTouchContent?: string;
  firstTouchGclid?: string;
  firstTouchLandingPath?: string;
  firstTouchLandingUrl?: string;
  firstTouchReferrer?: string;
  firstTouchReferralSource?: string;
  firstTouchReferralInviterEmail?: string;
  firstTouchReferralCampaign?: string;
};

type AttributionInput = Record<string, unknown>;

const ATTRIBUTION_KEYS: Array<{
  canonical: keyof AttributionSnapshot;
  aliases: string[];
}> = [
  { canonical: "source", aliases: ["source", "utm_source"] },
  { canonical: "creative", aliases: ["creative"] },
  { canonical: "medium", aliases: ["medium", "utm_medium"] },
  { canonical: "campaign", aliases: ["campaign", "utm_campaign"] },
  { canonical: "term", aliases: ["term", "utm_term"] },
  { canonical: "googleAdsKeyword", aliases: ["googleAdsKeyword", "google_ads_keyword"] },
  { canonical: "googleAdsMatchType", aliases: ["googleAdsMatchType", "google_ads_match_type"] },
  { canonical: "googleAdsNetwork", aliases: ["googleAdsNetwork", "google_ads_network"] },
  { canonical: "googleAdsDevice", aliases: ["googleAdsDevice", "google_ads_device"] },
  { canonical: "googleAdsCampaignId", aliases: ["googleAdsCampaignId", "google_ads_campaign_id"] },
  { canonical: "googleAdsAdGroupId", aliases: ["googleAdsAdGroupId", "google_ads_ad_group_id"] },
  { canonical: "googleAdsCreativeId", aliases: ["googleAdsCreativeId", "google_ads_creative_id"] },
  { canonical: "content", aliases: ["content", "utm_content"] },
  { canonical: "gclid", aliases: ["gclid"] },
  { canonical: "landingPath", aliases: ["landingPath", "landing_path"] },
  { canonical: "landingUrl", aliases: ["landingUrl", "landing_url"] },
  { canonical: "referrer", aliases: ["referrer", "referrer_url"] },
  { canonical: "referralSource", aliases: ["referralSource", "referral_source"] },
  { canonical: "referralInviterEmail", aliases: ["referralInviterEmail", "referral_inviter_email", "referrer_email", "inviter_email", "utm_inviter"] },
  { canonical: "referralCampaign", aliases: ["referralCampaign", "referral_campaign"] },
  { canonical: "firstTouchSource", aliases: ["firstTouchSource", "first_touch_source", "first_touch_utm_source"] },
  { canonical: "firstTouchCreative", aliases: ["firstTouchCreative", "first_touch_creative"] },
  { canonical: "firstTouchMedium", aliases: ["firstTouchMedium", "first_touch_medium", "first_touch_utm_medium"] },
  { canonical: "firstTouchCampaign", aliases: ["firstTouchCampaign", "first_touch_campaign", "first_touch_utm_campaign"] },
  { canonical: "firstTouchTerm", aliases: ["firstTouchTerm", "first_touch_term", "first_touch_utm_term"] },
  { canonical: "firstTouchGoogleAdsKeyword", aliases: ["firstTouchGoogleAdsKeyword", "first_touch_google_ads_keyword"] },
  { canonical: "firstTouchGoogleAdsMatchType", aliases: ["firstTouchGoogleAdsMatchType", "first_touch_google_ads_match_type"] },
  { canonical: "firstTouchGoogleAdsNetwork", aliases: ["firstTouchGoogleAdsNetwork", "first_touch_google_ads_network"] },
  { canonical: "firstTouchGoogleAdsDevice", aliases: ["firstTouchGoogleAdsDevice", "first_touch_google_ads_device"] },
  { canonical: "firstTouchGoogleAdsCampaignId", aliases: ["firstTouchGoogleAdsCampaignId", "first_touch_google_ads_campaign_id"] },
  { canonical: "firstTouchGoogleAdsAdGroupId", aliases: ["firstTouchGoogleAdsAdGroupId", "first_touch_google_ads_ad_group_id"] },
  { canonical: "firstTouchGoogleAdsCreativeId", aliases: ["firstTouchGoogleAdsCreativeId", "first_touch_google_ads_creative_id"] },
  { canonical: "firstTouchContent", aliases: ["firstTouchContent", "first_touch_content", "first_touch_utm_content"] },
  { canonical: "firstTouchGclid", aliases: ["firstTouchGclid", "first_touch_gclid"] },
  { canonical: "firstTouchLandingPath", aliases: ["firstTouchLandingPath", "first_touch_landing_path"] },
  { canonical: "firstTouchLandingUrl", aliases: ["firstTouchLandingUrl", "first_touch_landing_url"] },
  { canonical: "firstTouchReferrer", aliases: ["firstTouchReferrer", "first_touch_referrer_url"] },
  { canonical: "firstTouchReferralSource", aliases: ["firstTouchReferralSource", "first_touch_referral_source"] },
  { canonical: "firstTouchReferralInviterEmail", aliases: ["firstTouchReferralInviterEmail", "first_touch_referral_inviter_email"] },
  { canonical: "firstTouchReferralCampaign", aliases: ["firstTouchReferralCampaign", "first_touch_referral_campaign"] }
];

function isAttributionInput(value: unknown): value is AttributionInput {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(input: AttributionInput, aliases: string[]): string | undefined {
  for (const alias of aliases) {
    const value = input[alias];
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (normalized) return normalized;
  }

  return undefined;
}

export function normalizeAttributionSnapshot(value: unknown): AttributionSnapshot | undefined {
  if (!isAttributionInput(value)) return undefined;

  const snapshot: AttributionSnapshot = {};
  for (const item of ATTRIBUTION_KEYS) {
    const valueForKey = readString(value, item.aliases);
    if (valueForKey) {
      snapshot[item.canonical] = valueForKey;
    }
  }

  return Object.keys(snapshot).length > 0 ? snapshot : undefined;
}

export function buildAttributionEventProperties(value: unknown): Record<string, string> {
  const attribution = normalizeAttributionSnapshot(value);
  if (!attribution) return {};

  return {
    ...(attribution.source ? { source: attribution.source, utm_source: attribution.source } : {}),
    ...(attribution.creative ? { creative: attribution.creative } : {}),
    ...(attribution.medium ? { utm_medium: attribution.medium } : {}),
    ...(attribution.campaign ? { utm_campaign: attribution.campaign } : {}),
    ...(attribution.term ? { utm_term: attribution.term } : {}),
    ...(attribution.googleAdsKeyword ? { google_ads_keyword: attribution.googleAdsKeyword } : {}),
    ...(attribution.googleAdsMatchType ? { google_ads_match_type: attribution.googleAdsMatchType } : {}),
    ...(attribution.googleAdsNetwork ? { google_ads_network: attribution.googleAdsNetwork } : {}),
    ...(attribution.googleAdsDevice ? { google_ads_device: attribution.googleAdsDevice } : {}),
    ...(attribution.googleAdsCampaignId ? { google_ads_campaign_id: attribution.googleAdsCampaignId } : {}),
    ...(attribution.googleAdsAdGroupId ? { google_ads_ad_group_id: attribution.googleAdsAdGroupId } : {}),
    ...(attribution.googleAdsCreativeId ? { google_ads_creative_id: attribution.googleAdsCreativeId } : {}),
    ...(attribution.content ? { utm_content: attribution.content } : {}),
    ...(attribution.gclid ? { gclid: attribution.gclid } : {}),
    ...(attribution.landingPath ? { landing_path: attribution.landingPath } : {}),
    ...(attribution.landingUrl ? { landing_url: attribution.landingUrl } : {}),
    ...(attribution.referrer ? { referrer_url: attribution.referrer } : {}),
    ...(attribution.referralSource ? { referral_source: attribution.referralSource } : {}),
    ...(attribution.referralInviterEmail ? { referral_inviter_email: attribution.referralInviterEmail } : {}),
    ...(attribution.referralCampaign ? { referral_campaign: attribution.referralCampaign } : {}),
    ...(attribution.firstTouchSource ? { first_touch_source: attribution.firstTouchSource } : {}),
    ...(attribution.firstTouchCreative ? { first_touch_creative: attribution.firstTouchCreative } : {}),
    ...(attribution.firstTouchMedium ? { first_touch_medium: attribution.firstTouchMedium } : {}),
    ...(attribution.firstTouchCampaign ? { first_touch_campaign: attribution.firstTouchCampaign } : {}),
    ...(attribution.firstTouchTerm ? { first_touch_term: attribution.firstTouchTerm } : {}),
    ...(attribution.firstTouchGoogleAdsKeyword ? { first_touch_google_ads_keyword: attribution.firstTouchGoogleAdsKeyword } : {}),
    ...(attribution.firstTouchGoogleAdsMatchType ? { first_touch_google_ads_match_type: attribution.firstTouchGoogleAdsMatchType } : {}),
    ...(attribution.firstTouchGoogleAdsNetwork ? { first_touch_google_ads_network: attribution.firstTouchGoogleAdsNetwork } : {}),
    ...(attribution.firstTouchGoogleAdsDevice ? { first_touch_google_ads_device: attribution.firstTouchGoogleAdsDevice } : {}),
    ...(attribution.firstTouchGoogleAdsCampaignId ? { first_touch_google_ads_campaign_id: attribution.firstTouchGoogleAdsCampaignId } : {}),
    ...(attribution.firstTouchGoogleAdsAdGroupId ? { first_touch_google_ads_ad_group_id: attribution.firstTouchGoogleAdsAdGroupId } : {}),
    ...(attribution.firstTouchGoogleAdsCreativeId ? { first_touch_google_ads_creative_id: attribution.firstTouchGoogleAdsCreativeId } : {}),
    ...(attribution.firstTouchContent ? { first_touch_content: attribution.firstTouchContent } : {}),
    ...(attribution.firstTouchGclid ? { first_touch_gclid: attribution.firstTouchGclid } : {}),
    ...(attribution.firstTouchLandingPath ? { first_touch_landing_path: attribution.firstTouchLandingPath } : {}),
    ...(attribution.firstTouchLandingUrl ? { first_touch_landing_url: attribution.firstTouchLandingUrl } : {}),
    ...(attribution.firstTouchReferrer ? { first_touch_referrer_url: attribution.firstTouchReferrer } : {}),
    ...(attribution.firstTouchReferralSource ? { first_touch_referral_source: attribution.firstTouchReferralSource } : {}),
    ...(attribution.firstTouchReferralInviterEmail ? { first_touch_referral_inviter_email: attribution.firstTouchReferralInviterEmail } : {}),
    ...(attribution.firstTouchReferralCampaign ? { first_touch_referral_campaign: attribution.firstTouchReferralCampaign } : {})
  };
}
