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
import { applySafetyBypass, detectMomentFromText, isConfirmation } from "@/app/lib/aidaRules";
import { applyNutritionRules } from "@/app/lib/aidaNutritionRules";
import { applyPhaseRules } from "@/app/lib/aidaPhaseRules";

import { ensureUserState, saveReading, getLastReading, getRecentReadings } from "@/app/lib/aidaMemory";

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

// ---------------- helpers ----------------

function loadPhase1Protocol() {
  const p = path.join(process.cwd(), "protocols", "fase1.json");
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw);
}

/**
 * ✅ FIX: Solo preguntar "ayuno/post/noche" si el usuario dio lectura numérica EN ESTE MENSAJE.
 */
function buildSituationDirective(moment: Moment, confirmation: boolean, hasGlucoseNow: boolean) {
  if (confirmation) {
    return `El usuario confirmó que hará/ya hizo una acción. Responde como coach cercano. NO hagas preguntas en este turno.
Refuerza la acción + indica el siguiente micro-paso (cuándo medir o qué observar) y cierra con un cierre VARIADO sin pregunta.`;
  }

  if (moment === "AYUNO") {
    return `Contexto: AYUNO. Responde como coach cercano.
Si el usuario pidió acción inmediata ("ahorita/para desayunar"), responde con acción y/o 3 opciones sin preguntar permiso.
Evita preguntas innecesarias.`;
  }

  if (moment === "POSTCOMIDA") {
    return `Contexto: 2H POSTCOMIDA. Responde como coach cercano.
Da 1 acción simple (caminar/agua/respirar) y cierre breve.
Si falta info, SOLO 1 pregunta.`;
  }

  if (moment === "NOCHE") {
    return `Contexto: NOCHE. Responde como coach cercano.
Recomienda hábito de cierre y descanso.
Si falta info, SOLO 1 pregunta.`;
  }

  // ✅ Si NO hubo lectura numérica, NO forzar "ayuno/post/noche"
  if (!hasGlucoseNow) {
    return `El usuario NO dio una lectura numérica en este mensaje.
Responde breve, natural y útil.
1) Saluda (si aplica) y ofrece 1 camino:
2) Haz SOLO 1 pregunta: "Estoy a tus órdenes, ¿dime como te puedo ayuda?"`;
  }

  // ✅ Si SÍ hubo lectura pero no está claro el momento
  return `Contexto no claro PERO hay lectura numérica.
Pregunta SOLO 1 cosa: "¿Fue en ayuno, 2h postcomida o antes de dormir?"`;
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

  if (/(maread|mareo|temblor|sudor|debil|debilidad|confus|desmayo)/i.test(t)) symptoms.push("low_symptoms");
  if (/(vomit|v[oó]mito|nausea|n[áa]usea)/i.test(t)) symptoms.push("vomiting");
  if (/(dolor\s+pecho|falta\s+de\s+aire|ahogo|dificultad\s+para\s+respirar)/i.test(t)) symptoms.push("respiratory_or_chest");

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

Uso: si hay mejora vs histórico, menciónala breve ("hace X lecturas estabas más alto...").`;
}

// ---------------- route ----------------

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const messagesFromClient = body.messages;
    const onboarding = body.onboarding;

    if (!Array.isArray(messagesFromClient) || messagesFromClient.length === 0) {
      return NextResponse.json({ ok: false, error: "Historial de mensajes inválido" }, { status: 400 });
    }

    // ✅ userId real por dispositivo
    const userId = (body.deviceId ?? "").trim();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Falta deviceId" }, { status: 400 });
    }

    const lastUserMsg = [...messagesFromClient].reverse().find((m) => m.role === "user")?.content ?? "";

    const historyPlain = messagesFromClient
      .filter((m) => m.role !== "system")
      .slice(-12)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    // ✅ 1) Bypass de seguridad
    const bypass = applySafetyBypass(lastUserMsg, historyPlain);
    if (bypass?.bypass) {
      return NextResponse.json({ ok: true, reply: bypass.reply, bypass: true });
    }

    // ✅ 2) Garantiza UserState
    await ensureUserState(userId);

    // ✅ 3) Detectar + guardar baseline (A1c / promedio) si viene en el texto
    const baselineResult = await detectAndSaveBaseline({
      userId,
      text: lastUserMsg,
    });

    // ✅ 4) Momento + confirmación
    const confirmation = isConfirmation(lastUserMsg);
    const detected = (detectMomentFromText(lastUserMsg) ?? "DESCONOCIDO") as Moment;
    const moment: Moment =
      detected === "AYUNO" || detected === "POSTCOMIDA" || detected === "NOCHE" ? detected : "DESCONOCIDO";

    // ✅ 5) Extraer glucosa SOLO del mensaje actual
    const glucoseNow = extractGlucose(lastUserMsg);
    const hasGlucoseNow = glucoseNow !== null;

    const symptoms = extractSymptoms(lastUserMsg);

    // ✅ 6) Guardar lectura solo si el usuario dio número AHORITA
    if (glucoseNow !== null) {
      await saveReading({
        userId,
        glucose: glucoseNow,
        moment,
        symptoms,
      });
    }

    // ✅ Progress context
    const progressMetrics = await getProgressMetrics(prisma, userId);
    const progressContext = buildProgressContext(progressMetrics);

    // ✅ 7) Motor de reglas por fase (intercepta primero)
    const phaseRule = applyPhaseRules(lastUserMsg, currentPhase);
    if (phaseRule?.handled && phaseRule?.response) {
      return NextResponse.json({ ok: true, reply: phaseRule.response, bypass: false });
    }

    // ✅ 8) Motor nutricional (intercepta después)
    const ruleResult = applyNutritionRules(lastUserMsg, {
      moment,
      glucose: glucoseNow,
      symptoms,
    } as any);

    if (ruleResult?.handled && ruleResult?.response) {
      return NextResponse.json({ ok: true, reply: ruleResult.response, bypass: false });
    }

    // ✅ 9) Cargar memoria reciente
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

    return NextResponse.json({ ok: true, reply, bypass: false });
  } catch (err: any) {
    console.error("API /api/chat ERROR:", err);
    return NextResponse.json({ ok: false, error: err?.message ?? "Error desconocido" }, { status: 500 });
  }
}