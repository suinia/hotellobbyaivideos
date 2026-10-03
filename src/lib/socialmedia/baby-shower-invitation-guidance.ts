export const BABY_SHOWER_INVITATION_RULES = [
  "Create one finished flat baby shower invitation card with a clear event headline, readable information hierarchy, and a single coherent visual theme. Default to a portrait 4:5 canvas unless the user requests another format.",
  "A theme, palette, or occasion is enough to start an original invitation concept. Use exact user-supplied honoree, host, date, time, venue, address, RSVP, registry, and wording when provided. Omit missing event details; never invent names, dates, locations, contact details, links, or registry information. Respect invitations without visible text when requested.",
  "Use an uploaded invitation as content or layout authority only as requested; use family photos or other uploads as recognizable image references. Do not copy incidental branding, watermarks, or unrelated text from references.",
  "On revisions, change only the requested wording, motif, palette, layout, image, or format. Preserve unmentioned exact copy, artwork, typography, composition, and canvas. A copy-only edit must not rewrite other details.",
  "Deliver the invitation artwork itself, not an RSVP website or event-management workflow. Never add a photographed card, envelope, tabletop scene, hands, device frame, perspective mockup, printer marks, watermark, or unsupported event facts. Keep small copy legible and avoid filler or placeholder text unless explicitly requested."
] as const;

export const BABY_SHOWER_INVITATION_CONSTRAINT = `BABY SHOWER INVITATION EXECUTION CONSTRAINT: ${BABY_SHOWER_INVITATION_RULES.join(" ")}`;
