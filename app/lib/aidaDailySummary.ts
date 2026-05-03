// app/lib/aidaDailySummary.ts

import { prisma } from "@/app/lib/prisma";

const MX_TZ = "America/Mexico_City";

function getTodayLocalDate(): string {
  const now = new Date();
  const mx = new Date(
    now.toLocaleString("en-US", { timeZone: MX_TZ })
  );

  const yyyy = mx.getFullYear();
  const mm = String(mx.getMonth() + 1).padStart(2, "0");
  const dd = String(mx.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function getMxStartOfToday(): Date {
  const mxNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: MX_TZ })
  );

  mxNow.setHours(0, 0, 0, 0);
  return mxNow;
}

function formatDateMX(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00");

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;

  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function getTrendLabel(firstAvg: number, lastAvg: number): string {
  const diff = lastAvg - firstAvg;

  if (diff <= -15) {
    return `Mejoró: bajó aproximadamente ${Math.abs(diff)} mg/dL comparando el inicio con el cierre.`;
  }

  if (diff >= 15) {
    return `Subió: aumentó aproximadamente ${diff} mg/dL comparando el inicio con el cierre.`;
  }

  return "Se mantuvo relativamente estable durante el periodo.";
}

function getSignal(values: number[]): string {
  const hadHypo = values.some((v) => v < 70);
  const hadSevereHyper = values.some((v) => v >= 300);

  if (hadHypo) {
    return "Hubo hipoglucemia. Esto requiere más vigilancia y no conviene hacer cambios agresivos.";
  }

  if (hadSevereHyper) {
    return "Hubo picos altos importantes. Hay que reforzar hidratación, horarios, cena y seguimiento médico si se repiten.";
  }

  return "Sin eventos críticos registrados.";
}

function getHabitsThatWorked(readings: { glucose: number; moment: string | null }[]): string[] {
  const habits: string[] = [];

  const fasting = readings.filter((r) => r.moment === "AYUNO").map((r) => r.glucose);
  const postMeal = readings.filter((r) => r.moment === "POSTCOMIDA").map((r) => r.glucose);
  const night = readings.filter((r) => r.moment === "NOCHE").map((r) => r.glucose);

  if (fasting.length >= 2 && average(fasting) < 130) {
    habits.push("Las lecturas en ayuno muestran mejor control cuando se cuida la cena y el horario nocturno.");
  }

  if (postMeal.length >= 2 && average(postMeal) <= 160) {
    habits.push("Las lecturas 2h postcomida sugieren que algunos platos ya están funcionando mejor.");
  }

  if (night.length >= 2 && average(night) < 150) {
    habits.push("Las lecturas antes de dormir ayudan a detectar si la noche está quedando más estable.");
  }

  if (habits.length === 0) {
    habits.push("El hábito principal que funcionó fue registrar lecturas: eso permite detectar patrones reales y no trabajar a ciegas.");
  }

  return habits;
}

export async function buildDailySummary(userId: string) {
  const today = getTodayLocalDate();

  const user = await prisma.userState.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return { alreadySent: false, text: "No encontré tu perfil." };
  }

  // Bloqueo: solo 1 resumen por día
  if (user.dailySummaryDate === today) {
    return {
      alreadySent: true,
      text: "Ya te entregué tu resumen hoy. Si registras otra lectura lo actualizamos.",
    };
  }

  const start = getMxStartOfToday();

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  const readings = await prisma.reading.findMany({
    where: {
      userId,
      createdAt: {
        gte: start,
        lte: end,
      },
    },
  });

  if (readings.length === 0) {
    return {
      alreadySent: false,
      text:
        "Hoy no registramos lecturas. Si me mandas una (ayuno o 2h post), te hago tu resumen.",
    };
  }

  const values = readings.map((r) => r.glucose);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = average(values);
  const signal = getSignal(values);

  const formatted = formatDateMX(today);

  const text = `Resumen de hoy (${formatted}):
• Lecturas: ${values.length} | Promedio: ${avg} mg/dL (min ${min} / máx ${max})
• Señal: ${signal}
• Micro-paso mañana: manda tu primera lectura en ayuno antes de comer.`;

  await prisma.userState.update({
    where: { id: userId },
    data: {
      dailySummaryDate: today,
      dailySummaryCount: (user.dailySummaryCount ?? 0) + 1,
    },
  });

  return { alreadySent: false, text };
}

export async function buildTrialFinalReport(userId: string) {
  const user = await prisma.userState.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return "No encontré tu perfil para generar el reporte final.";
  }

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 7);

  const readings = await prisma.reading.findMany({
    where: {
      userId,
      createdAt: {
        gte: start,
        lte: end,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (readings.length === 0) {
    return `Reporte final del Trial 7D:
No tengo lecturas suficientes para calcular tu avance.

Lo más importante ahora:
• Registrar glucosa en ayuno.
• Registrar glucosa 2h después de comer.
• Identificar qué cenas elevan tu glucosa al día siguiente.

Para avanzar al programa Full, necesitamos más datos y acompañamiento constante.`;
  }

  const values = readings.map((r) => r.glucose);
  const avg7d = average(values);
  const min = Math.min(...values);
  const max = Math.max(...values);

  const midpoint = Math.ceil(readings.length / 2);
  const firstHalf = readings.slice(0, midpoint).map((r) => r.glucose);
  const secondHalf = readings.slice(midpoint).map((r) => r.glucose);

  const firstAvg = average(firstHalf);
  const lastAvg = secondHalf.length > 0 ? average(secondHalf) : firstAvg;

  const trend = getTrendLabel(firstAvg, lastAvg);
  const signal = getSignal(values);
  const habits = getHabitsThatWorked(readings);

  const fasting = readings.filter((r) => r.moment === "AYUNO").map((r) => r.glucose);
  const postMeal = readings.filter((r) => r.moment === "POSTCOMIDA").map((r) => r.glucose);

  const fastingAvg = fasting.length > 0 ? average(fasting) : null;
  const postMealAvg = postMeal.length > 0 ? average(postMeal) : null;

  const fastingLine =
    fastingAvg !== null
      ? `• Promedio en ayuno: ${fastingAvg} mg/dL`
      : "• Promedio en ayuno: sin suficientes registros";

  const postMealLine =
    postMealAvg !== null
      ? `• Promedio 2h postcomida: ${postMealAvg} mg/dL`
      : "• Promedio 2h postcomida: sin suficientes registros";

  const habitsText = habits.map((h) => `• ${h}`).join("\n");

  return `Reporte final del Trial 7D:
• Lecturas registradas: ${values.length}
• Promedio general: ${avg7d} mg/dL
• Rango: ${min} a ${max} mg/dL
${fastingLine}
${postMealLine}

Tendencia:
• ${trend}

Señal clínica:
• ${signal}

Hábitos que funcionaron:
${habitsText}

Siguiente paso:
Este trial nos ayuda a ver patrones, pero el cambio real necesita continuidad. En el programa Full trabajamos 12 semanas para estabilizar ayuno, mejorar respuesta postcomida, ajustar hábitos y preparar una mejora medible en glicosilada.

Asistente educativo, no sustituye consulta médica.`;
}