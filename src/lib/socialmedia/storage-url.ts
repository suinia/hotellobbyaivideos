const LEGACY_SUPABASE_HOSTS = new Set([
  "pjngyaqydfsywuzhjeeu.supabase.co"
]);

const SUPABASE_IMAGE_TRANSFORMS_ENABLED =
  process.env.NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORMS === "true";

function getConfiguredSupabaseOrigin(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!configuredUrl) return "";

  try {
    return new URL(configuredUrl).origin;
  } catch {
    return "";
  }
}

export function normalizeSupabaseStorageUrl(url: string): string {
  const normalized = url.trim();
  if (!normalized || !/^https?:\/\//i.test(normalized)) return normalized;

  const configuredOrigin = getConfiguredSupabaseOrigin();
  if (!configuredOrigin) return normalized;

  try {
    const parsed = new URL(normalized);
    if (!LEGACY_SUPABASE_HOSTS.has(parsed.hostname)) return normalized;
    return new URL(`${parsed.pathname}${parsed.search}${parsed.hash}`, configuredOrigin).toString();
  } catch {
    return normalized;
  }
}

export type SupabaseImageTransformOptions = {
  width?: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
};

export function buildSupabasePublicImageTransformUrl(
  url: string,
  options: SupabaseImageTransformOptions = {}
): string {
  const normalized = normalizeSupabaseStorageUrl(url).trim();
  if (!normalized || !/^https?:\/\//i.test(normalized)) return normalized;
  if (!SUPABASE_IMAGE_TRANSFORMS_ENABLED) return normalized;

  try {
    const parsed = new URL(normalized);
    const publicObjectPrefix = "/storage/v1/object/public/";
    if (!parsed.pathname.startsWith(publicObjectPrefix)) return normalized;

    parsed.pathname = parsed.pathname.replace(
      publicObjectPrefix,
      "/storage/v1/render/image/public/"
    );
    parsed.searchParams.delete("width");
    parsed.searchParams.delete("height");
    parsed.searchParams.delete("quality");
    parsed.searchParams.delete("resize");
    if (options.width) parsed.searchParams.set("width", String(options.width));
    if (options.height) parsed.searchParams.set("height", String(options.height));
    if (options.quality) parsed.searchParams.set("quality", String(options.quality));
    if (options.resize) parsed.searchParams.set("resize", options.resize);
    return parsed.toString();
  } catch {
    return normalized;
  }
}
