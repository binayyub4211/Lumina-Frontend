"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import {
  runInvalidationWaterfall,
  type WaterfallOptions,
} from "@/src/lib/invalidationRegistry";

/**
 * useInvalidationWaterfall
 * ------------------------
 * Returns a `runWaterfall(mutatedKey)` callback that invalidates the mutated
 * query group and all of its derived dependents in topological order,
 * awaiting each rank before advancing (see {@link runInvalidationWaterfall}).
 *
 * Replaces ad-hoc `queryClient.invalidateQueries()` calls in mutation
 * `onSuccess` handlers:
 *
 * ```ts
 * const runWaterfall = useInvalidationWaterfall();
 * useMutation({
 *   mutationFn: setNodeStatus,
 *   onSuccess: () => runWaterfall(['nodes', orgId]),
 * });
 * ```
 */
export function useInvalidationWaterfall(defaultOptions?: WaterfallOptions) {
  const queryClient = useQueryClient();

  return useCallback(
    (mutatedKey: QueryKey, options?: WaterfallOptions) =>
      runInvalidationWaterfall(queryClient, mutatedKey, {
        ...defaultOptions,
        ...options,
      }),
    [queryClient, defaultOptions],
  );
}
