import { normalizeMessageText } from "./catalog";

/** Keep aliases that English resources cannot reconstruct without ambiguity. */
export function compactSourceIndex(
  sourceIndex: Record<string, string>,
  english: Record<string, unknown>,
): Record<string, string> {
  const candidates = new Map<string, Set<string>>();
  function record(text: string, key: string) {
    const folded = normalizeMessageText(text).toLowerCase();
    const keys = candidates.get(folded) ?? new Set<string>();
    keys.add(key);
    candidates.set(folded, keys);
  }
  function walk(value: unknown, key: string) {
    if (typeof value === "string") record(value, key);
    else if (value && typeof value === "object") {
      for (const [part, child] of Object.entries(value)) walk(child, `${key}.${part}`);
    }
  }
  // Matches catalog.ensureAliases: home copy is accessed by key, not inferred.
  for (const [namespace, resource] of Object.entries(english)) {
    if (namespace !== "home") walk(resource, namespace);
  }
  const reconstructible = new Map([...candidates].map(([text, keys]) => [text, new Set(keys)]));
  for (const [text, key] of Object.entries(sourceIndex)) record(text, key);
  return Object.fromEntries(Object.entries(sourceIndex).filter(([text, key]) => {
    const folded = normalizeMessageText(text).toLowerCase();
    // Retain every ambiguous alias to preserve canonical lookup precedence.
    return candidates.get(folded)!.size !== 1 || !reconstructible.get(folded)?.has(key);
  }));
}
