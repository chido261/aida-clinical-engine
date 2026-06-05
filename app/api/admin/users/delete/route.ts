// app/api/admin/users/delete/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

type Body = {
  userId?: string;
};

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
    const userId = String(body.userId || "").trim();

    if (!userId) {
      return jsonERR(
        {
          ok: false,
          error: "Usuario inválido",
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

    const deleted = await prisma.$transaction(async (tx) => {
      const readings = await tx.reading.deleteMany({
        where: {
          userId,
        },
      });

      const usageDaily = await tx.usageDaily.deleteMany({
        where: {
          userId,
        },
      });

      const deviceSessions = await tx.deviceSession.deleteMany({
        where: {
          deviceId: userId,
        },
      });

      const user = await tx.userState.delete({
        where: {
          id: userId,
        },
      });

      return {
        user,
        readingsCount: readings.count,
        usageDailyCount: usageDaily.count,
        deviceSessionsCount: deviceSessions.count,
      };
    });

    return jsonOK({
      ok: true,
      deleted: {
        userId: deleted.user.id,
        readingsCount: deleted.readingsCount,
        usageDailyCount: deleted.usageDailyCount,
        deviceSessionsCount: deleted.deviceSessionsCount,
      },
    });
  } catch (err: any) {
    console.error("API /api/admin/users/delete ERROR:", err);

    return jsonERR(
      {
        ok: false,
        error: err?.message ?? "Error desconocido",
      },
      500
    );
  }
}