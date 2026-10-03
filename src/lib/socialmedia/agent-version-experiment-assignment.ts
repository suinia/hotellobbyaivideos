import type { AppUser } from "@/lib/auth/app-user";
import { isGuestUserId } from "@/lib/auth/guest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_SOCIALMEDIA_AGENT_VERSION_EXPERIMENT_VARIANT,
  SOCIALMEDIA_AGENT_VERSION_EXPERIMENT_KEY,
  normalizeSocialmediaAgentVersionExperimentVariant,
  type SocialmediaAgentVersionExperimentVariant
} from "@/lib/socialmedia/agent-version-experiment";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseConfig } from "@/lib/supabase/config";

const ACTIVE_EXPERIMENT_CACHE_TTL_MS = 60_000;
const DEFAULT_EXPERIMENT_DB_TIMEOUT_MS = 500;
const DEFAULT_EXPERIMENT_DB_FAILURE_BACKOFF_MS = 5_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANUAL_V2_OVERRIDE_SOURCES = new Set([
  "manual",
  "manual_override",
  "manual_test_override"
]);

type ExperimentConfigRow = { default_variant?: unknown; active_experiment_id?: unknown };
type ExperimentRow = { experiment_key?: unknown; status?: unknown; starts_at?: unknown; ends_at?: unknown };
type ExperimentVariantRow = { variant?: unknown; weight?: unknown; enabled?: unknown };
type SessionAssignmentRow = {
  agent_version_experiment_id?: unknown;
  agent_version_experiment_variant?: unknown;
  agent_version_experiment_source?: unknown;
};

type SessionAssignment = {
  experimentId?: string;
  variant: SocialmediaAgentVersionExperimentVariant;
  source: string;
};

type SessionAssignmentReadResult = {
  row: SessionAssignmentRow | null;
  readFailed: boolean;
};

type WeightedVariant = {
  variant: SocialmediaAgentVersionExperimentVariant;
  weight: number;
};

export type SocialmediaAgentVersionExperimentState = {
  defaultVariant: SocialmediaAgentVersionExperimentVariant;
  experimentId?: string;
  active: boolean;
  variants: WeightedVariant[];
  readFailed?: boolean;
};

type ActiveExperiment = SocialmediaAgentVersionExperimentState;

type AssignmentDependencies = {
  admin?: Pick<SupabaseClient, "from">;
  adminEnabled?: boolean;
  experiment?: ActiveExperiment | null;
};

export type SocialmediaAgentVersionExperimentAssignment = {
  key: typeof SOCIALMEDIA_AGENT_VERSION_EXPERIMENT_KEY;
  experimentId?: string;
  variant: SocialmediaAgentVersionExperimentVariant;
  source: string;
  persisted: boolean;
  sessionLocked: boolean;
  active: boolean;
  emergencyRollback: boolean;
};

let activeExperimentCache: { expiresAt: number; value: ActiveExperiment | null } | null = null;
let experimentDbCircuitOpenUntil = 0;
let experimentDbTimeoutMs = DEFAULT_EXPERIMENT_DB_TIMEOUT_MS;
let experimentDbFailureBackoffMs = DEFAULT_EXPERIMENT_DB_FAILURE_BACKOFF_MS;

type ExperimentDbBudget = { deadlineAt: number };

function createExperimentDbBudget(): ExperimentDbBudget {
  return { deadlineAt: Date.now() + experimentDbTimeoutMs };
}

type AbortablePromiseLike<T> = PromiseLike<T> & {
  abortSignal?: (signal: AbortSignal) => PromiseLike<T>;
};

class ExperimentDatabaseUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExperimentDatabaseUnavailableError";
  }
}

function openExperimentDbCircuit(): void {
  experimentDbCircuitOpenUntil = Math.max(
    experimentDbCircuitOpenUntil,
    Date.now() + experimentDbFailureBackoffMs
  );
}

function isExperimentDbCircuitOpen(): boolean {
  return experimentDbCircuitOpenUntil > Date.now();
}

function isAvailabilityError(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const error = value as { code?: unknown; message?: unknown };
  const code = typeof error.code === "string" ? error.code.toUpperCase() : "";
  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";
  return code.startsWith("08")
    || /^PGRST00[0-3]$/.test(code)
    || /fetch failed|network|connection|timed?\s*out|timeout|abort/.test(message);
}

async function runExperimentDbOperation<T>(
  label: string,
  operation: AbortablePromiseLike<T>,
  options: { allowCircuitBypass?: boolean; budget?: ExperimentDbBudget } = {}
): Promise<T> {
  if (isExperimentDbCircuitOpen() && !options.allowCircuitBypass) {
    throw new ExperimentDatabaseUnavailableError(`experiment database circuit open: ${label}`);
  }

  const controller = new AbortController();
  const timeoutMs = options.budget
    ? Math.max(0, options.budget.deadlineAt - Date.now())
    : experimentDbTimeoutMs;
  if (timeoutMs <= 0) {
    openExperimentDbCircuit();
    throw new ExperimentDatabaseUnavailableError(`experiment database deadline exceeded: ${label}`);
  }
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const abortableOperation = typeof operation.abortSignal === "function"
    ? operation.abortSignal(controller.signal)
    : operation;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      openExperimentDbCircuit();
      reject(new ExperimentDatabaseUnavailableError(`experiment database timeout: ${label}`));
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([Promise.resolve(abortableOperation), timeout]);
    if (isAvailabilityError((response as { error?: unknown } | null)?.error)) {
      openExperimentDbCircuit();
    }
    return response;
  } catch (error) {
    openExperimentDbCircuit();
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function normalizeTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function isExperimentActive(row: ExperimentRow, now = Date.now()): boolean {
  if (row.status !== "active") return false;
  const startsAt = normalizeTimestamp(row.starts_at);
  const endsAt = normalizeTimestamp(row.ends_at);
  return (startsAt === null || startsAt <= now) && (endsAt === null || endsAt > now);
}

function normalizeWeightedVariants(rows: ExperimentVariantRow[]): WeightedVariant[] {
  return rows.flatMap((row) => {
    if (row.enabled === false) return [];
    const rawVariant = typeof row.variant === "string" ? row.variant.trim().toLowerCase() : "";
    if (rawVariant !== "agent_v1" && rawVariant !== "agent_v2") return [];
    const weight = Math.max(0, Number(row.weight ?? 0));
    return Number.isFinite(weight)
      ? [{ variant: rawVariant as SocialmediaAgentVersionExperimentVariant, weight }]
      : [];
  });
}

function pickWeightedVariant(rows: WeightedVariant[]): SocialmediaAgentVersionExperimentVariant {
  const enabled = rows.filter((row) => row.weight > 0);
  if (!enabled.length) return DEFAULT_SOCIALMEDIA_AGENT_VERSION_EXPERIMENT_VARIANT;
  let cursor = Math.random() * enabled.reduce((sum, row) => sum + row.weight, 0);
  for (const row of enabled) {
    cursor -= row.weight;
    if (cursor <= 0) return row.variant;
  }
  return enabled[0]?.variant ?? DEFAULT_SOCIALMEDIA_AGENT_VERSION_EXPERIMENT_VARIANT;
}

function isVariantReceivingTraffic(
  variant: SocialmediaAgentVersionExperimentVariant,
  rows: WeightedVariant[]
): boolean {
  return rows.some((row) => row.variant === variant && row.weight > 0);
}

function isManualV2Override(assignment: Pick<SessionAssignment, "variant" | "source">): boolean {
  return assignment.variant === "agent_v2"
    && MANUAL_V2_OVERRIDE_SOURCES.has(assignment.source.trim().toLowerCase());
}

function shouldEmergencyRollbackV2(
  assignment: Pick<SessionAssignment, "variant" | "source">,
  experiment: ActiveExperiment
): boolean {
  if (assignment.variant !== "agent_v2") return false;
  if (!isVariantInExperiment("agent_v2", experiment.variants)) return true;
  return !isManualV2Override(assignment)
    && !isVariantReceivingTraffic("agent_v2", experiment.variants);
}

function isVariantInExperiment(
  variant: SocialmediaAgentVersionExperimentVariant,
  rows: WeightedVariant[]
): boolean {
  return rows.some((row) => row.variant === variant);
}

function result(params: Partial<SocialmediaAgentVersionExperimentAssignment> & {
  variant: SocialmediaAgentVersionExperimentVariant;
  source: string;
}): SocialmediaAgentVersionExperimentAssignment {
  return {
    key: SOCIALMEDIA_AGENT_VERSION_EXPERIMENT_KEY,
    experimentId: params.experimentId,
    variant: params.variant,
    source: params.source,
    persisted: params.persisted ?? false,
    sessionLocked: params.sessionLocked ?? false,
    active: params.active ?? false,
    emergencyRollback: params.emergencyRollback ?? false
  };
}

function cacheActiveExperiment(value: ActiveExperiment | null): ActiveExperiment | null {
  activeExperimentCache = {
    expiresAt: Date.now() + ACTIVE_EXPERIMENT_CACHE_TTL_MS,
    value
  };
  return value;
}

function lastKnownExperimentOrReadFailure(
  fallback: ActiveExperiment
): ActiveExperiment {
  const lastKnown = activeExperimentCache?.value;
  const value = lastKnown && !lastKnown.readFailed
    ? { ...lastKnown, readFailed: true }
    : { ...fallback, readFailed: true };
  // A short negative cache is deliberate: it protects a failing experiment
  // database from a request stampede while every affected request uses V1.
  activeExperimentCache = {
    expiresAt: Math.max(Date.now() + experimentDbFailureBackoffMs, experimentDbCircuitOpenUntil),
    value
  };
  return value;
}

async function readActiveExperiment(
  budget: ExperimentDbBudget = createExperimentDbBudget()
): Promise<ActiveExperiment | null> {
  if (!supabaseConfig.adminEnabled) return null;
  if (isExperimentDbCircuitOpen()) {
    return lastKnownExperimentOrReadFailure({
      defaultVariant: DEFAULT_SOCIALMEDIA_AGENT_VERSION_EXPERIMENT_VARIANT,
      active: false,
      variants: []
    });
  }
  if (activeExperimentCache && activeExperimentCache.expiresAt > Date.now()) {
    return activeExperimentCache.value;
  }

  const admin = getSupabaseAdminClient();
  let configResponse: Awaited<ReturnType<typeof runExperimentDbOperation<{
    data: unknown;
    error: { message: string } | null;
  }>>>;
  try {
    configResponse = await runExperimentDbOperation("read experiment config", admin
    .from("experiment_configs")
    .select("default_variant, active_experiment_id")
    .eq("experiment_key", SOCIALMEDIA_AGENT_VERSION_EXPERIMENT_KEY)
    .maybeSingle(), { budget });
  } catch (error) {
    console.warn("[socialmedia agent version experiment] experiment config read timed out", {
      error: error instanceof Error ? error.message : String(error)
    });
    return lastKnownExperimentOrReadFailure({
      defaultVariant: DEFAULT_SOCIALMEDIA_AGENT_VERSION_EXPERIMENT_VARIANT,
      active: false,
      variants: []
    });
  }
  const { data: config, error: configError } = configResponse;
  if (configError) {
    console.warn("[socialmedia agent version experiment] failed to read experiment config", {
      error: configError.message
    });
    return lastKnownExperimentOrReadFailure({
      defaultVariant: DEFAULT_SOCIALMEDIA_AGENT_VERSION_EXPERIMENT_VARIANT,
      active: false,
      variants: []
    });
  }

  const configRow = (config ?? {}) as ExperimentConfigRow;
  const defaultVariant = normalizeSocialmediaAgentVersionExperimentVariant(
    typeof configRow.default_variant === "string" ? configRow.default_variant : undefined
  );
  const experimentId = typeof configRow.active_experiment_id === "string"
    ? configRow.active_experiment_id
    : undefined;
  if (!experimentId) return cacheActiveExperiment({ defaultVariant, active: false, variants: [] });

  let experimentResponse;
  try {
    experimentResponse = await runExperimentDbOperation("read active experiment", admin
      .from("experiments")
      .select("experiment_key, status, starts_at, ends_at")
      .eq("id", experimentId)
      .maybeSingle(), { budget });
  } catch (error) {
    console.warn("[socialmedia agent version experiment] active experiment read timed out", {
      experimentId,
      error: error instanceof Error ? error.message : String(error)
    });
    return lastKnownExperimentOrReadFailure({ defaultVariant, experimentId, active: false, variants: [] });
  }
  const { data: experiment, error: experimentError } = experimentResponse;
  if (experimentError) {
    console.warn("[socialmedia agent version experiment] failed to read active experiment", {
      experimentId,
      error: experimentError.message
    });
    return lastKnownExperimentOrReadFailure({
      defaultVariant,
      experimentId,
      active: false,
      variants: []
    });
  }
  const experimentRow = (experiment ?? {}) as ExperimentRow;
  const active = experimentRow.experiment_key === SOCIALMEDIA_AGENT_VERSION_EXPERIMENT_KEY
    && isExperimentActive(experimentRow);
  if (!active) return cacheActiveExperiment({ defaultVariant, experimentId, active: false, variants: [] });

  let variantsResponse;
  try {
    variantsResponse = await runExperimentDbOperation("read experiment variants", admin
      .from("experiment_variants")
      .select("variant, weight, enabled")
      .eq("experiment_id", experimentId)
      .eq("enabled", true), { budget });
  } catch (error) {
    console.warn("[socialmedia agent version experiment] variant read timed out", {
      experimentId,
      error: error instanceof Error ? error.message : String(error)
    });
    return lastKnownExperimentOrReadFailure({ defaultVariant, experimentId, active: false, variants: [] });
  }
  const { data: variants, error: variantsError } = variantsResponse;
  if (variantsError) {
    console.warn("[socialmedia agent version experiment] failed to read variants", {
      experimentId,
      error: variantsError.message
    });
    return lastKnownExperimentOrReadFailure({
      defaultVariant,
      experimentId,
      active: false,
      variants: []
    });
  }
  return cacheActiveExperiment({
    defaultVariant,
    experimentId,
    active: true,
    variants: normalizeWeightedVariants((variants ?? []) as ExperimentVariantRow[])
  });
}

function forcedSessionIds(): Set<string> {
  return new Set(
    (process.env.SOCIALMEDIA_AGENT_FRONTDESK_V2_SESSION_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function actorIdentity(user: AppUser): { userId?: string; anonymousId?: string } {
  if (user.authMode === "supabase" && UUID_PATTERN.test(user.id)) return { userId: user.id };
  const anonymousId = user.id.trim();
  return anonymousId ? { anonymousId } : {};
}

function sessionOwnerFilter(user: AppUser): { column: "user_id" | "guest_user_id"; value: string } | null {
  if (user.authMode === "supabase" && UUID_PATTERN.test(user.id)) {
    return { column: "user_id", value: user.id };
  }
  if (user.authMode === "guest" || isGuestUserId(user.id)) {
    return { column: "guest_user_id", value: user.id };
  }
  return null;
}

async function readSessionAssignment(
  sessionId: string,
  user: AppUser,
  admin: Pick<SupabaseClient, "from"> = getSupabaseAdminClient(),
  allowCircuitBypass = false,
  budget: ExperimentDbBudget = createExperimentDbBudget()
): Promise<SessionAssignmentReadResult> {
  const owner = sessionOwnerFilter(user);
  if (!owner) return { row: null, readFailed: false };
  let response;
  try {
    response = await runExperimentDbOperation("read session assignment", admin
    .from("sessions")
    .select("agent_version_experiment_id, agent_version_experiment_variant, agent_version_experiment_source")
    .eq("id", sessionId)
    .eq(owner.column, owner.value)
    .maybeSingle(), { allowCircuitBypass, budget });
  } catch (error) {
    console.warn("[socialmedia agent version experiment] session lock read timed out", {
      sessionId,
      error: error instanceof Error ? error.message : String(error)
    });
    return { row: null, readFailed: true };
  }
  const { data, error } = response;
  if (error) {
    console.warn("[socialmedia agent version experiment] failed to read session lock", {
      sessionId,
      error: error.message
    });
    return { row: null, readFailed: true };
  }
  return { row: data as SessionAssignmentRow | null, readFailed: false };
}

function normalizeSessionAssignment(row: SessionAssignmentRow | null): SessionAssignment | null {
  if (typeof row?.agent_version_experiment_variant !== "string") return null;
  return {
    experimentId: typeof row.agent_version_experiment_id === "string"
      ? row.agent_version_experiment_id
      : undefined,
    variant: normalizeSocialmediaAgentVersionExperimentVariant(
      row.agent_version_experiment_variant
    ),
    source: typeof row.agent_version_experiment_source === "string"
      ? row.agent_version_experiment_source
      : "session_lock"
  };
}

async function persistSessionAssignment(params: {
  sessionId: string;
  user: AppUser;
  experimentId?: string;
  variant: SocialmediaAgentVersionExperimentVariant;
  source: string;
  allowCircuitBypass?: boolean;
  budget?: ExperimentDbBudget;
}, admin: Pick<SupabaseClient, "from"> = getSupabaseAdminClient()): Promise<SessionAssignment | null> {
  const owner = sessionOwnerFilter(params.user);
  if (!owner) return null;
  let response;
  try {
    response = await runExperimentDbOperation("persist session assignment", admin
    .from("sessions")
    .update({
      agent_version_experiment_id: params.experimentId ?? null,
      agent_version_experiment_variant: params.variant,
      agent_version_experiment_source: params.source
    })
    .eq("id", params.sessionId)
    .eq(owner.column, owner.value)
    .is("agent_version_experiment_variant", null), {
      allowCircuitBypass: params.allowCircuitBypass,
      budget: params.budget
    });
  } catch (error) {
    console.warn("[socialmedia agent version experiment] session lock write timed out", {
      sessionId: params.sessionId,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
  const { error } = response;
  if (error) {
    console.warn("[socialmedia agent version experiment] failed to persist session lock", {
      sessionId: params.sessionId,
      error: error.message
    });
    return null;
  }
  const raced = await readSessionAssignment(
    params.sessionId,
    params.user,
    admin,
    params.allowCircuitBypass,
    params.budget
  );
  return raced.readFailed ? null : normalizeSessionAssignment(raced.row);
}

async function resolveV1Fallback(params: {
  sessionId: string;
  user: AppUser;
  experiment?: ActiveExperiment | null;
  source: string;
  admin: Pick<SupabaseClient, "from">;
  allowCircuitBypass?: boolean;
  budget: ExperimentDbBudget;
}): Promise<SocialmediaAgentVersionExperimentAssignment> {
  let fallbackLock: SessionAssignment | null = null;
  try {
    fallbackLock = await persistSessionAssignment({
      sessionId: params.sessionId,
      user: params.user,
      experimentId: params.experiment?.experimentId,
      variant: "agent_v1",
      source: params.source,
      allowCircuitBypass: params.allowCircuitBypass,
      budget: params.budget
    }, params.admin);
  } catch (error) {
    console.warn("[socialmedia agent version experiment] failed to persist V1 fallback lock", {
      sessionId: params.sessionId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
  return result({
    variant: "agent_v1",
    source: params.source,
    persisted: fallbackLock?.variant === "agent_v1",
    sessionLocked: Boolean(fallbackLock),
    experimentId: fallbackLock?.experimentId ?? params.experiment?.experimentId,
    active: false,
    emergencyRollback: fallbackLock?.variant === "agent_v2"
  });
}

export function createSocialmediaAgentVersionV1Fallback(
  source = "unexpected_error_fallback"
): SocialmediaAgentVersionExperimentAssignment {
  return result({ variant: "agent_v1", source });
}

async function resolveActorAssignment(params: {
  user: AppUser;
  experiment: ActiveExperiment;
  budget: ExperimentDbBudget;
}, admin: Pick<SupabaseClient, "from"> = getSupabaseAdminClient()): Promise<{
  variant: SocialmediaAgentVersionExperimentVariant;
  source: string;
  persisted: boolean;
}> {
  const { userId, anonymousId } = actorIdentity(params.user);
  if (!userId && !anonymousId) {
    return { variant: pickWeightedVariant(params.experiment.variants), source: "random", persisted: false };
  }
  const scopedAssignment = () => {
    const query = admin.from("experiment_assignments").select("variant, source");
    return userId ? query.eq("user_id", userId) : query.eq("anonymous_id", anonymousId);
  };
  const { data: existing, error: existingError } = await runExperimentDbOperation(
    "read actor assignment",
    scopedAssignment()
      .eq("experiment_id", params.experiment.experimentId!)
      .maybeSingle(),
    { budget: params.budget }
  );
  if (!existingError && existing?.variant) {
    return {
      variant: normalizeSocialmediaAgentVersionExperimentVariant(existing.variant),
      source: existing.source || "existing",
      persisted: true
    };
  }
  if (existingError) {
    console.warn("[socialmedia agent version experiment] failed to read actor assignment", {
      actorId: params.user.id,
      error: existingError.message
    });
    throw new Error("SOCIALMEDIA_AGENT_VERSION_ASSIGNMENT_READ_FAILED");
  }

  const variant = pickWeightedVariant(params.experiment.variants);
  const { error: insertError } = await runExperimentDbOperation(
    "persist actor assignment",
    admin.from("experiment_assignments").insert({
      user_id: userId,
      anonymous_id: anonymousId,
      experiment_id: params.experiment.experimentId,
      experiment_key: SOCIALMEDIA_AGENT_VERSION_EXPERIMENT_KEY,
      variant,
      source: "random"
    }),
    { budget: params.budget }
  );
  if (!insertError) return { variant, source: "random", persisted: true };

  const { data: raced, error: raceError } = await runExperimentDbOperation(
    "verify actor assignment",
    scopedAssignment()
      .eq("experiment_id", params.experiment.experimentId!)
      .maybeSingle(),
    { budget: params.budget }
  );
  if (raceError) {
    console.warn("[socialmedia agent version experiment] failed to verify concurrent actor assignment", {
      actorId: params.user.id,
      error: raceError.message
    });
    throw new Error("SOCIALMEDIA_AGENT_VERSION_ASSIGNMENT_RACE_READ_FAILED");
  }
  if (raced?.variant) {
    return {
      variant: normalizeSocialmediaAgentVersionExperimentVariant(raced.variant),
      source: raced.source || "existing",
      persisted: true
    };
  }
  console.warn("[socialmedia agent version experiment] failed to persist actor assignment", {
    actorId: params.user.id,
    error: insertError.message
  });
  throw new Error("SOCIALMEDIA_AGENT_VERSION_ASSIGNMENT_WRITE_FAILED");
}

/**
 * Resolve the Frontdesk generation for one Agent session. Actor assignment is
 * durable across sessions, while the copied session assignment freezes a
 * conversation against later weight changes. Setting agent_v2 weight to zero
 * rolls back random V2 traffic, while an explicit database assignment with a
 * manual override source remains on V2 for controlled verification.
 * Experiment/config/persistence failures always return an effective V1 result
 * so the experiment cannot make the core conversation flow unavailable.
 */
export async function resolveSocialmediaAgentVersionExperimentAssignment(params: {
  user: AppUser;
  sessionId: string;
  forceV1?: boolean;
  /** New Agent traffic uses the V3 stack; V1/V2 assignment code remains for rollback/reference only. */
  forceV3Stack?: boolean;
  fallbackSource?: string;
}, dependencies: AssignmentDependencies = {}): Promise<SocialmediaAgentVersionExperimentAssignment> {
  if (params.forceV3Stack) {
    return result({ variant: "agent_v2", source: "agent_v3_stack", active: false });
  }
  const sessionId = params.sessionId.trim();
  const configuredMode = (process.env.SOCIALMEDIA_AGENT_FRONTDESK_VERSION ?? "v2").trim().toLowerCase();
  const mode = process.env.NODE_ENV === "production" ? "experiment" : configuredMode;
  if (mode === "v2") return result({ variant: "agent_v2", source: "environment", active: false });
  if (mode !== "experiment") return result({ variant: "agent_v1", source: "environment", active: false });

  const budget = createExperimentDbBudget();
  const hasInjectedExperiment = Object.prototype.hasOwnProperty.call(dependencies, "experiment");
  const experiment = hasInjectedExperiment
    ? dependencies.experiment ?? null
    : await readActiveExperiment(budget);
  const defaultVariant = experiment?.defaultVariant ?? DEFAULT_SOCIALMEDIA_AGENT_VERSION_EXPERIMENT_VARIANT;
  const adminEnabled = dependencies.adminEnabled ?? supabaseConfig.adminEnabled;
  const forcedSession = forcedSessionIds().has(sessionId);
  if (!adminEnabled || params.user.authMode === "local-dev" || params.user.authMode === "api-key") {
    return forcedSession
      ? result({ variant: "agent_v2", source: "forced_session", active: Boolean(experiment?.active) })
      : result({ variant: "agent_v1", source: "fallback", active: Boolean(experiment?.active) });
  }
  const admin = dependencies.admin ?? getSupabaseAdminClient();

  const sessionRead = await readSessionAssignment(sessionId, params.user, admin, false, budget);
  if (sessionRead.readFailed) {
    return resolveV1Fallback({
      sessionId,
      user: params.user,
      experiment,
      source: "session_read_error_fallback",
      admin,
      budget
    });
  }
  const locked = normalizeSessionAssignment(sessionRead.row);
  if (params.forceV1) {
    return resolveV1Fallback({
      sessionId,
      user: params.user,
      experiment,
      source: params.fallbackSource ?? "request_error_fallback",
      admin,
      budget
    });
  }
  if (experiment?.readFailed) {
    return resolveV1Fallback({
      sessionId,
      user: params.user,
      experiment,
      source: "experiment_read_error_fallback",
      admin,
      budget
    });
  }
  if (forcedSession) {
    if (locked) {
      return result({
        variant: "agent_v2",
        source: "forced_session",
        persisted: true,
        sessionLocked: true,
        experimentId: locked.experimentId,
        active: Boolean(experiment?.active && locked.experimentId === experiment.experimentId)
      });
    }
    const forcedLock = await persistSessionAssignment({
      sessionId,
      user: params.user,
      experimentId: experiment?.experimentId,
      variant: "agent_v2",
      source: "forced_session",
      budget
    }, admin);
    return forcedLock
      ? result({
          variant: "agent_v2",
          source: "forced_session",
          persisted: true,
          sessionLocked: true,
          experimentId: forcedLock.experimentId ?? experiment?.experimentId,
          active: Boolean(experiment?.active)
        })
      : resolveV1Fallback({
          sessionId,
          user: params.user,
          experiment,
          source: "forced_session_lock_error_fallback",
          admin,
          budget
        });
  }
  if (locked) {
    if (
      experiment?.active
      && shouldEmergencyRollbackV2(locked, experiment)
    ) {
      return result({
        variant: "agent_v1",
        source: "emergency_default",
        persisted: true,
        sessionLocked: true,
        experimentId: locked.experimentId,
        active: locked.experimentId === experiment.experimentId,
        emergencyRollback: true
      });
    }
    return result({
      variant: locked.variant,
      source: locked.source,
      persisted: true,
      sessionLocked: true,
      experimentId: locked.experimentId,
      active: Boolean(experiment?.active && locked.experimentId === experiment.experimentId)
    });
  }

  if (!experiment?.active || !experiment.experimentId) {
    const defaultLock = await persistSessionAssignment({
      sessionId,
      user: params.user,
      experimentId: experiment?.experimentId,
      variant: defaultVariant,
      source: "default",
      budget
    }, admin);
    return defaultLock
      ? result({
          variant: defaultLock.variant,
          source: defaultLock.source,
          persisted: true,
          sessionLocked: true,
          experimentId: defaultLock.experimentId,
          active: false
        })
      : resolveV1Fallback({
          sessionId,
          user: params.user,
          experiment,
          source: "default_lock_error_fallback",
          admin,
          budget
        });
  }

  let actor: Awaited<ReturnType<typeof resolveActorAssignment>>;
  try {
    actor = await resolveActorAssignment({ user: params.user, experiment, budget }, admin);
  } catch (error) {
    console.warn("[socialmedia agent version experiment] using V1 after actor assignment failure", {
      actorId: params.user.id,
      error: error instanceof Error ? error.message : String(error)
    });
    return resolveV1Fallback({
      sessionId,
      user: params.user,
      experiment,
      source: "actor_assignment_error_fallback",
      admin,
      // The actor read itself failed, but the Session table may still be
      // healthy. Make one bounded attempt to freeze this conversation on V1.
      allowCircuitBypass: true,
      budget
    });
  }
  const sessionAssignment = await persistSessionAssignment({
    sessionId,
    user: params.user,
    experimentId: experiment.experimentId,
    variant: actor.variant,
    source: actor.source,
    budget
  }, admin);
  if (!sessionAssignment) {
    return resolveV1Fallback({
      sessionId,
      user: params.user,
      experiment,
      source: "session_lock_error_fallback",
      admin,
      budget
    });
  }
  const lockedVariant = sessionAssignment.variant;
  const emergencyRollback = shouldEmergencyRollbackV2(sessionAssignment, experiment);
  return result({
    variant: emergencyRollback ? "agent_v1" : lockedVariant,
    source: emergencyRollback ? "emergency_default" : sessionAssignment.source,
    persisted: actor.persisted,
    sessionLocked: true,
    experimentId: sessionAssignment.experimentId ?? experiment.experimentId,
    active: sessionAssignment.experimentId === experiment.experimentId,
    emergencyRollback
  });
}

export async function migrateAnonymousSocialmediaAgentVersionExperimentAssignmentToUser(params: {
  anonymousId: string;
  userId: string;
}): Promise<{ migrated: boolean; variant?: SocialmediaAgentVersionExperimentVariant }> {
  const anonymousId = params.anonymousId.trim();
  const userId = params.userId.trim();
  if (!supabaseConfig.adminEnabled || !anonymousId || !UUID_PATTERN.test(userId)) {
    return { migrated: false };
  }
  const budget = createExperimentDbBudget();
  const experiment = await readActiveExperiment(budget);
  if (experiment?.readFailed) throw new Error("SOCIALMEDIA_AGENT_VERSION_EXPERIMENT_READ_FAILED");
  if (!experiment?.active || !experiment.experimentId) return { migrated: false };
  return migrateAnonymousSocialmediaAgentVersionExperimentAssignmentWithClient({
    ...params,
    admin: getSupabaseAdminClient(),
    experimentId: experiment.experimentId,
    variants: experiment.variants
  }, budget);
}

export async function migrateAnonymousSocialmediaAgentVersionExperimentAssignmentWithClient(params: {
  anonymousId: string;
  userId: string;
  admin: Pick<SupabaseClient, "from">;
  experimentId: string;
  variants: WeightedVariant[];
}, budget: ExperimentDbBudget = createExperimentDbBudget()): Promise<{
  migrated: boolean;
  variant?: SocialmediaAgentVersionExperimentVariant;
}> {
  const anonymousId = params.anonymousId.trim();
  const userId = params.userId.trim();
  const experimentId = params.experimentId.trim();
  if (!anonymousId || !UUID_PATTERN.test(userId) || !experimentId) return { migrated: false };

  const { data: guestAssignment, error: guestError } = await runExperimentDbOperation(
    "read guest actor assignment",
    params.admin
      .from("experiment_assignments")
      .select("variant, source, assigned_at")
      .eq("experiment_id", experimentId)
      .eq("anonymous_id", anonymousId)
      .maybeSingle(),
    { budget }
  );
  if (guestError) throw new Error("SOCIALMEDIA_AGENT_VERSION_GUEST_ASSIGNMENT_READ_FAILED");
  if (!guestAssignment?.variant) return { migrated: false };
  const variant = normalizeSocialmediaAgentVersionExperimentVariant(String(guestAssignment.variant));
  if (!isVariantInExperiment(variant, params.variants)) return { migrated: false };
  const guestSource = typeof guestAssignment.source === "string" ? guestAssignment.source : "";
  const claimedSource = isManualV2Override({ variant, source: guestSource })
    ? guestSource
    : "guest_claim";

  const userAssignmentQuery = () => params.admin
    .from("experiment_assignments")
    .select("variant, experiment_id")
    .eq("user_id", userId)
    .eq("experiment_key", SOCIALMEDIA_AGENT_VERSION_EXPERIMENT_KEY)
    .order("assigned_at", { ascending: false })
    .limit(1);
  const { data: existingUser, error: userError } = await runExperimentDbOperation(
    "read claimed user assignment",
    userAssignmentQuery().maybeSingle(),
    { budget }
  );
  if (userError) throw new Error("SOCIALMEDIA_AGENT_VERSION_USER_ASSIGNMENT_READ_FAILED");
  if (existingUser?.variant) {
    const existingVariant = normalizeSocialmediaAgentVersionExperimentVariant(String(existingUser.variant));
    return existingUser.experiment_id === experimentId && isVariantInExperiment(existingVariant, params.variants)
      ? { migrated: false, variant: existingVariant }
      : { migrated: false };
  }

  const now = new Date().toISOString();
  const { error: insertError } = await runExperimentDbOperation(
    "persist claimed user assignment",
    params.admin.from("experiment_assignments").insert({
      user_id: userId,
      experiment_id: experimentId,
      experiment_key: SOCIALMEDIA_AGENT_VERSION_EXPERIMENT_KEY,
      variant,
      source: claimedSource,
      assigned_at: typeof guestAssignment.assigned_at === "string" ? guestAssignment.assigned_at : now,
      updated_at: now
    }),
    { budget }
  );
  if (!insertError) return { migrated: true, variant };

  const { data: raced, error: raceError } = await runExperimentDbOperation(
    "verify claimed user assignment",
    userAssignmentQuery().maybeSingle(),
    { budget }
  );
  if (raceError) throw new Error("SOCIALMEDIA_AGENT_VERSION_ASSIGNMENT_RACE_READ_FAILED");
  if (raced?.variant) return { migrated: false };
  throw new Error("SOCIALMEDIA_AGENT_VERSION_ASSIGNMENT_WRITE_FAILED");
}

export function toFrontdeskAgentVariant(
  variant: SocialmediaAgentVersionExperimentVariant
): "legacy" | "v2" {
  return variant === "agent_v2" ? "v2" : "legacy";
}

export function resetSocialmediaAgentVersionExperimentCacheForTest(): void {
  activeExperimentCache = null;
  experimentDbCircuitOpenUntil = 0;
  experimentDbTimeoutMs = DEFAULT_EXPERIMENT_DB_TIMEOUT_MS;
  experimentDbFailureBackoffMs = DEFAULT_EXPERIMENT_DB_FAILURE_BACKOFF_MS;
}

export function configureSocialmediaAgentVersionExperimentTimingForTest(params: {
  timeoutMs: number;
  failureBackoffMs: number;
}): void {
  experimentDbTimeoutMs = Math.max(1, Math.floor(params.timeoutMs));
  experimentDbFailureBackoffMs = Math.max(1, Math.floor(params.failureBackoffMs));
}
