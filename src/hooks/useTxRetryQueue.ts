"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadQueue,
  addRecord,
  updateRecord,
  removeRecord,
  clearCompleted,
  generateIdempotencyKey,
  type TxRecord,
  type TxStatus,
} from "@/src/services/txPersistence";
import { getTransaction } from "@/src/lib/sorobanClient";

export function useTxRetryQueue() {
  const [records, setRecords] = useState<TxRecord[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => {
    setRecords([...loadQueue()]);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const syncWithNetwork = useCallback(async () => {
    const pending = loadQueue().filter(
      (r) => r.status === "pending" || r.status === "unknown",
    );
    if (pending.length === 0) return;

    setSyncing(true);
    try {
      await Promise.allSettled(
        pending.map(async (record) => {
          if (!record.txHash) {
            updateRecord(record.idempotencyKey, { status: "unknown" });
            return;
          }
          const result = await getTransaction(record.txHash);
          let newStatus: TxStatus;
          switch (result.status) {
            case "SUCCESS":
              newStatus = "confirmed";
              break;
            case "FAILED":
              newStatus = "failed";
              break;
            default:
              newStatus = "unknown";
          }
          updateRecord(record.idempotencyKey, { status: newStatus });
        }),
      );
    } finally {
      setSyncing(false);
      refresh();
    }
  }, [refresh]);

  useEffect(() => {
    syncWithNetwork();
  }, [syncWithNetwork]);

  const enqueue = useCallback(
    async (params: {
      contractId: string;
      method: string;
      args: unknown[];
      txHash?: string;
    }) => {
      const idempotencyKey = generateIdempotencyKey();
      const record: TxRecord = {
        idempotencyKey,
        txHash: params.txHash,
        contractId: params.contractId,
        method: params.method,
        args: params.args,
        status: "pending",
        createdAt: Date.now(),
        lastCheckedAt: Date.now(),
      };
      addRecord(record);
      refresh();
      return record;
    },
    [refresh],
  );

  const retryTransaction = useCallback(
    async (idempotencyKey: string) => {
      const records = loadQueue();
      const record = records.find((r) => r.idempotencyKey === idempotencyKey);
      if (!record || !record.txHash) return;

      updateRecord(idempotencyKey, { status: "pending" });
      refresh();

      try {
        const result = await getTransaction(record.txHash);
        const newStatus: TxStatus =
          result.status === "SUCCESS"
            ? "confirmed"
            : result.status === "FAILED"
              ? "failed"
              : "unknown";
        updateRecord(idempotencyKey, { status: newStatus });
      } catch {
        updateRecord(idempotencyKey, { status: "unknown" });
      }
      refresh();
    },
    [refresh],
  );

  const cancelTransaction = useCallback(
    (idempotencyKey: string) => {
      removeRecord(idempotencyKey);
      refresh();
    },
    [refresh],
  );

  const clearOldCompleted = useCallback(() => {
    clearCompleted();
    refresh();
  }, [refresh]);

  return {
    pendingTransactions: records,
    syncing,
    enqueue,
    retryTransaction,
    cancelTransaction,
    clearOldCompleted,
    syncWithNetwork,
    refresh,
  };
}
