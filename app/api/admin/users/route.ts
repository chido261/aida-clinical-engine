// app/api/admin/users/route.ts

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

function getLicenseLabel(status: string | null | undefined) {
  if (status === "trial") return "Prueba";
  if (status === "active") return "Activo";
  if (status === "expired") return "Expirado";
  if (status === "maintenance") return "Mantenimiento";
  return status || "Sin estado";
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

    const users = await prisma.userState.findMany({
      orderBy: {
        updatedAt: "desc",
      },
      take: 200,
    });

    return jsonOK({
      ok: true,
      users: users.map((user) => ({
        id: user.id,
        licenseStatus: user.licenseStatus,
        licenseLabel: getLicenseLabel(user.licenseStatus),
        phoneE164: user.phoneE164,
        trialStartedAt: user.trialStartedAt,
        trialEndsAt: user.trialEndsAt,
        fullStartedAt: user.fullStartedAt,
        fullEndsAt: user.fullEndsAt,
        activePlan: user.activePlan,
        activePlanSource: user.activePlanSource,
        lastMsgAt: user.lastMsgAt,
        totalMsgCount: user.totalMsgCount,
        dailyMsgDate: user.dailyMsgDate,
        dailyMsgCount: user.dailyMsgCount,
        baselineA1c: user.baselineA1c,
        baselineAvgGlucose: user.baselineAvgGlucose,
        baselineSetAt: user.baselineSetAt,
        clinicalState: user.clinicalState,
        pendingFollowUpType: user.pendingFollowUpType,
        pendingFollowUpAt: user.pendingFollowUpAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
    });
  } catch (err: any) {
    console.error("API /api/admin/users ERROR:", err);

    return jsonERR(
      {
        ok: false,
        error: err?.message ?? "Error desconocido",
      },
      500
    );
  }
}