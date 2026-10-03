import type { SocialmediaAspectRatio } from "@/lib/socialmedia/types";

export type SocialmediaRequestedOutputSize = {
  width: number;
  height: number;
  size: string;
  aspectRatio: SocialmediaAspectRatio;
  /** Deterministic post-processing for exact physical-ratio deliverables. */
  resizeMode?: "fill" | "cover";
  /**
   * Server-selected composition step that runs before the exact `cover` crop.
   * This remains explicit so an edit cannot silently stretch a narrower source.
   */
  compositionMode?: "center_crop" | "outpaint_then_crop" | "adaptive_crop_or_outpaint";
  physicalDimensions?: {
    width: number;
    height: number;
    unit: "mm" | "cm" | "in";
    requestedRatio: string;
    providerAspectRatio?: SocialmediaAspectRatio;
    sourceWidth?: number;
    sourceHeight?: number;
    nativePpi?: number;
    maxNativePpi?: number;
    maxNativeWidth?: number;
    maxNativeHeight?: number;
    targetPpi?: number;
    requiredPixelWidth?: number;
    requiredPixelHeight?: number;
    targetPpiMet?: boolean;
    exceedsNativeResolution?: boolean;
  };
};

const MIN_OUTPUT_DIMENSION = 128;
const MAX_OUTPUT_DIMENSION = 8192;

type DimensionMatchOrder = "width_first" | "height_first";

type DimensionPattern = {
  pattern: RegExp;
  order?: DimensionMatchOrder;
};

const DIMENSION_NUMBER = String.raw`(?:\d{1,3}(?:,\d{3})+|\d{3,5})`;
const DIMENSION_UNIT = String.raw`(?:px|pixel|pixels)?`;
const DIMENSION_SEPARATOR = String.raw`(?:x|×|by|:|\*)`;

const DIMENSION_PATTERNS: DimensionPattern[] = [
  { pattern: new RegExp(String.raw`\b(${DIMENSION_NUMBER})\s*${DIMENSION_UNIT}\s*${DIMENSION_SEPARATOR}\s*(${DIMENSION_NUMBER})\s*${DIMENSION_UNIT}\b`, "i") },
  { pattern: new RegExp(String.raw`\b(${DIMENSION_NUMBER})\s*${DIMENSION_UNIT}\s*(?:w|wide|width)\b\D{0,32}\b(${DIMENSION_NUMBER})\s*${DIMENSION_UNIT}\s*(?:h|high|height|tall)\b`, "i") },
  { pattern: new RegExp(String.raw`\b(${DIMENSION_NUMBER})\s*${DIMENSION_UNIT}\s*(?:h|high|height|tall)\b\D{0,32}\b(${DIMENSION_NUMBER})\s*${DIMENSION_UNIT}\s*(?:w|wide|width)\b`, "i"), order: "height_first" },
  { pattern: new RegExp(String.raw`\b(?:width|wide|w)\s*[:=]?\s*(${DIMENSION_NUMBER})\s*${DIMENSION_UNIT}\b\D{0,32}\b(?:height|high|tall|h)\s*[:=]?\s*(${DIMENSION_NUMBER})\s*${DIMENSION_UNIT}\b`, "i") },
  { pattern: new RegExp(String.raw`\b(?:height|high|tall|h)\s*[:=]?\s*(${DIMENSION_NUMBER})\s*${DIMENSION_UNIT}\b\D{0,32}\b(?:width|wide|w)\s*[:=]?\s*(${DIMENSION_NUMBER})\s*${DIMENSION_UNIT}\b`, "i"), order: "height_first" },
  { pattern: new RegExp(String.raw`\b(?:size|sized|dimensions?|resolution|canvas|export|output)\D{0,24}\b(${DIMENSION_NUMBER})\s*${DIMENSION_UNIT}\s*(?:${DIMENSION_SEPARATOR}|\s+)\s*(${DIMENSION_NUMBER})\s*${DIMENSION_UNIT}\b`, "i") },
  { pattern: new RegExp(String.raw`\b(?:landscape|horizontal|banner|header|cover|thumbnail|wallpaper)\D{0,24}\b(${DIMENSION_NUMBER})\s*${DIMENSION_UNIT}\s+(?:and\s+)?(${DIMENSION_NUMBER})\s*${DIMENSION_UNIT}\b`, "i") },
  { pattern: new RegExp(String.raw`\b(?:portrait|vertical|story|reel|shorts)\D{0,24}\b(${DIMENSION_NUMBER})\s*${DIMENSION_UNIT}\s+(?:and\s+)?(${DIMENSION_NUMBER})\s*${DIMENSION_UNIT}\b`, "i") },
  { pattern: /(?:宽|宽度)\s*[:：]?\s*(\d{3,5})\D{0,24}(?:高|高度)\s*[:：]?\s*(\d{3,5})/i },
  { pattern: /(?:高|高度)\s*[:：]?\s*(\d{3,5})\D{0,24}(?:宽|宽度)\s*[:：]?\s*(\d{3,5})/i, order: "height_first" }
];

function isReasonableDimension(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_OUTPUT_DIMENSION && value <= MAX_OUTPUT_DIMENSION;
}

function gcd(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a || 1;
}

function nearestSocialmediaAspectRatio(width: number, height: number): SocialmediaAspectRatio {
  const ratio = width / height;
  const candidates: Array<{ value: SocialmediaAspectRatio; ratio: number }> = [
    { value: "1:1", ratio: 1 },
    { value: "3:2", ratio: 3 / 2 },
    { value: "2:3", ratio: 2 / 3 },
    { value: "4:3", ratio: 4 / 3 },
    { value: "3:4", ratio: 3 / 4 },
    { value: "5:4", ratio: 5 / 4 },
    { value: "4:5", ratio: 4 / 5 },
    { value: "16:9", ratio: 16 / 9 },
    { value: "9:16", ratio: 9 / 16 },
    { value: "2:1", ratio: 2 },
    { value: "1:2", ratio: 1 / 2 },
    { value: "21:9", ratio: 21 / 9 },
    { value: "9:21", ratio: 9 / 21 }
  ];

  return candidates.reduce((best, item) =>
    Math.abs(item.ratio - ratio) < Math.abs(best.ratio - ratio) ? item : best
  ).value;
}

export function formatReducedAspectRatio(width: number, height: number): string {
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

export function parseSocialmediaRequestedOutputSize(content: string): SocialmediaRequestedOutputSize | null {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  for (const { pattern, order } of DIMENSION_PATTERNS) {
    const match = normalized.match(pattern);
    if (!match?.[1] || !match[2]) continue;

    let width = Number(match[1].replace(/,/g, ""));
    let height = Number(match[2].replace(/,/g, ""));
    if (order === "height_first") {
      width = Number(match[2].replace(/,/g, ""));
      height = Number(match[1].replace(/,/g, ""));
    }
    if (!isReasonableDimension(width) || !isReasonableDimension(height)) continue;

    return {
      width,
      height,
      size: `${width}x${height}`,
      aspectRatio: nearestSocialmediaAspectRatio(width, height)
    };
  }

  return null;
}
