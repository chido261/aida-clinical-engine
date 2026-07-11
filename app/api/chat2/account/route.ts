// app/api/chat2/account/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

type AllowedPhase = "DIAGNOSTICO" | "FASE_1" | "FASE_2";

type AccountAction =
  | "GET_ACCOUNT"
  | "UPDATE_PROFILE"
  | "UPDATE_PHASE";

type AccountRequestBody = {
  deviceId?: unknown;
  action?: unknown;

  name?: unknown;
  age?: unknown;
  heightCm?: unknown;
  weightKg?: unknown;
  baselineA1c?: unknown;
  meds?: unknown;
  fastingPeakMgDl?: unknown;
  postMealPeakMgDl?: unknown;

  activePhase?: unknown;
};

const ALLOWED_PHASES: AllowedPhase[] = [
  "DIAGNOSTICO",
  "FASE_1",
  "FASE_2",
];

const TEST_PROFILE = {
  name: "David Rodriguez",
  age: 43,
  heightCm: 174,
  weightKg: 90,
  baselineA1c: 9,
  meds:
    "Linagliptina: 1 por la mañana. Dapagliflozina: 1 por la noche.",
  fastingPeakMgDl: 230,
  postMealPeakMgDl: 300,
  diagnosis: "dm2",
  activePhase: "DIAGNOSTICO" as AllowedPhase,
};

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getNullableString(value: unknown) {
  const text = getString(value);
  return text || null;
}

function getNullableInteger(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue =
    typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return Math.round(numberValue);
}

function getNullableFloat(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue =
    typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return numberValue;
}

function normalizeAction(value: unknown): AccountAction {
  const action = getString(value).toUpperCase();

  if (action === "UPDATE_PROFILE") {
    return "UPDATE_PROFILE";
  }

  if (action === "UPDATE_PHASE") {
    return "UPDATE_PHASE";
  }

  return "GET_ACCOUNT";
}

function normalizePhase(value: unknown): AllowedPhase | null {
  const phase = getString(value).toUpperCase();

  if (
    phase === "DIAGNOSTICO" ||
    phase === "DIAGNOSTICO_7_DIAS"
  ) {
    return "DIAGNOSTICO";
  }

  if (phase === "FASE_1") {
    return "FASE_1";
  }

  if (phase === "FASE_2") {
    return "FASE_2";
  }

  return null;
}

function protocolFromPhase(phase: AllowedPhase) {
  if (phase === "DIAGNOSTICO") {
    return "DIAGNOSTICO_7_DIAS";
  }

  return phase;
}

function phaseLabel(phase: AllowedPhase) {
  if (phase === "DIAGNOSTICO") {
    return "Diagnóstico 7 días";
  }

  if (phase === "FASE_1") {
    return "Fase 1";
  }

  return "Fase 2";
}

async function ensureChat2User(deviceId: string) {
  const existing = await prisma.userState.findUnique({
    where: {
      id: deviceId,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.userState.create({
    data: {
      id: deviceId,

      name: TEST_PROFILE.name,
      age: TEST_PROFILE.age,
      heightCm: TEST_PROFILE.heightCm,
      weightKg: TEST_PROFILE.weightKg,
      diagnosis: TEST_PROFILE.diagnosis,
      meds: TEST_PROFILE.meds,

      baselineA1c: TEST_PROFILE.baselineA1c,
      baselineAvgGlucose: TEST_PROFILE.fastingPeakMgDl,
      baselineSetAt: new Date(),

      fastingPeakMgDl: TEST_PROFILE.fastingPeakMgDl,
      postMealPeakMgDl: TEST_PROFILE.postMealPeakMgDl,

      activeProtocol: protocolFromPhase(
        TEST_PROFILE.activePhase
      ),
      activePhase: TEST_PROFILE.activePhase,
      protocolStartedAt: new Date(),

      licenseStatus: "trial",
      trialStartedAt: new Date(),
      trialEndsAt: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ),
    },
  });
}

async function updateProfile(
  deviceId: string,
  body: AccountRequestBody
) {
  const age = getNullableInteger(body.age);
  const heightCm = getNullableFloat(body.heightCm);
  const weightKg = getNullableFloat(body.weightKg);
  const baselineA1c = getNullableFloat(body.baselineA1c);
  const fastingPeakMgDl = getNullableInteger(
    body.fastingPeakMgDl
  );
  const postMealPeakMgDl = getNullableInteger(
    body.postMealPeakMgDl
  );

  if (age !== null && (age < 18 || age > 120)) {
    throw new Error("La edad no es válida.");
  }

  if (
    heightCm !== null &&
    (heightCm < 100 || heightCm > 250)
  ) {
    throw new Error("La estatura no es válida.");
  }

  if (
    weightKg !== null &&
    (weightKg < 30 || weightKg > 400)
  ) {
    throw new Error("El peso no es válido.");
  }

  if (
    baselineA1c !== null &&
    (baselineA1c < 3 || baselineA1c > 25)
  ) {
    throw new Error("La hemoglobina glucosilada no es válida.");
  }

  if (
    fastingPeakMgDl !== null &&
    (fastingPeakMgDl < 30 || fastingPeakMgDl > 600)
  ) {
    throw new Error("La glucosa en ayunas no es válida.");
  }

  if (
    postMealPeakMgDl !== null &&
    (postMealPeakMgDl < 30 || postMealPeakMgDl > 600)
  ) {
    throw new Error("La glucosa postcomida no es válida.");
  }

  return prisma.userState.update({
    where: {
      id: deviceId,
    },
    data: {
      name: getNullableString(body.name),
      age,
      heightCm,
      weightKg,
      baselineA1c,
      baselineSetAt: baselineA1c !== null
        ? new Date()
        : undefined,
      meds: getNullableString(body.meds),
      fastingPeakMgDl,
      postMealPeakMgDl,
    },
  });
}

async function updatePhase(
  deviceId: string,
  phase: AllowedPhase
) {
  const currentUser = await prisma.userState.findUnique({
    where: {
      id: deviceId,
    },
    select: {
      activePhase: true,
    },
  });

  if (!currentUser) {
    throw new Error("No se encontró el usuario.");
  }

  const phaseChanged = currentUser.activePhase !== phase;

  return prisma.userState.update({
    where: {
      id: deviceId,
    },
    data: {
      activePhase: phase,
      activeProtocol: protocolFromPhase(phase),

      ...(phaseChanged
        ? {
            protocolStartedAt: new Date(),
            eligibleForNextProtocol: false,
            protocolReviewReason: null,
          }
        : {}),
    },
  });
}

async function buildAccount(deviceId: string) {
  const user = await ensureChat2User(deviceId);

  const normalizedPhase =
    normalizePhase(user.activePhase) ?? "DIAGNOSTICO";

  const [fastingStats, postMealStats] = await Promise.all([
    prisma.reading.aggregate({
      where: {
        userId: deviceId,
        moment: "AYUNO",
      },
      _min: {
        glucose: true,
      },
      _max: {
        glucose: true,
      },
      _avg: {
        glucose: true,
      },
    }),

    prisma.reading.aggregate({
      where: {
        userId: deviceId,
        moment: "POSTCOMIDA",
      },
      _min: {
        glucose: true,
      },
      _max: {
        glucose: true,
      },
      _avg: {
        glucose: true,
      },
    }),
  ]);

  return {
    id: user.id,

    personal: {
      name: user.name,
      age: user.age,
      heightCm: user.heightCm,
      heightMeters:
        user.heightCm !== null
          ? Number((user.heightCm / 100).toFixed(2))
          : null,
      weightKg: user.weightKg,
      diagnosis: user.diagnosis,
    },

    clinical: {
      baselineA1c: user.baselineA1c,
      medications: user.meds,

      fastingReferenceMgDl:
        user.fastingPeakMgDl ?? null,

      fastingMinimumMgDl:
        fastingStats._min.glucose ?? null,

      fastingMaximumMgDl:
        fastingStats._max.glucose ??
        user.fastingPeakMgDl ??
        null,

      fastingAverageMgDl:
        fastingStats._avg.glucose !== null
          ? Math.round(fastingStats._avg.glucose)
          : user.fastingPeakMgDl ?? null,

      postMealReferenceMgDl:
        user.postMealPeakMgDl ?? null,

      postMealMinimumMgDl:
        postMealStats._min.glucose ?? null,

      postMealMaximumMgDl:
        postMealStats._max.glucose ??
        user.postMealPeakMgDl ??
        null,

      postMealAverageMgDl:
        postMealStats._avg.glucose !== null
          ? Math.round(postMealStats._avg.glucose)
          : user.postMealPeakMgDl ?? null,
    },

    protocol: {
      activePhase: normalizedPhase,
      activePhaseLabel: phaseLabel(normalizedPhase),
      activeProtocol: protocolFromPhase(normalizedPhase),
      protocolStartedAt: user.protocolStartedAt,
      eligibleForNextProtocol:
        user.eligibleForNextProtocol,
      protocolReviewReason:
        user.protocolReviewReason,

      availablePhases: ALLOWED_PHASES.map((phase) => ({
        value: phase,
        label: phaseLabel(phase),
      })),
    },

    updatedAt: user.updatedAt,
  };
}

export async function POST(req: Request) {
  try {
    const body =
      (await req.json()) as AccountRequestBody;

    const deviceId = getString(body.deviceId);
    const action = normalizeAction(body.action);

    if (!deviceId) {
      return NextResponse.json(
        {
          ok: false,
          error: "deviceId_required",
          message: "Falta el identificador del dispositivo.",
        },
        {
          status: 400,
        }
      );
    }

    await ensureChat2User(deviceId);

    if (action === "UPDATE_PROFILE") {
      await updateProfile(deviceId, body);
    }

    if (action === "UPDATE_PHASE") {
      const phase = normalizePhase(body.activePhase);

      if (!phase) {
        return NextResponse.json(
          {
            ok: false,
            error: "invalid_phase",
            message: "La fase seleccionada no es válida.",
            allowedPhases: ALLOWED_PHASES,
          },
          {
            status: 400,
          }
        );
      }

      await updatePhase(deviceId, phase);
    }

    const account = await buildAccount(deviceId);

    return NextResponse.json({
      ok: true,
      account,
      message:
        action === "UPDATE_PHASE"
          ? "La fase fue actualizada correctamente."
          : action === "UPDATE_PROFILE"
            ? "El perfil fue actualizado correctamente."
            : null,
    });
  } catch (error: unknown) {
    console.error(
      "API /api/chat2/account ERROR:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error desconocido",
      },
      {
        status: 500,
      }
    );
  }
}