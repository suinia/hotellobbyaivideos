export function buildBackgroundRemoverSubmittedInputText(inputText: string): string {
  return [
    inputText,
    "",
    "Background remover execution intent: Use the uploaded image as the exact base and change only its background plus unavoidable boundary pixels. If the user's instruction explicitly requests a white, solid-color, studio, or scene background, use that replacement; otherwise remove the background and output real transparent alpha. Never draw a checkerboard or fake transparency. Preserve the foreground subject's identity, pose, geometry, crop, colors, texture, lighting, text, logos, product details, fine edges, openings, and natural edge softness."
  ].join("\n");
}
