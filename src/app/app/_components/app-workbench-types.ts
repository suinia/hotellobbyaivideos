export type SocialmediaAssetItem = {
  asset_id: string;
  assetId: string;
  job_id: string;
  session_id?: string;
  source_use_case?: string;
  public_path?: string;
  output_type?: string;
  created_at: string;
  job_created_at?: string;
  job_updated_at?: string;
  input_text?: string;
  unlocked?: boolean;
  detail_loaded?: boolean;
  image: {
    assetId: string;
    url: string;
    width?: number;
    height?: number;
    promptSummary?: string;
    imageIndex?: number;
    accessVariant?: "original" | "watermarked";
    previewVariant?: "watermarked" | "masked_blur" | "low_res_clean";
  };
};

export type SocialmediaBoardItem = {
  session_id: string;
  title: string;
  source_use_case?: string;
  public_path?: string;
  output_type?: string;
  created_at: string;
  updated_at: string;
  last_job_id?: string;
  job_count: number;
  status?: "queued" | "running" | "completed" | "failed";
  image?: {
    assetId: string;
    url: string;
    width?: number;
    height?: number;
    accessVariant?: "original" | "watermarked";
    previewVariant?: "watermarked" | "masked_blur" | "low_res_clean";
    promptSummary?: string;
  };
};
