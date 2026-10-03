const VISIBLE_TEXT_LANGUAGE_CONSTRAINT_PREFIX = "Visible text language constraint:";
const HFSYAPI_GPT_IMAGE_2_VISIBLE_TEXT_LANGUAGE_RECONSTRAINT_PREFIX = "中文再次强调：";

export function extractVisibleTextLanguageConstraint(prompt: string): string | null {
  const line = prompt
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.startsWith(VISIBLE_TEXT_LANGUAGE_CONSTRAINT_PREFIX));

  return line || null;
}

export function applyVisibleTextLanguageConstraint(params: {
  prompt: string;
  language?: string | null;
}): string {
  // Image text must follow the user's request. Do not add a provider-level
  // English-only policy: it conflicts with valid Chinese, Spanish, and other
  // language-specific image requests. Strip the legacy policy from retried
  // jobs as well, so an older pending task cannot reintroduce it on fallback.
  const lines = params.prompt
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(VISIBLE_TEXT_LANGUAGE_CONSTRAINT_PREFIX));
  while (lines.at(-1)?.trim() === "") lines.pop();
  return lines.join("\n");
}

export function applyHfsyapiVisibleTextLanguageConstraint(params: {
  prompt: string;
  language?: string | null;
  model?: string | null;
  primaryProvider?: string | null;
}): string {
  return applyVisibleTextLanguageConstraint(params)
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(HFSYAPI_GPT_IMAGE_2_VISIBLE_TEXT_LANGUAGE_RECONSTRAINT_PREFIX))
    .join("\n");
}
