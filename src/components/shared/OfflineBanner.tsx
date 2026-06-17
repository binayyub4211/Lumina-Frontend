"use client";

import { useEffect, useState } from "react";

const isBrowserOnline = () =>
  typeof navigator !== "undefined" ? navigator.onLine : true;

/**
 * A tiny self-contained banner that is safe to embed on the offline
 * fallback page (which is fully static and cannot reliably ship data
 * hooks).
 */
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState<boolean>(isBrowserOnline);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <p
      data-testid="offline-banner"
      data-online={isOnline}
      className={`mt-6 inline-flex items-center rounded-md border px-3 py-1 text-xs font-semibold ${
        isOnline
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-300 bg-amber-100 text-amber-900"
      }`}
    >
      <span
        aria-hidden
        className={`mr-2 h-2 w-2 rounded-full ${
          isOnline ? "bg-emerald-500" : "bg-amber-500"
        }`}
      />
      {isOnline ? "Back online · syncing queue" : "Offline · pending actions queued"}
    </p>
  );
}
