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
import { useTxRetryQueue } from "@/src/hooks/useTxRetryQueue";
import { sendTransaction } from "@/src/lib/sorobanClient";
import { updateRecord } from "@/src/services/txPersistence";
import {
  StroopConverter,
  STROOP_DECIMALS,
} from "@/src/utils/balance_scaler";
import { formatStroop } from "@/src/lib/bigintmath";

export interface BillingData {
  balance: string;
  rawBalance: bigint;
  formattedBalance: string;
  status: "active" | "inactive" | "suspended";
}

export function useSorobanBilling(defaultContext: ErrorDecodeContext = {}) {
  const [billingError, setBillingError] = useState<DecodedError | null>(null);

  const walletQueryKey = useWalletQueryKey(["soroban", "billing"]);

  const queryKey = useMemo(() => walletQueryKey, [walletQueryKey]);

  const { data: billingData, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const rawBalance = StroopConverter.fromBlockchain("0");
      return {
        balance: rawBalance.toString(),
        rawBalance,
        formattedBalance: formatStroop(rawBalance, STROOP_DECIMALS),
        status: "active" as const,
      };
    },
    enabled: !walletQueryKey[0]?.startsWith("wallet-blocked"),
    staleTime: 30_000,
  });

  const {
    pendingTransactions,
    syncing,
    enqueue,
    retryTransaction,
    cancelTransaction,
    clearOldCompleted,
    refresh: refreshQueue,
  } = useTxRetryQueue();

  const submitWithQueue = useCallback(
    async (params: {
      contractId: string;
      method: string;
      args: unknown[];
      txXdr: string;
    }) => {
      const record = await enqueue({
        contractId: params.contractId,
        method: params.method,
        args: params.args,
      });

      const result = await sendTransaction(params.txXdr);

      if (result.hash) {
        updateRecord(record.idempotencyKey, {
          txHash: result.hash,
          status:
            result.status === "SUCCESS" ||
            result.status === "PENDING"
              ? "pending"
              : "failed",
        });
      } else {
        updateRecord(record.idempotencyKey, { status: "failed" });
      }

      return result;
    },
    [enqueue],
  );

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
    pendingTransactions,
    syncing,
    submitWithQueue,
    retryTransaction,
    cancelTransaction,
    clearOldCompleted,
    refreshQueue,
  };
}
