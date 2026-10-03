const CONTENT_POLICY_ERROR_FIELDS = new Set([
  "content_policy",
  "content_filter",
  "content_policy_violation",
  "moderation_blocked",
  "safety_rejection",
  "safety_violation",
  "safety_violations"
]);
const PERMANENT_AGENT_ERROR_FIELDS = new Set([
  "authentication_error",
  "billing_hard_limit_reached",
  "context_length_exceeded",
  "forbidden",
  "insufficient_quota",
  "invalid_api_key",
  "invalid_request_error",
  "model_not_found",
  "permission_error",
  "unauthorized",
  "unsupported_value"
]);
const RETRYABLE_AGENT_ERROR_FIELDS = new Set([
  "internal_error",
  "internal_server_error",
  "overloaded",
  "rate_limit_exceeded",
  "rate_limit_error",
  "request_timeout",
  "server_error",
  "service_unavailable",
  "temporarily_unavailable",
  "too_many_requests",
  "timeout",
  "timeout_error",
  "upstream_error",
  "upstream_unavailable"
]);

export class AgentContentPolicyError extends Error {
  readonly statusCode: number;
  readonly providerCode?: string;
  readonly providerType?: string;

  constructor(params: {
    statusCode: number;
    providerCode?: string;
    providerType?: string;
  }) {
    super("The conversation agent request was rejected by the content policy.");
    this.name = "AgentContentPolicyError";
    this.statusCode = params.statusCode;
    this.providerCode = params.providerCode;
    this.providerType = params.providerType;
  }
}

export function normalizeAgentProviderErrorField(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return normalized || undefined;
}

export function isAgentContentPolicyErrorField(value: unknown): boolean {
  const normalized = normalizeAgentProviderErrorField(value);
  return Boolean(normalized && CONTENT_POLICY_ERROR_FIELDS.has(normalized));
}

export function isAgentContentPolicyErrorMessage(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  if (isAgentContentPolicyErrorField(normalized)) return true;
  const policySignal = "(?:content[_\\s-]*(?:policy|filter)|moderation|safety(?: system)?)";
  const rejectionSignal = "(?:block(?:ed|ing)?|den(?:y|ied)|disallow(?:ed)?|filter(?:ed)?|reject(?:ed|ion)?|refus(?:ed|al)|unsafe|violat(?:e[sd]?|ion)s?)";
  return new RegExp(
    `(?:${rejectionSignal}.{0,100}${policySignal}|${policySignal}.{0,100}${rejectionSignal})`,
    "i"
  ).test(normalized);
}

export function readAgentProviderStatusCode(
  errorRecord: Record<string, unknown> | undefined
): number | undefined {
  if (!errorRecord) return undefined;
  const rawStatusCode = errorRecord.status_code
    ?? errorRecord.statusCode
    ?? errorRecord.status;
  if (typeof rawStatusCode === "number" && Number.isFinite(rawStatusCode)) {
    return rawStatusCode;
  }
  return typeof rawStatusCode === "string" && /^\d{3}$/.test(rawStatusCode)
    ? Number(rawStatusCode)
    : undefined;
}

export function isRetryableAgentProviderFailure(
  errorRecord: Record<string, unknown> | undefined
): boolean {
  if (!errorRecord) return false;
  const providerCode = normalizeAgentProviderErrorField(errorRecord.code);
  const providerType = normalizeAgentProviderErrorField(errorRecord.type);
  if (
    isAgentContentPolicyErrorField(providerCode)
    || isAgentContentPolicyErrorField(providerType)
    || isAgentContentPolicyErrorMessage(errorRecord.message)
  ) {
    return false;
  }
  if (providerCode && PERMANENT_AGENT_ERROR_FIELDS.has(providerCode)) return false;
  if (providerCode && RETRYABLE_AGENT_ERROR_FIELDS.has(providerCode)) return true;
  const statusCode = readAgentProviderStatusCode(errorRecord);
  if (statusCode !== undefined) {
    return statusCode === 408 || statusCode === 429 || statusCode >= 500;
  }
  if (providerType && PERMANENT_AGENT_ERROR_FIELDS.has(providerType)) return false;
  if (providerType && RETRYABLE_AGENT_ERROR_FIELDS.has(providerType)) return true;
  const message = typeof errorRecord.message === "string" ? errorRecord.message : "";
  return /(?:upstream stream ended before terminal response event|temporar(?:y|ily) unavailable|\boverloaded\b|\brate limit(?:ed| exceeded)?\b|\b(?:request )?(?:timed out|timeout)\b|\b(?:internal )?server error\b)/i.test(message);
}

export function readAgentContentPolicyError(
  body: unknown,
  statusCode: number
): AgentContentPolicyError | undefined {
  const bodyRecord = body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : undefined;
  if (!bodyRecord) return undefined;
  const nestedError = bodyRecord.error
    && typeof bodyRecord.error === "object"
    && !Array.isArray(bodyRecord.error)
    ? bodyRecord.error as Record<string, unknown>
    : undefined;
  const incompleteDetails = bodyRecord.incomplete_details
    && typeof bodyRecord.incomplete_details === "object"
    && !Array.isArray(bodyRecord.incomplete_details)
    ? bodyRecord.incomplete_details as Record<string, unknown>
    : undefined;
  const responseStatus = normalizeAgentProviderErrorField(bodyRecord.status);
  const incompleteReason = responseStatus === "incomplete"
    ? normalizeAgentProviderErrorField(incompleteDetails?.reason)
    : undefined;
  const providerError = nestedError ?? bodyRecord;
  const providerCode = normalizeAgentProviderErrorField(providerError.code)
    ?? incompleteReason;
  const providerType = normalizeAgentProviderErrorField(providerError.type)
    ?? (responseStatus === "incomplete" ? "response_incomplete" : undefined);
  if (
    !isAgentContentPolicyErrorField(providerCode)
    && !isAgentContentPolicyErrorField(providerType)
    && !isAgentContentPolicyErrorMessage(providerError.message)
  ) {
    return undefined;
  }
  return new AgentContentPolicyError({
    statusCode,
    providerCode: providerCode
      ?? (isAgentContentPolicyErrorMessage(providerError.message) ? "content_policy" : undefined),
    providerType
  });
}
