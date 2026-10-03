export type FlyerSeoLandingPage = {
  slug: string;
  categorySlug: string;
  label: string;
  shortLabel: string;
  title: string;
  description: string;
  h1: string;
  lede: string;
  primaryKeyword: string;
  supportingKeywords: string[];
  imageKeywords: string[];
  audience: string;
  searchIntent: string;
  ctaLabel: string;
  primaryPrompt: string;
  promptExamples: Array<{
    title: string;
    prompt: string;
  }>;
  copyChecklist: string[];
  formatTips: string[];
  faq: Array<{
    question: string;
    answer: string;
  }>;
  related: string[];
};

export const flyerSeoLandingPages: FlyerSeoLandingPage[] = [
  {
    slug: "party-flyer-maker",
    categorySlug: "party-flyers",
    label: "Party Flyer Maker",
    shortLabel: "party flyer",
    title: "Party Flyer Maker for Events, Club Nights, and Invites",
    description:
      "Make party flyers for birthdays, club nights, neighborhood events, and private parties with AI prompts, flyer examples, and ready-to-edit details.",
    h1: "Party flyer maker for events, club nights, and invites",
    lede:
      "Plan a party flyer around the event vibe first, then make the date, venue, host, RSVP, and call to action easy to scan.",
    primaryKeyword: "party flyer maker",
    supportingKeywords: ["party flyer", "party flyers", "party flyer templates", "birthday party flyer", "club flyer maker"],
    imageKeywords: ["party", "club", "nightlife", "birthday", "drink vendor", "summer night"],
    audience: "Hosts, DJs, event planners, venues, and creators promoting parties or social events.",
    searchIntent: "Find a fast way to design a party flyer or start from party flyer examples.",
    ctaLabel: "Create a party flyer",
    primaryPrompt:
      "Create a bold party flyer with event title, date, time, venue, host names, RSVP contact, music style, dress code, and a high-energy 4:5 social layout.",
    promptExamples: [
      {
        title: "Club night flyer",
        prompt:
          "Create a neon club night flyer for [event name]. Include DJ lineup, date, venue, doors open time, ticket link, age note, and dramatic nightclub lighting."
      },
      {
        title: "Block party flyer",
        prompt:
          "Create a friendly block party flyer with neighborhood name, date, time, location, food note, activities, RSVP contact, and warm community style."
      },
      {
        title: "Private party invite",
        prompt:
          "Create an elegant private party flyer with host name, theme, dress code, date, address area, RSVP details, and premium evening typography."
      }
    ],
    copyChecklist: ["Event name", "Date and time", "Venue or address area", "Host or lineup", "RSVP or ticket CTA"],
    formatTips: ["Use 4:5 for Instagram feeds", "Use 9:16 for stories", "Keep date and venue in one readable block"],
    faq: [
      {
        question: "What should a party flyer include?",
        answer:
          "Include the event name, date, time, venue, host or lineup, RSVP details, ticket link, dress code, and one clear CTA."
      },
      {
        question: "Can I make a birthday party flyer from this page?",
        answer:
          "Yes. Use the party flyer prompt and add the celebrant name, age, theme, venue, date, and RSVP details."
      },
      {
        question: "Should this page generate the flyer directly?",
        answer:
          "The page helps you plan the party flyer and sends the completed prompt to the AI Flyer Generator, where generation happens."
      }
    ],
    related: ["birthday-flyer-maker", "sweet-16-flyer-maker", "club-flyer-maker", "event-flyer-maker"]
  },
  {
    slug: "birthday-flyer-maker",
    categorySlug: "birthday-flyers",
    label: "Birthday Flyer Maker",
    shortLabel: "birthday flyer",
    title: "Birthday Flyer Maker for Party Invites and Celebrations",
    description:
      "Create birthday flyers for parties, Sweet 16 events, milestone birthdays, and social invites with AI prompt examples and editable flyer ideas.",
    h1: "Birthday flyer maker for party invites and celebrations",
    lede:
      "Build a birthday flyer that makes the name, age, theme, date, venue, RSVP, and celebration mood instantly clear.",
    primaryKeyword: "birthday flyer",
    supportingKeywords: ["birthday flyer template", "birthday party flyer", "birthday flyers", "birthday flyer design"],
    imageKeywords: ["birthday", "sweet 16", "celebration", "party", "invitation"],
    audience: "Parents, hosts, party planners, venues, and creators designing birthday announcements.",
    searchIntent: "Find birthday flyer ideas, templates, or a fast way to make a birthday party flyer.",
    ctaLabel: "Create a birthday flyer",
    primaryPrompt:
      "Create a birthday flyer with celebrant name, age, theme, date, venue, RSVP details, dress code, and festive readable typography in a portrait social format.",
    promptExamples: [
      {
        title: "Sweet 16 flyer",
        prompt:
          "Create a glam Sweet 16 birthday flyer with name, age, date, venue, RSVP, pink and silver theme, dress code, and readable invitation layout."
      },
      {
        title: "Kids birthday flyer",
        prompt:
          "Create a kids birthday flyer with child name, age, playful theme, date, time, venue, parent RSVP contact, and cheerful colors."
      },
      {
        title: "Milestone birthday flyer",
        prompt:
          "Create a milestone birthday flyer for [age]. Use elegant party styling, large name treatment, date, venue, RSVP, and premium night-event mood."
      }
    ],
    copyChecklist: ["Name and age", "Party theme", "Date and time", "Venue", "RSVP contact"],
    formatTips: ["Use portrait for invites", "Keep the name and age largest", "Avoid crowding the flyer with long gift notes"],
    faq: [
      {
        question: "What details do I need for a birthday flyer?",
        answer:
          "Add the celebrant name, age, party theme, date, time, venue, RSVP contact, dress code, and any note guests must know."
      },
      {
        question: "Can I make Sweet 16 invitations?",
        answer:
          "Yes. Add Sweet 16, color palette, venue, date, RSVP, dress code, and whether the design should feel glam, playful, elegant, or modern."
      },
      {
        question: "What size should a birthday flyer be?",
        answer:
          "Use 4:5 for feed posts, 9:16 for stories, and letter or A4 if you plan to print the flyer."
      }
    ],
    related: ["party-flyer-maker", "sweet-16-flyer-maker", "event-flyer-maker"]
  },
  {
    slug: "real-estate-flyer-maker",
    categorySlug: "real-estate-flyers",
    label: "Real Estate Flyer Maker",
    shortLabel: "real estate flyer",
    title: "Real Estate Flyer Maker for Listings and Open Houses",
    description:
      "Make real estate flyers for listings, open houses, agent promos, and property marketing with AI prompts, copy checklists, and flyer examples.",
    h1: "Real estate flyer maker for listings and open houses",
    lede:
      "Create a property flyer that highlights the home, price or offer, location, showing details, agent contact, and next step.",
    primaryKeyword: "real estate flyer",
    supportingKeywords: ["real estate flyers", "real estate flyer template", "real estate flyer maker", "open house flyer"],
    imageKeywords: ["real estate", "property", "open house", "for sale", "listing", "agent"],
    audience: "Agents, brokers, property managers, and real estate marketers.",
    searchIntent: "Find listing flyer examples, real estate flyer templates, or a faster way to make an open house flyer.",
    ctaLabel: "Create a real estate flyer",
    primaryPrompt:
      "Create a modern real estate flyer with property photo area, price, address area, key features, open house or tour CTA, agent name, phone number, and clean listing layout.",
    promptExamples: [
      {
        title: "Just listed flyer",
        prompt:
          "Create a just-listed real estate flyer with large property photo, price, neighborhood, four feature bullets, agent contact footer, and schedule-a-tour CTA."
      },
      {
        title: "Open house flyer",
        prompt:
          "Create an open house flyer with date, time, address area, property highlights, agent details, QR code space, and a clear visit-this-weekend CTA."
      },
      {
        title: "Agent promo flyer",
        prompt:
          "Create a real estate agent flyer promoting listing services with agent photo space, recent sales, credibility points, phone number, website, and contact CTA."
      }
    ],
    copyChecklist: ["Property type", "Price or offer", "Location or neighborhood", "Top features", "Agent contact"],
    formatTips: ["Use a large photo area", "Keep agent details in the footer", "Use a clean print-friendly layout"],
    faq: [
      {
        question: "What should a real estate flyer include?",
        answer:
          "Include a strong property photo, price or positioning, location, key features, open house details, agent contact information, and a clear CTA."
      },
      {
        question: "Can I make open house flyers?",
        answer:
          "Yes. Add the open house date and time, address area, property highlights, agent contact details, and a visit or schedule-tour CTA."
      },
      {
        question: "Is real estate flyer maker better than real estate flyer generator as a keyword?",
        answer:
          "This page focuses on planning the real estate flyer itself, then sends the finished brief to the AI Flyer Generator."
      }
    ],
    related: ["open-house-flyer-maker", "business-flyer-maker", "event-flyer-maker"]
  },
  {
    slug: "business-flyer-maker",
    categorySlug: "business-flyers",
    label: "Business Flyer Maker",
    shortLabel: "business flyer",
    title: "Business Flyer Maker for Services, Offers, and Local Promotions",
    description:
      "Make business flyers for local services, workshops, launches, promotions, and offers with AI prompt examples and campaign-ready copy guidance.",
    h1: "Business flyer maker for services, offers, and local promotions",
    lede:
      "Create a business flyer that makes the offer, benefit, service area, contact details, and booking CTA easy to act on.",
    primaryKeyword: "business flyers",
    supportingKeywords: ["business flyer", "business flyer templates", "flyers for business", "how to make a business flyer"],
    imageKeywords: ["business", "local service", "product", "sale", "premium", "offer"],
    audience: "Small businesses, local service providers, consultants, and teams promoting offers.",
    searchIntent: "Find business flyer examples, business flyer templates, or a fast way to make a local promotion.",
    ctaLabel: "Create a business flyer",
    primaryPrompt:
      "Create a clean business flyer for a local service with headline, three benefits, offer, service area, phone number, website, QR code space, and a strong booking CTA.",
    promptExamples: [
      {
        title: "Local service flyer",
        prompt:
          "Create a local service flyer with a bold benefit headline, three service bullets, limited-time offer, phone number, website, and professional CTA block."
      },
      {
        title: "Workshop flyer",
        prompt:
          "Create a workshop flyer with topic, speaker, date, venue, three outcomes, QR code space, and register-now CTA."
      },
      {
        title: "Launch offer flyer",
        prompt:
          "Create a business launch flyer with opening offer, service promise, dates, address, website, phone number, and visit-us CTA."
      }
    ],
    copyChecklist: ["Offer or service", "Main benefit", "Service area", "Phone or website", "Booking CTA"],
    formatTips: ["Use a phone number large enough for print", "Put the offer near the headline", "Use clear proof points"],
    faq: [
      {
        question: "What makes a good business flyer?",
        answer:
          "A good business flyer has one offer, one audience, a clear benefit, contact details, and a CTA that tells people what to do next."
      },
      {
        question: "Can I make local service flyers?",
        answer:
          "Yes. Add the service, area served, benefits, offer, phone number, website, and booking CTA."
      },
      {
        question: "Should I use business flyer or business flyer maker in the URL?",
        answer:
          "Use business-flyer-maker for the page URL, while the page copy also covers business flyers and business flyer templates."
      }
    ],
    related: ["construction-flyer-maker", "photography-flyer-maker", "pressure-washing-flyer-maker", "salon-flyer-maker", "hiring-flyer-maker"]
  },
  {
    slug: "event-flyer-maker",
    categorySlug: "event-flyers",
    label: "Event Flyer Maker",
    shortLabel: "event flyer",
    title: "Event Flyer Maker for Workshops, Meetups, and Local Events",
    description:
      "Make event flyers for workshops, meetups, fundraisers, local events, and registration campaigns with AI prompts and layout guidance.",
    h1: "Event flyer maker for workshops, meetups, and local events",
    lede:
      "Build an event flyer around the title, date, location, host, benefits, registration link, and one clear reason to attend.",
    primaryKeyword: "event flyer",
    supportingKeywords: ["event flyers", "event flyer templates", "event flyer examples", "event flyer maker"],
    imageKeywords: ["event", "party", "registration", "workshop", "community", "sports", "invitation"],
    audience: "Organizers, venues, schools, nonprofits, creators, and local businesses running events.",
    searchIntent: "Find event flyer examples, templates, or a fast way to create a registration flyer.",
    ctaLabel: "Create an event flyer",
    primaryPrompt:
      "Create an event flyer with title, date, time, venue, host, key benefits, sponsor row, QR code space, and a register-now CTA.",
    promptExamples: [
      {
        title: "Workshop event flyer",
        prompt:
          "Create a workshop event flyer with topic, speaker, date, time, venue, three learning outcomes, QR code space, and register-now CTA."
      },
      {
        title: "Community event flyer",
        prompt:
          "Create a community event flyer with event name, date, location, family-friendly activities, sponsor row, RSVP contact, and welcoming local style."
      },
      {
        title: "Fundraiser event flyer",
        prompt:
          "Create a fundraiser event flyer with cause headline, donation goal, date, venue, sponsor area, QR code space, and donate-or-register CTA."
      }
    ],
    copyChecklist: ["Event title", "Date and time", "Venue", "Host or speaker", "Registration CTA"],
    formatTips: ["Use a strong date block", "Keep sponsor logos away from the headline", "Reserve space for a QR code"],
    faq: [
      {
        question: "What should an event flyer include?",
        answer:
          "Include the event name, date, time, venue, host, audience, benefits, RSVP or registration link, and CTA."
      },
      {
        question: "Can I make fundraiser event flyers?",
        answer:
          "Yes. Include the cause, goal, donation method, sponsor details, date, venue, and donate or register CTA."
      },
      {
        question: "Is event flyer generator the main keyword?",
        answer:
          "This page focuses on event flyer planning, examples, and prompt structure while the final generation happens in the AI Flyer Generator."
      }
    ],
    related: ["party-flyer-maker", "workshop-flyer-maker", "talent-show-flyer-maker", "concert-flyer-maker"]
  },
  {
    slug: "cleaning-service-flyer-maker",
    categorySlug: "cleaning-flyers",
    label: "Cleaning Service Flyer Maker",
    shortLabel: "cleaning service flyer",
    title: "Cleaning Service Flyer Maker for House Cleaning and Local Offers",
    description:
      "Make cleaning service flyers for house cleaning, deep cleaning, move-out cleaning, and commercial cleaning offers with AI prompts and flyer copy guidance.",
    h1: "Cleaning service flyer maker for house cleaning and local offers",
    lede:
      "Create a cleaning flyer that makes the service, offer, area served, phone number, proof points, and booking CTA easy to trust.",
    primaryKeyword: "cleaning service flyer",
    supportingKeywords: ["house cleaning flyer", "cleaning business flyers", "cleaning company flyers", "cleaning services flyers"],
    imageKeywords: ["cleaning", "local service", "home service", "business", "service flyer"],
    audience: "Cleaning businesses, home service teams, solo cleaners, and local service marketers.",
    searchIntent: "Find cleaning flyer examples, templates, or a fast way to create a local cleaning service promotion.",
    ctaLabel: "Create a cleaning flyer",
    primaryPrompt:
      "Create a cleaning service flyer with headline, house cleaning services, service area, first-booking offer, phone number, website, trust badges, and book-now CTA.",
    promptExamples: [
      {
        title: "House cleaning flyer",
        prompt:
          "Create a house cleaning flyer with headline, deep cleaning and recurring cleaning bullets, service area, first-booking discount, phone number, website, and clean trustworthy style."
      },
      {
        title: "Move-out cleaning flyer",
        prompt:
          "Create a move-out cleaning flyer with apartment and home cleaning services, checklist-style benefits, deadline-friendly CTA, phone number, and booking website."
      },
      {
        title: "Commercial cleaning flyer",
        prompt:
          "Create a commercial cleaning flyer for offices with service list, flexible schedule note, insured team proof point, phone number, website, and request-a-quote CTA."
      }
    ],
    copyChecklist: ["Cleaning service type", "Area served", "Offer", "Phone number", "Booking CTA"],
    formatTips: ["Use clean high-contrast design", "Make phone number prominent", "Include trust points such as insured or locally owned"],
    faq: [
      {
        question: "What should a cleaning service flyer include?",
        answer:
          "Include the cleaning services offered, area served, offer or package, phone number, website, proof points, and booking CTA."
      },
      {
        question: "Can I make house cleaning flyers?",
        answer:
          "Yes. Use the prompt with house cleaning, deep cleaning, recurring cleaning, move-out cleaning, and your service area."
      },
      {
        question: "Why target cleaning service flyer?",
        answer:
          "Cleaning service flyers have a clear local business job: show the service, build trust, make the offer readable, and get people to book."
      }
    ],
    related: ["house-cleaning-flyer", "business-flyer-maker", "sale-flyer-maker"]
  },
  {
    slug: "open-house-flyer-maker",
    categorySlug: "open-house-flyers",
    label: "Open House Flyer Maker",
    shortLabel: "open house flyer",
    title: "Open House Flyer Maker for Property Showings",
    description:
      "Create open house flyers for listings, weekend showings, agent promos, and property tours with prompt examples and layout guidance.",
    h1: "Open house flyer maker for property showings",
    lede:
      "Make an open house flyer that puts the date, time, address area, property highlights, agent contact, and visit CTA in the right order.",
    primaryKeyword: "open house flyer",
    supportingKeywords: ["open house flyer template", "real estate open house flyer", "open house flyers", "open house flyer maker"],
    imageKeywords: ["open house", "real estate", "property", "listing", "agent", "showing"],
    audience: "Agents, brokerages, property managers, and sellers promoting scheduled property showings.",
    searchIntent: "Find an open house flyer example or quickly create a real estate showing flyer.",
    ctaLabel: "Create an open house flyer",
    primaryPrompt:
      "Create an open house flyer with property photo area, open house date and time, address area, top property features, agent name, phone number, QR code space, and visit-this-weekend CTA.",
    promptExamples: [
      {
        title: "Weekend showing flyer",
        prompt:
          "Create a weekend open house flyer with large home photo, date and time block, neighborhood, three property highlights, agent footer, and visit-this-weekend CTA."
      },
      {
        title: "Luxury open house flyer",
        prompt:
          "Create a luxury open house flyer with elegant typography, premium property photo, address area, showing time, lifestyle feature bullets, and schedule-a-private-tour CTA."
      },
      {
        title: "Condo open house flyer",
        prompt:
          "Create a condo open house flyer with city-style visual direction, amenities, price area, showing date, agent contact, QR code space, and clean 4:5 social layout."
      }
    ],
    copyChecklist: ["Property headline", "Open house date and time", "Address area", "Top features", "Agent contact"],
    formatTips: ["Use a large property image", "Make the date block impossible to miss", "Reserve space for a QR code"],
    faq: [
      {
        question: "What should an open house flyer include?",
        answer:
          "Include the property photo, open house date and time, address area, strongest features, agent contact, and one clear visit or schedule-tour CTA."
      },
      {
        question: "Can I make open house social posts from this page?",
        answer:
          "Yes. Use 4:5 for feed posts, 9:16 for stories, and keep the showing date and agent contact readable."
      },
      {
        question: "Should open house flyers be different from listing flyers?",
        answer:
          "Yes. Open house flyers should make the visit time and location clearer than a general listing flyer."
      }
    ],
    related: ["real-estate-flyer-maker", "business-flyer-maker", "event-flyer-maker"]
  },
  {
    slug: "restaurant-flyer-maker",
    categorySlug: "restaurant-flyers",
    label: "Restaurant Flyer Maker",
    shortLabel: "restaurant flyer",
    title: "Restaurant Flyer Maker for Menus, Specials, and Local Food Promos",
    description:
      "Make restaurant flyers for menu specials, happy hours, grand openings, delivery promos, catering, and local food campaigns.",
    h1: "Restaurant flyer maker for menus, specials, and local food promos",
    lede:
      "Create a restaurant flyer that makes the dish, offer, hours, address, ordering method, and appetite appeal easy to understand.",
    primaryKeyword: "restaurant flyer",
    supportingKeywords: ["restaurant flyer template", "food flyer", "menu flyer", "restaurant promotion flyer"],
    imageKeywords: ["restaurant", "food", "menu", "delivery", "happy hour", "catering"],
    audience: "Restaurants, cafes, food trucks, bars, caterers, and local food brands promoting offers.",
    searchIntent: "Find restaurant flyer ideas, menu flyer examples, or a fast way to create a food promotion.",
    ctaLabel: "Create a restaurant flyer",
    primaryPrompt:
      "Create a restaurant flyer with featured dish, special offer, menu highlights, hours, address, phone number, ordering method, and order-now CTA.",
    promptExamples: [
      {
        title: "Lunch special flyer",
        prompt:
          "Create a restaurant lunch special flyer with hero dish photo direction, price, hours, address, phone number, delivery app note, and order-now CTA."
      },
      {
        title: "Happy hour flyer",
        prompt:
          "Create a happy hour flyer with drink specials, food offer, day and time, venue address, social handle, and energetic evening style."
      },
      {
        title: "Catering flyer",
        prompt:
          "Create a catering flyer with package headline, food categories, service area, phone number, website, delivery note, and request-a-quote CTA."
      }
    ],
    copyChecklist: ["Food or offer headline", "Menu details", "Hours or dates", "Address or delivery method", "Order CTA"],
    formatTips: ["Use one hero dish", "Keep prices readable", "Make ordering details larger than decorative copy"],
    faq: [
      {
        question: "What should a restaurant flyer include?",
        answer:
          "Include the featured dish or offer, menu details, price or promotion, hours, address, phone number, ordering method, and CTA."
      },
      {
        question: "Can I make menu flyers?",
        answer:
          "Yes. Keep menu sections short and ask for a readable menu flyer layout rather than a dense full restaurant menu."
      },
      {
        question: "What format works best for restaurant flyers?",
        answer:
          "Use 4:5 for social posts, 9:16 for stories, and letter or A4 for delivery inserts or local print handouts."
      }
    ],
    related: ["food-flyer-maker", "menu-flyer-maker", "drink-vendor-flyer-maker", "farmers-market-flyer-maker"]
  },
  {
    slug: "grand-opening-flyer-maker",
    categorySlug: "grand-opening-flyers",
    label: "Grand Opening Flyer Maker",
    shortLabel: "grand opening flyer",
    title: "Grand Opening Flyer Maker for New Businesses and Local Launches",
    description:
      "Create grand opening flyers for new stores, restaurants, salons, gyms, pop-ups, and local launch events.",
    h1: "Grand opening flyer maker for new businesses and local launches",
    lede:
      "Make a grand opening flyer that highlights the business name, opening date, location, launch offer, event details, and visit CTA.",
    primaryKeyword: "grand opening flyer",
    supportingKeywords: ["grand opening flyer template", "business opening flyer", "grand opening announcement", "new business flyer"],
    imageKeywords: ["grand opening", "opening", "launch", "business", "restaurant", "salon", "local"],
    audience: "New local businesses, restaurants, salons, gyms, shops, pop-ups, and service teams.",
    searchIntent: "Find a grand opening flyer example or quickly make a launch announcement for a new business.",
    ctaLabel: "Create a grand opening flyer",
    primaryPrompt:
      "Create a grand opening flyer with business name, opening date, address, launch offer, event highlights, phone number, website, and visit-us CTA.",
    promptExamples: [
      {
        title: "Store opening flyer",
        prompt:
          "Create a grand opening flyer for a new store with business name, opening date, address, first-week offer, hours, website, and visit-us CTA."
      },
      {
        title: "Restaurant opening flyer",
        prompt:
          "Create a restaurant grand opening flyer with signature dish, opening date, address, opening offer, hours, phone number, and order-or-visit CTA."
      },
      {
        title: "Salon opening flyer",
        prompt:
          "Create a salon grand opening flyer with services, opening date, launch discount, address, booking phone number, Instagram handle, and book-now CTA."
      }
    ],
    copyChecklist: ["Business name", "Opening date", "Location", "Launch offer", "Visit CTA"],
    formatTips: ["Lead with the opening date", "Keep the address and hours together", "Use the offer as a secondary highlight"],
    faq: [
      {
        question: "What should a grand opening flyer include?",
        answer:
          "Include the business name, opening date, address, hours, launch offer, event details, contact information, and visit CTA."
      },
      {
        question: "Can I make restaurant or salon opening flyers?",
        answer:
          "Yes. Add the business type, service or menu highlight, address, opening date, launch promotion, and booking or visit CTA."
      },
      {
        question: "Should a grand opening flyer be printable?",
        answer:
          "Often yes. Generate both a 4:5 social version and a letter or A4 print version for local distribution."
      }
    ],
    related: ["business-flyer-maker", "restaurant-flyer-maker", "sale-flyer-maker", "hiring-flyer-maker"]
  },
  {
    slug: "sale-flyer-maker",
    categorySlug: "sale-flyers",
    label: "Sale Flyer Maker",
    shortLabel: "sale flyer",
    title: "Sale Flyer Maker for Discounts, Offers, and Retail Promotions",
    description:
      "Create sale flyers for discounts, flash sales, clearance events, weekend offers, retail promos, and local business campaigns.",
    h1: "Sale flyer maker for discounts, offers, and retail promotions",
    lede:
      "Make a sale flyer that puts the discount, deadline, product or service, store details, and shop-now CTA where people can see it quickly.",
    primaryKeyword: "sale flyer",
    supportingKeywords: ["sale flyer template", "sales flyer", "promotion flyer", "discount flyer"],
    imageKeywords: ["sale", "discount", "offer", "promotion", "retail", "product"],
    audience: "Retail shops, ecommerce brands, local businesses, service providers, and teams promoting limited-time offers.",
    searchIntent: "Find a sale flyer example or create a discount flyer that makes the offer clear fast.",
    ctaLabel: "Create a sale flyer",
    primaryPrompt:
      "Create a sale flyer with large discount headline, featured product or service, deadline, store details, website, phone number, and shop-now CTA.",
    promptExamples: [
      {
        title: "Flash sale flyer",
        prompt:
          "Create a flash sale flyer with a large discount headline, featured product space, deadline, store name, website, and shop-now CTA."
      },
      {
        title: "Clearance sale flyer",
        prompt:
          "Create a clearance sale flyer with percent-off headline, featured categories, dates, store location, website, and limited-time CTA."
      },
      {
        title: "Weekend offer flyer",
        prompt:
          "Create a weekend offer flyer for a local service with offer headline, service benefits, dates, phone number, website, and book-now CTA."
      }
    ],
    copyChecklist: ["Discount headline", "Product or service", "Deadline", "Store details", "Shop CTA"],
    formatTips: ["Make the discount largest", "Keep the deadline close to the CTA", "Use high contrast for price and offer blocks"],
    faq: [
      {
        question: "What should a sale flyer include?",
        answer:
          "Include the discount or offer, featured product or service, deadline, store details, contact information, and CTA."
      },
      {
        question: "Can I make retail and local service sale flyers?",
        answer:
          "Yes. Add the product, service, discount, campaign dates, location, website, and phone number."
      },
      {
        question: "What makes a sale flyer convert?",
        answer:
          "The offer, deadline, and CTA should be readable first. Keep supporting details shorter than the discount and action block."
      }
    ],
    related: ["black-friday-flyer-maker", "business-flyer-maker", "grand-opening-flyer-maker", "yard-sale-flyer-maker"]
  },
  {
    slug: "sweet-16-flyer-maker",
    categorySlug: "birthday-flyers",
    label: "Sweet 16 Flyer Maker",
    shortLabel: "Sweet 16 flyer",
    title: "Sweet 16 Flyer Maker for Birthday Parties and Invitations",
    description:
      "Create Sweet 16 flyers and invitations with name, age, theme, date, venue, dress code, RSVP, and celebration style.",
    h1: "Sweet 16 flyer maker for birthday parties and invitations",
    lede:
      "Make a Sweet 16 flyer that gives the celebration a clear theme while keeping the name, age, date, venue, RSVP, and dress code readable.",
    primaryKeyword: "sweet 16 flyer",
    supportingKeywords: ["sweet 16 invitation flyer", "sweet sixteen flyer", "sweet 16 birthday flyer", "sweet 16 party flyer"],
    imageKeywords: ["sweet 16", "birthday", "celebration", "party", "invitation", "glam"],
    audience: "Families, party planners, hosts, venues, and creators making Sweet 16 announcements.",
    searchIntent: "Find Sweet 16 flyer ideas, invitation examples, or a fast way to create a birthday party flyer.",
    ctaLabel: "Create a Sweet 16 flyer",
    primaryPrompt:
      "Create a Sweet 16 flyer with celebrant name, age, party theme, date, venue, dress code, RSVP details, color palette, and elegant portrait invitation layout.",
    promptExamples: [
      {
        title: "Glam Sweet 16 flyer",
        prompt:
          "Create a glam Sweet 16 flyer with name, age, date, venue, RSVP, pink and silver palette, dress code, and elegant readable typography."
      },
      {
        title: "Neon Sweet 16 flyer",
        prompt:
          "Create a neon Sweet 16 party flyer with celebrant name, age, date, venue, music vibe, RSVP, and high-energy night party style."
      },
      {
        title: "Elegant invitation flyer",
        prompt:
          "Create an elegant Sweet 16 invitation flyer with floral accents, name, age, date, venue, RSVP phone number, dress code, and premium portrait layout."
      }
    ],
    copyChecklist: ["Name and age", "Theme", "Date and time", "Venue", "RSVP contact"],
    formatTips: ["Use portrait for invitations", "Make the name and age the hero", "Keep RSVP details separate from decorative copy"],
    faq: [
      {
        question: "What should a Sweet 16 flyer include?",
        answer:
          "Include the celebrant name, age, theme, date, time, venue, dress code, RSVP contact, and any note guests must know."
      },
      {
        question: "Can I make Sweet 16 invitations?",
        answer:
          "Yes. Use a portrait invitation format and include the RSVP and dress code clearly."
      },
      {
        question: "What style works for Sweet 16 flyers?",
        answer:
          "Glam, elegant, neon, floral, luxury, and playful themes can all work if the name, age, date, and venue stay readable."
      }
    ],
    related: ["birthday-flyer-maker", "party-flyer-maker", "event-flyer-maker"]
  },
  {
    slug: "house-cleaning-flyer",
    categorySlug: "cleaning-flyers",
    label: "House Cleaning Flyer Maker",
    shortLabel: "house cleaning flyer",
    title: "House Cleaning Flyer Maker for Local Cleaning Services",
    description:
      "Create house cleaning flyers for recurring cleaning, deep cleaning, move-out cleaning, first-booking offers, and local service promotions.",
    h1: "House cleaning flyer maker for local cleaning services",
    lede:
      "Make a house cleaning flyer that builds trust quickly with services, area served, offer, phone number, proof points, and booking CTA.",
    primaryKeyword: "house cleaning flyer",
    supportingKeywords: ["house cleaning flyer template", "home cleaning flyer", "cleaning service flyer", "cleaning business flyer"],
    imageKeywords: ["house cleaning", "cleaning", "home service", "local service", "maid service"],
    audience: "Residential cleaners, solo cleaning businesses, local service teams, and home service marketers.",
    searchIntent: "Find house cleaning flyer examples or create a local cleaning promotion with phone and booking details.",
    ctaLabel: "Create a house cleaning flyer",
    primaryPrompt:
      "Create a house cleaning flyer with headline, recurring cleaning services, deep cleaning offer, service area, phone number, website, trust badges, and book-now CTA.",
    promptExamples: [
      {
        title: "Recurring cleaning flyer",
        prompt:
          "Create a recurring house cleaning flyer with weekly and biweekly service bullets, service area, first-booking discount, phone number, website, and book-now CTA."
      },
      {
        title: "Deep cleaning flyer",
        prompt:
          "Create a deep cleaning flyer with checklist-style benefits, rooms covered, limited-time offer, phone number, service area, and request-a-quote CTA."
      },
      {
        title: "Move-out cleaning flyer",
        prompt:
          "Create a move-out cleaning flyer with apartment and home cleaning services, deadline-friendly CTA, phone number, website, and trustworthy local style."
      }
    ],
    copyChecklist: ["Cleaning service headline", "Service area", "Offer", "Phone number", "Booking CTA"],
    formatTips: ["Use a clean white-space layout", "Make the phone number large", "Add trust details like insured, locally owned, or satisfaction guarantee"],
    faq: [
      {
        question: "What should a house cleaning flyer include?",
        answer:
          "Include the cleaning services, service area, offer, phone number, website, trust points, and booking CTA."
      },
      {
        question: "Can I promote recurring and deep cleaning?",
        answer:
          "Yes. Use separate bullets for recurring cleaning, deep cleaning, move-out cleaning, and first-time customer offers."
      },
      {
        question: "What makes a house cleaning flyer trustworthy?",
        answer:
          "Clear contact details, service area, proof points, simple design, and a specific offer usually matter more than decoration."
      }
    ],
    related: ["cleaning-service-flyer-maker", "business-flyer-maker", "sale-flyer-maker"]
  },
  {
    slug: "fundraiser-flyer-maker",
    categorySlug: "fundraiser-flyers",
    label: "Fundraiser Flyer Maker",
    shortLabel: "fundraiser flyer",
    title: "Fundraiser Flyer Maker for Charity, School, and Community Events",
    description:
      "Create fundraiser flyers for charity events, school drives, food drives, donation campaigns, and community causes with AI prompts and copy guidance.",
    h1: "Fundraiser flyer maker for charity, school, and community events",
    lede:
      "Make a fundraiser flyer that explains the cause, goal, deadline, donation method, event details, and CTA without losing emotional clarity.",
    primaryKeyword: "fundraiser flyer maker",
    supportingKeywords: ["fundraiser flyer", "fundraiser flyer template", "charity flyer", "donation flyer", "school fundraiser flyer"],
    imageKeywords: ["fundraiser", "charity", "donation", "school", "food drive", "community"],
    audience: "Nonprofits, schools, churches, local groups, clubs, and organizers promoting donation or cause campaigns.",
    searchIntent: "Find a fundraiser flyer template or quickly make a donation campaign flyer.",
    ctaLabel: "Create a fundraiser flyer",
    primaryPrompt:
      "Create a fundraiser flyer with cause headline, donation goal, event date, location, needed items, organizer contact, QR code space, and donate-now CTA.",
    promptExamples: [
      {
        title: "Charity event flyer",
        prompt:
          "Create a charity fundraiser flyer with cause headline, event name, date, venue, donation goal, sponsor row, QR code space, and donate-or-register CTA."
      },
      {
        title: "School fundraiser flyer",
        prompt:
          "Create a school fundraiser flyer with school name, fundraiser item, deadline, pickup location, organizer contact, QR code space, and support-our-students CTA."
      },
      {
        title: "Food drive flyer",
        prompt:
          "Create a food drive flyer with needed items, drop-off location, dates, organizer contact, community tone, and clear donation CTA."
      }
    ],
    copyChecklist: ["Cause or campaign", "Goal or need", "Date or deadline", "Donation method", "CTA"],
    formatTips: ["Use one emotional headline", "Put the donation method near the CTA", "Keep deadline and location easy to scan"],
    faq: [
      {
        question: "What should a fundraiser flyer include?",
        answer:
          "Include the cause, donation goal or need, deadline, event details, drop-off or payment method, organizer contact, and CTA."
      },
      {
        question: "Can I make school fundraiser flyers?",
        answer:
          "Yes. Add the school name, fundraiser item, order deadline, pickup details, contact person, and QR code or payment link."
      },
      {
        question: "What makes a fundraiser flyer effective?",
        answer:
          "A strong fundraiser flyer explains why the cause matters, what people should give, how to give, and when the action is due."
      }
    ],
    related: ["charity-flyer-maker", "food-drive-flyer-maker", "bake-sale-flyer-maker", "funeral-flyer-maker"]
  },
  {
    slug: "concert-flyer-maker",
    categorySlug: "concert-flyers",
    label: "Concert Flyer Maker",
    shortLabel: "concert flyer",
    title: "Concert Flyer Maker for Shows, Bands, DJs, and Live Music",
    description:
      "Create concert flyers for live shows, band nights, DJ events, venue promos, and music releases with AI prompts and flyer copy structure.",
    h1: "Concert flyer maker for shows, bands, DJs, and live music",
    lede:
      "Make a concert flyer that makes the artist, date, venue, ticket details, lineup, age note, and show mood readable at a glance.",
    primaryKeyword: "concert flyer maker",
    supportingKeywords: ["concert flyer", "concert flyer template", "music flyer", "band flyer", "live music flyer"],
    imageKeywords: ["concert", "music", "live music", "band", "dj", "club", "stage"],
    audience: "Musicians, promoters, venues, DJs, bands, labels, and event teams promoting live music.",
    searchIntent: "Find concert flyer examples or quickly make a music event flyer with artist and venue details.",
    ctaLabel: "Create a concert flyer",
    primaryPrompt:
      "Create a concert flyer with artist name, lineup, date, venue, door time, ticket link, age note, sponsor row, and high-energy live music style.",
    promptExamples: [
      {
        title: "Band show flyer",
        prompt:
          "Create a band show flyer with headliner, supporting acts, date, venue, doors open time, ticket link, and gritty live music visual style."
      },
      {
        title: "DJ concert flyer",
        prompt:
          "Create a DJ concert flyer with DJ name, guest lineup, date, club venue, ticket link, age note, and neon nightlife atmosphere."
      },
      {
        title: "Acoustic show flyer",
        prompt:
          "Create an acoustic live music flyer with artist name, intimate venue, date, time, ticket note, social handle, and warm minimal design."
      }
    ],
    copyChecklist: ["Artist or lineup", "Date and time", "Venue", "Ticket link", "Age or entry note"],
    formatTips: ["Make artist name largest", "Keep date and venue together", "Use 4:5 for social event promotion"],
    faq: [
      {
        question: "What should a concert flyer include?",
        answer:
          "Include artist or lineup, date, doors time, venue, ticket link, age note, sponsors if needed, and one clear CTA."
      },
      {
        question: "Can I make band and DJ flyers?",
        answer:
          "Yes. Use the prompt examples for band shows, DJ nights, acoustic sets, venue promos, and music events."
      },
      {
        question: "What style works for concert flyers?",
        answer:
          "Match the music: gritty for rock, neon for club events, clean for acoustic shows, or cinematic for special venue promotions."
      }
    ],
    related: ["club-flyer-maker", "party-flyer-maker", "event-flyer-maker"]
  },
  {
    slug: "club-flyer-maker",
    categorySlug: "club-flyers",
    label: "Club Flyer Maker",
    shortLabel: "club flyer",
    title: "Club Flyer Maker for Nightlife, DJs, and Party Promos",
    description:
      "Create club flyers for DJ nights, guest lists, drink specials, themed parties, and nightlife promotions with AI prompt examples.",
    h1: "Club flyer maker for nightlife, DJs, and party promos",
    lede:
      "Make a club flyer that sells the vibe while keeping the event name, date, venue, lineup, age note, and ticket CTA readable.",
    primaryKeyword: "club flyer maker",
    supportingKeywords: ["club flyer", "club flyer template", "nightclub flyer", "dj flyer", "party flyer"],
    imageKeywords: ["club", "nightlife", "dj", "party", "neon", "drink vendor"],
    audience: "Clubs, DJs, promoters, venues, hosts, and creators promoting nightlife events.",
    searchIntent: "Find a club flyer maker or nightclub flyer example for a party or DJ event.",
    ctaLabel: "Create a club flyer",
    primaryPrompt:
      "Create a club flyer with event name, DJ lineup, date, venue, doors open time, age note, ticket link, dress code, and neon nightlife style.",
    promptExamples: [
      {
        title: "DJ night flyer",
        prompt:
          "Create a DJ night club flyer with headliner, supporting DJs, date, venue, ticket link, age note, and high-contrast neon lighting."
      },
      {
        title: "Guest list flyer",
        prompt:
          "Create a club guest list flyer with event name, RSVP text, venue, date, dress code, host names, and join-the-list CTA."
      },
      {
        title: "Drink special flyer",
        prompt:
          "Create a nightlife drink special flyer with offer headline, date, venue, time window, DJ note, and clear happy-hour CTA."
      }
    ],
    copyChecklist: ["Event name", "DJ or host lineup", "Date and venue", "Age or dress note", "Ticket or RSVP CTA"],
    formatTips: ["Use high contrast for nightlife text", "Keep age and ticket notes visible", "Avoid hiding venue details in effects"],
    faq: [
      {
        question: "What should a club flyer include?",
        answer:
          "Include event name, DJ or host lineup, date, time, venue, age note, dress code, ticket or guest-list link, and CTA."
      },
      {
        question: "Can I make nightclub flyers for Instagram?",
        answer:
          "Yes. Use 4:5 for feed posts and 9:16 for stories, with the date and venue in a clear information block."
      },
      {
        question: "How is a club flyer different from a party flyer?",
        answer:
          "Club flyers usually need stronger lineup, venue, age, ticket, and guest-list details, while general party flyers can be more invitation-focused."
      }
    ],
    related: ["party-flyer-maker", "concert-flyer-maker", "event-flyer-maker"]
  },
  {
    slug: "church-flyer-maker",
    categorySlug: "church-flyers",
    label: "Church Flyer Maker",
    shortLabel: "church flyer",
    title: "Church Flyer Maker for Services, Events, and Ministry Announcements",
    description:
      "Create church flyers for services, ministry events, community outreach, fundraisers, holiday programs, and donation drives.",
    h1: "Church flyer maker for services, events, and ministry announcements",
    lede:
      "Make a church flyer that keeps the message, service time, location, ministry details, contact, and invitation clear for the congregation.",
    primaryKeyword: "church flyer maker",
    supportingKeywords: ["church flyer", "church flyer template", "ministry flyer", "church event flyer", "gospel flyer"],
    imageKeywords: ["church", "ministry", "community", "fundraiser", "holiday", "event"],
    audience: "Churches, ministries, pastors, volunteer teams, youth groups, and community organizers.",
    searchIntent: "Find church flyer templates or create a ministry event announcement flyer.",
    ctaLabel: "Create a church flyer",
    primaryPrompt:
      "Create a church flyer with event name, ministry or service theme, date, time, church name, address, contact, invitation CTA, and warm community design.",
    promptExamples: [
      {
        title: "Sunday service flyer",
        prompt:
          "Create a Sunday service flyer with sermon series title, church name, date, service time, address, livestream note, and welcoming invitation CTA."
      },
      {
        title: "Youth ministry flyer",
        prompt:
          "Create a youth ministry flyer with event title, age group, date, time, church address, activity details, contact, and energetic community style."
      },
      {
        title: "Church fundraiser flyer",
        prompt:
          "Create a church fundraiser flyer with cause headline, donation goal, date, location, organizer contact, QR code space, and donate-now CTA."
      }
    ],
    copyChecklist: ["Event or service name", "Date and time", "Church name", "Address", "Invitation CTA"],
    formatTips: ["Use welcoming typography", "Keep service time large", "Place address and contact in one block"],
    faq: [
      {
        question: "What should a church flyer include?",
        answer:
          "Include event or service name, date, time, church name, address, ministry details, contact information, and invitation CTA."
      },
      {
        question: "Can I make ministry and fundraiser flyers?",
        answer:
          "Yes. Add the ministry name, audience, cause, deadline, donation or registration details, and church contact."
      },
      {
        question: "What format works for church flyers?",
        answer:
          "Use 4:5 or 9:16 for social posts, and letter or A4 for bulletin boards, handouts, and printed announcements."
      }
    ],
    related: ["fundraiser-flyer-maker", "event-flyer-maker", "funeral-flyer-maker"]
  },
  {
    slug: "yard-sale-flyer-maker",
    categorySlug: "yard-sale-flyers",
    label: "Yard Sale Flyer Maker",
    shortLabel: "yard sale flyer",
    title: "Yard Sale Flyer Maker for Garage Sales and Local Listings",
    description:
      "Create yard sale flyers for garage sales, estate sales, neighborhood sales, moving sales, and local weekend announcements.",
    h1: "Yard sale flyer maker for garage sales and local listings",
    lede:
      "Make a yard sale flyer that makes the sale date, address area, item categories, time window, and local CTA obvious from a distance.",
    primaryKeyword: "yard sale flyer maker",
    supportingKeywords: ["yard sale flyer", "garage sale flyer", "garage sale flyer template", "moving sale flyer", "estate sale flyer"],
    imageKeywords: ["yard sale", "garage sale", "sale", "local", "weekend", "community"],
    audience: "Homeowners, families, local organizers, estate sale teams, and neighborhood groups.",
    searchIntent: "Find a yard sale flyer template or quickly make a garage sale announcement.",
    ctaLabel: "Create a yard sale flyer",
    primaryPrompt:
      "Create a yard sale flyer with large sale headline, date, time, address area, item categories, rain date note, and stop-by CTA.",
    promptExamples: [
      {
        title: "Garage sale flyer",
        prompt:
          "Create a garage sale flyer with date, time, street or neighborhood, item categories, cash note, rain date, and bold local announcement style."
      },
      {
        title: "Moving sale flyer",
        prompt:
          "Create a moving sale flyer with sale headline, furniture and household item categories, date, time, address area, and everything-must-go CTA."
      },
      {
        title: "Estate sale flyer",
        prompt:
          "Create an estate sale flyer with date range, time, address area, featured items, contact note, and clean readable print layout."
      }
    ],
    copyChecklist: ["Sale type", "Date and time", "Address area", "Item categories", "Stop-by CTA"],
    formatTips: ["Make date and address readable from distance", "Use bold item categories", "Keep decorative details minimal for print"],
    faq: [
      {
        question: "What should a yard sale flyer include?",
        answer:
          "Include sale type, date, time, address area, item categories, payment note, rain date if needed, and a clear CTA."
      },
      {
        question: "Can I make garage sale and moving sale flyers?",
        answer:
          "Yes. Add item categories, sale deadline, address area, and whether everything must go."
      },
      {
        question: "Should a yard sale flyer be printable?",
        answer:
          "Usually yes. Use high contrast, large text, and a simple letter-size layout for neighborhood posting."
      }
    ],
    related: ["garage-sale-flyer-maker", "sale-flyer-maker", "business-flyer-maker", "event-flyer-maker"]
  },
  {
    slug: "fitness-flyer-maker",
    categorySlug: "fitness-flyers",
    label: "Fitness Flyer Maker",
    shortLabel: "fitness flyer",
    title: "Fitness Flyer Maker for Gyms, Trainers, and Classes",
    description:
      "Create fitness flyers for gyms, personal trainers, boot camps, yoga classes, challenges, and membership offers.",
    h1: "Fitness flyer maker for gyms, trainers, and classes",
    lede:
      "Make a fitness flyer that sells the class, trainer, benefit, schedule, location, offer, and sign-up CTA with strong visual energy.",
    primaryKeyword: "fitness flyer maker",
    supportingKeywords: ["fitness flyer", "gym flyer", "personal trainer flyer", "workout flyer", "boot camp flyer"],
    imageKeywords: ["fitness", "gym", "trainer", "workout", "boot camp", "yoga"],
    audience: "Gyms, personal trainers, yoga instructors, coaches, boot camps, and wellness studios.",
    searchIntent: "Find a fitness flyer template or quickly make a class, gym, or trainer promotion.",
    ctaLabel: "Create a fitness flyer",
    primaryPrompt:
      "Create a fitness flyer with class or offer headline, trainer name, schedule, location, benefits, price or free-trial offer, and sign-up CTA.",
    promptExamples: [
      {
        title: "Gym membership flyer",
        prompt:
          "Create a gym membership flyer with offer headline, membership benefits, location, trial period, phone number, website, and join-now CTA."
      },
      {
        title: "Personal trainer flyer",
        prompt:
          "Create a personal trainer flyer with trainer name, specialties, transformation benefits, session offer, booking contact, and professional fitness style."
      },
      {
        title: "Boot camp flyer",
        prompt:
          "Create a boot camp flyer with challenge name, dates, class times, location, fitness benefits, price, and reserve-your-spot CTA."
      }
    ],
    copyChecklist: ["Class or offer", "Trainer or gym", "Schedule", "Location", "Sign-up CTA"],
    formatTips: ["Show the benefit clearly", "Keep schedule details readable", "Use energetic imagery without hiding the CTA"],
    faq: [
      {
        question: "What should a fitness flyer include?",
        answer:
          "Include the class or offer, trainer or gym name, schedule, location, benefits, price or trial offer, contact, and sign-up CTA."
      },
      {
        question: "Can I make personal trainer flyers?",
        answer:
          "Yes. Add specialties, transformation promise, session package, location or online option, and booking contact."
      },
      {
        question: "What format works for fitness flyers?",
        answer:
          "Use 4:5 for Instagram feed promotions, 9:16 for stories, and letter or A4 for gym desk or local print flyers."
      }
    ],
    related: ["gym-flyer-maker", "personal-trainer-flyer-maker", "business-flyer-maker", "sale-flyer-maker"]
  },
  {
    slug: "salon-flyer-maker",
    categorySlug: "salon-flyers",
    label: "Salon Flyer Maker",
    shortLabel: "salon flyer",
    title: "Salon Flyer Maker for Hair, Beauty, and Nail Promotions",
    description:
      "Create salon flyers for hair offers, nail promos, spa packages, beauty services, openings, and appointment campaigns.",
    h1: "Salon flyer maker for hair, beauty, and nail promotions",
    lede:
      "Make a salon flyer that highlights the service, offer, booking method, location, stylist or brand, and appointment CTA.",
    primaryKeyword: "salon flyer maker",
    supportingKeywords: ["salon flyer", "hair salon flyer", "beauty salon flyer", "nail salon flyer", "spa flyer"],
    imageKeywords: ["salon", "beauty", "hair", "nail", "spa", "appointment"],
    audience: "Hair salons, nail artists, beauty studios, spas, stylists, and local appointment-based businesses.",
    searchIntent: "Find a salon flyer template or create a beauty service promotion that drives bookings.",
    ctaLabel: "Create a salon flyer",
    primaryPrompt:
      "Create a salon flyer with service headline, beauty offer, stylist or salon name, address, booking phone number, Instagram handle, and book-now CTA.",
    promptExamples: [
      {
        title: "Hair salon offer flyer",
        prompt:
          "Create a hair salon flyer with cut and color offer, salon name, stylist note, address, booking phone number, Instagram handle, and book-now CTA."
      },
      {
        title: "Nail salon flyer",
        prompt:
          "Create a nail salon flyer with manicure offer, service menu highlights, location, appointment phone number, social handle, and polished beauty style."
      },
      {
        title: "Spa package flyer",
        prompt:
          "Create a spa package flyer with package name, service bundle, price or savings, booking deadline, address, phone number, and relax-and-book CTA."
      }
    ],
    copyChecklist: ["Service or offer", "Salon name", "Booking method", "Location", "Appointment CTA"],
    formatTips: ["Use one service as the hook", "Keep booking phone visible", "Use clean beauty imagery with enough text space"],
    faq: [
      {
        question: "What should a salon flyer include?",
        answer:
          "Include the service, offer, salon name, location, booking phone or website, social handle, stylist note if needed, and CTA."
      },
      {
        question: "Can I make nail and spa flyers?",
        answer:
          "Yes. Use service-specific prompts for nail offers, spa packages, hair specials, beauty launches, and appointment promos."
      },
      {
        question: "What makes a salon flyer book more appointments?",
        answer:
          "A specific service offer, easy booking contact, readable location, and one appointment CTA usually matter more than a crowded service list."
      }
    ],
    related: ["nail-salon-flyer-maker", "hair-salon-flyer-maker", "business-flyer-maker", "grand-opening-flyer-maker"]
  },
  {
    slug: "pressure-washing-flyer-maker",
    categorySlug: "pressure-washing-flyers",
    label: "Pressure Washing Flyer Maker",
    shortLabel: "pressure washing flyer",
    title: "Pressure Washing Flyer Maker for Local Home Service Offers",
    description:
      "Create pressure washing flyers for driveways, siding, patios, decks, seasonal cleanups, and local home service campaigns.",
    h1: "Pressure washing flyer maker for local home service offers",
    lede:
      "Make a pressure washing flyer that shows the service, area served, offer, phone number, before-and-after proof, and booking CTA clearly.",
    primaryKeyword: "pressure washing flyer",
    supportingKeywords: ["pressure washing flyer template", "power washing flyer", "pressure washing business flyer", "driveway cleaning flyer"],
    imageKeywords: ["pressure washing", "power washing", "home service", "driveway", "cleaning", "local service"],
    audience: "Pressure washing businesses, power washing crews, home service teams, and local contractors.",
    searchIntent: "Find pressure washing flyer examples or create a local service flyer that gets calls.",
    ctaLabel: "Create a pressure washing flyer",
    primaryPrompt:
      "Create a pressure washing flyer with service headline, driveway and siding cleaning bullets, service area, seasonal offer, phone number, before-and-after space, and book-now CTA.",
    promptExamples: [
      {
        title: "Driveway cleaning flyer",
        prompt:
          "Create a driveway pressure washing flyer with before-and-after visual direction, service area, limited-time offer, phone number, website, and book-now CTA."
      },
      {
        title: "House exterior flyer",
        prompt:
          "Create a power washing flyer for siding, patios, decks, and walkways with service bullets, local area, phone number, insured note, and request-a-quote CTA."
      },
      {
        title: "Spring cleanup flyer",
        prompt:
          "Create a spring pressure washing flyer with seasonal cleanup headline, driveway and patio services, discount deadline, phone number, and schedule-today CTA."
      }
    ],
    copyChecklist: ["Service headline", "Area served", "Offer", "Phone number", "Booking CTA"],
    formatTips: ["Use before-and-after space", "Make the phone number dominant", "Keep service bullets short and local"],
    faq: [
      {
        question: "What should a pressure washing flyer include?",
        answer:
          "Include the service area, surfaces cleaned, offer, phone number, proof points such as insured or locally owned, and booking CTA."
      },
      {
        question: "Can I make power washing flyers?",
        answer:
          "Yes. Use pressure washing or power washing wording depending on what customers in your area search and recognize."
      },
      {
        question: "What image works best for pressure washing flyers?",
        answer:
          "Before-and-after driveway, siding, patio, or deck visuals usually communicate the value faster than generic service imagery."
      }
    ],
    related: ["cleaning-service-flyer-maker", "house-cleaning-flyer", "business-flyer-maker"]
  },
  {
    slug: "food-flyer-maker",
    categorySlug: "restaurant-flyers",
    label: "Food Flyer Maker",
    shortLabel: "food flyer",
    title: "Food Flyer Maker for Specials, Delivery, Catering, and Local Promos",
    description:
      "Create food flyers for restaurant specials, delivery offers, catering menus, food trucks, pop-ups, and local food promotions.",
    h1: "Food flyer maker for specials, delivery, catering, and local promos",
    lede:
      "Make a food flyer that shows the dish, offer, order method, hours, address, and appetite appeal without making the layout feel crowded.",
    primaryKeyword: "food flyer maker",
    supportingKeywords: ["food flyer", "food flyer template", "restaurant flyer", "food promotion flyer", "food truck flyer"],
    imageKeywords: ["food", "restaurant", "menu", "delivery", "catering", "food truck"],
    audience: "Restaurants, cafes, food trucks, caterers, ghost kitchens, and local food brands promoting offers.",
    searchIntent: "Find a food flyer example or quickly create a promotion for a dish, menu, delivery offer, or catering package.",
    ctaLabel: "Create a food flyer",
    primaryPrompt:
      "Create a food flyer with featured dish, offer headline, menu highlights, order method, hours, address, phone number, and order-now CTA.",
    promptExamples: [
      {
        title: "Delivery food flyer",
        prompt:
          "Create a food delivery flyer with featured dish, delivery area, limited-time offer, ordering phone number, website or app note, and order-now CTA."
      },
      {
        title: "Food truck flyer",
        prompt:
          "Create a food truck flyer with truck name, signature items, location schedule, social handle, QR code space, and follow-us CTA."
      },
      {
        title: "Catering food flyer",
        prompt:
          "Create a catering food flyer with package headline, menu categories, service area, event types, phone number, website, and request-a-quote CTA."
      }
    ],
    copyChecklist: ["Featured food or offer", "Menu highlights", "Order method", "Hours or dates", "Order CTA"],
    formatTips: ["Use one hero dish", "Keep prices and ordering details readable", "Reserve space for a QR code or phone number"],
    faq: [
      {
        question: "What should a food flyer include?",
        answer:
          "Include the dish or offer, menu highlights, price or package, hours, address or delivery area, ordering method, and CTA."
      },
      {
        question: "Can I make food truck flyers?",
        answer:
          "Yes. Add the truck name, food categories, location schedule, social handle, QR code space, and a follow or order CTA."
      },
      {
        question: "How is a food flyer different from a restaurant flyer?",
        answer:
          "A food flyer can promote one dish, delivery offer, catering package, or food truck schedule, while a restaurant flyer often includes broader venue details."
      }
    ],
    related: ["restaurant-flyer-maker", "menu-flyer-maker", "drink-vendor-flyer-maker", "farmers-market-flyer-maker"]
  },
  {
    slug: "menu-flyer-maker",
    categorySlug: "restaurant-flyers",
    label: "Menu Flyer Maker",
    shortLabel: "menu flyer",
    title: "Menu Flyer Maker for Restaurant Specials and Takeout Offers",
    description:
      "Create menu flyers for lunch specials, takeout menus, catering packages, happy hours, seasonal items, and local restaurant promos.",
    h1: "Menu flyer maker for restaurant specials and takeout offers",
    lede:
      "Make a menu flyer that keeps the featured items, prices, ordering details, hours, and CTA readable enough for social posts and printed handouts.",
    primaryKeyword: "menu flyer maker",
    supportingKeywords: ["menu flyer", "menu flyer template", "restaurant menu flyer", "takeout menu flyer", "food flyer"],
    imageKeywords: ["menu", "restaurant", "food", "takeout", "specials", "catering"],
    audience: "Restaurants, cafes, bars, food trucks, caterers, and local food teams announcing menu offers.",
    searchIntent: "Find a menu flyer layout or create a compact restaurant promotion with selected menu items and ordering details.",
    ctaLabel: "Create a menu flyer",
    primaryPrompt:
      "Create a menu flyer with restaurant name, featured menu items, prices, special offer, hours, address, order method, and order-now CTA.",
    promptExamples: [
      {
        title: "Lunch menu flyer",
        prompt:
          "Create a lunch menu flyer with three featured items, prices, lunch hours, address, phone number, and order-now CTA."
      },
      {
        title: "Takeout menu flyer",
        prompt:
          "Create a takeout menu flyer with item categories, pickup and delivery note, ordering phone number, website, hours, and clean readable layout."
      },
      {
        title: "Happy hour menu flyer",
        prompt:
          "Create a happy hour menu flyer with drink and food specials, day and time, venue address, social handle, and visit-tonight CTA."
      }
    ],
    copyChecklist: ["Menu category", "Featured items", "Prices or offer", "Ordering details", "Order CTA"],
    formatTips: ["Keep menu sections short", "Use clear price alignment", "Do not turn a flyer into a full dense menu"],
    faq: [
      {
        question: "What should a menu flyer include?",
        answer:
          "Include the menu theme, featured items, prices or offer, hours, address, ordering method, and CTA."
      },
      {
        question: "Can I make takeout menu flyers?",
        answer:
          "Yes. Add pickup and delivery details, order phone or website, hours, and a readable item list."
      },
      {
        question: "How many items should be on a menu flyer?",
        answer:
          "Use a focused list of featured items or categories. A flyer should promote the menu, not replace a full multi-page menu."
      }
    ],
    related: ["restaurant-flyer-maker", "food-flyer-maker", "drink-vendor-flyer-maker", "happy-hour-flyer-maker"]
  },
  {
    slug: "garage-sale-flyer-maker",
    categorySlug: "sale-flyers",
    label: "Garage Sale Flyer Maker",
    shortLabel: "garage sale flyer",
    title: "Garage Sale Flyer Maker for Weekend and Neighborhood Sales",
    description:
      "Create garage sale flyers for weekend sales, moving sales, estate sales, neighborhood sales, and local print announcements.",
    h1: "Garage sale flyer maker for weekend and neighborhood sales",
    lede:
      "Make a garage sale flyer that makes the date, time, address area, item categories, rain note, and local CTA obvious from a quick glance.",
    primaryKeyword: "garage sale flyer maker",
    supportingKeywords: ["garage sale flyer", "garage sale flyer template", "yard sale flyer", "moving sale flyer", "estate sale flyer"],
    imageKeywords: ["garage sale", "yard sale", "sale", "moving sale", "local", "weekend"],
    audience: "Homeowners, families, neighborhood groups, estate sale organizers, and local sellers.",
    searchIntent: "Find a garage sale flyer template or quickly create a printable local sale announcement.",
    ctaLabel: "Create a garage sale flyer",
    primaryPrompt:
      "Create a garage sale flyer with large sale headline, date, time, address area, item categories, payment note, rain date, and stop-by CTA.",
    promptExamples: [
      {
        title: "Weekend garage sale flyer",
        prompt:
          "Create a weekend garage sale flyer with date, time, street or neighborhood, item categories, cash note, rain date, and bold print-friendly style."
      },
      {
        title: "Moving sale flyer",
        prompt:
          "Create a moving sale flyer with everything-must-go headline, furniture and household items, date, time, address area, and stop-by CTA."
      },
      {
        title: "Neighborhood sale flyer",
        prompt:
          "Create a neighborhood garage sale flyer with community name, date, time, participating streets, item categories, and local map note."
      }
    ],
    copyChecklist: ["Sale headline", "Date and time", "Address area", "Item categories", "Stop-by CTA"],
    formatTips: ["Make the date and street readable", "Use high contrast for print", "Keep item categories short and bold"],
    faq: [
      {
        question: "What should a garage sale flyer include?",
        answer:
          "Include the sale date, time, address area, item categories, rain date if needed, payment note, and a clear stop-by CTA."
      },
      {
        question: "Can I make moving sale flyers?",
        answer:
          "Yes. Add furniture or household item categories, the sale deadline, address area, and an everything-must-go message."
      },
      {
        question: "Should garage sale flyers be printable?",
        answer:
          "Usually yes. Use large text, strong contrast, and a simple layout for neighborhood posting."
      }
    ],
    related: ["yard-sale-flyer-maker", "sale-flyer-maker", "business-flyer-maker", "event-flyer-maker"]
  },
  {
    slug: "gym-flyer-maker",
    categorySlug: "fitness-flyers",
    label: "Gym Flyer Maker",
    shortLabel: "gym flyer",
    title: "Gym Flyer Maker for Membership Offers, Classes, and Challenges",
    description:
      "Create gym flyers for membership offers, fitness challenges, classes, personal training, free trials, and local fitness promos.",
    h1: "Gym flyer maker for membership offers, classes, and challenges",
    lede:
      "Make a gym flyer that makes the class, membership offer, schedule, location, trainer, and sign-up CTA clear before the visuals take over.",
    primaryKeyword: "gym flyer maker",
    supportingKeywords: ["gym flyer", "gym flyer template", "fitness flyer", "gym promotion flyer", "workout flyer"],
    imageKeywords: ["gym", "fitness", "workout", "trainer", "membership", "boot camp"],
    audience: "Gyms, fitness studios, boot camps, wellness centers, and coaches promoting classes or memberships.",
    searchIntent: "Find a gym flyer template or quickly make a local fitness offer that drives sign-ups.",
    ctaLabel: "Create a gym flyer",
    primaryPrompt:
      "Create a gym flyer with membership offer, class or challenge headline, schedule, location, benefits, trial note, phone number, and join-now CTA.",
    promptExamples: [
      {
        title: "Membership offer flyer",
        prompt:
          "Create a gym membership flyer with limited-time offer, benefits, free-trial note, location, phone number, website, and join-now CTA."
      },
      {
        title: "Fitness challenge flyer",
        prompt:
          "Create a gym challenge flyer with challenge name, dates, workout benefits, coach note, location, price, and reserve-your-spot CTA."
      },
      {
        title: "Class schedule flyer",
        prompt:
          "Create a gym class flyer with class type, weekly schedule, instructor name, location, trial offer, and sign-up CTA."
      }
    ],
    copyChecklist: ["Gym offer", "Class or challenge", "Schedule", "Location", "Sign-up CTA"],
    formatTips: ["Keep the schedule readable", "Make the trial or membership offer specific", "Use energetic imagery without covering the CTA"],
    faq: [
      {
        question: "What should a gym flyer include?",
        answer:
          "Include the offer, class or challenge, schedule, location, benefits, price or trial note, contact details, and sign-up CTA."
      },
      {
        question: "Can I make gym membership flyers?",
        answer:
          "Yes. Add membership benefits, trial period, location, phone number, website, and a join-now CTA."
      },
      {
        question: "What format works for gym flyers?",
        answer:
          "Use 4:5 for Instagram feed posts, 9:16 for stories, and letter or A4 for gym desk or local print flyers."
      }
    ],
    related: ["fitness-flyer-maker", "personal-trainer-flyer-maker", "sale-flyer-maker", "business-flyer-maker"]
  },
  {
    slug: "personal-trainer-flyer-maker",
    categorySlug: "fitness-flyers",
    label: "Personal Trainer Flyer Maker",
    shortLabel: "personal trainer flyer",
    title: "Personal Trainer Flyer Maker for Sessions, Packages, and Fitness Leads",
    description:
      "Create personal trainer flyers for session packages, transformations, boot camps, online coaching, and local fitness lead generation.",
    h1: "Personal trainer flyer maker for sessions, packages, and fitness leads",
    lede:
      "Make a personal trainer flyer that explains the transformation, specialty, package, location, proof point, and booking CTA clearly.",
    primaryKeyword: "personal trainer flyer maker",
    supportingKeywords: ["personal trainer flyer", "personal trainer flyer template", "fitness flyer", "workout flyer", "gym flyer"],
    imageKeywords: ["personal trainer", "fitness", "coach", "workout", "gym", "transformation"],
    audience: "Personal trainers, fitness coaches, boot camp instructors, and online coaching brands.",
    searchIntent: "Find a personal trainer flyer template or create a local lead generation flyer for coaching packages.",
    ctaLabel: "Create a personal trainer flyer",
    primaryPrompt:
      "Create a personal trainer flyer with trainer name, specialty, transformation benefit, package offer, location or online option, booking contact, and book-now CTA.",
    promptExamples: [
      {
        title: "Transformation package flyer",
        prompt:
          "Create a personal trainer flyer for a transformation package with coach name, program length, benefits, session offer, contact, and book-now CTA."
      },
      {
        title: "Online coaching flyer",
        prompt:
          "Create an online fitness coaching flyer with coach specialty, program benefits, package options, social handle, website, and apply-now CTA."
      },
      {
        title: "Boot camp trainer flyer",
        prompt:
          "Create a boot camp trainer flyer with class dates, workout style, location, price, trainer name, and reserve-your-spot CTA."
      }
    ],
    copyChecklist: ["Trainer name", "Specialty", "Package or offer", "Location or online option", "Booking CTA"],
    formatTips: ["Lead with the transformation benefit", "Keep contact details visible", "Use proof points without overcrowding the flyer"],
    faq: [
      {
        question: "What should a personal trainer flyer include?",
        answer:
          "Include the trainer name, specialty, transformation benefit, package offer, location or online option, contact details, and booking CTA."
      },
      {
        question: "Can I make online coaching flyers?",
        answer:
          "Yes. Add the coaching niche, program benefits, package options, social handle, website, and apply-now CTA."
      },
      {
        question: "What makes a personal trainer flyer work?",
        answer:
          "A clear outcome, specific package, trainer credibility, easy contact method, and one booking CTA usually matter most."
      }
    ],
    related: ["fitness-flyer-maker", "gym-flyer-maker", "business-flyer-maker", "sale-flyer-maker"]
  },
  {
    slug: "nail-salon-flyer-maker",
    categorySlug: "salon-flyers",
    label: "Nail Salon Flyer Maker",
    shortLabel: "nail salon flyer",
    title: "Nail Salon Flyer Maker for Manicure Offers and Beauty Promos",
    description:
      "Create nail salon flyers for manicure offers, pedicure packages, nail art promos, openings, appointment campaigns, and beauty specials.",
    h1: "Nail salon flyer maker for manicure offers and beauty promos",
    lede:
      "Make a nail salon flyer that shows the service, offer, booking method, location, style direction, and appointment CTA in a clean beauty layout.",
    primaryKeyword: "nail salon flyer maker",
    supportingKeywords: ["nail salon flyer", "nail salon flyer template", "nail flyer", "beauty salon flyer", "salon flyer"],
    imageKeywords: ["nail salon", "nails", "manicure", "beauty", "spa", "appointment"],
    audience: "Nail salons, independent nail artists, beauty studios, spas, and local appointment-based businesses.",
    searchIntent: "Find a nail salon flyer template or create a manicure promotion that drives bookings.",
    ctaLabel: "Create a nail salon flyer",
    primaryPrompt:
      "Create a nail salon flyer with manicure offer, nail art style, salon name, address, booking phone number, Instagram handle, and book-now CTA.",
    promptExamples: [
      {
        title: "Manicure offer flyer",
        prompt:
          "Create a nail salon flyer with manicure offer, polish style, salon name, booking phone number, address, social handle, and book-now CTA."
      },
      {
        title: "Nail art promo flyer",
        prompt:
          "Create a nail art promo flyer with design theme, appointment offer, artist name, booking details, Instagram handle, and polished beauty style."
      },
      {
        title: "Pedicure package flyer",
        prompt:
          "Create a pedicure package flyer with service bundle, savings note, booking deadline, salon address, phone number, and relax-and-book CTA."
      }
    ],
    copyChecklist: ["Nail service", "Offer", "Salon name", "Booking method", "Appointment CTA"],
    formatTips: ["Use one service as the hook", "Keep booking phone visible", "Leave enough clean space around nail imagery"],
    faq: [
      {
        question: "What should a nail salon flyer include?",
        answer:
          "Include the nail service, offer, salon name, address, booking phone or website, social handle, and appointment CTA."
      },
      {
        question: "Can I make manicure and pedicure flyers?",
        answer:
          "Yes. Add the service, package price or savings, booking deadline, address, and contact method."
      },
      {
        question: "What makes a nail salon flyer book appointments?",
        answer:
          "A specific service offer, clear booking contact, readable location, and polished visual direction usually matter most."
      }
    ],
    related: ["salon-flyer-maker", "hair-salon-flyer-maker", "business-flyer-maker", "grand-opening-flyer-maker"]
  },
  {
    slug: "hair-salon-flyer-maker",
    categorySlug: "salon-flyers",
    label: "Hair Salon Flyer Maker",
    shortLabel: "hair salon flyer",
    title: "Hair Salon Flyer Maker for Cut, Color, and Beauty Offers",
    description:
      "Create hair salon flyers for cut and color offers, stylist promos, new client specials, salon openings, and appointment campaigns.",
    h1: "Hair salon flyer maker for cut, color, and beauty offers",
    lede:
      "Make a hair salon flyer that highlights the service, stylist or salon, offer, booking method, location, and appointment CTA.",
    primaryKeyword: "hair salon flyer maker",
    supportingKeywords: ["hair salon flyer", "hair salon flyer template", "beauty salon flyer", "salon flyer", "spa flyer"],
    imageKeywords: ["hair salon", "hair", "beauty", "stylist", "appointment", "salon"],
    audience: "Hair salons, stylists, beauty studios, barbers, spas, and local appointment businesses.",
    searchIntent: "Find a hair salon flyer template or create a service promotion that drives bookings.",
    ctaLabel: "Create a hair salon flyer",
    primaryPrompt:
      "Create a hair salon flyer with cut and color offer, stylist or salon name, address, booking phone number, Instagram handle, and book-now CTA.",
    promptExamples: [
      {
        title: "Cut and color flyer",
        prompt:
          "Create a hair salon flyer with cut and color offer, stylist note, salon name, booking phone number, address, Instagram handle, and book-now CTA."
      },
      {
        title: "New client special flyer",
        prompt:
          "Create a new client hair salon flyer with first-visit offer, services, stylist name, address, booking method, and appointment CTA."
      },
      {
        title: "Salon opening flyer",
        prompt:
          "Create a hair salon grand opening flyer with opening date, services, launch discount, address, booking phone number, and book-now CTA."
      }
    ],
    copyChecklist: ["Hair service", "Offer", "Stylist or salon", "Booking method", "Appointment CTA"],
    formatTips: ["Make the service and offer easy to scan", "Keep phone and address together", "Use beauty imagery with clear text space"],
    faq: [
      {
        question: "What should a hair salon flyer include?",
        answer:
          "Include the hair service, offer, stylist or salon name, address, booking phone or website, social handle, and appointment CTA."
      },
      {
        question: "Can I make cut and color flyers?",
        answer:
          "Yes. Add the service bundle, stylist note, price or savings, booking deadline, and contact details."
      },
      {
        question: "What format works for hair salon flyers?",
        answer:
          "Use 4:5 for Instagram posts, 9:16 for stories, and letter or A4 for local print handouts."
      }
    ],
    related: ["salon-flyer-maker", "nail-salon-flyer-maker", "grand-opening-flyer-maker", "sale-flyer-maker"]
  },
  {
    slug: "charity-flyer-maker",
    categorySlug: "fundraiser-flyers",
    label: "Charity Flyer Maker",
    shortLabel: "charity flyer",
    title: "Charity Flyer Maker for Fundraisers, Drives, and Community Causes",
    description:
      "Create charity flyers for fundraisers, donation drives, food drives, nonprofit events, school causes, and community campaigns.",
    h1: "Charity flyer maker for fundraisers, drives, and community causes",
    lede:
      "Make a charity flyer that explains the cause, need, deadline, donation method, organizer, and CTA with enough emotional clarity to move people.",
    primaryKeyword: "charity flyer maker",
    supportingKeywords: ["charity flyer", "charity flyer template", "donation flyer", "fundraiser flyer", "nonprofit flyer"],
    imageKeywords: ["charity", "fundraiser", "donation", "nonprofit", "community", "food drive"],
    audience: "Nonprofits, schools, churches, community groups, clubs, and organizers promoting donation campaigns.",
    searchIntent: "Find a charity flyer template or quickly create a donation campaign flyer for a cause.",
    ctaLabel: "Create a charity flyer",
    primaryPrompt:
      "Create a charity flyer with cause headline, donation goal, needed items, deadline, organizer contact, QR code space, and donate-now CTA.",
    promptExamples: [
      {
        title: "Donation drive flyer",
        prompt:
          "Create a donation drive charity flyer with cause headline, needed items, drop-off location, dates, organizer contact, QR code space, and donate-now CTA."
      },
      {
        title: "Nonprofit event flyer",
        prompt:
          "Create a nonprofit charity event flyer with event name, cause, date, venue, donation goal, sponsor row, and register-or-donate CTA."
      },
      {
        title: "Food drive flyer",
        prompt:
          "Create a food drive flyer with needed items, drop-off location, deadline, community message, organizer contact, and clear donation CTA."
      }
    ],
    copyChecklist: ["Cause", "Need or goal", "Deadline", "Donation method", "Donate CTA"],
    formatTips: ["Lead with the cause", "Put the donation method near the CTA", "Keep deadline and location easy to scan"],
    faq: [
      {
        question: "What should a charity flyer include?",
        answer:
          "Include the cause, need or goal, deadline, donation method, event or drop-off details, organizer contact, and CTA."
      },
      {
        question: "Can I make donation drive flyers?",
        answer:
          "Yes. Add needed items, drop-off location, dates, organizer contact, QR code space, and donate-now CTA."
      },
      {
        question: "How is a charity flyer different from a fundraiser flyer?",
        answer:
          "A charity flyer can focus on donations, drives, or cause awareness, while a fundraiser flyer often includes event or money-raising details."
      }
    ],
    related: ["fundraiser-flyer-maker", "food-drive-flyer-maker", "funeral-flyer-maker", "psa-flyer-maker"]
  },
  {
    slug: "car-detailing-flyer-maker",
    categorySlug: "car-detailing-flyers",
    label: "Car Detailing Flyer Maker",
    shortLabel: "car detailing flyer",
    title: "Car Detailing Flyer Maker for Mobile Auto Service Offers",
    description:
      "Create car detailing flyers for mobile detailing packages, wash offers, ceramic coating promos, appointment campaigns, and local auto service leads.",
    h1: "Car detailing flyer maker for mobile auto service offers",
    lede:
      "Make a car detailing flyer that shows the package, price or offer, service area, booking method, proof points, and appointment CTA clearly.",
    primaryKeyword: "car detailing flyer maker",
    supportingKeywords: ["car detailing flyer", "car detailing flyer template", "auto detailing flyer", "mobile detailing flyer", "car wash flyer"],
    imageKeywords: ["car detailing", "auto service", "car wash", "mobile detailing", "booking", "local service"],
    audience: "Mobile detailers, car wash teams, auto care shops, solo service providers, and local appointment businesses.",
    searchIntent: "Find a car detailing flyer template or quickly create a local auto service promotion that gets bookings.",
    ctaLabel: "Create a car detailing flyer",
    primaryPrompt:
      "Create a car detailing flyer with premium clean-car visuals, three package options, mobile service area, limited-time offer, phone number, booking website, and book-now CTA.",
    promptExamples: [
      {
        title: "Mobile detailing flyer",
        prompt:
          "Create a mobile car detailing flyer with service area, wash and interior package bullets, appointment phone number, booking website, and book-now CTA."
      },
      {
        title: "Detailing package flyer",
        prompt:
          "Create a car detailing package flyer with bronze, silver, and premium options, price space, included services, booking deadline, and clean auto style."
      },
      {
        title: "Ceramic coating promo",
        prompt:
          "Create an auto detailing flyer for ceramic coating with protection benefits, before-and-after visual direction, service area, phone number, and request-a-quote CTA."
      }
    ],
    copyChecklist: ["Detailing package", "Service area", "Offer or price", "Booking method", "Appointment CTA"],
    formatTips: ["Use before-and-after or shine-focused visuals", "Make package options easy to compare", "Keep phone and booking URL visible"],
    faq: [
      {
        question: "What should a car detailing flyer include?",
        answer:
          "Include the detailing package, services covered, service area, offer or price, booking phone or website, proof points, and appointment CTA."
      },
      {
        question: "Can I make mobile detailing flyers?",
        answer:
          "Yes. Add mobile service area, package options, contact details, booking link, and whether customers need to schedule ahead."
      },
      {
        question: "What image works best for car detailing flyers?",
        answer:
          "Clean-car closeups, before-and-after panels, glossy exterior shots, and package comparison layouts usually communicate value quickly."
      }
    ],
    related: ["business-flyer-maker", "car-wash-flyer-maker", "landscaping-flyer-maker", "pressure-washing-flyer-maker"]
  },
  {
    slug: "landscaping-flyer-maker",
    categorySlug: "landscaping-flyers",
    label: "Landscaping Flyer Maker",
    shortLabel: "landscaping flyer",
    title: "Landscaping Flyer Maker for Lawn Care and Outdoor Service Offers",
    description:
      "Create landscaping flyers for lawn care, seasonal cleanup, garden maintenance, yard work, local service offers, and booking campaigns.",
    h1: "Landscaping flyer maker for lawn care and outdoor service offers",
    lede:
      "Make a landscaping flyer that explains the service, seasonal offer, service area, proof points, phone number, and booking CTA.",
    primaryKeyword: "landscaping flyer maker",
    supportingKeywords: ["landscaping flyer", "landscaping flyer template", "lawn care flyer", "yard work flyer", "lawn service flyer"],
    imageKeywords: ["landscaping", "lawn care", "yard work", "outdoor service", "seasonal cleanup", "local service"],
    audience: "Landscapers, lawn care teams, garden maintenance providers, local contractors, and seasonal service businesses.",
    searchIntent: "Find a landscaping flyer template or create a local outdoor service promotion for bookings and calls.",
    ctaLabel: "Create a landscaping flyer",
    primaryPrompt:
      "Create a landscaping flyer with lawn care headline, seasonal cleanup services, service area, first-booking offer, phone number, website, and schedule-today CTA.",
    promptExamples: [
      {
        title: "Lawn care flyer",
        prompt:
          "Create a lawn care flyer with mowing, edging, cleanup, service area, weekly plan offer, phone number, and schedule-today CTA."
      },
      {
        title: "Spring cleanup flyer",
        prompt:
          "Create a spring landscaping flyer with yard cleanup, mulch, trimming, seasonal deadline, service area, phone number, and book-now CTA."
      },
      {
        title: "Garden maintenance flyer",
        prompt:
          "Create a garden maintenance flyer with planting, pruning, cleanup services, local area, website, phone number, and request-a-quote CTA."
      }
    ],
    copyChecklist: ["Outdoor service", "Service area", "Seasonal offer", "Phone number", "Booking CTA"],
    formatTips: ["Use green outdoor imagery with clear text space", "Keep service bullets short", "Make the phone number large enough for print"],
    faq: [
      {
        question: "What should a landscaping flyer include?",
        answer:
          "Include the service list, service area, seasonal offer, phone number, website, proof points, and a booking or quote CTA."
      },
      {
        question: "Can I make lawn care flyers?",
        answer:
          "Yes. Add mowing, edging, cleanup, recurring plan options, service area, and phone or booking details."
      },
      {
        question: "What season works best for landscaping flyers?",
        answer:
          "Spring cleanup, summer lawn care, fall cleanup, and storm cleanup all work well when the deadline and service area are clear."
      }
    ],
    related: ["business-flyer-maker", "car-detailing-flyer-maker", "car-wash-flyer-maker", "pressure-washing-flyer-maker"]
  },
  {
    slug: "school-flyer-maker",
    categorySlug: "school-flyers",
    label: "School Flyer Maker",
    shortLabel: "school flyer",
    title: "School Flyer Maker for Events, Clubs, Fundraisers, and Announcements",
    description:
      "Create school flyers for fundraisers, club events, sports registration, programs, parent notices, classroom announcements, and community campaigns.",
    h1: "School flyer maker for events, clubs, fundraisers, and announcements",
    lede:
      "Make a school flyer that keeps the event, audience, date, location, organizer, required details, and parent-friendly CTA easy to read.",
    primaryKeyword: "school flyer maker",
    supportingKeywords: ["school flyer", "school flyer template", "school event flyer", "school fundraiser flyer", "class flyer"],
    imageKeywords: ["school", "fundraiser", "sports", "community", "announcement", "students"],
    audience: "Schools, teachers, parent groups, clubs, coaches, administrators, and community organizers.",
    searchIntent: "Find a school flyer template or quickly create a printable announcement for students, parents, or local families.",
    ctaLabel: "Create a school flyer",
    primaryPrompt:
      "Create a school flyer with event name, audience, date, time, location, organizer contact, QR code space, required note, and friendly printable layout.",
    promptExamples: [
      {
        title: "School event flyer",
        prompt:
          "Create a school event flyer with event title, grade or audience, date, time, location, organizer contact, QR code space, and family-friendly style."
      },
      {
        title: "Club announcement flyer",
        prompt:
          "Create a school club flyer with club name, meeting date, room, advisor contact, who can join, and sign-up CTA."
      },
      {
        title: "Parent notice flyer",
        prompt:
          "Create a parent notice flyer with school name, important date, location, required action, contact details, and simple high-contrast layout."
      }
    ],
    copyChecklist: ["School or event name", "Audience", "Date and location", "Organizer contact", "Parent CTA"],
    formatTips: ["Use clear printable typography", "Keep dates and contact details together", "Leave room for a QR code or permission note"],
    faq: [
      {
        question: "What should a school flyer include?",
        answer:
          "Include the school or event name, target audience, date, time, location, organizer contact, QR code or required note, and CTA."
      },
      {
        question: "Can I make school fundraiser flyers?",
        answer:
          "Yes. Add the cause, goal, item or donation method, deadline, pickup details, parent contact, and support CTA."
      },
      {
        question: "Should school flyers be printable?",
        answer:
          "Often yes. Use simple typography, high contrast, safe margins, and a letter or A4 layout for handouts and bulletin boards."
      }
    ],
    related: ["fundraiser-flyer-maker", "sports-registration-flyer-maker", "talent-show-flyer-maker", "graduation-flyer-maker"]
  },
  {
    slug: "sports-registration-flyer-maker",
    categorySlug: "sports-registration-flyers",
    label: "Sports Registration Flyer Maker",
    shortLabel: "sports registration flyer",
    title: "Sports Registration Flyer Maker for Teams, Tryouts, and Signups",
    description:
      "Create sports registration flyers for youth teams, tryouts, clinics, camps, season signups, deadlines, and school or community programs.",
    h1: "Sports registration flyer maker for teams, tryouts, and signups",
    lede:
      "Make a sports registration flyer that makes the sport, age group, deadline, location, fee, coach contact, and signup CTA easy to act on.",
    primaryKeyword: "sports registration flyer maker",
    supportingKeywords: ["sports registration flyer", "sports registration flyer template", "youth sports flyer", "tryout flyer", "team signup flyer"],
    imageKeywords: ["sports registration", "team", "tryouts", "youth sports", "school", "signup"],
    audience: "Coaches, schools, clubs, recreation programs, youth leagues, and community sports organizers.",
    searchIntent: "Find a sports registration flyer template or create a signup announcement for teams, tryouts, clinics, or camps.",
    ctaLabel: "Create a sports registration flyer",
    primaryPrompt:
      "Create a youth sports registration flyer with sport name, age groups, signup deadline, practice location, fee, coach contact, QR code space, and register-now CTA.",
    promptExamples: [
      {
        title: "Youth league signup flyer",
        prompt:
          "Create a youth sports signup flyer with sport name, age groups, registration dates, fee, location, coach contact, QR code space, and register-now CTA."
      },
      {
        title: "Tryout flyer",
        prompt:
          "Create a team tryout flyer with sport, tryout date, time, location, required gear, coach contact, and bold athletic style."
      },
      {
        title: "Sports clinic flyer",
        prompt:
          "Create a sports clinic flyer with clinic name, skill focus, age range, date, location, price, coach name, and reserve-your-spot CTA."
      }
    ],
    copyChecklist: ["Sport name", "Age group", "Deadline", "Location", "Registration CTA"],
    formatTips: ["Make deadline and age range prominent", "Reserve space for a QR code", "Use energetic but readable team colors"],
    faq: [
      {
        question: "What should a sports registration flyer include?",
        answer:
          "Include the sport, age groups, registration deadline, location, fee, coach or organizer contact, QR code space, and registration CTA."
      },
      {
        question: "Can I make tryout flyers?",
        answer:
          "Yes. Add the tryout date, time, location, required gear, age group, coach contact, and what players should do next."
      },
      {
        question: "What format works for sports registration flyers?",
        answer:
          "Use 4:5 for social sharing, 9:16 for stories, and letter or A4 for school handouts and local print flyers."
      }
    ],
    related: ["school-flyer-maker", "event-flyer-maker", "fundraiser-flyer-maker", "fitness-flyer-maker"]
  },
  {
    slug: "psa-flyer-maker",
    categorySlug: "psa-flyers",
    label: "PSA Flyer Maker",
    shortLabel: "PSA flyer",
    title: "PSA Flyer Maker for Awareness, Safety, and Community Notices",
    description:
      "Create PSA flyers for awareness campaigns, school safety notices, public service announcements, health messages, and community information.",
    h1: "PSA flyer maker for awareness, safety, and community notices",
    lede:
      "Make a PSA flyer that keeps the message, audience, risk, action, contact, and required wording direct enough for people to understand quickly.",
    primaryKeyword: "psa flyer maker",
    supportingKeywords: ["psa flyer", "psa flyer template", "public service announcement flyer", "awareness flyer", "community notice flyer"],
    imageKeywords: ["PSA", "awareness", "safety", "community", "school", "public service"],
    audience: "Schools, nonprofits, community groups, health teams, local organizers, and safety campaigns.",
    searchIntent: "Find a PSA flyer template or create an awareness notice for a school, community, health, or safety campaign.",
    ctaLabel: "Create a PSA flyer",
    primaryPrompt:
      "Create a PSA flyer with direct awareness headline, target audience, risk or message, required action, support contact, QR code space, and printable high-contrast layout.",
    promptExamples: [
      {
        title: "School awareness PSA",
        prompt:
          "Create a school PSA flyer with awareness headline, student audience, key warning signs, action steps, counselor contact, and high-contrast printable style."
      },
      {
        title: "Community safety notice",
        prompt:
          "Create a community safety PSA flyer with issue headline, neighborhood audience, action steps, date or hotline, QR code space, and clear notice layout."
      },
      {
        title: "Health awareness flyer",
        prompt:
          "Create a health awareness PSA flyer with direct message, who it affects, prevention steps, contact resource, QR code space, and calm trustworthy design."
      }
    ],
    copyChecklist: ["Awareness headline", "Audience", "Key message", "Action step", "Resource or contact"],
    formatTips: ["Use direct language", "Keep decorative elements minimal", "Make action steps and contact resources easy to find"],
    faq: [
      {
        question: "What should a PSA flyer include?",
        answer:
          "Include the public message, audience, risk or issue, action steps, support contact or resource, date if needed, and a clear CTA."
      },
      {
        question: "Can I make school PSA flyers?",
        answer:
          "Yes. Add the school audience, required wording, counselor or organizer contact, and a printable high-contrast layout."
      },
      {
        question: "What makes a PSA flyer effective?",
        answer:
          "A strong PSA flyer uses direct wording, clear action steps, credible contact details, and a design that does not distract from the message."
      }
    ],
    related: ["school-flyer-maker", "charity-flyer-maker", "event-flyer-maker", "fundraiser-flyer-maker"]
  },
  {
    slug: "drink-vendor-flyer-maker",
    categorySlug: "drink-vendor-flyers",
    label: "Drink Vendor Flyer Maker",
    shortLabel: "drink vendor flyer",
    title: "Drink Vendor Flyer Maker for Pop-Ups, Menus, and Party Offers",
    description:
      "Create drink vendor flyers for beverage menus, pop-up stands, party drink promos, happy hours, vendor bookings, and local event offers.",
    h1: "Drink vendor flyer maker for pop-ups, menus, and party offers",
    lede:
      "Make a drink vendor flyer that shows the menu, prices, event or location, ordering method, vendor brand, and CTA without crowding the design.",
    primaryKeyword: "drink vendor flyer maker",
    supportingKeywords: ["drink vendor flyer", "drink vendor flyer template", "beverage flyer", "drink menu flyer", "vendor flyer"],
    imageKeywords: ["drink vendor", "beverage", "menu", "party", "happy hour", "pop-up"],
    audience: "Drink vendors, mobile bars, beverage stands, party vendors, restaurants, and event sellers.",
    searchIntent: "Find a drink vendor flyer template or create a beverage menu promotion for an event, party, or local pop-up.",
    ctaLabel: "Create a drink vendor flyer",
    primaryPrompt:
      "Create a drink vendor flyer with vendor name, drink menu highlights, prices, event or location, ordering method, social handle, and order-now CTA.",
    promptExamples: [
      {
        title: "Party drink vendor flyer",
        prompt:
          "Create a party drink vendor flyer with vendor name, drink menu, event date, location, prices, social handle, and order-now CTA."
      },
      {
        title: "Pop-up beverage menu",
        prompt:
          "Create a pop-up beverage menu flyer with signature drinks, prices, location schedule, QR code space, Instagram handle, and follow-us CTA."
      },
      {
        title: "Happy hour drink flyer",
        prompt:
          "Create a happy hour drink flyer with specials, day and time, venue, price highlights, social handle, and visit-tonight CTA."
      }
    ],
    copyChecklist: ["Vendor name", "Drink menu", "Prices or offer", "Event or location", "Order CTA"],
    formatTips: ["Keep menu items short", "Make prices readable", "Use one hero drink or clean menu blocks"],
    faq: [
      {
        question: "What should a drink vendor flyer include?",
        answer:
          "Include the vendor name, drink menu, prices or offer, event or location, ordering method, social handle, and CTA."
      },
      {
        question: "Can I make drink menu flyers?",
        answer:
          "Yes. Use short menu sections, price alignment, ordering details, and a readable layout for social or print."
      },
      {
        question: "How is a drink vendor flyer different from a restaurant flyer?",
        answer:
          "Drink vendor flyers usually focus on a compact beverage menu, pop-up location, event date, and quick ordering details."
      }
    ],
    related: ["happy-hour-flyer-maker", "food-flyer-maker", "menu-flyer-maker", "restaurant-flyer-maker"]
  },
  {
    slug: "car-wash-flyer-maker",
    categorySlug: "car-wash-flyers",
    label: "Car Wash Flyer Maker",
    shortLabel: "car wash flyer",
    title: "Car Wash Flyer Maker for Wash Deals, Fundraisers, and Auto Offers",
    description:
      "Create car wash flyers for wash deals, mobile auto service promos, school fundraisers, detailing offers, and local booking campaigns.",
    h1: "Car wash flyer maker for wash deals, fundraisers, and auto offers",
    lede:
      "Make a car wash flyer that shows the wash package, price or donation goal, location, date, phone number, and CTA in a layout people can scan quickly.",
    primaryKeyword: "car wash flyer maker",
    supportingKeywords: ["car wash flyer", "car wash flyer template", "car wash flyer design", "car wash flyer ideas", "car wash fundraiser flyer"],
    imageKeywords: ["car wash", "auto", "detailing", "fundraiser", "local service", "wash deal"],
    audience: "Car wash teams, mobile wash providers, detailers, schools, clubs, and local fundraising groups.",
    searchIntent: "Find a car wash flyer template or create a wash deal, fundraiser, or auto service promotion.",
    ctaLabel: "Create a car wash flyer",
    primaryPrompt:
      "Create a car wash flyer with wash package, price or donation goal, date, location, service area, phone number, QR code space, and wash-today CTA.",
    promptExamples: [
      {
        title: "Car wash deal flyer",
        prompt:
          "Create a car wash flyer for a weekend wash deal with package price, location, hours, phone number, glossy clean-car visuals, and visit-today CTA."
      },
      {
        title: "Fundraiser car wash flyer",
        prompt:
          "Create a car wash fundraiser flyer with school or team name, cause, date, time, location, suggested donation, volunteer contact, and support-us CTA."
      },
      {
        title: "Mobile car wash flyer",
        prompt:
          "Create a mobile car wash flyer with service area, wash package bullets, appointment phone number, booking link, limited-time offer, and book-now CTA."
      }
    ],
    copyChecklist: ["Wash package", "Price or donation", "Location or service area", "Date or hours", "CTA"],
    formatTips: ["Use clean-car imagery with clear text space", "Make price or donation amount prominent", "Keep location and phone number together"],
    faq: [
      {
        question: "What should a car wash flyer include?",
        answer:
          "Include the wash package, price or donation amount, date or hours, location or service area, phone number, booking link, and CTA."
      },
      {
        question: "Can I make a car wash fundraiser flyer?",
        answer:
          "Yes. Add the organization name, cause, date, time, location, suggested donation, volunteer contact, and a support CTA."
      },
      {
        question: "How is a car wash flyer different from a detailing flyer?",
        answer:
          "A car wash flyer usually promotes a quick wash, event, or fundraiser, while a detailing flyer often needs package comparisons and appointment details."
      }
    ],
    related: ["car-detailing-flyer-maker", "pressure-washing-flyer-maker", "fundraiser-flyer-maker", "business-flyer-maker"]
  },
  {
    slug: "babysitting-flyer-maker",
    categorySlug: "babysitting-flyers",
    label: "Babysitting Flyer Maker",
    shortLabel: "babysitting flyer",
    title: "Babysitting Flyer Maker for Childcare, Nanny, and After-School Services",
    description:
      "Create babysitting flyers for teen sitters, nanny services, after-school care, family neighborhoods, and local childcare offers.",
    h1: "Babysitting flyer maker for childcare, nanny, and after-school services",
    lede:
      "Make a babysitting flyer that explains availability, age range, experience, certifications, neighborhood, contact method, and parent-friendly CTA.",
    primaryKeyword: "babysitting flyer maker",
    supportingKeywords: ["babysitting flyer", "babysitting flyer template", "babysitting flyer ideas", "babysitting flyer examples", "childcare flyer"],
    imageKeywords: ["babysitting", "childcare", "nanny", "after-school care", "family", "local service"],
    audience: "Babysitters, teen sitters, nannies, daycare helpers, tutors, and local childcare providers.",
    searchIntent: "Find a babysitting flyer template or create a local childcare service flyer parents can trust.",
    ctaLabel: "Create a babysitting flyer",
    primaryPrompt:
      "Create a friendly babysitting flyer with sitter name, availability, age range, experience, CPR note if applicable, neighborhood, phone number, and contact-me CTA.",
    promptExamples: [
      {
        title: "Teen babysitter flyer",
        prompt:
          "Create a babysitting flyer for a teen sitter with name, age or grade if desired, availability, neighborhood, parent contact phone, experience note, and friendly family style."
      },
      {
        title: "After-school care flyer",
        prompt:
          "Create an after-school care flyer with pickup hours, homework help note, age range, weekly availability, contact method, and safe trustworthy layout."
      },
      {
        title: "Nanny service flyer",
        prompt:
          "Create a nanny service flyer with childcare experience, schedule availability, certifications, references note, service area, phone number, and request-a-call CTA."
      }
    ],
    copyChecklist: ["Care type", "Availability", "Age range", "Experience or trust note", "Contact CTA"],
    formatTips: ["Use warm but readable colors", "Keep contact details clear for parents", "Avoid overcrowding with too many credentials"],
    faq: [
      {
        question: "What should a babysitting flyer include?",
        answer:
          "Include sitter name, availability, age range, service area, experience, certifications if applicable, parent contact method, and CTA."
      },
      {
        question: "Can teens make babysitting flyers?",
        answer:
          "Yes. The flyer should stay parent-friendly and include availability, neighborhood, responsible contact details, and any experience or references."
      },
      {
        question: "What makes a babysitting flyer trustworthy?",
        answer:
          "Clear availability, a calm layout, experience notes, certification or reference mentions, and easy parent contact details help build trust."
      }
    ],
    related: ["daycare-flyer-maker", "tutor-flyer-maker", "school-flyer-maker", "business-flyer-maker"]
  },
  {
    slug: "dog-walker-flyer-maker",
    categorySlug: "dog-walker-flyers",
    label: "Dog Walker Flyer Maker",
    shortLabel: "dog walker flyer",
    title: "Dog Walker Flyer Maker for Pet Care, Dog Sitting, and Local Services",
    description:
      "Create dog walker flyers for pet walking, dog sitting, neighborhood pet care, service packages, and local booking campaigns.",
    h1: "Dog walker flyer maker for pet care, dog sitting, and local services",
    lede:
      "Make a dog walker flyer that shows the service area, walk options, schedule, rates or package space, contact details, and booking CTA.",
    primaryKeyword: "dog walker flyer maker",
    supportingKeywords: ["dog walker flyer", "dog walking service flyer", "dog walker flyer template", "dog sitting flyer", "pet care flyer"],
    imageKeywords: ["dog walker", "dog walking", "pet care", "dog sitting", "local service", "booking"],
    audience: "Dog walkers, pet sitters, local pet care providers, neighborhood service businesses, and student service providers.",
    searchIntent: "Find a dog walker flyer template or create a local pet care flyer that gets calls and bookings.",
    ctaLabel: "Create a dog walker flyer",
    primaryPrompt:
      "Create a dog walker flyer with service area, walk package options, availability, rates space, pet care trust note, phone number, and book-a-walk CTA.",
    promptExamples: [
      {
        title: "Dog walking service flyer",
        prompt:
          "Create a dog walking service flyer with neighborhood, walk lengths, weekly availability, rates space, phone number, and book-a-walk CTA."
      },
      {
        title: "Dog sitting flyer",
        prompt:
          "Create a dog sitting flyer with pet care services, overnight or drop-in options, service area, experience note, contact details, and schedule-a-meet CTA."
      },
      {
        title: "Neighborhood pet care flyer",
        prompt:
          "Create a friendly neighborhood pet care flyer with dog walking, feeding, check-ins, local area, phone number, and reliable care message."
      }
    ],
    copyChecklist: ["Pet service", "Service area", "Schedule", "Rates or packages", "Booking CTA"],
    formatTips: ["Use friendly pet imagery", "Make service area obvious", "Keep phone number and availability easy to find"],
    faq: [
      {
        question: "What should a dog walker flyer include?",
        answer:
          "Include the service area, walk options, availability, rates or package space, contact details, trust note, and booking CTA."
      },
      {
        question: "Can I make dog sitting flyers too?",
        answer:
          "Yes. Add sitting type, drop-in or overnight details, schedule, service area, pet care experience, and contact method."
      },
      {
        question: "What image works best for dog walking flyers?",
        answer:
          "Use a clear dog or walking scene with open text space so the service, area, and phone number remain readable."
      }
    ],
    related: ["babysitting-flyer-maker", "business-flyer-maker", "landscaping-flyer-maker", "cleaning-service-flyer-maker"]
  },
  {
    slug: "food-drive-flyer-maker",
    categorySlug: "food-drive-flyers",
    label: "Food Drive Flyer Maker",
    shortLabel: "food drive flyer",
    title: "Food Drive Flyer Maker for Donations, Schools, and Community Causes",
    description:
      "Create food drive flyers for donation campaigns, school collections, church drives, nonprofit events, deadlines, and drop-off instructions.",
    h1: "Food drive flyer maker for donations, schools, and community causes",
    lede:
      "Make a food drive flyer that tells people what to donate, where to drop it off, when the deadline is, who is organizing it, and how to help.",
    primaryKeyword: "food drive flyer maker",
    supportingKeywords: ["food drive flyer", "food drive flyer template", "food drive flyer examples", "food drive flyer ideas", "donation drive flyer"],
    imageKeywords: ["food drive", "donation", "community", "school", "charity", "nonprofit"],
    audience: "Schools, churches, nonprofits, clubs, community groups, and organizers running food collection campaigns.",
    searchIntent: "Find a food drive flyer template or create a printable donation drive announcement.",
    ctaLabel: "Create a food drive flyer",
    primaryPrompt:
      "Create a food drive flyer with donation headline, needed items, drop-off location, deadline, organizer contact, QR code space, and donate-food CTA.",
    promptExamples: [
      {
        title: "School food drive flyer",
        prompt:
          "Create a school food drive flyer with grade or club organizer, needed items, collection dates, drop-off location, parent contact, and donate-food CTA."
      },
      {
        title: "Church food drive flyer",
        prompt:
          "Create a church food drive flyer with cause message, pantry partner, needed items, drop-off hours, location, contact details, and help-neighbors CTA."
      },
      {
        title: "Community donation flyer",
        prompt:
          "Create a community food donation flyer with headline, item list, deadline, drop-off address, organizer phone, QR code space, and clear charity style."
      }
    ],
    copyChecklist: ["Needed items", "Drop-off location", "Deadline", "Organizer", "Donation CTA"],
    formatTips: ["Put the item list in short bullets", "Make deadline and location prominent", "Use friendly community imagery without hiding the text"],
    faq: [
      {
        question: "What should a food drive flyer include?",
        answer:
          "Include needed items, drop-off location, deadline, organizer, contact details, QR code if needed, and a clear donation CTA."
      },
      {
        question: "Can I make school food drive flyers?",
        answer:
          "Yes. Add the school or club name, grade or audience, item list, collection dates, drop-off point, and parent contact."
      },
      {
        question: "What format works for food drive flyers?",
        answer:
          "Letter or A4 works well for print, while 4:5 works for social posts and parent group sharing."
      }
    ],
    related: ["charity-flyer-maker", "fundraiser-flyer-maker", "school-flyer-maker", "church-flyer-maker"]
  },
  {
    slug: "happy-hour-flyer-maker",
    categorySlug: "happy-hour-flyers",
    label: "Happy Hour Flyer Maker",
    shortLabel: "happy hour flyer",
    title: "Happy Hour Flyer Maker for Restaurant, Bar, and Drink Specials",
    description:
      "Create happy hour flyers for bar specials, restaurant offers, drink menus, weekday promos, event nights, and local dining campaigns.",
    h1: "Happy hour flyer maker for restaurant, bar, and drink specials",
    lede:
      "Make a happy hour flyer that shows the special, day and time, venue, prices, featured drinks or food, and visit CTA without crowding the menu.",
    primaryKeyword: "happy hour flyer maker",
    supportingKeywords: ["happy hour flyer", "happy hour flyer template", "happy hour flyer design", "happy hour flyer ideas", "drink specials flyer"],
    imageKeywords: ["happy hour", "bar", "restaurant", "drinks", "menu", "specials"],
    audience: "Bars, restaurants, cafes, drink vendors, event venues, and local hospitality marketers.",
    searchIntent: "Find a happy hour flyer template or create a restaurant and bar specials flyer quickly.",
    ctaLabel: "Create a happy hour flyer",
    primaryPrompt:
      "Create a happy hour flyer with venue name, day and time, drink and food specials, prices, location, social handle, and visit-tonight CTA.",
    promptExamples: [
      {
        title: "Bar happy hour flyer",
        prompt:
          "Create a bar happy hour flyer with drink specials, day and time, price highlights, venue address, social handle, and visit-tonight CTA."
      },
      {
        title: "Restaurant specials flyer",
        prompt:
          "Create a restaurant happy hour flyer with appetizer deals, cocktail specials, hours, address, reservation note, and stop-by CTA."
      },
      {
        title: "Weekday happy hour promo",
        prompt:
          "Create a weekday happy hour flyer with Monday through Thursday hours, featured drinks, small bites, venue name, location, and bright social layout."
      }
    ],
    copyChecklist: ["Specials", "Day and time", "Venue", "Prices", "Visit CTA"],
    formatTips: ["Keep menu copy short", "Make time and price easy to see", "Use one hero drink or clean specials grid"],
    faq: [
      {
        question: "What should a happy hour flyer include?",
        answer:
          "Include the venue name, day and time, drink or food specials, prices, location, contact or social handle, and visit CTA."
      },
      {
        question: "Can I make restaurant happy hour flyers?",
        answer:
          "Yes. Add appetizer deals, drink specials, hours, address, reservation or walk-in note, and a clear CTA."
      },
      {
        question: "What format works for happy hour flyers?",
        answer:
          "Use 4:5 for feed posts, 9:16 for stories, and letter or half-page when printing table tents or handouts."
      }
    ],
    related: ["drink-vendor-flyer-maker", "restaurant-flyer-maker", "menu-flyer-maker", "food-flyer-maker"]
  },
  {
    slug: "tutor-flyer-maker",
    categorySlug: "tutor-flyers",
    label: "Tutor Flyer Maker",
    shortLabel: "tutor flyer",
    title: "Tutor Flyer Maker for Tutoring, Test Prep, and After-School Help",
    description:
      "Create tutor flyers for math help, reading support, test prep, after-school tutoring, online sessions, and local education services.",
    h1: "Tutor flyer maker for tutoring, test prep, and after-school help",
    lede:
      "Make a tutor flyer that explains the subject, grade level, session format, availability, proof points, contact method, and book-a-session CTA.",
    primaryKeyword: "tutor flyer maker",
    supportingKeywords: ["tutor flyer", "tutor flyer template", "tutor flyer examples", "tutoring flyer", "tutoring flyer template"],
    imageKeywords: ["tutor", "tutoring", "education", "test prep", "class", "student"],
    audience: "Tutors, teachers, after-school programs, test prep coaches, learning centers, and student service providers.",
    searchIntent: "Find a tutor flyer template or create a local tutoring service flyer that gets parent inquiries.",
    ctaLabel: "Create a tutor flyer",
    primaryPrompt:
      "Create a tutor flyer with subject, grade level, session type, availability, credentials or results note, phone number, website, and book-a-session CTA.",
    promptExamples: [
      {
        title: "Math tutor flyer",
        prompt:
          "Create a math tutor flyer with grade levels, algebra and homework support, online or in-person sessions, availability, contact details, and book-a-session CTA."
      },
      {
        title: "Test prep flyer",
        prompt:
          "Create a test prep tutor flyer with SAT or ACT focus, score improvement message, session schedule, instructor credentials, phone number, and reserve-a-spot CTA."
      },
      {
        title: "After-school tutoring flyer",
        prompt:
          "Create an after-school tutoring flyer with homework help, reading and math support, days available, location, parent contact, and friendly school-safe layout."
      }
    ],
    copyChecklist: ["Subject", "Grade level", "Session format", "Availability", "Booking CTA"],
    formatTips: ["Lead with the subject and grade range", "Keep contact details parent-friendly", "Use a clean academic layout with readable type"],
    faq: [
      {
        question: "What should a tutor flyer include?",
        answer:
          "Include the subject, grade level, session format, availability, credentials or proof points, contact details, and booking CTA."
      },
      {
        question: "Can I make test prep flyers?",
        answer:
          "Yes. Add the exam, target score or benefit, schedule, instructor credential, location or online format, and registration CTA."
      },
      {
        question: "What makes a tutoring flyer effective?",
        answer:
          "Parents need to see the subject, grade level, trust signal, schedule, and contact method quickly."
      }
    ],
    related: ["school-flyer-maker", "daycare-flyer-maker", "babysitting-flyer-maker", "business-flyer-maker"]
  },
  {
    slug: "daycare-flyer-maker",
    categorySlug: "daycare-flyers",
    label: "Daycare Flyer Maker",
    shortLabel: "daycare flyer",
    title: "Daycare Flyer Maker for Childcare, Enrollment, and Preschool Openings",
    description:
      "Create daycare flyers for childcare openings, preschool enrollment, family programs, open houses, tuition offers, and parent outreach.",
    h1: "Daycare flyer maker for childcare, enrollment, and preschool openings",
    lede:
      "Make a daycare flyer that explains openings, ages served, schedule, location, trust signals, tour details, and parent CTA clearly.",
    primaryKeyword: "daycare flyer maker",
    supportingKeywords: ["daycare flyer", "daycare flyer template", "daycare flyer ideas", "daycare flyer examples", "childcare flyer"],
    imageKeywords: ["daycare", "childcare", "preschool", "children", "enrollment", "family"],
    audience: "Daycare centers, preschool programs, childcare providers, family service teams, and local enrollment marketers.",
    searchIntent: "Find a daycare flyer template or create a childcare enrollment flyer for local families.",
    ctaLabel: "Create a daycare flyer",
    primaryPrompt:
      "Create a daycare flyer with center name, ages served, openings, schedule, location, tour date, trust signals, phone number, and enroll-now CTA.",
    promptExamples: [
      {
        title: "Daycare enrollment flyer",
        prompt:
          "Create a daycare enrollment flyer with center name, available age groups, daily schedule, location, tour details, contact phone, and enroll-now CTA."
      },
      {
        title: "Preschool open house flyer",
        prompt:
          "Create a preschool open house flyer with date, time, age range, program highlights, address, registration link, and visit-us CTA."
      },
      {
        title: "Childcare openings flyer",
        prompt:
          "Create a childcare openings flyer with spots available, ages served, hours, safety and care notes, parent contact, and schedule-a-tour CTA."
      }
    ],
    copyChecklist: ["Ages served", "Openings", "Schedule", "Location", "Enrollment CTA"],
    formatTips: ["Use warm family-friendly visuals", "Make ages and availability easy to scan", "Keep phone and tour CTA visible"],
    faq: [
      {
        question: "What should a daycare flyer include?",
        answer:
          "Include the daycare name, ages served, openings, schedule, location, trust signals, tour or enrollment details, contact method, and CTA."
      },
      {
        question: "Can I make preschool enrollment flyers?",
        answer:
          "Yes. Add age range, program highlights, open house or tour date, address, registration link, and parent contact."
      },
      {
        question: "What design works for daycare flyers?",
        answer:
          "Use warm colors, friendly imagery, clear headings, and simple parent-focused details instead of dense text."
      }
    ],
    related: ["babysitting-flyer-maker", "tutor-flyer-maker", "school-flyer-maker", "business-flyer-maker"]
  },
  {
    slug: "lost-pet-flyer-maker",
    categorySlug: "lost-pet-flyers",
    label: "Lost Pet Flyer Maker",
    shortLabel: "lost pet flyer",
    title: "Lost Pet Flyer Maker for Missing Dog, Cat, and Neighborhood Notices",
    description:
      "Create lost pet flyers with photo space, pet description, last seen location, reward details, phone number, and printable neighborhood notice layout.",
    h1: "Lost pet flyer maker for missing dog, cat, and neighborhood notices",
    lede:
      "Make a lost pet flyer that keeps the pet photo, name, last seen area, description, reward, and contact details large enough for print and local sharing.",
    primaryKeyword: "lost pet flyer maker",
    supportingKeywords: ["lost pet flyer", "lost pet flyer template", "lost pet flyer generator", "lost pet flyer printable", "missing dog flyer"],
    imageKeywords: ["lost pet", "missing dog", "missing cat", "neighborhood", "notice", "reward"],
    audience: "Pet owners, neighborhood groups, shelters, rescue volunteers, and local community helpers.",
    searchIntent: "Find a lost pet flyer generator or create a printable missing pet notice quickly.",
    ctaLabel: "Create a lost pet flyer",
    primaryPrompt:
      "Create a lost pet flyer with large pet photo space, pet name, breed or description, last seen location, date, reward note, phone number, and please-call CTA.",
    promptExamples: [
      {
        title: "Missing dog flyer",
        prompt:
          "Create a missing dog flyer with large photo space, dog name, breed, color, collar details, last seen location and date, reward note, phone number, and please-call CTA."
      },
      {
        title: "Lost cat flyer",
        prompt:
          "Create a lost cat flyer with photo space, cat name, markings, indoor or outdoor note, last seen street, contact phone, reward note, and printable notice style."
      },
      {
        title: "Neighborhood pet alert",
        prompt:
          "Create a neighborhood lost pet alert flyer with pet photo, description bullets, last seen map-style area, contact number, reward note, and high-contrast headline."
      }
    ],
    copyChecklist: ["Pet photo", "Pet description", "Last seen location", "Contact number", "Reward or CTA"],
    formatTips: ["Make the pet photo the largest element", "Use a very large phone number", "Keep the layout high contrast for street posting"],
    faq: [
      {
        question: "What should a lost pet flyer include?",
        answer:
          "Include a large photo, pet name, description, last seen location and date, reward if offered, contact number, and clear please-call CTA."
      },
      {
        question: "Can I make missing dog or cat flyers?",
        answer:
          "Yes. Add species-specific details such as breed, markings, collar, temperament, microchip note if relevant, and last seen area."
      },
      {
        question: "What format works best for lost pet flyers?",
        answer:
          "Use a high-contrast letter or A4 flyer for printing, with a large image and large contact number."
      }
    ],
    related: ["dog-walker-flyer-maker", "psa-flyer-maker", "business-flyer-maker", "school-flyer-maker"]
  },
  {
    slug: "photography-flyer-maker",
    categorySlug: "photography-flyers",
    label: "Photography Flyer Maker",
    shortLabel: "photography flyer",
    title: "Photography Flyer Maker for Mini Sessions, Studios, and Booking Offers",
    description:
      "Create photography flyers for mini sessions, portrait packages, studio promos, event shoots, holiday sessions, and local booking campaigns.",
    h1: "Photography flyer maker for mini sessions, studios, and booking offers",
    lede:
      "Make a photography flyer that highlights the session type, package, date or booking window, location, price space, portfolio cue, and booking CTA.",
    primaryKeyword: "photography flyer maker",
    supportingKeywords: ["photography flyer", "photography flyer template", "photography flyer design", "photo flyer maker", "photography flyer ideas"],
    imageKeywords: ["photography", "photo session", "mini session", "portrait", "studio", "booking"],
    audience: "Photographers, studios, portrait businesses, event photographers, school photo teams, and local booking services.",
    searchIntent: "Find a photography flyer template or create a booking-focused flyer for photo sessions and packages.",
    ctaLabel: "Create a photography flyer",
    primaryPrompt:
      "Create a photography flyer with session type, package offer, booking dates, location, portfolio-style visual, price space, contact details, and book-your-session CTA.",
    promptExamples: [
      {
        title: "Mini session flyer",
        prompt:
          "Create a photography mini session flyer with session theme, date, location, package price, limited spots note, portfolio-style image area, and book-now CTA."
      },
      {
        title: "Portrait studio flyer",
        prompt:
          "Create a portrait photography flyer with studio name, headshot or family portrait package, price space, booking link, phone number, and clean premium layout."
      },
      {
        title: "Event photographer flyer",
        prompt:
          "Create an event photography flyer with service types, coverage package, sample gallery cue, booking deadline, contact details, and request-a-quote CTA."
      }
    ],
    copyChecklist: ["Session type", "Package or price", "Booking window", "Location", "Booking CTA"],
    formatTips: ["Use one strong photo area", "Keep package details short", "Make booking date and contact method easy to find"],
    faq: [
      {
        question: "What should a photography flyer include?",
        answer:
          "Include the session type, package or price space, date or booking window, location, portfolio cue, contact details, and booking CTA."
      },
      {
        question: "Can I make mini session flyers?",
        answer:
          "Yes. Add the session theme, date, location, price, limited slots note, booking method, and one strong visual style."
      },
      {
        question: "What format works for photography flyers?",
        answer:
          "Use 4:5 for social posts, 9:16 for stories, and letter or postcard layouts for local handouts."
      }
    ],
    related: ["business-flyer-maker", "event-flyer-maker", "sale-flyer-maker", "grand-opening-flyer-maker"]
  },
  {
    slug: "construction-flyer-maker",
    categorySlug: "construction-flyers",
    label: "Construction Flyer Maker",
    shortLabel: "construction flyer",
    title: "Construction Flyer Maker for Contractors, Remodeling, and Local Projects",
    description:
      "Create construction flyers for contractors, remodeling services, roofing, repairs, project promos, estimates, and local lead generation.",
    h1: "Construction flyer maker for contractors, remodeling, and local projects",
    lede:
      "Make a construction flyer that explains the service, project type, service area, proof points, estimate offer, phone number, and quote CTA.",
    primaryKeyword: "construction flyer maker",
    supportingKeywords: ["construction flyer", "construction flyer template", "construction flyer design", "construction flyer examples", "contractor flyer"],
    imageKeywords: ["construction", "contractor", "remodeling", "repair", "estimate", "local service"],
    audience: "Contractors, remodelers, roofers, builders, repair teams, handymen, and local service businesses.",
    searchIntent: "Find a construction flyer template or create a contractor promotion that drives quote requests.",
    ctaLabel: "Create a construction flyer",
    primaryPrompt:
      "Create a construction flyer with service headline, project types, service area, proof points, free estimate offer, phone number, website, and request-a-quote CTA.",
    promptExamples: [
      {
        title: "Contractor service flyer",
        prompt:
          "Create a contractor flyer with remodeling, repairs, and project services, service area, licensed and insured note, phone number, and free-estimate CTA."
      },
      {
        title: "Home remodeling flyer",
        prompt:
          "Create a construction flyer for home remodeling with kitchen and bathroom services, before-and-after visual direction, estimate offer, website, and book-a-consult CTA."
      },
      {
        title: "Roofing repair flyer",
        prompt:
          "Create a roofing repair flyer with storm damage inspection offer, service area, trust badges, emergency phone number, and schedule-inspection CTA."
      }
    ],
    copyChecklist: ["Construction service", "Project type", "Service area", "Trust proof", "Quote CTA"],
    formatTips: ["Use strong before-and-after or jobsite visuals", "Make phone number large", "Keep proof points short and credible"],
    faq: [
      {
        question: "What should a construction flyer include?",
        answer:
          "Include the service, project types, service area, proof points, estimate offer, contact details, and quote CTA."
      },
      {
        question: "Can I make contractor flyers?",
        answer:
          "Yes. Add the contractor specialty, licensed or insured note if true, recent work cue, service area, phone number, and quote CTA."
      },
      {
        question: "What design works for construction flyers?",
        answer:
          "Use clear jobsite or before-and-after imagery, sturdy typography, high contrast, and a prominent phone number."
      }
    ],
    related: ["business-flyer-maker", "pressure-washing-flyer-maker", "landscaping-flyer-maker", "cleaning-service-flyer-maker"]
  },
  {
    slug: "workshop-flyer-maker",
    categorySlug: "workshop-flyers",
    label: "Workshop Flyer Maker",
    shortLabel: "workshop flyer",
    title: "Workshop Flyer Maker for Classes, Training Sessions, and Registrations",
    description:
      "Create workshop flyers for classes, training sessions, webinars, business events, creative sessions, and registration campaigns.",
    h1: "Workshop flyer maker for classes, training sessions, and registrations",
    lede:
      "Make a workshop flyer that explains the topic, speaker, date, venue or online format, outcomes, audience, price, and registration CTA.",
    primaryKeyword: "workshop flyer maker",
    supportingKeywords: ["workshop flyer", "workshop flyer template", "workshop flyer design", "workshop flyer ideas", "training flyer"],
    imageKeywords: ["workshop", "class", "training", "speaker", "registration", "learning"],
    audience: "Educators, coaches, trainers, businesses, community organizers, creative studios, and event teams.",
    searchIntent: "Find a workshop flyer template or create a registration flyer for a class, training, or event.",
    ctaLabel: "Create a workshop flyer",
    primaryPrompt:
      "Create a workshop flyer with topic headline, speaker name, date, time, venue or online link, three outcomes, price, QR code space, and register-now CTA.",
    promptExamples: [
      {
        title: "Business workshop flyer",
        prompt:
          "Create a business workshop flyer with topic, speaker, date, time, venue, three learning outcomes, price, QR code space, and register-now CTA."
      },
      {
        title: "Creative class flyer",
        prompt:
          "Create a creative workshop flyer with class title, materials note, instructor, schedule, location, limited seats, and reserve-your-seat CTA."
      },
      {
        title: "Online training flyer",
        prompt:
          "Create an online training flyer with webinar topic, host, date, time zone, key takeaways, registration link, and clean professional style."
      }
    ],
    copyChecklist: ["Workshop topic", "Speaker or host", "Date and venue", "Outcomes", "Registration CTA"],
    formatTips: ["Lead with the topic and outcome", "Keep time zone or venue clear", "Reserve space for QR code or registration link"],
    faq: [
      {
        question: "What should a workshop flyer include?",
        answer:
          "Include the topic, speaker, date, time, venue or online format, audience, outcomes, price if needed, and registration CTA."
      },
      {
        question: "Can I make online workshop flyers?",
        answer:
          "Yes. Add platform or registration link, time zone, host, learning outcomes, and a clear sign-up CTA."
      },
      {
        question: "What format works for workshop flyers?",
        answer:
          "Use 4:5 for LinkedIn and Instagram, 9:16 for stories, and letter or A4 for local handouts."
      }
    ],
    related: ["event-flyer-maker", "business-flyer-maker", "tutor-flyer-maker", "school-flyer-maker"]
  },
  {
    slug: "bake-sale-flyer-maker",
    categorySlug: "bake-sale-flyers",
    label: "Bake Sale Flyer Maker",
    shortLabel: "bake sale flyer",
    title: "Bake Sale Flyer Maker for School Fundraisers and Community Food Sales",
    description:
      "Create bake sale flyers for school fundraisers, charity food tables, church events, community sales, prices, deadlines, and donation drives.",
    h1: "Bake sale flyer maker for school fundraisers and community food sales",
    lede:
      "Make a bake sale flyer that shows the cause, date, location, menu highlights, price or donation note, organizer contact, and support CTA.",
    primaryKeyword: "bake sale flyer maker",
    supportingKeywords: ["bake sale flyer", "bake sale flyer template", "bake sale flyer ideas", "bake sale flyer design", "cake sale flyer"],
    imageKeywords: ["bake sale", "fundraiser", "school", "dessert", "food", "community"],
    audience: "Schools, parent groups, churches, clubs, charities, students, and community organizers.",
    searchIntent: "Find a bake sale flyer template or create a fundraiser flyer for a food sale.",
    ctaLabel: "Create a bake sale flyer",
    primaryPrompt:
      "Create a bake sale flyer with fundraiser cause, date, time, location, dessert highlights, price or donation note, organizer contact, and support-the-sale CTA.",
    promptExamples: [
      {
        title: "School bake sale flyer",
        prompt:
          "Create a school bake sale flyer with class or club name, fundraiser cause, date, time, location, dessert list, parent contact, and support-us CTA."
      },
      {
        title: "Charity bake sale flyer",
        prompt:
          "Create a charity bake sale flyer with cause headline, baked goods, suggested donation, location, deadline, organizer phone, and help-the-cause CTA."
      },
      {
        title: "Church bake sale flyer",
        prompt:
          "Create a church bake sale flyer with event name, date, service or hall location, dessert table highlights, donation note, and community support CTA."
      }
    ],
    copyChecklist: ["Cause", "Date and location", "Menu highlights", "Price or donation", "Support CTA"],
    formatTips: ["Use warm food visuals", "Make date and location prominent", "Keep dessert list short enough to read"],
    faq: [
      {
        question: "What should a bake sale flyer include?",
        answer:
          "Include the cause, date, time, location, baked goods, price or donation note, organizer contact, and support CTA."
      },
      {
        question: "Can I make school bake sale flyers?",
        answer:
          "Yes. Add the school, class or club, fundraiser cause, parent contact, date, location, and item highlights."
      },
      {
        question: "What format works for bake sale flyers?",
        answer:
          "Letter or A4 works for school handouts, while 4:5 works for parent groups and social sharing."
      }
    ],
    related: ["food-drive-flyer-maker", "fundraiser-flyer-maker", "charity-flyer-maker", "school-flyer-maker"]
  },
  {
    slug: "talent-show-flyer-maker",
    categorySlug: "talent-show-flyers",
    label: "Talent Show Flyer Maker",
    shortLabel: "talent show flyer",
    title: "Talent Show Flyer Maker for Auditions, School Performances, and Events",
    description:
      "Create talent show flyers for auditions, school performances, community showcases, signup deadlines, ticket details, and stage events.",
    h1: "Talent show flyer maker for auditions, school performances, and events",
    lede:
      "Make a talent show flyer that makes the show date, audition details, venue, participant rules, ticket info, and signup CTA easy to understand.",
    primaryKeyword: "talent show flyer maker",
    supportingKeywords: ["talent show flyer", "talent show flyer template", "talent show flyer design", "talent show flyer ideas", "audition flyer"],
    imageKeywords: ["talent show", "audition", "school", "stage", "performance", "event"],
    audience: "Schools, teachers, student councils, community centers, churches, event teams, and performance organizers.",
    searchIntent: "Find a talent show flyer template or create an audition and event announcement.",
    ctaLabel: "Create a talent show flyer",
    primaryPrompt:
      "Create a talent show flyer with show title, audition or event date, venue, signup deadline, participant rules, ticket info, contact details, and join-the-show CTA.",
    promptExamples: [
      {
        title: "School talent show flyer",
        prompt:
          "Create a school talent show flyer with show title, date, time, auditorium location, signup deadline, grade eligibility, contact details, and join-the-show CTA."
      },
      {
        title: "Audition flyer",
        prompt:
          "Create a talent show audition flyer with audition date, time slots, venue, what to prepare, signup QR code space, and register-to-perform CTA."
      },
      {
        title: "Community showcase flyer",
        prompt:
          "Create a community talent show flyer with performer categories, ticket info, date, venue, host organization, sponsor space, and attend-or-sign-up CTA."
      }
    ],
    copyChecklist: ["Show title", "Date and venue", "Signup deadline", "Rules or eligibility", "CTA"],
    formatTips: ["Make date and venue easy to scan", "Use stage visuals without hiding details", "Separate audience ticket info from performer signup info"],
    faq: [
      {
        question: "What should a talent show flyer include?",
        answer:
          "Include the show title, date, time, venue, audition or signup details, eligibility, ticket info if needed, contact details, and CTA."
      },
      {
        question: "Can I make audition flyers?",
        answer:
          "Yes. Add audition date, time slots, location, what performers should prepare, signup method, and deadline."
      },
      {
        question: "What format works for talent show flyers?",
        answer:
          "Use 4:5 for social posts and letter or A4 for school bulletin boards and handouts."
      }
    ],
    related: ["school-flyer-maker", "event-flyer-maker", "graduation-flyer-maker", "dance-flyer-maker"]
  },
  {
    slug: "wedding-flyer-maker",
    categorySlug: "wedding-flyers",
    label: "Wedding Flyer Maker",
    shortLabel: "wedding flyer",
    title: "Wedding Flyer Maker for Invitations, Announcements, and Events",
    description:
      "Create wedding flyers for invitations, save-the-dates, receptions, bridal events, venue notices, RSVP details, and social announcements.",
    h1: "Wedding flyer maker for invitations, announcements, and events",
    lede:
      "Make a wedding flyer that presents the couple names, date, venue, RSVP details, dress code, schedule note, and celebration mood clearly.",
    primaryKeyword: "wedding flyer maker",
    supportingKeywords: ["wedding flyer", "wedding flyer template", "wedding flyer design", "wedding flyer maker free", "wedding poster maker"],
    imageKeywords: ["wedding", "invitation", "reception", "save the date", "bridal", "event"],
    audience: "Couples, wedding planners, venues, photographers, bridal shops, and event teams creating wedding announcements.",
    searchIntent: "Find a wedding flyer template or create a polished wedding announcement, invite, or event flyer.",
    ctaLabel: "Create a wedding flyer",
    primaryPrompt:
      "Create an elegant wedding flyer with couple names, wedding date, venue, RSVP details, dress code, schedule note, floral or editorial visual style, and a clear invitation CTA.",
    promptExamples: [
      {
        title: "Wedding invitation flyer",
        prompt:
          "Create an elegant wedding invitation flyer with couple names, date, venue, RSVP deadline, dress code, soft floral styling, and a refined portrait layout."
      },
      {
        title: "Reception flyer",
        prompt:
          "Create a wedding reception flyer with couple names, reception date, venue, time, RSVP contact, music or dinner note, and warm celebration style."
      },
      {
        title: "Save-the-date flyer",
        prompt:
          "Create a save-the-date wedding flyer with couple names, date, city, wedding website space, RSVP teaser, and minimal romantic typography."
      }
    ],
    copyChecklist: ["Couple names", "Date and venue", "RSVP details", "Dress code", "Invitation CTA"],
    formatTips: ["Use portrait for social invitations", "Keep names and date largest", "Leave clear space for RSVP and venue details"],
    faq: [
      {
        question: "What should a wedding flyer include?",
        answer:
          "Include the couple names, date, time, venue, RSVP details, dress code, wedding website if needed, and one clear invitation CTA."
      },
      {
        question: "Can I make save-the-date flyers?",
        answer:
          "Yes. Add the couple names, date, city or venue area, website or RSVP note, and a visual style such as romantic, modern, floral, or minimal."
      },
      {
        question: "What format works for wedding flyers?",
        answer:
          "Use 4:5 or portrait for social sharing, 9:16 for stories, and letter or A4 for printable event notices."
      }
    ],
    related: ["event-flyer-maker", "party-flyer-maker", "photography-flyer-maker", "birthday-flyer-maker", "baby-shower-flyer-maker", "graduation-flyer-maker"]
  },
  {
    slug: "halloween-flyer-maker",
    categorySlug: "halloween-flyers",
    label: "Halloween Flyer Maker",
    shortLabel: "Halloween flyer",
    title: "Halloween Flyer Maker for Parties, Events, and Seasonal Promos",
    description:
      "Create Halloween flyers for parties, haunted events, costume contests, restaurant specials, school events, and seasonal promotions.",
    h1: "Halloween flyer maker for parties, events, and seasonal promos",
    lede:
      "Make a Halloween flyer that makes the event title, date, venue, costume theme, ticket or RSVP detail, and seasonal CTA easy to scan.",
    primaryKeyword: "halloween flyer maker",
    supportingKeywords: ["halloween flyer", "halloween flyer design", "halloween flyer templates", "halloween flyer maker free", "halloween poster maker"],
    imageKeywords: ["Halloween", "costume", "party", "seasonal", "spooky", "event"],
    audience: "Event hosts, clubs, schools, restaurants, venues, promoters, and local businesses planning Halloween campaigns.",
    searchIntent: "Find a Halloween flyer template or create a seasonal event or promotion flyer with a clear date and CTA.",
    ctaLabel: "Create a Halloween flyer",
    primaryPrompt:
      "Create a Halloween flyer with event title, date, time, venue, costume theme, ticket or RSVP details, spooky seasonal visuals, and a clear attend-or-book CTA.",
    promptExamples: [
      {
        title: "Halloween party flyer",
        prompt:
          "Create a Halloween party flyer with event name, date, venue, DJ or host, costume contest note, ticket link, and high-contrast spooky nightclub style."
      },
      {
        title: "School Halloween event flyer",
        prompt:
          "Create a family-friendly Halloween flyer with school event name, date, time, activity list, parent contact, costume note, and cheerful seasonal visuals."
      },
      {
        title: "Restaurant Halloween special",
        prompt:
          "Create a Halloween restaurant flyer with themed menu offer, date range, address, reservation phone, limited-time badge, and seasonal food styling."
      }
    ],
    copyChecklist: ["Event or offer", "Date and time", "Venue", "Theme or costume note", "CTA"],
    formatTips: ["Keep orange and black contrast readable", "Use large date and venue blocks", "Avoid hiding copy inside busy seasonal art"],
    faq: [
      {
        question: "What should a Halloween flyer include?",
        answer:
          "Include the event or offer, date, time, venue, costume or theme note, ticket or RSVP details, and one clear CTA."
      },
      {
        question: "Can I make Halloween party flyers?",
        answer:
          "Yes. Add the party name, DJ or host, venue, date, ticket link, costume contest details, and the visual mood you want."
      },
      {
        question: "What design works for Halloween flyers?",
        answer:
          "Use strong seasonal cues, but keep the headline, date, venue, and CTA readable before adding extra spooky decoration."
      }
    ],
    related: ["party-flyer-maker", "event-flyer-maker", "club-flyer-maker", "holiday-flyer-maker"]
  },
  {
    slug: "holiday-flyer-maker",
    categorySlug: "holiday-flyers",
    label: "Holiday Flyer Maker",
    shortLabel: "holiday flyer",
    title: "Holiday Flyer Maker for Seasonal Events, Sales, and Promotions",
    description:
      "Create holiday flyers for seasonal sales, community events, restaurant specials, school programs, gift offers, and festive announcements.",
    h1: "Holiday flyer maker for seasonal events, sales, and promotions",
    lede:
      "Make a holiday flyer that makes the seasonal offer, event date, deadline, location, gift or discount detail, and CTA easy to act on.",
    primaryKeyword: "holiday flyer maker",
    supportingKeywords: ["holiday flyer", "holiday flyer design", "holiday flyer templates", "holiday poster maker", "holiday sale flyer"],
    imageKeywords: ["holiday", "seasonal", "christmas", "sale", "gift", "event"],
    audience: "Retailers, restaurants, schools, churches, community groups, venues, and service businesses running seasonal campaigns.",
    searchIntent: "Find a holiday flyer template or create a seasonal event, sale, or announcement flyer.",
    ctaLabel: "Create a holiday flyer",
    primaryPrompt:
      "Create a holiday flyer with seasonal headline, event or offer details, date range, location or website, gift or discount note, festive visual style, and clear CTA.",
    promptExamples: [
      {
        title: "Holiday sale flyer",
        prompt:
          "Create a holiday sale flyer with discount headline, featured products, sale dates, coupon code, store or website, gift-ready visual style, and shop-now CTA."
      },
      {
        title: "Community holiday event",
        prompt:
          "Create a community holiday event flyer with event name, date, venue, activities, organizer contact, donation or RSVP note, and warm festive style."
      },
      {
        title: "Restaurant holiday special",
        prompt:
          "Create a holiday restaurant flyer with seasonal menu item, date range, reservation phone, address, limited-time badge, and book-a-table CTA."
      }
    ],
    copyChecklist: ["Seasonal offer", "Date or deadline", "Location or website", "Gift or discount detail", "CTA"],
    formatTips: ["Make deadline and offer visible", "Use festive visuals with enough text space", "Create separate social and print versions"],
    faq: [
      {
        question: "What should a holiday flyer include?",
        answer:
          "Include the seasonal event or offer, date range, location or website, gift or discount detail, contact information, and a clear CTA."
      },
      {
        question: "Can I make holiday sale flyers?",
        answer:
          "Yes. Add the discount, featured products, sale dates, coupon code, website or store details, and shop-now CTA."
      },
      {
        question: "What format works for holiday flyers?",
        answer:
          "Use 4:5 for feed posts, 9:16 for stories, and letter or A4 for printable seasonal promotions."
      }
    ],
    related: ["black-friday-flyer-maker", "sale-flyer-maker", "halloween-flyer-maker", "event-flyer-maker"]
  },
  {
    slug: "marketing-flyer-maker",
    categorySlug: "marketing-flyers",
    label: "Marketing Flyer Maker",
    shortLabel: "marketing flyer",
    title: "Marketing Flyer Maker for Campaigns, Offers, and Advertising",
    description:
      "Create marketing flyers for campaigns, product launches, advertising offers, local promos, lead generation, and brand announcements.",
    h1: "Marketing flyer maker for campaigns, offers, and advertising",
    lede:
      "Make a marketing flyer that connects one audience, one offer, one proof point, one channel, and one CTA before the design gets busy.",
    primaryKeyword: "marketing flyer maker",
    supportingKeywords: ["marketing flyer", "marketing flyer design", "marketing flyer templates", "marketing flyer maker ai", "advertising flyer maker"],
    imageKeywords: ["marketing", "advertising", "campaign", "product", "business", "promotion"],
    audience: "Marketers, founders, sales teams, local businesses, agencies, creators, and product teams promoting campaigns.",
    searchIntent: "Find a marketing flyer template or create an advertising flyer for a campaign, launch, or lead-generation offer.",
    ctaLabel: "Create a marketing flyer",
    primaryPrompt:
      "Create a marketing flyer with campaign headline, target audience, offer, three proof points, product or service visual, website, QR code space, and conversion CTA.",
    promptExamples: [
      {
        title: "Lead generation flyer",
        prompt:
          "Create a marketing flyer for lead generation with benefit headline, offer, three proof points, QR code space, website, phone number, and book-a-call CTA."
      },
      {
        title: "Product launch flyer",
        prompt:
          "Create a product launch flyer with product name, main benefit, launch date, feature bullets, website, early-bird offer, and learn-more CTA."
      },
      {
        title: "Local campaign flyer",
        prompt:
          "Create a local marketing flyer with service promise, neighborhood or service area, limited offer, testimonial cue, phone number, and schedule-now CTA."
      }
    ],
    copyChecklist: ["Audience", "Offer", "Proof point", "Channel", "Conversion CTA"],
    formatTips: ["Lead with one benefit", "Keep proof points short", "Reserve space for QR code, URL, or phone number"],
    faq: [
      {
        question: "What should a marketing flyer include?",
        answer:
          "Include the campaign audience, offer, main benefit, proof points, contact or website, QR code if needed, and one conversion CTA."
      },
      {
        question: "Can I make advertising flyers?",
        answer:
          "Yes. Add the product or service, audience, offer, proof, distribution channel, and CTA so the flyer supports the campaign goal."
      },
      {
        question: "What design works for marketing flyers?",
        answer:
          "Use one dominant benefit headline, a clear product or service visual, short proof points, and a CTA that matches the campaign channel."
      }
    ],
    related: ["business-flyer-maker", "sale-flyer-maker", "grand-opening-flyer-maker", "event-flyer-maker"]
  },
  {
    slug: "product-flyer-maker",
    categorySlug: "product-flyers",
    label: "Product Flyer Maker",
    shortLabel: "product flyer",
    title: "Product Flyer Maker for Launches, Offers, and Promotions",
    description:
      "Create product flyers for launches, feature announcements, retail offers, ecommerce promos, product comparisons, and sales campaigns.",
    h1: "Product flyer maker for launches, offers, and promotions",
    lede:
      "Make a product flyer that presents the product name, main benefit, offer, proof points, price or launch date, website, and CTA clearly.",
    primaryKeyword: "product flyer maker",
    supportingKeywords: ["product flyer", "product flyer design", "product flyer template", "product poster maker", "product brochure maker"],
    imageKeywords: ["product", "launch", "retail", "ecommerce", "promotion", "marketing"],
    audience: "Product marketers, ecommerce teams, founders, retailers, creators, and local shops promoting products or launches.",
    searchIntent: "Find a product flyer template or create a product promotion for a launch, sale, or campaign.",
    ctaLabel: "Create a product flyer",
    primaryPrompt:
      "Create a product flyer with product name, hero product visual, main benefit, three feature bullets, launch date or price, website, QR code space, and shop-now CTA.",
    promptExamples: [
      {
        title: "Product launch flyer",
        prompt:
          "Create a product launch flyer with product name, hero image area, launch date, key benefit, three features, website, early-bird offer, and learn-more CTA."
      },
      {
        title: "Retail product flyer",
        prompt:
          "Create a retail product flyer with product photo direction, price, discount, store or website, feature callouts, limited-time badge, and shop-now CTA."
      },
      {
        title: "Product comparison flyer",
        prompt:
          "Create a product comparison flyer with product name, three advantages, proof point, offer, QR code space, and clean marketing layout."
      }
    ],
    copyChecklist: ["Product name", "Main benefit", "Offer or price", "Proof points", "Shop CTA"],
    formatTips: ["Use one strong product visual", "Keep feature bullets short", "Reserve space for price, QR code, or website"],
    faq: [
      {
        question: "What should a product flyer include?",
        answer:
          "Include the product name, main benefit, feature bullets, price or offer, launch date if relevant, website, QR code if needed, and one CTA."
      },
      {
        question: "Can I make ecommerce product flyers?",
        answer:
          "Yes. Add the product, discount, website, coupon code, audience, product photo direction, and shop-now CTA."
      },
      {
        question: "What design works for product flyers?",
        answer:
          "Use a clear product hero, short benefit-led copy, enough negative space for price and CTA, and brand colors that keep the offer readable."
      }
    ],
    related: ["marketing-flyer-maker", "sale-flyer-maker", "business-flyer-maker", "black-friday-flyer-maker"]
  },
  {
    slug: "advertising-flyer-maker",
    categorySlug: "advertising-flyers",
    label: "Advertising Flyer Maker",
    shortLabel: "advertising flyer",
    title: "Advertising Flyer Maker for Ads, Offers, and Promotions",
    description:
      "Create advertising flyers for service ads, product promos, local campaigns, ad flyers, promotional offers, and lead-generation handouts.",
    h1: "Advertising flyer maker for ads, offers, and promotions",
    lede:
      "Make an advertising flyer that matches one audience, one offer, one reason to believe, one distribution channel, and one conversion CTA.",
    primaryKeyword: "advertising flyer maker",
    supportingKeywords: ["advertising flyer", "ad flyer maker", "advertisement flyer maker ai", "promotional flyer maker", "advertising poster maker"],
    imageKeywords: ["advertising", "ad", "promotion", "campaign", "offer", "lead generation"],
    audience: "Small businesses, agencies, marketers, local services, product sellers, and teams creating campaign handouts.",
    searchIntent: "Find an ad flyer maker or create a promotional flyer that turns an offer into a campaign asset.",
    ctaLabel: "Create an advertising flyer",
    primaryPrompt:
      "Create an advertising flyer with target audience, offer headline, product or service visual, three proof points, deadline, phone or website, and conversion CTA.",
    promptExamples: [
      {
        title: "Local ad flyer",
        prompt:
          "Create a local advertising flyer with service headline, area served, limited offer, three proof points, phone number, website, and book-now CTA."
      },
      {
        title: "Promotional flyer",
        prompt:
          "Create a promotional flyer with offer headline, product or service visual, discount, deadline, QR code space, and claim-this-offer CTA."
      },
      {
        title: "Lead generation ad flyer",
        prompt:
          "Create an ad flyer for lead generation with audience-specific benefit, testimonial cue, free consultation offer, contact details, and schedule-a-call CTA."
      }
    ],
    copyChecklist: ["Audience", "Offer", "Proof", "Contact method", "Conversion CTA"],
    formatTips: ["Make the offer and CTA dominant", "Use proof points instead of long paragraphs", "Match format to distribution channel"],
    faq: [
      {
        question: "What should an advertising flyer include?",
        answer:
          "Include the target audience, offer, main benefit, proof points, deadline if needed, contact method, and one conversion CTA."
      },
      {
        question: "Can I make ad flyers for local services?",
        answer:
          "Yes. Add the service, area served, offer, proof, phone number, website, and booking CTA."
      },
      {
        question: "How is an advertising flyer different from a general business flyer?",
        answer:
          "An advertising flyer is more campaign-focused: it needs a specific offer, audience, channel, and measurable action."
      }
    ],
    related: ["marketing-flyer-maker", "business-flyer-maker", "product-flyer-maker", "sale-flyer-maker"]
  },
  {
    slug: "christmas-flyer-maker",
    categorySlug: "christmas-flyers",
    label: "Christmas Flyer Maker",
    shortLabel: "Christmas flyer",
    title: "Christmas Flyer Maker for Events, Sales, and Holiday Promotions",
    description:
      "Create Christmas flyers for holiday sales, church events, school programs, restaurant specials, parties, gift offers, and seasonal announcements.",
    h1: "Christmas flyer maker for events, sales, and holiday promotions",
    lede:
      "Make a Christmas flyer that makes the event or offer, date, venue, gift or discount detail, RSVP or order method, and festive CTA easy to read.",
    primaryKeyword: "christmas flyer maker",
    supportingKeywords: ["christmas flyer", "christmas flyer design", "christmas flyer templates", "christmas poster maker", "christmas poster maker online free"],
    imageKeywords: ["Christmas", "holiday", "gift", "seasonal", "church", "sale"],
    audience: "Retailers, churches, schools, restaurants, venues, community groups, and local businesses running Christmas campaigns.",
    searchIntent: "Find a Christmas flyer template or create a holiday event, church, school, or sale announcement.",
    ctaLabel: "Create a Christmas flyer",
    primaryPrompt:
      "Create a Christmas flyer with holiday headline, event or sale details, date, venue or website, gift or discount note, festive visual style, and clear RSVP or shop CTA.",
    promptExamples: [
      {
        title: "Christmas sale flyer",
        prompt:
          "Create a Christmas sale flyer with gift-ready headline, discount, featured products, sale dates, coupon code, store or website, and shop-now CTA."
      },
      {
        title: "Church Christmas event",
        prompt:
          "Create a church Christmas event flyer with service or concert title, date, time, church name, address, family-friendly note, and attend CTA."
      },
      {
        title: "Christmas party flyer",
        prompt:
          "Create a Christmas party flyer with party name, date, venue, dress code, RSVP contact, festive visuals, and join-us CTA."
      }
    ],
    copyChecklist: ["Christmas event or offer", "Date and venue", "Gift or discount detail", "Contact or RSVP", "Holiday CTA"],
    formatTips: ["Make date and offer readable", "Use festive visuals with clear text space", "Create social and print versions separately"],
    faq: [
      {
        question: "What should a Christmas flyer include?",
        answer:
          "Include the event or offer, date, time, venue or website, gift or discount detail, RSVP or order method, and one holiday CTA."
      },
      {
        question: "Can I make Christmas church flyers?",
        answer:
          "Yes. Add the service, concert, outreach, or program title, church name, date, time, address, audience note, and attend CTA."
      },
      {
        question: "What format works for Christmas flyers?",
        answer:
          "Use 4:5 for social feeds, 9:16 for stories, and letter or A4 for printable church, school, or retail flyers."
      }
    ],
    related: ["holiday-flyer-maker", "church-flyer-maker", "sale-flyer-maker", "party-flyer-maker"]
  },
  {
    slug: "easter-flyer-maker",
    categorySlug: "easter-flyers",
    label: "Easter Flyer Maker",
    shortLabel: "Easter flyer",
    title: "Easter Flyer Maker for Church Events, Egg Hunts, and Promotions",
    description:
      "Create Easter flyers for church services, egg hunts, brunch specials, school events, community activities, and spring promotions.",
    h1: "Easter flyer maker for church events, egg hunts, and promotions",
    lede:
      "Make an Easter flyer that makes the event title, date, venue, family details, RSVP or registration method, and spring CTA clear.",
    primaryKeyword: "easter flyer maker",
    supportingKeywords: ["easter flyer", "easter flyer design", "easter flyer templates", "easter flyer design for church", "easter poster maker"],
    imageKeywords: ["Easter", "church", "spring", "egg hunt", "brunch", "family"],
    audience: "Churches, schools, restaurants, community groups, family event organizers, and local businesses.",
    searchIntent: "Find an Easter flyer template or create a church, family event, brunch, or spring promotion flyer.",
    ctaLabel: "Create an Easter flyer",
    primaryPrompt:
      "Create an Easter flyer with event title, date, time, venue, family-friendly details, RSVP or registration contact, spring visual style, and clear attend CTA.",
    promptExamples: [
      {
        title: "Church Easter flyer",
        prompt:
          "Create a church Easter flyer with service title, date, time, church name, address, family invite note, worship or brunch detail, and attend CTA."
      },
      {
        title: "Easter egg hunt flyer",
        prompt:
          "Create an Easter egg hunt flyer with event name, age range, date, time, park or venue, registration note, organizer contact, and family-friendly spring visuals."
      },
      {
        title: "Easter brunch flyer",
        prompt:
          "Create an Easter brunch flyer with restaurant name, date, reservation hours, menu highlight, address, phone number, and reserve-a-table CTA."
      }
    ],
    copyChecklist: ["Easter event", "Date and venue", "Audience or age range", "RSVP or registration", "Attend CTA"],
    formatTips: ["Use family-friendly contrast", "Keep date and location prominent", "Separate church, brunch, or egg hunt details clearly"],
    faq: [
      {
        question: "What should an Easter flyer include?",
        answer:
          "Include the event name, date, time, venue, family or age details, RSVP or registration method, organizer contact, and CTA."
      },
      {
        question: "Can I make Easter church flyers?",
        answer:
          "Yes. Add the service name, church name, date, time, address, worship or brunch details, and a welcoming CTA."
      },
      {
        question: "What format works for Easter flyers?",
        answer:
          "Use 4:5 for social posts and letter or A4 for church bulletins, school handouts, and community boards."
      }
    ],
    related: ["church-flyer-maker", "holiday-flyer-maker", "event-flyer-maker", "school-flyer-maker"]
  },
  {
    slug: "summer-camp-flyer-maker",
    categorySlug: "summer-camp-flyers",
    label: "Summer Camp Flyer Maker",
    shortLabel: "summer camp flyer",
    title: "Summer Camp Flyer Maker for Kids Programs and Registrations",
    description:
      "Create summer camp flyers for kids programs, school camps, sports camps, art camps, registration deadlines, schedules, and parent handouts.",
    h1: "Summer camp flyer maker for kids programs and registrations",
    lede:
      "Make a summer camp flyer that explains the camp theme, age range, dates, location, activities, price or deadline, and registration CTA.",
    primaryKeyword: "summer camp flyer design",
    supportingKeywords: ["summer camp flyer", "summer camp flyer templates", "summer camp flyer examples", "summer camp poster maker", "kids summer camp flyer design"],
    imageKeywords: ["summer camp", "kids", "school", "sports", "art camp", "registration"],
    audience: "Schools, camps, coaches, teachers, churches, community centers, activity providers, and parent groups.",
    searchIntent: "Find summer camp flyer design ideas or create a registration flyer for a kids camp or seasonal program.",
    ctaLabel: "Create a summer camp flyer",
    primaryPrompt:
      "Create a summer camp flyer with camp name, age range, dates, location, activities, price or deadline, parent contact, and register-now CTA.",
    promptExamples: [
      {
        title: "Kids summer camp flyer",
        prompt:
          "Create a kids summer camp flyer with camp name, age range, dates, daily schedule note, activity list, location, parent contact, and register-now CTA."
      },
      {
        title: "Sports camp flyer",
        prompt:
          "Create a sports summer camp flyer with sport, age groups, dates, coach name, location, fee, registration deadline, and sign-up CTA."
      },
      {
        title: "Art camp flyer",
        prompt:
          "Create a summer art camp flyer with theme, age range, dates, materials note, instructor, location, price, and reserve-a-spot CTA."
      }
    ],
    copyChecklist: ["Camp name", "Age range", "Dates and location", "Activities", "Registration CTA"],
    formatTips: ["Write for parents first", "Make age range and dates prominent", "Use playful visuals without hiding logistics"],
    faq: [
      {
        question: "What should a summer camp flyer include?",
        answer:
          "Include the camp name, age range, dates, times, location, activities, price or deadline, parent contact, and registration CTA."
      },
      {
        question: "Can I make kids summer camp flyers?",
        answer:
          "Yes. Add age range, activity list, safety or supervision details if needed, schedule, contact details, and a parent-friendly CTA."
      },
      {
        question: "What format works for summer camp flyers?",
        answer:
          "Use letter or A4 for school handouts and 4:5 or 9:16 for parent groups and social promotion."
      }
    ],
    related: ["school-flyer-maker", "sports-registration-flyer-maker", "class-flyer-maker", "daycare-flyer-maker"]
  },
  {
    slug: "class-flyer-maker",
    categorySlug: "class-flyers",
    label: "Class Flyer Maker",
    shortLabel: "class flyer",
    title: "Class Flyer Maker for Courses, Workshops, and Signups",
    description:
      "Create class flyers for tutoring, workshops, lessons, online courses, school programs, coaching sessions, schedules, and registrations.",
    h1: "Class flyer maker for courses, workshops, and signups",
    lede:
      "Make a class flyer that explains the topic, audience, instructor, schedule, location or online format, price, and signup CTA.",
    primaryKeyword: "class flyer design",
    supportingKeywords: ["class flyer", "class flyer templates", "class poster maker", "class flyer maker", "class flyer design sri lanka"],
    imageKeywords: ["class", "course", "workshop", "tutor", "training", "registration"],
    audience: "Teachers, tutors, coaches, course creators, training teams, schools, studios, and community educators.",
    searchIntent: "Find class flyer designs or create a signup flyer for a course, lesson, workshop, or training session.",
    ctaLabel: "Create a class flyer",
    primaryPrompt:
      "Create a class flyer with class title, audience, instructor, schedule, location or online format, price, outcomes, contact details, and sign-up CTA.",
    promptExamples: [
      {
        title: "Tutoring class flyer",
        prompt:
          "Create a tutoring class flyer with subject, grade level, tutor name, schedule, location or online option, price note, phone number, and enroll CTA."
      },
      {
        title: "Workshop class flyer",
        prompt:
          "Create a workshop class flyer with topic, instructor, date, time, venue, learning outcomes, limited seats, and register-now CTA."
      },
      {
        title: "Online class flyer",
        prompt:
          "Create an online class flyer with course title, audience, platform note, start date, schedule, outcomes, website, and sign-up CTA."
      }
    ],
    copyChecklist: ["Class topic", "Audience", "Instructor", "Schedule", "Signup CTA"],
    formatTips: ["Lead with the outcome", "Keep schedule and price easy to scan", "Use QR code or website space for registration"],
    faq: [
      {
        question: "What should a class flyer include?",
        answer:
          "Include the class title, audience, instructor, schedule, location or online format, price if needed, outcomes, contact details, and signup CTA."
      },
      {
        question: "Can I make tutoring class flyers?",
        answer:
          "Yes. Add subject, grade level, tutor name, schedule, pricing note, contact details, and enroll CTA."
      },
      {
        question: "What format works for class flyers?",
        answer:
          "Use 4:5 for social posts, 9:16 for stories, and letter or A4 for school boards and local handouts."
      }
    ],
    related: ["workshop-flyer-maker", "tutor-flyer-maker", "school-flyer-maker", "dance-flyer-maker"]
  },
  {
    slug: "black-friday-flyer-maker",
    categorySlug: "black-friday-flyers",
    label: "Black Friday Flyer Maker",
    shortLabel: "Black Friday flyer",
    title: "Black Friday Flyer Maker for Sales, Deals, and Retail Promotions",
    description:
      "Create Black Friday flyers for flash sales, retail discounts, online offers, doorbusters, product promos, and holiday shopping campaigns.",
    h1: "Black Friday flyer maker for sales, deals, and retail promotions",
    lede:
      "Make a Black Friday flyer that puts the discount, deadline, featured products, coupon code, store or website, and shop-now CTA front and center.",
    primaryKeyword: "black friday flyer maker",
    supportingKeywords: ["black friday flyer", "black friday flyer template", "black friday flyer design", "black friday sale flyer", "black friday ad maker"],
    imageKeywords: ["Black Friday", "sale", "discount", "retail", "deal", "shopping"],
    audience: "Retail shops, ecommerce brands, local businesses, product sellers, restaurants, salons, and service businesses running seasonal offers.",
    searchIntent: "Find a Black Friday flyer template or create a holiday sale promotion with clear offer hierarchy.",
    ctaLabel: "Create a Black Friday flyer",
    primaryPrompt:
      "Create a Black Friday flyer with biggest discount headline, featured products, sale dates, coupon code, store or website, urgency badge, and shop-now CTA.",
    promptExamples: [
      {
        title: "Retail Black Friday flyer",
        prompt:
          "Create a Black Friday retail flyer with 50% off headline, featured products, sale dates, store address, website, coupon code, and shop-now CTA."
      },
      {
        title: "Ecommerce sale flyer",
        prompt:
          "Create an ecommerce Black Friday flyer with online-only discount, product hero image, coupon code, countdown urgency, website URL, and buy-now CTA."
      },
      {
        title: "Local service sale flyer",
        prompt:
          "Create a Black Friday local service flyer with limited-time package discount, booking deadline, phone number, website, and schedule-now CTA."
      }
    ],
    copyChecklist: ["Discount", "Deadline", "Product or service", "Coupon or website", "Shop CTA"],
    formatTips: ["Make the discount the largest text", "Keep sale dates visible", "Use high contrast without making the offer hard to read"],
    faq: [
      {
        question: "What should a Black Friday flyer include?",
        answer:
          "Include the main discount, sale dates, featured products or services, coupon code or website, store details if needed, and shop-now CTA."
      },
      {
        question: "Can I make online Black Friday flyers?",
        answer:
          "Yes. Add the website URL, coupon code, product hero, sale deadline, and a clear buy-now CTA."
      },
      {
        question: "What design works for Black Friday flyers?",
        answer:
          "High contrast works well, but the discount, dates, and CTA should stay readable before decoration."
      }
    ],
    related: ["sale-flyer-maker", "business-flyer-maker", "grand-opening-flyer-maker", "restaurant-flyer-maker"]
  },
  {
    slug: "music-flyer-maker",
    categorySlug: "music-flyers",
    label: "Music Flyer Maker",
    shortLabel: "music flyer",
    title: "Music Flyer Maker for Shows, Releases, and Artist Promos",
    description:
      "Create music flyers for live shows, listening parties, release events, DJ nights, playlists, and artist promotions with AI prompt examples.",
    h1: "Music flyer maker for shows, releases, and artist promos",
    lede:
      "Make a music flyer that matches the sound while keeping the artist, date, venue, release details, ticket link, and CTA readable.",
    primaryKeyword: "music flyer maker",
    supportingKeywords: ["music flyer", "music flyer design", "music poster maker", "band flyer maker", "gig flyer maker"],
    imageKeywords: ["music", "concert", "band", "dj", "artist", "stage", "release"],
    audience: "Artists, bands, DJs, venues, labels, promoters, and creators announcing music events or releases.",
    searchIntent: "Find a music flyer maker, music poster maker, or quick prompt for a show, release, or artist promo.",
    ctaLabel: "Create a music flyer",
    primaryPrompt:
      "Create a music flyer with artist name, event or release title, date, venue or streaming CTA, genre mood, lineup or feature note, social handle, and strong music-poster visual style.",
    promptExamples: [
      {
        title: "Release party flyer",
        prompt:
          "Create a music release party flyer with artist name, release title, date, venue, guest performers, RSVP link, genre mood, and cinematic music artwork style."
      },
      {
        title: "Artist promo flyer",
        prompt:
          "Create an artist promo flyer with artist name, new single title, streaming CTA, social handle, release date, and cover-art inspired square layout."
      },
      {
        title: "DJ music flyer",
        prompt:
          "Create a DJ music flyer with DJ name, event title, date, club venue, guest list CTA, music style, and bold neon nightlife energy."
      }
    ],
    copyChecklist: ["Artist or event name", "Date or release timing", "Venue or platform", "Genre mood", "Ticket or streaming CTA"],
    formatTips: ["Match the visual style to the genre", "Keep artist and date readable", "Use square or 4:5 for music promo posts"],
    faq: [
      {
        question: "What should a music flyer include?",
        answer:
          "Include the artist or event name, release or show details, date, venue or platform, genre mood, ticket or streaming CTA, and social handle."
      },
      {
        question: "Can I make flyers for music releases?",
        answer:
          "Yes. Add the release title, artist name, release date, platform CTA, cover-art direction, and any featured performers."
      },
      {
        question: "Is this different from a concert flyer?",
        answer:
          "Yes. Concert flyers focus on live show details, while music flyers can also cover releases, listening parties, playlist promos, and artist announcements."
      }
    ],
    related: ["concert-flyer-maker", "band-flyer-maker", "gig-flyer-maker", "club-flyer-maker"]
  },
  {
    slug: "band-flyer-maker",
    categorySlug: "music-flyers",
    label: "Band Flyer Maker",
    shortLabel: "band flyer",
    title: "Band Flyer Maker for Shows, Tours, and Live Music Promos",
    description:
      "Create band flyers for live shows, small tours, album nights, local venues, and music promos with AI prompts and flyer copy guidance.",
    h1: "Band flyer maker for shows, tours, and live music promos",
    lede:
      "Make a band flyer that puts the band name, lineup, date, venue, ticket details, door time, and sound of the show in one clear layout.",
    primaryKeyword: "band flyer maker",
    supportingKeywords: ["band flyer", "band flyer maker free", "band flyer design", "band flyer templates", "concert flyer maker"],
    imageKeywords: ["band", "music", "concert", "live music", "stage", "gig", "tour"],
    audience: "Bands, venue promoters, local music organizers, artists, and managers promoting live shows.",
    searchIntent: "Find a band flyer maker or band flyer template for a show, tour date, or live music announcement.",
    ctaLabel: "Create a band flyer",
    primaryPrompt:
      "Create a band flyer with band name, supporting acts, date, venue, door time, ticket price or link, age note, social handle, and gritty live music poster style.",
    promptExamples: [
      {
        title: "Local band show flyer",
        prompt:
          "Create a local band show flyer with headliner, supporting bands, date, venue, doors time, ticket price, age note, and gritty poster-style artwork."
      },
      {
        title: "Tour date flyer",
        prompt:
          "Create a band tour date flyer with band name, city, venue, date, ticket link, support act, tour name, and bold music poster hierarchy."
      },
      {
        title: "Album night flyer",
        prompt:
          "Create a band album night flyer with album title, band name, venue, date, guest acts, RSVP or ticket CTA, and cover-art inspired style."
      }
    ],
    copyChecklist: ["Band name", "Lineup", "Date and venue", "Door time", "Ticket CTA"],
    formatTips: ["Make the band name the hero", "Keep venue and date together", "Use high contrast for small social previews"],
    faq: [
      {
        question: "What should a band flyer include?",
        answer:
          "Include the band name, supporting acts, date, venue, doors time, ticket details, age note, social handle, and CTA."
      },
      {
        question: "Can I make tour and album flyers?",
        answer:
          "Yes. Add the tour name or album title, city, venue, date, ticket link, and a visual direction that matches the music."
      },
      {
        question: "Should I use a poster or flyer format for bands?",
        answer:
          "Use 4:5 or square for social promotion, and a print poster or letter-size layout when the flyer will be posted at venues."
      }
    ],
    related: ["music-flyer-maker", "gig-flyer-maker", "concert-flyer-maker", "club-flyer-maker"]
  },
  {
    slug: "gig-flyer-maker",
    categorySlug: "concert-flyers",
    label: "Gig Flyer Maker",
    shortLabel: "gig flyer",
    title: "Gig Flyer Maker for Local Shows, Bands, and Venues",
    description:
      "Create gig flyers for local shows, open mics, band nights, DJ sets, and venue promos with AI prompt examples and copy checklists.",
    h1: "Gig flyer maker for local shows, bands, and venues",
    lede:
      "Make a gig flyer that gets the performer, venue, date, door time, ticket note, and show vibe across quickly.",
    primaryKeyword: "gig flyer maker",
    supportingKeywords: ["gig flyer", "gig flyer templates", "gig flyer design", "gig poster maker", "band flyer maker"],
    imageKeywords: ["gig", "concert", "band", "venue", "music", "open mic", "stage"],
    audience: "Local musicians, venues, promoters, open mic hosts, DJs, and event teams promoting live performances.",
    searchIntent: "Find a gig flyer maker or gig poster template for a local live music event.",
    ctaLabel: "Create a gig flyer",
    primaryPrompt:
      "Create a gig flyer with performer name, support acts, date, venue, door time, ticket price, age note, social handle, and energetic local music poster style.",
    promptExamples: [
      {
        title: "Local gig flyer",
        prompt:
          "Create a local gig flyer with performer name, support acts, venue, date, door time, ticket price, age note, and bold music-poster layout."
      },
      {
        title: "Open mic flyer",
        prompt:
          "Create an open mic gig flyer with host name, date, venue, sign-up time, performance slots, contact, and welcoming live music style."
      },
      {
        title: "Venue night flyer",
        prompt:
          "Create a venue gig flyer with lineup, date, door time, address, ticket link, drink special note, and high-energy stage lighting."
      }
    ],
    copyChecklist: ["Performer or lineup", "Date", "Venue", "Door time", "Ticket or sign-up CTA"],
    formatTips: ["Keep date and venue near the headline", "Use poster-style hierarchy", "Make ticket details readable on mobile"],
    faq: [
      {
        question: "What should a gig flyer include?",
        answer:
          "Include performer or lineup, date, venue, door time, ticket price or sign-up details, age note if needed, and CTA."
      },
      {
        question: "Can I make open mic flyers?",
        answer:
          "Yes. Add the host, sign-up time, performance rules, venue, contact details, and a clear participate or attend CTA."
      },
      {
        question: "How is a gig flyer different from a concert flyer?",
        answer:
          "Gig flyers often target smaller local shows and venue nights, so the performer, date, venue, and door details need to be very direct."
      }
    ],
    related: ["concert-flyer-maker", "band-flyer-maker", "music-flyer-maker", "club-flyer-maker"]
  },
  {
    slug: "health-flyer-maker",
    categorySlug: "health-flyers",
    label: "Health Flyer Maker",
    shortLabel: "health flyer",
    title: "Health Flyer Maker for Clinics, Fairs, and Wellness Events",
    description:
      "Create health flyers for clinics, wellness fairs, screenings, awareness events, fitness programs, and community health campaigns.",
    h1: "Health flyer maker for clinics, fairs, and wellness events",
    lede:
      "Make a health flyer that keeps the topic, audience, date, location, provider, contact details, and action step clear and trustworthy.",
    primaryKeyword: "health flyer design",
    supportingKeywords: ["health flyer", "health flyer templates", "health poster maker", "wellness flyer", "clinic flyer"],
    imageKeywords: ["health", "wellness", "clinic", "screening", "community", "medical", "fitness"],
    audience: "Clinics, wellness teams, community organizers, schools, nonprofits, gyms, and healthcare marketers.",
    searchIntent: "Find health flyer design ideas, templates, or a fast way to make a clinic or wellness event flyer.",
    ctaLabel: "Create a health flyer",
    primaryPrompt:
      "Create a health flyer with wellness topic, audience, event date, location, provider or organizer, contact details, QR code space, and clear register or learn-more CTA.",
    promptExamples: [
      {
        title: "Health fair flyer",
        prompt:
          "Create a health fair flyer with event name, date, time, location, free screening list, organizer contact, QR code space, and family-friendly community style."
      },
      {
        title: "Clinic service flyer",
        prompt:
          "Create a clinic service flyer with service headline, patient audience, appointment details, phone number, address, provider note, and book-now CTA."
      },
      {
        title: "Wellness workshop flyer",
        prompt:
          "Create a wellness workshop flyer with topic, instructor, date, venue, outcomes, registration link, and calm trustworthy visual style."
      }
    ],
    copyChecklist: ["Health topic", "Audience", "Date or appointment detail", "Location", "Contact or registration CTA"],
    formatTips: ["Use clear plain language", "Keep contact details prominent", "Avoid decorative text that could obscure health instructions"],
    faq: [
      {
        question: "What should a health flyer include?",
        answer:
          "Include the health topic, intended audience, date or appointment details, location, organizer or provider, contact information, and CTA."
      },
      {
        question: "Can I make clinic and wellness event flyers?",
        answer:
          "Yes. Add the service or event, eligibility notes, date, location, provider, phone number, website, and registration details."
      },
      {
        question: "What tone works best for health flyers?",
        answer:
          "Use clear, trustworthy language and readable hierarchy so instructions, contact details, and action steps are not lost."
      }
    ],
    related: ["fitness-flyer-maker", "volunteer-flyer-maker", "psa-flyer-maker", "event-flyer-maker"]
  },
  {
    slug: "volunteer-flyer-maker",
    categorySlug: "volunteer-flyers",
    label: "Volunteer Flyer Maker",
    shortLabel: "volunteer flyer",
    title: "Volunteer Flyer Maker for Recruiting Helpers and Community Teams",
    description:
      "Create volunteer flyers for nonprofit events, school programs, community cleanups, donation drives, and cause campaigns with AI prompts.",
    h1: "Volunteer flyer maker for recruiting helpers and community teams",
    lede:
      "Make a volunteer flyer that explains the cause, role, date, location, requirements, contact person, and sign-up CTA in plain language.",
    primaryKeyword: "volunteer flyer templates",
    supportingKeywords: ["volunteer flyer", "volunteer flyer design", "volunteer flyer examples", "volunteer recruitment flyer", "community flyer"],
    imageKeywords: ["volunteer", "community", "charity", "fundraiser", "school", "cleanup", "cause"],
    audience: "Nonprofits, schools, churches, local groups, event organizers, and community teams recruiting volunteers.",
    searchIntent: "Find volunteer flyer templates, examples, or a fast way to create a volunteer recruitment flyer.",
    ctaLabel: "Create a volunteer flyer",
    primaryPrompt:
      "Create a volunteer flyer with cause headline, volunteer role, date, location, time commitment, requirements, organizer contact, QR code space, and sign-up CTA.",
    promptExamples: [
      {
        title: "Community cleanup flyer",
        prompt:
          "Create a volunteer flyer for a community cleanup with cause headline, date, meeting location, shift times, what to bring, organizer contact, and sign-up CTA."
      },
      {
        title: "Nonprofit event volunteer flyer",
        prompt:
          "Create a nonprofit volunteer flyer with event name, roles needed, date, venue, time commitment, contact person, QR code space, and help-us CTA."
      },
      {
        title: "School volunteer flyer",
        prompt:
          "Create a school volunteer flyer with program name, parent volunteer roles, date, location, background check note, contact email, and sign-up CTA."
      }
    ],
    copyChecklist: ["Cause or event", "Volunteer role", "Date and location", "Requirements", "Sign-up CTA"],
    formatTips: ["Make the role specific", "Put contact and QR code together", "Keep requirements short and visible"],
    faq: [
      {
        question: "What should a volunteer flyer include?",
        answer:
          "Include the cause or event, volunteer role, date, location, shift or time commitment, requirements, organizer contact, and sign-up CTA."
      },
      {
        question: "Can I make volunteer recruitment flyers?",
        answer:
          "Yes. Add the roles needed, who can help, when and where to show up, contact details, and any required form or QR code."
      },
      {
        question: "What makes a volunteer flyer effective?",
        answer:
          "Be specific about the role and next step. People should understand who is needed, why it matters, and how to sign up."
      }
    ],
    related: ["charity-flyer-maker", "fundraiser-flyer-maker", "health-flyer-maker", "food-drive-flyer-maker"]
  },
  {
    slug: "art-flyer-maker",
    categorySlug: "art-flyers",
    label: "Art Flyer Maker",
    shortLabel: "art flyer",
    title: "Art Flyer Maker for Exhibits, Classes, and Creative Events",
    description:
      "Create art flyers for gallery shows, exhibitions, art classes, open studios, creative workshops, and artist promos with AI prompts.",
    h1: "Art flyer maker for exhibits, classes, and creative events",
    lede:
      "Make an art flyer that lets the artwork or creative style lead while keeping the event title, date, venue, artist, and RSVP clear.",
    primaryKeyword: "art flyer design",
    supportingKeywords: ["art flyer", "art flyer templates", "art poster maker", "artist poster maker", "art event flyer"],
    imageKeywords: ["art", "gallery", "artist", "exhibition", "creative", "workshop", "class"],
    audience: "Artists, galleries, studios, art teachers, workshop hosts, creative communities, and event organizers.",
    searchIntent: "Find art flyer design ideas, templates, or a fast way to create an exhibit, class, or artist promo flyer.",
    ctaLabel: "Create an art flyer",
    primaryPrompt:
      "Create an art flyer with exhibit or class title, artist name, date, venue, RSVP or registration link, visual style direction, and clean creative hierarchy.",
    promptExamples: [
      {
        title: "Gallery exhibit flyer",
        prompt:
          "Create an art gallery exhibit flyer with show title, artist name, opening date, venue, RSVP link, curator note, and elegant gallery-style layout."
      },
      {
        title: "Art class flyer",
        prompt:
          "Create an art class flyer with class topic, instructor, date, location, skill level, supplies note, registration link, and creative studio style."
      },
      {
        title: "Open studio flyer",
        prompt:
          "Create an open studio art flyer with artist names, date, studio location, featured work, RSVP or drop-in note, and warm creative community mood."
      }
    ],
    copyChecklist: ["Event or class title", "Artist or instructor", "Date", "Venue or studio", "RSVP or registration CTA"],
    formatTips: ["Let one artwork direction lead", "Keep date and venue readable", "Use enough margin for gallery-style layouts"],
    faq: [
      {
        question: "What should an art flyer include?",
        answer:
          "Include the exhibit, class, or event title, artist or instructor, date, venue, RSVP or registration details, and visual style direction."
      },
      {
        question: "Can I make art class and gallery flyers?",
        answer:
          "Yes. Add whether the flyer is for a class, exhibit, open studio, workshop, or artist promo, then include date, venue, and CTA."
      },
      {
        question: "What design works best for art flyers?",
        answer:
          "Use one strong artwork or style direction, then keep the title, artist, date, and venue readable instead of overloading the flyer."
      }
    ],
    related: ["workshop-flyer-maker", "class-flyer-maker", "music-flyer-maker", "event-flyer-maker"]
  },
  {
    slug: "modern-flyer-design",
    categorySlug: "modern-flyers",
    label: "Modern Flyer Design",
    shortLabel: "modern flyer",
    title: "Modern Flyer Design Ideas for Clean Promos and Events",
    description:
      "Create modern flyer designs for business promos, events, sales, services, announcements, and social campaigns with AI prompt examples.",
    h1: "Modern flyer design ideas for clean promos and events",
    lede:
      "Make a modern flyer that feels current without losing the headline, offer, date, contact details, and call to action.",
    primaryKeyword: "modern flyer design",
    supportingKeywords: ["modern flyer design inspiration", "modern flyer design ideas", "modern flyer templates", "modern flyer design 2026", "modern poster design"],
    imageKeywords: ["modern", "clean", "minimal", "business", "event", "promotion", "typography"],
    audience: "Creators, marketers, small businesses, event organizers, designers, and teams who want a clean flyer direction.",
    searchIntent: "Find modern flyer design ideas or quickly turn a clean visual direction into a generated flyer prompt.",
    ctaLabel: "Create a modern flyer",
    primaryPrompt:
      "Create a modern flyer with a clean headline, concise supporting copy, event or offer details, contact information, generous spacing, bold typography, and a clear CTA.",
    promptExamples: [
      {
        title: "Modern business flyer",
        prompt:
          "Create a modern business flyer with bold headline, three concise benefits, offer details, website, phone number, and clean editorial-style layout."
      },
      {
        title: "Modern event flyer",
        prompt:
          "Create a modern event flyer with event title, date, venue, host, registration link, minimal color palette, and strong readable typography."
      },
      {
        title: "Modern sale flyer",
        prompt:
          "Create a modern sale flyer with discount headline, featured product or service, deadline, store or website, and clean high-contrast CTA block."
      }
    ],
    copyChecklist: ["Headline", "Purpose or offer", "Date or deadline", "Contact details", "CTA"],
    formatTips: ["Use fewer visual elements", "Keep spacing generous", "Make the CTA stronger than decorative text"],
    faq: [
      {
        question: "What makes a flyer design modern?",
        answer:
          "Modern flyer design usually uses cleaner spacing, stronger typography, fewer competing elements, clear hierarchy, and a direct CTA."
      },
      {
        question: "Can I make modern business and event flyers?",
        answer:
          "Yes. Add the business, event, offer, audience, date or deadline, contact details, and preferred visual style."
      },
      {
        question: "Should a modern flyer be minimal?",
        answer:
          "It can be minimal, but the important part is readable hierarchy. The headline, details, and CTA should be easier to understand than the decoration."
      }
    ],
    related: ["business-flyer-maker", "marketing-flyer-maker", "advertising-flyer-maker", "event-flyer-maker"]
  },
  {
    slug: "election-flyer-maker",
    categorySlug: "election-flyers",
    label: "Election Flyer Maker",
    shortLabel: "election flyer",
    title: "Election Flyer Maker for Campaign Events and Voter Notices",
    description:
      "Create election flyers for candidate announcements, campaign events, voter reminders, town halls, and nonpartisan civic notices with AI prompts.",
    h1: "Election flyer maker for campaign events and voter notices",
    lede:
      "Make an election flyer that keeps the candidate or civic message, date, location, voting details, contact information, and CTA clear.",
    primaryKeyword: "election flyer maker",
    supportingKeywords: ["election flyer", "election poster maker", "election pamphlet maker", "campaign flyer", "voter reminder flyer"],
    imageKeywords: ["election", "campaign", "vote", "candidate", "civic", "town hall", "community"],
    audience: "Campaign teams, civic groups, student elections, community organizers, and teams making election-related notices.",
    searchIntent: "Find an election flyer maker or campaign flyer prompt for candidate events, voter reminders, or civic announcements.",
    ctaLabel: "Create an election flyer",
    primaryPrompt:
      "Create an election flyer with candidate or civic message, event or voting date, location, key details, contact information, website or QR code space, and a clear CTA.",
    promptExamples: [
      {
        title: "Candidate event flyer",
        prompt:
          "Create an election flyer for a candidate town hall with candidate name, event date, venue, time, RSVP link, contact details, and clear civic campaign layout."
      },
      {
        title: "Voter reminder flyer",
        prompt:
          "Create a voter reminder flyer with election date, polling information placeholder, registration deadline, website, QR code space, and neutral informational style."
      },
      {
        title: "Student election flyer",
        prompt:
          "Create a student election flyer with candidate name, role, three platform points, voting date, school location, social handle, and clear vote CTA."
      }
    ],
    copyChecklist: ["Candidate or civic message", "Date", "Location or voting detail", "Contact or website", "CTA"],
    formatTips: ["Keep voting details readable", "Use official dates and locations carefully", "Leave space for QR code or website verification"],
    faq: [
      {
        question: "What should an election flyer include?",
        answer:
          "Include the candidate or civic message, date, location or voting details, contact information, website or QR code, and a clear CTA."
      },
      {
        question: "Can I make voter reminder flyers?",
        answer:
          "Yes. Add the election date, registration deadline, polling information placeholder, official website, and a neutral informational layout."
      },
      {
        question: "What should I double-check before printing election flyers?",
        answer:
          "Check names, dates, polling details, disclaimers, contact information, and any local campaign or election notice requirements before printing."
      }
    ],
    related: ["volunteer-flyer-maker", "event-flyer-maker", "psa-flyer-maker", "marketing-flyer-maker"]
  },
  {
    slug: "free-flyer-maker",
    categorySlug: "modern-flyers",
    label: "Free Flyer Maker",
    shortLabel: "free flyer",
    title: "Free Flyer Maker for Events, Offers, and Local Promotions",
    description:
      "Use a free flyer maker workflow for event flyers, local service offers, sales, church notices, school announcements, and printable promotions.",
    h1: "Free flyer maker for events, offers, and local promotions",
    lede:
      "Start with a focused flyer brief, then open the AI Flyer Generator with the headline, details, audience, and format already organized.",
    primaryKeyword: "flyer maker free",
    supportingKeywords: ["free flyer maker", "flyer maker online free", "free flyer maker online", "flyer maker free ai"],
    imageKeywords: ["flyer", "modern", "event", "business", "promotion", "template"],
    audience: "Creators, small businesses, organizers, students, churches, and local teams that need a fast flyer without starting from a blank page.",
    searchIntent: "Find a free flyer maker or free online flyer maker that can turn event or offer details into a ready-to-edit design.",
    ctaLabel: "Create a free flyer",
    primaryPrompt:
      "Create a clean free flyer for [event or offer]. Include headline, date or offer details, location or service area, contact method, CTA, and a readable 4:5 layout with modern visual style.",
    promptExamples: [
      {
        title: "Free event flyer",
        prompt:
          "Create a free event flyer for [event name]. Include date, time, venue, host, ticket or RSVP CTA, and a bold social post layout with readable event details."
      },
      {
        title: "Free local service flyer",
        prompt:
          "Create a free local service flyer for [service]. Include offer, service area, phone number, website, trust cue, booking CTA, and clean print-friendly hierarchy."
      },
      {
        title: "Free community flyer",
        prompt:
          "Create a free community flyer for [announcement]. Include organizer, date, location, participation details, contact, and friendly neighborhood styling."
      }
    ],
    copyChecklist: ["Main headline", "Event or offer details", "Date or deadline", "Contact method", "CTA"],
    formatTips: ["Use 4:5 for social posts", "Use letter or A4 for printing", "Keep free template text easy to replace"],
    faq: [
      {
        question: "Can I make a flyer for free?",
        answer:
          "Yes. Use this page to prepare the flyer brief and open it in the AI Flyer Generator, then revise the text, layout, and format before exporting."
      },
      {
        question: "What should I put in a free flyer maker prompt?",
        answer:
          "Include the flyer type, headline, date or offer, location, contact details, CTA, audience, visual style, and final format."
      },
      {
        question: "Is this different from a template page?",
        answer:
          "This page starts from search intent and prompt structure. Template pages are better when you want to browse visual examples before generating."
      }
    ],
    related: ["online-flyer-maker", "ai-flyer-maker", "flyer-design-maker", "business-flyer-maker"]
  },
  {
    slug: "online-flyer-maker",
    categorySlug: "modern-flyers",
    label: "Online Flyer Maker",
    shortLabel: "online flyer",
    title: "Online Flyer Maker for Social, Print, and Local Campaigns",
    description:
      "Make online flyers for parties, business promotions, real estate listings, classes, fundraisers, and announcements with AI prompts and flyer examples.",
    h1: "Online flyer maker for social, print, and local campaigns",
    lede:
      "Use an online flyer maker when you need the same idea to work across social posts, stories, printable handouts, and shareable local promotions.",
    primaryKeyword: "flyer maker online",
    supportingKeywords: ["online flyer maker", "flyer maker online free", "flyer creator online", "make a flyer online"],
    imageKeywords: ["flyer", "online", "social", "print", "business", "event"],
    audience: "Marketers, small businesses, event hosts, educators, and community organizers creating flyers in a browser.",
    searchIntent: "Find an online flyer maker that can quickly create a shareable flyer for social or print without installing design software.",
    ctaLabel: "Create an online flyer",
    primaryPrompt:
      "Create an online flyer for [event, service, or offer]. Include the main headline, details, audience, CTA, brand colors, and both social-friendly spacing and print-readable text hierarchy.",
    promptExamples: [
      {
        title: "Online promo flyer",
        prompt:
          "Create an online promotion flyer for [business]. Include offer, dates, service area, website, phone number, CTA, and modern brand-ready layout."
      },
      {
        title: "Online event flyer",
        prompt:
          "Create an online event flyer with event name, date, time, location, speaker or lineup, registration link, and a polished 4:5 social layout."
      },
      {
        title: "Printable online flyer",
        prompt:
          "Create a printable online flyer for [announcement]. Use letter-size layout, large headline, detail block, QR code space, contact footer, and high contrast."
      }
    ],
    copyChecklist: ["Flyer goal", "Headline", "Details", "Brand or style", "CTA"],
    formatTips: ["Choose social or print before generating", "Use high contrast for phone screenshots", "Leave QR code space when needed"],
    faq: [
      {
        question: "What is an online flyer maker best for?",
        answer:
          "It is best for quickly turning an event, offer, class, sale, or announcement into a flyer you can share digitally or prepare for print."
      },
      {
        question: "Can online flyer designs work for printing?",
        answer:
          "Yes, but mention letter or A4 format, readable margins, and high contrast in the prompt before generating."
      },
      {
        question: "Does the online flyer maker page generate directly?",
        answer:
          "This SEO page prepares the brief and sends the prompt to the AI Flyer Generator, where the design is generated and refined."
      }
    ],
    related: ["free-flyer-maker", "ai-flyer-maker", "flyer-design-maker", "event-flyer-maker"]
  },
  {
    slug: "ai-flyer-maker",
    categorySlug: "modern-flyers",
    label: "AI Flyer Maker",
    shortLabel: "AI flyer",
    title: "AI Flyer Maker for Fast Event and Business Designs",
    description:
      "Use an AI flyer maker to create event flyers, business flyers, party flyers, real estate flyers, and local promotions from structured prompts.",
    h1: "AI flyer maker for fast event and business designs",
    lede:
      "AI flyer results improve when the prompt names the flyer type, required text, format, audience, visual style, and main CTA before generation starts.",
    primaryKeyword: "flyer maker ai",
    supportingKeywords: ["ai flyer maker", "ai flyer generator", "flyer maker free ai", "ai flyer design"],
    imageKeywords: ["ai flyer", "flyer", "modern", "business", "event", "design"],
    audience: "Creators and teams that want AI to draft the first flyer layout while keeping event details, offers, and calls to action readable.",
    searchIntent: "Find an AI flyer maker that can turn a short brief into a designed flyer and still preserve the important text details.",
    ctaLabel: "Create an AI flyer",
    primaryPrompt:
      "Create an AI flyer for [flyer type]. Include exact headline, required details, audience, visual style, CTA, and final format. Make the headline and key details readable on mobile.",
    promptExamples: [
      {
        title: "AI event flyer",
        prompt:
          "Create an AI event flyer for [event name]. Include exact title, date, time, venue, registration CTA, audience, and energetic but readable visual direction."
      },
      {
        title: "AI business flyer",
        prompt:
          "Create an AI business flyer for [service or product]. Include offer, benefit, service area, trust point, contact details, CTA, and clean modern layout."
      },
      {
        title: "AI flyer redesign",
        prompt:
          "Create a cleaner AI flyer redesign for [existing flyer idea]. Keep the headline, date, location, and CTA prominent while simplifying the background."
      }
    ],
    copyChecklist: ["Flyer type", "Exact headline", "Required details", "Audience", "CTA"],
    formatTips: ["Quote exact text in the prompt", "Ask for readable hierarchy", "Revise one text or layout issue at a time"],
    faq: [
      {
        question: "How do I get better AI flyer results?",
        answer:
          "Name the flyer type, exact text, audience, style, format, and hierarchy. AI flyer prompts work better when the required copy is explicit."
      },
      {
        question: "Can an AI flyer maker handle business and event flyers?",
        answer:
          "Yes. Use the related pages for event, business, party, real estate, or sale flyers when the search intent is more specific."
      },
      {
        question: "Should I use AI flyer maker or AI flyer generator?",
        answer:
          "Both searches can lead to the same workflow: prepare the flyer brief here, then generate and refine it in the AI Flyer Generator."
      }
    ],
    related: ["free-flyer-maker", "online-flyer-maker", "flyer-design-maker", "event-flyer-maker"]
  },
  {
    slug: "flyer-design-maker",
    categorySlug: "modern-flyers",
    label: "Flyer Design Maker",
    shortLabel: "flyer design",
    title: "Flyer Design Maker for Modern Layouts and Ideas",
    description:
      "Create flyer designs for business promotions, events, parties, real estate listings, classes, and campaigns with prompt-ready layout guidance.",
    h1: "Flyer design maker for modern layouts and ideas",
    lede:
      "Use this page when the search is less about a specific flyer type and more about making the layout, typography, image direction, and CTA feel polished.",
    primaryKeyword: "flyer design ai",
    supportingKeywords: ["flyer design", "flyer designer free", "flyer design ideas", "flyer design maker"],
    imageKeywords: ["flyer design", "modern", "layout", "typography", "business", "event"],
    audience: "Creators, marketers, and organizers who need flyer design ideas before choosing the exact event, business, or campaign page.",
    searchIntent: "Find flyer design ideas or an AI flyer design maker that can turn a rough concept into a polished flyer layout.",
    ctaLabel: "Create a flyer design",
    primaryPrompt:
      "Create a modern flyer design for [topic]. Use a clear headline, supporting detail block, CTA, image direction, strong typography, and balanced spacing for a polished 4:5 layout.",
    promptExamples: [
      {
        title: "Modern flyer design",
        prompt:
          "Create a modern flyer design for [topic] with large headline, clean grid, one hero image area, detail block, CTA button style, and restrained color palette."
      },
      {
        title: "Bold flyer design",
        prompt:
          "Create a bold flyer design with high-contrast typography, dynamic image crop, short headline, date or offer block, CTA, and social-ready format."
      },
      {
        title: "Minimal flyer design",
        prompt:
          "Create a minimal flyer design for [topic] with generous whitespace, elegant type, small supporting details, clear CTA, and print-friendly margins."
      }
    ],
    copyChecklist: ["Headline", "Visual direction", "Detail block", "CTA", "Final format"],
    formatTips: ["Use one type hierarchy", "Keep the CTA visible", "Choose a visual style before adding copy"],
    faq: [
      {
        question: "What makes a flyer design look professional?",
        answer:
          "A professional flyer has one clear headline, enough whitespace, readable details, consistent typography, and a CTA that is easy to find."
      },
      {
        question: "Can I use this page for flyer design ideas?",
        answer:
          "Yes. Start from the prompt examples, then move to a specific flyer maker page when the design needs event, business, real estate, or service-specific details."
      },
      {
        question: "Is flyer design different from flyer templates?",
        answer:
          "Flyer design focuses on layout and visual direction. Template pages are useful when you want to browse existing flyer examples first."
      }
    ],
    related: ["modern-flyer-design", "free-flyer-maker", "online-flyer-maker", "ai-flyer-maker"]
  },
  {
    slug: "flyer-creator",
    categorySlug: "modern-flyers",
    label: "Flyer Creator",
    shortLabel: "flyer creator",
    title: "Flyer Creator for Events, Business Offers, and Local Notices",
    description:
      "Use a flyer creator workflow to turn event details, service offers, announcements, and campaign ideas into generator-ready flyer prompts.",
    h1: "Flyer creator for events, business offers, and local notices",
    lede:
      "Use this flyer creator page when you know the message but need help turning it into a readable flyer brief, layout direction, and CTA.",
    primaryKeyword: "flyer creator",
    supportingKeywords: ["flyer creator free", "flyer creator ai", "flyer creator free online", "flyer creator online"],
    imageKeywords: ["flyer creator", "flyer", "modern", "event", "business", "announcement"],
    audience: "Creators, local teams, small businesses, students, and organizers turning rough flyer ideas into polished first drafts.",
    searchIntent: "Find a flyer creator that can organize a message, required details, audience, and visual style before generation.",
    ctaLabel: "Create a flyer",
    primaryPrompt:
      "Create a flyer for [event, offer, or announcement]. Include a clear headline, required details, audience, visual style, CTA, and final format with readable text hierarchy.",
    promptExamples: [
      {
        title: "Event flyer creator",
        prompt:
          "Create an event flyer for [event name]. Include date, time, location, host, registration or RSVP CTA, audience, and a polished 4:5 layout."
      },
      {
        title: "Business flyer creator",
        prompt:
          "Create a business flyer for [offer]. Include benefit, service area, price or promo, contact details, trust cue, CTA, and modern brand-friendly styling."
      },
      {
        title: "Announcement flyer creator",
        prompt:
          "Create an announcement flyer for [topic]. Include headline, key details, organizer, date or deadline, contact method, and a clean readable layout."
      }
    ],
    copyChecklist: ["Flyer goal", "Headline", "Required details", "Audience", "CTA"],
    formatTips: ["Start with message hierarchy", "Use 4:5 for social sharing", "Use letter or A4 for print distribution"],
    faq: [
      {
        question: "What is a flyer creator best for?",
        answer:
          "A flyer creator is best for turning a rough event, offer, service, or announcement idea into a clear flyer brief with headline, details, style, and CTA."
      },
      {
        question: "Can I use this as a free online flyer creator?",
        answer:
          "Yes. Prepare the brief here, then open the AI Flyer Generator with a structured prompt and revise the result."
      },
      {
        question: "How is flyer creator different from flyer maker?",
        answer:
          "The searches overlap. This page focuses on organizing the message and prompt before generation, while specific maker pages focus on a flyer type."
      }
    ],
    related: ["free-flyer-maker", "online-flyer-maker", "ai-flyer-maker", "flyer-design-maker"]
  },
  {
    slug: "free-flyer-generator",
    categorySlug: "modern-flyers",
    label: "Free Flyer Generator",
    shortLabel: "free flyer generator",
    title: "Free Flyer Generator for Online Flyer Drafts",
    description:
      "Use a free flyer generator workflow for event promos, local service flyers, sales, school notices, and social-ready flyer drafts.",
    h1: "Free flyer generator for online flyer drafts",
    lede:
      "Start with a structured prompt so the generated flyer keeps the headline, event details, contact information, and CTA readable.",
    primaryKeyword: "flyer generator free",
    supportingKeywords: ["free flyer generator", "flyer generator ai free", "flyer generator online free", "flyer generator online"],
    imageKeywords: ["free flyer generator", "flyer", "ai flyer", "online", "promotion", "event"],
    audience: "People searching for a fast free flyer generator for social posts, printable notices, and local promotions.",
    searchIntent: "Find a free flyer generator or online flyer generator that can create a first draft from event, offer, or announcement details.",
    ctaLabel: "Generate a free flyer",
    primaryPrompt:
      "Generate a flyer for [event or offer]. Include exact headline, required details, contact method, CTA, visual style, and a readable social or print layout.",
    promptExamples: [
      {
        title: "Free AI flyer draft",
        prompt:
          "Generate a free AI flyer draft for [event]. Include headline, date, time, venue, RSVP or ticket CTA, and high-contrast readable text."
      },
      {
        title: "Free business flyer draft",
        prompt:
          "Generate a business flyer for [service]. Include offer, service area, phone number, website, proof point, booking CTA, and clean local-service design."
      },
      {
        title: "Free printable flyer draft",
        prompt:
          "Generate a printable flyer for [announcement]. Use letter-size layout, large headline, detail block, QR code space, contact footer, and clear margins."
      }
    ],
    copyChecklist: ["Exact headline", "Required details", "Contact method", "Visual style", "CTA"],
    formatTips: ["Mention social or print format", "Keep the prompt text short", "Revise readability before decoration"],
    faq: [
      {
        question: "Can a free flyer generator make printable flyers?",
        answer:
          "Yes. Include letter or A4 format, readable margins, and high contrast in the prompt before generating."
      },
      {
        question: "What should I include before generating a flyer?",
        answer:
          "Include the headline, event or offer details, audience, contact method, CTA, final format, and visual style."
      },
      {
        question: "Is this the same as the AI Flyer Generator?",
        answer:
          "This SEO page prepares the free flyer generator brief. The actual flyer is generated and revised in the AI Flyer Generator."
      }
    ],
    related: ["free-flyer-maker", "ai-flyer-maker", "online-flyer-maker", "flyer-creator"]
  },
  {
    slug: "text-to-flyer-generator",
    categorySlug: "modern-flyers",
    label: "Text to Flyer Generator",
    shortLabel: "text to flyer",
    title: "Text to Flyer Generator for Prompt-Based Flyer Design",
    description:
      "Turn text into flyer prompts for events, local offers, classes, sales, and announcements with AI-ready copy structure and layout guidance.",
    h1: "Text to flyer generator for prompt-based flyer design",
    lede:
      "Use this page when you have the words for a flyer and need to turn them into a prompt that controls layout, hierarchy, style, and format.",
    primaryKeyword: "flyer generator from text",
    supportingKeywords: ["text to flyer generator", "flyer generator chatgpt", "make a flyer with ai", "make a flyer with chatgpt"],
    imageKeywords: ["text to flyer", "prompt", "ai flyer", "flyer generator", "layout", "typography"],
    audience: "Marketers, creators, students, and organizers who already have flyer copy and want AI to turn it into a designed flyer.",
    searchIntent: "Find a way to generate a flyer from text, a prompt, or ChatGPT-style copy while keeping the required wording readable.",
    ctaLabel: "Turn text into a flyer",
    primaryPrompt:
      "Turn this text into a flyer: [paste flyer text]. Create a clear headline, detail block, CTA, visual style, and final format while preserving the important wording.",
    promptExamples: [
      {
        title: "Paste text into a flyer",
        prompt:
          "Turn this flyer text into a polished 4:5 design: [paste text]. Preserve headline, date, location, contact, and CTA while improving layout hierarchy."
      },
      {
        title: "ChatGPT flyer prompt",
        prompt:
          "Create a flyer from this ChatGPT-style brief: [brief]. Use a strong headline, grouped details, CTA, modern visual style, and readable text space."
      },
      {
        title: "Text-heavy flyer cleanup",
        prompt:
          "Turn this long announcement into a flyer. Shorten the copy into headline, three detail bullets, contact footer, and one CTA while keeping the meaning."
      }
    ],
    copyChecklist: ["Source text", "Headline", "Details to preserve", "CTA", "Final format"],
    formatTips: ["Paste exact text in the prompt", "Ask the AI to group details", "Shorten long copy before generating"],
    faq: [
      {
        question: "Can I generate a flyer from text?",
        answer:
          "Yes. Paste the flyer text, identify the headline and CTA, and tell the generator which details must be preserved."
      },
      {
        question: "Can I use ChatGPT text for a flyer?",
        answer:
          "Yes. Use ChatGPT or any draft copy as source text, then convert it into a flyer prompt with layout and readability instructions."
      },
      {
        question: "How do I keep text readable in an AI flyer?",
        answer:
          "Keep the exact wording short, group details into sections, and revise the draft for headline size, contrast, and spacing before export."
      }
    ],
    related: ["ai-flyer-maker", "flyer-creator", "free-flyer-generator", "flyer-design-maker"]
  },
  {
    slug: "dj-flyer-maker",
    categorySlug: "music-flyers",
    label: "DJ Flyer Maker",
    shortLabel: "DJ flyer",
    title: "DJ Flyer Maker for Club Nights, Sets, and Music Events",
    description:
      "Create DJ flyers for club nights, guest sets, parties, tours, and music promos with AI prompt examples, lineup copy, and event-ready layout guidance.",
    h1: "DJ flyer maker for club nights, sets, and music events",
    lede:
      "Build a DJ flyer that makes the artist name, event title, date, venue, ticket link, age note, and nightlife mood easy to scan.",
    primaryKeyword: "dj flyer maker",
    supportingKeywords: ["dj flyer maker online", "dj flyer maker online free", "dj poster maker", "dj poster maker free"],
    imageKeywords: ["dj", "music", "club", "nightlife", "concert", "party"],
    audience: "DJs, promoters, clubs, venues, nightlife teams, and music event organizers.",
    searchIntent: "Find a DJ flyer maker or DJ poster maker for a club night, party, guest set, or music event announcement.",
    ctaLabel: "Create a DJ flyer",
    primaryPrompt:
      "Create a DJ flyer with DJ name, event title, date, time, venue, ticket or RSVP link, age note, music style, and high-energy nightclub layout.",
    promptExamples: [
      {
        title: "Club DJ night flyer",
        prompt:
          "Create a club DJ night flyer for [DJ name]. Include event title, date, venue, doors time, ticket link, age note, and neon nightlife lighting."
      },
      {
        title: "Guest DJ set flyer",
        prompt:
          "Create a guest DJ set flyer with headliner name, supporting lineup, venue, date, start time, cover charge, and premium club typography."
      },
      {
        title: "DJ party promo flyer",
        prompt:
          "Create a DJ party promo flyer with theme, DJ name, host, date, location, RSVP contact, dress code, and bold 4:5 social layout."
      }
    ],
    copyChecklist: ["DJ or lineup name", "Event title", "Date and time", "Venue", "Ticket or RSVP CTA"],
    formatTips: ["Use 4:5 for social posts", "Keep artist name and date dominant", "Use 9:16 for story promotion"],
    faq: [
      {
        question: "What should a DJ flyer include?",
        answer:
          "Include the DJ name, event title, lineup, date, time, venue, ticket link or RSVP, age note, dress code, and a clear CTA."
      },
      {
        question: "Can I make a DJ poster from this page?",
        answer:
          "Yes. Use the prompt examples and choose a print-friendly format when you need a DJ poster instead of a social flyer."
      },
      {
        question: "How do I make a DJ flyer look less generic?",
        answer:
          "Mention the music style, venue vibe, lighting direction, typography mood, and required event details before generating."
      }
    ],
    related: ["music-flyer-maker", "club-flyer-maker", "party-flyer-maker", "concert-flyer-maker"]
  },
  {
    slug: "lawn-care-flyer-maker",
    categorySlug: "landscaping-flyers",
    label: "Lawn Care Flyer Maker",
    shortLabel: "lawn care flyer",
    title: "Lawn Care Flyer Maker for Local Landscaping Offers",
    description:
      "Make lawn care flyers for mowing, seasonal cleanups, landscaping packages, and local service promotions with AI prompts and readable offer guidance.",
    h1: "Lawn care flyer maker for local landscaping offers",
    lede:
      "Create a lawn care flyer that makes the service area, offer, phone number, package details, and booking CTA easy for local customers to act on.",
    primaryKeyword: "lawn care flyers",
    supportingKeywords: ["lawn care flyer ideas", "lawn care flyer examples", "lawn care flyer template", "lawn care flyer design"],
    imageKeywords: ["lawn care", "landscaping", "local service", "mowing", "yard", "green"],
    audience: "Landscapers, lawn care teams, solo service providers, and local home service marketers.",
    searchIntent: "Find lawn care flyer ideas, templates, examples, or a fast way to create a local mowing and landscaping promotion.",
    ctaLabel: "Create a lawn care flyer",
    primaryPrompt:
      "Create a lawn care flyer with service name, mowing or landscaping offer, service area, phone number, seasonal package, trust cue, and clear booking CTA.",
    promptExamples: [
      {
        title: "Mowing service flyer",
        prompt:
          "Create a lawn mowing flyer with business name, weekly mowing offer, service area, phone number, first-service discount, and clean outdoor service design."
      },
      {
        title: "Seasonal cleanup flyer",
        prompt:
          "Create a seasonal lawn cleanup flyer with headline, services included, limited-time offer, neighborhood area, contact details, and booking CTA."
      },
      {
        title: "Landscaping package flyer",
        prompt:
          "Create a landscaping package flyer with lawn care, trimming, mulch, cleanup, before-and-after photo direction, phone number, and quote request CTA."
      }
    ],
    copyChecklist: ["Service name", "Offer or package", "Service area", "Phone or website", "Booking CTA"],
    formatTips: ["Use letter format for door hangers", "Keep phone number large", "Add before-and-after visual direction when useful"],
    faq: [
      {
        question: "What should a lawn care flyer include?",
        answer:
          "Include the service name, offer, service area, phone number or website, trust cue, seasonal package details, and booking CTA."
      },
      {
        question: "Can I make lawn mowing flyers?",
        answer:
          "Yes. Add the mowing schedule, neighborhood, starting price or offer, contact details, and whether the design should feel premium or friendly."
      },
      {
        question: "What format works best for lawn care flyers?",
        answer:
          "Use letter or A4 for local print distribution and 4:5 for social posts or neighborhood group promotions."
      }
    ],
    related: ["landscaping-flyer-maker", "business-flyer-maker", "pressure-washing-flyer-maker", "car-wash-flyer-maker"]
  },
  {
    slug: "job-fair-flyer-maker",
    categorySlug: "event-flyers",
    label: "Job Fair Flyer Maker",
    shortLabel: "job fair flyer",
    title: "Job Fair Flyer Maker for Hiring Events and Recruitment",
    description:
      "Create job fair flyers for hiring events, recruitment fairs, employer booths, and community career events with AI prompts and clear registration copy.",
    h1: "Job fair flyer maker for hiring events and recruitment",
    lede:
      "Build a job fair flyer that makes the hiring event, date, location, employer details, roles, registration CTA, and attendance requirements clear.",
    primaryKeyword: "job fair flyer",
    supportingKeywords: ["job fair flyer examples", "job fair flyer ideas", "job fair flyer template", "hiring fair flyer", "recruitment fair flyer"],
    imageKeywords: ["job fair", "hiring", "career", "recruitment", "event", "business"],
    audience: "Recruiters, schools, workforce teams, employers, community organizations, and event planners.",
    searchIntent: "Find a job fair flyer template, examples, or a fast way to create a hiring event announcement.",
    ctaLabel: "Create a job fair flyer",
    primaryPrompt:
      "Create a job fair flyer with event name, date, time, venue, participating employers, roles or industries, registration link, contact details, and professional event layout.",
    promptExamples: [
      {
        title: "Community job fair flyer",
        prompt:
          "Create a community job fair flyer with event name, date, location, employer list, industries hiring, registration CTA, and friendly professional style."
      },
      {
        title: "Employer hiring event flyer",
        prompt:
          "Create a hiring event flyer for [company]. Include roles, pay or benefits note, date, time, address, what to bring, and apply-now CTA."
      },
      {
        title: "Campus career fair flyer",
        prompt:
          "Create a campus career fair flyer with school name, date, location, employers attending, student audience, QR code space, and registration CTA."
      }
    ],
    copyChecklist: ["Event name", "Date and time", "Venue", "Employers or roles", "Registration CTA"],
    formatTips: ["Use QR code space", "Keep date and location prominent", "Group employer or role details into short bullets"],
    faq: [
      {
        question: "What should a job fair flyer include?",
        answer:
          "Include the event name, date, time, venue, participating employers or roles, audience, registration link, contact details, and what attendees should bring."
      },
      {
        question: "Can I make a hiring fair flyer?",
        answer:
          "Yes. Add hiring roles, employer name, pay or benefits note, application instructions, and a clear apply or register CTA."
      },
      {
        question: "What style works for recruitment flyers?",
        answer:
          "Use a professional layout with high-contrast date and location details, short role bullets, and enough space for a QR code or registration link."
      }
    ],
    related: ["event-flyer-maker", "business-flyer-maker", "hiring-flyer-maker", "school-flyer-maker"]
  },
  {
    slug: "car-show-flyer-maker",
    categorySlug: "event-flyers",
    label: "Car Show Flyer Maker",
    shortLabel: "car show flyer",
    title: "Car Show Flyer Maker for Auto Events and Meetups",
    description:
      "Create car show flyers for auto events, meetups, fundraisers, and local shows with AI prompt examples and event-ready detail guidance.",
    h1: "Car show flyer maker for auto events and meetups",
    lede:
      "Make a car show flyer that highlights the event name, date, location, registration details, entry fees, featured vehicles, and attendee CTA.",
    primaryKeyword: "car show flyer",
    supportingKeywords: ["car show flyer template", "car show flyer ideas", "car show flyer examples", "car show flyer design", "car show flyer maker"],
    imageKeywords: ["car show", "auto event", "cars", "meetup", "classic car", "fundraiser"],
    audience: "Auto clubs, car show organizers, local venues, fundraisers, and community event promoters.",
    searchIntent: "Find car show flyer ideas, templates, examples, or a maker for an auto event or local car meetup.",
    ctaLabel: "Create a car show flyer",
    primaryPrompt:
      "Create a car show flyer with event name, date, location, registration details, entry fee, featured vehicle style, sponsor space, contact info, and bold auto-event layout.",
    promptExamples: [
      {
        title: "Classic car show flyer",
        prompt:
          "Create a classic car show flyer with event name, date, venue, registration deadline, entry fee, awards note, sponsor space, and vintage auto styling."
      },
      {
        title: "Car meet flyer",
        prompt:
          "Create a car meet flyer with meetup title, date, time, parking location, featured vehicle style, rules note, social handle, and bold street-style layout."
      },
      {
        title: "Fundraiser car show flyer",
        prompt:
          "Create a fundraiser car show flyer with cause name, event date, location, registration CTA, donation note, vehicle categories, and family-friendly design."
      }
    ],
    copyChecklist: ["Event name", "Date and time", "Location", "Registration details", "Contact or CTA"],
    formatTips: ["Use wide photo direction for cars", "Keep date and location large", "Leave sponsor or QR code space"],
    faq: [
      {
        question: "What should a car show flyer include?",
        answer:
          "Include the car show name, date, time, location, registration details, entry fee, featured vehicle categories, sponsor space, contact details, and CTA."
      },
      {
        question: "Can I make a car meet flyer?",
        answer:
          "Yes. Add the meetup title, location, parking instructions, date, social handle, rules note, and visual style for the car scene."
      },
      {
        question: "What format works best for car show flyers?",
        answer:
          "Use 4:5 for social promotion and letter or A4 for printable flyers at local venues or auto shops."
      }
    ],
    related: ["event-flyer-maker", "car-detailing-flyer-maker", "fundraiser-flyer-maker", "business-flyer-maker"]
  },
  {
    slug: "graduation-flyer-maker",
    categorySlug: "graduation-flyers",
    label: "Graduation Flyer Maker",
    shortLabel: "graduation flyer",
    title: "Graduation Flyer Maker for Parties, Ceremonies, and Announcements",
    description:
      "Create graduation flyers for parties, ceremonies, senior events, photo shoots, and school announcements with AI prompt examples and readable event details.",
    h1: "Graduation flyer maker for parties, ceremonies, and announcements",
    lede:
      "Build a graduation flyer that makes the graduate name, school, class year, date, venue, RSVP, and celebration details easy to scan.",
    primaryKeyword: "graduation flyer",
    supportingKeywords: [
      "graduation party flyer",
      "graduation flyers",
      "graduation flyer design",
      "graduation flyer template",
      "graduation ceremony flyer"
    ],
    imageKeywords: ["graduation", "party", "school", "celebration", "event", "invitation"],
    audience: "Graduates, parents, schools, student groups, photographers, and event hosts planning graduation announcements.",
    searchIntent: "Find a graduation flyer, graduation party flyer, or ceremony announcement layout with editable details.",
    ctaLabel: "Create a graduation flyer",
    primaryPrompt:
      "Create a graduation flyer with graduate name, class year, school, party or ceremony title, date, time, venue, RSVP details, photo direction, and elegant readable layout.",
    promptExamples: [
      {
        title: "Graduation party flyer",
        prompt:
          "Create a graduation party flyer for [graduate name]. Include class year, school colors, date, time, venue, RSVP contact, dress note, and celebratory portrait layout."
      },
      {
        title: "Graduation ceremony flyer",
        prompt:
          "Create a graduation ceremony flyer with school name, ceremony title, date, venue, arrival instructions, ticket or RSVP note, and formal academic styling."
      },
      {
        title: "Graduation photoshoot flyer",
        prompt:
          "Create a graduation photoshoot flyer with photographer name, mini-session offer, dates, location, booking CTA, cap-and-gown visual direction, and clean pricing block."
      }
    ],
    copyChecklist: ["Graduate name", "Class year", "School or program", "Date and venue", "RSVP or booking CTA"],
    formatTips: ["Use school colors carefully", "Keep name and class year largest", "Use 4:5 for social invites and letter size for print"],
    faq: [
      {
        question: "What should a graduation flyer include?",
        answer:
          "Include the graduate name, class year, school or program, event title, date, time, venue, RSVP details, photo direction, and one clear CTA."
      },
      {
        question: "Can I make a graduation party flyer?",
        answer:
          "Yes. Add the party theme, date, venue, host, RSVP contact, dress code, and whether the flyer should feel formal, fun, elegant, or school-spirited."
      },
      {
        question: "What size works for graduation flyers?",
        answer:
          "Use 4:5 for Instagram posts, 9:16 for stories, and letter or A4 for printed school or family announcements."
      }
    ],
    related: ["party-flyer-maker", "school-flyer-maker", "event-flyer-maker", "photography-flyer-maker"]
  },
  {
    slug: "funeral-flyer-maker",
    categorySlug: "funeral-flyers",
    label: "Funeral Flyer Maker",
    shortLabel: "funeral flyer",
    title: "Funeral Flyer Maker for Memorial Services and Announcements",
    description:
      "Create funeral flyers, memorial service announcements, and celebration of life flyers with respectful prompt examples and clear service details.",
    h1: "Funeral flyer maker for memorial services and announcements",
    lede:
      "Prepare a respectful funeral flyer that makes the name, dates, service time, location, family note, photo direction, and memorial details clear.",
    primaryKeyword: "funeral flyer",
    supportingKeywords: [
      "funeral flyer template",
      "funeral flyers",
      "funeral flyer examples",
      "funeral service flyer",
      "funeral announcement flyer"
    ],
    imageKeywords: ["memorial", "funeral", "church", "flowers", "announcement", "service"],
    audience: "Families, funeral homes, churches, memorial organizers, and community members preparing service announcements.",
    searchIntent: "Find a funeral flyer, memorial flyer, or funeral announcement layout that handles service details with care.",
    ctaLabel: "Create a funeral flyer",
    primaryPrompt:
      "Create a respectful funeral flyer with loved one's name, birth and passing dates, service date, time, location, family note, photo area, memorial details, and calm elegant layout.",
    promptExamples: [
      {
        title: "Memorial service flyer",
        prompt:
          "Create a memorial service flyer for [name]. Include birth and passing dates, service date, time, church or venue, family note, photo area, and soft elegant floral styling."
      },
      {
        title: "Celebration of life flyer",
        prompt:
          "Create a celebration of life flyer with name, portrait area, date, venue, short remembrance line, RSVP or contact note, and warm respectful color palette."
      },
      {
        title: "Funeral fundraiser flyer",
        prompt:
          "Create a funeral fundraiser flyer with loved one's name, family support message, donation method, service or deadline details, contact person, and dignified layout."
      }
    ],
    copyChecklist: ["Loved one's name", "Dates or age", "Service date and time", "Venue", "Family note or contact"],
    formatTips: ["Use calm contrast", "Keep service details grouped", "Leave a clear portrait or memorial image area"],
    faq: [
      {
        question: "What should a funeral flyer include?",
        answer:
          "Include the loved one's name, dates, service date and time, venue, family or host note, contact information, photo area, and any donation or reception details."
      },
      {
        question: "Can I make a celebration of life flyer?",
        answer:
          "Yes. Use warmer language, a portrait or meaningful image direction, service or gathering details, and a respectful CTA such as RSVP or share with family."
      },
      {
        question: "How should a funeral flyer look?",
        answer:
          "Keep the design calm, readable, and respectful. Use gentle colors, enough whitespace, clear service details, and a simple photo or floral direction."
      }
    ],
    related: ["church-flyer-maker", "event-flyer-maker", "fundraiser-flyer-maker", "charity-flyer-maker"]
  },
  {
    slug: "hiring-flyer-maker",
    categorySlug: "hiring-flyers",
    label: "Hiring Flyer Maker",
    shortLabel: "hiring flyer",
    title: "Hiring Flyer Maker for Jobs, Recruitment, and Now Hiring Posters",
    description:
      "Create hiring flyers and now hiring posters with role details, benefits, location, application instructions, and AI prompt examples for recruitment.",
    h1: "Hiring flyer maker for jobs, recruitment, and now hiring posters",
    lede:
      "Build a hiring flyer that makes the role, pay or benefits, location, requirements, schedule, application method, and deadline easy to act on.",
    primaryKeyword: "hiring flyer",
    supportingKeywords: [
      "hiring flyer template",
      "now hiring flyer",
      "we are hiring flyer",
      "hiring flyers",
      "job hiring flyers examples"
    ],
    imageKeywords: ["hiring", "jobs", "business", "recruitment", "career", "now hiring"],
    audience: "Small businesses, recruiters, restaurants, retailers, local services, schools, and community hiring teams.",
    searchIntent: "Find a hiring flyer or now hiring poster that can communicate open roles and application steps quickly.",
    ctaLabel: "Create a hiring flyer",
    primaryPrompt:
      "Create a hiring flyer with company name, job title, pay or benefits note, location, schedule, requirements, application instructions, deadline, and professional now-hiring layout.",
    promptExamples: [
      {
        title: "Now hiring flyer",
        prompt:
          "Create a now hiring flyer for [business]. Include open roles, pay or benefits, location, schedule, requirements, apply link, phone number, and bold readable CTA."
      },
      {
        title: "Restaurant hiring flyer",
        prompt:
          "Create a restaurant hiring flyer with roles, shift times, benefits, immediate interviews note, address, contact phone, and friendly local business styling."
      },
      {
        title: "Retail recruitment flyer",
        prompt:
          "Create a retail recruitment flyer with store name, open positions, employee benefits, location, application QR code space, and clean professional layout."
      }
    ],
    copyChecklist: ["Job title", "Pay or benefits", "Location", "Requirements", "Apply CTA"],
    formatTips: ["Keep the apply method large", "Use QR code space for applications", "Mention deadline or immediate interviews if relevant"],
    faq: [
      {
        question: "What should a hiring flyer include?",
        answer:
          "Include the company name, job title, pay or benefits, location, schedule, requirements, application instructions, contact details, and deadline."
      },
      {
        question: "Can I make a now hiring poster?",
        answer:
          "Yes. Use a bold headline, short role list, pay or benefits note, location, QR code space, and a direct apply CTA."
      },
      {
        question: "What is the best CTA for a hiring flyer?",
        answer:
          "Use a direct CTA such as Apply Today, Walk-In Interviews, Scan to Apply, Call to Schedule, or Bring Your Resume."
      }
    ],
    related: ["job-fair-flyer-maker", "business-flyer-maker", "restaurant-flyer-maker", "grand-opening-flyer-maker"]
  },
  {
    slug: "dance-flyer-maker",
    categorySlug: "dance-flyers",
    label: "Dance Flyer Maker",
    shortLabel: "dance flyer",
    title: "Dance Flyer Maker for Classes, Studios, Parties, and Events",
    description:
      "Create dance flyers for classes, dance studios, parties, line dance nights, and community events with AI prompts and event-ready copy guidance.",
    h1: "Dance flyer maker for classes, studios, parties, and events",
    lede:
      "Make a dance flyer that highlights the class, instructor, date, venue, style, level, price, registration details, and call to action.",
    primaryKeyword: "dance flyer",
    supportingKeywords: [
      "line dance flyer",
      "line dancing flyer",
      "dance class flyer",
      "dance club flyer",
      "dance studio flyer"
    ],
    imageKeywords: ["dance", "class", "studio", "party", "music", "event"],
    audience: "Dance studios, instructors, event hosts, schools, clubs, community centers, and party promoters.",
    searchIntent: "Find a dance flyer, dance class flyer, or dance event announcement with clear schedule and registration details.",
    ctaLabel: "Create a dance flyer",
    primaryPrompt:
      "Create a dance flyer with dance style, class or event title, instructor, date, time, venue, level, price, registration link, and energetic readable layout.",
    promptExamples: [
      {
        title: "Dance class flyer",
        prompt:
          "Create a dance class flyer for [style]. Include instructor, level, date, time, studio location, price, registration CTA, and bright movement-focused design."
      },
      {
        title: "Line dance night flyer",
        prompt:
          "Create a line dance night flyer with event title, date, venue, lesson time, social dancing time, cover charge, dress note, and fun country dance styling."
      },
      {
        title: "Dance studio open house flyer",
        prompt:
          "Create a dance studio open house flyer with studio name, trial class schedule, age groups, location, registration QR code space, and welcoming family-friendly design."
      }
    ],
    copyChecklist: ["Dance style", "Date and time", "Instructor or host", "Venue", "Register CTA"],
    formatTips: ["Use action-oriented imagery", "Group class details into short blocks", "Use 4:5 for social and letter size for studio handouts"],
    faq: [
      {
        question: "What should a dance flyer include?",
        answer:
          "Include the dance style, class or event title, instructor, level, date, time, venue, price, registration details, and CTA."
      },
      {
        question: "Can I make a dance class flyer?",
        answer:
          "Yes. Add the class style, level, age group, schedule, studio address, instructor name, price, and registration link."
      },
      {
        question: "How do I make a dance flyer readable?",
        answer:
          "Keep the event title and date large, use one energetic image direction, and group schedule, price, and registration details into one clean block."
      }
    ],
    related: ["class-flyer-maker", "party-flyer-maker", "club-flyer-maker", "music-flyer-maker"]
  },
  {
    slug: "baby-shower-flyer-maker",
    categorySlug: "baby-shower-flyers",
    label: "Baby Shower Flyer Maker",
    shortLabel: "baby shower flyer",
    title: "Baby Shower Flyer Maker for Invitations and Community Events",
    description:
      "Create baby shower flyers and invitations with theme details, registry notes, RSVP information, and AI prompt examples for social or print invites.",
    h1: "Baby shower flyer maker for invitations and community events",
    lede:
      "Plan a baby shower flyer around the parent name, theme, date, venue, registry note, RSVP details, and warm invitation style.",
    primaryKeyword: "baby shower flyers",
    supportingKeywords: [
      "baby shower flyer",
      "community baby shower flyer",
      "baby shower flyers for boy",
      "baby shower flyer template",
      "baby shower flyer ideas"
    ],
    imageKeywords: ["baby shower", "invitation", "party", "family", "celebration", "pastel"],
    audience: "Parents, family hosts, churches, community groups, event planners, and baby shower organizers.",
    searchIntent: "Find a baby shower flyer or invitation layout with theme, RSVP, registry, and event details.",
    ctaLabel: "Create a baby shower flyer",
    primaryPrompt:
      "Create a baby shower flyer with parent or family name, theme, date, time, venue, RSVP contact, registry note, gift note, and warm pastel invitation layout.",
    promptExamples: [
      {
        title: "Classic baby shower invite",
        prompt:
          "Create a baby shower flyer for [parent name]. Include theme, date, time, venue, RSVP contact, registry note, and soft elegant invitation styling."
      },
      {
        title: "Community baby shower flyer",
        prompt:
          "Create a community baby shower flyer with organizer name, date, location, donation or registry note, family-friendly details, RSVP contact, and welcoming design."
      },
      {
        title: "Baby boy shower flyer",
        prompt:
          "Create a baby boy shower flyer with parent name, theme, date, venue, RSVP, registry note, blue and cream palette, and playful but readable layout."
      }
    ],
    copyChecklist: ["Parent or family name", "Theme", "Date and venue", "RSVP contact", "Registry or gift note"],
    formatTips: ["Use soft contrast for readability", "Keep RSVP details near the bottom", "Use 4:5 for social invites and letter size for print"],
    faq: [
      {
        question: "What should a baby shower flyer include?",
        answer:
          "Include the parent or family name, shower theme, date, time, venue, RSVP contact, registry or gift note, host details, and one clear invitation CTA."
      },
      {
        question: "Can I make a community baby shower flyer?",
        answer:
          "Yes. Add the organizer, location, donation or registry note, audience, RSVP details, and a warm community-focused design direction."
      },
      {
        question: "What style works for baby shower flyers?",
        answer:
          "Use gentle colors, simple type, clear invitation details, and enough whitespace so RSVP and registry information stays readable."
      }
    ],
    related: ["birthday-flyer-maker", "party-flyer-maker", "event-flyer-maker", "wedding-flyer-maker"]
  },
  {
    slug: "farmers-market-flyer-maker",
    categorySlug: "farmers-market-flyers",
    label: "Farmers Market Flyer Maker",
    shortLabel: "farmers market flyer",
    title: "Farmers Market Flyer Maker for Vendors, Events, and Local Markets",
    description:
      "Create farmers market flyers for vendor lineups, seasonal produce, community events, pop-ups, and local market announcements with AI prompts.",
    h1: "Farmers market flyer maker for vendors, events, and local markets",
    lede:
      "Build a farmers market flyer that makes the market date, location, vendor mix, produce or food offer, hours, and visit CTA easy to understand.",
    primaryKeyword: "farmers market flyer",
    supportingKeywords: [
      "farmers market flyers",
      "farmers market flyer ideas",
      "farmers market flyer template",
      "flyer farmers market",
      "vendor market flyer"
    ],
    imageKeywords: ["farmers market", "food", "vendor", "local market", "produce", "community"],
    audience: "Farmers markets, food vendors, community organizers, pop-up markets, local shops, and event promoters.",
    searchIntent: "Find a farmers market flyer or vendor market announcement that can promote dates, vendors, food, and location.",
    ctaLabel: "Create a farmers market flyer",
    primaryPrompt:
      "Create a farmers market flyer with market name, date, hours, location, vendor highlights, seasonal produce or food offer, family-friendly note, and visit CTA.",
    promptExamples: [
      {
        title: "Weekly farmers market flyer",
        prompt:
          "Create a weekly farmers market flyer with market name, date, hours, address, vendor highlights, fresh produce note, parking info, and friendly local design."
      },
      {
        title: "Vendor market flyer",
        prompt:
          "Create a vendor market flyer with event title, vendor categories, date, location, shopping CTA, food note, family activity detail, and modern community layout."
      },
      {
        title: "Seasonal produce flyer",
        prompt:
          "Create a seasonal farmers market flyer featuring [produce]. Include market date, hours, location, vendor note, local farm feel, and visit-this-weekend CTA."
      }
    ],
    copyChecklist: ["Market name", "Date and hours", "Location", "Vendor or produce highlights", "Visit CTA"],
    formatTips: ["Use warm food imagery", "Keep date and address prominent", "Add vendor categories instead of long vendor lists"],
    faq: [
      {
        question: "What should a farmers market flyer include?",
        answer:
          "Include the market name, date, hours, location, vendor highlights, seasonal produce or food notes, parking or family details, and a clear visit CTA."
      },
      {
        question: "Can I make a vendor market flyer?",
        answer:
          "Yes. Add vendor categories, event date, location, food or activity notes, shopping CTA, and a style that fits the local market audience."
      },
      {
        question: "What format works best for farmers market flyers?",
        answer:
          "Use 4:5 for social posts, 9:16 for stories, and letter size for community boards, shops, and local handouts."
      }
    ],
    related: ["food-flyer-maker", "event-flyer-maker", "restaurant-flyer-maker", "drink-vendor-flyer-maker"]
  },
  {
    slug: "comedy-show-flyer-maker",
    categorySlug: "comedy-show-flyers",
    label: "Comedy Show Flyer Maker",
    shortLabel: "comedy show flyer",
    title: "Comedy Show Flyer Maker for Stand-Up Nights and Live Events",
    description:
      "Create comedy show flyers for stand-up nights, openers, dinner shows, club events, and ticketed performances with AI prompt examples.",
    h1: "Comedy show flyer maker for stand-up nights and live events",
    lede:
      "Make a comedy show flyer that highlights the headliner, lineup, venue, date, ticket link, age note, host, and showtime.",
    primaryKeyword: "comedy show flyer",
    supportingKeywords: [
      "comedy show flyers",
      "comedy show flyer examples",
      "comedy show flyer design",
      "comedy show flyer template",
      "comedy show flyer ideas"
    ],
    imageKeywords: ["comedy", "stand up", "show", "club", "event", "nightlife"],
    audience: "Comedians, promoters, comedy clubs, venues, hosts, and event teams promoting live comedy nights.",
    searchIntent: "Find a comedy show flyer or stand-up event announcement with lineup, venue, ticket, and showtime details.",
    ctaLabel: "Create a comedy show flyer",
    primaryPrompt:
      "Create a comedy show flyer with headliner, supporting lineup, host, date, showtime, venue, ticket link, age note, and bold club-event layout.",
    promptExamples: [
      {
        title: "Stand-up comedy night flyer",
        prompt:
          "Create a stand-up comedy night flyer with headliner, opener list, host, date, venue, showtime, ticket CTA, age note, and bold spotlight-style design."
      },
      {
        title: "Comedy club flyer",
        prompt:
          "Create a comedy club flyer with event title, comedian names, club address, date, doors time, ticket link, drink minimum note, and premium nightlife typography."
      },
      {
        title: "Dinner and comedy flyer",
        prompt:
          "Create a dinner and comedy flyer with headline, dinner time, showtime, performers, venue, price or ticket note, reservation CTA, and warm evening layout."
      }
    ],
    copyChecklist: ["Headliner", "Lineup or host", "Date and showtime", "Venue", "Ticket CTA"],
    formatTips: ["Keep performer names readable", "Use dark background only with high contrast", "Put ticket link and showtime in one detail block"],
    faq: [
      {
        question: "What should a comedy show flyer include?",
        answer:
          "Include the show title, headliner, lineup, host, date, showtime, venue, ticket link, age note, and any dinner or drink minimum details."
      },
      {
        question: "Can I make a stand-up comedy flyer?",
        answer:
          "Yes. Add the comedian names, venue, showtime, ticket CTA, age note, and whether the visual style should feel club, theater, casual, or premium."
      },
      {
        question: "How do I make a comedy flyer less cluttered?",
        answer:
          "Limit the lineup to readable names, group logistics into one block, and keep the headliner or event title as the largest element."
      }
    ],
    related: ["open-mic-flyer-maker", "event-flyer-maker", "club-flyer-maker", "party-flyer-maker"]
  },
  {
    slug: "open-mic-flyer-maker",
    categorySlug: "open-mic-flyers",
    label: "Open Mic Flyer Maker",
    shortLabel: "open mic flyer",
    title: "Open Mic Flyer Maker for Music, Comedy, Poetry, and Community Nights",
    description:
      "Create open mic flyers for music nights, comedy open mics, poetry events, and community performances with AI prompts and signup details.",
    h1: "Open mic flyer maker for music, comedy, poetry, and community nights",
    lede:
      "Build an open mic flyer that makes the performer signup, date, venue, time slots, host, audience note, and participation rules clear.",
    primaryKeyword: "open mic flyer",
    supportingKeywords: [
      "open mic flyers",
      "open mic night flyer",
      "open mic flyer template",
      "open mic night flyer template",
      "free open mic flyer template"
    ],
    imageKeywords: ["open mic", "music", "comedy", "poetry", "stage", "community"],
    audience: "Venues, coffee shops, musicians, comedians, poets, hosts, clubs, and community event organizers.",
    searchIntent: "Find an open mic flyer or open mic night announcement with signup, venue, schedule, and host details.",
    ctaLabel: "Create an open mic flyer",
    primaryPrompt:
      "Create an open mic flyer with event title, date, venue, signup time, performance slots, host, audience note, rules, contact method, and welcoming stage-event layout.",
    promptExamples: [
      {
        title: "Music open mic flyer",
        prompt:
          "Create a music open mic flyer with event title, date, venue, signup time, performance slots, host name, acoustic stage visual direction, and invite-to-perform CTA."
      },
      {
        title: "Comedy open mic flyer",
        prompt:
          "Create a comedy open mic flyer with event name, host, date, showtime, signup instructions, venue, age note, and bold casual comedy-club layout."
      },
      {
        title: "Poetry open mic flyer",
        prompt:
          "Create a poetry open mic flyer with theme, date, venue, signup details, featured reader, community note, and warm arts-event design."
      }
    ],
    copyChecklist: ["Event title", "Date and venue", "Signup time", "Host", "Performance or audience CTA"],
    formatTips: ["Separate performer signup from audience details", "Keep venue and time large", "Mention genre if the open mic is music, comedy, or poetry"],
    faq: [
      {
        question: "What should an open mic flyer include?",
        answer:
          "Include the event title, date, venue, signup time, performance slots, host, genre, rules, contact method, and whether guests should perform or attend."
      },
      {
        question: "Can I make an open mic night flyer?",
        answer:
          "Yes. Add the night theme, performer signup details, venue, date, showtime, host, and a CTA for performers or audience members."
      },
      {
        question: "How do I make open mic signup details clear?",
        answer:
          "Use a separate signup block with arrival time, slot length, contact method, and any rules about instruments, comedy sets, or poetry readings."
      }
    ],
    related: ["music-flyer-maker", "comedy-show-flyer-maker", "event-flyer-maker", "club-flyer-maker"]
  }
];

export const flyerSeoLandingPaths = flyerSeoLandingPages.map((page) => `/flyers/${page.slug}`);

export function getFlyerSeoLandingPage(slug: string) {
  return flyerSeoLandingPages.find((page) => page.slug === slug);
}

function getFlyerSeoLandingPages(slugs: string[]) {
  return slugs
    .map(getFlyerSeoLandingPage)
    .filter((page): page is FlyerSeoLandingPage => Boolean(page));
}

export const flyerSeoLandingPageGroups = [
  {
    title: "Events and celebrations",
    description:
      "Use these when the flyer needs a date, venue, host, lineup, RSVP, ticket link, or invitation details.",
    pages: getFlyerSeoLandingPages([
      "party-flyer-maker",
      "birthday-flyer-maker",
      "sweet-16-flyer-maker",
      "wedding-flyer-maker",
      "halloween-flyer-maker",
      "event-flyer-maker",
      "workshop-flyer-maker",
      "class-flyer-maker",
      "art-flyer-maker",
      "club-flyer-maker",
      "concert-flyer-maker",
      "music-flyer-maker",
      "band-flyer-maker",
      "gig-flyer-maker",
      "dj-flyer-maker",
      "open-mic-flyer-maker",
      "comedy-show-flyer-maker",
      "dance-flyer-maker",
      "graduation-flyer-maker",
      "baby-shower-flyer-maker",
      "funeral-flyer-maker",
      "farmers-market-flyer-maker",
      "car-show-flyer-maker",
      "job-fair-flyer-maker"
    ])
  },
  {
    title: "School, family, and community notices",
    description:
      "Use these when the flyer needs parent-friendly copy, donation instructions, registration details, safety notes, or neighborhood contact information.",
    pages: getFlyerSeoLandingPages([
      "school-flyer-maker",
      "sports-registration-flyer-maker",
      "psa-flyer-maker",
      "summer-camp-flyer-maker",
      "food-drive-flyer-maker",
      "bake-sale-flyer-maker",
      "talent-show-flyer-maker",
      "tutor-flyer-maker",
      "daycare-flyer-maker",
      "babysitting-flyer-maker",
      "lost-pet-flyer-maker",
      "fundraiser-flyer-maker",
      "charity-flyer-maker",
      "volunteer-flyer-maker",
      "health-flyer-maker",
      "church-flyer-maker",
      "funeral-flyer-maker",
      "graduation-flyer-maker",
      "baby-shower-flyer-maker"
    ])
  },
  {
    title: "Business and local services",
    description:
      "Use these when the flyer needs to sell a service, offer, appointment, menu, or local business action.",
    pages: getFlyerSeoLandingPages([
      "free-flyer-maker",
      "online-flyer-maker",
      "ai-flyer-maker",
      "flyer-design-maker",
      "flyer-creator",
      "free-flyer-generator",
      "text-to-flyer-generator",
      "business-flyer-maker",
      "cleaning-service-flyer-maker",
      "house-cleaning-flyer",
      "pressure-washing-flyer-maker",
      "car-detailing-flyer-maker",
      "car-wash-flyer-maker",
      "landscaping-flyer-maker",
      "lawn-care-flyer-maker",
      "hiring-flyer-maker",
      "dog-walker-flyer-maker",
      "construction-flyer-maker",
      "photography-flyer-maker",
      "product-flyer-maker",
      "advertising-flyer-maker",
      "salon-flyer-maker",
      "hair-salon-flyer-maker",
      "nail-salon-flyer-maker",
      "fitness-flyer-maker",
      "gym-flyer-maker",
      "personal-trainer-flyer-maker",
      "restaurant-flyer-maker",
      "food-flyer-maker",
      "menu-flyer-maker",
      "drink-vendor-flyer-maker",
      "happy-hour-flyer-maker",
      "marketing-flyer-maker",
      "modern-flyer-design",
      "election-flyer-maker"
    ])
  },
  {
    title: "Real estate, openings, and sales",
    description:
      "Use these when the flyer needs property details, a launch date, a discount, an address, or a local sale CTA.",
    pages: getFlyerSeoLandingPages([
      "real-estate-flyer-maker",
      "open-house-flyer-maker",
      "grand-opening-flyer-maker",
      "sale-flyer-maker",
      "holiday-flyer-maker",
      "christmas-flyer-maker",
      "easter-flyer-maker",
      "black-friday-flyer-maker",
      "yard-sale-flyer-maker",
      "garage-sale-flyer-maker"
    ])
  }
] as const;

export const flyerSecondRoundExpansionClusters = [
  {
    title: "Local service expansion pages",
    body:
      "Use these support pages to reinforce business, cleaning, and hiring flyer targets without pretending every service variation needs the same page depth.",
    measuredTargetSlugs: ["business-flyer-maker", "cleaning-service-flyer-maker", "hiring-flyer-maker"],
    pageSlugs: [
      "pressure-washing-flyer-maker",
      "car-detailing-flyer-maker",
      "lawn-care-flyer-maker",
      "construction-flyer-maker",
      "dog-walker-flyer-maker",
      "job-fair-flyer-maker"
    ]
  },
  {
    title: "Event and performance expansion pages",
    body:
      "Use these pages to catch specific venue, lineup, and community-event intent while sending topical strength back to related event flyer pages.",
    measuredTargetSlugs: ["dance-flyer-maker", "comedy-show-flyer-maker", "open-mic-flyer-maker"],
    pageSlugs: [
      "dj-flyer-maker",
      "music-flyer-maker",
      "band-flyer-maker",
      "gig-flyer-maker",
      "talent-show-flyer-maker",
      "car-show-flyer-maker"
    ]
  },
  {
    title: "Family and community expansion pages",
    body:
      "Use these support pages for school, church, donation, and neighborhood intent that naturally links into related graduation, funeral, and baby shower targets.",
    measuredTargetSlugs: ["graduation-flyer-maker", "funeral-flyer-maker", "baby-shower-flyer-maker"],
    pageSlugs: [
      "church-flyer-maker",
      "fundraiser-flyer-maker",
      "charity-flyer-maker",
      "school-flyer-maker",
      "bake-sale-flyer-maker",
      "food-drive-flyer-maker"
    ]
  }
] as const;

export const flyerSecondRoundExpansionSlugs = Array.from(
  new Set(flyerSecondRoundExpansionClusters.flatMap((cluster) => cluster.pageSlugs))
);
