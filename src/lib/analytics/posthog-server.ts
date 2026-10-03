const POSTHOG_PROJECT_KEY =
  process.env.POSTHOG_PROJECT_KEY?.trim() ||
  process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ||
  "phc_NPaESe3VTduG1YvNnQZ9WVzB4gcHPtJNdA4mFecmI3D";
const POSTHOG_API_HOST =
  process.env.POSTHOG_API_HOST?.trim() ||
  process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ||
  "https://us.i.posthog.com";

function isServerAnalyticsDisabled(): boolean {
  if (process.env.POSTHOG_SERVER_CAPTURE_DISABLED === "1") return true;
  if (!POSTHOG_PROJECT_KEY) return true;
  if (process.env.POSTHOG_SERVER_CAPTURE_LOCAL === "1") return false;
  return process.env.NODE_ENV !== "production";
}

export async function captureServerAnalyticsEvent(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>
): Promise<void> {
  if (isServerAnalyticsDisabled()) return;
  const normalizedDistinctId = distinctId.trim() || "server";
  const response = await fetch(`${POSTHOG_API_HOST.replace(/\/+$/, "")}/capture/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      api_key: POSTHOG_PROJECT_KEY,
      event,
      distinct_id: normalizedDistinctId,
      properties
    })
  });
  if (!response.ok) {
    throw new Error(`PostHog capture failed: ${response.status}`);
  }
}

export async function captureServerAnalyticsEventBestEffort(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>
): Promise<void> {
  try {
    await captureServerAnalyticsEvent(event, distinctId, properties);
  } catch (error) {
    console.error("[posthog-server] capture failed:", error instanceof Error ? error.message : String(error));
  }
}

export function captureServerAnalyticsEventSoon(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>
): void {
  void captureServerAnalyticsEventBestEffort(event, distinctId, properties);
}
