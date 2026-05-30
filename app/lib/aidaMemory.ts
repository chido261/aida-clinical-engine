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
}) {
  const { userId, glucose, moment, symptoms } = params;

  return prisma.reading.create({
    data: {
      userId,
      glucose,
      moment,
      symptoms: symptoms?.length ? symptoms.join(",") : null,
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
   USER STATE + WINDOWS
========================================= */

type LicenseStatus = "trial" | "active" | "maintenance" | "expired";

function normalizeStatus(s?: string | null): LicenseStatus {
  if (s === "active" || s === "maintenance" || s === "expired" || s === "trial") return s;
  return "trial";
}

/**
 * Regla:
 * - LOCAL normal: siempre active, sin paywall.
 * - LOCAL con AIDA_LICENSE_TEST_MODE=true: se comporta como nube para probar trial/expired/full.
 * - CLOUD:
 *   - si no existe: crear trial 7d.
 *   - si active: validar ventana FULL 90d.
 *   - si maintenance: validar ventana maintenance.
 *   - si trial: si venció => expired.
 *
 * Nota:
 * maintenance y active son estados que normalmente se asignan al pagar.
 * Aquí solo hacemos creación y expiración automática consistente.
 */
export async function ensureUserState(userId: string) {
  const existing = await prisma.userState.findUnique({ where: { id: userId } });
  const now = new Date();

  // 🔧 LOCAL normal -> siempre activo
  // 🧪 LOCAL con AIDA_LICENSE_TEST_MODE=true -> se comporta como nube
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

  // 🌩️ CLOUD o 🧪 LOCAL TEST MODE

  // 1) No existe -> Trial 7d
  if (!existing) {
    return prisma.userState.create({
      data: {
        id: userId,
        trialStartedAt: now,
        trialEndsAt: addDaysExact(now, TRIAL_DAYS),
        licenseStatus: "trial",
      },
    });
  }

  const status = normalizeStatus(existing.licenseStatus);

  // 2) Completar fechas faltantes según status
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

  // 3) Expiración automática exacta
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

  // Expired: no tocar
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
   EXPIRATION CHECK (used by /api/chat)
========================================= */

export function isTrialExpired(userState: { licenseStatus: string; trialEndsAt: Date | null }) {
  if (shouldBypassLicense) return false;

  const status = normalizeStatus(userState.licenseStatus);
  if (status === "active" || status === "maintenance") return false;
  if (status === "expired") return true;

  if (!userState.trialEndsAt) return false;
  return Date.now() >= userState.trialEndsAt.getTime();
}

/**
 * Expired lock logic (retención):
 * - Si expired: mantenemos datos 7 días.
 * - Luego, en otro sprint, podemos borrar user + readings.
 * - Aquí solo devolvemos si todavía está en ventana de retención.
 */
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