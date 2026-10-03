export type FlyerSubmittedInputOptions = {
  inputText: string;
  flyerTypeLabel?: string;
  flyerStyleLabel?: string;
  assetLabel?: string;
  aspectRatio: string;
};

export function buildFlyerSubmittedInputText({
  inputText,
  flyerTypeLabel,
  flyerStyleLabel,
  assetLabel = "Flyer",
  aspectRatio
}: FlyerSubmittedInputOptions): string {
  const lines = [
    inputText,
    "",
    "Marketing production intent: Treat the user's listing, product, event, service, or campaign information as source material for a ready-to-use marketing asset. Extract the strongest commercial message, audience hook, offer/details, and CTA from the provided information before designing."
  ];

  if (flyerTypeLabel?.trim()) {
    lines.push(`${assetLabel} type: ${flyerTypeLabel.trim()}.`);
  } else {
    lines.push(`${assetLabel} type: Infer from the user's prompt and uploaded references. Do not assume real estate or property listing details unless they are provided.`);
  }

  if (flyerStyleLabel?.trim()) {
    lines.push(`${assetLabel} style: ${flyerStyleLabel.trim()}.`);
  }

  lines.push(`Format: ${aspectRatio}.`);

  return lines.join("\n");
}
