"use client";

import { useFormattedBalance } from "@/src/hooks/useFormattedBalance";
import { STROOP_DECIMALS } from "@/src/utils/balance_scaler";

interface TokenBalanceRowProps {
  symbol: string;
  stroopBalance: bigint | null | undefined;
  decimals?: number;
  usdValue?: number | null;
  currency?: string;
  locale?: string;
  loading?: boolean;
}

function LoadingSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[#d8d0c1] bg-white px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 animate-pulse rounded-full bg-[#ece5d8]" />
        <div className="space-y-1.5">
          <div className="h-4 w-16 animate-pulse rounded bg-[#ece5d8]" />
          <div className="h-3 w-20 animate-pulse rounded bg-[#ece5d8]" />
        </div>
      </div>
      <div className="space-y-1.5 text-right">
        <div className="h-5 w-24 animate-pulse rounded bg-[#ece5d8]" />
        <div className="h-3 w-16 animate-pulse rounded bg-[#ece5d8]" />
      </div>
    </div>
  );
}

function ErrorRow({ symbol, message }: { symbol: string; message: string }) {
  return (
    <div
      className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-5 py-4"
      role="alert"
    >
      <div className="flex items-center gap-3">
        <span className="text-rose-600" aria-hidden="true">!</span>
        <span className="text-sm font-medium text-rose-800">{symbol}</span>
      </div>
      <span className="text-xs text-rose-600">{message}</span>
    </div>
  );
}

export function TokenBalanceRow({
  symbol,
  stroopBalance,
  decimals = STROOP_DECIMALS,
  usdValue,
  currency = "USD",
  locale,
  loading = false,
}: TokenBalanceRowProps) {
  if (loading) return <LoadingSkeleton />;

  if (stroopBalance == null) {
    return <ErrorRow symbol={symbol} message="Balance unavailable" />;
  }

  const balance = useFormattedBalance(stroopBalance, decimals, locale);

  let usdDisplay: string | null = null;
  if (usdValue != null && balance.raw !== 0n) {
    usdDisplay = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(usdValue);
  }

  const ariaLabel = `${symbol} balance: ${balance.formatted}${usdDisplay ? `, approximately ${usdDisplay}` : ""}`;

  return (
    <div
      className="flex items-center justify-between rounded-lg border border-[#d8d0c1] bg-white px-5 py-4 transition hover:border-[#cfc4b1]"
      role="group"
      aria-label={ariaLabel}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ece5d8] bg-[#f7f4ee] text-sm font-semibold text-[#3e3830]">
          {symbol.charAt(0)}
        </div>
        <div>
          <span className="text-sm font-semibold text-[#171512]">{symbol}</span>
          {balance.isZero && (
            <span className="ml-2 inline-flex items-center rounded-full bg-[#f7f4ee] px-2 py-0.5 text-[10px] font-medium text-[#6f5f48]">
              Empty
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        <div
          className={`text-sm font-medium tabular-nums ${
            balance.isNegative ? "text-rose-600" : "text-[#171512]"
          }`}
        >
          {balance.formatted}
        </div>
        {usdDisplay && (
          <div className="mt-0.5 text-xs text-[#6f5f48]">{usdDisplay}</div>
        )}
      </div>
    </div>
  );
}
