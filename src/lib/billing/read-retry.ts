const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const TRANSIENT_CODES = new Set([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET"
]);

function isTransientReadFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { name?: string; message?: string; code?: string; cause?: unknown };
  if (value.name === "AbortError") return false;
  return TRANSIENT_CODES.has(value.code ?? "")
    || /(?:fetch failed|failed to fetch|network request failed)/i.test(value.message ?? "")
    || (value.cause !== error && isTransientReadFailure(value.cause));
}

/** Only wrap individual read queries, never credit mutations or a whole billing workflow. */
export async function retryBillingRead<T extends { error: unknown; status?: number }>(
  read: () => PromiseLike<T>,
  wait: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 500))
): Promise<T> {
  try {
    const result = await read();
    if (!result.error || !(TRANSIENT_STATUSES.has(result.status ?? 0)
      || ((!result.status || result.status === 0) && isTransientReadFailure(result.error)))) return result;
  } catch (error) {
    if (!isTransientReadFailure(error)) throw error;
  }
  await wait();
  // Exactly one retry; return/throw its result without converting failure into success.
  return await read();
}
