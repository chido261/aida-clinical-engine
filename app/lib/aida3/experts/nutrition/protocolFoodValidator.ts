import type { ProtocolDocument, ProtocolFoodCatalog } from "../../protocols/contracts";
import type { NutritionCandidate, NutritionFoodDecision } from "./contracts";

export function normalizeFood(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function singular(value: string) {
  if (value.endsWith("es") && value.length > 4) return value.slice(0, -2);
  if (value.endsWith("s") && value.length > 3) return value.slice(0, -1);
  return value;
}

function matches(candidate: string, policyTerm: string) {
  const left = normalizeFood(candidate);
  const right = normalizeFood(policyTerm.split(/\s+(?:como|cuando|si|excepto|en porcion)\b/i)[0] ?? policyTerm);
  if (!left || !right) return false;
  return left === right || singular(left) === singular(right) ||
    ` ${left} `.includes(` ${right} `) || ` ${right} `.includes(` ${left} `);
}

function findMatch(candidate: string, terms: string[]) {
  return terms.filter(term => matches(candidate, term)).sort((a, b) => normalizeFood(b).length - normalizeFood(a).length)[0];
}

const CATEGORY_GROUP: Record<string, keyof ProtocolFoodCatalog | null> = {
  PROTEIN: "proteins", DAIRY: "dairy", HEALTHY_FAT: "healthyFats", VEGETABLE: "vegetables",
  LEGUME: "legumes", FRUIT: "fruits", BEVERAGE: "beverages", SWEETENER: "sweeteners",
  CARBOHYDRATE: null, UNKNOWN: null,
};

export class ProtocolFoodValidator {
  validate(protocol: ProtocolDocument, candidate: NutritionCandidate): NutritionFoodDecision {
    const canonicalFood = candidate.canonicalName?.trim() || candidate.name.trim();
    const conditional = findMatch(canonicalFood, protocol.policies.conditional);
    if (conditional) return {
      food: candidate.name, canonicalFood, status: "CONDITIONAL",
      reason: "El protocolo permite este alimento únicamente con sus condiciones de validación.", evidence: conditional,
    };

    const restricted = findMatch(canonicalFood, protocol.policies.restricted);
    if (restricted) return {
      food: candidate.name, canonicalFood, status: "NOT_ALLOWED",
      reason: "El protocolo no recomienda este alimento en la fase actual.", evidence: restricted,
    };

    for (const [group, values] of Object.entries(protocol.foods) as Array<[keyof ProtocolFoodCatalog, string[]]>) {
      const direct = findMatch(canonicalFood, values);
      if (direct) return {
        food: candidate.name, canonicalFood, status: "ALLOWED",
        reason: `El alimento aparece en la categoría permitida ${group}.`, evidence: direct,
      };
    }

    const categoryGroup = CATEGORY_GROUP[candidate.category ?? "UNKNOWN"];
    if (categoryGroup && protocol.foods[categoryGroup].length > 0) return {
      food: candidate.name, canonicalFood, status: "ALLOWED",
      reason: `La capa semántica lo clasificó dentro de la categoría permitida ${categoryGroup}.`, evidence: categoryGroup,
    };

    return {
      food: candidate.name, canonicalFood, status: "UNKNOWN",
      reason: "No existe evidencia protocolaria suficiente para decidir.", evidence: null,
    };
  }
}
