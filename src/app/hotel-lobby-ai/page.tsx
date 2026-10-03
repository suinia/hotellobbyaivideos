import { Suspense } from "react";
import { AppTool } from "@/app/app/_components/app-workbench";
import { AppAuthModal } from "@/app/app/_components/app-auth-modal";
import { AppShellLayout } from "@/app/app/_components/app-shell-layout";
import { publicPageMetadata } from "@/lib/page-metadata";
export const metadata = { ...publicPageMetadata("/hotel-lobby-ai", "Hotel Lobby AI Studio", "Create your Hotel Lobby AI video. Upload photos, choose Solo, Duet or Pet duet, and customize your performance."), robots: { index: false, follow: true } };
export default function Studio() { return <><AppAuthModal/><Suspense fallback={<p role="status">Loading your Hotel Lobby studio…</p>}><AppShellLayout><AppTool slug="hotel-lobby-ai"/></AppShellLayout></Suspense></>; }
