import {
  resolveApimartImageFirstPollDelayMs,
  resolveApimartImagePollIntervalMs
} from "@/lib/images/apimart-polling-config";

type ImageModelProvider = {
  model: string;
  apiUrl: string;
  key: string;
};

export type TokenCreditRate = {
  in: number;
  out: number;
};

export type ImageCreditCostMap = Record<string, number>;

export type ImageBuilderV3Provider = "openai" | "openrouter" | "apimart";

export type ImageBuilderV3ProviderStage = "primary" | "fallback";

export type ImageBuilderV3ProviderConfig = {
  provider: ImageBuilderV3Provider;
  apiKey: string;
  baseUrl?: string;
  model: string;
  criticModel: string;
};

export type ImageBuilderV4Provider = "openai" | "openrouter" | "apimart";

export type ImageBuilderV4ProviderStage = "primary" | "fallback";

export type ImageBuilderV4ProviderConfig = {
  provider: ImageBuilderV4Provider;
  apiKey: string;
  baseUrl?: string;
  model: string;
  criticModel: string;
};

export type ImageBuilderV4Mode = "off" | "shadow" | "experiment" | "active";

export type ImageBuilderV4RolloutConfig = {
  mode: ImageBuilderV4Mode;
  rolloutPercent: number;
  rolloutSalt: string;
};

export type VideoBuilderV3Provider = "openai" | "openrouter" | "apimart";

export type VideoBuilderV3ProviderStage = "primary" | "fallback";

export type VideoBuilderV3ProviderConfig = {
  provider: VideoBuilderV3Provider;
  apiKey: string;
  baseUrl?: string;
  model: string;
  criticModel: string;
};

export type VideoAgentRuntimeMode = "v1" | "v3" | "v4" | "experiment";

export type VideoAgentRolloutConfig = {
  runtime: VideoAgentRuntimeMode;
  v3RolloutPercent: number;
  v3RolloutSalt: string;
};

function tryParseProvidersJson(raw: string): unknown {
  return JSON.parse(raw);
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === "'" || first === "\"") && last === first) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function envOrDefault(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized || fallback;
}

function envBoolean(value: string | undefined, fallback = false): boolean {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return fallback;
}

function envNonNegativeInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : fallback;
}

function firstEnvValue(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) return normalized;
  }
  return "";
}

function parseFrontdeskProvider(
  value: string | undefined,
  fallback: "toapis" | "apimart" | "openrouter"
): "toapis" | "apimart" | "openrouter" {
  const normalized = value?.trim().toLowerCase();
  return normalized === "toapis" || normalized === "apimart" || normalized === "openrouter"
    ? normalized
    : fallback;
}

function parseImageBuilderProvider(
  value: string | undefined,
  fallback: "toapis" | "apimart" | "openrouter"
): "toapis" | "apimart" | "openrouter" {
  const normalized = value?.trim().toLowerCase();
  return normalized === "toapis" || normalized === "apimart" || normalized === "openrouter"
    ? normalized
    : fallback;
}

function parseImageBuilderMode(value: string | undefined): "disabled" | "shadow" | "active" {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "shadow" || normalized === "active") return normalized;
  return "disabled";
}

export function resolveImageBuilderRuntime(value: string | undefined): "v2" | "v3" | "v4" {
  const normalized = value?.trim().toLowerCase();
  return normalized === "v3" || normalized === "v4" ? normalized : "v2";
}

function parseVideoAgentRuntime(value: string | undefined): VideoAgentRuntimeMode {
  const normalized = value?.trim().toLowerCase();
  return normalized === "v3" || normalized === "v4" || normalized === "experiment"
    ? normalized
    : "v1";
}

function parseImageBuilderV4Mode(value: string | undefined): ImageBuilderV4Mode {
  const normalized = value?.trim().toLowerCase();
  return normalized === "shadow" || normalized === "experiment" || normalized === "active"
    ? normalized
    : "off";
}

export function resolveImageBuilderV4RolloutConfig(
  env: Readonly<Record<string, string | undefined>>
): ImageBuilderV4RolloutConfig {
  const rawPercent = Number(env.IMAGE_BUILDER_V4_ROLLOUT_PERCENT ?? 0);
  return {
    mode: parseImageBuilderV4Mode(env.IMAGE_BUILDER_V4_MODE),
    rolloutPercent: Number.isFinite(rawPercent)
      ? Math.min(100, Math.max(0, rawPercent))
      : 0,
    rolloutSalt: envOrDefault(
      env.IMAGE_BUILDER_V4_ROLLOUT_SALT,
      "image-builder-v4-rollout-v1"
    )
  };
}

export function resolveVideoAgentRolloutConfig(
  env: Readonly<Record<string, string | undefined>>
): VideoAgentRolloutConfig {
  const rawPercent = Number(env.VIDEO_AGENT_V3_ROLLOUT_PERCENT ?? 0);
  const v3RolloutPercent = Number.isFinite(rawPercent)
    ? Math.min(100, Math.max(0, rawPercent))
    : 0;
  return {
    runtime: parseVideoAgentRuntime(env.VIDEO_AGENT_RUNTIME),
    v3RolloutPercent,
    v3RolloutSalt: envOrDefault(
      env.VIDEO_AGENT_V3_ROLLOUT_SALT,
      "video-agent-v3-rollout-v1"
    )
  };
}

export function resolveVideoBuilderV3ProviderConfig(
  env: Readonly<Record<string, string | undefined>>,
  stage: VideoBuilderV3ProviderStage = "primary"
): VideoBuilderV3ProviderConfig {
  const providerValue = stage === "primary"
    ? env.VIDEO_AGENT_V3_PROVIDER
    : env.VIDEO_AGENT_V3_FALLBACK_PROVIDER;
  const normalizedProvider = providerValue?.trim().toLowerCase();
  const defaultProvider: VideoBuilderV3Provider = stage === "primary" ? "openrouter" : "apimart";
  const provider: VideoBuilderV3Provider = normalizedProvider === "openai"
    || normalizedProvider === "openrouter"
    || normalizedProvider === "apimart"
    ? normalizedProvider
    : defaultProvider;
  const defaultModel = provider === "openrouter"
    ? "openai/gpt-5.6-luna"
    : provider === "apimart"
      ? "gpt-5.6-luna"
      : "gpt-5.6";
  const model = envOrDefault(
    stage === "primary" ? env.VIDEO_AGENT_V3_MODEL : env.VIDEO_AGENT_V3_FALLBACK_MODEL,
    defaultModel
  );
  const configuredBaseUrl = firstEnvValue(
    stage === "primary" ? env.VIDEO_AGENT_V3_BASE_URL : env.VIDEO_AGENT_V3_FALLBACK_BASE_URL
  );
  const baseUrl = configuredBaseUrl
    ? configuredBaseUrl.replace(/\/+$/, "")
    : provider === "openrouter"
      ? "https://openrouter.ai/api/v1"
      : provider === "apimart"
        ? `${envOrDefault(env.APIMART_API_URL, "https://api.apimart.ai").replace(/\/+$/, "")}/v1`
        : undefined;
  const apiKey = provider === "openrouter"
    ? firstEnvValue(env.OPENROUTER_API_KEY)
    : provider === "apimart"
      ? firstEnvValue(env.APIMART_RESPONSES_API_KEY, env.APIMART_API_KEY)
      : firstEnvValue(env.OPENAI_API_KEY);
  return {
    provider,
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
    model,
    criticModel: envOrDefault(
      stage === "primary"
        ? env.VIDEO_AGENT_V3_CRITIC_MODEL
        : env.VIDEO_AGENT_V3_FALLBACK_CRITIC_MODEL,
      model
    )
  };
}

export function resolveImageBuilderV3ProviderConfig(
  env: Readonly<Record<string, string | undefined>>,
  stage: ImageBuilderV3ProviderStage = "primary"
): ImageBuilderV3ProviderConfig {
  const providerValue = stage === "primary"
    ? env.IMAGE_BUILDER_V3_PROVIDER
    : env.IMAGE_BUILDER_V3_FALLBACK_PROVIDER;
  const normalizedProvider = providerValue?.trim().toLowerCase();
  const defaultProvider: ImageBuilderV3Provider = stage === "primary" ? "openrouter" : "apimart";
  const provider: ImageBuilderV3Provider = normalizedProvider === "openai"
    || normalizedProvider === "openrouter"
    || normalizedProvider === "apimart"
    ? normalizedProvider
    : defaultProvider;
  const defaultModel = provider === "openrouter"
    ? "openai/gpt-5.6-luna"
    : provider === "apimart"
      ? "gpt-5.6-luna"
      : "gpt-5.6";
  const model = envOrDefault(
    stage === "primary" ? env.IMAGE_BUILDER_V3_MODEL : env.IMAGE_BUILDER_V3_FALLBACK_MODEL,
    defaultModel
  );
  const configuredBaseUrl = firstEnvValue(
    stage === "primary" ? env.IMAGE_BUILDER_V3_BASE_URL : env.IMAGE_BUILDER_V3_FALLBACK_BASE_URL
  );
  const baseUrl = configuredBaseUrl
    ? configuredBaseUrl.replace(/\/+$/, "")
    : provider === "openrouter"
      ? "https://openrouter.ai/api/v1"
      : provider === "apimart"
        ? `${envOrDefault(env.APIMART_API_URL, "https://api.apimart.ai").replace(/\/+$/, "")}/v1`
        : undefined;
  const apiKey = provider === "openrouter"
    ? firstEnvValue(env.OPENROUTER_API_KEY)
    : provider === "apimart"
      ? firstEnvValue(env.APIMART_RESPONSES_API_KEY, env.APIMART_API_KEY)
      : firstEnvValue(env.OPENAI_API_KEY);
  return {
    provider,
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
    model,
    criticModel: envOrDefault(
      stage === "primary"
        ? env.IMAGE_BUILDER_V3_CRITIC_MODEL
        : env.IMAGE_BUILDER_V3_FALLBACK_CRITIC_MODEL,
      model
    )
  };
}

export function resolveImageBuilderV4ProviderConfig(
  env: Readonly<Record<string, string | undefined>>,
  stage: ImageBuilderV4ProviderStage = "primary"
): ImageBuilderV4ProviderConfig {
  const providerValue = stage === "primary"
    ? firstEnvValue(
        env.IMAGE_BUILDER_V4_PRIMARY_PROVIDER,
        env.IMAGE_BUILDER_V4_PROVIDER
      )
    : env.IMAGE_BUILDER_V4_FALLBACK_PROVIDER;
  const normalizedProvider = providerValue?.trim().toLowerCase();
  const defaultProvider: ImageBuilderV4Provider = stage === "primary"
    ? "openrouter"
    : "apimart";
  const provider: ImageBuilderV4Provider = normalizedProvider === "openai"
    || normalizedProvider === "openrouter"
    || normalizedProvider === "apimart"
    ? normalizedProvider
    : defaultProvider;
  const defaultModel = provider === "openrouter"
    ? "openai/gpt-5.6-luna"
    : provider === "apimart"
      ? "gpt-5.6-luna"
      : "gpt-5.6";
  const model = envOrDefault(
    stage === "primary"
      ? firstEnvValue(
          env.IMAGE_BUILDER_V4_PRIMARY_MODEL,
          env.IMAGE_BUILDER_V4_MODEL
        )
      : env.IMAGE_BUILDER_V4_FALLBACK_MODEL,
    defaultModel
  );
  const configuredBaseUrl = firstEnvValue(
    stage === "primary"
      ? firstEnvValue(
          env.IMAGE_BUILDER_V4_PRIMARY_BASE_URL,
          env.IMAGE_BUILDER_V4_BASE_URL
        )
      : env.IMAGE_BUILDER_V4_FALLBACK_BASE_URL
  );
  const baseUrl = configuredBaseUrl
    ? configuredBaseUrl.replace(/\/+$/, "")
    : provider === "openrouter"
      ? "https://openrouter.ai/api/v1"
      : provider === "apimart"
        ? `${envOrDefault(env.APIMART_API_URL, "https://api.apimart.ai").replace(/\/+$/, "")}/v1`
        : undefined;
  const configuredApiKey = stage === "primary"
    ? firstEnvValue(
        env.IMAGE_BUILDER_V4_PRIMARY_API_KEY,
        env.IMAGE_BUILDER_V4_API_KEY
      )
    : firstEnvValue(env.IMAGE_BUILDER_V4_FALLBACK_API_KEY);
  const apiKey = provider === "openrouter"
    ? firstEnvValue(configuredApiKey, env.OPENROUTER_API_KEY)
    : provider === "apimart"
      ? firstEnvValue(
          configuredApiKey,
          env.APIMART_RESPONSES_API_KEY,
          env.APIMART_API_KEY
        )
      : firstEnvValue(configuredApiKey, env.OPENAI_API_KEY);
  return {
    provider,
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
    model,
    criticModel: envOrDefault(
      stage === "primary"
        ? firstEnvValue(
            env.IMAGE_BUILDER_V4_PRIMARY_CRITIC_MODEL,
            env.IMAGE_BUILDER_V4_CRITIC_MODEL
          )
        : env.IMAGE_BUILDER_V4_FALLBACK_CRITIC_MODEL,
      model
    )
  };
}

const imageBuilderV3ProviderConfig = resolveImageBuilderV3ProviderConfig(process.env);
const imageBuilderV3FallbackProviderConfig = resolveImageBuilderV3ProviderConfig(
  process.env,
  "fallback"
);
const videoBuilderV3ProviderConfig = resolveVideoBuilderV3ProviderConfig(process.env);
const videoBuilderV3FallbackProviderConfig = resolveVideoBuilderV3ProviderConfig(
  process.env,
  "fallback"
);
const videoAgentRolloutConfig = resolveVideoAgentRolloutConfig(process.env);
const imageBuilderV4ProviderConfig = resolveImageBuilderV4ProviderConfig(process.env);
const imageBuilderV4FallbackProviderConfig = resolveImageBuilderV4ProviderConfig(
  process.env,
  "fallback"
);
const imageBuilderV4RolloutConfig = resolveImageBuilderV4RolloutConfig(process.env);

function isWaffoTestMode(): boolean {
  const environment = (process.env.WAFFO_ENVIRONMENT ?? "").trim().toLowerCase();
  if (["production", "prod", "live"].includes(environment)) return false;
  if (["test", "testing", "sandbox"].includes(environment)) return true;
  return (process.env.WAFFO_TEST_MODE ?? "true").trim().toLowerCase() === "true";
}

function waffoPrivateKey(): string {
  const testMode = isWaffoTestMode();
  if (!testMode) {
    // Never fall back to a sandbox key in production. A configuration mistake
    // must fail checkout creation rather than signing live API calls with the
    // wrong credential.
    return firstEnvValue(process.env.WAFFO_PRIVATE_KEY, process.env.waffo_live_key);
  }
  return firstEnvValue(
    process.env.WAFFO_PRIVATE_KEY,
    process.env.waffo_test_key
  );
}

function parseProvidersJsonLenient(raw: string): unknown {
  const normalized = stripWrappingQuotes(raw)
    .replace(/,\s*([\]}])/g, "$1")
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, "$1\"$2\":");

  return JSON.parse(normalized);
}

function parseImageModelProviders(raw: string | undefined): ImageModelProvider[] {
  const defaultProvider: ImageModelProvider = {
    model: "google/gemini-3.1-flash-image-preview",
    apiUrl: "https://openrouter.ai/api/v1/chat/completions",
    key: (process.env.OPENROUTER_API_KEY ?? process.env.LLM_API_KEY ?? "").trim()
  };

  if (!raw?.trim()) {
    return [defaultProvider];
  }

  try {
    let parsed: unknown;
    try {
      parsed = tryParseProvidersJson(raw);
    } catch {
      parsed = parseProvidersJsonLenient(raw);
      console.warn("[config] Parsed NANO_BANANA_MODEL_PROVIDERS with lenient mode; prefer strict JSON format.");
    }

    if (!Array.isArray(parsed)) {
      console.warn("[config] NANO_BANANA_MODEL_PROVIDERS is not an array; falling back to default provider.");
      return [defaultProvider];
    }

    const providers = parsed
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return null;
        }

        const record = item as Record<string, unknown>;
        const model = String(record.model ?? "").trim();
        const apiUrl = String(record.apiUrl ?? record.API_URL ?? record.api_url ?? "").trim();
        const key = String(
          record.key
          ?? record.apiKey
          ?? record.API_KEY
          ?? record.api_key
          ?? defaultProvider.key
          ?? ""
        ).trim();
        if (!model || !apiUrl) {
          return null;
        }
        return { model, apiUrl, key };
      })
      .filter((item): item is ImageModelProvider => Boolean(item));

    if (!providers.length) {
      console.warn("[config] NANO_BANANA_MODEL_PROVIDERS has no valid provider; falling back to default provider.");
      return [defaultProvider];
    }

    return providers;
  } catch {
    console.warn("[config] Failed to parse NANO_BANANA_MODEL_PROVIDERS; falling back to default provider.");
    return [defaultProvider];
  }
}

function parseTokenCreditRates(raw: string | undefined): Record<string, TokenCreditRate> {
  const defaults: Record<string, TokenCreditRate> = {
    default: {
      in: 50,
      out: 250
    }
  };

  if (!raw?.trim()) {
    return defaults;
  }

  try {
    let parsed: unknown;
    try {
      parsed = tryParseProvidersJson(raw);
    } catch {
      parsed = parseProvidersJsonLenient(raw);
      console.warn("[config] Parsed BILLING_TOKEN_CREDIT_RATES with lenient mode; prefer strict JSON format.");
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return defaults;
    }

    const entries = Object.entries(parsed as Record<string, unknown>)
      .map(([model, value]) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          return null;
        }
        const record = value as Record<string, unknown>;
        const inputRate = Number(record.in ?? record.input ?? 0);
        const outputRate = Number(record.out ?? record.output ?? 0);
        if (!Number.isFinite(inputRate) || inputRate < 0 || !Number.isFinite(outputRate) || outputRate < 0) {
          return null;
        }
        return [model.trim().toLowerCase(), { in: inputRate, out: outputRate }] as const;
      })
      .filter((item): item is readonly [string, TokenCreditRate] => Boolean(item));

    const normalized = Object.fromEntries(entries);
    if (!normalized.default) {
      normalized.default = defaults.default;
    }
    return normalized;
  } catch {
    console.warn("[config] Failed to parse BILLING_TOKEN_CREDIT_RATES; falling back to default rates.");
    return defaults;
  }
}

function parseImageCreditCosts(raw: string | undefined): ImageCreditCostMap {
  const defaults: ImageCreditCostMap = {
    "1K_low": 10,
    "1K_medium": 80,
    "1K_high": 300,
    "2K_low": 20,
    "2K_medium": 200,
    "2K_high": 700,
    "4K_low": 40,
    "4K_medium": 300,
    "4K_high": 1200
  };

  if (!raw?.trim()) {
    return defaults;
  }

  try {
    let parsed: unknown;
    try {
      parsed = tryParseProvidersJson(raw);
    } catch {
      parsed = parseProvidersJsonLenient(raw);
      console.warn("[config] Parsed BILLING_IMAGE_CREDIT_COSTS with lenient mode; prefer strict JSON format.");
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return defaults;
    }

    const entries = Object.entries(parsed as Record<string, unknown>)
      .map(([key, value]) => {
        const credits = Number(value);
        if (!key.trim() || !Number.isFinite(credits) || credits < 0) {
          return null;
        }
        return [key.trim(), Math.round(credits)] as const;
      })
      .filter((item): item is readonly [string, number] => Boolean(item));

    return {
      ...defaults,
      ...Object.fromEntries(entries)
    };
  } catch {
    console.warn("[config] Failed to parse BILLING_IMAGE_CREDIT_COSTS; falling back to default costs.");
    return defaults;
  }
}

export function parseImage25PrimaryProvider(raw?: string): "apimart" | "openrouter" {
  return raw?.trim().toLowerCase() === "openrouter" ? "openrouter" : "apimart";
}

export function parseImage25FallbackProvider(raw?: string): "apimart" | "openrouter" | "none" {
  const value = raw?.trim().toLowerCase();
  if (value === "apimart") return "apimart";
  if (value === "none" || value === "off" || value === "false") return "none";
  return "openrouter";
}

function parseImagePrimaryProvider(raw: string | undefined): "apimart" | "vectorengine" | "hfsyapi" | "toapis" | "openrouter" {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === "hfsyapi") return "hfsyapi";
  if (normalized === "toapis") return "toapis";
  if (normalized === "openrouter") return "openrouter";
  return normalized === "vectorengine" ? "vectorengine" : "apimart";
}

export type ImageFallbackProvider = "apimart" | "vectorengine" | "hfsyapi" | "toapis" | "openrouter" | "none";

function parseImageFallbackProvider(raw: string | undefined): ImageFallbackProvider {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === "apimart") return "apimart";
  if (normalized === "hfsyapi") return "hfsyapi";
  if (normalized === "toapis") return "toapis";
  if (normalized === "openrouter") return "openrouter";
  return normalized === "none" || normalized === "off" || normalized === "false" ? "none" : "vectorengine";
}

function parseOptionalImageFallbackProvider(raw: string | undefined): ImageFallbackProvider | undefined {
  return raw?.trim() ? parseImageFallbackProvider(raw) : undefined;
}

function parseImagePollTimeoutMs(): number {
  // IMAGE_POLL_TIMEOUT_MS is the shared deadline for async image tasks. Keep
  // the previous provider-specific names as a deploy-safe fallback only.
  const raw = process.env.IMAGE_POLL_TIMEOUT_MS
    ?? process.env.SOCIALMEDIA_APIMART_POLL_TIMEOUT_MS
    ?? process.env.APIMART_IMAGE_TIMEOUT_MS
    ?? process.env.TOAPIS_IMAGE_TIMEOUT_MS
    ?? "200000";
  return Math.max(30_000, Number(raw) || 200_000);
}

function parseLlmProvider(
  raw: string | undefined,
  fallback: "openrouter" | "apimart" | "vectorengine" | "hfsyapi" | "toapis" | "none"
): "openrouter" | "apimart" | "vectorengine" | "hfsyapi" | "toapis" | "none" {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === "openrouter") return "openrouter";
  if (normalized === "vectorengine") return "vectorengine";
  if (normalized === "hfsyapi") return "hfsyapi";
  if (normalized === "toapis") return "toapis";
  if (normalized === "none" || normalized === "off" || normalized === "false") return "none";
  if (normalized === "apimart") return "apimart";
  return fallback;
}

function parseVideoProvider(raw: string | undefined): "xinhankr" | "volcengine-seedance" | "hfsyapi" | "apimart" | "toapis-videos" | "minimax" {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === "minimax" || normalized === "minimax-video" || normalized === "minimax-videos") {
    return "minimax";
  }
  if (normalized === "xinhankr" || normalized === "xinhankr-relay" || normalized === "relay") {
    return "xinhankr";
  }
  if (normalized === "toapis" || normalized === "toapis-video" || normalized === "toapis-videos" || normalized === "seedance-2" || normalized === "seedance-2-fast" || normalized === "seedance-2-mini") {
    return "toapis-videos";
  }
  if (normalized === "volcengine-seedance" || normalized === "volcengine" || normalized === "seedance") {
    return "volcengine-seedance";
  }
  if (normalized === "hfsyapi" || normalized === "hfsy" || normalized === "sd-2" || normalized === "sd-2-fast") {
    return "hfsyapi";
  }
  return "minimax";
}

function parseMiniMaxH3Provider(raw: string | undefined): "minimax" | "apimart" {
  return raw?.trim().toLowerCase() === "apimart" ? "apimart" : "minimax";
}

export type MiniMaxH3FallbackProvider = "minimax" | "apimart" | "none";

function parseMiniMaxH3FallbackProvider(raw: string | undefined): MiniMaxH3FallbackProvider {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === "minimax" || normalized === "minimax-video" || normalized === "minimax-videos") {
    return "minimax";
  }
  return normalized === "none" || normalized === "off" || normalized === "false"
    ? "none"
    : "apimart";
}

function parseSocialmediaInputMode(raw: string | undefined): "pipeline" | "agent" {
  return raw?.trim().toLowerCase() === "agent" ? "agent" : "pipeline";
}

export const appConfig = {
  name: "Vismuse AI",
  version: "0.1.0",
  llm: {
    primaryProvider: parseLlmProvider(process.env.LLM_PRIMARY_PROVIDER, "openrouter"),
    fallbackProvider: parseLlmProvider(process.env.LLM_FALLBACK_PROVIDER, "apimart"),
    apiUrl: envOrDefault(process.env.LLM_API_URL, "https://openrouter.ai/api/v1/chat/completions"),
    // Keep the generic LLM URL/key/model tuple aligned for legacy callers that
    // still bypass the provider-aware client.
    apiKey: firstEnvValue(process.env.LLM_API_KEY, process.env.OPENROUTER_LLM_API_KEY, process.env.OPENROUTER_API_KEY),
    model: envOrDefault(process.env.LLM_MODEL, "openai/gpt-5.6-luna"),
    openrouterApiUrl: envOrDefault(
      process.env.OPENROUTER_LLM_API_URL,
      envOrDefault(process.env.LLM_API_URL, "https://openrouter.ai/api/v1/chat/completions")
    ),
    openrouterApiKey: firstEnvValue(
      process.env.OPENROUTER_LLM_API_KEY,
      process.env.OPENROUTER_API_KEY,
      process.env.LLM_API_KEY
    ),
    openrouterModel: envOrDefault(
      process.env.OPENROUTER_LLM_MODEL,
      envOrDefault(process.env.LLM_MODEL, "openai/gpt-5.6-luna")
    ),
    apimartApiUrl: envOrDefault(
      process.env.APIMART_LLM_API_URL,
      `${envOrDefault(process.env.APIMART_API_URL, "https://api.apimart.ai").replace(/\/+$/, "")}/api/v1/chat/completions`
    ),
    apimartApiKey: firstEnvValue(process.env.APIMART_LLM_API_KEY, process.env.APIMART_API_KEY),
    apimartModel: envOrDefault(process.env.APIMART_LLM_MODEL, "gpt-5.6-luna"),
    vectorengineApiUrl: envOrDefault(
      process.env.VECTORENGINE_LLM_API_URL,
      "https://api.vectorengine.ai/v1/chat/completions"
    ),
    vectorengineApiKey: firstEnvValue(process.env.VECTORENGINE_LLM_API_KEY, process.env.VECTORENGINE_API_KEY, process.env.LLM_API_KEY),
    vectorengineModel: envOrDefault(process.env.VECTORENGINE_LLM_MODEL, "gemini-3-flash-preview"),
    hfsyapiApiUrl: envOrDefault(process.env.HFSYAPI_LLM_API_URL, "https://www.hfsyapi.cn/v1/chat/completions"),
    hfsyapiApiKey: firstEnvValue(process.env.HFSYAPI_LLM_API_KEY, process.env.HFSYAPI_API_KEY),
    hfsyapiModel: envOrDefault(process.env.HFSYAPI_LLM_MODEL, "gpt-5.4"),
    toapisApiUrl: envOrDefault(process.env.TOAPIS_LLM_API_URL, "https://toapis.com/v1/chat/completions"),
    toapisApiKey: firstEnvValue(process.env.TOAPIS_API_KEY),
    toapisModel: envOrDefault(process.env.TOAPIS_LLM_MODEL, "gpt-5.6-luna"),
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 25000),
    copyFallbackModel: process.env.LLM_COPY_FALLBACK_MODEL ?? "gemini-2.5-flash",
    copyPolishModel: process.env.LLM_COPY_POLISH_MODEL ?? "gpt-5.4-mini",
    rescueModel: process.env.LLM_RESCUE_MODEL ?? "gpt-5.4-mini",
    httpReferer: process.env.LLM_HTTP_REFERER ?? process.env.NEXT_PUBLIC_APP_URL ?? "",
    xTitle: process.env.LLM_X_TITLE ?? "Vismuse AI"
  },
  frontdeskAgent: {
    primaryProvider: parseFrontdeskProvider(process.env.FRONTDESK_PRIMARY_PROVIDER, "toapis"),
    primaryModel: envOrDefault(process.env.FRONTDESK_PRIMARY_MODEL, "gpt-5.4-nano-official"),
    fallbackProvider: parseFrontdeskProvider(process.env.FRONTDESK_FALLBACK_PROVIDER, "apimart"),
    fallbackModel: envOrDefault(process.env.FRONTDESK_FALLBACK_MODEL, "gpt-5.4-nano"),
    adaptiveModelEnabled: envBoolean(process.env.FRONTDESK_ADAPTIVE_MODEL_ENABLED),
    complexModel: envOrDefault(process.env.FRONTDESK_COMPLEX_MODEL, "gpt-5.6-terra"),
    complexHistoryTurns: envNonNegativeInteger(process.env.FRONTDESK_COMPLEX_HISTORY_TURNS, 6),
    complexHistoryChars: envNonNegativeInteger(process.env.FRONTDESK_COMPLEX_HISTORY_CHARS, 12_000)
  },
  v1Agent: {
    primaryProvider: parseFrontdeskProvider(process.env.V1_AGENT_PRIMARY_PROVIDER, "openrouter"),
    primaryModel: envOrDefault(process.env.V1_AGENT_PRIMARY_MODEL, "openai/gpt-5.6-luna"),
    fallbackProvider: parseFrontdeskProvider(process.env.V1_AGENT_FALLBACK_PROVIDER, "apimart"),
    fallbackModel: envOrDefault(
      process.env.V1_AGENT_FALLBACK_MODEL,
      envOrDefault(process.env.APIMART_RESPONSES_MODEL, "gpt-5.3-codex")
    )
  },
  imageBuilderAgent: {
    mode: parseImageBuilderMode(process.env.IMAGE_BUILDER_MODE),
    runtime: resolveImageBuilderRuntime(process.env.IMAGE_BUILDER_RUNTIME),
    primaryProvider: parseImageBuilderProvider(process.env.IMAGE_BUILDER_PRIMARY_PROVIDER, "toapis"),
    primaryModel: envOrDefault(process.env.IMAGE_BUILDER_PRIMARY_MODEL, "gpt-5.4"),
    fallbackProvider: parseImageBuilderProvider(process.env.IMAGE_BUILDER_FALLBACK_PROVIDER, "apimart"),
    fallbackModel: envOrDefault(process.env.IMAGE_BUILDER_FALLBACK_MODEL, "gpt-5.4"),
    v3Provider: imageBuilderV3ProviderConfig.provider,
    v3ApiKey: imageBuilderV3ProviderConfig.apiKey,
    v3BaseUrl: imageBuilderV3ProviderConfig.baseUrl,
    v3Model: imageBuilderV3ProviderConfig.model,
    v3CriticModel: imageBuilderV3ProviderConfig.criticModel,
    v3FallbackProvider: imageBuilderV3FallbackProviderConfig.provider,
    v3FallbackApiKey: imageBuilderV3FallbackProviderConfig.apiKey,
    v3FallbackBaseUrl: imageBuilderV3FallbackProviderConfig.baseUrl,
    v3FallbackModel: imageBuilderV3FallbackProviderConfig.model,
    v3FallbackCriticModel: imageBuilderV3FallbackProviderConfig.criticModel,
    v3ProviderFallbackEnabled: envBoolean(
      process.env.IMAGE_BUILDER_V3_PROVIDER_FALLBACK,
      true
    ),
    v3TimeoutMs: Math.max(
      1_000,
      Number(process.env.IMAGE_BUILDER_V3_TIMEOUT_MS ?? 60_000) || 60_000
    ),
    v3TracingEnabled: imageBuilderV3ProviderConfig.provider === "openai"
      && envBoolean(process.env.IMAGE_BUILDER_V3_TRACING_ENABLED),
    v3TransportFallbackEnabled: envBoolean(
      process.env.IMAGE_BUILDER_V3_TRANSPORT_FALLBACK,
      true
    )
  },
  imageBuilderAgentV4: {
    mode: imageBuilderV4RolloutConfig.mode,
    rolloutPercent: imageBuilderV4RolloutConfig.rolloutPercent,
    rolloutSalt: imageBuilderV4RolloutConfig.rolloutSalt,
    provider: imageBuilderV4ProviderConfig.provider,
    apiKey: imageBuilderV4ProviderConfig.apiKey,
    baseUrl: imageBuilderV4ProviderConfig.baseUrl,
    model: imageBuilderV4ProviderConfig.model,
    criticModel: imageBuilderV4ProviderConfig.criticModel,
    fallbackProvider: imageBuilderV4FallbackProviderConfig.provider,
    fallbackApiKey: imageBuilderV4FallbackProviderConfig.apiKey,
    fallbackBaseUrl: imageBuilderV4FallbackProviderConfig.baseUrl,
    fallbackModel: imageBuilderV4FallbackProviderConfig.model,
    fallbackCriticModel: imageBuilderV4FallbackProviderConfig.criticModel,
    providerFallbackEnabled: envBoolean(
      process.env.IMAGE_BUILDER_V4_PROVIDER_FALLBACK,
      true
    ),
    timeoutMs: Math.max(
      1_000,
      Number(process.env.IMAGE_BUILDER_V4_TIMEOUT_MS ?? 60_000) || 60_000
    ),
    tracingEnabled: imageBuilderV4ProviderConfig.provider === "openai"
      && envBoolean(process.env.IMAGE_BUILDER_V4_TRACING_ENABLED)
  },
  videoAgent: {
    runtime: videoAgentRolloutConfig.runtime,
    v3RolloutPercent: videoAgentRolloutConfig.v3RolloutPercent,
    v3RolloutSalt: videoAgentRolloutConfig.v3RolloutSalt,
    v3ShadowEnabled: envBoolean(process.env.VIDEO_AGENT_V3_SHADOW),
    v4ShadowEnabled: envBoolean(process.env.VIDEO_AGENT_V4_SHADOW),
    v3Provider: videoBuilderV3ProviderConfig.provider,
    v3ApiKey: videoBuilderV3ProviderConfig.apiKey,
    v3BaseUrl: videoBuilderV3ProviderConfig.baseUrl,
    v3Model: videoBuilderV3ProviderConfig.model,
    v3CriticModel: videoBuilderV3ProviderConfig.criticModel,
    v3FallbackProvider: videoBuilderV3FallbackProviderConfig.provider,
    v3FallbackApiKey: videoBuilderV3FallbackProviderConfig.apiKey,
    v3FallbackBaseUrl: videoBuilderV3FallbackProviderConfig.baseUrl,
    v3FallbackModel: videoBuilderV3FallbackProviderConfig.model,
    v3FallbackCriticModel: videoBuilderV3FallbackProviderConfig.criticModel,
    v3ProviderFallbackEnabled: envBoolean(
      process.env.VIDEO_AGENT_V3_PROVIDER_FALLBACK,
      true
    ),
    v3TimeoutMs: Math.max(
      1_000,
      Number(process.env.VIDEO_AGENT_V3_TIMEOUT_MS ?? 60_000) || 60_000
    ),
    v3TracingEnabled: videoBuilderV3ProviderConfig.provider === "openai"
      && envBoolean(process.env.VIDEO_AGENT_V3_TRACING_ENABLED)
  },
  toapisResponses: {
    // These defaults are consumed only by SOCIALMEDIA_INPUT_MODE=agent. The
    // pipeline route never invokes the Responses Agent.
    enabled: (process.env.TOAPIS_RESPONSES_AGENT_ENABLED ?? "true").trim().toLowerCase() === "true",
    apiUrl: envOrDefault(process.env.TOAPIS_RESPONSES_API_URL, "https://toapis.com/v1/responses").replace(/\/+$/, ""),
    apiKey: firstEnvValue(process.env.TOAPIS_RESPONSES_API_KEY, process.env.TOAPIS_API_KEY, process.env.TOAPIS_VIDEO_API_KEY),
    model: envOrDefault(process.env.TOAPIS_RESPONSES_MODEL, "gpt-5.3-codex-official"),
    timeoutMs: Math.max(1_000, Number(process.env.TOAPIS_RESPONSES_TIMEOUT_MS ?? 60_000) || 60_000)
  },
  apimartResponsesFallback: {
    enabled: (process.env.APIMART_RESPONSES_AGENT_FALLBACK_ENABLED ?? "true").trim().toLowerCase() === "true",
    apiUrl: envOrDefault(
      process.env.APIMART_RESPONSES_API_URL,
      `${envOrDefault(process.env.APIMART_API_URL, "https://api.apimart.ai").replace(/\/+$/, "")}/v1/responses`
    ).replace(/\/+$/, ""),
    apiKey: firstEnvValue(process.env.APIMART_RESPONSES_API_KEY, process.env.APIMART_API_KEY),
    model: envOrDefault(process.env.APIMART_RESPONSES_MODEL, "gpt-5.3-codex"),
    timeoutMs: Math.max(1_000, Number(process.env.APIMART_RESPONSES_TIMEOUT_MS ?? 25_000) || 25_000)
  },
  openrouterResponses: {
    enabled: true,
    apiUrl: envOrDefault(
      process.env.OPENROUTER_RESPONSES_API_URL,
      "https://openrouter.ai/api/v1/responses"
    ).replace(/\/+$/, ""),
    apiKey: firstEnvValue(process.env.OPENROUTER_API_KEY),
    timeoutMs: Math.max(1_000, Number(process.env.OPENROUTER_RESPONSES_TIMEOUT_MS ?? 60_000) || 60_000)
  },
  socialmedia: {
    // Pipeline is the current production behaviour: every turn enters the
    // deterministic generation workflow. Agent is an explicit opt-in mode.
    inputMode: parseSocialmediaInputMode(process.env.SOCIALMEDIA_INPUT_MODE),
    agentMockGeneration: (process.env.SOCIALMEDIA_AGENT_MOCK_GENERATION ?? "false").trim().toLowerCase() === "true"
  },
  image: {
    gptImage25: {
      primaryProvider: parseImage25PrimaryProvider(process.env.IMAGE_PRIMARY_PROVIDER_2_5),
      fallbackProvider: parseImage25FallbackProvider(process.env.IMAGE_FALLBACK_PROVIDER_2_5)
    },
    pollTimeoutMs: parseImagePollTimeoutMs(),
    primaryProvider: parseImagePrimaryProvider(
      process.env.IMAGE_GENERATION_PRIMARY_PROVIDER
      ?? process.env.IMAGE_PRIMARY_PROVIDER
    ),
    fallbackProvider: parseImageFallbackProvider(
      process.env.IMAGE_GENERATION_FALLBACK_PROVIDER
      ?? process.env.IMAGE_FALLBACK_PROVIDER
    ),
    fallback24kProvider: parseOptionalImageFallbackProvider(process.env.IMAGE_24K_FALLBACK_PROVIDER),
    providers: parseImageModelProviders(process.env.NANO_BANANA_MODEL_PROVIDERS),
    responseFormat: process.env.NANO_BANANA_RESPONSE_FORMAT ?? "",
    timeoutMs: Number(process.env.NANO_BANANA_TIMEOUT_MS ?? 60000),
    transientRetryMax: Number(process.env.NANO_BANANA_TRANSIENT_RETRY_MAX ?? 2),
    transientRetryBaseDelayMs: Number(process.env.NANO_BANANA_RETRY_BASE_DELAY_MS ?? 450),
    apimart: {
      apiUrl: envOrDefault(process.env.APIMART_API_URL, "https://api.apimart.ai").replace(/\/+$/, ""),
      apiKey: firstEnvValue(process.env.APIMART_API_KEY),
      model: "gpt-image-2",
      forceOfficial: (process.env.APIMART_IMAGE_FORCE_OFFICIAL ?? "false").trim().toLowerCase() === "true",
      directCarousel: (process.env.APIMART_DIRECT_CAROUSEL ?? "true").trim().toLowerCase() === "true",
      resolution: (process.env.APIMART_IMAGE_RESOLUTION ?? "1k").trim().toLowerCase(),
      quality: (process.env.GPT_IMAGE_2_OFFICIAL_QUALITY ?? "low").trim().toLowerCase(),
      background: (process.env.APIMART_IMAGE_BACKGROUND ?? "auto").trim().toLowerCase(),
      moderation: (process.env.APIMART_IMAGE_MODERATION ?? "auto").trim().toLowerCase(),
      outputFormat: (process.env.APIMART_IMAGE_OUTPUT_FORMAT ?? "png").trim().toLowerCase(),
      outputCompression: Number(process.env.APIMART_IMAGE_OUTPUT_COMPRESSION ?? 0),
      submitTimeoutMs: Number(process.env.APIMART_IMAGE_SUBMIT_TIMEOUT_MS ?? 60000),
      initialPollDelayMs: resolveApimartImageFirstPollDelayMs(
        process.env.APIMART_IMAGE_INITIAL_POLL_DELAY_MS
      ),
      pollIntervalMs: resolveApimartImagePollIntervalMs(
        process.env.APIMART_IMAGE_POLL_INTERVAL_MS
      ),
      pollTransientErrorMaxAttempts: Number(process.env.APIMART_IMAGE_POLL_TRANSIENT_ERROR_MAX_ATTEMPTS ?? 8),
      timeoutMs: parseImagePollTimeoutMs()
    },
    vectorengine: {
      apiUrl: envOrDefault(process.env.VECTORENGINE_IMAGE_API_URL, "https://api.vectorengine.cn").replace(/\/+$/, ""),
      apiKey: firstEnvValue(process.env.VECTORENGINE_IMAGE_API_KEY, process.env.VECTORENGINE_API_KEY),
      model: "gpt-image-2",
      fallbackEnabled: (process.env.VECTORENGINE_IMAGE_FALLBACK_ENABLED ?? "true").trim().toLowerCase() !== "false",
      timeoutMs: Number(process.env.VECTORENGINE_IMAGE_TIMEOUT_MS ?? 240000)
    },
    hfsyapi: {
      apiUrl: envOrDefault(process.env.HFSYAPI_IMAGE_API_URL, "https://www.hfsyapi.cn").replace(/\/+$/, ""),
      apiKey: firstEnvValue(process.env.HFSYAPI_IMAGE_API_KEY, process.env.HFSYAPI_API_KEY),
      model: envOrDefault(process.env.HFSYAPI_IMAGE_MODEL, "gpt-image-2"),
      responseFormat: envOrDefault(process.env.HFSYAPI_IMAGE_RESPONSE_FORMAT, "b64_json"),
      timeoutMs: Number(process.env.HFSYAPI_IMAGE_TIMEOUT_MS ?? 240000)
    },
    toapis: {
      apiUrl: envOrDefault(process.env.TOAPIS_IMAGE_API_URL, "https://toapis.com").replace(/\/+$/, ""),
      apiKey: firstEnvValue(process.env.TOAPIS_API_KEY),
      model: envOrDefault(process.env.TOAPIS_IMAGE_MODEL, "gpt-image-2-official"),
      resolution: (process.env.TOAPIS_IMAGE_RESOLUTION ?? "1k").trim().toLowerCase(),
      quality: (process.env.GPT_IMAGE_2_OFFICIAL_QUALITY ?? "low").trim().toLowerCase(),
      outputFormat: (process.env.TOAPIS_IMAGE_OUTPUT_FORMAT ?? "png").trim().toLowerCase(),
      submitTimeoutMs: Number(process.env.TOAPIS_IMAGE_SUBMIT_TIMEOUT_MS ?? 20000),
      initialPollDelayMs: Number(process.env.TOAPIS_IMAGE_INITIAL_POLL_DELAY_MS ?? 2000),
      pollIntervalMs: Number(process.env.TOAPIS_IMAGE_POLL_INTERVAL_MS ?? 3000),
      pollRequestTimeoutMs: Number(process.env.TOAPIS_IMAGE_POLL_REQUEST_TIMEOUT_MS ?? 20000),
      pollTransientErrorMaxAttempts: Number(process.env.TOAPIS_IMAGE_POLL_TRANSIENT_ERROR_MAX_ATTEMPTS ?? 8),
      timeoutMs: parseImagePollTimeoutMs()
    },
    openrouter: {
      apiUrl: envOrDefault(process.env.OPENROUTER_IMAGE_API_URL, "https://openrouter.ai/api/v1").replace(/\/+$/, ""),
      apiKey: firstEnvValue(process.env.OPENROUTER_API_KEY),
      model: envOrDefault(process.env.OPENROUTER_IMAGE_MODEL, "openai/gpt-image-2"),
      model25: envOrDefault(process.env.OPENROUTER_IMAGE_MODEL_2_5, "openai/gpt-image-2.5-flare"),
      quality: (process.env.OPENROUTER_IMAGE_QUALITY ?? "medium").trim().toLowerCase(),
      timeoutMs: Math.max(30_000, Number(process.env.OPENROUTER_IMAGE_TIMEOUT_MS ?? 180_000) || 180_000)
    },
    generatedAssets: {
      uploadRetryMax: Number(process.env.GENERATED_ASSETS_UPLOAD_RETRY_MAX ?? 2),
      uploadRetryBaseDelayMs: Number(process.env.GENERATED_ASSETS_UPLOAD_RETRY_BASE_DELAY_MS ?? 750),
      allowDataUrlFallback:
        (process.env.GENERATED_ASSETS_ALLOW_DATA_URL_FALLBACK ?? "false").trim().toLowerCase() === "true"
    }
  },
  video: {
    provider: parseVideoProvider(
      process.env.SOCIALMEDIA_VIDEO_PROVIDER
      ?? process.env.VIDEO_GENERATION_PROVIDER
      ?? process.env.VIDEO_PROVIDER
    ),
    minimaxH3Provider: parseMiniMaxH3Provider(process.env.MINIMAX_H3_PROVIDER),
    minimaxH3FallbackProvider: parseMiniMaxH3FallbackProvider(process.env.MINIMAX_H3_FALLBACK_PROVIDER),
    volcengineSeedance: {
      model: envOrDefault(process.env.VOLCENGINE_SEEDANCE_VIDEO_MODEL, "doubao-seedance-2-0-fast-260128")
    },
    xinhankr: {
      apiUrl: envOrDefault(process.env.XINHANKR_BASE_URL ?? process.env.XINHANKR_API_URL, "https://token.xinhankr.com").replace(/\/+$/, ""),
      apiKey: firstEnvValue(process.env.XINHANKR_API_KEY),
      model: envOrDefault(process.env.XINHANKR_VIDEO_MODEL, "doubao-seedance-2-0-fast-260128"),
      model1080: envOrDefault(process.env.XINHANKR_VIDEO_MODEL_1080, "doubao-seedance-2-0-260128"),
      duration: Math.max(1, Math.round(Number(process.env.XINHANKR_VIDEO_DURATION ?? 5) || 5)),
      resolution: (process.env.XINHANKR_VIDEO_RESOLUTION ?? "480p").trim().toLowerCase(),
      submitTimeoutMs: Number(process.env.XINHANKR_VIDEO_SUBMIT_TIMEOUT_MS ?? 20000)
    },
    hfsyapi: {
      apiUrl: envOrDefault(process.env.HFSYAPI_VIDEO_API_URL ?? process.env.HFSYAPI_IMAGE_API_URL, "https://www.hfsyapi.cn").replace(/\/+$/, ""),
      apiKey: firstEnvValue(process.env.HFSYAPI_LLM_API_KEY, process.env.HFSYAPI_API_KEY, process.env.HFSYAPI_IMAGE_API_KEY),
      model: envOrDefault(process.env.HFSYAPI_VIDEO_MODEL, "sd-2-fast"),
      orientation: (process.env.HFSYAPI_VIDEO_ORIENTATION ?? "portrait").trim().toLowerCase(),
      ratio: (process.env.HFSYAPI_VIDEO_RATIO ?? "auto").trim(),
      duration: Math.max(5, Math.min(15, Math.round(Number(process.env.HFSYAPI_VIDEO_DURATION ?? 10) || 10))),
      size: (process.env.HFSYAPI_VIDEO_SIZE ?? "adaptive").trim().toLowerCase(),
      watermark: (process.env.HFSYAPI_VIDEO_WATERMARK ?? "false").trim().toLowerCase() === "true",
      submitTimeoutMs: Number(process.env.HFSYAPI_VIDEO_SUBMIT_TIMEOUT_MS ?? 20000),
      queryPath: process.env.HFSYAPI_VIDEO_QUERY_PATH ?? "",
      mockEnabled: ["1", "true", "yes", "on"].includes((process.env.HFSYAPI_VIDEO_MOCK_ENABLED ?? "").trim().toLowerCase()),
      mockDelayMs: Math.max(0, Math.round(Number(process.env.HFSYAPI_VIDEO_MOCK_DELAY_MS ?? 100000) || 100000)),
      mockResultUrl: envOrDefault(
        process.env.HFSYAPI_VIDEO_MOCK_RESULT_URL,
        "http://img688.com/file/1782012893036_1f16d21b-b8aa-6510-b030-27dd4a49fc19.mp4"
      )
    },
    minimax: {
      apiUrl: envOrDefault(process.env.MINIMAX_API_URL, "https://api.minimax.io").replace(/\/+$/, ""),
      apiKey: firstEnvValue(process.env.MINIMAX_KEY, process.env.MINMAX_KEY, process.env.MINIMAX_API_KEY),
      model: envOrDefault(process.env.MINIMAX_VIDEO_MODEL, "MiniMax-H3"),
      duration: Math.max(4, Math.min(15, Math.round(Number(process.env.MINIMAX_VIDEO_DURATION ?? 5) || 5))),
      resolution: envOrDefault(process.env.MINIMAX_VIDEO_RESOLUTION, "768P").toUpperCase(),
      ratio: envOrDefault(process.env.MINIMAX_VIDEO_RATIO, "16:9"),
      submitTimeoutMs: Math.max(1000, Number(process.env.MINIMAX_VIDEO_SUBMIT_TIMEOUT_MS ?? 20000) || 20000),
      pollRequestTimeoutMs: Math.max(1000, Number(process.env.MINIMAX_VIDEO_POLL_REQUEST_TIMEOUT_MS ?? 20000) || 20000),
      initialPollDelayMs: Math.max(1000, Number(process.env.MINIMAX_VIDEO_INITIAL_POLL_DELAY_MS ?? 5000) || 5000),
      pollIntervalMs: Math.max(1000, Number(process.env.MINIMAX_VIDEO_POLL_INTERVAL_MS ?? 10000) || 10000),
      timeoutMs: Math.max(30000, Number(process.env.MINIMAX_VIDEO_TIMEOUT_MS ?? 900000) || 900000)
    },
    apimart: {
      apiUrl: envOrDefault(process.env.APIMART_API_URL, "https://api.apimart.ai").replace(/\/+$/, ""),
      apiKey: firstEnvValue(process.env.APIMART_API_KEY),
      model: envOrDefault(process.env.APIMART_VIDEO_MODEL, "doubao-seedance-2-0-fast"),
      size: (process.env.APIMART_VIDEO_SIZE ?? "auto").trim(),
      duration: Math.max(1, Math.round(Number(process.env.APIMART_VIDEO_DURATION ?? 5) || 5)),
      resolution: (process.env.APIMART_VIDEO_RESOLUTION ?? "480p").trim().toLowerCase(),
      quality: (process.env.APIMART_VIDEO_QUALITY ?? "auto").trim().toLowerCase(),
      audio: (process.env.APIMART_VIDEO_AUDIO ?? "false").trim().toLowerCase() === "true",
      cameraFixed: (process.env.APIMART_VIDEO_CAMERA_FIXED ?? "false").trim().toLowerCase() === "true",
      submitTimeoutMs: Number(process.env.APIMART_VIDEO_SUBMIT_TIMEOUT_MS ?? 20000),
      pollRequestTimeoutMs: Math.max(1000, Number(process.env.APIMART_VIDEO_POLL_REQUEST_TIMEOUT_MS ?? 20000) || 20000),
      initialPollDelayMs: Number(process.env.APIMART_VIDEO_INITIAL_POLL_DELAY_MS ?? 15000),
      pollIntervalMs: Number(process.env.APIMART_VIDEO_POLL_INTERVAL_MS ?? 5000),
      timeoutMs: Number(process.env.APIMART_VIDEO_TIMEOUT_MS ?? 900000)
    },
    toapis: {
      apiUrl: "https://toapis.com",
      apiKey: firstEnvValue(process.env.TOAPIS_VIDEO_API_KEY, process.env.TOAPIS_API_KEY, process.env.APIMART_API_KEY),
      model: envOrDefault(process.env.TOAPIS_VIDEO_MODEL, "seedance-2-mini"),
      size: (process.env.TOAPIS_VIDEO_SIZE ?? "auto").trim(),
      duration: Math.max(-1, Math.min(15, Math.round(Number(process.env.TOAPIS_VIDEO_DURATION ?? 5) || 5))),
      resolution: (process.env.TOAPIS_VIDEO_RESOLUTION ?? "480p").trim().toLowerCase(),
      audio: (process.env.TOAPIS_VIDEO_AUDIO ?? "true").trim().toLowerCase() !== "false",
      submitTimeoutMs: Number(process.env.TOAPIS_VIDEO_SUBMIT_TIMEOUT_MS ?? 60000),
      initialPollDelayMs: Number(process.env.TOAPIS_VIDEO_INITIAL_POLL_DELAY_MS ?? 5000),
      pollIntervalMs: Number(process.env.TOAPIS_VIDEO_POLL_INTERVAL_MS ?? 10000),
      timeoutMs: Number(process.env.TOAPIS_VIDEO_TIMEOUT_MS ?? 600000),
      apimartFallbackEnabled: (process.env.TOAPIS_VIDEO_APIMART_FALLBACK_ENABLED ?? "true").trim().toLowerCase() !== "false",
      apimartFallbackModels: {
        lite: envOrDefault(process.env.TOAPIS_VIDEO_APIMART_FALLBACK_MODEL_LITE, "doubao-seedance-2.0-mini"),
        pro: envOrDefault(process.env.TOAPIS_VIDEO_APIMART_FALLBACK_MODEL_PRO, "doubao-seedance-2.0-fast"),
        max: envOrDefault(process.env.TOAPIS_VIDEO_APIMART_FALLBACK_MODEL_MAX, "doubao-seedance-2.0")
      }
    }
  },
  productAd: {
    directMultiturn: (
      process.env.AI_PRODUCT_AD_DIRECT_MULTITURN
      ?? process.env.PRODUCT_AD_DIRECT_MULTITURN
      ?? "true"
    ).trim().toLowerCase() === "true"
  },
  quality: {
    enabled: (process.env.QUALITY_LOOP_ENABLED ?? "true") === "true",
    threshold: Number(process.env.QUALITY_AUDIT_THRESHOLD ?? 78),
    imageCoverThreshold: Number(process.env.QUALITY_IMAGE_COVER_THRESHOLD ?? 85),
    imageInnerThreshold: Number(process.env.QUALITY_IMAGE_INNER_THRESHOLD ?? 78),
    copyRounds: Number(process.env.QUALITY_MAX_COPY_ROUNDS ?? 1),
    imageRounds: Number(process.env.QUALITY_MAX_IMAGE_ROUNDS ?? 0),
    maxExtraImages: Number(process.env.QUALITY_MAX_EXTRA_IMAGES ?? 1),
    imageLoopMaxMs: Number(process.env.QUALITY_IMAGE_LOOP_MAX_MS ?? 120000),
    imageAuditScope: (process.env.QUALITY_IMAGE_AUDIT_SCOPE ?? "cover").trim().toLowerCase() === "all" ? "all" : "cover"
  },
  pipeline: {
    mode: (process.env.PIPELINE_MODE ?? "fast").trim().toLowerCase() === "full" ? "full" : "fast",
    maxDurationMs: Number(process.env.PIPELINE_MAX_DURATION_MS ?? 300000),
    allowShortTextSource: (process.env.SOURCE_ADEQUACY_ALLOW_SHORT_TEXT ?? "false").trim().toLowerCase() === "true",
    enableSourceIntel: (process.env.PIPELINE_ENABLE_SOURCE_INTEL ?? "false").trim().toLowerCase() === "true",
    enableStoryboardQuality: (process.env.PIPELINE_ENABLE_STORYBOARD_QUALITY ?? "false").trim().toLowerCase() === "true",
    enableStyleRecommender: (process.env.PIPELINE_ENABLE_STYLE_RECOMMENDER ?? "false").trim().toLowerCase() === "true",
    enableAttentionAuditor: (process.env.PIPELINE_ENABLE_ATTENTION_AUDITOR ?? "false").trim().toLowerCase() === "true",
    enableAttentionFixer: (process.env.PIPELINE_ENABLE_ATTENTION_FIXER ?? "false").trim().toLowerCase() === "true",
    enablePostCopyQuality: (process.env.PIPELINE_ENABLE_POST_COPY_QUALITY ?? "false").trim().toLowerCase() === "true",
    enableFinalAudit: (process.env.PIPELINE_ENABLE_FINAL_AUDIT ?? "false").trim().toLowerCase() === "true"
  },
  billing: {
    convertCostCredits: Math.max(1, Number(process.env.BILLING_CONVERT_COST_CREDITS ?? 120)),
    imageCostCredits: Math.max(0, Number(process.env.BILLING_IMAGE_COST_CREDITS ?? 25)),
    imageCreditCosts: parseImageCreditCosts(process.env.BILLING_IMAGE_CREDIT_COSTS),
    tokenCreditRates: parseTokenCreditRates(process.env.BILLING_TOKEN_CREDIT_RATES),
    signupCreditValidityDays: Math.max(1, Number(process.env.BILLING_SIGNUP_CREDIT_VALIDITY_DAYS ?? 30)),
    rechargeCreditValidityDays: Math.max(1, Number(process.env.BILLING_RECHARGE_CREDIT_VALIDITY_DAYS ?? 30)),
    devSimulateWebhook: (process.env.BILLING_DEV_SIMULATE_WEBHOOK ?? "true").trim().toLowerCase() === "true",
    creem: {
      testMode: (process.env.CREEM_TEST_MODE ?? "true").trim().toLowerCase() === "true",
      apiKey: (process.env.CREEM_API_KEY ?? "").trim(),
      webhookSecret: (process.env.CREEM_WEBHOOK_SECRET ?? "").trim(),
      moderationApiKey: (process.env.CREEM_MODERATION_API_KEY ?? "").trim(),
      moderationEnabled: (process.env.CREEM_MODERATION_ENABLED?.trim() || (process.env.CREEM_MODERATION_API_KEY?.trim() || process.env.CREEM_API_KEY?.trim() ? "true" : "false")).toLowerCase() === "true",
      moderationFailOpen: (process.env.CREEM_MODERATION_FAIL_OPEN ?? "false").trim().toLowerCase() === "true",
      moderationTimeoutMs: Math.max(1000, Number(process.env.CREEM_MODERATION_TIMEOUT_MS ?? 5000)),
      productIdPro: (process.env.CREEM_PRODUCT_ID_PRO ?? "").trim(),
      productIdMax: (process.env.CREEM_PRODUCT_ID_MAX ?? "").trim(),
      productIdImageUnlock: (process.env.CREEM_PRODUCT_ID_IMAGE_UNLOCK ?? "").trim(),
      productIdImageUnlockV14: (process.env.CREEM_PRODUCT_ID_IMAGE_UNLOCK_V14 ?? "").trim(),
      productIdImageUnlockV19: (process.env.CREEM_PRODUCT_ID_IMAGE_UNLOCK_V19 ?? "").trim(),
      appUrl: (process.env.NEXT_PUBLIC_APP_URL ?? "").trim()
    },
    stripe: {
      testMode: (process.env.STRIPE_TEST_MODE ?? "true").trim().toLowerCase() === "true",
      secretKey: (process.env.STRIPE_SECRET_KEY ?? "").trim(),
      webhookSecret: (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim(),
      apiVersion: (process.env.STRIPE_API_VERSION ?? "").trim(),
      promotionCodesEnabled: (process.env.STRIPE_PROMOTION_CODES_ENABLED ?? "false").trim().toLowerCase() === "true"
    },
    waffo: {
      testMode: isWaffoTestMode(),
      merchantId: (process.env.WAFFO_MERCHANT_ID ?? "").trim(),
      storeId: (process.env.WAFFO_STORE_ID ?? "").trim(),
      privateKey: waffoPrivateKey(),
      onetimeProductId: (process.env.WAFFO_ONETIME_PRODUCT_ID ?? "").trim(),
      monthlySubscriptionProductId: (process.env.WAFFO_MONTHLY_SUBSCRIPTION_PRODUCT_ID ?? "").trim(),
      yearlySubscriptionProductId: (process.env.WAFFO_YEARLY_SUBSCRIPTION_PRODUCT_ID ?? "").trim(),
      productIdProMonthlyV19: (process.env.WAFFO_PRODUCT_ID_PRO_MONTHLY_V19 ?? "").trim(),
      productIdProAnnualV19: (process.env.WAFFO_PRODUCT_ID_PRO_ANNUAL_V19 ?? "").trim(),
      productIdMaxMonthlyV19: (process.env.WAFFO_PRODUCT_ID_MAX_MONTHLY_V19 ?? "").trim(),
      productIdMaxAnnualV19: (process.env.WAFFO_PRODUCT_ID_MAX_ANNUAL_V19 ?? "").trim(),
      productIdBasicMonthlyV24: (process.env.WAFFO_PRODUCT_ID_BASIC_MONTHLY_V24 ?? "").trim(),
      productIdBasicAnnualV24: (process.env.WAFFO_PRODUCT_ID_BASIC_ANNUAL_V24 ?? "").trim(),
      productIdProMonthlyV24: (process.env.WAFFO_PRODUCT_ID_PRO_MONTHLY_V24 ?? "").trim(),
      productIdProAnnualV24: (process.env.WAFFO_PRODUCT_ID_PRO_ANNUAL_V24 ?? "").trim(),
      productIdMaxMonthlyV24: (process.env.WAFFO_PRODUCT_ID_MAX_MONTHLY_V24 ?? "").trim(),
      productIdMaxAnnualV24: (process.env.WAFFO_PRODUCT_ID_MAX_ANNUAL_V24 ?? "").trim(),
      productIdImageUnlock: (process.env.WAFFO_PRODUCT_ID_IMAGE_UNLOCK ?? "").trim(),
      productIdVideoUnlock: (process.env.WAFFO_PRODUCT_ID_VIDEO_UNLOCK ?? "").trim()
    }
  },
  externalKeys: {
    openrouter: process.env.OPENROUTER_API_KEY ?? "",
    tavily: process.env.TAVILY_API_KEY ?? "",
    serper: process.env.SERPER_API_KEY ?? "",
    jina: process.env.JINA_API_KEY ?? "",
    gemini: process.env.GEMINI_API_KEY ?? ""
  },
  security: {
    acceptedApiKeys: (process.env.CLAWVISUAL_API_KEYS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    allowWithoutKey: (process.env.CLAWVISUAL_ALLOW_NO_KEY ?? "true") === "true"
  }
};

export function resolveImageFallbackProvider(resolution?: string | null): ImageFallbackProvider {
  const normalized = String(resolution ?? "").trim().toLowerCase();
  return normalized === "2k" || normalized === "4k"
    ? appConfig.image.fallback24kProvider ?? appConfig.image.fallbackProvider
    : appConfig.image.fallbackProvider;
}
