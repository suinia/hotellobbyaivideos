import type { Metadata } from "next";
import { AppRecents } from "../_components/app-recents-page";

export const metadata: Metadata = {
  title: "Recents",
  robots: {
    index: false,
    follow: false
  }
};

export default function AppRecentsPage() {
  return <AppRecents />;
}
