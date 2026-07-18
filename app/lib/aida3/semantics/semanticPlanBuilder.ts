import type { Aida3Task, Aida3TurnPlan } from "../core/contracts";
import type { ProtocolId } from "../protocols/contracts";
import type { SemanticRequest, SemanticRequestKind, SemanticTurnUnderstanding } from "./contracts";

const ROUTES: Record<SemanticRequestKind, { expertId: string; action: string }> = {
  FOOD_VALIDATION: { expertId: "NUTRITION", action: "VALIDATE_FOODS" },
  MEAL_OPTIONS: { expertId: "CHEF", action: "GENERATE_MEAL_OPTIONS" },
  BEVERAGE_OPTIONS: { expertId: "CHEF", action: "GENERATE_BEVERAGE_OPTIONS" },
  RECIPE_STEPS: { expertId: "CHEF", action: "EXPLAIN_RECIPE" },
  SAFETY_REVIEW: { expertId: "SAFETY", action: "EVALUATE_SAFETY" },
};

function assertUnderstanding(understanding: SemanticTurnUnderstanding) {
  if (!understanding.originalMessage.trim()) throw new Error("AIDA3_SEMANTIC_MESSAGE_REQUIRED");
  if (understanding.requests.length === 0) throw new Error("AIDA3_SEMANTIC_REQUESTS_REQUIRED");
  const ids = new Set<string>();
  for (const request of understanding.requests) {
    if (!request.id.trim() || ids.has(request.id)) throw new Error(`AIDA3_SEMANTIC_INVALID_ID:${request.id}`);
    ids.add(request.id);
  }
  for (const request of understanding.requests) {
    for (const dependency of request.dependsOn) {
      if (!ids.has(dependency) || dependency === request.id) {
        throw new Error(`AIDA3_SEMANTIC_INVALID_DEPENDENCY:${request.id}:${dependency}`);
      }
    }
  }
}

function taskInput(request: SemanticRequest, protocolId: ProtocolId) {
  const common = { ...request.constraints, foods: request.foods, protocolId };
  return request.kind === "FOOD_VALIDATION" ? { protocolId, foods: request.foods } : common;
}

export function buildTurnPlan(params: {
  turnId: string;
  protocolId: ProtocolId;
  understanding: SemanticTurnUnderstanding;
}): Aida3TurnPlan {
  assertUnderstanding(params.understanding);
  const nutritionTaskIds = params.understanding.requests
    .filter(request => request.kind === "FOOD_VALIDATION")
    .map(request => request.id);
  const tasks: Aida3Task[] = params.understanding.requests.map(request => {
    const route = ROUTES[request.kind];
    const requiresNutrition = request.kind === "MEAL_OPTIONS" || request.kind === "BEVERAGE_OPTIONS";
    const dependsOn = [...new Set([...request.dependsOn, ...(requiresNutrition ? nutritionTaskIds : [])])];
    return {
      id: request.id,
      expertId: route.expertId,
      action: route.action,
      subject: request.subject || null,
      input: taskInput(request, params.protocolId),
      dependsOn,
      required: request.required,
    };
  });
  return {
    turnId: params.turnId,
    originalMessage: params.understanding.originalMessage,
    responseLength: params.understanding.responseLength,
    relevantContext: { ...params.understanding.relevantContext, protocolId: params.protocolId },
    tasks,
  };
}
