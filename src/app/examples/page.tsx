import { publicPageMetadata } from "@/lib/page-metadata";
import Link from "next/link";
import { ExampleBrowser } from "@/components/hotel-library-browser";
import HotelSiteFooter from "@/components/hotel-site-footer";
import styles from "@/components/hotel-site.module.css";
export const metadata = publicPageMetadata("/examples", "Hotel Lobby AI Video Examples", "Watch original Hotel Lobby AI cat, dog, and people duets. Explore the prompts and photo tips behind each orange-studio performance.");
export default function Examples(){return <><main className={styles.page}><div className={styles.hero}><p className={styles.eyebrow}>THE STUDIO SCREENING ROOM</p><h1>Same stage.<br/>A different story every time.</h1><p>Meet the cats, unexpected duos, and characters who have already taken the mic. Watch a take, explore its direction, and start your own.</p></div><ExampleBrowser/><section className={styles.banner}><div><h2>Who’s in your next video?</h2><p>Use your own photos with any of these performance ideas.</p></div><Link className={styles.button} href="/prompts">Find your starting prompt →</Link></section></main><HotelSiteFooter/></>}
