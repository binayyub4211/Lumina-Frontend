"use client";

import { useState } from "react";
import type { DecodedError, ErrorSeverity } from "@/src/utils/errorDecoder";

interface ErrorToastProps {
  error: DecodedError;
  onDismiss?: () => void;
}

const severityStyles: Record<ErrorSeverity, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  error: "border-rose-200 bg-rose-50 text-rose-950",
};

export function ErrorToast({ error, onDismiss }: ErrorToastProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <aside
      aria-live="polite"
      className={`w-full max-w-xl rounded-lg border p-4 shadow-sm ${severityStyles[error.severity]}`}
      role="status"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase">
            {error.errorType.replace("_", " ")}
          </p>
          <p className="mt-1 text-base font-medium">{error.userMessage}</p>
          <p className="mt-1 text-sm opacity-80">Code: {error.errorCode}</p>
        </div>

        {onDismiss ? (
          <button
            aria-label="Dismiss error"
            className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold hover:bg-black/10"
            onClick={onDismiss}
            type="button"
          >
            x
          </button>
        ) : null}
      </div>

      <button
        className="mt-3 text-sm font-semibold underline underline-offset-4"
        onClick={() => setIsExpanded((current) => !current)}
        type="button"
      >
        {isExpanded ? "Hide troubleshooting" : "Show troubleshooting"}
      </button>

      {isExpanded ? (
        <div className="mt-3 space-y-3 text-sm">
          <ul className="list-disc space-y-2 pl-5">
            {error.troubleshootingSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>

          {error.documentationUrl ? (
            <a
              className="inline-flex font-semibold underline underline-offset-4"
              href={error.documentationUrl}
              rel="noreferrer"
              target="_blank"
            >
              Stellar documentation
            </a>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
