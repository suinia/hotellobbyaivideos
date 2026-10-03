export function buildVisionBoardSubmittedInputText(options: {
  inputText: string; themeLabel?: string; styleLabel?: string; aspectRatio: string; isContinuation?: boolean;
}): string {
  const lines = [options.inputText];
  if (options.themeLabel) lines.push(`Vision board theme: ${options.themeLabel}.`);
  if (options.styleLabel) lines.push(`Collage style: ${options.styleLabel}.`);
  if (options.aspectRatio !== "auto") lines.push(`Format: ${options.aspectRatio}.`);
  if (options.isContinuation) lines.push("Preserve unmentioned goals, photos, wording, layout, palette and canvas; apply only the requested changes.");
  return lines.join("\n");
}
