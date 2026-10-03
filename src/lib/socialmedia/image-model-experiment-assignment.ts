import type { SupabaseClient } from "@supabase/supabase-js";
import { isGuestUserId } from "@/lib/auth/guest";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseConfig } from "@/lib/supabase/config";
import {
  IMAGE_MODEL_EXPERIMENT_KEY,
  resolveLocalImageModelOverride,
  parseImageModelExperimentVariant,
  pickImageModelExperimentVariant,
  type ImageModelExperimentSnapshot,
  type ImageModelExperimentVariant
} from "@/lib/socialmedia/image-model-experiment";

type Admin = Pick<SupabaseClient, "from">;
type Config = {
  defaultVariant: ImageModelExperimentVariant;
  experimentId?: string;
  active: boolean;
  variants: Array<{ variant: unknown; weight: unknown }>;
};
let cache: { expiresAt: number; config: Config | undefined } | undefined;

function actor(ownerUserId?: string): { column: "user_id" | "anonymous_id"; id: string } | undefined {
  if (!ownerUserId) return undefined;
  if (isGuestUserId(ownerUserId)) return { column: "anonymous_id", id: ownerUserId };
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerUserId)) {
    return { column: "user_id", id: ownerUserId };
  }
  return undefined;
}

async function readConfig(admin: Admin, now = Date.now()): Promise<Config | undefined> {
  const { data: row, error } = await admin.from("experiment_configs")
    .select("default_variant, active_experiment_id").eq("experiment_key", IMAGE_MODEL_EXPERIMENT_KEY).maybeSingle();
  if (error) throw new Error("IMAGE_MODEL_EXPERIMENT_CONFIG_READ_FAILED");
  const defaultVariant = parseImageModelExperimentVariant(row?.default_variant);
  // Deploying the code before its migration preserves the existing provider policy.
  if (!row || !defaultVariant) return undefined;
  const config: Config = { defaultVariant, active: false, variants: [] };
  if (!row.active_experiment_id) return config;
  const { data: experiment, error: experimentError } = await admin.from("experiments")
    .select("experiment_key, status, starts_at, ends_at").eq("id", row.active_experiment_id).maybeSingle();
  if (experimentError) throw new Error("IMAGE_MODEL_EXPERIMENT_READ_FAILED");
  if (!experiment || experiment.experiment_key !== IMAGE_MODEL_EXPERIMENT_KEY) return config;
  const startsAt = experiment.starts_at ? Date.parse(experiment.starts_at) : -Infinity;
  const endsAt = experiment.ends_at ? Date.parse(experiment.ends_at) : Infinity;
  if (experiment.status !== "active" || !(startsAt <= now && endsAt > now)) return config;
  const { data: variants, error: variantsError } = await admin.from("experiment_variants")
    .select("variant, weight").eq("experiment_id", row.active_experiment_id).eq("enabled", true);
  if (variantsError) throw new Error("IMAGE_MODEL_EXPERIMENT_VARIANTS_READ_FAILED");
  return { ...config, active: true, experimentId: row.active_experiment_id, variants: variants ?? [] };
}

async function readAssignment(admin: Admin, experimentId: string, identity: NonNullable<ReturnType<typeof actor>>) {
  const { data, error } = await admin.from("experiment_assignments").select("variant")
    .eq("experiment_key", IMAGE_MODEL_EXPERIMENT_KEY).eq("experiment_id", experimentId)
    .eq(identity.column, identity.id).maybeSingle();
  if (error) throw new Error("IMAGE_MODEL_EXPERIMENT_ASSIGNMENT_READ_FAILED");
  return data;
}

async function assign(admin: Admin, config: Config, ownerUserId: string, random: () => number): Promise<ImageModelExperimentSnapshot> {
  const fallback = (source: ImageModelExperimentSnapshot["source"]): ImageModelExperimentSnapshot => ({
    key: IMAGE_MODEL_EXPERIMENT_KEY, variant: config.defaultVariant, source
  });
  const identity = actor(ownerUserId);
  if (!config.active || !config.experimentId || !identity) return fallback("default");
  const snapshot = (value: unknown, source: "assignment" | "random"): ImageModelExperimentSnapshot => {
    const variant = parseImageModelExperimentVariant(value);
    // Zero weight stops enrollment; enabled=false also stops existing assignments.
    return variant && config.variants.some((row) => row.variant === variant)
      ? { key: IMAGE_MODEL_EXPERIMENT_KEY, variant, source, experimentId: config.experimentId }
      : fallback("disabled");
  };
  try {
    const existing = await readAssignment(admin, config.experimentId, identity);
    if (existing) return snapshot(existing.variant, "assignment");
    const variant = pickImageModelExperimentVariant(config.variants, random);
    if (!variant) return fallback("default");
    const { error } = await admin.from("experiment_assignments").insert({
      experiment_key: IMAGE_MODEL_EXPERIMENT_KEY,
      experiment_id: config.experimentId,
      [identity.column]: identity.id,
      variant,
      source: "random"
    });
    if (!error) return snapshot(variant, "random");
    // The unique experiment/actor index chooses one winner for simultaneous jobs.
    const winner = await readAssignment(admin, config.experimentId, identity);
    if (winner) return snapshot(winner.variant, "assignment");
    return fallback("unavailable");
  } catch {
    // Never expose an unpersisted random bucket as an experiment assignment.
    return fallback("unavailable");
  }
}

export async function resolveImageModelExperimentWithClient(params: {
  admin: Admin; ownerUserId: string; random?: () => number; now?: number;
}): Promise<ImageModelExperimentSnapshot | undefined> {
  if (!actor(params.ownerUserId)) return undefined;
  const config = await readConfig(params.admin, params.now);
  return config ? assign(params.admin, config, params.ownerUserId, params.random ?? Math.random) : undefined;
}

export async function resolveImageModelExperiment(ownerUserId?: string): Promise<ImageModelExperimentSnapshot | undefined> {
  const localOverride = resolveLocalImageModelOverride(process.env);
  if (localOverride) return localOverride;
  if (process.env.VERCEL_ENV !== "production" || !supabaseConfig.adminEnabled || !actor(ownerUserId)) return undefined;
  try {
    const admin = getSupabaseAdminClient();
    if (!cache || cache.expiresAt <= Date.now()) {
      const config = await readConfig(admin);
      cache = { config, expiresAt: Date.now() + 60_000 };
    }
    return cache.config ? await assign(admin, cache.config, ownerUserId!, Math.random) : undefined;
  } catch {
    // Do not reuse stale active weights after a failed refresh.
    cache = undefined;
    console.warn("[image-model-experiment] configuration unavailable; using configured image provider");
    return undefined;
  }
}

export async function migrateImageModelExperimentWithClient(params: {
  admin: Admin; anonymousId: string; userId: string;
}): Promise<{ migrated: boolean }> {
  const guest = actor(params.anonymousId);
  const user = actor(params.userId);
  if (guest?.column !== "anonymous_id" || user?.column !== "user_id") return { migrated: false };
  // Claims preserve historical assignments even while the rollout is offline.
  const { data: assignments, error: readError } = await params.admin.from("experiment_assignments")
    .select("experiment_id, variant").eq("experiment_key", IMAGE_MODEL_EXPERIMENT_KEY)
    .eq("anonymous_id", guest.id);
  if (readError) throw new Error("IMAGE_MODEL_EXPERIMENT_ASSIGNMENT_READ_FAILED");
  let migrated = false;
  for (const assignment of assignments ?? []) {
    const variant = parseImageModelExperimentVariant(assignment.variant);
    if (!variant || !assignment.experiment_id) continue;
    if (await readAssignment(params.admin, assignment.experiment_id, user)) continue;
    const { error } = await params.admin.from("experiment_assignments").insert({
      experiment_key: IMAGE_MODEL_EXPERIMENT_KEY,
      experiment_id: assignment.experiment_id,
      user_id: user.id,
      variant,
      source: "guest_claim"
    });
    if (!error) { migrated = true; continue; }
    if (await readAssignment(params.admin, assignment.experiment_id, user)) continue;
    throw new Error("IMAGE_MODEL_EXPERIMENT_MIGRATION_FAILED");
  }
  return { migrated };
}

export async function migrateImageModelExperimentToUser(params: {
  anonymousId: string; userId: string;
}): Promise<{ migrated: boolean }> {
  if (!supabaseConfig.adminEnabled) return { migrated: false };
  return migrateImageModelExperimentWithClient({ ...params, admin: getSupabaseAdminClient() });
}
