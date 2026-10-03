export class AppThreadSessionFetchError extends Error {
  status?: number;
  constructor(message: string, params?: { status?: number }) {
    super(message);
    this.name = "AppThreadSessionFetchError";
    this.status = params?.status;
  }
}

/** An account change or newer refresh made this response obsolete. */
export class AppThreadSessionSupersededError extends Error {
  constructor() {
    super("Chat request was superseded.");
    this.name = "AppThreadSessionSupersededError";
  }
}

type Snapshot = { session_id?: string; error?: string };
type Packet = { data: Snapshot; reusable: boolean };
type RequestEntry = { promise: Promise<Packet>; prefetch: boolean; consumed: boolean };
export type ThreadSessionLoadOptions = { signal?: AbortSignal; dedupe?: boolean; useCache?: boolean };

/** A short, single-use cache for speculative reads, never a history authority. */
export function createThreadSessionLoader(options: {
  fetch: typeof fetch;
  identity: () => string | null;
  now?: () => number;
  ttlMs?: number;
  maxEntries?: number;
}) {
  const cache = new Map<string, { data: Snapshot; expiresAt: number }>();
  const requests = new Map<string, RequestEntry>();
  const now = options.now ?? Date.now;
  let identity = options.identity();
  let generation = 0;

  function reset() {
    generation += 1;
    cache.clear();
    requests.clear();
    identity = options.identity();
  }

  function synchronizeIdentity() {
    if (options.identity() !== identity) reset();
    return identity;
  }

  async function load<T extends Snapshot>(url: string, config: ThreadSessionLoadOptions = {}, prefetch = false): Promise<T> {
    const owner = synchronizeIdentity();
    if (url.includes("fresh_unlocks=") || config.dedupe === false) reset();
    const requestGeneration = generation;
    const match = /^\/api\/v1\/sessions\/([^/?]+)$/.exec(url);
    const reusableRequest = Boolean(owner && match && !config.signal && config.dedupe !== false);
    const key = `${owner}:${url}`;
    const current = () => requestGeneration === generation && options.identity() === owner;
    const cached = cache.get(key);
    if (!prefetch) cache.delete(key);
    let entry = reusableRequest ? requests.get(key) : undefined;
    if (reusableRequest && cached && cached.expiresAt > now() && (prefetch || config.useCache)) {
      if (prefetch) return structuredClone(cached.data) as T;
      // Share the delivery during the same mount (including Strict Mode's
      // repeated effect), then consume it. A later navigation still reloads.
      entry = { prefetch: false, consumed: true, promise: Promise.resolve({ data: cached.data, reusable: true }) };
      const cachedEntry = entry;
      entry.promise = entry.promise.finally(() => {
        if (requests.get(key) === cachedEntry) requests.delete(key);
      });
      requests.set(key, entry);
    }
    if (cached?.expiresAt && cached.expiresAt <= now()) cache.delete(key);

    if (!prefetch && !config.useCache && entry?.prefetch) {
      entry.consumed = true;
      entry = undefined;
    }
    if (!entry) {
      entry = { prefetch, consumed: !prefetch, promise: Promise.resolve({ data: {}, reusable: false }) };
      const thisEntry = entry;
      entry.promise = (async () => {
        const response = await options.fetch(url, {
          cache: "no-store", signal: config.signal,
          ...(prefetch ? { headers: { "x-vismuse-session-prefetch": "1" } } : {})
        });
        const data = await response.json().catch(() => ({})) as Snapshot;
        if (!current()) throw new AppThreadSessionSupersededError();
        if (!response.ok) throw new AppThreadSessionFetchError(data.error || "Unable to load this chat.", { status: response.status });
        const reusable = response.headers.get("x-vismuse-session-prefetch") === "ready"
          && data.session_id === (match ? decodeURIComponent(match[1]) : undefined);
        if (prefetch && reusableRequest && reusable && !thisEntry.consumed) {
          cache.delete(key);
          cache.set(key, { data: structuredClone(data), expiresAt: now() + (options.ttlMs ?? 10_000) });
          while (cache.size > (options.maxEntries ?? 8)) cache.delete(cache.keys().next().value!);
        }
        return { data, reusable };
      })().finally(() => {
        if (requests.get(key) === thisEntry) requests.delete(key);
      });
      if (reusableRequest) requests.set(key, entry);
    }
    if (!prefetch) entry.consumed = true;
    let packet: Packet;
    try {
      packet = await entry.promise;
    } catch (error) {
      if (!prefetch && entry.prefetch && current()) {
        return load<T>(url, { ...config, useCache: false });
      }
      throw error;
    }
    if (!current()) throw new AppThreadSessionSupersededError();
    if (!prefetch && entry.prefetch && !packet.reusable) {
      // Pending/incomplete tasks still run the ordinary recovery read on entry.
      return load<T>(url, { ...config, useCache: false });
    }
    return structuredClone(packet.data) as T;
  }

  return {
    load,
    reset,
    async prefetch(url: string) {
      if (!synchronizeIdentity()) return;
      if ([...requests.values()].filter((entry) => entry.prefetch).length >= 2) return;
      try { await load(url, {}, true); } catch { /* Navigation can retry. */ }
    }
  };
}
