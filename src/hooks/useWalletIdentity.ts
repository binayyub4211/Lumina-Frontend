"use client";

import { useContext, useMemo } from "react";
import { WalletContext } from "@/src/components/providers/WalletProvider";

export interface WalletIdentity {
  publicKey: string | null;
  generation: number;
  isTransitioning: boolean;
}

export function useWalletIdentity(): WalletIdentity {
  const ctx = useContext(WalletContext);

  return useMemo(
    () => ({
      publicKey: ctx?.publicKey ?? null,
      generation: ctx?.generation ?? 0,
      isTransitioning: ctx?.isTransitioning ?? false,
    }),
    [ctx?.publicKey, ctx?.generation, ctx?.isTransitioning],
  );
}

export function useWalletQueryKey(baseKey: string[]): string[] {
  const { publicKey, isTransitioning } = useWalletIdentity();

  return useMemo(
    () => {
      if (!publicKey || isTransitioning) return ["wallet-blocked", ...baseKey];
      return [publicKey, ...baseKey];
    },
    [publicKey, isTransitioning, baseKey],
  );
}
