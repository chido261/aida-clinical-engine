// app/api/onboarding/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { ensureUserState } from "@/app/lib/aidaMemory";

type OnboardingBody = {
  deviceId?: unknown;
  name?: unknown;
  age?: unknown;
  heightCm?: unknown;
  weightKg?: unknown;
  diagnosis?: unknown;
  meds?: unknown;
  fastingPeakMgDl?: unknown;
  postMealPeakMgDl?: unknown;
  wakeTime?: unknown;
};

function jsonOK(payload: unknown) {
  return NextResponse.json(payload);
}

function jsonERR(payload: unknown, status: number) {
  return NextResponse.json(payload, { status });
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getInt(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : value;
  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) return null;

  return Math.round(parsed);
}

function getFloat(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : value;
  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) return null;

  return parsed;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as OnboardingBody;

    const deviceId = getString(body.deviceId);
    const name = getString(body.name);
    const diagnosis = getString(body.diagnosis);
    const meds = getString(body.meds);
    const wakeTime = getString(body.wakeTime);

    const age = getInt(body.age);
    const heightCm = getFloat(body.heightCm);
    const weightKg = getFloat(body.weightKg);
    const fastingPeakMgDl = getInt(body.fastingPeakMgDl);
    const postMealPeakMgDl = getInt(body.postMealPeakMgDl);

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

    if (!name || !age || !heightCm || !weightKg || !diagnosis || !wakeTime) {
      return jsonERR(
        {
          ok: false,
          error: "missing_required_fields",
          message: "Faltan datos obligatorios del onboarding.",
        },
        400
      );
    }

    if (!fastingPeakMgDl || !postMealPeakMgDl) {
      return jsonERR(
        {
          ok: false,
          error: "missing_glucose_fields",
          message: "Faltan mediciones de glucosa.",
        },
        400
      );
    }

    const existingUserState = await ensureUserState(deviceId);

    const userState = await prisma.userState.update({
      where: {
        id: deviceId,
      },
      data: {
        name,
        age,
        heightCm,
        weightKg,
        diagnosis,
        meds: meds || null,
        fastingPeakMgDl,
        postMealPeakMgDl,
        wakeTime,
        onboardingDoneAt: new Date(),
        activeProtocol: "DIAGNOSTICO_7_DIAS",
        activePhase: "DIAGNOSTICO",
        protocolVersion: "1.0",
        protocolStartedAt: existingUserState.protocolStartedAt ?? new Date(),
      },
    });

    return jsonOK({
      ok: true,
      user: {
        id: userState.id,
        name: userState.name,
        onboardingDoneAt: userState.onboardingDoneAt,
        licenseStatus: userState.licenseStatus,
        trialEndsAt: userState.trialEndsAt,
        fullEndsAt: userState.fullEndsAt,
      },
    });
  } catch (err: unknown) {
    console.error("API /api/onboarding ERROR:", err);

    return jsonERR(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      },
      500
    );
  }
}
