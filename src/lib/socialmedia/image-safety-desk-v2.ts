import { appConfig } from "@/lib/config";
import type { TelemetryEvent } from "@/lib/telemetry/axiom";
import { trackServerEvent } from "@/lib/telemetry/axiom";

type SafetyDeskResponseItem = {
  type?: string;
  name?: string;
  arguments?: string;
};

export type ImageSafetyDeskV2Decision = {
  action: "retry_with_rewrite" | "ask_replace_reference" | "ask_edit_prompt" | "ask_user_choose";
  reasonCode:
    | "benign_false_positive"
    | "third_party_ip"
    | "celebrity_likeness"
    | "nsfw"
    | "violence"
    | "reference_uncertain"
    | "prompt_uncertain";
  assistantReply: string;
  rewrittenPrompt?: string;
  useReferenceImages?: boolean;
  problematicReferenceIndexes?: number[];
  detectedEntities?: string[];
  promptIssues?: Array<{ quote: string; suggestion: string }>;
};

const ACTIONS = new Set<ImageSafetyDeskV2Decision["action"]>([
  "retry_with_rewrite",
  "ask_replace_reference",
  "ask_edit_prompt",
  "ask_user_choose"
]);

const REASON_CODES = new Set<ImageSafetyDeskV2Decision["reasonCode"]>([
  "benign_false_positive",
  "third_party_ip",
  "celebrity_likeness",
  "nsfw",
  "violence",
  "reference_uncertain",
  "prompt_uncertain"
]);

export const DEFAULT_IMAGE_SAFETY_DESK_V2_MODEL = "openai/gpt-5.6-luna";

export function resolveImageSafetyDeskV2Model(): string {
  return process.env.SOCIALMEDIA_IMAGE_SAFETY_DESK_V2_MODEL?.trim()
    || DEFAULT_IMAGE_SAFETY_DESK_V2_MODEL;
}

function normalizeString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizePrompt(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return normalized.length <= maxLength ? normalized : normalized.slice(0, maxLength).trimEnd();
}

function normalizeUniqueStrings(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => normalizeString(item, maxLength)).filter(Boolean))].slice(0, maxItems);
}

export function normalizeImageSafetyDeskV2Decision(
  value: unknown,
  referenceImageCount: number,
  canDropReferenceImages: boolean
): ImageSafetyDeskV2Decision | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const action = record.action;
  const reasonCode = record.reason_code;
  const assistantReply = normalizeString(record.assistant_reply, 600);
  if (
    typeof action !== "string"
    || !ACTIONS.has(action as ImageSafetyDeskV2Decision["action"])
    || typeof reasonCode !== "string"
    || !REASON_CODES.has(reasonCode as ImageSafetyDeskV2Decision["reasonCode"])
    || !assistantReply
  ) return null;

  const rewrittenPrompt = normalizePrompt(record.rewritten_prompt, 12_000);
  const useReferenceImages = record.use_reference_images !== false;
  if (action === "retry_with_rewrite") {
    if (reasonCode !== "benign_false_positive" || rewrittenPrompt.length < 40) return null;
    if (!canDropReferenceImages && referenceImageCount > 0 && !useReferenceImages) return null;
  }

  const problematicReferenceIndexes = Array.isArray(record.problematic_reference_indexes)
    ? [...new Set(record.problematic_reference_indexes
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item >= 1 && item <= referenceImageCount))]
        .slice(0, referenceImageCount)
    : [];
  if (action === "ask_replace_reference" && problematicReferenceIndexes.length === 0) return null;

  const promptIssues = Array.isArray(record.prompt_issues)
    ? record.prompt_issues.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const issue = item as Record<string, unknown>;
        const quote = normalizeString(issue.quote, 240);
        const suggestion = normalizeString(issue.suggestion, 360);
        return quote && suggestion ? [{ quote, suggestion }] : [];
      }).slice(0, 4)
    : [];
  if (action === "ask_edit_prompt" && promptIssues.length === 0) return null;

  const detectedEntities = normalizeUniqueStrings(record.detected_entities, 6, 120);
  return {
    action: action as ImageSafetyDeskV2Decision["action"],
    reasonCode: reasonCode as ImageSafetyDeskV2Decision["reasonCode"],
    assistantReply,
    ...(action === "retry_with_rewrite" ? { rewrittenPrompt, useReferenceImages } : {}),
    ...(problematicReferenceIndexes.length ? { problematicReferenceIndexes } : {}),
    ...(promptIssues.length ? { promptIssues } : {}),
    ...(detectedEntities.length ? { detectedEntities } : {})
  };
}

export function isImageSafetyDeskV2Enabled(agentVariant?: string): boolean {
  if (agentVariant !== "agent_v2" && agentVariant !== "pipeline") return false;
  const raw = (process.env.SOCIALMEDIA_IMAGE_SAFETY_DESK_V2_ENABLED ?? "true").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export async function decideImageSafetyDeskV2(params: {
  prompt: string;
  errorMessage: string;
  referenceImageUrls?: string[];
  userReferenceImageCount?: number;
  canDropReferenceImages?: boolean;
  allowAutomaticRetry?: boolean;
  language?: string;
  agentVariant?: string;
  telemetry?: Omit<TelemetryEvent, "event" | "source">;
}): Promise<ImageSafetyDeskV2Decision | null> {
  if (!isImageSafetyDeskV2Enabled(params.agentVariant)) return null;
  const config = appConfig.openrouterResponses;
  if (!config.enabled || !config.apiKey) return null;

  const referenceImageUrls = (params.referenceImageUrls ?? []).filter(Boolean);
  const referenceImageCount = referenceImageUrls.length;
  const userReferenceImageCount = Math.max(
    0,
    Math.min(referenceImageCount, Math.floor(params.userReferenceImageCount ?? referenceImageCount))
  );
  const generatedResultImageCount = referenceImageCount - userReferenceImageCount;
  const imageRoles = [
    ...Array.from({ length: generatedResultImageCount }, () => "current_generated_result"),
    ...Array.from({ length: userReferenceImageCount }, () => "user_supplied_reference")
  ];
  const attachedUrls = referenceImageUrls.slice(0, 4);
  const attachedRoles = imageRoles.slice(0, attachedUrls.length);
  const content: Array<Record<string, string>> = [{
    type: "input_text",
    text: JSON.stringify({
      generation_prompt: params.prompt,
      upstream_rejection: params.errorMessage.slice(0, 1200),
      reference_image_count: referenceImageCount,
      user_reference_image_count: userReferenceImageCount,
      attached_image_count: attachedUrls.length,
      attached_image_roles: attachedRoles,
      omitted_image_count: Math.max(0, referenceImageCount - attachedUrls.length),
      can_drop_reference_images: params.canDropReferenceImages !== false,
      allow_automatic_retry: params.allowAutomaticRetry !== false
    })
  }];
  attachedUrls.forEach((url) => content.push({ type: "input_image", image_url: url }));

  const instructions = [
    "You are Vismuse Safety Desk V2. You run only after an upstream image-generation rejection.",
    "Inspect the generation prompt and every attached image. Diagnose whether the likely trigger is the prompt, a specific reference image, or an ambiguous false positive.",
    "Do not bypass safety systems, make legal conclusions, or claim certainty. Be specific and actionable.",
    "When a user_supplied_reference visibly contains a recognizable franchise, character, logo, celebrity, or adult/NSFW content, choose ask_replace_reference and identify its 1-based position among user-supplied references. You may name clearly recognizable entities such as Nintendo or Mario Kart using cautious wording such as 'appears to contain'.",
    "Never include a current_generated_result or an omitted/unseen image in problematic_reference_indexes. If the current generated result seems to be the trigger, choose ask_user_choose and explain that the generated image cannot safely be reused.",
    "When the prompt itself contains the likely problem, choose ask_edit_prompt. Return only the smallest problematic quoted phrases and concise safer replacements. Do not ask the user to rewrite the whole request.",
    "Choose retry_with_rewrite only when neither the prompt nor the images show a clear restricted issue and this looks like an ambiguous false positive. Preserve the legitimate subject and factual details while rewriting the prompt into a clean, age-safe, non-infringing image prompt.",
    params.allowAutomaticRetry === false
      ? "Automatic retry is disabled for this request. Never choose retry_with_rewrite; ask the user to edit the smallest problematic prompt segment, replace the specific problematic reference, or choose how to proceed."
      : "Automatic retry is available for a validated benign false positive.",
    "Never use retry_with_rewrite to replace a protected character, celebrity, logo, sexualized subject, or other core subject with an invented substitute without user consent.",
    "When can_drop_reference_images=false, a retry must retain every image in the same order. If any image is problematic, ask the user to replace it instead of silently dropping it.",
    "Choose ask_user_choose when the available evidence cannot distinguish between a prompt issue and a reference-image issue.",
    `Write assistant_reply in ${params.language || "the user's language"}. It is shown directly to the user. Use one or two short sentences, explain the specific actionable issue, and never mention internal providers, policies, moderation systems, or error codes.`,
    "Return the decision only through the required function call."
  ].join(" ");

  const request = {
    model: resolveImageSafetyDeskV2Model(),
    instructions,
    input: [{ role: "user", content }],
    tools: [{
      type: "function",
      name: "decide_image_safety_recovery_v2",
      description: "Return the single safe post-rejection recovery decision.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: [...ACTIONS] },
          reason_code: { type: "string", enum: [...REASON_CODES] },
          assistant_reply: { type: "string", maxLength: 600 },
          rewritten_prompt: { type: ["string", "null"] },
          use_reference_images: { type: ["boolean", "null"] },
          problematic_reference_indexes: { type: "array", items: { type: "integer", minimum: 1 } },
          detected_entities: { type: "array", items: { type: "string" }, maxItems: 6 },
          prompt_issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                quote: { type: "string" },
                suggestion: { type: "string" }
              },
              required: ["quote", "suggestion"],
              additionalProperties: false
            },
            maxItems: 4
          }
        },
        required: [
          "action",
          "reason_code",
          "assistant_reply",
          "rewritten_prompt",
          "use_reference_images",
          "problematic_reference_indexes",
          "detected_entities",
          "prompt_issues"
        ],
        additionalProperties: false
      }
    }],
    tool_choice: "required"
  };

  const startedAt = Date.now();
  try {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(config.timeoutMs)
    });
    if (!response.ok) return null;
    const body = await response.json() as { output?: SafetyDeskResponseItem[] };
    const call = body.output?.find(
      (item) => item.type === "function_call" && item.name === "decide_image_safety_recovery_v2"
    );
    if (!call?.arguments) return null;
    const decision = normalizeImageSafetyDeskV2Decision(
      JSON.parse(call.arguments),
      userReferenceImageCount,
      params.canDropReferenceImages !== false
    );
    if (decision) {
      trackServerEvent({
        ...params.telemetry,
        event: "socialmedia.image.safety_desk_v2.completed",
        status: "success",
        stage: "image_generate",
        durationMs: Date.now() - startedAt,
        reason: `action=${decision.action};reason_code=${decision.reasonCode}`,
        apimartImageUrlCount: referenceImageCount
      });
    }
    return decision;
  } catch (error) {
    trackServerEvent({
      ...params.telemetry,
      event: "socialmedia.image.safety_desk_v2.failed",
      level: "warn",
      status: "failed",
      stage: "image_generate",
      durationMs: Date.now() - startedAt,
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}
