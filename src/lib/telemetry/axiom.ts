import { FAILED_REQUEST_PAYLOAD_MAX_CHARS } from "@/lib/telemetry/failed-request-payload";

export type TelemetryLevel = "info" | "warn" | "error";
export type TelemetrySource = "client" | "server";

export type TelemetryEvent = {
  event: string;
  level?: TelemetryLevel;
  source?: TelemetrySource;
  service?: string;
  env?: string;
  route?: string;
  path?: string;
  stage?: string;
  status?: string;
  durationMs?: number;
  sessionId?: string;
  traceId?: string;
  requestId?: string;
  jobId?: string;
  uid?: string;
  userId?: string;
  guestUserId?: string;
  deviceId?: string;
  _time?: string;
  [key: string]: unknown;
};

// Keep this list aligned with fields already present in the Axiom dataset.
// Adding a new key here can fail ingestion while the Personal plan schema is full.
const TOP_LEVEL_KEYS = new Set([
  "_time",
  "apimartBackground",
  "apimartImageUrlCount",
  "apimartModeration",
  "apimartModel",
  "apimartN",
  "apimartOutputFormat",
  "apimartQuality",
  "apimartResolution",
  "apimartSize",
  "appSessionId",
  "action",
  "billing_surface",
  "provider",
  "deviceId",
  "durationMs",
  "elementLabel",
  "env",
  "entry",
  "errorMessage",
  "errorName",
  "errorStack",
  "event",
  "creative",
  "first_touch_campaign",
  "first_touch_content",
  "first_touch_creative",
  "first_touch_gclid",
  "first_touch_google_ads_ad_group_id",
  "first_touch_google_ads_campaign_id",
  "first_touch_google_ads_creative_id",
  "first_touch_google_ads_device",
  "first_touch_google_ads_keyword",
  "first_touch_google_ads_match_type",
  "first_touch_google_ads_network",
  "first_touch_landing_path",
  "first_touch_landing_url",
  "first_touch_medium",
  "first_touch_referrer_url",
  "first_touch_source",
  "first_touch_term",
  "first_touch_utm_campaign",
  "first_touch_utm_content",
  "first_touch_utm_medium",
  "first_touch_utm_source",
  "first_touch_utm_term",
  "gclid",
  "google_ads_ad_group_id",
  "google_ads_campaign_id",
  "google_ads_creative_id",
  "google_ads_device",
  "google_ads_keyword",
  "google_ads_match_type",
  "google_ads_network",
  "guestUserId",
  "host",
  "ipCity",
  "ipCountry",
  "input_mode",
  "jobId",
  "landing_path",
  "landing_url",
  "level",
  "moderationDecision",
  "path",
  "outputType",
  "promptCase",
  "promptPreview",
  "reason",
  "requestId",
  "route",
  "rawErrorMessage",
  "referrer_url",
  "serverReceivedAt",
  "service",
  "sessionId",
  "source",
  "sourceUseCase",
  "stage",
  "status",
  "statusCode",
  "traceId",
  "ui_version",
  "uid",
  "userId",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term"
]);

const CANONICAL_KEY_BY_ALIAS: Record<string, string> = {
  app_session_id: "appSessionId",
  aspect_ratio: "aspectRatio",
  asset_id: "assetId",
  auth_mode: "authMode",
  client_session_id: "clientSessionId",
  credit_balance: "creditBalance",
  duration_ms: "durationMs",
  error_message: "errorMessage",
  generation_entry: "generationEntry",
  generation_status: "generationStatus",
  guest_id: "guestUserId",
  guest_user_id: "guestUserId",
  guestId: "guestUserId",
  image_count: "imageCount",
  job_id: "jobId",
  output_type: "outputType",
  prompt_case: "promptCase",
  request_id: "requestId",
  session_id: "sessionId",
  source_use_case: "sourceUseCase",
  trace_id: "traceId",
  user_id: "userId",
  warning_count: "warningCount"
};

const REQUEST_SUMMARY_KEYS = new Set([
  "contentLength",
  "sourceAssetCount",
  "targetAssetCount"
]);

const RESPONSE_SUMMARY_KEYS = new Set([
  "assistantMessagePreview",
  "hasAssistantMessage",
  "hasJob",
  "intent"
]);

const UTM_JSON_KEYS = [
  "creative",
  "first_touch_campaign",
  "first_touch_content",
  "first_touch_creative",
  "first_touch_gclid",
  "first_touch_landing_path",
  "first_touch_landing_url",
  "first_touch_medium",
  "first_touch_referrer_url",
  "first_touch_source",
  "first_touch_term",
  "first_touch_utm_campaign",
  "first_touch_utm_content",
  "first_touch_utm_medium",
  "first_touch_utm_source",
  "first_touch_utm_term",
  "gclid",
  "landing_path",
  "landing_url",
  "referrer_url",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term"
];

const GOOGLE_ADS_JSON_KEYS = [
  "google_ads_ad_group_id",
  "google_ads_campaign_id",
  "google_ads_creative_id",
  "google_ads_device",
  "google_ads_keyword",
  "google_ads_match_type",
  "google_ads_network"
];

const ATTRS_MAP_KEYS = new Set([
  "imageModelExperimentKey",
  "imageModelExperimentId",
  "imageModelExperimentVariant",
  "imageModelExperimentSource",
  "elementHref",
  "elementTag",
  "pageKind",
  "referrer",
  "url",
  "userAgent",
  "viewportHeight",
  "viewportWidth",
  "workflow"
]);
function resolveEnv(): string {
  return process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || "development";
}

function shouldWriteAttrsMap(): boolean {
  return process.env.AXIOM_ATTRS_MAP_ENABLED === "1";
}

function shouldWriteAttributionJson(): boolean {
  return process.env.AXIOM_ATTRIBUTION_JSON_ENABLED === "1";
}

function isLocalTelemetryHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]";
}

function isLocalTelemetryUrl(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  const raw = value.trim();
  try {
    const parsed = new URL(raw);
    if (parsed.hostname) return isLocalTelemetryHost(parsed.hostname);
  } catch {
    // Fall through to host-like parsing below.
  }

  const hostLike = raw.split("/")[0]?.split("?")[0] ?? raw;
  if (hostLike.startsWith("[")) {
    const end = hostLike.indexOf("]");
    return end >= 0 ? isLocalTelemetryHost(hostLike.slice(0, end + 1)) : false;
  }
  return isLocalTelemetryHost(hostLike.split(":")[0] ?? hostLike);
}

function isAgentV4ValidationDiagnostic(event: TelemetryEvent): boolean {
  return event.source === "server" && event.event === "socialmedia.agent.v4.terminal_validation.failed";
}

function shouldSkipAxiomIngest(event: TelemetryEvent): boolean {
  if (isAgentV4ValidationDiagnostic(event)) return false;
  if (process.env.NODE_ENV === "development") return true;
  return (
    isLocalTelemetryUrl(event.url) ||
    isLocalTelemetryUrl(event.host) ||
    isLocalTelemetryUrl(event.origin) ||
    isLocalTelemetryUrl(event.referrer)
  );
}

function sanitizeString(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function sanitizePreservedString(value: string, maxLength: number): string {
  const normalized = value.trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function stringMaxLengthForKey(key: string): number {
  if (key === "errorStack") return 4000;
  if (key === "apimartPrompt") return 12000;
  if (key === "google_ads_json" || key === "utm_json") return 4000;
  return 1000;
}

function normalizeTelemetryValue(key: string, value: unknown): unknown {
  if (typeof value === "string") {
    const normalized = sanitizeString(value, stringMaxLengthForKey(key));
    return normalized || undefined;
  }
  return value;
}

function normalizeTelemetryAttrValue(key: string, value: unknown): unknown {
  const normalized = normalizeTelemetryValue(key, value);
  if (normalized === undefined) return undefined;
  if (normalized && typeof normalized === "object") {
    try {
      return sanitizeString(JSON.stringify(normalized), stringMaxLengthForKey(key));
    } catch {
      return undefined;
    }
  }
  return normalized;
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function asPlainRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function assignCanonicalAliases(event: TelemetryEvent): TelemetryEvent {
  const next: TelemetryEvent = { ...event };
  next.appSessionId = firstDefined(next.appSessionId, next.app_session_id) as string | undefined;
  next.durationMs = firstDefined(next.durationMs, next.duration_ms) as number | undefined;
  next.errorMessage = firstDefined(next.errorMessage, next.error_message) as string | undefined;
  next.guestUserId = firstDefined(next.guestUserId, next.guest_user_id, next.guestId, next.guest_id) as string | undefined;
  next.deviceId = firstDefined(next.deviceId, next.guestUserId, next.guest_user_id, next.guestId, next.guest_id, next.anonymousId) as string | undefined;
  next.jobId = firstDefined(next.jobId, next.job_id) as string | undefined;
  next.outputType = firstDefined(next.outputType, next.output_type) as string | undefined;
  next.promptCase = firstDefined(next.promptCase, next.prompt_case) as string | undefined;
  next.requestId = firstDefined(next.requestId, next.request_id) as string | undefined;
  next.sessionId = firstDefined(next.sessionId, next.session_id) as string | undefined;
  next.sourceUseCase = firstDefined(next.sourceUseCase, next.source_use_case) as string | undefined;
  next.traceId = firstDefined(next.traceId, next.trace_id) as string | undefined;
  next.userId = firstDefined(next.userId, next.user_id) as string | undefined;
  return next;
}

function buildSummaryFields(
  prefix: "requestSummary" | "responseSummary",
  value: unknown
): Record<string, unknown> | undefined {
  const record = asPlainRecord(value);
  if (!record) return undefined;
  const allowedKeys = prefix === "requestSummary" ? REQUEST_SUMMARY_KEYS : RESPONSE_SUMMARY_KEYS;
  const summary: Record<string, unknown> = {};
  for (const [summaryKey, summaryValue] of Object.entries(record)) {
    if (!allowedKeys.has(summaryKey)) continue;
    const sanitized = normalizeTelemetryValue(`${prefix}.${summaryKey}`, summaryValue);
    if (sanitized !== undefined) {
      summary[summaryKey] = sanitized;
    }
  }
  return Object.keys(summary).length ? summary : undefined;
}

function buildJsonStringField(raw: TelemetryEvent, keys: string[], outputKey: string): string | undefined {
  const payload: Record<string, unknown> = {};
  for (const key of keys) {
    const sanitized = normalizeTelemetryValue(key, raw[key]);
    if (
      sanitized === undefined ||
      sanitized === null ||
      typeof sanitized === "object" ||
      typeof sanitized === "function"
    ) {
      continue;
    }
    payload[key] = sanitized;
  }
  if (!Object.keys(payload).length) return undefined;
  return sanitizeString(JSON.stringify(payload), stringMaxLengthForKey(outputKey));
}
function sanitizeEvent(event: TelemetryEvent): TelemetryEvent {
  const raw: TelemetryEvent = assignCanonicalAliases({
    service: "vismuse-web",
    env: resolveEnv(),
    level: event.level ?? "info",
    _time: event._time ?? new Date().toISOString(),
    ...event
  });
  const agentVariant = raw.agentVariant === "agent_v1"
    || raw.agentVariant === "agent_v2"
    || raw.agentVariant === "agent_v4"
    ? raw.agentVariant
    : undefined;
  if (agentVariant) {
    const existingReason = typeof raw.reason === "string" ? raw.reason.trim() : "";
    if (!/(?:^|;)agent_variant=agent_v(?:1|2|4)(?:;|$)/.test(existingReason)) {
      raw.reason = [existingReason, `agent_variant=${agentVariant}`].filter(Boolean).join(";");
    }
  }
  const appendReasonDimension = (key: string, value: string | undefined) => {
    if (!value) return;
    const existingReason = typeof raw.reason === "string" ? raw.reason.trim() : "";
    const dimension = `${key}=${value}`;
    if (!existingReason.split(";").includes(dimension)) {
      raw.reason = [existingReason, dimension].filter(Boolean).join(";");
    }
  };
  if (typeof raw.entryVisitorId === "string" && /^[a-f0-9-]{36}$/i.test(raw.entryVisitorId)) {
    appendReasonDimension("general_entry_visitor", raw.entryVisitorId);
  }
  // Reuse the existing reason column: adding top-level columns can exceed the dataset schema limit.
  if (raw.event === "general_entry.exposure") {
    appendReasonDimension("general_entry_variant", raw.variant === "control" || raw.variant === "general" ? raw.variant : undefined);
    appendReasonDimension("general_entry_experiment", typeof raw.experimentId === "string" ? encodeURIComponent(raw.experimentId.slice(0, 80)) : undefined);
    appendReasonDimension("general_entry_assignment", typeof raw.assignmentSource === "string" ? encodeURIComponent(raw.assignmentSource.slice(0, 60)) : undefined);
  }
  const inputModeExperimentVariant = raw.input_mode_experiment_variant === "pipeline"
    || raw.input_mode_experiment_variant === "agent"
    || raw.input_mode_experiment_variant === "agent_v4"
    ? raw.input_mode_experiment_variant
    : undefined;
  const agentRuntimeVersion = raw.agentRuntimeVersion === "v1"
    || raw.agentRuntimeVersion === "v2"
    || raw.agentRuntimeVersion === "v3"
    || raw.agentRuntimeVersion === "v4"
    ? raw.agentRuntimeVersion
    : agentVariant === "agent_v1"
      ? "v1"
      : agentVariant === "agent_v2"
        ? "v2"
        : undefined;
  const imageBuilderRequestedRuntime = raw.imageBuilderRequestedRuntime === "v2"
    || raw.imageBuilderRequestedRuntime === "v3"
    || raw.imageBuilderRequestedRuntime === "v4"
    ? raw.imageBuilderRequestedRuntime
    : undefined;
  const imageBuilderExecutedRuntime = raw.imageBuilderExecutedRuntime === "v2"
    || raw.imageBuilderExecutedRuntime === "v3"
    || raw.imageBuilderExecutedRuntime === "v4"
    ? raw.imageBuilderExecutedRuntime
    : undefined;
  const imageBuilderMode = raw.imageBuilderMode === "disabled"
    || raw.imageBuilderMode === "shadow"
    || raw.imageBuilderMode === "active"
    ? raw.imageBuilderMode
    : undefined;
  const imageBuilderFallbackKind = raw.imageBuilderFallbackKind === "configuration"
    || raw.imageBuilderFallbackKind === "transport"
    || raw.imageBuilderFallbackKind === "semantic"
    || raw.imageBuilderFallbackKind === "unknown"
    ? raw.imageBuilderFallbackKind
    : undefined;
  const imageBuilderRequestedProvider = raw.imageBuilderRequestedProvider === "openai"
    || raw.imageBuilderRequestedProvider === "openrouter"
    || raw.imageBuilderRequestedProvider === "apimart"
    ? raw.imageBuilderRequestedProvider
    : undefined;
  const imageBuilderExecutedProvider = raw.imageBuilderExecutedProvider === "openai"
    || raw.imageBuilderExecutedProvider === "openrouter"
    || raw.imageBuilderExecutedProvider === "apimart"
    ? raw.imageBuilderExecutedProvider
    : undefined;
  const imageBuilderProviderFallbackKind = raw.imageBuilderProviderFallbackKind === "configuration"
    || raw.imageBuilderProviderFallbackKind === "transport"
    ? raw.imageBuilderProviderFallbackKind
    : undefined;
  const imageBuilderProviderFallbackStatus = raw.imageBuilderProviderFallbackStatus === "success"
    || raw.imageBuilderProviderFallbackStatus === "failed"
    || raw.imageBuilderProviderFallbackStatus === "deadline_exhausted"
    ? raw.imageBuilderProviderFallbackStatus
    : undefined;
  const videoAgentRequestedRuntime = raw.videoAgentRequestedRuntime === "v1"
    || raw.videoAgentRequestedRuntime === "v3"
    || raw.videoAgentRequestedRuntime === "experiment"
    ? raw.videoAgentRequestedRuntime
    : undefined;
  const videoAgentExecutedRuntime = raw.videoAgentExecutedRuntime === "v1"
    || raw.videoAgentExecutedRuntime === "v3"
    ? raw.videoAgentExecutedRuntime
    : undefined;
  const videoAgentCohort = raw.videoAgentCohort === "forced_v1"
    || raw.videoAgentCohort === "forced_v3"
    || raw.videoAgentCohort === "experiment_control_v1"
    || raw.videoAgentCohort === "experiment_treatment_v3"
    ? raw.videoAgentCohort
    : undefined;
  const videoAgentRolloutPercent = typeof raw.videoAgentRolloutPercent === "number"
    && Number.isFinite(raw.videoAgentRolloutPercent)
    && raw.videoAgentRolloutPercent >= 0
    && raw.videoAgentRolloutPercent <= 100
    ? String(raw.videoAgentRolloutPercent)
    : undefined;
  appendReasonDimension("input_mode_variant", inputModeExperimentVariant);
  appendReasonDimension("agent_runtime", agentRuntimeVersion);
  appendReasonDimension("image_builder_requested", imageBuilderRequestedRuntime);
  appendReasonDimension("image_builder_executed", imageBuilderExecutedRuntime);
  appendReasonDimension("image_builder_mode", imageBuilderMode);
  appendReasonDimension("image_builder_fallback", imageBuilderFallbackKind);
  appendReasonDimension("image_builder_requested_provider", imageBuilderRequestedProvider);
  appendReasonDimension("image_builder_executed_provider", imageBuilderExecutedProvider);
  appendReasonDimension("image_builder_provider_fallback", imageBuilderProviderFallbackKind);
  appendReasonDimension("image_builder_provider_fallback_status", imageBuilderProviderFallbackStatus);
  appendReasonDimension("video_agent_requested", videoAgentRequestedRuntime);
  appendReasonDimension("video_agent_executed", videoAgentExecutedRuntime);
  appendReasonDimension("video_agent_cohort", videoAgentCohort);
  appendReasonDimension("video_agent_rollout_percent", videoAgentRolloutPercent);
  const next: Partial<TelemetryEvent> = {};
  const attrs: Record<string, unknown> = {};
  const writeAttrs = shouldWriteAttrsMap();
  if (shouldWriteAttributionJson()) {
    const utmJson = buildJsonStringField(raw, UTM_JSON_KEYS, "utm_json");
    const googleAdsJson = buildJsonStringField(raw, GOOGLE_ADS_JSON_KEYS, "google_ads_json");
    if (utmJson && TOP_LEVEL_KEYS.has("utm_json")) next.utm_json = utmJson;
    if (googleAdsJson && TOP_LEVEL_KEYS.has("google_ads_json")) next.google_ads_json = googleAdsJson;
  }

  for (const [key, value] of Object.entries(raw)) {
    const canonicalKey = CANONICAL_KEY_BY_ALIAS[key] ?? key;
    if (canonicalKey !== key && TOP_LEVEL_KEYS.has(canonicalKey)) {
      continue;
    }
    if (canonicalKey === "requestSummary" || canonicalKey === "responseSummary") {
      const summary = buildSummaryFields(canonicalKey, value);
      if (summary) next[canonicalKey] = summary;
      continue;
    }

    const isServerFailedRequestPayload = canonicalKey === "promptPreview"
      && raw.source === "server"
      && raw.event === "socialmedia.server.request.failed";
    // Preserve diagnostic fragments exactly so long cause/issue chains can be reassembled.
    const sanitized = typeof value === "string" && canonicalKey === "errorStack" && isAgentV4ValidationDiagnostic(raw)
      ? value.slice(0, 4000)
      : typeof value === "string" && isServerFailedRequestPayload
      ? sanitizePreservedString(value, FAILED_REQUEST_PAYLOAD_MAX_CHARS)
      : normalizeTelemetryValue(canonicalKey, value);
    if (sanitized === undefined) continue;

    if (TOP_LEVEL_KEYS.has(canonicalKey)) {
      next[canonicalKey] = sanitized;
    } else if (writeAttrs && canonicalKey === "attrs" && value && typeof value === "object" && !Array.isArray(value)) {
      for (const [attrKey, attrValue] of Object.entries(value as Record<string, unknown>)) {
        if (!ATTRS_MAP_KEYS.has(attrKey)) continue;
        const sanitizedAttr = normalizeTelemetryAttrValue(attrKey, attrValue);
        if (sanitizedAttr !== undefined) attrs[attrKey] = sanitizedAttr;
      }
    } else if (writeAttrs && ATTRS_MAP_KEYS.has(canonicalKey)) {
      const sanitizedAttr = normalizeTelemetryAttrValue(canonicalKey, value);
      if (sanitizedAttr !== undefined) attrs[canonicalKey] = sanitizedAttr;
    }
  }

  if (Object.keys(attrs).length) {
    next.attrs = attrs;
  }

  return next as TelemetryEvent;
}

export function sanitizeAxiomEventForTest(event: TelemetryEvent): TelemetryEvent {
  return sanitizeEvent(event);
}

export async function axiomIngestBatch(events: TelemetryEvent[]): Promise<void> {
  const sanitizedEvents = events
    .filter((event) => !shouldSkipAxiomIngest(event))
    .map((event) => sanitizeEvent(event));

  if (!sanitizedEvents.length) return;

  const token = process.env.AXIOM_TOKEN?.trim();
  const dataset = process.env.AXIOM_DATASET?.trim();
  if (!token || !dataset) return;

  const url = `https://api.axiom.co/v1/datasets/${encodeURIComponent(dataset)}/ingest`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(sanitizedEvents)
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      console.warn("[axiom] ingest failed", {
        status: response.status,
        statusText: response.statusText,
        dataset,
        count: sanitizedEvents.length,
        event: sanitizedEvents[0]?.event,
        traceId: sanitizedEvents[0]?.traceId,
        jobId: sanitizedEvents[0]?.jobId,
        message: responseText.slice(0, 1000)
      });
    }
  } catch (error) {
    console.warn("[axiom] ingest request failed", {
      dataset,
      count: sanitizedEvents.length,
      event: sanitizedEvents[0]?.event,
      traceId: sanitizedEvents[0]?.traceId,
      jobId: sanitizedEvents[0]?.jobId,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function axiomIngest(event: TelemetryEvent): Promise<void> {
  await axiomIngestBatch([event]);
}

export function trackServerEvent(event: TelemetryEvent): void {
  void axiomIngest({
    ...event,
    source: "server"
  });
}

export async function withTelemetryStep<T>(
  step: string,
  context: Omit<TelemetryEvent, "event" | "source">,
  fn: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();
  await axiomIngest({
    ...context,
    event: `${step}.started`,
    source: "server",
    stage: typeof context.stage === "string" ? context.stage : step,
    status: "started"
  });

  try {
    const result = await fn();
    await axiomIngest({
      ...context,
      event: `${step}.completed`,
      source: "server",
      stage: typeof context.stage === "string" ? context.stage : step,
      status: "success",
      durationMs: Date.now() - startedAt
    });
    return result;
  } catch (error) {
    await axiomIngest({
      ...context,
      event: `${step}.failed`,
      source: "server",
      level: "error",
      stage: typeof context.stage === "string" ? context.stage : step,
      status: "failed",
      durationMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : undefined,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}
