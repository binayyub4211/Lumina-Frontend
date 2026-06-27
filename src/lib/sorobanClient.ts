"use client";

export interface SorobanTransactionResult {
  status: "SUCCESS" | "FAILED" | "NOT_FOUND";
  hash?: string;
  result?: unknown;
  error?: string;
}

export interface SorobanRpcConfig {
  serverUrl: string;
  networkPassphrase: string;
}

/** Resource consumption reported by simulateTransaction */
export interface SimulationResources {
  /** CPU instructions consumed */
  cpuInsns: bigint;
  /** Memory bytes consumed */
  memBytes: bigint;
  /** Ledger read bytes */
  readBytes: bigint;
  /** Ledger write bytes */
  writeBytes: bigint;
}

/** Structured result of a simulateTransaction dry-run */
export interface SimulateTransactionResult {
  /** Whether the simulation succeeded (no contract revert) */
  success: boolean;
  /** Minimum resource fee in stroops, as reported by the RPC node */
  minResourceFee: bigint;
  /** Parsed resource metrics */
  resources: SimulationResources;
  /** Raw error message from a contract revert, if any */
  error?: string;
}

let rpcUrl = "https://soroban-testnet.stellar.org";
let networkPassphrase = "Test SDF Network ; September 2015";

export function configureSorobanClient(config: Partial<SorobanRpcConfig>) {
  if (config.serverUrl) rpcUrl = config.serverUrl;
  if (config.networkPassphrase) networkPassphrase = config.networkPassphrase;
}

async function rpcCall(method: string, params: Record<string, unknown>) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`Soroban RPC error: HTTP ${response.status}`);
  }

  return response.json();
}

export async function getTransaction(txHash: string): Promise<SorobanTransactionResult> {
  try {
    const data = await rpcCall("getTransaction", { hash: txHash });

    if (data.error) {
      return { status: "NOT_FOUND", hash: txHash, error: data.error.message };
    }

    const result = data.result;
    if (result.status === "SUCCESS") {
      return { status: "SUCCESS", hash: txHash, result };
    }
    if (result.status === "FAILED") {
      return { status: "FAILED", hash: txHash, error: result.result?.error ?? "Transaction failed" };
    }

    return { status: "NOT_FOUND", hash: txHash };
  } catch (err) {
    return { status: "NOT_FOUND", hash: txHash, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function sendTransaction(txXdr: string): Promise<{ hash: string; status: string; error?: string }> {
  try {
    const data = await rpcCall("sendTransaction", { transaction: txXdr });

    if (data.error) {
      return { hash: "", status: "FAILED", error: data.error.message };
    }

    return {
      hash: data.result.hash,
      status: data.result.status,
      error: data.result.error,
    };
  } catch (err) {
    return {
      hash: "",
      status: "FAILED",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Dry-run a transaction envelope against the Soroban RPC `simulateTransaction`
 * endpoint without broadcasting it to the network.
 *
 * @param txXdr - Base64-encoded transaction envelope XDR
 * @returns Structured simulation result with fees and resource usage
 */
export async function simulateTransaction(
  txXdr: string,
): Promise<SimulateTransactionResult> {
  try {
    const data = await rpcCall("simulateTransaction", { transaction: txXdr });

    // JSON-RPC level error (network / auth)
    if (data.error) {
      return {
        success: false,
        minResourceFee: 0n,
        resources: { cpuInsns: 0n, memBytes: 0n, readBytes: 0n, writeBytes: 0n },
        error: data.error.message ?? "RPC error during simulation",
      };
    }

    const result = data.result;

    // Contract revert — result contains an error field
    if (result?.error) {
      return {
        success: false,
        minResourceFee: 0n,
        resources: { cpuInsns: 0n, memBytes: 0n, readBytes: 0n, writeBytes: 0n },
        error: typeof result.error === "string" ? result.error : JSON.stringify(result.error),
      };
    }

    // Parse minResourceFee — the RPC returns it as a decimal string of stroops
    const minResourceFee = result?.minResourceFee
      ? BigInt(result.minResourceFee)
      : 0n;

    // cost object: { cpuInsns: "1234567", memBytes: "4096" }
    const cost = result?.cost ?? {};
    const cpuInsns = cost.cpuInsns ? BigInt(cost.cpuInsns) : 0n;
    const memBytes = cost.memBytes ? BigInt(cost.memBytes) : 0n;

    // transactionData contains the footprint ledger entries
    // We parse readBytes / writeBytes from it where available
    let readBytes = 0n;
    let writeBytes = 0n;
    try {
      const txData = result?.transactionData;
      if (txData) {
        readBytes = txData.readBytes ? BigInt(txData.readBytes) : 0n;
        writeBytes = txData.writeBytes ? BigInt(txData.writeBytes) : 0n;
      }
    } catch {
      // non-fatal — just leave as 0
    }

    return {
      success: true,
      minResourceFee,
      resources: { cpuInsns, memBytes, readBytes, writeBytes },
    };
  } catch (err) {
    return {
      success: false,
      minResourceFee: 0n,
      resources: { cpuInsns: 0n, memBytes: 0n, readBytes: 0n, writeBytes: 0n },
      error: err instanceof Error ? err.message : "Unknown simulation error",
    };
  }
}

export { rpcUrl, networkPassphrase };
