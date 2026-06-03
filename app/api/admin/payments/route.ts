// app/api/admin/payments/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

function jsonOK(payload: any) {
  return NextResponse.json(payload);
}

function jsonERR(payload: any, status: number) {
  return NextResponse.json(payload, { status });
}

function isAuthorizedAdmin(req: Request) {
  const adminKey = process.env.AIDA_ADMIN_KEY;

  if (!adminKey) {
    return false;
  }

  const providedKey = req.headers.get("x-aida-admin-key");

  return providedKey === adminKey;
}

export async function GET(req: Request) {
  try {
    if (!isAuthorizedAdmin(req)) {
      return jsonERR(
        {
          ok: false,
          error: "No autorizado",
        },
        401
      );
    }

    const payments = await prisma.payment.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    const activationCodeIds = payments
      .map((payment) => payment.activationCodeId)
      .filter((id): id is number => typeof id === "number");

    const activationCodes = activationCodeIds.length
      ? await prisma.activationCode.findMany({
          where: {
            id: {
              in: activationCodeIds,
            },
          },
        })
      : [];

    const activationCodeById = new Map(
      activationCodes.map((code) => [code.id, code])
    );

    return jsonOK({
      ok: true,
      payments: payments.map((payment) => {
        const activationCode = payment.activationCodeId
          ? activationCodeById.get(payment.activationCodeId) ?? null
          : null;

        return {
          id: payment.id,
          provider: payment.provider,
          providerPaymentId: payment.providerPaymentId,
          providerRef: payment.providerRef,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          plan: payment.plan,
          durationDays: payment.durationDays,
          phoneE164: payment.phoneE164,
          deviceId: payment.deviceId,
          activationCodeId: payment.activationCodeId,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
          approvedAt: payment.approvedAt,

          activationCode: activationCode?.code ?? null,
          activationStatus: activationCode?.status ?? null,
          activationFullStartedAt: activationCode?.fullStartedAt ?? null,
          activationFullEndsAt: activationCode?.fullEndsAt ?? null,
          activationCurrentDeviceId: activationCode?.currentDeviceId ?? null,
        };
      }),
    });
  } catch (err: any) {
    console.error("API /api/admin/payments ERROR:", err);

    return jsonERR(
      {
        ok: false,
        error: err?.message ?? "Error desconocido",
      },
      500
    );
  }
}