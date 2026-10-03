const INTERNAL_SUBMITTED_INPUT_MARKERS = [
  "Marketing production intent:",
  "Background remover execution intent:",
  "Business card maker attributes:",
  "AI logo generator attributes:",
  "Personal image production intent:",
  "Tattoo generator attributes:",
  "You are a professional interior design visualizer",
  "AI room design attributes:",
  "AI clothes changer attributes:",
  "AI clothes changer revision intent:"
];

export function stripInternalSubmittedInputForDisplay(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  let markerIndex = -1;
  for (const marker of INTERNAL_SUBMITTED_INPUT_MARKERS) {
    const index = trimmed.indexOf(marker);
    if (index >= 0 && (markerIndex < 0 || index < markerIndex)) {
      markerIndex = index;
    }
  }

  if (markerIndex < 0) return trimmed;
  if (markerIndex === 0) return "";

  return trimmed.slice(0, markerIndex).trim() || trimmed;
}

export function resolveUserVisibleAndGenerationInput(params: {
  displayInputText: string;
  submittedInputText: string;
}): {
  displayInputText: string;
  generationInputText?: string;
} {
  const displayInputText = params.displayInputText.trim();
  const submittedInputText = params.submittedInputText.trim();

  return {
    displayInputText,
    generationInputText: submittedInputText && submittedInputText !== displayInputText
      ? submittedInputText
      : undefined
  };
}
