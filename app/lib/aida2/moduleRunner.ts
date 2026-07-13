// app/lib/aida2/moduleRunner.ts

import type { Aida2WorkPlan } from "@/app/lib/aida2/brain";
import {
  buildAida2ExecutionPlan,
  type Aida2ExecutionPlan,
} from "@/app/lib/aida2/decisionEngine";
import {
  runContextModule,
  type Aida2ContextModuleOutput,
} from "@/app/lib/aida2/modules/contextModule";
import {
  runProtocolModule,
  validateFoodWithProtocol,
  type ProtocolFoodDecision,
  type ProtocolId,
} from "@/app/lib/aida2/modules/protocolModule";
import {
  generateMealRecommendation,
  type MealSpecialistDecision,
  type MealType,
} from "@/app/lib/aida2/specialists/mealSpecialist";

export type Aida2ModuleRunnerInput = {
  workPlan: Aida2WorkPlan;
  history: string;
  userMessage: string;
  protocolId?: ProtocolId;
};

export type Aida2MealModuleOutput = {
  module: "MEAL_SPECIALIST";
  mealType: MealType;
  recommendation: string;
  decision: MealSpecialistDecision;
};

export type Aida2ProtocolModuleOutput = {
  module: "PROTOCOL";
  protocolId: ProtocolId;
  protocolVersion: string;
  foodDecision?: ProtocolFoodDecision;
};

export type Aida2ModuleResults = {
  executionPlan: Aida2ExecutionPlan;
  context?: Aida2ContextModuleOutput;
  protocol?: Aida2ProtocolModuleOutput;
  meal?: Aida2MealModuleOutput;
};

function detectMealType(params: {
  userMessage: string;
  history: string;
  workPlan: Aida2WorkPlan;
}): MealType {
  const { userMessage, history, workPlan } = params;

  const currentText = userMessage.toLowerCase();
  const combinedText = `${history}\n${userMessage}`.toLowerCase();

  const pendingMealType = workPlan.conversationState.pendingAction?.mealType;
  const activeMealType = workPlan.conversationState.activeMealType;

  if (pendingMealType) {
    return pendingMealType;
  }

  if (activeMealType) {
    return activeMealType;
  }

  if (/\b(desayuno|desayunar|mañana|amanec[ií]|ayunas)\b/i.test(currentText)) {
    return "desayuno";
  }

  if (/\b(cena|cenar|noche)\b/i.test(currentText)) {
    return "cena";
  }

  if (/\b(snack|colaci[oó]n|colacion|tentempi[eé]|botana)\b/i.test(currentText)) {
    return "snack";
  }

  if (
    workPlan.foodContext.isFoodRelated &&
    workPlan.foodContext.conversationMode === "FOLLOW_UP"
  ) {
    if (/\b(desayuno|desayunar|mañana|amanec[ií]|ayunas)\b/i.test(combinedText)) {
      return "desayuno";
    }

    if (/\b(cena|cenar|noche)\b/i.test(combinedText)) {
      return "cena";
    }

    if (/\b(snack|colaci[oó]n|colacion|tentempi[eé]|botana)\b/i.test(combinedText)) {
      return "snack";
    }
  }

  return "comida";
}

function buildMealSpecialistMessage(params: {
  workPlan: Aida2WorkPlan;
  history: string;
  userMessage: string;
  mealType: MealType;
  protocolDecision?: ProtocolFoodDecision;
}) {
  const {
    workPlan,
    history,
    userMessage,
    mealType,
    protocolDecision,
  } = params;

  const { foodContext, modulePlan, conversationState } = workPlan;
  const { pendingAction } = conversationState;

  if (!foodContext.isFoodRelated) {
    return userMessage;
  }

  const lines: string[] = [];

  lines.push("MENSAJE ACTUAL DEL USUARIO:");
  lines.push(userMessage);

  lines.push("");
  lines.push("DIRECCIÓN DE CEREBRO PARA EL ESPECIALISTA:");
  lines.push(`- Modo de conversación: ${foodContext.conversationMode}.`);
  lines.push(`- Tipo de consulta alimentaria: ${foodContext.questionType}.`);
  lines.push(`- Tipo de comida detectado para construir opciones: ${mealType}.`);
  lines.push(`- Acción esperada: ${modulePlan.expectedMealSpecialistAction}.`);
  lines.push(`- Foco de decisión: ${foodContext.decisionFocus}.`);

  if (foodContext.targetText) {
    lines.push(`- Elemento consultado: ${foodContext.targetText}.`);
  }

  if (foodContext.shouldValidatePreparation) {
    lines.push(
      "- El usuario parece describir una preparación; validar por ingredientes cuando aplique."
    );
  }

  if (protocolDecision) {
    lines.push("");
    lines.push("DECISIÓN PRELIMINAR DEL PROTOCOLO ACTIVO:");
    lines.push(`- Protocolo: ${protocolDecision.protocolId}.`);
    lines.push(`- Versión: ${protocolDecision.protocolVersion}.`);
    lines.push(`- Alimento consultado: ${protocolDecision.requestedFood}.`);
    lines.push(
      `- Alimento canónico: ${protocolDecision.canonicalFood ?? "no identificado"}.`
    );
    lines.push(`- Categoría: ${protocolDecision.category}.`);
    lines.push(`- Estado: ${protocolDecision.status}.`);
    lines.push(`- Motivo: ${protocolDecision.reason}.`);
    lines.push(
      `- Requiere medición de glucosa: ${
        protocolDecision.shouldMeasureGlucose ? "sí" : "no"
      }.`
    );
    lines.push(
      "- Esta decisión proviene del Markdown activo y debe conservarse como referencia técnica."
    );
    lines.push(
      "- Si el estado es UNKNOWN y se trata de una preparación, puedes analizar ingredientes con la lógica actual sin inventar permisos."
    );
  }

  lines.push("");
  lines.push("ESTADO CONVERSACIONAL ACTUAL:");
  lines.push(`- Tema activo: ${conversationState.activeTopic ?? "sin tema activo"}.`);
  lines.push(`- Objetivo activo: ${conversationState.activeGoal ?? "sin objetivo activo"}.`);
  lines.push(`- Último alimento consultado: ${conversationState.lastFoodTarget ?? "ninguno"}.`);
  lines.push(`- Última decisión alimentaria: ${conversationState.lastFoodDecision ?? "sin decisión"}.`);
  lines.push(`- Motivo de última decisión: ${conversationState.lastFoodReason ?? "sin motivo"}.`);
  lines.push(
    `- Alimentos rechazados acumulados: ${
      conversationState.rejectedFoods.length > 0
        ? conversationState.rejectedFoods.join(", ")
        : "ninguno"
    }.`
  );
  lines.push(
    `- Alimentos compatibles acumulados: ${
      conversationState.compatibleFoods.length > 0
        ? conversationState.compatibleFoods.join(", ")
        : "ninguno"
    }.`
  );
  lines.push(
    `- El usuario está continuando una acción pendiente: ${
      conversationState.shouldContinuePendingAction ? "sí" : "no"
    }.`
  );

  if (pendingAction && pendingAction.type !== "NONE") {
    lines.push("");
    lines.push("ACCIÓN PENDIENTE QUE DEBE OBEDECER EL ESPECIALISTA:");
    lines.push(`- Tipo: ${pendingAction.type}.`);
    lines.push(`- Cantidad solicitada: ${pendingAction.count ?? 3}.`);
    lines.push(`- Objetivo/target: ${pendingAction.target ?? "sin target específico"}.`);
    lines.push(
      `- Evitar: ${
        pendingAction.avoid && pendingAction.avoid.length > 0
          ? pendingAction.avoid.join(", ")
          : "ningún alimento específico"
      }.`
    );
    lines.push(`- Tipo de comida: ${pendingAction.mealType ?? mealType}.`);
    lines.push(`- Razón: ${pendingAction.reason ?? "sin razón registrada"}.`);

    if (pendingAction.type === "BUILD_ALTERNATIVES") {
      lines.push(
        "- Ejecutar BUILD_ALTERNATIVES: construir opciones compatibles evitando los alimentos indicados."
      );
      lines.push(
        "- No volver a preguntar si el usuario ya aceptó continuar o pidió las recetas/opciones."
      );
    }

    if (pendingAction.type === "BUILD_RECIPES") {
      lines.push(
        "- Ejecutar BUILD_RECIPES: construir recetas u opciones compatibles con el protocolo."
      );
    }

    if (pendingAction.type === "ASK_INGREDIENTS") {
      lines.push(
        "- Ejecutar ASK_INGREDIENTS: pedir solo los ingredientes mínimos necesarios."
      );
    }

    if (pendingAction.type === "EXPLAIN_DECISION") {
      lines.push(
        "- Ejecutar EXPLAIN_DECISION: explicar brevemente la decisión alimentaria ya tomada."
      );
    }
  }

  if (foodContext.needsHistory && history.trim()) {
    lines.push("");
    lines.push("HISTORIAL RECIENTE PARA CONTINUIDAD:");
    lines.push(history);
  }

  lines.push("");
  lines.push("INSTRUCCIÓN PARA OPCIONES GENÉRICAS:");
  lines.push(
    "- Si el usuario pide opciones, recetas o ideas sin mencionar proteína específica, construir platillos completos y variados según el tipo de comida detectado."
  );
  lines.push(
    "- Cada opción debe tener sentido como comida real: proteína, grasa saludable y vegetales bajos en carga glucémica cuando aplique."
  );
  lines.push(
    "- No repetir los mismos vegetales o la misma estructura en todas las opciones."
  );
  lines.push(
    "- No usar el historial como lista obligatoria de ingredientes; usarlo solo para entender continuidad."
  );

  lines.push("");
  lines.push("LÍMITE:");
  lines.push(
    "- Conserva las capacidades actuales de clasificación, análisis de ingredientes y construcción culinaria."
  );
  lines.push(
    "- No contradigas una decisión explícita del protocolo activo."
  );
  lines.push(
    "- No cambies el objetivo de la conversación."
  );

  return lines.join("\n");
}

function buildProtocolResult(params: {
  workPlan: Aida2WorkPlan;
  protocolId: ProtocolId;
}): Aida2ProtocolModuleOutput {
  const { workPlan, protocolId } = params;
  const protocol = runProtocolModule({ protocolId });

  const targetText = workPlan.foodContext.targetText?.trim();

  const foodDecision =
    workPlan.foodContext.isFoodRelated && targetText
      ? validateFoodWithProtocol({
          protocolId,
          food: targetText,
        })
      : undefined;

  return {
    module: "PROTOCOL",
    protocolId: protocol.protocolId,
    protocolVersion: protocol.protocolVersion,
    foodDecision,
  };
}

export function runAida2Modules(
  input: Aida2ModuleRunnerInput
): Aida2ModuleResults {
  const {
    workPlan,
    history,
    userMessage,
    protocolId = "DIAGNOSTICO_7_DIAS",
  } = input;

  const executionPlan = buildAida2ExecutionPlan(workPlan);

  const results: Aida2ModuleResults = {
    executionPlan,
  };

  if (executionPlan.modulesToRun.includes("CONTEXT")) {
    results.context = runContextModule({
      workPlan,
      executionPlan,
      history,
      userMessage,
    });
  }

  if (workPlan.modulePlan.runProtocol) {
    results.protocol = buildProtocolResult({
      workPlan,
      protocolId,
    });
  }

  if (workPlan.modulePlan.runMealSpecialist) {
    const mealType = detectMealType({
      userMessage,
      history,
      workPlan,
    });

    const mealResult = generateMealRecommendation({
      mealType,
      protocolId,
      userMessage: buildMealSpecialistMessage({
        workPlan,
        history,
        userMessage,
        mealType,
        protocolDecision: results.protocol?.foodDecision,
      }),
    });

    results.meal = {
      module: "MEAL_SPECIALIST",
      mealType,
      recommendation: mealResult.recommendation,
      decision: mealResult.decision,
    };
  }

  return results;
}