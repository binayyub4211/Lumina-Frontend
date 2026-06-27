"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWalletIdentity } from "@/src/hooks/useWalletIdentity";
import { base64UrlEncode } from "@/src/lib/qrGenerator";
import type {
  NodeConfig,
  ProvisionPayload,
  ProvisioningToken,
} from "@/src/types/provisioning";
import { PROVISION_TOKEN_TTL_MS } from "@/src/types/provisioning";

function generateNonce(): string {
  const arr = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return base64UrlEncode(String.fromCharCode(...Array.from(arr)));
}

/**
 * Hook that generates a signed provisioning token for edge router onboarding.
 *
 * Constructs a payload containing the wallet public key, node configuration,
 * a one-time nonce, and a 10-minute TTL. Signs the payload via Freighter's
 * signAuthEntry and returns the compact signed token.
 *
 * The token refreshes automatically when the TTL expires.
 */
export function useProvisionToken(nodeConfig: NodeConfig | null) {
  const { publicKey } = useWalletIdentity();
  const [token, setToken] = useState<ProvisioningToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generate = useCallback(async () => {
    if (!publicKey || !nodeConfig) {
      setToken(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const now = Math.floor(Date.now() / 1000);
      const nonce = generateNonce();

      const payload: ProvisionPayload = {
        publicKey,
        nodeConfig,
        nonce,
        iat: now,
        exp: now + Math.floor(PROVISION_TOKEN_TTL_MS / 1000),
      };

      const payloadJson = JSON.stringify(payload);
      const payloadEncoded = base64UrlEncode(payloadJson);

      let signature: string;

      if (
        typeof window !== "undefined" &&
        window.freighter &&
        typeof window.freighter.signAuthEntry === "function"
      ) {
        const result = await window.freighter.signAuthEntry(payloadEncoded);
        signature = base64UrlEncode(result.signedAuthEntry);
      } else {
        // Fallback: use empty signature when Freighter is unavailable
        signature = base64UrlEncode("unsigned:" + nonce);
      }

      const compactToken = `${payloadEncoded}.${signature}`;
      const expiresAt = Date.now() + PROVISION_TOKEN_TTL_MS;

      setToken({
        payload: payloadEncoded,
        signature,
        token: compactToken,
        expiresAt,
      });
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate token";
      setError(message);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, [publicKey, nodeConfig]);

  // Auto-generate when publicKey or nodeConfig changes
  useEffect(() => {
    generate();
  }, [generate]);

  // Time remaining (ms)
  const remainingMs = useMemo(() => {
    if (!token) return 0;
    return Math.max(0, token.expiresAt - Date.now());
  }, [token]);

  // Auto-refresh when token expires
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!token || remainingMs <= 0) {
      if (token && remainingMs <= 0) {
        generate();
      }
      return;
    }

    timerRef.current = setTimeout(() => {
      generate();
    }, remainingMs + 100); // 100ms buffer after expiry

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [token, remainingMs, generate]);

  return {
    token,
    loading,
    error,
    remainingMs,
    refresh: generate,
  };
}
