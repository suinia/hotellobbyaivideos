import { publicPageMetadata } from "@/lib/page-metadata";
import Link from "next/link";
import { PromptBrowser } from "@/components/hotel-library-browser";
import HotelSiteFooter from "@/components/hotel-site-footer";
import styles from "@/components/hotel-site.module.css";
export const metadata = publicPageMetadata("/prompts", "Hotel Lobby AI Prompts — Solo, Duet & Pets", "Browse and copy Hotel Lobby AI prompts for solo performances, pet duets, cinematic camera moves, and orange-studio videos. Open a prompt directly in the studio.");
export default function Prompts(){return <><main className={styles.page}><div className={styles.hero}><p className={styles.eyebrow}>THE PROMPT LIBRARY</p><h1>A starting point.<br/>Not a blank page.</h1><p>Choose a direction for your cast. Copy it, make a few changes, or open it in the studio with the right performance mode already selected.</p></div><PromptBrowser/><section className={styles.banner}><div><h2>A few clear directions go a long way.</h2><p>Learn how to describe the scene, camera, and energy without overloading a short clip.</p></div><Link className={styles.button} href="/guides/hotel-lobby-ai-prompts">Explore the prompt guide →</Link></section></main><HotelSiteFooter/></>}
