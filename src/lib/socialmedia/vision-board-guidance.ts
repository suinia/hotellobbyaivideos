export const VISION_BOARD_RULES = [
  "Create one finished flat vision board: an intentional collage of goal-related imagery, a clear visual hierarchy, generous spacing, and short readable affirmations.",
  "Translate the user's aspirations into visual scenes without inventing personal facts, achievements, deadlines, income figures, or promises that goals will come true. Use exact supplied titles and affirmations; add motivational copy only when requested.",
  "Use uploaded photos for their requested content, identity, or style. Keep requested people and personal photos recognizable; do not replace them with generic imagery. A collection of goals belongs on one board unless separate outputs are requested.",
  "On revisions, change only the requested goal, image region, wording, style, or format. Preserve all unmentioned photos, goals, exact copy, layout, palette, and canvas. Collage regions are not separate output images or brochure panels.",
  "Deliver the board artwork itself, never a photograph of a corkboard, framed print, phone, laptop, wall, editor screenshot, or perspective mockup. Do not add watermarks, logos, dense paragraphs, or unsupported facts."
] as const;

export const VISION_BOARD_CONSTRAINT = `VISION BOARD EXECUTION CONSTRAINT: ${VISION_BOARD_RULES.join(" ")}`;
