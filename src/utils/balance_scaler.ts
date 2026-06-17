"use client";

import {
  toStroop,
  formatStroop,
  fromStroop,
} from "@/src/lib/bigintmath";

export const STROOP_DECIMALS = 7;

export class StroopConverter {
  static fromBlockchain(
    raw: string | bigint,
    decimals: number = STROOP_DECIMALS,
  ): bigint {
    if (typeof raw === "bigint") return raw;
    const trimmed = raw.trim();
    if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
      return BigInt(trimmed);
    }
    if (/^-?\d+$/.test(trimmed)) {
      return BigInt(trimmed);
    }
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return toStroop(trimmed, decimals);
    }
    throw new Error(`Cannot parse blockchain value: "${raw}"`);
  }

  static toDisplay(
    stroops: bigint,
    decimals: number = STROOP_DECIMALS,
    locale?: string,
  ): string {
    return formatStroop(stroops, decimals, locale);
  }

  static toHumanReadable(
    stroops: bigint,
    decimals: number = STROOP_DECIMALS,
  ): string {
    return fromStroop(stroops, decimals);
  }

  static serializeForCacheKey(value: bigint): string {
    return value.toString();
  }

  static parseCacheKey(key: string): bigint {
    return BigInt(key);
  }
}
