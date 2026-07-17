export const runtime = "nodejs";

import { DateTime } from "luxon";
import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { ensureUserState } from "@/app/lib/aidaMemory";
import { reviewCurrentProtocolWeekIfDue } from "@/app/lib/aida2/weeklyProtocolReview";

type SimulatorAction =
  | "STATUS"
  | "RESET_DIAGNOSTIC"
  | "EXPIRE_TRIAL"
  | "ACTIVATE_PHASE_1"
  | "LOAD_PASSING_WEEK"
  | "CONFIRM_MEDICATION_REDUCTION"
  | "RUN_WEEKLY_REVIEW";

type SimulatorBody = {
  deviceId?: unknown;
  action?: unknown;
  weekOffset?: unknown;
};

const TIMEZONE = "America/Mexico_City";
const READING_SLOTS = [
  "AYUNO",
  "POST_DESAYUNO",
  "PRE_COMIDA",
  "POST_COMIDA",
  "PRE_CENA",
  "POST_CENA",
] as const;

function unavailable() {
  return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAction(value: unknown): SimulatorAction {
  const action = text(value).toUpperCase();
  const actions: SimulatorAction[] = [
    "STATUS",
    "RESET_DIAGNOSTIC",
    "EXPIRE_TRIAL",
    "ACTIVATE_PHASE_1",
    "LOAD_PASSING_WEEK",
    "CONFIRM_MEDICATION_REDUCTION",
    "RUN_WEEKLY_REVIEW",
  ];
  return actions.includes(action as SimulatorAction)
    ? (action as SimulatorAction)
    : "STATUS";
}

function normalizeWeekOffset(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(1, Math.max(0, Math.round(parsed)));
}

async function buildStatus(deviceId: string) {
  const [user, readingCount, reviews] = await Promise.all([
    prisma.userState.findUnique({ where: { id: deviceId } }),
    prisma.reading.count({ where: { userId: deviceId } }),
    prisma.weeklyProtocolReview.findMany({
      where: { userId: deviceId },
      orderBy: { weekStart: "desc" },
      take: 4,
    }),
  ]);

  return { user, readingCount, reviews };
}

async function resetDiagnostic(deviceId: string) {
  const now = new Date();
  await ensureUserState(deviceId);

  await prisma.$transaction([
    prisma.reading.deleteMany({ where: { userId: deviceId } }),
    prisma.weeklyProtocolReview.deleteMany({ where: { userId: deviceId } }),
    prisma.conversationContext.deleteMany({ where: { userId: deviceId } }),
    prisma.clinicalEvent.deleteMany({ where: { userId: deviceId } }),
    prisma.mealLog.deleteMany({ where: { userId: deviceId } }),
    prisma.protocolProgress.deleteMany({ where: { userId: deviceId } }),
    prisma.userState.update({
      where: { id: deviceId },
      data: {
        name: "David Rodriguez",
        diagnosis: "dm2",
        onboardingDoneAt: now,
        trialStartedAt: now,
        trialEndsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        licenseStatus: "trial",
        fullStartedAt: null,
        fullEndsAt: null,
        activePhase: "DIAGNOSTICO",
        activeProtocol: "DIAGNOSTICO_7_DIAS",
        protocolVersion: "1.0",
        protocolStartedAt: now,
        eligibleForNextProtocol: false,
        protocolReviewReason: null,
        medicationReductionPercent: 0,
        medicationReductionConfirmedAt: null,
        clinicalState: null,
        lastEventType: null,
        lastEventAt: null,
        pendingFollowUpType: null,
        pendingFollowUpAt: null,
        lastRecommendation: null,
        currentNutritionGoal: null,
        totalMsgCount: 0,
        lastMsgAt: null,
      },
    }),
  ]);
}

async function loadPassingWeek(deviceId: string, weekOffset: number) {
  const weekStart = DateTime.now()
    .setZone(TIMEZONE)
    .startOf("week")
    .minus({ weeks: weekOffset });
  const weekEnd = weekStart.endOf("week");

  await prisma.reading.deleteMany({
    where: {
      userId: deviceId,
      createdAt: {
        gte: weekStart.toUTC().toJSDate(),
        lte: weekEnd.toUTC().toJSDate(),
      },
    },
  });

  const readings = Array.from({ length: 7 }).flatMap((_, dayIndex) =>
    READING_SLOTS.map((readingSlot, slotIndex) => ({
      userId: deviceId,
      glucose:
        readingSlot === "AYUNO"
          ? 92
          : readingSlot.startsWith("PRE_")
            ? 90
            : 125,
      moment:
        readingSlot === "AYUNO"
          ? "AYUNO"
          : readingSlot.startsWith("PRE_")
            ? "ANTES_COMER"
            : "POSTCOMIDA",
      readingSlot,
      symptoms: null,
      eventType: "STABLE_READING",
      nutritionGoal: "MAINTAIN_GLUCOSE",
      createdAt: weekStart
        .plus({ days: dayIndex, hours: 7 + slotIndex * 2 })
        .toUTC()
        .toJSDate(),
    }))
  );

  await prisma.reading.createMany({ data: readings });
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") return unavailable();

  try {
    const body = (await req.json()) as SimulatorBody;
    const deviceId = text(body.deviceId);
    const action = normalizeAction(body.action);
    const weekOffset = normalizeWeekOffset(body.weekOffset);

    if (!deviceId) {
      return NextResponse.json(
        { ok: false, error: "device_id_required" },
        { status: 400 }
      );
    }

    await ensureUserState(deviceId);

    if (action === "RESET_DIAGNOSTIC") {
      await resetDiagnostic(deviceId);
    } else if (action === "EXPIRE_TRIAL") {
      await prisma.userState.update({
        where: { id: deviceId },
        data: {
          licenseStatus: "expired",
          trialEndsAt: new Date(Date.now() - 60_000),
        },
      });
    } else if (action === "ACTIVATE_PHASE_1") {
      const now = new Date();
      await prisma.userState.update({
        where: { id: deviceId },
        data: {
          licenseStatus: "active",
          fullStartedAt: now,
          fullEndsAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
          activePhase: "FASE_1",
          activeProtocol: "FASE_1",
          protocolVersion: "1.0",
          protocolStartedAt: now,
          eligibleForNextProtocol: false,
        },
      });
    } else if (action === "LOAD_PASSING_WEEK") {
      await loadPassingWeek(deviceId, weekOffset);
    } else if (action === "CONFIRM_MEDICATION_REDUCTION") {
      await prisma.userState.update({
        where: { id: deviceId },
        data: {
          medicationReductionPercent: 51,
          medicationReductionConfirmedAt: new Date(),
        },
      });
    } else if (action === "RUN_WEEKLY_REVIEW") {
      await reviewCurrentProtocolWeekIfDue({
        userId: deviceId,
        force: true,
        weekOffset,
      });
    }

    return NextResponse.json({
      ok: true,
      action,
      weekOffset,
      status: await buildStatus(deviceId),
    });
  } catch (error: unknown) {
    console.error("POST /api/dev/aida2-simulator ERROR:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

