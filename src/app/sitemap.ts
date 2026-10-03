import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
export default function sitemap(): MetadataRoute.Sitemap { return ["/", "/pricing", "/examples", "/examples/cat-duet", "/examples/cat-dog-duet", "/examples/grandparents-duet", "/prompts", "/guides", "/guides/how-to-make-hotel-lobby-ai-video", "/guides/hotel-lobby-ai-pets", "/guides/hotel-lobby-ai-prompts", "/privacy", "/terms", "/refund-policy"].map(path => ({ url: `${SITE_URL}${path}`, lastModified: "2026-10-02", changeFrequency: path === "/" ? "weekly" : "monthly", priority: path === "/" ? 1 : 0.7 })); }
