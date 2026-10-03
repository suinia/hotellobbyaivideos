# Standalone extraction verification — 2026-10-02

## Scope and provenance

- Implemented in `hotellobbyaivideos`; reference projects were read only.
- Workbench source: `clawvisualWeb/src/app/hotel-lobby-ai` and shared app components.
- API boundary: `flyermakerai/src/app/api/[...path]/route.ts`.
- Retained the Hotel Lobby video contract, default vertical composition, solo/duet/pets validation, optional creative directions, upload processing, conversation UI, shared account and checkout integrations.
- Owned demo assets: three rap-v1 MP4 files plus WebP posters/thumbnails.
- SEO reference: https://hotellobbyai.co/ for search topics, and Vismuse's own workbench/materials for actual capabilities. New copy does not promise free daily videos, original-song audio, or exact choreography.

## Verified

- TypeScript check and production Webpack build pass.
- Original 10 Hotel Lobby workbench regressions pass.
- Five proxy integration tests pass: auth/cookies/query forwarding and anti-spoofed attribution; multipart bytes; same-origin/external redirects; network failure; HEAD.
- Browser: live shared account and recent-project data load through the standalone proxy.
- Browser: Hotel Lobby inspiration API returns the four existing Hotel Lobby examples.
- Browser: Solo toggles to one-photo validation; Duet requires two photos; advanced settings exposes output, aspect, duration, scene, camera, style, lighting, and energy.
- Browser: owned sample upload completes and enables Create. Clicking Create as an unsigned guest opens the Hotel Lobby sign-in modal and shows `Sign in to create video tasks.` No video-generation job or payment was submitted.
- Browser: pricing uses the complete FlyerMaker pricing page architecture, with shared catalog assignment, annual/monthly cards, and sign-in before checkout. Annual switching and the Pro sign-in gate passed. No checkout was submitted.
- Browser: 390 × 844 mobile layout has a 390px document width (no horizontal overflow), one h1, and the correct hotellobbyaivideos.com canonical.

## Release dependencies / not verified

- A complete signed-in generation and paid download are not verified: the browser is a guest with zero credits. The original backend performs video generation and settlement.
- Real OAuth/provider completion and payment settlement were not performed. The hosted Supabase callback and Vismuse BILLING_ALLOWED_RETURN_ORIGINS must include the new domain before production launch.
- No deployment, DNS update, production backend change, or purchase was performed.
- The launch surface is English. Localized marketing URLs are not emitted.
- Local dev dependency symlink is gitignored; clean deployments use npm ci.

## Multi-page expansion

- Added `/examples`, three `/examples/:slug` pages, `/prompts`, and `/guides`.
- Added shared website navigation, Discover sidebar links, and cross-links between guides, examples, and the workspace.
- Prompt links carry both description and cast mode into the real Hotel Lobby composer.
- Added example type filtering and prompt category/copy controls.
- Updated sitemap with all new public routes.
- Added the browser locale-catalog alias to Webpack so the server's full multilingual catalog is not included in initial client JavaScript.

- Production browser: example category filtering passed; Pricing renders shared plans and annual billing totals.
- Pricing preserves annual package selection after the authentication return.
- Production browser: Solo prompt selection pre-fills the exact prompt and activates Solo (one photo) in the real composer.
- Latest production build and all 15 unit tests pass.

## Review fixes

- Fixed Assets conversation links, inherited video promo links, and new-task return links to use standalone routes.
- Wait for the resolved pricing assignment before automatic checkout resumes.
- Reload the sanitized return path after email OTP verification, including when the URL is unchanged, so a previously consumed auto-checkout marker cannot block continuation.
- Share strict same-origin return-path validation between pricing and OAuth callback; regression coverage includes slash/backslash and control-character normalization.
- Render pricing cards on the server; keep checkout disabled while pricing assignment resolves. Verified HTTP HTML includes the plan price without requiring JavaScript.
- Validation: TypeScript, production build, 18 tests, six HTTP route checks, and browser annual-plan/sign-in-gate checks passed.
- Actual OTP delivery/verification, signed-in generation, and payment settlement remain unverified without an appropriate test account/provider flow.

- Second review: corrected hub/detail Open Graph and Twitter metadata, used a raster preview for pricing, and removed duplicate brand suffixes. Build/typecheck pass; five generated HTML pages have verified route-specific OG URLs and matching Twitter titles.
