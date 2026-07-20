import assert from "node:assert/strict";
import {
  Aida3ExpertRegistry, Aida3SpecialistResponseAssembler, Aida3TurnOrchestrator, NutritionExpert,
  OpenAiNutritionResponseWriter, OpenAiStructuredSpecialistClient, type Aida3TurnPlan,
} from "../app/lib/aida3";

const calls: Array<Record<string, unknown>> = [];
const fakeOpenAi = { responses: { create: async (input: Record<string, unknown>) => {
  calls.push(input);
  return { output_text: JSON.stringify({
    patientSummary: "El pulpo es compatible con tu protocolo actual. Las tostadas no se recomiendan en esta fase.",
    decisions: [
      { food: "pulpo", status: "ALLOWED" },
      { food: "tostadas", status: "NOT_ALLOWED" },
    ],
  }) };
} } };

const specialistClient = new OpenAiStructuredSpecialistClient(fakeOpenAi as never, "test-model");
const nutrition = new NutritionExpert(undefined, undefined,
  new OpenAiNutritionResponseWriter(specialistClient));
const registry = new Aida3ExpertRegistry().register(nutrition);
const orchestrator = new Aida3TurnOrchestrator(registry);
const assembler = new Aida3SpecialistResponseAssembler();

const plan: Aida3TurnPlan = {
  turnId: "openai-nutrition", originalMessage: "¿Puedo comer pulpo con tostadas?",
  responseLength: "SHORT", relevantContext: {}, tasks: [{
    id: "nutrition", expertId: "NUTRITION", action: "VALIDATE_FOODS",
    subject: "pulpo con tostadas", input: { protocolId: "FASE_1", foods: [
      { name: "pulpo", category: "PROTEIN" },
      { name: "tostadas", category: "CARBOHYDRATE" },
    ] }, dependsOn: [], required: true,
  }],
};

async function main() {
  const outcome = await orchestrator.execute(plan);
  assert.equal(outcome.status, "READY_FOR_HUMANIZER");
  const result = outcome.bundle.results[0];
  const foods = result.data.foods as Array<{ food: string; status: string }>;
  assert.equal(result.decision, "PARTIALLY_COMPATIBLE");
  assert.deepEqual(foods.map(food => [food.food, food.status]), [
    ["pulpo", "ALLOWED"], ["tostadas", "NOT_ALLOWED"],
  ]);
  assert.equal(result.data.narrativeSource, "OPENAI");
  assert.equal(calls.length, 1);

  const specialistInput = JSON.parse(String(calls[0].input)) as {
    originalMessage: string; protocolName: string; foods: unknown[];
  };
  assert.equal(specialistInput.originalMessage, plan.originalMessage);
  assert.match(specialistInput.protocolName, /Fase 1/);
  assert.equal(specialistInput.foods.length, 2);

  const response = assembler.compose(outcome);
  assert.equal(response.text,
    "El pulpo es compatible con tu protocolo actual. Las tostadas no se recomiendan en esta fase.");

  const tamperingOpenAi = { responses: { create: async () => ({ output_text: JSON.stringify({
    patientSummary: "Todo está permitido.",
    decisions: [{ food: "pulpo", status: "ALLOWED" }, { food: "tostadas", status: "ALLOWED" }],
  }) }) } };
  const tamperingClient = new OpenAiStructuredSpecialistClient(tamperingOpenAi as never, "test-model");
  const protectedNutrition = new NutritionExpert(undefined, undefined,
    new OpenAiNutritionResponseWriter(tamperingClient));
  const protectedOutcome = await new Aida3TurnOrchestrator(
    new Aida3ExpertRegistry().register(protectedNutrition)).execute(plan);
  const protectedResult = protectedOutcome.bundle.results[0];
  assert.equal(protectedResult.data.narrativeSource, "DETERMINISTIC_FALLBACK");
  assert.equal((protectedResult.data.foods as Array<{ status: string }>)[1].status, "NOT_ALLOWED");

  console.log("AIDA3 OPENAI NUTRITION SPECIALIST OK");
  console.log(JSON.stringify({ specialistCalls: calls.length, decision: result.decision,
    verifiedFoods: foods, rejectedChangedDecision: true, response: response.text }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
