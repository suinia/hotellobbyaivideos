import { SOCIALMEDIA_IMAGE_MODEL_PROMPT_MAX_CHARS } from "@/lib/socialmedia/input-limits";

export const IMAGE_MODEL_PROMPT_TRUNCATION_NOTICE = "\n\n[Prompt shortened to fit the image model limit.]\n\n";

/** Final safety boundary shared by every image provider payload. */
export function limitImageModelPrompt(prompt: string): string {
  if (prompt.length <= SOCIALMEDIA_IMAGE_MODEL_PROMPT_MAX_CHARS) return prompt;

  const tailBudget = Math.min(6_000, Math.floor(
    (SOCIALMEDIA_IMAGE_MODEL_PROMPT_MAX_CHARS - IMAGE_MODEL_PROMPT_TRUNCATION_NOTICE.length) / 4
  ));
  const headBudget = SOCIALMEDIA_IMAGE_MODEL_PROMPT_MAX_CHARS
    - IMAGE_MODEL_PROMPT_TRUNCATION_NOTICE.length
    - tailBudget;

  return [
    prompt.slice(0, headBudget).trimEnd(),
    IMAGE_MODEL_PROMPT_TRUNCATION_NOTICE,
    prompt.slice(-tailBudget).trimStart()
  ].join("");
}
