import { prisma } from "@/app/lib/prisma";
import { shouldBypassLicense } from "@/app/lib/runtimeConfig";
import { DateTime } from "luxon";

/* =========================================
   CONFIG
========================================= */

const MX_TZ = "America/Mexico_City";

// Trial
export const TRIAL_DAYS = 7;
export const DAILY_LIMIT_TRIAL = 50;

// Full
export const FULL_DAYS = 90;

// Maintenance
export const MAINTENANCE_DAYS = 30;

// Retención al expirar maintenance
export const RETENTION_DAYS_AFTER_EXPIRED = 7;

/* =========================================
   TIME HELPERS (MX)
========================================= */

function nowMx() {
  return DateTime.now().setZone(MX_TZ);
}

function addDaysExact(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/* =========================================
   LECTURAS
========================================= */

export async function saveReading(params: {
  userId: string;
  glucose: number;
  moment: string;
  symptoms?: string[];
  eventType?: string | null;
  nutritionGoal?: string | null;
  relatedMealId?: number | null;
  readingSlot?: string | null;
}) {
  const {
    userId,
    glucose,
    moment,
    symptoms,
    eventType,
    nutritionGoal,
    relatedMealId,
  } = params;

  return prisma.reading.create({
    data: {
      userId,
      glucose,
      moment,
      symptoms: symptoms?.length ? symptoms.join(",") : null,
      eventType: eventType ?? null,
      nutritionGoal: nutritionGoal ?? null,
      relatedMealId: relatedMealId ?? null,
      readingSlot: params.readingSlot ?? null,
    },
  });
}

export async function getLastReading(userId: string) {
  return prisma.reading.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getRecentReadings(userId: string, limit = 5) {
  return prisma.reading.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function updateLastReadingMoment(params: {
  userId: string;
  moment: string;
}) {
  const { userId, moment } = params;

  const last = await getLastReading(userId);

  if (!last) return null;

  return prisma.reading.update({
    where: { id: last.id },
    data: { moment },
  });
}

/* =========================================
   COMIDAS
========================================= */

export async function saveMealLog(params: {
  userId: string;
  rawText: string;
  mealMoment?: string | null;
  detectedFoods?: string[] | null;
  protocolAllowedFoods?: string[] | null;
  protocolExcludedFoods?: string[] | null;
  activeProtocol?: string | null;
  activePhase?: string | null;
  protocolCompliant?: boolean | null;
  nutritionGoal?: string | null;
  relatedReadingId?: number | null;
  advisorNote?: string | null;
}) {
  return prisma.mealLog.create({
    data: {
      userId: params.userId,
      rawText: params.rawText,
      mealMoment: params.mealMoment ?? "DESCONOCIDO",
      detectedFoods: params.detectedFoods?.length
        ? params.detectedFoods.join(",")
        : null,
      protocolAllowedFoods: params.protocolAllowedFoods?.length
        ? params.protocolAllowedFoods.join(",")
        : null,
      protocolExcludedFoods: params.protocolExcludedFoods?.length
        ? params.protocolExcludedFoods.join(",")
        : null,
      activeProtocol: params.activeProtocol ?? "PROTOCOL_1",
      activePhase: params.activePhase ?? "FASE_1",
      protocolCompliant: params.protocolCompliant ?? null,
      nutritionGoal: params.nutritionGoal ?? null,
      relatedReadingId: params.relatedReadingId ?? null,
      advisorNote: params.advisorNote ?? null,
    },
  });
}

export async function getLastMealLog(userId: string) {
  return prisma.mealLog.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

/* =========================================
   EVENTOS CLÍNICOS
========================================= */

export async function openClinicalEvent(params: {
  userId: string;
  type: string;
  glucoseAtOpen?: number | null;
  moment?: string | null;
  nutritionGoal?: string | null;
  pendingFollowUpType?: string | null;
  lastRecommendation?: string | null;
}) {
  return prisma.clinicalEvent.create({
    data: {
      userId: params.userId,
      type: params.type,
      status: "OPEN",
      glucoseAtOpen: params.glucoseAtOpen ?? null,
      moment: params.moment ?? null,
      nutritionGoal: params.nutritionGoal ?? null,
      pendingFollowUpType: params.pendingFollowUpType ?? null,
      lastRecommendation: params.lastRecommendation ?? null,
    },
  });
}

export async function closeLastClinicalEvent(params: {
  userId: string;
  type?: string | null;
  glucoseAtClose?: number | null;
  resolutionNote?: string | null;
}) {
  const lastEvent = await prisma.clinicalEvent.findFirst({
    where: {
      userId: params.userId,
      status: "OPEN",
      ...(params.type ? { type: params.type } : {}),
    },
    orderBy: { openedAt: "desc" },
  });

  if (!lastEvent) return null;

  return prisma.clinicalEvent.update({
    where: { id: lastEvent.id },
    data: {
      status: "RESOLVED",
      closedAt: new Date(),
      glucoseAtClose: params.glucoseAtClose ?? null,
      resolutionNote: params.resolutionNote ?? null,
    },
  });
}

export async function getLastOpenClinicalEvent(userId: string) {
  return prisma.clinicalEvent.findFirst({
    where: {
      userId,
      status: "OPEN",
    },
    orderBy: { openedAt: "desc" },
  });
}

/* =========================================
   PROTOCOLO
========================================= */

export async function ensureProtocolProgress(params: {
  userId: string;
  protocol?: string;
  phase?: string;
}) {
  const protocol = params.protocol ?? "PROTOCOL_1";
  const phase = params.phase ?? "FASE_1";

  const current = await prisma.protocolProgress.findFirst({
    where: {
      userId: params.userId,
      protocol,
      phase,
      status: "ACTIVE",
    },
    orderBy: { startedAt: "desc" },
  });

  if (current) return current;

  return prisma.protocolProgress.create({
    data: {
      userId: params.userId,
      protocol,
      phase,
      status: "ACTIVE",
    },
  });
}

export async function updateProtocolProgressCounters(params: {
  userId: string;
  protocol?: string;
  phase?: string;
  stableDaysCount?: number;
  postMealInRangeCount?: number;
  fastingInRangeCount?: number;
  hypoEventsCount?: number;
  highEventsCount?: number;
  eligibleForNextProtocol?: boolean;
  reviewReason?: string | null;
}) {
  const progress = await ensureProtocolProgress({
    userId: params.userId,
    protocol: params.protocol,
    phase: params.phase,
  });

  return prisma.protocolProgress.update({
    where: { id: progress.id },
    data: {
      stableDaysCount:
        params.stableDaysCount !== undefined
          ? params.stableDaysCount
          : progress.stableDaysCount,
      postMealInRangeCount:
        params.postMealInRangeCount !== undefined
          ? params.postMealInRangeCount
          : progress.postMealInRangeCount,
      fastingInRangeCount:
        params.fastingInRangeCount !== undefined
          ? params.fastingInRangeCount
          : progress.fastingInRangeCount,
      hypoEventsCount:
        params.hypoEventsCount !== undefined
          ? params.hypoEventsCount
          : progress.hypoEventsCount,
      highEventsCount:
        params.highEventsCount !== undefined
          ? params.highEventsCount
          : progress.highEventsCount,
      eligibleForNextProtocol:
        params.eligibleForNextProtocol !== undefined
          ? params.eligibleForNextProtocol
          : progress.eligibleForNextProtocol,
      reviewReason:
        params.reviewReason !== undefined
          ? params.reviewReason
          : progress.reviewReason,
    },
  });
}

/* =========================================
   USER STATE + WINDOWS
========================================= */

type LicenseStatus = "trial" | "active" | "maintenance" | "expired";

function normalizeStatus(s?: string | null): LicenseStatus {
  if (s === "active" || s === "maintenance" || s === "expired" || s === "trial") return s;
  return "trial";
}

export async function ensureUserState(userId: string) {
  const existing = await prisma.userState.findUnique({ where: { id: userId } });
  const now = new Date();

  if (shouldBypassLicense) {
    if (!existing) {
      return prisma.userState.create({
        data: {
          id: userId,
          trialStartedAt: now,
          trialEndsAt: addDaysExact(now, TRIAL_DAYS),
          licenseStatus: "active",
          fullStartedAt: now,
          fullEndsAt: addDaysExact(now, FULL_DAYS),
          activeProtocol: "DIAGNOSTICO_7_DIAS",
          activePhase: "DIAGNOSTICO",
          protocolStartedAt: now,
        },
      });
    }

    if (normalizeStatus(existing.licenseStatus) !== "active") {
      return prisma.userState.update({
        where: { id: userId },
        data: { licenseStatus: "active" },
      });
    }

    return existing;
  }

  if (!existing) {
    return prisma.userState.create({
      data: {
        id: userId,
        trialStartedAt: now,
        trialEndsAt: addDaysExact(now, TRIAL_DAYS),
        licenseStatus: "trial",
        activeProtocol: "DIAGNOSTICO_7_DIAS",
        activePhase: "DIAGNOSTICO",
        protocolStartedAt: now,
      },
    });
  }

  const status = normalizeStatus(existing.licenseStatus);

  if (status === "trial" && (!existing.trialStartedAt || !existing.trialEndsAt)) {
    return prisma.userState.update({
      where: { id: userId },
      data: {
        trialStartedAt: now,
        trialEndsAt: addDaysExact(now, TRIAL_DAYS),
        licenseStatus: "trial",
      },
    });
  }

  if (status === "active" && (!existing.fullStartedAt || !existing.fullEndsAt)) {
    return prisma.userState.update({
      where: { id: userId },
      data: {
        fullStartedAt: now,
        fullEndsAt: addDaysExact(now, FULL_DAYS),
        licenseStatus: "active",
      },
    });
  }

  if (status === "maintenance" && (!existing.fullStartedAt || !existing.fullEndsAt)) {
    return prisma.userState.update({
      where: { id: userId },
      data: {
        fullStartedAt: now,
        fullEndsAt: addDaysExact(now, MAINTENANCE_DAYS),
        licenseStatus: "maintenance",
      },
    });
  }

  const nowMs = now.getTime();

  if (status === "trial") {
    if (existing.trialEndsAt && nowMs >= existing.trialEndsAt.getTime()) {
      return prisma.userState.update({
        where: { id: userId },
        data: { licenseStatus: "expired" },
      });
    }

    return existing;
  }

  if (status === "active" && existing.fullEndsAt) {
    if (nowMs >= existing.fullEndsAt.getTime()) {
      return prisma.userState.update({
        where: { id: userId },
        data: { licenseStatus: "expired" },
      });
    }

    return existing;
  }

  if (status === "maintenance" && existing.fullEndsAt) {
    if (nowMs >= existing.fullEndsAt.getTime()) {
      return prisma.userState.update({
        where: { id: userId },
        data: { licenseStatus: "expired" },
      });
    }

    return existing;
  }

  return existing;
}

/* =========================================
   TRIAL INFO (MX_TZ)
========================================= */

export function getTrialInfo(userState: {
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  licenseStatus: string;
}) {
  if (shouldBypassLicense) {
    return {
      isTrial: false,
      isExpired: false,
      dayNumber: null as number | null,
      daysRemaining: null as number | null,
    };
  }

  const status = normalizeStatus(userState.licenseStatus);

  if (status !== "trial") {
    return {
      isTrial: false,
      isExpired: status === "expired",
      dayNumber: null as number | null,
      daysRemaining: null as number | null,
    };
  }

  if (!userState.trialStartedAt || !userState.trialEndsAt) {
    return {
      isTrial: true,
      isExpired: false,
      dayNumber: null as number | null,
      daysRemaining: null as number | null,
    };
  }

  const now = nowMx();
  const start = DateTime.fromJSDate(userState.trialStartedAt).setZone(MX_TZ);
  const end = DateTime.fromJSDate(userState.trialEndsAt).setZone(MX_TZ);

  const isExpired = now.toMillis() >= end.toMillis();

  const startDay = start.startOf("day");
  const nowDay = now.startOf("day");
  const dayNumber = Math.max(1, Math.floor(nowDay.diff(startDay, "days").days) + 1);

  let daysRemaining = 0;
  if (!isExpired) {
    const diffDays = end.diff(now, "days").days;
    daysRemaining = Math.max(1, Math.ceil(diffDays));
  }

  return { isTrial: true, isExpired, dayNumber, daysRemaining };
}

/* =========================================
   GENERIC WINDOW INFO (FULL/MAINTENANCE)
========================================= */

export function getWindowInfo(userState: {
  licenseStatus: string;
  fullStartedAt: Date | null;
  fullEndsAt: Date | null;
}) {
  if (shouldBypassLicense) {
    return {
      mode: "LOCAL" as const,
      dayNumber: null as number | null,
      daysRemaining: null as number | null,
      endsAt: null as Date | null,
    };
  }

  const status = normalizeStatus(userState.licenseStatus);

  if (status !== "active" && status !== "maintenance") {
    return {
      mode: status === "trial" ? ("TRIAL" as const) : ("EXPIRED" as const),
      dayNumber: null as number | null,
      daysRemaining: null as number | null,
      endsAt: null as Date | null,
    };
  }

  if (!userState.fullStartedAt || !userState.fullEndsAt) {
    return {
      mode: status === "active" ? ("FULL" as const) : ("MAINTENANCE" as const),
      dayNumber: null as number | null,
      daysRemaining: null as number | null,
      endsAt: null as Date | null,
    };
  }

  const now = nowMx();
  const start = DateTime.fromJSDate(userState.fullStartedAt).setZone(MX_TZ);
  const end = DateTime.fromJSDate(userState.fullEndsAt).setZone(MX_TZ);

  const startDay = start.startOf("day");
  const nowDay = now.startOf("day");
  const dayNumber = Math.max(1, Math.floor(nowDay.diff(startDay, "days").days) + 1);

  let daysRemaining = 0;
  if (now.toMillis() < end.toMillis()) {
    const diffDays = end.diff(now, "days").days;
    daysRemaining = Math.max(1, Math.ceil(diffDays));
  }

  return {
    mode: status === "active" ? ("FULL" as const) : ("MAINTENANCE" as const),
    dayNumber,
    daysRemaining,
    endsAt: userState.fullEndsAt,
  };
}

/* =========================================
   EXPIRATION CHECK
========================================= */

export function isTrialExpired(userState: { licenseStatus: string; trialEndsAt: Date | null }) {
  if (shouldBypassLicense) return false;

  const status = normalizeStatus(userState.licenseStatus);
  if (status === "active" || status === "maintenance") return false;
  if (status === "expired") return true;

  if (!userState.trialEndsAt) return false;
  return Date.now() >= userState.trialEndsAt.getTime();
}

export function getExpiredRetentionInfo(userState: {
  licenseStatus: string;
  updatedAt: Date;
}) {
  const status = normalizeStatus(userState.licenseStatus);

  if (status !== "expired") {
    return { isExpired: false, retentionDaysLeft: null as number | null };
  }

  const now = nowMx();
  const updated = DateTime.fromJSDate(userState.updatedAt).setZone(MX_TZ);
  const expiresRetentionAt = updated.plus({ days: RETENTION_DAYS_AFTER_EXPIRED });

  const diffDays = expiresRetentionAt.diff(now, "days").days;
  const retentionDaysLeft = Math.max(0, Math.ceil(diffDays));

  return { isExpired: true, retentionDaysLeft };
}
