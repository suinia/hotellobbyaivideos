import type { SeoDocConfig } from "./docs";

const churchPrompt = "Create a welcoming 4:5 church flyer for “[EVENT OR SERVICE NAME].” Use the exact text “[CHURCH NAME],” “[DATE],” “[SERVICE TIME],” “[ADDRESS],” “[CONTACT OR WEBSITE],” and “[INVITATION].” Use warm sunrise light, deep blue and gold, and respectful readable typography. Make the service name and time prominent. Include my approved church logo and preserve its appearance.";

export const churchFlyerDoc: SeoDocConfig = {
  slug: "how-to-make-a-church-flyer-with-ai",
  title: "How to Make a Church Flyer With AI: Services and Ministry Events",
  description: "Learn how to make a church flyer with AI for services, revivals, youth ministry, and outreach. Plan the copy, choose a template, generate, and review.",
  image: {
    src: "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-flyer-generator/user-demand-20260710/ai-flyer-generator-user-demand-church-revival_thumb.webp",
    alt: "Church revival flyer with a service headline, date, location, and invitation"
  },
  h1: "How to make a church flyer with AI",
  lede: "Create a welcoming invitation for a service, revival, youth ministry, fundraiser, or community event. Start with verified details, then build and refine your flyer through chat.",
  category: "Church flyers",
  homeCategory: "Marketing",
  toolHref: "/docs/church-flyer-maker",
  toolLabel: "Explore Church Flyer Maker",
  sourceUseCase: "ai-flyer-generator",
  sections: [
    {
      title: "1. Gather the service and invitation details",
      paragraphs: ["Decide who the flyer is for and what you want them to do: attend a service, register for a youth event, join a ministry, volunteer, or support a fundraiser. Keep that invitation clear.", "Confirm every name, date, service time, address, and contact detail with the organizer. For a recurring service, state the weekday and time; for a special event, include the full date."],
      bullets: ["Church name and event or service title", "Full date, start time, and recurring schedule when relevant", "Venue name and address, or verified livestream URL", "Speaker or ministry name if needed", "One invitation, RSVP, registration, or donation action"]
    },
    {
      title: "2. Choose a church flyer template and approved images",
      paragraphs: ["Browse church flyer templates for an initial direction. A Sunday service invitation may need a calm, welcoming layout; a youth event can use brighter colors; a revival or special program should keep the theme and schedule prominent.", "Use your approved church logo, venue photo, or speaker portrait when useful. Explain which image is the logo and which should be the main visual. Avoid using unrelated event imagery just because the layout looks attractive."]
    },
    {
      title: "3. Generate a first draft with the exact wording",
      paragraphs: ["Replace the bracketed fields in this prompt with the approved copy. Add your photos or logo in AI Flyer Generator, choose a portrait or social format, and send the brief to generate a first draft.", "Give the service title, time, and venue a clear reading order. Keep longer schedules and ministry explanations on the event page rather than crowding them into the flyer."],
      example: { label: "Church service flyer prompt", prompt: churchPrompt }
    },
    {
      title: "4. Review, refine, and share the church flyer",
      paragraphs: ["Check the church name, speaker name, date, time, address, and contact information across the whole image. Read the invitation at phone size and confirm that newcomers can understand where to go and what to expect.", "Request a focused change in the same chat, such as “Keep the church logo and service title. Make the service time larger and replace the address with [VERIFIED ADDRESS].” Each revision produces a new image, so review all details again.", "Download as PNG or JPG, or export an eligible original as PDF. The PDF preserves the generated image’s aspect ratio. Confirm paper dimensions, resolution, bleed, and printer requirements separately."]
    },
    {
      title: "Church flyer FAQ",
      paragraphs: ["What should a church flyer include? Start with the church and service name, full date and time, location, contact information, and one clear invitation. Add speakers, ministry details, or registration conditions only when attendees need them.", "Can I make youth ministry, revival, and fundraiser flyers? Yes. Describe the audience and event, provide the approved copy and images, and adapt the visual style to the occasion.", "Can I use my church logo or a pastor’s photo? Upload an approved image with the brief and identify its role. Explain what must remain recognizable, then check the generated result before publishing."]
    }
  ],
  workflow: [],
  tips: ["Make the service time and location easy to find.", "Use one clear invitation instead of several competing actions.", "Check registration and livestream links separately; text inside a flyer image is not clickable."],
  templateLinks: [
    { href: "/templates/flyers/church-flyers", label: "Church flyer templates", description: "Browse a church flyer starting point and customize its prompt." },
    { href: "/docs/church-flyer-maker", label: "Church Flyer Maker", description: "Plan service, ministry, and outreach flyers with examples and prompts." },
    { href: "/docs/flyer-generator", label: "How to make a flyer", description: "Read the broader creation and review workflow." },
    { href: "/docs/edit-flyer-with-ai", label: "Edit a flyer with AI", description: "Update copy or visual details in an existing flyer." }
  ],
  relatedTools: [{ href: "/tools/ai-flyer-generator", label: "AI Flyer Generator" }, { href: "/templates/flyers/church-flyers", label: "Church flyer templates" }]
};

export const churchFlyerDocJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: churchFlyerDoc.h1,
  description: churchFlyerDoc.description,
  url: "https://vismuse.com/docs/how-to-make-a-church-flyer-with-ai",
  step: churchFlyerDoc.sections.slice(0, 4).map((section, index) => ({
    "@type": "HowToStep",
    position: index + 1,
    name: section.title,
    text: section.paragraphs.join(" ")
  }))
};
