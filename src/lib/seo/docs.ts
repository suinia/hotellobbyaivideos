import type { DocsHomeCategory } from "./docs-categories";
import { churchFlyerDoc } from "./church-flyer-doc";
import { flyerMakerDocs } from "./flyer-maker-docs";

export type SeoDocSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
  example?: {
    label: string;
    prompt: string;
  };
};

export type SeoDocConfig = {
  slug: string;
  title: string;
  description: string;
  image: {
    src: string;
    alt: string;
  };
  h1: string;
  lede: string;
  category: string;
  homeCategory: DocsHomeCategory;
  toolHref?: string;
  toolLabel?: string;
  sourceUseCase?: string;
  sections: SeoDocSection[];
  workflow: string[];
  tips: string[];
  templateLinks?: {
    href: string;
    label: string;
    description: string;
  }[];
  specializedLinks?: {
    href: string;
    label: string;
    description: string;
  }[];
  relatedTools: {
    href: string;
    label: string;
  }[];
};

export type ToolDocLink = {
  href: string;
  label: string;
  description: string;
};

export const seoDocs: SeoDocConfig[] = [
  ...flyerMakerDocs,
  churchFlyerDoc,
  {
    slug: "how-to-use-vismuse",
    title: "How to Use Vismuse: A Beginner’s Guide",
    image: {
      src: "/assets/docs/how-to-use-vismuse-hero-v2.png",
      alt: "A simple Vismuse workflow from prompt and reference image to finished images and video"
    },
    description:
      "Learn how to use Vismuse in five simple steps: choose a tool, describe what you want, add a reference, pick the size, and ask for changes.",
    h1: "How to use Vismuse: a beginner’s guide",
    lede:
      "Choose what you want to make, describe it in your own words, and tell Vismuse what to change. You do not need design experience or special prompt language.",
    category: "Getting started",
    homeCategory: "Vismuse",
    toolHref: "/tools",
    toolLabel: "Choose what to create",
    sections: [
      {
        title: "1. Pick what you want to create",
        paragraphs: [
          "Start with the finished result: an image, video, flyer, album cover, product ad, or something else. Choose the tool with the closest name. If you are not sure, use AI Image Maker for an image or AI Video Generator for a video."
        ]
      },
      {
        title: "2. Describe it in your own words",
        paragraphs: [
          "Tell Vismuse what you are making, what should appear, how it should look, and where you will use it. Include any exact words, colors, or details that must appear."
        ],
        bullets: [
          "What you are making",
          "The main subject or action",
          "The look, colors, and mood",
          "Where you will use it",
          "Exact text or details that must stay"
        ],
        example: {
          label: "Example image brief",
          prompt: "Create a square Instagram image for a citrus sparkling water. Put the can on a pale stone table with water splashes and warm morning light. Use lime green and cream. Add the headline ‘A brighter kind of refreshment.’"
        }
      },
      {
        title: "3. Add a photo when Vismuse needs something to follow",
        paragraphs: [
          "Upload a product photo, portrait, room photo, logo, sketch, or other reference when you want Vismuse to keep or match something. Say what must stay the same and what may change."
        ],
        example: {
          label: "Example reference edit",
          prompt: "Keep the can, label, and camera angle from my photo. Change only the background to a bright poolside scene."
        }
      },
      {
        title: "4. Pick the right size",
        paragraphs: [
          "Choose the shape based on where the result will appear: 1:1 for square posts and covers, 4:5 for portrait posts, 9:16 for stories and vertical video, and 16:9 for wide images and video. Start with 1K for a quick draft. Choose 2K or 4K when you need a larger final image and the option is available.",
          "For video, also choose a duration. If you upload an image, describe what should move and how the camera should move."
        ]
      },
      {
        title: "5. Check the result and ask for one change",
        paragraphs: [
          "Check the subject, text, colors, layout, motion, and important details. You do not need to start over. Say what is already right, then ask for one clear change.",
          "When the result looks right, download it. Available file types, resolution, and watermark options can vary by tool and plan."
        ],
        example: {
          label: "Example revision",
          prompt: "Keep the product, layout, and lighting. Change only the background from blue to warm beige."
        }
      }
    ],
    workflow: [],
    tips: [
      "Put exact text in quotation marks and check it before publishing.",
      "Say what to keep before you say what to change.",
      "Explain what each uploaded reference should be used for.",
      "Ask for one clear change at a time.",
      "Start a new project when you switch to a different type of output."
    ],
    templateLinks: [
      {
        href: "/docs/which-vismuse-tool-should-you-use",
        label: "Which Vismuse tool should you use?",
        description: "Match your project to the best starting point."
      },
      {
        href: "/docs/how-to-write-better-ai-prompts-in-vismuse",
        label: "Write better AI prompts",
        description: "Turn an idea into a clear, usable creative brief."
      },
      {
        href: "/templates",
        label: "Browse templates",
        description: "Start from a proven visual direction."
      }
    ],
    relatedTools: [
      { href: "/tools/ai-image-maker", label: "AI Image Maker" },
      { href: "/ai-video-generator", label: "AI Video Generator" },
      { href: "/tools", label: "All Vismuse tools" }
    ]
  },
  {
    slug: "which-vismuse-tool-should-you-use",
    title: "Which Vismuse Tool Should You Use?",
    image: {
      src: "/assets/docs/which-vismuse-tool-icons-hero-v2.png",
      alt: "A full-width grid of Vismuse tool icons for images, videos, marketing designs, and photo edits"
    },
    description:
      "Choose the right Vismuse AI tool for images, videos, text edits, background removal, flyers, product ads, album covers, and more.",
    h1: "Which Vismuse tool should you use?",
    lede:
      "Start with the result you need. Vismuse handles creation and editing through chat, so you can make polished work without learning a traditional editor.",
    category: "Tool guide",
    homeCategory: "Vismuse",
    toolHref: "/tools",
    toolLabel: "Browse all Vismuse tools",
    sections: [
      {
        title: "Start with what you want to make",
        paragraphs: [
          "Pick the closest match below. You can describe the style, content, and changes you want after you open the tool."
        ],
        bullets: [
          "Create a custom image from an idea → AI Image Maker",
          "Create a video or animate an image → AI Video Generator",
          "Make a flyer, cover, ad, logo, or other fixed format → choose the tool with that name",
          "Change text in an existing image → AI Image Text Editor",
          "Remove an image background → Background Remover"
        ]
      },
      {
        title: "Create an image or video",
        paragraphs: [
          "Use a general tool when your idea does not fit one fixed format. Use a focused video tool when you already know where the video will be used."
        ],
        bullets: [
          "AI Image Maker — custom images, social graphics, portraits, and visual concepts",
          "AI Video Generator — videos from a prompt or reference image, including image animation",
          "Promo Video Maker — short promotional videos for products, offers, and launches",
          "Spotify Canvas Generator — seamless vertical loops made from album artwork"
        ]
      },
      {
        title: "Make a business or marketing design",
        paragraphs: [
          "A focused tool gives Vismuse the right format and priorities from the start."
        ],
        bullets: [
          "AI Product Ad Image Generator — ecommerce product scenes and campaign images",
          "AI Flyer Generator — events, offers, listings, and local promotions",
          "AI Brochure Generator — company, product, property, service, and travel brochures",
          "AI Infographic Generator — processes, comparisons, timelines, and data stories",
          "AI Menu Generator — restaurant menus built around your items and prices",
          "AI Logo Generator — logo concepts and brand marks",
          "Business Card Maker — print-ready business card concepts",
          "Invitation Maker — invitations for parties, weddings, and other events"
        ]
      },
      {
        title: "Make a cover, poster, or personal design",
        paragraphs: [
          "Choose the format closest to the final artwork you need."
        ],
        bullets: [
          "AI Poster Maker — event posters, product promotions, movie posters, and lost-and-found notices",
          "AI Album Cover Generator — artwork for albums, singles, EPs, playlists, and mixtapes",
          "AI Book Cover Generator — covers for print books and ebooks",
          "AI Sticker Generator — custom sticker art and character stickers",
          "AI Wallpaper Generator — phone and desktop backgrounds",
          "Tattoo Generator — custom tattoo concepts and stencil ideas"
        ]
      },
      {
        title: "Edit something you already have",
        paragraphs: [
          "Upload your current image, then describe the change in plain language. You can review the result and ask for another edit in the same conversation."
        ],
        bullets: [
          "AI Image Text Editor — replace, remove, or add words while keeping the surrounding design",
          "Background Remover — make a transparent, white, colored, or product-ready background",
          "AI Product Ad Image Generator — turn a product photo into a finished campaign scene",
          "AI Video Generator — add motion or camera movement to a still image",
          "Spotify Canvas Generator — animate cover art for a music release"
        ]
      },
      {
        title: "How to choose between similar tools",
        paragraphs: [
          "When two tools could work, choose the one closest to the final result you plan to publish."
        ],
        bullets: [
          "AI Image Maker or a focused tool — use the focused tool for a known format; use AI Image Maker for an open-ended idea",
          "AI Image Text Editor or AI Image Maker — edit the existing image when its design should stay; start fresh when you want a new composition",
          "AI Flyer Generator or AI Brochure Generator — choose a flyer for one-page promotion; choose a brochure for more detailed information",
          "AI Video Generator or Promo Video Maker — choose AI Video Generator for open-ended motion; choose Promo Video Maker to market a product or offer",
          "AI Product Ad Image Generator or Background Remover — choose Product Ad for a finished campaign image; choose Background Remover for a clean cutout",
          "AI Album Cover Generator or Spotify Canvas Generator — create the cover first, then animate it for Spotify"
        ]
      }
    ],
    workflow: [],
    tips: [
      "Choose by the final format, not the visual style.",
      "Put exact names, prices, dates, and other required text in quotation marks.",
      "Use a focused tool when you know the format; use a general tool when you want to explore.",
      "If you are still unsure, use AI Image Maker for images or AI Video Generator for motion."
    ],
    templateLinks: [
      {
        href: "/docs/how-to-use-vismuse",
        label: "Vismuse beginner’s guide",
        description: "Follow the core workflow from brief to final result."
      },
      {
        href: "/docs/how-to-write-better-ai-prompts-in-vismuse",
        label: "Write better AI prompts",
        description: "Turn an idea into a clear, useful creative brief."
      },
      {
        href: "/templates",
        label: "Browse templates",
        description: "Compare formats and visual directions before you start."
      }
    ],
    relatedTools: [
      { href: "/tools", label: "All Vismuse tools" },
      { href: "/tools/ai-image-maker", label: "AI Image Maker" },
      { href: "/tools/ai-image-text-editor", label: "AI Image Text Editor" },
      { href: "/ai-video-generator", label: "AI Video Generator" }
    ]
  },
  {
    slug: "how-to-write-better-ai-prompts-in-vismuse",
    title: "How to Write Better AI Prompts in Vismuse",
    image: {
      src: "/assets/visual-templates/ai-album-cover/album-cover-editor-showcase.png",
      alt: "Vismuse prompt and generated album cover example"
    },
    description:
      "Learn how to write clear Vismuse prompts for images, designs, edits, and videos with practical formulas, examples, and revision instructions.",
    h1: "How to write better AI prompts in Vismuse",
    lede:
      "A good prompt is a compact creative brief. State the result, the important visual details, and anything that must stay exact. Leave out words that do not change the output.",
    category: "Prompt guide",
    homeCategory: "Vismuse",
    toolHref: "/ai-image-maker",
    toolLabel: "Try a prompt",
    sections: [
      {
        title: "1. Write the job in one clear brief",
        paragraphs: [
          "Start with the finished deliverable and its purpose. Then add only the details that affect the result."
        ],
        bullets: [
          "Deliverable and use — an Instagram ad, album cover, product photo, or vertical video",
          "Audience or goal — who it is for and what it should communicate",
          "Subject or action — what viewers should see",
          "Composition — placement, framing, camera angle, or space for text",
          "Visual direction — medium, colors, lighting, and mood",
          "Required content — exact copy and details that must stay unchanged",
          "Output format — aspect ratio or destination"
        ],
        example: {
          label: "Prompt formula",
          prompt: "Create a [deliverable] for [audience or use]. Show [subject or action] in [setting]. Arrange it [composition]. Use [style, colors, and lighting]. Include the exact text “[copy].” Keep [required details] unchanged. Make it [aspect ratio]."
        }
      },
      {
        title: "2. Include details that solve the task",
        paragraphs: [
          "Different jobs need different details. Do not add camera language to a flyer unless it controls a photo inside the design."
        ],
        bullets: [
          "Marketing design — purpose, audience, offer, visual hierarchy, and exact copy",
          "Product image — product details to preserve, setting, angle, lighting, and space for copy",
          "Portrait — appearance, expression, pose, framing, background, and lighting",
          "Cover artwork — title, artist or author, genre, mood, focal image, and typography direction",
          "Image edit — what the upload provides, what changes, and what stays unchanged"
        ],
        example: {
          label: "Example marketing prompt",
          prompt: "Create a 4:5 Instagram ad for a neighborhood coffee shop promoting a two-for-one cold brew offer to commuters. Show two clear cups on a light stone counter. Put “2 FOR 1 COLD BREW” at the top and “Weekdays, 7–10 AM” below it. Use dark brown, cream, and muted orange. Make the offer the largest text and leave the bottom clear for a logo."
        }
      },
      {
        title: "3. Replace vague words with visible direction",
        paragraphs: [
          "Words such as “professional,” “beautiful,” or “premium” are too broad on their own. Explain what should create that impression."
        ],
        bullets: [
          "Professional → a clean grid, clear hierarchy, restrained colors, and readable type",
          "Premium → generous empty space, refined materials, controlled lighting, and a limited palette",
          "Energetic → bold contrast, diagonal movement, an active pose, and bright color",
          "Cozy → warm window light, soft texture, close framing, and muted earth tones"
        ]
      },
      {
        title: "4. Tell Vismuse what to keep and what to change",
        paragraphs: [
          "When you upload an image, say whether it is the source to edit or a reference for style, color, pose, or composition. Put exact on-image copy in quotation marks and check it before publishing."
        ],
        example: {
          label: "Example reference image prompt",
          prompt: "Use my uploaded bottle as the exact product reference. Keep the bottle shape, cap, label, logo, and proportions unchanged. Replace the background with a sunlit poolside table, add realistic condensation, and leave open space on the right for ad copy."
        }
      },
      {
        title: "5. Describe motion, not just appearance",
        paragraphs: [
          "For video, describe the opening shot, the subject’s action, the camera movement, the pace, and the ending. Keep one main action per clip."
        ],
        example: {
          label: "Example video prompt",
          prompt: "Create a 9:16 product video. Open on a close shot of a citrus can on wet stone. Water droplets slide slowly down the can while the camera gently pushes in. Morning light moves across the label. End with the can centered and the label fully readable."
        }
      },
      {
        title: "6. Revise without starting over",
        paragraphs: [
          "If most of the result works, do not rewrite the full brief. Name what should stay, then request one clear change."
        ],
        example: {
          label: "Example revision prompt",
          prompt: "Keep the product, camera angle, lighting, and headline unchanged. Change only the blue background to warm beige and leave more empty space above the product."
        }
      }
    ],
    workflow: [],
    tips: [
      "Give each prompt one main result and one clear visual direction.",
      "Put names, prices, dates, and other exact copy in quotation marks.",
      "Describe the result you want before listing anything to exclude.",
      "Remove adjectives that do not translate into a visible choice.",
      "Check important text, logos, product details, and factual claims before publishing."
    ],
    templateLinks: [
      {
        href: "/docs/how-to-use-reference-images-in-vismuse",
        label: "Use reference images",
        description: "Pair a clear prompt with visual source material."
      },
      {
        href: "/docs/how-to-choose-image-size-aspect-ratio-and-resolution",
        label: "Choose size and resolution",
        description: "Match the composition to its final destination."
      },
      {
        href: "/docs/ai-image-maker",
        label: "AI Image Maker docs",
        description: "Learn the full image generation and revision workflow."
      }
    ],
    relatedTools: [
      { href: "/tools/ai-image-maker", label: "AI Image Maker" },
      { href: "/tools/ai-flyer-generator", label: "AI Flyer Generator" },
      { href: "/tools/album-cover-generator", label: "AI Album Cover Generator" }
    ]
  },
  {
    slug: "how-to-use-reference-images-in-vismuse",
    title: "How to Use Reference Images in Vismuse",
    image: {
      src: "/assets/visual-templates/ai-album-cover/own-image-editing-showcase.png",
      alt: "Reference portrait transformed into album artwork with Vismuse"
    },
    description:
      "Use reference images in Vismuse to guide subject identity, product details, composition, color, style, and creative direction.",
    h1: "How to use reference images in Vismuse",
    lede:
      "A reference image shows Vismuse what words cannot. Upload a clear source, then state exactly what to keep and what to change.",
    category: "Reference image guide",
    homeCategory: "Vismuse",
    toolHref: "/ai-image-maker",
    toolLabel: "Create with a reference",
    sections: [
      {
        title: "Choose the right reference",
        paragraphs: [
          "Use a sharp, well-lit image with the important subject fully visible. A product photo should show the packaging and logo. A portrait should show the face clearly. A style reference should make its color, lighting, or composition easy to read."
        ]
      },
      {
        title: "Say what to keep",
        paragraphs: [
          "Tell Vismuse which details are the source of truth. Name the person, product shape, logo, pose, camera angle, room layout, or other elements that must stay consistent."
        ],
        bullets: ["Subject or identity", "Product and packaging details", "Pose or camera angle", "Layout or composition", "Colors and visual style"]
      },
      {
        title: "Say what to change",
        paragraphs: [
          "Separate the preserved details from the new direction. For example: “Keep the bottle, label, and camera angle. Replace the background with a clean summer pool scene.”"
        ]
      }
    ],
    workflow: [
      "Upload a clear source image",
      "Define what must stay the same",
      "Describe the new setting or style",
      "Generate and check the preserved details"
    ],
    tips: [
      "Crop out details that are not part of the request.",
      "Use a high-quality original when accuracy matters.",
      "Give each reference one clear role.",
      "Check faces, logos, packaging, and text before exporting."
    ],
    templateLinks: [
      {
        href: "/docs/how-to-write-better-ai-prompts-in-vismuse",
        label: "Write better AI prompts",
        description: "Tell Vismuse how to use the visual source."
      },
      {
        href: "/docs/background-remover",
        label: "Background Remover docs",
        description: "Turn a clean source image into a cutout or new scene."
      },
      {
        href: "/docs/album-cover-generator",
        label: "Album Cover Generator docs",
        description: "Build release artwork from an artist photo or visual reference."
      }
    ],
    relatedTools: [
      { href: "/tools/ai-image-maker", label: "AI Image Maker" },
      { href: "/tools/background-remover", label: "Background Remover" },
      { href: "/tools/album-cover-generator", label: "AI Album Cover Generator" }
    ]
  },
  {
    slug: "how-to-choose-image-size-aspect-ratio-and-resolution",
    title: "How to Choose Image Size, Aspect Ratio, and Resolution",
    image: {
      src: "/assets/home/how-vismuse-input-composer.png",
      alt: "Vismuse composer showing aspect ratio and resolution controls"
    },
    description:
      "Choose the right image size, aspect ratio, and resolution in Vismuse for social posts, stories, video, ads, covers, web, and print.",
    h1: "How to choose image size, aspect ratio, and resolution",
    lede:
      "Choose the destination before you generate. The right canvas protects the composition and reduces cropping later.",
    category: "Output settings guide",
    homeCategory: "Vismuse",
    toolHref: "/ai-image-maker",
    toolLabel: "Create an image",
    sections: [
      {
        title: "Choose the aspect ratio by destination",
        paragraphs: [
          "Use 1:1 for square covers and posts, 4:5 for portrait feed images, 9:16 for stories and vertical video, and 16:9 for landscape video, presentations, and wide web graphics. Use Auto when the final format is flexible."
        ],
        bullets: ["1:1 — album covers and square posts", "4:5 — portrait social posts", "9:16 — stories, reels, and vertical video", "16:9 — landscape video and wide graphics"]
      },
      {
        title: "Choose resolution by use",
        paragraphs: [
          "Use 1K for fast drafts and everyday digital work. Choose 2K when you need more detail or room to crop. Choose 4K for large displays, demanding layouts, or print preparation. Higher resolutions use more credits and may depend on your plan or workflow."
        ]
      },
      {
        title: "Check the final requirements",
        paragraphs: [
          "Platform and printer specifications can change. Confirm the required pixel dimensions, bleed, color mode, and file format before publishing or printing. Generate close to the final ratio to avoid cutting off text or key subjects."
        ]
      }
    ],
    workflow: [
      "Confirm where the image will be used",
      "Choose the closest aspect ratio",
      "Select a resolution for the final output",
      "Check the crop and destination requirements"
    ],
    tips: [
      "Design for the primary destination first.",
      "Keep important text away from the edges.",
      "Use lower resolution for drafts and higher resolution for finals.",
      "Confirm print specifications with the printer."
    ],
    templateLinks: [
      {
        href: "/docs/how-to-write-better-ai-prompts-in-vismuse",
        label: "Write better AI prompts",
        description: "Include the destination and format in your brief."
      },
      {
        href: "/docs/album-cover-generator",
        label: "Album Cover Generator docs",
        description: "Create square artwork for releases and playlists."
      },
      {
        href: "/docs/flyer-generator",
        label: "AI Flyer Generator docs",
        description: "Choose layouts for digital sharing and print."
      }
    ],
    relatedTools: [
      { href: "/tools/ai-image-maker", label: "AI Image Maker" },
      { href: "/ai-video-generator", label: "AI Video Generator" },
      { href: "/tools/ai-flyer-generator", label: "AI Flyer Generator" }
    ]
  },
  {
    slug: "how-to-write-ai-singer-image-prompts",
    title: "How to Write AI Singer Image Prompts",
    image: {
      src: "/assets/visual-templates/ai-image-maker/ai-portrait.png",
      alt: "AI-generated singer portrait used in the prompt guide"
    },
    description:
      "Write better AI singer image prompts for vocalist portraits, stage photos, music avatars, album visuals, and singer wallpapers.",
    h1: "How to write AI singer image prompts",
    lede:
      "Good AI singer image prompts combine subject, genre, performance moment, lighting, setting, camera feel, and final format. The more specific the music world, the less generic the singer image feels.",
    category: "Prompt guide",
    homeCategory: "Music",
    toolHref: "/ai-image-maker",
    toolLabel: "Create a singer image",
    sourceUseCase: "ai-image-maker",
    sections: [
      {
        title: "Start with the singer and genre",
        paragraphs: [
          "Name the kind of singer first: pop vocalist, jazz singer, rapper, K-pop idol-style performer, country singer-songwriter, punk vocalist, opera singer, or animated music avatar.",
          "Then add the genre or song mood. Genre changes clothing, lighting, background, pose, typography, and color choices."
        ],
        bullets: ["Singer type", "Genre", "Song mood", "Age or styling direction if needed", "Realistic, illustrated, anime, or editorial style"]
      },
      {
        title: "Describe the performance moment",
        paragraphs: [
          "Singer prompts work better when they capture a moment: mid-chorus, reaching a high note, leaning into a microphone, recording in a booth, holding an acoustic guitar, or standing in a spotlight before the crowd appears.",
          "A performance verb gives the AI a clearer body pose and expression than simply asking for a singer."
        ]
      },
      {
        title: "Add lighting and camera cues",
        paragraphs: [
          "Use lighting words that match music photography: rim light, warm spotlight, LED wall, stage haze, soft studio key light, crowd bokeh, low-key shadows, or golden hour backlight.",
          "Camera cues such as close-up portrait, waist-up framing, low angle, shallow depth of field, or square cover crop help shape the final image."
        ]
      },
      {
        title: "End with the final use",
        paragraphs: [
          "Finish the prompt with the output type: social portrait, album cover, phone wallpaper, desktop wallpaper, poster concept, or source image for later animation. This tells the generator how much space to leave and what composition to prioritize.",
          "If the image might later become a lip-sync or singing video, ask for a clear front-facing portrait with an unobstructed face."
        ],
        bullets: ["Social post", "Album cover", "Phone wallpaper", "Desktop wallpaper", "Source portrait for animation", "Music avatar"]
      }
    ],
    workflow: [
      "Define the singer and genre",
      "Choose a specific performance moment",
      "Add lighting, setting, and camera direction",
      "Finish with style and output format"
    ],
    tips: [
      "Put the singer type near the start of the prompt.",
      "Use one specific performance moment instead of a generic pose.",
      "Match lighting and camera language to the music genre.",
      "State the final format at the end of the prompt."
    ],
    templateLinks: [
      {
        href: "/ai-image-maker",
        label: "Create a singer image",
        description: "Turn one of the prompt structures in this guide into a singer portrait, music visual, or source image."
      },
      {
        href: "/docs/ai-image-maker",
        label: "AI Image Maker docs",
        description: "Learn how to generate and refine images with prompts and references in Vismuse."
      },
      {
        href: "/docs/album-cover-generator",
        label: "Album Cover Generator docs",
        description: "Move from a singer portrait to square release artwork with genre-aware composition."
      }
    ],
    relatedTools: [
      { href: "/tools/ai-image-maker", label: "AI Image Maker" },
      { href: "/tools/album-cover-generator", label: "AI Album Cover Generator" },
      { href: "/tools/ai-wallpaper-generator", label: "AI Wallpaper Generator" }
    ]
  },
  {
    slug: "how-to-make-a-real-estate-flyer-with-ai",
    title: "How to Make a Real Estate Flyer with AI",
    image: {
      src: "/assets/visual-templates/ai-flyer-generator/for-sale-flyer.png",
      alt: "AI-generated for-sale real estate flyer example"
    },
    description:
      "Learn how to make a real estate flyer with AI for a listing, open house, or agent promotion, with layout guidance, prompts, sizes, and a final checklist.",
    h1: "How to make a real estate flyer with AI",
    lede:
      "Create listing, open house, and agent flyers from a focused brief, with clear layouts for print and social media.",
    category: "Real estate flyer guide",
    homeCategory: "Marketing",
    toolHref: "/ai-flyer-generator",
    toolLabel: "Create a real estate flyer",
    sourceUseCase: "ai-flyer-generator",
    sections: [
      {
        title: "Write the copy in reading order",
        paragraphs: [
          "Draft the text as a short stack before thinking about colors: headline, supporting line, key facts, and call to action. This makes the intended reading order explicit instead of asking the AI to arrange a paragraph.",
          "Keep the headline to one idea and the feature list to three to five points. Move secondary details into the footer so they do not compete with the property or event message."
        ],
        bullets: ["Headline", "Supporting line", "Key facts", "Call to action", "Contact footer"]
      },
      {
        title: "Build the layout around one dominant photo",
        paragraphs: [
          "Choose the image that best supports the campaign: an exterior for curb appeal, an interior for a standout feature, or an agent portrait for a service promotion. Ask for a crop that preserves the building and leaves a quiet area for text.",
          "Separate the design into clear zones for the hero image, main message, facts, and contact block. Avoid placing copy over busy architecture or squeezing several equal-size photos into the top half."
        ],
        bullets: ["Hero image", "Message zone", "Facts block", "Contact footer"]
      },
      {
        title: "Revise the draft in two passes",
        paragraphs: [
          "Use the first revision pass for composition: crop, spacing, visual priority, and contrast. Do not spend time polishing colors while the headline or event details are still hard to find.",
          "Use the second pass for typography and exact copy. Request specific replacements instead of regenerating the whole concept, then move to the final checklist."
        ]
      }
    ],
    workflow: [
      "Select the campaign type",
      "Draft the copy stack",
      "Choose the main photo and format",
      "Generate and revise in two passes",
      "Complete the publishing checklist"
    ],
    tips: [
      "Write short blocks instead of supplying one long paragraph.",
      "Choose one photo to carry the first impression.",
      "Fix hierarchy before styling details.",
      "Request exact copy replacements during the final revision pass."
    ],
    templateLinks: [
      {
        href: "/templates/flyers",
        label: "Browse flyer templates",
        description: "Explore flyer structures and visual directions before writing your own real estate brief."
      },
      {
        href: "/docs/ai-flyer-prompts",
        label: "25 AI flyer prompts",
        description: "Copy ready-to-customize prompts for real estate, events, services, sales, restaurants, and community campaigns."
      },
      {
        href: "/docs/flyer-generator",
        label: "AI Flyer Generator docs",
        description: "Learn the broader Vismuse flyer workflow, editing process, downloads, and supported formats."
      },
      {
        href: "/tools/ai-flyer-generator",
        label: "AI Flyer Generator",
        description: "Review the flyer generator features, examples, workflow, and frequently asked questions."
      }
    ],
    relatedTools: [
      { href: "/tools/ai-flyer-generator", label: "AI Flyer Generator" },
      { href: "/templates/flyers", label: "Flyer Templates" },
      { href: "/tools/ai-image-maker", label: "AI Image Maker" }
    ]
  },
  {
    slug: "ai-image-maker",
    title: "AI Image Maker Docs",
    image: {
      src: "/assets/visual-templates/ai-image-maker/ai-image-maker-hero.png",
      alt: "AI Image Maker example artwork"
    },
    description:
      "Learn how to use Vismuse AI Image Maker to create images, posters, profile visuals, product concepts, and custom graphics from prompts and references.",
    h1: "AI Image Maker documentation",
    lede:
      "Use AI Image Maker when you want a flexible visual workspace for prompts, references, ideas, posters, profile images, and custom creative directions.",
    category: "General image creation",
    homeCategory: "Design",
    toolHref: "/ai-image-maker",
    toolLabel: "Open AI Image Maker",
    sourceUseCase: "ai-image-maker",
    sections: [
      {
        title: "When to use it",
        paragraphs: [
          "AI Image Maker is the broadest Vismuse entry point. It is useful when your request does not fit a specific generator, or when you want to explore a visual idea before choosing a more focused workflow.",
          "It works well for custom graphics, posters, profile pictures, concept art, background images, social visuals, and early creative exploration."
        ]
      },
      {
        title: "Supported inputs",
        paragraphs: [
          "Start with a short prompt, a longer creative brief, a reference image, product details, style notes, or a mix of these. Clear subject, composition, mood, size, and usage context usually lead to better results."
        ],
        bullets: ["Prompt or creative brief", "Reference image or source image", "Style, color, and format notes", "Audience or publishing context"]
      },
      {
        title: "What Vismuse generates",
        paragraphs: [
          "Vismuse creates a first visual result and keeps the work inside the same browser workspace so you can revise the image, change the direction, or generate a related version without starting over."
        ],
        bullets: ["AI-generated image", "Editable follow-up direction", "Saved project context", "Downloadable visual asset"]
      }
    ],
    workflow: ["Describe the image you want", "Add format, style, and reference details", "Generate a first image", "Refine the result with follow-up instructions"],
    tips: [
      "Name the main subject before describing the background.",
      "Say where the image will be used, such as poster, profile picture, wallpaper, or social post.",
      "Use revision prompts for small changes instead of rewriting the whole brief."
    ],
    templateLinks: [
      {
        href: "/library",
        label: "Browse image examples",
        description: "Open the template library when you want prompt patterns, remixable examples, and image starting points."
      },
      {
        href: "/ai-image-maker",
        label: "Create a custom image",
        description: "Start from a broad image idea, reference, prompt, or creative brief in AI Image Maker."
      }
    ],
    specializedLinks: [
      {
        href: "/docs/product-ad-image-generator",
        label: "Product ad images",
        description: "Use this workflow when products, ecommerce scenes, product backgrounds, and campaign images matter."
      },
      {
        href: "/docs/background-remover",
        label: "Background remover",
        description: "Use this workflow when you need transparent backgrounds, white backgrounds, product cutouts, or cleaner source images."
      },
      {
        href: "/docs/flyer-generator",
        label: "Flyers and promotions",
        description: "Use this workflow for event flyers, real estate flyers, birthday flyers, local offers, and business promos."
      },
      {
        href: "/docs/album-cover-generator",
        label: "Album covers",
        description: "Use this workflow for square music release artwork, single covers, mixtape covers, and playlist visuals."
      },
      {
        href: "/docs/book-cover-generator",
        label: "Book covers",
        description: "Use this workflow for ebook covers, Kindle covers, paperbacks, genre fiction, nonfiction, and self-publishing visuals."
      },
      {
        href: "/docs/logo-generator",
        label: "Logo generator",
        description: "Use this workflow for AI logo concepts, brand marks, monograms, badges, and small business logo directions."
      },
      {
        href: "/docs/sticker-generator",
        label: "Stickers",
        description: "Use this workflow for sticker sheets, reaction stickers, mascots, merch ideas, and small image assets."
      },
      {
        href: "/docs/wallpaper-generator",
        label: "Wallpapers",
        description: "Use this workflow for phone wallpapers, lock screens, desktop backgrounds, and aesthetic scenes."
      },
      {
        href: "/docs/templates-and-library",
        label: "Templates and library",
        description: "Use templates when you want examples, reusable prompt structures, or a remixable starting point."
      }
    ],
    relatedTools: [
      { href: "/tools/background-remover", label: "Background Remover" },
      { href: "/tools/ai-product-ad-image-generator", label: "Product Ad Generator" },
      { href: "/tools/ai-flyer-generator", label: "AI Flyer Generator" },
      { href: "/tools/album-cover-generator", label: "AI Album Cover Generator" },
      { href: "/tools/ai-book-cover-generator", label: "AI Book Cover Generator" }
    ]
  },
  {
    slug: "background-remover",
    title: "Background Remover Docs",
    image: {
      src: "/assets/background-remover/better-workflow-product-cutout.png",
      alt: "Product cutout prepared with Background Remover"
    },
    description:
      "Learn how to remove image backgrounds, create transparent or white backgrounds, prepare product cutouts, and keep editing cleaned images with Vismuse.",
    h1: "Background Remover documentation",
    lede:
      "Use Background Remover when you need to isolate the main subject, clean up a busy source photo, create a transparent-style cutout, or prepare a white background product image.",
    category: "Background editing",
    homeCategory: "Photography",
    toolHref: "/background-remover",
    toolLabel: "Open Background Remover",
    sourceUseCase: "background-remover",
    sections: [
      {
        title: "When to use it",
        paragraphs: [
          "Use this workflow for product photos, portraits, logos, object photos, profile images, and ecommerce pictures that need a cleaner background.",
          "It is useful as a first cleanup step before creating product ads, catalog images, marketplace visuals, or a new generated background around the same subject."
        ]
      },
      {
        title: "Supported inputs",
        paragraphs: [
          "Start with an uploaded image and optionally describe what you want after removal. Mention transparent background, white background, color background, or a new product scene when that final output matters."
        ],
        bullets: ["Product photo or object image", "Portrait, logo, or graphic", "Transparent or white background preference", "Optional follow-up background direction"]
      },
      {
        title: "What Vismuse generates",
        paragraphs: [
          "Vismuse creates a cleaned image direction that keeps the main subject sharp and lets you continue editing, change background color, create a product scene, or download the result."
        ],
        bullets: ["Clean cutouts", "Transparent-style results", "White background product images", "Editable follow-up background directions"]
      }
    ],
    workflow: ["Upload the source image", "Remove the background", "Choose transparent, white, color, or generated background", "Download or keep refining"],
    tips: [
      "Use clear source photos where the subject edge is visible.",
      "Say if the output needs a white marketplace background or a transparent-style result.",
      "After removal, use a follow-up prompt to create a new scene around the same subject."
    ],
    templateLinks: [
      {
        href: "/background-remover",
        label: "Remove an image background",
        description: "Open the upload-first workflow for transparent backgrounds, white backgrounds, and clean product cutouts."
      },
      {
        href: "/ai-product-ad-image-generator",
        label: "Create product ad images",
        description: "Continue from a cleaned product photo into campaign scenes, ecommerce images, and ad creatives."
      }
    ],
    relatedTools: [
      { href: "/tools/ai-image-maker", label: "AI Image Maker" },
      { href: "/tools/ai-product-ad-image-generator", label: "Product Ad Generator" },
      { href: "/library", label: "Template Library" }
    ]
  },
  {
    slug: "how-to-remove-background-from-image-on-iphone",
    title: "How to Remove Background from an Image on iPhone",
    image: {
      src: "/assets/background-remover/better-workflow-product-cutout.png",
      alt: "Product photo isolated from its background as a clean cutout"
    },
    description:
      "Learn how to remove the background from an image on iPhone using Photos, Preview, Files, or an AI background remover, then save or replace the background.",
    h1: "How to remove the background from an image on iPhone",
    lede:
      "You can remove a photo background on iPhone without a desktop editor. Use the built-in subject cutout for a quick copy, Preview on iOS 26 or later or Files for a separate background-free image, or an AI editor when you need cleaner edges or a replacement background.",
    category: "iPhone photo editing",
    homeCategory: "Photography",
    toolHref: "/background-remover?ref=iphone-background-guide",
    toolLabel: "Remove a background with Vismuse",
    sourceUseCase: "background-remover",
    sections: [
      {
        title: "The quickest answer",
        paragraphs: [
          "For a fast cutout in Photos, open the image and touch and hold the main subject until a bright outline appears. Choose Copy or Share to use the isolated subject in another app. This separates the subject for sharing, but it does not turn the original photo into a fully editable layered image.",
          "If your iPhone runs iOS 26 or later, open the image in Preview and choose Remove Background from the More menu to create a new image file. On iPhone versions that expose the command in Files, you can also touch and hold the file, choose Quick Actions, and select Remove Background. Preview is not available on iOS 18 or earlier."
        ]
      },
      {
        title: "Method 1: lift the subject in Photos",
        paragraphs: [
          "Open Photos and choose an image with one clear subject. Touch and hold the person, pet, product, or object. When the subject is outlined, choose Copy to paste it into a message, note, or design app, or choose Share to send or save the cutout.",
          "This method is best when you only need the subject for a sticker, message, presentation, or quick composition. It may not provide the file workflow or edge control you need for a product listing, logo, or reusable transparent PNG."
        ],
        bullets: [
          "Best for one clear person, pet, product, or object",
          "Fastest way to copy a subject from Photos",
          "Does not replace the background inside the original photo",
          "Fine hair, fur, glass, and low-contrast edges may need review"
        ]
      },
      {
        title: "Method 2: use Preview on iOS 26 or Files to create a separate image",
        paragraphs: [
          "On iOS 26 or later, open the image in Preview, tap the More button, and choose Remove Background. The option appears only when iPhone can detect a suitable subject. Save or share the result, then place it over another color or image to confirm that the background is actually transparent.",
          "If your iPhone offers the command in Files, first save the photo to Files. Touch and hold the file, open Quick Actions, and choose Remove Background. iPhone creates a separate result so you can keep the original nearby."
        ],
        bullets: [
          "Keep the original until you verify the exported result",
          "Check whether the saved file preserves transparency",
          "Zoom in around hair, hands, product handles, and narrow gaps",
          "Try a higher-contrast source photo if iPhone cannot find the subject"
        ]
      },
      {
        title: "Method 3: remove or replace the background with AI",
        paragraphs: [
          "Use an AI background remover when the built-in cutout misses part of the subject, when you want a white or colored background, or when the finished image needs a new setting. Open Vismuse on your iPhone, upload the photo, and describe both what should change and what must stay the same.",
          "Be specific about the final use. A marketplace product photo may need clean white, centered spacing, and a subtle contact shadow. A profile photo may need a calm studio color while preserving the face, hair, clothing, and expression. Compare the result with the source before downloading."
        ],
        example: {
          label: "Example iPhone background-removal prompt",
          prompt: "Remove the existing background and create a transparent cutout. Keep the person’s face, hair, clothing, pose, colors, and crop unchanged. Preserve natural soft edges around the hair."
        }
      },
      {
        title: "Choose the right method for the result you need",
        paragraphs: [
          "Use Photos subject lift when speed matters and you only need to copy the subject. Use Preview or Files when you want a separate cutout file. Use an AI editor when you need to refine difficult edges, replace the background, add a natural shadow, or continue editing through follow-up instructions.",
          "Removing a background and removing an unwanted person are different edits. Background removal keeps the chosen subject and discards everything around it. If you want to keep the original scene but erase a person standing in it, use an object-removal or cleanup workflow instead."
        ]
      },
      {
        title: "Common iPhone background-removal problems",
        paragraphs: [
          "If no outline or Remove Background command appears, iPhone may not detect a clear subject. Try a brighter image, crop closer to the subject, or use an AI editor that accepts a written instruction.",
          "If the result has a white background instead of transparency, check it over a colored canvas. Some previews display transparent areas as white, while some file formats cannot store transparency. Export as PNG when you need a transparent background.",
          "If edges look rough, return to the highest-quality original. Screenshots and compressed social images give the editor fewer edge details to work with."
        ]
      }
    ],
    workflow: [
      "Choose whether you need a copied subject, a transparent file, or a replacement background",
      "Try Photos subject lift or the Remove Background command in Preview or Files",
      "Use Vismuse for difficult edges, a white or colored background, or a new scene",
      "Inspect the subject at full size and verify transparency before using the image"
    ],
    tips: [
      "Start from the original photo instead of a screenshot whenever possible.",
      "Use PNG when the final image must preserve a transparent background.",
      "Describe the face, text, logo, colors, and proportions that must remain unchanged.",
      "Check fine hair, fur, glass, spokes, handles, and shadows at full size.",
      "Keep the source photo until the exported file works in its final destination."
    ],
    templateLinks: [
      {
        href: "/docs/background-remover",
        label: "Background Remover documentation",
        description: "Learn the complete Vismuse workflow for transparent, white, colored, and generated backgrounds."
      },
      {
        href: "/docs/how-to-remove-people-from-pictures-on-iphone",
        label: "Remove people from pictures on iPhone",
        description: "Keep the scene and erase an unwanted person instead of removing the whole background."
      },
      {
        href: "https://support.apple.com/en-us/102460",
        label: "Apple photo cutout instructions",
        description: "Review Apple’s current steps and device requirements for lifting a subject from a photo."
      }
    ],
    relatedTools: [
      { href: "/tools/background-remover", label: "Background Remover" },
      { href: "/tools/ai-image-maker", label: "AI Image Maker" },
      { href: "/tools/ai-product-ad-image-generator", label: "Product Ad Generator" }
    ]
  },
  {
    slug: "how-to-remove-people-from-pictures-on-iphone",
    title: "How to Remove People from Pictures on iPhone",
    image: {
      src: "/assets/articles/iphone-photo-editing/remove-people-before-after.webp",
      alt: "Before-and-after travel photo showing an unwanted passerby removed from the scene"
    },
    description:
      "Learn how to remove people from pictures on iPhone with Clean Up, cropping, or AI, including options for older iPhones and difficult backgrounds.",
    h1: "How to remove people from pictures on iPhone",
    lede:
      "To erase a person while keeping the rest of the scene, use Clean Up in Photos on a supported iPhone, crop someone near the edge, or upload the photo to an AI editor and describe exactly who should disappear.",
    category: "iPhone photo editing",
    homeCategory: "Photography",
    toolHref: "/ai-image-maker?ref=iphone-people-removal-guide",
    toolLabel: "Remove a person with AI Image Maker",
    sourceUseCase: "ai-image-maker",
    sections: [
      {
        title: "The quickest answer",
        paragraphs: [
          "On an Apple Intelligence-enabled iPhone, open the picture in Photos, tap Edit, open Tools, and choose Clean Up. Tap, brush over, or circle the person you want to remove, then inspect the reconstructed background before saving.",
          "If Clean Up is missing, the device, iOS version, language, or region may not support it. You can still crop a person near the edge or use a browser-based AI editor on the iPhone without installing a traditional desktop editor."
        ]
      },
      {
        title: "Method 1: remove a person with Clean Up in Photos",
        paragraphs: [
          "Choose the photo in Photos and enter Edit mode. Open Tools, select Clean Up, then tap a highlighted distraction or brush around the person. Pinch to zoom when you need a more accurate selection. Use Undo if the tool removes part of the person or object you want to keep.",
          "Clean Up works best when the unwanted person is smaller, is separated from the main subject, and stands in front of a background with repeatable texture such as sky, sand, water, grass, or a simple wall. A person covering a face, sign, patterned building, or important object gives the tool less information for rebuilding the hidden area."
        ],
        bullets: [
          "Select only the unwanted person and their visible shadow when necessary",
          "Work in several smaller passes instead of one oversized brush stroke",
          "Zoom in to check hands, hair, railings, text, and straight lines",
          "Use Reset if you save the edit and later want to restore the original"
        ]
      },
      {
        title: "Method 2: crop someone out of the picture",
        paragraphs: [
          "Cropping is often the cleanest fix when the unwanted person is close to an edge. Open Edit, choose Crop, and tighten the frame without cutting into the main subject. Straighten the horizon and keep enough space around faces, feet, products, or buildings.",
          "Cropping cannot help when the person is in the center or when removing them would make the composition too tight. In those cases, use Clean Up or an AI editor that can rebuild the covered background."
        ]
      },
      {
        title: "Method 3: remove people with an AI editor on iPhone",
        paragraphs: [
          "Open Vismuse AI Image Maker in Safari or another mobile browser, upload the picture, and identify the unwanted person by position, clothing, or another visible detail. State what must remain unchanged so the edit does not accidentally replace the main subject, alter faces, or redesign the whole image.",
          "AI removal is especially useful on an older iPhone without Clean Up, or when you want to describe a precise target in words. It still has to invent whatever was hidden behind the person, so review the result carefully and try a more specific follow-up if the first reconstruction looks unnatural."
        ],
        example: {
          label: "Example people-removal prompt",
          prompt: "Remove only the person in the red jacket standing at the far left. Reconstruct the sidewalk and wall behind them. Keep the couple in the center, every face, the lighting, colors, crop, and all other details unchanged."
        }
      },
      {
        title: "How to get a more natural result",
        paragraphs: [
          "Describe one person at a time when the picture contains a crowd. Use unambiguous details such as left or right, clothing color, distance from the camera, or nearby objects. Avoid instructions like ‘remove the background people’ if some background people should stay.",
          "Check the repaired area for repeated limbs, broken railings, bent architecture, duplicated texture, missing shadows, and altered text. If the background is complex, ask for a second pass that changes only the repaired area instead of regenerating the full photo."
        ],
        bullets: [
          "Name the person by location and visible clothing",
          "Say which people and objects must remain",
          "Include the unwanted person’s shadow if it should also disappear",
          "Preserve faces, text, logos, perspective, lighting, and crop",
          "Compare the edited picture with the original before sharing it"
        ]
      },
      {
        title: "Removing a person from the picture is not the same as hiding them in Photos",
        paragraphs: [
          "This guide is about erasing a visible person from the pixels of one picture. The People & Pets collection in Photos is different: it groups photos by recognized faces. Hiding, featuring less, renaming, or removing someone from that collection does not erase them from the underlying pictures.",
          "If your goal is to stop seeing someone in memories or suggestions, use the People & Pets controls instead. If your goal is to remove every photo containing someone, review the matched photos before deleting anything; face recognition can include mistakes."
        ]
      },
      {
        title: "Why Clean Up may be missing or give a poor result",
        paragraphs: [
          "Clean Up depends on a supported Apple Intelligence device, current software, and regional and language availability. If the button is absent, check Apple’s current requirements rather than repeatedly editing the same photo.",
          "A poor result usually means the person hides too much unique detail, overlaps the main subject, or sits in front of text, faces, reflections, or irregular architecture. Try a smaller selection, crop the photo, use a higher-resolution original, or describe the missing background to an AI editor."
        ]
      }
    ],
    workflow: [
      "Decide whether cropping can remove the person without hurting the composition",
      "Use Clean Up on a supported iPhone or upload the image to an AI editor",
      "Identify one unwanted person precisely and name everything that must stay",
      "Inspect the rebuilt background, edges, shadows, faces, text, and straight lines",
      "Keep the original until you are satisfied with the edited copy"
    ],
    tips: [
      "Remove one person at a time in a crowded image.",
      "Use location and clothing instead of vague phrases such as ‘that person.’",
      "Include a shadow or reflection only when it belongs to the person being removed.",
      "Do not assume an AI reconstruction is historically accurate; it invents hidden pixels.",
      "Avoid uploading private or sensitive photos unless you are comfortable with the service’s privacy terms."
    ],
    templateLinks: [
      {
        href: "/docs/ai-image-maker",
        label: "AI Image Maker documentation",
        description: "Learn how to upload an image, describe a precise edit, and refine the result through follow-up prompts."
      },
      {
        href: "/docs/how-to-remove-background-from-image-on-iphone",
        label: "Remove an image background on iPhone",
        description: "Isolate the main subject when you want to remove the entire background instead."
      },
      {
        href: "https://support.apple.com/guide/iphone/xy0grrlxue5w/ios",
        label: "Apple Clean Up instructions",
        description: "Check Apple’s current Clean Up steps, supported devices, languages, and regions."
      }
    ],
    relatedTools: [
      { href: "/tools/ai-image-maker", label: "AI Image Maker" },
      { href: "/tools/background-remover", label: "Background Remover" },
      { href: "/tools/ai-image-text-editor", label: "AI Image Text Editor" }
    ]
  },
  {
    slug: "product-ad-image-generator",
    title: "Product Ad Image Generator Docs",
    image: {
      src: "/assets/visual-templates/ai-image-maker/product-ad.png",
      alt: "Red headphone product advertising template used in the Product Ad guide"
    },
    description:
      "Learn how to create product ad images, campaign images, ecommerce creatives, and product-aware promo graphics with Vismuse.",
    h1: "Product Ad Image Generator documentation",
    lede:
      "Use Product Ad Image Generator when the product needs to remain recognizable while the scene, background, offer, or campaign direction becomes more polished.",
    category: "Product and ecommerce images",
    homeCategory: "Business",
    toolHref: "/ai-product-ad-image-generator",
    toolLabel: "Open Product Ad Generator",
    sourceUseCase: "ai-product-ad-image-generator",
    sections: [
      {
        title: "When to use it",
        paragraphs: [
          "Use this workflow for ecommerce images, launch creatives, product backgrounds, paid social concepts, and campaign visuals where the item is the center of the composition.",
          "It is better than the general image maker when the product itself, offer, audience, or platform format matters."
        ]
      },
      {
        title: "Supported inputs",
        paragraphs: [
          "You can start from a product photo, product URL, written product description, campaign brief, or ad concept. Add audience, mood, platform, and any text-space requirements when they matter."
        ],
        bullets: ["Product image or product URL", "Product name and key benefits", "Campaign goal or offer", "Background, lighting, and prop direction"]
      },
      {
        title: "What Vismuse generates",
        paragraphs: [
          "Vismuse generates product-aware ad images that can be used as a campaign starting point. You can then revise background, crop, lighting, copy space, or scene details."
        ],
        bullets: ["Product ad images", "Product background concepts", "Launch images", "Social ad creative drafts"]
      }
    ],
    workflow: ["Upload or describe the product", "Add campaign context and audience", "Choose the scene or ad direction", "Generate and refine the product image"],
    tips: [
      "Mention if the product must stay centered or keep its original shape.",
      "Describe the buyer and platform before asking for props or background details.",
      "Leave clear space if you plan to add headline text later."
    ],
    templateLinks: [
      {
        href: "/library?category=Product%20Ads",
        label: "Browse product ad examples",
        description: "Remix product ad prompts for ecommerce images, AI photoshoots, launch images, and product backgrounds."
      },
      {
        href: "/ai-product-ad-image-generator",
        label: "Create product ad images",
        description: "Open the generator with product ad defaults and campaign-focused examples."
      }
    ],
    relatedTools: [
      { href: "/tools/ai-product-ad-image-generator", label: "Product Ad Generator" },
      { href: "/tools/ai-image-maker", label: "AI Image Maker" },
      { href: "/tools/ai-flyer-generator", label: "AI Flyer Generator" },
      { href: "/library", label: "Template Library" }
    ]
  },
  {
    slug: "flyer-generator",
    title: "How to Make a Flyer With AI: Step-by-Step Guide",
    image: {
      src: "/assets/visual-templates/ai-flyer-generator/business-flyer.png",
      alt: "AI-generated business flyer with a clear headline, service details, and call to action"
    },
    description:
      "Learn how to make a flyer with AI: prepare exact copy and images, write a clear prompt, revise text and layout in chat, then export the final design.",
    h1: "How to make a flyer with AI: a step-by-step guide",
    lede:
      "Create an event, business, sale, or real estate flyer from a short brief, then refine the text, layout, colors, and images in chat—no design editor required.",
    category: "Flyers and promotions",
    homeCategory: "Marketing",
    toolHref: "/ai-flyer-generator",
    toolLabel: "Make a flyer with AI",
    sourceUseCase: "ai-flyer-generator",
    sections: [],
    workflow: [],
    tips: [],
    templateLinks: [
      {
        href: "/tools/ai-flyer-generator",
        label: "AI Flyer Generator overview",
        description: "See the product workflow, flyer examples, supported outputs, and answers to common questions."
      },
      {
        href: "/ai-flyer-generator",
        label: "Create a flyer in Vismuse",
        description: "Send your brief, review the first result, and request focused changes in the same conversation."
      },
      {
        href: "/docs/edit-flyer-with-ai",
        label: "Edit a flyer with AI",
        description: "Learn how to correct copy, replace images, simplify a layout, and create new formats through chat."
      },
      {
        href: "/docs/how-to-make-an-event-flyer-with-ai",
        label: "How to make an event flyer",
        description: "Build a clear event flyer around the date, venue, admission details, and one attendance action."
      },
      {
        href: "/docs/how-to-make-a-restaurant-flyer-with-ai",
        label: "How to make a restaurant flyer",
        description: "Promote one dish, offer, opening, or catering service with clear prices and ordering details."
      },
      {
        href: "/docs/how-to-make-a-business-flyer-with-ai",
        label: "How to make a business flyer",
        description: "Turn one service, offer, launch, or hiring need into a clear promotion with verified business details."
      },
      {
        href: "/docs/how-to-make-a-birthday-flyer-with-ai",
        label: "How to make a birthday flyer",
        description: "Create a clear party invitation with the name, milestone, date, venue, RSVP, and an approved photo."
      },
      {
        href: "/docs/how-to-make-a-party-flyer-with-ai",
        label: "How to make a party flyer",
        description: "Plan a house party, pool party, block party, or club night around verified details and one clear next step."
      },
      {
        href: "/docs/how-to-make-a-funeral-flyer-with-ai",
        label: "How to make a funeral flyer",
        description: "Prepare a memorial announcement with clear service details, family-chosen wording, and a familiar portrait."
      },
      {
        href: "/docs/ai-flyer-prompts",
        label: "25 AI flyer prompts",
        description: "Copy focused prompts for events, businesses, sales, restaurants, real estate, classes, and community campaigns."
      },
      {
        href: "/templates/flyers",
        label: "Flyer templates",
        description: "Browse remixable directions for parties, businesses, sales, real estate, restaurants, and local events."
      },
      {
        href: "/docs/how-to-make-a-real-estate-flyer-with-ai",
        label: "Real estate flyer guide",
        description: "Plan listing, open house, and agent flyers around verified facts and approved property photos."
      },
      {
        href: "/tools/party-flyer-generator",
        label: "Party Flyer Generator",
        description: "Explore a focused workflow for birthdays, music nights, celebrations, and other social events."
      }
    ],
    relatedTools: [
      { href: "/tools/ai-flyer-generator", label: "AI Flyer Generator" },
      { href: "/tools/ai-image-maker", label: "AI Image Maker" },
      { href: "/tools/ai-product-ad-image-generator", label: "Product Ad Generator" },
      { href: "/library", label: "Template Library" }
    ]
  },
  {
    slug: "how-to-make-an-event-flyer-with-ai",
    title: "How to Make an Event Flyer With AI: Step-by-Step Guide",
    image: {
      src: "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-flyer-generator/user-demand-20260710/ai-flyer-generator-user-demand-cultural-festival_thumb.webp",
      alt: "AI-generated cultural event flyer with a clear event name, date, location, and admission details"
    },
    description:
      "Learn how to make an event flyer with AI: organize the date, venue, ticket details, and exact copy, then generate and revise the design through chat.",
    h1: "How to make an event flyer with AI: a step-by-step guide",
    lede:
      "Create a flyer for a concert, community event, workshop, sports event, or venue promotion, then refine the copy, hierarchy, images, and format in chat—no design editor required.",
    category: "Event flyers",
    homeCategory: "Marketing",
    toolHref: "/ai-flyer-generator",
    toolLabel: "Make an event flyer with AI",
    sourceUseCase: "ai-flyer-generator",
    sections: [],
    workflow: [],
    tips: [],
    templateLinks: [
      {
        href: "/tools/ai-flyer-generator",
        label: "AI Flyer Generator",
        description: "See how the chat-based flyer maker creates and revises event flyers without a traditional canvas."
      },
      {
        href: "/ai-flyer-generator",
        label: "Create an event flyer in Vismuse",
        description: "Send your event details, review the first draft, and request focused changes in the same conversation."
      },
      {
        href: "/docs/ai-flyer-prompts",
        label: "25 AI flyer prompts",
        description: "Copy prompt patterns for concerts, community events, sports, workshops, and other promotions."
      },
      {
        href: "/docs/edit-flyer-with-ai",
        label: "Edit a flyer with AI",
        description: "Correct copy, change visual priority, replace an image, or adapt a flyer to another format through chat."
      },
      {
        href: "/templates/flyers",
        label: "Flyer templates",
        description: "Browse visual directions for events, parties, businesses, restaurants, real estate, and local campaigns."
      },
      {
        href: "/tools/party-flyer-generator",
        label: "Party Flyer Generator",
        description: "Explore a focused workflow for birthdays, club nights, celebrations, and social events."
      },
      {
        href: "/docs/flyer-generator",
        label: "How to make a flyer with AI",
        description: "Read the broader workflow for planning, generating, reviewing, and exporting any type of flyer."
      }
    ],
    relatedTools: [
      { href: "/tools/ai-flyer-generator", label: "AI Flyer Generator" },
      { href: "/tools/party-flyer-generator", label: "Party Flyer Generator" },
      { href: "/templates/flyers", label: "Flyer Templates" }
    ]
  },
  {
    slug: "how-to-make-a-restaurant-flyer-with-ai",
    title: "How to Make a Restaurant Flyer With AI: Step-by-Step Guide",
    image: {
      src: "/assets/visual-templates/ai-flyer-generator/flyer-workflow-final_thumb.jpg",
      alt: "AI-generated restaurant flyer with an appetizing food photo, prominent price, and clear ordering details"
    },
    description:
      "Learn how to make a restaurant flyer with AI: organize the offer, price, food photo, and ordering details, then generate and revise the design through chat.",
    h1: "How to make a restaurant flyer with AI: a step-by-step guide",
    lede:
      "Create a restaurant flyer for a special, grand opening, delivery offer, pop-up, or catering service, then refine the copy, price, image, and ordering details in chat—no design editor required.",
    category: "Restaurant flyers",
    homeCategory: "Marketing",
    toolHref: "/ai-flyer-generator",
    toolLabel: "Make a restaurant flyer with AI",
    sourceUseCase: "ai-flyer-generator",
    sections: [],
    workflow: [],
    tips: [],
    templateLinks: [
      {
        href: "/tools/ai-flyer-generator",
        label: "AI Flyer Generator",
        description: "See how the chat-based flyer maker creates and revises restaurant promotion flyers without a traditional canvas."
      },
      {
        href: "/ai-flyer-generator",
        label: "Create a restaurant flyer in Vismuse",
        description: "Send the offer and approved food photo, review the first draft, and request focused changes in the same conversation."
      },
      {
        href: "/docs/ai-flyer-prompts",
        label: "25 AI flyer prompts",
        description: "Copy prompt patterns for restaurant specials, cafés, sales, events, services, and local promotions."
      },
      {
        href: "/docs/edit-flyer-with-ai",
        label: "Edit a flyer with AI",
        description: "Correct a price, change visual priority, replace a photo, or adapt a flyer through chat."
      },
      {
        href: "/templates/flyers",
        label: "Flyer templates",
        description: "Browse visual directions for restaurants, events, parties, businesses, and local campaigns."
      },
      {
        href: "/docs/flyer-generator",
        label: "How to make a flyer with AI",
        description: "Read the broader workflow for planning, generating, reviewing, and exporting any type of flyer."
      }
    ],
    relatedTools: [
      { href: "/tools/ai-flyer-generator", label: "AI Flyer Generator" },
      { href: "/tools/ai-menu-generator", label: "AI Menu Generator" },
      { href: "/templates/flyers", label: "Flyer Templates" }
    ]
  },
  {
    slug: "how-to-make-a-business-flyer-with-ai",
    title: "How to Make a Business Flyer With AI: Step-by-Step Guide",
    image: {
      src: "/assets/visual-templates/ai-flyer-generator/business-flyer.png",
      alt: "AI-generated business flyer with a clear offer, service details, branding, and call to action"
    },
    description:
      "Learn how to make a business flyer with AI: organize the offer, exact copy, brand assets, and call to action, then generate and revise the design through chat.",
    h1: "How to make a business flyer with AI: a step-by-step guide",
    lede:
      "Create a business flyer for a local service, retail promotion, product launch, opening, or hiring campaign, then refine the copy, hierarchy, branding, and contact details in chat—no design editor required.",
    category: "Business flyers",
    homeCategory: "Marketing",
    toolHref: "/ai-flyer-generator",
    toolLabel: "Make a business flyer with AI",
    sourceUseCase: "ai-flyer-generator",
    sections: [],
    workflow: [],
    tips: [],
    templateLinks: [
      {
        href: "/tools/ai-flyer-generator",
        label: "AI Flyer Generator",
        description: "See how the chat-based flyer maker creates and revises business promotions without a traditional canvas."
      },
      {
        href: "/ai-flyer-generator",
        label: "Create a business flyer in Vismuse",
        description: "Send the campaign details and approved assets, review the first draft, and request focused changes in chat."
      },
      {
        href: "/docs/ai-flyer-prompts",
        label: "25 AI flyer prompts",
        description: "Copy prompt patterns for local services, product launches, hiring, sales, events, and other promotions."
      },
      {
        href: "/docs/edit-flyer-with-ai",
        label: "Edit a flyer with AI",
        description: "Correct business details, change visual priority, replace an image, or adapt a flyer through chat."
      },
      {
        href: "/templates/flyers",
        label: "Flyer templates",
        description: "Browse visual directions for businesses, services, sales, restaurants, events, and local campaigns."
      },
      {
        href: "/docs/flyer-generator",
        label: "How to make a flyer with AI",
        description: "Read the broader workflow for planning, generating, reviewing, and exporting any type of flyer."
      }
    ],
    relatedTools: [
      { href: "/tools/ai-flyer-generator", label: "AI Flyer Generator" },
      { href: "/tools/ai-product-ad-image-generator", label: "Product Ad Generator" },
      { href: "/templates/flyers", label: "Flyer Templates" }
    ]
  },
  {
    slug: "how-to-make-a-birthday-flyer-with-ai",
    title: "How to Make a Birthday Flyer With AI: Step-by-Step Guide",
    image: {
      src: "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-flyer-generator/user-demand-20260710/ai-flyer-generator-user-demand-luxury-birthday-party_thumb.webp",
      alt: "AI-generated birthday party flyer with a portrait, milestone age, event details, and RSVP information"
    },
    description:
      "Learn how to make a birthday flyer with AI: organize the name, age, date, venue, RSVP, and photo, then generate and revise the design through chat.",
    h1: "How to make a birthday flyer with AI: a step-by-step guide",
    lede:
      "Create a birthday flyer for a children's party, Sweet 16, milestone celebration, or birthday bash, then refine the copy, photo, theme, and RSVP details in chat—no design editor required.",
    category: "Birthday flyers",
    homeCategory: "Marketing",
    toolHref: "/ai-flyer-generator",
    toolLabel: "Make a birthday flyer with AI",
    sourceUseCase: "ai-flyer-generator",
    sections: [],
    workflow: [],
    tips: [],
    templateLinks: [
      {
        href: "/tools/ai-flyer-generator",
        label: "AI Flyer Generator",
        description: "See how the chat-based flyer maker creates and revises birthday invitations without a traditional canvas."
      },
      {
        href: "/ai-flyer-generator",
        label: "Create a birthday flyer in Vismuse",
        description: "Send the party details and approved photo, review the first draft, and request focused changes in chat."
      },
      {
        href: "/docs/ai-flyer-prompts",
        label: "25 AI flyer prompts",
        description: "Copy prompt patterns for birthdays, parties, events, businesses, restaurants, and other promotions."
      },
      {
        href: "/docs/edit-flyer-with-ai",
        label: "Edit a flyer with AI",
        description: "Correct a date, update the venue, replace a photo, or adapt a birthday flyer through chat."
      },
      {
        href: "/templates/flyers",
        label: "Flyer templates",
        description: "Browse visual directions for birthdays, parties, events, businesses, and local celebrations."
      },
      {
        href: "/tools/party-flyer-generator",
        label: "Party Flyer Generator",
        description: "Explore a focused workflow for birthday parties, club nights, celebrations, and social events."
      },
      {
        href: "/docs/how-to-make-an-event-flyer-with-ai",
        label: "How to make an event flyer",
        description: "Plan a broader public or ticketed event around verified details and one clear attendance action."
      },
      {
        href: "/docs/flyer-generator",
        label: "How to make a flyer with AI",
        description: "Read the broader workflow for planning, generating, reviewing, and exporting any type of flyer."
      }
    ],
    relatedTools: [
      { href: "/tools/ai-flyer-generator", label: "AI Flyer Generator" },
      { href: "/tools/party-flyer-generator", label: "Party Flyer Generator" },
      { href: "/templates/flyers", label: "Flyer Templates" }
    ]
  },
  {
    slug: "how-to-make-a-party-flyer-with-ai",
    title: "How to Make a Party Flyer With AI: Step-by-Step Guide",
    image: {
      src: "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-flyer-generator/user-demand-20260710/ai-flyer-generator-user-demand-dj-lounge-night_thumb.webp",
      alt: "AI-generated DJ lounge party flyer with a clear event title, date, venue, and RSVP or ticket details"
    },
    description:
      "Learn how to make a party flyer with AI: organize the event details, audience, theme, images, and RSVP or ticket information, then revise it through chat.",
    h1: "How to make a party flyer with AI: a step-by-step guide",
    lede:
      "Create a flyer for a house party, pool party, block party, private celebration, or club night, then refine the wording, images, visual emphasis, and format in chat—no design editor required.",
    category: "Party flyers",
    homeCategory: "Marketing",
    toolHref: "/ai-flyer-generator",
    toolLabel: "Make a party flyer with AI",
    sourceUseCase: "ai-flyer-generator",
    sections: [],
    workflow: [],
    tips: [],
    templateLinks: [
      {
        href: "/tools/party-flyer-generator",
        label: "AI Party Flyer Generator",
        description: "See examples and how the chat-based party flyer maker creates and revises a design without a traditional canvas."
      },
      {
        href: "/ai-flyer-generator",
        label: "Create a party flyer in Vismuse",
        description: "Send the event details and any photos or logos you can use, review the first draft, and request focused changes in chat."
      },
      {
        href: "/docs/ai-flyer-prompts",
        label: "25 AI flyer prompts",
        description: "Copy prompt patterns for parties, events, businesses, restaurants, real estate, and local promotions."
      },
      {
        href: "/docs/edit-flyer-with-ai",
        label: "Edit a flyer with AI",
        description: "Correct event details, clarify the RSVP or ticket information, replace an image, or adapt a party flyer through chat."
      },
      {
        href: "/docs/how-to-make-a-birthday-flyer-with-ai",
        label: "How to make a birthday flyer",
        description: "Use the birthday-specific workflow when the celebrant's name, age, milestone, photo, and RSVP lead the message."
      },
      {
        href: "/docs/how-to-make-an-event-flyer-with-ai",
        label: "How to make an event flyer",
        description: "Plan a broader public or ticketed event around verified logistics and one clear attendance action."
      },
      {
        href: "/templates/flyers",
        label: "Party flyer templates",
        description: "Browse visual directions for parties, nightlife, birthdays, events, businesses, and local campaigns."
      },
      {
        href: "/docs/flyer-generator",
        label: "How to make a flyer with AI",
        description: "Read the broader workflow for planning, generating, reviewing, and exporting any type of flyer."
      }
    ],
    relatedTools: [
      { href: "/tools/party-flyer-generator", label: "Party Flyer Generator" },
      { href: "/tools/ai-flyer-generator", label: "AI Flyer Generator" },
      { href: "/templates/flyers", label: "Flyer Templates" }
    ]
  },
  {
    slug: "how-to-make-a-funeral-flyer-with-ai",
    title: "How to Make a Funeral Flyer With AI: Wording and Prompts",
    description: "Learn how to make a funeral flyer with AI, with sample announcement wording, memorial flyer prompts, photo tips, and a simple chat editing workflow.",
    h1: "How to make a funeral flyer with AI",
    lede: "Prepare a funeral, memorial service, or celebration of life announcement with the family's wording and chosen photo, then refine the design through chat.",
    image: {
      src: "/assets/docs/funeral-flyer-layout.png",
      alt: "Funeral flyer layout illustration showing a portrait area, name, service details, and short family message"
    },
    category: "Funeral and memorial flyers",
    homeCategory: "Marketing",
    toolHref: "/ai-flyer-generator",
    toolLabel: "Create a funeral announcement",
    sourceUseCase: "ai-flyer-generator",
    sections: [],
    workflow: [],
    tips: [],
    templateLinks: [
      { href: "/tools/ai-flyer-generator", label: "AI Flyer Generator", description: "See how the flyer maker turns your wording and photo into a design you can revise through chat." },
      { href: "/docs/edit-flyer-with-ai", label: "Edit a flyer with AI", description: "Learn how to correct text, replace a photo, or adjust a layout in the same conversation." },
      { href: "/docs/ai-flyer-prompts", label: "AI flyer prompts", description: "Find more starting points for community announcements and other flyers." },
      { href: "/templates/flyers", label: "Flyer templates and examples", description: "Explore layouts and visual styles before choosing a direction for your announcement." },
      { href: "/docs/flyer-generator", label: "How to make a flyer with AI", description: "Read the general workflow for preparing, generating, reviewing, and downloading a flyer." }
    ],
    relatedTools: [
      { href: "/tools/ai-flyer-generator", label: "AI Flyer Generator" },
      { href: "/templates/flyers", label: "Flyer Templates" }
    ]
  },
  {
    slug: "edit-flyer-with-ai",
    title: "How to Edit a Flyer With AI (No Design Editor Needed)",
    image: {
      src: "/assets/visual-templates/ai-flyer-generator/flyer-workflow-final_thumb.jpg",
      alt: "AI-edited restaurant flyer with a clearer price, simpler hierarchy, and readable contact details"
    },
    description:
      "Learn how to edit a flyer online with AI: upload an existing flyer or continue from a generated one, then change text, images, colors, and layout through chat.",
    h1: "How to edit a flyer with AI (no design editor needed)",
    lede:
      "Describe what you want to change—a date, image, format, or the detail that should stand out—and Vismuse creates a revised flyer. No canvas or layers required.",
    category: "AI flyer editing",
    homeCategory: "Marketing",
    toolHref: "/ai-flyer-generator",
    toolLabel: "Edit a flyer with AI",
    sourceUseCase: "ai-flyer-generator",
    sections: [],
    workflow: [],
    tips: [],
    templateLinks: [
      {
        href: "/tools/ai-flyer-generator",
        label: "AI Flyer Generator overview",
        description: "Review the chat-based creation and editing workflow, supported outputs, examples, and FAQs."
      },
      {
        href: "/ai-flyer-generator",
        label: "Edit a flyer in Vismuse",
        description: "Upload a flyer or continue from a generated result and describe the next change in chat."
      },
      {
        href: "/docs/flyer-generator",
        label: "How to make a flyer with AI",
        description: "Follow the complete process for planning, prompting, reviewing, revising, and exporting a flyer."
      },
      {
        href: "/docs/how-to-make-an-event-flyer-with-ai",
        label: "How to make an event flyer",
        description: "Organize the date, venue, admission details, and attendance action before refining the design in chat."
      },
      {
        href: "/docs/ai-flyer-prompts",
        label: "25 AI flyer prompts",
        description: "Start a new flyer with focused prompts for events, businesses, sales, restaurants, real estate, and more."
      },
      {
        href: "/tools/ai-image-text-editor",
        label: "AI Image Text Editor",
        description: "Explore a focused tool for replacing or correcting visible text inside an existing image."
      },
      {
        href: "/templates/flyers",
        label: "Flyer templates",
        description: "Browse flyer examples and visual directions before creating or revising your own design."
      }
    ],
    relatedTools: [
      { href: "/tools/ai-flyer-generator", label: "AI Flyer Generator" },
      { href: "/tools/ai-image-text-editor", label: "AI Image Text Editor" },
      { href: "/templates/flyers", label: "Flyer Templates" }
    ]
  },
  {
    slug: "ai-flyer-prompts",
    title: "25 AI Flyer Prompts for Events, Businesses, Sales, and More",
    image: {
      src: "/assets/visual-templates/ai-flyer-generator/flyer-maker-hero-compact-v3-transparent.png",
      alt: "Collection of AI flyer examples for events, restaurants, businesses, sports, and community promotions"
    },
    description:
      "Copy 25 AI flyer prompt examples for events, businesses, sales, restaurants, real estate, classes, and more, then refine the same flyer through chat.",
    h1: "25 AI flyer prompts for events, businesses, sales, and more",
    lede:
      "Choose the closest flyer prompt, replace the bracketed details, and send it to the Vismuse AI agent. Generate a first draft, then revise the text, layout, colors, and images in chat—no design editor required.",
    category: "AI flyer prompts",
    homeCategory: "Marketing",
    toolHref: "/ai-flyer-generator",
    toolLabel: "Create a flyer from a prompt",
    sourceUseCase: "ai-flyer-generator",
    sections: [],
    workflow: [],
    tips: [],
    templateLinks: [
      {
        href: "/tools/ai-flyer-generator",
        label: "AI Flyer Generator",
        description: "See how the chat-based flyer maker creates and revises flyer designs without a traditional canvas editor."
      },
      {
        href: "/ai-flyer-generator",
        label: "Create and revise with the AI agent",
        description: "Send a flyer prompt, review the first result, and ask for focused changes in the same conversation."
      },
      {
        href: "/templates/flyers",
        label: "Flyer templates",
        description: "Browse remixable directions for parties, businesses, sales, real estate, restaurants, and local events."
      },
      {
        href: "/docs/flyer-generator",
        label: "How to make a flyer with AI",
        description: "Read the broader workflow for building a clear flyer brief, generating a draft, and refining it."
      },
      {
        href: "/docs/how-to-make-an-event-flyer-with-ai",
        label: "How to make an event flyer",
        description: "Turn verified event details into a clear flyer, then revise the hierarchy and formats through chat."
      },
      {
        href: "/docs/how-to-make-a-restaurant-flyer-with-ai",
        label: "How to make a restaurant flyer",
        description: "Turn a verified offer, price, food image, and ordering method into a focused restaurant promotion."
      },
      {
        href: "/docs/how-to-make-a-business-flyer-with-ai",
        label: "How to make a business flyer",
        description: "Build a focused promotion around one audience, benefit, verified business details, and clear action."
      },
      {
        href: "/docs/how-to-make-a-birthday-flyer-with-ai",
        label: "How to make a birthday flyer",
        description: "Turn verified party details, an approved photo, and a clear theme into a birthday invitation."
      },
      {
        href: "/docs/how-to-make-a-party-flyer-with-ai",
        label: "How to make a party flyer",
        description: "Turn verified event details, a focused visual direction, and one clear next step into a party promotion."
      },
      {
        href: "/docs/how-to-make-a-funeral-flyer-with-ai",
        label: "How to make a funeral flyer",
        description: "Adapt announcement wording and prompts for a funeral, memorial service, or celebration of life."
      },
      {
        href: "/docs/edit-flyer-with-ai",
        label: "Edit a flyer with AI",
        description: "Use focused follow-up requests to correct copy, change visual priority, replace images, and adapt formats."
      },
      {
        href: "/docs/how-to-make-a-real-estate-flyer-with-ai",
        label: "Real estate flyer guide",
        description: "Plan listing, open house, and agent flyers around verified property facts and approved photos."
      },
      {
        href: "/tools/party-flyer-generator",
        label: "Party Flyer Generator",
        description: "Explore a focused workflow for birthdays, music nights, celebrations, and other social events."
      }
    ],
    relatedTools: [
      { href: "/tools/ai-flyer-generator", label: "AI Flyer Generator" },
      { href: "/tools/party-flyer-generator", label: "Party Flyer Generator" },
      { href: "/templates/flyers", label: "Flyer Templates" }
    ]
  },
  {
    slug: "album-cover-generator",
    title: "How to Make an Album Cover With AI",
    image: {
      src: "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-album-cover/ai-album-cover-afterimage_thumb.webp",
      alt: "Album cover template from the Vismuse library"
    },
    description:
      "Learn how to create album covers, single artwork, mixtape covers, playlist artwork, and music release artwork with Vismuse.",
    h1: "How to make an album cover with AI",
    lede:
      "Follow this workflow to turn a genre, mood, title, artist direction, or release concept into square album cover art with Vismuse.",
    category: "Music artwork",
    homeCategory: "Music",
    toolHref: "/app/ai-album-cover-generator",
    toolLabel: "Open Album Cover Generator",
    sourceUseCase: "ai-album-cover",
    sections: [
      {
        title: "Choose between an album, single, and mixtape cover",
        paragraphs: [
          "Use this workflow for album covers, singles, mixtapes, EPs, playlist art, and music release artwork.",
          "For an album, choose an image that represents the whole release. For a single, focus on the mood of that song while keeping the artist identity recognizable. For a mixtape, establish a clear hierarchy for the artist or DJ name, mixtape title, and volume number."
        ]
      },
      {
        title: "Supported inputs",
        paragraphs: [
          "Start from the artist name, title, genre, mood, visual references, color direction, and any typography needs. You can also describe what the music feels like if the visual idea is not fixed yet.",
          "If you upload a photo, say what should stay from the image: the same face, pose, outfit, instrument, or composition. Then describe the new album cover background, title placement, and release mood."
        ],
        bullets: ["Artist and release title", "Genre and mood", "Color or scene direction", "Reference images or typography notes", "Photo-to-cover instructions"]
      },
      {
        title: "What Vismuse generates",
        paragraphs: [
          "Vismuse generates cover art concepts that can be revised for title placement, square crop, character, texture, color, and genre cues."
        ],
        bullets: ["Album cover concepts", "Single artwork", "Mixtape covers", "Playlist visuals"]
      }
    ],
    workflow: ["Describe the release", "Add genre, mood, and title direction", "Generate a square cover concept", "Refine typography, crop, or scene details"],
    tips: [
      "Name the genre before the visual style.",
      "Include title placement needs if you want text in the artwork.",
      "Ask for a cleaner square composition if the image feels poster-like."
    ],
    templateLinks: [
      {
        href: "/tools/album-cover-generator",
        label: "AI Album Cover Generator",
        description: "Explore album cover creation methods, examples, download options, and frequently asked questions."
      },
      {
        href: "/templates/album-covers",
        label: "Browse album cover examples",
        description: "Open remixable music artwork prompts and square cover examples from the template library."
      },
      {
        href: "/app/ai-album-cover-generator",
        label: "Create album cover art",
        description: "Start from a blank music release brief or remix an album cover example inside the generator."
      },
      {
        href: "/docs/photo-to-album-cover",
        label: "Photo to album cover guide",
        description: "Use this guide when the workflow starts from an artist photo, selfie, group shot, or reference image."
      },
      {
        href: "/docs/ai-cover-art-prompts",
        label: "30 AI cover art prompts",
        description: "Copy prompt ideas for portrait, rap, R&B, pop, rock, and conceptual cover art."
      },
      {
        href: "/docs/rap-album-cover-ideas",
        label: "Rap album cover ideas",
        description: "Explore focused visual directions and prompts for rap albums, singles, and mixtapes."
      },
      {
        href: "/docs/album-cover-typography",
        label: "Album cover typography guide",
        description: "Choose a type direction, build hierarchy, place the artist name and title, and refine text in chat."
      },
      {
        href: "/docs/album-cover-size",
        label: "Album cover size guide",
        description: "Check current Spotify, Apple Music, and SoundCloud dimensions before releasing your cover."
      }
    ],
    relatedTools: [
      { href: "/tools/album-cover-generator", label: "AI Album Cover Generator" },
      { href: "/templates/album-covers", label: "Album Cover Templates" }
    ]
  },
  {
    slug: "photo-to-album-cover",
    title: "How to Turn a Photo Into an Album Cover With AI",
    image: {
      src: "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-album-cover/user-demand-20260709/ai-album-cover-user-demand-rain-portrait-single_thumb.webp",
      alt: "Moody portrait transformed into square album cover art with artist and single title typography"
    },
    description:
      "Turn a photo into album cover art with an AI agent. Preserve the artist, change the background, add text, and revise the cover in chat—no editor required.",
    h1: "How to turn a photo into an album cover with AI",
    lede:
      "Upload a portrait, selfie, or band photo. Tell the Vismuse AI agent what to keep, what to change, and what text to add. Then refine the same cover in chat—no layers, masks, or design editor.",
    category: "Album cover guide",
    homeCategory: "Music",
    toolHref: "/tools/album-cover-generator",
    toolLabel: "Create and revise it in chat",
    sourceUseCase: "ai-album-cover",
    sections: [
      {
        title: "Choose a clear source photo",
        paragraphs: [
          "Start with the sharpest photo you are allowed to use. A well-lit face, visible outline, and enough room around the subject make it easier to build a square cover without cutting off important details.",
          "A selfie can work, but a portrait taken slightly farther back usually gives the generator more flexibility for the crop, title, and background. For a band, choose a photo where every member is visible and not hidden behind someone else."
        ],
        bullets: [
          "Use the highest-resolution original you have",
          "Choose one clear focal subject or a clearly arranged group",
          "Avoid heavy filters, motion blur, and tiny faces",
          "Leave some space around heads, hands, and instruments"
        ]
      },
      {
        title: "Say what must stay the same",
        paragraphs: [
          "Tell the agent which identity, styling, and composition details it must preserve. Name the person, pose, clothing, expression, instrument, or group arrangement that should remain, then say what it may change.",
          "AI can still alter fine facial details, so compare the result with the source photo before publishing. If identity drifts, continue in the same chat with one focused correction or upload a clearer portrait."
        ],
        example: {
          label: "Identity-preserving instruction",
          prompt: "Use my uploaded photo as the main subject. Keep the same person recognizable, including their face, hairstyle, expression, black jacket, and three-quarter pose. Do not add another person. You may change the background, lighting, color treatment, crop, and typography."
        }
      },
      {
        title: "Describe the new cover direction",
        paragraphs: [
          "Connect the visual treatment to the music: name the release type, genre, mood, scene, lighting, and palette. Ask for a 1:1 square composition with one strong focal point and enough contrast to work as a small streaming thumbnail.",
          "Be concrete. Instead of asking for a cool background, ask for a rainy city at night, a warm studio spotlight, a clean luxury set, or a grainy rehearsal room."
        ],
        example: {
          label: "Photo-to-cover direction",
          prompt: "Turn this portrait into square cinematic R&B single artwork. Keep the person recognizable. Replace the background with a rainy night street, add blue-gray shadows and warm streetlight reflections, use subtle film grain, and leave clean negative space in the lower third for the title."
        }
      },
      {
        title: "Add the artist name and release title",
        paragraphs: [
          "Put every required word in quotation marks and identify its role. Give the artist name and release title separate placement and style instructions, then check every letter in the result.",
          "Short text is more reliable and easier to read at thumbnail size. If a word is wrong, tell the agent the exact correction and ask it to leave the portrait, background, and layout alone."
        ],
        example: {
          label: "Exact cover text",
          prompt: "Add the exact artist name “MARC VALE” in small uppercase type at the top. Add the exact single title “NO STRANGER” in large condensed type across the lower third. Keep the portrait, face, background, lighting, and crop unchanged."
        }
      },
      {
        title: "Keep refining the same cover in chat",
        paragraphs: [
          "After the first result, stay in the conversation and describe the next change in ordinary language. The agent works from the current cover, so you do not need to select layers, paint a mask, or rebuild the composition in a design editor.",
          "Say what is already right before naming the change. If a revision damages something that was correct, describe the earlier detail to restore and the newer changes to keep; the agent can clarify if the target is ambiguous."
        ],
        bullets: [
          "Keep the face and pose; make only the background darker",
          "Keep the image; correct only the misspelled title",
          "Keep the current colors; move the artist name higher",
          "Remove the extra person; preserve the main subject and layout"
        ],
        example: {
          label: "Focused follow-up edit",
          prompt: "Keep the same person, face, pose, square crop, blue lighting, and title placement. Change only the background to a quieter rain texture and remove the extra figure behind the artist."
        }
      }
    ],
    workflow: [
      "Upload a clear photo you have permission to use",
      "List the identity and composition details that must stay",
      "Describe the genre, mood, background, and square crop",
      "Add the exact artist name and release title",
      "Continue in chat and request one focused edit at a time"
    ],
    tips: [
      "Say what to keep before describing what to change.",
      "Put exact cover text in quotation marks and proofread it before release.",
      "Use a square composition with a simple focal point and thumbnail contrast.",
      "Keep a copy of the strongest version before requesting another revision.",
      "Only upload and publish photos, logos, and artwork you have permission to use."
    ],
    templateLinks: [
      {
        href: "/tools/album-cover-generator",
        label: "AI Album Cover Generator",
        description: "See how the chat-based agent creates and revises cover art without a traditional editor."
      },
      {
        href: "/ai-album-cover-generator",
        label: "Create and revise with the AI agent",
        description: "Upload your photo, describe the first cover, and ask for follow-up changes in chat."
      },
      {
        href: "/templates/album-covers",
        label: "Album cover templates",
        description: "Browse portrait, rap, R&B, band, and typography-led cover directions."
      },
      {
        href: "/docs/album-cover-generator",
        label: "Album cover art guide",
        description: "Read the broader workflow for creating album, single, mixtape, and playlist artwork."
      },
      {
        href: "/docs/ai-cover-art-prompts",
        label: "30 AI cover art prompts",
        description: "Start with a copyable genre or visual-style prompt, then refine the cover in chat."
      },
      {
        href: "/docs/album-cover-typography",
        label: "Album cover typography guide",
        description: "Add the artist name and title without losing the portrait, mood, or visual hierarchy."
      },
      {
        href: "/docs/album-cover-size",
        label: "Album cover size guide",
        description: "Prepare the finished square portrait cover for Spotify, Apple Music, and SoundCloud."
      }
    ],
    relatedTools: [
      { href: "/tools/album-cover-generator", label: "AI Album Cover Generator" },
      { href: "/templates/album-covers", label: "Album Cover Templates" },
      { href: "/spotify-canvas-generator", label: "Spotify Canvas Generator" }
    ]
  },
  {
    slug: "ai-cover-art-prompts",
    title: "30 AI Cover Art Prompts for Albums, Singles, and Mixtapes",
    image: {
      src: "/assets/visual-templates/ai-album-cover/templates-inspiration-collage.png",
      alt: "Collage of AI cover art examples across portrait, rap, pop, rock, and conceptual styles"
    },
    description:
      "Copy 30 AI cover art prompts for albums, singles, and mixtapes. Explore portrait, rap, R&B, pop, rock, and conceptual ideas, then revise in chat.",
    h1: "30 AI cover art prompts for albums, singles, and mixtapes",
    lede:
      "Choose a visual direction, replace the bracketed release details, and send the prompt to the Vismuse AI agent. Then refine the same cover in chat—no design editor required.",
    category: "AI cover art prompts",
    homeCategory: "Music",
    toolHref: "/ai-album-cover-generator",
    toolLabel: "Create cover art from a prompt",
    sourceUseCase: "ai-album-cover",
    sections: [],
    workflow: [],
    tips: [],
    templateLinks: [
      {
        href: "/tools/album-cover-generator",
        label: "AI Album Cover Generator",
        description: "See how the chat-based agent creates and revises cover art without a traditional editor."
      },
      {
        href: "/ai-album-cover-generator",
        label: "Create and revise with the AI agent",
        description: "Send a cover prompt, review the result, and ask for focused follow-up changes in chat."
      },
      {
        href: "/templates/album-covers",
        label: "Album cover templates",
        description: "Browse remixable portrait, rap, R&B, band, and typography-led cover directions."
      },
      {
        href: "/docs/photo-to-album-cover",
        label: "Photo to album cover guide",
        description: "Learn how to preserve an artist or band while changing the setting, mood, and typography."
      },
      {
        href: "/docs/album-cover-generator",
        label: "Album cover art guide",
        description: "Read the full workflow for albums, singles, mixtapes, playlists, and other music releases."
      },
      {
        href: "/docs/rap-album-cover-ideas",
        label: "Rap album cover ideas",
        description: "Turn portrait, street, luxury, mixtape, and conceptual directions into focused rap artwork."
      },
      {
        href: "/docs/album-cover-typography",
        label: "Album cover typography guide",
        description: "Turn a visual direction into readable artist-name and release-title treatments."
      },
      {
        href: "/docs/album-cover-size",
        label: "Album cover size guide",
        description: "Turn the selected prompt result into a square, high-resolution streaming cover."
      }
    ],
    relatedTools: [
      { href: "/tools/album-cover-generator", label: "AI Album Cover Generator" },
      { href: "/templates/album-covers", label: "Album Cover Templates" },
      { href: "/spotify-canvas-generator", label: "Spotify Canvas Generator" }
    ]
  },
  {
    slug: "rap-album-cover-ideas",
    title: "Rap Album Cover Ideas and Prompts for Mixtapes and Singles",
    image: {
      src: "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-album-cover/user-demand-20260709/ai-album-cover-user-demand-gritty-rap-city_thumb.webp",
      alt: "Gritty rap album cover with a city skyline, artist silhouette, and bold chrome title"
    },
    description:
      "Explore 12 rap album cover ideas with copyable prompts for albums, singles, and mixtapes. Start from text or a photo, then refine the cover in chat.",
    h1: "Rap album cover ideas and prompts for mixtapes and singles",
    lede:
      "Explore portrait, street, luxury, collage, and conceptual directions. Copy a prompt or upload your photo, then ask the Vismuse AI agent to revise the same cover in chat without opening a design editor.",
    category: "Rap album cover ideas",
    homeCategory: "Music",
    toolHref: "/ai-album-cover-generator",
    toolLabel: "Create rap cover art",
    sourceUseCase: "ai-album-cover",
    sections: [],
    workflow: [],
    tips: [],
    templateLinks: [
      {
        href: "/tools/album-cover-generator",
        label: "AI Album Cover Generator",
        description: "Create rap album, single, and mixtape artwork, then request revisions in chat."
      },
      {
        href: "/ai-album-cover-generator",
        label: "Create with the Vismuse AI agent",
        description: "Start from a written direction or artist photo and continue refining the cover in conversation."
      },
      {
        href: "/templates/album-covers",
        label: "Album cover templates",
        description: "Browse remixable rap, portrait, dark, illustrated, and typography-led cover directions."
      },
      {
        href: "/docs/ai-cover-art-prompts",
        label: "30 AI cover art prompts",
        description: "Explore more copyable prompts across rap, R&B, pop, electronic, rock, and conceptual styles."
      },
      {
        href: "/docs/photo-to-album-cover",
        label: "Photo to album cover guide",
        description: "Learn how to preserve an artist or group while changing the background, mood, and typography."
      },
      {
        href: "/docs/album-cover-generator",
        label: "Album cover art guide",
        description: "Read the broader workflow for albums, singles, mixtapes, playlists, and other music releases."
      },
      {
        href: "/docs/album-cover-typography",
        label: "Album cover typography guide",
        description: "Build a clear title hierarchy and fix album cover text through focused chat edits."
      },
      {
        href: "/docs/album-cover-size",
        label: "Album cover size guide",
        description: "Check the final rap album, single, or mixtape cover against current streaming requirements."
      }
    ],
    relatedTools: [
      { href: "/tools/album-cover-generator", label: "AI Album Cover Generator" },
      { href: "/templates/album-covers", label: "Album Cover Templates" },
      { href: "/spotify-canvas-generator", label: "Spotify Canvas Generator" }
    ]
  },
  {
    slug: "album-cover-typography",
    title: "Album Cover Typography: How to Add the Artist Name and Title",
    image: {
      src: "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-album-cover/user-demand-20260709/ai-album-cover-user-demand-sports-fourth-down_thumb.webp",
      alt: "Album cover typography with a large bold title over a cinematic nighttime football field"
    },
    description:
      "Learn album cover typography and how to add the artist name and title. Choose type, build hierarchy, fix text, and refine the cover in chat.",
    h1: "Album cover typography: how to add the artist name and title",
    lede:
      "Decide what listeners should read first, choose a type direction that fits the music, and place every word clearly. Then use the Vismuse AI agent to add and refine the text in chat without opening a design editor.",
    category: "Album cover typography",
    homeCategory: "Music",
    toolHref: "/ai-album-cover-generator",
    toolLabel: "Add and refine cover text",
    sourceUseCase: "ai-album-cover",
    sections: [],
    workflow: [],
    tips: [],
    templateLinks: [
      {
        href: "/tools/album-cover-generator",
        label: "AI Album Cover Generator",
        description: "Create a cover, add the artist name and title, and request focused revisions in chat."
      },
      {
        href: "/ai-album-cover-generator",
        label: "Add text with the Vismuse AI agent",
        description: "Start from cover art or a written brief, then refine the typography in the same conversation."
      },
      {
        href: "/templates/album-covers",
        label: "Album cover templates",
        description: "Browse type-led, portrait, rap, R&B, rock, and conceptual cover directions."
      },
      {
        href: "/docs/photo-to-album-cover",
        label: "Photo to album cover guide",
        description: "Keep an artist recognizable while adding a title, artist name, and new visual direction."
      },
      {
        href: "/docs/ai-cover-art-prompts",
        label: "30 AI cover art prompts",
        description: "Copy complete prompts with title placement and type directions for multiple music genres."
      },
      {
        href: "/docs/rap-album-cover-ideas",
        label: "Rap album cover ideas",
        description: "Explore bold, condensed, editorial, and mixtape typography in context."
      },
      {
        href: "/docs/album-cover-generator",
        label: "Album cover art guide",
        description: "Read the complete workflow for album, single, mixtape, and playlist artwork."
      },
      {
        href: "/docs/album-cover-size",
        label: "Album cover size guide",
        description: "Verify square dimensions, resolution, file format, and thumbnail readability before release."
      }
    ],
    relatedTools: [
      { href: "/tools/album-cover-generator", label: "AI Album Cover Generator" },
      { href: "/templates/album-covers", label: "Album Cover Templates" },
      { href: "/spotify-canvas-generator", label: "Spotify Canvas Generator" }
    ]
  },
  {
    slug: "album-cover-size",
    title: "Album Cover Size Guide for Spotify, Apple Music, and SoundCloud",
    image: {
      src: "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-album-cover/ai-album-cover-afterimage_thumb.webp",
      alt: "Square album cover artwork prepared for Spotify, Apple Music, and SoundCloud"
    },
    description:
      "Check the latest album cover size for Spotify, Apple Music, and SoundCloud. Compare pixel dimensions, formats, and a chat-based preparation workflow.",
    h1: "Album cover size guide for Spotify, Apple Music, and SoundCloud",
    lede:
      "Compare current platform requirements, choose one reliable square master, and prepare the final file without stretching or guesswork. Then use the Vismuse AI agent to refine the crop, title, and spacing in chat instead of rebuilding the cover in an editor.",
    category: "Album cover size",
    homeCategory: "Music",
    toolHref: "/ai-album-cover-generator",
    toolLabel: "Create a square album cover",
    sourceUseCase: "ai-album-cover",
    sections: [],
    workflow: [],
    tips: [],
    templateLinks: [
      {
        href: "/tools/album-cover-generator",
        label: "AI Album Cover Generator",
        description: "Create a square cover, review the result, and request focused revisions in chat."
      },
      {
        href: "/ai-album-cover-generator",
        label: "Create with the Vismuse AI agent",
        description: "Choose 1:1 and a high-resolution output, then refine the current cover through conversation."
      },
      {
        href: "/templates/album-covers",
        label: "Album cover templates",
        description: "Browse square portrait, rap, R&B, rock, typography, and conceptual cover directions."
      },
      {
        href: "/docs/album-cover-typography",
        label: "Album cover typography guide",
        description: "Keep the artist name and release title accurate and readable at thumbnail size."
      },
      {
        href: "/docs/photo-to-album-cover",
        label: "Photo to album cover guide",
        description: "Reframe an artist photo as a square cover while preserving identity and important details."
      },
      {
        href: "/docs/ai-cover-art-prompts",
        label: "30 AI cover art prompts",
        description: "Start with a complete square cover prompt, then revise the selected result in chat."
      },
      {
        href: "/docs/rap-album-cover-ideas",
        label: "Rap album cover ideas",
        description: "Explore release-ready directions for rap albums, singles, and mixtapes."
      },
      {
        href: "/docs/album-cover-generator",
        label: "Album cover art guide",
        description: "Read the broader workflow for creating and refining music release artwork."
      }
    ],
    relatedTools: [
      { href: "/tools/album-cover-generator", label: "AI Album Cover Generator" },
      { href: "/templates/album-covers", label: "Album Cover Templates" },
      { href: "/spotify-canvas-generator", label: "Spotify Canvas Generator" }
    ]
  },
  {
    slug: "book-cover-generator",
    title: "AI Book Cover Generator Docs",
    image: {
      src: "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-book-cover/epic-fantasy-cover_thumb.webp",
      alt: "Epic fantasy book cover template from the Vismuse library"
    },
    description:
      "Learn how to create AI book covers for ebooks, Kindle books, paperbacks, fiction, nonfiction, memoirs, and self-publishing projects with Vismuse.",
    h1: "AI Book Cover Generator documentation",
    lede:
      "Use AI Book Cover Generator when the visual needs to sell a title, genre, author promise, or publishing concept in a cover-ready format.",
    category: "Publishing covers",
    homeCategory: "Design",
    toolHref: "/ai-book-cover-generator",
    toolLabel: "Open Book Cover Generator",
    sourceUseCase: "ai-book-cover",
    sections: [
      {
        title: "When to use it",
        paragraphs: [
          "Use this workflow for ebook covers, Kindle covers, paperback front covers, audiobook concepts, fiction covers, nonfiction covers, memoirs, poetry books, children's books, and book series visuals.",
          "It is most useful when you know the title, author, genre, and reader expectation, but need a polished cover direction that feels commercially recognizable."
        ]
      },
      {
        title: "Supported inputs",
        paragraphs: [
          "Start from the book title, author name, subtitle, genre, target reader, tone, visual references, typography style, color palette, and publishing format.",
          "If the book belongs to a series, include the series name, volume number, shared visual motifs, and what should stay consistent across covers."
        ],
        bullets: ["Title, subtitle, and author name", "Genre and target reader", "Typography and color direction", "Ebook, paperback, Kindle, or audiobook format"]
      },
      {
        title: "What Vismuse generates",
        paragraphs: [
          "Vismuse generates book cover concepts that can be refined for title hierarchy, genre cues, composition, character or object focus, contrast, and thumbnail readability.",
          "The first draft is a creative direction. Use follow-up prompts to adjust crop, type scale, background, mood, and how strongly the cover signals its genre."
        ],
        bullets: ["Ebook cover concepts", "Paperback front cover directions", "Kindle cover ideas", "Series cover systems"]
      },
      {
        title: "Template examples",
        paragraphs: [
          "Book cover templates are useful when you want a proven prompt shape for a genre before writing a full brief. Start from fantasy, romance, thriller, nonfiction, memoir, or children's book examples, then replace the title and audience details.",
          "For self-publishing, test multiple directions quickly: commercial genre cover, minimalist typography cover, character-led cover, and cinematic object-led cover."
        ],
        bullets: ["Fantasy and romance cover prompts", "Thriller and mystery cover prompts", "Nonfiction and memoir cover prompts", "Kindle and ebook cover prompts"]
      }
    ],
    workflow: ["Describe the book", "Add genre, audience, and title direction", "Generate a cover concept", "Refine title hierarchy, crop, and genre cues"],
    tips: [
      "Name the genre before describing the scene.",
      "Keep title and author hierarchy clear enough to read at thumbnail size.",
      "Avoid asking for too many symbols in one cover; choose one dominant visual idea."
    ],
    templateLinks: [
      {
        href: "/library?category=Book%20Covers",
        label: "Browse book cover examples",
        description: "Open remixable book cover prompts for fiction, nonfiction, Kindle, ebook, and self-publishing cover concepts."
      },
      {
        href: "/ai-book-cover-generator",
        label: "Create a book cover",
        description: "Start from a blank title brief or remix a cover direction inside the AI Book Cover Generator."
      }
    ],
    relatedTools: [
      { href: "/tools/ai-book-cover-generator", label: "AI Book Cover Generator" },
      { href: "/library", label: "Template Library" }
    ]
  },
  {
    slug: "logo-generator",
    title: "AI Logo Generator Docs",
    image: {
      src: "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-logo-generator/modern-startup-mark_thumb.webp",
      alt: "Modern startup logo template from the Vismuse library"
    },
    description:
      "Learn how to create AI logo concepts, brand marks, business logos, monograms, badges, and generated logo ideas with Vismuse.",
    h1: "AI Logo Generator documentation",
    lede:
      "Use AI Logo Generator when you need fast logo concept directions for a business, app, product, creator brand, or campaign identity.",
    category: "Logos and brand visuals",
    homeCategory: "Branding",
    toolHref: "/ai-logo-generator",
    toolLabel: "Open AI Logo Generator",
    sourceUseCase: "ai-logo-generator",
    sections: [
      {
        title: "When to use it",
        paragraphs: [
          "Use this workflow for AI logo concepts, brand marks, wordmark directions, monograms, badge logos, mascot logo ideas, and small business identity exploration.",
          "It works best for generating original directions and visual systems rather than copying an existing company mark."
        ]
      },
      {
        title: "Supported inputs",
        paragraphs: [
          "Start with the brand name, industry, logo type, style, color palette, symbols, and any words or letters that must appear. Mention whether the logo should feel modern, premium, playful, local, tech, organic, or editorial."
        ],
        bullets: ["Brand name and industry", "Logo type or mark direction", "Style and color palette", "Symbols, initials, or usage context"]
      },
      {
        title: "What Vismuse generates",
        paragraphs: [
          "Vismuse generates logo concept images and brand visual directions that can be refined for simplicity, color, mark shape, typography direction, and layout."
        ],
        bullets: ["Logo concepts", "Brand marks", "Monograms and badges", "Small business logo ideas"]
      }
    ],
    workflow: ["Describe the brand", "Choose logo type, style, and industry", "Generate logo concepts", "Refine mark, color, and layout"],
    tips: [
      "Use a fictional or owned brand name.",
      "Ask for limited colors and a simple scalable mark.",
      "Avoid requesting an existing brand style or trademarked logo."
    ],
    relatedTools: [
      { href: "/tools/ai-image-maker", label: "AI Image Maker" },
      { href: "/tools/ai-product-ad-image-generator", label: "Product Ad Generator" },
      { href: "/library?category=Logos", label: "Logo Templates" }
    ]
  },
  {
    slug: "sticker-generator",
    title: "AI Sticker Generator Docs",
    image: {
      src: "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-sticker-generator/kawaii-strawberry_thumb.webp",
      alt: "Kawaii strawberry sticker template from the Vismuse library"
    },
    description:
      "Learn how to create custom stickers, sticker sheets, reaction stickers, merch stickers, and PNG-style sticker art with Vismuse.",
    h1: "AI Sticker Generator documentation",
    lede:
      "Use AI Sticker Generator when you want a small, clear, characterful visual that reads well as a sticker, reaction, merch idea, or sticker sheet element.",
    category: "Stickers and reactions",
    homeCategory: "Design",
    toolHref: "/ai-sticker-generator",
    toolLabel: "Open AI Sticker Generator",
    sourceUseCase: "ai-sticker-generator",
    sections: [
      {
        title: "When to use it",
        paragraphs: [
          "Use this workflow for cute stickers, reaction art, mascot stickers, merch concepts, sticker sheets, labels, and small visual icons.",
          "It works best when the subject is easy to recognize and the composition is simple enough to read at a small size."
        ]
      },
      {
        title: "Supported inputs",
        paragraphs: [
          "Start with the character, object, expression, border style, color palette, and intended use. You can ask for a single sticker or a coordinated sheet."
        ],
        bullets: ["Character or object", "Expression or pose", "Border and background preference", "Single sticker or sheet direction"]
      },
      {
        title: "What Vismuse generates",
        paragraphs: [
          "Vismuse generates sticker-style artwork that can be refined for outline, expression, color, shape, and sheet layout."
        ],
        bullets: ["Sticker concepts", "Reaction stickers", "Sticker sheet ideas", "Mascot and merch visuals"]
      }
    ],
    workflow: ["Describe the sticker subject", "Add expression, outline, and color notes", "Generate the sticker", "Refine border, pose, or sheet layout"],
    tips: [
      "Use one main subject per sticker.",
      "Ask for a thick border if you want a classic sticker look.",
      "Keep text short, or avoid text entirely for cleaner results."
    ],
    relatedTools: [
      { href: "/tools/ai-image-maker", label: "AI Image Maker" },
      { href: "/tools/ai-wallpaper-generator", label: "AI Wallpaper Generator" },
      { href: "/library", label: "Template Library" }
    ]
  },
  {
    slug: "wallpaper-generator",
    title: "AI Wallpaper Generator Docs",
    image: {
      src: "https://api.vismuse.com/storage/v1/object/public/visual-template-assets/backgrounds/ai-wallpaper-generator/moonlit-ocean-lock-screen_thumb.webp",
      alt: "Moonlit ocean wallpaper template from the Vismuse library"
    },
    description:
      "Learn how to create AI phone wallpapers, desktop backgrounds, lock screens, 4K-style images, and aesthetic visual scenes with Vismuse.",
    h1: "AI Wallpaper Generator documentation",
    lede:
      "Use AI Wallpaper Generator when the output should work as a phone background, desktop wallpaper, lock screen, or clean visual scene with enough space for icons and widgets.",
    category: "Wallpapers and backgrounds",
    homeCategory: "Design",
    toolHref: "/ai-wallpaper-generator",
    toolLabel: "Open AI Wallpaper Generator",
    sourceUseCase: "ai-wallpaper-generator",
    sections: [
      {
        title: "When to use it",
        paragraphs: [
          "Use this workflow for phone wallpapers, desktop backgrounds, lock screens, aesthetic scenes, calm abstract visuals, and personal device backgrounds.",
          "It is useful when the image should look good behind icons, widgets, or lock screen elements."
        ]
      },
      {
        title: "Supported inputs",
        paragraphs: [
          "Start with the scene, mood, color direction, device type, and whether you need vertical, square, or wide composition. Mention if you want empty space near the top or center."
        ],
        bullets: ["Phone or desktop format", "Scene and mood", "Color palette", "Negative-space requirements"]
      },
      {
        title: "What Vismuse generates",
        paragraphs: [
          "Vismuse generates wallpaper concepts that can be refined for crop, detail level, color balance, focal point, and icon-friendly spacing."
        ],
        bullets: ["Phone wallpapers", "Desktop backgrounds", "Lock screen visuals", "Aesthetic background images"]
      }
    ],
    workflow: ["Choose phone or desktop use", "Describe the scene and mood", "Generate the wallpaper", "Adjust crop, space, and color balance"],
    tips: [
      "Mention the device or aspect ratio early.",
      "Ask for clean negative space if icons need to remain readable.",
      "Avoid busy text or tiny details unless the wallpaper is decorative only."
    ],
    relatedTools: [
      { href: "/tools/ai-image-maker", label: "AI Image Maker" },
      { href: "/tools/ai-sticker-generator", label: "AI Sticker Generator" },
      { href: "/library", label: "Template Library" }
    ]
  },
  {
    slug: "templates-and-library",
    title: "Templates and Library Docs",
    image: {
      src: "/assets/visual-templates/ai-album-cover/templates-inspiration-collage.png",
      alt: "Collection of templates available in Vismuse"
    },
    description:
      "Learn how to use the Vismuse library for visual templates, prompt examples, starter ideas, and faster generator workflows.",
    h1: "Templates and library documentation",
    lede:
      "Use the library when you want to start from a proven visual direction instead of writing every prompt from scratch.",
    category: "Templates and examples",
    homeCategory: "Design",
    toolHref: "/templates",
    toolLabel: "Open Templates",
    sections: [
      {
        title: "When to use it",
        paragraphs: [
          "Use the library when you know the kind of visual you want, but want a faster starting point. Templates and examples help with style, composition, prompt structure, and generator selection."
        ]
      },
      {
        title: "What templates include",
        paragraphs: [
          "A library item can include a preview image, prompt, starter text, category, use case, aspect ratio, and the generator it is designed for."
        ],
        bullets: ["Preview image", "Starter prompt", "Use case and tags", "Matching generator"]
      },
      {
        title: "How it connects to tools",
        paragraphs: [
          "Library examples are designed to connect back into the generator workflow, so users can start from a visual direction and then edit the output for their own project."
        ],
        bullets: ["Browse examples", "Open the matching generator", "Use the starter prompt", "Revise the result"]
      }
    ],
    workflow: ["Browse a relevant example", "Open the matching generator", "Use the starter prompt", "Revise the result for your project"],
    tips: [
      "Choose examples by output type before choosing by style.",
      "Treat prompts as starting points, not fixed templates.",
      "Use related templates to explore nearby visual directions."
    ],
    relatedTools: [
      { href: "/tools", label: "All tools" },
      { href: "/tools/ai-image-maker", label: "AI Image Maker" },
      { href: "/tools/ai-flyer-generator", label: "AI Flyer Generator" }
    ]
  }
];

export const INDEXABLE_DOC_SLUGS = seoDocs.map((doc) => doc.slug);

export function getSeoDocBySlug(slug: string) {
  return seoDocs.find((doc) => doc.slug === slug);
}

export function getToolDocLinks(toolHref: string): ToolDocLink[] {
  const docsByToolHref = new Map(seoDocs.map((doc) => [doc.toolHref, doc]));
  const primaryDoc = docsByToolHref.get(toolHref);
  const templateDoc = getSeoDocBySlug("templates-and-library");
  const relatedDocs = primaryDoc?.relatedTools
    .map((tool) => docsByToolHref.get(tool.href))
    .filter((doc): doc is SeoDocConfig => Boolean(doc))
    .slice(0, 2) ?? [];

  const orderedDocs = [primaryDoc, templateDoc, ...relatedDocs].filter((doc): doc is SeoDocConfig => Boolean(doc));
  const seen = new Set<string>();

  return orderedDocs
    .filter((doc) => {
      if (seen.has(doc.slug)) return false;
      seen.add(doc.slug);
      return true;
    })
    .map((doc) => ({
      href: `/docs/${doc.slug}`,
      label: doc.title.replace(" Docs", ""),
      description: doc.description
    }));
}
