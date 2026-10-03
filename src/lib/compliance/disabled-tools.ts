export const AI_IMAGE_MAKER_REDIRECT_PATH = "/ai-image-maker";

export const DISABLED_TOOL_SLUGS = [
  "ai-clothes-changer",
  "ai-personal-image-generator"
] as const;

export const HIDDEN_PUBLIC_TOOL_SLUGS = ["ai-certificate-generator"] as const;

const DISABLED_TOOL_SLUG_SET = new Set<string>(DISABLED_TOOL_SLUGS);
const HIDDEN_PUBLIC_TOOL_SLUG_SET = new Set<string>(HIDDEN_PUBLIC_TOOL_SLUGS);

export function isDisabledToolSlug(value: string | null | undefined) {
  return Boolean(value && DISABLED_TOOL_SLUG_SET.has(value.trim().toLowerCase()));
}

export function isHiddenPublicToolSlug(value: string | null | undefined) {
  return Boolean(value && HIDDEN_PUBLIC_TOOL_SLUG_SET.has(value.trim().toLowerCase()));
}

export function isDisabledToolRoute(pathname: string, category: string | null) {
  const normalizedPathname = pathname.toLowerCase();
  const routes = [
    "/ai-clothes-changer",
    "/docs/clothes-changer",
    "/app/ai-clothes-changer",
    "/app/clothes-changer",
    "/app/ai-personal-image-generator",
    "/app/personal-image",
    "/app/personal-image-generator",
    "/app/profile-picture",
    "/app/profile-picture-maker"
  ];

  return routes.some((route) => normalizedPathname === route || normalizedPathname.startsWith(`${route}/`))
    || category?.trim().toLowerCase() === "clothes changer"
    || category?.trim().toLowerCase() === "personal image";
}
