import type { ProtocolModuleOutput } from "./protocolModule";
import {
  CLINICAL_TERMS,
  classifyFood,
  normalizeFoodText,
} from "./foodClassifier";
import {
  PREPARATION_NAMES,
  PREPARATION_TERMS,
  analyzePreparation,
} from "./preparationAnalyzer";
import type {
  FoodValidation,
  MealDecisionStatus,
  MealSpecialistDecision,
  SemanticFoodInterpretation,
} from "./foodDecisionTypes";

const COMMON_RESTRICTED_TERMS = [
  "pan", "pan blanco", "pan integral", "tostada", "tostadas", "tortilla", "tortillas",
  "arroz", "pasta", "avena", "cereal", "cereales", "granola", "galleta", "galletas",
  "papa", "papas", "camote", "azúcar", "azucar", "refresco", "refrescos",
  "jugo", "jugos", "postre", "postres", "miel",
];

export type ProtocolFoodEvaluation = {
  validations: FoodValidation[];
  incompatibleFoods: FoodValidation[];
  compatibleFoods: FoodValidation[];
  conditionalFoods: string[];
  decision: MealSpecialistDecision;
};

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter(value => {
    const normalized = normalizeFoodText(value);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function flattenAllowed(protocol: ProtocolModuleOutput) {
  const foods = protocol.structured.allowedFoods;
  return [
    ...foods.proteins,
    ...foods.dairy,
    ...foods.healthyFats,
    ...foods.vegetables,
    ...foods.legumes,
    ...foods.fruits,
    ...foods.beverages,
  ];
}

function extractBullets(text: string) {
  return text
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("- "))
    .map(line => line.slice(2).trim())
    .filter(Boolean);
}

function restrictedTerms(protocol: ProtocolModuleOutput) {
  const text = protocol.sections.restrictedFoods ?? "";
  const normalizedText = normalizeFoodText(text);
  const bullets = extractBullets(text)
    .map(item => item.split(/\s+(?:como|cuando|si|excepto|en porci[oó]n)\b/i)[0]?.trim() ?? item)
    .filter(item => item.split(/\s+/).length <= 5);
  const common = COMMON_RESTRICTED_TERMS.filter(term =>
    ` ${normalizedText} `.includes(` ${normalizeFoodText(term)} `)
  );
  return unique([...bullets, ...common]);
}

function conditionalTerms(protocol: ProtocolModuleOutput) {
  const values: string[] = [];
  Object.values(protocol.sections).forEach(section => {
    const matches = section.matchAll(
      /(?:PERMITIDOS CON VALIDACI[ÓO]N|ALIMENTOS CON VALIDACI[ÓO]N)[:\s]*([\s\S]*?)(?=\n(?:##|#|EVITAR|NO RECOMENDADOS)|$)/gi
    );
    for (const match of matches) values.push(...extractBullets(match[1] ?? ""));
  });
  return unique(values);
}

function extractCandidates(message: string, terms: string[]) {
  const normalizedMessage = normalizeFoodText(message);
  const matches = unique(terms)
    .filter(term => ` ${normalizedMessage} `.includes(` ${normalizeFoodText(term)} `))
    .sort((left, right) => normalizeFoodText(right).length - normalizeFoodText(left).length);
  const selected: string[] = [];

  for (const term of matches) {
    const normalized = normalizeFoodText(term);
    const overlaps = selected.some(existing => {
      const current = normalizeFoodText(existing);
      return current.includes(normalized) || normalized.includes(current);
    });
    if (!overlaps) selected.push(term);
  }

  return selected;
}

function matches(candidate: string, term: string) {
  const left = normalizeFoodText(candidate);
  const right = normalizeFoodText(term);
  const singularLeft = left.endsWith("s") ? left.slice(0, -1) : left;
  const singularRight = right.endsWith("s") ? right.slice(0, -1) : right;
  return left === right ||
    singularLeft === singularRight ||
    ` ${left} `.includes(` ${right} `);
}

function validateCandidate(params: {
  candidate: string;
  protocol: ProtocolModuleOutput;
  restricted: string[];
  conditional: string[];
}): FoodValidation {
  const { candidate, protocol, restricted, conditional } = params;
  const conditionalMatch = conditional.find(term => matches(candidate, term));
  if (conditionalMatch) {
    return {
      food: candidate,
      canonicalFood: conditionalMatch,
      category: "carbohidrato saludable con validación",
      isCompatible: true,
      reason: "el protocolo lo permite con porción controlada y validación de glucosa",
      source: "protocol_conditional",
    };
  }

  const restrictedMatch = restricted.find(term => matches(candidate, term));
  if (restrictedMatch) {
    return {
      food: candidate,
      canonicalFood: restrictedMatch,
      category: "carbohidrato de alta carga glucémica",
      isCompatible: false,
      reason: "eleva la carga glucémica y se restringe en esta fase",
      source: "restricted",
    };
  }

  return classifyFood({ candidate, allowedFoods: protocol.structured.allowedFoods }) ?? {
    food: candidate,
    canonicalFood: candidate,
    category: "desconocido",
    isCompatible: false,
    reason: "el protocolo y el clasificador técnico no ofrecen una clasificación suficiente",
    source: "unknown",
  };
}

function status(validation: FoodValidation): MealDecisionStatus {
  if (validation.source === "protocol_conditional") return "ALLOWED_WITH_VALIDATION";
  if (validation.source === "preparation") return "NEEDS_INGREDIENTS";
  if (validation.source === "unknown") return "UNKNOWN";
  if (!validation.isCompatible) return "NOT_ALLOWED";
  return "ALLOWED";
}

export function evaluateFoodWithProtocol(params: {
  protocol: ProtocolModuleOutput;
  userMessage: string;
  shouldBuildRecipes: boolean;
  ignoreFoods?: string[];
  requestedConditionalFoodList?: boolean;
  semanticInterpretation?: SemanticFoodInterpretation | null;
}): ProtocolFoodEvaluation {
  const { protocol, userMessage, shouldBuildRecipes } = params;
  const ignored = (params.ignoreFoods ?? []).map(normalizeFoodText);
  const restricted = restrictedTerms(protocol);
  const conditional = conditionalTerms(protocol);
  const semantic = params.semanticInterpretation;
  const hasReliableSemanticComposition =
    Boolean(semantic) &&
    (semantic?.confidence ?? 0) >= 0.65 &&
    ((semantic?.baseIngredients.length ?? 0) > 0 ||
      (semantic?.declaredIngredients.length ?? 0) > 0);
  const preparationName = PREPARATION_NAMES.find(name =>
    ` ${normalizeFoodText(userMessage)} `.includes(` ${normalizeFoodText(name)} `)
  );
  const preparation = analyzePreparation({ message: userMessage, preparationName });

  let validations: FoodValidation[];
  if (hasReliableSemanticComposition && semantic) {
    if (semantic.isCommercialProduct && semantic.requiresClarification) {
      validations = [{
        food: semantic.dishName ?? userMessage,
        canonicalFood: semantic.dishName ?? userMessage,
        category: "preparación",
        isCompatible: true,
        reason: semantic.clarificationReason ?? "requiere revisar los ingredientes del producto comercial",
        source: "preparation",
      }];
    } else {
      const semanticIngredients = unique([
        ...semantic.baseIngredients,
        ...semantic.declaredIngredients,
      ]).filter(candidate =>
        !semantic.styleReferences.some(reference =>
          normalizeFoodText(reference) === normalizeFoodText(candidate)
        )
      );
      validations = semanticIngredients.map(candidate =>
        validateCandidate({ candidate, protocol, restricted, conditional })
      );
    }
  } else if (preparation) {
    validations = [preparation];
  } else {
    const candidates = extractCandidates(userMessage, [
      ...flattenAllowed(protocol),
      ...restricted,
      ...conditional,
      ...CLINICAL_TERMS,
      ...PREPARATION_TERMS,
    ]).filter(candidate => !ignored.some(food => normalizeFoodText(candidate).includes(food)));
    validations = candidates.map(candidate =>
      validateCandidate({ candidate, protocol, restricted, conditional })
    );
  }

  const foods = validations.map(validation => ({
    food: validation.food,
    canonicalFood: validation.canonicalFood,
    category: validation.category,
    status: status(validation),
    reason: validation.reason,
    source: validation.source,
  }));
  const incompatibleFoods = validations.filter(item => !item.isCompatible);
  const compatibleFoods = validations.filter(item => item.isCompatible);
  const hasConditionalFoods = foods.some(food => food.status === "ALLOWED_WITH_VALIDATION");

  return {
    validations,
    incompatibleFoods,
    compatibleFoods,
    conditionalFoods: conditional,
    decision: {
      protocolId: protocol.protocolId,
      foods,
      conditionalFoods: conditional,
      requestedConditionalFoodList: params.requestedConditionalFoodList ?? false,
      shouldMeasureGlucose: hasConditionalFoods,
      shouldBuildRecipes,
      shouldExplainValidation: hasConditionalFoods,
      hasAllowedFoods: foods.some(food => food.status === "ALLOWED"),
      hasConditionalFoods,
      hasNotAllowedFoods: foods.some(food => food.status === "NOT_ALLOWED"),
      hasUnknownFoods: foods.some(food => food.status === "UNKNOWN"),
    },
  };
}
