export type AgentIntent = "greeting" | "smalltalk" | "content_task" | "unclear";
export type AgentInputType = "text" | "url" | "mixed";
export type AgentReplyMode = "smalltalk" | "discussion" | "clarify" | "execution";
export type AgentTaskAction =
  | "none"
  | "create_task"
  | "revise_latest"
  | "revert_latest"
  | "replace_source"
  | "merge_source";
export type AgentTargetScope =
  | "none"
  | "full_draft"
  | "title"
  | "caption"
  | "hashtags"
  | "slide_copy"
  | "cover_image"
  | "slides"
  | "mixed";
export type AgentExecutionState = "none" | "completed";

export type DialogueClarificationOption = {
  id: string;
  label: string;
  taskAction: AgentTaskAction;
};

export type DialoguePendingQuestion = {
  version: 1;
  originUserMessageId: string;
  question: string;
  options: DialogueClarificationOption[];
};

export type DialogueConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type DialoguePendingRelation = "answer" | "new_request" | "none";

export function normalizeDialogueClarificationOptions(value: unknown): DialogueClarificationOption[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const actions: AgentTaskAction[] = ["none", "create_task", "revise_latest", "revert_latest", "replace_source", "merge_source"];
  return value.slice(0, 6).flatMap((option) => {
    if (!option || typeof option !== "object"
      || typeof option.id !== "string" || !option.id.trim() || option.id.length > 64
      || typeof option.label !== "string" || !option.label.trim() || option.label.length > 240
      || !actions.includes(option.taskAction) || ids.has(option.id.trim())) return [];
    ids.add(option.id.trim());
    return [{ id: option.id.trim(), label: option.label.trim(), taskAction: option.taskAction }];
  });
}

export type AgentIntentRoute = {
  intent: AgentIntent;
  inputType: AgentInputType;
  confidence: number;
  reason: string;
  replyMode?: AgentReplyMode;
  taskAction?: AgentTaskAction;
  targetScope?: AgentTargetScope;
  executionState?: AgentExecutionState;
};
