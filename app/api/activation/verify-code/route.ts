// app/api/activation/verify-code/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { activateCodeOnDevice } from "@/app/lib/aidaActivation";

function jsonERR(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const code = String(body?.code ?? "");
    const phone = String(body?.phone ?? "");
    const deviceId = String(body?.deviceId ?? "");
    const forceTransfer = body?.forceTransfer === true;

    const result = await activateCodeOnDevice({
      code,
      phone,
      deviceId,
      forceTransfer,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("API /api/activation/verify-code ERROR:", error);

    return jsonERR(
      error?.message || "No se pudo validar la clave de activación.",
      500
    );
  }
}