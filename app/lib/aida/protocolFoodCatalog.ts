// app/lib/aida/protocolFoodCatalog.ts

export type FoodItem = {
    name: string;
    category: "PROTEIN" | "HEALTHY_FAT" | "VEGETABLE" | "SEED" | "SEASONING";
    allowedProtocols: string[];
    preferredMeals?: ("DESAYUNO" | "COMIDA" | "CENA" | "COLACION")[];
  };
  
  export const PROTOCOL_FOOD_CATALOG: FoodItem[] = [
    // Proteínas
    { name: "huevo", category: "PROTEIN", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["DESAYUNO", "CENA"] },
    { name: "pollo", category: "PROTEIN", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA"] },
    { name: "bistec", category: "PROTEIN", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA"] },
    { name: "carne de res", category: "PROTEIN", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA"] },
    { name: "pescado", category: "PROTEIN", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA"] },
    { name: "atún", category: "PROTEIN", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA"] },
    { name: "sardina", category: "PROTEIN", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["DESAYUNO", "COMIDA", "CENA"] },
    { name: "queso fresco", category: "PROTEIN", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["DESAYUNO", "CENA", "COLACION"] },
  
    // Grasas saludables
    { name: "aguacate", category: "HEALTHY_FAT", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["DESAYUNO", "COMIDA", "CENA"] },
    { name: "aceite de oliva", category: "HEALTHY_FAT", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA"] },
    { name: "aceitunas", category: "HEALTHY_FAT", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["CENA", "COLACION"] },
  
    // Vegetales
    { name: "nopales", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["DESAYUNO", "COMIDA", "CENA"] },
    { name: "espinaca", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["DESAYUNO", "CENA"] },
    { name: "lechuga", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA"] },
    { name: "pepino", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA", "COLACION"] },
    { name: "jitomate", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["DESAYUNO", "COMIDA", "CENA"] },
    { name: "champiñones", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["DESAYUNO", "CENA"] },
    { name: "brócoli", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA"] },
    { name: "calabacita", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA"] },
    { name: "apio", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COLACION", "CENA"] },
    { name: "col", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA"] },
    { name: "chayote", category: "VEGETABLE", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COMIDA", "CENA"] },
  
    // Semillas
    { name: "semillas de chía", category: "SEED", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COLACION"] },
    { name: "linaza", category: "SEED", allowedProtocols: ["PROTOCOL_1"], preferredMeals: ["COLACION"] },
  
    // Condimentos
    { name: "limón", category: "SEASONING", allowedProtocols: ["PROTOCOL_1"] },
    { name: "especias", category: "SEASONING", allowedProtocols: ["PROTOCOL_1"] },
    { name: "salsa sin azúcar", category: "SEASONING", allowedProtocols: ["PROTOCOL_1"] },
  ];
  
  export const PROTOCOL_1_EXCLUDED_FOODS = [
    "tortilla",
    "pan",
    "arroz",
    "pasta",
    "avena",
    "maíz",
    "papa",
    "camote",
    "cereales",
    "granos",
    "azúcar",
    "jugos",
    "refrescos",
    "yogurt con fruta",
    "fruta como base del desayuno",
  ];
  
  export function getAllowedFoodsForProtocol(params: {
    protocol: string;
    mealType?: "DESAYUNO" | "COMIDA" | "CENA" | "COLACION";
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