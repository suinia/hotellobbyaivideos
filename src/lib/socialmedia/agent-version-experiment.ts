export type SocialmediaAgentVersionExperimentVariant = "agent_v1" | "agent_v2";

export const SOCIALMEDIA_AGENT_VERSION_EXPERIMENT_KEY = "socialmedia_agent_version_experiment_v1";
export const DEFAULT_SOCIALMEDIA_AGENT_VERSION_EXPERIMENT_VARIANT: SocialmediaAgentVersionExperimentVariant = "agent_v1";

const SUPPORTED_VARIANTS: SocialmediaAgentVersionExperimentVariant[] = [
  "agent_v1",
  "agent_v2"
];

export const SOCIALMEDIA_AGENT_VERSION_EXPERIMENT_VARIANTS = SUPPORTED_VARIANTS;

export function normalizeSocialmediaAgentVersionExperimentVariant(
  value?: string | null
): SocialmediaAgentVersionExperimentVariant {
  const normalized = String(value ?? "").trim().toLowerCase();
  return SUPPORTED_VARIANTS.includes(normalized as SocialmediaAgentVersionExperimentVariant)
    ? normalized as SocialmediaAgentVersionExperimentVariant
    : DEFAULT_SOCIALMEDIA_AGENT_VERSION_EXPERIMENT_VARIANT;
}
