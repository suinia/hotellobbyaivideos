import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { AppAuthModal } from "./_components/app-auth-modal";
import { AppShellLayout } from "./_components/app-shell-layout";

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

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppAuthModal />
      <Suspense fallback={null}>
        <AppShellLayout>{children}</AppShellLayout>
      </Suspense>
    </>
  );
}
