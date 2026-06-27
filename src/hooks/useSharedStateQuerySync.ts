"use client";

import { useEffect } from "react";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import {
  getSharedStateSync,
  type CacheInvalidatePayload,
  type OperationCompletePayload,
  type SharedStateMessage,
} from "@/src/services/sharedStateSync";

export function useSharedStateQuerySync(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const sync = getSharedStateSync();

    return sync.subscribe((message) => {
      switch (message.type) {
        case "cache_invalidate":
          invalidateCache(queryClient, message.payload);
          break;
        case "operation_complete":
          invalidateOperationCache(queryClient, message.payload);
          break;
        case "auth_expire":
          queryClient.clear();
          break;
        case "wallet_change":
          if (!message.payload.publicKey) {
            queryClient.clear();
          } else {
            queryClient.invalidateQueries();
          }
          break;
      }
    });
  }, [queryClient]);
}

export function broadcastCacheInvalidation(payload: CacheInvalidatePayload): SharedStateMessage {
  return getSharedStateSync().publish("cache_invalidate", payload);
}

export function broadcastOperationComplete(
  payload: OperationCompletePayload,
): SharedStateMessage {
  return getSharedStateSync().publish("operation_complete", payload);
}

export function broadcastAuthExpire(reason?: string): SharedStateMessage {
  return getSharedStateSync().publish("auth_expire", { reason });
}

function invalidateCache(
  queryClient: QueryClient,
  payload: CacheInvalidatePayload,
): void {
  if (payload.queryKey) {
    queryClient.invalidateQueries({
      queryKey: payload.queryKey,
      exact: payload.exact ?? false,
    });
    return;
  }

  queryClient.invalidateQueries();
}

function invalidateOperationCache(
  queryClient: QueryClient,
  payload: OperationCompletePayload,
): void {
  if (!payload.queryKey) return;
  queryClient.invalidateQueries({ queryKey: payload.queryKey });
}

