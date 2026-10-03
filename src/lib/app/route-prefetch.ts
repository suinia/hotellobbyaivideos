/** A small paced queue: route warming must never compete with initial hydration. */
export type PrefetchConnection = { saveData?: boolean; effectiveType?: string; downlink?: number };

export function allowsBackgroundPrefetch(connection?: PrefetchConnection): boolean {
  return !connection?.saveData
    && !["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? "")
    && !(typeof connection?.downlink === "number" && connection.downlink < 1.5);
}

export function createRoutePrefetchQueue(currentPath: string) {
  const pending: string[] = [];
  const warmed = new Set<string>();
  function enqueue(href: string, priority = false) {
    const route = href.split("#")[0]?.trim();
    if (!route?.startsWith("/") || route.startsWith("//") || route === currentPath || warmed.has(route)) return;
    const index = pending.indexOf(route);
    if (index >= 0) pending.splice(index, 1);
    if (priority) pending.unshift(route);
    else pending.push(route);
  }
  return {
    enqueue,
    take() {
      const route = pending.shift();
      if (route) warmed.add(route);
      return route;
    },
    invalidate(route: string) { warmed.delete(route); },
    get size() { return pending.length; }
  };
}
