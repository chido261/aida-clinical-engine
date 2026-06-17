// app/lib/aida/nutritionEngine.ts

import {
  getAllowedFoodsForProtocol,
  getExcludedFoodsForProtocol,
  findFoodInCatalog,
  type FoodItem,
  type MealType,
} from "@/app/lib/aida/protocolFoodCatalog";
import { buildGeneratedMealOptionsDirective } from "@/app/lib/aida/mealPlanGenerator";
import { interpretNutritionRequest } from "@/app/lib/aida/nutritionRequestInterpreter";

export type NutritionEngineResult = {
  handled: boolean;
  responseMode: "DETERMINISTIC" | "GPT_REDACTION" | "NONE";
  reply: string | null;
  directive: string | null;
  reason: string;
};

type RecipeTemplate = {
  id: string;
  mealTypes: MealType[];
  proteinKey: string;
  title: string;
  ingredients: string[];
  preparation: string;
};

const RECIPE_TEMPLATES: RecipeTemplate[] = [
  // RES / CARNE
  {
    id: "beef_nopales",
    mealTypes: ["COMIDA", "CENA"],
    proteinKey: "carne de res",
    title: "Carne de res con nopales y jitomate",
    ingredients: ["carne de res", "nopales", "jitomate"],
    preparation: "Cocina la carne de res. Agrega los nopales y el jitomate hasta que todo quede integrado.",
  },
  {
    id: "beef_fajitas",
    mealTypes: ["COMIDA", "CENA"],
    proteinKey: "carne de res",
    title: "Fajitas de res con pimiento y calabacita",
    ingredients: ["carne de res", "pimiento", "calabacita"],
    preparation: "Corta la carne de res en tiras. Cocina junto con pimiento y calabacita hasta que quede lista.",
  },
  {
    id: "beef_mushrooms",
    mealTypes: ["COMIDA", "CENA"],
    proteinKey: "carne de res",
    title: "Bistec con champiñones y brócoli",
    ingredients: ["bistec", "champiñones", "brócoli"],
    preparation: "Cocina el bistec. Añade champiñones y brócoli hasta que queden suaves.",
  },
  {
    id: "beef_picadillo",
    mealTypes: ["COMIDA"],
    proteinKey: "carne de res",
    title: "Picadillo de res con chayote y calabacita",
    ingredients: ["carne molida magra", "chayote", "calabacita"],
    preparation: "Cocina la carne molida magra. Agrega chayote y calabacita en cubos hasta que queden cocidos.",
  },
  {
    id: "beef_lettuce_bowl",
    mealTypes: ["COMIDA", "CENA"],
    proteinKey: "carne de res",
    title: "Tazón de res con lechuga, pepino y aguacate",
    ingredients: ["carne de res", "lechuga", "pepino", "aguacate"],
    preparation: "Cocina la carne de res. Sirve sobre lechuga y pepino, y acompaña con aguacate.",
  },

  // POLLO
  {
    id: "chicken_nopales",
    mealTypes: ["DESAYUNO", "COMIDA", "CENA"],
    proteinKey: "pollo",
    title: "Pollo con nopales y aguacate",
    ingredients: ["pollo", "nopales", "aguacate"],
    preparation: "Cocina el pollo. Acompaña con nopales y aguacate.",
  },
  {
    id: "chicken_mushrooms",
    mealTypes: ["COMIDA", "CENA"],
    proteinKey: "pollo",
    title: "Pollo con champiñones y espinaca",
    ingredients: ["pollo", "champiñones", "espinaca"],
    preparation: "Cocina el pollo. Agrega champiñones y espinaca hasta que queden suaves.",
  },
  {
    id: "chicken_broccoli",
    mealTypes: ["COMIDA", "CENA"],
    proteinKey: "pollo",
    title: "Pollo con brócoli y calabacita",
    ingredients: ["pollo", "brócoli", "calabacita"],
    preparation: "Cocina el pollo. Añade brócoli y calabacita hasta que queden listos.",
  },

  // HUEVO
  {
    id: "egg_nopales",
    mealTypes: ["DESAYUNO", "CENA"],
    proteinKey: "huevo",
    title: "Huevos con nopales y jitomate",
    ingredients: ["huevo", "nopales", "jitomate"],
    preparation: "Cocina los nopales con jitomate. Agrega el huevo y mezcla hasta que quede cocido.",
  },
  {
    id: "egg_spinach",
    mealTypes: ["DESAYUNO", "CENA"],
    proteinKey: "huevo",
    title: "Huevos con espinaca y champiñones",
    ingredients: ["huevo", "espinaca", "champiñones"],
    preparation: "Cocina la espinaca y los champiñones. Agrega el huevo y cocina hasta que quede listo.",
  },
  {
    id: "egg_avocado",
    mealTypes: ["DESAYUNO"],
    proteinKey: "huevo",
    title: "Huevos con jitomate y aguacate",
    ingredients: ["huevo", "jitomate", "aguacate"],
    preparation: "Cocina el huevo con jitomate y sirve con aguacate.",
  },

  // PAVO / QUESO / PESCADO
  {
    id: "turkey_rolls",
    mealTypes: ["DESAYUNO", "CENA"],
    proteinKey: "pavo",
    title: "Rollitos de pavo con aguacate y pepino",
    ingredients: ["pavo", "aguacate", "pepino"],
    preparation: "Forma rollitos con pavo. Acompaña con aguacate y pepino.",
  },
  {
    id: "cheese_panela",
    mealTypes: ["DESAYUNO", "CENA", "COLACION"],
    proteinKey: "queso fresco",
    title: "Queso fresco con nopales y jitomate",
    ingredients: ["queso fresco", "nopales", "jitomate"],
    preparation: "Sirve el queso fresco con nopales y jitomate.",
  },
  {
    id: "fish_bagred",
    mealTypes: ["COMIDA", "CENA"],
    proteinKey: "pescado",
    title: "Pescado con brócoli y calabacita",
    ingredients: ["pescado", "brócoli", "calabacita"],
    preparation: "Cocina el pescado. Acompaña con brócoli y calabacita.",
  },
  {
    id: "tuna_salad",
    mealTypes: ["COMIDA", "CENA"],
    proteinKey: "atún",
    title: "Atún con lechuga, pepino y aguacate",
    ingredients: ["atún", "lechuga", "pepino", "aguacate"],
    preparation: "Mezcla el atún con lechuga y pepino. Sirve con aguacate.",
  },
  {
    id: "sardine_mexican",
    mealTypes: ["DESAYUNO", "COMIDA", "CENA"],
    proteinKey: "sardina",
    title: "Sardina con jitomate y nopales",
    ingredients: ["sardina", "jitomate", "nopales"],
    preparation: "Sirve la sardina con jitomate y nopales.",
  },
];

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function detectVarietyComplaint(text: string) {
  return /(no est[aá] variado|no es variado|se parecen|muy repetido|m[aá]s variedad|mas variedad|opciones distintas|otras opciones|c[aá]mbialas|cambialas)/i.test(
    text
  );
}

function detectMealTypeFromText(text: string): MealType {
  const t = normalize(text);

  if (t.includes("desayuno")) return "DESAYUNO";
  if (t.includes("cena")) return "CENA";
  if (t.includes("colacion") || t.includes("snack")) return "COLACION";

  return "COMIDA";
}

function detectCountFromText(text: string) {
  const match = text.match(/\b(\d{1,2})\b/);
  const value = match ? Number(match[1]) : 3;

  if (!Number.isFinite(value)) return 3;

  return Math.min(Math.max(value, 1), 14);
}

function detectRequestedProteinKey(text: string) {
  const t = normalize(text);

  if (t.includes("huevo")) return "huevo";
  if (t.includes("pollo")) return "pollo";
  if (t.includes("pavo")) return "pavo";
  if (t.includes("bistec")) return "carne de res";
  if (t.includes("carne")) return "carne de res";
  if (t.includes("bagre")) return "pescado";
  if (t.includes("pescado")) return "pescado";
  if (t.includes("atun") || t.includes("atún")) return "atún";
  if (t.includes("sardina")) return "sardina";
  if (t.includes("queso")) return "queso fresco";

  return null;
}

function wantsBeverage(text: string) {
  return /\b(bebida|agua|jamaica|café|cafe|té|te|infusión|infusion)\b/i.test(text);
}

function getSafeBeverage(text: string) {
  const t = normalize(text);

  if (t.includes("jamaica")) return "agua de jamaica sin azúcar";
  if (t.includes("cafe") || t.includes("café")) return "café sin azúcar";
  if (t.includes("te") || t.includes("té")) return "té sin azúcar";

  return "agua de jamaica sin azúcar";
}

function getAllowedFoodNames(params: {
  activeProtocol: string;
  mealType: MealType;
  blockedFoods: string[];
}) {
  const blocked = params.blockedFoods.map(normalize);

  return new Set(
    getAllowedFoodsForProtocol({
      protocol: params.activeProtocol,
      mealType: params.mealType,
    })
      .filter((food) => !blocked.includes(normalize(food.name)))
      .map((food) => normalize(food.name))
  );
}

function recipeIsAllowed(params: {
  recipe: RecipeTemplate;
  allowedFoodNames: Set<string>;
  mealType: MealType;
}) {
  if (!params.recipe.mealTypes.includes(params.mealType)) return false;

  return params.recipe.ingredients.every((ingredient) =>
    params.allowedFoodNames.has(normalize(ingredient))
  );
}

function buildFallbackRecipe(params: {
  mealType: MealType;
  activeProtocol: string;
  blockedFoods: string[];
  offset: number;
}) {
  const allowed = getAllowedFoodsForProtocol({
    protocol: params.activeProtocol,
    mealType: params.mealType,
  }).filter(
    (food) => !params.blockedFoods.map(normalize).includes(normalize(food.name))
  );

  const proteins = allowed.filter((food) => food.category === "PROTEIN");
  const vegetables = allowed.filter((food) => food.category === "VEGETABLE");
  const fats = allowed.filter(
    (food) =>
      food.category === "HEALTHY_FAT" &&
      !food.tags?.includes("onlyIfRequested")
  );

  const protein = proteins[params.offset % Math.max(proteins.length, 1)];
  const vegetable1 = vegetables[(params.offset + 1) % Math.max(vegetables.length, 1)];
  const vegetable2 = vegetables[(params.offset + 3) % Math.max(vegetables.length, 1)];
  const fat = fats[(params.offset + 2) % Math.max(fats.length, 1)];

  const ingredients = [
    protein?.name,
    vegetable1?.name,
    vegetable2?.name,
    fat?.name,
  ].filter(Boolean) as string[];

  return {
    title: `${protein?.name ?? "Proteína"} con ${vegetable1?.name ?? "vegetales"}`,
    ingredients,
    preparation: `Cocina ${protein?.name ?? "la proteína"} con ${vegetable1?.name ?? "vegetales"}${vegetable2?.name ? ` y ${vegetable2.name}` : ""}. ${fat?.name ? `Sirve con ${fat.name}.` : ""}`.trim(),
  };
}

function buildDeterministicMealOptions(params: {
  text: string;
  activeProtocol: string;
}) {
  const request = interpretNutritionRequest(params.text);
  const mealType =
    request.mealType === "DESAYUNO" ||
    request.mealType === "COMIDA" ||
    request.mealType === "CENA" ||
    request.mealType === "COLACION"
      ? request.mealType
      : detectMealTypeFromText(params.text);

  const count = request.count ?? detectCountFromText(params.text);
  const requestedProteinKey = detectRequestedProteinKey(params.text);

  const blockedFoods = [
    ...getExcludedFoodsForProtocol(params.activeProtocol),
    ...request.userAvoidedFoods,
    ...request.excludedRequestedFoods,
  ];

  const allowedFoodNames = getAllowedFoodNames({
    activeProtocol: params.activeProtocol,
    mealType,
    blockedFoods,
  });

  let recipePool = RECIPE_TEMPLATES.filter((recipe) =>
    recipeIsAllowed({
      recipe,
      allowedFoodNames,
      mealType,
    })
  );

  if (requestedProteinKey) {
    recipePool = recipePool.filter(
      (recipe) => recipe.proteinKey === requestedProteinKey
    );
  }

  if (recipePool.length < count && requestedProteinKey === "carne de res") {
    recipePool = RECIPE_TEMPLATES.filter(
      (recipe) =>
        ["carne de res", "pollo", "pescado", "atún", "sardina"].includes(
          recipe.proteinKey
        ) &&
        recipeIsAllowed({
          recipe,
          allowedFoodNames,
          mealType,
        })
    );
  }

  const selected = Array.from({ length: count }, (_, index) => {
    const recipe = recipePool[index];

    if (recipe) {
      return {
        title: recipe.title,
        ingredients: recipe.ingredients,
        preparation: recipe.preparation,
      };
    }

    return buildFallbackRecipe({
      mealType,
      activeProtocol: params.activeProtocol,
      blockedFoods,
      offset: index,
    });
  });

  const beverageLine = wantsBeverage(params.text)
    ? `\n\nBebida sugerida: ${getSafeBeverage(params.text)}.`
    : "";

  const avoidedLine = request.userAvoidedFoods.length
    ? `\n\nRespeté que no llevara: ${request.userAvoidedFoods.join(", ")}.`
    : "";

  const excludedLine = request.excludedRequestedFoods.length
    ? `\n\nAjusté la solicitud porque ${request.excludedRequestedFoods.join(", ")} no entra por ahora en Protocolo 1.`
    : "";

  return `Aquí tienes ${count} opciones para ${mealType.toLowerCase()} dentro del protocolo:\n\n${selected
    .map(
      (option, index) =>
        `${index + 1}. ${option.title}\nIngredientes: ${option.ingredients.join(", ")}.\nPreparación: ${option.preparation}`
    )
    .join("\n\n")}${beverageLine}${avoidedLine}${excludedLine}`;
}

function buildDeterministicBeverageReply(params: {
  text: string;
}) {
  const request = interpretNutritionRequest(params.text);
  const beverage = request.beverage ?? getSafeBeverage(params.text);

  if (request.sugarAdded === true) {
    return `No te la recomiendo si lleva azúcar. Mejor elige una versión sin azúcar, como agua de jamaica sin azúcar, café sin azúcar o té sin azúcar.`;
  }

  if (request.sugarAdded === null && /agua fresca|bebida preparada/i.test(params.text)) {
    return `Puede ser opción solo si es sin azúcar. Confírmame que no lleva azúcar, miel, jarabe ni endulzante añadido.`;
  }

  return `Sí, puedes acompañar con ${beverage} si es sin azúcar. Evita agregar miel, azúcar o jarabes.`;
}

export function runNutritionEngine(params: {
  text: string;
  activeProtocol: string;
  activePhase?: string | null;
}): NutritionEngineResult {
  const request = interpretNutritionRequest(params.text);
  const isVarietyComplaint = detectVarietyComplaint(params.text);

  if (isVarietyComplaint) {
    return {
      handled: true,
      responseMode: "DETERMINISTIC",
      reply: buildDeterministicMealOptions({
        text: "Dame 3 opciones variadas para comida con carne",
        activeProtocol: params.activeProtocol,
      }),
      directive: null,
      reason: "El usuario pidió más variedad en opciones previas.",
    };
  }

  if (!request.handled) {
    return {
      handled: false,
      responseMode: "NONE",
      reply: null,
      directive: null,
      reason: request.reason,
    };
  }

  if (request.requestType === "MEAL_OPTIONS") {
    return {
      handled: true,
      responseMode: "DETERMINISTIC",
      reply: buildDeterministicMealOptions({
        text: params.text,
        activeProtocol: params.activeProtocol,
      }),
      directive: null,
      reason: request.reason,
    };
  }

  if (request.requestType === "BEVERAGE_CHECK") {
    return {
      handled: true,
      responseMode: "DETERMINISTIC",
      reply: buildDeterministicBeverageReply({
        text: params.text,
      }),
      directive: null,
      reason: request.reason,
    };
  }

  const directive = buildGeneratedMealOptionsDirective({
    text: params.text,
    activeProtocol: params.activeProtocol,
  });

  if (!directive) {
    return {
      handled: false,
      responseMode: "NONE",
      reply: null,
      directive: null,
      reason: "La solicitud nutricional fue detectada, pero aún no tiene respuesta generada.",
    };
  }

  return {
    handled: true,
    responseMode: "GPT_REDACTION",
    reply: null,
    directive,
    reason: request.reason,
  };
}