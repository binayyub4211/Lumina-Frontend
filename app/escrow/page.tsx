"use client";

import { EscrowPanel } from "@/src/components/wallet/EscrowPanel";
import { PendingTxPanel } from "@/src/components/wallet/PendingTxPanel";
import { useSorobanBilling } from "@/src/hooks/useSorobanBilling";

export default function EscrowPage() {
  const {
    pendingTransactions,
    syncing,
    retryTransaction,
    cancelTransaction,
    clearOldCompleted,
    refreshQueue,
  } = useSorobanBilling();

  return (
    <main className="min-h-screen bg-[#faf8f5] px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#171512]">
            Soroban Escrow Dashboard
          </h1>
          <p className="mt-2 text-[#6f5f48]">
            Manage your escrow funds with instant optimistic updates
          </p>
        </div>

        {/* Escrow Management Panel */}
        <EscrowPanel />

        {/* Pending Transactions Panel */}
        <PendingTxPanel
          transactions={pendingTransactions}
          syncing={syncing}
          onRetry={retryTransaction}
          onCancel={cancelTransaction}
          onClearCompleted={clearOldCompleted}
          onRefresh={refreshQueue}
        />

        {/* Feature Info */}
        <div className="rounded-lg border border-[#d8d0c1] bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold text-[#171512]">
            Optimistic UI Features
          </h2>
          <ul className="space-y-2 text-sm text-[#6f5f48]">
            <li className="flex items-start gap-2">
              <span className="mt-1 text-[#0f766e]">✓</span>
              <span>
                <strong>Instant Updates:</strong> Balance changes appear within 50ms
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 text-[#0f766e]">✓</span>
              <span>
                <strong>Fast Rollback:</strong> Failed transactions revert within 200ms
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 text-[#0f766e]">✓</span>
              <span>
                <strong>Duplicate Prevention:</strong> Nonce-based deduplication prevents double submissions
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 text-[#0f766e]">✓</span>
              <span>
                <strong>Crash Recovery:</strong> SessionStorage ensures state survives page refreshes
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 text-[#0f766e]">✓</span>
              <span>
                <strong>Smart Reconciliation:</strong> Orphaned optimistic entries automatically reconciled with backend
              </span>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
