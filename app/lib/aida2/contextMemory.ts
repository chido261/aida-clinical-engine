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

export type Aida2MemoryTurn = {
  userMessage: string;
  assistantReply: string;
  topic: string | null;
  intent: string | null;
  foodTarget: string | null;
  foodDecision: Aida2FoodDecision;
  createdAt: string;
};

export type Aida2ConversationContextSnapshot = {
  isFirstInteraction: boolean;
  isReturningUser: boolean;
  contextSummary: string | null;
  lastInteractionType:
    | "FOOD_VALIDATION"
    | "FOOD_RECIPE_REQUEST"
    | "FOOD_CONCEPT"
    | "GLUCOSE_READING"
    | "HYPOGLYCEMIA"
    | "FOLLOW_UP"
    | "GENERAL"
    | null;
  lastMainTopic: string | null;
  lastClinicalSituation: string | null;
  lastGlucoseSituation: string | null;
  lastMealContext: string | null;
  lastRecommendedAction: string | null;
  nextSuggestedFollowUp: string | null;
};

export type Aida2MemoryMetadata = {
  version: 2;
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
  recentTurns: Aida2MemoryTurn[];
  lastConfirmedTopic: string | null;
  lastCorrectionFromUser: string | null;
  memoryConfidence: "LOW" | "MEDIUM" | "HIGH";
  conversationContext: Aida2ConversationContextSnapshot;
  lastUpdatedAt: string;
};

export type Aida2ContextMemory = {
  userId: string;
  userState: {
    name: string | null;
    age: number | null;
    heightCm: number | null;
    weightKg: number | null;
    diagnosis: string | null;
    baselineA1c: number | null;
    meds: string | null;
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

function normalizeActivePhase(
  activePhase: string | null | undefined
): "DIAGNOSTICO" | "FASE_1" | "FASE_2" {
  const normalized = activePhase?.trim().toUpperCase();

  if (
    normalized === "DIAGNOSTICO" ||
    normalized === "DIAGNOSTICO_7_DIAS"
  ) {
    return "DIAGNOSTICO";
  }

  if (normalized === "FASE_2") {
    return "FASE_2";
  }

  if (normalized === "FASE_1") {
    return "FASE_1";
  }

  return "DIAGNOSTICO";
}

function resolveProtocolId(
  activePhase: string | null | undefined
): ProtocolId {
  const normalizedPhase = normalizeActivePhase(activePhase);

  if (normalizedPhase === "FASE_1") {
    return "FASE_1";
  }

  if (normalizedPhase === "FASE_2") {
    return "FASE_2";
  }

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

function buildEmptyConversationContext(): Aida2ConversationContextSnapshot {
  return {
    isFirstInteraction: true,
    isReturningUser: false,
    contextSummary: null,
    lastInteractionType: null,
    lastMainTopic: null,
    lastClinicalSituation: null,
    lastGlucoseSituation: null,
    lastMealContext: null,
    lastRecommendedAction: null,
    nextSuggestedFollowUp: null,
  };
}

function coerceMetadataVersion(
  previous: Partial<Aida2MemoryMetadata> | null
): Partial<Aida2MemoryMetadata> | null {
  if (!previous) return null;

  return {
    ...previous,
    version: 2,
    recentTurns: Array.isArray(previous.recentTurns)
      ? previous.recentTurns
      : [],
    lastConfirmedTopic: previous.lastConfirmedTopic ?? null,
    lastCorrectionFromUser: previous.lastCorrectionFromUser ?? null,
    memoryConfidence: previous.memoryConfidence ?? "MEDIUM",
    conversationContext:
      previous.conversationContext ?? buildEmptyConversationContext(),
  };
}

function buildMetadata(params: {
  previous: Partial<Aida2MemoryMetadata> | null;
  activeProtocol: string;
  activePhase: string;
}) {
  const { previous, activePhase } = params;
  const coerced = coerceMetadataVersion(previous);
  const normalizedPhase = normalizeActivePhase(activePhase);

  const protocol = runProtocolModule({
    protocolId: resolveProtocolId(normalizedPhase),
  });

  const now = new Date().toISOString();

  return {
    version: 2,
    activeProtocol: protocol.protocolId,
    activePhase: normalizedPhase,
    glucoseTargets: coerced?.glucoseTargets ?? DEFAULT_GLUCOSE_TARGETS,
    allowedFoodsSnapshot: {
      proteins: protocol.structured.allowedFoods.proteins,
      dairy: protocol.structured.allowedFoods.dairy,
      healthyFats: protocol.structured.allowedFoods.healthyFats,
      vegetables: protocol.structured.allowedFoods.vegetables,
      legumes: protocol.structured.allowedFoods.legumes,
      fruits: protocol.structured.allowedFoods.fruits,
      beverages: protocol.structured.allowedFoods.beverages,
    },
    restrictedFoodsSnapshot: extractRestrictedFoods(
      protocol.sections.restrictedFoods
    ),
    lastFoodDecision: coerced?.lastFoodDecision ?? null,
    pendingAction: coerced?.pendingAction ?? null,
    knownUserPatterns: coerced?.knownUserPatterns ?? [],
    recentTurns: coerced?.recentTurns ?? [],
    lastConfirmedTopic: coerced?.lastConfirmedTopic ?? null,
    lastCorrectionFromUser: coerced?.lastCorrectionFromUser ?? null,
    memoryConfidence: coerced?.memoryConfidence ?? "MEDIUM",
    conversationContext:
      coerced?.conversationContext ?? buildEmptyConversationContext(),
    lastUpdatedAt: now,
  } satisfies Aida2MemoryMetadata;
}

async function ensureUserState(userId: string) {
  return prisma.userState.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      activeProtocol: "DIAGNOSTICO_7_DIAS",
      activePhase: "DIAGNOSTICO",
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

  const normalizedPhase = normalizeActivePhase(userState.activePhase);
  const resolvedProtocolId = resolveProtocolId(normalizedPhase);

  const metadata = buildMetadata({
    previous: previousMetadata,
    activeProtocol: resolvedProtocolId,
    activePhase: normalizedPhase,
  });

  await prisma.conversationContext.update({
    where: { userId },
    data: {
      metadataJson: JSON.stringify(metadata),
      currentGoal:
        context.currentGoal ??
        "Mantener glucosa en ayunas entre 70 y 100 mg/dL y las demás lecturas entre 100 y 140 mg/dL, limitando carbohidratos de alta carga glucémica.",
    },
  });

  return {
    userId,
    userState: {
      name: userState.name ?? null,
      age: userState.age ?? null,
      heightCm: userState.heightCm ?? null,
      weightKg: userState.weightKg ?? null,
      diagnosis: userState.diagnosis ?? null,
      baselineA1c: userState.baselineA1c ?? null,
      meds: userState.meds ?? null,
      activeProtocol: resolvedProtocolId,
      activePhase: normalizedPhase,
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
        "Mantener glucosa en ayunas entre 70 y 100 mg/dL y las demás lecturas entre 100 y 140 mg/dL.",
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
  const context = metadata.conversationContext;

  const lines: string[] = [
    "MEMORIA PERSISTENTE DE AIDA:",
    `- Usuario: ${userState.name ?? "sin nombre registrado"}.`,
    `- Edad: ${userState.age ?? "no registrada"}.`,
    `- Estatura: ${
      userState.heightCm !== null
        ? `${(userState.heightCm / 100).toFixed(2)} m`
        : "no registrada"
    }.`,
    `- Peso: ${
      userState.weightKg !== null
        ? `${userState.weightKg} kg`
        : "no registrado"
    }.`,
    `- Diagnóstico registrado: ${userState.diagnosis ?? "no registrado"}.`,
    `- Hemoglobina glucosilada registrada: ${
      userState.baselineA1c !== null
        ? `${userState.baselineA1c}%`
        : "no registrada"
    }.`,
    `- Medicamentos registrados: ${userState.meds ?? "ninguno registrado"}.`,
    `- Protocolo activo: ${metadata.activeProtocol}.`,
    `- Fase activa: ${metadata.activePhase}.`,
    `- Objetivo glucémico: ayunas < ${metadata.glucoseTargets.fastingMaxMgDl} mg/dL; postcomida ${metadata.glucoseTargets.postMealMinMgDl}-${metadata.glucoseTargets.postMealMaxMgDl} mg/dL.`,
    `- Objetivo conversacional actual: ${conversation.currentGoal ?? "mantener estabilidad glucémica"}.`,
    `- Confianza de memoria: ${metadata.memoryConfidence}.`,
  ];

  if (context.contextSummary) {
    lines.push(`- Contexto resumido: ${context.contextSummary}.`);
  }

  if (context.lastInteractionType) {
    lines.push(`- Tipo de última interacción: ${context.lastInteractionType}.`);
  }

  if (context.lastMainTopic) {
    lines.push(`- Último tema principal: ${context.lastMainTopic}.`);
  }

  if (context.lastClinicalSituation) {
    lines.push(`- Situación clínica reciente: ${context.lastClinicalSituation}.`);
  }

  if (context.lastGlucoseSituation) {
    lines.push(`- Situación glucémica reciente: ${context.lastGlucoseSituation}.`);
  }

  if (context.lastMealContext) {
    lines.push(`- Contexto alimentario reciente: ${context.lastMealContext}.`);
  }

  if (context.lastRecommendedAction) {
    lines.push(`- Última acción recomendada: ${context.lastRecommendedAction}.`);
  }

  if (context.nextSuggestedFollowUp) {
    lines.push(`- Seguimiento sugerido: ${context.nextSuggestedFollowUp}.`);
  }

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
      `- Última decisión alimentaria confirmada: ${metadata.lastFoodDecision.food} = ${metadata.lastFoodDecision.decision}; ${metadata.lastFoodDecision.reason}.`
    );
  }

  if (metadata.lastConfirmedTopic) {
    lines.push(`- Último tema confirmado: ${metadata.lastConfirmedTopic}.`);
  }

  if (metadata.lastCorrectionFromUser) {
    lines.push(`- Corrección reciente del usuario: ${metadata.lastCorrectionFromUser}.`);
  }

  if (metadata.pendingAction && metadata.pendingAction.type !== "NONE") {
    lines.push(
      `- Acción pendiente: ${metadata.pendingAction.type}; evitar: ${
        metadata.pendingAction.avoid?.join(", ") || "sin alimento específico"
      }; cantidad: ${metadata.pendingAction.count ?? 3}.`
    );
  }

  if (metadata.recentTurns.length > 0) {
    lines.push("- Últimos turnos guardados en memoria:");
    metadata.recentTurns.slice(-3).forEach((turn) => {
      lines.push(
        `  • Usuario: ${turn.userMessage} | AIDA: ${turn.assistantReply}`
      );
    });
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
    "- Usa esta memoria como contexto operativo. No la menciones literalmente al usuario.",
    "- Si hay seguimiento sugerido, prioriza retomarlo de forma natural.",
    "- No afirmes recordar algo específico si no aparece en memoria o historial.",
    "- Si el usuario pregunta por datos personales o clínicos registrados, responde usando esta memoria.",
    "- Si el usuario pregunta por su hemoglobina glucosilada, usa exactamente el valor de baselineA1c mostrado en esta memoria.",
    "- Si el usuario corrige un recuerdo, acepta la corrección y actualiza el tema."
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
      memory.metadata.lastConfirmedTopic ??
      memory.metadata.conversationContext.lastMainTopic ??
      (lastDecision ? `Validación alimentaria: ${lastDecision.food}` : null),
    activeGoal:
      pendingAction?.reason ??
      memory.metadata.conversationContext.nextSuggestedFollowUp ??
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

function detectUserCorrection(userMessage: string) {
  if (
    /\b(falso|no fue eso|no era eso|te equivocas|te equivocaste|no pregunt[eé] eso|no dije eso)\b/i.test(
      userMessage
    )
  ) {
    return compact(userMessage, 500);
  }

  return null;
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

  if (/\b(papa|papas|arroz|pan|tortilla|avena|dulce|galleta|camote)\b/i.test(userMessage)) {
    patterns.push("El usuario consulta alimentos de alta carga glucémica; conviene explicar y ofrecer alternativas prácticas.");
  }

  if (/\b(glucosa|az[uú]car|mg\/dl|hipoglucemia|hiper|alta|baja|ayunas|postcomida|despu[eé]s de comer)\b/i.test(userMessage)) {
    patterns.push("El usuario consulta o reporta datos de glucosa; conviene guardar seguimiento y sugerir próxima revisión.");
  }

  return uniqueText(patterns).slice(-8);
}

function buildMemoryTurn(params: {
  userMessage: string;
  assistantReply: string;
  workPlan: Aida2WorkPlan;
}) {
  const { userMessage, assistantReply, workPlan } = params;

  return {
    userMessage: compact(userMessage, 280) ?? userMessage,
    assistantReply: compact(assistantReply, 420) ?? assistantReply,
    topic:
      workPlan.foodContext.targetText ??
      workPlan.conversationState.activeTopic ??
      null,
    intent: workPlan.understanding.intent,
    foodTarget: workPlan.foodContext.targetText,
    foodDecision: workPlan.conversationState.lastFoodDecision,
    createdAt: new Date().toISOString(),
  } satisfies Aida2MemoryTurn;
}

function buildLastConfirmedTopic(params: {
  workPlan: Aida2WorkPlan;
  foodDecision: Aida2FoodMemoryDecision | null;
}) {
  const { workPlan, foodDecision } = params;

  if (foodDecision) {
    return `Revisión alimentaria: ${foodDecision.food}`;
  }

  if (workPlan.foodContext.targetText) {
    return `Revisión alimentaria: ${workPlan.foodContext.targetText}`;
  }

  if (workPlan.thinking.userGoal) {
    return workPlan.thinking.userGoal;
  }

  return null;
}

function inferInteractionType(params: {
  userMessage: string;
  workPlan: Aida2WorkPlan;
}) {
  const { userMessage, workPlan } = params;

  if (/\b(hipoglucemia|hipo|47|50|55|60|baja|me tiembla|sudor|sudando)\b/i.test(userMessage)) {
    return "HYPOGLYCEMIA";
  }

  if (/\b(glucosa|az[uú]car|mg\/dl|ayunas|postcomida|despu[eé]s de comer|antes de comer|alta|baja)\b/i.test(userMessage)) {
    return "GLUCOSE_READING";
  }

  if (/\b(receta|recetas|opci[oó]n|opciones|ideas|men[uú]|platillo|preparar)\b/i.test(userMessage)) {
    return "FOOD_RECIPE_REQUEST";
  }

  if (/\b(comida chatarra|chatarra|saludable|malo|bueno|conviene|carga gluc[eé]mica)\b/i.test(userMessage)) {
    return "FOOD_CONCEPT";
  }

  if (workPlan.foodContext.isFoodRelated) {
    return "FOOD_VALIDATION";
  }

  if (/\b(recuerdas|seguimos|continuamos|como te dije|lo anterior|la vez pasada)\b/i.test(userMessage)) {
    return "FOLLOW_UP";
  }

  return "GENERAL";
}

function extractGlucoseText(userMessage: string) {
  const reading = userMessage.match(/\b(\d{2,3})\s*(?:mg\/dl)?\b/i)?.[1];

  if (!reading) {
    if (/\b(glucosa|az[uú]car|ayunas|postcomida|hipoglucemia|alta|baja)\b/i.test(userMessage)) {
      return compact(userMessage, 220);
    }

    return null;
  }

  return `El usuario mencionó una glucosa de ${reading} mg/dL.`;
}

function buildConversationContextAfterResponse(params: {
  previous: Aida2ConversationContextSnapshot;
  userMessage: string;
  assistantReply: string;
  workPlan: Aida2WorkPlan;
  foodDecision: Aida2FoodMemoryDecision | null;
  hasPreviousTurns: boolean;
}) {
  const {
    previous,
    userMessage,
    assistantReply,
    workPlan,
    foodDecision,
    hasPreviousTurns,
  } = params;

  const interactionType = inferInteractionType({ userMessage, workPlan });
  const mainTopic =
    foodDecision?.food ??
    workPlan.foodContext.targetText ??
    workPlan.thinking.userGoal ??
    previous.lastMainTopic ??
    "Conversación general";

  const glucoseSituation = extractGlucoseText(userMessage);

  const mealContext =
    workPlan.foodContext.targetText || foodDecision
      ? `Consulta alimentaria sobre ${mainTopic}.`
      : previous.lastMealContext;

  const clinicalSituation =
    interactionType === "HYPOGLYCEMIA"
      ? "Posible evento de hipoglucemia o glucosa baja reportada por el usuario."
      : interactionType === "GLUCOSE_READING"
        ? "El usuario reportó o consultó una situación relacionada con glucosa."
        : previous.lastClinicalSituation;

  const recommendedAction =
    foodDecision?.decision === "not_recommended"
      ? `Evitar ${foodDecision.food} y buscar una alternativa compatible.`
      : compact(assistantReply, 260) ?? previous.lastRecommendedAction;

  const nextFollowUp =
    interactionType === "HYPOGLYCEMIA"
      ? "Preguntar cómo sigue y confirmar si la glucosa se estabilizó."
      : interactionType === "GLUCOSE_READING"
        ? "Dar seguimiento a la próxima medición de glucosa."
        : foodDecision?.decision === "not_recommended"
          ? `Preguntar si desea opciones compatibles para reemplazar ${foodDecision.food}.`
          : interactionType === "FOOD_RECIPE_REQUEST"
            ? "Preguntar si la receta fue útil o si necesita otra opción."
            : previous.nextSuggestedFollowUp;

  const contextSummary =
    compact(
      [
        `Última interacción: ${interactionType}.`,
        `Tema principal: ${mainTopic}.`,
        glucoseSituation ? `Glucosa: ${glucoseSituation}` : null,
        mealContext ? `Alimentación: ${mealContext}` : null,
        recommendedAction ? `Acción: ${recommendedAction}` : null,
      ]
        .filter(Boolean)
        .join(" "),
      700
    ) ?? previous.contextSummary;

  return {
    isFirstInteraction: false,
    isReturningUser: hasPreviousTurns,
    contextSummary,
    lastInteractionType: interactionType,
    lastMainTopic: mainTopic,
    lastClinicalSituation: clinicalSituation,
    lastGlucoseSituation: glucoseSituation ?? previous.lastGlucoseSituation,
    lastMealContext: mealContext,
    lastRecommendedAction: recommendedAction,
    nextSuggestedFollowUp: nextFollowUp,
  } satisfies Aida2ConversationContextSnapshot;
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
    workPlan,
    moduleResults,
  });

  const userCorrection = detectUserCorrection(userMessage);

  if (foodDecision) {
    metadata.lastFoodDecision = foodDecision;
    metadata.pendingAction = {
      type: "BUILD_ALTERNATIVES",
      count: 3,
      target: null,
      avoid: [foodDecision.food],
      mealType: workPlan.conversationState.activeMealType as Aida2MealType | null,
      reason: `Resolver la comida o antojo evitando ${foodDecision.food}.`,
    };
  }

  if (moduleDeliveredOptions(moduleResults)) {
    metadata.pendingAction = null;
  }

  if (userCorrection) {
    metadata.lastCorrectionFromUser = userCorrection;
    metadata.memoryConfidence = "LOW";
  } else if (foodDecision || workPlan.foodContext.targetText) {
    metadata.memoryConfidence = "HIGH";
  } else {
    metadata.memoryConfidence = metadata.memoryConfidence ?? "MEDIUM";
  }

  metadata.lastConfirmedTopic =
    buildLastConfirmedTopic({ workPlan, foodDecision }) ??
    metadata.lastConfirmedTopic;

  metadata.knownUserPatterns = inferKnownPatterns({
    userMessage,
    previousPatterns: metadata.knownUserPatterns,
  });

  metadata.conversationContext = buildConversationContextAfterResponse({
    previous: metadata.conversationContext ?? buildEmptyConversationContext(),
    userMessage,
    assistantReply,
    workPlan,
    foodDecision,
    hasPreviousTurns: metadata.recentTurns.length > 0,
  });

  metadata.recentTurns = [
    ...metadata.recentTurns,
    buildMemoryTurn({
      userMessage,
      assistantReply,
      workPlan,
    }),
  ].slice(-8);

  metadata.lastUpdatedAt = new Date().toISOString();

  await prisma.conversationContext.update({
    where: { userId },
    data: {
      clinicalSummary: compact(
        metadata.conversationContext.contextSummary ??
          memory.conversation.clinicalSummary ??
          "AIDA acompaña al usuario a mantener estabilidad glucémica con decisiones alimentarias, ejercicio y seguimiento."
      ),
      activeGlucoseTopics: compact(metadata.conversationContext.lastGlucoseSituation),
      currentGoal:
        memory.conversation.currentGoal ??
        "Mantener glucosa en ayunas entre 70 y 100 mg/dL y las demás lecturas entre 100 y 140 mg/dL.",
      detectedPatterns:
        metadata.knownUserPatterns.length > 0
          ? metadata.knownUserPatterns.join(" ")
          : memory.conversation.detectedPatterns,
      lastConcern: compact(userMessage, 600),
      lastAidaRecommendation: compact(assistantReply, 900),
      pendingConversationFollowUp:
        metadata.conversationContext.nextSuggestedFollowUp ??
        metadata.pendingAction?.reason ??
        null,
      metadataJson: JSON.stringify(metadata),
    },
  });

  await prisma.userState.update({
    where: { id: userId },
    data: {
      lastMsgAt: new Date(),
      totalMsgCount: { increment: 1 },
    },
  });
}
