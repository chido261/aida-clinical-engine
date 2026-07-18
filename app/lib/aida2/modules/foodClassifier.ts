import type { StructuredAllowedFoods } from "./protocolParsers";
import type { FoodCategory, FoodValidation } from "./foodDecisionTypes";

const CLINICAL_GROUPS: Array<{
  category: FoodCategory;
  terms: string[];
  reason: string;
}> = [
  {
    category: "proteína",
    terms: [
      "huevo", "huevos", "pollo", "res", "carne", "bistec", "cerdo", "pavo",
      "pescado", "atún", "atun", "sardina", "sardinas", "salmón", "salmon",
      "tilapia", "mojarra", "camarón", "camaron", "camarones", "pulpo",
      "mariscos", "tofu", "tempeh",
    ],
    reason: "se clasifica como proteína natural compatible con las categorías permitidas del protocolo",
  },
  {
    category: "grasa saludable",
    terms: [
      "aguacate", "aceite de oliva", "aceite de aguacate", "aceitunas",
      "almendras", "almendra", "nueces", "pistaches", "cacahuate",
      "cacahuates", "chía", "chia", "linaza", "semillas",
    ],
    reason: "se clasifica como grasa saludable compatible con las categorías permitidas del protocolo",
  },
  {
    category: "vegetal bajo en carga glucémica",
    terms: [
      "lechuga", "espinaca", "acelga", "arúgula", "arugula", "brócoli", "brocoli",
      "coliflor", "pepino", "calabaza", "ejotes", "champiñones", "champiñón",
      "setas", "jitomate", "tomate", "apio", "espárragos", "esparragos",
      "nopal", "pimiento", "chile", "cebolla", "ajo", "rábano", "rabano",
    ],
    reason: "se clasifica como vegetal sin almidón compatible con las categorías permitidas del protocolo",
  },
];

export const CLINICAL_TERMS = CLINICAL_GROUPS.flatMap(group => group.terms);

export function normalizeFoodText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[¿?¡!.,;:()\[\]{}"'`´]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matches(candidate: string, term: string) {
  const left = normalizeFoodText(candidate);
  const right = normalizeFoodText(term);
  const singular = (value: string) => value.endsWith("s") ? value.slice(0, -1) : value;
  return left === right ||
    singular(left) === singular(right) ||
    ` ${left} `.includes(` ${right} `) ||
    (left.split(" ").length === 1 &&
      right.split(" ").some(word => singular(word) === singular(left)));
}

function compatible(
  food: string,
  canonicalFood: string,
  category: FoodCategory,
  reason: string,
  source: FoodValidation["source"]
): FoodValidation {
  return {
    food,
    canonicalFood,
    category,
    isCompatible: true,
    reason,
    source,
  };
}

export function classifyFood(params: {
  candidate: string;
  allowedFoods: StructuredAllowedFoods;
}): FoodValidation | null {
  const { candidate, allowedFoods } = params;
  const protocolGroups: Array<{
    category: FoodCategory;
    foods: string[];
    reason: string;
  }> = [
    { category: "proteína", foods: allowedFoods.proteins, reason: "aparece como proteína natural compatible" },
    { category: "proteína", foods: allowedFoods.dairy, reason: "aparece como lácteo natural compatible" },
    { category: "grasa saludable", foods: allowedFoods.healthyFats, reason: "aparece como grasa saludable compatible" },
    { category: "vegetal bajo en carga glucémica", foods: allowedFoods.vegetables, reason: "aparece como vegetal sin almidón compatible" },
    { category: "leguminosa", foods: allowedFoods.legumes, reason: "aparece como leguminosa permitida por el protocolo" },
    { category: "fruta", foods: allowedFoods.fruits, reason: "aparece como fruta permitida por el protocolo" },
    { category: "bebida", foods: allowedFoods.beverages, reason: "aparece como bebida compatible" },
    { category: "endulzante compatible", foods: allowedFoods.sweeteners, reason: "aparece como endulzante permitido por el protocolo" },
  ];

  const protocolMatches = protocolGroups.flatMap(group =>
    group.foods
      .filter(food => matches(candidate, food))
      .map(food => ({ ...group, food }))
  ).sort((left, right) => {
    const candidateText = normalizeFoodText(candidate);
    const leftText = normalizeFoodText(left.food);
    const rightText = normalizeFoodText(right.food);
    const leftExact = leftText === candidateText ? 1 : 0;
    const rightExact = rightText === candidateText ? 1 : 0;
    if (leftExact !== rightExact) return rightExact - leftExact;
    return leftText.split(" ").length - rightText.split(" ").length;
  });
  const protocolMatch = protocolMatches[0];
  if (protocolMatch) {
    return compatible(
      candidate,
      protocolMatch.food,
      protocolMatch.category,
      protocolMatch.reason,
      "protocol_reference"
    );
  }

  for (const group of CLINICAL_GROUPS) {
    const match = group.terms.find(term => matches(candidate, term));
    if (match) {
      return compatible(candidate, match, group.category, group.reason, "clinical_classification");
    }
  }

  return null;
}
