export const PLAYLIST_COVER_RULES = [
  "Create one finished flat playlist cover: a clear mood, genre, activity, or personal collection identity with a strong focal point and a composition that stays recognizable at thumbnail size. Default to a square 1:1 canvas unless the user requests another format.",
  "A playlist is a curated collection of tracks, not a single artist's album release. A mood, activity, genre, title, or visual concept is enough to start. The playlist title is optional; use exact supplied titles and curator names only when requested as visible copy, and honor text-free requests. Do not require an artist name, album title, track list, or release date.",
  "Use uploaded images for the requested subject, identity, content, or style. Keep requested people and supplied photos recognizable. Do not copy incidental text, branding, or player controls from a reference unless explicitly requested.",
  "On revisions, change only the requested title, subject, color, mood, style, layout, or format. Preserve all unmentioned imagery, exact copy, composition, palette, and canvas; a request to remove text should leave the artwork intact.",
  "Deliver the cover artwork itself. Never add invented artists, song lists, release credits, explicit-content badges, platform logos, watermarks, playback controls, a phone screen, a vinyl sleeve, a CD case, or a perspective mockup. Do not imply official platform endorsement."
] as const;

export const PLAYLIST_COVER_CONSTRAINT = `PLAYLIST COVER EXECUTION CONSTRAINT: ${PLAYLIST_COVER_RULES.join(" ")}`;
