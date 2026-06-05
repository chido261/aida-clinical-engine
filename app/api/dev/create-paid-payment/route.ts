// app/api/dev/create-paid-payment/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  createOrRenewActivationCode,
  normalizePhoneE164,
} from "@/app/lib/aidaActivation";
import { getAidaPlan, type AidaPlanId } from "@/app/lib/aidaPlans";
import { prisma } from "@/app/lib/prisma";

type Body = {
  deviceId?: unknown;
  phone?: unknown;
  plan?: unknown;
};

function jsonERR(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

    const body = (await req.json()) as Body;

    const deviceId = getString(body.deviceId);
    const phone = getString(body.phone);
    const planId = getString(body.plan || "mensual") as AidaPlanId;

    const plan = getAidaPlan(planId);

    if (!deviceId) {
      return jsonERR("Falta deviceId.", 400);
    }

    if (!phone) {
      return jsonERR("Ingresa un celular.", 400);
    }

    if (!plan) {
      return jsonERR("Plan inválido.", 400);
    }

    const phoneE164 = normalizePhoneE164(phone);

    const payment = await prisma.payment.create({
      data: {
        provider: "dev",
        providerPaymentId: `dev-${Date.now()}`,
        providerRef: `dev-ref-${Date.now()}`,
        status: "approved",
        amount: plan.priceMxCents,
        currency: "MXN",
        plan: plan.id,
        durationDays: plan.durationDays,
        phoneE164,
        deviceId,
        approvedAt: new Date(),
      },
    });

    const activationCode = await createOrRenewActivationCode({
      phone: phoneE164,
      planId: plan.id,
      paymentId: payment.id,
      deviceId,
    });

    const updatedPayment = await prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        activationCodeId: activationCode.id,
      },
    });

    return NextResponse.json({
      ok: true,
      payment: {
        id: updatedPayment.id,
        status: updatedPayment.status,
        phoneE164: updatedPayment.phoneE164,
        plan: updatedPayment.plan,
        durationDays: updatedPayment.durationDays,
        amount: updatedPayment.amount,
        activationCodeId: updatedPayment.activationCodeId,
      },
      activationCode: {
        id: activationCode.id,
        code: activationCode.code,
        plan: activationCode.plan,
        fullStartedAt: activationCode.fullStartedAt,
        fullEndsAt: activationCode.fullEndsAt,
        currentDeviceId: activationCode.currentDeviceId,
      },
      testUrl: `/pago/activar?paymentId=${updatedPayment.id}`,
    });
  } catch (error: any) {
    console.error("API /api/dev/create-paid-payment ERROR:", error);

    return jsonERR(error?.message || "No se pudo crear el pago de prueba.", 500);
  }
}