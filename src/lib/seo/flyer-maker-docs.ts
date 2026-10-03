import type { SeoDocConfig } from "./docs";
import { buildFlyerTopicGeneratorHref, flyerTopicExamples, restoredFlyerMakerPages } from "./flyer-topic-pages";

// Register maker guides with the Docs directory; their full layout is rendered by FlyerMakerPage.
export const flyerMakerDocs: SeoDocConfig[] = restoredFlyerMakerPages.map((page) => ({
  slug: page.slug,
  title: page.title,
  description: page.description,
  h1: page.h1,
  lede: page.lede,
  image: { src: flyerTopicExamples[page.categorySlug][0].image, alt: `${page.shortLabel} example` },
  category: "Flyer guides",
  homeCategory: "Marketing",
  toolHref: buildFlyerTopicGeneratorHref(page.primaryPrompt),
  toolLabel: page.ctaLabel,
  sourceUseCase: "ai-flyer-generator",
  sections: [
    { title: `What to include in your ${page.shortLabel}`, paragraphs: [page.audience], bullets: page.copyChecklist },
    ...page.promptExamples.map((example) => ({ title: example.title, paragraphs: [], example: { label: example.title, prompt: example.prompt } }))
  ],
  workflow: [],
  tips: page.formatTips,
  templateLinks: [{ href: `/templates/flyers/${page.categorySlug}`, label: `${page.label} templates`, description: "Choose an example and customize its prompt." }],
  relatedTools: [{ href: "/tools/ai-flyer-generator", label: "AI Flyer Generator" }]
}));
