export const IMAGE_MODEL_EXPERIMENT_KEY = "image_model_experiment_v1";
export const IMAGE_MODEL_EXPERIMENT_VARIANTS = ["gpt-image-2.5-flare", "gpt-image-2-official", "gpt-image-2.5-sunburst"] as const;
export type ImageModelExperimentVariant = typeof IMAGE_MODEL_EXPERIMENT_VARIANTS[number];

/** Flare and Sunburst share the 2.5 policy. Safety fallback models must retain their own execution policy. */
export function isGptImage25ModelExperiment(input: { experimentModel?: unknown; model?: string }): boolean {
  return (input.experimentModel === "gpt-image-2.5-flare" || input.experimentModel === "gpt-image-2.5-sunburst")
    && (!input.model || /^(?:openai\/)?gpt-image-2(?:-official|\.5-(?:flare|sunburst))?$/i.test(input.model.trim()));
}

export type ImageModelExperimentSnapshot = {
  key: typeof IMAGE_MODEL_EXPERIMENT_KEY;
  variant: ImageModelExperimentVariant;
  experimentId?: string;
  source: "assignment" | "random" | "default" | "disabled" | "unavailable" | "local_override";
};

export function parseImageModelExperimentVariant(value: unknown): ImageModelExperimentVariant | undefined {
  return IMAGE_MODEL_EXPERIMENT_VARIANTS.find((variant) => variant === value);
}

export function pickImageModelExperimentVariant(
  rows: Array<{ variant: unknown; weight: unknown }>,
  random = Math.random
): ImageModelExperimentVariant | undefined {
  const entries = rows.flatMap((row) => {
    const variant = parseImageModelExperimentVariant(row.variant);
    const weight = Number(row.weight);
    return variant && Number.isFinite(weight) && weight > 0 ? [{ variant, weight }] : [];
  });
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (!Number.isFinite(total) || total <= 0) return undefined;
  let cursor = random() * total;
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor < 0) return entry.variant;
  }
  return entries.at(-1)?.variant;
}

export function flareExperimentQuality(resolution?: string): "low" | "medium" {
  const tier = resolution?.trim().toLowerCase();
  return tier === "2k" || tier === "4k" ? "low" : "medium";
}

/** Explicit local development choice; deployed environments retain their rollout policy. */
export function resolveLocalImageModelOverride(env: Record<string, string | undefined>): ImageModelExperimentSnapshot | undefined {
  if (env.NODE_ENV !== "development" || env.VERCEL === "1"
    || (env.VERCEL_ENV && env.VERCEL_ENV !== "development")) return undefined;
  const value = env.LOCAL_IMAGE_MODEL?.trim().toLowerCase();
  const variant = value === "2" || value === "2.0" ? "gpt-image-2-official"
    : value === "2.5" ? "gpt-image-2.5-flare" : parseImageModelExperimentVariant(value);
  return variant ? { key: IMAGE_MODEL_EXPERIMENT_KEY, variant, source: "local_override" } : undefined;
}
