import { appConfig } from "@/lib/config";

export type SafetyRecoveryDecision = {
  action:
    | "retry_unchanged"
    | "ask_user_replace_reference"
    | "ask_user_modify_request";
  assistantReply: string;
};

type ResponseItem = {
  type?: string;
  name?: string;
  arguments?: string;
};

export function isToapisSafetyRecoveryAgentEnabled(agentRequest?: boolean) {
  const effectiveAgentRequest = agentRequest ?? appConfig.socialmedia.inputMode === "agent";
  if (!effectiveAgentRequest) return false;
  const raw = (process.env.SOCIALMEDIA_SAFETY_RECOVERY_AGENT_ENABLED ?? "true").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function normalizeSafetyRecoveryAssistantReply(value: unknown): string {
  if (typeof value !== "string") return "";

  // Some model responses double-escape newlines in function arguments. Those
  // must be rendered as normal text, never shown to the user as "\\n".
  const normalized = value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n|\\r/g, "\n")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // The response is an explanation of the next step, not a place to expose a
  // full replacement prompt. The Responses schema asks for this limit too;
  // retaining it here makes the UI resilient to a non-conforming model reply.
  return normalized.length <= 360 ? normalized : `${normalized.slice(0, 357).trimEnd()}…`;
}

function parseDecision(value: string | undefined): SafetyRecoveryDecision | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const action = parsed.action;
    const assistantReply = normalizeSafetyRecoveryAssistantReply(parsed.assistant_reply);
    if (
      !assistantReply
      || (
        action !== "retry_unchanged"
        && action !== "ask_user_replace_reference"
        && action !== "ask_user_modify_request"
      )
    ) return null;
    return {
      action,
      assistantReply
    };
  } catch {
    return null;
  }
}

function isProtectedIpSafetyError(errorMessage: string): boolean {
  return /protected\s+ip|franchise|copyright|fictional character|character name|official campaign/i.test(errorMessage);
}

export function isUnsafeProtectedCharacterStandInRewrite(params: {
  safePrompt: string;
  errorMessage: string;
}): boolean {
  if (!isProtectedIpSafetyError(params.errorMessage)) return false;
  const affirmativePrompt = params.safePrompt.replace(
    /\b(?:avoid|exclude|no|remove|without)\b[^.!?\n]{0,180}\b(?:character|franchise|logo|lookalike|mascot|stand-in)\b[^.!?\n]*/gi,
    ""
  );
  return /\b(?:character|franchise|logo|lookalike|mascot|stand-in)\b/i.test(affirmativePrompt)
    && /\b(?:based\s+on|create|depict|feature|featuring|include|inspired\s+by|resembl(?:e|es|ing)|show|similar\s+to|styled\s+after)\b/i.test(affirmativePrompt);
}

export async function decideToapisSafetyRecovery(params: {
  prompt: string;
  errorMessage: string;
  referenceImageUrls?: string[];
  userReferenceImageCount?: number;
  canDropReferenceImages?: boolean;
  language?: string;
  agentRequest?: boolean;
}): Promise<SafetyRecoveryDecision | null> {
  const config = appConfig.toapisResponses;
  if (!isToapisSafetyRecoveryAgentEnabled(params.agentRequest) || !config.enabled || !config.apiKey) return null;

  const attachedImageCount = params.referenceImageUrls?.length ?? 0;
  const explicitUserReferenceImageCount = typeof params.userReferenceImageCount === "number"
    && Number.isFinite(params.userReferenceImageCount)
    ? params.userReferenceImageCount
    : attachedImageCount;
  const userReferenceImageCount = Math.max(
    0,
    Math.min(
      attachedImageCount,
      Math.floor(explicitUserReferenceImageCount)
    )
  );
  const currentGeneratedResultImageCount = attachedImageCount - userReferenceImageCount;
  const allImageRoles = [
    ...Array.from({ length: currentGeneratedResultImageCount }, () => "current_generated_result"),
    ...Array.from({ length: userReferenceImageCount }, () => "user_supplied_reference")
  ];
  const attachedImageUrls = (params.referenceImageUrls ?? []).slice(0, 4);
  const attachedImageRoles = allImageRoles.slice(0, attachedImageUrls.length);
  const attachedUserReferenceImageCount = attachedImageRoles
    .filter((role) => role === "user_supplied_reference")
    .length;
  const content: Array<Record<string, string>> = [{ type: "input_text", text: JSON.stringify({
    user_request: params.prompt,
    upstream_safety_error: params.errorMessage.slice(0, 900),
    total_input_image_count: attachedImageCount,
    attached_image_count: attachedImageUrls.length,
    omitted_image_count: attachedImageCount - attachedImageUrls.length,
    attached_image_roles: attachedImageRoles,
    current_generated_result_image_count: attachedImageRoles
      .filter((role) => role === "current_generated_result")
      .length,
    user_supplied_reference_image_count: attachedUserReferenceImageCount,
    total_user_supplied_reference_image_count: userReferenceImageCount,
    reference_image_count: attachedUserReferenceImageCount,
    can_drop_reference_images: params.canDropReferenceImages !== false
  }) }];
  for (const imageUrl of attachedImageUrls) {
    content.push({ type: "input_image", image_url: imageUrl });
  }
  const baseInstructions = [
    "You are Vismuse's post-failure image safety recovery classifier.",
    "Classify the failure only. Never rewrite the user's prompt, replace its subject, remove identity features, invent an alternative, or continue with a different creative request.",
    "Choose retry_unchanged only when the user's prompt has no clear unsafe, infringing, sexualized, violent, criminal, or otherwise restricted intent and can be retried with the exact same prompt and exact same ordered image inputs.",
    "For retry_unchanged, assistant_reply must state briefly that the unchanged request is being retried. Do not claim that any wording, person, product, image, identity, layout, or creative intent was adjusted.",
    "attached_image_roles maps to the attached input images in order. Images marked current_generated_result are Vismuse's prior generated outputs being edited, not user-supplied references. Preserve them as the editing base when they are visually safe, and never ask the user to replace one as though they supplied it.",
    "Choose ask_user_replace_reference only when the text itself is benign, user_supplied_reference_image_count is greater than zero, and an actual user-supplied reference is likely the trigger. Do not omit that reference and continue automatically.",
    "When user_supplied_reference_image_count is zero, ask_user_replace_reference is invalid.",
    "Generic mythological or archetypal subject words such as troll, dragon, fairy, princess, or superhero are not protected by themselves. Without an explicit franchise name, signature design, or recognizable likeness request, preserve the generic subject and classify the unchanged request according to its actual safety intent.",
    "When can_drop_reference_images=false, every attached image is immutable input. If the request cannot continue with all images in the same order, do not choose retry_unchanged.",
    "Choose ask_user_modify_request when the prompt itself has clear restricted intent, or when continuing would require removing, replacing, weakening, or materially changing the user's subject, identity, product, reference role, layout, or other core intent.",
    "For protected characters, celebrity likenesses, logos, official campaigns, explicit sexual content, graphic violence, crime, or any request that would need a substitute subject, choose ask_user_modify_request. Never propose or execute the substitute yourself.",
    `Write assistant_reply in ${params.language || "the user's language"}. It is shown directly to the user: use one or two short sentences (maximum 360 characters), with no markdown, bullets, lists, or escaped newline characters. Do not include the full replacement prompt. Do not mention internal providers, policies, moderation systems, or error codes.`
  ];

  const buildRequest = (additionalInstruction?: string) => ({
    model: config.model,
    instructions: [...baseInstructions, additionalInstruction].filter(Boolean).join(" "),
    input: [{ role: "user", content }],
    tools: [{
      type: "function",
      name: "decide_safety_recovery",
      description: "Return the one allowed post-failure recovery decision.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["retry_unchanged", "ask_user_replace_reference", "ask_user_modify_request"] },
          assistant_reply: { type: "string", maxLength: 360 }
        },
        required: ["action", "assistant_reply"],
        additionalProperties: false
      }
    }],
    tool_choice: "required"
  });

  const requestDecision = async (additionalInstruction?: string): Promise<SafetyRecoveryDecision | null> => {
    const request = buildRequest(additionalInstruction);
    // A single retry makes a transient Responses timeout transparent without
    // re-running image generation or altering the original job.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(config.apiUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(config.timeoutMs)
        });
        if (response.ok) {
          const body = await response.json() as { output?: ResponseItem[] };
          const call = body.output?.find((item) => item.type === "function_call" && item.name === "decide_safety_recovery");
          return parseDecision(call?.arguments);
        }
        if (attempt === 1 || (response.status !== 408 && response.status !== 429 && response.status < 500)) return null;
      } catch {
        if (attempt === 1) return null;
      }
    }
    return null;
  };

  let decision = await requestDecision();
  if (decision?.action === "ask_user_replace_reference" && userReferenceImageCount === 0) {
    decision = await requestDecision([
      "The previous ask_user_replace_reference decision was invalid because there are zero user-supplied reference images.",
      "Any attached image is only the current generated result being edited.",
      "Do not blame or ask the user to replace that generated result.",
      "Choose retry_unchanged only if the exact original prompt and exact ordered images can be retried without changing intent; otherwise choose ask_user_modify_request."
    ].join(" "));
    if (!decision || decision.action === "ask_user_replace_reference") {
      return {
        action: "ask_user_modify_request",
        assistantReply: "Please adjust the request and try again."
      };
    }
  }
  return decision;
}
