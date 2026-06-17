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

export { rpcUrl, networkPassphrase };
