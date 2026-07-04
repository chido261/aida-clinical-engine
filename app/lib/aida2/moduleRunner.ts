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
  generateMealRecommendation,
  type MealType,
} from "@/app/lib/aida2/specialists/mealSpecialist";

export type Aida2ModuleRunnerInput = {
  workPlan: Aida2WorkPlan;
  history: string;
  userMessage: string;
};

export type Aida2MealModuleOutput = {
  module: "MEAL_SPECIALIST";
  mealType: MealType;
  recommendation: string;
};

export type Aida2ModuleResults = {
  executionPlan: Aida2ExecutionPlan;
  context?: Aida2ContextModuleOutput;
  meal?: Aida2MealModuleOutput;
};

function detectMealType(message: string): MealType {
  const text = message.toLowerCase();

  if (/\b(desayuno|desayunar|mañana|amanec[ií])\b/i.test(text)) {
    return "desayuno";
  }

  if (/\b(cena|cenar|noche)\b/i.test(text)) {
    return "cena";
  }

  if (/\b(snack|colaci[oó]n|colacion|tentempi[eé]|botana)\b/i.test(text)) {
    return "snack";
  }

  return "comida";
}

function buildMealSpecialistMessage(params: {
  workPlan: Aida2WorkPlan;
  history: string;
  userMessage: string;
}) {
  const { workPlan, history, userMessage } = params;
  const { foodContext, modulePlan } = workPlan;

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

  if (foodContext.needsHistory && history.trim()) {
    lines.push("");
    lines.push("HISTORIAL RECIENTE PARA CONTINUIDAD:");
    lines.push(history);
  }

  lines.push("");
  lines.push("LÍMITE:");
  lines.push(
    "- Clasifica y valida técnicamente con el protocolo. No cambies el objetivo de la conversación."
  );

  return lines.join("\n");
}

export function runAida2Modules(
  input: Aida2ModuleRunnerInput
): Aida2ModuleResults {
  const { workPlan, history, userMessage } = input;

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

  if (workPlan.modulePlan.runMealSpecialist) {
    const mealType = detectMealType(userMessage);

    const mealResult = generateMealRecommendation({
      mealType,
      userMessage: buildMealSpecialistMessage({
        workPlan,
        history,
        userMessage,
      }),
    });

    results.meal = {
      module: "MEAL_SPECIALIST",
      mealType,
      recommendation: mealResult.recommendation,
    };
  }

  return results;
}