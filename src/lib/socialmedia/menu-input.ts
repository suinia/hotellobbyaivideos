export type MenuSubmittedInputOptions = {
  inputText: string;
  menuCategoryLabel?: string;
  menuStyleLabel?: string;
  aspectRatio: string;
};

export type ResolveMenuSubmissionStyleLabelOptions = {
  selectedStyleLabel?: string;
  isContinuation: boolean;
  styleWasExplicitlySelected: boolean;
};

export function resolveMenuSubmissionStyleLabel({
  selectedStyleLabel,
  isContinuation,
  styleWasExplicitlySelected
}: ResolveMenuSubmissionStyleLabelOptions): string | undefined {
  if (isContinuation && !styleWasExplicitlySelected) return undefined;
  return selectedStyleLabel?.trim() || undefined;
}

export function buildMenuSubmittedInputText({
  inputText,
  menuCategoryLabel,
  menuStyleLabel,
  aspectRatio
}: MenuSubmittedInputOptions): string {
  const lines = [
    inputText,
    "",
    "Menu production intent: Create one flat, ready-to-print restaurant menu with a clear reading order, distinct menu sections, readable item names and prices, and a visual style appropriate to the venue."
  ];

  if (menuCategoryLabel?.trim()) {
    lines.push(`Menu category: ${menuCategoryLabel.trim()}.`);
  } else {
    lines.push("Menu category: Infer the best fit from the supplied venue and items, such as breakfast, cafe, diner, drink, or wine.");
  }

  if (menuStyleLabel?.trim()) {
    lines.push(`Menu style: ${menuStyleLabel.trim()}.`);
  }

  lines.push(`Format: ${aspectRatio}.`);
  lines.push("Content integrity: Preserve every supplied item name, description, section, dietary label, currency, and price exactly. Omit missing information instead of inventing dishes, prices, ingredients, claims, contact details, or logos.");
  lines.push("Output constraints: Flat edge-to-edge artwork only; no photographed paper, clipboard, table scene, folded menu, device screen, perspective mockup, watermark, lorem ipsum, or extra text.");

  return lines.join("\n");
}
