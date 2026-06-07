// app/api/payments/latest-for-device/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

type Body = {
  deviceId?: unknown;
};

const APPROVED_PAYMENT_WINDOW_HOURS = 24;

function jsonOK(payload: any) {
  return NextResponse.json(payload);
}

function jsonERR(payload: any, status: number) {
  return NextResponse.json(payload, { status });
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const deviceId = getString(body.deviceId);

    if (!deviceId) {
      return jsonERR(
        {
          ok: false,
          error: "device_id_required",
          message: "Falta deviceId.",
        },
        400
      );
    }

    const payment = await prisma.payment.findFirst({
      where: {
        deviceId,
        provider: "mercadopago",
        status: "approved",
        activationCodeId: null,
        createdAt: {
          gte: hoursAgo(APPROVED_PAYMENT_WINDOW_HOURS),
        },
      },
      orderBy: {
        approvedAt: "desc",
      },
      select: {
        id: true,
        status: true,
        plan: true,
        amount: true,
        currency: true,
        createdAt: true,
        approvedAt: true,
        activationCodeId: true,
      },
    });

    if (!payment) {
      return jsonOK({
        ok: true,
        found: false,
        payment: null,
      });
    }

    return jsonOK({
      ok: true,
      found: true,
      payment,
      redirectUrl: `/pago/regreso?paymentId=${payment.id}`,
    });
  } catch (err: any) {
    console.error("API /api/payments/latest-for-device ERROR:", err);

    return jsonERR(
      {
        ok: false,
        error: err?.message ?? "Error desconocido",
      },
      500
    );
  }
}