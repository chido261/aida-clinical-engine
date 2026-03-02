import { prisma } from "@/app/lib/prisma";
import { isLocal } from "@/app/lib/runtimeConfig";

/* =========================================
   CONFIGURACIÓN TRIAL
========================================= */

const TRIAL_DAYS = 7;
export const DAILY_LIMIT_TRIAL = 50;

/* =========================================
   HELPERS
========================================= */

function addDays(date: Date, days: number) {
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

/* =========================================
   ESTADO USUARIO + TRIAL 7D
========================================= */

export async function ensureUserState(userId: string) {
  const existing = await prisma.userState.findUnique({
    where: { id: userId },
  });

  const now = new Date();

  // 🔧 LOCAL → siempre activo
  if (isLocal) {
    if (!existing) {
      return prisma.userState.create({
        data: {
          id: userId,
          trialStartedAt: now,
          trialEndsAt: addDays(now, TRIAL_DAYS),
          licenseStatus: "active",
        },
      });
    }

    if (existing.licenseStatus !== "active") {
      return prisma.userState.update({
        where: { id: userId },
        data: { licenseStatus: "active" },
      });
    }

    return existing;
  }

  // 🌩️ CLOUD

  // 1) No existe → crear trial 7D
  if (!existing) {
    return prisma.userState.create({
      data: {
        id: userId,
        trialStartedAt: now,
        trialEndsAt: addDays(now, TRIAL_DAYS),
        licenseStatus: "trial",
      },
    });
  }

  // 2) Active → no tocar
  if (existing.licenseStatus === "active") return existing;

  // 3) Si no tiene fechas → inicializar
  if (!existing.trialStartedAt || !existing.trialEndsAt) {
    return prisma.userState.update({
      where: { id: userId },
      data: {
        trialStartedAt: now,
        trialEndsAt: addDays(now, TRIAL_DAYS),
        licenseStatus: "trial",
      },
    });
  }

  // 4) Expiración automática
  const endsAt = new Date(existing.trialEndsAt);
  if (now > endsAt && existing.licenseStatus !== "expired") {
    return prisma.userState.update({
      where: { id: userId },
      data: { licenseStatus: "expired" },
    });
  }

  return existing;
}

/* =========================================
   TRIAL INFO (día actual + días restantes)
========================================= */

export function getTrialInfo(userState: {
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  licenseStatus: string;
}) {
  if (isLocal || userState.licenseStatus === "active") {
    return {
      isTrial: false,
      isExpired: false,
      dayNumber: null,
      daysLeft: null,
    };
  }

  if (!userState.trialStartedAt || !userState.trialEndsAt) {
    return {
      isTrial: false,
      isExpired: false,
      dayNumber: null,
      daysLeft: null,
    };
  }

  const now = new Date();
  const start = new Date(userState.trialStartedAt);
  const end = new Date(userState.trialEndsAt);

  const diffMs = now.getTime() - start.getTime();
  const dayNumber = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  const daysLeft = Math.max(
    0,
    Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  return {
    isTrial: userState.licenseStatus === "trial",
    isExpired: now > end || userState.licenseStatus === "expired",
    dayNumber,
    daysLeft,
  };
}

/* =========================================
   VALIDACIÓN EXPIRACIÓN
========================================= */

export function isTrialExpired(userState: {
  licenseStatus: string;
  trialEndsAt: Date | null;
}) {
  if (isLocal) return false;

  if (userState.licenseStatus === "active") return false;
  if (userState.licenseStatus === "expired") return true;

  if (!userState.trialEndsAt) return false;

  const now = new Date();
  return now > new Date(userState.trialEndsAt);
}