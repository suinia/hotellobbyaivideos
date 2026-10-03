export function buildStaticThumbWebpUrl(url: string, options: { allowRemote?: boolean } = {}): string {
  const normalized = url.trim();
  if (!normalized) return "";

  try {
    const parsed = new URL(normalized);
    if ((parsed.protocol === "http:" || parsed.protocol === "https:") && !options.allowRemote) {
      return "";
    }
    const path = parsed.pathname;
    parsed.pathname = path.match(/\.[a-z0-9]+$/i)
      ? path.replace(/\.[a-z0-9]+$/i, "_thumb.webp")
      : `${path}_thumb.webp`;
    return parsed.toString();
  } catch {
    return normalized.match(/\.[a-z0-9]+(?:[?#].*)?$/i)
      ? normalized.replace(/\.[a-z0-9]+(?=([?#]|$))/i, "_thumb.webp")
      : `${normalized}_thumb.webp`;
  }
}
