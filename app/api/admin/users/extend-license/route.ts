// app/api/admin/users/extend-license/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

type Body = {
  userId?: string;
  days?: number;
};

const ALLOWED_DAYS = [30, 90, 365];

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
    const days = Number(body.days);

    if (!userId) {
      return jsonERR(
        {
          ok: false,
          error: "Usuario inválido",
        },
        400
      );
    }

    if (!ALLOWED_DAYS.includes(days)) {
      return jsonERR(
        {
          ok: false,
          error: "Duración inválida",
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

    const currentEnd =
      existing.fullEndsAt && existing.fullEndsAt > now
        ? existing.fullEndsAt
        : now;

    const newFullEndsAt = addDaysExact(currentEnd, days);

    const updatedUser = await prisma.userState.update({
      where: {
        id: userId,
      },
      data: {
        licenseStatus: "active",
        fullStartedAt: existing.fullStartedAt ?? now,
        fullEndsAt: newFullEndsAt,
        activePlan:
  days === 30 ? "manual-30" : days === 90 ? "manual-90" : "manual-365",
activePlanSource: "manual-extension",
      },
    });

    return jsonOK({
      ok: true,
      user: {
        id: updatedUser.id,
        licenseStatus: updatedUser.licenseStatus,
        fullStartedAt: updatedUser.fullStartedAt,
        fullEndsAt: updatedUser.fullEndsAt,
        phoneE164: updatedUser.phoneE164,
        totalMsgCount: updatedUser.totalMsgCount,
        lastMsgAt: updatedUser.lastMsgAt,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (err: any) {
    console.error("API /api/admin/users/extend-license ERROR:", err);

    return jsonERR(
      {
        ok: false,
        error: err?.message ?? "Error desconocido",
      },
      500
    );
  }
}