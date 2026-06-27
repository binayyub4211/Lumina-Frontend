"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setWalletTransitioningRef } from "@/src/lib/queryClient";
import {
  getSharedStateSync,
  type WalletChangePayload,
} from "@/src/services/sharedStateSync";

export interface WalletContextValue {
  publicKey: string | null;
  generation: number;
  isTransitioning: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export const WalletContext = createContext<WalletContextValue | null>(null);

const FREIGHTER_ACCOUNT_CHANGE = "accountChange";

interface FreighterUserInfo {
  publicKey?: string;
}

declare global {
  interface Window {
    freighter?: {
      getUserInfo: () => Promise<FreighterUserInfo>;
      isConnected: () => Promise<{ isConnected: boolean }>;
      signTransaction?: (xdr: string) => Promise<{ signedTxXdr: string }>;
      signAuthEntry?: (authEntry: string) => Promise<{ signedAuthEntry: string }>;
    };
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [generation, setGeneration] = useState(0);
  const queryClient = useQueryClient();

  const transitioningRef = useRef(false);
  const prevPublicKeyRef = useRef<string | null>(null);
  const latestWalletTimestampRef = useRef(0);

  useEffect(() => {
    setWalletTransitioningRef(transitioningRef);
  }, []);

  const applyWalletChange = useCallback(
    async (payload: WalletChangePayload, timestamp: number) => {
      if (timestamp < latestWalletTimestampRef.current) return;
      latestWalletTimestampRef.current = timestamp;

      transitioningRef.current = true;
      setIsTransitioning(true);

      await queryClient.cancelQueries();

      const nextPublicKey = payload.publicKey;
      const previousPublicKey = prevPublicKeyRef.current;

      if (previousPublicKey !== nextPublicKey) {
        setGeneration((g) => payload.generation ?? g + 1);
      }

      if (nextPublicKey) {
        queryClient.invalidateQueries();
      } else {
        queryClient.clear();
      }

      setPublicKey(nextPublicKey);
      prevPublicKeyRef.current = nextPublicKey;

      transitioningRef.current = false;
      setIsTransitioning(false);
    },
    [queryClient],
  );

  const publishWalletChange = useCallback((nextPublicKey: string | null) => {
    const message = getSharedStateSync().publish("wallet_change", {
      publicKey: nextPublicKey,
    });
    latestWalletTimestampRef.current = message.timestamp;
  }, []);

  const handleAccountChange = useCallback(async () => {
    transitioningRef.current = true;
    setIsTransitioning(true);

    await queryClient.cancelQueries();

    try {
      const info = window.freighter ? await window.freighter.getUserInfo() : {};
      const newKey = info.publicKey ?? null;

      if (prevPublicKeyRef.current !== newKey) {
        setGeneration((g) => g + 1);
      }

      setPublicKey(newKey);
      prevPublicKeyRef.current = newKey;
      if (newKey) {
        queryClient.invalidateQueries();
      } else {
        queryClient.clear();
      }
      publishWalletChange(newKey);
    } catch {
      setPublicKey(null);
      prevPublicKeyRef.current = null;
      queryClient.clear();
      publishWalletChange(null);
    } finally {
      transitioningRef.current = false;
      setIsTransitioning(false);
    }
  }, [publishWalletChange, queryClient]);

  useEffect(() => {
    const sync = getSharedStateSync();
    return sync.subscribe((message) => {
      if (message.type === "wallet_change") {
        void applyWalletChange(message.payload, message.timestamp);
      }

      if (message.type === "auth_expire") {
        void applyWalletChange({ publicKey: null }, message.timestamp);
      }
    });
  }, [applyWalletChange]);

  useEffect(() => {
    const handler = () => {
      handleAccountChange();
    };

    window.addEventListener(FREIGHTER_ACCOUNT_CHANGE, handler);
    return () => {
      window.removeEventListener(FREIGHTER_ACCOUNT_CHANGE, handler);
    };
  }, [handleAccountChange]);

  const connect = useCallback(async () => {
    try {
      if (window.freighter) {
        const { isConnected } = await window.freighter.isConnected();
        if (!isConnected) return;
      }
      await handleAccountChange();
    } catch {
      setPublicKey(null);
      queryClient.clear();
      publishWalletChange(null);
    }
  }, [handleAccountChange, publishWalletChange, queryClient]);

  const disconnect = useCallback(() => {
    transitioningRef.current = true;
    setIsTransitioning(true);

    queryClient.cancelQueries();
    queryClient.clear();

    setPublicKey(null);
    setGeneration((g) => g + 1);
    prevPublicKeyRef.current = null;
    publishWalletChange(null);

    transitioningRef.current = false;
    setIsTransitioning(false);
  }, [publishWalletChange, queryClient]);

  const value = useMemo<WalletContextValue>(
    () => ({
      publicKey,
      generation,
      isTransitioning,
      connect,
      disconnect,
    }),
    [publicKey, generation, isTransitioning, connect, disconnect],
  );

  return (
    <WalletContext value={value}>
      {children}
    </WalletContext>
  );
}
