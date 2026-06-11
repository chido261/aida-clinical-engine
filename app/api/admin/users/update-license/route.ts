// app/api/admin/users/update-license/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

type LicenseAction = "cancel-license" | "reset-trial";

type Body = {
  userId?: string;
  action?: string;
};

const TRIAL_DAYS = 7;

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

function addDaysExact(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function isValidAction(value: string | undefined): value is LicenseAction {
  return value === "cancel-license" || value === "reset-trial";
}

async function cancelActiveAccessForUser({
  userId,
  phoneE164,
  now,
}: {
  userId: string;
  phoneE164: string | null;
  now: Date;
}) {
  const activeSessions = await prisma.deviceSession.findMany({
    where: {
      OR: [
        {
          deviceId: userId,
        },
        phoneE164
          ? {
              phoneE164,
            }
          : undefined,
      ].filter(Boolean) as any,
      active: true,
    },
    select: {
      activationCodeId: true,
    },
  });

  const sessionActivationCodeIds = activeSessions
    .map((session) => session.activationCodeId)
    .filter((id): id is number => typeof id === "number");

  const activeCodes = await prisma.activationCode.findMany({
    where: {
      status: "active",
      OR: [
        {
          currentDeviceId: userId,
        },
        phoneE164
          ? {
              phoneE164,
            }
          : undefined,
        sessionActivationCodeIds.length
          ? {
              id: {
                in: sessionActivationCodeIds,
              },
            }
          : undefined,
      ].filter(Boolean) as any,
    },
    select: {
      id: true,
    },
  });

  const activationCodeIds = Array.from(
    new Set([
      ...sessionActivationCodeIds,
      ...activeCodes.map((code) => code.id),
    ])
  );

  await prisma.deviceSession.updateMany({
    where: {
      OR: [
        {
          deviceId: userId,
        },
        phoneE164
          ? {
              phoneE164,
            }
          : undefined,
        activationCodeIds.length
          ? {
              activationCodeId: {
                in: activationCodeIds,
              },
            }
          : undefined,
      ].filter(Boolean) as any,
      active: true,
    },
    data: {
      active: false,
      disabledAt: now,
    },
  });

  if (activationCodeIds.length) {
    await prisma.activationCode.updateMany({
      where: {
        id: {
          in: activationCodeIds,
        },
      },
      data: {
        status: "cancelled",
        currentDeviceId: null,
      },
    });
  }

  return {
    cancelledActivationCodes: activationCodeIds.length,
  };
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

    const userId = String(body.userId || "").trim();
    const action = body.action;

    if (!userId) {
      return jsonERR(
        {
          ok: false,
          error: "Usuario inválido",
        },
        400
      );
    }

    if (!isValidAction(action)) {
      return jsonERR(
        {
          ok: false,
          error: "Acción inválida",
        },
        400
      );
    }

    const existing = await prisma.userState.findUnique({
      where: {
        id: userId,
      },
    });

    if (!existing) {
      return jsonERR(
        {
          ok: false,
          error: "Usuario no encontrado",
        },
        404
      );
    }

    const now = new Date();

    const accessCleanup = await cancelActiveAccessForUser({
      userId,
      phoneE164: existing.phoneE164,
      now,
    });

    const updatedUser =
      action === "cancel-license"
        ? await prisma.userState.update({
            where: {
              id: userId,
            },
            data: {
              licenseStatus: "expired",
              fullEndsAt: now,
              activePlan: null,
              activePlanSource: null,
            },
          })
        : await prisma.userState.update({
            where: {
              id: userId,
            },
            data: {
              licenseStatus: "trial",
              trialStartedAt: now,
              trialEndsAt: addDaysExact(now, TRIAL_DAYS),
              fullStartedAt: null,
              fullEndsAt: null,
              activePlan: null,
              activePlanSource: null,
              dailyMsgDate: null,
              dailyMsgCount: 0,
            },
          });

    return jsonOK({
      ok: true,
      action,
      accessCleanup,
      user: {
        id: updatedUser.id,
        licenseStatus: updatedUser.licenseStatus,
        trialStartedAt: updatedUser.trialStartedAt,
        trialEndsAt: updatedUser.trialEndsAt,
        fullStartedAt: updatedUser.fullStartedAt,
        fullEndsAt: updatedUser.fullEndsAt,
        activePlan: updatedUser.activePlan,
        activePlanSource: updatedUser.activePlanSource,
        phoneE164: updatedUser.phoneE164,
        totalMsgCount: updatedUser.totalMsgCount,
        lastMsgAt: updatedUser.lastMsgAt,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (err: any) {
    console.error("API /api/admin/users/update-license ERROR:", err);

    return jsonERR(
      {
        ok: false,
        error: err?.message ?? "Error desconocido",
      },
      500
    );
  }
}