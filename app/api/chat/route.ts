// app/api/chat/route.ts
export const runtime = "nodejs";

import { prisma } from "@/app/lib/prisma";
import { getProgressMetrics, buildProgressContext } from "@/app/lib/aidaProgress";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";

import { detectAndSaveBaseline } from "@/app/lib/aidaBaseline";
import { buildAidaSystemPrompt } from "@/app/lib/aidaPrompt";
import {
  applySafetyBypass,
  detectMomentFromText,
  isConfirmation,
  applyClinicalDecisionEngine,
  type ClinicalState,
} from "@/app/lib/aidaRules";
import { applyNutritionRules } from "@/app/lib/aidaNutritionRules";
import { applyPhaseRules } from "@/app/lib/aidaPhaseRules";
import {
  buildDailySummary,
  buildTrialFinalReport,
} from "@/app/lib/aidaDailySummary";

import {
  ensureUserState,
  isTrialExpired,
  getTrialInfo,
  saveReading,
  getLastReading,
  getRecentReadings,
} from "@/app/lib/aidaMemory";

import { isLocal } from "@/app/lib/runtimeConfig";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type Body = {
  deviceId?: string;
  messages: ChatMessage[];
  onboarding?: any;
};

type Moment = "AYUNO" | "POSTCOMIDA" | "NOCHE" | "DESCONOCIDO";

const currentPhase = "FASE_1";
const MX_TZ = "America/Mexico_City";

// ✅ UI constants
const EDUCATIONAL_DISCLAIMER =
  "AIDA es un asistente educativo. No sustituye la valoración de un profesional de la salud. En caso de urgencias o síntomas severos: acude a atención médica.";

// ---------------- helpers ----------------

function loadPhase1Protocol() {
  const p = path.join(process.cwd(), "protocols", "fase1.json");
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw);
}

function getLocalDateISO(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function buildUI(userState?: any, opts?: { blocked?: boolean }) {
  const blocked = Boolean(opts?.blocked);

  // LOCAL (dev): no paywall, pero sí mostramos modo
  if (isLocal) {
    return {
      disclaimer: EDUCATIONAL_DISCLAIMER,
      mode: "LOCAL",
      modeLabel: "Modo: Desarrollo (Local)",
      daysLeft: null,
      daysRemaining: null,
      blocked: false,
      ctaText: null,
      ctaUrl: null,
    };
  }

  const status = (userState?.licenseStatus ?? "trial") as string;

  // Trial
  if (status === "trial") {
    const info = getTrialInfo(userState);
    const daysRemaining = info.daysRemaining ?? null;

    return {
      disclaimer: EDUCATIONAL_DISCLAIMER,
      mode: "TRIAL",
      modeLabel:
        daysRemaining != null
          ? `Modo: Prueba (${daysRemaining} día(s) restantes)`
          : "Modo: Prueba",
      // compat: lo viejo sigue existiendo
      daysLeft: daysRemaining,
      // nuevo
      daysRemaining,
      blocked: false,
      ctaText: "Activar versión completa",
      ctaUrl: process.env.AIDA_BILLING_URL ?? "/pago",
    };
  }

  // Expired
  if (status === "expired") {
    return {
      disclaimer: EDUCATIONAL_DISCLAIMER,
      mode: "EXPIRED",
      modeLabel: "Modo: Prueba finalizada",
      daysLeft: 0,
      daysRemaining: 0,
      blocked: true,
      ctaText: "Pagar 1 año",
      ctaUrl: process.env.AIDA_BILLING_URL ?? "/pago",
    };
  }

  // Active = Full (por ahora)
  if (status === "active") {
    return {
      disclaimer: EDUCATIONAL_DISCLAIMER,
      mode: "FULL",
      modeLabel: "Modo: Paquete completo",
      daysLeft: null,
      daysRemaining: null,
      blocked,
      ctaText: null,
      ctaUrl: null,
    };
  }

  // Future: maintenance
  if (status === "maintenance") {
    return {
      disclaimer: EDUCATIONAL_DISCLAIMER,
      mode: "MAINTENANCE",
      modeLabel: "Modo: Mantenimiento",
      daysLeft: null,
      daysRemaining: null,
      blocked,
      ctaText: "Administrar suscripción",
      ctaUrl: process.env.AIDA_BILLING_URL ?? "/pago",
    };
  }

  // Fallback
  return {
    disclaimer: EDUCATIONAL_DISCLAIMER,
    mode: status.toUpperCase(),
    modeLabel: `Modo: ${status}`,
    daysLeft: null,
    daysRemaining: null,
    blocked,
    ctaText: null,
    ctaUrl: null,
  };
}

function jsonOK(payload: any) {
  return NextResponse.json(payload);
}

function jsonERR(payload: any, status: number) {
  return NextResponse.json(payload, { status });
}

/**
 * ✅ IMPORTANTE:
 * - Si NO hay momento explícito en el mensaje actual, NO asumirlo.
 * - Si hay lectura numérica pero momento desconocido -> preguntar 1 vez.
 */
function buildSituationDirective(moment: Moment, confirmation: boolean, hasGlucoseNow: boolean) {
  if (confirmation) {
    return `El usuario confirmó que hará/ya hizo una acción. Responde como coach cercano. NO hagas preguntas en este turno.
Refuerza la acción + indica el siguiente micro-paso (cuándo medir o qué observar) y cierra con un cierre VARIADO sin pregunta.`;
  }

  if (!hasGlucoseNow) {
    return `El usuario NO dio una lectura numérica en este mensaje.
Responde breve, natural y útil.
Haz SOLO 1 pregunta para avanzar.`;
  }

  if (moment === "AYUNO") {
    return `Contexto: AYUNO (solo porque el usuario lo dijo explícitamente).
Responde como coach cercano con acción inmediata. No inventes momentos.`;
  }

  if (moment === "POSTCOMIDA") {
    return `Contexto: POSTCOMIDA (solo porque el usuario lo dijo explícitamente).
Responde como coach cercano con acción inmediata según reglas. No inventes momentos.`;
  }

  if (moment === "NOCHE") {
    return `Contexto: NOCHE (solo porque el usuario lo dijo explícitamente).
Acción ligera y cierre. No inventes momentos.`;
  }

  return `Hay lectura numérica PERO el usuario NO dijo el momento.
PROHIBIDO etiquetar como "ayuno" o "postcomida" aunque en memoria haya lecturas previas.
Haz SOLO 1 pregunta: "¿Fue en ayunas, 2h postcomida o antes de dormir?"`;
}

function extractGlucose(text: string): number | null {
  const matches = text.match(/\b(\d{2,3})\b/g);
  if (!matches) return null;
  const nums = matches.map(Number).filter((n) => n >= 40 && n <= 600);
  if (!nums.length) return null;
  return nums[nums.length - 1];
}

function extractSymptoms(text: string): string[] {
  const t = text.toLowerCase();
  const symptoms: string[] = [];

  if (/(maread|mareo|temblor|sudor|debil|debilidad|confus|desmayo|taquicardia|palpitaciones)/i.test(t))
    symptoms.push("low_symptoms");
  if (/(vomit|v[oó]mito|nausea|n[áa]usea)/i.test(t)) symptoms.push("vomiting");
  if (/(dolor\s+pecho|falta\s+de\s+aire|ahogo|dificultad\s+para\s+respirar)/i.test(t))
    symptoms.push("respiratory_or_chest");

  return symptoms;
}

function buildMemoryContext(params: {
  last?: any | null;
  recent?: any[];
  baseline?: { a1c?: number | null; avgGlucose?: number | null } | null;
}) {
  const { last, recent, baseline } = params;

  const baselineLine =
    baseline?.a1c || baseline?.avgGlucose
      ? `Baseline registrado: A1c=${baseline?.a1c ?? "N/D"} | Promedio=${baseline?.avgGlucose ?? "N/D"}`
      : "Baseline: no registrado.";

  const lastLine = last
    ? `Última lectura: ${last.glucose} mg/dL (${last.moment}) ${last.createdAt?.toString?.() ?? ""}`.trim()
    : "Última lectura: no hay.";

  const recentLines =
    recent?.length
      ? recent
          .slice(0, 6)
          .map((r) => `- ${r.glucose} (${r.moment}) ${r.createdAt?.toString?.() ?? ""}`.trim())
          .join("\n")
      : "- (sin lecturas recientes)";

  return `Memoria del usuario (NO inventar, usar solo esto):
${baselineLine}
${lastLine}
Lecturas recientes:
${recentLines}

Uso:
- Si la última lectura fue baja (<70), prioriza seguimiento de estabilización.
- NO asumas el momento si el usuario no lo dijo explícitamente en el mensaje actual.`;
}

// ---------------- route ----------------

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const messagesFromClient = body.messages;
    const onboarding = body.onboarding;

    if (!Array.isArray(messagesFromClient) || messagesFromClient.length === 0) {
      return jsonERR({ ok: false, error: "Historial de mensajes inválido" }, 400);
    }

    const userId = (body.deviceId ?? "").trim();
    if (!userId) {
      return jsonERR({ ok: false, error: "Falta deviceId" }, 400);
    }

    const lastUserMsg = [...messagesFromClient].reverse().find((m) => m.role === "user")?.content ?? "";

    if (lastUserMsg.length > 1000) {
      return jsonERR({ ok: false, error: "Mensaje demasiado largo" }, 400);
    }

    const historyPlain = messagesFromClient
      .filter((m) => m.role !== "system")
      .slice(-12)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    // ✅ Detectores DEL MENSAJE ACTUAL
    const glucoseNow = extractGlucose(lastUserMsg);
    const hasGlucoseNow = glucoseNow !== null;

    const confirmation = isConfirmation(lastUserMsg);
    const detected = (detectMomentFromText(lastUserMsg) ?? "DESCONOCIDO") as Moment;
    const moment: Moment =
      detected === "AYUNO" || detected === "POSTCOMIDA" || detected === "NOCHE" ? detected : "DESCONOCIDO";

    const symptoms = extractSymptoms(lastUserMsg);

    // 1) Bypass de seguridad
    const bypass = applySafetyBypass(lastUserMsg, historyPlain);
    if ((bypass as any)?.bypass) {
      // ✅ guardar lectura aunque haya bypass (sin paywall/limit)
      const us = await ensureUserState(userId);
      const ui = buildUI(us);

      if (glucoseNow !== null) {
        await saveReading({
          userId,
          glucose: glucoseNow,
          moment,
          symptoms,
        });

        // ✅ Persistir estado clínico si hubo hipo
        if (glucoseNow < 70) {
          await prisma.userState.update({
            where: { id: userId },
            data: { clinicalState: "HYPO_ACTIVE" },
          });
        } else if (us.clinicalState && glucoseNow >= 90) {
          await prisma.userState.update({
            where: { id: userId },
            data: { clinicalState: null },
          });
        }
      }

      return jsonOK({ ok: true, reply: (bypass as any).reply, bypass: true, ui });
    }

    // 2) Estado + Trial
    const userState = await ensureUserState(userId);
    const clinicalState = (userState.clinicalState ?? null) as ClinicalState;
    const uiBase = buildUI(userState);

    // 2.1) Intercept clínico determinístico (si NO hay glucosa ahora)
    if (glucoseNow === null && clinicalState === "HYPO_ACTIVE") {
      return jsonOK({
        ok: true,
        bypass: false,
        clinicalIntercept: true,
        reply:
          `Antes de continuar: hace rato tuviste una hipoglucemia.\n` +
          `1) ¿Ya tomaste 15 g de carbohidrato rápido?\n` +
          `2) ¿Ya te re-mediste? (dime el número)\n` +
          `Si tienes confusión, desmayo o te sientes peor: urgencias. 🚑`,
        ui: uiBase,
      });
    }

    if (glucoseNow === null && clinicalState === "RECOVERING_FROM_HYPO") {
      return jsonOK({
        ok: true,
        bypass: false,
        clinicalIntercept: true,
        reply:
          `Seguimos en recuperación de la baja.\n` +
          `Dime tu glucosa actual (número) para confirmar estabilidad.\n` +
          `Si sigues <90, mantenemos snack con proteína + grasa y re-checamos.`,
        ui: uiBase,
      });
    }

    // ✅ LOCAL: nunca paywall
    if (!isLocal && isTrialExpired(userState)) {
      const uiExpired = buildUI({ ...userState, licenseStatus: "expired" }, { blocked: true });

      return jsonERR(
        {
          ok: false,
          error: "TRIAL_EXPIRED",
          paywall: {
            title: "Tu prueba gratuita terminó",
            message:
              "Gracias por usar nuestra versión de prueba de AIDA. Para continuar usando la versión completa por 1 año realiza tu pago en el siguiente botón.",
            ctaText: "Pagar 1 año",
            ctaUrl: process.env.AIDA_BILLING_URL ?? "/pago",
          },
          ui: uiExpired,
        },
        402
      );
    }

    // 3) Rate limit SOLO trial (50/día, reinicia por dailyMsgDate)
    const todayLocal = getLocalDateISO(MX_TZ);
    const isTrial = isLocal ? false : userState.licenseStatus === "trial";

    const LIMIT_PER_DAY_TRIAL = 50;
    const currentCount = userState.dailyMsgDate === todayLocal ? (userState.dailyMsgCount ?? 0) : 0;

    if (isTrial && currentCount >= LIMIT_PER_DAY_TRIAL) {
      return jsonERR(
        {
          ok: false,
          error: "Límite diario alcanzado (50 mensajes en prueba). Intenta mañana o activa la versión completa.",
          ui: uiBase,
        },
        429
      );
    }

    const now = new Date();
    const nextCount = userState.dailyMsgDate === todayLocal ? currentCount + 1 : 1;

    await prisma.$transaction([
      prisma.userState.update({
        where: { id: userId },
        data: {
          dailyMsgDate: todayLocal,
          dailyMsgCount: nextCount,
          totalMsgCount: { increment: 1 },
          lastMsgAt: now,
        },
      }),
      prisma.usageDaily.upsert({
        where: { userId_dateLocal: { userId, dateLocal: todayLocal } },
        create: {
          userId,
          dateLocal: todayLocal,
          count: 1,
          licenseStatus: isTrial ? "trial" : "active",
        },
        update: {
          count: { increment: 1 },
          licenseStatus: isTrial ? "trial" : "active",
        },
      }),
    ]);

    // 4) Baseline
    const baselineResult = await detectAndSaveBaseline({ userId, text: lastUserMsg });

    // 4.5) Tomar previousGlucose ANTES de guardar nueva lectura
    const lastBeforeSave = glucoseNow !== null ? await getLastReading(userId) : null;
    const previousGlucose = lastBeforeSave?.glucose ?? null;

    // 5) Guardar lectura normal (si hay número)
    if (glucoseNow !== null) {
      await saveReading({
        userId,
        glucose: glucoseNow,
        moment,
        symptoms,
      });
    }

// 5.5) Reportes manuales
const wantsTrialFinalReport =
  /(reporte final|reporte trial|reporte de trial|reporte 7 d[ií]as|reporte final trial|cierre del trial|cierre de trial)/i.test(
    lastUserMsg
  );

if (wantsTrialFinalReport) {
  const report = await buildTrialFinalReport(userId);

  return jsonOK({
    ok: true,
    reply: report,
    bypass: false,
    trialFinalReport: true,
    ui: uiBase,
  });
}

const wantsSummary =
  /(resumen|resumen del d[ií]a|c[oó]mo voy|como voy|qu[eé] pas[oó] hoy|que paso hoy)/i.test(
    lastUserMsg
  );

if (wantsSummary) {
  const summary = await buildDailySummary(userId);

  return jsonOK({
    ok: true,
    reply: summary.text,
    bypass: false,
    dailySummary: true,
    ui: uiBase,
  });
}

    // ✅ 6) Motor clínico PRIMERO
    if (glucoseNow !== null) {
      const clinicalDecision = applyClinicalDecisionEngine({
        glucose: glucoseNow,
        moment,
        previousGlucose,
        symptoms,
        clinicalState,
      });

      if (clinicalDecision.handled) {
        await prisma.userState.update({
          where: { id: userId },
          data: { clinicalState: clinicalDecision.nextClinicalState },
        });

        return jsonOK({
          ok: true,
          reply: clinicalDecision.response,
          bypass: false,
          ui: uiBase,
        });
      }

      if (clinicalDecision.nextClinicalState !== clinicalState) {
        await prisma.userState.update({
          where: { id: userId },
          data: { clinicalState: clinicalDecision.nextClinicalState },
        });
      }
    }

    // Progress context
    const progressMetrics = await getProgressMetrics(userId);
    const progressContext = buildProgressContext(progressMetrics);

    // Reglas por fase
    const phaseRule = applyPhaseRules(lastUserMsg, currentPhase);
    if (phaseRule?.handled && phaseRule?.response) {
      return jsonOK({ ok: true, reply: phaseRule.response, bypass: false, ui: uiBase });
    }

    // Reglas nutricionales
    const ruleResult = applyNutritionRules(
      lastUserMsg,
      {
        moment,
        glucose: glucoseNow ?? undefined,
        symptoms,
      } as any
    );

    if (ruleResult?.handled && ruleResult?.response) {
      return jsonOK({ ok: true, reply: ruleResult.response, bypass: false, ui: uiBase });
    }

    // Memoria reciente (para prompt)
    const last = await getLastReading(userId);
    const recent = await getRecentReadings(userId, 6);

    const memoryContext = buildMemoryContext({
      last,
      recent,
      baseline: baselineResult?.saved
        ? { a1c: baselineResult.a1c ?? null, avgGlucose: baselineResult.avgGlucose ?? null }
        : null,
    });

    const protocol = loadPhase1Protocol();

    const systemPrompt = buildAidaSystemPrompt({
      phaseName: protocol.name ?? "Fase 1",
      phaseMinWeeks: 2,
    });

    const onboardingContext = onboarding
      ? `Datos base del usuario (onboarding):\n${JSON.stringify(onboarding)}`
      : "No hay datos de onboarding.";

    const protocolContext = `Reglas del protocolo actual (usar como referencia educativa, no repetir literal):\n${JSON.stringify(
      protocol
    )}`;

    const situationDirective = buildSituationDirective(moment, confirmation, hasGlucoseNow);

    const finalMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "system", content: memoryContext },
      { role: "system", content: progressContext },
      { role: "system", content: onboardingContext },
      { role: "system", content: protocolContext },
      { role: "system", content: situationDirective },
      ...messagesFromClient.filter((m) => m.role !== "system").slice(-20),
    ];

    const resp = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: finalMessages,
      temperature: 0.35,
    });

    const reply = resp.choices?.[0]?.message?.content ?? "No pude generar respuesta en este momento.";

    return jsonOK({ ok: true, reply, bypass: false, ui: uiBase });
  } catch (err: any) {
    console.error("API /api/chat ERROR:", err);
    return jsonERR({ ok: false, error: err?.message ?? "Error desconocido" }, 500);
  }
}