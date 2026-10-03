"use client";

import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";

import Link from "next/link";

export default function NotFoundPage() {
  const uiLocale = useUiLocale();
  return localizeUiTree((
    <main lang={uiLocale} style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f8fafc" }}>
      <section style={{ width: "min(100%, 520px)", padding: "48px 32px", border: "1px solid #e2e8f0", borderRadius: 16, background: "#fff", textAlign: "center", boxShadow: "0 18px 55px rgba(15, 23, 42, 0.08)" }}>
        <p style={{ margin: 0, color: "#64748b", fontSize: 14, fontWeight: 700, letterSpacing: "0.08em" }}>404</p>
        <h1 style={{ margin: "12px 0 0", color: "#0f172a", fontSize: "clamp(30px, 6vw, 44px)", lineHeight: 1.1 }}>Page not found</h1>
        <p style={{ margin: "16px auto 28px", maxWidth: 360, color: "#64748b", fontSize: 16, lineHeight: 1.6 }}>
          This page may have moved or is no longer available.
        </p>
        <Link href="/" style={{ display: "inline-flex", minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 999, padding: "0 20px", background: "#0f172a", color: "#fff", fontWeight: 700, textDecoration: "none" }}>
          Back to home
        </Link>
      </section>
    </main>
  ), uiLocale);
}
