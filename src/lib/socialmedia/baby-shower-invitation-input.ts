export function buildBabyShowerInvitationSubmittedInputText(options: {
  inputText: string;
  themeLabel?: string;
  styleLabel?: string;
  aspectRatio: string;
  isContinuation?: boolean;
}): string {
  const lines = [options.inputText];
  if (options.themeLabel) lines.push(`Baby shower theme: ${options.themeLabel}.`);
  if (options.styleLabel) lines.push(`Invitation style: ${options.styleLabel}.`);
  if (options.aspectRatio !== "auto") lines.push(`Format: ${options.aspectRatio}.`);
  if (options.isContinuation) lines.push("Preserve unmentioned exact event wording, imagery, typography, composition, and canvas; apply only the requested changes.");
  return lines.join("\n");
}
