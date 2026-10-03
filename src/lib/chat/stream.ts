
import type { ClarificationCardData } from "./clarification-card";
export type ChatStreamSourceCard = {
  url: string;
  title: string;
  domain: string;
  excerpt?: string;
  published_at?: string;
  thumbnail_url?: string;
};

export type ChatStreamBaseEvent = {
  type: string;
};

export type ChatStreamAssistantPlanEvent = ChatStreamBaseEvent & {
  type: "assistant_plan";
  text: string;
};

export type ChatStreamAssistantDeltaEvent = ChatStreamBaseEvent & {
  type: "assistant_delta";
  channel: "opening" | "result";
  delta: string;
};

export type ChatStreamAssistantResetEvent = ChatStreamBaseEvent & {
  type: "assistant_reset";
  channel: "result";
};

export type ChatStreamToolStartedEvent = ChatStreamBaseEvent & {
  type: "tool_started";
  tool_name: string;
  title: string;
  detail?: string;
  stage?: string;
};

export type ChatStreamIntent = "chat" | "generate" | "revise" | "clarify" | "upload";

export type ChatStreamToolResultEvent = ChatStreamBaseEvent & {
  type: "tool_result";
  tool_name: string;
  title: string;
  detail?: string;
  output_text?: string;
  stage?: string;
  intent?: ChatStreamIntent;
  output_kind?: "image" | "video";
};

export type ChatStreamSourceCardEvent = ChatStreamBaseEvent & {
  type: "source_card";
  tool_name?: string;
  source: ChatStreamSourceCard;
};

export type ChatStreamAssistantResultEvent = ChatStreamBaseEvent & {
  type: "assistant_result";
  text: string;
};

export type ChatStreamAssistantNextEvent = ChatStreamBaseEvent & {
  type: "assistant_next";
  text: string;
};

export type ChatStreamTaskCreatedEvent = ChatStreamBaseEvent & {
  type: "task_created";
  payload: {
    action: "task_created";
    batch_id?: string;
    request_variant?: "single_platform" | "multi_platform_batch";
    session_id?: string;
    agent_mode?: boolean;
    job_id: string;
    poll_token?: string;
    status_url?: string;
    status?: "queued" | "running" | "completed" | "failed";
    error?: string;
    output_kind?: "image" | "video";
    source_use_case?: string;
    done: false;
  };
};

export type ChatStreamConversationDoneEvent = ChatStreamBaseEvent & {
  type: "conversation_done";
  payload: {
    action: "conversation";
    batch_id?: string;
    request_variant?: "single_platform" | "multi_platform_batch";
    session_id?: string;
    agent_mode?: boolean;
    creative_task_summary?: string | null;
    clarification_card?: ClarificationCardData;
    cta?:
      | {
          kind?: "workspace";
          href: string;
          label: string;
        }
      | {
          kind: "watermark_upgrade";
          targetJobId: string;
          targetAssetId: string;
          label: string;
        }
      | {
          kind: "subscription_plans";
          label: string;
        }
      | {
          kind: "video_subscription";
          label: string;
        };
    done: true;
  };
};

export type ChatStreamErrorEvent = ChatStreamBaseEvent & {
  type: "error";
  message: string;
  code?: string;
  details?: Record<string, unknown>;
};

export type ChatStreamDoneEvent = ChatStreamBaseEvent & {
  type: "done";
};

export type ChatStreamEvent =
  | ChatStreamAssistantPlanEvent
  | ChatStreamAssistantDeltaEvent
  | ChatStreamAssistantResetEvent
  | ChatStreamToolStartedEvent
  | ChatStreamToolResultEvent
  | ChatStreamSourceCardEvent
  | ChatStreamAssistantResultEvent
  | ChatStreamAssistantNextEvent
  | ChatStreamTaskCreatedEvent
  | ChatStreamConversationDoneEvent
  | ChatStreamErrorEvent
  | ChatStreamDoneEvent;

export function formatChatStreamEvent(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function isChatStreamResponse(response: Response): boolean {
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  return contentType.includes("text/event-stream");
}

export function parseChatStreamChunk(chunk: string): ChatStreamEvent[] {
  const events: ChatStreamEvent[] = [];
  const blocks = chunk.split("\n\n");
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const dataLine = trimmed
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("data:"));
    if (!dataLine) continue;
    const payload = dataLine.slice(5).trim();
    if (!payload) continue;
    try {
      const parsed = JSON.parse(payload) as ChatStreamEvent;
      if (parsed && typeof parsed === "object" && typeof parsed.type === "string") {
        events.push(parsed);
      }
    } catch {
      continue;
    }
  }
  return events;
}
