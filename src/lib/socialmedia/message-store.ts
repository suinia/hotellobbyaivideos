import { randomUUID } from "node:crypto";
import { isGuestUserId } from "@/lib/auth/guest";
import { appConfig } from "@/lib/config";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseConfig } from "@/lib/supabase/config";
import type {
  SocialmediaMessage,
  SocialmediaMessageIntent,
  SocialmediaMessageRole,
  SocialmediaSourceAsset,
  SocialmediaTargetAsset
} from "@/lib/socialmedia/types";

declare global {
  var __SOCIALMEDIA_MESSAGES__: Map<string, SocialmediaMessage> | undefined;
}

const localMessages = globalThis.__SOCIALMEDIA_MESSAGES__ ?? new Map<string, SocialmediaMessage>();
globalThis.__SOCIALMEDIA_MESSAGES__ = localMessages;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MESSAGE_STORE_WRITE_ATTEMPTS = 2;
const MESSAGE_STORE_TERMINAL_UPDATE_ATTEMPTS = 3;
const MESSAGE_STORE_RETRY_DELAY_MS = 150;

type MessageRow = {
  id: string;
  session_id: string;
  user_id: string | null;
  guest_user_id: string | null;
  role: SocialmediaMessageRole;
  content: string;
  intent: SocialmediaMessageIntent;
  job_id: string | null;
  source_assets_json: SocialmediaSourceAsset[] | null;
  target_assets_json: SocialmediaTargetAsset[] | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
};

function canUsePersistentStore(userId: string, persist?: boolean): boolean {
  // Conversation persistence is part of the Responses Agent experience.
  // Keep the legacy pipeline byte-for-byte equivalent in its storage behavior
  // unless the request's effective input mode opts into this path.
  return (persist ?? appConfig.socialmedia.inputMode === "agent")
    && supabaseConfig.adminEnabled
    && (isGuestUserId(userId) || UUID_PATTERN.test(userId));
}

function isMessageTableUnavailable(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "PGRST205"
    || /could not find the table ['\"]?public\.socialmedia_messages/i.test(error?.message ?? "");
}

function messageStoreErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "unknown message store error");
  }
  return String(error ?? "unknown message store error");
}

function isTransientMessageStoreError(error: unknown): boolean {
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  const message = messageStoreErrorMessage(error);
  return /(?:fetch failed|network|socket|timeout|timed out|econnreset|econnrefused|enotfound|eai_again|connection|502|503|504)/i.test(`${code} ${message}`);
}

function waitForMessageStoreRetry(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, MESSAGE_STORE_RETRY_DELAY_MS));
}

function localMessagesFor(sessionId: string, userId: string): SocialmediaMessage[] {
  return [...localMessages.values()]
    .filter((message) => message.sessionId === sessionId && message.userId === userId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function jobMessageTerminalRank(message: SocialmediaMessage): number {
  if (message.metadata?.kind === "job_completed") return 3;
  if (message.metadata?.kind === "job_failed") return 2;
  if (message.metadata?.kind === "job_started") return 1;
  return 0;
}

function mergePersistedAndLocalMessages(
  persisted: SocialmediaMessage[],
  sessionId: string,
  userId: string
): SocialmediaMessage[] {
  const merged = new Map(localMessagesFor(sessionId, userId).map((message) => [message.id, message]));
  for (const message of persisted) {
    const localMessage = merged.get(message.id);
    if (
      !localMessage
      || jobMessageTerminalRank(message) >= jobMessageTerminalRank(localMessage)
    ) {
      merged.set(message.id, message);
    }
  }
  return [...merged.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function retainLocally(message: SocialmediaMessage, reason: string, warn = false): SocialmediaMessage {
  if (warn) {
    console.warn("[socialmedia-message-store] using local message fallback", {
      reason,
      sessionId: message.sessionId,
      messageId: message.id
    });
  }
  localMessages.set(message.id, message);
  return message;
}

function toMessage(row: MessageRow): SocialmediaMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id ?? row.guest_user_id ?? "",
    role: row.role,
    content: row.content,
    intent: row.intent,
    jobId: row.job_id,
    sourceAssets: row.source_assets_json ?? undefined,
    targetAssets: row.target_assets_json ?? undefined,
    metadata: row.metadata_json ?? undefined,
    createdAt: row.created_at
  };
}

export async function createSocialmediaMessage(params: {
  /** Verified incomplete user message being retried under its Session lease. */
  retryMessage?: SocialmediaMessage;
  sessionId: string;
  userId: string;
  role: SocialmediaMessageRole;
  content: string;
  intent: SocialmediaMessageIntent;
  jobId?: string | null;
  sourceAssets?: SocialmediaSourceAsset[];
  targetAssets?: SocialmediaTargetAsset[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
  sessionActivityAt?: string;
  persist?: boolean;
  requirePersisted?: boolean;
}): Promise<SocialmediaMessage> {
  const retryMessage = params.retryMessage;
  if (retryMessage && (params.role !== "user" || retryMessage.role !== "user"
    || retryMessage.sessionId !== params.sessionId || retryMessage.userId !== params.userId
    || retryMessage.content !== params.content)) {
    throw new Error("A message retry must preserve its owner, Session, role and content.");
  }
  const message: SocialmediaMessage = {
    id: retryMessage?.id ?? randomUUID(),
    sessionId: params.sessionId,
    userId: params.userId,
    role: params.role,
    content: params.content,
    intent: params.intent,
    jobId: params.jobId ?? null,
    sourceAssets: params.sourceAssets,
    targetAssets: params.targetAssets,
    metadata: params.metadata,
    createdAt: retryMessage?.createdAt ?? (params.createdAt?.trim() || new Date().toISOString())
  };

  if (!canUsePersistentStore(params.userId, params.persist)) {
    return retainLocally(message, "agent mode is disabled or the owner is not persistable");
  }

  const owner = isGuestUserId(params.userId)
    ? { user_id: null, guest_user_id: params.userId }
    : { user_id: params.userId, guest_user_id: null };
  const row = {
    id: message.id,
    session_id: message.sessionId,
    ...owner,
    role: message.role,
    content: message.content,
    intent: message.intent,
    job_id: message.jobId ?? null,
    source_assets_json: message.sourceAssets ?? null,
    target_assets_json: message.targetAssets ?? null,
    metadata_json: message.metadata ?? null,
    created_at: message.createdAt
  };
  let persistedRow: MessageRow | undefined;
  let transientFailure: unknown;
  for (let attempt = 1; attempt <= MESSAGE_STORE_WRITE_ATTEMPTS; attempt += 1) {
    try {
      // The fixed message ID makes this retry idempotent when the insert
      // succeeds remotely but its response is lost in transit.
      const { data, error } = await getSupabaseAdminClient()
        .from("socialmedia_messages")
        .upsert(row, { onConflict: "id" })
        .select("*")
        .single();
      if (isMessageTableUnavailable(error)) {
        if (params.requirePersisted) {
          throw new Error("Unable to persist conversation message: socialmedia_messages is unavailable.");
        }
        return retainLocally(message, "socialmedia_messages migration has not been applied", true);
      }
      if (!error && data) {
        persistedRow = data as MessageRow;
        break;
      }
      if (!isTransientMessageStoreError(error)) {
        throw new Error(`Unable to persist conversation message: ${error?.message ?? "no row returned"}`);
      }
      transientFailure = error;
    } catch (error) {
      if (!isTransientMessageStoreError(error)) throw error;
      transientFailure = error;
    }
    if (attempt < MESSAGE_STORE_WRITE_ATTEMPTS) await waitForMessageStoreRetry();
  }

  if (!persistedRow) {
    if (params.requirePersisted) {
      throw new Error(
        `Unable to persist conversation message after ${MESSAGE_STORE_WRITE_ATTEMPTS} attempts: ${messageStoreErrorMessage(transientFailure)}`
      );
    }
    return retainLocally(
      message,
      `transient persistence failure after ${MESSAGE_STORE_WRITE_ATTEMPTS} attempts: ${messageStoreErrorMessage(transientFailure)}`,
      true
    );
  }

  try {
    const { error: sessionTouchError } = await getSupabaseAdminClient()
      .from("sessions")
      .update({ updated_at: params.sessionActivityAt?.trim() || message.createdAt })
      .eq("id", message.sessionId);
    if (sessionTouchError) {
      console.warn("[socialmedia-message-store] failed to update session activity", {
        sessionId: message.sessionId,
        error: sessionTouchError.message
      });
    }
  } catch (error) {
    console.warn("[socialmedia-message-store] failed to update session activity", {
      sessionId: message.sessionId,
      error: messageStoreErrorMessage(error)
    });
  }
  return toMessage(persistedRow);
}

/**
 * A generation starts with a short Agent acknowledgement. Once the job reaches
 * a terminal state, update its status. Agent image completion can retain the
 * opening reply while still recording job_completed for history grounding.
 */
export async function replaceSocialmediaJobOpeningMessage(params: {
  sessionId: string;
  userId: string;
  jobId: string;
  content: string;
  kind?: "job_completed" | "job_failed";
  preserveOpeningReply?: boolean;
}): Promise<number> {
  const openingMessage = params.preserveOpeningReply && params.kind !== "job_failed"
    ? (await listSocialmediaMessages(params.sessionId, params.userId, { persist: true }))
        .find((message) => message.jobId === params.jobId
          && message.role === "assistant"
          && (message.metadata?.kind === "job_started" || message.metadata?.kind === "job_completed"))
    : undefined;
  const content = openingMessage?.content.trim() ? openingMessage.content : params.content;
  const metadata = { kind: params.kind ?? "job_completed" };
  const locallyUpdatedIds = new Set<string>();
  for (const [id, message] of localMessages) {
    if (
      message.sessionId === params.sessionId
      && message.userId === params.userId
      && message.jobId === params.jobId
      && message.role === "assistant"
      && (
        params.kind !== "job_failed"
        || message.metadata?.kind === "job_started"
        || message.metadata?.kind === "job_failed"
      )
    ) {
      localMessages.set(id, { ...message, content, metadata });
      locallyUpdatedIds.add(id);
    }
  }

  // Terminal updates run after the original request, so they do not receive
  // that request's experiment assignment. Update persisted Agent turns whenever
  // the table is available; pipeline turns have no matching database row.
  if (!canUsePersistentStore(params.userId, true)) {
    return locallyUpdatedIds.size;
  }

  const ownerColumn = isGuestUserId(params.userId) ? "guest_user_id" : "user_id";
  let updatedRows: Array<{ id: string }> = [];
  let lastTransientError: unknown;
  for (let attempt = 1; attempt <= MESSAGE_STORE_TERMINAL_UPDATE_ATTEMPTS; attempt += 1) {
    try {
      let updateQuery = getSupabaseAdminClient()
        .from("socialmedia_messages")
        .update({ content, metadata_json: metadata })
        .eq("session_id", params.sessionId)
        .eq("job_id", params.jobId)
        .eq(ownerColumn, params.userId)
        .eq("role", "assistant");
      if (params.kind === "job_failed") {
        // A delayed failure callback must not overwrite a later successful recovery.
        updateQuery = updateQuery.in("metadata_json->>kind", ["job_started", "job_failed"]);
      }
      const { data, error } = await updateQuery.select("id");
      if (isMessageTableUnavailable(error)) return locallyUpdatedIds.size;
      if (!error) {
        updatedRows = data ?? [];
        lastTransientError = undefined;
        break;
      }
      if (!isTransientMessageStoreError(error)) {
        throw new Error(`Unable to replace generation opening message: ${error.message}`);
      }
      lastTransientError = error;
    } catch (error) {
      if (!isTransientMessageStoreError(error)) throw error;
      lastTransientError = error;
    }
    if (attempt < MESSAGE_STORE_TERMINAL_UPDATE_ATTEMPTS) {
      await waitForMessageStoreRetry();
    }
  }
  if (lastTransientError) {
    throw new Error(
      `Unable to replace generation opening message after ${MESSAGE_STORE_TERMINAL_UPDATE_ATTEMPTS} attempts: `
      + messageStoreErrorMessage(lastTransientError)
    );
  }
  for (const row of updatedRows) locallyUpdatedIds.add(row.id);
  return locallyUpdatedIds.size;
}

export async function listSocialmediaMessages(
  sessionId: string,
  userId: string,
  options?: {
    persist?: boolean;
    requirePersisted?: boolean;
  }
): Promise<SocialmediaMessage[]> {
  if (!canUsePersistentStore(userId, options?.persist)) {
    return localMessagesFor(sessionId, userId);
  }

  const ownerColumn = isGuestUserId(userId) ? "guest_user_id" : "user_id";
  let rows: MessageRow[] | undefined;
  let queryError: { code?: string; message: string } | null = null;
  let transientReadFailure: unknown;
  for (let attempt = 1; attempt <= MESSAGE_STORE_WRITE_ATTEMPTS; attempt += 1) {
    try {
      const { data, error } = await getSupabaseAdminClient()
        .from("socialmedia_messages")
        .select("*")
        .eq("session_id", sessionId)
        .eq(ownerColumn, userId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      if (!error) {
        rows = (data as MessageRow[] | null) ?? [];
        queryError = null;
        break;
      }
      queryError = error;
      if (!isTransientMessageStoreError(error)) break;
      transientReadFailure = error;
    } catch (error) {
      if (!isTransientMessageStoreError(error)) throw error;
      transientReadFailure = error;
    }
    if (attempt < MESSAGE_STORE_WRITE_ATTEMPTS) await waitForMessageStoreRetry();
  }
  const error = queryError;
  if (rows === undefined && transientReadFailure) {
    if (options?.requirePersisted) {
      throw new Error(
        `Unable to load persisted conversation messages: ${messageStoreErrorMessage(transientReadFailure)}`
      );
    }
    console.warn("[socialmedia-message-store] transient read failure; returning local messages", {
      sessionId,
      error: messageStoreErrorMessage(transientReadFailure)
    });
    return localMessagesFor(sessionId, userId);
  }
  if (error) {
    if (isMessageTableUnavailable(error)) {
      if (options?.requirePersisted) {
        throw new Error("Unable to load persisted conversation messages: socialmedia_messages is unavailable.");
      }
      console.warn("[socialmedia-message-store] socialmedia_messages migration has not been applied; returning local messages only");
      return localMessagesFor(sessionId, userId);
    }
    throw new Error(`Unable to load conversation messages: ${error.message}`);
  }
  const persistedMessages = (rows ?? []).map(toMessage);
  if (options?.requirePersisted) {
    const persistedIds = new Set(persistedMessages.map((message) => message.id));
    const missingLocalMessage = localMessagesFor(sessionId, userId).find(
      (message) => !persistedIds.has(message.id)
    );
    if (missingLocalMessage) {
      throw new Error(
        `Unable to load complete persisted conversation history: message ${missingLocalMessage.id} is only available locally.`
      );
    }
    return persistedMessages;
  }
  return mergePersistedAndLocalMessages(persistedMessages, sessionId, userId);
}

export async function adoptSocialmediaMessages(guestUserId: string, targetUserId: string): Promise<number> {
  if (!canUsePersistentStore(targetUserId, true) || !isGuestUserId(guestUserId) || !UUID_PATTERN.test(targetUserId)) return 0;
  const { data, error } = await getSupabaseAdminClient()
    .from("socialmedia_messages")
    .update({ user_id: targetUserId, guest_user_id: null })
    .eq("guest_user_id", guestUserId)
    .select("id");
  if (error) {
    if (isMessageTableUnavailable(error)) return 0;
    throw new Error(`Unable to adopt conversation messages: ${error.message}`);
  }
  return data?.length ?? 0;
}
