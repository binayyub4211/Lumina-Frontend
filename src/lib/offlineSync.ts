"use client";

/**
 * Boot-level offline infrastructure installed once from the Providers
 * tree. The application-level telemetry module and the WalletStatusBar
 * component both rely on the global listeners being present from the
 * very first page load — i.e. no longer gated on the path of an error
 * report. Exposed as functions so server components never pull this in.
 */
import { flushQueue } from "@/src/lib/offlineQueue";

let installed = false;
let inflightFlush: Promise<void> | null = null;

function triggerFlush(): Promise<void> {
  if (inflightFlush) return inflightFlush;
  // Coerce `Promise<FlushSummary>` down to `Promise<void>` via a `.then`
  // adapter so the assignment to `inflightFlush: Promise<void> | null`
  // typechecks without resorting to `as unknown`.
  const guard: Promise<void> = flushQueue()
    .then(() => undefined)
    .catch((error: unknown) => {
      console.warn("Failed to flush offline queue", error);
    });
  inflightFlush = guard.finally(() => {
    inflightFlush = null;
  });
  return inflightFlush;
}

export function installOfflineSync(): () => void {
  if (typeof window === "undefined" || installed) {
    return () => {};
  }
  installed = true;

  const handleOnline = (): void => {
    void triggerFlush();
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("pageshow", handleOnline);

  // Drain anything left over from a prior session as soon as we boot. This
  // is a best-effort flush; the network state at the very first browser
  // tick may be stale.
  if (window.navigator.onLine) {
    queueMicrotask(handleOnline);
  }

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("pageshow", handleOnline);
    installed = false;
  };
}
