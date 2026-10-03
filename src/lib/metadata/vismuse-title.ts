const TRAILING_VISMUSE_PATTERN = /(?:\s*\|\s*vismuse)+\s*$/i;

export function stripTrailingVismuse(value: string): string {
  return value.trim().replace(TRAILING_VISMUSE_PATTERN, "").trim();
}

export function formatVismuseTitle(value: string, fallback = "Task"): string {
  const title = stripTrailingVismuse(value) || stripTrailingVismuse(fallback) || "Vismuse";
  return title.toLowerCase() === "vismuse" ? "Hotel Lobby AI" : `${title} | Hotel Lobby AI`;
}
