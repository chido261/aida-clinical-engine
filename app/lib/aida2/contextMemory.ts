// app/lib/aida2/contextMemory.ts

import { prisma } from "@/app/lib/prisma";
import {
  runProtocolModule,
  type ProtocolId,
} from "@/app/lib/aida2/modules/protocolModule";
import type { Aida2WorkPlan } from "@/app/lib/aida2/brain";
import type { Aida2ModuleResults } from "@/app/lib/aida2/moduleRunner";
import type {
  Aida2ConversationState,
  Aida2FoodDecision,
  Aida2MealType,
  Aida2PendingAction,
} from "@/app/lib/aida2/conversationState";

export type Aida2FoodMemoryDecision = {
  food: string;
  decision: Exclude<Aida2FoodDecision, null>;
  reason: string;
  createdAt: string;
};

export type Aida2MemoryMetadata = {
  version: 1;
  activeProtocol: string;
  activePhase: string;
  glucoseTargets: {
    fastingMaxMgDl: number;
    postMealMinMgDl: number;
    postMealMaxMgDl: number;
  };
  allowedFoodsSnapshot: {
    proteins: string[];
    dairy: string[];
    healthyFats: string[];
    vegetables: string[];
    legumes: string[];
    fruits: string[];
    beverages: string[];
  };
  restrictedFoodsSnapshot: string[];
  lastFoodDecision: Aida2FoodMemoryDecision | null;
  pendingAction: Aida2PendingAction | null;
  knownUserPatterns: string[];
  lastUpdatedAt: string;
};

export type Aida2ContextMemory = {
  userId: string;
  userState: {
    name: string | null;
    activeProtocol: string;
    activePhase: string;
    currentNutritionGoal: string | null;
    clinicalState: string | null;
    lastRecommendation: string | null;
    fastingPeakMgDl: number | null;
    postMealPeakMgDl: number | null;
  };
  conversation: {
    clinicalSummary: string | null;
    activeGlucoseTopics: string | null;
    currentGoal: string | null;
    detectedPatterns: string | null;
    medicationContext: string | null;
    lastConcern: string | null;
    lastAidaRecommendation: string | null;
    pendingConversationFollowUp: string | null;
  };
  metadata: Aida2MemoryMetadata;
};

const DEFAULT_GLUCOSE_TARGETS = {
  fastingMaxMgDl: 100,
  postMealMinMgDl: 100,
  postMealMaxMgDl: 140,
};

function resolveProtocolId(_activePhase: string | null | undefined): ProtocolId {
  // Por ahora AIDA2 trabaja con el protocolo Diagnóstico 7 días.
  // Aunque UserState tenga activePhase = FASE_1, no debemos cargar fase1.md
  // porque ese archivo no existe o no está listo en este flujo.
  return "DIAGNOSTICO_7_DIAS";
}

function compact(value: string | null | undefined, maxLength = 900) {
  if (!value) return null;

  const clean = value.replace(/\s+/g, " ").trim();

  if (!clean) return null;

  return clean.length > maxLength ? `${clean.slice(0, maxLength)}...` : clean;
}

function safeParseMetadata(value: string | null | undefined) {
  if (!value) return null;

  try {
    return JSON.parse(value) as Partial<Aida2MemoryMetadata>;
  } catch {
    return null;
  }
}

function extractRestrictedFoods(restrictedFoodsText: string | undefined) {
  if (!restrictedFoodsText) return [];

  return restrictedFoodsText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-"))
    .map((line) =>
      line
        .replace(/^-\s*/, "")
        .replace(/\(.*?\)/g, "")
        .trim()
    )
    .filter(Boolean);
}

function uniqueText(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  );
}

function buildMetadata(params: {
  previous: Partial<Aida2MemoryMetadata> | null;
  activeProtocol: string;
  activePhase: string;
}) {
  const { previous, activeProtocol, activePhase } = params;

  const protocol = runProtocolModule({
    protocolId: resolveProtocolId(activePhase),
  });

  const now = new Date().toISOString();

  return {
    version: 1,
    activeProtocol,
    activePhase,
    glucoseTargets: previous?.glucoseTargets ?? DEFAULT_GLUCOSE_TARGETS,
    allowedFoodsSnapshot: {
      proteins: protocol.structured.allowedFoods.proteins,
      dairy: protocol.structured.allowedFoods.dairy,
      healthyFats: protocol.structured.allowedFoods.healthyFats,
      vegetables: protocol.structured.allowedFoods.vegetables,
      legumes: protocol.structured.allowedFoods.legumes,
      fruits: protocol.structured.allowedFoods.fruits,
      beverages: protocol.structured.allowedFoods.beverages,
    },
    restrictedFoodsSnapshot:
      previous?.restrictedFoodsSnapshot ??
      extractRestrictedFoods(protocol.sections.restrictedFoods),
    lastFoodDecision: previous?.lastFoodDecision ?? null,
    pendingAction: previous?.pendingAction ?? null,
    knownUserPatterns: previous?.knownUserPatterns ?? [],
    lastUpdatedAt: now,
  } satisfies Aida2MemoryMetadata;
}

async function ensureUserState(userId: string) {
  return prisma.userState.upsert({
    where: { id: userId },
    update: {
      lastMsgAt: new Date(),
      totalMsgCount: { increment: 1 },
    },
    create: {
      id: userId,
      activeProtocol: "PROTOCOL_1",
      activePhase: "FASE_1",
      lastMsgAt: new Date(),
      totalMsgCount: 1,
      licenseStatus: "trial",
    },
  });
}

async function ensureConversationContext(userId: string) {
  return prisma.conversationContext.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      clinicalSummary: null,
      activeGlucoseTopics: null,
      currentGoal: null,
      detectedPatterns: null,
      medicationContext: null,
      lastConcern: null,
      lastAidaRecommendation: null,
      pendingConversationFollowUp: null,
      metadataJson: null,
    },
  });
}

export async function loadAida2ContextMemory(params: {
  userId: string;
}): Promise<Aida2ContextMemory> {
  const { userId } = params;

  const userState = await ensureUserState(userId);
  const context = await ensureConversationContext(userId);

  const previousMetadata = safeParseMetadata(context.metadataJson);

  const metadata = buildMetadata({
    previous: previousMetadata,
    activeProtocol: userState.activeProtocol ?? "PROTOCOL_1",
    activePhase: userState.activePhase ?? "FASE_1",
  });

  await prisma.conversationContext.update({
    where: { userId },
    data: {
      metadataJson: JSON.stringify(metadata),
      currentGoal:
        context.currentGoal ??
        "Mantener glucosa en ayunas por debajo de 100 mg/dL y postcomida entre 100 y 140 mg/dL, limitando carbohidratos de alta carga glucémica.",
    },
  });

  return {
    userId,
    userState: {
      name: userState.name ?? null,
      activeProtocol: userState.activeProtocol ?? "PROTOCOL_1",
      activePhase: userState.activePhase ?? "FASE_1",
      currentNutritionGoal: userState.currentNutritionGoal ?? null,
      clinicalState: userState.clinicalState ?? null,
      lastRecommendation: userState.lastRecommendation ?? null,
      fastingPeakMgDl: userState.fastingPeakMgDl ?? null,
      postMealPeakMgDl: userState.postMealPeakMgDl ?? null,
    },
    conversation: {
      clinicalSummary: context.clinicalSummary ?? null,
      activeGlucoseTopics: context.activeGlucoseTopics ?? null,
      currentGoal:
        context.currentGoal ??
        "Mantener glucosa en ayunas por debajo de 100 mg/dL y postcomida entre 100 y 140 mg/dL.",
      detectedPatterns: context.detectedPatterns ?? null,
      medicationContext: context.medicationContext ?? null,
      lastConcern: context.lastConcern ?? null,
      lastAidaRecommendation: context.lastAidaRecommendation ?? null,
      pendingConversationFollowUp: context.pendingConversationFollowUp ?? null,
    },
    metadata,
  };
}

export function buildAida2MemoryPrompt(memory: Aida2ContextMemory) {
  const { userState, conversation, metadata } = memory;

  const lines: string[] = [
    "MEMORIA PERSISTENTE DE AIDA:",
    `- Usuario: ${userState.name ?? "sin nombre registrado"}.`,
    `- Protocolo activo: ${metadata.activeProtocol}.`,
    `- Fase activa: ${metadata.activePhase}.`,
    `- Objetivo glucémico: ayunas < ${metadata.glucoseTargets.fastingMaxMgDl} mg/dL; postcomida ${metadata.glucoseTargets.postMealMinMgDl}-${metadata.glucoseTargets.postMealMaxMgDl} mg/dL.`,
    `- Objetivo conversacional actual: ${conversation.currentGoal ?? "mantener estabilidad glucémica"}.`,
  ];

  if (conversation.clinicalSummary) {
    lines.push(`- Resumen clínico: ${conversation.clinicalSummary}.`);
  }

  if (conversation.detectedPatterns) {
    lines.push(`- Patrones detectados: ${conversation.detectedPatterns}.`);
  }

  if (conversation.medicationContext) {
    lines.push(`- Contexto de medicamentos: ${conversation.medicationContext}.`);
  }

  if (metadata.lastFoodDecision) {
    lines.push(
      `- Última decisión alimentaria: ${metadata.lastFoodDecision.food} = ${metadata.lastFoodDecision.decision}; ${metadata.lastFoodDecision.reason}.`
    );
  }

  if (metadata.pendingAction && metadata.pendingAction.type !== "NONE") {
    lines.push(
      `- Acción pendiente: ${metadata.pendingAction.type}; evitar: ${
        metadata.pendingAction.avoid?.join(", ") || "sin alimento específico"
      }; cantidad: ${metadata.pendingAction.count ?? 3}.`
    );
  }

  lines.push(
    `- Alimentos permitidos disponibles para contexto rápido: proteínas (${metadata.allowedFoodsSnapshot.proteins.slice(0, 12).join(", ")}); vegetales (${metadata.allowedFoodsSnapshot.vegetables.slice(0, 12).join(", ")}); grasas (${metadata.allowedFoodsSnapshot.healthyFats.slice(0, 8).join(", ")}).`
  );

  if (metadata.restrictedFoodsSnapshot.length > 0) {
    lines.push(
      `- Alimentos restringidos de referencia: ${metadata.restrictedFoodsSnapshot.slice(0, 20).join(", ")}.`
    );
  }

  lines.push(
    "- Usa esta memoria como contexto operativo. No la menciones literalmente al usuario."
  );

  return lines.join("\n");
}

export function buildConversationStateFromMemory(
  memory: Aida2ContextMemory
): Aida2ConversationState {
  const lastDecision = memory.metadata.lastFoodDecision;
  const pendingAction = memory.metadata.pendingAction;

  return {
    activeTopic:
      pendingAction?.reason ??
      (lastDecision ? `Validación alimentaria: ${lastDecision.food}` : null),
    activeGoal:
      pendingAction?.reason ??
      "Mantener estabilidad glucémica con decisiones alimentarias compatibles.",
    activeMealType: pendingAction?.mealType ?? null,

    lastUserIntent: lastDecision ? "FOOD_ADVICE" : null,
    lastFoodTarget: lastDecision?.food ?? null,
    lastFoodDecision: lastDecision?.decision ?? null,
    lastFoodReason: lastDecision?.reason ?? null,

    pendingAction,

    rejectedFoods:
      lastDecision?.decision === "not_recommended" ? [lastDecision.food] : [],
    compatibleFoods: [],

    lastAssistantPromise: memory.conversation.pendingConversationFollowUp,
    shouldContinuePendingAction: false,
  };
}

function foodDecisionFromMealRecommendation(params: {
  userMessage: string;
  workPlan: Aida2WorkPlan;
  moduleResults: Aida2ModuleResults;
}) {
  const { workPlan, moduleResults } = params;
  const recommendation = moduleResults.meal?.recommendation ?? "";

  if (!workPlan.foodContext.isFoodRelated) return null;

  const target = workPlan.foodContext.targetText?.trim();

  if (!target) return null;

  const rejected =
    /\b(no recomendado|no recomendados|alta carga gluc[eé]mica|no compatibles?|se restringe|no conviene|evitar)\b/i.test(
      recommendation
    );

  if (!rejected) return null;

  return {
    food: target,
    decision: "not_recommended",
    reason: "Alimento marcado como no recomendado por la validación alimentaria o el protocolo activo.",
    createdAt: new Date().toISOString(),
  } satisfies Aida2FoodMemoryDecision;
}

function moduleDeliveredOptions(moduleResults: Aida2ModuleResults) {
  return /\bBASES CULINARIAS COMPATIBLES\b/i.test(
    moduleResults.meal?.recommendation ?? ""
  );
}

function inferKnownPatterns(params: {
  userMessage: string;
  previousPatterns: string[];
}) {
  const { userMessage, previousPatterns } = params;
  const patterns = [...previousPatterns];

  if (/\b(antojo|antojos|ganas de|se me antoja|ansiedad)\b/i.test(userMessage)) {
    patterns.push("El usuario expresa antojos; conviene resolverlos con sustituciones compatibles, no solo prohibiciones.");
  }

  if (/\b(papa|papas|arroz|pan|tortilla|avena|dulce|galleta)\b/i.test(userMessage)) {
    patterns.push("El usuario consulta alimentos de alta carga glucémica; conviene explicar y ofrecer alternativas prácticas.");
  }

  return uniqueText(patterns).slice(-8);
}

export async function updateAida2ContextMemoryAfterResponse(params: {
  userId: string;
  userMessage: string;
  assistantReply: string;
  workPlan: Aida2WorkPlan;
  moduleResults: Aida2ModuleResults;
}) {
  const { userId, userMessage, assistantReply, workPlan, moduleResults } =
    params;

  const memory = await loadAida2ContextMemory({ userId });
  const metadata = { ...memory.metadata };

  const foodDecision = foodDecisionFromMealRecommendation({
    userMessage,
    workPlan,
    moduleResults,
  });

  if (foodDecision) {
    metadata.lastFoodDecision = foodDecision;
    metadata.pendingAction = {
      type: "BUILD_ALTERNATIVES",
      count: 3,
      target: null,
      avoid: [foodDecision.food],
      mealType: workPlan.foodContext.targetText
        ? (workPlan.conversationState.activeMealType as Aida2MealType | null)
        : null,
      reason: `Resolver la comida o antojo evitando ${foodDecision.food}.`,
    };
  }

  if (moduleDeliveredOptions(moduleResults)) {
    metadata.pendingAction = null;
  }

  metadata.knownUserPatterns = inferKnownPatterns({
    userMessage,
    previousPatterns: metadata.knownUserPatterns,
  });

  metadata.lastUpdatedAt = new Date().toISOString();

  await prisma.conversationContext.update({
    where: { userId },
    data: {
      clinicalSummary: compact(
        memory.conversation.clinicalSummary ??
          "AIDA acompaña al usuario a mantener estabilidad glucémica con decisiones alimentarias, ejercicio y seguimiento."
      ),
      currentGoal:
        memory.conversation.currentGoal ??
        "Mantener glucosa en ayunas por debajo de 100 mg/dL y postcomida entre 100 y 140 mg/dL.",
      detectedPatterns:
        metadata.knownUserPatterns.length > 0
          ? metadata.knownUserPatterns.join(" ")
          : memory.conversation.detectedPatterns,
      lastConcern: compact(userMessage, 600),
      lastAidaRecommendation: compact(assistantReply, 900),
      pendingConversationFollowUp: metadata.pendingAction?.reason ?? null,
      metadataJson: JSON.stringify(metadata),
    },
  });
}
