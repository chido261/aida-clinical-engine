// app/api/payments/latest-for-device/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

type Body = {
  deviceId?: unknown;
};

function jsonOK(payload: any) {
  return NextResponse.json(payload);
}

function jsonERR(payload: any, status: number) {
  return NextResponse.json(payload, { status });
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
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
        status: {
          in: ["pending", "created", "approved"],
        },
        createdAt: {
          gte: minutesAgo(120),
        },
      },
      orderBy: {
        createdAt: "desc",
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