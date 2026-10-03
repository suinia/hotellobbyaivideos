import { Suspense } from "react";
import { AppTool } from "@/app/app/_components/app-workbench";
import { AppAuthModal } from "@/app/app/_components/app-auth-modal";
import { AppShellLayout } from "@/app/app/_components/app-shell-layout";
import { HotelLobbyContent, hotelFaqs } from "@/components/hotel-lobby-content";
import { SITE_URL, SITE_DESCRIPTION } from "@/lib/site";

export default function Home() {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Hotel Lobby AI Video Generator",
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: hotelFaqs.map(([name, text]) => ({
        "@type": "Question", name,
        acceptedAnswer: { "@type": "Answer", text },
      })),
    },
    ...[
      ["cat-duet", "The cat duet", "Two cats share a microphone in an orange studio.", "2026-09-30T12:09:20.057Z"],
      ["cat-dog-duet", "An unlikely duo", "A cat and corgi share the spotlight in an orange studio.", "2026-09-30T12:11:33.233Z"],
      ["grandparents-duet", "Generations of cool", "An original older couple performs a relaxed orange-studio duet.", "2026-09-30T12:09:22.130Z"],
    ].map(([slug, name, description, uploadDate]) => ({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name, description, uploadDate, duration: "PT8S",
      contentUrl: `${SITE_URL}/assets/hotel-lobby-ai/demos/rap-v1/${slug}.mp4`,
      thumbnailUrl: `${SITE_URL}/assets/hotel-lobby-ai/demos/rap-v1/${slug}_poster.webp`,
    })),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
      <AppAuthModal />
      <Suspense fallback={<p role="status">Loading your Hotel Lobby workspace…</p>}>
        <AppShellLayout>
          <AppTool slug="hotel-lobby-ai" />
          <HotelLobbyContent />
        </AppShellLayout>
      </Suspense>
    </>
  );
}
