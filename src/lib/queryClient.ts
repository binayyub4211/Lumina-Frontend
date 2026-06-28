"use client";

import {
  QueryClient,
} from "@tanstack/react-query";

let walletTransitioningRef: { current: boolean } = { current: false };

export function setWalletTransitioningRef(ref: { current: boolean }) {
  walletTransitioningRef = ref;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Garbage-collect cache entries 30s after they go unused, regardless of
        // subscriptions (Technical Invariants & Bounds).
        gcTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function isWalletTransitioning(): boolean {
  return walletTransitioningRef.current;
}
