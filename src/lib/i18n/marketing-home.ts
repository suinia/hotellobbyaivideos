import type { SiteLocale } from "@/lib/i18n/site-locales";
import { LOCALE_RESOURCES } from "@/locales/catalog.generated";

type HomepageCopy = {
  seo: {
    title: string;
    description: string;
    keywords: string[];
    socialImageAlt: string;
  };
  nav: {
    aiVideo: string;
    aiImage: string;
    tools: string;
    templates: string;
    resources: string;
    pricing: string;
    signIn: string;
    create: string;
  };
  hero: {
    taglineLead: string;
    taglineEmphasis: string;
    title: string;
    description: string;
  };
  composer: {
    image: string;
    video: string;
    agent: string;
    chooseAgent: string;
    placeholder: string;
    submit: string;
  };
  proofTitle: string;
  audiences: string[];
  proofItems: Array<{ value: string; label: string }>;
  howTitle: string;
  howItems: Array<{ title: string; description: string; action: string; mediaLabel: string }>;
  editPrompt: string;
  creatorTitle: string;
  creatorDescription: string;
  creatorItems: Array<{ title: string; description: string }>;
  tryNow: string;
  templatesTitle: string;
  templatesDescription: string;
  browseTemplates: string;
  faqTitle: string;
  faqs: Array<{ question: string; answer: string }>;
  footer: {
    tagline: string;
    imageTools: string;
    videoTools: string;
    resources: string;
    company: string;
    aiImageMaker: string;
    aiFlyerMaker: string;
    albumCoverMaker: string;
    promoVideoMaker: string;
    aiVideoGenerator: string;
    templates: string;
    pricing: string;
    docs: string;
    helpCenter: string;
    contactSupport: string;
    refundPolicy: string;
    about: string;
    privacy: string;
    terms: string;
    rights: string;
  };
};

export function getHomepageCopy(locale: SiteLocale): HomepageCopy {
  return (LOCALE_RESOURCES[locale]?.home ?? LOCALE_RESOURCES.en.home) as HomepageCopy;
}
