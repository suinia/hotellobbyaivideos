import type {
  SocialmediaAspectRatio,
  SocialmediaImageCount,
  SocialmediaOutputFormat,
  SocialmediaResolution
} from "@/lib/socialmedia/types";

// This is the single contract shared by the UI request, the agent, and the
// generation pipeline. Keep provider-specific pixel mappings downstream; the
// agent works with these portable user-facing controls.
export const SOCIALMEDIA_IMAGE_GENERATION_CAPABILITIES: {
  aspectRatios: readonly SocialmediaAspectRatio[];
  resolutions: readonly SocialmediaResolution[];
  imageCounts: readonly Exclude<SocialmediaImageCount, "auto">[];
  outputFormats: readonly SocialmediaOutputFormat[];
} = {
  aspectRatios: ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "16:9", "9:16", "2:1", "1:2", "21:9", "9:21"],
  resolutions: ["1k", "2k", "4k"],
  imageCounts: [1, 2, 3, 4, 5, 6, 7, 8],
  outputFormats: ["png", "jpeg"]
};
