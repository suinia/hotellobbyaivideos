const GENERIC_GENERATION_FAILURE_MESSAGE = "We ran into a service issue. Please try again.";
export const GENERATION_SAFETY_BLOCKED_CODE = "GENERATION_SAFETY_BLOCKED";

const KNOWN_USER_FACING_FAILURE_MESSAGES = [
  [
    "the video could not be generated because content moderation flagged the prompt, a reference image, or the generated result.",
    "please adjust your prompt or input assets: revise the wording, or remove or replace the relevant reference image, then try again."
  ].join(" ")
];

const KNOWN_USER_FACING_FAILURE_PREFIXES = [
  "we ran into a service issue.",
  "the image system rejected this generation",
  "i can't generate images that copy",
  "the system detected sensitive information",
  "we couldn't generate this video because",
  "generation failed. the system detected a safety issue",
  "you've used your free video generation.",
  "basic includes images only."
];

const INTERNAL_GENERATION_ERROR_PATTERNS = [
  /\bagent v\d+\b/i,
  /\bimage builder(?: v\d+)?\b/i,
  /\bcritic (?:rejected|failed|returned|validation)\b/i,
  /\bsafety retry\b/i,
  /\brepaired plan\b/i,
  /\bplan_validation_[a-z0-9_]+\b/i,
  /\bcritic_rejected_[a-z0-9_]+\b/i
];

export type GenerationAgentSafetyResponse = {
  source: "image_safety_desk" | "image_builder_clarification";
  message: string;
};

export function isInternalGenerationError(input: unknown): boolean {
  const message = typeof input === "string" ? input.replace(/\s+/g, " ").trim() : "";
  return Boolean(message) && INTERNAL_GENERATION_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function readUserFacingAgentSafetyResponse(
  input: GenerationAgentSafetyResponse | undefined
): string | undefined {
  if (!input) return undefined;
  const message = input.message.replace(/\s+/g, " ").trim();
  if (!message || isInternalGenerationError(message)) return undefined;
  return message;
}

export function isGenerationCreditPaywallError(input: unknown, code?: string | null): boolean {
  if (code === "INSUFFICIENT_CREDITS") return true;

  const normalized = typeof input === "string" ? input.replace(/\s+/g, " ").trim().toLowerCase() : "";
  return /insufficient credits/i.test(normalized)
    || normalized.includes("insufficient_credits")
    || /you need [\d,]+ more credits/i.test(normalized)
    || normalized.includes("watermark-free images")
    || normalized.includes("used your current image generation credits")
    || normalized.includes("used your current video generation credits")
    || normalized.includes("used your free credits")
    || normalized.includes("used your free video generation")
    || normalized.includes("subscribe to keep generating videos")
    || normalized.includes("out of image credits")
    || normalized.includes("out of video credits");
}

/**
 * Job errors stay verbatim in storage and server telemetry for diagnosis.
 * This is the public boundary: never send provider payloads, request IDs, or
 * infrastructure details to a browser.
 */
export function toUserFacingGenerationError(input: unknown, options?: { isVideo?: boolean; code?: string | null }): string {
  if (options?.code === "VIDEO_SIGNUP_REQUIRED") return "Sign in to create video tasks.";
  const message = typeof input === "string" ? input.replace(/\s+/g, " ").trim() : "";
  if (!message) return GENERIC_GENERATION_FAILURE_MESSAGE;
  if (isInternalGenerationError(message)) return GENERIC_GENERATION_FAILURE_MESSAGE;
  // Only the server-classified, top-level Safety Desk reply receives this code.
  // Provider diagnostics and summaries must continue through the normal filter.
  if (options?.code === GENERATION_SAFETY_BLOCKED_CODE && !options.isVideo) return message;

  const normalized = message.toLowerCase();
  if (KNOWN_USER_FACING_FAILURE_MESSAGES.includes(normalized)) {
    return message;
  }
  if (KNOWN_USER_FACING_FAILURE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return message;
  }
  if (/you need \d+ more credits/i.test(message) && /video generation/i.test(message)) {
    return message;
  }
  if (isGenerationCreditPaywallError(message) && (options?.isVideo || /video/i.test(message))) {
    return "You've used your current video generation credits.";
  }
  if (isGenerationCreditPaywallError(message)) {
    return "You’re out of image credits.";
  }

  return GENERIC_GENERATION_FAILURE_MESSAGE;
}

export { GENERIC_GENERATION_FAILURE_MESSAGE };
