// app/api/dev/create-activation-code/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  createOrRenewActivationCode,
  normalizePhoneE164,
} from "@/app/lib/aidaActivation";
import { getAidaPlan, type AidaPlanId } from "@/app/lib/aidaPlans";

function jsonERR(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function isDevAllowed(req: Request) {
  const isLocal = process.env.NODE_ENV !== "production";
  const devKey = process.env.AIDA_DEV_KEY;
  const incomingKey = req.headers.get("x-aida-dev-key");

  if (isLocal) return true;
  if (devKey && incomingKey && devKey === incomingKey) return true;

  return false;
}

export async function POST(req: Request) {
  try {
    if (!isDevAllowed(req)) {
      return jsonERR("No autorizado.", 401);
    }

    const body = await req.json();

    const phone = String(body?.phone ?? "");
    const planId = String(body?.plan ?? "3-meses") as AidaPlanId;

    const plan = getAidaPlan(planId);

    if (!phone.trim()) {
      return jsonERR("Ingresa un celular.", 400);
    }

    if (!plan) {
      return jsonERR("Plan inválido.", 400);
    }

    const activationCode = await createOrRenewActivationCode({
      phone,
      planId,
      paymentId: null,
    });

    return NextResponse.json({
      ok: true,
      activationCode: {
        id: activationCode.id,
        code: activationCode.code,
        phoneE164: normalizePhoneE164(phone),
        plan: activationCode.plan,
        fullStartedAt: activationCode.fullStartedAt,
        fullEndsAt: activationCode.fullEndsAt,
      },
    });
  } catch (error: any) {
    console.error("API /api/dev/create-activation-code ERROR:", error);

    return jsonERR(
      error?.message || "No se pudo crear la clave de activación.",
      500
    );
  }
}