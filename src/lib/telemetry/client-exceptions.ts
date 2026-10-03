"use client";

import { captureAnalyticsEvent } from "@/lib/analytics/posthog";
import { getClientSessionId, truncateTelemetryText } from "@/lib/telemetry/client";

type ClientExceptionSource = "window_error" | "unhandled_rejection" | "react_error" | "react_global_error";

type ClientExceptionExtra = {
  componentStack?: string | null;
  digest?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
};

const DEDUPE_WINDOW_MS = 5_000;
const MAX_STACK_CHARS = 2_000;
const recentExceptions = new Map<string, number>();

function getErrorName(value: unknown): string {
  return value instanceof Error ? value.name : typeof value;
}

function getErrorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getErrorStack(value: unknown): string | undefined {
  return value instanceof Error ? truncateTelemetryText(value.stack, MAX_STACK_CHARS) : undefined;
}

function getErrorLocation(extra: ClientExceptionExtra): string | undefined {
  if (!extra.filename) return undefined;
  const line = extra.lineno ? `:${extra.lineno}` : "";
  const column = extra.colno ? `:${extra.colno}` : "";
  return truncateTelemetryText(`${extra.filename}${line}${column}`, MAX_STACK_CHARS);
}

function shouldSkipDuplicate(key: string): boolean {
  const now = Date.now();
  for (const [recentKey, lastSeenAt] of recentExceptions) {
    if (now - lastSeenAt > DEDUPE_WINDOW_MS) recentExceptions.delete(recentKey);
  }

  const lastSeenAt = recentExceptions.get(key);
  recentExceptions.set(key, now);
  return lastSeenAt !== undefined && now - lastSeenAt <= DEDUPE_WINDOW_MS;
}

export function reportClientException(
  source: ClientExceptionSource,
  error: unknown,
  extra: ClientExceptionExtra = {}
): void {
  if (typeof window === "undefined") return;

  const message = truncateTelemetryText(getErrorMessage(error), 240) ?? "Unknown client exception";
  const stack = getErrorStack(error) ?? getErrorLocation(extra);
  const route = window.location.pathname || "/";
  const dedupeKey = [route, message, stack?.slice(0, 500) ?? ""].join("|");
  if (shouldSkipDuplicate(dedupeKey)) return;

  try {
    captureAnalyticsEvent("client_exception", {
      stage: "client_exception",
      status: "failed",
      level: "error",
      reason: `${source}: ${message}`,
      sessionId: getClientSessionId(),
      exception_source: source,
      error_name: getErrorName(error),
      error_message: message,
      error_stack: stack,
      component_stack: truncateTelemetryText(extra.componentStack, MAX_STACK_CHARS),
      digest: extra.digest,
      filename: extra.filename,
      lineno: extra.lineno,
      colno: extra.colno,
      route,
      url: window.location.href,
      user_agent: navigator.userAgent
    });
  } catch {
    // Exception telemetry must never cause another product exception.
  }
}
