// app/lib/aida/protocolFoodCatalog.ts

export type MealType = "DESAYUNO" | "COMIDA" | "CENA" | "COLACION";

export type FoodCategory =
  | "PROTEIN"
  | "HEALTHY_FAT"
  | "VEGETABLE"
  | "SEED"
  | "BEVERAGE"
  | "SEASONING";

export type FoodItem = {
  name: string;
  category: FoodCategory;
  allowedProtocols: string[];
  preferredMeals?: MealType[];
  synonyms?: string[];
  tags?: string[];
};

export const PROTOCOL_FOOD_CATALOG: FoodItem[] = [
  // Proteínas
  { name: "huevo", category: "PROTEIN", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["DESAYUNO", "CENA"], synonyms: ["tortilla de huevo"] },
  { name: "pollo", category: "PROTEIN", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["DESAYUNO", "COMIDA", "CENA"] },
  { name: "pavo", category: "PROTEIN", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["DESAYUNO", "COMIDA", "CENA"] },
  { name: "bistec", category: "PROTEIN", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA"] },
  { name: "carne molida magra", category: "PROTEIN", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA"] },
  { name: "carne de res", category: "PROTEIN", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA"] },
  { name: "pescado", category: "PROTEIN", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA"], synonyms: ["bagre", "bagre asado", "pescado blanco"] },
  { name: "salmón", category: "PROTEIN", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA"] },
  { name: "atún", category: "PROTEIN", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA"], synonyms: ["atun"] },
  { name: "sardina", category: "PROTEIN", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["DESAYUNO", "COMIDA", "CENA"] },
  { name: "queso fresco", category: "PROTEIN", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["DESAYUNO", "CENA", "COLACION"] },
  { name: "queso panela", category: "PROTEIN", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["DESAYUNO", "CENA", "COLACION"] },

  // Grasas saludables
  { name: "aguacate", category: "HEALTHY_FAT", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["DESAYUNO", "COMIDA", "CENA"], synonyms: ["guacamole", "guacamole natural"] },
  { name: "aceite de oliva", category: "HEALTHY_FAT", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA"], tags: ["onlyIfRequested"] },
  { name: "aceitunas", category: "HEALTHY_FAT", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["CENA", "COLACION"] },
  { name: "almendras", category: "HEALTHY_FAT", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COLACION"], tags: ["smallPortion"] },

  // Vegetales
  { name: "nopales", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["DESAYUNO", "COMIDA", "CENA"], synonyms: ["nopal"] },
  { name: "espinaca", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["DESAYUNO", "CENA"] },
  { name: "lechuga", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA"] },
  { name: "pepino", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA", "COLACION"] },
  { name: "jitomate", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["DESAYUNO", "COMIDA", "CENA"] },
  { name: "champiñones", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["DESAYUNO", "CENA"], synonyms: ["champiñón"] },
  { name: "brócoli", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA"], synonyms: ["brocoli"] },
  { name: "calabacita", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA"] },
  { name: "apio", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COLACION", "CENA"] },
  { name: "col", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA"] },
  { name: "chayote", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA"] },
  { name: "acelga", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["DESAYUNO", "CENA"] },
  { name: "coliflor", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA"] },
  { name: "pimiento", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA"] },
  { name: "cebolla", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["DESAYUNO", "COMIDA", "CENA"], tags: ["moderatePortion"] },
  { name: "cilantro", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"] },
  { name: "perejil", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"] },

  // Semillas
  { name: "semillas de chía", category: "SEED", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COLACION"], tags: ["smallPortion"] },
  { name: "linaza", category: "SEED", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COLACION"], tags: ["smallPortion"] },

  // Bebidas
  { name: "agua natural", category: "BEVERAGE", allowedProtocols: ["PROTOCOL_1"] },
  { name: "agua mineral sin azúcar", category: "BEVERAGE", allowedProtocols: ["PROTOCOL_1"] },
  { name: "agua de jamaica sin azúcar", category: "BEVERAGE", allowedProtocols: ["PROTOCOL_1"], synonyms: ["jamaica sin azúcar"] },
  { name: "té sin azúcar", category: "BEVERAGE", allowedProtocols: ["PROTOCOL_1"], synonyms: ["te sin azúcar"] },
  { name: "café sin azúcar", category: "BEVERAGE", allowedProtocols: ["PROTOCOL_1"], synonyms: ["cafe sin azúcar", "cafe sin azucar"] },
  { name: "agua con limón sin azúcar", category: "BEVERAGE", allowedProtocols: ["PROTOCOL_1"] },

  // Condimentos
  { name: "limón", category: "SEASONING", allowedProtocols: ["PROTOCOL_1"] },
  { name: "sal moderada", category: "SEASONING", allowedProtocols: ["PROTOCOL_1"] },
  { name: "especias", category: "SEASONING", allowedProtocols: ["PROTOCOL_1"] },
  { name: "salsa sin azúcar", category: "SEASONING", allowedProtocols: ["PROTOCOL_1"] },
  { name: "vinagre", category: "SEASONING", allowedProtocols: ["PROTOCOL_1"] },
];

export const PROTOCOL_1_EXCLUDED_FOODS = [
  "tortilla",
  "pan",
  "pan integral",
  "arroz",
  "pasta",
  "avena",
  "maíz",
  "papa",
  "camote",
  "cereales",
  "granos",
  "azúcar",
  "miel",
  "jugos",
  "refrescos",
  "yogurt con fruta",
  "fruta como base del desayuno",
];

export function getAllowedFoodsForProtocol(params: {
  protocol: string;
  mealType?: MealType;
}) {
  return PROTOCOL_FOOD_CATALOG.filter((food) => {
    const allowed = food.allowedProtocols.includes(params.protocol);
    const mealOk = params.mealType
      ? !food.preferredMeals || food.preferredMeals.includes(params.mealType)
      : true;

    return allowed && mealOk;
  });
}

export function getExcludedFoodsForProtocol(protocol: string) {
  if (protocol === "PROTOCOL_1") return PROTOCOL_1_EXCLUDED_FOODS;
  return [];
}

export function findFoodInCatalog(name: string, protocol = "PROTOCOL_1") {
  const normalized = name.toLowerCase().trim();

  return PROTOCOL_FOOD_CATALOG.find((food) => {
    if (!food.allowedProtocols.includes(protocol)) return false;

    const names = [food.name, ...(food.synonyms ?? [])].map((item) =>
      item.toLowerCase().trim()
    );

    return names.includes(normalized);
  }) ?? null;
}