import { LOCALE_RESOURCES, LOCALE_NAMESPACES, getSourceIndex } from "@/locales/catalog.generated";
import { isSiteLocale } from "@/lib/i18n/site-locales";

/** Public translations only; retry just the namespace whose JS chunk failed. */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const locale = params.get("locale");
  if (!isSiteLocale(locale)) return Response.json({ error: "Unsupported locale" }, { status: 400 });
  const requested = params.get("namespaces");
  const namespaces = requested === null ? LOCALE_NAMESPACES : [...new Set(requested.split(","))];
  if (!namespaces.length || namespaces.some((namespace) => !LOCALE_NAMESPACES.includes(namespace))) {
    return Response.json({ error: "Unsupported namespace" }, { status: 400 });
  }
  const resources = LOCALE_RESOURCES[locale] as Record<string, unknown>;
  const body = params.get("index") === "1"
    ? Object.fromEntries(Object.entries(getSourceIndex()).filter(([, key]) => namespaces.includes(key.split(".")[0])))
    : Object.fromEntries(namespaces.map((namespace) => [namespace, resources[namespace]]));
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
