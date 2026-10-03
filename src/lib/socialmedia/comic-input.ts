export type ComicSubmittedInputOptions = {
  inputText: string;
  comicFormatLabel?: string;
  comicStyleLabel?: string;
  aspectRatio: string;
  isContinuation?: boolean;
};

export function resolveComicSubmissionStyleLabel({
  selectedStyleValue,
  selectedStyleLabel
}: {
  selectedStyleValue: string;
  selectedStyleLabel?: string;
}): string | undefined {
  if (selectedStyleValue === "auto") return undefined;
  return selectedStyleLabel?.trim() || undefined;
}

export function resolveComicSubmissionAspectRatio({
  aspectRatio,
  isContinuation,
  wasExplicitlySelected
}: {
  aspectRatio: string;
  isContinuation: boolean;
  wasExplicitlySelected: boolean;
}): string {
  return isContinuation && !wasExplicitlySelected ? "auto" : aspectRatio;
}

export function buildComicSubmittedInputText({
  inputText,
  comicFormatLabel,
  comicStyleLabel,
  aspectRatio,
  isContinuation = false
}: ComicSubmittedInputOptions): string {
  const lines = [
    inputText,
    "",
    "Comic production intent: Create one finished flat comic strip or comic page with a deliberate panel sequence, consistent recurring characters, clear visual storytelling, and readable speech balloons or captions only when the user supplies or requests them."
  ];

  lines.push(comicFormatLabel?.trim()
    ? `Comic format: ${comicFormatLabel.trim()}.`
    : isContinuation
      ? "Comic format: Preserve the existing format, panel count, panel order, and reading direction unless the latest request explicitly changes them."
      : "Comic format: Infer the clearest format and panel count from the story beats; use a concise single page when no format is specified.");
  if (comicStyleLabel?.trim()) {
    lines.push(`Comic style: ${comicStyleLabel.trim()}.`);
  } else if (isContinuation) {
    lines.push("Comic style: Preserve the existing visual style unless the latest request explicitly changes it.");
  }
  if (aspectRatio !== "auto") {
    lines.push(`Format: ${aspectRatio}.`);
  } else if (isContinuation) {
    lines.push("Canvas: Preserve the current aspect ratio and page orientation unless the latest request explicitly changes them.");
  }
  lines.push("Story integrity: Preserve supplied character traits, panel order, dialogue, captions, names, and story facts exactly. Do not invent visible dialogue, credits, logos, copyrighted characters, or extra plot claims.");

  return lines.join("\n");
}
