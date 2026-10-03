const IMAGE_EXTENSION_BY_MIME_TYPE: Readonly<Record<string, string>> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp"
};

export function getImageExtensionFromType(contentType: string | null | undefined): string | undefined {
  const normalized = contentType?.split(";")[0]?.trim().toLowerCase();
  return normalized ? IMAGE_EXTENSION_BY_MIME_TYPE[normalized] : undefined;
}

export function resolveImageDownloadFileName(
  fileName: string,
  contentType: string | null | undefined
): string {
  const extension = getImageExtensionFromType(contentType);
  if (!extension) return fileName;

  const trimmedFileName = fileName.trim();
  const lastSlashIndex = Math.max(trimmedFileName.lastIndexOf("/"), trimmedFileName.lastIndexOf("\\"));
  const lastDotIndex = trimmedFileName.lastIndexOf(".");
  const hasExtension = lastDotIndex > lastSlashIndex + 1;
  const baseName = hasExtension ? trimmedFileName.slice(0, lastDotIndex) : trimmedFileName;
  return `${baseName || "image"}.${extension}`;
}
