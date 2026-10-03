import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { appConfig } from "@/lib/config";
import { callGenericLlmJson } from "@/lib/llm/skill-client";
import { recordUsageFromPayload } from "@/lib/llm/usage-tracker";
import { splitSentences } from "@/lib/skills/utils";
import type { PublishFormat, PublishPlatform } from "@/lib/types/skills";
import {
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGE_CODES,
  normalizeLanguage,
  type SupportedLanguageCode
} from "@/lib/i18n/languages";

const TITLE_SUFFIX_PATTERNS: RegExp[] = [
  /\s*[-|｜]\s*[^-|｜]{1,24}(?:网|官网|首页|资讯|新闻|频道|博客|blog|news)\s*$/i,
  /\s*[-|｜]\s*[a-z0-9.-]+\.(?:com|cn|net|org|io|co|app|ai)\s*$/i,
  /\s*[-|｜]\s*(?:official\s+site|homepage|home)\s*$/i
];

const MAX_CONTENT_LENGTH = 20000;
const MAX_SOURCE_IMAGE_URLS = 16;
const INPUT_CLASSIFIER_TIMEOUT_MS = 4000;
const SOURCE_ADEQUACY_URL_CHAR_THRESHOLD = 2800;
const SOURCE_ADEQUACY_URL_WORD_THRESHOLD = 400;
const SOURCE_PACK_TARGET_CHARS = 3200;
const SOURCE_PACK_POINT_LIMIT = 6;
const SOURCE_PACK_SENTENCE_LIMIT = 6;
const LONG_TEXT_SOURCE_PACK_CHAR_THRESHOLD = 2600;
const LONG_TEXT_SOURCE_PACK_SENTENCE_THRESHOLD = 18;
const SOURCE_IMAGE_FALLBACK_WAIT_MS = 700;
type InputType = "text" | "url" | "mixed";

type SourceExtractionResult = { text: string; title?: string; imageUrls?: string[] };
type SourceResolverProvider = "jina" | "origin" | "youtube";
type UsableResolverOutcome = {
  provider: SourceResolverProvider;
  result: SourceExtractionResult;
};

type InputClassification = {
  type: InputType;
  urls: string[];
  text: string;
};

type SourceAdequacyAssessment = {
  adequate?: boolean;
  confidence?: "high" | "medium" | "low";
  reason?: string;
  user_message?: string;
  has_explicit_output_language?: boolean;
  language_code?: string;
};

export type PlannerSourcePack = {
  text: string;
  mode: "full" | "condensed";
  sourceChars: number;
  plannerChars: number;
  sectionCount: number;
  pointCount: number;
  recommendedQuickSlides: number;
};

const SOURCE_ADEQUACY_MAX_ATTEMPTS = 3;
const SOURCE_ADEQUACY_RETRY_DELAYS_MS = [250, 700];
const URL_FETCH_TIMEOUT_MS = 12_000;
const CURL_FETCH_TIMEOUT_MS = 15_000;
const DIRECT_IMAGE_URL_EXTENSION_PATTERN = /\.(?:avif|bmp|gif|jpe?g|png|webp)(?:[?#].*)?$/i;
const BROWSER_LIKE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9"
};
const execFileAsync = promisify(execFile);

const URL_PATTERN = /(https?:\/\/[^\s)]+|www\.[^\s)]+)/gi;

function cleanText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function normalizeMultilineText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function countWords(raw: string): number {
  return normalizeMultilineText(raw)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .length;
}

function truncateSoft(raw: string, maxChars: number): string {
  const normalized = cleanText(raw);
  if (!normalized) return "";
  if (normalized.length <= maxChars) return normalized;

  const head = normalized.slice(0, maxChars + 1);
  const boundary = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "), head.lastIndexOf(" "));
  if (boundary >= Math.floor(maxChars * 0.55)) {
    return head.slice(0, boundary + 1).trim();
  }

  return `${normalized.slice(0, maxChars - 1).trim()}...`;
}

function splitSourceSections(raw: string): string[] {
  const normalized = normalizeMultilineText(raw);
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((item) => cleanText(item))
    .filter(Boolean);

  if (paragraphs.length >= 3) {
    return paragraphs;
  }

  const sentences = splitSentences(normalized);
  if (sentences.length <= 3) {
    return normalized ? [normalized] : [];
  }

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > 260 && current) {
      chunks.push(current);
      current = sentence;
      continue;
    }
    current = candidate;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.filter(Boolean);
}

function scoreSourceSection(section: string, index: number, total: number): number {
  const normalized = cleanText(section);
  const lengthScore = Math.min(140, normalized.length);
  const positionBonus = index === 0 ? 30 : index < Math.min(3, total) ? 18 : 0;
  const structureBonus =
    (/:/.test(normalized) ? 18 : 0) +
    (/\d/.test(normalized) ? 10 : 0) +
    (/(first|second|third|step|framework|because|however|therefore|for example)/i.test(normalized) ? 12 : 0);
  const noisePenalty = normalized.length < 80 ? 28 : 0;
  return lengthScore + positionBonus + structureBonus - noisePenalty;
}

function pickSourcePackPoints(sections: string[]): string[] {
  return sections
    .map((section, index) => ({
      index,
      section: truncateSoft(section, 320),
      score: scoreSourceSection(section, index, sections.length)
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, SOURCE_PACK_POINT_LIMIT)
    .sort((left, right) => left.index - right.index)
    .map((item) => item.section)
    .filter(Boolean);
}

function pickSourcePackHighlights(points: string[]): string[] {
  return Array.from(
    new Set(
      points.flatMap((point) =>
        splitSentences(point)
          .map((sentence) => truncateSoft(sentence, 220))
          .filter(Boolean)
      )
    )
  ).slice(0, SOURCE_PACK_SENTENCE_LIMIT);
}

function shouldCondenseForPlanner(params: {
  content: string;
  sourceType: "url" | "text";
  sections: string[];
}): boolean {
  if (params.sourceType === "url") {
    return true;
  }

  const normalized = normalizeMultilineText(params.content);
  const sourceChars = normalized.length;
  const sentenceCount = splitSentences(normalized).length;

  return (
    sourceChars >= LONG_TEXT_SOURCE_PACK_CHAR_THRESHOLD ||
    sentenceCount >= LONG_TEXT_SOURCE_PACK_SENTENCE_THRESHOLD ||
    params.sections.length >= 5
  );
}

export function buildPlannerSourcePack(params: {
  content: string;
  sourceType: "url" | "text";
  sourceTitle?: string;
  sourceUrl?: string;
}): PlannerSourcePack {
  const normalizedContent = normalizeMultilineText(params.content);
  const sourceChars = normalizedContent.length;
  const sections = splitSourceSections(normalizedContent);
  const shouldCondense = shouldCondenseForPlanner({
    content: normalizedContent,
    sourceType: params.sourceType,
    sections
  });
  const title = cleanTitleCandidate(params.sourceTitle ?? tryExtractTitle(normalizedContent) ?? "");

  if (!shouldCondense) {
    return {
      text: normalizedContent,
      mode: "full",
      sourceChars,
      plannerChars: normalizedContent.length,
      sectionCount: sections.length || (normalizedContent ? 1 : 0),
      pointCount: sections.length || (normalizedContent ? 1 : 0),
      recommendedQuickSlides: sourceChars >= 1400 ? 4 : 3
    };
  }

  const selectedPoints = pickSourcePackPoints(sections.length ? sections : [normalizedContent]);
  const highlights = pickSourcePackHighlights(selectedPoints);
  const lead = highlights[0] ?? truncateSoft(sections[0] ?? normalizedContent, 240);
  const lines: string[] = [];

  if (title) lines.push(`Source title: ${title}`);
  if (params.sourceUrl) lines.push(`Source URL: ${params.sourceUrl}`);
  lines.push(`Source type: ${params.sourceType}`);
  if (lead) lines.push(`Core thesis: ${lead}`);

  if (selectedPoints.length) {
    lines.push("Key points:");
    for (const [index, point] of selectedPoints.entries()) {
      lines.push(`${index + 1}. ${point}`);
    }
  }

  if (highlights.length > 1) {
    lines.push("Supporting highlights:");
    for (const highlight of highlights.slice(1)) {
      lines.push(`- ${highlight}`);
    }
  }

  let packText = normalizeMultilineText(lines.join("\n"));
  if (packText.length > SOURCE_PACK_TARGET_CHARS) {
    packText = truncateSoft(packText, SOURCE_PACK_TARGET_CHARS);
  }

  const recommendedQuickSlides =
    params.sourceType === "url" || selectedPoints.length >= 4 || sourceChars >= LONG_TEXT_SOURCE_PACK_CHAR_THRESHOLD
      ? 4
      : 3;

  return {
    text: packText,
    mode: "condensed",
    sourceChars,
    plannerChars: packText.length,
    sectionCount: sections.length || (normalizedContent ? 1 : 0),
    pointCount: selectedPoints.length || highlights.length || (normalizedContent ? 1 : 0),
    recommendedQuickSlides
  };
}

export function shouldSkipSourceAdequacyAssessment(params: {
  content: string;
  sourceType: "url" | "text";
}): boolean {
  if (params.sourceType !== "url") {
    return false;
  }

  const normalized = normalizeMultilineText(params.content);
  const compactChars = normalized.replace(/\s+/g, "").length;
  const words = countWords(normalized);

  return compactChars >= SOURCE_ADEQUACY_URL_CHAR_THRESHOLD || words >= SOURCE_ADEQUACY_URL_WORD_THRESHOLD;
}

async function settleFirstUsableSource(tasks: Array<Promise<UsableResolverOutcome | null>>): Promise<UsableResolverOutcome | null> {
  if (!tasks.length) return null;

  return new Promise((resolve) => {
    let pending = tasks.length;
    let settled = false;

    const onComplete = (outcome: UsableResolverOutcome | null) => {
      if (settled) return;
      if (outcome) {
        settled = true;
        resolve(outcome);
        return;
      }
      pending -= 1;
      if (pending <= 0) {
        settled = true;
        resolve(null);
      }
    };

    for (const task of tasks) {
      task.then(onComplete).catch(() => onComplete(null));
    }
  });
}

async function mergeNearbySourceImages(
  picked: UsableResolverOutcome,
  tasks: Array<Promise<UsableResolverOutcome | null>>
): Promise<UsableResolverOutcome> {
  if (picked.result.imageUrls?.length) return picked;

  const settled = await Promise.race([
    Promise.allSettled(tasks),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), SOURCE_IMAGE_FALLBACK_WAIT_MS))
  ]);
  if (!settled) return picked;

  const imageUrls = settled.flatMap((result) => {
    if (result.status !== "fulfilled") return [];
    return result.value?.result.imageUrls ?? [];
  });
  if (!imageUrls.length) return picked;

  return {
    ...picked,
    result: {
      ...picked.result,
      imageUrls: uniqueImageUrls(imageUrls)
    }
  };
}

function normalizeResolverResult(
  provider: SourceResolverProvider,
  result: SourceExtractionResult | null
): UsableResolverOutcome | null {
  if (!result) return null;
  return { provider, result };
}

async function resolveUrlSource(url: string): Promise<UsableResolverOutcome | null> {
  const jinaTask = fetchFromJinaReader(url).then((result) => normalizeResolverResult("jina", result));
  const originTask = fetchFromOrigin(url).then((result) => normalizeResolverResult("origin", result));
  const tasks = [jinaTask, originTask];

  const picked = await settleFirstUsableSource(tasks);
  if (picked) {
    const merged = await mergeNearbySourceImages(picked, tasks);
    console.info(`[resolve-input] pick url=${url} provider=${merged.provider}`);
    return merged;
  }

  const youtubeResult = normalizeResolverResult("youtube", await fetchFromYouTubeMetadata(url));
  console.info(
    `[resolve-input] pick url=${url} provider=${youtubeResult?.provider ?? "none"} after=jina+origin-unusable`
  );
  return youtubeResult;
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim().replace(/[),.;]+$/, "");
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("www.")) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function uniqueUrls(urls: string[]): string[] {
  return Array.from(new Set(urls.map(normalizeUrl).filter(Boolean)));
}

function extractUrls(input: string): string[] {
  const found = input.match(URL_PATTERN) ?? [];
  return uniqueUrls(found);
}

function removeUrls(input: string): string {
  return cleanText(input.replace(URL_PATTERN, " "));
}

function toClassificationByHeuristic(input: string): InputClassification {
  const urls = extractUrls(input);
  const text = removeUrls(input);

  if (!urls.length) {
    return { type: "text", urls: [], text: cleanText(input) };
  }

  if (text.length > 20) {
    return { type: "mixed", urls, text };
  }

  return { type: "url", urls, text: "" };
}

function stripHtml(html: string): string {
  const withoutScript = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");

  const text = withoutScript
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return cleanText(text);
}

function cleanTitleCandidate(rawTitle: string): string {
  let title = cleanText(rawTitle)
    .replace(/^#+\s*/, "")
    .replace(/[`*_]/g, "");

  for (const pattern of TITLE_SUFFIX_PATTERNS) {
    title = title.replace(pattern, "").trim();
  }

  return title;
}

function extractTitleFromHtml(html: string): string | undefined {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!titleMatch) return undefined;

  const title = cleanTitleCandidate(titleMatch[1]);
  if (title.length >= 8 && title.length <= 140) {
    return title;
  }

  return undefined;
}

function extractMetaContent(html: string, key: string): string | undefined {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escapedKey}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escapedKey}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+itemprop=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']${escapedKey}["'][^>]*>`, "i")
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const normalized = cleanText(match[1]);
      if (normalized) return normalized;
    }
  }

  return undefined;
}

function isUsableImageUrl(value: string): boolean {
  if (!value) return false;
  if (!/^https?:\/\//i.test(value)) return false;
  if (/^(data|blob):/i.test(value)) return false;
  return !/\.(?:svg)(?:[?#].*)?$/i.test(value);
}

function isLikelyDirectImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return DIRECT_IMAGE_URL_EXTENSION_PATTERN.test(url.pathname);
  } catch {
    return false;
  }
}

function isDirectImageResponse(contentType: string, url: string): boolean {
  const normalized = contentType.toLowerCase();
  if (normalized.startsWith("image/")) return !normalized.includes("svg");
  if (normalized.includes("text/html")) return false;
  return isLikelyDirectImageUrl(url);
}

function normalizeImageUrl(raw: string, baseUrl?: string): string | undefined {
  const cleaned = raw
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/&amp;/g, "&");
  if (!cleaned || cleaned.startsWith("data:") || cleaned.startsWith("blob:")) return undefined;

  try {
    const absolute = baseUrl ? new URL(cleaned, baseUrl).toString() : new URL(cleaned).toString();
    return isUsableImageUrl(absolute) ? absolute : undefined;
  } catch {
    return undefined;
  }
}

function collectImageUrl(candidates: string[], raw: unknown, baseUrl?: string): void {
  if (typeof raw !== "string") return;
  const normalized = normalizeImageUrl(raw, baseUrl);
  if (normalized) candidates.push(normalized);
}

function readJsonLdTypeNames(record: Record<string, unknown>): string[] {
  const rawType = record["@type"] ?? record.type;
  const values = Array.isArray(rawType) ? rawType : [rawType];
  return values
    .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
    .filter(Boolean);
}

function isJsonLdImageObject(record: Record<string, unknown>): boolean {
  return readJsonLdTypeNames(record).some((type) => (
    type === "imageobject"
    || type === "photograph"
    || type === "photo"
  ));
}

function readImageFromJsonLd(value: unknown, options?: { allowUrl?: boolean }): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => readImageFromJsonLd(item, options));
  if (typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const direct = readImageFromJsonLd(record.image, { allowUrl: true });
  const nested = ["photo", "photos", "thumbnail", "thumbnailUrl", "contentUrl"]
    .flatMap((key) => readImageFromJsonLd(record[key], { allowUrl: true }));
  const objectUrl = options?.allowUrl || isJsonLdImageObject(record)
    ? readImageFromJsonLd(record.url, { allowUrl: true })
    : [];
  return [...direct, ...nested, ...objectUrl];
}

function extractJsonLdImageUrls(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      for (const candidate of readImageFromJsonLd(parsed)) {
        collectImageUrl(urls, candidate, baseUrl);
      }
    } catch {
      // Ignore malformed structured data.
    }
  }
  return urls;
}

function extractSrcsetImageUrls(srcset: string, baseUrl: string): string[] {
  return srcset
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .map((candidate) => normalizeImageUrl(candidate, baseUrl))
    .filter((candidate): candidate is string => Boolean(candidate));
}

function isSameSourcePageUrl(candidate: string, sourceUrl?: string): boolean {
  if (!sourceUrl || isLikelyDirectImageUrl(candidate)) return false;
  try {
    const candidateUrl = new URL(candidate);
    const parsedSourceUrl = new URL(sourceUrl);
    const normalizePath = (value: string) => value.replace(/\/+$/, "") || "/";
    return candidateUrl.origin === parsedSourceUrl.origin
      && normalizePath(candidateUrl.pathname) === normalizePath(parsedSourceUrl.pathname);
  } catch {
    return false;
  }
}

function uniqueImageUrls(urls: string[], sourceUrl?: string): string[] {
  return Array.from(new Set(
    urls.filter((url) => isUsableImageUrl(url) && !isSameSourcePageUrl(url, sourceUrl))
  )).slice(0, MAX_SOURCE_IMAGE_URLS);
}

function extractImageUrlsFromHtml(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  [
    "og:image",
    "og:image:url",
    "og:image:secure_url",
    "twitter:image",
    "twitter:image:src"
  ].forEach((key) => collectImageUrl(urls, extractMetaContent(html, key), baseUrl));

  urls.push(...extractJsonLdImageUrls(html, baseUrl));

  const imageTags = html.matchAll(/<img\b[^>]*>/gi);
  for (const tagMatch of imageTags) {
    const tag = tagMatch[0];
    const src = tag.match(/\s(?:src|data-src)=["']([^"']+)["']/i)?.[1];
    collectImageUrl(urls, src, baseUrl);

    const srcset = tag.match(/\s(?:srcset|data-srcset)=["']([^"']+)["']/i)?.[1];
    if (srcset) urls.push(...extractSrcsetImageUrls(srcset, baseUrl));
  }

  return uniqueImageUrls(urls, baseUrl);
}

function extractImageUrlsFromMarkdown(raw: string, sourceUrl?: string): string[] {
  const urls: string[] = [];
  const markdownImages = raw.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g);
  for (const match of markdownImages) {
    collectImageUrl(urls, match[1]);
  }

  const imageLines = raw.matchAll(/^Image:\s*(https?:\/\/\S+)/gim);
  for (const match of imageLines) {
    collectImageUrl(urls, match[1]);
  }

  return uniqueImageUrls(urls, sourceUrl);
}

function buildGenericMetadataFallbackText(params: {
  title?: string;
  description?: string;
  author?: string;
  siteName?: string;
  publishedAt?: string;
  url: string;
}): string {
  const lines: string[] = [`Source URL: ${params.url}`];
  if (params.title) lines.push(`Page title: ${params.title}`);
  if (params.siteName) lines.push(`Site: ${params.siteName}`);
  if (params.author) lines.push(`Author: ${params.author}`);
  if (params.publishedAt) lines.push(`Published: ${params.publishedAt}`);
  if (params.description) lines.push(`Description: ${params.description}`);
  return lines.join("\n");
}

function buildDirectImageFallbackText(url: string): string {
  const lines = [
    `Source URL: ${url}`,
    "Source type: Direct image URL",
    "Description: The input is a direct image link. Use the linked image as a visual reference."
  ];
  return lines.join("\n");
}

function isYouTubeUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "youtu.be" || hostname.endsWith("youtube.com") || hostname.endsWith("youtube-nocookie.com");
  } catch {
    return false;
  }
}

type YoutubeStructuredMetadata = {
  title?: string;
  description?: string;
  author?: string;
  publishedAt?: string;
};

function parseYoutubeStructuredMetadata(html: string): YoutubeStructuredMetadata | null {
  const blocks = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));

  for (const block of blocks) {
    const payload = safeJsonParse<unknown>(block[1]);
    const candidates = Array.isArray(payload) ? payload : [payload];
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "object") continue;
      const record = candidate as Record<string, unknown>;
      const typeValue = typeof record["@type"] === "string" ? record["@type"] : "";
      if (typeValue !== "VideoObject") continue;

      const author =
        typeof record.author === "string"
          ? cleanText(record.author)
          : record.author && typeof record.author === "object"
            ? cleanText(String((record.author as Record<string, unknown>).name ?? ""))
            : "";

      return {
        title: cleanText(String(record.name ?? "")) || undefined,
        description: cleanText(String(record.description ?? "")) || undefined,
        author: author || undefined,
        publishedAt: cleanText(String(record.uploadDate ?? "")) || undefined
      };
    }
  }

  return null;
}

function buildYoutubeFallbackText(params: {
  title?: string;
  description?: string;
  author?: string;
  publishedAt?: string;
}): string {
  const lines: string[] = [];
  if (params.title) {
    lines.push(`Video title: ${params.title}`);
  }
  if (params.author) {
    lines.push(`Channel: ${params.author}`);
  }
  if (params.publishedAt) {
    lines.push(`Published: ${params.publishedAt}`);
  }
  if (params.description) {
    lines.push(`Description: ${params.description}`);
  }
  return lines.join("\n");
}

async function fetchFromYouTubeMetadata(url: string): Promise<SourceExtractionResult | null> {
  if (!isYouTubeUrl(url)) return null;

  try {
    console.info(`[resolve-input] youtube:start url=${url}`);
    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: BROWSER_LIKE_HEADERS,
      cache: "no-store"
    }, URL_FETCH_TIMEOUT_MS);

    console.info(`[resolve-input] youtube:response url=${url} status=${response.status}`);
    if (!response.ok) return null;

    const raw = await response.text();
    const structured = parseYoutubeStructuredMetadata(raw);
    const title =
      structured?.title
      || extractMetaContent(raw, "og:title")
      || extractMetaContent(raw, "twitter:title")
      || extractTitleFromHtml(raw);
    const description =
      structured?.description
      || extractMetaContent(raw, "og:description")
      || extractMetaContent(raw, "twitter:description")
      || extractMetaContent(raw, "description");
    const author =
      structured?.author
      || extractMetaContent(raw, "author")
      || extractMetaContent(raw, "itemprop:author");
    const publishedAt =
      structured?.publishedAt
      || extractMetaContent(raw, "datePublished");

    const text = buildYoutubeFallbackText({
      title,
      description,
      author,
      publishedAt
    });

    if (!text || text.length < 40) {
      console.warn(`[resolve-input] youtube:insufficient url=${url}`);
      return null;
    }

    console.info(`[resolve-input] youtube:ok url=${url} title=${title ?? ""} chars=${text.length}`);
    return {
      text: text.slice(0, MAX_CONTENT_LENGTH),
      title: title || undefined
    };
  } catch (error) {
    console.warn(
      `[resolve-input] youtube:failed url=${url} message=${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

function extractReadableBodyFromJina(raw: string): string {
  const normalized = normalizeMultilineText(raw);
  const lines = normalized.split("\n");

  const markdownContentIndex = lines.findIndex((line) => /^Markdown Content:?$/i.test(line.trim()));
  const bodyLines = (markdownContentIndex >= 0 ? lines.slice(markdownContentIndex + 1) : lines).map((line) =>
    line
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );

  const NOISE_PATTERNS = [
    /^Title:\s*/i,
    /^Page Title:\s*/i,
    /^URL Source:\s*/i,
    /^URL:\s*/i,
    /^Published Time:\s*/i,
    /^Domain:\s*/i,
    /^Image:\s*/i,
    /^Warning:\s*/i,
    /^[=-]{3,}$/,
    /^[_*`~|]+$/,
    /javascript:/i,
    /^(关注|热搜词|相关文章|更多|首页)\s*$/i,
    /^(本文来自|作者[:：]|题图来自)/i
  ];

  const isNoiseLine = (line: string): boolean => {
    if (!line) return true;
    if (line.length < 6) return true;
    if (NOISE_PATTERNS.some((pattern) => pattern.test(line))) return true;
    return false;
  };

  const nonNoiseLines = bodyLines.filter((line) => !isNoiseLine(line));
  return cleanText(nonNoiseLines.join("\n"));
}

function tryExtractTitle(text: string): string | undefined {
  const lines = normalizeMultilineText(text).split("\n").map((line) => cleanText(line));

  const pageTitleLine = lines.find((line) => line.startsWith("Page Title:"));
  if (pageTitleLine) {
    const title = cleanTitleCandidate(pageTitleLine.replace(/^Page Title:\s*/, ""));
    if (title.length >= 8 && title.length <= 140) return title;
  }

  const jinaTitle = lines.find((line) => line.startsWith("Title:"));
  if (jinaTitle) {
    const title = cleanTitleCandidate(jinaTitle.replace(/^Title:\s*/, ""));
    if (title.length >= 8 && title.length <= 140) return title;
  }

  const firstReadable = lines.find((line) => line.length >= 8 && line.length <= 140);
  if (!firstReadable) return undefined;

  const fallback = cleanTitleCandidate(firstReadable);
  return fallback.length >= 8 && fallback.length <= 140 ? fallback : undefined;
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function classifyInputWithLlm(input: string): Promise<InputClassification | null> {
  if (!appConfig.llm.apiUrl) return null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (appConfig.llm.apiKey) {
    headers.Authorization = `Bearer ${appConfig.llm.apiKey}`;
  }

  const system = [
    "You classify user input for content automation.",
    "Return strict JSON only:",
    '{"type":"text|url|mixed","urls":["https://..."],"text":"..."}.',
    "type=url means mostly URL(s) without meaningful prose.",
    "type=mixed means prose + URL(s).",
    "text must not include URLs."
  ].join(" ");

  try {
    const response = await fetchWithTimeout(
      appConfig.llm.apiUrl,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: appConfig.llm.model,
          temperature: 0,
          messages: [
            { role: "system", content: system },
            { role: "user", content: input }
          ]
        }),
        cache: "no-store"
      },
      Math.max(1000, Math.min(appConfig.llm.timeoutMs, INPUT_CLASSIFIER_TIMEOUT_MS))
    );

    if (!response.ok) return null;

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      output_text?: string;
      usage?: unknown;
      model?: string;
    };
    recordUsageFromPayload({
      model: appConfig.llm.model,
      payload: data
    });

    const llmContent = data.choices?.[0]?.message?.content ?? data.output_text;
    if (!llmContent) return null;

    const parsed = safeJsonParse<Partial<InputClassification>>(extractJsonPayload(llmContent));
    if (!parsed) return null;

    const mergedUrls = uniqueUrls([
      ...extractUrls(input),
      ...(Array.isArray(parsed.urls) ? parsed.urls.map((url) => String(url)) : [])
    ]);

    const parsedType: InputType = parsed.type === "url" || parsed.type === "mixed" ? parsed.type : "text";
    const parsedText = typeof parsed.text === "string" ? cleanText(parsed.text) : "";
    const text = parsedText || removeUrls(input);

    if (!mergedUrls.length) {
      return { type: "text", urls: [], text: cleanText(input) };
    }

    if (parsedType === "url" && text.length > 20) {
      return { type: "mixed", urls: mergedUrls, text };
    }

    return { type: parsedType, urls: mergedUrls, text };
  } catch {
    return null;
  }
}

async function fetchMarkdownFromUrl(url: string): Promise<string> {
  try {
    console.info(`[resolve-input] jina:start url=${url}`);
    const headers: Record<string, string> = {
      Accept: "text/plain"
    };
    const jinaApiKey = process.env.JINA_API_KEY?.trim();
    if (jinaApiKey) {
      headers.Authorization = `Bearer ${jinaApiKey}`;
    }
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers,
      cache: "no-store"
    });

    if (!response.ok) throw new Error(`Jina error: ${response.status}`);
    const text = await response.text();
    console.info(`[resolve-input] jina:ok url=${url} chars=${text.length}`);
    return text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Jina] Reader unavailable for ${url}: ${message}`);
    return "";
  }
}

async function fetchFromJinaReader(url: string): Promise<SourceExtractionResult | null> {
  const raw = normalizeMultilineText(await fetchMarkdownFromUrl(url));
  if (!raw || raw.replace(/\s+/g, "").length < 200) return null;

  const imageUrls = extractImageUrlsFromMarkdown(raw, url);
  const text = extractReadableBodyFromJina(raw) || cleanText(raw);
  if (!text || text.length < 120) return null;

  return {
    text: text.slice(0, MAX_CONTENT_LENGTH),
    title: tryExtractTitle(raw),
    imageUrls
  };
}

async function fetchFromOrigin(url: string): Promise<SourceExtractionResult | null> {
  try {
    console.info(`[resolve-input] origin:start url=${url}`);
    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: BROWSER_LIKE_HEADERS,
      cache: "no-store"
    }, URL_FETCH_TIMEOUT_MS);

    console.info(
      `[resolve-input] origin:response url=${url} status=${response.status} contentType=${response.headers.get("content-type") ?? ""}`
    );
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (isDirectImageResponse(contentType, url)) {
      const imageUrls = uniqueImageUrls([url]);
      if (imageUrls.length) {
        console.info(`[resolve-input] origin:direct-image url=${url} contentType=${contentType}`);
        return {
          text: buildDirectImageFallbackText(url).slice(0, MAX_CONTENT_LENGTH),
          imageUrls
        };
      }
    }

    const raw = await response.text();
    const imageUrls = contentType.includes("text/html") ? extractImageUrlsFromHtml(raw, url) : [];
    const text = contentType.includes("text/html") ? stripHtml(raw) : cleanText(raw);
    const title = contentType.includes("text/html") ? extractTitleFromHtml(raw) : undefined;

    if (contentType.includes("text/html")) {
      const description =
        extractMetaContent(raw, "og:description")
        || extractMetaContent(raw, "twitter:description")
        || extractMetaContent(raw, "description");
      const author =
        extractMetaContent(raw, "author")
        || extractMetaContent(raw, "article:author");
      const siteName = extractMetaContent(raw, "og:site_name");
      const publishedAt =
        extractMetaContent(raw, "article:published_time")
        || extractMetaContent(raw, "datePublished");

      if ((!text || text.length < 120) && (title || description)) {
        const fallbackText = buildGenericMetadataFallbackText({
          url,
          title,
          description,
          author,
          siteName,
          publishedAt
        });

        if (fallbackText.length >= 40) {
          console.info(`[resolve-input] origin:metadata-fallback url=${url} title=${title ?? ""} chars=${fallbackText.length}`);
          return {
            text: fallbackText.slice(0, MAX_CONTENT_LENGTH),
            title,
            imageUrls
          };
        }
      }
    }

    if (!text || text.length < 120) {
      console.warn(`[resolve-input] origin:insufficient-text url=${url} chars=${text.length}`);
      return null;
    }

    console.info(`[resolve-input] origin:ok url=${url} title=${title ?? ""} chars=${text.length}`);
    return {
      text: text.slice(0, MAX_CONTENT_LENGTH),
      title,
      imageUrls
    };
  } catch (error) {
    console.warn(
      `[resolve-input] origin:failed url=${url} message=${error instanceof Error ? error.message : String(error)}`
    );
  }

  try {
    console.info(`[resolve-input] curl:start url=${url}`);
    const args = [
      "-L",
      "--silent",
      "--show-error",
      "--max-time",
      String(Math.ceil(CURL_FETCH_TIMEOUT_MS / 1000)),
      "-A",
      BROWSER_LIKE_HEADERS["User-Agent"],
      "-H",
      `Accept: ${BROWSER_LIKE_HEADERS.Accept}`,
      "-H",
      `Accept-Language: ${BROWSER_LIKE_HEADERS["Accept-Language"]}`,
      url
    ];
    const { stdout } = await execFileAsync("curl", args, {
      timeout: CURL_FETCH_TIMEOUT_MS,
      maxBuffer: 2 * 1024 * 1024
    });

    const raw = String(stdout ?? "");
    if (!raw.trim()) {
      console.warn(`[resolve-input] curl:empty url=${url}`);
      return null;
    }

    const imageUrls = extractImageUrlsFromHtml(raw, url);
    const title = extractTitleFromHtml(raw);
    const text = stripHtml(raw);
    if (text.length >= 120) {
      console.info(`[resolve-input] curl:ok url=${url} title=${title ?? ""} chars=${text.length}`);
      return {
        text: text.slice(0, MAX_CONTENT_LENGTH),
        title,
        imageUrls
      };
    }

    const description =
      extractMetaContent(raw, "og:description")
      || extractMetaContent(raw, "twitter:description")
      || extractMetaContent(raw, "description");
    const author =
      extractMetaContent(raw, "author")
      || extractMetaContent(raw, "article:author");
    const siteName = extractMetaContent(raw, "og:site_name");
    const publishedAt =
      extractMetaContent(raw, "article:published_time")
      || extractMetaContent(raw, "datePublished");
    const fallbackText = buildGenericMetadataFallbackText({
      url,
      title,
      description,
      author,
      siteName,
      publishedAt
    });

    if (fallbackText.length >= 40) {
      console.info(`[resolve-input] curl:metadata-fallback url=${url} title=${title ?? ""} chars=${fallbackText.length}`);
      return {
        text: fallbackText.slice(0, MAX_CONTENT_LENGTH),
        title,
        imageUrls
      };
    }

    console.warn(`[resolve-input] curl:insufficient-text url=${url} chars=${text.length}`);
    return null;
  } catch (error) {
    console.warn(
      `[resolve-input] curl:failed url=${url} message=${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

export async function assessResolvedSourceAdequacy(params: {
  content: string;
  sourceType: "url" | "text";
  sourceUrl?: string;
  sourceTitle?: string;
  originalInput: string;
  outputLanguage?: string;
  explicitLanguageOverrideHint?: SupportedLanguageCode | null;
  platform?: PublishPlatform;
  platforms?: PublishPlatform[];
  format?: PublishFormat;
  imageCount?: number;
  targetSlides?: number;
}): Promise<SourceAdequacyAssessment | null> {
  const contentExcerpt = params.content.slice(0, 3200);
  const originalExcerpt = normalizeMultilineText(params.originalInput).slice(0, 800);
  const languageOptions = SUPPORTED_LANGUAGE_CODES.map((code) => `${code}: ${LANGUAGE_LABELS[code]}`);

  for (let attempt = 0; attempt < SOURCE_ADEQUACY_MAX_ATTEMPTS; attempt += 1) {
    const assessment = await callGenericLlmJson<SourceAdequacyAssessment>({
      instruction: [
        "You evaluate whether source material is sufficient to support a high-quality social content generation task.",
        "Judge adequacy based on the requested output, not just text length.",
        "The source is adequate when it contains enough coherent substance, facts, argument, explanation, or structure to create a credible result for the requested platform and format.",
        "The source is inadequate when it is only a greeting, a vague instruction, a single isolated fact, a short note with too little context, a login wall, an error page, navigation junk, or any text that lacks enough substance for a strong result.",
        "A short but self-contained paragraph may be adequate for a short post, but usually not for a richer carousel or multi-slide output.",
        "In the same pass, determine whether the user explicitly asks for the final output to be written in a specific language.",
        "Only mark has_explicit_output_language=true when the user clearly instructs the final output language.",
        "Do not infer an output-language override merely because the source text itself is written in that language.",
        "If there is an explicit language instruction, choose one language_code from the supported list only.",
        "If the source is inadequate, set adequate=false and write a short, polite user_message asking for the missing input: for example more context, the full article, a richer summary, or another accessible link.",
        "Do not mention internal systems, parsing, scoring, or LLMs in user_message.",
        "Return strict JSON only."
      ].join(" "),
      input: {
        source_type: params.sourceType,
        source_url: params.sourceUrl,
        source_title: params.sourceTitle,
        requested_output: {
          platform: params.platform,
          platforms: params.platforms?.length ? params.platforms : undefined,
          format: params.format,
          image_count: params.imageCount,
          target_slides: params.targetSlides,
          selected_output_language: params.outputLanguage
        },
        explicit_output_language_hint: params.explicitLanguageOverrideHint ?? undefined,
        supported_languages: languageOptions,
        original_input_excerpt: originalExcerpt,
        resolved_source_excerpt: contentExcerpt
      },
      outputSchemaHint:
        '{"adequate":true,"confidence":"high","reason":"The source contains enough coherent detail for the requested output.","user_message":"","has_explicit_output_language":false,"language_code":"en-US"}',
      outputLanguage: params.outputLanguage ?? "en",
      temperature: 0,
      fallbackModels: [appConfig.llm.copyFallbackModel],
      debugLabel: "source-adequacy-assessment"
    });

    if (assessment) {
      return assessment;
    }

    if (attempt < SOURCE_ADEQUACY_RETRY_DELAYS_MS.length) {
      await new Promise((resolve) => setTimeout(resolve, SOURCE_ADEQUACY_RETRY_DELAYS_MS[attempt]));
    }
  }

  return null;
}

export function normalizeAdequacyLanguageCode(value?: string | null): SupportedLanguageCode | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return normalizeLanguage(normalized);
}

export async function resolveInputContent(input: string): Promise<{
  content: string;
  sourceType: "url" | "text";
  sourceUrl?: string;
  sourceTitle?: string;
  sourceImageUrls?: string[];
}> {
  const raw = normalizeMultilineText(input);
  const heuristic = toClassificationByHeuristic(raw);

  // Pure text inputs do not need an extra model classification round.
  if (heuristic.type === "text") {
    return {
      content: cleanText(heuristic.text || raw).slice(0, MAX_CONTENT_LENGTH),
      sourceType: "text"
    };
  }

  const classified = (await classifyInputWithLlm(raw)) ?? heuristic;
  console.info(
    `[resolve-input] classify type=${classified.type} urls=${classified.urls.length} textChars=${classified.text.length}`
  );

  if (classified.type === "text" || classified.urls.length === 0) {
    return {
      content: cleanText(classified.text || raw).slice(0, MAX_CONTENT_LENGTH),
      sourceType: "text"
    };
  }

  const contentParts: string[] = [];
  let sourceTitle: string | undefined;
  const sourceImageUrls: string[] = [];

  if (classified.type === "mixed" && classified.text) {
    contentParts.push(classified.text);
  }

  for (const url of classified.urls) {
    const picked = await resolveUrlSource(url);
    if (!picked) continue;
    if (!sourceTitle) sourceTitle = picked.result.title;
    sourceImageUrls.push(...(picked.result.imageUrls ?? []));

    contentParts.push(`Source URL: ${url}\n${picked.result.text}`);
  }

  const merged = cleanText(contentParts.join("\n\n")).slice(0, MAX_CONTENT_LENGTH);
  if (!merged) {
    console.warn(`[resolve-input] merged-empty urls=${classified.urls.join(",")}`);
    const primaryUrl = classified.urls[0];
    const fallbackTitle = (() => {
      try {
        const parsed = new URL(primaryUrl);
        const slug = parsed.pathname.split("/").filter(Boolean).pop() ?? parsed.hostname.replace(/^www\./i, "");
        return slug
          .replace(/[-_]+/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase())
          .trim();
      } catch {
        return undefined;
      }
    })();

    return {
      content: buildGenericMetadataFallbackText({
        url: primaryUrl,
        title: fallbackTitle,
        description: "The page content could not be fully extracted. Use the available metadata and ask for more detail if needed."
      }).slice(0, MAX_CONTENT_LENGTH),
      sourceType: "url",
      sourceUrl: primaryUrl,
      sourceTitle: fallbackTitle,
      sourceImageUrls: []
    };
  }

  return {
    content: merged,
    sourceType: "url",
    sourceUrl: classified.urls[0],
    sourceTitle: sourceTitle ?? tryExtractTitle(merged),
    sourceImageUrls: uniqueImageUrls(sourceImageUrls)
  };
}
