import { stripSiteLocaleFromPath } from "./site-locales";

// The composer and subscription controls are reused on marketing pages too.
const WORKBENCH_NAMESPACES = ["common", "workbench"] as const;
const HOME_NAMESPACES = ["common", "workbench", "home"] as const;
const SEO_NAMESPACES = ["common", "workbench", "home", "seo"] as const;
const OTHER_WORKBENCH_PATHS = new Set([
  "/poster-maker", "/business-card-maker", "/invitation-maker", "/background-remover",
  "/tattoo-generator", "/spotify-canvas-generator", "/promo-video", "/hotel-lobby-ai"
]);

export function getLocaleNamespacesForPath(pathname: string): readonly string[] {
  const path = stripSiteLocaleFromPath(pathname).replace(/\/$/, "") || "/";
  if (path === "/" || path === "/home") return HOME_NAMESPACES;
  // SEO copy and carousel step props are translated by the server. The client
  // only needs shared controls, the composer, and the header/auth home copy.
  if (path === "/tools/album-cover-generator") return HOME_NAMESPACES;
  if (/^\/(?:app|chat|socialmedia|thread|share|billing|auth|internal|local)(?:\/|$)/.test(path)
    || /^\/ai-[^/]+$/.test(path) || OTHER_WORKBENCH_PATHS.has(path)) return WORKBENCH_NAMESPACES;
  return SEO_NAMESPACES;
}
