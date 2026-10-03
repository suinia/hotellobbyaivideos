import { callGenericLlmJson, callSkillLlmJson } from "@/lib/llm/skill-client";
import { appConfig } from "@/lib/config";
import {
  filterImageLockedTexts,
  filterLockedTextsForOutputLanguage,
  targetLanguageDisallowsHan
} from "@/lib/i18n/text-guard";
import { CONTACT_INFO_PROVENANCE_RULE } from "@/lib/prompts/contact-info-guard";
import type {
  ConversionContext,
  DiagramType,
  SlideCardPlan,
  AssetPromptPlan
} from "@/lib/types/skills";

type RawVisualPromptPlan = {
  global_style?: {
    style_theme?: string;
    style_anchor?: string;
    visual_direction?: string;
    style_flavor?: string;
    icon_direction?: string;
    typography_direction?: string;
    color_direction?: string;
    texture_direction?: string;
    background_direction?: string;
    consistency_rule?: string;
    negative_keywords?: string[];
  };
  slides?: Array<{
    index?: number;
    prompt?: string;
    locked_texts?: string[];
    style_tag?: string;
    diagram_type?: string;
    negative_space_area?: "top" | "left" | "right" | "bottom" | "center";
  }>;
};

type ReviewedVisualPromptPlan = {
  slides?: Array<{
    index?: number;
    prompt?: string;
    locked_texts?: string[];
    diagram_type?: string;
    negative_space_area?: "top" | "left" | "right" | "bottom" | "center";
  }>;
};

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripPromptSourceReferences(value: string): string {
  return compact(
    value
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/\bwww\.\S+/gi, "")
      .replace(/\bSource URL\s*:\s*.*$/gim, "")
      .replace(/\bURL Source\s*:\s*.*$/gim, "")
      .replace(/\bSource material\s*:\s*.*$/gim, "")
      .replace(/\bexample\.com\b/gi, "")
  );
}

function truncate(value: string, max = 220): string {
  const normalized = compact(value);
  if (!normalized) return "";
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function buildCopyKey(value: string): string {
  return compact(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDiagramType(value: unknown): DiagramType {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "comparison_pillar") return "comparison_pillar";
  if (raw === "concentric_moat") return "concentric_moat";
  if (raw === "process_flow") return "process_flow";
  if (raw === "metric_trend") return "metric_trend";
  return "metaphor";
}

function normalizeSpaceArea(value: unknown): "top" | "left" | "right" | "bottom" | "center" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "top") return "top";
  if (raw === "left") return "left";
  if (raw === "right") return "right";
  if (raw === "bottom") return "bottom";
  return "center";
}

function normalizeKeywords(values: unknown, max = 12): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((item) => compact(String(item ?? "")))
    .filter(Boolean)
    .slice(0, max);
}

function normalizeLockedTexts(values: unknown, outputLanguage: string, max = 12): string[] {
  if (!Array.isArray(values)) return [];
  const normalized = values
    .map((item) => compact(String(item ?? "")))
    .map((item) => item.replace(/\bLOCKED_TEXT(?:_\d+)?\b/gi, "").replace(/\bTEXT_LOCK\b/gi, ""))
    .map((item) => compact(item))
    .filter(Boolean)
    .slice(0, max);

  return filterLockedTextsForOutputLanguage(Array.from(new Set(normalized)), outputLanguage).slice(0, max);
}

function shouldKeepLockedText(value: string): boolean {
  const normalized = compact(value);
  if (!normalized) return false;
  if (normalized.length > 72) return false;
  if (/[.!?。！？]/.test(normalized) && normalized.length > 42) return false;
  return true;
}

function buildVisibleTextLanguageRule(outputLanguage: string): string {
  return targetLanguageDisallowsHan(outputLanguage)
    ? "If any visible text appears in the image, it must stay in the requested output language and use English only. Do not introduce Chinese, Japanese, or Han characters."
    : `If any visible text appears in the image, it must stay in the requested output language (${outputLanguage}) and must not be replaced with English.`;
}

async function reviewAssetPromptPlans(params: {
  context: ConversionContext;
  plans: AssetPromptPlan[];
}): Promise<AssetPromptPlan[] | null> {
  const { context, plans } = params;
  if (!plans.length) return null;

  const reviewed = await callGenericLlmJson<ReviewedVisualPromptPlan>({
    instruction: [
      "Review the image prompts before they are sent to an image model.",
      "Make the smallest possible edits while preserving the slide's meaning, composition richness, and exact on-image copy.",
      "Only fix obvious prompt problems: spelling mistakes, repeated visible copy, mismatched diagram types, and contradictory style instructions.",
      "Do not simplify, flatten, shorten, sanitize, or make the visual concept more generic unless needed to resolve a clear conflict.",
      "Do not rewrite, translate, shorten, summarize, paraphrase, or replace any intended visible card copy.",
      "Do not modify the exact card title/subtitle pairs or the locked_texts except to remove duplicates or empty placeholder values.",
      "Do not change the original layout format, card count, card order, card hierarchy, or spatial arrangement instructions.",
      "Do not replace a structured infographic layout with a freer poster, collage, screenshot, or mood-shot composition.",
      "Preserve the original central anchor, focal subject, palette direction, and composition logic unless they directly conflict with another instruction.",
      "Actively detect prompt lines that would make the image model render duplicate cards, repeated title/subtitle pairs, or extra repeated info blocks.",
      "If any non-canonical prompt line repeats or paraphrases a card's title/subtitle, remove that line instead of changing the original card copy.",
      "Preserve exactly one canonical instance of each card title/subtitle pair in the prompt and keep the original card order unchanged.",
      "If the prompt implies split paths, comparison columns, gauges, or process flow, align the diagram_type accordingly.",
      "Keep only short intentional labels in locked_texts.",
      "You may remove duplicate prompt instructions or contradictory styling notes, but never change the original card copy or layout structure.",
      "Preserve all constraints about exact card-pair usage, single-slide composition, and forbidden UI artifacts.",
      buildVisibleTextLanguageRule(context.request.outputLanguage),
      "Return the fully corrected slide prompt set."
    ].join(" "),
    input: {
      output_language: context.request.outputLanguage,
      distribution: {
        platform: context.request.platform ?? "instagram",
        format: context.request.format ?? "carousel",
        image_count: context.request.imageCount ?? "auto",
        ratio: context.request.aspectRatios[0] ?? "4:5"
      },
      slides: plans.map((plan) => ({
        index: plan.index,
        prompt: plan.prompt,
        locked_texts: plan.lockedTexts,
        diagram_type: plan.diagramType,
        negative_space_area: plan.negativeSpaceArea
      }))
    },
    outputSchemaHint:
      '{"slides":[{"index":1,"prompt":"...","locked_texts":["Short label"],"diagram_type":"metaphor|comparison_pillar|concentric_moat|process_flow|metric_trend","negative_space_area":"top|left|right|bottom|center"}]}',
    outputLanguage: "en-US",
    temperature: 0.1,
    fallbackModels: [appConfig.llm.copyFallbackModel],
    debugLabel: "review-visual-prompts"
  });

  if (!Array.isArray(reviewed?.slides) || !reviewed.slides.length) {
    return null;
  }

  const reviewedByIndex = new Map(
    reviewed.slides
      .map((slide) => ({
        index: Number(slide?.index),
        prompt: compact(String(slide?.prompt ?? "")),
        lockedTexts: normalizeLockedTexts(slide?.locked_texts, context.request.outputLanguage).filter(shouldKeepLockedText),
        diagramType: normalizeDiagramType(slide?.diagram_type),
        negativeSpaceArea: normalizeSpaceArea(slide?.negative_space_area)
      }))
      .filter((slide) => Number.isFinite(slide.index) && slide.index > 0)
      .map((slide) => [slide.index, slide] as const)
  );

  return plans.map((plan) => {
    const next = reviewedByIndex.get(plan.index);
    if (!next) return plan;
    return {
      ...plan,
      prompt: mergeReviewedPromptWithImmutableCopy(plan.prompt, next.prompt || plan.prompt),
      lockedTexts: plan.lockedTexts.filter(shouldKeepLockedText),
      diagramType: next.diagramType || plan.diagramType,
      negativeSpaceArea: next.negativeSpaceArea || plan.negativeSpaceArea
    };
  });
}

function isImmutablePromptLine(line: string): boolean {
  const normalized = compact(line).toLowerCase();
  return (
    normalized.startsWith("around the center,") ||
    normalized.startsWith("each card should use topic-specific illustration elements related to") ||
    normalized.startsWith("each card must show one concise title and one short subtitle line.") ||
    normalized.startsWith("use these exact card title and subtitle pairs once each:") ||
    normalized.startsWith("within this single image, every card title and subtitle pair must appear exactly once.") ||
    normalized.startsWith("do not duplicate, recycle, paraphrase, or merge card copy between cards.") ||
    normalized.startsWith("do not repeat card numbers, titles, or subtitle lines anywhere else in the image.") ||
    normalized.startsWith("aspect ratio ") ||
    normalized.startsWith("only the actual slide copy belongs on the image.") ||
    normalized.startsWith("this must be a single standalone slide artwork, not a screenshot or mockup of a carousel, website, or app.") ||
    normalized.startsWith("do not render pagination dots, swipe indicators, navigation arrows, browser chrome, app controls, phone frames, or neighboring slides.") ||
    normalized.startsWith("do not render pagination dots, swipe indicators, navigation arrows, browser or app controls, phone frames, or neighboring slides.") ||
    normalized.startsWith("keep every card, panel, caption block, and decorative element fully inside the canvas with comfortable margins.") ||
    normalized.startsWith("keep every card, panel, title, and supporting graphic fully inside the frame with comfortable margins.") ||
    normalized.startsWith("do not crop the main subject, cards, panels, titles, or ui-style elements at the edges of the frame.") ||
    normalized.startsWith("do not crop cards, captions, decorative panels, or the main subject at the canvas edges.")
  );
}

function reviewEditablePromptLinePrefix(line: string): string | null {
  const normalized = compact(line).toLowerCase();
  const editablePrefixes = [
    "create a ",
    "use a ",
    "render the image with ",
    "use icons with ",
    "use typography with ",
    "the central idea of the slide is ",
    "the overall tone should feel ",
    "any texture should follow ",
    "color treatment should follow ",
    "the background should follow ",
    "keep the layout and visual language consistent across slides with ",
    "use a structured "
  ];

  return editablePrefixes.find((prefix) => normalized.startsWith(prefix)) ?? null;
}

function mergeReviewedPromptWithImmutableCopy(originalPrompt: string, reviewedPrompt: string): string {
  const originalLines = originalPrompt
    .split(/\n+/)
    .map((line) => compact(line))
    .filter(Boolean);
  const reviewedLines = reviewedPrompt
    .split(/\n+/)
    .map((line) => compact(line))
    .filter(Boolean);
  const reviewedEditableByPrefix = new Map<string, string>();

  for (const line of reviewedLines) {
    if (isImmutablePromptLine(line)) continue;
    const prefix = reviewEditablePromptLinePrefix(line);
    if (!prefix) continue;
    reviewedEditableByPrefix.set(prefix, line);
  }

  const mergedLines: string[] = [];
  const seen = new Set<string>();

  for (const line of originalLines) {
    const finalLine = (() => {
      if (isImmutablePromptLine(line)) return line;
      const prefix = reviewEditablePromptLinePrefix(line);
      if (!prefix) return line;
      return reviewedEditableByPrefix.get(prefix) || line;
    })();

    if (!finalLine) continue;
    const key = compact(finalLine).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    mergedLines.push(finalLine);
  }

  for (const line of reviewedLines) {
    const prefix = reviewEditablePromptLinePrefix(line);
    const key = compact(line).toLowerCase();
    if (!prefix || !key || seen.has(key)) continue;
    seen.add(key);
    mergedLines.push(line);
  }

  return mergedLines.join("\n");
}

function pickSlideCards(context: ConversionContext, index: number): SlideCardPlan | undefined {
  return context.slideCardPlans.find((item) => item.index === index);
}

function splitSentenceCandidates(value: string): string[] {
  const normalized = compact(value);
  if (!normalized) return [];
  return normalized
    .split(/(?<=[.!?。！？])\s+|(?:\n+)/g)
    .map((item) => compact(item).replace(/[:;,\-]\s*$/g, ""))
    .filter(Boolean)
    .slice(0, 8);
}

function buildDenseCardSentences(params: {
  heading: string;
  summary: string;
  cards: SlideCardPlan["cards"];
  isLongform: boolean;
  slideIndex: number;
}): string[] {
  const { heading, summary, cards } = params;
  const maxCount = 5;
  const fromCards = Array.from(
    new Map(
      cards
        .map((card) => compact(card.sentence))
        .filter(Boolean)
        .map((item) => [buildCopyKey(item), item] as const)
    ).values()
  ).slice(0, maxCount);
  if (fromCards.length) return fromCards;

  const fromSummary = splitSentenceCandidates(summary);
  const fromHeading = splitSentenceCandidates(heading);

  const merged = Array.from(new Set([...fromCards, ...fromSummary, ...fromHeading]))
    .map((item) => item.replace(/\bLOCKED_TEXT(?:_\d+)?\b/gi, "").replace(/\bTEXT_LOCK\b/gi, "").trim())
    .filter(Boolean)
    .slice(0, maxCount);
  return merged.length ? merged : [compact(summary) || compact(heading) || "Core insight."];
}

function inferCardTitleFromLine(line: string, index: number): string {
  const words = compact(line)
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
  if (!words.length) return `Card ${index + 1}`;
  return truncate(words.join(" "), 26) || `Card ${index + 1}`;
}

function buildCardPairInstructions(cardPayload: Array<{ title: string; sub_title: string }>, cardCount: number): string {
  return cardPayload
    .slice(0, cardCount)
    .map((card, index) => `${index + 1}. "${compact(card.title)}" paired with "${compact(card.sub_title)}"`)
    .join(" ");
}

function parseCardPayload(value: string): Array<{ title: string; sub_title: string }> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => (typeof item === "object" && item !== null ? (item as Record<string, unknown>) : null))
      .filter(Boolean)
      .map((item) => ({
        title: compact(String(item?.title ?? "")),
        sub_title: compact(String(item?.sub_title ?? ""))
      }))
      .filter((item) => item.title || item.sub_title);
  } catch {
    return [];
  }
}

function resolveNonDuplicateSlideFocus(summary: string, cardPayload: Array<{ title: string; sub_title: string }>): string {
  const cardCopyKeys = new Set(
    cardPayload
      .flatMap((card) => [card.title, card.sub_title])
      .map((item) => buildCopyKey(item))
      .filter(Boolean)
  );

  const candidates = [
    normalizeLockedTexts(splitSentenceCandidates(summary), "en-US", 8).join(" "),
    ...splitSentenceCandidates(summary),
    compact(summary)
  ]
    .map((item) => compact(item))
    .filter(Boolean);

  for (const candidate of candidates) {
    const key = buildCopyKey(candidate);
    if (!key || cardCopyKeys.has(key)) continue;
    return candidate;
  }

  return "";
}

function sanitizeVisualPrompt(params: {
  prompt: string;
  cardPayload: Array<{ title: string; sub_title: string }>;
  cardCount: number;
  textLines: string[];
  isLongform: boolean;
  outputLanguage: string;
}): string {
  const { prompt, cardPayload, cardCount, textLines, isLongform, outputLanguage } = params;
  const sanitizedLines: string[] = [];
  const promptLines = prompt
    .split(/\n+/)
    .map((line) => stripPromptSourceReferences(line))
    .filter(Boolean);

  const cardPairsInstruction = buildCardPairInstructions(cardPayload, cardCount);
  const replacements: Array<[string, (value: string) => string | null]> = [
    ["style theme:", (value) => `Use a ${truncate(value, 120)} visual style.`],
    ["visual rendering direction:", (value) => `Render the image with ${truncate(value, 220)}.`],
    ["icon direction:", (value) => `Use icons with ${truncate(value, 200)}.`],
    ["typography direction:", (value) => `Use typography with ${truncate(value, 200)}.`],
    ["slide focus:", (value) => {
      const focus = resolveNonDuplicateSlideFocus(value, cardPayload);
      return focus ? `The central idea of the slide is ${truncate(focus, 220)}.` : null;
    }],
    ["style direction:", (value) => `The overall tone should feel ${truncate(value, 220)}.`],
    ["texture direction:", (value) => `Any texture should follow ${truncate(value, 180)}.`],
    ["color direction:", (value) => `Color treatment should follow ${truncate(value, 180)}.`],
    ["background:", (value) => `The background should follow ${truncate(value, 180)}.`],
    ["global consistency rule:", (value) => `Keep the layout and visual language consistent across slides with ${truncate(value, 220)}.`],
    ["longform_infographic rule:", () => "Prioritize dense explanatory infographic cards over decorative scenery."],
    ["render exactly these text lines on cards (no rewrite):", () => null],
    ["card copy payload (must preserve card structure):", (value) => {
      const parsed = parseCardPayload(value);
      const effectivePairs = parsed.length ? buildCardPairInstructions(parsed, cardCount) : cardPairsInstruction;
      return effectivePairs ? `Use these exact card title and subtitle pairs once each: ${effectivePairs}` : null;
    }],
    ["slide index", () => null]
  ];

  for (const line of promptLines) {
    const lower = line.toLowerCase();
    let handled = false;

    for (const [prefix, transform] of replacements) {
      if (!lower.startsWith(prefix)) continue;
      const value = compact(line.slice(prefix.length));
      const transformed = transform(value.replace(/\.$/, ""));
      if (transformed) {
        sanitizedLines.push(transformed);
      }
      handled = true;
      break;
    }

    if (handled) continue;

    if (lower.includes("4-card grid") && cardCount !== 4) {
      sanitizedLines.push(`Use a structured ${cardCount}-card layout with consistent spacing and clear card separation.`);
      continue;
    }

    if (/https?:\/\/|www\./i.test(line)) {
      continue;
    }

    if (/\b(source url|url source|source material)\b/i.test(line)) {
      continue;
    }

    if (/^the central idea of the slide is /i.test(line)) {
      const focus = line.replace(/^the central idea of the slide is /i, "").replace(/\.$/, "");
      if (!resolveNonDuplicateSlideFocus(focus, cardPayload)) {
        continue;
      }
    }

    sanitizedLines.push(line);
  }

  if (!sanitizedLines.some((line) => /exact card title and subtitle pairs/i.test(line)) && cardPairsInstruction) {
    sanitizedLines.push(`Use these exact card title and subtitle pairs once each: ${cardPairsInstruction}`);
  }

  sanitizedLines.push(
    "Do not render planning notes, style labels, prompt headings, template names, legends, or instruction text as visible copy.",
    "Only the actual slide copy belongs on the image.",
    CONTACT_INFO_PROVENANCE_RULE,
    "Do not show website names, browser UI, page URLs, source labels, reference labels, publication names, or citations in the image.",
    "This must be a single standalone slide artwork, not a screenshot or mockup of a carousel, website, or app.",
    "Do not render pagination dots, swipe indicators, navigation arrows, browser chrome, app controls, phone frames, or neighboring slides.",
    "Keep every card, panel, caption block, and decorative element fully inside the canvas with comfortable margins.",
    "Do not crop the main subject, cards, panels, titles, or UI-style elements at the edges of the frame.",
    buildVisibleTextLanguageRule(outputLanguage),
    "Avoid generic AI-poster tropes; make the layout feel like a deliberate human-designed editorial graphic.",
    "Make the slide feel information-rich, using meaningful diagram cues, connectors, comparison shapes, mini charts, or object groupings instead of empty decorative space.",
    "Each card should combine concise copy with a topic-specific supporting visual cluster, not just one oversized generic icon.",
    "Prefer bright or softly tinted editorial backgrounds with strong readability; avoid dark empty canvases unless the source topic explicitly calls for a dark treatment.",
    "Avoid childish worksheet, sticker-sheet, instruction-manual, or thick-outline clipart aesthetics."
  );

  if (isLongform && textLines.length) {
    sanitizedLines.push(
      "Use one complete idea per card and keep every card distinct.",
      "Do not duplicate or reuse the same copy on multiple cards."
    );
  }

  return Array.from(new Set(sanitizedLines)).join("\n");
}

function buildFallbackPrompt(params: {
  slideIndex: number;
  heading: string;
  summary: string;
  cards: SlideCardPlan["cards"];
  textLines: string[];
  cardPayload: Array<{ title: string; sub_title: string }>;
  isLongform: boolean;
  aspectRatio: string;
  styleTheme: string;
  styleAnchor: string;
  visualDirection: string;
  styleFlavor: string;
  iconDirection: string;
  typographyDirection: string;
  colorDirection: string;
  textureDirection: string;
  backgroundDirection: string;
  consistencyRule: string;
  outputLanguage: string;
}): string {
  const {
    heading,
    summary,
    cards,
    textLines,
    cardPayload,
    isLongform,
    aspectRatio,
    styleTheme,
    styleAnchor,
    visualDirection,
    styleFlavor,
    iconDirection,
    typographyDirection,
    colorDirection,
    textureDirection,
    backgroundDirection,
    consistencyRule,
    outputLanguage
  } = params;

  const cardCount = Math.max(1, Math.min(5, cardPayload.length || textLines.length || cards.length || 1));
  const topics = cards.map((card) => card.title).filter(Boolean).slice(0, cardCount).join(", ") || "core points";
  const cardPairsInstruction = buildCardPairInstructions(cardPayload, cardCount);
  const slideFocus = resolveNonDuplicateSlideFocus(summary, cardPayload);

  const lines = [
    `Create a ${styleAnchor}, centered on ${truncate(heading || "the main slide topic", 90)}.`,
    `Use a ${truncate(styleTheme, 80)} style with ${truncate(visualDirection, 180)}.`,
    `Icons should follow ${truncate(iconDirection, 160)} and typography should follow ${truncate(typographyDirection, 160)}.`,
    `Around the center, ${cardCount} distinct rectangular information cards numbered 1 to ${cardCount}.`,
    `Each card should use topic-specific illustration elements related to ${truncate(topics, 160)}.`,
    "Make the image information-rich, with structured supporting visuals such as connectors, comparison markers, mini charts, process arrows, grouped objects, or data cues.",
    "Each card should include a meaningful supporting visual cluster or scene fragment, not a lone floating icon.",
    "Each card must show one concise title and one short subtitle line.",
    `Use these exact card title and subtitle pairs once each: ${cardPairsInstruction}.`,
    "Within this single image, every card title and subtitle pair must appear exactly once.",
    "Do not duplicate, recycle, paraphrase, or merge card copy between cards.",
    "Do not repeat card numbers, titles, or subtitle lines anywhere else in the image.",
    `The overall tone should feel ${truncate(styleFlavor, 180)}.`,
    `Any texture should follow ${truncate(textureDirection, 120)}.`,
    `Color treatment should follow ${truncate(colorDirection, 140)}.`,
    `The background should follow ${truncate(backgroundDirection, 140)}.`,
    `Keep the layout and visual language consistent across slides with ${truncate(consistencyRule, 180)}.`,
    "High clarity, polished editorial information design.",
    `Aspect ratio ${aspectRatio}.`,
    "Do not render random extra words, prompt labels, placeholder tokens, watermark, or logo.",
    "Do not render planning notes, template names, or code-like labels as visible text.",
    CONTACT_INFO_PROVENANCE_RULE,
    "Do not show website names, page URLs, browser chrome, source references, or publication labels.",
    "This must be a single standalone slide artwork, not a screenshot or mockup of a carousel, website, or app.",
    "Do not render pagination dots, swipe indicators, navigation arrows, browser or app controls, phone frames, or neighboring slides.",
    "Keep every card, panel, title, and supporting graphic fully inside the frame with comfortable margins.",
    "Do not crop cards, captions, decorative panels, or the main subject at the canvas edges.",
    "Prefer bright or softly tinted editorial backgrounds over dark empty backgrounds unless the topic explicitly requires darkness.",
    "Avoid childish worksheet, sticker-sheet, instruction-manual, or thick-outline clipart styles.",
    buildVisibleTextLanguageRule(outputLanguage)
  ];

  if (slideFocus) {
    lines.splice(10, 0, `The central idea of the slide is ${truncate(slideFocus, 180)}.`);
  }

  if (isLongform && textLines.length) {
    lines.push(
      "Prioritize information-dense explanatory cards over mood scenery.",
      "Use one central anchor + surrounding structured cards; avoid minimalist poster style.",
      "Use layered explanatory graphics so the viewer learns from the diagram structure, not only from the text lines.",
      "Render card numbers 1..N with clear spacing and readable hierarchy (title above subtitle).",
      "Distribute one complete text line per card; never truncate, split, paraphrase, or reuse a line on another card."
    );
  }

  return lines.join("\n");
}

function fallbackGlobalStyle(context: ConversionContext): {
  styleTheme: string;
  styleAnchor: string;
  visualDirection: string;
  styleFlavor: string;
  iconDirection: string;
  typographyDirection: string;
  colorDirection: string;
  textureDirection: string;
  backgroundDirection: string;
  consistencyRule: string;
  negativeKeywords: string[];
} {
  const corpus = [
    context.visualStyleProfile.styleArchetype || "",
    context.visualStyleProfile.globalDirection,
    ...context.visualStyleProfile.styleKeywords
  ]
    .join(" ")
    .toLowerCase();

  let styleAnchor = "professional infographic layout, polished modern editorial information design";
  let styleTheme = "editorial_clean";
  let visualDirection =
    "information-rich editorial infographic rendering with layered diagram cues, topic-matched mini illustrations, and clear hierarchy";
  let iconDirection =
    "topic-specific editorial icons or mini illustrations with supporting details, avoiding lone generic glyphs";
  let typographyDirection = "high-legibility sans-serif typography with strong headline hierarchy and concise explainer copy";
  if (/(playful|cartoon|hand[- ]drawn|watercolor|lifestyle|human)/i.test(corpus)) {
    styleTheme = "playful_educational";
    styleAnchor = "professional hand-drawn infographic layout, polished educational editorial illustration style";
    visualDirection = "hand-drawn or softly illustrated infographic with structured explanatory scenes and readable hierarchy";
    iconDirection = "rounded illustrated icons with small supporting details and restrained outlines";
    typographyDirection = "rounded, friendly sans-serif typography with strong legibility";
  } else if (/(tech|data|corporate|minimal|analytical)/i.test(corpus)) {
    styleTheme = "tech_editorial";
    styleAnchor = "professional infographic layout, clean modern editorial systems illustration style";
    visualDirection = "modern technology editorial infographic with crisp geometric forms, layered UI-grade diagram details, and polished data cues";
    iconDirection = "geometric duotone icons and mini technical illustrations with precise edges and supporting details";
    typographyDirection = "geometric grotesk/sans-serif typography with clean spacing and strong information hierarchy";
  } else if (/(monochrome|high-contrast|dark)/i.test(corpus)) {
    styleTheme = "serious_editorial";
    styleAnchor = "professional infographic layout, serious editorial information design";
    visualDirection = "serious editorial visual language with restrained drama, structured diagrams, and purposeful detail";
    iconDirection = "clean high-contrast editorial symbols with clear supporting detail";
    typographyDirection = "neutral news/editorial sans-serif style with strong headline hierarchy";
  }

  return {
    styleTheme,
    styleAnchor,
    visualDirection,
    styleFlavor:
      "topic-matched professional infographic layout with clear central anchor, structured numbered cards, and rich explanatory visual details",
    iconDirection,
    typographyDirection,
    colorDirection:
      "topic-appropriate color direction with readability-first contrast, selective accent colors, and a preference for bright or softly tinted surfaces",
    textureDirection: "texture style should match topic (clean vector, subtle material texture, or restrained illustration grain)",
    backgroundDirection:
      "background should support readability, usually bright or softly tinted rather than dark and empty, unless the topic clearly needs a darker tone",
    consistencyRule:
      "All slides must keep one coherent visual language, card style, icon style, typography personality, color logic, and information density",
    negativeKeywords: Array.from(
      new Set([
        ...context.visualStyleProfile.negativeKeywords.slice(0, 10),
        "minimalist poster",
        "empty dark background",
        "childish worksheet",
        "sticker sheet infographic",
        "thick outline clipart"
      ])
    ).slice(0, 14)
  };
}

export async function skillVisualPromptPlanner(context: ConversionContext): Promise<ConversionContext> {
  const aspectRatio = context.request.aspectRatios[0] ?? "4:5";
  const isLongform = true;
  const textOnImage = context.request.generationMode === "quote_slides" || isLongform;
  const fallbackGlobal = fallbackGlobalStyle(context);

  const llmResult = await callSkillLlmJson<RawVisualPromptPlan>({
    skill: "visualPromptPlanner",
    input: {
      source_text: context.request.inputText,
      content_mode: "longform_digest",
      ratio: aspectRatio,
      distribution: {
        platform: context.request.platform ?? "instagram",
        format: context.request.format ?? "carousel",
        image_count: context.request.imageCount ?? "auto"
      },
      output_language: context.request.outputLanguage,
      text_on_image: textOnImage,
      style_profile: context.visualStyleProfile,
      good_case_rules: {
        style: "professional topic-matched infographic layout with one coherent style family and polished editorial finish",
        style_selection: [
          "children/education -> polished illustrated educational infographic, not childish worksheet art",
          "technology/reporting -> modern clean tech editorial infographic with layered diagram detail",
          "business/finance/news -> serious editorial information design with bright readable surfaces and structured graphics"
        ],
        center_anchor: "one clear central anchor subject",
        cards: "1-5 distinct rectangular information cards, numbered and clearly separated",
        card_content:
          "each card has a specific visual element tied to topic, one concise subtitle, and supporting micro-visual detail beyond a single generic icon",
        quality: "high clarity, professional graphic design, information-rich and polished rather than sparse",
        texture: "texture should follow selected topic style and remain consistent across all slides",
        palette: "palette should match topic mood while preserving text readability and using accent colors deliberately",
        background: "background should be readable, style-consistent, and preferably bright or softly tinted unless the topic clearly requires dark mode",
        icons: "icon style must match selected visual style and remain consistent across slides",
        typography: "text style personality should match topic and remain consistent across slides",
        information_density:
          "image should teach through diagram structure, connectors, grouped objects, comparison bars, or mini charts, not only through text blocks",
        consistency: "all slides share one global visual language",
        forbidden: [
          "placeholder tokens like H1 / LOCKED_TEXT",
          "random extra text",
          "truncated sentence fragments",
          "style drift between slide 1 and others",
          "forcing cartoon style for serious technology/news topics",
          "oversized lone icons with too much empty space",
          "dark empty backgrounds",
          "childish worksheet or instruction-manual clipart style"
        ]
      },
      slides: context.storyboard.map((story) => {
        const cards = pickSlideCards(context, story.index)?.cards ?? [];
        const heading = pickSlideCards(context, story.index)?.heading ?? `Slide ${story.index}`;
        const summary = pickSlideCards(context, story.index)?.summary ?? story.script;
        const visual = context.visuals.find((item) => item.index === story.index);
        return {
          index: story.index,
          heading,
          summary,
          slide_cards: cards.map((card) => ({
            title: card.title,
            sub_title: card.sentence
          })),
          script: story.script,
          visual_hint: visual?.metaphor,
          hero_subject: visual?.metaphorPlan?.heroSubject,
          diagram_type: visual?.metaphorPlan?.diagramType
        };
      }),
      constraints: {
        same_style_across_all_slides: true,
        preserve_information_density: true,
        cards_per_slide_max: 5,
        cards_per_slide_min: 1,
        one_complete_sentence_per_card: true,
        no_text_truncation: true,
        longform_infographic_only: true,
        avoid_minimal_poster_for_longform: true,
        avoid_cinematic_mood_shot_for_longform: true,
        style_must_match_topic: true,
        icon_style_consistency: true,
        typography_style_consistency: true,
        no_han_text_on_image_when_output_disallows_han: targetLanguageDisallowsHan(context.request.outputLanguage)
      }
    },
    outputSchemaHint:
      '{"global_style":{"style_theme":"...","style_anchor":"...","visual_direction":"...","style_flavor":"...","icon_direction":"...","typography_direction":"...","color_direction":"...","texture_direction":"...","background_direction":"...","consistency_rule":"...","negative_keywords":["..."]},"slides":[{"index":1,"prompt":"...","locked_texts":["..."],"style_tag":"...","diagram_type":"metaphor|comparison_pillar|concentric_moat|process_flow|metric_trend","negative_space_area":"top|left|right|bottom|center"}]}',
    outputLanguage: "en-US"
  });

  const global = {
      styleTheme: compact(String(llmResult?.global_style?.style_theme ?? "")) || fallbackGlobal.styleTheme,
      styleAnchor: compact(String(llmResult?.global_style?.style_anchor ?? "")) || fallbackGlobal.styleAnchor,
      visualDirection: compact(String(llmResult?.global_style?.visual_direction ?? "")) || fallbackGlobal.visualDirection,
      styleFlavor: compact(String(llmResult?.global_style?.style_flavor ?? "")) || fallbackGlobal.styleFlavor,
      iconDirection: compact(String(llmResult?.global_style?.icon_direction ?? "")) || fallbackGlobal.iconDirection,
      typographyDirection:
        compact(String(llmResult?.global_style?.typography_direction ?? "")) || fallbackGlobal.typographyDirection,
      colorDirection: compact(String(llmResult?.global_style?.color_direction ?? "")) || fallbackGlobal.colorDirection,
    textureDirection:
      compact(String(llmResult?.global_style?.texture_direction ?? "")) || fallbackGlobal.textureDirection,
    backgroundDirection:
      compact(String(llmResult?.global_style?.background_direction ?? "")) || fallbackGlobal.backgroundDirection,
    consistencyRule:
      compact(String(llmResult?.global_style?.consistency_rule ?? "")) || fallbackGlobal.consistencyRule,
    negativeKeywords:
      normalizeKeywords(llmResult?.global_style?.negative_keywords, 12).length > 0
        ? normalizeKeywords(llmResult?.global_style?.negative_keywords, 12)
        : fallbackGlobal.negativeKeywords
  };

  if (!/infographic/i.test(global.styleAnchor)) {
    global.styleAnchor = fallbackGlobal.styleAnchor;
  }

  const planByIndex = new Map(
    (llmResult?.slides ?? [])
      .map((slide) => ({
        index: Number(slide?.index),
        prompt: compact(String(slide?.prompt ?? "")),
        lockedTexts: normalizeLockedTexts(slide?.locked_texts, context.request.outputLanguage),
        styleTag: compact(String(slide?.style_tag ?? "")),
        diagramType: normalizeDiagramType(slide?.diagram_type),
        negativeSpaceArea: normalizeSpaceArea(slide?.negative_space_area)
      }))
      .filter((slide) => Number.isFinite(slide.index) && slide.index > 0)
      .map((slide) => [slide.index, slide] as const)
  );

  const assetPromptPlans: AssetPromptPlan[] = context.storyboard.map((story) => {
    const slidePlan = pickSlideCards(context, story.index);
    const cards = slidePlan?.cards ?? [{ title: "Core", sentence: story.script }];
    const denseLines = buildDenseCardSentences({
      heading: slidePlan?.heading || `Slide ${story.index}`,
      summary: slidePlan?.summary || story.script,
      cards,
      isLongform,
      slideIndex: story.index
    });
    const cardPayload = denseLines.map((line, idx) => ({
      title: compact(cards[idx]?.title || inferCardTitleFromLine(line, idx)),
      sub_title: compact(line)
    }));

    const fallbackPrompt = buildFallbackPrompt({
      slideIndex: story.index,
      heading: slidePlan?.heading || `Slide ${story.index}`,
      summary: slidePlan?.summary || story.script,
      cards,
      textLines: denseLines,
      cardPayload,
      isLongform,
      aspectRatio,
      styleTheme: global.styleTheme,
      styleAnchor: global.styleAnchor,
      visualDirection: global.visualDirection,
      styleFlavor: global.styleFlavor,
      iconDirection: global.iconDirection,
      typographyDirection: global.typographyDirection,
      colorDirection: global.colorDirection,
      textureDirection: global.textureDirection,
      backgroundDirection: global.backgroundDirection,
      consistencyRule: global.consistencyRule,
      outputLanguage: context.request.outputLanguage
    });

    const raw = planByIndex.get(story.index);
    const prompt = sanitizeVisualPrompt({
      prompt: raw?.prompt || fallbackPrompt,
      cardPayload,
      cardCount: cardPayload.length,
      textLines: denseLines,
      isLongform,
      outputLanguage: context.request.outputLanguage
    });
    const lockedTextsFromCards = cardPayload
      .flatMap((card) => [card.title, card.sub_title])
      .filter(Boolean)
      .filter(shouldKeepLockedText);
    const lockedTexts = textOnImage
      ? filterImageLockedTexts(
          normalizeLockedTexts(
            [...(raw?.lockedTexts ?? []), ...lockedTextsFromCards],
            context.request.outputLanguage
          ),
          context.request.outputLanguage
        )
      : [];

    const visual = context.visuals.find((item) => item.index === story.index);

    return {
      index: story.index,
      prompt,
      lockedTexts,
      styleTag:
        raw?.styleTag ||
        global.styleTheme ||
        visual?.metaphorPlan?.styleTag ||
        context.visualStyleProfile.recommendedPreset ||
        context.request.brand.stylePreset,
      diagramType: raw?.diagramType || visual?.metaphorPlan?.diagramType || "metaphor",
      negativeSpaceArea: raw?.negativeSpaceArea || "center",
      negativeKeywords: global.negativeKeywords
    } satisfies AssetPromptPlan;
  });

  const reviewedPlans = await reviewAssetPromptPlans({
    context,
    plans: assetPromptPlans
  });

  return {
    ...context,
    assetPromptPlans: reviewedPlans ?? assetPromptPlans
  };
}
