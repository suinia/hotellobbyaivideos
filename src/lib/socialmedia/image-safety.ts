import { generateApimartGptImages, type GenerateApimartImagesInput } from "@/lib/images/apimart-gpt-image";
import { isImageGenerationSafetyErrorMessage } from "@/lib/images/image-safety-error";
import { callGenericLlmJson } from "@/lib/llm/skill-client";
import { decideImageSafetyDeskV2 } from "@/lib/socialmedia/image-safety-desk-v2";
import { decideToapisSafetyRecovery, isToapisSafetyRecoveryAgentEnabled } from "@/lib/socialmedia/toapis-safety-recovery-agent";
import type { TelemetryEvent } from "@/lib/telemetry/axiom";
import { trackServerEvent } from "@/lib/telemetry/axiom";

type SocialImageTelemetryContext = Omit<TelemetryEvent, "event" | "source">;

export type ImageSafetyProviderFallbackResult =
  | { status: "not_applicable" }
  | { status: "completed"; imageUrls: string[]; provider: string }
  | { status: "safety_blocked"; model: string; error: string }
  | { status: "failed"; model?: string; error?: string };

type SafetyRewriteOutput = {
  prompt?: string;
  use_reference_images?: boolean;
  reason?: string;
};

type SafetyAssessmentOutput = {
  user_instruction_safe?: boolean;
  should_preserve_prompt?: boolean;
  has_strong_replaceable_terms?: boolean;
  replaceable_terms?: string[];
  risk_type?:
    | "unsafe_content"
    | "sexual_content"
    | "violence"
    | "self_harm"
    | "reference_image"
    | "third_party_ip"
    | "celebrity_likeness"
    | "ambiguous";
  reason?: string;
};

type SafeFashionRewriteResult = {
  prompt: string;
  reason: string;
  riskType: "sexualized_fashion_with_reference" | "sexualized_fashion";
  removedTerms: string[];
};

export const IMAGE_GENERATION_SAFETY_BLOCKED_MESSAGE = [
  "The image system did not accept this generation attempt.",
  "Please try again later or adjust the wording."
].join(" ");

export const IMAGE_GENERATION_REFERENCE_PRESERVED_SAFETY_BLOCKED_MESSAGE = [
  "The image system did not accept this generation attempt.",
  "Your original reference images are still saved; please try again later or adjust the wording."
].join(" ");

export const IMAGE_GENERATION_IP_BLOCKED_MESSAGE = [
  "I can't generate images that copy or closely imitate a known IP character, franchise, celebrity, logo, or official campaign.",
  "Please describe an original character, brand, or generic visual direction instead."
].join(" ");

export const REFERENCE_IMAGE_SAFETY_BLOCKED_CODE = "reference_image_safety_blocked";

export const REFERENCE_IMAGE_SAFETY_BLOCKED_MESSAGE = [
  "The image system rejected this generation because it detected unsafe content in the instruction or reference image.",
  "Please adjust the wording or upload a safer reference image, then try again."
].join(" ");

export class ImageGenerationAgentSafetyResponseError extends Error {
  readonly upstreamError: string;
  readonly warningCode?: string;

  constructor(message: string, upstreamError: string, warningCode?: string) {
    super(message);
    this.name = "ImageGenerationAgentSafetyResponseError";
    this.upstreamError = upstreamError;
    this.warningCode = warningCode;
  }
}

export function isImageGenerationAgentSafetyResponseError(
  error: unknown
): error is ImageGenerationAgentSafetyResponseError {
  return error instanceof ImageGenerationAgentSafetyResponseError;
}

export function isSocialmediaSafeRewriteEnabled(): boolean {
  const raw = process.env.SOCIALMEDIA_SAFE_REWRITE_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function isSocialmediaSafetyRecoveryEnabled(agentRequest?: boolean): boolean {
  return isSocialmediaSafeRewriteEnabled() || isToapisSafetyRecoveryAgentEnabled(agentRequest);
}

export function isImageGenerationSafetyBlocked(errorMessage: string): boolean {
  if (
    errorMessage === IMAGE_GENERATION_SAFETY_BLOCKED_MESSAGE
    || errorMessage === IMAGE_GENERATION_REFERENCE_PRESERVED_SAFETY_BLOCKED_MESSAGE
    || errorMessage === IMAGE_GENERATION_IP_BLOCKED_MESSAGE
  ) return true;
  return isImageGenerationSafetyErrorMessage(errorMessage);
}

export function isImageGenerationSafetyWarningCode(code: string): boolean {
  return code === "image_generation_safety_blocked"
    || code === REFERENCE_IMAGE_SAFETY_BLOCKED_CODE;
}

function safetyBlockedMessageForInput(input: {
  imageUrls?: string[];
  referenceImageCount?: number;
}): string {
  const referenceImageCount = input.referenceImageCount ?? input.imageUrls?.length ?? 0;
  return referenceImageCount > 0
    ? IMAGE_GENERATION_REFERENCE_PRESERVED_SAFETY_BLOCKED_MESSAGE
    : IMAGE_GENERATION_SAFETY_BLOCKED_MESSAGE;
}

function mustPreserveOrderedImageInputs(input: {
  imageUrls?: string[];
  allowDroppingReferenceImages?: boolean;
}): boolean {
  return input.allowDroppingReferenceImages === false
    && (input.imageUrls?.length ?? 0) > 0;
}

export function isReferenceImageGenerationSafetyBlocked(errorMessage: string): boolean {
  return errorMessage.toLowerCase().includes(REFERENCE_IMAGE_SAFETY_BLOCKED_CODE);
}

export function toUserFacingImageGenerationError(errorMessage: string): string {
  if (isReferenceImageGenerationSafetyBlocked(errorMessage)) {
    return REFERENCE_IMAGE_SAFETY_BLOCKED_MESSAGE;
  }
  return isImageGenerationSafetyBlocked(errorMessage)
    ? IMAGE_GENERATION_SAFETY_BLOCKED_MESSAGE
    : errorMessage;
}

export function imageGenerationWarningCode(errorMessage: string): string {
  if (isReferenceImageGenerationSafetyBlocked(errorMessage)) {
    return REFERENCE_IMAGE_SAFETY_BLOCKED_CODE;
  }
  return isImageGenerationSafetyBlocked(errorMessage)
    ? "image_generation_safety_blocked"
    : "image_generation_failed";
}

export function imageGenerationWarningMessage(params: {
  error: string;
  rawError?: string;
  attempts: number;
}): string {
  const raw = params.rawError ?? params.error;
  if (isReferenceImageGenerationSafetyBlocked(raw)) {
    return params.error;
  }
  return isImageGenerationSafetyBlocked(raw)
    ? params.error
    : `${params.error} (attempts: ${params.attempts})`;
}

function normalizeRewritePrompt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length >= 40 ? value.trim() : null;
}

const SEXUAL_SAFETY_ERROR_PATTERN = /safety_violations=\[?sexual|safety_violations=sexual|\bsexual\b/i;
const EXPLICIT_SEXUAL_REQUEST_PATTERN = /(?:裸体|裸露|色情|情色|性行为|做爱|性交|成人视频|未成年|幼女|少女|学生妹|\bnude\b|\bexplicit\b|\bporn(?:ographic)?\b|\bsex(?:ual)?\s+act\b)/i;
const RECOVERABLE_ADULT_FIGURE_PATTERN = /(?:性感(?:的)?(?:女郎|美女|女性|女人|模特)?|(?:女郎|美女|女性|女人|模特).{0,12}性感|\b(?:sexy|seductive)\s+(?:adult\s+)?(?:woman|women|female|model)s?\b)/i;
const INTELLECTUAL_PROPERTY_ASSESSMENT_PATTERN =
  /\b(?:copyright|copyrighted|intellectual property|\bip\b|third[-\s]?party|trademark|trademarked|franchise|fictional character|character name|movie title|studio|celebrity|actor likeness|official campaign|logo|marvel|dc comics|disney|pokemon|spider[-\s]?man|batman|superman)\b/i;
const VIOLENCE_ASSESSMENT_PATTERN = /\b(?:violence|violent|weapon|blood|gore|graphic injury|explosive|bomb|kill|shoot|gun)\b/i;
const HUMAN_SUBJECT_PATTERN = /\b(girl|woman|women|female|model|person|subject|portrait|selfie|face|hair|bangs)\b/i;
const FASHION_CONTEXT_PATTERN = /\b(outfit|wearing|clothing|fashion|style|styling|top|shorts|stockings|tights|legwarmers|leg warmers|sneakers|choker|necklace|bracelets|accessories|denim|y2k|emo|scene|alt)\b/i;

const SEXUALIZED_FASHION_TERM_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bbra\b/i, label: "bra" },
  { pattern: /\blingerie\b/i, label: "lingerie" },
  { pattern: /\bunderwear\b/i, label: "underwear" },
  { pattern: /\bstrapless\b/i, label: "strapless" },
  { pattern: /\bcorset(?:-|\s)?(?:like|style|inspired)?\b/i, label: "corset" },
  { pattern: /\bsheer\b/i, label: "sheer" },
  { pattern: /\bsemi[-\s]?sheer\b/i, label: "semi-sheer" },
  { pattern: /\btransparent\b/i, label: "transparent" },
  { pattern: /\bsee[-\s]?through\b/i, label: "see-through" },
  { pattern: /\bthigh[-\s]?high\b/i, label: "thigh-high" },
  { pattern: /\bvery short\b/i, label: "very short" },
  { pattern: /\bmicro\b/i, label: "micro" },
  { pattern: /\bgarter\b/i, label: "garter" },
  { pattern: /\bcleavage\b/i, label: "cleavage" },
  { pattern: /\bsexy\b/i, label: "sexy" },
  { pattern: /\bseductive\b/i, label: "seductive" },
  { pattern: /\berotic\b/i, label: "erotic" },
  { pattern: /\bprovocative\b/i, label: "provocative" },
  { pattern: /\bpeeking out\b/i, label: "peeking out" },
  { pattern: /\blace[-\s]?trimmed\b/i, label: "lace-trimmed" },
  { pattern: /\blace bands\b/i, label: "lace bands" }
];

const FINAL_PROMPT_FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  ...SEXUALIZED_FASHION_TERM_PATTERNS,
  { pattern: /\bpanties\b/i, label: "panties" },
  { pattern: /\bthong\b/i, label: "thong" },
  { pattern: /\bbarely\b/i, label: "barely" },
  { pattern: /\bskin[-\s]?tight\b/i, label: "skin-tight" },
  { pattern: /\bbody[-\s]?hugging\b/i, label: "body-hugging" }
];

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function collectPatternLabels(text: string, patterns: Array<{ pattern: RegExp; label: string }>): string[] {
  return uniqueStrings(patterns.filter((item) => item.pattern.test(text)).map((item) => item.label));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesAny(text: string, values: string[]): boolean {
  return values.some((value) => {
    const escaped = escapeRegex(value.trim()).replace(/\s+/g, "\\s+");
    const pattern = new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i");
    return pattern.test(text);
  });
}

function listFromDetections(items: Array<{ text: string; when: boolean }>, fallback: string): string {
  const detected = items.filter((item) => item.when).map((item) => item.text);
  return uniqueStrings(detected).join(", ") || fallback;
}

function isSexualizedFashionSafetyBlock(params: {
  prompt: string;
  errorMessage: string;
}): boolean {
  const prompt = extractUserRequestText(params.prompt);
  return (
    SEXUAL_SAFETY_ERROR_PATTERN.test(params.errorMessage)
    && HUMAN_SUBJECT_PATTERN.test(prompt)
    && FASHION_CONTEXT_PATTERN.test(prompt)
    && collectPatternLabels(prompt, SEXUALIZED_FASHION_TERM_PATTERNS).length > 0
  );
}

function extractUserRequestText(prompt: string): string {
  const matches = Array.from(prompt.matchAll(/(?:Current user request|Turn\s+\d+\s+user request):\s*"""([\s\S]*?)"""/gi))
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
  if (!matches.length) return prompt;

  return uniqueStrings(matches).join("\n");
}

function shouldSurfaceSafetyBlockInsteadOfRewrite(prompt: string): boolean {
  const userPrompt = extractUserRequestText(prompt);
  const hasVulnerablePose = /\b(collapsed|unconscious|passed out|fainted|corpse pose|lying completely flat)\b/i.test(userPrompt);
  const hasNamedPortraitSubject = /\bportrait of\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/.test(userPrompt);
  return hasVulnerablePose || hasNamedPortraitSubject;
}

export function validateSafeFashionRewritePrompt(prompt: string): string[] {
  const forbidden = collectPatternLabels(prompt, FINAL_PROMPT_FORBIDDEN_PATTERNS);
  const hasYouthCodedSubject = /\b(girl|teen|teenage|minor|child|kid)\b/i.test(prompt);
  return uniqueStrings([
    ...forbidden,
    hasYouthCodedSubject ? "youth-coded subject" : ""
  ]);
}

export function buildSafeFashionEditorialPrompt(params: {
  prompt: string;
  referenceImageCount: number;
}): SafeFashionRewriteResult | null {
  const userPrompt = extractUserRequestText(params.prompt);
  if (shouldSurfaceSafetyBlockInsteadOfRewrite(userPrompt)) {
    return null;
  }
  if (!isSexualizedFashionSafetyBlock({
    prompt: userPrompt,
    errorMessage: "safety_violations=[sexual]"
  })) {
    return null;
  }

  const normalized = userPrompt.toLowerCase();
  const removedTerms = collectPatternLabels(userPrompt, SEXUALIZED_FASHION_TERM_PATTERNS);
  const aesthetic = listFromDetections([
    { text: "alt", when: includesAny(normalized, ["alt", "alternative"]) },
    { text: "Y2K", when: includesAny(normalized, ["y2k"]) },
    { text: "scene/emo", when: includesAny(normalized, ["scene", "emo"]) },
    { text: "monochrome black-and-white", when: includesAny(normalized, ["black-and-white", "black and white", "monochrome"]) },
    { text: "streetwear", when: includesAny(normalized, ["streetwear", "rave", "fashion"]) }
  ], "fashion-editorial streetwear");
  const garments = listFromDetections([
    { text: "a structured sleeveless top with layered opaque fabric details", when: includesAny(normalized, ["top", "corset", "strapless", "bra", "underlayer"]) },
    { text: "high-waisted black denim styling", when: includesAny(normalized, ["denim", "shorts", "skirt"]) },
    { text: "opaque patterned tights", when: includesAny(normalized, ["stockings", "tights", "polka", "lace"]) },
    { text: "bold striped leg warmers", when: includesAny(normalized, ["legwarmers", "leg warmers", "striped"]) },
    { text: "gray faux-fur leg warmers", when: includesAny(normalized, ["fur", "faux-fur", "gray", "grey"]) },
    { text: "black low-top sneakers with white toe caps", when: includesAny(normalized, ["sneakers", "toe caps", "low-top"]) }
  ], "structured outerwear-inspired layering, opaque fabrics, and coordinated streetwear pieces");
  const accessories = listFromDetections([
    { text: "a black choker", when: includesAny(normalized, ["choker"]) },
    { text: "layered silver necklaces", when: includesAny(normalized, ["silver", "necklace", "cross"]) },
    { text: "chunky bracelets and wrist accessories", when: includesAny(normalized, ["bracelet", "wrist"]) },
    { text: "metal stud details", when: includesAny(normalized, ["stud", "studded"]) }
  ], "coordinated metallic accessories");
  const referencePolicy = params.referenceImageCount > 0
    ? [
        "",
        "Use the reference image only for broad non-sensitive visual context such as lighting, color mood, hairstyle silhouette, face framing, and general composition.",
        "Do not copy sensitive clothing, body emphasis, age cues, or suggestive styling from the reference image."
      ].join("\n")
    : "";
  const prompt = [
    `Create a fashion editorial image of an adult model in a ${aesthetic} outfit.`,
    "",
    `The look features ${garments}. Include ${accessories}.`,
    "",
    "Use a neutral confident pose and a full-body editorial composition. The outfit should be fully clothed, non-revealing, age-safe, fashion-focused, and made with opaque fabrics.",
    referencePolicy
  ].join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const finalViolations = validateSafeFashionRewritePrompt(prompt);
  if (finalViolations.length) {
    return null;
  }

  return {
    prompt,
    reason: "Reconstructed sexualized fashion wording into a fully clothed, age-safe fashion editorial prompt.",
    riskType: params.referenceImageCount > 0 ? "sexualized_fashion_with_reference" : "sexualized_fashion",
    removedTerms
  };
}

export function buildSafeAdultFigureRetryPrompt(params: {
  prompt: string;
  errorMessage: string;
}): SafeFashionRewriteResult | null {
  const userPrompt = extractUserRequestText(params.prompt);
  if (
    !SEXUAL_SAFETY_ERROR_PATTERN.test(params.errorMessage)
    || EXPLICIT_SEXUAL_REQUEST_PATTERN.test(userPrompt)
    || !RECOVERABLE_ADULT_FIGURE_PATTERN.test(userPrompt)
  ) {
    return null;
  }

  const prompt = userPrompt
    .replace(/性感(?:的)?(?=(?:女郎|美女|女性|女人|模特))/g, "优雅的")
    .replace(/性感/g, "优雅")
    .replace(/(?:女郎|美女)/g, "成年女性")
    .replace(/\bsexy\b/gi, "elegant")
    .replace(/\bseductive\b/gi, "poised")
    .replace(/\b(?:woman|women|female|model)s?\b/gi, "adult women");
  const safePrompt = [
    prompt,
    "Depict every person as a clearly adult, fully clothed, non-sexualized subject. Do not include nudity, erotic posing, or body emphasis."
  ].join("\n\n");

  return {
    prompt: safePrompt,
    reason: "Rewrote a non-explicit adult-figure request into a fully clothed, non-sexualized version for one retry.",
    riskType: "sexualized_fashion",
    removedTerms: ["sexualized adult-figure wording"]
  };
}

export function appendImageRequestCompletionNote(prompt: string): string {
  return [
    prompt.trim(),
    "",
    "The user is requesting image generation. Please complete the image as faithfully as possible."
  ].join("\n");
}

export type SafetyRewriteTaskInput = GenerateApimartImagesInput & {
  mode: "generate" | "edit" | "direct_multiturn";
  agentRequest?: boolean;
  telemetry?: SocialImageTelemetryContext;
  imageIndex?: number;
  allowDroppingReferenceImages?: boolean;
  referenceImageCount?: number;
  allowAutomaticRetry?: boolean;
};

export type SafetyRewriteTaskResult = {
  prompt: string;
  imageUrls?: string[];
  reason?: string;
  strategy: "clarification" | "rewrite";
};

async function assessPromptAfterSafetyBlock(params: {
  prompt: string;
  mode: "generate" | "edit" | "direct_multiturn";
  aspectRatio: string;
  referenceImageCount: number;
  errorMessage: string;
  telemetry?: SocialImageTelemetryContext;
  imageIndex?: number;
}): Promise<{ userInstructionSafe: boolean; hasStrongReplaceableTerms: boolean; riskType?: SafetyAssessmentOutput["risk_type"]; reason?: string } | null> {
  const startedAt = Date.now();
  const result = await callGenericLlmJson<SafetyAssessmentOutput>({
    debugLabel: "socialmedia-image-safety-assessment",
    temperature: 0,
    retrySameModelOnce: false,
    instruction: [
      "You classify an image-generation request after an upstream safety rejection.",
      "Decide whether the user's actual latest instruction is safe and neutral enough to preserve exactly, or whether it itself asks for sexualized, nude, revealing, intimate, fetish, exploitative, celebrity/IP-infringing, or otherwise unsafe content.",
      "A request to make an image clearer, sharper, more realistic, more like a provided person/reference, or to preserve a pose is safe when it does not itself ask for sexualized or unsafe content.",
      "Do not penalize a safe user instruction only because an upstream safety system rejected the reference image or previous generated image.",
      "Only set has_strong_replaceable_terms=true when there are explicit terms or phrases that are likely rejection triggers and can be narrowly replaced without changing the user's intent, such as sexualized clothing/body wording, nudity wording, or third-party IP/celebrity/official campaign wording.",
      "Set risk_type=third_party_ip for requests to generate or closely imitate known fictional characters, franchises, movie titles, studio-owned characters, trademarked logos, or official campaign assets.",
      "Set risk_type=celebrity_likeness for actor, celebrity, or public-figure likeness requests.",
      "Set risk_type=sexual_content for nudity, explicit sexual content, sexualized bodies, fetish wording, or adult-service promotion.",
      "Set risk_type=violence for gore, weapons, blood, credible harm, explosives, or graphic violence.",
      "Set risk_type=reference_image when the user's text is likely safe but uploaded or previous reference imagery is the likely trigger.",
      "If the user instruction is safe and the likely issue is the attached/current image, old context, or an ambiguous upstream rejection, set has_strong_replaceable_terms=false.",
      "Return JSON only."
    ].join("\n"),
    outputLanguage: "en",
    outputSchemaHint: JSON.stringify({
      user_instruction_safe: "boolean; true if the user's latest instruction can be preserved without rewriting",
      should_preserve_prompt: "boolean; true when a retry should keep the original prompt and only append a safety clarification",
      has_strong_replaceable_terms: "boolean; true only when specific trigger words can be narrowly replaced once",
      risk_type: "unsafe_content | sexual_content | violence | self_harm | reference_image | third_party_ip | celebrity_likeness | ambiguous",
      replaceable_terms: "string[]; exact words or short phrases that justify one narrow rewrite",
      reason: "string; short internal reason"
    }),
    input: {
      mode: params.mode,
      aspect_ratio: params.aspectRatio,
      reference_image_count: params.referenceImageCount,
      safety_error_summary: params.errorMessage.slice(0, 800),
      original_prompt: params.prompt
    }
  });

  if (typeof result?.user_instruction_safe !== "boolean") {
    trackServerEvent({
      ...params.telemetry,
      event: "socialmedia.image.safety_assessment.failed",
      level: "warn",
      status: "failed",
      stage: "image_generate",
      imageIndex: params.imageIndex,
      durationMs: Date.now() - startedAt,
      reason: "missing_boolean_decision"
    });
    return null;
  }

  const userInstructionSafe = result.user_instruction_safe === true && result.should_preserve_prompt !== false;
  const hasStrongReplaceableTerms = result.has_strong_replaceable_terms === true;
  trackServerEvent({
    ...params.telemetry,
    event: "socialmedia.image.safety_assessment.completed",
    status: "success",
    stage: "image_generate",
    imageIndex: params.imageIndex,
    durationMs: Date.now() - startedAt,
    mode: params.mode,
    reason: result.reason,
    safetyAssessment: userInstructionSafe ? "preserve_prompt" : "blocked_or_rewrite",
    riskType: result.risk_type,
    hasStrongReplaceableTerms,
    replaceableTerms: result.replaceable_terms
  });

  return {
    userInstructionSafe,
    hasStrongReplaceableTerms,
    riskType: result.risk_type,
    reason: result.reason
  };
}

export type ImageSafetyBlockReasonCode =
  | "ip_block"
  | "celebrity_block"
  | "sex_block"
  | "illicit_block"
  | "violence_block"
  | "self_harm_block"
  | "reference_image_block"
  | "safety_block";

export type ImageSafetyBlockExplanation = {
  message: string;
  reasonCode: ImageSafetyBlockReasonCode;
  reason?: string;
};

function imageSafetyBlockReasonText(reasonCode: ImageSafetyBlockReasonCode): string {
  switch (reasonCode) {
    case "ip_block":
      return "protected IP, franchise, character, logo, or official campaign references";
    case "celebrity_block":
      return "celebrity or public-figure likeness";
    case "sex_block":
      return "sexual, nude, adult, or body-focused content";
    case "illicit_block":
      return "illegal, illicit, or regulated activity";
    case "violence_block":
      return "violent, weapon-related, or graphic harm content";
    case "self_harm_block":
      return "self-harm or dangerous-instruction content";
    case "reference_image_block":
      return "the uploaded or reference image may have triggered the safety system";
    case "safety_block":
    default:
      return "sensitive content in the prompt or input assets";
  }
}

function appendImageSafetyReason(message: string, reasonCode: ImageSafetyBlockReasonCode): string {
  if (reasonCode === "safety_block") return message;
  return `${message} Possible reason: ${imageSafetyBlockReasonText(reasonCode)}.`;
}

function extractExplicitSafetyViolationReason(errorMessage: string): ImageSafetyBlockReasonCode | undefined {
  const match = errorMessage.match(/safety_violations\s*=\s*\[?([^\]\s.;,)]+)/i);
  const violation = match?.[1]?.trim().toLowerCase();
  if (!violation) return undefined;
  if (violation.includes("sexual") || violation.includes("sex") || violation.includes("nudity")) {
    return "sex_block";
  }
  if (violation.includes("illicit") || violation.includes("illegal")) {
    return "illicit_block";
  }
  if (violation.includes("violence") || violation.includes("violent") || violation.includes("weapon")) {
    return "violence_block";
  }
  if (violation.includes("self_harm") || violation.includes("self-harm") || violation.includes("suicide")) {
    return "self_harm_block";
  }
  return "safety_block";
}

function classifyImageSafetyBlockReason(params: {
  assessment: Awaited<ReturnType<typeof assessPromptAfterSafetyBlock>>;
  prompt: string;
  errorMessage: string;
  referenceImageCount: number;
}): ImageSafetyBlockReasonCode {
  const explicitReason = extractExplicitSafetyViolationReason(params.errorMessage);
  if (explicitReason) return explicitReason;
  const riskType = params.assessment?.riskType;
  const reason = params.assessment?.reason ?? "";
  const combined = [params.prompt, params.errorMessage, reason].join("\n");
  if (riskType === "third_party_ip" || INTELLECTUAL_PROPERTY_ASSESSMENT_PATTERN.test(combined)) {
    return "ip_block";
  }
  if (riskType === "celebrity_likeness") {
    return "celebrity_block";
  }
  if (riskType === "sexual_content" || SEXUAL_SAFETY_ERROR_PATTERN.test(combined)) {
    return "sex_block";
  }
  if (riskType === "violence" || VIOLENCE_ASSESSMENT_PATTERN.test(combined)) {
    return "violence_block";
  }
  if (riskType === "self_harm") {
    return "self_harm_block";
  }
  if (
    params.referenceImageCount > 0
    && (
      riskType === "reference_image"
      || (params.assessment?.userInstructionSafe && !params.assessment.hasStrongReplaceableTerms)
    )
  ) {
    return "reference_image_block";
  }
  return "safety_block";
}

export async function explainImageGenerationSafetyBlock(params: {
  prompt: string;
  mode: "generate" | "edit" | "direct_multiturn";
  aspectRatio: string;
  referenceImageCount: number;
  errorMessage: string;
  telemetry?: SocialImageTelemetryContext;
  imageIndex?: number;
}): Promise<ImageSafetyBlockExplanation> {
  const fallbackMessage = toUserFacingImageGenerationError(params.errorMessage);
  if (!isImageGenerationSafetyBlocked(params.errorMessage)) {
    return {
      message: fallbackMessage,
      reasonCode: "safety_block"
    };
  }

  const explicitReason = extractExplicitSafetyViolationReason(params.errorMessage);
  if (explicitReason) {
    trackServerEvent({
      ...params.telemetry,
      event: "socialmedia.image.safety_reason.completed",
      status: "success",
      stage: "image_generate",
      imageIndex: params.imageIndex,
      mode: params.mode,
      reasonCode: explicitReason,
      reason: "explicit_upstream_safety_violation",
      referenceImageCount: params.referenceImageCount
    });
    return {
      message: appendImageSafetyReason(fallbackMessage, explicitReason),
      reasonCode: explicitReason,
      reason: "explicit_upstream_safety_violation"
    };
  }

  let assessment: Awaited<ReturnType<typeof assessPromptAfterSafetyBlock>> = null;
  try {
    assessment = await assessPromptAfterSafetyBlock(params);
  } catch (assessmentError) {
    const assessmentMessage = assessmentError instanceof Error ? assessmentError.message : String(assessmentError);
    trackServerEvent({
      ...params.telemetry,
      event: "socialmedia.image.safety_reason.failed",
      level: "warn",
      status: "failed",
      stage: "image_generate",
      imageIndex: params.imageIndex,
      mode: params.mode,
      errorMessage: assessmentMessage
    });
  }

  const reasonCode = classifyImageSafetyBlockReason({
    assessment,
    prompt: params.prompt,
    errorMessage: params.errorMessage,
    referenceImageCount: params.referenceImageCount
  });
  trackServerEvent({
    ...params.telemetry,
    event: "socialmedia.image.safety_reason.completed",
    status: "success",
    stage: "image_generate",
    imageIndex: params.imageIndex,
    mode: params.mode,
    reasonCode,
    reason: assessment?.reason,
    riskType: assessment?.riskType,
    referenceImageCount: params.referenceImageCount
  });

  return {
    message: fallbackMessage,
    reasonCode,
    reason: assessment?.reason
  };
}

function isThirdPartyIpSafetyAssessment(
  assessment: Awaited<ReturnType<typeof assessPromptAfterSafetyBlock>>
): boolean {
  if (!assessment) return false;
  if (assessment.riskType === "third_party_ip" || assessment.riskType === "celebrity_likeness") return true;
  return INTELLECTUAL_PROPERTY_ASSESSMENT_PATTERN.test(assessment.reason ?? "");
}

async function rewritePromptAfterSafetyBlock(params: {
  prompt: string;
  mode: "generate" | "edit" | "direct_multiturn";
  aspectRatio: string;
  referenceImageCount: number;
  allowDroppingReferenceImages?: boolean;
  errorMessage: string;
  telemetry?: SocialImageTelemetryContext;
  imageIndex?: number;
}): Promise<{ prompt: string; useReferenceImages: boolean; reason?: string } | null> {
  const startedAt = Date.now();
  if (isSexualizedFashionSafetyBlock({
    prompt: params.prompt,
    errorMessage: params.errorMessage
  })) {
    if (shouldSurfaceSafetyBlockInsteadOfRewrite(params.prompt)) {
      trackServerEvent({
        ...params.telemetry,
        event: "socialmedia.image.safety_rewrite.blocked",
        level: "warn",
        status: "blocked",
        stage: "image_generate",
        imageIndex: params.imageIndex,
        durationMs: Date.now() - startedAt,
        mode: params.mode,
        reason: "semantic_rewrite_would_change_user_intent"
      });
      return null;
    }
    const reconstructed = buildSafeFashionEditorialPrompt({
      prompt: params.prompt,
      referenceImageCount: params.referenceImageCount
    });
    if (reconstructed) {
      const useReferenceImages = params.allowDroppingReferenceImages
        ? params.referenceImageCount > 0
        : true;
      trackServerEvent({
        ...params.telemetry,
        event: "socialmedia.image.safety_rewrite.completed",
        status: "success",
        stage: "image_generate",
        imageIndex: params.imageIndex,
        durationMs: Date.now() - startedAt,
        mode: params.mode,
        apimartImageUrlCount: useReferenceImages ? params.referenceImageCount : 0,
        reason: reconstructed.reason,
        rewriteStrategy: "safe_intent_reconstruct",
        riskType: reconstructed.riskType,
        referencePolicy: params.referenceImageCount > 0 ? "non_sensitive_context_only" : "none",
        blockedTermsRemoved: reconstructed.removedTerms,
        promptPreview: reconstructed.prompt.slice(0, 800)
      });
      return {
        prompt: reconstructed.prompt,
        useReferenceImages,
        reason: reconstructed.reason
      };
    }
  }

  const result = await callGenericLlmJson<SafetyRewriteOutput>({
    debugLabel: "socialmedia-image-safety-rewrite",
    temperature: 0.1,
    retrySameModelOnce: false,
    instruction: [
      "You rewrite image-generation prompts after a safety rejection.",
      "Your job is not to bypass safety systems. Preserve legitimate visual intent while converting unsafe wording into a clean, age-safe image prompt.",
      "Prefer semantic reconstruction over small word swaps when the original prompt combines human subjects with revealing, intimate, body-focused, or sexualized fashion language.",
      "For fashion styling requests, extract the safe visual intent first: aesthetic, color palette, silhouette, materials, accessories, composition, and neutral pose. Then rebuild a fully clothed fashion-editorial prompt from those safe elements.",
      "Do not preserve sensitive clothing or body-emphasis terms just because they are part of the original request. Replace them with outerwear-inspired, opaque, non-revealing fashion language.",
      "Avoid these terms in the final prompt: bra, panties, lingerie, underwear, garter, thong, cleavage, see-through, transparent, sheer, barely, very short, micro, thigh-high, erotic, sexy, seductive, provocative, strapless, skin-tight, body-hugging.",
      "Use positive safe wording in the final prompt, such as fully clothed, opaque fabrics, non-revealing styling, neutral pose, fashion editorial, streetwear-inspired, and age-safe adult model.",
      "Also neutralize third-party entertainment IP, fictional character names, movie titles, celebrity or actor likenesses, studio names, theater-chain names, franchise titles, official poster language, trademarked logos, and requests that imply an authorized campaign when they are not essential.",
      "For IP or brand-triggered poster requests, convert the concept into an original, non-infringing alternative: keep the genre, mood, layout, color direction, and poster format, but replace real names with generic original descriptors.",
      "Example: rewrite a request for a Cinemark movie poster for Madam Web 2 as an original theatrical-style poster for a fictional spider-themed superhero thriller sequel, with no real theater logo, real film title, studio branding, actors, or official campaign marks.",
      "Keep user-owned brand names, event details, offer text, product details, layout direction, platform constraints, and readable advertising goals when they are not likely rejection triggers.",
      "Replace body-focused descriptions with neutral wellness, lifestyle, fashion, fitness, or commercial model language.",
      "Use only age-appropriate, tasteful, clothed commercial models if people are necessary.",
      "If the prompt contains old multi-turn context that is irrelevant to the current new design, drop that old context.",
      "If a person in a reference image may be underage or age-ambiguous, do not apply revealing, intimate, body-emphasizing, or sexualized fashion transformations to that person.",
      "When reference images must be kept, use them only for broad non-sensitive visual context such as lighting, color mood, hairstyle silhouette, face framing, and general composition.",
      "Do not describe the reference image as the source of truth for sensitive clothing, body shape, age cues, or suggestive styling.",
      "If reference images are optional and likely to reintroduce irrelevant or sensitive prior context, set use_reference_images=false.",
      "If can_drop_reference_images=false, reference images are required: keep them only as broad non-sensitive visual context and set use_reference_images=true.",
      "For safe enhancement requests like clearer, sharper, more realistic, more like the reference, preserve those exact goals and do not replace them with a generic concept.",
      "Return a practical prompt that can be sent to an image model."
    ].join("\n"),
    outputLanguage: "en",
    outputSchemaHint: JSON.stringify({
      prompt: "string; revised image-generation prompt",
      use_reference_images: "boolean; false only when references are optional and likely to reintroduce unsafe or irrelevant prior context",
      reason: "string; short internal reason"
    }),
    input: {
      mode: params.mode,
      aspect_ratio: params.aspectRatio,
      reference_image_count: params.referenceImageCount,
      can_drop_reference_images: Boolean(params.allowDroppingReferenceImages),
      safety_error_summary: params.errorMessage.slice(0, 800),
      original_prompt: params.prompt
    }
  });

  const prompt = normalizeRewritePrompt(result?.prompt);
  if (!prompt) {
    trackServerEvent({
      ...params.telemetry,
      event: "socialmedia.image.safety_rewrite.failed",
      level: "warn",
      status: "failed",
      stage: "image_generate",
      imageIndex: params.imageIndex,
      durationMs: Date.now() - startedAt,
      reason: "empty_or_invalid_rewrite"
    });
    return null;
  }

  const useReferenceImages = params.allowDroppingReferenceImages
    ? result?.use_reference_images !== false
    : true;
  const finalViolations = validateSafeFashionRewritePrompt(prompt);
  if (isSexualizedFashionSafetyBlock({
    prompt: params.prompt,
    errorMessage: params.errorMessage
  }) && finalViolations.length) {
    const reconstructed = buildSafeFashionEditorialPrompt({
      prompt: params.prompt,
      referenceImageCount: params.referenceImageCount
    });
    if (reconstructed) {
      trackServerEvent({
        ...params.telemetry,
        event: "socialmedia.image.safety_rewrite.completed",
        status: "success",
        stage: "image_generate",
        imageIndex: params.imageIndex,
        durationMs: Date.now() - startedAt,
        mode: params.mode,
        apimartImageUrlCount: useReferenceImages ? params.referenceImageCount : 0,
        reason: reconstructed.reason,
        rewriteStrategy: "safe_intent_reconstruct_fallback",
        riskType: reconstructed.riskType,
        referencePolicy: params.referenceImageCount > 0 ? "non_sensitive_context_only" : "none",
        blockedTermsRemoved: reconstructed.removedTerms,
        finalPromptRejectedTerms: finalViolations,
        promptPreview: reconstructed.prompt.slice(0, 800)
      });
      return {
        prompt: reconstructed.prompt,
        useReferenceImages,
        reason: reconstructed.reason
      };
    }
  }

  trackServerEvent({
    ...params.telemetry,
    event: "socialmedia.image.safety_rewrite.completed",
    status: "success",
    stage: "image_generate",
    imageIndex: params.imageIndex,
    durationMs: Date.now() - startedAt,
    mode: params.mode,
    apimartImageUrlCount: useReferenceImages ? params.referenceImageCount : 0,
    reason: result?.reason,
    rewriteStrategy: "llm_rewrite",
    referencePolicy: params.referenceImageCount > 0 ? "reference_context" : "none",
    promptPreview: prompt.slice(0, 800)
  });

  return {
    prompt,
    useReferenceImages,
    reason: result?.reason
  };
}

async function retryWithSafetyClarification(params: {
  input: GenerateApimartImagesInput & {
    mode: "generate" | "edit" | "direct_multiturn";
    telemetry?: SocialImageTelemetryContext;
    imageIndex?: number;
  };
  triggerErrorMessage: string;
}): Promise<{
  imageUrls: string[];
  provider: string;
}> {
  const startedAt = Date.now();

  trackServerEvent({
    ...params.input.telemetry,
    event: "socialmedia.image.safety_clarification_retry.started",
    status: "started",
    stage: "image_generate",
    imageIndex: params.input.imageIndex,
    mode: params.input.mode,
    apimartImageUrlCount: params.input.imageUrls?.length ?? 0,
    errorMessage: params.triggerErrorMessage,
    promptPreview: params.input.prompt.slice(0, 800)
  });

  try {
    const result = await generateApimartGptImages(params.input);

    trackServerEvent({
      ...params.input.telemetry,
      event: "socialmedia.image.safety_clarification_retry.completed",
      status: "success",
      stage: "image_generate",
      imageIndex: params.input.imageIndex,
      mode: params.input.mode,
      apimartImageUrlCount: result.imageUrls.length,
      reason: `provider=${result.provider}`,
      durationMs: Date.now() - startedAt
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    trackServerEvent({
      ...params.input.telemetry,
      event: "socialmedia.image.safety_clarification_retry.failed",
      level: "warn",
      status: "failed",
      stage: "image_generate",
      imageIndex: params.input.imageIndex,
      mode: params.input.mode,
      durationMs: Date.now() - startedAt,
      errorMessage: message
    });
    throw error;
  }
}

function buildReferenceSafetyBlockedError(errorMessage: string): Error {
  return new Error(`${REFERENCE_IMAGE_SAFETY_BLOCKED_CODE}: ${errorMessage}`);
}

function withSubmitFailureTelemetry<T extends GenerateApimartImagesInput & {
  mode: "generate" | "edit" | "direct_multiturn";
  telemetry?: SocialImageTelemetryContext;
}>(input: T): T {
  if (input.onSubmitAttemptFailed || !input.telemetry) return input;
  return {
    ...input,
    onSubmitAttemptFailed: (failure) => {
      trackServerEvent({
        ...input.telemetry,
        event: "socialmedia.image_provider.submit.failed",
        level: "warn",
        status: failure.willFallback ? "fallback" : failure.willRetry ? "retrying" : "failed",
        stage: "image_generate",
        apimartModel: `${failure.provider ?? "apimart"}:${failure.model}`,
        statusCode: failure.statusCode,
        errorMessage: failure.errorMessage,
        rawErrorMessage: failure.rawErrorMessage,
        apimartImageUrlCount: input.imageUrls?.length ?? 0,
        promptPreview: input.prompt.slice(0, 800),
        reason: [
          `attempt=${failure.attempt}/${failure.maxAttempts}`,
          `provider=${failure.provider ?? "apimart"}`,
          `retry=${failure.willRetry ? "1" : "0"}`,
          `fallback=${failure.willFallback ? "1" : "0"}`
        ].join(";")
      });
    }
  };
}

export async function prepareApimartSafetyRewriteTask(params: {
  input: SafetyRewriteTaskInput;
  triggerErrorMessage: string;
}): Promise<SafetyRewriteTaskResult> {
  // A terminal Pipeline Nano safety block is classified by Safety Desk even
  // though ordinary Pipeline recovery is disabled. `allowAutomaticRetry: false`
  // is the explicit terminal boundary: it may explain, but cannot launch an image.
  if (
    !isSocialmediaSafetyRecoveryEnabled(params.input.agentRequest)
    && params.input.allowAutomaticRetry !== false
  ) {
    const userFacingError = toUserFacingImageGenerationError(params.triggerErrorMessage);
    throw new Error(
      userFacingError === IMAGE_GENERATION_SAFETY_BLOCKED_MESSAGE
        ? safetyBlockedMessageForInput(params.input)
        : userFacingError
    );
  }

  const agentVariant = params.input.telemetry?.agentVariant === "agent_v2"
    ? "agent_v2"
    : params.input.telemetry?.agentVariant === "agent_v1"
      ? "agent_v1"
      : params.input.agentRequest === false
        ? "pipeline"
        : undefined;
  const safetyDeskV2 = await decideImageSafetyDeskV2({
    prompt: params.input.prompt,
    errorMessage: params.triggerErrorMessage,
    referenceImageUrls: params.input.imageUrls,
    userReferenceImageCount: params.input.referenceImageCount,
    canDropReferenceImages: params.input.allowDroppingReferenceImages !== false,
    allowAutomaticRetry: params.input.allowAutomaticRetry !== false,
    language: params.input.visibleTextLanguage,
    agentVariant,
    telemetry: params.input.telemetry
  });
  if (safetyDeskV2?.action === "retry_with_rewrite" && safetyDeskV2.rewrittenPrompt) {
    if (params.input.allowAutomaticRetry === false) {
      throw new ImageGenerationAgentSafetyResponseError(
        safetyBlockedMessageForInput(params.input),
        params.triggerErrorMessage
      );
    }
    return {
      prompt: appendImageRequestCompletionNote(safetyDeskV2.rewrittenPrompt),
      imageUrls: safetyDeskV2.useReferenceImages === false
        ? undefined
        : params.input.imageUrls,
      reason: safetyDeskV2.assistantReply,
      strategy: "rewrite"
    };
  }
  if (safetyDeskV2) {
    const totalImageCount = params.input.imageUrls?.length ?? 0;
    const userReferenceImageCount = Math.max(
      0,
      Math.min(totalImageCount, Math.floor(params.input.referenceImageCount ?? totalImageCount))
    );
    const generatedResultImageCount = totalImageCount - userReferenceImageCount;
    const absoluteProblematicReferenceIndexes = safetyDeskV2.problematicReferenceIndexes?.map(
      (index) => index + generatedResultImageCount
    );
    throw new ImageGenerationAgentSafetyResponseError(
      safetyDeskV2.assistantReply,
      params.triggerErrorMessage,
      safetyDeskV2.action === "ask_replace_reference"
        ? `${REFERENCE_IMAGE_SAFETY_BLOCKED_CODE}[${absoluteProblematicReferenceIndexes?.join(",") ?? ""}]`
        : undefined
    );
  }

  if (params.input.allowAutomaticRetry === false) {
    throw new ImageGenerationAgentSafetyResponseError(
      safetyBlockedMessageForInput(params.input),
      params.triggerErrorMessage
    );
  }

  const recovery = await decideToapisSafetyRecovery({
    prompt: params.input.prompt,
    errorMessage: params.triggerErrorMessage,
    referenceImageUrls: params.input.imageUrls,
    userReferenceImageCount: params.input.referenceImageCount,
    canDropReferenceImages: params.input.allowDroppingReferenceImages !== false,
    language: params.input.visibleTextLanguage,
    agentRequest: params.input.agentRequest
  });
  if (recovery?.action === "retry_unchanged") {
    trackServerEvent({
      ...params.input.telemetry,
      event: "socialmedia.image.safety_retry_unchanged",
      status: "ready",
      stage: "image_generate",
      imageIndex: params.input.imageIndex,
      mode: params.input.mode,
      apimartImageUrlCount: params.input.imageUrls?.length ?? 0,
      reason: recovery.assistantReply
    });
    return {
      prompt: params.input.prompt,
      imageUrls: params.input.imageUrls,
      reason: recovery.assistantReply,
      strategy: "clarification"
    };
  }
  if (recovery?.action === "ask_user_replace_reference") {
    if ((params.input.referenceImageCount ?? 0) > 0) {
      throw buildReferenceSafetyBlockedError(recovery.assistantReply);
    }
    throw new Error(safetyBlockedMessageForInput(params.input));
  }
  if (recovery) {
    throw new ImageGenerationAgentSafetyResponseError(
      recovery.assistantReply,
      params.triggerErrorMessage
    );
  }
  if (isToapisSafetyRecoveryAgentEnabled(params.input.agentRequest)) {
    // Agent-mode recovery is classification-only. If the classifier is
    // unavailable or invalid, never fall through to a free-form prompt
    // rewriter that could replace the user's subject or core intent.
    throw new Error(safetyBlockedMessageForInput(params.input));
  }

  let assessment: Awaited<ReturnType<typeof assessPromptAfterSafetyBlock>> = null;
  try {
    assessment = await assessPromptAfterSafetyBlock({
      prompt: params.input.prompt,
      mode: params.input.mode,
      aspectRatio: params.input.aspectRatio,
      referenceImageCount: params.input.imageUrls?.length ?? 0,
      errorMessage: params.triggerErrorMessage,
      telemetry: params.input.telemetry,
      imageIndex: params.input.imageIndex
    });
  } catch (assessmentError) {
    const assessmentMessage = assessmentError instanceof Error ? assessmentError.message : String(assessmentError);
    trackServerEvent({
      ...params.input.telemetry,
      event: "socialmedia.image.safety_assessment.failed",
      level: "warn",
      status: "failed",
      stage: "image_generate",
      imageIndex: params.input.imageIndex,
      mode: params.input.mode,
      errorMessage: assessmentMessage
    });
  }

  if (assessment?.userInstructionSafe && !assessment.hasStrongReplaceableTerms) {
    return {
      prompt: params.input.prompt,
      imageUrls: params.input.imageUrls,
      reason: assessment.reason,
      strategy: "clarification"
    };
  }

  if (isThirdPartyIpSafetyAssessment(assessment)) {
    trackServerEvent({
      ...params.input.telemetry,
      event: "socialmedia.image.safety_rewrite.blocked",
      level: "warn",
      status: "blocked",
      stage: "image_generate",
      imageIndex: params.input.imageIndex,
      mode: params.input.mode,
      reason: assessment?.reason,
      riskType: assessment?.riskType,
      blockedReason: "third_party_ip"
    });
    throw new Error(IMAGE_GENERATION_IP_BLOCKED_MESSAGE);
  }

  if (!assessment?.hasStrongReplaceableTerms) {
    throw new Error(safetyBlockedMessageForInput(params.input));
  }

  if (mustPreserveOrderedImageInputs(params.input)) {
    trackServerEvent({
      ...params.input.telemetry,
      event: "socialmedia.image.safety_rewrite.blocked",
      level: "warn",
      status: "blocked",
      stage: "image_generate",
      imageIndex: params.input.imageIndex,
      mode: params.input.mode,
      reason: "required_ordered_image_inputs_cannot_be_semantically_rewritten"
    });
    throw new Error(safetyBlockedMessageForInput(params.input));
  }

  trackServerEvent({
    ...params.input.telemetry,
    event: "socialmedia.image.safety_rewrite.started",
    status: "started",
    stage: "image_generate",
    imageIndex: params.input.imageIndex,
    mode: params.input.mode,
    apimartImageUrlCount: params.input.imageUrls?.length ?? 0,
    errorMessage: params.triggerErrorMessage
  });

  const rewrite = await rewritePromptAfterSafetyBlock({
    prompt: params.input.prompt,
    mode: params.input.mode,
    aspectRatio: params.input.aspectRatio,
    referenceImageCount: params.input.imageUrls?.length ?? 0,
    allowDroppingReferenceImages: params.input.allowDroppingReferenceImages,
    errorMessage: params.triggerErrorMessage,
    telemetry: params.input.telemetry,
    imageIndex: params.input.imageIndex
  });

  if (!rewrite) {
    throw new Error(safetyBlockedMessageForInput(params.input));
  }

  return {
    prompt: appendImageRequestCompletionNote(rewrite.prompt),
    imageUrls: rewrite.useReferenceImages ? params.input.imageUrls : undefined,
    reason: rewrite.reason,
    strategy: "rewrite"
  };
}

async function retryWithSafetyRewrite(params: {
  input: GenerateApimartImagesInput & {
    mode: "generate" | "edit" | "direct_multiturn";
    telemetry?: SocialImageTelemetryContext;
    imageIndex?: number;
    allowDroppingReferenceImages?: boolean;
    referenceImageCount?: number;
  };
  triggerErrorMessage: string;
}): Promise<{
  imageUrls: string[];
  provider: string;
}> {
  trackServerEvent({
    ...params.input.telemetry,
    event: "socialmedia.image.safety_rewrite.started",
    status: "started",
    stage: "image_generate",
    imageIndex: params.input.imageIndex,
    mode: params.input.mode,
    apimartImageUrlCount: params.input.imageUrls?.length ?? 0,
    errorMessage: params.triggerErrorMessage
  });

  let rewrite: Awaited<ReturnType<typeof rewritePromptAfterSafetyBlock>>;
  try {
    rewrite = await rewritePromptAfterSafetyBlock({
      prompt: params.input.prompt,
      mode: params.input.mode,
      aspectRatio: params.input.aspectRatio,
      referenceImageCount: params.input.imageUrls?.length ?? 0,
      allowDroppingReferenceImages: params.input.allowDroppingReferenceImages,
      errorMessage: params.triggerErrorMessage,
      telemetry: params.input.telemetry,
      imageIndex: params.input.imageIndex
    });
  } catch (rewriteError) {
    const message = rewriteError instanceof Error ? rewriteError.message : String(rewriteError);
    trackServerEvent({
      ...params.input.telemetry,
      event: "socialmedia.image.safety_rewrite.failed",
      level: "warn",
      status: "failed",
      stage: "image_generate",
      imageIndex: params.input.imageIndex,
      mode: params.input.mode,
      errorMessage: message
    });
    throw new Error(safetyBlockedMessageForInput(params.input));
  }

  if (!rewrite) {
    throw new Error(safetyBlockedMessageForInput(params.input));
  }

  const rewrittenInput = {
    ...params.input,
    prompt: appendImageRequestCompletionNote(rewrite.prompt),
    imageUrls: rewrite.useReferenceImages ? params.input.imageUrls : undefined
  };

  try {
    return await generateApimartGptImages(rewrittenInput);
  } catch (retryError) {
    const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
    if (!isImageGenerationSafetyBlocked(retryMessage)) {
      throw retryError;
    }

    // A second job-level moderation rejection does not identify which input
    // caused it. The multimodal recovery decision already chose to retain the
    // references, so do not override that decision merely because images were
    // attached. Preserve them for a later retry and report an ambiguous block.
    throw new Error(safetyBlockedMessageForInput(params.input));
  }
}

export async function generateApimartGptImagesWithSafetyRewrite(input: GenerateApimartImagesInput & {
  mode: "generate" | "edit" | "direct_multiturn";
  agentRequest?: boolean;
  telemetry?: SocialImageTelemetryContext;
  imageIndex?: number;
  allowDroppingReferenceImages?: boolean;
  referenceImageCount?: number;
  safetyProviderFallback?: (triggerError: string) => Promise<ImageSafetyProviderFallbackResult>;
}): Promise<{
  imageUrls: string[];
  provider: string;
}> {
  const trackedInput = withSubmitFailureTelemetry(input);
  try {
    return await generateApimartGptImages(trackedInput);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isImageGenerationSafetyBlocked(message)) {
      throw error;
    }
    let recoveryErrorMessage = message;
    let fallbackWasSafetyBlocked = false;
    if (input.safetyProviderFallback) {
      const fallback = await input.safetyProviderFallback(message);
      if (fallback.status === "completed") {
        return { imageUrls: fallback.imageUrls, provider: fallback.provider };
      }
      if (fallback.status === "safety_blocked") {
        recoveryErrorMessage = fallback.error;
        fallbackWasSafetyBlocked = true;
      }
    }

    if (fallbackWasSafetyBlocked) {
      await prepareApimartSafetyRewriteTask({
        input: {
          ...input,
          n: input.n,
          imageUrls: input.imageUrls,
          mode: input.mode,
          allowAutomaticRetry: false
        },
        triggerErrorMessage: recoveryErrorMessage
      });
      throw new Error(safetyBlockedMessageForInput(input));
    }

    if (!isSocialmediaSafetyRecoveryEnabled(input.agentRequest)) {
      const userFacingMessage = toUserFacingImageGenerationError(message);
      throw new Error(
        userFacingMessage === IMAGE_GENERATION_SAFETY_BLOCKED_MESSAGE
          ? safetyBlockedMessageForInput(input)
          : userFacingMessage
      );
    }

    // Agent recovery takes precedence when enabled. Its response can either
    // safely retry or become the user-facing explanation for this failure.
    if (isToapisSafetyRecoveryAgentEnabled(input.agentRequest)) {
      const rewrite = await prepareApimartSafetyRewriteTask({
        input: {
          ...input,
          n: input.n,
          imageUrls: input.imageUrls,
          mode: input.mode,
          allowAutomaticRetry: !fallbackWasSafetyBlocked
        },
        triggerErrorMessage: recoveryErrorMessage
      });
      try {
        return await generateApimartGptImages({
          ...trackedInput,
          prompt: rewrite.prompt,
          imageUrls: rewrite.imageUrls
        });
      } catch (retryError) {
        const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
        if (!isImageGenerationSafetyBlocked(retryMessage)) throw retryError;
        throw new Error(safetyBlockedMessageForInput(input));
      }
    }

    let assessment: Awaited<ReturnType<typeof assessPromptAfterSafetyBlock>> = null;
    try {
      assessment = await assessPromptAfterSafetyBlock({
        prompt: input.prompt,
        mode: input.mode,
        aspectRatio: input.aspectRatio,
        referenceImageCount: input.imageUrls?.length ?? 0,
        errorMessage: message,
        telemetry: input.telemetry,
        imageIndex: input.imageIndex
      });
    } catch (assessmentError) {
      const assessmentMessage = assessmentError instanceof Error ? assessmentError.message : String(assessmentError);
      trackServerEvent({
        ...input.telemetry,
        event: "socialmedia.image.safety_assessment.failed",
        level: "warn",
        status: "failed",
        stage: "image_generate",
        imageIndex: input.imageIndex,
        mode: input.mode,
        errorMessage: assessmentMessage
      });
    }

    if (assessment?.userInstructionSafe && !assessment.hasStrongReplaceableTerms) {
      try {
        return await retryWithSafetyClarification({
          input: trackedInput,
          triggerErrorMessage: message
        });
      } catch (retryError) {
        const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
        if (isImageGenerationSafetyBlocked(retryMessage)) {
          throw new Error(safetyBlockedMessageForInput(input));
        }
        throw retryError;
      }
    }

    if (isThirdPartyIpSafetyAssessment(assessment)) {
      trackServerEvent({
        ...input.telemetry,
        event: "socialmedia.image.safety_rewrite.blocked",
        level: "warn",
        status: "blocked",
        stage: "image_generate",
        imageIndex: input.imageIndex,
        mode: input.mode,
        reason: assessment?.reason,
        riskType: assessment?.riskType,
        blockedReason: "third_party_ip"
      });
      throw new Error(IMAGE_GENERATION_IP_BLOCKED_MESSAGE);
    }

    if (!assessment?.hasStrongReplaceableTerms) {
      throw new Error(safetyBlockedMessageForInput(input));
    }

    if (mustPreserveOrderedImageInputs(input)) {
      trackServerEvent({
        ...input.telemetry,
        event: "socialmedia.image.safety_rewrite.blocked",
        level: "warn",
        status: "blocked",
        stage: "image_generate",
        imageIndex: input.imageIndex,
        mode: input.mode,
        reason: "required_ordered_image_inputs_cannot_be_semantically_rewritten"
      });
      throw new Error(safetyBlockedMessageForInput(input));
    }

    return retryWithSafetyRewrite({
      input: trackedInput,
      triggerErrorMessage: message
    });
  }
}
