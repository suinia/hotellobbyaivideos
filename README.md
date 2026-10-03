# Hotel Lobby AI

Standalone Hotel Lobby video workspace at https://hotellobbyaivideos.com.

## Architecture

Matches the AI FlyerMaker standalone-site boundary: the frontend owns its brand, workbench, SEO pages, and Supabase OAuth callback. Same-origin `/api/*` forwards to the existing Vismuse service. Accounts, guest identity, uploads, generation, conversations, credit settlement, and checkout remain on Vismuse. No separate generation backend, database, or payment catalog is deployed here.

The workbench UI and video request contract were extracted from `clawvisualWeb` on October 2, 2026. The proxy architecture follows `flyermakerai`. Internal `vismuse:*` event/storage keys and Hotel Lobby `sourceUseCase` are deliberately retained for compatibility.

## Development

```sh
npm ci
cp .env.example .env.local
# Set the shared PUBLIC Supabase anon key, never a service-role key.
npm run dev -- --port 3018
```

The current local checkout uses a gitignored symlink to the existing clawvisualWeb node_modules. Deployment and clean checkouts should use `npm ci`. Webpack is used for deterministic builds with this local dependency arrangement.

## Routes

- `/`: Hotel Lobby workbench, original video examples, guide links, FAQ
- `/hotel-lobby-ai`: permanent alias to the homepage, preserving query parameters
- `/app/chat/:id`, `/app/recents`, `/app/assets`: existing conversation/project UI
- `/app/explore`: Hotel Lobby video examples
- `/examples` and `/examples/:slug`: filtered video gallery and individual prompt/photo-tip pages
- `/prompts`: filterable, copyable prompt library with cast-aware workspace links
- `/guides` and `/guides/:slug`: guide hub, creation, pet-duet, and prompt guides
- `/pricing`: shared video plans and credit checkout
- `/auth/callback`: local Supabase PKCE exchange; account/guest reconciliation occurs through the shared API
- `/share/:token`: public share view on the shared platform
- `/robots.txt`, `/sitemap.xml`: standalone SEO discovery

The launch surface is English; it does not advertise untranslated localized SEO URLs. Authentication and account handling use the public Supabase client. The website does not need model-provider, service-role, or payment secret keys.

## Production configuration

1. Set `NEXT_PUBLIC_APP_URL=https://hotellobbyaivideos.com`, `VISMUSE_API_ORIGIN=https://vismuse.com`, and the shared public Supabase variables.
2. In the existing Supabase project, allow `https://hotellobbyaivideos.com/auth/callback` (and the local/preview callback URLs you use). This repository cannot verify the hosted allowlist.
3. In the Vismuse backend, add `https://hotellobbyaivideos.com` to `BILLING_ALLOWED_RETURN_ORIGINS`. The backend intentionally falls back to its own origin for unlisted payment returns. Configure `BILLING_SITE_PAYMENT_PROVIDERS` only if a site-specific provider is required.
4. Deploy the frontend and connect the apex/www domains. No deploy or production configuration mutation is performed by this checkout.
5. Verify a real login, generation, and checkout return using the production configuration before release. Local UI and proxy checks do not prove provider fulfillment or payment settlement.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

Content uses owned Vismuse Hotel Lobby examples, with independently written SEO copy informed by https://hotellobbyai.co/. No third-party free-generation allowance, music inclusion, timing guarantee, or identity-preservation guarantee is copied.
