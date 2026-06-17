"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createQueryClient } from "@/src/lib/queryClient";
import { installOfflineSync } from "@/src/lib/offlineSync";
import { WalletProvider } from "@/src/components/providers/WalletProvider";
import { WalletStatusBar } from "@/src/components/shared/WalletStatusBar";

function OfflineSyncInstigator() {
  useEffect(() => installOfflineSync(), []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <OfflineSyncInstigator />
      <WalletProvider>
        {children}
        <WalletStatusBar />
      </WalletProvider>
    </QueryClientProvider>
  );
}
