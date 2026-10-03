export type AnimeSubmittedInputOptions = {
  inputText: string;
  animeTypeLabel?: string;
  animeStyleLabel?: string;
  aspectRatio: string;
  isContinuation?: boolean;
};

export function resolveAnimeSubmissionStyleLabel({
  selectedStyleValue,
  selectedStyleLabel
}: {
  selectedStyleValue: string;
  selectedStyleLabel?: string;
}): string | undefined {
  if (selectedStyleValue === "auto") return undefined;
  return selectedStyleLabel?.trim() || undefined;
}

export function resolveAnimeSubmissionAspectRatio({
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

export function buildAnimeSubmittedInputText({
  inputText,
  animeTypeLabel,
  animeStyleLabel,
  aspectRatio,
  isContinuation = false
}: AnimeSubmittedInputOptions): string {
  const lines = [
    inputText,
    "",
    "Anime production intent: Create one finished flat anime-style image with a clear focal subject, expressive character design, intentional composition, and polished lighting and color. This is a single illustration, not a comic page."
  ];

  lines.push(animeTypeLabel?.trim()
    ? `Anime image type: ${animeTypeLabel.trim()}.`
    : isContinuation
      ? "Anime image type: Preserve the existing subject type and composition unless the latest request explicitly changes them."
      : "Anime image type: Infer the most useful character, portrait, scene, group, or creature composition from the request.");
  if (animeStyleLabel?.trim()) {
    lines.push(`Anime style: ${animeStyleLabel.trim()}.`);
  } else if (isContinuation) {
    lines.push("Anime style: Preserve the existing visual style, character identity, palette, and rendering treatment unless the latest request explicitly changes them.");
  }
  if (aspectRatio !== "auto") {
    lines.push(`Format: ${aspectRatio}.`);
  } else if (isContinuation) {
    lines.push("Canvas: Preserve the current aspect ratio and orientation unless the latest request explicitly changes them.");
  }
  lines.push("Artwork integrity: Use original characters and designs. Do not imitate a living artist or named animation studio, and do not introduce franchise characters, celebrity likenesses, panels, gutters, speech balloons, captions, logos, watermarks, device frames, or mockups unless the user explicitly requests allowed visible text or presentation elements.");

  return lines.join("\n");
}
