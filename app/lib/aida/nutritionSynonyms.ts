// app/lib/aida/nutritionSynonyms.ts

export type NormalizedFoodMatch = {
    original: string;
    mappedTo: string;
    status: "ALLOWED_EQUIVALENCE" | "EXCLUDED" | "NEEDS_CHECK";
  };
  
  export const NUTRITION_SYNONYMS: Record<string, NormalizedFoodMatch> = {
    bagre: {
      original: "bagre",
      mappedTo: "pescado",
      status: "ALLOWED_EQUIVALENCE",
    },
    "bagre asado": {
      original: "bagre asado",
      mappedTo: "pescado",
      status: "ALLOWED_EQUIVALENCE",
    },
    guacamole: {
      original: "guacamole",
      mappedTo: "aguacate",
      status: "ALLOWED_EQUIVALENCE",
    },
    "guacamole natural": {
      original: "guacamole natural",
      mappedTo: "aguacate",
      status: "ALLOWED_EQUIVALENCE",
    },
    nopal: {
      original: "nopal",
      mappedTo: "nopales",
      status: "ALLOWED_EQUIVALENCE",
    },
    champiñón: {
      original: "champiñón",
      mappedTo: "champiñones",
      status: "ALLOWED_EQUIVALENCE",
    },
    atun: {
      original: "atun",
      mappedTo: "atún",
      status: "ALLOWED_EQUIVALENCE",
    },
    "agua de jamaica sin azúcar": {
      original: "agua de jamaica sin azúcar",
      mappedTo: "agua de jamaica sin azúcar",
      status: "ALLOWED_EQUIVALENCE",
    },
    "jamaica sin azúcar": {
      original: "jamaica sin azúcar",
      mappedTo: "agua de jamaica sin azúcar",
      status: "ALLOWED_EQUIVALENCE",
    },
    "agua fresca": {
      original: "agua fresca",
      mappedTo: "agua fresca",
      status: "NEEDS_CHECK",
    },
    "pan integral": {
      original: "pan integral",
      mappedTo: "pan",
      status: "EXCLUDED",
    },
    "tortilla de maíz": {
      original: "tortilla de maíz",
      mappedTo: "tortilla",
      status: "EXCLUDED",
    },
    "tortilla de harina": {
      original: "tortilla de harina",
      mappedTo: "tortilla",
      status: "EXCLUDED",
    },
    "tortilla de huevo": {
      original: "tortilla de huevo",
      mappedTo: "huevo",
      status: "ALLOWED_EQUIVALENCE",
    },
  };
  
  export function normalizeNutritionText(text: string) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim();
  }
  
  export function normalizeFoodName(food: string): NormalizedFoodMatch {
    const direct = NUTRITION_SYNONYMS[food];
  
    if (direct) return direct;
  
    const normalizedFood = normalizeNutritionText(food);
  
    const found = Object.entries(NUTRITION_SYNONYMS).find(
      ([key]) => normalizeNutritionText(key) === normalizedFood
    );
  
    if (found) return found[1];
  
    return {
      original: food,
      mappedTo: food,
      status: "ALLOWED_EQUIVALENCE",
    };
  }
  
  export function normalizeFoodList(foods: string[]) {
    return foods.map(normalizeFoodName);
  }