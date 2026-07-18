import assert from "node:assert/strict";
import { Aida3Brain, type BrainContext, type CurrentTurnAnalysis } from "../app/lib/aida3";

const brain = new Aida3Brain();
const context: BrainContext = { protocolId: "FASE_1", conversationId: "brain-test",
  availableRecipes: [{ id: "old-option-1", name: "Receta anterior con aguacate" }] };

const greeting: CurrentTurnAnalysis = { currentMessage: "Hola", responseLength: "SHORT",
  requests: [{ id: "greeting", type: "GREETING" }] };
const greetingPlan = brain.compile({ turnId: "brain-greeting", message: "Hola", analysis: greeting, context }).plan;
assert.deepEqual(greetingPlan.tasks.map(task => task.expertId), ["CONVERSATION"]);

const glucose: CurrentTurnAnalysis = { currentMessage: "Tengo 110 de glucosa", responseLength: "SHORT",
  requests: [{ id: "glucose", type: "GLUCOSE_READING", valueMgDl: 110, moment: null }] };
const glucosePlan = brain.compile({ turnId: "brain-glucose", message: glucose.currentMessage, analysis: glucose, context }).plan;
assert.deepEqual(glucosePlan.tasks.map(task => task.expertId), ["GLUCOSE"]);

const phase: CurrentTurnAnalysis = { currentMessage: "¿En qué fase estoy?", responseLength: "SHORT",
  requests: [{ id: "phase", type: "PROTOCOL_STATUS" }] };
const phasePlan = brain.compile({ turnId: "brain-phase", message: phase.currentMessage, analysis: phase, context }).plan;
assert.deepEqual(phasePlan.tasks.map(task => task.expertId), ["PROTOCOL"]);

const culinary: CurrentTurnAnalysis = { currentMessage: "Dame 3 opciones con pulpo; una con aguacate, valida tostada y agrega té.",
  responseLength: "MEDIUM", requests: [
    { id: "meals", type: "MEAL_OPTIONS", count: 3,
      requiredEveryOption: [{ name: "pulpo", category: "PROTEIN" }],
      requiredAtLeastOne: [{ name: "aguacate", category: "HEALTHY_FAT" }],
      validateOnly: [{ name: "tostada", canonicalName: "tostadas", category: "CARBOHYDRATE" }] },
    { id: "drink", type: "BEVERAGE_OPTIONS", count: 1, exclude: ["agua"] },
  ] };
const culinaryPlan = brain.compile({ turnId: "brain-food", message: culinary.currentMessage, analysis: culinary, context }).plan;
assert.deepEqual(culinaryPlan.tasks.map(task => `${task.expertId}:${task.action}`), [
  "NUTRITION:VALIDATE_FOODS", "CHEF:GENERATE_MEAL_OPTIONS", "CHEF:GENERATE_BEVERAGE_OPTIONS",
]);
assert.deepEqual(culinaryPlan.tasks.find(task => task.id === "meals")?.input.requiredEveryOption,
  [{ name: "pulpo", category: "PROTEIN" }]);
assert.deepEqual(culinaryPlan.tasks.find(task => task.id === "meals")?.input.requiredAtLeastOne,
  [{ name: "aguacate", category: "HEALTHY_FAT" }]);
assert.deepEqual(culinaryPlan.tasks.find(task => task.id === "meals")?.input.validateOnly,
  [{ name: "tostada", canonicalName: "tostadas", category: "CARBOHYDRATE" }]);
console.log("AIDA3 BRAIN CYCLE OK");
console.log(JSON.stringify({ greeting: greetingPlan.tasks, glucose: glucosePlan.tasks, phase: phasePlan.tasks,
  culinary: culinaryPlan.tasks }, null, 2));
