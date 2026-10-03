import { randomUUID } from "node:crypto";
import { appConfig } from "@/lib/config";
import { PROMPTS, buildPromptHeader } from "@/lib/prompts/index";
import { inspectUsageFromPayload, recordLlmCallTrace, recordUsageFromPayload } from "@/lib/llm/usage-tracker";

const LLM_DEBUG_TIMINGS_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.LLM_DEBUG_TIMINGS === "1" || process.env.SOCIALMEDIA_DEBUG_TIMINGS === "1";

type SkillPromptName = keyof typeof PROMPTS;

type ChatResponse = {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
  usage?: unknown;
  model?: string;
};

type ApimartChatEnvelope = {
  code?: number;
  message?: string;
  data?: ChatResponse;
};

type ChatStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
  usage?: unknown;
  model?: string;
};

type LlmCallParams = {
  systemPrompt: string;
  input: unknown;
  temperature?: number;
  model?: string;
  fallbackModels?: string[];
  debugLabel?: string;
  retrySameModelOnce?: boolean;
  includeRescueModel?: boolean;
};

type LlmProvider = "openrouter" | "apimart" | "vectorengine" | "hfsyapi" | "toapis";

type LlmProviderConfig = {
  provider: LlmProvider;
  apiUrl: string;
  apiKey: string;
  model: string;
};

type LlmProviderCallParams = {
  systemPrompt: string;
  input: unknown;
  temperature?: number;
  model?: string;
  stream?: boolean;
  signal?: AbortSignal;
  debugLabel?: string;
};

type LlmProviderCallResult = {
  provider: LlmProvider;
  model: string;
  payload: ChatResponse;
};

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function safeParse<T>(raw: string): T | null {
  try {
    return JSON.parse(extractJson(raw)) as T;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function unwrapChatResponse(raw: unknown): ChatResponse {
  if (isRecord(raw) && isRecord(raw.data)) {
    return raw.data as ChatResponse;
  }
  return (raw ?? {}) as ChatResponse;
}

function assertApimartEnvelope(raw: unknown): void {
  if (!isRecord(raw) || !("code" in raw)) return;
  const envelope = raw as ApimartChatEnvelope;
  if (envelope.code === undefined || envelope.code === 200) return;
  throw new Error(`APIMart LLM returned code ${envelope.code}: ${envelope.message ?? "unknown error"}`);
}

function getHostname(value: string): string | undefined {
  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
}

function logLlmProviderTiming(
  event: "started" | "completed" | "failed" | "fallback_provider",
  payload: Record<string, unknown>
): void {
  if (!LLM_DEBUG_TIMINGS_ENABLED) return;
  const method = event === "failed" || event === "fallback_provider" ? console.warn : console.info;
  method("[llm-provider] " + event, payload);
}

function extractText(payload: ChatResponse): string {
  const choiceContent = payload.choices?.[0]?.message?.content;
  return (
    (typeof choiceContent === "string"
      ? choiceContent
      : choiceContent?.map((part) => part.text ?? "").join("")) ||
    payload.output_text ||
    payload.output?.[0]?.content?.map((part) => part.text ?? "").join("") ||
    ""
  );
}

function extractDeltaText(payload: ChatStreamChunk): string {
  const deltaContent = payload.choices?.[0]?.delta?.content;
  return typeof deltaContent === "string"
    ? deltaContent
    : deltaContent?.map((part) => part.text ?? "").join("") || "";
}

function normalizeModels(primary?: string, fallbacks?: string[]): Array<string | undefined> {
  const primaryModel = String(primary ?? "").trim();
  const merged: Array<string | undefined> = [
    primaryModel || undefined,
    ...(fallbacks ?? [])
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
  ];
  const seen = new Set<string>();
  return merged.filter((item) => {
    const key = item ?? "__provider_default__";
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveLlmProviderConfig(provider: LlmProvider, model?: string): LlmProviderConfig {
  if (provider === "openrouter") {
    return {
      provider,
      apiUrl: appConfig.llm.openrouterApiUrl,
      apiKey: appConfig.llm.openrouterApiKey,
      model: model?.trim() || appConfig.llm.openrouterModel || appConfig.llm.model
    };
  }

  if (provider === "apimart") {
    return {
      provider,
      apiUrl: appConfig.llm.apimartApiUrl,
      apiKey: appConfig.llm.apimartApiKey,
      model: model?.trim() || appConfig.llm.apimartModel || appConfig.llm.model
    };
  }

  if (provider === "hfsyapi") {
    return {
      provider,
      apiUrl: appConfig.llm.hfsyapiApiUrl,
      apiKey: appConfig.llm.hfsyapiApiKey,
      model: model?.trim() || appConfig.llm.hfsyapiModel || appConfig.llm.model
    };
  }

  if (provider === "toapis") {
    return {
      provider,
      apiUrl: appConfig.llm.toapisApiUrl,
      apiKey: appConfig.llm.toapisApiKey,
      model: model?.trim() || appConfig.llm.toapisModel || appConfig.llm.model
    };
  }

  return {
    provider,
    apiUrl: appConfig.llm.vectorengineApiUrl || appConfig.llm.apiUrl,
    apiKey: appConfig.llm.vectorengineApiKey || appConfig.llm.apiKey,
    model: model?.trim() || appConfig.llm.vectorengineModel || appConfig.llm.model
  };
}

function buildLlmHeaders(config: LlmProviderConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }
  if (appConfig.llm.httpReferer) {
    headers["HTTP-Referer"] = appConfig.llm.httpReferer;
  }
  if (appConfig.llm.xTitle) {
    headers["X-Title"] = appConfig.llm.xTitle;
  }

  return headers;
}

async function callLLMProvider(params: LlmProviderCallParams & { provider: LlmProvider }): Promise<LlmProviderCallResult> {
  const config = resolveLlmProviderConfig(params.provider, params.model);
  if (!config.apiUrl) {
    throw new Error(`${config.provider} LLM API URL is missing`);
  }

  const startedAt = Date.now();
  const baseLogPayload = {
    provider: config.provider,
    model: config.model,
    debugLabel: params.debugLabel,
    apiHost: getHostname(config.apiUrl),
    stream: params.stream ?? false
  };
  logLlmProviderTiming("started", {
    ...baseLogPayload,
    temperature: params.temperature ?? 0.2
  });

  try {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: buildLlmHeaders(config),
      body: JSON.stringify({
        model: config.model,
        temperature: params.temperature ?? 0.2,
        stream: params.stream ?? false,
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: JSON.stringify(params.input) }
        ]
      }),
      cache: "no-store",
      signal: params.signal
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      const error = new Error(
        `${config.provider} LLM request failed: ${response.status} ${response.statusText}${responseText ? ` ${responseText}` : ""}`
      );
      (error as Error & { status?: number }).status = response.status;
      throw error;
    }

    const raw = await response.json() as unknown;
    if (config.provider === "apimart") {
      assertApimartEnvelope(raw);
    }

    const payload = unwrapChatResponse(raw);
    logLlmProviderTiming("completed", {
      ...baseLogPayload,
      durationMs: Date.now() - startedAt,
      responseModel: payload.model,
      enveloped: isRecord(raw) && isRecord(raw.data),
      hasChoices: Boolean(payload.choices?.length),
      hasUsage: Boolean(payload.usage)
    });

    return {
      provider: config.provider,
      model: config.model,
      payload
    };
  } catch (error) {
    logLlmProviderTiming("failed", {
      ...baseLogPayload,
      durationMs: Date.now() - startedAt,
      timeout: isTimeoutError(error),
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

export function callLLMByApimart(params: LlmProviderCallParams): Promise<LlmProviderCallResult> {
  return callLLMProvider({ ...params, provider: "apimart", stream: params.stream ?? false });
}

export function callLLMByVectorengine(params: LlmProviderCallParams): Promise<LlmProviderCallResult> {
  return callLLMProvider({ ...params, provider: "vectorengine", stream: params.stream ?? false });
}

export function callLLMByHfsyapi(params: LlmProviderCallParams): Promise<LlmProviderCallResult> {
  return callLLMProvider({ ...params, provider: "hfsyapi", stream: params.stream ?? false });
}

export function callLLMByToapis(params: LlmProviderCallParams): Promise<LlmProviderCallResult> {
  return callLLMProvider({ ...params, provider: "toapis", stream: params.stream ?? false });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildModelExecutionPlan(params: {
  primary?: string;
  fallbackModels?: string[];
  retrySameModelOnce?: boolean;
  includeRescueModel?: boolean;
}): Array<{ model?: string; attempt: number; totalAttemptsForModel: number }> {
  const mergedFallbacks = [...(params.fallbackModels ?? [])];
  const rescueModel = String(appConfig.llm.rescueModel ?? "").trim();
  if (params.includeRescueModel !== false && rescueModel) {
    mergedFallbacks.push(rescueModel);
  }

  const models = normalizeModels(params.primary, mergedFallbacks);
  const retryPrimary = params.retrySameModelOnce !== false;

  return models.flatMap((model, index) => {
    const totalAttemptsForModel = index === 0 && retryPrimary ? 2 : 1;
    return Array.from({ length: totalAttemptsForModel }, (_, attemptIndex) => ({
      model,
      attempt: attemptIndex + 1,
      totalAttemptsForModel
    }));
  });
}

function createAbortTimeout(timeoutMs: number): { controller: AbortController; cleanup: () => void } | null {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    controller,
    cleanup: () => clearTimeout(timer)
  };
}

function estimateInputChars(params: { systemPrompt: string; input: unknown }): number {
  const serializedInput = JSON.stringify(params.input);
  return params.systemPrompt.length + serializedInput.length;
}

function isTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("abort") || message.toLowerCase().includes("timeout");
}

function isBillingLimitProviderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  return (
    normalized.includes("billing_hard_limit_reached")
    || normalized.includes("billing_limit_user_error")
    || normalized.includes("billing hard limit has been reached")
  );
}

function isTransientLlmProviderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  const status = Number((error as { status?: unknown } | null)?.status);
  if (isBillingLimitProviderError(error)) {
    return true;
  }
  if (Number.isFinite(status) && (status === 408 || status === 409 || status === 425 || status === 429 || status >= 500)) {
    return true;
  }
  return (
    isTimeoutError(error)
    || normalized.includes("fetch failed")
    || normalized.includes("network")
    || normalized.includes("socket hang up")
    || normalized.includes("econnreset")
    || normalized.includes("etimedout")
    || normalized.includes("eai_again")
    || normalized.includes("enotfound")
    || normalized.includes("upstream provider unavailable")
    || normalized.includes("all channels failed")
    || normalized.includes("temporarily unavailable")
    || /\b50[0-9]\b/.test(normalized)
  );
}

function resolvePrimaryLlmProvider(): LlmProvider {
  if (appConfig.llm.primaryProvider === "openrouter") return "openrouter";
  if (appConfig.llm.primaryProvider === "hfsyapi") return "hfsyapi";
  if (appConfig.llm.primaryProvider === "toapis") return "toapis";
  return appConfig.llm.primaryProvider === "vectorengine" ? "vectorengine" : "apimart";
}

function resolveFallbackLlmProvider(primary: LlmProvider): LlmProvider | null {
  const fallback = appConfig.llm.fallbackProvider;
  if (fallback === "none" || fallback === primary) return null;
  return fallback;
}

/** One request, with the caller's abort signal and no retry/fallback or billing usage scope. */
export function callLLMByProvider(provider: LlmProvider, params: LlmProviderCallParams): Promise<LlmProviderCallResult> {
  if (provider === "openrouter") return callLLMProvider({ ...params, provider: "openrouter" });
  if (provider === "hfsyapi") return callLLMByHfsyapi(params);
  if (provider === "toapis") return callLLMByToapis(params);
  return provider === "vectorengine" ? callLLMByVectorengine(params) : callLLMByApimart(params);
}

async function callLlmJson<T>(params: LlmCallParams): Promise<T | null> {
  if (!appConfig.llm.openrouterApiUrl && !appConfig.llm.apimartApiUrl && !appConfig.llm.vectorengineApiUrl && !appConfig.llm.hfsyapiApiUrl && !appConfig.llm.toapisApiUrl && !appConfig.llm.apiUrl) {
    return null;
  }

  const executionPlan = buildModelExecutionPlan({
    primary: params.model,
    fallbackModels: params.fallbackModels,
    retrySameModelOnce: params.retrySameModelOnce,
    includeRescueModel: params.includeRescueModel
  });
  const inputChars = estimateInputChars({
    systemPrompt: params.systemPrompt,
    input: params.input
  });
  const callId = randomUUID();

  for (let planIndex = 0; planIndex < executionPlan.length; planIndex += 1) {
    const plan = executionPlan[planIndex];
    const model = plan.model;
    const timeout = createAbortTimeout(appConfig.llm.timeoutMs);
    const attemptStartedAt = Date.now();
    const primaryProvider = resolvePrimaryLlmProvider();
    let provider: LlmProvider = primaryProvider;
    try {
      let result: LlmProviderCallResult;
      try {
        result = await callLLMByProvider(primaryProvider, {
          systemPrompt: params.systemPrompt,
          input: params.input,
          temperature: params.temperature,
          model,
          debugLabel: params.debugLabel,
          signal: timeout?.controller.signal
        });
      } catch (error) {
        const fallbackProvider = resolveFallbackLlmProvider(primaryProvider);
        if (!fallbackProvider || !isTransientLlmProviderError(error)) {
          throw error;
        }
        provider = fallbackProvider;
        if (params.debugLabel && LLM_DEBUG_TIMINGS_ENABLED) {
          console.warn(`[llm:${params.debugLabel}] ${primaryProvider} failed; falling back to ${fallbackProvider}`, {
            model,
            attempt: plan.attempt,
            totalAttemptsForModel: plan.totalAttemptsForModel,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        logLlmProviderTiming("fallback_provider", {
          debugLabel: params.debugLabel,
          model,
          attempt: plan.attempt,
          totalAttemptsForModel: plan.totalAttemptsForModel,
          fromProvider: primaryProvider,
          toProvider: fallbackProvider,
          durationMs: Date.now() - attemptStartedAt,
          error: error instanceof Error ? error.message : String(error)
        });
        timeout?.cleanup();
        const fallbackTimeout = createAbortTimeout(appConfig.llm.timeoutMs);
        try {
          result = await callLLMByProvider(fallbackProvider, {
            systemPrompt: params.systemPrompt,
            input: params.input,
            temperature: params.temperature,
            model,
            debugLabel: params.debugLabel,
            signal: fallbackTimeout?.controller.signal
          });
        } finally {
          fallbackTimeout?.cleanup();
        }
      }

      provider = result.provider;
      const payload = result.payload;
      recordUsageFromPayload({
        model: result.model,
        payload
      });
      const usageSummary = inspectUsageFromPayload(payload);
      const finalizeTrace = (success: boolean) => {
        recordLlmCallTrace({
          callId,
          label: params.debugLabel,
          model: result.model,
          attempt: plan.attempt,
          totalAttemptsForModel: plan.totalAttemptsForModel,
          usedFallbackModel: planIndex > 0 || result.provider !== primaryProvider,
          timeoutHit: result.provider !== primaryProvider,
          inputChars,
          outputTokens: usageSummary.outputTokens,
          totalTokens: usageSummary.totalTokens,
          durationMs: Date.now() - attemptStartedAt,
          success
        });
      };
      const content = extractText(payload);
      if (!content) {
        finalizeTrace(false);
        if (params.debugLabel && LLM_DEBUG_TIMINGS_ENABLED) {
          console.warn(`[llm:${params.debugLabel}] empty content`, {
            provider: result.provider,
            model: result.model,
            attempt: plan.attempt,
            totalAttemptsForModel: plan.totalAttemptsForModel,
            usage: usageSummary,
            payload
          });
        }
      } else {
        const parsed = safeParse<T>(content);
        if (params.debugLabel && LLM_DEBUG_TIMINGS_ENABLED) {
          console.info(`[llm:${params.debugLabel}] response`, {
            provider: result.provider,
            model: result.model,
            attempt: plan.attempt,
            totalAttemptsForModel: plan.totalAttemptsForModel,
            usage: usageSummary,
            raw: content,
            parsed
          });
        }
        if (params.debugLabel && LLM_DEBUG_TIMINGS_ENABLED && !usageSummary.hasUsage) {
          console.warn(`[llm:${params.debugLabel}] usage missing or unrecognized`, {
            provider: result.provider,
            model: result.model,
            attempt: plan.attempt,
            totalAttemptsForModel: plan.totalAttemptsForModel,
            topLevelKeys: payload && typeof payload === "object" ? Object.keys(payload as Record<string, unknown>) : [],
            usageKeys:
              payload?.usage && typeof payload.usage === "object" && payload.usage !== null
                ? Object.keys(payload.usage as Record<string, unknown>)
                : payload && typeof payload === "object" && "usage_metadata" in payload && payload.usage_metadata && typeof payload.usage_metadata === "object"
                  ? Object.keys(payload.usage_metadata as Record<string, unknown>)
                  : []
          });
        }
        if (parsed) {
          finalizeTrace(true);
          return parsed;
        }
        finalizeTrace(false);
        if (params.debugLabel && LLM_DEBUG_TIMINGS_ENABLED) {
          console.warn(`[llm:${params.debugLabel}] JSON parse failed`, {
            provider: result.provider,
            model: result.model,
            attempt: plan.attempt,
            totalAttemptsForModel: plan.totalAttemptsForModel
          });
        }
      }
    } catch (error) {
      recordLlmCallTrace({
        callId,
        label: params.debugLabel,
        model: model ?? "(provider-default)",
        attempt: plan.attempt,
        totalAttemptsForModel: plan.totalAttemptsForModel,
        usedFallbackModel: planIndex > 0,
        timeoutHit: isTimeoutError(error) || provider !== primaryProvider,
        inputChars,
        outputTokens: 0,
        totalTokens: 0,
        durationMs: Date.now() - attemptStartedAt,
        success: false
      });
      if (params.debugLabel && LLM_DEBUG_TIMINGS_ENABLED) {
        console.error(`[llm:${params.debugLabel}] request failed`, {
          provider,
          model,
          attempt: plan.attempt,
          totalAttemptsForModel: plan.totalAttemptsForModel,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } finally {
      timeout?.cleanup();
    }

    if (planIndex < executionPlan.length - 1) {
      await sleep(plan.attempt < plan.totalAttemptsForModel ? 250 : 400);
    }
  }

  return null;
}

async function callLlmTextStream(params: LlmCallParams & {
  onDelta: (delta: string) => Promise<void> | void;
}): Promise<string> {
  const executionPlan = buildModelExecutionPlan({
    primary: params.model,
    fallbackModels: params.fallbackModels,
    retrySameModelOnce: params.retrySameModelOnce,
    includeRescueModel: params.includeRescueModel
  });
  const inputChars = estimateInputChars({
    systemPrompt: params.systemPrompt,
    input: params.input
  });
  const callId = randomUUID();
  const primaryProvider = resolvePrimaryLlmProvider();
  const fallbackProvider = resolveFallbackLlmProvider(primaryProvider);
  const providerPlan = fallbackProvider ? [primaryProvider, fallbackProvider] : [primaryProvider];

  for (let planIndex = 0; planIndex < executionPlan.length; planIndex += 1) {
    const plan = executionPlan[planIndex];
    const model = plan.model;
    for (const provider of providerPlan) {
      const config = resolveLlmProviderConfig(provider, model);
      if (!config.apiUrl) continue;
      const timeout = createAbortTimeout(appConfig.llm.timeoutMs);
      const attemptStartedAt = Date.now();
      try {
        const response = await fetch(config.apiUrl, {
          method: "POST",
          headers: buildLlmHeaders(config),
          body: JSON.stringify({
            model: config.model,
            temperature: params.temperature ?? 0.2,
            stream: true,
            messages: [
              { role: "system", content: params.systemPrompt },
              { role: "user", content: JSON.stringify(params.input) }
            ]
          }),
          cache: "no-store",
          signal: timeout?.controller.signal
        });

        if (!response.ok || !response.body) {
          const responseText = await response.text().catch(() => "");
          const error = new Error(
            `${provider} LLM stream request failed: ${response.status} ${response.statusText}${responseText ? ` ${responseText}` : ""}`
          );
          (error as Error & { status?: number }).status = response.status;
          throw error;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let combined = "";
        let usagePayload: ChatStreamChunk | null = null;

        const consumeEvent = async (block: string) => {
          const trimmed = block.trim();
          if (!trimmed) return;
          const dataLine = trimmed
            .split("\n")
            .map((line) => line.trim())
            .find((line) => line.startsWith("data:"));
          if (!dataLine) return;
          const payload = dataLine.slice(5).trim();
          if (!payload || payload === "[DONE]") return;
          try {
            const parsed = JSON.parse(payload) as ChatStreamChunk;
            const delta = extractDeltaText(parsed);
            if (delta) {
              combined += delta;
              await params.onDelta(delta);
            }
            if (parsed.usage) {
              usagePayload = parsed;
            }
          } catch {
            // Ignore malformed SSE chunks and keep consuming the stream.
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";
          for (const block of blocks) {
            await consumeEvent(block);
          }
        }

        if (buffer.trim()) {
          await consumeEvent(buffer);
        }

        recordUsageFromPayload({
          model: config.model,
          payload: usagePayload ?? { model }
        });
        const usageSummary = inspectUsageFromPayload(usagePayload ?? {});
        recordLlmCallTrace({
          callId,
          label: params.debugLabel,
          model: config.model,
          attempt: plan.attempt,
          totalAttemptsForModel: plan.totalAttemptsForModel,
          usedFallbackModel: planIndex > 0 || provider !== primaryProvider,
          timeoutHit: provider !== primaryProvider,
          inputChars,
          outputTokens: usageSummary.outputTokens,
          totalTokens: usageSummary.totalTokens,
          durationMs: Date.now() - attemptStartedAt,
          success: combined.trim().length > 0
        });

        if (params.debugLabel && LLM_DEBUG_TIMINGS_ENABLED) {
          console.info(`[llm:${params.debugLabel}] stream complete`, {
            provider,
            model,
            attempt: plan.attempt,
            totalAttemptsForModel: plan.totalAttemptsForModel,
            usage: usageSummary,
            output: combined
          });
        }

        if (combined.trim()) {
          return combined;
        }
      } catch (error) {
        recordLlmCallTrace({
          callId,
          label: params.debugLabel,
          model: config.model,
          attempt: plan.attempt,
          totalAttemptsForModel: plan.totalAttemptsForModel,
          usedFallbackModel: planIndex > 0 || provider !== primaryProvider,
          timeoutHit: isTimeoutError(error) || provider !== primaryProvider,
          inputChars,
          outputTokens: 0,
          totalTokens: 0,
          durationMs: Date.now() - attemptStartedAt,
          success: false
        });
        if (params.debugLabel && LLM_DEBUG_TIMINGS_ENABLED) {
          console.error(`[llm:${params.debugLabel}] stream request failed`, {
            provider,
            model: config.model,
            attempt: plan.attempt,
            totalAttemptsForModel: plan.totalAttemptsForModel,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        if (provider === primaryProvider && fallbackProvider && isTransientLlmProviderError(error)) {
          timeout?.cleanup();
          continue;
        }
      } finally {
        timeout?.cleanup();
      }
    }

    if (planIndex < executionPlan.length - 1) {
      await sleep(plan.attempt < plan.totalAttemptsForModel ? 250 : 400);
    }
  }

  return "";
}

export async function callSkillLlmJson<T>(params: {
  skill: SkillPromptName;
  input: unknown;
  outputSchemaHint: string;
  outputLanguage?: string;
  temperature?: number;
  model?: string;
  fallbackModels?: string[];
  debugLabel?: string;
  retrySameModelOnce?: boolean;
  includeRescueModel?: boolean;
}): Promise<T | null> {
  const systemPrompt = [
    buildPromptHeader(params.skill),
    "If input includes distribution/platform/format/aspect constraints, treat them as hard constraints.",
    `All textual output must be written in language code "${params.outputLanguage ?? "en"}".`,
    "Return strict JSON only. No markdown. No prose.",
    `JSON schema hint: ${params.outputSchemaHint}`
  ].join(" ");

  return callLlmJson<T>({
    systemPrompt,
    input: params.input,
    temperature: params.temperature,
    model: params.model,
    fallbackModels: params.fallbackModels,
    debugLabel: params.debugLabel,
    retrySameModelOnce: params.retrySameModelOnce,
    includeRescueModel: params.includeRescueModel
  });
}

export async function callGenericLlmJson<T>(params: {
  instruction: string;
  input: unknown;
  outputSchemaHint: string;
  outputLanguage?: string;
  temperature?: number;
  model?: string;
  fallbackModels?: string[];
  debugLabel?: string;
  retrySameModelOnce?: boolean;
  includeRescueModel?: boolean;
}): Promise<T | null> {
  const systemPrompt = [
    params.instruction,
    `All textual output must be written in language code "${params.outputLanguage ?? "en"}".`,
    "Return strict JSON only. No markdown. No prose.",
    `JSON schema hint: ${params.outputSchemaHint}`
  ].join(" ");

  return callLlmJson<T>({
    systemPrompt,
    input: params.input,
    temperature: params.temperature,
    model: params.model,
    fallbackModels: params.fallbackModels,
    debugLabel: params.debugLabel,
    retrySameModelOnce: params.retrySameModelOnce,
    includeRescueModel: params.includeRescueModel
  });
}

export async function callGenericLlmTextStream(params: {
  instruction: string;
  input: unknown;
  outputLanguage?: string;
  temperature?: number;
  model?: string;
  fallbackModels?: string[];
  debugLabel?: string;
  retrySameModelOnce?: boolean;
  includeRescueModel?: boolean;
  onDelta: (delta: string) => Promise<void> | void;
}): Promise<string> {
  const systemPrompt = [
    params.instruction,
    `All textual output must be written in language code "${params.outputLanguage ?? "en"}".`
  ].join(" ");

  return callLlmTextStream({
    systemPrompt,
    input: params.input,
    temperature: params.temperature,
    model: params.model,
    fallbackModels: params.fallbackModels,
    debugLabel: params.debugLabel,
    retrySameModelOnce: params.retrySameModelOnce,
    includeRescueModel: params.includeRescueModel,
    onDelta: params.onDelta
  });
}
