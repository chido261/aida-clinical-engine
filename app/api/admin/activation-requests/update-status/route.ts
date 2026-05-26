// app/api/admin/activation-requests/update-status/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

type Status = "pending" | "paid" | "activated" | "cancelled";

type Body = {
  id?: number;
  status?: string;
};

const VALID_STATUSES: Status[] = ["pending", "paid", "activated", "cancelled"];

function isValidStatus(value: string | undefined): value is Status {
  return VALID_STATUSES.includes(value as Status);
}

function addDaysExact(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

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

export async function POST(req: Request) {
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

    const body = (await req.json()) as Body;

    const id = Number(body.id);
    const nextStatus = body.status;

    if (!Number.isInteger(id) || id <= 0) {
      return jsonERR({ ok: false, error: "Folio inválido" }, 400);
    }

    if (!isValidStatus(nextStatus)) {
      return jsonERR({ ok: false, error: "Estado inválido" }, 400);
    }

    const existing = await prisma.activationRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      return jsonERR({ ok: false, error: "Solicitud no encontrada" }, 404);
    }

    if (existing.status === "activated") {
      return jsonERR(
        {
          ok: false,
          error: "Esta solicitud ya fue activada y no puede cambiarse desde aquí.",
        },
        409
      );
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.activationRequest.update({
        where: { id },
        data: {
          status: nextStatus,
        },
      });

      let updatedUserState = null;

      if (nextStatus === "activated") {
        updatedUserState = await tx.userState.upsert({
          where: {
            id: existing.deviceId,
          },
          create: {
            id: existing.deviceId,
            trialStartedAt: now,
            trialEndsAt: now,
            licenseStatus: "active",
            fullStartedAt: now,
            fullEndsAt: addDaysExact(now, existing.duration),
            activePlan: existing.plan,
            activePlanSource: "activation-request",
            phoneE164: existing.phone,
          },
          update: {
            licenseStatus: "active",
            fullStartedAt: now,
            fullEndsAt: addDaysExact(now, existing.duration),
            activePlan: existing.plan,
            activePlanSource: "activation-request",
            phoneE164: existing.phone,
          },
        });
      }

      return {
        updatedRequest,
        updatedUserState,
      };
    });

    return jsonOK({
      ok: true,
      activationRequest: {
        id: result.updatedRequest.id,
        deviceId: result.updatedRequest.deviceId,
        name: result.updatedRequest.name,
        phone: result.updatedRequest.phone,
        plan: result.updatedRequest.plan,
        price: result.updatedRequest.price,
        duration: result.updatedRequest.duration,
        status: result.updatedRequest.status,
        createdAt: result.updatedRequest.createdAt,
        updatedAt: result.updatedRequest.updatedAt,
      },
      userState: result.updatedUserState
        ? {
            id: result.updatedUserState.id,
            licenseStatus: result.updatedUserState.licenseStatus,
            fullStartedAt: result.updatedUserState.fullStartedAt,
            fullEndsAt: result.updatedUserState.fullEndsAt,
            phoneE164: result.updatedUserState.phoneE164,
          }
        : null,
    });
  } catch (err: any) {
    console.error("API /api/admin/activation-requests/update-status ERROR:", err);

    return jsonERR(
      {
        ok: false,
        error: err?.message ?? "Error desconocido",
      },
      500
    );
  }
}