import { NextResponse } from "next/server";
import type { UnknownErrorTelemetryPayload } from "@/src/utils/errorDecoder";

export async function POST(request: Request) {
  const payload = (await request.json()) as UnknownErrorTelemetryPayload & {
    reportedAt?: string;
  };

  console.warn("Unknown Stellar error reported", payload);

  return NextResponse.json({ ok: true });
}
