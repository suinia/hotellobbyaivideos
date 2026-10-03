import type { Metadata } from "next";
import { Suspense } from "react";
import { AppThread } from "../../_components/app-thread";

type AppChatPageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "Task",
  robots: {
    index: false,
    follow: false
  }
};

export default async function AppChatPage({ params }: AppChatPageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={null}>
      <AppThread sessionId={id} preferPublicToolRoutes />
    </Suspense>
  );
}
