import { z } from "zod";
import { isVideoGenerationSourceUseCase } from "@/lib/videos/source-use-case";

// Shared eligibility for card payloads and image clarification instructions;
// this helper does not classify a turn's intent or readiness.
export function supportsClarificationCard(sourceUseCase?: string, visualDomain = "image") {
  return visualDomain === "image" && Boolean(sourceUseCase)
    && !isVideoGenerationSourceUseCase(sourceUseCase)
    && sourceUseCase !== "ai-comic-generator" && sourceUseCase !== "ai-comic";
}

export const clarificationOptionsSchema = z.array(z.string().trim().min(1).max(160)).max(4);
const selectableClarificationOptionsSchema = clarificationOptionsSchema.min(2);
export const clarificationCardSchema = z.object({
  id: z.string().min(1).max(100),
  question: z.string().trim().min(1).max(1000),
  options: selectableClarificationOptionsSchema,
  aspectRatio: z.string().max(30),
  resolution: z.string().max(20)
}).strict();
export type ClarificationCardData = z.infer<typeof clarificationCardSchema>;

export function readClarificationCard(value: unknown, sourceUseCase?: string): ClarificationCardData | undefined {
  if (!supportsClarificationCard(sourceUseCase)) return undefined;
  const parsed = clarificationCardSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
