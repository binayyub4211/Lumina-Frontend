"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  OptimisticTransactionManager,
  type BalanceDelta,
  type OptimisticSnapshot,
} from "@/src/lib/OptimisticTransactionManager";

export interface BillingData {
  balance: string;
  rawBalance: bigint;
  formattedBalance: string;
  status: "active" | "inactive" | "suspended";
}

export function useSorobanBilling(defaultContext: ErrorDecodeContext = {}) {
  const [billingError, setBillingError] = useState<DecodedError | null>(null);
  const queryClient = useQueryClient();
  const optimisticManagerRef = useRef<OptimisticTransactionManager | null>(null);
  const submitButtonDisabled = useRef(false);

  // Initialize optimistic manager
  if (!optimisticManagerRef.current) {
    optimisticManagerRef.current = new OptimisticTransactionManager(queryClient);
  }

  const walletQueryKey = useWalletQueryKey(["soroban", "billing"]);

  const queryKey = useMemo(() => walletQueryKey, [walletQueryKey]);

  const { data: billingData, isLoading, refetch } = useQuery({
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

  // Reconcile orphaned optimistic snapshots on mount
  useEffect(() => {
    const reconcile = async () => {
      if (!optimisticManagerRef.current) return;

      const backendFetcher = async () => {
        const result = await refetch();
        return {
          rawBalance: result.data?.rawBalance ?? 0n,
        };
      };

      const reconciled = await optimisticManagerRef.current.reconcileOrphanedSnapshots(
        backendFetcher
      );

      if (reconciled > 0) {
        console.log(`Reconciled ${reconciled} orphaned optimistic snapshots`);
      }
    };

    reconcile();
  }, [refetch]);

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

  const submitWithOptimisticUpdate = useCallback(
    async (params: {
      contractId: string;
      method: string;
      args: unknown[];
      txXdr: string;
      delta: BalanceDelta;
    }) => {
      const manager = optimisticManagerRef.current;
      if (!manager) {
        throw new Error("Optimistic manager not initialized");
      }

      // Prevent double submission
      if (submitButtonDisabled.current) {
        console.warn("Submission already in progress, ignoring duplicate request");
        return { success: false, error: "Submission already in progress" };
      }

      submitButtonDisabled.current = true;

      const previousData = queryClient.getQueryData(queryKey);
      
      try {
        // Apply optimistic update within 50ms
        const nonce = manager.applyOptimisticUpdate(
          queryKey,
          params.delta,
          previousData
        );

        // Check for duplicate submission via nonce
        if (!manager.markSubmitting(nonce)) {
          throw new Error("Duplicate transaction submission detected");
        }

        // Persist snapshot for crash recovery
        const snapshot: OptimisticSnapshot = {
          nonce,
          queryKey,
          previousData,
          delta: params.delta,
          timestamp: Date.now(),
          contractId: params.contractId,
          method: params.method,
          args: params.args,
        };
        manager.persistSnapshot(snapshot);

        // Submit actual transaction
        const record = await enqueue({
          contractId: params.contractId,
          method: params.method,
          args: params.args,
        });

        const result = await sendTransaction(params.txXdr);

        if (result.hash && result.status !== "FAILED") {
          // Transaction submitted successfully
          updateRecord(record.idempotencyKey, {
            txHash: result.hash,
            status: result.status === "SUCCESS" ? "confirmed" : "pending",
          });

          // Mark as confirmed and remove snapshot
          manager.removeSnapshot(nonce);
          manager.clearSubmitting(nonce);

          // Refetch to get accurate backend state
          setTimeout(() => {
            refetch();
          }, 3000); // Give blockchain time to confirm

          return { success: true, hash: result.hash, nonce };
        } else {
          // Transaction failed - rollback within 200ms
          const error = result.error ?? "Transaction submission failed";
          
          updateRecord(record.idempotencyKey, { status: "failed" });
          
          manager.rollbackOptimisticUpdate(queryKey, previousData, nonce);
          manager.clearSubmitting(nonce);

          // Decode and set error
          const decodedError = decodeBillingError(new Error(error), {
            transactionHash: result.hash,
            contractId: params.contractId,
          });

          return { success: false, error: decodedError.userMessage, nonce };
        }
      } catch (error) {
        // Rollback on exception
        const nonce = manager.applyOptimisticUpdate(queryKey, params.delta, previousData);
        manager.rollbackOptimisticUpdate(queryKey, previousData, nonce);
        manager.clearSubmitting(nonce);

        const decodedError = decodeBillingError(error, {
          contractId: params.contractId,
        });

        return {
          success: false,
          error: decodedError.userMessage,
        };
      } finally {
        submitButtonDisabled.current = false;
      }
    },
    [queryClient, queryKey, enqueue, refetch, decodeBillingError],
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
    submitWithQueue,
    submitWithOptimisticUpdate,
    decodeBillingError,
    pendingTransactions,
    syncing,
    retryTransaction,
    cancelTransaction,
    clearOldCompleted,
    refreshQueue,
    isSubmitting: submitButtonDisabled.current,
    refetchBalance: refetch,
  };
}
