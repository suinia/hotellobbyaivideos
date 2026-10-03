import { appConfig } from "@/lib/config";
import { generateApimartGptImages } from "@/lib/images/apimart-gpt-image";
import { callGenericLlmJson } from "@/lib/llm/skill-client";
import { beginUsageScope, snapshotUsage, type UsageSnapshot } from "@/lib/llm/usage-tracker";
import { resolveContentPipeline } from "@/lib/pipeline/registry";
import { CONTACT_INFO_PROVENANCE_RULE } from "@/lib/prompts/contact-info-guard";
import { runCopyPolishLoop, runCoverReviewPack, runFinalAuditRecovery, runPostCopyQualityLoop } from "@/lib/quality/loop";
import { skillInputProcessor } from "@/lib/skills/input-processor";
import { skillAssetGenerator } from "@/lib/skills/asset-generator";
import { skillViralOptimizer } from "@/lib/skills/viral-optimizer";
import { skillContentPlanner } from "@/lib/skills/content-planner";
import { skillVisualPromptPlanner } from "@/lib/skills/visual-prompt-planner";
import type { ConversionContext, ConversionRequest, ConversionResult } from "@/lib/types/skills";

type ProgressCallback = (step: string, progress: number, outputPreview?: string) => Promise<void> | void;
type StageStartCallback = (step: string, progress: number) => Promise<void> | void;

function createInitialContext(request: ConversionRequest): ConversionContext {
  return {
    request,
    corePoints: [],
    hooks: [],
    storyboard: [],
    slideCardPlans: [],
    visuals: [],
    visualStyleProfile: {
      visualDomain: "general",
      recommendedPreset: request.brand.stylePreset,
      recommendedTone: request.tone,
      styleKeywords: ["clean editorial storytelling visuals"],
      negativeKeywords: ["fantasy", "sci-fi", "landscape painting"],
      globalDirection: "Consistent editorial visual language across all slides.",
      rationale: "Default style profile."
    },
    theme: { cssVariables: {} },
    assetPromptPlans: [],
    assets: [],
    compositions: [],
    resizedOutputs: [],
    audits: [],
    sourceEvidence: [],
    trendSignals: [],
    cta: "",
    caption: "",
    hashtags: []
  };
}

function truncate(value: string, max = 200): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function normalizeHashtags(tags: string[], limit = 5): string[] {
  const normalized = tags
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag.replace(/\s+/g, "")}`))
    .filter((tag) => /^#[\p{L}\p{N}_-]+$/u.test(tag));

  return Array.from(new Set(normalized)).slice(0, Math.max(1, limit));
}

function fallbackHashtags(input: string): string[] {
  const text = input.toLowerCase();
  if (text.includes("ai")) {
    return ["#AI", "#Automation", "#ContentMarketing", "#Productivity", "#CreatorEconomy", "#Growth"];
  }
  if (text.includes("startup")) {
    return ["#Startup", "#Founders", "#Growth", "#Execution", "#Business", "#BuildInPublic"];
  }
  return ["#ContentStrategy", "#SocialMedia", "#Marketing", "#Branding", "#Storytelling", "#Creator"];
}

function toSingleSentence(title: string): string {
  const normalized = title.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const sentence = normalized
    .split(/(?<=[。！？.!?])\s+|\n+/)
    .map((item) => item.trim())
    .find(Boolean) ?? normalized;
  return truncate(sentence, 90);
}

function normalizeCaptionLength(caption: string, fallbackText: string): string {
  const trimToNaturalBoundary = (value: string, maxChars: number): string => {
    if (value.length <= maxChars) return value;
    const head = value.slice(0, maxChars + 1);

    const sentenceMarks = Array.from(head.matchAll(/[。！？.!?](?=\s|$)/g));
    const lastSentenceMark = sentenceMarks[sentenceMarks.length - 1];
    if (lastSentenceMark?.index != null) {
      const cut = lastSentenceMark.index + 1;
      if (cut >= Math.floor(maxChars * 0.55)) {
        return head.slice(0, cut).trim();
      }
    }

    const wordCut = Math.max(head.lastIndexOf(" "), head.lastIndexOf("\n"), head.lastIndexOf("\t"));
    if (wordCut >= Math.floor(maxChars * 0.6)) {
      return head.slice(0, wordCut).trim();
    }

    return value.slice(0, maxChars).trim();
  };

  const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
  let content = normalize(caption);
  const fallback = normalize(fallbackText);
  if (!content) content = fallback;
  if (!content) return "";

  if (content.length > 300) {
    content = trimToNaturalBoundary(content, 300);
  }

  if (content.length < 100) {
    const pool = fallback && fallback !== content ? `${content} ${fallback}` : content;
    content = trimToNaturalBoundary(pool, 300);
    if (content.length < 100) {
      content = trimToNaturalBoundary(`${content} ${content}`, 300);
    }
  }

  return content;
}

function trimToSoftLimit(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;

  const head = normalized.slice(0, maxChars + 1);
  const sentenceMarks = Array.from(head.matchAll(/[。！？.!?](?=\s|$)/g));
  const lastSentenceMark = sentenceMarks[sentenceMarks.length - 1];
  if (lastSentenceMark?.index != null) {
    const cut = lastSentenceMark.index + 1;
    if (cut >= Math.floor(maxChars * 0.6)) {
      return head.slice(0, cut).trim();
    }
  }

  const wordCut = Math.max(head.lastIndexOf(" "), head.lastIndexOf("\n"), head.lastIndexOf("\t"));
  if (wordCut >= Math.floor(maxChars * 0.65)) {
    return head.slice(0, wordCut).trim();
  }

  return normalized.slice(0, maxChars).trim();
}

function applyPlatformCopyRules(params: {
  request: ConversionRequest;
  result: ConversionResult;
}): ConversionResult {
  const next: ConversionResult = { ...params.result };

  if (params.request.platform === "x") {
    next.post_caption = trimToSoftLimit(next.post_caption, 280);
    next.hashtags = normalizeHashtags(next.hashtags, 3);
  }

  if (params.request.platform === "linkedin") {
    next.post_caption = trimToSoftLimit(next.post_caption, 3000);
  }

  if (params.request.platform === "linkedin") {
    next.hashtags = normalizeHashtags(next.hashtags, 5);
  }

  if (params.request.platform === "instagram" || params.request.platform === "tiktok") {
    next.hashtags = normalizeHashtags(next.hashtags, 5);
  }

  return next;
}

function inferPlatformType(request: ConversionRequest): ConversionResult["platform_type"] {
  if (request.platform === "x") return "Twitter";
  if (request.platform === "instagram") return "Instagram";
  if (request.platform === "tiktok") return "TikTok";
  if (request.platform === "linkedin") return "LinkedIn";
  const aspectRatio = request.aspectRatios[0];
  if (aspectRatio === "9:16") return "TikTok";
  if (aspectRatio === "1:1") return "Twitter";
  if (aspectRatio === "16:9") return "LinkedIn";
  return "Instagram";
}

function buildCoreSkillPreview(stage: string, context: ConversionContext): string {
  switch (stage) {
    case "skill_content_planner":
      return truncate(
        `title=${context.hooks[0] ?? "n/a"} slides=${context.storyboard.length} cards=${context.slideCardPlans.reduce((acc, item) => acc + item.cards.length, 0)} source=${context.request.plannerSourceKind ?? "full"}`
      );
    case "skill_visual_prompt_planner":
      return truncate(context.assetPromptPlans.slice(0, 2).map((item) => `#${item.index} ${item.prompt}`).join(" | "));
    case "skill_asset_generator":
      return truncate(context.assets.slice(0, 2).map((asset) => `#${asset.index} ${asset.prompt}`).join(" | "));
    case "skill_viral_optimizer":
      return truncate(`${context.caption} ${context.hashtags.join(" ")}`);
    default:
      return "stage completed";
  }
}

function buildBaseResult(context: ConversionContext, skillLogs: ConversionResult["skill_logs"]): ConversionResult {
  const aspectRatio = context.request.aspectRatios[0] ?? "4:5";
  const normalizedHashtags = normalizeHashtags(context.hashtags, 5);
  const defaultHashtags = fallbackHashtags(context.request.inputText);
  const hashtags =
    normalizedHashtags.length >= 1
      ? normalizedHashtags
      : normalizeHashtags([...normalizedHashtags, ...defaultHashtags], 5).slice(0, 5);

  const css = context.theme.cssVariables;
  const brandOverlayBase = {
    logo_position: "bottom-right",
    color_values: {
      primary: css["--vf-primary"] ?? "#22d3ee",
      secondary: css["--vf-secondary"] ?? "#34d399",
      background: css["--vf-bg"] ?? "#091322",
      text: css["--vf-text"] ?? "#e8f1ff"
    },
    font_name: context.request.brand.fonts?.[0] ?? "System Sans",
    logo_url: context.request.brand.logoUrl
  };

  return {
    post_title: context.hooks[0] ?? context.request.sourceTitle ?? context.corePoints[0] ?? "Vismuse AI Result",
    post_caption: context.caption || truncate(context.corePoints.join(" "), 500),
    hashtags,
    platform_type: inferPlatformType(context.request),
    source_evidence: context.sourceEvidence.slice(0, 6),
    trend_signals: context.trendSignals.slice(0, 10),
    slides: context.storyboard.map((story) => {
      const isQuoteMode = context.request.generationMode === "quote_slides";
      const visual = context.visuals.find((item) => item.index === story.index);
      const asset = context.assets.find((item) => item.index === story.index);
      const composition = context.compositions.find((item) => item.index === story.index);

      return {
        slide_id: story.index,
        is_cover: story.index === 1,
        content_quote: isQuoteMode ? story.script : composition?.script ?? visual?.hierarchy.body ?? story.script,
        visual_prompt: asset?.prompt ?? visual?.metaphor ?? "",
        image_url: composition?.imageUrl ?? asset?.imageUrl ?? "",
        layout_template: composition?.layout ?? visual?.layout ?? "TEMPLATE_LIST",
        focus_keywords: visual?.hierarchy.highlightKeywords ?? [],
        metaphor_title: visual?.metaphorPlan?.metaphorName ?? asset?.metaphorConcept,
        ai_reasoning: visual?.metaphorPlan?.reasoning ?? asset?.designReasoning,
        text_overlay_position: asset?.negativeSpaceArea,
        style_tag: asset?.styleTag ?? visual?.metaphorPlan?.styleTag ?? context.visualStyleProfile.recommendedPreset,
        diagram_type: asset?.diagramType ?? visual?.metaphorPlan?.diagramType,
        entity_tags: asset?.entityTags ?? visual?.metaphorPlan?.entityTags,
        metric_tags: asset?.metricTags ?? visual?.metaphorPlan?.metricTags,
        prompt_logs: asset?.prompt,
        brand_overlay: { ...brandOverlayBase }
      };
    }),
    skill_logs: skillLogs,
    aspect_ratio: aspectRatio
  };
}

function stageProgress(index: number, total: number): number {
  if (total <= 0) return 99;
  return Math.max(5, Math.min(99, Math.round(((index + 1) / total) * 99)));
}

function shouldGenerateVisualAssets(request: ConversionRequest): boolean {
  const rawImageCount = request.imageCount;
  const hasExplicitImageCount = rawImageCount != null;
  const explicitImageCount = Number(rawImageCount);

  if (hasExplicitImageCount && Number.isFinite(explicitImageCount) && explicitImageCount > 0) {
    return true;
  }

  if (request.format === "carousel") {
    return !hasExplicitImageCount || explicitImageCount !== 0;
  }

  return false;
}

function shouldUseDirectImageGeneration(request: ConversionRequest): boolean {
  return Boolean(
    appConfig.image.apimart.directCarousel &&
    appConfig.image.apimart.apiKey &&
    request.platform === "instagram" &&
    request.format === "carousel" &&
    shouldGenerateVisualAssets(request)
  );
}

type DirectCarouselNDecision = {
  n?: number;
  reason?: string;
};

type DirectPublishCopy = {
  title?: string;
  caption?: string;
  hashtags?: string[];
};

function clampDirectImageCount(value: unknown, fallback = 3): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(4, Math.round(numeric)));
}

async function decideDirectImageCount(request: ConversionRequest, storyboardCount: number): Promise<{ n: number; reason: string }> {
  const explicitImageCount = Number(request.imageCount);
  if (Number.isFinite(explicitImageCount) && explicitImageCount > 0) {
    const n = clampDirectImageCount(explicitImageCount);
    return {
      n,
      reason: `User selected ${n} image${n > 1 ? "s" : ""}.`
    };
  }

  const decision = await callGenericLlmJson<DirectCarouselNDecision>({
    instruction: [
      "Decide how many standalone images should be generated for one Instagram carousel from a user's prompt.",
      "Return only the image count n and a short reason.",
      "Use n=1 for a single poster or one-scene request.",
      "Use n=2-4 when the prompt naturally contains multiple tips, steps, scenes, products, or carousel beats.",
      "The image API supports at most 4 images, so never return more than 4.",
      "Do not rewrite, expand, plan, or judge the prompt quality. Only choose n."
    ].join(" "),
    input: {
      user_prompt: request.inputText,
      context: {
        platform: "instagram",
        format: "carousel",
        aspect_ratio: request.aspectRatios[0] ?? "4:5",
        current_slide_count: storyboardCount || undefined,
        requested_image_count: request.imageCount
      }
    },
    outputSchemaHint: '{"n":3,"reason":"The prompt contains three tips."}',
    outputLanguage: request.outputLanguage,
    temperature: 0,
    fallbackModels: [appConfig.llm.copyFallbackModel],
    debugLabel: "direct-image-count"
  });

  return {
    n: clampDirectImageCount(decision?.n, storyboardCount > 0 ? storyboardCount : 3),
    reason: truncate(decision?.reason ?? "Defaulted to the planned slide count.", 180)
  };
}

function buildDirectImageBasePrompt(request: ConversionRequest, n: number): string {
  const languageLabel = request.outputLanguage === "en-US" || request.outputLanguage === "en"
    ? "English"
    : request.outputLanguage;
  return [
    request.inputText.trim(),
    "",
    "Context:",
    "- Platform: Instagram",
    "- Format: carousel",
    `- Image count: ${n}`,
    `- Language: ${languageLabel}`,
    "- Output requirement: return separate standalone images, one full-canvas Instagram slide per image.",
    `- ${CONTACT_INFO_PROVENANCE_RULE}`,
    "- Do not create a collage, contact sheet, grid, split-screen, storyboard board, before/after panel, or multiple slides inside any single image.",
    "- Each returned image should look like one independent 4:5 Instagram carousel slide, not a preview of the whole carousel."
  ].join("\n");
}

function buildDirectSingleImagePrompt(params: {
  basePrompt: string;
  imageIndex: number;
  imageCount: number;
}): string {
  return [
    params.basePrompt,
    "",
    "Single image generation:",
    `- Generate image ${params.imageIndex} of ${params.imageCount} only.`,
    "- This request must return exactly one standalone image.",
    "- Do not include thumbnails, neighboring slides, slide previews, a grid, or any visual reference to the other carousel images.",
    "- Make this image visually distinct from the other carousel images while staying consistent with the same Instagram carousel style."
  ].join("\n");
}

async function generateDirectCarouselImages(context: ConversionContext): Promise<ConversionContext> {
  const aspectRatio = context.request.aspectRatios[0] ?? "4:5";
  const nDecision = await decideDirectImageCount(context.request, context.storyboard.length);
  const basePrompt = buildDirectImageBasePrompt(context.request, nDecision.n);
  const assets = [];

  for (let index = 0; index < nDecision.n; index += 1) {
    const imageIndex = index + 1;
    const prompt = buildDirectSingleImagePrompt({
      basePrompt,
      imageIndex,
      imageCount: nDecision.n
    });
    const generated = await generateApimartGptImages({
      prompt,
      visibleTextLanguage: context.request.outputLanguage,
      aspectRatio,
      n: 1
    });
    const imageUrl = generated.imageUrls[0];
    if (!imageUrl) {
      throw new Error(`Direct image generation ${imageIndex}/${nDecision.n} returned no image URL`);
    }
    assets.push({
      index: imageIndex,
      prompt,
      imageUrl,
      styleTag: "direct-instagram-carousel",
      negativeSpaceArea: "center" as const,
      designReasoning: nDecision.reason
    });
  }

  return {
    ...context,
    assets
  };
}

async function generateDirectPublishCopy(params: {
  prompt: string;
  request: ConversionRequest;
}): Promise<{
  title: string;
  caption: string;
  hashtags: string[];
}> {
  const fallbackTitle = toSingleSentence(params.request.inputText) || "Instagram carousel";
  const fallbackCaption = normalizeCaptionLength(params.request.inputText, params.request.inputText);
  const fallbackTags = normalizeHashtags(["#Instagram", "#Carousel", ...fallbackHashtags(params.request.inputText)], 5);

  try {
    const copy = await callGenericLlmJson<DirectPublishCopy>({
      instruction: [
        "You are writing final publish-ready social media copy for a generated visual post.",
        "Use the provided image-generation prompt as source context.",
        "Return a concise title, one polished platform-ready caption, and 3-5 hashtags.",
        "Do not copy raw website scrape text verbatim.",
        CONTACT_INFO_PROVENANCE_RULE,
        "Do not mention image generation, prompts, APIs, or internal tools.",
        "The caption should feel ready to publish on the requested platform."
      ].join(" "),
      input: {
        image_generation_prompt: params.prompt,
        platform: params.request.platform ?? "instagram",
        format: params.request.format ?? "carousel",
        output_language: params.request.outputLanguage
      },
      outputSchemaHint: '{"title":"...","caption":"...","hashtags":["#..."]}',
      outputLanguage: params.request.outputLanguage,
      temperature: 0.4,
      fallbackModels: [appConfig.llm.copyFallbackModel],
      debugLabel: "direct-publish-copy"
    });

    return {
      title: truncate(toSingleSentence(copy?.title ?? "") || fallbackTitle, 90),
      caption: normalizeCaptionLength(copy?.caption ?? fallbackCaption, fallbackCaption),
      hashtags: normalizeHashtags(copy?.hashtags ?? fallbackTags, 5)
    };
  } catch (error) {
    console.warn("[direct-publish-copy] failed; using fallback copy", {
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      title: truncate(fallbackTitle, 90),
      caption: fallbackCaption,
      hashtags: fallbackTags
    };
  }
}

async function runDirectCarousel(
  request: ConversionRequest,
  onProgress?: ProgressCallback,
  onStageStart?: StageStartCallback
): Promise<{ result: ConversionResult; usage: UsageSnapshot }> {
  const usageScope = beginUsageScope();
  const skillLogs: ConversionResult["skill_logs"] = [];
  const aspectRatio = request.aspectRatios[0] ?? "4:5";

  await onStageStart?.("direct_image_count", 20);
  const nDecision = await decideDirectImageCount(request, 0);
  const basePrompt = buildDirectImageBasePrompt(request, nDecision.n);
  const countPreview = `images=${nDecision.n} reason=${nDecision.reason}`;
  skillLogs.push({
    skill_name: "direct_image_count",
    status: "completed",
    output_preview: truncate(countPreview)
  });
  await onProgress?.("direct_image_count", 20, countPreview);

  await onStageStart?.("direct_publish_copy", 35);
  const copy = await generateDirectPublishCopy({ prompt: basePrompt, request });
  skillLogs.push({
    skill_name: "direct_publish_copy",
    status: "completed",
    output_preview: truncate(copy.caption)
  });
  await onProgress?.("direct_publish_copy", 35, copy.caption);

  await onStageStart?.("skill_asset_generator", 90);
  const images: Array<{ imageUrl: string; prompt: string }> = [];
  for (let index = 0; index < nDecision.n; index += 1) {
    const imageIndex = index + 1;
    const prompt = buildDirectSingleImagePrompt({
      basePrompt,
      imageIndex,
      imageCount: nDecision.n
    });
    await onProgress?.(
      "skill_asset_generator",
      Math.min(95, 35 + Math.round((index / nDecision.n) * 55)),
      `Generating image ${imageIndex}/${nDecision.n}`
    );
    const generated = await generateApimartGptImages({
      prompt,
      visibleTextLanguage: request.outputLanguage,
      aspectRatio,
      n: 1
    });
    const imageUrl = generated.imageUrls[0];
    if (!imageUrl) {
      throw new Error(`Direct image generation ${imageIndex}/${nDecision.n} returned no image URL`);
    }
    images.push({ imageUrl, prompt });
  }

  skillLogs.push({
    skill_name: "skill_asset_generator",
    status: "completed",
    output_preview: truncate(`images=${images.length} perRequestN=1`)
  });
  await onProgress?.("skill_asset_generator", 99, `Generated ${images.length} image${images.length > 1 ? "s" : ""}.`);

  const css = {
    "--vf-primary": "#22d3ee",
    "--vf-secondary": "#34d399",
    "--vf-bg": "#091322",
    "--vf-text": "#e8f1ff"
  };
  const result: ConversionResult = {
    post_title: copy.title,
    post_caption: copy.caption,
    hashtags: copy.hashtags,
    platform_type: inferPlatformType(request),
    source_evidence: [],
    trend_signals: [],
    slides: images.map((image, index) => ({
      slide_id: index + 1,
      is_cover: index === 0,
      content_quote: copy.caption,
      visual_prompt: image.prompt,
      image_url: image.imageUrl,
      layout_template: "TEMPLATE_LIST",
      focus_keywords: [],
      style_tag: "direct-instagram-carousel",
      prompt_logs: image.prompt,
      brand_overlay: {
        logo_position: "bottom-right",
        color_values: {
          primary: css["--vf-primary"],
          secondary: css["--vf-secondary"],
          background: css["--vf-bg"],
          text: css["--vf-text"]
        },
        font_name: request.brand.fonts?.[0] ?? "System Sans",
        logo_url: request.brand.logoUrl
      }
    })),
    skill_logs: skillLogs,
    aspect_ratio: aspectRatio,
    review: {
      required: false,
      reason: `direct_image_generation; n_reason=${nDecision.reason}`
    }
  };

  return {
    result: applyPlatformCopyRules({ request, result }),
    usage: snapshotUsage(usageScope)
  };
}

export async function runConversion(
  request: ConversionRequest,
  onProgress?: ProgressCallback,
  onStageStart?: StageStartCallback
): Promise<{ result: ConversionResult; usage: UsageSnapshot }> {
  if (shouldUseDirectImageGeneration(request)) {
    return runDirectCarousel(request, onProgress, onStageStart);
  }

  const usageScope = beginUsageScope();
  const startedAt = Date.now();
  const pipelineMaxMs = Math.max(120000, Number(appConfig.pipeline.maxDurationMs || 300000));
  const deadlineAt = startedAt + pipelineMaxMs;
  const isTimedOut = () => Date.now() >= deadlineAt;
  const pipelineMode = appConfig.pipeline.mode === "fast" ? "fast" : "full";
  const stagePlan = resolveContentPipeline(request.contentMode)[pipelineMode];
  const shouldRunViralOptimizer = stagePlan.includes("skill_viral_optimizer");

  const skillLogs: ConversionResult["skill_logs"] = [];
  let activeRequest = request;
  let context: ConversionContext | null = null;
  let result: ConversionResult | null = null;
  let pendingViralOptimization:
    | {
        baseContext: ConversionContext;
        promise: Promise<ConversionContext>;
      }
    | null = null;

  const ensureContext = () => {
    if (!context) {
      throw new Error("Pipeline error: conversion context is not initialized.");
    }
    return context;
  };

  const ensureResult = () => {
    if (result) return result;
    const currentContext = ensureContext();
    result = buildBaseResult(currentContext, skillLogs);
    return result;
  };

  for (let index = 0; index < stagePlan.length; index += 1) {
    const stage = stagePlan[index];
    if (isTimedOut() && stage.startsWith("skill_quality_")) {
      break;
    }

    const progress = stageProgress(index, stagePlan.length);
    if (onStageStart) {
      await onStageStart(stage, progress);
    }
    try {
      let outputPreview = "";

      switch (stage) {
        case "skill_input_processor": {
          activeRequest = activeRequest.inputPreprocessed
            ? activeRequest
            : await skillInputProcessor(activeRequest, async (substage, substageProgress, substagePreview) => {
                if (onProgress) {
                  await onProgress(substage, substageProgress, substagePreview);
                }
              });
          context = createInitialContext(activeRequest);
          outputPreview = truncate(
            `${activeRequest.inputPreprocessed ? "shared=reused" : `mode=${activeRequest.contentMode}`} source=${activeRequest.sourceType ?? "text"} title=${activeRequest.sourceTitle ?? "n/a"} chars=${activeRequest.inputText.length} planner=${activeRequest.plannerSourceKind ?? "full"}:${activeRequest.plannerSourceMeta?.plannerChars ?? activeRequest.inputText.length}${activeRequest.plannerTargetSlides ? ` quick_slides=${activeRequest.plannerTargetSlides}` : ""}`
          );
          break;
        }
        case "skill_content_planner": {
          context = await skillContentPlanner(ensureContext());
          outputPreview = buildCoreSkillPreview(stage, ensureContext());
          break;
        }
        case "skill_visual_prompt_planner": {
          if (!shouldGenerateVisualAssets(activeRequest)) {
            outputPreview = "Skipped visual prompt planning for text-only output.";
            break;
          }
          if (shouldUseDirectImageGeneration(activeRequest)) {
            outputPreview = "Skipped visual prompt planning for direct image generation.";
            break;
          }
          if (shouldRunViralOptimizer && !pendingViralOptimization) {
            const baseContext = ensureContext();
            pendingViralOptimization = {
              baseContext,
              promise: skillViralOptimizer(baseContext)
            };
          }
          context = await skillVisualPromptPlanner(ensureContext());
          outputPreview = buildCoreSkillPreview(stage, ensureContext());
          break;
        }
        case "skill_asset_generator": {
          if (!shouldGenerateVisualAssets(activeRequest)) {
            outputPreview = "Skipped image generation for text-only output.";
            break;
          }
          context = shouldUseDirectImageGeneration(activeRequest)
            ? await generateDirectCarouselImages(ensureContext())
            : await skillAssetGenerator(ensureContext());
          outputPreview = buildCoreSkillPreview(stage, ensureContext());
          break;
        }
        case "skill_viral_optimizer": {
          if (pendingViralOptimization) {
            const optimized = await pendingViralOptimization.promise;
            const currentContext = ensureContext();
            context = {
              ...currentContext,
              cta: optimized.cta,
              caption: optimized.caption,
              hashtags: optimized.hashtags
            };
            pendingViralOptimization = null;
          } else {
            context = await skillViralOptimizer(ensureContext());
          }
          outputPreview = buildCoreSkillPreview(stage, ensureContext());
          break;
        }
        case "skill_quality_post_copy_loop": {
          const quality = await runPostCopyQualityLoop({
            result: ensureResult(),
            sourceText: activeRequest.inputText,
            outputLanguage: activeRequest.outputLanguage
          });
          result = { ...quality.result, skill_logs: skillLogs };
          outputPreview = truncate(quality.report.summary, 220);
          break;
        }
        case "skill_quality_copy_polish": {
          const polished = await runCopyPolishLoop({
            result: ensureResult(),
            sourceText: activeRequest.inputText,
            outputLanguage: activeRequest.outputLanguage
          });
          result = { ...polished.result, skill_logs: skillLogs };
          outputPreview = truncate(polished.report.summary, 220);
          break;
        }
        case "skill_quality_final_audit": {
          const finalAudit = await runFinalAuditRecovery({
            result: ensureResult(),
            sourceText: activeRequest.inputText,
            outputLanguage: activeRequest.outputLanguage
          });
          result = { ...finalAudit.result, skill_logs: skillLogs };
          outputPreview = truncate(finalAudit.report.summary, 220);
          break;
        }
        case "skill_quality_image_loop": {
          throw new Error("skill_quality_image_loop is not implemented yet.");
        }
        default: {
          throw new Error(`Unknown pipeline stage: ${stage}`);
        }
      }

      skillLogs.push({
        skill_name: stage,
        status: "completed",
        output_preview: outputPreview
      });
      if (onProgress) {
        await onProgress(stage, progress, outputPreview);
      }
    } catch (error) {
      const message = truncate(error instanceof Error ? error.message : "stage failed", 220);
      skillLogs.push({
        skill_name: stage,
        status: "failed",
        output_preview: message
      });
      throw error;
    }
  }

  result = ensureResult();

  if (activeRequest.reviewMode === "required" && !isTimedOut()) {
    try {
      const review = await runCoverReviewPack({
        result,
        sourceText: activeRequest.inputText
      });
      result.review = review;
    } catch (error) {
      result.review = {
        required: true,
        reason: `cover review pack failed: ${error instanceof Error ? truncate(error.message, 90) : "unknown"}`
      };
    }
  } else {
    result.review = {
      required: false,
      reason: isTimedOut() ? "skipped_due_to_pipeline_budget" : "auto mode"
    };
  }

  const finalContext = ensureContext();
  result = {
    ...result,
    post_title: toSingleSentence(result.post_title) || "Core insight on slide 1",
    post_caption: normalizeCaptionLength(
      result.post_caption,
      [finalContext.corePoints.slice(0, 4).join(" "), finalContext.cta].filter(Boolean).join(" ")
    ),
    hashtags: normalizeHashtags(result.hashtags, 5),
    skill_logs: skillLogs
  };
  result = applyPlatformCopyRules({
    request: activeRequest,
    result
  });

  const usage = snapshotUsage(usageScope);
  result.skill_logs = skillLogs;

  return {
    result,
    usage
  };
}
