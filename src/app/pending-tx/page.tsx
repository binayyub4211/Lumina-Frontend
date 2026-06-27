"use client";

import Link from "next/link";
import { PendingTxPanel } from "@/src/components/wallet/PendingTxPanel";
import { useTxRetryQueue } from "@/src/hooks/useTxRetryQueue";

export default function PendingTxPage() {
  const {
    pendingTransactions,
    syncing,
    retryTransaction,
    cancelTransaction,
    clearOldCompleted,
    refresh,
  } = useTxRetryQueue();

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#171512]">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-[#d8d0c1] pb-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#6f5f48]">
              Lumina Network
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#171512] sm:text-4xl">
              Transaction Recovery
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-md border border-[#cfc4b1] bg-white px-4 py-2 text-sm font-medium text-[#3e3830] transition hover:border-[#0f766e] hover:text-[#0f766e]"
          >
            Back to Dashboard
          </Link>
        </header>

        <div className="mt-8">
          <PendingTxPanel
            transactions={pendingTransactions}
            syncing={syncing}
            onRetry={retryTransaction}
            onCancel={cancelTransaction}
            onClearCompleted={clearOldCompleted}
            onRefresh={refresh}
          />
        </div>
      </div>
    </main>
  );
}
