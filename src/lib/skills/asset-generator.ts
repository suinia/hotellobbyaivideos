import { filterImageLockedTexts, targetLanguageDisallowsHan } from "@/lib/i18n/text-guard";
import {
  DEFAULT_NEGATIVE_PROMPT,
  NEGATIVE_PROMPT_WITH_TEXT_ON_IMAGE,
  generateNanoBananaImage
} from "@/lib/images/nano-banana";
import { CONTACT_INFO_PROVENANCE_RULE } from "@/lib/prompts/contact-info-guard";
import type { CompositionPlan, ConversionContext } from "@/lib/types/skills";

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, max = 220): string {
  const normalized = compact(value);
  if (!normalized) return "";
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function normalizeSpaceFromComposition(plan: CompositionPlan | undefined): "top" | "left" | "right" | "bottom" | "center" {
  if (plan === "left-heavy") return "right";
  if (plan === "right-heavy") return "left";
  if (plan === "bottom-heavy") return "top";
  if (plan === "top-heavy") return "bottom";
  return "center";
}

function buildFallbackPrompt(params: {
  quote: string;
  index: number;
  aspectRatio: string;
  stylePreset: string;
  outputLanguage: string;
}): string {
  return [
    `Create a high-quality standalone editorial slide artwork. Slide index ${params.index}.`,
    `Core message: ${truncate(params.quote, 180)}.`,
    `Visual style: ${params.stylePreset} editorial storytelling, clean high-contrast composition.`,
    `Aspect ratio ${params.aspectRatio}.`,
    "Keep one dominant focal subject and reserve clean area for text readability.",
    "This is one complete slide only, not a screenshot or mockup of a carousel or app interface.",
    CONTACT_INFO_PROVENANCE_RULE,
    "Do not show pagination dots, swipe indicators, arrows, browser chrome, phone frames, or neighboring slides.",
    "Keep all cards, panels, and focal objects fully inside the canvas with safe margins.",
    targetLanguageDisallowsHan(params.outputLanguage)
      ? "If any visible text appears in the image, it must be in English only. No Chinese, Japanese, or Han characters."
      : "Keep visible text aligned to the requested output language.",
    "No watermark, no logo, no random extra text, no placeholder tokens."
  ].join("\n");
}

export async function skillAssetGenerator(context: ConversionContext): Promise<ConversionContext> {
  const aspectRatio = context.request.aspectRatios[0] ?? "4:5";
  const textOnImage = context.request.generationMode === "quote_slides" || context.request.contentMode === "longform_digest";

  const assets = await Promise.all(
    context.storyboard.map(async (story) => {
      const visual = context.visuals.find((item) => item.index === story.index);
      const plan = context.assetPromptPlans.find((item) => item.index === story.index);
      const quote = compact(story.script || visual?.hierarchy.body || "");

      const prompt =
        compact(plan?.prompt ?? "") ||
        buildFallbackPrompt({
          quote,
          index: story.index,
          aspectRatio,
          stylePreset: context.visualStyleProfile.recommendedPreset || context.request.brand.stylePreset,
          outputLanguage: context.request.outputLanguage
        });

      const lockedTexts = textOnImage
        ? filterImageLockedTexts(plan?.lockedTexts?.length ? plan.lockedTexts : [], context.request.outputLanguage)
        : [];

      const negativePromptBase = textOnImage ? NEGATIVE_PROMPT_WITH_TEXT_ON_IMAGE : DEFAULT_NEGATIVE_PROMPT;
      const negativePromptWithStyle = [
        negativePromptBase,
        targetLanguageDisallowsHan(context.request.outputLanguage)
          ? "Chinese characters, Japanese characters, Han script, non-English text overlays"
          : "",
        ...(plan?.negativeKeywords ?? []),
        ...context.visualStyleProfile.negativeKeywords
      ]
        .map((item) => compact(item))
        .filter(Boolean)
        .join(", ");

      const imageResult = await generateNanoBananaImage({
        prompt,
        negativePrompt: negativePromptWithStyle,
        aspectRatio,
        seed: story.index,
        textOnImage,
        lockedTexts
      });

      return {
        index: story.index,
        prompt,
        imageUrl: imageResult.imageUrl,
        styleTag:
          plan?.styleTag ||
          visual?.metaphorPlan?.styleTag ||
          context.visualStyleProfile.recommendedPreset ||
          context.request.brand.stylePreset,
        diagramType: plan?.diagramType || visual?.metaphorPlan?.diagramType,
        entityTags: visual?.metaphorPlan?.entityTags,
        metricTags: visual?.metaphorPlan?.metricTags,
        negativeSpaceArea:
          plan?.negativeSpaceArea || normalizeSpaceFromComposition(visual?.metaphorPlan?.compositionPlan),
        metaphorConcept: visual?.metaphorPlan?.metaphorName,
        designReasoning: visual?.metaphorPlan?.reasoning
      };
    })
  );

  return {
    ...context,
    assets
  };
}
