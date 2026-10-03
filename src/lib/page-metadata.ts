import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "./site";

export function publicPageMetadata(path: string, title: string, description: string, image = "/assets/hotel-lobby-ai/pets.webp", type: "website" | "article" = "website"): Metadata {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: path },
    openGraph: { title: fullTitle, description, url: `${SITE_URL}${path}`, siteName: SITE_NAME, type, images: [{ url: image, alt: title }] },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [image] }
  };
}
