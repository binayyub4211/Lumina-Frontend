import type { UnknownErrorTelemetryPayload } from "@/src/utils/errorDecoder";

const TELEMETRY_ENDPOINT = "/api/telemetry/stellar-errors";

export async function reportUnknownStellarError(
  payload: UnknownErrorTelemetryPayload,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    await fetch(TELEMETRY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        reportedAt: new Date().toISOString(),
      }),
      keepalive: true,
    });
  } catch (telemetryError) {
    console.warn("Unable to report unknown Stellar error", telemetryError);
  }
}
