// app/api/payments/status/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

function jsonOK(payload: any) {
  return NextResponse.json(payload);
}

function jsonERR(payload: any, status: number) {
  return NextResponse.json(payload, { status });
}

function maskPhone(phoneE164: string | null) {
  if (!phoneE164) return null;

  const clean = phoneE164.replace(/\D/g, "");

  if (clean.length <= 4) {
    return phoneE164;
  }

  return `••••••${clean.slice(-4)}`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const paymentIdRaw = url.searchParams.get("paymentId") ?? "";
    const paymentId = Number(paymentIdRaw);

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return jsonERR(
        {
          ok: false,
          error: "paymentId inválido",
        },
        400
      );
    }

    const payment = await prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
    });

    if (!payment) {
      return jsonERR(
        {
          ok: false,
          error: "Pago no encontrado",
        },
        404
      );
    }

    const activationCode = payment.activationCodeId
      ? await prisma.activationCode.findUnique({
          where: {
            id: payment.activationCodeId,
          },
        })
      : null;

    return jsonOK({
      ok: true,
      payment: {
        id: payment.id,
        provider: payment.provider,
        providerPaymentId: payment.providerPaymentId,
        providerRef: payment.providerRef,
        status: payment.status,
        plan: payment.plan,
        amount: payment.amount,
        currency: payment.currency,
        durationDays: payment.durationDays,
        phoneMasked: maskPhone(payment.phoneE164),
        deviceId: payment.deviceId,
        approvedAt: payment.approvedAt,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,

        activationCodeId: payment.activationCodeId,
        activationCode: activationCode?.code ?? null,
        activationStatus: activationCode?.status ?? null,
        activationFullStartedAt: activationCode?.fullStartedAt ?? null,
        activationFullEndsAt: activationCode?.fullEndsAt ?? null,
        activationCurrentDeviceId: activationCode?.currentDeviceId ?? null,
      },
    });
  } catch (err: any) {
    console.error("API /api/payments/status ERROR:", err);

    return jsonERR(
      {
        ok: false,
        error: err?.message ?? "Error desconocido",
      },
      500
    );
  }
}