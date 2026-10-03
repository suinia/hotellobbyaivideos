export type InfographicSubmittedInputOptions = {
  inputText: string;
  infographicTypeLabel?: string;
  infographicStyleLabel?: string;
  aspectRatio: string;
};

export function buildInfographicSubmittedInputText({
  inputText,
  infographicTypeLabel,
  infographicStyleLabel,
  aspectRatio
}: InfographicSubmittedInputOptions): string {
  const lines = [
    inputText,
    "",
    "Infographic production intent: Turn the user's supplied facts, data, process, comparison, or timeline into a clear visual story. Establish one takeaway, group related information, and use charts, diagrams, icons, labels, and concise text only where they improve comprehension."
  ];

  if (infographicTypeLabel?.trim()) {
    lines.push(`Infographic type: ${infographicTypeLabel.trim()}.`);
  } else {
    lines.push("Infographic type: Infer the clearest structure from the supplied material, such as statistical, comparison, process, timeline, list, or informational.");
  }

  if (infographicStyleLabel?.trim()) {
    lines.push(`Infographic style: ${infographicStyleLabel.trim()}.`);
  }

  lines.push(`Format: ${aspectRatio}.`);
  lines.push("Data integrity: Do not invent statistics, dates, sources, rankings, claims, or labels. If exact values are not supplied, communicate the concept without fabricating numeric data.");

  return lines.join("\n");
}
