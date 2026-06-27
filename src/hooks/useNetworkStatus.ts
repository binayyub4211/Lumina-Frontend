"use client";

import { useEffect, useState } from "react";

function readOnlineStatus(): boolean {
  if (typeof navigator === "undefined") {
    return true;
  }
  return navigator.onLine;
}

export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(readOnlineStatus);

  useEffect(() => {
    const updateStatus = () => setIsOnline(readOnlineStatus());

    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  return isOnline;
}
