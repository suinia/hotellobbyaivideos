export const LANGUAGE_LABELS = {
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  "en-US": "English",
  "ko-KR": "한국어",
  "ja-JP": "日本語",
  "vi-VN": "Tiếng Việt",
  "th-TH": "ไทย",
  "id-ID": "Indonesia",
  "de-DE": "Deutsch",
  "es-ES": "Español",
  "ru-RU": "Русский",
  "pt-BR": "Português",
  "fr-FR": "Français",
  "pl-PL": "Polski"
} as const;

export type SupportedLanguageCode = keyof typeof LANGUAGE_LABELS;

export const SUPPORTED_LANGUAGE_CODES = Object.keys(LANGUAGE_LABELS) as SupportedLanguageCode[];

export const DEFAULT_LANGUAGE: SupportedLanguageCode = "en-US";

const PRIMARY_LANGUAGE_FALLBACK: Record<string, SupportedLanguageCode> = {
  zh: "zh-CN",
  en: "en-US",
  ko: "ko-KR",
  ja: "ja-JP",
  vi: "vi-VN",
  th: "th-TH",
  id: "id-ID",
  de: "de-DE",
  es: "es-ES",
  ru: "ru-RU",
  pt: "pt-BR",
  fr: "fr-FR",
  pl: "pl-PL"
};

const LANGUAGE_OVERRIDE_PATTERNS: Array<{ code: SupportedLanguageCode; patterns: RegExp[] }> = [
  {
    code: "zh-CN",
    patterns: [/\b(?:in|use|write in|reply in|respond in|output in)\s+(?:simplified\s+)?chinese\b/i, /请用简体中文/i, /请用中文/i, /用简体中文输出/i, /用中文输出/i, /中文回复/i, /中文输出/i]
  },
  {
    code: "zh-TW",
    patterns: [/\b(?:in|use|write in|reply in|respond in|output in)\s+traditional\s+chinese\b/i, /請用繁體中文/i, /用繁體中文輸出/i, /繁體中文回覆/i, /繁體中文輸出/i]
  },
  {
    code: "en-US",
    patterns: [/\b(?:in|use|write in|reply in|respond in|output in)\s+english\b/i, /请用英文/i, /用英文输出/i, /英文回复/i, /英文输出/i]
  },
  {
    code: "ja-JP",
    patterns: [/\b(?:in|use|write in|reply in|respond in|output in)\s+japanese\b/i, /请用日语/i, /用日语输出/i, /日语回复/i, /日语输出/i]
  },
  {
    code: "ko-KR",
    patterns: [/\b(?:in|use|write in|reply in|respond in|output in)\s+korean\b/i, /请用韩语/i, /用韩语输出/i, /韩语回复/i, /韩语输出/i]
  },
  {
    code: "vi-VN",
    patterns: [/\b(?:in|use|write in|reply in|respond in|output in)\s+vietnamese\b/i, /请用越南语/i, /用越南语输出/i, /越南语回复/i, /越南语输出/i]
  },
  {
    code: "th-TH",
    patterns: [/\b(?:in|use|write in|reply in|respond in|output in)\s+thai\b/i, /请用泰语/i, /用泰语输出/i, /泰语回复/i, /泰语输出/i]
  },
  {
    code: "id-ID",
    patterns: [/\b(?:in|use|write in|reply in|respond in|output in)\s+(?:bahasa\s+)?indonesian\b/i, /请用印尼语/i, /用印尼语输出/i, /印尼语回复/i, /印尼语输出/i]
  },
  {
    code: "de-DE",
    patterns: [/\b(?:in|use|write in|reply in|respond in|output in)\s+german\b/i, /请用德语/i, /用德语输出/i, /德语回复/i, /德语输出/i]
  },
  {
    code: "es-ES",
    patterns: [/\b(?:in|use|write in|reply in|respond in|output in)\s+spanish\b/i, /请用西班牙语/i, /用西班牙语输出/i, /西班牙语回复/i, /西班牙语输出/i]
  },
  {
    code: "ru-RU",
    patterns: [/\b(?:in|use|write in|reply in|respond in|output in)\s+russian\b/i, /请用俄语/i, /用俄语输出/i, /俄语回复/i, /俄语输出/i]
  },
  {
    code: "pt-BR",
    patterns: [/\b(?:in|use|write in|reply in|respond in|output in)\s+portuguese\b/i, /请用葡萄牙语/i, /用葡萄牙语输出/i, /葡萄牙语回复/i, /葡萄牙语输出/i]
  },
  {
    code: "fr-FR",
    patterns: [/\b(?:in|use|write in|reply in|respond in|output in)\s+french\b/i, /请用法语/i, /用法语输出/i, /法语回复/i, /法语输出/i]
  },
  {
    code: "pl-PL",
    patterns: [/\b(?:in|use|write in|reply in|respond in|output in)\s+polish\b/i, /请用波兰语/i, /用波兰语输出/i, /波兰语回复/i, /波兰语输出/i]
  }
];

export function normalizeLanguage(input?: string | null): SupportedLanguageCode {
  if (!input) return DEFAULT_LANGUAGE;

  const normalized = input.trim();
  if (!normalized) return DEFAULT_LANGUAGE;

  const exact = SUPPORTED_LANGUAGE_CODES.find(
    (code) => code.toLowerCase() === normalized.toLowerCase()
  );
  if (exact) return exact;

  const primary = normalized.split("-")[0]?.toLowerCase();
  if (primary && PRIMARY_LANGUAGE_FALLBACK[primary]) {
    return PRIMARY_LANGUAGE_FALLBACK[primary];
  }

  return DEFAULT_LANGUAGE;
}

export function detectRequestedOutputLanguageOverride(input?: string | null): SupportedLanguageCode | null {
  const normalized = String(input ?? "").trim();
  if (!normalized) return null;

  for (const entry of LANGUAGE_OVERRIDE_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(normalized))) {
      return entry.code;
    }
  }

  return null;
}
