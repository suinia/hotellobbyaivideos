export const MINIMAX_H3_VIDEO_PROMPT_MAX_CHARACTERS = 7_000;
export const MINIMAX_H3_VIDEO_AGENT_PROMPT_TARGET_CHARACTERS = 6_500;

export type MiniMaxH3VideoPromptLimitViolation = {
  promptLength: number;
  maxCharacters: number;
};

export function isMiniMaxH3VideoModel(model?: string | null): boolean {
  return model?.trim().toLowerCase() === "minimax-h3";
}

export function resolveMiniMaxH3VideoPromptLimitViolation(params: {
  prompt: string;
  isMiniMaxH3: boolean;
}): MiniMaxH3VideoPromptLimitViolation | null {
  if (!params.isMiniMaxH3) return null;
  const promptLength = params.prompt.trim().length;
  return promptLength > MINIMAX_H3_VIDEO_PROMPT_MAX_CHARACTERS
    ? {
        promptLength,
        maxCharacters: MINIMAX_H3_VIDEO_PROMPT_MAX_CHARACTERS
      }
    : null;
}
