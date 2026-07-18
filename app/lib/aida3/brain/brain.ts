import type { Aida3Task } from "../core/contracts";
import type { NutritionCandidate } from "../experts/nutrition";
import type { BrainCompilation, BrainContext, BrainRequest, CurrentTurnAnalysis } from "./contracts";

function uniqueFoods(values: NutritionCandidate[]) {
  const seen = new Set<string>();
  return values.filter(food => {
    const key = (food.canonicalName || food.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validateAnalysis(message: string, analysis: CurrentTurnAnalysis) {
  if (analysis.currentMessage !== message) throw new Error("AIDA3_BRAIN_MESSAGE_CHANGED");
  if (!analysis.requests.length) throw new Error("AIDA3_BRAIN_EMPTY_REQUEST_LIST");
  if (new Set(analysis.requests.map(request => request.id)).size !== analysis.requests.length) {
    throw new Error("AIDA3_BRAIN_DUPLICATE_REQUEST_ID");
  }
}

function nutritionTask(id: string, foods: NutritionCandidate[], context: BrainContext): Aida3Task {
  return { id, expertId: "NUTRITION", action: "VALIDATE_FOODS", subject: "validación de alimentos",
    input: { protocolId: context.protocolId, foods: uniqueFoods(foods) }, dependsOn: [], required: true };
}

export class Aida3Brain {
  compile(params: { turnId: string; message: string; analysis: CurrentTurnAnalysis; context: BrainContext }): BrainCompilation {
    validateAnalysis(params.message, params.analysis);
    const tasks: Aida3Task[] = [];
    const explicitValidation = params.analysis.requests.filter((request): request is Extract<BrainRequest, { type: "FOOD_VALIDATION" }> =>
      request.type === "FOOD_VALIDATION");
    const culinary = params.analysis.requests.filter((request): request is Extract<BrainRequest, { type: "MEAL_OPTIONS" }> =>
      request.type === "MEAL_OPTIONS");
    const foodsToValidate = uniqueFoods([
      ...explicitValidation.flatMap(request => request.foods),
      ...culinary.flatMap(request => [...request.requiredEveryOption, ...request.requiredAtLeastOne, ...request.validateOnly]),
    ]);
    const nutritionId = foodsToValidate.length ? "brain-nutrition" : null;
    if (nutritionId) tasks.push(nutritionTask(nutritionId, foodsToValidate, params.context));

    for (const request of params.analysis.requests) {
      if (request.type === "FOOD_VALIDATION") continue;
      if (request.type === "GREETING") tasks.push({ id: request.id, expertId: "CONVERSATION", action: "GREET",
        subject: "saludo", input: {}, dependsOn: [], required: true });
      if (request.type === "PROTOCOL_STATUS") tasks.push({ id: request.id, expertId: "PROTOCOL", action: "GET_CURRENT_PROTOCOL",
        subject: "fase actual", input: { protocolId: params.context.protocolId }, dependsOn: [], required: true });
      if (request.type === "GLUCOSE_READING") tasks.push({ id: request.id, expertId: "GLUCOSE", action: "RECORD_READING",
        subject: "lectura de glucosa", input: { valueMgDl: request.valueMgDl, moment: request.moment }, dependsOn: [], required: true });
      if (request.type === "MEAL_OPTIONS") tasks.push({ id: request.id, expertId: "CHEF", action: "GENERATE_MEAL_OPTIONS",
        subject: "opciones de comida", input: { protocolId: params.context.protocolId, count: request.count,
          requiredEveryOption: request.requiredEveryOption, requiredAtLeastOne: request.requiredAtLeastOne,
          validateOnly: request.validateOnly }, dependsOn: nutritionId ? [nutritionId] : [], required: true });
      if (request.type === "BEVERAGE_OPTIONS") tasks.push({ id: request.id, expertId: "CHEF", action: "GENERATE_BEVERAGE_OPTIONS",
        subject: "opciones de bebida", input: { protocolId: params.context.protocolId, count: request.count,
          exclude: request.exclude }, dependsOn: [], required: true });
      if (request.type === "RECIPE_STEPS") tasks.push({ id: request.id, expertId: "CHEF", action: "EXPLAIN_RECIPE",
        subject: "detalle de receta", input: { recipeIds: request.recipeIds }, dependsOn: [], required: true });
    }
    return { analysis: params.analysis, plan: { turnId: params.turnId, originalMessage: params.message,
      responseLength: params.analysis.responseLength, relevantContext: { ...params.context }, tasks } };
  }
}
