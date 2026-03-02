// app/lib/aidaDailySummary.ts

import { prisma } from "@/app/lib/prisma";

function getTodayLocalDate(): string {
  const now = new Date();
  const mx = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Mexico_City" })
  );
  const yyyy = mx.getFullYear();
  const mm = String(mx.getMonth() + 1).padStart(2, "0");
  const dd = String(mx.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateMX(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00");
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
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

  const start = new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Mexico_City",
    })
  );
  start.setHours(0, 0, 0, 0);

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
  const avg =
    Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  let signal = "Sin eventos relevantes.";
  const hadHypo = values.some((v) => v < 70);
  const hadSevereHyper = values.some((v) => v >= 300);

  if (hadHypo) {
    signal = "Hubo hipoglucemia hoy. Bien que la detectaste.";
  } else if (hadSevereHyper) {
    signal = "Hubo un pico alto importante. Mañana lo vigilamos.";
  }

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