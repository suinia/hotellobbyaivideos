"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./hotel-site.module.css";
const links = [["/", "Home"], ["/hotel-lobby-ai", "Studio"], ["/examples", "Examples"], ["/prompts", "Prompts"], ["/guides", "Guides"], ["/pricing", "Pricing"]] as const;
export default function HotelSiteNav({workspace=false}:{workspace?:boolean}) {
  const path=usePathname();
  const isWorkspace=path==="/hotel-lobby-ai"||path.startsWith("/app");
  if (path.startsWith("/app/chat/")||workspace!==isWorkspace) return null;
  return <header className={`${styles.header} ${workspace?styles.workspaceHeader:""}`}>
    {!workspace && <Link href="/" className={styles.brand}><img src="/brand/logo.png" width={192} height={36} style={{objectFit:"contain",height:"auto"}} alt="Hotel Lobby AI"/></Link>}
    <nav aria-label="Website navigation">{links.map(([href,label])=><Link key={href} href={href} aria-current={(href==="/"?path==="/":path===href||path.startsWith(`${href}/`))?"page":undefined}>{label}</Link>)}</nav>
    {!workspace && <Link className={styles.headerCta} href="/hotel-lobby-ai">Open studio ↗</Link>}
  </header>;
}
