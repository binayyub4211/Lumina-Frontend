"use client";

import { useCallback, useState } from "react";
import {
  type DecodedError,
  type ErrorDecodeContext,
  resolveError,
} from "@/src/utils/errorDecoder";
import { reportUnknownStellarError } from "@/src/utils/errorTelemetry";

export function useLedgerEvents(defaultContext: ErrorDecodeContext = {}) {
  const [eventError, setEventError] = useState<DecodedError | null>(null);

  const decodeLedgerEventError = useCallback(
    (error: unknown, context: ErrorDecodeContext = {}) => {
      const decodedError = resolveError(
        error,
        { ...defaultContext, ...context },
        reportUnknownStellarError,
      );

      setEventError(decodedError);
      return decodedError;
    },
    [defaultContext],
  );

  return {
    eventError,
    clearEventError: () => setEventError(null),
    decodeLedgerEventError,
  };
}
