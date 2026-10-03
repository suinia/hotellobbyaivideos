import type { AppUser } from "@/lib/auth/app-user";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appConfig } from "@/lib/config";
import { resolveGeneratorUseCaseContext } from "@/lib/use-cases/generator-context";
import {
  DEFAULT_SOCIALMEDIA_INPUT_MODE_EXPERIMENT_VARIANT,
  isSocialmediaAgentV4ExperimentSourceUseCase,
  SOCIALMEDIA_INPUT_MODE_EXPERIMENT_COOKIE,
  SOCIALMEDIA_INPUT_MODE_EXPERIMENT_KEY,
  normalizeSocialmediaInputModeExperimentVariant,
  parseSocialmediaInputModeExperimentVariant,
  type SocialmediaInputModeExperimentVariant
} from "@/lib/socialmedia/input-mode-experiment";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseConfig } from "@/lib/supabase/config";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2;
const ACTIVE_EXPERIMENT_CACHE_TTL_MS = 60_000;
const MANUAL_ASSIGNMENT_SOURCES = new Set([
  "manual",
  "manual_override",
  "manual_test_override"
]);

type ExperimentConfigRow = { default_variant?: unknown; active_experiment_id?: unknown };
type ExperimentRow = { experiment_key?: unknown; status?: unknown; starts_at?: unknown; ends_at?: unknown };
type ExperimentVariantRow = { variant?: unknown; weight?: unknown };

type ActiveExperiment = {
  defaultVariant: SocialmediaInputModeExperimentVariant;
  experimentId?: string;
  active: boolean;
  variants: ExperimentVariantRow[];
  readFailed?: boolean;
};

export type SocialmediaInputModeExperimentAssignment = {
  key: string;
  variant: SocialmediaInputModeExperimentVariant;
  source: string;
  persisted: boolean;
  shouldSetCookie: boolean;
  experimentId?: string;
  active: boolean;
};

export type EffectiveSocialmediaInputMode = {
  inputMode: "pipeline" | "agent";
  imageBuilderRuntime?: "v3" | "v4";
  /** Retired experiment with V4 as default; scoped to image workbenches below. */
  ignoreLegacyPipelineOverride?: boolean;
  experiment?: SocialmediaInputModeExperimentAssignment;
};

export function resolveSocialmediaInputModeExperimentExecution(
  variant: SocialmediaInputModeExperimentVariant
): Pick<EffectiveSocialmediaInputMode, "inputMode" | "imageBuilderRuntime"> {
  if (variant === "agent_v4") {
    return { inputMode: "agent", imageBuilderRuntime: "v4" };
  }
  if (variant === "agent") {
    return { inputMode: "agent", imageBuilderRuntime: "v3" };
  }
  return { inputMode: "pipeline" };
}

export function applySocialmediaSessionInputModeOverride(
  inputMode: "pipeline" | "agent",
  inputModeOverride?: "pipeline" | "agent",
  ignoreLegacyPipelineOverride = false
): "pipeline" | "agent" {
  if (inputMode === "agent" && ignoreLegacyPipelineOverride && inputModeOverride === "pipeline") return "agent";
  return inputModeOverride ?? inputMode;
}

export function resolveSocialmediaInputModeForSource(
  mode: EffectiveSocialmediaInputMode,
  sourceUseCase?: string
): EffectiveSocialmediaInputMode {
  const executionSource = mode.ignoreLegacyPipelineOverride
    ? resolveGeneratorUseCaseContext(sourceUseCase).sourceUseCase
    : sourceUseCase;
  if (mode.imageBuilderRuntime !== "v4" || isSocialmediaAgentV4ExperimentSourceUseCase(executionSource)) return mode;
  // Retiring the image experiment must not activate a different video pipeline.
  if (mode.ignoreLegacyPipelineOverride) {
    return { ...mode, inputMode: "pipeline", imageBuilderRuntime: undefined, ignoreLegacyPipelineOverride: false };
  }
  return { ...mode, imageBuilderRuntime: "v3" };
}

let activeExperimentCache: { expiresAt: number; value: ActiveExperiment | null } | null = null;

function parseCookieHeader(cookieHeader?: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const item of (cookieHeader ?? "").split(";")) {
    const separatorIndex = item.indexOf("=");
    if (separatorIndex < 0) continue;
    const key = item.slice(0, separatorIndex).trim();
    if (key) cookies[key] = decodeURIComponent(item.slice(separatorIndex + 1).trim());
  }
  return cookies;
}

function readCookieVariant(cookieHeader?: string | null): SocialmediaInputModeExperimentVariant | null {
  const value = parseCookieHeader(cookieHeader)[SOCIALMEDIA_INPUT_MODE_EXPERIMENT_COOKIE];
  return value ? normalizeSocialmediaInputModeExperimentVariant(value) : null;
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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function pickWeightedVariant(rows: ExperimentVariantRow[]): SocialmediaInputModeExperimentVariant {
  const entries = rows
    .map((row) => {
      const variant = parseSocialmediaInputModeExperimentVariant(
        typeof row.variant === "string" ? row.variant : null
      );
      const weight = Math.max(0, Number(row.weight ?? 0));
      return variant && Number.isFinite(weight) && weight > 0 ? { variant, weight } : null;
    })
    .filter((item): item is { variant: SocialmediaInputModeExperimentVariant; weight: number } => Boolean(item));
  if (!entries.length) return DEFAULT_SOCIALMEDIA_INPUT_MODE_EXPERIMENT_VARIANT;

  let cursor = Math.random() * entries.reduce((sum, item) => sum + item.weight, 0);
  for (const item of entries) {
    cursor -= item.weight;
    if (cursor <= 0) return item.variant;
  }
  return entries[0]?.variant ?? DEFAULT_SOCIALMEDIA_INPUT_MODE_EXPERIMENT_VARIANT;
}

export function canExecuteSocialmediaInputModeExperimentAssignment(params: {
  variant: SocialmediaInputModeExperimentVariant;
  source?: unknown;
  activeVariants: ReadonlyArray<{ variant?: unknown; weight?: unknown }>;
}): boolean {
  const activeVariant = params.activeVariants.find((row) => (
    parseSocialmediaInputModeExperimentVariant(typeof row.variant === "string" ? row.variant : null)
      === params.variant
  ));
  if (!activeVariant) return false;

  const source = typeof params.source === "string"
    ? params.source.trim().toLowerCase()
    : "";
  if (MANUAL_ASSIGNMENT_SOURCES.has(source)) return true;

  return activeVariant.weight === undefined
    || (Number.isFinite(Number(activeVariant.weight)) && Number(activeVariant.weight) > 0);
}

function assignment(params: {
  variant?: string | null;
  source: string;
  persisted?: boolean;
  cookieHeader?: string | null;
  experimentId?: string;
  active?: boolean;
}): SocialmediaInputModeExperimentAssignment {
  const variant = normalizeSocialmediaInputModeExperimentVariant(params.variant);
  return {
    key: SOCIALMEDIA_INPUT_MODE_EXPERIMENT_KEY,
    variant,
    source: params.source,
    persisted: params.persisted ?? false,
    shouldSetCookie: readCookieVariant(params.cookieHeader) !== variant,
    experimentId: params.experimentId,
    active: params.active ?? false
  };
}

function cacheActiveExperiment(value: ActiveExperiment | null): ActiveExperiment | null {
  activeExperimentCache = { expiresAt: Date.now() + ACTIVE_EXPERIMENT_CACHE_TTL_MS, value };
  return value;
}

async function readActiveExperiment(): Promise<ActiveExperiment | null> {
  if (!supabaseConfig.adminEnabled) return null;
  if (activeExperimentCache && activeExperimentCache.expiresAt > Date.now()) return activeExperimentCache.value;

  const admin = getSupabaseAdminClient();
  const { data: config, error: configError } = await admin
    .from("experiment_configs")
    .select("default_variant, active_experiment_id")
    .eq("experiment_key", SOCIALMEDIA_INPUT_MODE_EXPERIMENT_KEY)
    .maybeSingle();
  if (configError) {
    console.warn("[socialmedia input mode experiment] failed to read experiment config", { error: configError.message });
    return cacheActiveExperiment({
      defaultVariant: DEFAULT_SOCIALMEDIA_INPUT_MODE_EXPERIMENT_VARIANT,
      active: false,
      variants: [],
      readFailed: true
    });
  }

  const configRow = (config ?? {}) as ExperimentConfigRow;
  const defaultVariant = normalizeSocialmediaInputModeExperimentVariant(
    typeof configRow.default_variant === "string"
      ? configRow.default_variant
      : DEFAULT_SOCIALMEDIA_INPUT_MODE_EXPERIMENT_VARIANT
  );
  const experimentId = typeof configRow.active_experiment_id === "string" ? configRow.active_experiment_id : undefined;
  if (!experimentId) return cacheActiveExperiment({ defaultVariant, active: false, variants: [] });

  const { data: experiment, error: experimentError } = await admin
    .from("experiments")
    .select("experiment_key, status, starts_at, ends_at")
    .eq("id", experimentId)
    .maybeSingle();
  if (experimentError) {
    console.warn("[socialmedia input mode experiment] failed to read active experiment", { experimentId, error: experimentError.message });
    return cacheActiveExperiment({ defaultVariant, experimentId, active: false, variants: [], readFailed: true });
  }

  const experimentRow = (experiment ?? {}) as ExperimentRow;
  const active = experimentRow.experiment_key === SOCIALMEDIA_INPUT_MODE_EXPERIMENT_KEY && isExperimentActive(experimentRow);
  if (!active) return cacheActiveExperiment({ defaultVariant, experimentId, active: false, variants: [] });

  const { data: variants, error: variantsError } = await admin
    .from("experiment_variants")
    .select("variant, weight")
    .eq("experiment_id", experimentId)
    .eq("enabled", true);
  if (variantsError) {
    console.warn("[socialmedia input mode experiment] failed to read experiment variants", { experimentId, error: variantsError.message });
    return cacheActiveExperiment({ defaultVariant, experimentId, active: false, variants: [], readFailed: true });
  }
  return cacheActiveExperiment({ defaultVariant, experimentId, active: true, variants: (variants ?? []) as ExperimentVariantRow[] });
}

export async function resolveSocialmediaInputModeExperimentAssignment(params: {
  user: AppUser;
  cookieHeader?: string | null;
  requestedVariant?: string | null;
}): Promise<SocialmediaInputModeExperimentAssignment> {
  const requestedVariant = params.requestedVariant?.trim()
    ? normalizeSocialmediaInputModeExperimentVariant(params.requestedVariant)
    : null;
  const config = await readActiveExperiment();
  const defaultVariant = config?.defaultVariant ?? DEFAULT_SOCIALMEDIA_INPUT_MODE_EXPERIMENT_VARIANT;

  if (requestedVariant) return assignment({ variant: requestedVariant, source: "request", cookieHeader: params.cookieHeader, experimentId: config?.experimentId, active: Boolean(config?.active) });
  if (config?.readFailed) {
    return assignment({ variant: "pipeline", source: "unavailable", cookieHeader: params.cookieHeader, active: false });
  }
  if (!config?.active || !config.experimentId) {
    return assignment({ variant: defaultVariant, source: config ? "default" : "fallback", cookieHeader: params.cookieHeader, active: false });
  }
  if (!supabaseConfig.adminEnabled || params.user.authMode === "local-dev" || params.user.authMode === "api-key") {
    return assignment({ variant: defaultVariant, source: "fallback", cookieHeader: params.cookieHeader, experimentId: config.experimentId, active: true });
  }

  const userId = params.user.authMode === "supabase" && isUuid(params.user.id) ? params.user.id : undefined;
  const anonymousId = userId ? undefined : params.user.id.trim();
  if (!userId && !anonymousId) {
    return assignment({ variant: pickWeightedVariant(config.variants), source: "random", cookieHeader: params.cookieHeader, experimentId: config.experimentId, active: true });
  }

  const admin = getSupabaseAdminClient();
  const scopedAssignment = () => {
    const query = admin.from("experiment_assignments").select("variant, source");
    return userId ? query.eq("user_id", userId) : query.eq("anonymous_id", anonymousId);
  };
  const { data: existing, error: existingError } = await scopedAssignment()
    .eq("experiment_id", config.experimentId)
    .maybeSingle();
  if (!existingError && existing?.variant) {
    const existingVariant = parseSocialmediaInputModeExperimentVariant(existing.variant);
    if (existingVariant && canExecuteSocialmediaInputModeExperimentAssignment({
      variant: existingVariant,
      source: existing.source,
      activeVariants: config.variants
    })) {
      return assignment({ variant: existingVariant, source: existing.source || "existing", persisted: true, cookieHeader: params.cookieHeader, experimentId: config.experimentId, active: true });
    }
    // Zero random weight pauses non-manual traffic; disabling the variant pauses
    // every source. Keep the stored assignment for a possible re-enable, but
    // execute deterministic control instead of re-randomizing this actor.
    return assignment({
      variant: defaultVariant,
      source: "disabled_variant_fallback",
      cookieHeader: params.cookieHeader,
      experimentId: config.experimentId,
      active: true
    });
  }
  if (existingError) {
    console.warn("[socialmedia input mode experiment] failed to read assignment", { userId: params.user.id, error: existingError.message });
    return assignment({ variant: pickWeightedVariant(config.variants), source: "random", cookieHeader: params.cookieHeader, experimentId: config.experimentId, active: true });
  }

  const variant = pickWeightedVariant(config.variants);
  const { error: insertError } = await admin.from("experiment_assignments").insert({
    user_id: userId,
    anonymous_id: anonymousId,
    experiment_id: config.experimentId,
    experiment_key: SOCIALMEDIA_INPUT_MODE_EXPERIMENT_KEY,
    variant,
    source: "random"
  });
  if (!insertError) {
    return assignment({ variant, source: "random", persisted: true, cookieHeader: params.cookieHeader, experimentId: config.experimentId, active: true });
  }

  const { data: raced } = await scopedAssignment().eq("experiment_id", config.experimentId).maybeSingle();
  if (raced?.variant) {
    const racedVariant = parseSocialmediaInputModeExperimentVariant(raced.variant);
    if (racedVariant && canExecuteSocialmediaInputModeExperimentAssignment({
      variant: racedVariant,
      source: raced.source,
      activeVariants: config.variants
    })) {
      return assignment({ variant: racedVariant, source: raced.source || "existing", persisted: true, cookieHeader: params.cookieHeader, experimentId: config.experimentId, active: true });
    }
    return assignment({
      variant: defaultVariant,
      source: "disabled_variant_fallback",
      cookieHeader: params.cookieHeader,
      experimentId: config.experimentId,
      active: true
    });
  }
  console.warn("[socialmedia input mode experiment] failed to persist assignment", { userId: params.user.id, error: insertError.message });
  return assignment({ variant, source: "random", cookieHeader: params.cookieHeader, experimentId: config.experimentId, active: true });
}

export async function migrateAnonymousSocialmediaInputModeExperimentAssignmentToUser(params: {
  anonymousId: string;
  userId: string;
}): Promise<{ migrated: boolean; variant?: SocialmediaInputModeExperimentVariant }> {
  const anonymousId = params.anonymousId.trim();
  const userId = params.userId.trim();
  if (!supabaseConfig.adminEnabled || !anonymousId || !isUuid(userId)) return { migrated: false };

  const config = await readActiveExperiment();
  if (config?.readFailed) {
    throw new Error("SOCIALMEDIA_INPUT_MODE_EXPERIMENT_READ_FAILED");
  }
  if (!config?.active || !config.experimentId) return { migrated: false };

  return migrateAnonymousSocialmediaInputModeExperimentAssignmentWithClient({
    ...params,
    admin: getSupabaseAdminClient(),
    experimentId: config.experimentId,
    activeVariants: config.variants
  });
}

export async function migrateAnonymousSocialmediaInputModeExperimentAssignmentWithClient(params: {
  anonymousId: string;
  userId: string;
  admin: Pick<SupabaseClient, "from">;
  experimentId: string;
  activeVariants: ExperimentVariantRow[];
}): Promise<{ migrated: boolean; variant?: SocialmediaInputModeExperimentVariant }> {
  const anonymousId = params.anonymousId.trim();
  const userId = params.userId.trim();
  const experimentId = params.experimentId.trim();
  if (!anonymousId || !isUuid(userId) || !experimentId) return { migrated: false };

  const admin = params.admin;
  const { data: anonymousAssignment, error: anonymousAssignmentError } = await admin
    .from("experiment_assignments")
    .select("variant, source, assigned_at")
    .eq("experiment_id", experimentId)
    .eq("anonymous_id", anonymousId)
    .maybeSingle();
  if (anonymousAssignmentError) {
    console.warn("[socialmedia input mode experiment] failed to read guest assignment for claim", {
      anonymousId,
      userId,
      experimentId,
      error: anonymousAssignmentError.message
    });
    throw new Error("SOCIALMEDIA_INPUT_MODE_GUEST_ASSIGNMENT_READ_FAILED");
  }
  if (!anonymousAssignment?.variant) return { migrated: false };

  const variant = parseSocialmediaInputModeExperimentVariant(String(anonymousAssignment.variant));
  if (!variant || !canExecuteSocialmediaInputModeExperimentAssignment({
    variant,
    source: anonymousAssignment.source,
    activeVariants: params.activeVariants
  })) return { migrated: false };
  const anonymousSource = typeof anonymousAssignment.source === "string"
    ? anonymousAssignment.source
    : "";
  const claimedSource = MANUAL_ASSIGNMENT_SOURCES.has(anonymousSource.trim().toLowerCase())
    ? anonymousSource
    : "guest_claim";

  // An account's existing experiment history always wins over the guest device.
  const { data: existingUserAssignment, error: existingUserAssignmentError } = await admin
    .from("experiment_assignments")
    .select("variant, source, experiment_id")
    .eq("user_id", userId)
    .eq("experiment_key", SOCIALMEDIA_INPUT_MODE_EXPERIMENT_KEY)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingUserAssignmentError) {
    console.warn("[socialmedia input mode experiment] failed to read user assignment for claim", {
      anonymousId,
      userId,
      experimentId,
      error: existingUserAssignmentError.message
    });
    throw new Error("SOCIALMEDIA_INPUT_MODE_USER_ASSIGNMENT_READ_FAILED");
  }
  if (existingUserAssignment?.variant) {
    const existingVariant = parseSocialmediaInputModeExperimentVariant(String(existingUserAssignment.variant));
    return existingUserAssignment.experiment_id === experimentId
      && existingVariant
      && canExecuteSocialmediaInputModeExperimentAssignment({
        variant: existingVariant,
        source: existingUserAssignment.source,
        activeVariants: params.activeVariants
      })
      ? { migrated: false, variant: existingVariant }
      : { migrated: false };
  }

  const now = new Date().toISOString();
  const { error: insertError } = await admin.from("experiment_assignments").insert({
    user_id: userId,
    experiment_id: experimentId,
    experiment_key: SOCIALMEDIA_INPUT_MODE_EXPERIMENT_KEY,
    variant,
    source: claimedSource,
    assigned_at: typeof anonymousAssignment.assigned_at === "string" ? anonymousAssignment.assigned_at : now,
    updated_at: now
  });
  if (!insertError) return { migrated: true, variant };

  // Never overwrite an account assignment created concurrently with the claim.
  const { data: raced, error: raceReadError } = await admin
    .from("experiment_assignments")
    .select("variant")
    .eq("user_id", userId)
    .eq("experiment_key", SOCIALMEDIA_INPUT_MODE_EXPERIMENT_KEY)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (raceReadError) {
    console.warn("[socialmedia input mode experiment] failed to verify concurrent user assignment", {
      anonymousId,
      userId,
      experimentId,
      error: insertError.message,
      raceError: raceReadError.message
    });
    throw new Error("SOCIALMEDIA_INPUT_MODE_ASSIGNMENT_RACE_READ_FAILED");
  }
  if (raced) return { migrated: false };
  console.warn("[socialmedia input mode experiment] failed to persist claimed user assignment", {
    anonymousId,
    userId,
    experimentId,
    error: insertError.message
  });
  throw new Error("SOCIALMEDIA_INPUT_MODE_ASSIGNMENT_WRITE_FAILED");
}

export function buildSocialmediaInputModeExperimentCookie(variant: SocialmediaInputModeExperimentVariant): string {
  return [
    `${SOCIALMEDIA_INPUT_MODE_EXPERIMENT_COOKIE}=${encodeURIComponent(variant)}`,
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    "Secure"
  ].join("; ");
}

export async function resolveEffectiveSocialmediaInputMode(params: {
  user: AppUser;
  cookieHeader?: string | null;
}): Promise<EffectiveSocialmediaInputMode> {
  // Only the real Vercel production deployment uses the database rollout.
  // Preview builds also have NODE_ENV=production and must remain deterministic.
  if (process.env.VERCEL_ENV !== "production") {
    return { inputMode: appConfig.socialmedia.inputMode };
  }
  const experiment = await resolveSocialmediaInputModeExperimentAssignment(params);
  return {
    ...resolveSocialmediaInputModeExperimentExecution(experiment.variant),
    ...(!experiment.active && experiment.variant === "agent_v4"
      ? { ignoreLegacyPipelineOverride: true }
      : {}),
    experiment
  };
}
