import assert from "node:assert/strict";
import {
  Aida3ExpertRegistry, Aida3TurnEngine, Aida3TurnOrchestrator, Aida3TurnResponseComposer,
  ChefExpert, InMemoryCulinaryMemory, NutritionExpert, type BeverageOptionsTool, type HumanizerProvider,
  type MealOptionsTool, type RecipeStepsTool, type SemanticTurnUnderstanding, type SemanticUnderstandingProvider,
} from "../app/lib/aida3";

const turns: SemanticTurnUnderstanding[] = [
  { originalMessage: "Dame 3 opciones con pulpo; una con aguacate, valida tostada y agrega una bebida.",
    responseLength: "MEDIUM", relevantContext: { conversationId: "e2e-conversation" }, requests: [
      { id: "nutrition", kind: "FOOD_VALIDATION", subject: "pulpo, aguacate y tostada",
        foods: [{ name: "pulpo", category: "PROTEIN" }, { name: "aguacate", category: "HEALTHY_FAT" },
          { name: "tostada", canonicalName: "tostadas", category: "CARBOHYDRATE" }],
        constraints: {}, dependsOn: [], required: true },
      { id: "options", kind: "MEAL_OPTIONS", subject: "tres opciones con pulpo",
        foods: [{ name: "pulpo", category: "PROTEIN" }, { name: "aguacate", category: "HEALTHY_FAT" }],
        constraints: { count: 3, atLeastOneIncludes: ["aguacate"] }, dependsOn: ["nutrition"], required: true },
      { id: "drink", kind: "BEVERAGE_OPTIONS", subject: "una bebida distinta de agua", foods: [],
        constraints: { count: 1, exclude: ["agua"] }, dependsOn: ["nutrition"], required: true },
    ] },
  { originalMessage: "Explícame la opción 2.", responseLength: "DETAILED",
    relevantContext: { conversationId: "e2e-conversation" }, requests: [
      { id: "recipe", kind: "RECIPE_STEPS", subject: "opción 2", foods: [],
        constraints: { recipeIds: ["option-2"] }, dependsOn: [], required: true },
    ] },
];
let semanticCalls = 0;
const semantics: SemanticUnderstandingProvider = { understand: async ({ message, relevantContext }) => {
  const turn = turns[semanticCalls++];
  assert.equal(turn?.originalMessage, message);
  return { ...turn, relevantContext: { ...relevantContext, conversationId: "e2e-conversation" } };
} };

const meals: MealOptionsTool = { generate: async input => Array.from({ length: input.count }, (_, index) => ({
  id: `option-${index + 1}`, name: ["Pulpo con aguacate", "Pulpo al ajillo", "Ensalada de pulpo"][index]!,
  ingredients: index === 0 ? ["pulpo", "aguacate", "jitomate"] : ["pulpo", "espárragos"],
  description: "Compatible con los alimentos aprobados",
})) };
const beverages: BeverageOptionsTool = { generate: async () => [
  { id: "beverage-1", name: "Té verde sin azúcar", ingredients: ["té verde"] },
] };
const recipes: RecipeStepsTool = { explain: async recipe => ({ recipeId: recipe.id, title: recipe.name,
  steps: ["Corta el pulpo.", "Sofríe el ajo.", "Agrega los espárragos."] }) };

function requiredText(result: { data: Record<string, unknown>; patientSummary: string | null }) {
  const data = result.data;
  if (Array.isArray(data.foods)) return data.foods.map(item => {
    const food = item as { food: string; status: string };
    return food.status === "ALLOWED" ? `${food.food} es compatible` :
      food.status === "CONDITIONAL" ? `${food.food} requiere validación` : `${food.food} no se recomienda en esta fase`;
  }).join("; ");
  if (Array.isArray(data.options)) return data.options.map(item => (item as { name: string }).name).join("; ");
  if (Array.isArray(data.beverages)) return data.beverages.map(item => (item as { name: string }).name).join("; ");
  const instructions = data.instructions as { steps?: string[] } | undefined;
  if (instructions?.steps) return `${(data.recipe as { name: string }).name}: ${instructions.steps.join(" ")}`;
  return result.patientSummary ?? "";
}
const humanizer: HumanizerProvider = { humanize: async input => ({ parts: input.results.map(result => ({
  taskId: result.taskId, decision: result.decision, text: requiredText(result),
})) }) };

async function main() {
  const memory = new InMemoryCulinaryMemory();
  const registry = new Aida3ExpertRegistry().register(new NutritionExpert())
    .register(new ChefExpert(meals, beverages, recipes, memory));
  const engine = new Aida3TurnEngine(semantics, new Aida3TurnOrchestrator(registry),
    new Aida3TurnResponseComposer(humanizer));

  const first = await engine.execute({ turnId: "e2e-1", message: turns[0]!.originalMessage,
    protocolId: "FASE_1", relevantContext: { conversationId: "e2e-conversation" } });
  assert.equal(semanticCalls, 1);
  assert.equal(first.outcome.status, "READY_FOR_HUMANIZER");
  assert.deepEqual(first.response.coveredTaskIds, ["nutrition", "options", "drink"]);
  assert.match(first.response.text, /Pulpo con aguacate/);
  assert.match(first.response.text, /Té verde sin azúcar/);
  assert.match(first.response.text, /tostada no se recomienda en esta fase/i);

  const second = await engine.execute({ turnId: "e2e-2", message: turns[1]!.originalMessage,
    protocolId: "FASE_1", relevantContext: { conversationId: "e2e-conversation" } });
  assert.equal(semanticCalls, 2);
  assert.equal(second.outcome.bundle.results[0]?.decision, "RECIPE_EXPLAINED");
  assert.match(second.response.text, /Pulpo al ajillo/);
  assert.match(second.response.text, /Sofríe el ajo/);
  console.log("AIDA3 E2E OK");
  console.log(JSON.stringify({ first: first.response, second: second.response, semanticCalls }, null, 2));
}
void main();
