"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

type WaffoSubscription = {
  subscription_id: string;
  status?: string | null;
  cancel_at_period_end?: boolean | null;
  current_period_end_at?: string | null;
};

function safeReturnPath(value?: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/app";
}

function formatPeriodEnd(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
}

function WaffoSubscriptionManager() {
  const searchParams = useSearchParams();
  const returnTo = useMemo(() => safeReturnPath(searchParams.get("return_to")), [searchParams]);
  const [subscription, setSubscription] = useState<WaffoSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSubscription = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/v1/billing/waffo/subscription", { cache: "no-store" });
      const body = await response.json().catch(() => ({})) as WaffoSubscription & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load subscription settings.");
      setSubscription(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load subscription settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSubscription();
  }, [loadSubscription]);

  const updateSubscription = useCallback(async (action: "cancel" | "reactivate") => {
    if (action === "cancel" && !window.confirm("Cancel this subscription at the end of the current billing period?")) {
      return;
    }
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/v1/billing/waffo/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const body = await response.json().catch(() => ({})) as { status?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to update subscription.");
      setSubscription((current) => current ? {
        ...current,
        status: body.status ?? current.status,
        cancel_at_period_end: action === "cancel"
      } : current);
      setNotice(action === "cancel"
        ? "Your subscription will end at the close of the current billing period."
        : "Your subscription has been reactivated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update subscription.");
    } finally {
      setSubmitting(false);
    }
  }, []);

  const periodEnd = formatPeriodEnd(subscription?.current_period_end_at);
  const action = subscription?.cancel_at_period_end ? "reactivate" : "cancel";

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#0b1020", color: "#f8fafc" }}>
      <section style={{ width: "min(100%, 560px)", border: "1px solid rgba(255,255,255,.16)", borderRadius: 18, padding: 32, background: "#131a2d", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <h1 style={{ margin: 0, fontSize: 25 }}>Subscription settings</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>Manage your subscription securely through Vismuse.</p>

        {loading ? <p>Loading subscription…</p> : null}
        {error ? <p role="alert" style={{ color: "#fda4af" }}>{error}</p> : null}
        {notice ? <p role="status" style={{ color: "#86efac" }}>{notice}</p> : null}

        {subscription && !loading ? (
          <div style={{ display: "grid", gap: 14, marginTop: 24 }}>
            <div style={{ borderRadius: 12, padding: 16, background: "rgba(255,255,255,.06)" }}>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>Status</div>
              <strong style={{ textTransform: "capitalize" }}>{subscription.status || "active"}</strong>
              {subscription.cancel_at_period_end && periodEnd ? <p style={{ marginBottom: 0, color: "#cbd5e1" }}>Access remains active until {periodEnd}.</p> : null}
            </div>
            <button
              type="button"
              onClick={() => void updateSubscription(action)}
              disabled={submitting}
              style={{ minHeight: 42, border: 0, borderRadius: 10, padding: "0 16px", cursor: submitting ? "wait" : "pointer", fontWeight: 700, background: action === "cancel" ? "#fee2e2" : "#dcfce7", color: "#1e293b" }}
            >
              {submitting ? "Updating…" : action === "cancel" ? "Cancel subscription" : "Reactivate subscription"}
            </button>
          </div>
        ) : null}

        <p style={{ marginTop: 28, marginBottom: 0 }}><Link href={returnTo} style={{ color: "#a5b4fc" }}>← Back to Vismuse</Link></p>
      </section>
    </main>
  );
}

export default function WaffoSubscriptionPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b1020", color: "#f8fafc" }}>Loading subscription settings…</main>}>
      <WaffoSubscriptionManager />
    </Suspense>
  );
}
