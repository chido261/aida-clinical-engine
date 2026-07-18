import assert from "node:assert/strict";
import { OpenAiChefTools } from "../app/lib/aida3";

const outputs = [
  { options: Array.from({ length: 4 }, (_, index) => ({ id: `option-${index + 1}`,
    name: `Opción ${index + 1}`, ingredients: ["pulpo"], description: "Opción compatible" })) },
  { beverages: [{ id: "beverage-1", name: "Té verde sin azúcar", ingredients: ["té verde"] }] },
  { recipeId: "option-2", title: "Opción 2", steps: ["Preparar", "Cocinar", "Servir"] },
];
const calls: Array<Record<string, unknown>> = [];
const fakeOpenAi = { responses: { create: async (input: Record<string, unknown>) => {
  calls.push(input);
  return { output_text: JSON.stringify(outputs[calls.length - 1]) };
} } };

async function main() {
  const tools = new OpenAiChefTools(fakeOpenAi as never, "test-model");
  const context = { protocolId: "FASE_1", approvedFoods: ["pulpo"], conditionalFoods: [], count: 4,
    constraints: { atLeastOneIncludes: [], rejectedFoods: ["tostadas"] } };
  const meals = await tools.generateMeals(context);
  const beverages = await tools.generateBeverages({ ...context, count: 1, constraints: { exclude: ["agua"] } });
  const recipe = await tools.explain(meals[1]!);
  assert.equal(meals.length, 4);
  assert.equal(beverages[0]?.name, "Té verde sin azúcar");
  assert.equal(recipe.recipeId, "option-2");
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map(call => (call.text as { format: { name: string } }).format.name),
    ["aida3_meal_options", "aida3_beverage_options", "aida3_recipe_steps"]);
  console.log("AIDA3 CHAT3 FOUNDATION OK");
  console.log(JSON.stringify({ mealCount: meals.length, beverageCount: beverages.length,
    recipe: recipe.title, structuredCalls: calls.length }, null, 2));
}
void main();
