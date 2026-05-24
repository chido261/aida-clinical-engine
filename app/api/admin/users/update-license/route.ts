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

    const updatedUser =
      action === "cancel-license"
        ? await prisma.userState.update({
            where: {
              id: userId,
            },
            data: {
              licenseStatus: "expired",
              fullEndsAt: now,
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
              dailyMsgDate: null,
              dailyMsgCount: 0,
            },
          });

    return jsonOK({
      ok: true,
      action,
      user: {
        id: updatedUser.id,
        licenseStatus: updatedUser.licenseStatus,
        trialStartedAt: updatedUser.trialStartedAt,
        trialEndsAt: updatedUser.trialEndsAt,
        fullStartedAt: updatedUser.fullStartedAt,
        fullEndsAt: updatedUser.fullEndsAt,
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