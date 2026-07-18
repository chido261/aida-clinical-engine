import assert from "node:assert/strict";
import {
  Aida3ExpertRegistry, Aida3TurnOrchestrator, ChefExpert, InMemoryCulinaryMemory, NutritionExpert,
  type BeverageOptionsTool, type MealOptionsTool, type RecipeStepsTool, type Aida3TurnPlan,
} from "../app/lib/aida3";

const meals: MealOptionsTool = { generate: async input => Array.from({ length: input.count }, (_, index) => ({
  id: `option-${index + 1}`, name: `Pulpo opción ${index + 1}`,
  ingredients: index === 0 ? ["pulpo", "aguacate", "jitomate"] : ["pulpo", "espárragos"],
  description: `Opción compatible ${index + 1}`,
})) };
const beverages: BeverageOptionsTool = { generate: async input => Array.from({ length: input.count }, (_, index) => ({
  id: `beverage-${index + 1}`, name: "Té verde sin azúcar", ingredients: ["té verde"],
})) };
const recipes: RecipeStepsTool = { explain: async recipe => ({ recipeId: recipe.id, title: recipe.name,
  steps: ["Preparar ingredientes", "Cocinar el pulpo", "Servir"] }) };

const registry = new Aida3ExpertRegistry().register(new NutritionExpert()).register(
  new ChefExpert(meals, beverages, recipes, new InMemoryCulinaryMemory())
);
const orchestrator = new Aida3TurnOrchestrator(registry);
const firstTurn: Aida3TurnPlan = { turnId: "chef-turn-1", originalMessage: "Dame 5 opciones con pulpo, una con aguacate, y un té.",
  responseLength: "MEDIUM", relevantContext: { conversationId: "conversation-1" }, tasks: [
    { id: "nutrition", expertId: "NUTRITION", action: "VALIDATE_FOODS", subject: "pulpo y aguacate",
      input: { protocolId: "FASE_1", foods: [{ name: "pulpo", category: "PROTEIN" }, { name: "aguacate", category: "HEALTHY_FAT" }] },
      dependsOn: [], required: true },
    { id: "options", expertId: "CHEF", action: "GENERATE_MEAL_OPTIONS", subject: "cinco opciones",
      input: { protocolId: "FASE_1", count: 5, atLeastOneIncludes: ["aguacate"] }, dependsOn: ["nutrition"], required: true },
    { id: "drink", expertId: "CHEF", action: "GENERATE_BEVERAGE_OPTIONS", subject: "una bebida",
      input: { protocolId: "FASE_1", count: 1, exclude: ["agua"] }, dependsOn: ["nutrition"], required: true },
  ] };

async function main() {
  const first = await orchestrator.execute(firstTurn);
  assert.equal(first.status, "READY_FOR_HUMANIZER");
  assert.equal(first.bundle.results.find(result => result.taskId === "options")?.data.count, 5);
  assert.equal(first.bundle.results.find(result => result.taskId === "drink")?.data.count, 1);

  const detail = await orchestrator.execute({ turnId: "chef-turn-2", originalMessage: "Explícame la opción 2.", responseLength: "DETAILED",
    relevantContext: { conversationId: "conversation-1" }, tasks: [{ id: "recipe", expertId: "CHEF", action: "EXPLAIN_RECIPE",
      subject: "opción 2", input: { recipeIds: ["option-2"] }, dependsOn: [], required: true }] });
  assert.equal(detail.bundle.results[0]?.decision, "RECIPE_EXPLAINED");
  assert.equal((detail.bundle.results[0]?.data.recipe as { id: string }).id, "option-2");

  const multiple = await orchestrator.execute({ turnId: "chef-turn-3", originalMessage: "Explícame la 1 y la 2.", responseLength: "SHORT",
    relevantContext: { conversationId: "conversation-1" }, tasks: [{ id: "recipes", expertId: "CHEF", action: "EXPLAIN_RECIPE",
      subject: "dos recetas", input: { recipeIds: ["option-1", "option-2"] }, dependsOn: [], required: true }] });
  assert.equal(multiple.status, "NEEDS_USER_INPUT");
  assert.match(multiple.bundle.results[0]?.patientSummary ?? "", /una receta a la vez/i);
  console.log("AIDA3 CHEF OK");
  console.log(JSON.stringify({ first: first.bundle.results, detail: detail.bundle.results, multiple: multiple.bundle.results }, null, 2));
}
void main();
