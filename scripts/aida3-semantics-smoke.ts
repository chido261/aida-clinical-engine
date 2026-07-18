import assert from "node:assert/strict";
import { buildTurnPlan, type SemanticTurnUnderstanding } from "../app/lib/aida3";

const understanding: SemanticTurnUnderstanding = {
  originalMessage: "Dame 3 opciones con pulpo; una con aguacate, valida tostada y agrega una bebida.",
  responseLength: "MEDIUM",
  relevantContext: { currentMeal: "comida" },
  requests: [
    { id: "validate-foods", kind: "FOOD_VALIDATION", subject: "pulpo, aguacate y tostada",
      foods: [{ name: "pulpo", category: "PROTEIN" }, { name: "aguacate", category: "HEALTHY_FAT" },
        { name: "tostada", canonicalName: "tostadas", category: "CARBOHYDRATE" }],
      constraints: {}, dependsOn: [], required: true },
    { id: "meal-options", kind: "MEAL_OPTIONS", subject: "tres opciones con pulpo",
      foods: [{ name: "pulpo", category: "PROTEIN" }, { name: "aguacate", category: "HEALTHY_FAT" }],
      constraints: { count: 3, atLeastOneIncludes: ["aguacate"] }, dependsOn: ["validate-foods"], required: true },
    { id: "beverage", kind: "BEVERAGE_OPTIONS", subject: "una bebida sin agua",
      foods: [], constraints: { count: 1, exclude: ["agua"] }, dependsOn: [], required: true },
  ],
};

const plan = buildTurnPlan({ turnId: "semantic-smoke", protocolId: "FASE_1", understanding });
assert.equal(plan.tasks.length, 3);
assert.deepEqual(plan.tasks.map(task => task.expertId), ["NUTRITION", "CHEF", "CHEF"]);
assert.deepEqual(plan.tasks.find(task => task.id === "meal-options")?.dependsOn, ["validate-foods"]);
assert.equal(plan.tasks.find(task => task.id === "meal-options")?.input.count, 3);
assert.deepEqual(plan.tasks.find(task => task.id === "beverage")?.input.exclude, ["agua"]);
assert.deepEqual(plan.tasks.find(task => task.id === "beverage")?.dependsOn, ["validate-foods"]);
assert.equal(plan.relevantContext.protocolId, "FASE_1");
console.log("AIDA3 SEMANTICS OK");
console.log(JSON.stringify(plan, null, 2));
