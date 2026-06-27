"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  simulateTransaction,
  type SimulateTransactionResult,
} from "@/src/lib/sorobanClient";
import { StroopConverter, STROOP_DECIMALS } from "@/src/utils/balance_scaler";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Stellar network base fee in stroops (100 stroops = 0.00001 XLM) */
const BASE_FEE_STROOPS = 100n;

/** Confidence range upper bound multiplier — 25 % above estimated resource fee */
const CONFIDENCE_BUFFER_BPS = 125n; // × resource fee / 100

/** Debounce delay before triggering a new simulation */
const DEBOUNCE_MS = 500;

/** Maximum time to wait for a simulation before showing a persistent skeleton */
const TIMEOUT_MS = 5_000;

/** sessionStorage key prefix for cached estimates */
const CACHE_KEY_PREFIX = "lumina:feeEstimate:";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface FeeEstimateResources {
  cpuInsns: bigint;
  memBytes: bigint;
  readBytes: bigint;
  writeBytes: bigint;
}

export interface FeeBreakdown {
  /** Network base fee in stroops */
  baseFee: bigint;
  /** Resource fee in stroops as reported by simulateTransaction */
  resourceFee: bigint;
  /** baseFee + resourceFee */
  totalFee: bigint;
  /** Conservative lower bound (= totalFee) */
  minFee: bigint;
  /** Upper bound with 25 % buffer over resource fee */
  maxFee: bigint;
  /** Confidence level derived from simulation outcome + footprint size */
  confidence: "green" | "yellow" | "red";
  /** Parsed resource consumption metrics */
  resources: FeeEstimateResources;
}

export interface UseFeeEstimateResult {
  /** True while a simulation is in-flight or within the debounce window */
  loading: boolean;
  /** Populated once a simulation returns successfully */
  estimate: FeeBreakdown | null;
  /** Populated when the simulation returns an error or contract reverts */
  error: string | null;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Derive a short deterministic cache key from a tx XDR string.
 * Uses a simple djb2-style hash — good enough for sessionStorage keys.
 */
function hashXdr(xdr: string): string {
  let h = 5381;
  for (let i = 0; i < xdr.length; i++) {
    h = ((h << 5) + h) ^ xdr.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return h.toString(16);
}

function readCache(txXdr: string): FeeBreakdown | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY_PREFIX + hashXdr(txXdr));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, string>;
    return {
      baseFee: BigInt(parsed.baseFee),
      resourceFee: BigInt(parsed.resourceFee),
      totalFee: BigInt(parsed.totalFee),
      minFee: BigInt(parsed.minFee),
      maxFee: BigInt(parsed.maxFee),
      confidence: parsed.confidence as FeeBreakdown["confidence"],
      resources: {
        cpuInsns: BigInt(parsed.cpuInsns),
        memBytes: BigInt(parsed.memBytes),
        readBytes: BigInt(parsed.readBytes),
        writeBytes: BigInt(parsed.writeBytes),
      },
    };
  } catch {
    return null;
  }
}

function writeCache(txXdr: string, estimate: FeeBreakdown): void {
  try {
    const payload = {
      baseFee: estimate.baseFee.toString(),
      resourceFee: estimate.resourceFee.toString(),
      totalFee: estimate.totalFee.toString(),
      minFee: estimate.minFee.toString(),
      maxFee: estimate.maxFee.toString(),
      confidence: estimate.confidence,
      cpuInsns: estimate.resources.cpuInsns.toString(),
      memBytes: estimate.resources.memBytes.toString(),
      readBytes: estimate.resources.readBytes.toString(),
      writeBytes: estimate.resources.writeBytes.toString(),
    };
    sessionStorage.setItem(CACHE_KEY_PREFIX + hashXdr(txXdr), JSON.stringify(payload));
  } catch {
    // sessionStorage may be unavailable in SSR / private browsing — ignore
  }
}

/**
 * Determine confidence level from simulation results.
 *
 * - green  → succeeded, footprint is manageable
 * - yellow → succeeded, but resource consumption is large (> 1M CPU insns or > 1 MB mem)
 * - red    → simulation failed / contract reverted
 */
function deriveConfidence(
  result: SimulateTransactionResult,
): FeeBreakdown["confidence"] {
  if (!result.success) return "red";
  const { cpuInsns, memBytes } = result.resources;
  if (cpuInsns > 1_000_000n || memBytes > 1_048_576n) return "yellow";
  return "green";
}

function buildEstimate(result: SimulateTransactionResult): FeeBreakdown {
  const resourceFee = result.minResourceFee;
  const baseFee = BASE_FEE_STROOPS;
  const totalFee = baseFee + resourceFee;
  const minFee = totalFee;
  const maxFee = baseFee + (resourceFee * CONFIDENCE_BUFFER_BPS) / 100n;

  return {
    baseFee,
    resourceFee,
    totalFee,
    minFee,
    maxFee,
    confidence: deriveConfidence(result),
    resources: { ...result.resources },
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Dry-runs a Soroban transaction and returns a structured fee estimate.
 *
 * @param txXdr - Base64-encoded transaction envelope XDR, or null to skip estimation
 *
 * @example
 * ```tsx
 * const { loading, estimate, error } = useFeeEstimate(txXdr);
 * ```
 */
export function useFeeEstimate(txXdr: string | null): UseFeeEstimateResult {
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<FeeBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs to manage debounce / timeout / abort across renders
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runSimulation = useCallback(async (xdr: string) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setLoading(true);
    setError(null);

    // Enforce 5-second maximum — skeleton stays visible beyond that
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      // After 5 s we leave loading=true so the skeleton remains;
      // the simulation may still resolve and will update state when it does.
    }, TIMEOUT_MS);

    try {
      const result = await simulateTransaction(xdr);

      if (signal.aborted) return; // stale result — discard

      if (result.success) {
        const built = buildEstimate(result);
        writeCache(xdr, built);
        setEstimate(built);
        setError(null);
      } else {
        setEstimate(null);
        setError(result.error ?? "Simulation failed");
      }
    } catch (err) {
      if (signal.aborted) return;
      setEstimate(null);
      setError(err instanceof Error ? err.message : "Unexpected simulation error");
    } finally {
      if (!signal.aborted) {
        setLoading(false);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
    }
  }, []);

  useEffect(() => {
    // Clear everything when txXdr is null
    if (!txXdr) {
      setLoading(false);
      setEstimate(null);
      setError(null);
      return;
    }

    // Serve from cache immediately, then re-validate in the background
    const cached = readCache(txXdr);
    if (cached) {
      setEstimate(cached);
      setError(null);
      // Skip loading indicator for cached results — re-validate silently
      setLoading(false);
    }

    // Debounce the actual RPC call
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSimulation(txXdr);
    }, cached ? 0 : DEBOUNCE_MS);
    // If we already have a cached result we fire immediately to re-validate;
    // otherwise we wait for the full debounce window so rapid changes
    // don't spam the RPC endpoint.

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txXdr]);

  return { loading, estimate, error };
}

// ─── Formatting helpers (exported for convenience) ───────────────────────────

/**
 * Format a stroop amount as a human-readable XLM string.
 * Delegates to the balance_scaler BigInt engine.
 */
export function formatFeeXlm(stroops: bigint): string {
  return StroopConverter.toDisplay(stroops, STROOP_DECIMALS) + " XLM";
}
