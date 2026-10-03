"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./hotel-site.module.css";
const links = [["/", "Create"], ["/examples", "Examples"], ["/prompts", "Prompts"], ["/guides", "Guides"], ["/pricing", "Pricing"]] as const;
export default function HotelSiteNav({workspace=false}:{workspace?:boolean}) {
  const path=usePathname();
  const isWorkspace=path==="/"||path.startsWith("/app");
  if (path.startsWith("/app/chat/")||workspace!==isWorkspace) return null;
  return <header className={`${styles.header} ${workspace?styles.workspaceHeader:""}`}>
    {!workspace && <Link href="/" className={styles.brand}><img src="/icon.svg" width={28} height={28} alt=""/>Hotel Lobby AI</Link>}
    <nav aria-label="Website navigation">{links.map(([href,label])=><Link key={href} href={href} aria-current={(href==="/"?path==="/":path===href||path.startsWith(`${href}/`))?"page":undefined}>{label}</Link>)}</nav>
    {!workspace && <Link className={styles.headerCta} href="/">Open studio ↗</Link>}
  </header>;
}
