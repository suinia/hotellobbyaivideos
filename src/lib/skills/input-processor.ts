import { appConfig } from "@/lib/config";
import { normalizeContentMode, type ConversionRequest } from "@/lib/types/skills";
import {
  detectRequestedOutputLanguageOverride,
  normalizeLanguage
} from "@/lib/i18n/languages";
import {
  assessResolvedSourceAdequacy,
  buildPlannerSourcePack,
  normalizeAdequacyLanguageCode,
  resolveInputContent,
  shouldSkipSourceAdequacyAssessment
} from "@/lib/content/resolve-input";

type InputProcessorProgressCallback = (stage: string, progress: number, outputPreview?: string) => Promise<void> | void;

export class NeedsMoreSourceError extends Error {
  suggestedTask?: string;

  constructor(message: string, options?: { suggestedTask?: string }) {
    super(message);
    this.name = "NeedsMoreSourceError";
    this.suggestedTask = options?.suggestedTask;
  }
}

function looksLikeUrlLikeInput(input: string): boolean {
  const trimmed = input.trim();
  return /^https?:\/\/\S+/i.test(trimmed) || /^www\.\S+/i.test(trimmed);
}

export async function preprocessConversionRequest(
  request: ConversionRequest,
  onProgress?: InputProcessorProgressCallback
): Promise<ConversionRequest> {
  const shouldSurfaceUrlStages = request.inputPreprocessed !== true && looksLikeUrlLikeInput(request.inputText);

  if (shouldSurfaceUrlStages) {
    await onProgress?.(
      "resolving_source",
      18,
      "Opening the submitted link and extracting the main readable content."
    );
  }

  const resolved = await resolveInputContent(request.inputText);
  const selectedLanguage = normalizeLanguage(request.outputLanguage);
  const regexLanguageOverride = detectRequestedOutputLanguageOverride(request.inputText);
  const normalizedContentMode = normalizeContentMode(request.contentMode);

  const shouldSkipAdequacyCheck = shouldSkipSourceAdequacyAssessment({
    content: resolved.content,
    sourceType: resolved.sourceType
  });

  if (shouldSurfaceUrlStages && !shouldSkipAdequacyCheck) {
    await onProgress?.(
      "evaluating_source",
      24,
      `Checking whether the extracted source is strong enough to generate from${resolved.sourceTitle ? `: ${resolved.sourceTitle}` : "."}`
    );
  }

  const adequacy = shouldSkipAdequacyCheck
    ? null
    : await assessResolvedSourceAdequacy({
        content: resolved.content,
        sourceType: resolved.sourceType,
        sourceUrl: resolved.sourceUrl,
        sourceTitle: resolved.sourceTitle,
        originalInput: request.inputText,
        outputLanguage: regexLanguageOverride ?? selectedLanguage,
        explicitLanguageOverrideHint: regexLanguageOverride,
        platform: request.platform,
        platforms: request.batchPlatforms,
        format: request.format,
        imageCount: request.imageCount,
        targetSlides: request.targetSlides
      });

  const llmLanguageOverride =
    adequacy?.has_explicit_output_language === true
      ? normalizeAdequacyLanguageCode(adequacy.language_code)
      : null;
  const normalizedLanguage = llmLanguageOverride ?? regexLanguageOverride ?? selectedLanguage;

  if (adequacy?.adequate === false && !appConfig.pipeline.allowShortTextSource) {
    throw new NeedsMoreSourceError(
      adequacy.user_message ||
        "This source does not have enough substance yet for a strong result. Please paste more of the article, add a richer summary, or share a more detailed source.",
      {
        suggestedTask: "Add more details, paste a longer source, or share a link and I’ll turn it into a stronger draft."
      }
    );
  }

  if (adequacy?.adequate === false) {
    console.warn("[input-processor] Source adequacy check failed but SOURCE_ADEQUACY_ALLOW_SHORT_TEXT is enabled; continuing generation.", {
      reason: adequacy.reason,
      sourceType: resolved.sourceType,
      chars: resolved.content.length
    });
  }

  const plannerSourcePack = buildPlannerSourcePack({
    content: resolved.content,
    sourceType: resolved.sourceType,
    sourceTitle: resolved.sourceTitle,
    sourceUrl: resolved.sourceUrl
  });
  const plannerPassMode =
    appConfig.pipeline.mode === "fast" && request.format === "carousel"
      ? "light_first_pass"
      : "standard";
  const shouldClampQuickSlides =
    appConfig.pipeline.mode === "fast" &&
    request.format === "carousel" &&
    !Number.isFinite(Number(request.targetSlides));

  return {
    ...request,
    inputPreprocessed: true,
    contentMode: normalizedContentMode,
    outputLanguage: normalizedLanguage,
    inputText: resolved.content,
    plannerPassMode,
    plannerTargetSlides: shouldClampQuickSlides ? plannerSourcePack.recommendedQuickSlides : undefined,
    plannerSourceText: plannerSourcePack.text,
    plannerSourceKind: plannerSourcePack.mode,
    plannerSourceMeta: {
      sourceChars: plannerSourcePack.sourceChars,
      plannerChars: plannerSourcePack.plannerChars,
      sectionCount: plannerSourcePack.sectionCount,
      pointCount: plannerSourcePack.pointCount,
      recommendedQuickSlides: plannerSourcePack.recommendedQuickSlides
    },
    sourceType: resolved.sourceType,
    sourceUrl: resolved.sourceUrl,
    sourceTitle: resolved.sourceTitle
  };
}

export async function skillInputProcessor(
  request: ConversionRequest,
  onProgress?: InputProcessorProgressCallback
): Promise<ConversionRequest> {
  return preprocessConversionRequest(request, onProgress);
}
