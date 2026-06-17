"use client";

import { useMemo } from "react";
import { formatStroop, isZero, isNegative } from "@/src/lib/bigintmath";
import { STROOP_DECIMALS } from "@/src/utils/balance_scaler";

export interface FormattedBalance {
  raw: bigint;
  formatted: string;
  isZero: boolean;
  isNegative: boolean;
}

export function useFormattedBalance(
  stroops: bigint | null | undefined,
  decimals: number = STROOP_DECIMALS,
  locale?: string,
): FormattedBalance {
  return useMemo(() => {
    if (stroops == null) {
      return { raw: 0n, formatted: "0", isZero: true, isNegative: false };
    }
    return {
      raw: stroops,
      formatted: formatStroop(stroops, decimals, locale),
      isZero: isZero(stroops),
      isNegative: isNegative(stroops),
    };
  }, [stroops, decimals, locale]);
}
