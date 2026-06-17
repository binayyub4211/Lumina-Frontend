"use client";

import { type TxRecord } from "@/src/services/txPersistence";

interface PendingTxPanelProps {
  transactions: TxRecord[];
  syncing: boolean;
  onRetry: (idempotencyKey: string) => void;
  onCancel: (idempotencyKey: string) => void;
  onClearCompleted: () => void;
  onRefresh: () => void;
}

function StatusBadge({ status }: { status: TxRecord["status"] }) {
  const config: Record<
    TxRecord["status"],
    { label: string; className: string }
  > = {
    pending: {
      label: "Pending",
      className: "bg-amber-50 text-amber-800 border-amber-200",
    },
    confirmed: {
      label: "Confirmed",
      className: "bg-green-50 text-green-800 border-green-200",
    },
    failed: {
      label: "Failed",
      className: "bg-rose-50 text-rose-800 border-rose-200",
    },
    unknown: {
      label: "Unknown",
      className: "bg-yellow-50 text-yellow-800 border-yellow-200",
    },
  };

  const { label, className } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-semibold ${className}`}
    >
      {status === "pending" ? (
        <svg
          className="h-3 w-3 animate-spin"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="28"
            strokeDashoffset="8"
            opacity="0.4"
          />
        </svg>
      ) : status === "confirmed" ? (
        <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm3.36 4.65-4.14 4.5a.5.5 0 0 1-.74 0l-2.07-2.25a.5.5 0 1 1 .75-.69l1.7 1.84 3.76-4.09a.5.5 0 0 1 .74.69z" />
        </svg>
      ) : status === "failed" ? (
        <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm2.12 9.88a.5.5 0 0 1-.7.7L8 10.21l-1.41 1.42a.5.5 0 0 1-.7-.7L7.3 9.5 5.88 8.09a.5.5 0 0 1 .7-.7L8 8.79l1.41-1.41a.5.5 0 0 1 .7.7L8.7 9.5l1.42 1.39z" />
        </svg>
      ) : (
        <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0v-4A.5.5 0 0 1 8 4zm0 7.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z" />
        </svg>
      )}
      {label}
    </span>
  );
}

export function PendingTxPanel({
  transactions,
  syncing,
  onRetry,
  onCancel,
  onClearCompleted,
  onRefresh,
}: PendingTxPanelProps) {
  const hasCompleted = transactions.some(
    (tx) => tx.status === "confirmed" || tx.status === "failed",
  );

  return (
    <section className="rounded-lg border border-[#d8d0c1] bg-white">
      <div className="flex items-center justify-between border-b border-[#d8d0c1] px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-[#171512]">
            Pending Transactions
          </h2>
          <p className="mt-0.5 text-sm text-[#6f5f48]">
            {transactions.length === 0
              ? "No transactions in queue"
              : `${transactions.filter((t) => t.status === "pending").length} pending, ${transactions.length} total`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {syncing && (
            <span className="text-xs text-[#6f5f48]">Syncing...</span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-md border border-[#cfc4b1] px-3 py-1.5 text-sm font-medium text-[#3e3830] transition hover:border-[#0f766e] hover:text-[#0f766e]"
          >
            Refresh
          </button>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-[#6f5f48]">
          No broadcast transactions recorded yet.
        </div>
      ) : (
        <div className="divide-y divide-[#ece5d8]">
          {transactions.map((tx) => (
            <div
              key={tx.idempotencyKey}
              className="flex items-center justify-between gap-4 px-5 py-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <StatusBadge status={tx.status} />
                  <span className="truncate text-sm font-medium text-[#171512]">
                    {tx.contractId}.{tx.method}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[#6f5f48]">
                  <span>
                    Created:{" "}
                    {new Date(tx.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {tx.txHash && (
                    <span className="font-mono" title={tx.txHash}>
                      Hash: {tx.txHash.slice(0, 12)}...
                    </span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {(tx.status === "failed" || tx.status === "unknown") && (
                  <button
                    type="button"
                    onClick={() => onRetry(tx.idempotencyKey)}
                    className="rounded-md bg-[#0f766e] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#115e59]"
                  >
                    Retry
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onCancel(tx.idempotencyKey)}
                  className="rounded-md border border-[#cfc4b1] px-3 py-1.5 text-xs font-medium text-[#6f5f48] transition hover:border-rose-300 hover:text-rose-600"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasCompleted && (
        <div className="border-t border-[#ece5d8] px-5 py-3">
          <button
            type="button"
            onClick={onClearCompleted}
            className="text-xs font-medium text-[#6f5f48] underline underline-offset-2 transition hover:text-[#0f766e]"
          >
            Clear completed &gt; 24h old
          </button>
        </div>
      )}
    </section>
  );
}
