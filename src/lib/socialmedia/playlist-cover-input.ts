export function buildPlaylistCoverSubmittedInputText(options: {
  inputText: string;
  moodLabel?: string;
  styleLabel?: string;
  aspectRatio: string;
  isContinuation?: boolean;
}): string {
  const lines = [options.inputText];
  if (options.moodLabel) lines.push(`Playlist mood or activity: ${options.moodLabel}.`);
  if (options.styleLabel) lines.push(`Cover style: ${options.styleLabel}.`);
  if (options.aspectRatio !== "auto") lines.push(`Format: ${options.aspectRatio}.`);
  if (options.isContinuation) lines.push("Preserve unmentioned imagery, wording, composition, palette and canvas; apply only the requested changes.");
  return lines.join("\n");
}
