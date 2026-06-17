// app/lib/aida/nutritionRequestInterpreter.ts

export type NutritionRequestType =
  | "MEAL_OPTIONS"
  | "WEEKLY_MENU"
  | "BEVERAGE_CHECK"
  | "SELECT_MEAL_OPTION"
  | "MEAL_REVIEW"
  | "UNKNOWN";

export type NutritionMealType =
  | "DESAYUNO"
  | "COMIDA"
  | "CENA"
  | "COLACION"
  | "DESCONOCIDO";

export type InterpretedNutritionRequest = {
  handled: boolean;
  requestType: NutritionRequestType;
  mealType: NutritionMealType;
  count: number | null;
  days: number | null;
  includeMeals: NutritionMealType[];
  requiredFoods: string[];
  mappedFoods: string[];
  excludedRequestedFoods: string[];
  userAvoidedFoods: string[];
  beverage: string | null;
  sugarAdded: boolean | null;
  selectedOptionNumber: number | null;
  needsClarification: boolean;
  reason: string;
};

const PROTOCOL_1_EXCLUDED_REQUESTS = [
  "pan",
  "pan integral",
  "tortilla",
  "tortilla de maíz",
  "tortilla de harina",
  "arroz",
  "pasta",
  "avena",
  "papa",
  "camote",
  "jugo",
  "jugos",
  "refresco",
  "azúcar",
  "miel",
];

const FOOD_SYNONYMS: Record<string, string> = {
  bagre: "pescado",
  "bagre asado": "pescado",
  guacamole: "aguacate",
  "guacamole natural": "aguacate",
  nopal: "nopales",
  champiñón: "champiñones",
  atun: "atún",
  brocoli: "brócoli",
  "jamaica sin azúcar": "agua de jamaica sin azúcar",
  "agua de jamaica sin azúcar": "agua de jamaica sin azúcar",
  "agua de jamaica": "agua de jamaica",
  "pan integral": "pan",
  "tortilla de maíz": "tortilla",
  "tortilla de harina": "tortilla",
  "tortilla de huevo": "huevo",
};

const KNOWN_FOODS = [
  "huevo",
  "pollo",
  "pavo",
  "bistec",
  "carne molida magra",
  "carne de res",
  "pescado",
  "bagre",
  "bagre asado",
  "salmón",
  "atún",
  "atun",
  "sardina",
  "queso fresco",
  "queso panela",
  "aguacate",
  "guacamole",
  "almendras",
  "nopales",
  "nopal",
  "espinaca",
  "lechuga",
  "pepino",
  "jitomate",
  "champiñones",
  "champiñón",
  "brócoli",
  "brocoli",
  "calabacita",
  "apio",
  "col",
  "chayote",
  "acelga",
  "coliflor",
  "pimiento",
  "cebolla",
  "cilantro",
  "perejil",
  "pan",
  "pan integral",
  "tortilla",
  "tortilla de maíz",
  "tortilla de harina",
  "arroz",
  "jugo",
  "avena",
  "papa",
  "camote",
];

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function detectRequestType(text: string): NutritionRequestType {
  const t = normalizeText(text);

  if (/\b(hare|haré|voy a hacer|elijo|escojo|me quedo con)\s+(la\s+)?(opcion|opción)?\s*\d+\b/i.test(t)) {
    return "SELECT_MEAL_OPTION";
  }

  if (/\b(menu|menú|semana|semanal|7 dias|siete dias|toda la semana)\b/i.test(t)) {
    return "WEEKLY_MENU";
  }

  if (/\b(dame|quiero|sugiere|recomienda|opciones|ideas|platillos|desayunos|comidas|cenas|colaciones)\b/i.test(t)) {
    return "MEAL_OPTIONS";
  }
  
  if (/\b(puedo tomar|puedo beber|agua|bebida|jamaica|cafe|café|te|té)\b/i.test(t)) {
    return "BEVERAGE_CHECK";
  }

  if (/\b(comi|comí|desayune|desayuné|cene|cené|almorce|almorcé)\b/i.test(t)) {
    return "MEAL_REVIEW";
  }

  return "UNKNOWN";
}

function detectMealType(text: string): NutritionMealType {
  const t = normalizeText(text);

  if (/\bdesayuno|desayunos|desayunar\b/i.test(t)) return "DESAYUNO";
  if (/\bcomida|comidas|almuerzo|almorzar\b/i.test(t)) return "COMIDA";
  if (/\bcena|cenas|cenar\b/i.test(t)) return "CENA";
  if (/\bcolacion|colación|snack|botana\b/i.test(t)) return "COLACION";

  return "DESCONOCIDO";
}

function detectCount(text: string): number | null {
  const match = text.match(/\b(\d{1,2})\b/);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;

  return Math.min(Math.max(value, 1), 14);
}

function detectSelectedOption(text: string): number | null {
  const match = normalizeText(text).match(/\b(?:opcion|opción|la)?\s*(\d{1,2})\b/);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;

  return value;
}

function detectFoods(text: string) {
  const t = normalizeText(text);

  const found = KNOWN_FOODS.filter((food) =>
    t.includes(normalizeText(food))
  );

  return Array.from(new Set(found));
}

function mapFoods(foods: string[]) {
  return Array.from(
    new Set(
      foods.map((food) => {
        const normalized = normalizeText(food);
        return FOOD_SYNONYMS[food] ?? FOOD_SYNONYMS[normalized] ?? food;
      })
    )
  );
}

function detectUserAvoidedFoods(text: string) {
  const t = normalizeText(text);
  const avoided: string[] = [];

  for (const food of KNOWN_FOODS) {
    const f = normalizeText(food);

    const patterns = [
      `sin ${f}`,
      `sin nada de ${f}`,
      `ninguno con ${f}`,
      `ninguna con ${f}`,
      `ningun con ${f}`,
      `no quiero ${f}`,
      `que no tenga ${f}`,
      `que no tengan ${f}`,
      `evita ${f}`,
      `evitar ${f}`,
      `excluye ${f}`,
    ];

    if (patterns.some((pattern) => t.includes(pattern))) {
      avoided.push(FOOD_SYNONYMS[f] ?? food);
    }
  }

  return Array.from(new Set(avoided));
}

function detectExcludedRequestedFoods(foods: string[]) {
  const normalizedFoods = foods.map(normalizeText);

  return PROTOCOL_1_EXCLUDED_REQUESTS.filter((excluded) =>
    normalizedFoods.includes(normalizeText(excluded))
  );
}

function detectBeverage(text: string): string | null {
  const t = normalizeText(text);

  if (t.includes("jamaica")) return "agua de jamaica";
  if (t.includes("agua mineral")) return "agua mineral";
  if (t.includes("agua")) return "agua natural";
  if (t.includes("cafe") || t.includes("café")) return "café";
  if (t.includes("te") || t.includes("té")) return "té";

  return null;
}

function detectSugarAdded(text: string): boolean | null {
  const t = normalizeText(text);

  if (/sin azucar|sin endulzante|sin miel|natural sin azucar/i.test(t)) return false;
  if (/con azucar|endulzada|con miel|con jarabe/i.test(t)) return true;

  return null;
}

export function interpretNutritionRequest(text: string): InterpretedNutritionRequest {
  const requestType = detectRequestType(text);
  const mealType = detectMealType(text);
  const count = detectCount(text);
  const foods = detectFoods(text);
  const mappedFoods = mapFoods(foods);
  const userAvoidedFoods = detectUserAvoidedFoods(text);
  const excludedRequestedFoods = detectExcludedRequestedFoods(mappedFoods);
  const beverage = detectBeverage(text);
  const sugarAdded = detectSugarAdded(text);
  const selectedOptionNumber = detectSelectedOption(text);

  const cleanedRequiredFoods = mappedFoods.filter(
    (food) => !userAvoidedFoods.includes(food)
  );

  if (requestType === "UNKNOWN") {
    return {
      handled: false,
      requestType,
      mealType,
      count: null,
      days: null,
      includeMeals: [],
      requiredFoods: [],
      mappedFoods: [],
      excludedRequestedFoods: [],
      userAvoidedFoods: [],
      beverage: null,
      sugarAdded: null,
      selectedOptionNumber: null,
      needsClarification: false,
      reason: "No parece una solicitud nutricional específica.",
    };
  }

  if (requestType === "WEEKLY_MENU") {
    return {
      handled: true,
      requestType,
      mealType: "DESCONOCIDO",
      count: null,
      days: 7,
      includeMeals: ["DESAYUNO", "COMIDA", "CENA", "COLACION"],
      requiredFoods: cleanedRequiredFoods,
      mappedFoods: cleanedRequiredFoods,
      excludedRequestedFoods,
      userAvoidedFoods,
      beverage: null,
      sugarAdded: null,
      selectedOptionNumber: null,
      needsClarification: false,
      reason: "El usuario pidió menú semanal.",
    };
  }

  if (requestType === "SELECT_MEAL_OPTION") {
    return {
      handled: true,
      requestType,
      mealType: "DESCONOCIDO",
      count: null,
      days: null,
      includeMeals: [],
      requiredFoods: [],
      mappedFoods: [],
      excludedRequestedFoods: [],
      userAvoidedFoods,
      beverage: null,
      sugarAdded: null,
      selectedOptionNumber,
      needsClarification: selectedOptionNumber == null,
      reason: "El usuario seleccionó una opción previa.",
    };
  }

  if (requestType === "BEVERAGE_CHECK") {
    return {
      handled: true,
      requestType,
      mealType,
      count: null,
      days: null,
      includeMeals: mealType !== "DESCONOCIDO" ? [mealType] : [],
      requiredFoods: cleanedRequiredFoods,
      mappedFoods: cleanedRequiredFoods,
      excludedRequestedFoods,
      userAvoidedFoods,
      beverage,
      sugarAdded,
      selectedOptionNumber: null,
      needsClarification: beverage == null,
      reason: "El usuario preguntó por una bebida.",
    };
  }

  if (requestType === "MEAL_OPTIONS") {
    return {
      handled: true,
      requestType,
      mealType,
      count: count ?? 3,
      days: null,
      includeMeals: mealType !== "DESCONOCIDO" ? [mealType] : [],
      requiredFoods: cleanedRequiredFoods,
      mappedFoods: cleanedRequiredFoods,
      excludedRequestedFoods,
      userAvoidedFoods,
      beverage: null,
      sugarAdded: null,
      selectedOptionNumber: null,
      needsClarification: mealType === "DESCONOCIDO",
      reason: "El usuario pidió opciones de comida.",
    };
  }

  return {
    handled: true,
    requestType,
    mealType,
    count: null,
    days: null,
    includeMeals: mealType !== "DESCONOCIDO" ? [mealType] : [],
    requiredFoods: cleanedRequiredFoods,
    mappedFoods: cleanedRequiredFoods,
    excludedRequestedFoods,
    userAvoidedFoods,
    beverage,
    sugarAdded,
    selectedOptionNumber,
    needsClarification: false,
    reason: "Solicitud nutricional interpretada.",
  };
}