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

  if (workPlan.understanding.intent === "FOOD_ADVICE") {
    const mealType = detectMealType(userMessage);

    const mealResult = generateMealRecommendation({
      mealType,
      userMessage,
    });

    results.meal = {
      module: "MEAL_SPECIALIST",
      mealType,
      recommendation: mealResult.recommendation,
    };
  }

  return results;
}