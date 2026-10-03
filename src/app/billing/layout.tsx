import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true
    }
  }
};

export default function BillingLayout({ children }: { children: ReactNode }) {
  return children;
}
