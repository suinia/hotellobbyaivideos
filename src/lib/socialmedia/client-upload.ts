export const CLIENT_UPLOAD_NORMALIZED_MAX_BYTES = 4 * 1024 * 1024;
export const CLIENT_UPLOAD_RAW_MAX_BYTES = 25 * 1024 * 1024;

const CLIENT_UPLOAD_NORMALIZE_ATTEMPTS = [
  { maxEdge: 2560, quality: 0.88 },
  { maxEdge: 2200, quality: 0.84 },
  { maxEdge: 1800, quality: 0.8 },
  { maxEdge: 1400, quality: 0.76 },
  { maxEdge: 1200, quality: 0.72 },
  { maxEdge: 1000, quality: 0.68 },
  { maxEdge: 800, quality: 0.64 }
] as const;

const IMAGE_FILE_EXTENSIONS = [".avif", ".gif", ".heic", ".heif", ".jpg", ".jpeg", ".png", ".webp"];

type PrepareUploadImageFileOptions = {
  normalizedMaxBytes?: number;
  rawMaxBytes?: number;
  forceNormalize?: boolean;
  allowOriginalFallback?: boolean;
};

function hasKnownImageExtension(name: string): boolean {
  const normalized = name.toLowerCase().trim();
  return IMAGE_FILE_EXTENSIONS.some((extension) => normalized.endsWith(extension));
}

function isHeicLikeFile(file: File): boolean {
  const mimeType = file.type.toLowerCase().trim();
  const name = file.name.toLowerCase().trim();
  return mimeType === "image/heic"
    || mimeType === "image/heif"
    || name.endsWith(".heic")
    || name.endsWith(".heif");
}

export function isLikelyImageFile(file: File): boolean {
  const mimeType = file.type.toLowerCase().trim();
  return mimeType.startsWith("image/") || hasKnownImageExtension(file.name);
}

function formatMegabytes(bytes: number): number {
  return Math.floor(bytes / 1024 / 1024);
}

function buildImageTooLargeError(rawMaxBytes: number): Error {
  return new Error(`Image is too large. Please upload an image under ${formatMegabytes(rawMaxBytes)} MB.`);
}

function buildImageCompressionFailedError(rawMaxBytes: number): Error {
  return new Error(
    `This image is over ${formatMegabytes(rawMaxBytes)} MB and could not be compressed in your browser. Please upload a smaller image.`
  );
}

function shouldNormalizeUploadFile(
  file: File,
  normalizedMaxBytes: number,
  forceNormalize: boolean
): boolean {
  const mimeType = file.type.toLowerCase().trim();
  return forceNormalize
    || !mimeType
    || isHeicLikeFile(file)
    || file.size > normalizedMaxBytes;
}

function replaceImageFileExtension(name: string, extension: string): string {
  const trimmedName = name.trim();
  const lastDotIndex = trimmedName.lastIndexOf(".");
  const baseName = lastDotIndex > 0 ? trimmedName.slice(0, lastDotIndex) : trimmedName;
  return `${baseName || "reference-image"}.${extension}`;
}

function loadUploadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("This image format could not be read by the browser."));
    };
    image.src = objectUrl;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to prepare image for upload."));
        return;
      }
      resolve(blob);
    }, "image/jpeg", quality);
  });
}

async function normalizeUploadImageFile(file: File, normalizedMaxBytes: number): Promise<File> {
  const image = await loadUploadImage(file);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) {
    throw new Error("This image is missing readable dimensions.");
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw new Error("This browser could not prepare the image for upload.");
  }

  let lastBlob: Blob | null = null;
  for (const attempt of CLIENT_UPLOAD_NORMALIZE_ATTEMPTS) {
    const scale = Math.min(1, attempt.maxEdge / Math.max(sourceWidth, sourceHeight));
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToJpegBlob(canvas, attempt.quality);
    lastBlob = blob;
    if (blob.size <= normalizedMaxBytes) {
      return new File([blob], replaceImageFileExtension(file.name, "jpg"), {
        type: "image/jpeg",
        lastModified: file.lastModified || Date.now()
      });
    }
  }

  throw new Error("Failed to prepare image for upload.");
}

export async function prepareUploadImageFile(file: File): Promise<File> {
  return prepareUploadImageFileWithOptions(file);
}

export async function prepareUploadImageFileWithOptions(
  file: File,
  options: PrepareUploadImageFileOptions = {}
): Promise<File> {
  const normalizedMaxBytes = options.normalizedMaxBytes ?? CLIENT_UPLOAD_NORMALIZED_MAX_BYTES;
  const rawMaxBytes = options.rawMaxBytes ?? CLIENT_UPLOAD_RAW_MAX_BYTES;
  const forceNormalize = options.forceNormalize ?? false;
  const allowOriginalFallback = options.allowOriginalFallback ?? true;

  const isLikelyImage = isLikelyImageFile(file);
  if (file.size > rawMaxBytes && !isLikelyImage) {
    throw buildImageTooLargeError(rawMaxBytes);
  }
  if (!shouldNormalizeUploadFile(file, normalizedMaxBytes, forceNormalize)) return file;

  try {
    return await normalizeUploadImageFile(file, normalizedMaxBytes);
  } catch (error) {
    if (allowOriginalFallback && isLikelyImage && file.size <= rawMaxBytes) {
      return file;
    }
    if (file.size > rawMaxBytes) {
      throw buildImageCompressionFailedError(rawMaxBytes);
    }
    throw error;
  }
}
