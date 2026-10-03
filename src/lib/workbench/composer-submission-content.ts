export const BACKGROUND_REMOVER_DEFAULT_PROMPT =
  "Remove the background from the uploaded image. Keep the foreground subject unchanged, preserve fine natural edges, and return real transparent alpha without drawing a checkerboard or replacement backdrop.";

export const CLOTHES_CHANGER_DEFAULT_PROMPT =
  "Change the person's outfit using the uploaded clothing reference.";

function matchesWorkbench(
  sourceUseCase: string | null | undefined,
  submitPathSlug: string | null | undefined,
  expected: string
): boolean {
  return sourceUseCase?.trim().toLowerCase() === expected
    || submitPathSlug?.trim().toLowerCase() === expected;
}

export function resolveImageWorkbenchDisplayContent(params: {
  content: string;
  sourceUseCase?: string | null;
  submitPathSlug?: string | null;
  compact?: boolean;
}): string {
  if (params.content.trim()) return params.content;

  if (matchesWorkbench(params.sourceUseCase, params.submitPathSlug, "background-remover")) {
    return BACKGROUND_REMOVER_DEFAULT_PROMPT;
  }
  if (
    !params.compact
    && matchesWorkbench(params.sourceUseCase, params.submitPathSlug, "ai-clothes-changer")
  ) {
    return CLOTHES_CHANGER_DEFAULT_PROMPT;
  }

  return params.content;
}
