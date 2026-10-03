import HotelSiteNav from "@/components/hotel-site-nav";
import type { Metadata } from "next";
import { SiteLocaleProvider } from "@/lib/i18n/site-locale-provider";
import MobileKeyboardDismiss from "@/components/mobile-keyboard-dismiss";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from "@/lib/site";
import "./globals.css";
export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL), title: { default: "Hotel Lobby AI Video Generator — Photos to Rap Videos", template: "%s | Hotel Lobby AI" },
    description: SITE_DESCRIPTION, alternates: { canonical: "/" },
    openGraph: { type: "website", siteName: SITE_NAME, title: "Hotel Lobby AI Video Generator", description: SITE_DESCRIPTION, url: SITE_URL, images: [{ url: "/assets/hotel-lobby-ai/pets.webp", alt: "Two cats in an orange music studio" }] },
    twitter: { card: "summary_large_image", title: "Hotel Lobby AI Video Generator", description: SITE_DESCRIPTION, images: ["/assets/hotel-lobby-ai/pets.webp"] },
    icons: { icon: [{ url: "/brand/icon-32.png", sizes: "32x32", type: "image/png" }, { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }], apple: [{ url: "/brand/icon-180.png", sizes: "180x180", type: "image/png" }] }
};
export default function RootLayout({ children }: Readonly<{
    children: React.ReactNode;
}>) {
    return <html lang="en"><body><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: SITE_URL }).replace(/</g, "\\u003c") }}/><SiteLocaleProvider locale="en"><HotelSiteNav />{children}</SiteLocaleProvider><MobileKeyboardDismiss /></body></html>;
}
