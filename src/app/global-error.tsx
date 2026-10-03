"use client";

import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";

import { useEffect } from "react";
import { reportClientException } from "@/lib/telemetry/client-exceptions";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const uiLocale = useUiLocale();
  useEffect(() => {
    reportClientException("react_global_error", error, { digest: error.digest });
  }, [error]);

  return localizeUiTree((
    <html lang={uiLocale}>
      <body>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            color: "#0a0a0a",
            background: "#ffffff",
            fontFamily: "Arial, Helvetica, sans-serif"
          }}
        >
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Something went wrong</h1>
            <p style={{ margin: "12px 0 0", color: "#525252", fontSize: 14, lineHeight: 1.6 }}>
              The page hit a temporary client-side error.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 24,
                border: 0,
                borderRadius: 6,
                background: "#0a0a0a",
                color: "#ffffff",
                padding: "8px 16px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  ), uiLocale);
}
