import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { GENERAL_ENTRY_EXPERIMENT_KEY, isGeneralEntryVariant, type GeneralEntryVariant } from "./general-entry";

export type GeneralEntryAssignment = { variant: GeneralEntryVariant; experimentId?: string; source: string };
const control = (source: string): GeneralEntryAssignment => ({ variant: "control", source });

/** One persisted assignment drives homepage rendering and ordinary authentication returns.
 * This is an entry experiment: /app, existing General sessions and dedicated tools remain accessible.
 */
export async function resolveGeneralEntryAssignment(
  identity: { userId?: string; visitorId?: string },
  adminFactory: () => SupabaseClient = getSupabaseAdminClient,
  options: { timeoutMs?: number } = {}
): Promise<GeneralEntryAssignment> {
  try {
    const admin = adminFactory();
    const signal = AbortSignal.timeout(options.timeoutMs ?? 3000);
    const config = await admin.from("experiment_configs").select("active_experiment_id")
      .eq("experiment_key", GENERAL_ENTRY_EXPERIMENT_KEY).abortSignal(signal).maybeSingle();
    if (config.error) return control("config_error");
    const experimentId = config.data?.active_experiment_id;
    if (!experimentId) return control("inactive");
    const [experiment, variants] = await Promise.all([
      admin.from("experiments").select("experiment_key,status,starts_at,ends_at").eq("id", experimentId).abortSignal(signal).maybeSingle(),
      admin.from("experiment_variants").select("variant,weight,enabled").eq("experiment_id", experimentId).abortSignal(signal)
    ]);
    const row = experiment.data;
    const now = Date.now();
    if (experiment.error || variants.error) return control("config_error");
    if (!row || row.experiment_key !== GENERAL_ENTRY_EXPERIMENT_KEY || row.status !== "active"
      || (row.starts_at && !(Date.parse(row.starts_at) <= now))
      || (row.ends_at && !(Date.parse(row.ends_at) > now))) return control("inactive");
    const enabled = (variants.data ?? []).filter(v => v.enabled === true && isGeneralEntryVariant(v.variant));
    const allowed = (value: unknown): value is GeneralEntryVariant => isGeneralEntryVariant(value) && enabled.some(v => v.variant === value);
    const userId = identity.userId;
    const anonymousId = identity.visitorId ? `general-entry:${identity.visitorId}` : undefined;
    if (!userId && !anonymousId) return control("no_identity");
    const read = (field: "user_id" | "anonymous_id", value: string) => admin.from("experiment_assignments")
      .select("variant,source").eq("experiment_id", experimentId).eq(field, value).abortSignal(signal).maybeSingle();
    const field = userId ? "user_id" : "anonymous_id";
    const actor = userId ?? anonymousId!;
    const existing = await read(field, actor);
    if (existing.error) return control("assignment_read_error");
    if (existing.data) return allowed(existing.data.variant)
      ? { variant: existing.data.variant, experimentId, source: "existing" }
      : control("variant_disabled");
    let inherited: GeneralEntryVariant | undefined;
    if (userId && anonymousId) {
      const guest = await read("anonymous_id", anonymousId);
      if (guest.error) return control("assignment_read_error");
      if (allowed(guest.data?.variant)) inherited = guest.data.variant;
    }
    // Stable hash prevents concurrent first visits from drawing different random groups.
    const candidates = enabled.filter(v => Number.isFinite(Number(v.weight)) && Number(v.weight) > 0)
      .sort((a, b) => a.variant.localeCompare(b.variant));
    const total = candidates.reduce((sum, v) => sum + Number(v.weight), 0);
    if (!inherited && !total) return control("no_weighted_variants");
    let hash = 2166136261;
    for (const char of `${experimentId}:${actor}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    let cursor = (hash / 4294967296) * total;
    let variant: GeneralEntryVariant = inherited ?? "control";
    if (!inherited) for (const candidate of candidates) {
      cursor -= Number(candidate.weight);
      if (cursor < 0) { variant = candidate.variant as GeneralEntryVariant; break; }
    }
    const source = inherited ? "visitor_transfer" : "stable_bucket";
    const saved = await admin.from("experiment_assignments").insert({
      experiment_key: GENERAL_ENTRY_EXPERIMENT_KEY, experiment_id: experimentId,
      user_id: userId ?? null, anonymous_id: userId ? null : anonymousId, variant, source
    }).abortSignal(signal);
    if (!saved.error) return { variant, experimentId, source };
    const raced = await read(field, actor);
    return !raced.error && allowed(raced.data?.variant)
      ? { variant: raced.data.variant, experimentId, source: "existing" }
      : control("assignment_write_error");
  } catch {
    return control("unavailable");
  }
}
