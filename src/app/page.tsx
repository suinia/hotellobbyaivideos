import Link from "next/link";
import styles from "@/components/hotel-home.module.css";
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
      <main>
        <section className={styles.hero}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>YOUR PHOTOS. YOUR CAST. YOUR STAGE.</p>
            <h1>Hotel Lobby AI<br/><span>Put your photos<br/>in the spotlight.</span></h1>
            <p className={styles.description}>Turn portraits of friends, characters, or pets into an AI rap video. An orange studio, a hanging mic, and a performance that’s yours.</p>
            <div className={styles.actions}><Link className={styles.primary} href="/hotel-lobby-ai">Create your video ↗</Link><Link className={styles.secondary} href="/examples">Watch examples →</Link></div>
            <p className={styles.note}>Solo, duet, or pets · No editing skills needed</p>
          </div>
          <div className={styles.stage}><video controls playsInline preload="metadata" poster="/assets/hotel-lobby-ai/demos/rap-v1/cat-duet_poster.webp" aria-label="Hotel Lobby AI cat duet example"><source src="/assets/hotel-lobby-ai/demos/rap-v1/cat-duet.mp4" type="video/mp4"/></video><div className={styles.caption}><span>FROM PHOTO TO PERFORMANCE</span><strong>Two cats. One mic.</strong><p>Original AI example · Your cast is next.</p></div></div>
        </section>
        <HotelLobbyContent />
      </main>
    </>
  );
}
