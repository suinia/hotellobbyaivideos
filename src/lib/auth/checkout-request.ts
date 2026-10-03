import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/** Retry only an authentication rejection, using the original checkout intent. */
export async function requestCheckoutWithAuthRecovery(
  url: "/api/v1/credits/recharge" | "/api/v1/socialmedia/assets/unlock",
  init: RequestInit,
  accountId: string,
  dependencies: {
    fetch?: typeof fetch;
    refreshAccountId?: () => Promise<string | undefined>;
  } = {}
): Promise<Response> {
  const request = dependencies.fetch ?? fetch;
  const response = await request(url, init);
  if (response.status !== 401) return response;
  init.signal?.throwIfAborted();

  const refreshAccountId = dependencies.refreshAccountId ?? (async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return undefined;
    const { data, error } = await client.auth.refreshSession();
    return error ? undefined : data.session?.user.id;
  });
  let refreshedAccountId: string | undefined;
  let stopWaiting: (() => void) | undefined;
  try {
    const aborted = new Promise<never>((_resolve, reject) => {
      stopWaiting = () => reject(init.signal?.reason ?? new DOMException("Aborted", "AbortError"));
      init.signal?.addEventListener("abort", stopWaiting, { once: true });
    });
    refreshedAccountId = await Promise.race([refreshAccountId(), aborted]);
  } catch {
    init.signal?.throwIfAborted();
    return response;
  } finally {
    if (stopWaiting) init.signal?.removeEventListener("abort", stopWaiting);
  }
  // A refresh must not continue a purchase under a different signed-in account.
  init.signal?.throwIfAborted();
  if (!accountId || refreshedAccountId !== accountId) return response;
  // The same body and idempotency key survive the single retry. Never retry a
  // transport error, permission rejection, or an ambiguous checkout result.
  return request(url, init);
}
