import { trackServerEvent, type TelemetryEvent } from "@/lib/telemetry/axiom";

type ApiHandler<Context = unknown> = (
  request: Request,
  context: Context
) => Response | Promise<Response>;

type ApiTelemetryOptions = {
  route: string;
  method?: string;
  eventPrefix?: string;
  attrs?: Record<string, unknown>;
};

function getRequestPath(request: Request): string | undefined {
  try {
    return new URL(request.url).pathname;
  } catch {
    return undefined;
  }
}

function getRequestHost(request: Request): string | undefined {
  return request.headers.get("host") ?? undefined;
}

function getHeaderValue(request: Request, name: string): string | undefined {
  return request.headers.get(name)?.trim() || undefined;
}

function buildRequestTelemetryBase(request: Request, options: ApiTelemetryOptions): Omit<TelemetryEvent, "event" | "source"> {
  const route = options.route;
  return {
    route,
    path: getRequestPath(request),
    host: getRequestHost(request),
    requestId: getHeaderValue(request, "x-request-id") ?? crypto.randomUUID(),
    traceId: getHeaderValue(request, "x-trace-id"),
    sessionId: getHeaderValue(request, "x-session-id"),
    stage: "api_request",
    action: options.method ?? request.method,
    ...options.attrs
  };
}

export function withApiTelemetry<Context = unknown>(
  options: ApiTelemetryOptions,
  handler: ApiHandler<Context>
): ApiHandler<Context> {
  return async (request, context) => {
    const startedAt = Date.now();
    const eventPrefix = options.eventPrefix ?? "api.request";
    const base = buildRequestTelemetryBase(request, options);

    try {
      const response = await handler(request, context);
      trackServerEvent({
        ...base,
        event: `${eventPrefix}.completed`,
        status: response.status >= 400 ? "failed" : "success",
        level: response.status >= 500 ? "error" : response.status >= 400 ? "warn" : "info",
        statusCode: response.status,
        durationMs: Date.now() - startedAt
      });
      return response;
    } catch (error) {
      trackServerEvent({
        ...base,
        event: `${eventPrefix}.failed`,
        status: "failed",
        level: "error",
        statusCode: 500,
        durationMs: Date.now() - startedAt,
        errorName: error instanceof Error ? error.name : undefined,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  };
}
