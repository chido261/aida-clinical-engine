// app/lib/aidaProgress.ts
import { prisma } from "@/app/lib/prisma";

/**
 * Resumen clínico cuantitativo para AIDA (últimos 14 días / últimas 14 lecturas).
 * - Promedio 7 y 14
 * - Tendencia (avgLast7 vs avgPrev7)
 * - Variabilidad (SD 14)
 * - Rangos y porcentajes >180, >250, <70
 * - Estimación de A1c (a partir del promedio)
 */

export type TrendLabel = "BAJANDO" | "ESTABLE" | "SUBIENDO" | "INSUFICIENTE";

export type ProgressMetrics = {
  hasBaseline: boolean;
  baselineAvgGlucose?: number | null;
  baselineA1c?: number | null;
  baselineSetAt?: Date | null;

  n14: number;
  n7: number;
  nPrev7: number;

  avg14?: number;
  avgLast7?: number;
  avgPrev7?: number;

  trendMgDl?: number; // avgLast7 - avgPrev7 (negativo = mejora)
  trendLabel: TrendLabel;

  sd14?: number;
  min14?: number;
  max14?: number;

  pctOver180?: number;
  pctOver250?: number;
  pctUnder70?: number;

  a1cEstFromAvg14?: number; // (avg + 46.7)/28.7
  a1cEstFromAvg7?: number;

  deltaVsBaselineMgDl?: number; // avg14 - baselineAvgGlucose
  deltaVsBaselinePct?: number; // % relativo
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round0(n: number) {
  return Math.round(n);
}

function mean(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = xs.reduce((a, b) => a + b, 0);
  return s / xs.length;
}

function stdDevSample(xs: number[]): number | undefined {
  // SD muestral (n-1). Si n < 2, no aplica.
  if (xs.length < 2) return undefined;
  const m = mean(xs)!;
  const variance =
    xs.reduce((acc, x) => acc + Math.pow(x - m, 2), 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

function pct(count: number, total: number): number | undefined {
  if (!total) return undefined;
  return (count / total) * 100;
}

function a1cFromAvgGlucose(avg: number): number {
  // A1c ≈ (avg + 46.7) / 28.7
  return (avg + 46.7) / 28.7;
}

function trendLabelFromDelta(delta: number | undefined): TrendLabel {
  if (delta === undefined) return "INSUFICIENTE";
  if (delta <= -10) return "BAJANDO";
  if (delta >= 10) return "SUBIENDO";
  return "ESTABLE";
}

/**
 * Obtiene métricas con Prisma usando UserState + últimas lecturas.
 * Usa el prisma singleton (app/lib/prisma.ts)
 */
export async function getProgressMetrics(userId: string): Promise<ProgressMetrics> {
  const userState = await prisma.userState.findUnique({
    where: { id: userId },
    select: {
      baselineAvgGlucose: true,
      baselineA1c: true,
      baselineSetAt: true,
    },
  });

  const hasBaseline = !!userState?.baselineSetAt;

  const last14 = await prisma.reading.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 14,
    select: { glucose: true, createdAt: true },
  });

  const values14 = last14
  .map((r: { glucose: number }) => r.glucose)
  .filter((g: number): g is number => typeof g === "number");

  // Last7 = las 7 más recientes; Prev7 = las 7 anteriores (dentro de 14)
  const last7 = values14.slice(0, 7);
  const prev7 = values14.slice(7, 14);

  const avg14 = mean(values14);
  const avgLast7 = mean(last7);
  const avgPrev7 = mean(prev7);

  const trendMgDl =
    avgLast7 !== undefined && avgPrev7 !== undefined
      ? avgLast7 - avgPrev7
      : undefined;

  const sd14 = stdDevSample(values14);
  const min14 = values14.length ? Math.min(...values14) : undefined;
  const max14 = values14.length ? Math.max(...values14) : undefined;

  const over180 = values14.filter((v) => v > 180).length;
  const over250 = values14.filter((v) => v > 250).length;
  const under70 = values14.filter((v) => v < 70).length;

  const pctOver180 = pct(over180, values14.length);
  const pctOver250 = pct(over250, values14.length);
  const pctUnder70 = pct(under70, values14.length);

  const a1cEstFromAvg14 = avg14 !== undefined ? a1cFromAvgGlucose(avg14) : undefined;
  const a1cEstFromAvg7 = avgLast7 !== undefined ? a1cFromAvgGlucose(avgLast7) : undefined;

  const baselineAvgGlucose = userState?.baselineAvgGlucose ?? null;

  const deltaVsBaselineMgDl =
    baselineAvgGlucose !== null && avg14 !== undefined
      ? avg14 - baselineAvgGlucose
      : undefined;

  const deltaVsBaselinePct =
    baselineAvgGlucose !== null && avg14 !== undefined && baselineAvgGlucose !== 0
      ? ((avg14 - baselineAvgGlucose) / baselineAvgGlucose) * 100
      : undefined;

  return {
    hasBaseline,
    baselineAvgGlucose,
    baselineA1c: userState?.baselineA1c ?? null,
    baselineSetAt: userState?.baselineSetAt ?? null,

    n14: values14.length,
    n7: last7.length,
    nPrev7: prev7.length,

    avg14: avg14 !== undefined ? round1(avg14) : undefined,
    avgLast7: avgLast7 !== undefined ? round1(avgLast7) : undefined,
    avgPrev7: avgPrev7 !== undefined ? round1(avgPrev7) : undefined,

    trendMgDl: trendMgDl !== undefined ? round1(trendMgDl) : undefined,
    trendLabel: trendLabelFromDelta(trendMgDl),

    sd14: sd14 !== undefined ? round1(sd14) : undefined,
    min14,
    max14,

    pctOver180: pctOver180 !== undefined ? round1(pctOver180) : undefined,
    pctOver250: pctOver250 !== undefined ? round1(pctOver250) : undefined,
    pctUnder70: pctUnder70 !== undefined ? round1(pctUnder70) : undefined,

    a1cEstFromAvg14: a1cEstFromAvg14 !== undefined ? round1(a1cEstFromAvg14) : undefined,
    a1cEstFromAvg7: a1cEstFromAvg7 !== undefined ? round1(a1cEstFromAvg7) : undefined,

    deltaVsBaselineMgDl:
      deltaVsBaselineMgDl !== undefined ? round1(deltaVsBaselineMgDl) : undefined,
    deltaVsBaselinePct:
      deltaVsBaselinePct !== undefined ? round1(deltaVsBaselinePct) : undefined,
  };
}

/**
 * Convierte métricas a texto corto para system prompt (para que el modelo responda cuantitativo).
 * Esto NO sustituye reglas; solo alimenta contexto.
 */
export function buildProgressContext(m: ProgressMetrics): string {
  // Si no hay datos suficientes, devolvemos algo minimalista.
  if (!m.n14) return "PROGRESO: Aún no hay lecturas registradas para estimar promedios.";
  if (!m.hasBaseline) {
    return [
      `PROGRESO (sin baseline):`,
      `- Lecturas (14): ${m.n14}`,
      m.avgLast7 !== undefined ? `- Promedio 7: ${round0(m.avgLast7)} mg/dL` : `- Promedio 7: N/D`,
      m.avg14 !== undefined ? `- Promedio 14: ${round0(m.avg14)} mg/dL` : `- Promedio 14: N/D`,
      m.sd14 !== undefined
        ? `- Variabilidad SD14: ${round0(m.sd14)} (más bajo = más estable)`
        : `- Variabilidad SD14: N/D`,
      m.trendMgDl !== undefined
        ? `- Tendencia 7vs7: ${m.trendLabel} (${round0(m.trendMgDl)} mg/dL)`
        : `- Tendencia 7vs7: INSUFICIENTE`,
    ].join("\n");
  }

  return [
    `PROGRESO (con baseline):`,
    `- Baseline promedio: ${m.baselineAvgGlucose ?? "N/D"} mg/dL`,
    `- Lecturas (14): ${m.n14}`,
    m.avgLast7 !== undefined ? `- Promedio 7: ${round0(m.avgLast7)} mg/dL` : `- Promedio 7: N/D`,
    m.avg14 !== undefined ? `- Promedio 14: ${round0(m.avg14)} mg/dL` : `- Promedio 14: N/D`,
    m.deltaVsBaselineMgDl !== undefined
      ? `- Cambio vs baseline: ${m.deltaVsBaselineMgDl > 0 ? "+" : ""}${round0(m.deltaVsBaselineMgDl)} mg/dL (${
          m.deltaVsBaselinePct !== undefined
            ? `${m.deltaVsBaselinePct > 0 ? "+" : ""}${round1(m.deltaVsBaselinePct)}%`
            : "N/D"
        })`
      : `- Cambio vs baseline: N/D`,
    m.trendMgDl !== undefined
      ? `- Tendencia 7vs7: ${m.trendLabel} (${m.trendMgDl > 0 ? "+" : ""}${round0(m.trendMgDl)} mg/dL)`
      : `- Tendencia 7vs7: INSUFICIENTE`,
    m.sd14 !== undefined
      ? `- Variabilidad SD14: ${round0(m.sd14)} (más bajo = más estable)`
      : `- Variabilidad SD14: N/D`,
    `- % >180: ${m.pctOver180 !== undefined ? `${round1(m.pctOver180)}%` : "N/D"} | % >250: ${
      m.pctOver250 !== undefined ? `${round1(m.pctOver250)}%` : "N/D"
    } | % <70: ${m.pctUnder70 !== undefined ? `${round1(m.pctUnder70)}%` : "N/D"}`,
    `- A1c est. (14): ${m.a1cEstFromAvg14 !== undefined ? m.a1cEstFromAvg14 : "N/D"} | A1c est. (7): ${
      m.a1cEstFromAvg7 !== undefined ? m.a1cEstFromAvg7 : "N/D"
    }`,
  ].join("\n");
}