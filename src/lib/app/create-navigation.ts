import { findAppToolByPathname, resolveAppToolPublicHref } from "@/app/app/_components/app-data";

/** Normalize only actual creation entry points; list pages keep the last entry. */
export function resolveAppCreateHref(pathname: string, preferPublicToolRoutes: boolean): string | null {
  if (pathname === "/app" || pathname === "/app/") return "/app";
  const tool = findAppToolByPathname(pathname);
  if (!tool) return null;
  return preferPublicToolRoutes
    ? resolveAppToolPublicHref(tool.slug) ?? `/${tool.slug}`
    : tool.href;
}
