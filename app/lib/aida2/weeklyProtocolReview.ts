import { DateTime } from "luxon";

import { prisma } from "@/app/lib/prisma";
import {
  runProtocolModule,
  type ProtocolId,
} from "@/app/lib/aida2/modules/protocolModule";
import type {
  OperationalProtocolConfig,
  ProtocolReadingSlot,
} from "@/app/lib/aida2/modules/protocolParsers";

type ReviewReading = {
  glucose: number;
  readingSlot: string | null;
  moment: string;
  createdAt: Date;
};

export type WeeklyReviewResult = {
  expectedReadings: number;
  recordedReadings: number;
  controlledReadings: number;
  completionPercent: number;
  controlledPercent: number;
  fastingAverage: number | null;
  otherAverage: number | null;
  minimumGlucose: number | null;
  maximumGlucose: number | null;
  hypoglycemiaCount: number;
  passed: boolean;
};

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Number(((value / total) * 100).toFixed(2));
}

function isKnownSlot(
  slot: string | null,
  config: OperationalProtocolConfig
): slot is ProtocolReadingSlot {
  return Boolean(
    slot && config.readings.slots.includes(slot as ProtocolReadingSlot)
  );
}

function deduplicateDailySlots(
  readings: ReviewReading[],
  config: OperationalProtocolConfig
) {
  const selected = new Map<string, ReviewReading>();

  readings.forEach((reading) => {
    if (!isKnownSlot(reading.readingSlot, config)) return;

    const localDate = DateTime.fromJSDate(reading.createdAt)
      .setZone(config.readings.timezone)
      .toISODate();
    const key = `${localDate}:${reading.readingSlot}`;
    const previous = selected.get(key);

    if (!previous || previous.createdAt < reading.createdAt) {
      selected.set(key, reading);
    }
  });

  return [...selected.values()];
}

export function evaluateWeeklyReadings(params: {
  readings: ReviewReading[];
  config: OperationalProtocolConfig;
}): WeeklyReviewResult {
  const { config } = params;
  const readings = deduplicateDailySlots(params.readings, config);
  const fasting = readings.filter((reading) => reading.readingSlot === "AYUNO");
  const others = readings.filter((reading) => reading.readingSlot !== "AYUNO");
  const controlledReadings = readings.filter((reading) => {
    const range = reading.readingSlot === "AYUNO"
      ? config.readings.fastingTarget
      : config.readings.otherSafeRange;
    return reading.glucose >= range.min && reading.glucose <= range.max;
  }).length;
  const hypoglycemiaCount = readings.filter(
    (reading) => reading.glucose < config.readings.hypoglycemiaBelow
  ).length;
  const completionPercent = percent(
    readings.length,
    config.weeklyReview.expectedReadings
  );
  const controlledPercent = percent(controlledReadings, readings.length);
  const glucoseValues = readings.map((reading) => reading.glucose);
  const passed =
    completionPercent >= config.weeklyReview.minimumCompletionPercent &&
    controlledPercent >= config.weeklyReview.minimumControlledPercent &&
    (!config.weeklyReview.requiresNoHypoglycemia || hypoglycemiaCount === 0);

  return {
    expectedReadings: config.weeklyReview.expectedReadings,
    recordedReadings: readings.length,
    controlledReadings,
    completionPercent,
    controlledPercent,
    fastingAverage: average(fasting.map((reading) => reading.glucose)),
    otherAverage: average(others.map((reading) => reading.glucose)),
    minimumGlucose: glucoseValues.length ? Math.min(...glucoseValues) : null,
    maximumGlucose: glucoseValues.length ? Math.max(...glucoseValues) : null,
    hypoglycemiaCount,
    passed,
  };
}

function protocolIdFromPhase(phase: string): ProtocolId {
  if (phase === "FASE_2") return "FASE_2";
  if (phase === "FASE_1") return "FASE_1";
  return "DIAGNOSTICO_7_DIAS";
}

export async function reviewCurrentProtocolWeekIfDue(params: {
  userId: string;
  now?: Date;
  force?: boolean;
  weekOffset?: number;
}) {
  const user = await prisma.userState.findUnique({ where: { id: params.userId } });
  if (!user) return null;

  const protocol = runProtocolModule({
    protocolId: protocolIdFromPhase(user.activePhase),
  });
  const config = protocol.structured.operational;
  const now = DateTime.fromJSDate(params.now ?? new Date())
    .setZone(config.readings.timezone)
    .minus({ weeks: params.weekOffset ?? 0 });

  if (
    !config.weeklyReview.enabled ||
    (!params.force && now.weekday !== 7)
  ) return null;

  const weekStart = now.startOf("week");
  const weekEnd = now.endOf("week");
  const readings = await prisma.reading.findMany({
    where: {
      userId: params.userId,
      createdAt: {
        gte: weekStart.toUTC().toJSDate(),
        lte: weekEnd.toUTC().toJSDate(),
      },
    },
    orderBy: { createdAt: "asc" },
  });
  const result = evaluateWeeklyReadings({ readings, config });

  await prisma.weeklyProtocolReview.upsert({
    where: {
      userId_phase_weekStart: {
        userId: params.userId,
        phase: user.activePhase,
        weekStart: weekStart.toUTC().toJSDate(),
      },
    },
    create: {
      userId: params.userId,
      protocol: user.activeProtocol,
      protocolVersion: user.protocolVersion,
      phase: user.activePhase,
      weekStart: weekStart.toUTC().toJSDate(),
      weekEnd: weekEnd.toUTC().toJSDate(),
      ...result,
    },
    update: {
      reviewedAt: new Date(),
      ...result,
    },
  });

  if (user.activePhase === "FASE_1") {
    const requiredWeeks =
      config.weeklyReview.consecutivePassingWeeksForAdvance ?? 2;
    const recent = await prisma.weeklyProtocolReview.findMany({
      where: { userId: params.userId, phase: "FASE_1" },
      orderBy: { weekStart: "desc" },
      take: requiredWeeks,
    });
    const consecutivePassing =
      recent.length === requiredWeeks &&
      recent.every((review) => review.passed) &&
      recent.every((review, index) => {
        if (index === recent.length - 1) return true;
        const current = DateTime.fromJSDate(review.weekStart);
        const previous = DateTime.fromJSDate(recent[index + 1].weekStart);
        return Math.round(current.diff(previous, "days").days) === 7;
      });
    const requiredReduction =
      config.weeklyReview.requiresMedicationReductionPercent ?? 50;
    const medicationCriterion =
      Boolean(user.medicationReductionConfirmedAt) &&
      user.medicationReductionPercent > requiredReduction;
    const eligible = consecutivePassing && medicationCriterion;

    await prisma.userState.update({
      where: { id: params.userId },
      data: {
        eligibleForNextProtocol: eligible,
        protocolReviewReason: eligible
          ? "Dos semanas favorables y reducción terapéutica superior a la mitad, confirmada."
          : !consecutivePassing
            ? "Aún se requieren dos semanas consecutivas favorables."
            : "Falta confirmar una reducción terapéutica superior a la mitad.",
        ...(eligible
          ? {
              activePhase: "FASE_2",
              activeProtocol: "FASE_2",
              protocolVersion: "1.0",
              protocolStartedAt: new Date(),
              eligibleForNextProtocol: false,
            }
          : {}),
      },
    });
  }

  return result;
}
