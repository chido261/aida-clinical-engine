// app/lib/aidaBaseline.ts
import { prisma } from "@/app/lib/prisma";

function extractA1c(text: string): number | null {
  const t = text.toLowerCase();

  // Acepta: "glicosilada es 7.0", "glicosilada fue de 7.0", "A1c salió 7.0", "A1c=7.0", "A1c: 7.0%"
  const m = t.match(
    /(a1c|glicosilada)\s*(?:es|est[aá]|fue|sal[ií]o|result[oó]|tengo)?\s*(?:de|:|=)?\s*(\d{1,2}(?:[.,]\d)?)\s*%?/i
  );

  if (!m) return null;

  const val = Number(m[2].replace(",", "."));
  if (!Number.isFinite(val) || val < 4 || val > 20) return null;
  return val;
}

function extractAvgGlucose(text: string): number | null {
  const t = text.toLowerCase();
  const m =
    t.match(/promedio\s*(?:arriba\s*de\s*)?(\d{2,3})/i) ||
    t.match(/media\s*(?:arriba\s*de\s*)?(\d{2,3})/i);
  if (!m) return null;
  const val = Number(m[1]);
  if (!Number.isFinite(val) || val < 40 || val > 600) return null;
  return val;
}

export async function detectAndSaveBaseline(params: { userId: string; text: string }) {
  const { userId, text } = params;

  const a1c = extractA1c(text);
  const avgGlucose = extractAvgGlucose(text);

  if (a1c == null && avgGlucose == null) {
    return { saved: false as const, a1c: null, avgGlucose: null };
  }

  await prisma.userState.upsert({
    where: { id: userId },
    update: {
      baselineA1c: a1c ?? undefined,
      baselineAvgGlucose: avgGlucose ?? undefined,
      baselineSetAt: new Date(),
    },
    create: {
      id: userId,
      baselineA1c: a1c ?? undefined,
      baselineAvgGlucose: avgGlucose ?? undefined,
      baselineSetAt: new Date(),
    },
  });

  return { saved: true as const, a1c, avgGlucose };
}

export async function getBaseline(userId: string): Promise<{
  a1c: number | null;
  avgGlucose: number | null;
  setAt: Date | null;
}> {
  const st = await prisma.userState.findUnique({
    where: { id: userId },
    select: { baselineA1c: true, baselineAvgGlucose: true, baselineSetAt: true },
  });

  return {
    a1c: st?.baselineA1c ?? null,
    avgGlucose: st?.baselineAvgGlucose ?? null,
    setAt: st?.baselineSetAt ?? null,
  };
}