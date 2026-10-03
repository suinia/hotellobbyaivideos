import type { JobRecord } from "@/lib/types/job";
import { callGenericLlmJson } from "@/lib/llm/skill-client";
import {
  SOCIALMEDIA_WORKFLOW,
  type SocialmediaAspectRatio,
  type SocialmediaJobPayload,
  type SocialmediaSourceAsset
} from "@/lib/socialmedia/types";
import { normalizeSupabaseStorageUrl } from "@/lib/socialmedia/storage-url";

export type VideoContinuationContext = {
  mode: "retry" | "continue";
  prompt: string;
  sourceAssets: SocialmediaSourceAsset[];
  inheritSourceAssets: boolean;
  aspectRatio?: SocialmediaAspectRatio;
  sourceJobId: string;
};

export type VideoContinuationPromptRewriteInput = {
  previous_prompt: string;
  follow_up_instruction: string;
  mode: "continue";
  explicit_continuation: boolean;
  aspect_ratio?: SocialmediaAspectRatio;
  current_reference_images: Array<{
    index: number;
    role: SocialmediaSourceAsset["role"];
    asset_id?: string;
    original_name?: string;
    mime_type?: string;
    dimensions?: string;
    summary?: string;
  }>;
  reference_images: Array<{
    index: number;
    role: SocialmediaSourceAsset["role"];
    asset_id?: string;
    original_name?: string;
    mime_type?: string;
    dimensions?: string;
    summary?: string;
  }>;
};

type VideoContinuationLlmOutput = {
  action?: "continue" | "new";
  prompt?: string;
  reason?: string;
};

type VideoContinuationPromptRewriter = (
  input: VideoContinuationPromptRewriteInput
) => Promise<VideoContinuationLlmOutput | null>;

function asSocialmediaPayload(payload: JobRecord["payload"]): SocialmediaJobPayload["socialmedia"] | null {
  const socialmedia = payload.socialmedia;
  if (!socialmedia || typeof socialmedia !== "object") return null;
  return socialmedia as SocialmediaJobPayload["socialmedia"];
}

export function isVideoRetryInstruction(content: string): boolean {
  const compact = content.replace(/\s+/g, "").trim().toLowerCase();
  if (!compact) return false;
  if (/^(重试|再试一次|重新生成|重新来|再来一次|再来一个|再生成一次)$/.test(compact)) return true;

  const spaced = content.replace(/\s+/g, " ").trim().toLowerCase();
  return /^(retry|try again|rerun|regenerate|again|one more|do it again|run it again|generate again)( please)?[.!。！]*$/.test(spaced);
}

export function isVideoContinueInstruction(content: string): boolean {
  const compact = content.replace(/\s+/g, "").trim().toLowerCase();
  if (!compact) return false;
  if (/^(继续|继续生成|继续做|继续来|接着生成|接着做|接着来|再继续|延续)$/.test(compact)) return true;
  if (/^(继续生成|继续做|接着生成|接着做|延续)/.test(compact)) return true;

  const spaced = content.replace(/\s+/g, " ").trim().toLowerCase();
  return /^(continue|continue generating|keep going|carry on|extend this|make another|generate another|create another)( please)?[.!。！]*$/.test(spaced);
}

function isVideoContinuationInstruction(content: string): boolean {
  return isVideoRetryInstruction(content) || isVideoContinueInstruction(content);
}

function referencesPreviousVideoContext(content: string): boolean {
  if (isVideoContinuationInstruction(content)) return true;
  const compact = content.replace(/\s+/g, "").trim().toLowerCase();
  if (!compact) return false;
  if (/(上一条|上一个|上次|之前|前面|刚才|原来|原视频|上一版|旧视频|同样风格|相同风格|保持风格|延续风格|参考上)/.test(compact)) return true;

  const spaced = content.replace(/\s+/g, " ").trim().toLowerCase();
  return /\b(previous|last|prior|earlier|same style|same vibe|keep the style|continue|extend|retry|again)\b/.test(spaced);
}

function isImplicitVideoEditInstruction(content: string): boolean {
  const normalized = content.replace(/\s+/g, " ").trim().toLowerCase();
  if (!normalized) return false;
  if (/\b(?:new|another|different)\s+(?:video|clip|animation)\b/.test(normalized)) return false;
  if (/(?:新|另一个|另一条|不同的)(?:视频|短片|动画)/.test(normalized)) return false;
  return /^(?:make\s+(?:it|this|that)\b|change\b|modify\b|edit\b|restyle\b|shorten\b|lengthen\b|add\b|remove\b|replace\b|把|将|让它|改|修改|更改|调整|加上|添加|移除|去掉|替换)/i.test(normalized);
}

function referencesPreviousVideoSourceAsset(content: string): boolean {
  const compact = content.replace(/\s+/g, "").trim().toLowerCase();
  if (!compact) return false;
  if (/(上一张图|上张图|上一张图片|上张图片|旧图|之前的图|前面的图|刚才那张图|刚才的图|原图|旧参考图|之前的参考图|一起用|两张图|两个参考)/.test(compact)) return true;

  const spaced = content.replace(/\s+/g, " ").trim().toLowerCase();
  return /\b(previous|last|prior|earlier|old|original)\s+(image|photo|picture|frame|reference)\b/.test(spaced)
    || /\b(use|combine|include)\b.*\b(previous|last|old)\b.*\b(image|photo|picture|frame|reference)\b/.test(spaced);
}

function shouldInheritPreviousVideoSourceAssets(content: string, currentSourceAssets: SocialmediaSourceAsset[] = []): boolean {
  if (currentSourceAssets.length === 0) return true;
  return referencesPreviousVideoSourceAsset(content);
}

function buildContinuationPrompt(previousPrompt: string, instruction: string): string {
  return [
    `Original video request: ${previousPrompt}`,
    `Follow-up instruction: ${instruction}`,
    "Use the original video request and reference image(s) as context. Do not interpret the follow-up instruction by itself."
  ].join("\n");
}

function truncateLlmField(value: string | undefined, maxLength: number): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}...` : normalized;
}

function normalizeLlmPrompt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const prompt = value.trim().replace(/\n{3,}/g, "\n\n");
  if (prompt.length < 12) return null;
  if (/^(继续|continue|retry|again|重试)$/i.test(prompt.replace(/\s+/g, ""))) return null;
  return prompt;
}

function summarizeAssetsForLlm(assets: SocialmediaSourceAsset[]): VideoContinuationPromptRewriteInput["reference_images"] {
  return assets.slice(0, 8).map((asset, index) => ({
    index: index + 1,
    role: asset.role,
    asset_id: asset.assetId,
    original_name: truncateLlmField(asset.originalName, 120),
    mime_type: asset.mimeType,
    dimensions: asset.width && asset.height ? `${asset.width}x${asset.height}` : undefined,
    summary: truncateLlmField(asset.summary, 600)
  }));
}

function buildVideoContinuationRewriteInput(
  context: VideoContinuationContext,
  followUpInstruction: string,
  currentSourceAssets: SocialmediaSourceAsset[] = []
): VideoContinuationPromptRewriteInput {
  return {
    previous_prompt: context.prompt,
    follow_up_instruction: followUpInstruction.trim(),
    mode: "continue",
    explicit_continuation: isVideoContinueInstruction(followUpInstruction),
    aspect_ratio: context.aspectRatio,
    current_reference_images: summarizeAssetsForLlm(currentSourceAssets),
    reference_images: summarizeAssetsForLlm(context.sourceAssets)
  };
}

async function rewriteVideoContinuationPrompt(input: VideoContinuationPromptRewriteInput, outputLanguage?: string): Promise<VideoContinuationLlmOutput | null> {
  return callGenericLlmJson<VideoContinuationLlmOutput>({
    instruction: [
      "You rewrite a follow-up AI video request into one executable downstream prompt.",
      "First decide whether the latest user input is a continuation/edit/extension of the previous video concept or a standalone new video request.",
      "If explicit_continuation is true, treat it as a continuation.",
      "current_reference_images are assets uploaded or selected in the latest user turn. reference_images are from the previous video job.",
      "If the latest user input points to the current image/poster/reference, introduces a different subject, or asks for a new video using newly supplied assets, return action 'new' so old references are not inherited.",
      "If it is standalone, return action 'new' and leave prompt empty.",
      "The downstream image and video models will receive the original reference image files separately, so use the reference image summaries only as visual context.",
      "Preserve the original subject, visual identity, style, camera language, and aspect constraints unless the follow-up explicitly changes them.",
      "Apply the follow-up instruction as the new creative direction. If the follow-up is vague, such as '继续生成' or 'continue', create a coherent next variation or continuation of the previous video concept.",
      "Do not output a meta prompt. Do not include labels such as 'Original video request' or 'Follow-up instruction'.",
      "When action is 'continue', return a polished prompt that can be sent directly to an image/video generation model."
    ].join(" "),
    input,
    outputSchemaHint: '{"action":"continue","prompt":"A complete downstream AI video/image prompt that combines the prior request, reference image context, and the follow-up instruction.","reason":"Brief reason for how the continuation was interpreted."}',
    outputLanguage,
    temperature: 0.2,
    debugLabel: "socialmedia-video-continuation-prompt"
  });
}

function findLatestVideoPromptJob(sessionJobs: JobRecord[]): JobRecord | null {
  return [...sessionJobs]
    .filter((job) => job.payload.workflow === SOCIALMEDIA_WORKFLOW)
    .sort((left, right) => {
      const createdAtDelta = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      if (createdAtDelta !== 0) return createdAtDelta;
      return right.turnIndex - left.turnIndex;
    })
    .find((job) => {
      const socialmedia = asSocialmediaPayload(job.payload);
      const prompt = socialmedia?.inputText?.trim();
      return (
        socialmedia?.sourceUseCase === "ai-video-generator"
        || socialmedia?.sourceUseCase === "ai-image-to-video"
        || socialmedia?.sourceUseCase === "ai-animation-generator"
        || socialmedia?.sourceUseCase === "hotel-lobby-ai"
        || socialmedia?.sourceUseCase === "promo-video-maker"
        || socialmedia?.sourceUseCase === "spotify-canvas-generator"
      )
        && Boolean(prompt)
        && !isVideoContinuationInstruction(prompt ?? "");
    }) ?? null;
}

function buildVideoContinuationContextFromJob(params: {
  latestVideoJob: JobRecord;
  mode: "retry" | "continue";
  instruction: string;
}): VideoContinuationContext | null {
  const socialmedia = asSocialmediaPayload(params.latestVideoJob.payload);
  const previousPrompt = socialmedia?.inputText?.trim();
  if (!previousPrompt) return null;

  return {
    mode: params.mode,
    prompt: params.mode === "retry" ? previousPrompt : buildContinuationPrompt(previousPrompt, params.instruction),
    sourceAssets: socialmedia?.sourceAssets ?? [],
    inheritSourceAssets: true,
    aspectRatio: socialmedia?.aspectRatio,
    sourceJobId: params.latestVideoJob.id
  };
}

export function resolveVideoContinuationContext(sessionJobs: JobRecord[], content: string): VideoContinuationContext | null {
  const instruction = content.trim();
  const mode = isVideoRetryInstruction(instruction)
    ? "retry"
    : isVideoContinueInstruction(instruction)
      ? "continue"
      : null;
  if (!mode) return null;

  const latestVideoJob = findLatestVideoPromptJob(sessionJobs);
  return latestVideoJob ? buildVideoContinuationContextFromJob({ latestVideoJob, mode, instruction }) : null;
}

/**
 * Deterministic continuation used only after the Video Agent has failed.
 * At that point the caller has already confirmed that the latest turn is an
 * actionable video operation, so preserve the last executed prompt instead
 * of sending a fragment such as "make it warmer" by itself.
 */
export function resolveVideoAgentFallbackContinuationContext(params: {
  sessionJobs: JobRecord[];
  content: string;
  currentSourceAssets?: SocialmediaSourceAsset[];
}): VideoContinuationContext | null {
  const latestVideoJob = findLatestVideoPromptJob(params.sessionJobs);
  if (!latestVideoJob) return null;

  if (
    !referencesPreviousVideoContext(params.content)
    && !isImplicitVideoEditInstruction(params.content)
  ) return null;

  const currentSourceAssets = params.currentSourceAssets ?? [];
  if (currentSourceAssets.length > 0 && !referencesPreviousVideoContext(params.content)) {
    return null;
  }
  return buildVideoContinuationContextFromJob({
    latestVideoJob,
    mode: isVideoRetryInstruction(params.content) ? "retry" : "continue",
    instruction: params.content
  });
}

export async function resolveVideoContinuationContextWithLlm(params: {
  sessionJobs: JobRecord[];
  content: string;
  currentSourceAssets?: SocialmediaSourceAsset[];
  outputLanguage?: string;
  rewritePrompt?: VideoContinuationPromptRewriter;
}): Promise<VideoContinuationContext | null> {
  const currentSourceAssets = params.currentSourceAssets ?? [];
  if (currentSourceAssets.length > 0 && !referencesPreviousVideoContext(params.content)) {
    return null;
  }

  const explicitContext = resolveVideoContinuationContext(params.sessionJobs, params.content);
  const inheritSourceAssets = shouldInheritPreviousVideoSourceAssets(params.content, currentSourceAssets);
  if (explicitContext?.mode === "retry") {
    return { ...explicitContext, inheritSourceAssets };
  }

  const context = explicitContext ?? (() => {
    const latestVideoJob = findLatestVideoPromptJob(params.sessionJobs);
    return latestVideoJob
      ? buildVideoContinuationContextFromJob({
          latestVideoJob,
          mode: "continue",
          instruction: params.content
        })
      : null;
  })();
  if (!context) return null;

  const sourceJob = params.sessionJobs.find((job) => job.id === context.sourceJobId);
  const previousPrompt = sourceJob ? asSocialmediaPayload(sourceJob.payload)?.inputText?.trim() : undefined;
  const rewriteInput = buildVideoContinuationRewriteInput({
    ...context,
    prompt: previousPrompt || context.prompt
  }, params.content, currentSourceAssets);

  try {
    const llm = await (params.rewritePrompt ?? ((input) => rewriteVideoContinuationPrompt(input, params.outputLanguage)))(rewriteInput);
    if (!explicitContext && llm?.action !== "continue") return null;
    const prompt = normalizeLlmPrompt(llm?.prompt);
    if (prompt) return { ...context, prompt, inheritSourceAssets };
    return explicitContext ? { ...context, inheritSourceAssets } : null;
  } catch {
    return explicitContext ? { ...context, inheritSourceAssets } : null;
  }
}

function sourceAssetKeys(asset: SocialmediaSourceAsset): string[] {
  return [
    asset.assetId?.trim(),
    asset.path?.trim(),
    asset.url ? normalizeSupabaseStorageUrl(asset.url).trim() : undefined
  ].filter((key): key is string => Boolean(key));
}

export function mergeVideoContinuationSourceAssets(params: {
  currentSourceAssets: SocialmediaSourceAsset[];
  inheritedSourceAssets: SocialmediaSourceAsset[];
}): SocialmediaSourceAsset[] {
  const merged: SocialmediaSourceAsset[] = [];
  const seen = new Set<string>();
  const add = (asset: SocialmediaSourceAsset) => {
    const keys = sourceAssetKeys(asset);
    if (keys.length && keys.some((key) => seen.has(key))) return;
    keys.forEach((key) => seen.add(key));
    merged.push({
      ...asset,
      url: asset.url ? normalizeSupabaseStorageUrl(asset.url) : asset.url
    });
  };

  params.currentSourceAssets.forEach(add);
  params.inheritedSourceAssets.forEach(add);
  return merged;
}
