export type CertificateSubmittedInputOptions = {
  inputText: string;
  certificateTypeLabel?: string;
  certificateStyleLabel?: string;
  aspectRatio: string;
};

export type ResolveCertificateSubmissionStyleLabelOptions = {
  selectedStyleLabel?: string;
  isContinuation: boolean;
  styleWasExplicitlySelected: boolean;
};

export function resolveCertificateSubmissionStyleLabel({
  selectedStyleLabel,
  isContinuation,
  styleWasExplicitlySelected
}: ResolveCertificateSubmissionStyleLabelOptions): string | undefined {
  if (isContinuation && !styleWasExplicitlySelected) return undefined;
  return selectedStyleLabel?.trim() || undefined;
}

export function buildCertificateSubmittedInputText({
  inputText,
  certificateTypeLabel,
  certificateStyleLabel,
  aspectRatio
}: CertificateSubmittedInputOptions): string {
  const lines = [
    inputText,
    "",
    "Certificate production intent: Create one flat, ready-to-print certificate with a formal reading order, a prominent recipient name, clear achievement or recognition copy, and balanced signature or seal areas."
  ];

  if (certificateTypeLabel?.trim()) {
    lines.push(`Certificate type: ${certificateTypeLabel.trim()}.`);
  } else {
    lines.push("Certificate type: Infer the best fit from the supplied purpose, such as achievement, appreciation, completion, participation, or award.");
  }

  if (certificateStyleLabel?.trim()) {
    lines.push(`Certificate style: ${certificateStyleLabel.trim()}.`);
  }

  lines.push(`Format: ${aspectRatio}.`);
  lines.push("Content integrity: Preserve every supplied recipient name, certificate title, achievement, course or event name, issuer, date, credential, signature label, and organization name exactly. Omit missing information instead of inventing names, qualifications, dates, claims, signatures, seals, registration numbers, or logos.");
  lines.push("Output constraints: Flat edge-to-edge certificate artwork only; no photographed paper, frame on a wall, desk scene, hands holding a certificate, rolled diploma, device screen, perspective mockup, watermark, lorem ipsum, or extra text.");

  return lines.join("\n");
}
