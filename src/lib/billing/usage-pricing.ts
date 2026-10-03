import { appConfig, type TokenCreditRate } from "@/lib/config";
import type { UsageSnapshot } from "@/lib/llm/usage-tracker";
import type { ConversionResult } from "@/lib/types/skills";

function normalizeModelKey(model?: string): string {
  return String(model ?? "").trim().toLowerCase();
}

function resolveTokenRate(model?: string): TokenCreditRate {
  const normalized = normalizeModelKey(model);
  const configured = appConfig.billing.tokenCreditRates;
  if (normalized && configured[normalized]) {
    return configured[normalized];
  }
  return configured.default;
}

export function countBillableImages(result?: ConversionResult): number {
  if (!result?.slides?.length) return 0;
  return result.slides.filter((slide) => String(slide.image_url ?? "").trim()).length;
}

export function calculateTokenCredits(snapshot?: UsageSnapshot | null): {
  rawCredits: number;
  roundedCredits: number;
} {
  if (!snapshot) {
    return { rawCredits: 0, roundedCredits: 0 };
  }

  let rawCredits = 0;
  if (snapshot.models.length) {
    for (const model of snapshot.models) {
      const rate = resolveTokenRate(model.model);
      rawCredits += (model.inputTokens / 1_000_000) * rate.in;
      rawCredits += (model.outputTokens / 1_000_000) * rate.out;
    }
  } else {
    const rate = resolveTokenRate();
    rawCredits += (snapshot.inputTokens / 1_000_000) * rate.in;
    rawCredits += (snapshot.outputTokens / 1_000_000) * rate.out;
  }

  return {
    rawCredits,
    roundedCredits: rawCredits > 0 ? Math.ceil(rawCredits) : 0
  };
}

export function calculateImageCredits(imageCount: number): number {
  if (!Number.isFinite(imageCount) || imageCount <= 0) return 0;
  return Math.max(0, Math.round(imageCount)) * appConfig.billing.imageCostCredits;
}

export function calculateUsageCharge(params: {
  usage?: UsageSnapshot | null;
  imageCount?: number;
}): {
  tokenCredits: number;
  imageCredits: number;
  totalCredits: number;
} {
  const tokenCredits = calculateTokenCredits(params.usage).roundedCredits;
  const imageCredits = calculateImageCredits(params.imageCount ?? 0);
  return {
    tokenCredits,
    imageCredits,
    totalCredits: tokenCredits + imageCredits
  };
}
