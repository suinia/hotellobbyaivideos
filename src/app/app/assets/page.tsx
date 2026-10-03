import type { Metadata } from "next";
import { AppAssets } from "../_components/app-assets-page";

export const metadata: Metadata = {
  title: "Assets",
  robots: {
    index: false,
    follow: false
  }
};

export default function AppAssetsPage() {
  return <AppAssets />;
}
