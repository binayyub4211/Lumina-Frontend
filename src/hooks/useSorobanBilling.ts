"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWalletQueryKey } from "@/src/hooks/useWalletIdentity";
import {
  type DecodedError,
  type ErrorDecodeContext,
  resolveError,
} from "@/src/utils/errorDecoder";
import { reportUnknownStellarError } from "@/src/utils/errorTelemetry";

export function useSorobanBilling(defaultContext: ErrorDecodeContext = {}) {
  const [billingError, setBillingError] = useState<DecodedError | null>(null);

  const walletQueryKey = useWalletQueryKey(["soroban", "billing"]);

  const queryKey = useMemo(() => walletQueryKey, [walletQueryKey]);

  const { data: billingData, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      return { balance: "0", status: "active" as const };
    },
    enabled: !walletQueryKey[0]?.startsWith("wallet-blocked"),
    staleTime: 30_000,
  });

  const decodeBillingError = useCallback(
    (error: unknown, context: ErrorDecodeContext = {}) => {
      const decodedError = resolveError(
        error,
        { ...defaultContext, ...context },
        reportUnknownStellarError,
      );

      setBillingError(decodedError);
      return decodedError;
    },
    [defaultContext],
  );

  return {
    billingData,
    billingLoading: isLoading,
    billingError,
    clearBillingError: () => setBillingError(null),
    decodeBillingError,
  };
}
