// app/api/onboarding/status/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { ensureUserState } from "@/app/lib/aidaMemory";

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

    await ensureUserState(deviceId);

    const userState = await prisma.userState.findUnique({
      where: {
        id: deviceId,
      },
      select: {
        id: true,
        name: true,
        age: true,
        heightCm: true,
        weightKg: true,
        diagnosis: true,
        meds: true,
        fastingPeakMgDl: true,
        postMealPeakMgDl: true,
        wakeTime: true,
        onboardingDoneAt: true,
        licenseStatus: true,
        trialEndsAt: true,
        fullEndsAt: true,
      },
    });

    return jsonOK({
      ok: true,
      hasOnboarding: Boolean(userState?.onboardingDoneAt),
      user: userState,
    });
  } catch (err: any) {
    console.error("API /api/onboarding/status ERROR:", err);

    return jsonERR(
      {
        ok: false,
        error: err?.message ?? "Error desconocido",
      },
      500
    );
  }
}