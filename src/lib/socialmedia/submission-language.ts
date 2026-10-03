import { normalizeLanguage } from "@/lib/i18n/languages";
import { resolveSocialmediaResponseLanguage } from "./language";

/** Preserve the actual interface locale for Image/General semantic routing. */
export function resolveSocialmediaSubmissionLanguage(params: {
  userInput?: string;
  selectedLanguage?: string;
  outputType?: "image" | "video";
}) {
  return params.outputType === "video"
    ? resolveSocialmediaResponseLanguage(params)
    : normalizeLanguage(params.selectedLanguage);
}
