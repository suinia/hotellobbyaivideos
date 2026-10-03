export const DOCS_HOME_CATEGORIES = [
  { label: "Video", slug: "video", heading: "Video" },
  { label: "Marketing", slug: "marketing", heading: "Marketing" },
  { label: "Music", slug: "music", heading: "Music & Entertainment" },
  { label: "Design", slug: "design", heading: "Design & Inspiration" },
  { label: "Branding", slug: "branding", heading: "Branding" },
  { label: "Social Media", slug: "social-media", heading: "Social Media" },
  { label: "Business", slug: "business-ecommerce", heading: "Business & Ecommerce" },
  { label: "Photography", slug: "photography", heading: "Photography" },
  { label: "Vismuse", slug: "vismuse", heading: "Vismuse" }
] as const;

export type DocsHomeCategory = (typeof DOCS_HOME_CATEGORIES)[number]["label"];
