"use client";

import { useState, useEffect, useCallback, useId } from "react";
import { FeeEstimator, type SimulationStatus } from "@/src/components/wallet/FeeEstimator";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TxModalProps {
  /** Whether the modal is visible */
  open: boolean;
  /** Called when the user closes/cancels the modal */
  onClose: () => void;
  /**
   * Called when the user presses Confirm.
   * The modal will not close itself — the parent is responsible.
   */
  onConfirm: () => void | Promise<void>;
  /**
   * Base64-encoded transaction envelope XDR.
   * Passed to FeeEstimator for pre-flight simulation.
   * Pass null to skip fee estimation (e.g. classic Stellar payments).
   */
  txXdr: string | null;
  /** Modal heading, e.g. "Confirm Deposit" */
  title: string;
  /** Optional sub-heading sentence under the title */
  description?: string;
  /** Short operation label shown in the summary row, e.g. "Deposit" */
  operation: string;
  /** Human-readable amount string, e.g. "12.5 XLM" */
  amount: string;
  /** Target contract or recipient identifier (truncated automatically) */
  contractId?: string;
  /** Soroban method name, e.g. "deposit" */
  method?: string;
  /** Whether the parent is currently processing the confirmed action */
  isConfirming?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(value: string, head = 8, tail = 6): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="tx-summary-row">
      <span className="tx-summary-label">{label}</span>
      <span className={`tx-summary-value${mono ? " font-mono" : ""}`}>{value}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * TxModal — Soroban transaction confirmation dialog.
 *
 * Layout:
 * 1. Header     — title + close button
 * 2. Summary    — read-only overview of the operation
 * 3. FeeEstimator — pre-flight simulation panel (skeleton → table or error)
 * 4. Actions    — Cancel and Confirm buttons; Confirm is gated on simulation
 *
 * The Confirm button is disabled while:
 * - Fee estimation is loading (first-run, no cache)
 * - Simulation returned an error (contract revert, RPC failure)
 * - The parent signals it is processing the confirmed action
 */
export function TxModal({
  open,
  onClose,
  onConfirm,
  txXdr,
  title,
  description,
  operation,
  amount,
  contractId,
  method,
  isConfirming = false,
}: TxModalProps) {
  const titleId = useId();
  const descId = useId();

  // Tracks the outcome reported by FeeEstimator
  const [simulationOk, setSimulationOk] = useState<boolean | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Reset simulation gate whenever the modal opens or txXdr changes
  useEffect(() => {
    if (open) {
      // If txXdr is null we skip estimation → allow confirm immediately
      if (!txXdr) {
        setSimulationOk(true);
        setSimulationError(null);
      } else {
        setSimulationOk(null);
        setSimulationError(null);
      }
    }
  }, [open, txXdr]);

  const handleSimulationResult = useCallback((status: SimulationStatus) => {
    setSimulationOk(status.success);
    setSimulationError(status.error ?? null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!simulationOk || confirming || isConfirming) return;
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  }, [simulationOk, confirming, isConfirming, onConfirm]);

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const isProcessing = confirming || isConfirming;
  // simulationOk === null means estimation is still in-flight
  const confirmDisabled = simulationOk !== true || isProcessing;

  const confirmTitle =
    simulationError
      ? "Simulation failed — fix the contract invocation before confirming"
      : simulationOk === null
        ? "Waiting for fee estimation…"
        : undefined;

  return (
    /* Backdrop */
    <div
      className="tx-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClick={handleBackdropClick}
    >
      {/* Panel */}
      <div className="tx-modal-panel" role="document">

        {/* ── Header ── */}
        <div className="tx-modal-header">
          <div>
            <h2 id={titleId} className="tx-modal-title">
              {title}
            </h2>
            {description && (
              <p id={descId} className="tx-modal-description">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tx-modal-close"
            aria-label="Close modal"
            disabled={isProcessing}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
            </svg>
          </button>
        </div>

        {/* ── Transaction Summary ── */}
        <div className="tx-modal-section">
          <p className="tx-modal-section-label">Transaction Summary</p>
          <div className="tx-summary-card">
            <SummaryRow label="Operation" value={operation} />
            <SummaryRow label="Amount" value={amount} />
            {contractId && (
              <SummaryRow
                label="Contract"
                value={truncate(contractId)}
                mono
              />
            )}
            {method && (
              <SummaryRow label="Method" value={method} mono />
            )}
          </div>
        </div>

        {/* ── Fee Estimator ── */}
        {txXdr && (
          <div className="tx-modal-section">
            <FeeEstimator
              txXdr={txXdr}
              onSimulationResult={handleSimulationResult}
            />
          </div>
        )}

        {/* ── Action buttons ── */}
        <div className="tx-modal-actions">
          <button
            id="tx-modal-cancel"
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="tx-btn tx-btn--ghost"
          >
            Cancel
          </button>
          <button
            id="tx-modal-confirm"
            type="button"
            onClick={handleConfirm}
            disabled={confirmDisabled}
            title={confirmTitle}
            className="tx-btn tx-btn--primary"
            aria-describedby={simulationError ? "tx-sim-error-hint" : undefined}
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray="50"
                    strokeDashoffset="15"
                    opacity="0.3"
                  />
                  <path
                    d="M12 2a10 10 0 0 1 10 10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
                Processing…
              </span>
            ) : simulationOk === null && txXdr ? (
              "Estimating fees…"
            ) : (
              "Confirm"
            )}
          </button>
        </div>

        {/* Screen-reader hint when confirm is blocked by simulation error */}
        {simulationError && (
          <p id="tx-sim-error-hint" className="sr-only">
            Confirm is disabled because the simulation failed: {simulationError}
          </p>
        )}
      </div>
    </div>
  );
}
