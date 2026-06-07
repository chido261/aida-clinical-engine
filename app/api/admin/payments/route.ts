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

function safeParseRawPayload(rawPayload: unknown) {
  if (!rawPayload) return null;

  if (typeof rawPayload === "object") {
    return rawPayload as Record<string, any>;
  }

  if (typeof rawPayload !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, any>)
      : null;
  } catch {
    return null;
  }
}

function getCustomerNameFromRawPayload(rawPayload: unknown) {
  const payload = safeParseRawPayload(rawPayload);
  const name = typeof payload?.name === "string" ? payload.name.trim() : "";

  return name || null;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

    const deviceIds = Array.from(
      new Set(
        payments
          .map((payment) => payment.deviceId)
          .filter((id): id is string => Boolean(id))
      )
    );

    const phones = Array.from(
      new Set(
        payments
          .map((payment) => payment.phoneE164)
          .filter((phone): phone is string => Boolean(phone))
      )
    );

    const users = await prisma.userState.findMany({
      where: {
        OR: [
          deviceIds.length
            ? {
                id: {
                  in: deviceIds,
                },
              }
            : {},
          phones.length
            ? {
                phoneE164: {
                  in: phones,
                },
              }
            : {},
        ],
      },
      select: {
        id: true,
        name: true,
        phoneE164: true,
      },
    });

    const userByDeviceId = new Map(
      users
        .filter((user) => Boolean(user.id))
        .map((user) => [user.id, user])
    );

    const userByPhone = new Map(
      users
        .filter((user) => Boolean(user.phoneE164))
        .map((user) => [user.phoneE164 as string, user])
    );

    return jsonOK({
      ok: true,
      payments: payments.map((payment) => {
        const activationCode = payment.activationCodeId
          ? activationCodeById.get(payment.activationCodeId) ?? null
          : null;

        const userFromDevice = payment.deviceId
          ? userByDeviceId.get(payment.deviceId) ?? null
          : null;

        const userFromPhone = payment.phoneE164
          ? userByPhone.get(payment.phoneE164) ?? null
          : null;

        const customerName =
          getCustomerNameFromRawPayload(payment.rawPayload) ||
          normalizeText(userFromDevice?.name) ||
          normalizeText(userFromPhone?.name) ||
          null;

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
          customerName,
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