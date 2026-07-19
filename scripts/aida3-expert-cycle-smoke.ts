import assert from "node:assert/strict";
import {
  Aida3Brain, Aida3ExpertRegistry, Aida3TurnOrchestrator, ChefExpert, ConversationExpert, GlucoseExpert,
  InMemoryCulinaryMemory, NutritionExpert, ProtocolExpert, type BrainContext, type ChefGenerationContext,
  type CurrentTurnAnalysis, type GeneratedBeverage, type RecipeInstructions, type StoredRecipeOption,
} from "../app/lib/aida3";

const calls: ChefGenerationContext[] = [];
const meals = { async generate(context: ChefGenerationContext): Promise<StoredRecipeOption[]> {
  calls.push(context);
  return [
    { id: "option-1", name: "Pulpo con aguacate", ingredients: ["pulpo", "aguacate", "jitomate"], description: "Fresca" },
    { id: "option-2", name: "Pulpo al ajillo", ingredients: ["pulpo", "ajo", "espárragos"], description: "Caliente" },
    { id: "option-3", name: "Pulpo con vegetales", ingredients: ["pulpo", "calabacita"], description: "Ligera" },
  ];
} };
const beverages = { async generate(context: ChefGenerationContext): Promise<GeneratedBeverage[]> {
  calls.push(context);
  return [{ id: "beverage-1", name: "Té verde sin azúcar", ingredients: ["agua", "té verde"] }];
} };
const recipes = { async explain(option: StoredRecipeOption): Promise<RecipeInstructions> {
  return { recipeId: option.id, title: option.name, steps: ["Preparar", "Cocinar", "Servir"] };
} };

const registry = new Aida3ExpertRegistry()
  .register(new ConversationExpert())
  .register(new GlucoseExpert())
  .register(new ProtocolExpert())
  .register(new NutritionExpert())
  .register(new ChefExpert(meals, beverages, recipes, new InMemoryCulinaryMemory()));
const orchestrator = new Aida3TurnOrchestrator(registry);
const brain = new Aida3Brain();
const context: BrainContext = { protocolId: "FASE_1", conversationId: "expert-cycle", patientName: "David Rodriguez",
  availableRecipes: [{ id: "stale", name: "Receta anterior con aguacate" }] };

async function run(analysis: CurrentTurnAnalysis) {
  const compiled = brain.compile({ turnId: `turn-${analysis.requests[0].id}`, message: analysis.currentMessage, analysis, context });
  return orchestrator.execute(compiled.plan);
}

async function main() {
  const greeting = await run({ currentMessage: "Hola", responseLength: "SHORT",
    requests: [{ id: "greeting", type: "GREETING" }] });
  assert.equal(greeting.status, "READY_FOR_HUMANIZER");
  assert.deepEqual(greeting.bundle.results.map(result => result.expertId), ["CONVERSATION"]);
  assert.equal(greeting.bundle.results[0].patientSummary,
    "¡Hola, David! Estoy aquí para orientarte. ¿Qué te gustaría consultar?");

  const glucose = await run({ currentMessage: "Tengo 110 de glucosa", responseLength: "SHORT",
    requests: [{ id: "glucose", type: "GLUCOSE_READING", valueMgDl: 110, moment: null }] });
  assert.equal(glucose.status, "READY_FOR_HUMANIZER");
  assert.deepEqual(glucose.bundle.results.map(result => result.expertId), ["GLUCOSE"]);
  assert.equal(glucose.bundle.results[0].patientSummary, "Registré 110 mg/dL.");

  const phase = await run({ currentMessage: "¿En qué fase estoy?", responseLength: "SHORT",
    requests: [{ id: "phase", type: "PROTOCOL_STATUS" }] });
  assert.equal(phase.status, "READY_FOR_HUMANIZER");
  assert.deepEqual(phase.bundle.results.map(result => result.expertId), ["PROTOCOL"]);
  assert.equal(phase.bundle.results[0].patientSummary, "Estás en la Fase 1.");

  const culinary = await run({ currentMessage: "Dame 3 opciones con pulpo, una con aguacate, valida tostada y agrega una bebida.",
    responseLength: "MEDIUM", requests: [
      { id: "meals", type: "MEAL_OPTIONS", count: 3,
        requiredEveryOption: [{ name: "pulpo", category: "PROTEIN" }],
        requiredAtLeastOne: [{ name: "aguacate", category: "HEALTHY_FAT" }],
        validateOnly: [{ name: "tostada", canonicalName: "tostadas", category: "CARBOHYDRATE" }] },
      { id: "drink", type: "BEVERAGE_OPTIONS", count: 1, exclude: ["agua"] },
    ] });
  assert.equal(culinary.status, "READY_FOR_HUMANIZER");
  assert.deepEqual(culinary.bundle.results.map(result => result.expertId), ["NUTRITION", "CHEF", "CHEF"]);
  const mealCall = calls.find(call => call.constraints.requiredEveryOption.length > 0);
  const beverageCall = calls.find(call => call.constraints.exclude.length > 0);
  assert.deepEqual(mealCall?.constraints.requiredEveryOption, ["pulpo"]);
  assert.deepEqual(mealCall?.constraints.requiredAtLeastOne, ["aguacate"]);
  assert.deepEqual(beverageCall?.constraints.exclude, ["agua"]);
  assert.equal(calls.length, 2);

  console.log("AIDA3 EXPERT CYCLE OK");
  console.log(JSON.stringify({ greeting: greeting.bundle.results, glucose: glucose.bundle.results, phase: phase.bundle.results,
    culinary: culinary.bundle.results, chefCalls: calls.length }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
