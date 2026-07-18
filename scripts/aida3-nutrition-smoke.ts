import assert from "node:assert/strict";
import { Aida3ExpertRegistry, Aida3TurnOrchestrator, NutritionExpert, type Aida3TurnPlan } from "../app/lib/aida3";

const registry = new Aida3ExpertRegistry();
registry.register(new NutritionExpert());
const orchestrator = new Aida3TurnOrchestrator(registry);

const plan: Aida3TurnPlan = {
  turnId: "nutrition-smoke", originalMessage: "¿Puedo comer pulpo con tostadas?", responseLength: "SHORT",
  relevantContext: {}, tasks: [
    { id: "phase-one", expertId: "NUTRITION", action: "VALIDATE_FOODS", subject: "pulpo con tostadas",
      input: { protocolId: "FASE_1", foods: [
        { name: "pulpo", category: "PROTEIN" }, { name: "tostadas", category: "CARBOHYDRATE" },
      ] }, dependsOn: [], required: true },
    { id: "phase-two", expertId: "NUTRITION", action: "VALIDATE_FOODS", subject: "tostada horneada",
      input: { protocolId: "FASE_2", foods: [{ name: "tostada", canonicalName: "tostadas horneadas", category: "CARBOHYDRATE" }] },
      dependsOn: [], required: true },
    { id: "unknown", expertId: "NUTRITION", action: "VALIDATE_FOODS", subject: "alimento desconocido",
      input: { protocolId: "FASE_1", foods: [{ name: "alimento lunar", category: "UNKNOWN" }] },
      dependsOn: [], required: true },
  ],
};

async function main() {
  const outcome = await orchestrator.execute(plan);
  assert.equal(outcome.status, "READY_FOR_HUMANIZER");
  const phaseOne = outcome.bundle.results.find(result => result.taskId === "phase-one")!;
  const phaseOneFoods = phaseOne.data.foods as Array<{ food: string; status: string }>;
  assert.equal(phaseOne.decision, "PARTIALLY_COMPATIBLE");
  assert.equal(phaseOneFoods.find(food => food.food === "pulpo")?.status, "ALLOWED");
  assert.equal(phaseOneFoods.find(food => food.food === "tostadas")?.status, "NOT_ALLOWED");
  const phaseTwoFoods = outcome.bundle.results.find(result => result.taskId === "phase-two")!.data.foods as Array<{ status: string }>;
  assert.equal(phaseTwoFoods[0]?.status, "CONDITIONAL");
  assert.equal(outcome.bundle.results.find(result => result.taskId === "unknown")?.decision, "REQUIRES_REVIEW");
  console.log("AIDA3 NUTRITION OK");
  console.log(JSON.stringify(outcome.bundle.results, null, 2));
}

void main();
