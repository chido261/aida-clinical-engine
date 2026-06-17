// app/lib/aida/nutritionEngine.ts

import { buildGeneratedMealOptionsDirective } from "@/app/lib/aida/mealPlanGenerator";
import { interpretNutritionRequest } from "@/app/lib/aida/nutritionRequestInterpreter";

export type NutritionEngineResult = {
  handled: boolean;
  responseMode: "GPT_REDACTION" | "NONE";
  directive: string | null;
  reason: string;
};

export function runNutritionEngine(params: {
  text: string;
  activeProtocol: string;
  activePhase?: string | null;
}): NutritionEngineResult {
  const request = interpretNutritionRequest(params.text);

  if (!request.handled) {
    return {
      handled: false,
      responseMode: "NONE",
      directive: null,
      reason: request.reason,
    };
  }

  const directive = buildGeneratedMealOptionsDirective({
    text: params.text,
    activeProtocol: params.activeProtocol,
  });

  if (!directive) {
    return {
      handled: false,
      responseMode: "NONE",
      directive: null,
      reason: "La solicitud nutricional fue detectada, pero aún no tiene directiva generada.",
    };
  }

  return {
    handled: true,
    responseMode: "GPT_REDACTION",
    directive,
    reason: request.reason,
  };
}