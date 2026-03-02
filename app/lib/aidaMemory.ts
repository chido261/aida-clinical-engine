import { prisma } from "@/app/lib/prisma";
import { isLocal } from "@/app/lib/runtimeConfig";

/**
 * Guarda una lectura de glucosa si existe
 */
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

/**
 * Obtiene la última lectura registrada
 */
export async function getLastReading(userId: string) {
  return prisma.reading.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Obtiene las últimas N lecturas para contexto
 */
export async function getRecentReadings(userId: string, limit = 5) {
  return prisma.reading.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

const TRIAL_HOURS = 48;

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Garantiza que exista el estado del usuario
 * - LOCAL: fuerza "active" (sin expiración)
 * - CLOUD: aplica trial 48h y expira si corresponde
 */
export async function ensureUserState(userId: string) {
  const existing = await prisma.userState.findUnique({
    where: { id: userId },
  });

  const now = new Date();

  // ✅ MODO LOCAL: siempre activo (para desarrollo)
  if (isLocal) {
    if (!existing) {
      return prisma.userState.create({
        data: {
          id: userId,
          trialStartedAt: now,
          trialEndsAt: addHours(now, TRIAL_HOURS),
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

  // 🌩️ MODO CLOUD: trial real
  // 1) No existe -> crear con trial
  if (!existing) {
    return prisma.userState.create({
      data: {
        id: userId,
        trialStartedAt: now,
        trialEndsAt: addHours(now, TRIAL_HOURS),
        licenseStatus: "trial",
      },
    });
  }

  // 2) Si está active, no tocar
  if (existing.licenseStatus === "active") return existing;

  // 3) Existe pero sin trial -> inicializar
  if (!existing.trialStartedAt || !existing.trialEndsAt) {
    return prisma.userState.update({
      where: { id: userId },
      data: {
        trialStartedAt: now,
        trialEndsAt: addHours(now, TRIAL_HOURS),
        licenseStatus: "trial",
      },
    });
  }

  // 4) Si expiró -> marcar expired
  const endsAt = new Date(existing.trialEndsAt);
  if (now > endsAt && existing.licenseStatus !== "expired") {
    return prisma.userState.update({
      where: { id: userId },
      data: { licenseStatus: "expired" },
    });
  }

  return existing;
}

/**
 * Helper para checar si el usuario está bloqueado por trial
 * - LOCAL: nunca bloquea
 * - CLOUD: bloquea si expired o si ya pasó trialEndsAt
 */
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