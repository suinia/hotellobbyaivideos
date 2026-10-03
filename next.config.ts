import type { NextConfig } from "next";
import path from "node:path";

type RemotePattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];

function getSupabaseImageRemotePatterns(): RemotePattern[] {
  const hostnames = new Set(["api.vismuse.com", "pjngyaqydfsywuzhjeeu.supabase.co"]);
  const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (configuredSupabaseUrl) {
    try {
      hostnames.add(new URL(configuredSupabaseUrl).hostname);
    } catch {
      // Ignore invalid env values and keep the known legacy host available.
    }
  }

  return [...hostnames].map((hostname) => ({
    protocol: "https",
    hostname,
    pathname: "/storage/v1/**"
  }));
}

const frameSrcOrigins = [
  "'self'",
  "https://accounts.google.com",
  "https://www.youtube.com",
  "https://www.youtube-nocookie.com",
  ...(process.env.VERCEL_ENV === "preview" ? ["https://vercel.live"] : [])
].join(" ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      `frame-src ${frameSrcOrigins}`,
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline' https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:",
      "connect-src 'self' https: wss:",
      "worker-src 'self' blob:",
      "upgrade-insecure-requests"
    ].join("; ")
  }
] as const;

const noindexRobotsHeader = {
  key: "X-Robots-Tag",
  value: "noindex, nofollow, noarchive, nosnippet"
} as const;

const visualTemplatesCacheHeader = {
  key: "Cache-Control",
  value: "public, s-maxage=3600, stale-while-revalidate=3600"
} as const;

const immutableAssetCacheHeader = {
  key: "Cache-Control",
  value: "public, max-age=31536000, immutable"
} as const;

const nextConfig: NextConfig = {
  devIndicators: false,
  webpack(config, { isServer }) {
    if (!isServer) {
      config.plugins.push(new (require("webpack").NormalModuleReplacementPlugin)(/locales\/catalog\.generated(?:\.ts)?$/, path.join(process.cwd(), "src/locales/catalog.browser.generated.ts")));
    }
    return config;
  },
  turbopack: {
    root: process.cwd(),
    resolveAlias: { "@/locales/catalog.generated": { browser: "./src/locales/catalog.browser.generated.ts" } }
  },
  reactCompiler: true,
  output: "standalone",
  poweredByHeader: false,
  images: {
    formats: ["image/webp"],
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
    remotePatterns: [
      ...getSupabaseImageRemotePatterns(),
      {
        protocol: "https",
        hostname: "vismuse.com",
        pathname: "/logo.png"
      }
    ]
  },
  async redirects() {
    return [
      ...["/home", "/hotel-lobby-ai", "/app", "/app/create", "/app/hotel-lobby-ai"].map(source => ({source, destination: "/", permanent: true})),
      { source: "/hotel-lobby-ai/:sessionId", destination: "/app/chat/:sessionId", permanent: true },
      { source: "/:path*", has: [{ type: "host" as const, value: "www.hotellobbyaivideos.com" }], destination: "https://hotellobbyaivideos.com/:path*", permanent: true }
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders.map((item) => ({ ...item }))
      },
      {
        source: "/api/:path*",
        headers: [
          ...securityHeaders.map((item) => ({ ...item })),
          { ...noindexRobotsHeader },
          {
            key: "Cache-Control",
            value: "no-store"
          }
        ]
      },
      {
        source: "/api/v1/visual-templates",
        headers: [
          { ...noindexRobotsHeader },
          { ...visualTemplatesCacheHeader }
        ]
      },
      {
        source: "/_next/static/:path*",
        headers: [{ ...noindexRobotsHeader }]
      },
      {
        source: "/assets/videos/:path*",
        headers: [{ ...immutableAssetCacheHeader }]
      }
    ];
  }
};

export default nextConfig;
