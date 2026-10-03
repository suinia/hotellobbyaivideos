"use client";

import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";

import { useEffect } from "react";
import { reportClientException } from "@/lib/telemetry/client-exceptions";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  const uiLocale = useUiLocale();
  useEffect(() => {
    reportClientException("react_error", error, { digest: error.digest });
  }, [error]);

  return localizeUiTree((
    <main lang={uiLocale} className="flex min-h-screen items-center justify-center bg-white px-6 text-neutral-950">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          The page hit a temporary client-side error.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          Try again
        </button>
      </div>
    </main>
  ), uiLocale);
}
