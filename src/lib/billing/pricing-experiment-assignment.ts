import {
  DEFAULT_PRICING_VARIANT,
  PRICING_EXPERIMENT_COOKIE,
  PRICING_EXPERIMENT_KEY,
  SUPPORTED_PRICING_VARIANTS,
  normalizePricingVariant,
  type PricingVariant,
  type UserPlan
} from "@/lib/billing/catalog";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseConfig } from "@/lib/supabase/config";
import {
  getAuthoritativeActiveBillingSubscriptionBinding,
  isTransientBillingSubscriptionBindingError,
  type ActiveBillingSubscriptionBinding
} from "@/lib/billing/subscription-bindings";

type ExperimentConfigRow = {
  default_variant?: unknown;
  active_experiment_id?: unknown;
};

type ExperimentRow = {
  id?: unknown;
  experiment_key?: unknown;
  status?: unknown;
  starts_at?: unknown;
  ends_at?: unknown;
};

export type ExperimentVariantRow = {
  variant?: unknown;
  weight?: unknown;
};

export type ActivePricingExperiment = {
  defaultVariant: PricingVariant;
  experimentId?: string;
  active: boolean;
  variants: ExperimentVariantRow[];
  readFailed?: boolean;
};

export type PricingExperimentAssignment = {
  key: string;
  variant: PricingVariant;
  source: string;
  persisted: boolean;
  experimentId?: string;
  active?: boolean;
};

export type PricingExperimentAssignmentResolverDependencies = {
  readActiveExperiment?: () => Promise<ActivePricingExperiment | null>;
  readActiveSubscriptionBinding?: (userId: string) => Promise<ActiveBillingSubscriptionBinding | undefined>;
  getAdminClient?: () => SupabaseClient;
  adminEnabled?: boolean;
  persistUserAssignment?: (params: {
    userId: string;
    variant: PricingVariant | string;
    source: string;
  }) => Promise<boolean>;
};

const ACTIVE_PRICING_EXPERIMENT_CACHE_TTL_MS = 60_000;
let activePricingExperimentCache: {
  expiresAt: number;
  value: ActivePricingExperiment | null;
} | null = null;

function parseCookieHeader(cookieHeader?: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const item of (cookieHeader ?? "").split(";")) {
    const separatorIndex = item.indexOf("=");
    if (separatorIndex < 0) continue;
    const key = item.slice(0, separatorIndex).trim();
    const value = item.slice(separatorIndex + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      // Ignore a malformed cookie without making assignment resolution fail.
    }
  }
  return cookies;
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

function pricingAssignment(params: {
  variant?: PricingVariant | null;
  source: string;
  persisted?: boolean;
  experimentId?: string;
  active?: boolean;
}): PricingExperimentAssignment {
  return {
    key: PRICING_EXPERIMENT_KEY,
    variant: normalizePricingVariant(params.variant ?? DEFAULT_PRICING_VARIANT),
    source: params.source,
    persisted: params.persisted ?? false,
    experimentId: params.experimentId,
    active: params.active ?? false
  };
}

export function readPricingExperimentCookieVariant(cookieHeader?: string | null): PricingVariant | null {
  const cookieVariant = parseCookieHeader(cookieHeader)[PRICING_EXPERIMENT_COOKIE];
  return parsePersistedPricingVariant(cookieVariant);
}

function pickWeightedVariant(
  rows: ExperimentVariantRow[],
  fallbackVariant: PricingVariant = DEFAULT_PRICING_VARIANT
): PricingVariant {
  const entries = rows
    .map((row) => {
      const variant = parsePersistedPricingVariant(row.variant);
      const weight = Math.max(0, Number(row.weight ?? 0));
      return variant && Number.isFinite(weight) && weight > 0 ? { variant, weight } : null;
    })
    .filter((item): item is { variant: PricingVariant; weight: number } => Boolean(item));

  if (!entries.length) {
    return variantInActiveExperiment(fallbackVariant, rows)
      ? fallbackVariant
      : rows
        .map((row) => parsePersistedPricingVariant(row.variant))
        .find((variant): variant is PricingVariant => Boolean(variant))
        ?? fallbackVariant;
  }

  const total = entries.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return fallbackVariant;

  let cursor = Math.random() * total;
  for (const item of entries) {
    cursor -= item.weight;
    if (cursor <= 0) return item.variant;
  }

  return entries[0]?.variant ?? fallbackVariant;
}

function cacheActivePricingExperiment(value: ActivePricingExperiment | null): ActivePricingExperiment | null {
  activePricingExperimentCache = {
    expiresAt: Date.now() + ACTIVE_PRICING_EXPERIMENT_CACHE_TTL_MS,
    value
  };
  return value;
}

async function readActivePricingExperiment(): Promise<ActivePricingExperiment | null> {
  if (!supabaseConfig.adminEnabled) return null;

  if (activePricingExperimentCache && activePricingExperimentCache.expiresAt > Date.now()) {
    return activePricingExperimentCache.value;
  }

  const admin = getSupabaseAdminClient();
  const { data: config, error: configError } = await admin
    .from("experiment_configs")
    .select("default_variant, active_experiment_id")
    .eq("experiment_key", PRICING_EXPERIMENT_KEY)
    .maybeSingle();

  if (configError) {
    console.warn("[pricing experiment] failed to read experiment config", {
      key: PRICING_EXPERIMENT_KEY,
      error: configError.message
    });
    return cacheActivePricingExperiment({
      defaultVariant: DEFAULT_PRICING_VARIANT,
      active: false,
      variants: [],
      readFailed: true
    });
  }

  const configRow = (config ?? {}) as ExperimentConfigRow;
  const defaultVariant = parsePersistedPricingVariant(configRow.default_variant) ?? DEFAULT_PRICING_VARIANT;
  const experimentId = typeof configRow.active_experiment_id === "string"
    ? configRow.active_experiment_id
    : undefined;

  if (!experimentId) {
    return cacheActivePricingExperiment({
      defaultVariant,
      active: false,
      variants: []
    });
  }

  const { data: experiment, error: experimentError } = await admin
    .from("experiments")
    .select("id, experiment_key, status, starts_at, ends_at")
    .eq("id", experimentId)
    .maybeSingle();

  if (experimentError) {
    console.warn("[pricing experiment] failed to read active experiment", {
      key: PRICING_EXPERIMENT_KEY,
      experimentId,
      error: experimentError.message
    });
    return cacheActivePricingExperiment({
      defaultVariant,
      active: false,
      variants: [],
      readFailed: true
    });
  }

  const experimentRow = (experiment ?? {}) as ExperimentRow;
  const active = experimentRow.experiment_key === PRICING_EXPERIMENT_KEY && isExperimentActive(experimentRow);
  if (!active) {
    return cacheActivePricingExperiment({
      defaultVariant,
      experimentId,
      active: false,
      variants: []
    });
  }

  const { data: variants, error: variantsError } = await admin
    .from("experiment_variants")
    .select("variant, weight")
    .eq("experiment_id", experimentId)
    .eq("enabled", true);

  if (variantsError) {
    console.warn("[pricing experiment] failed to read experiment variants", {
      key: PRICING_EXPERIMENT_KEY,
      experimentId,
      error: variantsError.message
    });
    return cacheActivePricingExperiment({
      defaultVariant,
      experimentId,
      active: false,
      variants: [],
      readFailed: true
    });
  }

  const activeVariants = ((variants ?? []) as ExperimentVariantRow[])
    .filter((row) => parsePersistedPricingVariant(row.variant));
  if (!activeVariants.length) {
    console.warn("[pricing experiment] active experiment has no supported enabled variants", {
      key: PRICING_EXPERIMENT_KEY,
      experimentId
    });
    return cacheActivePricingExperiment({
      defaultVariant,
      experimentId,
      active: false,
      variants: [],
      readFailed: true
    });
  }

  return cacheActivePricingExperiment({
    defaultVariant,
    experimentId,
    active: true,
    variants: activeVariants
  });
}

export function parsePersistedPricingVariant(value: unknown): PricingVariant | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim().toUpperCase();
  if (SUPPORTED_PRICING_VARIANTS.includes(normalized as PricingVariant)) {
    return normalized as PricingVariant;
  }
  return normalized === "A" || normalized === "B" || normalized === "C"
    ? normalizePricingVariant(normalized)
    : null;
}

function variantInActiveExperiment(variant: PricingVariant, variants: ExperimentVariantRow[]): boolean {
  return variants.some((row) => parsePersistedPricingVariant(row.variant) === variant);
}

export function resolveActiveSubscriptionPricingVariant(
  subscriptionPricingVariant: string | null | undefined,
  activeVariants: Array<{ variant?: unknown }>
): PricingVariant | null {
  const pricingVariant = parsePersistedPricingVariant(subscriptionPricingVariant);
  if (!pricingVariant) return null;

  return variantInActiveExperiment(pricingVariant, activeVariants)
    ? pricingVariant
    : null;
}

export function resolveCarriedPricingVariant(
  previousVariant: string | null | undefined,
  activeVariants: Array<{ variant?: unknown }>
): PricingVariant | null {
  const variant = parsePersistedPricingVariant(previousVariant);
  if (!variant) return null;
  return variantInActiveExperiment(variant, activeVariants) ? variant : null;
}

export function resolveNewPricingExperimentAssignment(
  previousVariant: string | null | undefined,
  activeVariants: ExperimentVariantRow[],
  defaultVariant: PricingVariant = DEFAULT_PRICING_VARIANT
): { variant: PricingVariant; source: "carry_forward" | "random" } {
  const carriedVariant = resolveCarriedPricingVariant(previousVariant, activeVariants);
  return carriedVariant
    ? { variant: carriedVariant, source: "carry_forward" }
    : { variant: pickWeightedVariant(activeVariants, defaultVariant), source: "random" };
}

export function resolvePricingHistoryReadFallback(params: {
  cookieVariant?: string | null;
  defaultVariant: PricingVariant;
  activeVariants: ExperimentVariantRow[];
}): PricingVariant {
  const cookieVariant = parsePersistedPricingVariant(params.cookieVariant);
  if (cookieVariant && variantInActiveExperiment(cookieVariant, params.activeVariants)) {
    return cookieVariant;
  }
  if (variantInActiveExperiment(params.defaultVariant, params.activeVariants)) {
    return params.defaultVariant;
  }
  return params.activeVariants
    .map((row) => parsePersistedPricingVariant(row.variant))
    .find((variant): variant is PricingVariant => Boolean(variant))
    ?? params.defaultVariant;
}

export function resolveUnpersistedPricingVariant(params: {
  candidateVariant: PricingVariant;
  candidateSource: "carry_forward" | "random";
  cookieVariant?: string | null;
  defaultVariant: PricingVariant;
  activeVariants: ExperimentVariantRow[];
}): PricingVariant {
  return params.candidateSource === "carry_forward"
    ? params.candidateVariant
    : resolvePricingHistoryReadFallback(params);
}

export async function readPreviousPricingExperimentVariant(params: {
  admin: SupabaseClient;
  actorColumn: "user_id" | "anonymous_id";
  actorId: string;
  currentExperimentId: string;
}): Promise<{ variant: string | null; error: string | null }> {
  const { data, error } = await params.admin
    .from("experiment_assignments")
    .select("variant")
    .eq("experiment_key", PRICING_EXPERIMENT_KEY)
    .eq(params.actorColumn, params.actorId)
    .or(`experiment_id.is.null,experiment_id.neq.${params.currentExperimentId}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    variant: typeof data?.variant === "string" ? data.variant : null,
    error: error?.message ?? null
  };
}

export async function insertPricingExperimentAssignment(params: {
  admin: SupabaseClient;
  userId?: string;
  anonymousId?: string;
  experimentId: string;
  variant: PricingVariant;
  source: "carry_forward" | "random";
}): Promise<string | null> {
  const { error } = await params.admin
    .from("experiment_assignments")
    .insert({
      user_id: params.userId,
      anonymous_id: params.anonymousId,
      experiment_id: params.experimentId,
      experiment_key: PRICING_EXPERIMENT_KEY,
      variant: params.variant,
      source: params.source
    });

  return error?.message ?? null;
}

/**
 * Reads a signed-in user's active assignment without creating one. This is
 * used while a guest-to-account claim is pending: an existing account keeps
 * its assignment, while a new account can still render the guest assignment
 * until the claim persists it.
 */
export async function readPersistedUserPricingExperimentAssignment(
  userId: string
): Promise<PricingExperimentAssignment | null> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId || !supabaseConfig.adminEnabled) return null;

  const config = await readActivePricingExperiment();
  if (!config?.active || !config.experimentId) return null;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("experiment_assignments")
    .select("variant, source")
    .eq("experiment_id", config.experimentId)
    .eq("user_id", normalizedUserId)
    .maybeSingle();

  if (error) {
    console.warn("[pricing experiment] failed to read persisted user assignment", {
      userId: normalizedUserId,
      experimentId: config.experimentId,
      error: error.message
    });
    return null;
  }
  if (!data?.variant) return null;

  const variant = parsePersistedPricingVariant(data.variant);
  if (!variant) return null;
  if (!variantInActiveExperiment(variant, config.variants)) return null;

  return pricingAssignment({
    variant,
    source: typeof data.source === "string" && data.source.trim() ? data.source : "assignment",
    persisted: true,
    experimentId: config.experimentId,
    active: true
  });
}

export async function resolveUserPricingExperimentAssignment(params: {
  userId?: string;
  anonymousId?: string;
  email?: string | null;
  cookieHeader?: string | null;
  requestedVariant?: string | null;
  currentPlan?: UserPlan | string | null;
}, dependencies: PricingExperimentAssignmentResolverDependencies = {}): Promise<PricingExperimentAssignment> {
  void params.email;

  const requestedVariant = parsePersistedPricingVariant(params.requestedVariant);
  const config = await (dependencies.readActiveExperiment ?? readActivePricingExperiment)();
  const defaultVariant = config?.defaultVariant ?? DEFAULT_PRICING_VARIANT;
  const adminEnabled = dependencies.adminEnabled ?? supabaseConfig.adminEnabled;
  const getAdminClient = dependencies.getAdminClient ?? getSupabaseAdminClient;
  const persistUserAssignment = dependencies.persistUserAssignment ?? persistUserPricingExperimentAssignment;

  if (!config?.active || !config.experimentId) {
    const fallbackVariant = !config || config.readFailed
      ? readPricingExperimentCookieVariant(params.cookieHeader) ?? defaultVariant
      : defaultVariant;
    return pricingAssignment({
      variant: fallbackVariant,
      source: config && !config.readFailed ? "default" : "fallback",
      active: false
    });
  }

  // An active subscription is the authority for pricing surfaces while its
  // purchased pricing variant remains enabled in the current experiment. This
  // prevents an existing subscriber from being re-randomized when a later
  // experiment starts. If that variant is not part of the active experiment,
  // normal assignment/randomization continues.
  if (params.userId && adminEnabled) {
    let subscriptionBinding: ActiveBillingSubscriptionBinding | undefined;
    try {
      subscriptionBinding = await (
        dependencies.readActiveSubscriptionBinding ?? getAuthoritativeActiveBillingSubscriptionBinding
      )(params.userId);
    } catch (error) {
      console.warn("[pricing experiment] failed to read authoritative active subscription binding", {
        userId: params.userId,
        experimentId: config.experimentId,
        error: error instanceof Error ? error.message : String(error)
      });

      // A persisted pin is a safe temporary fallback only when the current
      // binding could not be read. Integrity failures must remain visible and
      // must never be masked by an older assignment.
      if (!isTransientBillingSubscriptionBindingError(error)) {
        throw error;
      }

      const admin = getAdminClient();
      const { data: persistedPin, error: persistedPinError } = await admin
        .from("experiment_assignments")
        .select("variant, source")
        .eq("user_id", params.userId)
        .eq("experiment_id", config.experimentId)
        .maybeSingle();
      const persistedPinVariant = parsePersistedPricingVariant(persistedPin?.variant);
      if (
        !persistedPinError
        && persistedPin?.source === "active_subscription"
        && persistedPinVariant
        && variantInActiveExperiment(persistedPinVariant, config.variants)
      ) {
        return pricingAssignment({
          variant: persistedPinVariant,
          source: "active_subscription",
          persisted: true,
          experimentId: config.experimentId,
          active: true
        });
      }

      throw new Error("PRICING_SUBSCRIPTION_BINDING_READ_FAILED", { cause: error });
    }
    const subscriptionVariant = resolveActiveSubscriptionPricingVariant(
      subscriptionBinding?.pricingVariant,
      config.variants
    );

    if (subscriptionVariant) {
      const admin = getAdminClient();
      const { data: existingSubscriptionAssignment, error: existingSubscriptionAssignmentError } = await admin
        .from("experiment_assignments")
        .select("variant, source")
        .eq("user_id", params.userId)
        .eq("experiment_id", config.experimentId)
        .maybeSingle();
      if (existingSubscriptionAssignmentError) {
        console.warn("[pricing experiment] failed to read subscription-pinned assignment", {
          userId: params.userId,
          experimentId: config.experimentId,
          error: existingSubscriptionAssignmentError.message
        });
      }
      const alreadyPersisted = parsePersistedPricingVariant(existingSubscriptionAssignment?.variant) === subscriptionVariant
        && existingSubscriptionAssignment?.source === "active_subscription";
      const persisted = alreadyPersisted || await persistUserAssignment({
        userId: params.userId,
        variant: subscriptionVariant,
        source: "active_subscription"
      });
      return pricingAssignment({
        variant: subscriptionVariant,
        source: "active_subscription",
        persisted,
        experimentId: config.experimentId,
        active: true
      });
    }
  }

  // Explicit client override is reserved for QA. For users without an active
  // subscription pin, it remains above the stored assignment so checkout
  // matches the version intentionally rendered there.
  if (requestedVariant && variantInActiveExperiment(requestedVariant, config.variants)) {
    return pricingAssignment({
      variant: requestedVariant,
      source: "request",
      experimentId: config.experimentId,
      active: true
    });
  }

  const actorId = params.userId ?? params.anonymousId;
  if (!actorId) {
    const cookieVariant = readPricingExperimentCookieVariant(params.cookieHeader);
    return pricingAssignment({
      variant: cookieVariant && variantInActiveExperiment(cookieVariant, config.variants)
        ? cookieVariant
        : pickWeightedVariant(config.variants, defaultVariant),
      source: cookieVariant && variantInActiveExperiment(cookieVariant, config.variants)
        ? "cookie"
        : "random",
      experimentId: config.experimentId,
      active: true
    });
  }

  if (!adminEnabled) {
    return pricingAssignment({
      variant: resolvePricingHistoryReadFallback({
        cookieVariant: parseCookieHeader(params.cookieHeader)[PRICING_EXPERIMENT_COOKIE],
        defaultVariant,
        activeVariants: config.variants
      }),
      source: "fallback",
      experimentId: config.experimentId,
      active: true
    });
  }

  const admin = getAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("experiment_assignments")
    .select("variant, source")
    .eq("experiment_id", config.experimentId)
    .eq(params.userId ? "user_id" : "anonymous_id", actorId)
    .maybeSingle();

  if (!existingError && existing?.variant) {
    const existingVariant = parsePersistedPricingVariant(existing.variant);
    if (existingVariant && variantInActiveExperiment(existingVariant, config.variants)) {
      return pricingAssignment({
        variant: existingVariant,
        source: typeof existing.source === "string" && existing.source.trim() ? existing.source : "assignment",
        persisted: true,
        experimentId: config.experimentId,
        active: true
      });
    }

    const variant = pickWeightedVariant(config.variants, defaultVariant);
    const source = "random";
    const { error: updateInvalidError } = await admin
      .from("experiment_assignments")
      .update({
        variant,
        source,
        updated_at: new Date().toISOString()
      })
      .eq("experiment_id", config.experimentId)
      .eq(params.userId ? "user_id" : "anonymous_id", actorId);

    if (!updateInvalidError) {
      return pricingAssignment({
        variant,
        source,
        persisted: true,
        experimentId: config.experimentId,
        active: true
      });
    }

    console.warn("[pricing experiment] failed to replace invalid assignment variant", {
      userId: params.userId,
      anonymousId: params.anonymousId,
      experimentId: config.experimentId,
      existingVariant: existing.variant,
      error: updateInvalidError.message
    });
    return pricingAssignment({
      variant: resolvePricingHistoryReadFallback({
        cookieVariant: parseCookieHeader(params.cookieHeader)[PRICING_EXPERIMENT_COOKIE],
        defaultVariant,
        activeVariants: config.variants
      }),
      source: "fallback",
      experimentId: config.experimentId,
      active: true
    });
  }

  if (existingError) {
    console.warn("[pricing experiment] failed to read assignment", {
      userId: params.userId,
      anonymousId: params.anonymousId,
      experimentId: config.experimentId,
      error: existingError.message
    });
    return pricingAssignment({
      variant: resolvePricingHistoryReadFallback({
        cookieVariant: parseCookieHeader(params.cookieHeader)[PRICING_EXPERIMENT_COOKIE],
        defaultVariant,
        activeVariants: config.variants
      }),
      source: "fallback",
      experimentId: config.experimentId,
      active: true
    });
  }

  const actorColumn = params.userId ? "user_id" : "anonymous_id";
  const previous = await readPreviousPricingExperimentVariant({
    admin,
    actorColumn,
    actorId,
    currentExperimentId: config.experimentId
  });

  if (previous.error) {
    console.warn("[pricing experiment] failed to read previous assignment", {
      userId: params.userId,
      anonymousId: params.anonymousId,
      experimentId: config.experimentId,
      error: previous.error
    });
    return pricingAssignment({
      variant: resolvePricingHistoryReadFallback({
        cookieVariant: parseCookieHeader(params.cookieHeader)[PRICING_EXPERIMENT_COOKIE],
        defaultVariant,
        activeVariants: config.variants
      }),
      source: "fallback",
      experimentId: config.experimentId,
      active: true
    });
  }

  const nextAssignment = resolveNewPricingExperimentAssignment(
    previous.variant,
    config.variants,
    defaultVariant
  );
  const { variant, source } = nextAssignment;
  const insertError = await insertPricingExperimentAssignment({
    admin,
    userId: params.userId,
    anonymousId: params.anonymousId,
    experimentId: config.experimentId,
    variant,
    source
  });

  if (!insertError) {
    return pricingAssignment({
      variant,
      source,
      persisted: true,
      experimentId: config.experimentId,
      active: true
    });
  }

  const { data: raced, error: racedError } = await admin
    .from("experiment_assignments")
    .select("variant, source")
    .eq("experiment_id", config.experimentId)
    .eq(params.userId ? "user_id" : "anonymous_id", actorId)
    .maybeSingle();

  const racedVariant = parsePersistedPricingVariant(raced?.variant);
  if (!racedError && racedVariant && variantInActiveExperiment(racedVariant, config.variants)) {
    return pricingAssignment({
      variant: racedVariant,
      source: typeof raced?.source === "string" && raced.source.trim() ? raced.source : "assignment",
      persisted: true,
      experimentId: config.experimentId,
      active: true
    });
  }

  console.warn("[pricing experiment] failed to persist assignment", {
    userId: params.userId,
    anonymousId: params.anonymousId,
    experimentId: config.experimentId,
    error: insertError,
    raceReadError: racedError?.message
  });
  return pricingAssignment({
    variant: resolveUnpersistedPricingVariant({
      candidateVariant: variant,
      candidateSource: source,
      cookieVariant: parseCookieHeader(params.cookieHeader)[PRICING_EXPERIMENT_COOKIE],
      defaultVariant,
      activeVariants: config.variants
    }),
    source: source === "carry_forward" ? source : "fallback",
    experimentId: config.experimentId,
    active: true
  });
}

export async function persistUserPricingExperimentAssignment(params: {
  userId: string;
  variant: PricingVariant | string;
  source: string;
}): Promise<boolean> {
  if (!supabaseConfig.adminEnabled) return false;

  const config = await readActivePricingExperiment();
  if (!config?.active || !config.experimentId) return false;

  const variant = parsePersistedPricingVariant(params.variant);
  if (!variant) return false;
  if (!variantInActiveExperiment(variant, config.variants)) return false;

  const admin = getSupabaseAdminClient();
  const source = params.source.trim() || "checkout_request";
  const updatedAt = new Date().toISOString();

  const { data: updated, error: updateError } = await admin
    .from("experiment_assignments")
    .update({
      variant,
      source,
      updated_at: updatedAt
    })
    .eq("user_id", params.userId)
    .eq("experiment_id", config.experimentId)
    .select("id")
    .maybeSingle();

  if (updated) return true;
  if (updateError) {
    console.warn("[pricing experiment] failed to update assignment", {
      userId: params.userId,
      experimentId: config.experimentId,
      error: updateError.message
    });
    return false;
  }

  const { error: insertError } = await admin
    .from("experiment_assignments")
    .insert({
      user_id: params.userId,
      experiment_id: config.experimentId,
      experiment_key: PRICING_EXPERIMENT_KEY,
      variant,
      source,
      assigned_at: updatedAt,
      updated_at: updatedAt
    });

  if (!insertError) return true;

  const { error: retryUpdateError } = await admin
    .from("experiment_assignments")
    .update({
      variant,
      source,
      updated_at: updatedAt
    })
    .eq("user_id", params.userId)
    .eq("experiment_id", config.experimentId);

  if (!retryUpdateError) return true;

  console.warn("[pricing experiment] failed to persist assignment", {
    userId: params.userId,
    experimentId: config.experimentId,
    error: insertError.message,
    retryError: retryUpdateError.message
  });
  return false;
}

export async function migrateAnonymousPricingExperimentAssignmentToUser(params: {
  anonymousId: string;
  userId: string;
  source?: string;
}): Promise<{ migrated: boolean; variant?: PricingVariant }> {
  const anonymousId = params.anonymousId.trim();
  const userId = params.userId.trim();
  if (!supabaseConfig.adminEnabled || !anonymousId || !userId) return { migrated: false };

  const config = await readActivePricingExperiment();
  if (config?.readFailed) {
    throw new Error("PRICING_EXPERIMENT_ASSIGNMENT_READ_FAILED");
  }
  if (!config?.active || !config.experimentId) return { migrated: false };

  return migrateAnonymousPricingExperimentAssignmentWithClient({
    ...params,
    admin: getSupabaseAdminClient(),
    experimentId: config.experimentId,
    activeVariants: config.variants
  });
}

export async function migrateAnonymousPricingExperimentAssignmentWithClient(params: {
  anonymousId: string;
  userId: string;
  source?: string;
  admin: Pick<SupabaseClient, "from">;
  experimentId: string;
  activeVariants: ExperimentVariantRow[];
}): Promise<{ migrated: boolean; variant?: PricingVariant }> {
  const anonymousId = params.anonymousId.trim();
  const userId = params.userId.trim();
  const experimentId = params.experimentId.trim();
  if (!anonymousId || !userId || !experimentId) return { migrated: false };

  const admin = params.admin;

  // Formal account history is authoritative. Read it before the guest row so
  // an established account never changes experiments during guest binding.
  const { data: existingUserAssignment, error: existingUserAssignmentError } = await admin
    .from("experiment_assignments")
    .select("variant, experiment_id")
    .eq("user_id", userId)
    .eq("experiment_key", PRICING_EXPERIMENT_KEY)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingUserAssignmentError) {
    console.warn("[pricing experiment] failed to read user assignment for claim", {
      anonymousId,
      userId,
      experimentId,
      error: existingUserAssignmentError.message
    });
    throw new Error("PRICING_EXPERIMENT_USER_ASSIGNMENT_READ_FAILED");
  }
  if (existingUserAssignment) {
    const existingVariant = parsePersistedPricingVariant(existingUserAssignment.variant);
    return existingVariant
      ? { migrated: false, variant: existingVariant }
      : { migrated: false };
  }

  const { data: anonymousAssignment, error: anonymousAssignmentError } = await admin
    .from("experiment_assignments")
    .select("variant, assigned_at")
    .eq("experiment_id", experimentId)
    .eq("anonymous_id", anonymousId)
    .maybeSingle();

  if (anonymousAssignmentError) {
    console.warn("[pricing experiment] failed to read guest assignment for claim", {
      anonymousId,
      userId,
      experimentId,
      error: anonymousAssignmentError.message
    });
    throw new Error("PRICING_EXPERIMENT_GUEST_ASSIGNMENT_READ_FAILED");
  }
  if (!anonymousAssignment?.variant) return { migrated: false };

  const variant = parsePersistedPricingVariant(anonymousAssignment.variant);
  if (!variant) return { migrated: false };
  if (!variantInActiveExperiment(variant, params.activeVariants)) return { migrated: false };

  const now = new Date().toISOString();
  const source = params.source?.trim() || "guest_claim";
  const { error: insertError } = await admin
    .from("experiment_assignments")
    .insert({
      user_id: userId,
      experiment_id: experimentId,
      experiment_key: PRICING_EXPERIMENT_KEY,
      variant,
      source,
      assigned_at: typeof anonymousAssignment.assigned_at === "string" ? anonymousAssignment.assigned_at : now,
      updated_at: now
    });

  if (!insertError) return { migrated: true, variant };

  // An account read may assign the user concurrently. Re-read and preserve
  // that winner; never UPDATE it with the guest variant.
  const { data: raced, error: raceReadError } = await admin
    .from("experiment_assignments")
    .select("variant")
    .eq("user_id", userId)
    .eq("experiment_key", PRICING_EXPERIMENT_KEY)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (raceReadError) {
    console.warn("[pricing experiment] failed to verify concurrent user assignment", {
      anonymousId,
      userId,
      experimentId,
      error: insertError.message,
      raceError: raceReadError.message
    });
    throw new Error("PRICING_EXPERIMENT_ASSIGNMENT_RACE_READ_FAILED");
  }
  if (raced) {
    const racedVariant = parsePersistedPricingVariant(raced.variant);
    return racedVariant
      ? { migrated: false, variant: racedVariant }
      : { migrated: false };
  }
  console.warn("[pricing experiment] failed to persist claimed user assignment", {
    anonymousId,
    userId,
    experimentId,
    error: insertError.message
  });
  throw new Error("PRICING_EXPERIMENT_ASSIGNMENT_WRITE_FAILED");
}
