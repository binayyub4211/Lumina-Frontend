import type { UnknownErrorTelemetryPayload } from "@/src/utils/errorDecoder";
import { enqueueRequest, peekQueue, flushQueue } from "@/src/lib/offlineQueue";
import { installOfflineSync } from "@/src/lib/offlineSync";

const TELEMETRY_ENDPOINT = "/api/telemetry/stellar-errors";

/**
 * Try to deliver the payload directly. Throws on a 5xx response or a
 * network error so the caller can queue a retry.
 */
async function postPayload(
  payload: UnknownErrorTelemetryPayload & { reportedAt: string },
) {
  if (typeof window === "undefined") return;
  try {
    const response = await fetch(TELEMETRY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (!response.ok && response.status >= 500) {
      throw new Error(`Server responded ${response.status}`);
    }
  } catch (telemetryError) {
    console.warn("Unable to report unknown Stellar error", telemetryError);
    throw telemetryError;
  }
}

export async function reportUnknownStellarError(
  payload: UnknownErrorTelemetryPayload,
) {
  if (typeof window === "undefined") {
    return;
  }

  // Guarantees online/pageshow listeners exist, even if no error is
  // reported before the user goes offline.
  installOfflineSync();

  const enriched = {
    ...payload,
    reportedAt: new Date().toISOString(),
  } as UnknownErrorTelemetryPayload & { reportedAt: string };

  if (!window.navigator.onLine) {
    await enqueueRequest({
      url: TELEMETRY_ENDPOINT,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enriched),
      source: "stellar-error-decoder",
    });
    return;
  }

  try {
    await postPayload(enriched);
  } catch {
    await enqueueRequest({
      url: TELEMETRY_ENDPOINT,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enriched),
      source: "stellar-error-decoder",
    });
  }
}

/**
 * Surface helpers useful for tests and developer tooling.
 */
export const offlineTelemetry = {
  peekQueue,
  flushQueue,
};
