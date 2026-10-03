/** Parse only a hostname/host or HTTP(S) origin, never a full page URL. */
export function normalizeTriggerHostname(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw || raw === "null" || !/^(?:https?:\/\/)?[^/?#\\\s@,]+\/?$/i.test(raw)) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!hostname || hostname.length > 253) return undefined;
    if (!hostname.startsWith("[") && !hostname.split(".").every(
      (label) => label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
    )) return undefined;
    return hostname;
  } catch {
    return undefined;
  }
}

/** Attribution only: client-supplied headers do not establish identity or access. */
export function resolveTriggerHostname(headers: Pick<Headers, "get">): string | undefined {
  // A malformed explicit attribution stays unknown instead of recording the API host.
  const explicit = headers.get("x-vismuse-client-origin")
    ?? headers.get("x-flyermaker-origin")
    ?? headers.get("x-trigger-hostname");
  if (explicit !== null) return normalizeTriggerHostname(explicit);

  return normalizeTriggerHostname(headers.get("origin"))
    ?? normalizeTriggerHostname(headers.get("x-forwarded-host")?.split(",")[0])
    ?? normalizeTriggerHostname(headers.get("host"));
}
