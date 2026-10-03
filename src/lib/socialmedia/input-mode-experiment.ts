import { isImageBuilderV4ImageSourceUseCase } from "./image-builder-v4-workspaces";

export type SocialmediaInputModeExperimentVariant = "pipeline" | "agent" | "agent_v4";

export const SOCIALMEDIA_INPUT_MODE_EXPERIMENT_KEY = "socialmedia_input_mode_experiment_v1";
export const SOCIALMEDIA_INPUT_MODE_EXPERIMENT_COOKIE = "vismuse_socialmedia_input_mode_experiment_v1";
export const DEFAULT_SOCIALMEDIA_INPUT_MODE_EXPERIMENT_VARIANT: SocialmediaInputModeExperimentVariant = "pipeline";

const SUPPORTED_SOCIALMEDIA_INPUT_MODE_EXPERIMENT_VARIANTS: SocialmediaInputModeExperimentVariant[] = [
  "pipeline",
  "agent",
  "agent_v4"
];

export const SOCIALMEDIA_INPUT_MODE_EXPERIMENT_VARIANTS =
  SUPPORTED_SOCIALMEDIA_INPUT_MODE_EXPERIMENT_VARIANTS;

export function isSocialmediaAgentV4ExperimentSourceUseCase(
  sourceUseCase?: string
): boolean {
  return isImageBuilderV4ImageSourceUseCase(sourceUseCase);
}

export function parseSocialmediaInputModeExperimentVariant(
  value?: string | null
): SocialmediaInputModeExperimentVariant | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  return SUPPORTED_SOCIALMEDIA_INPUT_MODE_EXPERIMENT_VARIANTS.includes(
    normalized as SocialmediaInputModeExperimentVariant
  )
    ? normalized as SocialmediaInputModeExperimentVariant
    : null;
}

export function normalizeSocialmediaInputModeExperimentVariant(
  value?: string | null
): SocialmediaInputModeExperimentVariant {
  return parseSocialmediaInputModeExperimentVariant(value)
    ?? DEFAULT_SOCIALMEDIA_INPUT_MODE_EXPERIMENT_VARIANT;
}
