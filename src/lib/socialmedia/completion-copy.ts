import {
  isChineseSocialmediaResponseLanguage,
  resolveSocialmediaResponseLanguage
} from "@/lib/socialmedia/language";

export type ImageGenerationCompletionContext = {
  inputText?: string;
  language?: string;
  sourceUseCase?: string;
  outputType?: string;
};

export function isMenuGenerationContext(
  context: Pick<ImageGenerationCompletionContext, "sourceUseCase" | "outputType">
): boolean {
  return context.outputType === "menu" || context.sourceUseCase === "ai-menu-generator";
}

export function isComicGenerationContext(
  context: Pick<ImageGenerationCompletionContext, "sourceUseCase" | "outputType">
): boolean {
  return context.outputType === "comic" || context.sourceUseCase === "ai-comic-generator";
}

export function isAnimeGenerationContext(
  context: Pick<ImageGenerationCompletionContext, "sourceUseCase" | "outputType">
): boolean {
  return context.outputType === "anime_art" || context.sourceUseCase === "ai-anime-generator";
}

export function buildImageGenerationCompletionReply({
  inputText,
  language,
  sourceUseCase,
  outputType
}: ImageGenerationCompletionContext): string {
  const responseLanguage = language
    ? language
    : resolveSocialmediaResponseLanguage({
        userInput: inputText,
        selectedLanguage: "en-US"
      });
  const isChinese = isChineseSocialmediaResponseLanguage(responseLanguage);

  if (isMenuGenerationContext({ sourceUseCase, outputType })) {
    return isChinese
      ? "已经根据你的需求生成菜单。你可以继续告诉我需要修改什么，或描述新的生成需求。"
      : "I've generated your menu. You can keep editing it, or describe something new to generate.";
  }

  if (isComicGenerationContext({ sourceUseCase, outputType })) {
    return isChinese
      ? "已经根据你的需求生成漫画。你可以继续修改分镜、对白或角色，或描述一个新故事。"
      : "I've generated your comic. You can keep editing panels, dialogue, or characters, or describe a new story.";
  }

  if (sourceUseCase === "baby-shower-invitations" || outputType === "baby_shower_invitation") {
    return isChinese ? "已经生成你的宝宝派对邀请函。你可以继续修改姓名、日期、地点、回复方式或视觉风格。" : "I've generated your baby shower invitation. You can keep editing the wording, event details, imagery, or style.";
  }

  if (sourceUseCase === "playlist-cover-maker" || outputType === "playlist_cover") {
    return isChinese ? "已经生成你的歌单封面。你可以继续修改氛围、标题、图片或风格。" : "I've generated your playlist cover. You can keep editing the mood, title, imagery, or style.";
  }

  if (sourceUseCase === "vision-board-maker" || outputType === "vision_board") {
    return isChinese ? "已经生成你的愿景板。你可以继续修改目标、图片、文字或风格。" : "I've generated your vision board. You can keep editing goals, images, wording, or style.";
  }

  if (isAnimeGenerationContext({ sourceUseCase, outputType })) {
    return isChinese
      ? "已经根据你的需求生成动漫图片。你可以继续修改角色、服装、场景或风格，或描述一个新画面。"
      : "I've generated your anime artwork. You can keep editing the character, outfit, scene, or style, or describe a new image.";
  }

  return isChinese
    ? "已经根据你的需求生成图片。你可以继续告诉我需要修改什么，或描述新的生成需求。"
    : "I've generated the image based on your request. Keep going: tell me what to change, or describe something new to generate.";
}
