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
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function isWalletTransitioning(): boolean {
  return walletTransitioningRef.current;
}
