"use client";

import { useWalletIdentity } from "@/src/hooks/useWalletIdentity";

export function WalletStatusBar() {
  const { publicKey, generation, isTransitioning } = useWalletIdentity();

  return (
    <div
      data-testid="wallet-status"
      style={{ display: "none" }}
    >
      <span
        data-testid="wallet-indicator"
        data-public-key={publicKey ?? "disconnected"}
      />
      <span
        data-testid="wallet-generation"
        data-generation={generation}
      />
      <span
        data-testid="wallet-transitioning"
        data-transitioning={isTransitioning}
      />
    </div>
  );
}
