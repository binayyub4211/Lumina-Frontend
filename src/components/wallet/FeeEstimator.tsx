"use client";

import { useEffect } from "react";
import { useFeeEstimate, formatFeeXlm, type FeeBreakdown } from "@/src/hooks/useFeeEstimate";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SimulationStatus {
  success: boolean;
  error?: string;
}

interface FeeEstimatorProps {
  /** Base64-encoded transaction XDR to simulate, or null to suppress estimation */
  txXdr: string | null;
  /**
   * Called whenever the simulation outcome changes.
   * Parent uses this to gate the Confirm button.
   */
  onSimulationResult: (status: SimulationStatus) => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      <td className="fee-table-cell">
        <div className="h-3.5 w-28 animate-pulse rounded bg-[#ece5d8]" />
      </td>
      <td className="fee-table-cell">
        <div className="h-3.5 w-20 animate-pulse rounded bg-[#ece5d8]" />
      </td>
      <td className="fee-table-cell text-right">
        <div className="ml-auto h-3.5 w-24 animate-pulse rounded bg-[#ece5d8]" />
      </td>
    </tr>
  );
}

function FeeTableSkeleton() {
  return (
    <div className="fee-estimator-panel" aria-busy="true" aria-label="Estimating fees…">
      <div className="fee-estimator-header">
        <div className="flex items-center gap-2">
          {/* spinner */}
          <svg
            className="h-4 w-4 animate-spin text-[#0f766e]"
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
          <span className="fee-section-title">Estimating network fees…</span>
        </div>
        <span className="fee-section-hint">Pre-flight simulation in progress</span>
      </div>

      <table className="fee-table" aria-hidden="true">
        <thead>
          <tr>
            <th className="fee-table-head">Resource</th>
            <th className="fee-table-head">Units Consumed</th>
            <th className="fee-table-head text-right">Fee Contribution</th>
          </tr>
        </thead>
        <tbody>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </tbody>
      </table>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: FeeBreakdown["confidence"] }) {
  const config = {
    green: {
      label: "High confidence",
      dot: "bg-emerald-400",
      pill: "bg-emerald-50 text-emerald-800 border-emerald-200",
    },
    yellow: {
      label: "Moderate confidence",
      dot: "bg-amber-400",
      pill: "bg-amber-50 text-amber-800 border-amber-200",
    },
    red: {
      label: "Low confidence",
      dot: "bg-rose-400",
      pill: "bg-rose-50 text-rose-800 border-rose-200",
    },
  } as const;

  const { label, dot, pill } = config[confidence];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${pill}`}
      title={label}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function formatUnits(resource: string, value: bigint): string {
  if (resource === "CPU Instructions") {
    return value === 0n ? "—" : Number(value).toLocaleString() + " insns";
  }
  if (resource === "Memory" || resource === "Read I/O" || resource === "Write I/O") {
    if (value === 0n) return "—";
    const kb = Number(value) / 1024;
    return kb >= 1 ? kb.toFixed(1) + " KB" : value.toString() + " B";
  }
  return "—";
}

interface ResourceRow {
  label: string;
  units: string;
  fee: bigint;
}

function FeeTable({ estimate }: { estimate: FeeBreakdown }) {
  const { baseFee, resourceFee, totalFee, resources } = estimate;

  // Distribute resourceFee proportionally across resource dimensions.
  // When all values are zero (e.g. base fee only) we just show the base fee.
  const totalWeight =
    resources.cpuInsns + resources.memBytes + resources.readBytes + resources.writeBytes;

  function allocatedFee(weight: bigint): bigint {
    if (totalWeight === 0n) return 0n;
    return (resourceFee * weight) / totalWeight;
  }

  const rows: ResourceRow[] = [
    {
      label: "Base fee",
      units: "—",
      fee: baseFee,
    },
    {
      label: "CPU Instructions",
      units: formatUnits("CPU Instructions", resources.cpuInsns),
      fee: allocatedFee(resources.cpuInsns),
    },
    {
      label: "Memory",
      units: formatUnits("Memory", resources.memBytes),
      fee: allocatedFee(resources.memBytes),
    },
    {
      label: "Read I/O",
      units: formatUnits("Read I/O", resources.readBytes),
      fee: allocatedFee(resources.readBytes),
    },
    {
      label: "Write I/O",
      units: formatUnits("Write I/O", resources.writeBytes),
      fee: allocatedFee(resources.writeBytes),
    },
  ];

  return (
    <table className="fee-table">
      <thead>
        <tr>
          <th className="fee-table-head">Resource</th>
          <th className="fee-table-head">Units Consumed</th>
          <th className="fee-table-head text-right">Fee Contribution</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="fee-table-row">
            <td className="fee-table-cell font-medium text-[#3e3830]">{row.label}</td>
            <td className="fee-table-cell tabular-nums text-[#6f5f48]">{row.units}</td>
            <td className="fee-table-cell text-right tabular-nums text-[#171512]">
              {formatFeeXlm(row.fee)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="fee-table-total">
          <td className="fee-table-cell font-semibold text-[#171512]">Total</td>
          <td className="fee-table-cell" />
          <td className="fee-table-cell text-right font-semibold tabular-nums text-[#0f766e]">
            {formatFeeXlm(totalFee)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

function SimulationError({ message }: { message: string }) {
  return (
    <div
      className="fee-estimator-panel fee-estimator-panel--error"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden="true">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 4a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 1.5 0V5zm-.75 6.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-rose-800">Simulation failed</p>
          <p className="mt-0.5 break-words text-xs text-rose-700">{message}</p>
          <p className="mt-1.5 text-xs text-rose-600">
            The contract invocation reverted during the dry-run. Confirm is disabled
            until the issue is resolved.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * FeeEstimator — pre-flight fee estimation panel for TxModal.
 *
 * Renders one of three states:
 * 1. **Loading** — skeleton pulsing while simulateTransaction is in-flight
 * 2. **Success** — breakdown table with confidence badge and range
 * 3. **Error**   — error banner, calls `onSimulationResult({ success: false })`
 */
export function FeeEstimator({ txXdr, onSimulationResult }: FeeEstimatorProps) {
  const { loading, estimate, error } = useFeeEstimate(txXdr);

  // Notify the parent whenever the outcome changes
  useEffect(() => {
    if (loading) return; // still pending — don't change gate yet
    if (estimate) {
      onSimulationResult({ success: true });
    } else if (error) {
      onSimulationResult({ success: false, error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, estimate, error]);

  if (loading && !estimate) {
    return <FeeTableSkeleton />;
  }

  if (error && !estimate) {
    return <SimulationError message={error} />;
  }

  if (!estimate) return null;

  return (
    <div className="fee-estimator-panel" aria-label="Estimated transaction fees">
      {/* Header row */}
      <div className="fee-estimator-header">
        <div className="flex items-center gap-2">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="h-4 w-4 text-[#0f766e]"
            aria-hidden="true"
          >
            <path
              d="M8 1.5A6.5 6.5 0 1 0 8 14.5 6.5 6.5 0 0 0 8 1.5z"
              stroke="currentColor"
              strokeWidth="1.25"
            />
            <path
              d="M8 5v3.5l2 2"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="fee-section-title">Network Fee Estimate</span>
          <ConfidenceBadge confidence={estimate.confidence} />
        </div>
        <span className="fee-section-hint">
          Based on a pre-flight simulation — actual fee may vary
        </span>
      </div>

      {/* Breakdown table */}
      <FeeTable estimate={estimate} />

      {/* Confidence range */}
      <div className="fee-range-row">
        <span className="text-xs text-[#6f5f48]">Estimated range:</span>
        <span className="text-xs font-medium tabular-nums text-[#3e3830]">
          {formatFeeXlm(estimate.minFee)} – {formatFeeXlm(estimate.maxFee)}
        </span>
      </div>

      {/* Re-estimation hint while a background re-validate runs */}
      {loading && (
        <p className="mt-2 text-center text-[10px] text-[#9b8a6f]" aria-live="polite">
          Re-validating estimate…
        </p>
      )}
    </div>
  );
}
