// app/api/admin/activation-requests/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { normalizePhoneE164 } from "@/app/lib/aidaActivation";

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

    const requests = await prisma.activationRequest.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    const phonesE164 = Array.from(
      new Set(requests.map((request) => normalizePhoneE164(request.phone)))
    ).filter(Boolean);

    const activationCodes = await prisma.activationCode.findMany({
      where: {
        phoneE164: {
          in: phonesE164,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const activationCodeIds = activationCodes.map((code) => code.id);

    const activeSessions = activationCodeIds.length
      ? await prisma.deviceSession.findMany({
          where: {
            activationCodeId: {
              in: activationCodeIds,
            },
            active: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        })
      : [];

    const codeByPhone = new Map<string, (typeof activationCodes)[number]>();

    for (const code of activationCodes) {
      if (!codeByPhone.has(code.phoneE164)) {
        codeByPhone.set(code.phoneE164, code);
      }
    }

    const sessionByCodeId = new Map(
      activeSessions.map((session) => [session.activationCodeId, session])
    );

    const requestCountByPhone = new Map<string, number>();

    for (const request of requests) {
      const phoneE164 = normalizePhoneE164(request.phone);
      requestCountByPhone.set(
        phoneE164,
        (requestCountByPhone.get(phoneE164) ?? 0) + 1
      );
    }

    return jsonOK({
      ok: true,
      activationRequests: requests.map((request) => {
        const phoneE164 = normalizePhoneE164(request.phone);
        const activationCode = codeByPhone.get(phoneE164) ?? null;
        const activeSession = activationCode
          ? sessionByCodeId.get(activationCode.id) ?? null
          : null;

        const sameDevice =
          Boolean(activationCode?.currentDeviceId) &&
          activationCode?.currentDeviceId === request.deviceId;

        const hasRepeatedPhone = (requestCountByPhone.get(phoneE164) ?? 0) > 1;

        const activationRelation = activationCode
          ? sameDevice
            ? "same_request"
            : "phone_current_code"
          : "none";

        const isRenewalLike =
          Boolean(activationCode) &&
          hasRepeatedPhone &&
          request.status === "activated";

        const activationNotice = activationCode
          ? sameDevice
            ? "Esta solicitud coincide con el dispositivo activo de la clave."
            : "Esta fila es una solicitud histórica. Se muestra la clave activa actual de este teléfono."
          : "Este teléfono todavía no tiene una clave activa registrada.";

        return {
          id: request.id,
          deviceId: request.deviceId,
          name: request.name,
          phone: request.phone,
          phoneE164,
          plan: request.plan,
          price: request.price,
          duration: request.duration,
          status: request.status,
          createdAt: request.createdAt,
          updatedAt: request.updatedAt,

          activationCodeId: activationCode?.id ?? null,
          activationCode: activationCode?.code ?? null,
          activationStatus: activationCode?.status ?? null,
          activationActivatedAt: activationCode?.activatedAt ?? null,
          activationCreatedAt: activationCode?.createdAt ?? null,
          activationFullStartedAt: activationCode?.fullStartedAt ?? null,
          activationFullEndsAt: activationCode?.fullEndsAt ?? null,
          activationCurrentDeviceId: activationCode?.currentDeviceId ?? null,

          deviceSessionActive: activeSession?.active ?? false,
          deviceSessionCreatedAt: activeSession?.createdAt ?? null,
          deviceSessionDisabledAt: activeSession?.disabledAt ?? null,

          activationRelation,
          isRenewalLike,
          activationNotice,
          hasRepeatedPhone,
        };
      }),
    });
  } catch (err: any) {
    console.error("API /api/admin/activation-requests ERROR:", err);

    return jsonERR(
      {
        ok: false,
        error: err?.message ?? "Error desconocido",
      },
      500
    );
  }
}