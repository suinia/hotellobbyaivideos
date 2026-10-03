import type { Metadata } from "next";
import { getFlyerSeoLandingPage, type FlyerSeoLandingPage } from "./flyer-seo-pages";

export type FlyerTopicExample = { title: string; description: string; image: string; prompt: string; tags: string[] };
export type FlyerTopicCategory = { slug: string; label: string; title: string; description: string; h1: string; lede: string; intent: string; keywords: string[]; heroPrompt: string };

// TDH copied verbatim from the version before b02b5a63 removed the legacy routes.
export const restoredFlyerCategories: FlyerTopicCategory[] = [
  {
    "slug": "church-flyers",
    "label": "Church flyers",
    "title": "Church Flyer Templates and AI Flyer Prompts",
    "description": "Browse AI church flyer templates with starter prompts for clear hierarchy, key details, format, and call to action.",
    "h1": "Church flyer templates for faster AI flyer drafts",
    "lede": "Start from church flyers prompts that already account for purpose, audience, hierarchy, required details, format, and call to action.",
    "intent": "Promote a church event, service, ministry, fundraiser, or community announcement.",
    "keywords": [
      "church flyers",
      "church flyers template",
      "church flyers maker"
    ],
    "heroPrompt": "Create church flyers with a clear headline, must-have details, audience-specific visual style, readable hierarchy, and strong call to action."
  },
  {
    "slug": "event-flyers",
    "label": "Event flyers",
    "title": "Event Flyer Templates for Workshops, Meetups, and Local Events",
    "description": "Browse AI event flyer templates for workshops, fundraisers, meetups, concerts, community events, and registration campaigns.",
    "h1": "Event flyer templates for workshops, meetups, and local events",
    "lede": "Make event flyers with a clear title, date, time, place, host, sponsor row, key details, and registration CTA.",
    "intent": "Announce an event and drive attendance, registration, RSVPs, or ticket sales.",
    "keywords": [
      "event flyer templates",
      "event flyer maker",
      "how to make event flyers"
    ],
    "heroPrompt": "Create an event flyer with title, date, time, venue, speaker or host, key benefits, sponsor row, QR code space, and register-now CTA."
  },
  {
    "slug": "birthday-flyers",
    "label": "Birthday flyers",
    "title": "Birthday Flyer Templates for Parties and Invitations",
    "description": "Browse birthday flyer templates for parties, Sweet 16 invitations, milestone birthdays, kids parties, and social event announcements.",
    "h1": "Birthday flyer templates for parties and invitations",
    "lede": "Create birthday flyers that make the name, age, theme, date, venue, dress code, RSVP, and celebration mood easy to understand.",
    "intent": "Invite guests to a birthday party or create a shareable birthday event announcement.",
    "keywords": [
      "birthday flyer templates",
      "birthday flyer maker",
      "sweet 16 invitations",
      "make a birthday flyer"
    ],
    "heroPrompt": "Create a birthday flyer with name, age, theme, date, venue, dress code, RSVP details, and festive readable typography."
  },
  {
    "slug": "club-flyers",
    "label": "Club flyers",
    "title": "Club Flyer Templates and AI Flyer Prompts",
    "description": "Browse AI club flyer templates with starter prompts for clear hierarchy, key details, format, and call to action.",
    "h1": "Club flyer templates for faster AI flyer drafts",
    "lede": "Start from club flyers prompts that already account for purpose, audience, hierarchy, required details, format, and call to action.",
    "intent": "Promote nightclub events, DJ nights, guest lists, and nightlife offers.",
    "keywords": [
      "club flyers",
      "club flyers template",
      "club flyers maker"
    ],
    "heroPrompt": "Create club flyers with a clear headline, must-have details, audience-specific visual style, readable hierarchy, and strong call to action."
  },
  {
    "slug": "real-estate-flyers",
    "label": "Real estate flyers",
    "title": "Real Estate Flyer Templates for Listings and Agents",
    "description": "Browse AI real estate flyer templates for listings, open houses, for-sale announcements, agent promos, and property marketing.",
    "h1": "Real estate flyer templates for listings and agents",
    "lede": "Create real estate flyers with strong property photos, listing details, agent branding, and a buyer-focused call to action.",
    "intent": "Market a property, open house, listing, rental, agent service, or neighborhood update.",
    "keywords": [
      "real estate flyer templates",
      "open house flyer",
      "property flyer",
      "just listed flyer"
    ],
    "heroPrompt": "Create a real estate flyer for a modern listing with property image area, price, address area, key features, agent contact, and tour CTA."
  },
  {
    "slug": "party-flyers",
    "label": "Party flyers",
    "title": "Party Flyer Templates for Club Nights, Birthdays, and Events",
    "description": "Browse AI party flyer templates for club nights, birthday parties, music events, neighborhood parties, and social promotions.",
    "h1": "Party flyer templates for club nights, birthdays, and events",
    "lede": "Create party flyers that sell the vibe first while keeping the event name, date, venue, lineup, RSVP, and CTA readable.",
    "intent": "Promote a party, club night, birthday, music event, or social gathering.",
    "keywords": [
      "party flyer templates",
      "party flyer maker",
      "make a party flyer",
      "club flyer maker"
    ],
    "heroPrompt": "Create a party flyer with bold title, date, time, venue, music style, lineup or host names, RSVP details, and high-energy visual style."
  }
];

export const flyerTopicExamples: Record<string, FlyerTopicExample[]> = {
  "church-flyers": [
    {
      "title": "Church Revival",
      "description": "A warm faith-event flyer with guest speaker space, service schedule, welcome message, and church details.",
      "image": "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-flyer-generator/user-demand-20260710/ai-flyer-generator-user-demand-church-revival_thumb.webp",
      "prompt": "Use case: ads-marketing. Asset type: vertical church event flyer template. Create an inspiring 4:5 church revival flyer with a photorealistic fictional middle-aged Black male pastor in a navy suit, warm friendly expression, and a completely visible natural face with clear eyes, nose, mouth, skin texture, and hair. Place him in front of glowing sunrise light through sanctuary windows with subtle congregation silhouettes. Use deep plum, warm gold, cream, and sky blue. Exact text, each rendered once: \"REVIVAL WEEKEND\", \"RESTORE • RENEW • REJOICE\", \"GUEST SPEAKER PASTOR ELI JAMES\", \"SUNDAY • 11 AM\", \"NEW HOPE COMMUNITY CHURCH\", \"EVERYONE IS WELCOME\". Respectful faith-centered composition, clear service details. The portrait must look like a complete real human face, not a blank oval, silhouette, mannequin, mask, cutout, or photo placeholder. No real person likeness, no real church, no logos, no watermark, no extra text.",
      "tags": [
        "church flyer",
        "revival flyer",
        "worship event flyer",
        "pastor flyer",
        "flyer template"
      ]
    }
  ],
  "event-flyers": [
    {
      "title": "Cultural Festival",
      "description": "A bright community festival flyer for national days, live performers, food, and family programming.",
      "image": "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-flyer-generator/user-demand-20260710/ai-flyer-generator-user-demand-cultural-festival_thumb.webp",
      "prompt": "Use case: ads-marketing. Asset type: vertical cultural festival flyer template. Create a vibrant 4:5 community celebration flyer with fireworks, festive textile patterns, a fictional singer on stage, families in the background, and green, ivory, coral, and gold accents. Exact text, each rendered once: \"UNITY DAY FESTIVAL\", \"LIVE MUSIC • FOOD • FAMILY FUN\", \"AUGUST 29 • 5–10 PM\", \"RIVERFRONT PARK\", \"FREE ENTRY & PARKING\". Keep the layout inclusive, energetic, highly readable, and suitable for replacing the performer photo or community logo. No real flags, no real person likeness, no logos, no watermark, no extra text.",
      "tags": [
        "cultural festival flyer",
        "community event flyer",
        "music festival flyer",
        "family event flyer",
        "flyer template"
      ]
    },
    {
      "title": "Football Conditioning",
      "description": "A bold youth sports announcement template for conditioning, schedule updates, tryouts, and cancellations.",
      "image": "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-flyer-generator/user-demand-20260710/ai-flyer-generator-user-demand-football-conditioning_thumb.webp",
      "prompt": "Use case: ads-marketing. Asset type: vertical youth sports announcement flyer template. Create a powerful 4:5 football conditioning flyer with fictional youth players training under stadium lights, grass texture, bold navy, white, electric green, and orange palette. Exact text, each rendered once: \"WILDCATS CONDITIONING\", \"SUNDAY • 4 PM\", \"AL WILKE PARK\", \"BRING WATER + CLEATS\", \"ALL PLAYERS WELCOME\". Strong athletic headline, simple schedule block, small replaceable mascot/logo area, readable on a phone screen. No real teams, no real athletes, no brand logos, no watermark, no extra text.",
      "tags": [
        "football flyer",
        "sports practice flyer",
        "team announcement",
        "youth sports flyer",
        "flyer template"
      ]
    },
    {
      "title": "Breakfast Fundraiser",
      "description": "A warm nonprofit fundraiser flyer combining a breakfast offer, mission message, price, and QR-style CTA.",
      "image": "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-flyer-generator/user-demand-20260710/ai-flyer-generator-user-demand-breakfast-fundraiser_thumb.webp",
      "prompt": "Use case: ads-marketing. Asset type: vertical nonprofit food fundraiser flyer template. Create a welcoming 4:5 breakfast benefit flyer with pancakes, waffles, berries, coffee, volunteers serving neighbors, and a warm teal, sunflower yellow, white, and charcoal palette. Exact text, each rendered once: \"BREAKFAST FOR A CAUSE\", \"PANCAKES OR WAFFLES • $7\", \"SATURDAY • 8–11 AM\", \"COMMUNITY HALL\", \"EVERY PLATE HELPS\", \"SCAN TO SUPPORT\". Include a clean blank QR placeholder, clear nonprofit hierarchy, optimistic documentary feel. No real charity logo, no watermark, no extra text.",
      "tags": [
        "fundraiser flyer",
        "breakfast flyer",
        "nonprofit event flyer",
        "community benefit flyer",
        "flyer template"
      ]
    }
  ],
  "birthday-flyers": [
    {
      "title": "Luxury Birthday Party",
      "description": "A glamorous adult birthday invitation with portrait space, premium styling, and clear RSVP details.",
      "image": "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-flyer-generator/user-demand-20260710/ai-flyer-generator-user-demand-luxury-birthday-party_thumb.webp",
      "prompt": "Use case: ads-marketing. Asset type: vertical birthday party flyer template. Create a glamorous 4:5 birthday flyer with a fictional woman in an elegant evening portrait, champagne-gold light, ivory florals, black satin texture, and soft blush accents. Exact text, each rendered once: \"CHLOE’S 37TH\", \"QUEEN STATUS\", \"SATURDAY • 7 PM\", \"THE GRAND LOFT\", \"DRESS TO IMPRESS\", \"RSVP 555 0147\". High-fashion invitation composition with a clear portrait replacement area and polished serif typography. No real celebrity likeness, no brand logos, no watermark, no extra text.",
      "tags": [
        "birthday flyer",
        "adult birthday invitation",
        "glam birthday flyer",
        "party invitation",
        "flyer template"
      ]
    },
    {
      "title": "Kids Park Birthday",
      "description": "A cheerful children’s birthday flyer with easy-to-edit age, park, date, and RSVP fields.",
      "image": "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-flyer-generator/user-demand-20260710/ai-flyer-generator-user-demand-kids-park-birthday_thumb.webp",
      "prompt": "Use case: ads-marketing. Asset type: vertical children’s birthday flyer template. Create a playful 4:5 park birthday invitation with colorful balloons, picnic tables, sunshine, confetti, and original friendly cartoon shapes in coral, sky blue, yellow, green, and white. Exact text, each rendered once: \"LESLIE TURNS 10!\", \"PARK PARTY\", \"AUGUST 7 • 2 PM\", \"MILLER PARK\", \"CAKE • GAMES • FUN\", \"RSVP 555 0182\". Big rounded headline, simple parent-friendly information blocks, bright but uncluttered layout. No copyrighted characters, no logos, no watermark, no extra text.",
      "tags": [
        "kids birthday flyer",
        "park party invitation",
        "birthday invitation",
        "children party flyer",
        "flyer template"
      ]
    },
    {
      "title": "Sweet 16 Invitation",
      "description": "A pink birthday invitation with a clear name, milestone age, date, venue, and RSVP.",
      "image": "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-flyer-generator/sweet-16-invitation_thumb.webp",
      "prompt": "Create an elegant Sweet 16 birthday flyer with the name, age, date, venue, RSVP, dress code, and a pink and silver celebration theme.",
      "tags": [
        "Birthday",
        "Sweet 16"
      ]
    }
  ],
  "club-flyers": [
    {
      "title": "DJ Lounge Night",
      "description": "A sophisticated nightlife flyer for DJ sets, lounges, cocktails, cigars, and late-night events.",
      "image": "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-flyer-generator/user-demand-20260710/ai-flyer-generator-user-demand-dj-lounge-night_thumb.webp",
      "prompt": "Use case: ads-marketing. Asset type: vertical nightlife flyer template. Create a premium 4:5 DJ lounge flyer with an elegant fictional female DJ silhouette, velvet seating, warm gold lighting, subtle smoke, cocktail and vinyl details, deep black, burgundy, and champagne palette. Exact text, each rendered once: \"VELVET FRIDAYS\", \"DJ NOVA\", \"CIGARS • COCKTAILS • GOOD VIBES\", \"8 PM–12 AM\", \"THE COPPER ROOM\". Luxurious editorial typography, clear event hierarchy, tasteful adult nightlife mood. No real person likeness, no real alcohol brands, no logos, no watermark, no extra text.",
      "tags": [
        "dj flyer",
        "nightclub flyer",
        "lounge flyer",
        "party flyer",
        "flyer template"
      ]
    },
    {
      "title": "Electric Night Festival",
      "description": "A neon nightlife flyer with a prominent event name, lineup, date, venue, and ticket action.",
      "image": "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-image-maker/party-flyer_thumb.webp",
      "prompt": "Create a neon club night flyer with event name, DJ lineup, date, venue, doors-open time, age note, and ticket link. Make the date and venue easy to scan.",
      "tags": [
        "Club",
        "Nightlife",
        "DJ"
      ]
    }
  ],
  "real-estate-flyers": [
    {
      "title": "Just Listed Flyer",
      "description": "Start from a property flyer example, then replace the listing, showing, and agent details.",
      "image": "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-flyer-generator/real-estate-templates_thumb.webp",
      "prompt": "Create a just-listed real estate flyer with a large approved property photo, price, neighborhood, key features, agent contact, and schedule-a-tour CTA.",
      "tags": [
        "Real estate",
        "Property"
      ]
    },
    {
      "title": "For Sale Flyer",
      "description": "Start from a property flyer example, then replace the listing, showing, and agent details.",
      "image": "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-flyer-generator/for-sale-flyer_thumb.webp",
      "prompt": "Create a for-sale property flyer with an approved home photo, price, address, property features, agent name, phone number, and contact CTA.",
      "tags": [
        "Real estate",
        "Property"
      ]
    },
    {
      "title": "Open House Flyer",
      "description": "Start from a property flyer example, then replace the listing, showing, and agent details.",
      "image": "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-flyer-generator/open-house-flyer_thumb.webp",
      "prompt": "Create an open house flyer with the date, time, property address, approved property photo, top features, agent contact, and visit-this-weekend CTA.",
      "tags": [
        "Real estate",
        "Property"
      ]
    }
  ],
  "party-flyers": [
    {
      "title": "DJ Lounge Night",
      "description": "A sophisticated nightlife flyer for DJ sets, lounges, cocktails, cigars, and late-night events.",
      "image": "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-flyer-generator/user-demand-20260710/ai-flyer-generator-user-demand-dj-lounge-night_thumb.webp",
      "prompt": "Use case: ads-marketing. Asset type: vertical nightlife flyer template. Create a premium 4:5 DJ lounge flyer with an elegant fictional female DJ silhouette, velvet seating, warm gold lighting, subtle smoke, cocktail and vinyl details, deep black, burgundy, and champagne palette. Exact text, each rendered once: \"VELVET FRIDAYS\", \"DJ NOVA\", \"CIGARS • COCKTAILS • GOOD VIBES\", \"8 PM–12 AM\", \"THE COPPER ROOM\". Luxurious editorial typography, clear event hierarchy, tasteful adult nightlife mood. No real person likeness, no real alcohol brands, no logos, no watermark, no extra text.",
      "tags": [
        "dj flyer",
        "nightclub flyer",
        "lounge flyer",
        "party flyer",
        "flyer template"
      ]
    },
    {
      "title": "Luxury Birthday Party",
      "description": "A glamorous adult birthday invitation with portrait space, premium styling, and clear RSVP details.",
      "image": "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-flyer-generator/user-demand-20260710/ai-flyer-generator-user-demand-luxury-birthday-party_thumb.webp",
      "prompt": "Use case: ads-marketing. Asset type: vertical birthday party flyer template. Create a glamorous 4:5 birthday flyer with a fictional woman in an elegant evening portrait, champagne-gold light, ivory florals, black satin texture, and soft blush accents. Exact text, each rendered once: \"CHLOE’S 37TH\", \"QUEEN STATUS\", \"SATURDAY • 7 PM\", \"THE GRAND LOFT\", \"DRESS TO IMPRESS\", \"RSVP 555 0147\". High-fashion invitation composition with a clear portrait replacement area and polished serif typography. No real celebrity likeness, no brand logos, no watermark, no extra text.",
      "tags": [
        "birthday flyer",
        "adult birthday invitation",
        "glam birthday flyer",
        "party invitation",
        "flyer template"
      ]
    },
    {
      "title": "Cultural Festival",
      "description": "A bright community festival flyer for national days, live performers, food, and family programming.",
      "image": "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-flyer-generator/user-demand-20260710/ai-flyer-generator-user-demand-cultural-festival_thumb.webp",
      "prompt": "Use case: ads-marketing. Asset type: vertical cultural festival flyer template. Create a vibrant 4:5 community celebration flyer with fireworks, festive textile patterns, a fictional singer on stage, families in the background, and green, ivory, coral, and gold accents. Exact text, each rendered once: \"UNITY DAY FESTIVAL\", \"LIVE MUSIC • FOOD • FAMILY FUN\", \"AUGUST 29 • 5–10 PM\", \"RIVERFRONT PARK\", \"FREE ENTRY & PARKING\". Keep the layout inclusive, energetic, highly readable, and suitable for replacing the performer photo or community logo. No real flags, no real person likeness, no logos, no watermark, no extra text.",
      "tags": [
        "cultural festival flyer",
        "community event flyer",
        "music festival flyer",
        "family event flyer",
        "flyer template"
      ]
    }
  ]
};

export const restoredFlyerMakerSlugs = ["church-flyer-maker", "event-flyer-maker", "birthday-flyer-maker", "club-flyer-maker", "real-estate-flyer-maker"] as const;
export const restoredFlyerMakerPages = restoredFlyerMakerSlugs.map((slug) => {
  const page = getFlyerSeoLandingPage(slug);
  if (!page) throw new Error(`Missing restored flyer page: ${slug}`);
  return page;
});
export const restoredFlyerMakerPaths = restoredFlyerMakerPages.map((page) => "/docs/" + page.slug);
export const restoredFlyerTemplatePaths = restoredFlyerCategories.map((category) => "/templates/flyers/" + category.slug);

export function getRestoredFlyerMaker(slug: string): FlyerSeoLandingPage | undefined {
  return restoredFlyerMakerPages.find((page) => page.slug === slug);
}
export function getRestoredFlyerCategory(slug: string) {
  return restoredFlyerCategories.find((category) => category.slug === slug);
}
export function getFlyerTopicMakerHref(category: FlyerTopicCategory) {
  const maker = restoredFlyerMakerPages.find((page) => page.categorySlug === category.slug);
  return maker ? "/docs/" + maker.slug : "/tools/party-flyer-generator";
}
export function buildFlyerTopicGeneratorHref(prompt: string) {
  return "/ai-flyer-generator?" + new URLSearchParams({ prompt, ref: "flyer-topic" }).toString();
}
export function buildFlyerTopicMetadata(page: {title: string; description: string}, path: string, image: string): Metadata {
  const imageUrl = new URL(image, "https://vismuse.com").toString();
  return {
    title: page.title, description: page.description, alternates: { canonical: path }, robots: { index: true, follow: true },
    openGraph: { title: page.title + " | Vismuse", description: page.description, url: "https://vismuse.com" + path, siteName: "Vismuse", type: "website", images: [{ url: imageUrl, alt: page.title }] },
    twitter: { card: "summary_large_image", title: page.title + " | Vismuse", description: page.description, images: [imageUrl] }
  };
}
