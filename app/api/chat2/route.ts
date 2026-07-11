// app/api/chat2/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/app/lib/prisma";
import { saveReading } from "@/app/lib/aidaMemory";
import { buildAida2WorkPlan } from "@/app/lib/aida2/brain";
import { runAida2Modules } from "@/app/lib/aida2/moduleRunner";
import type { ProtocolId } from "@/app/lib/aida2/modules/protocolModule";
import { buildAida2ConversationStrategy } from "@/app/lib/aida2/conversationStrategy";
import { buildAida2ComposerPrompt } from "@/app/lib/aida2/responseComposer";
import {
  buildAida2MemoryPrompt,
  buildConversationStateFromMemory,
  loadAida2ContextMemory,
  updateAida2ContextMemoryAfterResponse,
} from "@/app/lib/aida2/contextMemory";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type Body = {
  deviceId?: string;
  messages?: ChatMessage[];
};

function getLastUserMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
}

function buildHistory(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role !== "system")
    .slice(-8)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
}

function resolveUserId(body: Body) {
  const deviceId = body.deviceId?.trim();

  if (deviceId) return deviceId;

  return "chat2-local";
}

function resolveProtocolId(
  activePhase: string | null | undefined,
  activeProtocol: string | null | undefined
): ProtocolId {
  const normalizedPhase = (activePhase ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (
    normalizedPhase === "DIAGNOSTICO" ||
    normalizedPhase === "DIAGNOSTICO_7_DIAS"
  ) {
    return "DIAGNOSTICO_7_DIAS";
  }

  if (normalizedPhase === "FASE_2" || normalizedPhase === "FASE2") {
    return "FASE_2";
  }

  if (normalizedPhase === "FASE_1" || normalizedPhase === "FASE1") {
    return "FASE_1";
  }

  const normalizedProtocol = (activeProtocol ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (normalizedProtocol === "FASE_2") {
    return "FASE_2";
  }

  if (normalizedProtocol === "FASE_1") {
    return "FASE_1";
  }

  return "DIAGNOSTICO_7_DIAS";
}

function extractNameFromMessage(message: string) {
  const text = message.trim();

  const patterns = [
    /\bsoy\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)(?:\s|,|\.|$)/,
    /\bme llamo\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)(?:\s|,|\.|$)/,
    /\bmi nombre es\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)(?:\s|,|\.|$)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

async function persistNameIfMissing(params: {
  userId: string;
  userMessage: string;
}) {
  const { userId, userMessage } = params;
  const detectedName = extractNameFromMessage(userMessage);

  if (!detectedName) return;

  const userState = await prisma.userState.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  if (userState?.name?.trim()) return;

  await prisma.userState.update({
    where: { id: userId },
    data: {
      name: detectedName,
    },
  });
}

function messageLooksLikeGlucoseReport(message: string) {
  return /\b(glucosa|az[uú]car|glucemia|mg\/dl|mgdl|mg)\b/i.test(message);
}

function extractGlucoseFromMessage(message: string) {
  if (!messageLooksLikeGlucoseReport(message)) return null;

  const matches = message.match(/\b(\d{2,3})\b/g);

  if (!matches) return null;

  const values = matches
    .map(Number)
    .filter((value) => value >= 40 && value <= 600);

  if (!values.length) return null;

  return values[values.length - 1];
}

function inferReadingMomentFromMessage(message: string) {
  if (/\b(ayunas|en ayunas|despert[eé]|despertar|antes de desayunar)\b/i.test(message)) {
    return "AYUNO";
  }

  if (/\b(postcomida|post comida|despu[eé]s de comer|2\s*h|2\s*horas|dos horas)\b/i.test(message)) {
    return "POSTCOMIDA";
  }

  if (/\b(antes de comer|previo a comer|precomida)\b/i.test(message)) {
    return "ANTES_COMER";
  }

  if (/\b(noche|antes de dormir|dormir)\b/i.test(message)) {
    return "NOCHE";
  }

  return "DESCONOCIDO";
}

function classifyReadingEvent(glucose: number) {
  if (glucose < 70) {
    return {
      clinicalState: "HYPO_ACTIVE",
      eventType: "HYPOGLYCEMIA",
      nutritionGoal: "RAISE_GLUCOSE",
      pendingFollowUpType: "HYPO_RECHECK_15MIN",
      lastRecommendation:
        "Aplicar protocolo 15-15 y volver a medir glucosa en 15 minutos.",
    };
  }

  if (glucose >= 180) {
    return {
      clinicalState: "POSTMEAL_ELEVATED",
      eventType: "POSTMEAL_ELEVATED",
      nutritionGoal: "LOWER_GLUCOSE",
      pendingFollowUpType: "POSTMEAL_PLATE_REVIEW",
      lastRecommendation:
        "Revisar momento de medición, alimentos recientes y dar seguimiento a la próxima medición.",
    };
  }

  return {
    clinicalState: "STABLE",
    eventType: "STABLE_READING",
    nutritionGoal: "MAINTAIN_GLUCOSE",
    pendingFollowUpType: null,
    lastRecommendation:
      "Mantener seguimiento de glucosa y observar respuesta a alimentos.",
  };
}

async function persistGlucoseReadingFromChat2(params: {
  userId: string;
  userMessage: string;
}) {
  const { userId, userMessage } = params;

  const glucose = extractGlucoseFromMessage(userMessage);

  if (!glucose) return null;

  const moment = inferReadingMomentFromMessage(userMessage);
  const classification = classifyReadingEvent(glucose);

  const reading = await saveReading({
    userId,
    glucose,
    moment,
    symptoms: [],
    eventType: classification.eventType,
    nutritionGoal: classification.nutritionGoal,
  });

  await prisma.userState.update({
    where: { id: userId },
    data: {
      clinicalState: classification.clinicalState,
      lastEventType: classification.eventType,
      lastEventAt: new Date(),
      pendingFollowUpType: classification.pendingFollowUpType,
      pendingFollowUpAt: classification.pendingFollowUpType ? new Date() : null,
      lastRecommendation: classification.lastRecommendation,
      currentNutritionGoal: classification.nutritionGoal,
    },
  });

  return reading;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (!messages.length) {
      return NextResponse.json(
        { ok: false, error: "Historial de mensajes inválido" },
        { status: 400 }
      );
    }

    const lastUserMessage = getLastUserMessage(messages);

    if (!lastUserMessage.trim()) {
      return NextResponse.json(
        { ok: false, error: "Mensaje vacío" },
        { status: 400 }
      );
    }

    const userId = resolveUserId(body);

    let memory = await loadAida2ContextMemory({ userId });

    await persistNameIfMissing({
      userId,
      userMessage: lastUserMessage,
    });

    const savedReading = await persistGlucoseReadingFromChat2({
      userId,
      userMessage: lastUserMessage,
    });

    memory = await loadAida2ContextMemory({ userId });

    const recentHistory = buildHistory(messages);
    const memoryPrompt = buildAida2MemoryPrompt(memory);
    const history = [
      memoryPrompt,
      "",
      "HISTORIAL RECIENTE DE LA CONVERSACIÓN:",
      recentHistory || "Sin historial reciente.",
    ].join("\n");

    const conversationState = buildConversationStateFromMemory(memory);

    const workPlan = buildAida2WorkPlan({
      userId,
      message: lastUserMessage,
      history,
      conversationState,
    });

    const protocolId = resolveProtocolId(
      memory.userState.activePhase,
      memory.userState.activeProtocol
    );

    const moduleResults = runAida2Modules({
      workPlan,
      history,
      userMessage: lastUserMessage,
      protocolId,
    });

    const conversationStrategy = buildAida2ConversationStrategy({
      workPlan,
      moduleResults,
      userMessage: lastUserMessage,
    });

    const systemPrompt = buildAida2ComposerPrompt({
      workPlan,
      history,
      userMessage: lastUserMessage,
      contextModule: moduleResults.context,
      mealModule: moduleResults.meal,
      conversationStrategy,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.25,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.filter((m) => m.role !== "system").slice(-8),
      ],
    });

    const reply =
      response.choices[0]?.message?.content ??
      "No pude generar una respuesta en este momento.";

    await updateAida2ContextMemoryAfterResponse({
      userId,
      userMessage: lastUserMessage,
      assistantReply: reply,
      workPlan,
      moduleResults,
    });

    return NextResponse.json({
      ok: true,
      reply,
      aida2: true,
      userId,
      savedReading: savedReading
        ? {
            glucose: savedReading.glucose,
            moment: savedReading.moment,
            createdAt: savedReading.createdAt,
          }
        : null,
      workPlan,
      modules: moduleResults,
      conversationStrategy,
    });
  } catch (error: unknown) {
    console.error("API /api/chat2 ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}