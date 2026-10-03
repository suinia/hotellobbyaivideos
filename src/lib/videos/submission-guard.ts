import { isVideoGenerationSourceUseCase } from "@/lib/videos/source-use-case";

export const VIDEO_GENERATION_IN_PROGRESS_MESSAGE =
  "Your video generation is already running. Wait for it to finish before starting another video.";

type VideoSubmissionJob = {
  status?: string;
  output_type?: string;
  source_use_case?: string;
};

export function hasActiveVideoGenerationJob(jobs: VideoSubmissionJob[]): boolean {
  return jobs.some((job) => (
    (job.status === "queued" || job.status === "running")
    && (job.output_type === "video" || isVideoGenerationSourceUseCase(job.source_use_case))
  ));
}
