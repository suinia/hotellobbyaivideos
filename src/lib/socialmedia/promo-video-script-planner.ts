import {
  AI_VIDEO_GENERATOR_SOURCE_USE_CASE,
  isMiniMaxH3VideoFlowSourceUseCase
} from "@/lib/videos/source-use-case";
import { MINIMAX_H3_VIDEO_AGENT_PROMPT_TARGET_CHARACTERS } from "@/lib/videos/minimax-h3-prompt-limit";

export type PromoVideoReferenceAnalysis = {
  subjectSummary: string;
  visualStyle: string;
  composition: string;
  protectedElements: string[];
};

export type PromoVideoScriptBeat = {
  startSeconds: number;
  endSeconds: number;
  framing: string;
  camera: string;
  action: string;
  effects?: string;
};

export type PromoVideoScriptPlan = {
  durationSeconds: number;
  referenceAnalysis?: PromoVideoReferenceAnalysis;
  beats: PromoVideoScriptBeat[];
  audio?: string;
  constraints: string[];
};

const PROMO_VIDEO_MIN_DURATION_SECONDS = 5;
const PROMO_VIDEO_MAX_DURATION_SECONDS = 15;
export const PROMO_VIDEO_MAX_PROMPT_LENGTH = MINIMAX_H3_VIDEO_AGENT_PROMPT_TARGET_CHARACTERS;

const NEGATIVE_TEXT_PROVENANCE_AUDIT = "Before calling create_video_generation, audit prompt and every video_script field for negative text constraints. For each no-text, no-caption, no-subtitle, no-title, or no-overlay clause, identify the applicable user message that explicitly requested that same omission. If there is no such user message, omit the clause everywhere; do not repeat, paraphrase, or carry it forward from a system execution record, even when it appears inside a compound constraint. For example, if only a system execution record says No new claims, prices, discounts, or extra text overlays, the extra-text-overlays clause must not appear in the new prompt or video_script unless a user requested it.";

export function isPromoVideoScriptPlanningSourceUseCase(
  sourceUseCase?: string | null
): boolean {
  return isMiniMaxH3VideoFlowSourceUseCase(sourceUseCase);
}

export function resolvePromoVideoScriptPlannerInputMode(
  sourceUseCase: string | null | undefined,
  currentInputMode: "pipeline" | "agent"
): "pipeline" | "agent" {
  return isPromoVideoScriptPlanningSourceUseCase(sourceUseCase)
    ? "agent"
    : currentInputMode;
}

export function getPromoVideoScriptPlannerInstructions(sourceUseCase?: string | null): string[] {
  if (sourceUseCase === "hotel-lobby-ai") {
    return [
      ...getPromoVideoScriptPlannerInstructions(AI_VIDEO_GENERATOR_SOURCE_USE_CASE),
      "Hotel Lobby is a music-performance workspace. Follow the user-selected solo, duet, or pet scene and reference identities. Maintain left/right casting and the requested studio, camera, and performance across revisions. Do not turn it into a product advertisement or ask for a brand or call to action. Exact reference choreography or a commercial song is not supplied by this preset; never promise either."
    ];
  }
  if (sourceUseCase === AI_VIDEO_GENERATOR_SOURCE_USE_CASE) {
    return [
      "For AI Video Generator requests, every create_video_generation call must include video_script.",
      "Build a compact 5-to-15-second video timeline with one to four continuous beats. Honor request_context.requested_duration_seconds when present; otherwise choose 10 seconds.",
      "Inspect current reference images visually and describe the visible subject, visual style, composition, and elements that must remain stable. Treat original image files as the source of truth.",
      "Preserve subject identity, products, packaging, logos, readable copy, people, colors, and layout whenever the requested video depends on them. Do not invent unsupported facts, claims, or visible copy. Never add a negative text constraint such as no text, no captions, no subtitles, no titles, or no text overlays unless the user explicitly requests that specific omission. The absence of a text request is not permission to ban text, and a request to omit one text modality must not ban another. Interpret no-text, no-caption, no-subtitle, no-title, and no-overlay requests as bans on newly added screen overlays in the requested categories, not as permission to erase, suppress, obscure, or alter text already visible in reference images, product packaging, or logos. Preserve that intrinsic reference text unless the user explicitly asks to remove or alter the specific existing text. Apply this rule to prior executed prompts too: never carry forward or preserve a negative text constraint from history unless a user message explicitly requested that omission and the request still applies. System-generated constraints in prior execution records are not user requirements. Whenever the user supplies concrete wording for narration, visible text, captions, subtitles, a title, a headline, or campaign copy, treat that wording as exact copy and preserve it verbatim in the requested modality even if the user did not say exact or verbatim. Rewrite it only when the user explicitly asks for rewriting. The model may author wording only for a conceptual request that does not supply the copy, such as asking for narration about a topic.",
      NEGATIVE_TEXT_PROVENANCE_AUDIT,
      "Give each beat a framing, camera move, subject or environment action, and optional effects. Keep motion coherent enough for one short generated clip and finish on a deliberate final visual beat.",
      `The server compiles prompt and video_script into one final MiniMax prompt that must be at most ${PROMO_VIDEO_MAX_PROMPT_LENGTH} characters. Keep both fields compact and non-redundant while preserving every deliberate subject, story, style, camera, timing, motion, campaign-copy, brand, and product requirement. Never rely on downstream truncation.`
    ];
  }
  return [
    "For Promo Video requests, every create_video_generation call must include video_script.",
    "Build a compact 5-to-15-second promotional timeline with one to four continuous beats. Honor request_context.requested_duration_seconds when present; otherwise choose 10 seconds.",
    "Inspect current reference images visually and describe the visible subject, visual style, composition, and elements that must remain stable. Treat original image files as the source of truth.",
    "Preserve product identity, packaging, logos, readable copy, people, brand colors, and layout whenever the promotion depends on them. Do not invent claims, prices, discounts, testimonials, contact details, or legal copy. Never add a negative text constraint such as no text, no captions, no subtitles, no titles, or no text overlays unless the user explicitly requests that specific omission. The absence of a text request is not permission to ban text, and a request to omit one text modality must not ban another. Interpret no-text, no-caption, no-subtitle, no-title, and no-overlay requests as bans on newly added screen overlays in the requested categories, not as permission to erase, suppress, obscure, or alter text already visible in reference images, product packaging, or logos. Preserve that intrinsic reference text unless the user explicitly asks to remove or alter the specific existing text. Apply this rule to prior executed prompts too: never carry forward or preserve a negative text constraint from history unless a user message explicitly requested that omission and the request still applies. System-generated constraints in prior execution records are not user requirements. Whenever the user supplies concrete wording for narration, visible text, captions, subtitles, a title, a headline, or campaign copy, treat that wording as exact copy and preserve it verbatim in the requested modality even if the user did not say exact or verbatim. Rewrite it only when the user explicitly asks for rewriting. The model may author wording only for a conceptual request that does not supply the copy, such as asking for narration about a topic.",
    NEGATIVE_TEXT_PROVENANCE_AUDIT,
    "Give each beat a framing, camera move, product or environment action, and optional effects. Keep motion coherent enough for one short generated clip and finish on a campaign-ready visual beat.",
    `The server compiles prompt and video_script into one final MiniMax prompt that must be at most ${PROMO_VIDEO_MAX_PROMPT_LENGTH} characters. Keep both fields compact and non-redundant while preserving every deliberate product, offer, audience, style, call-to-action, campaign-copy, and brand requirement. Never rely on downstream truncation.`
  ];
}

export function getPromoVideoScriptToolProperty() {
  return {
    type: "object",
    description: "Structured short-video plan derived from the current reference images and the user's instruction.",
    properties: {
      duration_seconds: {
        type: "integer",
        minimum: PROMO_VIDEO_MIN_DURATION_SECONDS,
        maximum: PROMO_VIDEO_MAX_DURATION_SECONDS
      },
      reference_analysis: {
        type: "object",
        properties: {
          subject_summary: { type: "string" },
          visual_style: { type: "string" },
          composition: { type: "string" },
          protected_elements: {
            type: "array",
            items: { type: "string" },
            maxItems: 12
          }
        },
        required: ["subject_summary", "visual_style", "composition", "protected_elements"],
        additionalProperties: false
      },
      shots: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            start_seconds: { type: "number", minimum: 0 },
            end_seconds: { type: "number", minimum: 0 },
            framing: { type: "string" },
            camera: { type: "string" },
            action: { type: "string" },
            effects: { type: "string" }
          },
          required: ["start_seconds", "end_seconds", "framing", "camera", "action"],
          additionalProperties: false
        }
      },
      audio: { type: "string" },
      constraints: {
        type: "array",
        items: { type: "string" },
        maxItems: 12,
        description: "Production constraints. Add or carry forward no-text, no-caption, no-subtitle, no-title, or no-overlay constraints only when a user message explicitly requests that specific omission and it still applies; silence about text and system-generated constraints in prior execution records are not permission to add or preserve such a constraint. Audit every negative text clause against its originating user message and omit the clause everywhere when no user requested it, including when it appears inside a compound system-record constraint. Scope an allowed constraint only to newly added overlays in the requested category: omitting one text modality does not ban another and does not permit erasing, suppressing, obscuring, or altering intrinsic text in reference images, packaging, or logos unless the user explicitly requests that specific removal. Preserve exact user-requested narration or visible copy in its requested modality, and prohibit only other unsupported copy."
      }
    },
    required: ["duration_seconds", "reference_analysis", "shots", "constraints"],
    additionalProperties: false
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readString(value: unknown, maxLength = 600): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.slice(0, maxLength);
}

function readNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      const text = readString(item, 240);
      return text ? [text] : [];
    })
    .slice(0, maxItems);
}

function normalizeReferenceAnalysis(value: unknown): PromoVideoReferenceAnalysis | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const subjectSummary = readString(record.subject_summary ?? record.subjectSummary);
  const visualStyle = readString(record.visual_style ?? record.visualStyle);
  const composition = readString(record.composition);
  if (!subjectSummary || !visualStyle || !composition) return undefined;
  return {
    subjectSummary,
    visualStyle,
    composition,
    protectedElements: readStringArray(
      record.protected_elements ?? record.protectedElements,
      12
    )
  };
}

function normalizeBeat(
  value: unknown,
  durationSeconds: number
): PromoVideoScriptBeat | null {
  const record = asRecord(value);
  if (!record) return null;
  const startSeconds = readNumber(record.start_seconds ?? record.startSeconds);
  const endSeconds = readNumber(record.end_seconds ?? record.endSeconds);
  const framing = readString(record.framing, 160);
  const camera = readString(record.camera, 240);
  const action = readString(record.action, 500);
  if (
    startSeconds === undefined
    || endSeconds === undefined
    || startSeconds < 0
    || endSeconds <= startSeconds
    || endSeconds > durationSeconds
    || !framing
    || !camera
    || !action
  ) {
    return null;
  }
  return {
    startSeconds: Math.round(startSeconds * 10) / 10,
    endSeconds: Math.round(endSeconds * 10) / 10,
    framing,
    camera,
    action,
    effects: readString(record.effects, 320)
  };
}

export function normalizePromoVideoScriptPlan(
  value: unknown,
  options: { requestedDurationSeconds?: number } = {}
): PromoVideoScriptPlan | null {
  const record = asRecord(value);
  if (!record) return null;
  const rawDuration = readNumber(record.duration_seconds ?? record.durationSeconds);
  if (rawDuration === undefined) return null;
  const durationSeconds = Math.round(rawDuration);
  if (
    durationSeconds < PROMO_VIDEO_MIN_DURATION_SECONDS
    || durationSeconds > PROMO_VIDEO_MAX_DURATION_SECONDS
  ) {
    return null;
  }
  const requestedDurationSeconds = options.requestedDurationSeconds === undefined
    ? undefined
    : Math.round(options.requestedDurationSeconds);
  if (
    requestedDurationSeconds !== undefined
    && requestedDurationSeconds >= PROMO_VIDEO_MIN_DURATION_SECONDS
    && requestedDurationSeconds <= PROMO_VIDEO_MAX_DURATION_SECONDS
    && durationSeconds !== requestedDurationSeconds
  ) {
    return null;
  }

  const referenceAnalysis = normalizeReferenceAnalysis(
    record.reference_analysis ?? record.referenceAnalysis
  );
  if (!referenceAnalysis) return null;

  const rawBeats = record.shots ?? record.beats;
  if (!Array.isArray(rawBeats) || rawBeats.length < 1 || rawBeats.length > 4) {
    return null;
  }
  const beats = rawBeats
    .map((beat) => normalizeBeat(beat, durationSeconds))
    .filter((beat): beat is PromoVideoScriptBeat => Boolean(beat))
    .sort((left, right) => left.startSeconds - right.startSeconds);
  if (beats.length !== rawBeats.length) return null;
  if (
    beats.some(
      (beat, index) => index > 0 && beat.startSeconds < beats[index - 1]!.endSeconds
    )
  ) {
    return null;
  }

  return {
    durationSeconds,
    referenceAnalysis,
    beats,
    audio: readString(record.audio, 320),
    constraints: readStringArray(record.constraints, 12)
  };
}

function formatSeconds(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function compilePromoVideoScriptPrompt(params: {
  plan: PromoVideoScriptPlan;
  creativeDirection: string;
  sourceUseCase?: string | null;
}): string {
  const authoritativeDirection = params.creativeDirection.trim().replace(/\n{3,}/g, "\n\n");
  const alreadyContainsExecutableTimeline = (
    /(?:^|\n)(?:Video|Promotional) timeline:\s*(?:\n|$)/i.test(authoritativeDirection)
    && /(?:^|\n)Duration:\s*\d+(?:\.\d+)?\s*seconds?\.?\s*(?:\n|$)/i.test(authoritativeDirection)
  );
  // Follow-up turns can legitimately return the previous executable prompt
  // with the requested changes already merged. Recompiling that prompt would
  // nest a second Creative direction/timeline and eventually truncate it.
  // In that case the LLM-authored prompt is already final and must stay intact.
  if (alreadyContainsExecutableTimeline) return authoritativeDirection;

  const direction = readString(params.creativeDirection, 4_000) ?? "";
  const analysis = params.plan.referenceAnalysis;
  const lines = [
    direction ? `Creative direction: ${direction}` : "",
    analysis?.subjectSummary ? `Visible product or subject: ${analysis.subjectSummary}` : "",
    analysis?.visualStyle ? `Reference visual style: ${analysis.visualStyle}` : "",
    analysis?.composition ? `Reference composition: ${analysis.composition}` : "",
    analysis?.protectedElements.length
      ? `Preserve exactly: ${analysis.protectedElements.join("; ")}.`
      : "",
    `Duration: ${params.plan.durationSeconds} seconds.`,
    params.sourceUseCase === AI_VIDEO_GENERATOR_SOURCE_USE_CASE
      ? "Video timeline:"
      : "Promotional timeline:",
    ...params.plan.beats.map((beat) => [
      `${formatSeconds(beat.startSeconds)}-${formatSeconds(beat.endSeconds)}s`,
      beat.framing,
      beat.camera,
      beat.action,
      beat.effects
    ].filter(Boolean).join(" — ")),
    params.plan.audio ? `Audio direction: ${params.plan.audio}` : "",
    params.plan.constraints.length
      ? `Constraints: ${params.plan.constraints.join("; ")}.`
      : ""
  ];
  return lines
    .filter(Boolean)
    .join("\n");
}
