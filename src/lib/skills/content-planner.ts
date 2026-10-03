import { callGenericLlmJson, callSkillLlmJson } from "@/lib/llm/skill-client";
import { appConfig } from "@/lib/config";
import { hasUnexpectedHan, hasUnexpectedLatin, listHasUnexpectedHan, listHasUnexpectedLatin } from "@/lib/i18n/text-guard";
import { clampNumber, splitSentences } from "@/lib/skills/utils";
import type { ConversionContext, SlideCard, SlideCardPlan, SlideScript } from "@/lib/types/skills";

type RawContentPlan = {
  post_title?: string;
  post_caption?: string;
  hashtags?: string[];
  slide_cards?: Array<Array<{
    title?: string;
    sub_title?: string;
    sentence?: string;
  }>>;
  slides?: Array<{
    index?: number;
    heading?: string;
    summary?: string;
    cards?: Array<{
      title?: string;
      sub_title?: string;
      sentence?: string;
    }>;
  }>;
};

type NormalizedContentPlan = {
  post_title?: string;
  post_caption?: string;
  hashtags?: string[];
  slides?: Array<{
    index?: number;
    heading?: string;
    summary?: string;
    cards?: Array<{
      title?: string;
      sentence?: string;
    }>;
  }>;
};

type PlannerPassMode = "standard" | "light_first_pass";

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, max = 180): string {
  const normalized = compact(value);
  if (!normalized) return "";
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function normalizeCardTitle(value: string, fallback: string): string {
  const normalized = compact(value || fallback);
  return truncate(normalized, 36) || fallback;
}

function normalizeCardSentence(value: string): string {
  const cleaned = compact(value)
    .replace(/\bLOCKED_TEXT(?:_\d+)?\b/gi, "")
    .replace(/\bTEXT_LOCK\b/gi, "");
  const normalized = compact(cleaned);
  if (!normalized) return "";
  return truncate(normalized, 160);
}

function toSingleSentence(value: string, max = 180): string {
  const normalized = compact(value);
  if (!normalized) return "";
  const [firstSentence] = splitSentences(normalized);
  return truncate(firstSentence || normalized, max);
}

function buildCopyKey(value: string): string {
  return compact(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoCandidateLines(value: string): string[] {
  return Array.from(new Set(splitSentences(value).map((item) => normalizeCardSentence(item)).filter(Boolean))).slice(0, 12);
}

function inferCardTitleFromSentence(sentence: string, index: number): string {
  const words = compact(sentence)
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);

  if (!words.length) {
    return `Point ${index + 1}`;
  }

  const label = words.join(" ");

  return truncate(label, 28) || `Point ${index + 1}`;
}

function ensureLongformCardDensity(params: {
  slide: SlideCardPlan;
  sourceText: string;
  slideIndex: number;
}): SlideCardPlan {
  const { slide, sourceText, slideIndex } = params;
  const maxCards = 5;
  const desiredCount = Math.max(1, Math.min(maxCards, slide.cards.length || splitIntoCandidateLines(slide.summary).length || 1));
  const nextCards: SlideCard[] = [];
  const localSeen = new Set<string>();

  for (const card of slide.cards.slice(0, maxCards)) {
    const key = buildCopyKey(card.sentence);
    if (!key || localSeen.has(key)) continue;
    localSeen.add(key);
    nextCards.push(card);
  }

  if (nextCards.length >= desiredCount) {
    return {
      ...slide,
      cards: nextCards.slice(0, desiredCount)
    };
  }

  const globalCandidates = splitSentences(sourceText)
    .map((item) => normalizeCardSentence(item))
    .filter(Boolean);
  const seedOffset = Math.max(0, (slideIndex - 1) * 3);
  const seededCandidates = globalCandidates.slice(seedOffset, seedOffset + 8);

  const localCandidates = [
    ...slide.cards.map((card) => card.sentence),
    slide.summary,
    ...splitIntoCandidateLines(slide.summary),
    ...seededCandidates
  ]
    .map((item) => normalizeCardSentence(item))
    .filter(Boolean);

  const deduped = Array.from(new Set(localCandidates));

  for (const sentence of deduped) {
    if (nextCards.length >= desiredCount) break;
    const key = buildCopyKey(sentence);
    if (!key || localSeen.has(key)) continue;
    localSeen.add(key);
    nextCards.push({
      title: inferCardTitleFromSentence(sentence, nextCards.length),
      sentence
    });
  }

  if (!nextCards.length) {
    const fallbackSentence = normalizeCardSentence(slide.summary) || truncate(sourceText, 140);
    nextCards.push({
      title: "Core Insight",
      sentence: fallbackSentence
    });
  }

  return {
    ...slide,
    summary: slide.summary || nextCards.map((card) => card.sentence).slice(0, 2).join(" "),
    cards: nextCards.slice(0, desiredCount)
  };
}

function enforceUniqueCardCopy(slides: SlideCardPlan[], sourceText: string): SlideCardPlan[] {
  const globalSeen = new Set<string>();
  const sourceCandidates = splitSentences(sourceText)
    .map((item) => normalizeCardSentence(item))
    .filter(Boolean);

  return slides.map((slide, slideIndex) => {
    const targetCount = Math.max(1, Math.min(5, slide.cards.length || 1));
    const uniqueCards: SlideCard[] = [];
    const localSeen = new Set<string>();

    for (const card of slide.cards) {
      const key = buildCopyKey(card.sentence);
      if (!key || localSeen.has(key) || globalSeen.has(key)) continue;
      localSeen.add(key);
      globalSeen.add(key);
      uniqueCards.push(card);
      if (uniqueCards.length >= targetCount) break;
    }

    const fallbackCandidates = [
      ...splitIntoCandidateLines(slide.summary),
      ...sourceCandidates.slice(slideIndex * 5, slideIndex * 5 + 12),
      ...sourceCandidates
    ];

    for (const sentence of fallbackCandidates) {
      if (uniqueCards.length >= targetCount) break;
      const key = buildCopyKey(sentence);
      if (!key || localSeen.has(key) || globalSeen.has(key)) continue;
      localSeen.add(key);
      globalSeen.add(key);
      uniqueCards.push({
        title: inferCardTitleFromSentence(sentence, uniqueCards.length),
        sentence
      });
    }

    if (!uniqueCards.length) {
      const fallbackSentence = sourceCandidates.find((item) => {
        const key = buildCopyKey(item);
        return key && !globalSeen.has(key);
      }) || normalizeCardSentence(slide.summary) || truncate(sourceText, 140);
      const key = buildCopyKey(fallbackSentence);
      if (key) {
        globalSeen.add(key);
      }
      uniqueCards.push({
        title: inferCardTitleFromSentence(fallbackSentence, 0),
        sentence: fallbackSentence
      });
    }

    const summaryCandidates = [
      normalizeCardSentence(slide.summary),
      ...splitIntoCandidateLines(slide.summary)
    ].filter(Boolean);
    const summary = summaryCandidates.find((item) => !localSeen.has(buildCopyKey(item))) || "";

    return {
      ...slide,
      summary,
      cards: uniqueCards
    };
  });
}

function normalizeHashtags(values: string[], fallbackText: string): string[] {
  const fromValues = values
    .map((item) => compact(String(item ?? "")))
    .map((item) => item.replace(/^#+/, ""))
    .map((item) => item.replace(/[^\p{L}\p{N}_-]+/gu, ""))
    .filter(Boolean)
    .map((item) => `#${item}`);

  if (fromValues.length) {
    return Array.from(new Set(fromValues)).slice(0, 5);
  }

  const lower = fallbackText.toLowerCase();
  if (lower.includes("ai")) return ["#AI", "#Automation", "#SocialMedia", "#Creator", "#Growth"];
  if (lower.includes("product") || lower.includes("marketing")) {
    return ["#ProductMarketing", "#Growth", "#Conversion", "#Brand", "#Content"];
  }
  return ["#Content", "#Carousel", "#Storytelling", "#Learning", "#Growth"];
}

function getPlatformCarouselSlideMax(context: ConversionContext): number {
  if (context.request.format !== "carousel") {
    return 1;
  }

  switch (context.request.platform) {
    case "x":
      return 4;
    case "linkedin":
      return 9;
    case "instagram":
    case "tiktok":
      return 10;
    default:
      return 8;
  }
}

function getPlannerSourceText(context: ConversionContext): string {
  return context.request.plannerSourceText?.trim() || context.request.inputText;
}

function getPlannerSlideRequest(context: ConversionContext): {
  explicitTargetSlides: number | null;
  preferredTargetSlides: number | null;
  maxSlides: number;
} {
  const platformMax = Math.min(getPlatformCarouselSlideMax(context), 10);
  const explicitTargetSlides = Number.isFinite(context.request.targetSlides)
    ? clampNumber(Number(context.request.targetSlides), 1, platformMax)
    : null;
  const preferredTargetSlides =
    explicitTargetSlides ??
    (Number.isFinite(context.request.plannerTargetSlides)
      ? clampNumber(Number(context.request.plannerTargetSlides), 1, Math.min(platformMax, 4))
      : null);

  return {
    explicitTargetSlides,
    preferredTargetSlides,
    maxSlides: preferredTargetSlides ? Math.min(platformMax, preferredTargetSlides) : platformMax
  };
}

function getPlannerSlideCap(context: ConversionContext): number {
  return getPlannerSlideRequest(context).maxSlides;
}

function getPlannerPassMode(context: ConversionContext): PlannerPassMode {
  return context.request.plannerPassMode === "light_first_pass" ? "light_first_pass" : "standard";
}

function isLightFirstPass(context: ConversionContext): boolean {
  return getPlannerPassMode(context) === "light_first_pass";
}

function buildCompatibilityCardTitle(heading: string, cardTitle: string, index: number): string {
  if (index === 0) return "Hook";
  return normalizeCardTitle(cardTitle || heading, `Point ${index + 1}`);
}

function reduceSlidesToLightFirstPass(slides: SlideCardPlan[], sourceText: string): SlideCardPlan[] {
  return slides.map((slide, index) => {
    const summary =
      toSingleSentence(slide.summary, 170) ||
      toSingleSentence(slide.cards.map((card) => card.sentence).join(" "), 170) ||
      toSingleSentence(sourceText, 170) ||
      "Core insight.";
    const leadCard = slide.cards[0];

    return {
      index: index + 1,
      heading: normalizeCardTitle(slide.heading, index === 0 ? "Overview" : `Slide ${index + 1}`),
      summary,
      // Strongest safe approximation of the planned two-step planner split:
      // keep one compatibility card per slide so downstream stages can stay unchanged.
      cards: [
        {
          title: buildCompatibilityCardTitle(slide.heading, leadCard?.title ?? "", index),
          sentence: summary
        }
      ]
    };
  });
}

function fallbackSlideCount(context: ConversionContext): number {
  const { preferredTargetSlides, maxSlides } = getPlannerSlideRequest(context);
  if (preferredTargetSlides) {
    return preferredTargetSlides;
  }
  const chars = getPlannerSourceText(context).replace(/\s+/g, "").length;
  return clampNumber(Math.ceil(chars / 700), 1, maxSlides);
}

function buildFallbackSlides(context: ConversionContext, count: number): SlideCardPlan[] {
  const sentences = splitSentences(context.request.inputText)
    .map((item) => normalizeCardSentence(item))
    .filter(Boolean);

  const safeCount = clampNumber(count, 1, getPlannerSlideCap(context));
  const result: SlideCardPlan[] = [];

  for (let i = 0; i < safeCount; i += 1) {
    const sentenceA = sentences[i * 2] || sentences[i] || truncate(context.request.inputText, 140);
    const sentenceB = sentences[i * 2 + 1] || "";

    const cards: SlideCard[] = [
      {
        title: i === 0 ? "Core Insight" : `Point ${i + 1}`,
        sentence: sentenceA
      }
    ];

    if (sentenceB && cards.length < 5) {
      cards.push({
        title: `Detail ${i + 1}`,
        sentence: sentenceB
      });
    }

    const summary = cards.map((card) => card.sentence).join(" ");

    result.push({
      index: i + 1,
      heading: i === 0 ? "Overview" : `Slide ${i + 1}`,
      summary,
      cards
    });
  }

  return result;
}

function normalizeSlides(context: ConversionContext, raw: RawContentPlan | null): SlideCardPlan[] {
  const { explicitTargetSlides, preferredTargetSlides, maxSlides } = getPlannerSlideRequest(context);
  const lightFirstPass = isLightFirstPass(context);

  const slideCards = Array.isArray(raw?.slide_cards) ? raw?.slide_cards ?? [] : [];
  const ordered = (raw?.slides ?? [])
    .map((item, idx) => ({
      index: Number.isFinite(Number(item?.index)) ? Number(item?.index) : idx + 1,
      heading: compact(String(item?.heading ?? "")),
      summary: compact(String(item?.summary ?? "")),
      cards: Array.isArray(item?.cards)
        ? item.cards ?? []
        : Array.isArray(slideCards[idx])
          ? slideCards[idx] ?? []
          : []
    }))
    .sort((a, b) => a.index - b.index)
    .slice(0, maxSlides);

  const normalized = ordered
    .map((slide, idx) => {
      const cards = slide.cards
        .map((card, cardIdx) => {
          const sentence = normalizeCardSentence(String(card?.sub_title ?? card?.sentence ?? ""));
          if (!sentence) return null;
          const fallbackTitle = cardIdx === 0 ? "Core" : `Card ${cardIdx + 1}`;
          return {
            title: normalizeCardTitle(String(card?.title ?? ""), fallbackTitle),
            sentence
          } satisfies SlideCard;
        })
        .filter((card): card is SlideCard => Boolean(card))
        .slice(0, 5);

      const summaryFromCards = cards.map((card) => card.sentence).join(" ");
      const summary = normalizeCardSentence(slide.summary) || truncate(summaryFromCards, 180);
      const heading = normalizeCardTitle(slide.heading, idx === 0 ? "Overview" : `Slide ${idx + 1}`);

      if (!cards.length) {
        const fallbackSentence = summary || truncate(context.request.inputText, 140);
        return {
          index: idx + 1,
          heading,
          summary: fallbackSentence,
          cards: [
            {
              title: "Core",
              sentence: fallbackSentence
            }
          ]
        } satisfies SlideCardPlan;
      }

      return {
        index: idx + 1,
        heading,
        summary: summary || truncate(summaryFromCards, 180),
        cards
      } satisfies SlideCardPlan;
    })
    .slice(0, maxSlides);

  const desiredCount = preferredTargetSlides ?? clampNumber(normalized.length || fallbackSlideCount(context), 1, maxSlides);

  if (!normalized.length && slideCards.length) {
    const fromSlideCards = slideCards
      .map((cardGroup, idx) => {
        const cards = (cardGroup ?? [])
          .map((card, cardIdx) => {
            const sentence = normalizeCardSentence(String(card?.sub_title ?? card?.sentence ?? ""));
            if (!sentence) return null;
            return {
              title: normalizeCardTitle(String(card?.title ?? ""), cardIdx === 0 ? "Core" : `Card ${cardIdx + 1}`),
              sentence
            } satisfies SlideCard;
          })
          .filter((card): card is SlideCard => Boolean(card))
          .slice(0, 5);

        if (!cards.length) return null;
        return {
          index: idx + 1,
          heading: idx === 0 ? "Overview" : `Slide ${idx + 1}`,
          summary: cards.map((card) => card.sentence).join(" "),
          cards
        } satisfies SlideCardPlan;
      })
      .filter((item): item is SlideCardPlan => Boolean(item))
      .slice(0, maxSlides);

    if (fromSlideCards.length) {
      const aligned = fromSlideCards.map((item, idx) => ({ ...item, index: idx + 1 }));
      if (lightFirstPass) {
        return reduceSlidesToLightFirstPass(aligned, context.request.inputText);
      }
      return aligned.map((slide, idx) =>
        ensureLongformCardDensity({
          slide: { ...slide, index: idx + 1 },
          sourceText: context.request.inputText,
          slideIndex: idx + 1
        })
      );
    }
  }

  if (!normalized.length) {
    const fallbackSlides = buildFallbackSlides(context, desiredCount);
    return lightFirstPass ? reduceSlidesToLightFirstPass(fallbackSlides, context.request.inputText) : fallbackSlides;
  }

  let adjusted = normalized;
  if (adjusted.length > desiredCount) {
    adjusted = adjusted.slice(0, desiredCount).map((item, idx) => ({ ...item, index: idx + 1 }));
  } else if (adjusted.length < desiredCount) {
    const fallback = buildFallbackSlides(context, desiredCount);
    const merged = [...adjusted];
    for (const item of fallback) {
      if (merged.length >= desiredCount) break;
      merged.push({ ...item, index: merged.length + 1 });
    }
    adjusted = merged.slice(0, desiredCount).map((item, idx) => ({ ...item, index: idx + 1 }));
  }

  if (lightFirstPass) {
    return reduceSlidesToLightFirstPass(adjusted, context.request.inputText);
  }

  const byMode = adjusted.map((slide, idx) =>
    ensureLongformCardDensity({
      slide: { ...slide, index: idx + 1 },
      sourceText: context.request.inputText,
      slideIndex: idx + 1
    })
  );

  return byMode.map((item, idx) => ({ ...item, index: idx + 1 }));
}

function buildStoryboardFromSlides(slides: SlideCardPlan[]): SlideScript[] {
  return slides.map((slide) => ({
    index: slide.index,
    script: truncate(
      compact(
        [
          slide.heading,
          ...Array.from(
            new Map(
              [slide.summary, ...slide.cards.map((card) => card.sentence)]
                .map((item) => compact(item))
                .filter(Boolean)
                .map((item) => [buildCopyKey(item), item] as const)
            ).values()
          )
        ].join(". ")
      ),
      260
    )
  }));
}

function finalizeSlides(context: ConversionContext, raw: RawContentPlan | null): SlideCardPlan[] {
  const slides = normalizeSlides(context, raw);
  return isLightFirstPass(context) ? slides : enforceUniqueCardCopy(slides, context.request.inputText);
}

async function normalizePlanLanguage(params: {
  outputLanguage: string;
  sourceText: string;
  sourceTitle?: string;
  postTitle: string;
  postCaption: string;
  hashtags: string[];
  slides: SlideCardPlan[];
}): Promise<NormalizedContentPlan | null> {
  const needsNormalization =
    hasUnexpectedHan(params.postTitle, params.outputLanguage) ||
    hasUnexpectedLatin(params.postTitle, params.outputLanguage) ||
    hasUnexpectedHan(params.postCaption, params.outputLanguage) ||
    hasUnexpectedLatin(params.postCaption, params.outputLanguage) ||
    listHasUnexpectedHan(params.hashtags, params.outputLanguage) ||
    listHasUnexpectedLatin(params.hashtags, params.outputLanguage) ||
    params.slides.some(
      (slide) =>
        hasUnexpectedHan(slide.heading, params.outputLanguage) ||
        hasUnexpectedLatin(slide.heading, params.outputLanguage) ||
        hasUnexpectedHan(slide.summary, params.outputLanguage) ||
        hasUnexpectedLatin(slide.summary, params.outputLanguage) ||
        slide.cards.some(
          (card) =>
            hasUnexpectedHan(card.title, params.outputLanguage) ||
            hasUnexpectedLatin(card.title, params.outputLanguage) ||
            hasUnexpectedHan(card.sentence, params.outputLanguage) ||
            hasUnexpectedLatin(card.sentence, params.outputLanguage)
        )
    );

  if (!needsNormalization) {
    return null;
  }

  return callGenericLlmJson<NormalizedContentPlan>({
    instruction: [
      "Rewrite the provided social content plan into the requested output language.",
      "If the requested output language is Chinese, visible titles, summaries, captions, and card sentences must be written naturally in Chinese rather than defaulting to English.",
      "Preserve meaning, factual claims, slide count, and per-slide structure.",
      "Keep the same number of slides and cards.",
      "Do not add new claims.",
      "Hashtags must remain relevant and written naturally for the target language."
    ].join(" "),
    input: {
      output_language: params.outputLanguage,
      source_title: params.sourceTitle,
      source_excerpt: params.sourceText.slice(0, 2400),
      plan: {
        post_title: params.postTitle,
        post_caption: params.postCaption,
        hashtags: params.hashtags,
        slides: params.slides.map((slide) => ({
          index: slide.index,
          heading: slide.heading,
          summary: slide.summary,
          cards: slide.cards.map((card) => ({
            title: card.title,
            sentence: card.sentence
          }))
        }))
      }
    },
    outputSchemaHint:
      '{"post_title":"...","post_caption":"...","hashtags":["#..."],"slides":[{"index":1,"heading":"...","summary":"...","cards":[{"title":"...","sentence":"..."}]}]}',
    outputLanguage: params.outputLanguage,
    temperature: 0.1,
    fallbackModels: [appConfig.llm.copyFallbackModel],
    debugLabel: "normalize-content-plan-language"
  });
}

function pickCorePoints(slides: SlideCardPlan[]): string[] {
  const pool = slides.flatMap((slide) => [slide.summary, ...slide.cards.map((card) => card.sentence)])
    .map((item) => compact(item))
    .filter(Boolean);
  return Array.from(new Set(pool)).slice(0, 8);
}

export async function skillContentPlanner(context: ConversionContext): Promise<ConversionContext> {
  const plannerSourceText = getPlannerSourceText(context);
  const { explicitTargetSlides, preferredTargetSlides, maxSlides } = getPlannerSlideRequest(context);
  const plannerPassMode = getPlannerPassMode(context);
  const lightFirstPass = plannerPassMode === "light_first_pass";
  const writingPolicy = context.request.writingPolicy;
  const captionCharTarget =
    lightFirstPass
      ? context.request.platform === "x"
        ? "70-180 preferred, never exceed 240"
        : context.request.platform === "linkedin"
          ? "80-240 preferred, never exceed 900"
          : "60-180 preferred"
      : context.request.platform === "x"
        ? "120-280 preferred, never exceed 280"
        : context.request.platform === "linkedin"
          ? "120-600 preferred, never exceed 3000"
          : "100-300 preferred";
  const captionHardLimit =
    lightFirstPass
      ? context.request.platform === "x"
        ? 240
        : context.request.platform === "linkedin"
          ? 900
          : 220
      : context.request.platform === "x"
        ? 280
        : context.request.platform === "linkedin"
          ? 3000
          : 320;
  const hashtagsMax = lightFirstPass ? (context.request.platform === "x" ? 2 : 3) : context.request.platform === "x" ? 3 : 5;

  const llmResult = await callSkillLlmJson<RawContentPlan>({
    skill: "contentPlanner",
    input: {
      source_text: plannerSourceText,
      source_title: context.request.sourceTitle,
      target_audience: context.request.audience,
      platform_prompt_hint: context.request.promptHint,
      platform_writing_policy: writingPolicy
        ? {
            voice: writingPolicy.voice,
            opening: writingPolicy.opening,
            slide_rhythm: writingPolicy.slideRhythm,
            caption: writingPolicy.caption,
            cta: writingPolicy.cta,
            hashtags: writingPolicy.hashtags,
            avoid: writingPolicy.avoid
          }
        : undefined,
      tone: context.request.tone,
      output_language: context.request.outputLanguage,
      content_mode: lightFirstPass ? "longform_digest_first_pass" : "longform_digest",
      planner_pass: plannerPassMode,
      target_slides: preferredTargetSlides ?? "auto",
      distribution: {
        platform: context.request.platform ?? "instagram",
        format: context.request.format ?? "carousel",
        image_count: context.request.imageCount ?? "auto",
        primary_aspect_ratio: context.request.aspectRatios[0] ?? "4:5"
      },
      constraints: {
        slides_min: 1,
        slides_max: maxSlides,
        fixed_slides_when_user_set: explicitTargetSlides,
        cards_per_slide_min: 1,
        cards_per_slide_max: lightFirstPass ? 2 : 5,
        card_format: lightFirstPass
          ? "compatibility card only: short title + sub_title(one complete sentence)"
          : "title + sub_title(one complete sentence)",
        longform_density_rule: "for longform_digest, use the natural grouped card count for each slide, between 1 and 5, and never duplicate copy just to pad card count",
        first_pass_focus: lightFirstPass
          ? "Prioritize a strong hook, slide headings, and one-sentence summaries. Keep cards sparse and lightweight because downstream compatibility cards can mirror the summary."
          : undefined,
        two_step_expander_note: lightFirstPass
          ? "The current architecture uses a single-pass approximation. Return a lighter first-pass plan now; a later expander may enrich cards, caption, and hashtags in a separate step."
          : undefined,
        per_slide_summary_format: lightFirstPass ? "exactly one complete sentence per slide" : "one or two concise sentences",
        platform_writing_rule:
          "The result must sound native to the target platform and format. Match hook style, pacing, caption style, CTA tone, and hashtag behavior to the platform writing policy.",
        no_truncated_sentences: true,
        no_placeholder_tokens: true,
        hashtags_max: hashtagsMax,
        caption_chars: captionCharTarget
      }
    },
    outputSchemaHint:
      '{"post_title":"...","post_caption":"...","hashtags":["#..."],"slide_cards":[[{"title":"...","sub_title":"..."}]],"slides":[{"index":1,"heading":"...","summary":"...","cards":[{"title":"...","sub_title":"..."}]}]}',
    outputLanguage: context.request.outputLanguage,
    fallbackModels: [appConfig.llm.copyFallbackModel],
    debugLabel: "content-planner"
  });

  let slideCardPlans = finalizeSlides(context, llmResult);
  let storyboard = buildStoryboardFromSlides(slideCardPlans);
  let corePoints = pickCorePoints(slideCardPlans);

  let postTitle = truncate(compact(String(llmResult?.post_title ?? "")), 90) || storyboard[0]?.script || "Core insight";
  let postCaption =
    truncate(compact(String(llmResult?.post_caption ?? "")), captionHardLimit) ||
    truncate(slideCardPlans.slice(0, 2).map((slide) => slide.summary).join(" "), Math.min(captionHardLimit, 280));
  let hashtags = normalizeHashtags(llmResult?.hashtags ?? [], context.request.inputText).slice(0, hashtagsMax);

  const normalizedPlan = await normalizePlanLanguage({
    outputLanguage: context.request.outputLanguage,
    sourceText: context.request.inputText,
    sourceTitle: context.request.sourceTitle,
    postTitle,
    postCaption,
    hashtags,
    slides: slideCardPlans
  });

  if (normalizedPlan) {
    postTitle = truncate(compact(String(normalizedPlan.post_title ?? postTitle)), 90) || postTitle;
    postCaption = truncate(compact(String(normalizedPlan.post_caption ?? postCaption)), captionHardLimit) || postCaption;
    hashtags = normalizeHashtags(normalizedPlan.hashtags ?? hashtags, context.request.inputText).slice(0, hashtagsMax);

    if (Array.isArray(normalizedPlan.slides) && normalizedPlan.slides.length) {
      slideCardPlans = finalizeSlides(context, {
        slides: normalizedPlan.slides.map((slide) => ({
          index: slide.index,
          heading: slide.heading,
          summary: slide.summary,
          cards: slide.cards?.map((card) => ({
            title: card.title,
            sentence: card.sentence
          }))
        }))
      });
      storyboard = buildStoryboardFromSlides(slideCardPlans);
      corePoints = pickCorePoints(slideCardPlans);
    }
  }

  return {
    ...context,
    hooks: postTitle ? [postTitle] : context.hooks,
    caption: postCaption,
    hashtags,
    corePoints,
    storyboard,
    slideCardPlans
  };
}
