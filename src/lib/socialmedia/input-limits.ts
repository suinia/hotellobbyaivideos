/** Canonical maximum for user-authored message text across UI, API, and V4 context. */
export const SOCIALMEDIA_USER_MESSAGE_MAX_CHARS = 24_000;

/** Maximum text a user can enter in the app composer. */
export const SOCIALMEDIA_COMPOSER_MAX_CHARS = SOCIALMEDIA_USER_MESSAGE_MAX_CHARS;

/** Maximum user-authored message text accepted by the API. */
export const SOCIALMEDIA_MESSAGE_MAX_CHARS = SOCIALMEDIA_USER_MESSAGE_MAX_CHARS;

/** Maximum generated instruction text after workflow-specific guidance is appended. */
export const SOCIALMEDIA_GENERATION_INPUT_MAX_CHARS = 32_000;

/** Hard limit for the final prompt sent to an image model. */
export const SOCIALMEDIA_IMAGE_MODEL_PROMPT_MAX_CHARS = 30_000;
