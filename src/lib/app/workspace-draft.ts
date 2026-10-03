import { SOCIALMEDIA_COMPOSER_MAX_CHARS } from "@/lib/socialmedia/input-limits";

/** A prompt link seeds its own draft, without replacing an unrelated saved brief. */
export function getGeneralWorkspaceDraftKey(initialPrompt?: string | null): string {
  const prompt = initialPrompt?.trim().slice(0, SOCIALMEDIA_COMPOSER_MAX_CHARS);
  return prompt
    ? `vismuse.app.general-draft.prompt:${encodeURIComponent(prompt)}`
    : "vismuse.app.general-draft";
}
