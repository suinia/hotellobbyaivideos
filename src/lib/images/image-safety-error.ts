/**
 * Canonical provider-facing safety rejection matcher.
 *
 * Keep this module dependency-free so generation clients and social-media
 * recovery can share the same routing decision without creating import cycles.
 */
export function isImageGenerationSafetyErrorMessage(errorMessage: string): boolean {
  const normalized = errorMessage.toLowerCase();
  return normalized.includes("reference_image_safety_blocked")
    || normalized.includes("moderation_blocked")
    || normalized.includes("safety_violations")
    || normalized.includes("image_generation_user_error")
    || normalized.includes("your request was rejected by the safety system")
    || normalized.includes("rejected by the safety system")
    || normalized.includes("filtered by the safety system")
    || normalized.includes("prompt or input was rejected by the content safety system")
    || normalized.includes("rejected by the content safety system")
    || normalized.includes("rejected by content safety system")
    || normalized.includes("content_policy")
    || normalized.includes("detected unsafe content")
    || normalized.includes("generated images appear to be unsafe")
    || normalized.includes("flagged as containing prohibited words or images")
    || normalized.includes("i can't help generate or design")
    || normalized.includes("i cannot create sexually explicit")
    || normalized.includes("sexual services")
    || normalized.includes("sexually explicit paid content")
    || normalized.includes("pornographic content")
    || normalized.includes("违反平台政策");
}
