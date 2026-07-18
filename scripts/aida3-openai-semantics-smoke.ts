import assert from "node:assert/strict";
import { OpenAiSemanticProvider, buildTurnPlan, validateRecipeDetailRequest } from "../app/lib/aida3";

const fakeOpenAi = { responses: { create: async () => ({ output_text: JSON.stringify({
  responseLength: "MEDIUM", requests: [
    { id: "validate", kind: "FOOD_VALIDATION", subject: "atún y tostadas", foods: [
      { name: "atún", canonicalName: "atún", category: "PROTEIN" },
      { name: "tostadas", canonicalName: "tostadas", category: "CARBOHYDRATE" },
    ], constraints: {}, dependsOn: [], required: true },
    { id: "options", kind: "MEAL_OPTIONS", subject: "diez opciones", foods: [
      { name: "atún", canonicalName: "atún", category: "PROTEIN" },
    ], constraints: { count: 10 }, dependsOn: ["validate"], required: true },
  ],
}) }) } };

async function main() {
  const provider = new OpenAiSemanticProvider(fakeOpenAi as never, "test-model");
  const understanding = await provider.understand({ message: "Dame 10 opciones con atún y valida las tostadas.", relevantContext: {} });
  const plan = buildTurnPlan({ turnId: "openai-semantic-smoke", protocolId: "FASE_1", understanding });
  assert.equal(plan.tasks.find(task => task.id === "options")?.input.count, 10);
  assert.deepEqual(plan.tasks.find(task => task.id === "options")?.dependsOn, ["validate"]);
  assert.equal(plan.tasks.length, 2);
  assert.deepEqual(validateRecipeDetailRequest({ recipeIds: ["option-2"] }), { valid: true, recipeId: "option-2" });
  const multipleRecipes = validateRecipeDetailRequest({ recipeIds: ["option-1", "option-2"] });
  assert.equal(multipleRecipes.valid, false);
  if (!multipleRecipes.valid) assert.equal(multipleRecipes.status, "NEEDS_USER_INPUT");
  console.log("AIDA3 OPENAI SEMANTICS OK");
  console.log(JSON.stringify(plan, null, 2));
}
void main();
