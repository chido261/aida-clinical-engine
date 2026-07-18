// app/api/chat2/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/app/lib/prisma";
import { ensureUserState, saveReading } from "@/app/lib/aidaMemory";
import { buildAida2WorkPlan } from "@/app/lib/aida2/brain";
import { runAida2Modules } from "@/app/lib/aida2/moduleRunner";
import {
  runProtocolModule,
  type ProtocolId,
} from "@/app/lib/aida2/modules/protocolModule";
import { interpretFoodSemantics } from "@/app/lib/aida2/modules/semanticFoodInterpreter";
import { resolveUnknownFoodKnowledge } from "@/app/lib/aida2/modules/foodKnowledgeResolver";
import { buildCulinaryPlan } from "@/app/lib/aida2/modules/culinaryPlanner";
import { buildAida2ConversationStrategy } from "@/app/lib/aida2/conversationStrategy";
import { buildAida2ComposerPrompt } from "@/app/lib/aida2/responseComposer";
import {
  buildAida2MemoryPrompt,
  buildConversationStateFromMemory,
  loadAida2ContextMemory,
  updateAida2ContextMemoryAfterResponse,
} from "@/app/lib/aida2/contextMemory";
import { reviewCurrentProtocolWeekIfDue } from "@/app/lib/aida2/weeklyProtocolReview";
import { enforceAida2StructuredDecision } from "@/app/lib/aida2/responseGuard";
import type { SemanticFoodInterpretation } from "@/app/lib/aida2/modules/foodDecisionTypes";
import { auditTaskGraphCoverage, understandTurnWithBrain } from "@/app/lib/aida2/turnCognition";
import { verifyTurnContract } from "@/app/lib/aida2/turnContract";
import { executeMultiTaskGraph } from "@/app/lib/aida2/multiTaskExecutor";

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

function normalizeFood(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/^(?:el|la|los|las|un|una)\s+/, "").trim();
}

function buildFastProtocolInterpretation(params: {
  message: string;
  target: string | null;
  preparationStyle?: string | null;
  protocol: ReturnType<typeof runProtocolModule>;
}): SemanticFoodInterpretation | null {
  const { message, target, preparationStyle, protocol } = params;
  if (!target) return null;
  const normalizedTarget = normalizeFood(target);
  const knownFoods = Object.values(protocol.structured.allowedFoods).flat()
    .map(normalizeFood);
  const appearsDirectlyInProtocol = knownFoods.some(food =>
    food === normalizedTarget || food.endsWith(` de ${normalizedTarget}`)
  );
  if (!appearsDirectlyInProtocol) return null;
  return {
    originalText: message,
    dishName: preparationStyle ? `${preparationStyle} de ${target}` : target,
    semanticType: preparationStyle ? "plant_based_substitute" : "literal_food",
    baseIngredients: [target],
    declaredIngredients: [],
    styleReferences: preparationStyle ? [preparationStyle] : [],
    isCommercialProduct: false,
    requiresClarification: false,
    clarificationReason: null,
    confidence: 1,
    source: "semantic_fallback",
  };
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

function inferReadingSlotFromMessage(message: string) {
  if (/\b(ayunas|en ayunas|despert[eé]|despertar|antes de desayunar)\b/i.test(message)) {
    return "AYUNO";
  }

  const isAfter = /\b(postcomida|post comida|despu[eé]s de|2\s*h|2\s*horas|dos horas)\b/i.test(message);
  const isBefore = /\b(antes de|previo a|precomida)\b/i.test(message);

  if (/\b(desayuno|desayunar)\b/i.test(message)) {
    return isAfter ? "POST_DESAYUNO" : "AYUNO";
  }

  if (/\b(cena|cenar)\b/i.test(message)) {
    return isAfter ? "POST_CENA" : isBefore ? "PRE_CENA" : null;
  }

  if (/\b(comida|comer|almuerzo|almorzar)\b/i.test(message)) {
    return isAfter ? "POST_COMIDA" : isBefore ? "PRE_COMIDA" : null;
  }

  return null;
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
  const readingSlot = inferReadingSlotFromMessage(userMessage);
  const classification = classifyReadingEvent(glucose);

  const reading = await saveReading({
    userId,
    glucose,
    moment,
    symptoms: [],
    eventType: classification.eventType,
    nutritionGoal: classification.nutritionGoal,
    readingSlot,
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

    const access = await ensureUserState(userId);

    if (!access.onboardingDoneAt) {
      return NextResponse.json(
        {
          ok: false,
          error: "onboarding_required",
          onboardingRequired: true,
          message: "Completa tu formulario inicial antes de conversar con AIDA.",
        },
        { status: 428 }
      );
    }

    if (access.licenseStatus === "expired") {
      return NextResponse.json(
        {
          ok: false,
          error: "plan_expired",
          activationRequired: true,
          message:
            "Tu prueba de 7 días terminó. Activa la versión completa para continuar con la Fase 1.",
        },
        { status: 403 }
      );
    }

    let memory = await loadAida2ContextMemory({ userId });

    await persistNameIfMissing({
      userId,
      userMessage: lastUserMessage,
    });

    const savedReading = await persistGlucoseReadingFromChat2({
      userId,
      userMessage: lastUserMessage,
    });

    const weeklyReview = await reviewCurrentProtocolWeekIfDue({ userId });

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

    let turnCognition = await understandTurnWithBrain({
      openai,
      message: lastUserMessage,
      recentHistory,
      culinaryMemory: memory.metadata.activeCulinaryPlan,
    });
    const taskGraphAudit = await auditTaskGraphCoverage({
      openai,
      message: lastUserMessage,
      cognition: turnCognition,
      culinaryMemory: memory.metadata.activeCulinaryPlan,
    });
    turnCognition = taskGraphAudit.cognition;

    const workPlan = buildAida2WorkPlan({
      userId,
      message: lastUserMessage,
      history,
      conversationState,
      turnCognition,
    });

    const protocolId = resolveProtocolId(
      memory.userState.activePhase,
      memory.userState.activeProtocol
    );

    const protocol = runProtocolModule({ protocolId });

    const multiTaskResult = await executeMultiTaskGraph({
      openai,
      cognition: turnCognition,
      protocol,
    });
    if (taskGraphAudit.audited && !taskGraphAudit.complete) {
      return NextResponse.json({
        ok: true,
        reply: "Identifiqué varias solicitudes, pero todavía no pude comprobar que todas estén representadas. Prefiero no darte una respuesta parcial; inténtalo nuevamente para reconstruir el plan completo.",
        aida2: true,
        userId,
        turnCognition,
        taskGraphAudit,
      });
    }
    if (multiTaskResult.handled) {
      const moduleResults = runAida2Modules({
        workPlan,
        history,
        userMessage: lastUserMessage,
        protocolId,
        semanticInterpretation: null,
      });
      if (moduleResults.meal && multiTaskResult.primaryCulinaryPlan) {
        moduleResults.meal.culinaryPlan = multiTaskResult.primaryCulinaryPlan;
      }
      const reply = multiTaskResult.valid
        ? multiTaskResult.reply
        : `No completé correctamente todas tus solicitudes: ${multiTaskResult.violations.join(" ")}`;
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
        savedReading,
        weeklyReview,
        workPlan,
        modules: moduleResults,
        turnCognition,
        multiTaskResult,
        taskGraphAudit,
      });
    }

    const fastProtocolInterpretation = buildFastProtocolInterpretation({
            message: lastUserMessage,
            target: turnCognition.foodTarget,
            preparationStyle: turnCognition.preparationStyle,
            protocol,
          });

    const initialSemanticInterpretation = workPlan.foodContext.isFoodRelated
      ? fastProtocolInterpretation ?? await interpretFoodSemantics({
          openai,
          userMessage: lastUserMessage,
          protocol,
          conversationHistory: workPlan.turnDirective.requiresHistory ? recentHistory : undefined,
        })
      : null;

    const knowledgeResolution = initialSemanticInterpretation
      ? await resolveUnknownFoodKnowledge({
          openai,
          userMessage: lastUserMessage,
          interpretation: initialSemanticInterpretation,
        })
      : null;
    const semanticInterpretation =
      knowledgeResolution?.interpretation ?? initialSemanticInterpretation;

    const moduleResults = runAida2Modules({
      workPlan,
      history,
      userMessage: lastUserMessage,
      protocolId,
      semanticInterpretation,
    });

    const culinaryPlan = semanticInterpretation && workPlan.turnDirective.allowsCulinaryPlan
      ? await buildCulinaryPlan({
          openai,
          userMessage: lastUserMessage,
          interpretation: semanticInterpretation,
          protocol,
          conversationHistory: workPlan.turnDirective.requiresHistory ? recentHistory : undefined,
          turnDirective: workPlan.turnDirective,
          turnCognition,
          culinaryMemory: memory.metadata.activeCulinaryPlan,
        })
      : null;
    if (moduleResults.meal && culinaryPlan?.requested) {
      moduleResults.meal.culinaryPlan = culinaryPlan;
    }

    const turnContract = verifyTurnContract({
      cognition: turnCognition,
      culinaryPlan,
      culinaryMemory: memory.metadata.activeCulinaryPlan,
    });
    if (!turnContract.valid && culinaryPlan?.requested) {
      culinaryPlan.recipes = [];
      culinaryPlan.error = `No completé correctamente la solicitud: ${turnContract.violations.join(" ")}`;
    }

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
      semanticInterpretation,
    });

    // El plan culinario ya contiene una respuesta estructurada y verificada.
    // Evitamos una llamada adicional que sólo sería descartada por el guard.
    const hasDirectStructuredFoodAnswer =
      workPlan.turnDirective.dialogueAct === "VALIDATE_FOOD" &&
      Boolean(moduleResults.meal?.decision.foods.length);
    const modelReply = culinaryPlan?.requested || hasDirectStructuredFoodAnswer
      ? ""
      : (await openai.chat.completions.create({
          model: "gpt-4.1-mini",
          temperature: 0.25,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.filter((m) => m.role !== "system").slice(-8),
          ],
        })).choices[0]?.message?.content ??
        "No pude generar una respuesta en este momento.";

    const reply = enforceAida2StructuredDecision({
      reply: modelReply,
      mealModule: moduleResults.meal,
    });

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
            readingSlot: savedReading.readingSlot,
          }
        : null,
      weeklyReview,
      workPlan,
      modules: moduleResults,
      conversationStrategy,
      semanticInterpretation,
      knowledgeResolution: knowledgeResolution?.knowledge ?? null,
      culinaryPlan,
      turnCognition,
      taskGraphAudit,
      turnContract,
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
