import { isDisabledToolSlug, isHiddenPublicToolSlug } from "@/lib/compliance/disabled-tools";
import { resolveGeneratorUseCaseContext } from "@/lib/use-cases/generator-context";
import { defaultWorkbenchToolSlug, workbenchToolSlugs } from "@/lib/workbench/tools";

const HOME_AUTH_TOOL_SLUGS = new Set<string>([
  ...workbenchToolSlugs,
  "promo-video-maker",
  "hotel-lobby-ai",
  "spotify-canvas-generator"
]);

export function resolveHomeAuthRedirectTarget(rawToolSlug?: string | null, variant: "control" | "general" = "control"): string {
  if (variant === "general") return "/app";
  const toolSlug = rawToolSlug?.trim();
  if (
    toolSlug
    && HOME_AUTH_TOOL_SLUGS.has(toolSlug)
    && !isDisabledToolSlug(toolSlug)
    && !isHiddenPublicToolSlug(toolSlug)
  ) {
    return resolveGeneratorUseCaseContext(toolSlug).publicPath;
  }

  return `/${defaultWorkbenchToolSlug}`;
}

/** Only ordinary sign-in is bucketed; explicit work, payment and pending returns are preserved. */
export function resolveAuthReturnPath(raw: string | null, toolSlug?: string | null, variant: "control" | "general" = "control"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || /[\\\x00-\x1f\x7f]/.test(raw) || raw === "/") {
    return resolveHomeAuthRedirectTarget(toolSlug, variant);
  }
  return raw;
}
