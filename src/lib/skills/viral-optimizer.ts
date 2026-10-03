import { callGenericLlmJson, callSkillLlmJson } from "@/lib/llm/skill-client";
import { appConfig } from "@/lib/config";
import { hasUnexpectedHan, listHasUnexpectedHan } from "@/lib/i18n/text-guard";
import type { ConversionContext } from "@/lib/types/skills";

function fallbackCTA(input: string, platform?: ConversionContext["request"]["platform"]): string {
  const text = input.toLowerCase();
  if (platform === "linkedin") {
    if (text.includes("strategy") || text.includes("framework")) {
      return "Save this framework and share it with your team.";
    }
    return "What would you add from your own experience?";
  }
  if (platform === "x") {
    if (text.includes("data") || text.includes("metric")) {
      return "Reply DATA if you want the full breakdown.";
    }
    return "Bookmark this and share the sharpest takeaway.";
  }
  if (platform === "instagram" || platform === "tiktok") {
    if (text.includes("strategy") || text.includes("framework")) {
      return "Save this for later and send it to a creator friend.";
    }
    return "Save this and tag someone who should see it.";
  }
  if (text.includes("strategy") || text.includes("framework")) {
    return "Save this framework and send it to your team.";
  }
  if (text.includes("data") || text.includes("metric")) {
    return "Comment DATA and I will share the full benchmark.";
  }
  return "Save for later and tag a friend who needs this.";
}

function fallbackCaption(corePoints: string[], cta: string, platform?: ConversionContext["request"]["platform"]): string {
  const summary = corePoints.slice(0, 3).join(" ");
  if (platform === "x") {
    return `${summary}\n\n${cta}`.trim();
  }
  if (platform === "linkedin") {
    return `${summary}\n\n${cta}`.trim();
  }
  return `${summary}\n\n${cta}`.trim();
}

function fallbackHashtags(input: string, platform?: ConversionContext["request"]["platform"]): string[] {
  const text = input.toLowerCase();
  if (platform === "x") {
    if (text.includes("ai")) return ["#AI", "#Automation", "#Growth"];
    if (text.includes("startup")) return ["#Startup", "#Growth", "#BuildInPublic"];
    return ["#Growth", "#Content", "#Strategy"];
  }
  if (platform === "linkedin") {
    if (text.includes("ai")) return ["#AI", "#ContentStrategy", "#Marketing", "#Growth", "#CreatorEconomy"];
    if (text.includes("startup")) return ["#Startup", "#Growth", "#Founders", "#Business", "#Execution"];
    return ["#Marketing", "#ContentStrategy", "#Growth", "#B2B", "#Storytelling"];
  }
  if (text.includes("ai")) {
    return ["#AI", "#Productivity", "#ContentStrategy", "#Marketing", "#CreatorEconomy", "#Automation"];
  }
  if (text.includes("startup")) {
    return ["#Startup", "#Growth", "#Founders", "#Execution", "#Business", "#BuildInPublic"];
  }
  return ["#Productivity", "#SelfImprovement", "#Learning", "#ContentCreation", "#Mindset", "#CareerGrowth"];
}

function normalizeTag(raw: string): string {
  const cleaned = String(raw)
    .trim()
    .replace(/^#+/, "")
    .replace(/[^\p{L}\p{N}_-]+/gu, "");
  return cleaned ? `#${cleaned}` : "";
}

function scoreTag(params: {
  tag: string;
  trendScore: number;
  corpus: string;
  cooccurTokens: Map<string, number>;
}): number {
  const token = params.tag.replace(/^#/, "").toLowerCase();
  const semantic = params.corpus.includes(token) ? 82 : token.length >= 8 ? 66 : 58;
  const cooccur = Math.min(100, 48 + (params.cooccurTokens.get(token) ?? 0) * 14);
  const trendWeight = 0.55;
  const semanticWeight = 0.3;
  const cooccurWeight = 1 - trendWeight - semanticWeight;
  return Math.round(params.trendScore * trendWeight + semantic * semanticWeight + cooccur * cooccurWeight);
}

function rankHashtags(context: ConversionContext, llmTags: string[]): string[] {
  const trendMap = new Map(
    context.trendSignals.map((item) => [normalizeTag(item.tag).toLowerCase(), Math.max(40, Math.min(100, item.score))] as const)
  );

  const corpus = [context.request.sourceTitle, context.request.inputText, ...context.corePoints]
    .join(" ")
    .toLowerCase();
  const cooccurTokens = new Map<string, number>();
  for (const trend of context.trendSignals) {
    const token = trend.tag.toLowerCase();
    cooccurTokens.set(token, (cooccurTokens.get(token) ?? 0) + 1);
  }

  const candidates = Array.from(
    new Set([
      ...llmTags.map((tag) => normalizeTag(tag)),
      ...context.trendSignals.map((item) => normalizeTag(item.tag)),
      ...fallbackHashtags(context.request.inputText, context.request.platform).map((tag) => normalizeTag(tag))
    ])
  ).filter(Boolean);

  return candidates
    .map((tag) => ({
      tag,
      score: scoreTag({
        tag,
        trendScore: trendMap.get(tag.toLowerCase()) ?? 60,
        corpus,
        cooccurTokens
      })
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.tag)
    .slice(0, 5);
}

export async function skillViralOptimizer(context: ConversionContext): Promise<ConversionContext> {
  const writingPolicy = context.request.writingPolicy;
  const llmResult = await callSkillLlmJson<{ cta?: string; caption?: string; hashtags?: string[] }>({
    skill: "viralOptimizer",
    input: {
      hooks: context.hooks,
      core_points: context.corePoints,
      trend_signals: context.trendSignals,
      source_evidence: context.sourceEvidence.map((item) => ({
        title: item.title,
        credibility_score: item.credibilityScore
      })),
      tone: context.request.tone,
      source_title: context.request.sourceTitle,
      mode: context.request.generationMode,
      content_mode: context.request.contentMode,
      distribution: {
        platform: context.request.platform ?? "instagram",
        format: context.request.format ?? "carousel",
        primary_aspect_ratio: context.request.aspectRatios[0] ?? "4:5"
      },
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
      requirement:
        `Generate CTA plus a short social caption and ${context.request.platform === "x" ? "1-3" : "1-5"} hashtags. Prioritize semantic relevance and retention. Match the platform writing policy for cadence, CTA behavior, and hashtag density. ${context.request.platform === "x" ? "For X, keep the caption within 280 characters." : context.request.platform === "linkedin" ? "For LinkedIn, never exceed 3000 characters." : ""} Hashtags must start with #.`
    },
    outputSchemaHint:
      '{"cta":"Save for later and tag a friend.","caption":"...","hashtags":["#AI","#Productivity","#Growth"]}',
    outputLanguage: context.request.outputLanguage,
    fallbackModels: [appConfig.llm.copyFallbackModel]
  });

  const cta = String(llmResult?.cta ?? "").trim();
  const caption = String(llmResult?.caption ?? "").trim();
  const rankedHashtags = rankHashtags(context, llmResult?.hashtags ?? []);
  const fallbackCta = fallbackCTA(context.request.inputText, context.request.platform);
  const preferExistingCaption = context.caption.replace(/\s+/g, " ").trim();
  const preferExistingHashtags = (context.hashtags ?? []).filter(Boolean);

  let nextCta = cta || fallbackCta;
  let nextCaption =
    preferExistingCaption || caption || fallbackCaption(context.corePoints, cta || fallbackCta, context.request.platform);
  let nextHashtags = preferExistingHashtags.length ? preferExistingHashtags.slice(0, 5) : rankedHashtags;

  const needsNormalization =
    hasUnexpectedHan(nextCta, context.request.outputLanguage) ||
    hasUnexpectedHan(nextCaption, context.request.outputLanguage) ||
    listHasUnexpectedHan(nextHashtags, context.request.outputLanguage);

  if (needsNormalization) {
    const normalized = await callGenericLlmJson<{ cta?: string; caption?: string; hashtags?: string[] }>({
      instruction: [
        "Rewrite the CTA, caption, and hashtags into the requested output language.",
        "Preserve meaning and platform-native tone.",
        "Keep the CTA concise and the caption social-ready.",
        "Return strict JSON only."
      ].join(" "),
      input: {
        output_language: context.request.outputLanguage,
        platform: context.request.platform,
        format: context.request.format,
        cta: nextCta,
        caption: nextCaption,
        hashtags: nextHashtags
      },
      outputSchemaHint: '{"cta":"...","caption":"...","hashtags":["#..."]}',
      outputLanguage: context.request.outputLanguage,
      temperature: 0.1,
      fallbackModels: [appConfig.llm.copyFallbackModel],
      debugLabel: "normalize-viral-language"
    });

    if (normalized) {
      nextCta = String(normalized.cta ?? nextCta).trim() || nextCta;
      nextCaption = String(normalized.caption ?? nextCaption).trim() || nextCaption;
      nextHashtags = rankHashtags(context, normalized.hashtags ?? nextHashtags);
    }
  }

  return {
    ...context,
    cta: nextCta,
    caption: nextCaption,
    hashtags: nextHashtags
  };
}
