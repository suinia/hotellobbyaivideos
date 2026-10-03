import { callGenericLlmJson } from "@/lib/llm/skill-client";
import type { JobRecord } from "@/lib/types/job";
import type { ConversionResult } from "@/lib/types/skills";

export type CompletionChangeScope = "initial_delivery" | "copy_revision" | "image_revision";

function summarizeResult(result: ConversionResult) {
  return {
    post_title: result.post_title,
    caption_excerpt: result.post_caption.slice(0, 260),
    hashtags: result.hashtags.slice(0, 6),
    slide_count: result.slides.length,
    cover_keywords: result.slides.find((item) => item.is_cover)?.focus_keywords?.slice(0, 5) ?? [],
    slide_keywords: result.slides.slice(0, 4).map((item) => ({
      slide_id: item.slide_id,
      keywords: item.focus_keywords.slice(0, 4)
    }))
  };
}

const CHANGE_SCOPE_LABELS: Record<CompletionChangeScope, string> = {
  initial_delivery: "A new draft was created from the source.",
  copy_revision: "Textual parts of the existing draft were revised.",
  image_revision: "Visual slide assets of the existing draft were revised."
};

export async function generateCompletionNote(params: {
  changeScope: CompletionChangeScope;
  userRequest: string;
  result: ConversionResult;
  previousResult?: ConversionResult;
  baseJob?: JobRecord | null;
  outputLanguage?: string;
}): Promise<string | undefined> {
  const llm = await callGenericLlmJson<{ completion_note?: string }>({
    instruction: [
      "You are writing the assistant's completion note for a finished content task.",
      "Write 2 or 3 short sentences max.",
      "Sentence 1: clearly say what was completed.",
      "Sentence 2: mention the most important concrete change or result characteristic.",
      "Final sentence: suggest one natural next step.",
      "Only describe completed work. Do not imply discussion or uncertainty.",
      "Do not mention internal pipelines, tools, or implementation details.",
      "Return strict JSON only."
    ].join(" "),
    input: {
      change_scope: params.changeScope,
      change_scope_hint: CHANGE_SCOPE_LABELS[params.changeScope],
      user_request: params.userRequest,
      latest_result: summarizeResult(params.result),
      previous_result: params.previousResult ? summarizeResult(params.previousResult) : null,
      previous_job_context: params.baseJob
        ? {
            input_text: params.baseJob.payload.inputText,
            source_input_text: params.baseJob.payload.sourceInputText,
            revision_intent: params.baseJob.revisionIntent
          }
        : null
    },
    outputSchemaHint:
      '{"completion_note":"Done — I turned your article into a sharper 6-slide carousel draft with a clearer hook and caption. This version leans more into the main identity-shift angle, so it should read better for social. If you want, I can make it punchier or rewrite it for another platform."}',
    outputLanguage: params.outputLanguage,
    temperature: 0.25
  });

  const completionNote = typeof llm?.completion_note === "string" ? llm.completion_note.trim() : "";
  return completionNote || undefined;
}
