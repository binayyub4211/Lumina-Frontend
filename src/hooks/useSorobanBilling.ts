"use client";

import { useCallback, useState } from "react";
import {
  type DecodedError,
  type ErrorDecodeContext,
  resolveError,
} from "@/src/utils/errorDecoder";
import { reportUnknownStellarError } from "@/src/utils/errorTelemetry";

export function useSorobanBilling(defaultContext: ErrorDecodeContext = {}) {
  const [billingError, setBillingError] = useState<DecodedError | null>(null);

  const decodeBillingError = useCallback(
    (error: unknown, context: ErrorDecodeContext = {}) => {
      const decodedError = resolveError(
        error,
        { ...defaultContext, ...context },
        reportUnknownStellarError,
      );

      setBillingError(decodedError);
      return decodedError;
    },
    [defaultContext],
  );

  return {
    billingError,
    clearBillingError: () => setBillingError(null),
    decodeBillingError,
  };
}
