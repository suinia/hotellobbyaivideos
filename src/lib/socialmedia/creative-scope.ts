import { appConfig } from "@/lib/config";
import {
  isRetryableAgentProviderFailure,
  normalizeAgentProviderErrorField,
  readAgentContentPolicyError
} from "@/lib/socialmedia/agent-error-policy";

const MAX_SCOPE_REQUEST_ATTEMPTS = 2;
const SCOPE_RETRY_DELAY_MS = 150;

const TECHNICAL_OPERATION_PATTERN = /(?:\b(?:py(?:thon)?|javascript|typescript|java|c\+\+|c#|ruby|php|golang|rust|bash|powershell|cmd|terminal|diskpart|usb|windows|macos|linux)\b|(?:format|wipe|partition|mount)\s+(?:a\s+)?(?:usb|drive|disk)|(?:代码|程式码|脚本|命令行|终端|格式化(?:U盘|磁盘|硬盘)|分区|挂载|写(?:一段)?代码|编写(?:一段)?代码))/i;
const VISUAL_CREATION_PATTERN = /(?:\b(?:image|photo|picture|poster|flyer|infographic|menu|restaurant menu|price list|certificate|completion certificate|award certificate|cover|logo|banner|graphic|visual|video|animation|typography|typeface|font|illustration|artwork|art|mockup|render|drawing|sketch)\b|图片|图像|海报|传单|信息图|信息图表|菜单|餐厅菜单|价目表|证书|结业证书|获奖证书|封面|标志|横幅|视觉|视频|动画|字体|排版|画面|设计|插画|艺术|绘画)/i;
const EXECUTABLE_TECHNICAL_REPLY_PATTERN = /(?:```|\b(?:import\s+\w+|from\s+\S+\s+import|select\s+disk|create\s+partition|format\s+fs=|diskpart|sudo|powershell|cmd\.exe|pip\s+install)\b|^\s*(?:const|let|var|def|class)\b)/im;

type CreativeScope = "creative" | "product" | "out_of_scope";
type CreativeScopeWorkspace = "image_generator" | "video_generator";

export type CreativeScopeProviderConfig = {
  apiUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
};

export type CreativeScopeDecision = {
  scope: CreativeScope;
  requiresImageOperation: boolean;
};

export type CreativeScopeDiagnostic = {
  event: "retry" | "recovered" | "failed" | "fallback";
  reason:
    | "content_policy"
    | "http_error"
    | "invalid_json"
    | "invalid_schema"
    | "network_error"
    | "response_body_error"
    | "serialization_error"
    | "timeout"
    | "tool_free_agent_reply"
    | "empty_agent_reply";
  attemptCount?: number;
  maxAttempts?: number;
  durationMs?: number;
  retryable: boolean;
  statusCode?: number;
  errorName?: string;
  errorMessage?: string;
  providerCode?: string;
  providerType?: string;
  workspace?: CreativeScopeWorkspace;
};

type ScopeResponseEnvelope = {
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  output_text?: string;
};

type CreativeScopeFailure = Omit<CreativeScopeDiagnostic, "event" | "attemptCount" | "maxAttempts" | "durationMs" | "workspace">;

function hasVisualCreationSignal(value: string): boolean {
  return VISUAL_CREATION_PATTERN.test(value);
}

const IMAGE_CREATION_OBJECT_PATTERN = /(?:\b(?:image|photo|picture|poster|flyer|infographic|menu|restaurant menu|price list|certificate|completion certificate|award certificate|cover|logo|banner|graphic|visual|typography|typeface|font|illustration|artwork|art|mockup|render|drawing|sketch|portrait|advertisement|ad|product shot|social media post|business card|invitation|sticker|wallpaper|tattoo|3d scene)\b|图片|图像|照片|海报|传单|信息图|信息图表|菜单|餐厅菜单|价目表|证书|结业证书|获奖证书|封面|标志|横幅|视觉|字体|排版|插画|艺术|绘画|样机|肖像|广告|产品图|社交媒体帖子|名片|邀请函|贴纸|壁纸|纹身|3D场景)/i;
const IMAGE_EDIT_DIRECTION_PATTERN = /(?:\b(?:background|foreground|layout|composition|palette|colou?r|lighting|shadow|texture|watercolou?r|cinematic|photorealistic|camera angle|crop|subject|person|face|hair|clothing|dress|shirt|sky|scene|red|blue|green|black|white|yellow|pink|purple|orange)\b|背景|前景|版式|布局|构图|色调|颜色|灯光|光影|阴影|纹理|水彩|写实|镜头|裁剪|主体|人物|人脸|头发|服装|衣服|天空|场景|红色|蓝色|绿色|黑色|白色|黄色|粉色|紫色|橙色)/i;
const EXPLICIT_TECHNICAL_OPERATION_PATTERN = /(?:\b(?:code|script|program|function|class|module|package|command|terminal command|shell command|api|endpoint|database|schema|sql query|folder|directory|calendar event|account|password|file|file system|classifier|upload|download)\b|(?:format|wipe|partition|mount)\s+(?:a\s+)?(?:usb|drive|disk)|(?:代码|程式码|脚本|程序|函数|模块|软件包|命令|命令行|终端命令|接口|数据库|表结构|查询语句|文件|文件夹|目录|日历事件|账户|账号|密码|分类器|上传|下载|文件系统|格式化(?:U盘|磁盘|硬盘)|分区|挂载))/i;

export function hasExplicitImageCreationSignal(value: string): boolean {
  return IMAGE_CREATION_OBJECT_PATTERN.test(value);
}

export function hasExplicitImageEditSignal(value: string): boolean {
  return hasExplicitImageCreationSignal(value)
    || IMAGE_EDIT_DIRECTION_PATTERN.test(value);
}

export function hasExplicitTechnicalOperationSignal(value: string): boolean {
  return EXPLICIT_TECHNICAL_OPERATION_PATTERN.test(value);
}

function scopeText(response: ScopeResponseEnvelope): string {
  const output = response.output
    ?.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text ?? "")
    .join("\n")
    .trim();
  return output || response.output_text?.trim() || "";
}

function parseCreativeScope(value: string): CreativeScopeDecision | undefined {
  try {
    const parsed = JSON.parse(value) as { scope?: unknown; requires_image_operation?: unknown };
    if (
      (parsed.scope !== "creative" && parsed.scope !== "product" && parsed.scope !== "out_of_scope")
      || typeof parsed.requires_image_operation !== "boolean"
    ) return undefined;
    return {
      scope: parsed.scope,
      requiresImageOperation: parsed.requires_image_operation
    };
  } catch {
    return undefined;
  }
}

function waitForScopeRetry(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, SCOPE_RETRY_DELAY_MS));
}

function scopeProviderError(body: unknown, statusCode: number): Record<string, unknown> {
  const bodyRecord = body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const nestedError = bodyRecord.error
    && typeof bodyRecord.error === "object"
    && !Array.isArray(bodyRecord.error)
    ? bodyRecord.error as Record<string, unknown>
    : undefined;
  return {
    ...(nestedError ?? bodyRecord),
    status: statusCode
  };
}

function scopeHttpFailure(body: unknown, statusCode: number): CreativeScopeFailure {
  const providerError = scopeProviderError(body, statusCode);
  return {
    reason: "http_error",
    retryable: isRetryableAgentProviderFailure(providerError),
    statusCode,
    errorName: "CreativeScopeHttpError",
    errorMessage: `Creative scope request failed with HTTP ${statusCode}.`,
    providerCode: normalizeAgentProviderErrorField(providerError.code),
    providerType: normalizeAgentProviderErrorField(providerError.type)
  };
}

function scopeTransportFailure(error: unknown): CreativeScopeFailure {
  const isTimeout = error instanceof DOMException
    && (error.name === "TimeoutError" || error.name === "AbortError");
  return {
    reason: isTimeout ? "timeout" : "network_error",
    retryable: true,
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorMessage: isTimeout
      ? "Creative scope request timed out."
      : "Creative scope request could not reach the provider."
  };
}

/**
 * This is intentionally a separate, structured LLM turn. It decides scope,
 * while the creative Agent remains responsible only for an allowed creative
 * conversation. Callers decide how to safely handle a failed classification.
 */
export async function classifyCreativeScope(params: {
  content: string;
  previousResponseId?: string;
  conversationContext?: unknown;
  workspace?: CreativeScopeWorkspace;
  onDiagnostic?: (diagnostic: CreativeScopeDiagnostic) => void;
  provider?: CreativeScopeProviderConfig;
}): Promise<CreativeScopeDecision | undefined> {
  const config = params.provider ?? appConfig.toapisResponses;
  const startedAt = Date.now();
  const report = (
    event: CreativeScopeDiagnostic["event"],
    failure: CreativeScopeFailure,
    attemptCount?: number
  ) => {
    params.onDiagnostic?.({
      event,
      ...failure,
      ...(attemptCount === undefined
        ? {}
        : {
            attemptCount,
            maxAttempts: MAX_SCOPE_REQUEST_ATTEMPTS
          }),
      durationMs: Date.now() - startedAt,
      workspace: params.workspace
    });
  };
  let requestBody: string;
  try {
    requestBody = JSON.stringify({
      model: config.model,
      instructions: [
        "You are the strict scope router for Vismuse, an image and video creation product.",
        "Classify the current user request only; do not answer it and do not provide code, explanations, or tools.",
        params.workspace === "video_generator"
          ? "Video Generator context: treat any video-related instruction, visual description, scene, narrative, story, storyboard, or script as creative, even when the user does not explicitly ask to generate a video. It is an actionable video brief for the Video Agent."
          : params.workspace === "image_generator"
            ? "Image Generator context: the user is already inside an image-creation workspace. Treat a non-question declarative subject, title and artist, pasted copy, article summary, product or business phrase, event details, or other usable visual content as a creative image brief with requires_image_operation=true, even when it omits words such as create, generate, design, image, poster, or cover. Do not classify such content as out_of_scope merely because it also resembles prose, news, lyrics, or business information. Use product, out_of_scope, or requires_image_operation=false only when the user clearly asks an informational question, greets or chats, requests a non-visual external action, or explicitly asks to discuss without executing image work."
            : "",
        "creative: creating, revising, planning, or discussing an image/video/visual asset. This includes a request to put code or technical text visibly inside a visual asset.",
        "product: questions or actions about Vismuse features, generation results, downloads, watermarks, subscriptions, credits, or billing.",
        "out_of_scope: all other requests, including programming help, code or scripts, terminal commands, system/device operations, troubleshooting, general knowledge, or external services—even if an earlier conversation was off-topic.",
        "Default requires_image_operation to true for an in-scope image-work message that is not clearly an informational question, greeting, casual conversation, product question, or a request to discuss/plan without executing. Imperative and declarative creative directions should normally attempt image creation or revision.",
        params.workspace === "image_generator"
          ? "A future-conditional material handoff is not execution intent. When the user says they will send, provide, or upload images, copy, event details, or other required materials later and asks whether you can create the deliverable after receiving them, set requires_image_operation=false for this turn. This remains false even when they already name the output type, style, or number of outputs. Once a later turn actually supplies the promised materials and asks or clearly expects you to proceed, set it to true."
          : "",
        params.workspace === "image_generator"
          ? "When conversation_context ends with the assistant asking how to proceed with an image task, a brief affirmative continuation such as yes, okay, do it, or go ahead means the user expects image execution now: set requires_image_operation=true. Do not require the user to restate an option or answer another version of the same clarification; the downstream Image Agent will choose sensible defaults."
          : "",
        params.workspace === "image_generator"
          ? "When conversation_context or previous-response context contains a current image, completed image, or user-uploaded reference, interpret a concise imperative about content, composition, wording, placement, or appearance as an operation on that visual and set requires_image_operation=true, unless the user explicitly asks for a text-only answer or discussion. This remains true when the message omits the visual object or explicit image-operation verbs."
          : "",
        params.workspace === "image_generator"
          ? "A request only to inspect, read, describe, identify, extract, summarize, or analyze what is already visible is not an image operation: keep scope=creative but set requires_image_operation=false unless the user also asks to change or create the visual."
          : "",
        "Judge semantic intent, not isolated words or punctuation. A question-shaped action request such as 'Can you change the price?' is still requires_image_operation=true. A negative content constraint does not cancel execution: 'Change the price but do not add new text' is true because the user wants an image revision while forbidding extra copy. Use false only when the user clearly wants an answer or discussion without image execution in this turn.",
        "This flag captures execution intent, not whether the creative brief already has enough information. A generic request such as 'Make a flyer' is still true so the downstream Agent can ask for one essential creative attribute. Concise first-turn style, theme, color, or transformation instructions also count as execution intent even without a named image, such as 'frank ocean themed and make them pink and white'.",
        "Return exactly one JSON object and nothing else: {\"scope\":\"creative\",\"requires_image_operation\":true} or {\"scope\":\"creative\",\"requires_image_operation\":false}; use false for product and out_of_scope."
      ].join(" "),
      ...(params.previousResponseId ? { previous_response_id: params.previousResponseId } : {}),
      input: JSON.stringify({
        current_user_message: params.content,
        workspace: params.workspace,
        conversation_context: params.conversationContext
      })
    });
  } catch (error) {
    report("failed", {
      reason: "serialization_error",
      retryable: false,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: "Creative scope request could not be serialized."
    });
    return undefined;
  }

  let lastRetryFailure: CreativeScopeFailure | undefined;
  for (let attempt = 1; attempt <= MAX_SCOPE_REQUEST_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(config.apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: requestBody,
        cache: "no-store",
        signal: AbortSignal.timeout(config.timeoutMs)
      });
    } catch (error) {
      const failure = scopeTransportFailure(error);
      if (failure.retryable && attempt < MAX_SCOPE_REQUEST_ATTEMPTS) {
        lastRetryFailure = failure;
        report("retry", failure, attempt);
        await waitForScopeRetry();
        continue;
      }
      report("failed", failure, attempt);
      return undefined;
    }

    let rawBody: string;
    try {
      rawBody = await response.text();
    } catch (error) {
      const failure: CreativeScopeFailure = response.ok
        ? {
            reason: "response_body_error",
            retryable: true,
            statusCode: response.status,
            errorName: error instanceof Error ? error.name : "UnknownError",
            errorMessage: "Creative scope response body could not be read."
          }
        : scopeHttpFailure(undefined, response.status);
      if (failure.retryable && attempt < MAX_SCOPE_REQUEST_ATTEMPTS) {
        lastRetryFailure = failure;
        report("retry", failure, attempt);
        await waitForScopeRetry();
        continue;
      }
      report("failed", failure, attempt);
      return undefined;
    }

    let body: unknown;
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      const failure: CreativeScopeFailure = response.ok
        ? {
            reason: "invalid_json",
            retryable: true,
            statusCode: response.status,
            errorName: "CreativeScopeInvalidJson",
            errorMessage: "Creative scope provider returned invalid JSON."
          }
        : scopeHttpFailure(undefined, response.status);
      if (failure.retryable && attempt < MAX_SCOPE_REQUEST_ATTEMPTS) {
        lastRetryFailure = failure;
        report("retry", failure, attempt);
        await waitForScopeRetry();
        continue;
      }
      report("failed", failure, attempt);
      return undefined;
    }

    const contentPolicyFailure = readAgentContentPolicyError(body, response.status);
    if (contentPolicyFailure) {
      report("failed", {
        reason: "content_policy",
        retryable: false,
        statusCode: contentPolicyFailure.statusCode,
        errorName: contentPolicyFailure.name,
        errorMessage: contentPolicyFailure.message,
        providerCode: contentPolicyFailure.providerCode,
        providerType: contentPolicyFailure.providerType
      }, attempt);
      throw contentPolicyFailure;
    }

    if (!response.ok) {
      const failure = scopeHttpFailure(body, response.status);
      if (failure.retryable && attempt < MAX_SCOPE_REQUEST_ATTEMPTS) {
        lastRetryFailure = failure;
        report("retry", failure, attempt);
        await waitForScopeRetry();
        continue;
      }
      report("failed", failure, attempt);
      return undefined;
    }

    const decision = parseCreativeScope(scopeText(body as ScopeResponseEnvelope));
    if (!decision) {
      const failure: CreativeScopeFailure = {
        reason: "invalid_schema",
        retryable: true,
        statusCode: response.status,
        errorName: "CreativeScopeInvalidSchema",
        errorMessage: "Creative scope response did not match the required schema."
      };
      if (attempt < MAX_SCOPE_REQUEST_ATTEMPTS) {
        lastRetryFailure = failure;
        report("retry", failure, attempt);
        await waitForScopeRetry();
        continue;
      }
      report("failed", failure, attempt);
      return undefined;
    }

    if (attempt > 1) {
      report("recovered", {
        ...(lastRetryFailure ?? {
          reason: "invalid_schema",
          statusCode: response.status
        }),
        retryable: false,
      }, attempt);
    }
    return decision;
  }

  return undefined;
}

/**
 * Defense in depth for an Agent reply that escaped the input gate. The user
 * should never see executable snippets or device-operation steps from a
 * Vismuse visual-creation conversation.
 */
export function isUnrelatedTechnicalAgentReply(content: string, reply: string): boolean {
  if (EXECUTABLE_TECHNICAL_REPLY_PATTERN.test(reply)) return true;
  if (hasVisualCreationSignal(content)) return false;
  return TECHNICAL_OPERATION_PATTERN.test(content);
}

export function creativeScopeRedirect(language: string): string {
  return language.toLowerCase().startsWith("zh")
    ? "我可以帮你创建和编辑图片或视频。告诉我想做的海报、封面或短视频吧。"
    : "Vismuse can help create and edit images or videos. Tell me the visual you want to make, such as a poster, cover, or short video.";
}
