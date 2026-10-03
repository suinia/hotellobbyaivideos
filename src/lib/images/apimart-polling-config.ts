function resolveBoundedDelayMs(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  const normalized = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return Math.max(min, Math.min(max, normalized));
}

export function resolveApimartImageFirstPollDelayMs(value?: unknown): number {
  return resolveBoundedDelayMs(value, 30_000, 30_000, 60_000);
}

export function resolveApimartImagePollIntervalMs(value?: unknown): number {
  return resolveBoundedDelayMs(value, 5_000, 5_000, 10_000);
}

export const SOCIALMEDIA_APIMART_IMAGE_FIRST_POLL_DELAY_MS = resolveApimartImageFirstPollDelayMs(
  process.env.SOCIALMEDIA_APIMART_FIRST_POLL_DELAY_MS
    ?? process.env.APIMART_IMAGE_INITIAL_POLL_DELAY_MS
);

export const SOCIALMEDIA_APIMART_IMAGE_POLL_INTERVAL_MS = resolveApimartImagePollIntervalMs(
  process.env.SOCIALMEDIA_APIMART_IMAGE_POLL_INTERVAL_MS
    ?? process.env.SOCIALMEDIA_APIMART_POLL_INTERVAL_MS
    ?? process.env.APIMART_IMAGE_POLL_INTERVAL_MS
);
