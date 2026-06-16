"use client";

import { useEffect, useRef } from "react";
import { Server } from "@stellar/stellar-sdk/rpc";
import { decodeEvent } from "../utils/eventDecoder";
import { processEvent } from "../services/alertPipeline";
import { useAlertStore } from "./useAlertStore";

const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

export function useLedgerEvents() {
  const addAlert = useAlertStore((s) => s.addAlert);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestLedgerRef = useRef<number>(0);

  useEffect(() => {
    const server = new Server(SOROBAN_RPC_URL);

    async function fetchEvents() {
      try {
        const latest = await server.getLatestLedger();
        const startLedger = latestLedgerRef.current || latest.sequence - 1;

        const result = await server.getEvents({
          startLedger,
          filters: [{ type: "contract", contractIds: [CONTRACT_ADDRESS] }],
        });

        latestLedgerRef.current = latest.sequence;

        for (const event of result.events) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rawTopics = event.topic.map((t: any) => t.toXDR("hex"));
          const rawData = event.value.toXDR("hex");
          const decoded = decodeEvent(CONTRACT_ADDRESS, rawTopics, rawData);
          const alert = processEvent(decoded);
          if (alert) addAlert(alert);
        }
      } catch (err) {
        console.error("[useLedgerEvents] fetch error:", err);
      }
    }

    fetchEvents();
    pollingRef.current = setInterval(fetchEvents, 5000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [addAlert]);
}
