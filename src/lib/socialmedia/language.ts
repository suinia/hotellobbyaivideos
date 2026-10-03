import {
  detectRequestedOutputLanguageOverride,
  normalizeLanguage,
  type SupportedLanguageCode
} from "@/lib/i18n/languages";

type ScriptCounts = {
  chinese: number;
  latinLetters: number;
  japaneseKana: number;
  koreanHangul: number;
};

const SOCIALMEDIA_LANGUAGE_COMMANDS: Array<{ code: SupportedLanguageCode; patterns: RegExp[] }> = [
  {
    code: "zh-CN",
    patterns: [
      /(?:请)?用(?:简体)?中文(?:回复|回答|输出|生成|写)/i,
      /(?:回复|回答|输出|生成|写)(?:成|为)?(?:简体)?中文/i
    ]
  },
  {
    code: "zh-TW",
    patterns: [
      /(?:請)?用繁體中文(?:回覆|回答|輸出|生成|寫)/i,
      /(?:回覆|回答|輸出|生成|寫)(?:成|為)?繁體中文/i
    ]
  },
  {
    code: "en-US",
    patterns: [
      /(?:请)?用(?:英语|英文)(?:回复|回答|输出|生成|写)/i,
      /(?:回复|回答|输出|生成|写)(?:成|为)?(?:英语|英文)/i
    ]
  }
];

const FRENCH_LANGUAGE_SIGNALS = new Set([
  "affiche",
  "ajoute",
  "ajouter",
  "amour",
  "avec",
  "belle",
  "bonjour",
  "ce",
  "ces",
  "cette",
  "couverture",
  "cree",
  "creer",
  "dans",
  "de",
  "des",
  "du",
  "elle",
  "elles",
  "et",
  "francais",
  "genere",
  "generer",
  "je",
  "la",
  "le",
  "les",
  "leur",
  "mais",
  "modifie",
  "modifier",
  "mon",
  "nous",
  "par",
  "pas",
  "pour",
  "que",
  "qui",
  "sans",
  "soleil",
  "supprime",
  "supprimer",
  "sur",
  "texte",
  "titre",
  "tu",
  "un",
  "une",
  "votre",
  "vous",
  "veux"
]);

const GERMAN_LANGUAGE_SIGNALS = new Set([
  "aber",
  "als",
  "anfangen",
  "anpassen",
  "anderes",
  "bearbeiten",
  "beim",
  "bitte",
  "bild",
  "bilder",
  "das",
  "dein",
  "deine",
  "deinen",
  "deiner",
  "dem",
  "den",
  "der",
  "des",
  "die",
  "dich",
  "dir",
  "du",
  "ein",
  "eine",
  "einem",
  "einen",
  "einer",
  "eines",
  "erstelle",
  "erstellt",
  "erstellen",
  "für",
  "generieren",
  "gern",
  "gerne",
  "gestalten",
  "gestaltung",
  "helfen",
  "hilfe",
  "ich",
  "ihr",
  "kann",
  "kannst",
  "können",
  "loslegen",
  "mache",
  "mit",
  "möchtest",
  "möchten",
  "oder",
  "ohne",
  "sie",
  "soll",
  "sollen",
  "und",
  "verwende",
  "von",
  "was",
  "wie",
  "wir",
  "wobei",
  "zeige",
  "zuerst",
  "zum",
  "zur"
]);

function stripQuotedVisibleCopy(input: string): string {
  // Exact on-canvas copy is content authority, not evidence for the language
  // used by the surrounding user instruction or the Agent's reply.
  return input
    .replace(/"[^"\n]*"/gu, " ")
    .replace(/“[^”\n]*”/gu, " ")
    .replace(/«[^»\n]*»/gu, " ")
    .replace(/「[^」\n]*」/gu, " ")
    .replace(/『[^』\n]*』/gu, " ");
}

function inferFrenchLanguage(input: string): SupportedLanguageCode | null {
  const tokens = stripQuotedVisibleCopy(input).toLocaleLowerCase("fr").match(/\p{Letter}+/gu) ?? [];
  if (tokens.length < 2) return null;

  let signalCount = 0;
  let accentedTokenCount = 0;
  for (const token of tokens) {
    if (/[àâçéèêëîïôùûüÿœæ]/iu.test(token)) accentedTokenCount += 1;
    const folded = token.normalize("NFKD").replace(/\p{Mark}/gu, "");
    if (FRENCH_LANGUAGE_SIGNALS.has(folded)) signalCount += 1;
  }

  const signalRatio = signalCount / tokens.length;
  if (
    (signalCount >= 3 && signalRatio >= 0.22)
    || (signalCount >= 2 && accentedTokenCount >= 1 && signalRatio >= 0.34)
  ) {
    return "fr-FR";
  }

  return null;
}

function inferGermanLanguage(input: string): SupportedLanguageCode | null {
  const tokens = stripQuotedVisibleCopy(input).toLocaleLowerCase("de").match(/\p{Letter}+/gu) ?? [];
  if (tokens.length < 2) return null;

  let signalCount = 0;
  let distinctiveTokenCount = 0;
  for (const token of tokens) {
    if (/[äöüß]/iu.test(token)) distinctiveTokenCount += 1;
    if (GERMAN_LANGUAGE_SIGNALS.has(token)) signalCount += 1;
  }

  const signalRatio = signalCount / tokens.length;
  if (
    (signalCount >= 3 && signalRatio >= 0.22)
    || (signalCount >= 2 && distinctiveTokenCount >= 1 && signalRatio >= 0.3)
  ) {
    return "de-DE";
  }

  return null;
}

function countScripts(input: string): ScriptCounts {
  const counts: ScriptCounts = {
    chinese: 0,
    latinLetters: 0,
    japaneseKana: 0,
    koreanHangul: 0
  };

  for (const char of input) {
    if (/\p{Script=Han}/u.test(char)) {
      counts.chinese += 1;
    } else if (/\p{Script=Latin}/u.test(char) && /\p{Letter}/u.test(char)) {
      counts.latinLetters += 1;
    } else if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(char)) {
      counts.japaneseKana += 1;
    } else if (/\p{Script=Hangul}/u.test(char)) {
      counts.koreanHangul += 1;
    }
  }

  return counts;
}

function detectSocialmediaLanguageCommand(input: string): SupportedLanguageCode | null {
  for (const entry of SOCIALMEDIA_LANGUAGE_COMMANDS) {
    if (entry.patterns.some((pattern) => pattern.test(input))) {
      return entry.code;
    }
  }

  return null;
}

function inferDominantMessageLanguage(input: string): SupportedLanguageCode | null {
  const counts = countScripts(input);
  const totalLanguageSignals =
    counts.chinese + counts.latinLetters + counts.japaneseKana + counts.koreanHangul;
  if (totalLanguageSignals < 2) return null;

  if (counts.koreanHangul >= 2 && counts.koreanHangul / totalLanguageSignals >= 0.35) {
    return "ko-KR";
  }

  if (counts.japaneseKana >= 2 && counts.japaneseKana / totalLanguageSignals >= 0.25) {
    return "ja-JP";
  }

  if (counts.chinese >= 2 && counts.chinese / totalLanguageSignals >= 0.25) {
    return "zh-CN";
  }

  const latinLanguage = inferFrenchLanguage(input);
  if (latinLanguage) return latinLanguage;

  const germanLanguage = inferGermanLanguage(input);
  if (germanLanguage) return germanLanguage;

  if (counts.latinLetters >= 8 && counts.latinLetters / totalLanguageSignals >= 0.7) {
    return "en-US";
  }

  return null;
}

export function resolveSocialmediaResponseLanguage(params: {
  userInput?: string | null;
  selectedLanguage?: string | null;
}): SupportedLanguageCode {
  const normalizedSelectedLanguage = normalizeLanguage(params.selectedLanguage);
  const userInput = String(params.userInput ?? "").trim();
  if (!userInput) return normalizedSelectedLanguage;

  return (
    detectRequestedOutputLanguageOverride(userInput) ??
    detectSocialmediaLanguageCommand(userInput) ??
    inferDominantMessageLanguage(userInput) ??
    normalizedSelectedLanguage
  );
}

export function isChineseSocialmediaResponseLanguage(language?: string | null): boolean {
  return normalizeLanguage(language).startsWith("zh");
}
