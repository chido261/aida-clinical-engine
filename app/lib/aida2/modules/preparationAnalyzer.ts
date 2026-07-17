import type { FoodValidation } from "./foodDecisionTypes";
import { normalizeFoodText } from "./foodClassifier";

export const PREPARATION_NAMES = [
  "pan", "panes", "tortilla", "tortillas", "pizza", "galleta", "galletas", "base",
];

export const COMPATIBLE_PREPARATION_INGREDIENTS = [
  "harina de almendra", "almendra", "almendras", "linaza", "chía", "chia",
  "huevo", "huevos", "clara", "claras", "queso", "brócoli", "brocoli",
  "coliflor", "calabaza", "nopal", "espinaca", "pollo", "atún", "atun",
  "sardina", "pulpo", "aceite de oliva", "aceite de aguacate", "aguacate",
  "leche sin azúcar", "leche sin azucar", "yogur natural sin azúcar",
  "yogurt natural sin azúcar", "kéfir natural", "kefir natural",
];

export const INCOMPATIBLE_PREPARATION_INGREDIENTS = [
  "harina de trigo", "trigo", "harina blanca", "harina integral",
  "harina de maíz", "harina de maiz", "maíz", "maiz", "maseca", "avena",
  "harina de avena", "arroz", "harina de arroz", "papa", "camote",
  "azúcar", "azucar", "miel", "piloncillo", "jarabe", "fécula", "fecula", "maicena",
];

export const PREPARATION_TERMS = [
  ...PREPARATION_NAMES,
  ...COMPATIBLE_PREPARATION_INGREDIENTS,
  ...INCOMPATIBLE_PREPARATION_INGREDIENTS,
];

function uniqueTerms(values: string[]) {
  const seen = new Set<string>();
  return values.filter(value => {
    const normalized = normalizeFoodText(value);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function hasAffirmedIngredient(message: string, ingredient: string) {
  const normalizedMessage = normalizeFoodText(message);
  const normalizedIngredient = normalizeFoodText(ingredient);
  if (!normalizedMessage.includes(normalizedIngredient)) return false;

  return ![
    `sin ${normalizedIngredient}`,
    `no contiene ${normalizedIngredient}`,
    `no lleva ${normalizedIngredient}`,
    `libre de ${normalizedIngredient}`,
  ].some(pattern => normalizedMessage.includes(pattern));
}

function formatList(values: string[]) {
  if (values.length <= 1) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} y ${values.at(-1)}`;
}

export function analyzePreparation(params: {
  message: string;
  preparationName?: string | null;
}): FoodValidation | null {
  const { message } = params;
  const normalizedMessage = normalizeFoodText(message);
  const preparationName = params.preparationName ?? PREPARATION_NAMES.find(name =>
    ` ${normalizedMessage} `.includes(` ${normalizeFoodText(name)} `)
  );

  if (!preparationName) return null;

  const describesIngredients = /\b(?:preparo|prepare|hago|hice|hech[ao]s?|preparad[ao]s?)\s+(?:(?:solamente|solo|unicamente)\s+)?con\b|\b(?:ingredientes?|lleva|contiene)\b/i.test(
    normalizedMessage
  );
  const alternativeByName = /\b(?:tortillas?|pan|pizza|galletas?|base)\s+(?:de|con)\s+(?:harina\s+de\s+)?(?:linaza|chia|nopal|almendras?|brocoli|coliflor|calabaza|espinaca|queso)\b/i.test(
    normalizedMessage
  );

  if (!describesIngredients) {
    if (!alternativeByName) return null;
    return {
      food: preparationName,
      canonicalFood: preparationName,
      category: "preparación",
      isCompatible: true,
      reason: "requiere conocer todos sus ingredientes antes de decidir",
      source: "preparation",
    };
  }

  const incompatible = uniqueTerms(
    INCOMPATIBLE_PREPARATION_INGREDIENTS.filter(ingredient =>
      hasAffirmedIngredient(message, ingredient)
    )
  );
  if (incompatible.length > 0) {
    return {
      food: preparationName,
      canonicalFood: preparationName,
      category: "carbohidrato de alta carga glucémica",
      isCompatible: false,
      reason: `contiene ingredientes no compatibles: ${formatList(incompatible)}`,
      source: "restricted",
    };
  }

  const compatible = uniqueTerms(
    COMPATIBLE_PREPARATION_INGREDIENTS.filter(ingredient =>
      normalizedMessage.includes(normalizeFoodText(ingredient))
    )
  );
  if (compatible.length > 0) {
    return {
      food: preparationName,
      canonicalFood: preparationName,
      category: "preparación compatible condicionada",
      isCompatible: true,
      reason: `fue descrita con ingredientes compatibles: ${formatList(compatible)}`,
      source: "ingredient_based_preparation",
    };
  }

  return {
    food: preparationName,
    canonicalFood: preparationName,
    category: "preparación",
    isCompatible: true,
    reason: "requiere validar todos sus ingredientes antes de decidir",
    source: "preparation",
  };
}
