import assert from "node:assert/strict";
import {
  Aida3Brain, Aida3BrainTurnEngine, Aida3DeterministicResponseAssembler, Aida3ExpertRegistry,
  Aida3TurnOrchestrator, ChefExpert, ConversationExpert, GlucoseExpert, InMemoryCulinaryMemory,
  NutritionExpert, OpenAiCurrentTurnAnalyzer, ProtocolExpert, type BrainContext, type ChefGenerationContext,
  type GeneratedBeverage, type RecipeInstructions, type StoredRecipeOption,
} from "../app/lib/aida3";

const empty = { valueMgDl: null, moment: null, foods: [], count: null, requiredEveryOption: [],
  requiredAtLeastOne: [], validateOnly: [], exclude: [], recipeIds: [] };
const analyses = [
  { responseLength: "SHORT", requests: [{ ...empty, id: "greeting", type: "GREETING" }] },
  { responseLength: "SHORT", requests: [{ ...empty, id: "glucose", type: "GLUCOSE_READING", valueMgDl: 110 }] },
  { responseLength: "SHORT", requests: [{ ...empty, id: "phase", type: "PROTOCOL_STATUS" }] },
  { responseLength: "MEDIUM", requests: [
    { ...empty, id: "meals", type: "MEAL_OPTIONS", count: 3,
      requiredEveryOption: [{ name: "pulpo", canonicalName: "pulpo", category: "PROTEIN" }],
      requiredAtLeastOne: [{ name: "aguacate", canonicalName: "aguacate", category: "HEALTHY_FAT" }],
      validateOnly: [{ name: "tostada", canonicalName: "tostadas", category: "CARBOHYDRATE" }] },
    { ...empty, id: "drink", type: "BEVERAGE_OPTIONS", count: 1, exclude: ["agua"] },
  ] },
  { responseLength: "DETAILED", requests: [{ ...empty, id: "recipe", type: "RECIPE_STEPS", recipeIds: ["option-2"] }] },
];
const analysisInputs: Array<Record<string, unknown>> = [];
const fakeOpenAi = { responses: { create: async (input: Record<string, unknown>) => {
  analysisInputs.push(input);
  return { output_text: JSON.stringify(analyses[analysisInputs.length - 1]) };
} } };

let chefCalls = 0;
const meals = { async generate(context: ChefGenerationContext): Promise<StoredRecipeOption[]> {
  chefCalls += 1;
  assert.deepEqual(context.constraints.requiredEveryOption, ["pulpo"]);
  assert.deepEqual(context.constraints.requiredAtLeastOne, ["aguacate"]);
  return [
    { id: "option-1", name: "Pulpo con aguacate", ingredients: ["pulpo", "aguacate"], description: "Fresca" },
    { id: "option-2", name: "Pulpo al ajillo", ingredients: ["pulpo", "ajo"], description: "Caliente" },
    { id: "option-3", name: "Pulpo con vegetales", ingredients: ["pulpo", "calabacita"], description: "Ligera" },
  ];
} };
const beverages = { async generate(context: ChefGenerationContext): Promise<GeneratedBeverage[]> {
  chefCalls += 1;
  assert.deepEqual(context.constraints.exclude, ["agua"]);
  return [{ id: "beverage-1", name: "Té verde sin azúcar", ingredients: ["agua", "té verde"] }];
} };
const recipes = { async explain(recipe: StoredRecipeOption): Promise<RecipeInstructions> {
  chefCalls += 1;
  return { recipeId: recipe.id, title: recipe.name, steps: ["Corta el pulpo", "Sofríe el ajo", "Sirve"] };
} };

const memory = new InMemoryCulinaryMemory();
const registry = new Aida3ExpertRegistry().register(new ConversationExpert()).register(new GlucoseExpert())
  .register(new ProtocolExpert()).register(new NutritionExpert()).register(new ChefExpert(meals, beverages, recipes, memory));
const engine = new Aida3BrainTurnEngine(new OpenAiCurrentTurnAnalyzer(fakeOpenAi as never, "test-model"),
  new Aida3Brain(), new Aida3TurnOrchestrator(registry), new Aida3DeterministicResponseAssembler());
const context: BrainContext = { protocolId: "FASE_1", conversationId: "chat3-cycle",
  patientName: "David Rodriguez", availableRecipes: [] };

async function main() {
  const greeting = await engine.execute({ turnId: "greeting-turn", message: "Hola", context });
  assert.equal(greeting.response.text, "¡Hola, David! Estoy aquí para orientarte. ¿Qué te gustaría consultar?");
  assert.equal(chefCalls, 0);

  const glucose = await engine.execute({ turnId: "glucose-turn", message: "Tengo 110 de glucosa", context });
  assert.equal(glucose.response.text, "Registré 110 mg/dL.");
  assert.equal(chefCalls, 0);

  const phase = await engine.execute({ turnId: "phase-turn", message: "¿En qué fase estoy?", context });
  assert.equal(phase.response.text, "Estás en la Fase 1.");
  assert.equal(chefCalls, 0);

  const culinary = await engine.execute({ turnId: "culinary-turn",
    message: "Dame 3 opciones con pulpo, una con aguacate, valida tostada y agrega una bebida diferente de agua.", context });
  assert.match(culinary.response.text, /Tostada no se recomienda/);
  assert.match(culinary.response.text, /3\. Pulpo con vegetales/);
  assert.match(culinary.response.text, /Té verde sin azúcar/);
  assert.equal(chefCalls, 2);

  const availableRecipes = (await memory.listOptions(context.conversationId)).map(option => ({ id: option.id, name: option.name }));
  const detail = await engine.execute({ turnId: "recipe-turn", message: "Explícame la opción 2.",
    context: { ...context, availableRecipes } });
  assert.match(detail.response.text, /Pulpo al ajillo/);
  assert.match(detail.response.text, /1\. Corta el pulpo/);
  assert.equal(chefCalls, 3);
  assert.equal(analysisInputs.length, 5);
  const lastInput = JSON.parse(String(analysisInputs[4].input)) as Record<string, unknown>;
  assert.deepEqual(Object.keys(lastInput).sort(), ["culinaryReferences", "currentMessage", "recentConversation"]);
  assert.equal("conversationId" in lastInput, false);

  console.log("AIDA3 CHAT3 CYCLE OK");
  console.log(JSON.stringify({ greeting: greeting.response, glucose: glucose.response, phase: phase.response,
    culinary: culinary.response,
    detail: detail.response, analysisCalls: analysisInputs.length, chefCalls }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
