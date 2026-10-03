type LocaleResources = Record<string, unknown>;
type NamespaceLoaders = Record<string, () => Promise<unknown>>;
type SourceIndex = Record<string, string>;

/** Public JSON recovery avoids bundlers retaining a rejected chunk import. */
export async function fetchLocaleResources(locale: string, namespaces?: readonly string[]): Promise<LocaleResources> {
  const query = new URLSearchParams({ locale });
  if (namespaces) query.set("namespaces", namespaces.join(","));
  const response = await fetch(`/api/v1/locale-resources?${query}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load locale resources");
  return response.json();
}

export async function fetchLocaleSourceIndex(namespace: string): Promise<SourceIndex> {
  const query = new URLSearchParams({ locale: "en", namespaces: namespace, index: "1" });
  const response = await fetch(`/api/v1/locale-resources?${query}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load locale source index");
  return response.json();
}

/** Merge namespace snapshots; concurrent consumers share downloads and failures can retry. */
export function createBrowserLocaleCatalog(
  initial: Record<string, LocaleResources>,
  loaders: Record<string, NamespaceLoaders | (() => Promise<LocaleResources>)>,
  indexLoaders: Record<string, () => Promise<SourceIndex>> = {}
) {
  const resources = { ...initial };
  const pending = new Map<string, Promise<void>>();
  const readyIndexes = new Set<string>();
  let sourceIndex: SourceIndex = {};
  const register = (locale: string, value: LocaleResources) => {
    if (!Object.hasOwn(resources, locale)) { resources[locale] = value; return; }
    const missing = Object.fromEntries(Object.entries(value).filter(([key]) => !Object.hasOwn(resources[locale], key)));
    // Replace the namespace map so translation caches cannot retain stale contents.
    if (Object.keys(missing).length) resources[locale] = { ...resources[locale], ...missing };
  };
  const registerSourceIndex = (value: SourceIndex, namespaces: readonly string[]) => {
    const missing = namespaces.filter((namespace) => !readyIndexes.has(namespace));
    if (!missing.length) return;
    sourceIndex = { ...sourceIndex, ...value };
    missing.forEach((namespace) => readyIndexes.add(namespace));
  };
  const has = (locale: string, namespaces?: readonly string[]) => {
    if (!Object.hasOwn(resources, locale)) return false;
    if (!namespaces) return true;
    return namespaces.every((namespace) => Object.hasOwn(resources[locale], namespace)
      && (!Object.hasOwn(indexLoaders, namespace) || readyIndexes.has(namespace)));
  };
  const share = (key: string, run: () => Promise<void>): Promise<void> => {
    const existing = pending.get(key);
    if (existing) return existing;
    const request = run().finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  };
  const load = (locale: string, namespaces?: readonly string[]): Promise<void> => {
    if (!Object.hasOwn(loaders, locale)) {
      return has(locale, namespaces) ? Promise.resolve() : Promise.reject(new Error("Unsupported locale"));
    }
    const loader = loaders[locale];
    if (typeof loader === "function") {
      if (has(locale, namespaces)) return Promise.resolve();
      return share(locale, () => loader().then((value) => register(locale, value)));
    }
    const required = [...new Set(namespaces ?? Object.keys(loader))].sort();
    if (required.some((namespace) => !Object.hasOwn(loader, namespace))) return Promise.reject(new Error("Unsupported namespace"));
    if (has(locale, required) && has("en", required)) return Promise.resolve();
    return share(`${locale}:${required.join(",")}`, async () => {
      await Promise.all([
        ...(locale === "en" ? [] : [load("en", required)]),
        ...required.map(async (namespace) => {
          await Promise.all([
            Object.hasOwn(resources[locale] ?? {}, namespace) ? undefined : share(`resource:${locale}:${namespace}`, async () => {
              const value = await loader[namespace]();
              if (!value || typeof value !== "object") throw new Error("Invalid locale namespace");
              register(locale, { [namespace]: value });
            }),
            !Object.hasOwn(indexLoaders, namespace) || readyIndexes.has(namespace) ? undefined : share(`index:${namespace}`, async () => {
              registerSourceIndex(await indexLoaders[namespace](), [namespace]);
            })
          ]);
        })
      ]);
    });
  };
  return { resources, register, has, load, registerSourceIndex, getSourceIndex: () => sourceIndex };
}
