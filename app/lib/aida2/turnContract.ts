import type { Aida2TurnCognition } from "./turnCognition";
import type { CulinaryPlan } from "./modules/foodDecisionTypes";
import type { Aida2CulinaryMemory } from "./culinaryMemoryTypes";

export type Aida2TurnContractResult = {
  valid: boolean;
  violations: string[];
};

export function verifyTurnContract(params: {
  cognition: Aida2TurnCognition;
  culinaryPlan?: CulinaryPlan | null;
  culinaryMemory?: Aida2CulinaryMemory | null;
}): Aida2TurnContractResult {
  const { cognition, culinaryPlan, culinaryMemory } = params;
  const violations: string[] = [];

  if (cognition.dialogueAct === "VALIDATE_FOOD" && culinaryPlan?.requested) {
    violations.push("Una validación alimentaria no puede transformarse en solicitud de recetas.");
  }

  if (culinaryPlan?.requested && culinaryPlan.recipes.length !== culinaryPlan.requestedCount) {
    violations.push(
      `El plan prometió ${culinaryPlan.requestedCount} opción(es) y produjo ${culinaryPlan.recipes.length}.`
    );
  }

  if (cognition.selectedOption) {
    const exists = culinaryMemory?.options.some(option => option.index === cognition.selectedOption) ?? false;
    if (!exists) violations.push(`La opción ${cognition.selectedOption} no existe en el plan culinario activo.`);
  }

  return { valid: violations.length === 0, violations };
}
