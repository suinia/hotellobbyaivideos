export const IMAGE_ACCESS_VARIANT_COLUMNS = [
  "id", "job_id", "created_at", "storage_bucket", "storage_path", "public_url", "access_variant",
  "original_storage_bucket", "original_storage_path", "original_mime_type", "original_size_bytes",
  "watermarked_storage_bucket", "watermarked_storage_path", "watermarked_mime_type", "watermarked_size_bytes"
];

// Preserve every metadata field consumed by image/video access selection, while
// leaving provider source URLs and prompts in storage.
export const IMAGE_ACCESS_DISPLAY_META_FIELDS = [
  "preview_variant", "billing_mode", "served_mime_type", "low_res_clean_mime_type",
  "masked_blur_mime_type", "served_size_bytes", "low_res_clean_size_bytes",
  "masked_blur_size_bytes", "size_bytes", "requested_access_variant", "watermark_status",
  "first_frame_asset_id", "first_frame_url", "first_frame_path"
] as const;

export const IMAGE_ACCESS_DISPLAY_COLUMNS = [
  ...IMAGE_ACCESS_VARIANT_COLUMNS,
  ...IMAGE_ACCESS_DISPLAY_META_FIELDS.map((field) => `display_meta_${field}:meta_json->${field}`)
].join(",");

export function restoreImageAccessDisplayRow<T extends Record<string, unknown>>(row: T) {
  return {
    ...row,
    meta_json: Object.fromEntries(IMAGE_ACCESS_DISPLAY_META_FIELDS
      .filter((field) => row[`display_meta_${field}`] != null)
      .map((field) => [field, row[`display_meta_${field}`]]))
  };
}
