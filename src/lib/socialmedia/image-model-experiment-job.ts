import type { JobRecord } from "@/lib/types/job";
import type { SocialmediaJobPayload } from "@/lib/socialmedia/types";
import { resolveImageModelExperiment } from "@/lib/socialmedia/image-model-experiment-assignment";
import { isVideoGenerationSourceUseCase } from "@/lib/videos/source-use-case";
import { isGptImage25ModelExperiment } from "@/lib/socialmedia/image-model-experiment";

function applyAutoTextResolution(socialmedia: SocialmediaJobPayload["socialmedia"]): SocialmediaJobPayload["socialmedia"] {
  if (!socialmedia.autoTextHeavy || !socialmedia.agentRequest
    || !isGptImage25ModelExperiment({ experimentModel: socialmedia.imageModelExperiment?.variant })
    || (socialmedia.resolution !== "1k" && socialmedia.resolution !== "4k")) return socialmedia;
  return {
    ...socialmedia,
    // Render upgrade only: retain the original quote and requested delivery size.
    billingResolution: socialmedia.billingResolution ?? socialmedia.resolution,
    resolution: "4k",
    imageQuality: "low",
    ...(socialmedia.brief ? { brief: {
      ...socialmedia.brief,
      spec: { ...socialmedia.brief.spec, resolution: "4k", quality: "low" }
    } } : {})
  };
}

export async function assignQueuedImageModel(
  payload: JobRecord["payload"],
  ownerUserId?: string,
  resolve = resolveImageModelExperiment
): Promise<JobRecord["payload"]> {
  if (payload.workflow !== "socialmedia" || !payload.socialmedia || typeof payload.socialmedia !== "object") return payload;
  const socialmedia = payload.socialmedia as SocialmediaJobPayload["socialmedia"];
  // Videos (including their keyframes) and legacy masked edits are outside this experiment.
  const eligible = !socialmedia.videoModel
    && !isVideoGenerationSourceUseCase(socialmedia.sourceUseCase)
    && !(socialmedia as { imageEditor?: { strokes?: unknown[] } }).imageEditor?.strokes?.length;
  const imageModelExperiment = eligible ? await resolve(ownerUserId) : undefined;
  // Never trust an incoming/copy-forward snapshot when creating a new job.
  return { ...payload, socialmedia: applyAutoTextResolution({ ...socialmedia, imageModelExperiment }) };
}

/** Async billing/source preparation must retain the already persisted assignment. */
export function preserveQueuedImageModel(payload: JobRecord["payload"], initialPayload: JobRecord["payload"]): JobRecord["payload"] {
  if (payload.workflow !== "socialmedia" || !payload.socialmedia || typeof payload.socialmedia !== "object") return payload;
  const initial = initialPayload.socialmedia as SocialmediaJobPayload["socialmedia"] | undefined;
  return { ...payload, socialmedia: applyAutoTextResolution({
    ...payload.socialmedia as SocialmediaJobPayload["socialmedia"],
    imageModelExperiment: initial?.imageModelExperiment,
    autoTextHeavy: initial?.autoTextHeavy
  }) };
}
