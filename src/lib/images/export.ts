import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

export const IMAGE_EXPORT_FORMATS = ["png", "jpeg", "pdf"] as const;

export type ImageExportFormat = (typeof IMAGE_EXPORT_FORMATS)[number];

export type ExportSourceImage = {
  buffer: Buffer;
  index: number;
};

export type ExportedImage = {
  buffer: Buffer;
  contentType: "image/png" | "image/jpeg";
  extension: "png" | "jpg";
};

export function hasOriginalImageExportAccess(
  images: Array<{ accessVariant?: "original" | "watermarked" }>
): boolean {
  return images.length > 0 && images.every((image) => image.accessVariant === "original");
}

export async function convertImageForExport(
  source: Buffer,
  format: Exclude<ImageExportFormat, "pdf">
): Promise<ExportedImage> {
  const pipeline = sharp(source, { animated: false }).rotate();
  if (format === "jpeg") {
    const buffer = await pipeline
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 95, mozjpeg: true, chromaSubsampling: "4:4:4" })
      .toBuffer();
    return { buffer, contentType: "image/jpeg", extension: "jpg" };
  }

  const buffer = await pipeline
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  return { buffer, contentType: "image/png", extension: "png" };
}

export async function createImagePdf(sources: ExportSourceImage[]): Promise<Buffer> {
  if (!sources.length) throw new Error("At least one image is required to create a PDF.");

  const pdf = await PDFDocument.create();
  pdf.setCreator("Vismuse");
  pdf.setProducer("Vismuse");

  for (const source of [...sources].sort((left, right) => left.index - right.index)) {
    const normalized = await sharp(source.buffer, { animated: false })
      .rotate()
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer({ resolveWithObject: true });
    const width = normalized.info.width;
    const height = normalized.info.height;
    if (!width || !height) throw new Error("Unable to determine exported image dimensions.");

    const embedded = await pdf.embedPng(normalized.data);
    // Treat source pixels as CSS pixels at 96 DPI. The page follows the image
    // aspect ratio, so social posts are not cropped or padded into A4/Letter.
    const pageWidth = width * 0.75;
    const pageHeight = height * 0.75;
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight
    });
  }

  return Buffer.from(await pdf.save({ useObjectStreams: true }));
}
