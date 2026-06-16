"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { createQueryClient } from "@/src/lib/queryClient";
import { WalletProvider } from "@/src/components/providers/WalletProvider";
import { WalletStatusBar } from "@/src/components/shared/WalletStatusBar";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        {children}
        <WalletStatusBar />
      </WalletProvider>
    </QueryClientProvider>
  );
}
