import { prisma } from "@/app/lib/prisma";

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

/**
 * Garantiza que exista el estado del usuario
 */
export async function ensureUserState(userId: string) {
  const existing = await prisma.userState.findUnique({
    where: { id: userId },
  });

  if (existing) return existing;

  return prisma.userState.create({
    data: { id: userId },
  });
}
