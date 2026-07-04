// app/lib/aida2/specialists/mealSpecialist.ts

import { runProtocolModule } from "../modules/protocolModule";
import { MEAL_TEMPLATES } from "./mealTemplates";

export type MealType =
  | "desayuno"
  | "comida"
  | "cena"
  | "snack";

export type MealRequest = {
  mealType: MealType;
  userMessage?: string;
};

type AllowedFoods = {
  proteins: string[];
  dairy: string[];
  healthyFats: string[];
  vegetables: string[];
  legumes: string[];
  fruits: string[];
  beverages: string[];
};

type FoodCategory =
  | "proteína"
  | "grasa saludable"
  | "vegetal bajo en carga glucémica"
  | "leguminosa"
  | "fruta"
  | "bebida"
  | "carbohidrato de alta carga glucémica"
  | "preparación"
  | "preparación compatible condicionada"
  | "desconocido";

type FoodValidation = {
  food: string;
  canonicalFood: string;
  category: FoodCategory;
  isCompatible: boolean;
  reason: string;
  source:
    | "protocol_reference"
    | "clinical_classification"
    | "restricted"
    | "preparation"
    | "ingredient_based_preparation"
    | "unknown";
};

type MealBase = {
  title: string;
  proteins: string[];
  vegetables: string[];
  fats: string[];
  legumes: string[];
  fruits: string[];
};

const HIGH_GLYCEMIC_FOODS = [
  "pan blanco",
  "pan integral",
  "pan de trigo",
  "pan común",
  "pan comun",
  "tostada",
  "tostadas",
  "tortilla de maíz",
  "tortilla de maiz",
  "tortilla de harina",
  "arroz",
  "pasta",
  "avena",
  "cereal",
  "cereales",
  "granola",
  "galleta",
  "galletas",
  "papa",
  "papas",
  "camote",
  "azúcar",
  "azucar",
  "refresco",
  "refrescos",
  "jugo",
  "jugos",
  "postre",
  "postres",
  "miel",
];

const CONDITIONAL_PREPARATION_NAMES = [
  "pan",
  "tortilla",
  "tortillas",
  "pizza",
  "galleta",
  "galletas",
  "tostada",
  "tostadas",
  "base",
];

const COMPATIBLE_PREPARATION_INGREDIENTS = [
  "harina de almendra",
  "almendra",
  "almendras",
  "linaza",
  "chía",
  "chia",
  "huevo",
  "huevos",
  "clara",
  "claras",
  "queso",
  "brócoli",
  "brocoli",
  "coliflor",
  "calabaza",
  "nopal",
  "espinaca",
  "pollo",
  "atún",
  "atun",
  "sardina",
  "pulpo",
  "aceite de oliva",
  "aceite de aguacate",
  "aguacate",
  "leche sin azúcar",
  "leche sin azucar",
  "yogur natural sin azúcar",
  "yogurt natural sin azúcar",
  "kéfir natural",
  "kefir natural",
  "polvo para hornear",
];

const INCOMPATIBLE_PREPARATION_INGREDIENTS = [
  "harina de trigo",
  "trigo",
  "harina blanca",
  "harina integral",
  "harina de maíz",
  "harina de maiz",
  "maíz",
  "maiz",
  "maseca",
  "avena",
  "harina de avena",
  "arroz",
  "harina de arroz",
  "papa",
  "camote",
  "azúcar",
  "azucar",
  "miel",
  "piloncillo",
  "jarabe",
  "fécula",
  "fecula",
  "maicena",
];

const INGREDIENT_CONTEXT_WORDS = [
  "hecho con",
  "hecha con",
  "hechos con",
  "hechas con",
  "lleva",
  "tiene",
  "contiene",
  "preparado con",
  "preparada con",
  "de almendra",
  "de linaza",
  "de chía",
  "de chia",
  "de brócoli",
  "de brocoli",
  "de coliflor",
  "de nopal",
];

const FLEXIBLE_PROTEINS = [
  "huevo",
  "huevos",
  "huevo entero",
  "clara",
  "claras",
  "pollo",
  "res",
  "carne",
  "bistec",
  "cerdo",
  "pavo",
  "pescado",
  "atún",
  "atun",
  "sardina",
  "sardinas",
  "salmón",
  "salmon",
  "tilapia",
  "mojarra",
  "camarón",
  "camaron",
  "camarones",
  "pulpo",
  "mariscos",
  "tofu",
  "tempeh",
  "queso",
  "yogur",
  "yogurt",
  "kéfir",
  "kefir",
];

const FLEXIBLE_FATS = [
  "aguacate",
  "aceite de oliva",
  "aceite de aguacate",
  "aceitunas",
  "almendras",
  "almendra",
  "nueces",
  "pistaches",
  "cacahuate",
  "cacahuates",
  "chía",
  "chia",
  "linaza",
  "semillas",
];

const FLEXIBLE_VEGETABLES = [
  "lechuga",
  "lechugas",
  "espinaca",
  "acelga",
  "arúgula",
  "arugula",
  "brócoli",
  "brocoli",
  "coliflor",
  "col",
  "pepino",
  "calabaza",
  "ejotes",
  "champiñones",
  "champinon",
  "champiñón",
  "setas",
  "jitomate",
  "tomate",
  "tomate verde",
  "apio",
  "espárragos",
  "esparragos",
  "nopal",
  "pimiento",
  "pimientos",
  "chile",
  "cebolla",
  "ajo",
  "rábano",
  "rabano",
];

const FLEXIBLE_LEGUMES = [
  "frijol",
  "frijoles",
  "garbanzo",
  "garbanzos",
  "lenteja",
  "lentejas",
  "haba",
  "habas",
  "soya",
  "alubias",
];

const FLEXIBLE_FRUITS = [
  "fresa",
  "fresas",
  "arándanos",
  "arandanos",
  "frambuesas",
  "zarzamoras",
  "moras",
  "manzana verde",
  "toronja",
];

const PREPARATION_WORDS = [
  "ensalada",
  "omelette",
  "asado",
  "asada",
  "plancha",
  "salteado",
  "salteada",
  "horno",
  "cocido",
  "cocida",
  "preparado",
  "preparada",
];

const DEFAULT_VEGETABLES = [
  "brócoli",
  "calabaza",
  "ejotes",
  "champiñones",
  "pepino",
  "jitomate",
  "nopal",
  "espinaca",
  "lechuga",
  "espárragos",
];

const DEFAULT_FATS = [
  "aguacate",
  "aceite de oliva extra virgen",
];

const DIVERSE_RECIPE_TEMPLATES: Array<{
  match: string[];
  recipes: string[];
}> = [
  {
    match: ["pulpo"],
    recipes: [
      "Pulpo a la plancha con nopal asado, pimiento y aguacate.",
      "Ensalada fresca de pulpo con pepino, jitomate, lechuga y aceite de oliva extra virgen.",
      "Pulpo salteado con calabaza, champiñones y ajo.",
      "Pulpo cocido con espinaca, pepino y aguacate en trozos.",
    ],
  },
  {
    match: ["sardina", "sardinas"],
    recipes: [
      "Ensalada de sardina con pepino, jitomate, lechuga y aguacate.",
      "Sardina guisada con nopal, pimiento y tomate verde.",
      "Sardinas con calabaza salteada, espinaca y aceite de oliva extra virgen.",
      "Sardina con champiñones salteados, pepino y aguacate.",
    ],
  },
  {
    match: ["atun", "atún"],
    recipes: [
      "Ensalada de atún con pepino, jitomate, lechuga y aguacate.",
      "Atún con nopal asado, pimiento y aceite de oliva extra virgen.",
      "Atún con calabaza salteada, espinaca y champiñones.",
      "Atún con pepino, apio y aguacate en trozos.",
    ],
  },
  {
    match: ["pollo"],
    recipes: [
      "Pollo a la plancha con calabaza, champiñones y aguacate.",
      "Ensalada de pollo con lechuga, pepino, jitomate y aceite de oliva extra virgen.",
      "Pollo salteado con brócoli, pimiento y ajo.",
      "Pollo con nopal asado, espinaca y aguacate.",
    ],
  },
  {
    match: ["huevo", "huevos"],
    recipes: [
      "Huevos con espinaca, champiñones y aguacate.",
      "Omelette de huevo con brócoli, pimiento y queso.",
      "Huevos con nopal, jitomate y aceite de oliva extra virgen.",
      "Huevos revueltos con calabaza, espinaca y aguacate.",
    ],
  },
  {
    match: ["bistec", "res", "carne"],
    recipes: [
      "Bistec a la plancha con nopal, pimiento y aguacate.",
      "Bistec con brócoli salteado, champiñones y aceite de oliva extra virgen.",
      "Ensalada tibia de bistec con lechuga, pepino y jitomate.",
      "Bistec con calabaza, espinaca y aguacate.",
    ],
  },
  {
    match: ["pescado", "tilapia", "mojarra"],
    recipes: [
      "Filete de pescado a la plancha con calabaza, espinaca y aguacate.",
      "Pescado con nopal asado, pepino y aceite de oliva extra virgen.",
      "Pescado salteado con brócoli, champiñones y ajo.",
      "Ensalada de pescado con lechuga, jitomate, pepino y aguacate.",
    ],
  },
  {
    match: ["camaron", "camarón", "camarones"],
    recipes: [
      "Camarones salteados con calabaza, pimiento y ajo.",
      "Ensalada de camarón con pepino, lechuga, jitomate y aguacate.",
      "Camarones con nopal asado, espinaca y aceite de oliva extra virgen.",
      "Camarones con champiñones, brócoli y aguacate.",
    ],
  },
];


const GENERIC_BALANCED_MEAL_OPTIONS: Record<MealType, string[]> = {
  desayuno: [
    "Huevos con espinaca, champiñones y aguacate.",
    "Omelette de huevo con brócoli, pimiento y queso panela.",
    "Pollo deshebrado con nopal, jitomate y aceite de oliva extra virgen.",
    "Yogur griego natural sin azúcar con chía y nueces, si el protocolo de la fase permite lácteos naturales.",
    "Bistec de res con calabaza, espinaca y aguacate.",
  ],
  comida: [
    "Pechuga de pollo a la plancha con brócoli, calabaza y aguacate.",
    "Filete de pescado con nopal asado, pepino y aceite de oliva extra virgen.",
    "Bistec de res con champiñones, pimiento y aguacate.",
    "Ensalada de atún con lechuga, pepino, jitomate y aceite de oliva extra virgen.",
    "Camarones salteados con calabaza, brócoli y aguacate.",
  ],
  cena: [
    "Pescado a la plancha con espinaca, champiñones y aguacate.",
    "Pollo con nopal, pimiento y aceite de oliva extra virgen.",
    "Huevos con calabaza, espinaca y queso panela.",
    "Ensalada de sardina con lechuga, pepino, jitomate y aguacate.",
    "Camarones con brócoli, champiñones y aceite de oliva extra virgen.",
  ],
  snack: [
    "Queso panela con pepino y aguacate.",
    "Yogur griego natural sin azúcar con chía.",
    "Huevo cocido con pepino y aceite de oliva extra virgen.",
    "Atún con pepino y aguacate en porción pequeña.",
    "Almendras con pepino, si el protocolo permite esa grasa saludable en la fase.",
  ],
};

export function generateMealRecommendation(
  request: MealRequest
) {

  const protocol = runProtocolModule();

  const foods = protocol.structured.allowedFoods;

  const currentUserMessage = extractCurrentUserMessage(
    request.userMessage
  );

  const shouldUseCurrentMessageOnly = isGenericOptionsRequest(
    currentUserMessage
  );

  const messageForValidation = shouldUseCurrentMessageOnly
    ? currentUserMessage
    : request.userMessage;

  const requestedCount = extractRequestedCount(
    currentUserMessage
  );

  const validations = validateMentionedFoods({
    userMessage: messageForValidation,
    foods,
    restrictedFoodsText: protocol.sections.restrictedFoods,
  });

  const incompatibleFoods = validations.filter(
    item => !item.isCompatible &&
      item.category !== "preparación"
  );

  const compatibleFoods = validations.filter(
    item => item.isCompatible
  );

  const mealBases = incompatibleFoods.length > 0
    ? []
    : buildMealBases({
        mealType: request.mealType,
        requestedCount,
        validations: compatibleFoods,
        foods,
        userMessage: request.userMessage,
        currentUserMessage,
      });

  return {

    success: true,

    recommendation: buildProtocolGuidance({
      mealType: request.mealType,
      requestedCount,
      validations,
      incompatibleFoods,
      mealBases,
      phasePurpose: protocol.sections.purpose,
      plateDistribution: protocol.sections.plateDistribution,
      generalGuidelines: protocol.sections.generalGuidelines,
      fruitGuidelines: protocol.sections.fruits,
      controlSheet: protocol.sections.controlSheet,
    })

  };

}

function buildProtocolGuidance(params: {
  mealType: MealType;
  requestedCount: number;
  validations: FoodValidation[];
  incompatibleFoods: FoodValidation[];
  mealBases: MealBase[];
  phasePurpose?: string;
  plateDistribution?: string;
  generalGuidelines?: string;
  fruitGuidelines?: string;
  controlSheet?: string;
}) {

  const {
    mealType,
    requestedCount,
    validations,
    incompatibleFoods,
    mealBases,
    phasePurpose,
    plateDistribution,
    generalGuidelines,
    fruitGuidelines,
    controlSheet,
  } = params;

  const lines: string[] = [];

  lines.push("VALIDACIÓN DEL ESPECIALISTA EN COMIDA:");
  lines.push(`- Tipo de comida detectado: ${mealType}.`);
  lines.push(`- El usuario pidió ${requestedCount} opción(es) como referencia inicial.`);

  if (validations.length > 0) {
    lines.push("");
    lines.push("ALIMENTOS, INGREDIENTES O PREPARACIONES DETECTADAS:");

    validations.forEach(item => {
      lines.push(
        `- ${item.food}: ${item.category}; ${item.isCompatible ? "compatible" : "no recomendado"}; ${item.reason}`
      );
    });
  }

  if (incompatibleFoods.length > 0) {
    lines.push("");
    lines.push("DECISIÓN NUTRICIONAL:");
    lines.push("- Hay alimento(s) o ingrediente(s) de alta carga glucémica o no compatibles con la Fase de Diagnóstico.");
    lines.push("- No recomendar esos alimentos durante esta fase.");
    lines.push("- No decir que se pueden comer por combinarlos con proteína, grasa o vegetales.");
    lines.push("- Mantener el contexto de la conversación.");
    lines.push("- Si el usuario pregunta si puede agregar ese alimento a un platillo, responder sobre ese alimento sin cambiarle todo el platillo.");
  } else {
    lines.push("");
    lines.push("DECISIÓN NUTRICIONAL:");
    lines.push("- Los alimentos o ingredientes detectados son compatibles con la lógica de la Fase de Diagnóstico.");
    lines.push("- Las proteínas, grasas saludables y vegetales bajos en carga glucémica pueden combinarse.");
    lines.push("- Si el usuario describe una preparación tipo pan, tortilla, pizza, galleta o base, validar por ingredientes.");
    lines.push("- No rechazar pan de almendra, tortilla de brócoli, tortilla de linaza o base de coliflor si sus ingredientes son compatibles y no contienen azúcar, trigo, maíz, avena, arroz, papa o miel.");
    lines.push("- No rechazar combinaciones como atún con huevo, sardina con vegetales, pulpo con vegetales o ensalada de atún si sus ingredientes son compatibles.");
  }

  if (mealBases.length > 0) {
    lines.push("");
    lines.push("BASES CULINARIAS COMPATIBLES:");
    lines.push(`- Entregar máximo ${mealBases.length} opción(es), usando estas bases.`);
    lines.push("- Las opciones deben hacer sentido como comida real, no ser variaciones clonadas con los mismos ingredientes.");
    lines.push("- Si hay varias proteínas solicitadas, separar las opciones por proteína cuando sea natural.");

    mealBases.forEach((base, index) => {
      lines.push(`${index + 1}. ${base.title}`);
    });
  }

  lines.push("");
  lines.push("LÍMITES DE REDACCIÓN:");
  lines.push("- No redactar una respuesta rígida ni programada; usar estos datos como guía clínica y culinaria.");
  lines.push("- No inventar alimentos de alta carga glucémica.");
  lines.push("- No agregar pan común, tostadas, tortilla de maíz, tortilla de harina, arroz, papa, pasta, avena, cereales, granola, galletas, jugos, azúcar o postres.");
  lines.push("- Si el usuario habla de pan, tortilla, pizza, galleta o base hecha con ingredientes compatibles, no bloquear por el nombre; validar por ingredientes.");
  lines.push("- Si faltan ingredientes para saber si una preparación especial es compatible, pedir los ingredientes mínimos en lugar de rechazarla automáticamente.");
  lines.push("- Sí puedes redactar de forma natural con proteínas, grasas saludables y vegetales bajos en carga glucémica.");
  lines.push("- Si el usuario pide varias recetas, dar opciones breves, variadas y culinariamente coherentes solo con alimentos compatibles.");
  lines.push("- No repetir la misma receta cambiando solo el nombre de la proteína si el usuario pidió variedad.");
  lines.push("- Si el usuario pide una combinación compatible, no rechazarla solo porque no venía como plantilla exacta.");
  lines.push("- Si el usuario señala una contradicción previa, reconocerla brevemente y corregir según la lógica de la fase.");
  lines.push("- Mantener el propósito de la fase: que el usuario observe el impacto de los alimentos en su glucómetro.");

  if (phasePurpose) {
    lines.push("");
    lines.push("PROPÓSITO DE LA FASE:");
    lines.push(sanitizeForPrompt(phasePurpose));
  }

  if (plateDistribution) {
    lines.push("");
    lines.push("DISTRIBUCIÓN DEL PLATO:");
    lines.push(sanitizeForPrompt(plateDistribution));
  }

  if (generalGuidelines) {
    lines.push("");
    lines.push("LINEAMIENTOS GENERALES:");
    lines.push(sanitizeForPrompt(generalGuidelines));
  }

  if (
    validations.some(item => item.category === "fruta") &&
    fruitGuidelines
  ) {
    lines.push("");
    lines.push("LINEAMIENTOS DE FRUTAS:");
    lines.push(sanitizeForPrompt(fruitGuidelines));
  }

  if (controlSheet) {
    lines.push("");
    lines.push("RELACIÓN CON GLUCÓMETRO:");
    lines.push(sanitizeForPrompt(controlSheet));
  }

  return lines.join("\n");

}

function buildMealBases(params: {
  mealType: MealType;
  requestedCount: number;
  validations: FoodValidation[];
  foods: AllowedFoods;
  userMessage?: string;
  currentUserMessage?: string;
}) {

  const {
    mealType,
    requestedCount,
    validations,
    foods,
    userMessage,
    currentUserMessage,
  } = params;

  const requestedProteins = getFoodsByCategory(
    validations,
    "proteína"
  );

  const requestedVegetables = getFoodsByCategory(
    validations,
    "vegetal bajo en carga glucémica"
  );

  const requestedFats = getFoodsByCategory(
    validations,
    "grasa saludable"
  );

  const requestedLegumes = getFoodsByCategory(
    validations,
    "leguminosa"
  );

  const requestedFruits = getFoodsByCategory(
    validations,
    "fruta"
  );

  const wantsRecipe = isRecipeRequest(
    currentUserMessage ?? userMessage
  );

  if (
    wantsRecipe &&
    requestedProteins.length === 0
  ) {
    const genericBases = buildGenericBalancedMealOptions({
      mealType,
      requestedCount,
      requestedVegetables,
      requestedFats,
      requestedLegumes,
      requestedFruits,
    });

    if (genericBases.length > 0) {
      return genericBases;
    }
  }

  if (
    wantsRecipe &&
    requestedProteins.length > 0
  ) {
    const diverseBases = buildDiverseRecipeBases({
      requestedProteins,
      requestedVegetables,
      requestedFats,
      requestedLegumes,
      requestedFruits,
      requestedCount,
      userMessage,
    });

    if (diverseBases.length > 0) {
      return diverseBases;
    }
  }

  const wantsSalad = validations.some(
    item => item.category === "preparación" && normalizeText(item.food).includes("ensalada")
  );

  const total = Math.min(
    Math.max(requestedCount, 1),
    3
  );

  const bases: MealBase[] = [];

  for (let index = 0; index < total; index++) {
    const proteins = requestedProteins.length > 0
      ? requestedProteins
      : [chooseProteinFromTemplates(mealType, foods, index)];

    const vegetables = buildVegetableSet({
      requestedVegetables,
      index,
      wantsSalad,
    });

    const fats = requestedFats.length > 0
      ? requestedFats
      : [DEFAULT_FATS[index % DEFAULT_FATS.length]];

    const legumes = requestedLegumes.length > 0
      ? requestedLegumes
      : [];

    const fruits = requestedFruits.length > 0
      ? requestedFruits
      : [];

    bases.push({
      title: buildNaturalMeal({
        mealType,
        proteins,
        vegetables,
        fats,
        legumes,
        fruits,
        wantsSalad,
        index,
      }),
      proteins,
      vegetables,
      fats,
      legumes,
      fruits,
    });
  }

  return removeDuplicatedBases(
    bases
  );

}


function buildGenericBalancedMealOptions(params: {
  mealType: MealType;
  requestedCount: number;
  requestedVegetables: string[];
  requestedFats: string[];
  requestedLegumes: string[];
  requestedFruits: string[];
}) {
  const {
    mealType,
    requestedCount,
    requestedVegetables,
    requestedFats,
    requestedLegumes,
    requestedFruits,
  } = params;

  const total = Math.min(
    Math.max(requestedCount, 1),
    3
  );

  const templates = GENERIC_BALANCED_MEAL_OPTIONS[mealType];
  const bases: MealBase[] = [];

  for (let index = 0; index < total; index++) {
    const baseRecipe = templates[index % templates.length];

    bases.push({
      title: applyRequestedRecipeDetails({
        recipe: baseRecipe,
        requestedVegetables: normalizeRequestedFoods(
          requestedVegetables
        ),
        requestedFats: normalizeRequestedFoods(
          requestedFats
        ),
      }),
      proteins: [],
      vegetables: normalizeRequestedFoods(
        requestedVegetables
      ),
      fats: requestedFats.length > 0
        ? normalizeRequestedFoods(requestedFats)
        : DEFAULT_FATS,
      legumes: normalizeRequestedFoods(
        requestedLegumes
      ),
      fruits: normalizeRequestedFoods(
        requestedFruits
      ),
    });
  }

  return removeDuplicatedBases(
    bases
  );
}

function buildDiverseRecipeBases(params: {
  requestedProteins: string[];
  requestedVegetables: string[];
  requestedFats: string[];
  requestedLegumes: string[];
  requestedFruits: string[];
  requestedCount: number;
  userMessage?: string;
}) {
  const {
    requestedProteins,
    requestedVegetables,
    requestedFats,
    requestedLegumes,
    requestedFruits,
    requestedCount,
    userMessage,
  } = params;

  const bases: MealBase[] = [];

  requestedProteins.forEach(protein => {
    const countForProtein = extractRequestedCountForProtein({
      userMessage,
      protein,
      fallback: requestedProteins.length > 1
        ? 1
        : requestedCount,
    });

    const templates = getRecipeTemplatesForProtein(
      protein
    );

    for (let index = 0; index < countForProtein; index++) {
      const template = templates[index % templates.length];

      bases.push({
        title: applyRequestedRecipeDetails({
          recipe: template,
          requestedVegetables,
          requestedFats,
        }),
        proteins: [protein],
        vegetables: requestedVegetables,
        fats: requestedFats.length > 0
          ? requestedFats
          : DEFAULT_FATS,
        legumes: requestedLegumes,
        fruits: requestedFruits,
      });
    }
  });

  return removeDuplicatedBases(
    bases
  ).slice(0, 6);
}

function getRecipeTemplatesForProtein(
  protein: string
) {
  const normalizedProtein = normalizeText(
    protein
  );

  const match = DIVERSE_RECIPE_TEMPLATES.find(template =>
    template.match.some(item =>
      normalizedProtein.includes(normalizeText(item))
    )
  );

  if (match) {
    return match.recipes;
  }

  return [
    `${capitalize(protein)} a la plancha con nopal, pimiento y aguacate.`,
    `Ensalada de ${lowerFirst(protein)} con lechuga, pepino, jitomate y aceite de oliva extra virgen.`,
    `${capitalize(protein)} salteado con calabaza, champiñones y ajo.`,
    `${capitalize(protein)} con brócoli, espinaca y aguacate.`,
  ];
}

function applyRequestedRecipeDetails(params: {
  recipe: string;
  requestedVegetables: string[];
  requestedFats: string[];
}) {
  const {
    recipe,
    requestedVegetables,
    requestedFats,
  } = params;

  const hasRequestedVegetables = requestedVegetables.length > 0;
  const hasRequestedFats = requestedFats.length > 0;

  if (!hasRequestedVegetables && !hasRequestedFats) {
    return recipe;
  }

  const notes: string[] = [];

  if (hasRequestedVegetables) {
    notes.push(`incluyendo ${formatList(requestedVegetables)}`);
  }

  if (hasRequestedFats) {
    notes.push(`usando ${formatList(requestedFats)} como grasa saludable`);
  }

  return `${recipe.replace(/\.$/, "")}, ${notes.join(" y ")}.`;
}

function isRecipeRequest(
  userMessage: string | undefined
) {
  if (!userMessage) return false;

  const normalizedMessage = normalizeText(
    userMessage
  );

  return /\b(receta|recetas|idea|ideas|opcion|opciones|preparacion|preparaciones|preparar|hacer|cocinar)\b/.test(
    normalizedMessage
  );
}


function isGenericOptionsRequest(
  userMessage: string | undefined
) {
  if (!userMessage) return false;

  const normalizedMessage = normalizeText(
    userMessage
  );

  const asksForOptions = /\b(dame|quiero|necesito|sugiere|recomienda|pasame|pásame)\b.*\b(receta|recetas|idea|ideas|opcion|opciones|platillo|platillos)\b/.test(
    normalizedMessage
  ) ||
    /\b(\d+|una|un|dos|tres)\s+(receta|recetas|idea|ideas|opcion|opciones|platillo|platillos)\b/.test(
      normalizedMessage
    );

  if (!asksForOptions) return false;

  return !FLEXIBLE_PROTEINS.some(protein =>
    normalizedMessage.includes(
      normalizeText(protein)
    )
  );
}

function extractCurrentUserMessage(
  userMessage: string | undefined
) {
  if (!userMessage) return userMessage;

  const match = userMessage.match(
    /MENSAJE ACTUAL DEL USUARIO:\s*([\s\S]*?)(?:\n\s*\nDIRECCIÓN DE CEREBRO PARA EL ESPECIALISTA:|$)/
  );

  return match?.[1]?.trim() ?? userMessage;
}

function normalizeRequestedFoods(
  items: string[]
) {
  const seen = new Set<string>();

  return items.filter(item => {
    const key = getFoodEquivalenceKey(
      item
    );

    if (seen.has(key)) return false;

    seen.add(key);

    return true;
  });
}

function getFoodEquivalenceKey(
  value: string
) {
  const normalized = normalizeText(
    value
  );

  if (
    normalized === "col" ||
    normalized.includes("col rizada") ||
    normalized.includes("kale")
  ) {
    return "col";
  }

  return normalized;
}

function extractRequestedCountForProtein(params: {
  userMessage: string | undefined;
  protein: string;
  fallback: number;
}) {
  const {
    userMessage,
    protein,
    fallback,
  } = params;

  if (!userMessage) {
    return clampCount(fallback);
  }

  const normalizedMessage = normalizeText(
    userMessage
  );

  const normalizedProtein = normalizeText(
    protein
  );

  const proteinWords = normalizedProtein
    .split(/\s+/)
    .filter(Boolean);

  const lastProteinWord = proteinWords[proteinWords.length - 1] ?? normalizedProtein;

  const escapedProtein = escapeRegExp(
    lastProteinWord
  );

  const patterns = [
    new RegExp(`\\b(\\d+)\\s+(?:receta|recetas|idea|ideas|opcion|opciones)?\\s*(?:con|de)\\s+${escapedProtein}\\b`),
    new RegExp(`\\b(\\d+)\\s+(?:con|de)\\s+${escapedProtein}\\b`),
    new RegExp(`\\b${escapedProtein}\\b.{0,24}\\b(\\d+)\\s+(?:receta|recetas|idea|ideas|opcion|opciones)\\b`),
  ];

  for (const pattern of patterns) {
    const match = normalizedMessage.match(
      pattern
    );

    if (match?.[1]) {
      return clampCount(
        Number(match[1])
      );
    }
  }

  return clampCount(
    fallback
  );
}

function buildNaturalMeal(params: {
  mealType: MealType;
  proteins: string[];
  vegetables: string[];
  fats: string[];
  legumes: string[];
  fruits: string[];
  wantsSalad: boolean;
  index: number;
}) {

  const {
    mealType,
    proteins,
    vegetables,
    fats,
    legumes,
    fruits,
    wantsSalad,
    index,
  } = params;

  const proteinText = formatList(
    proteins
  );

  const vegetableText = formatList(
    vegetables
  );

  const fatText = formatList(
    fats
  );

  const legumeText = formatList(
    legumes
  );

  const fruitText = formatList(
    fruits
  );

  if (fruits.length > 0 && proteins.length === 0) {
    return `${capitalize(fruitText)} como fruta permitida en el horario indicado por la fase.`;
  }

  if (wantsSalad) {
    return `Ensalada de ${lowerFirst(proteinText)} con ${vegetableText}, acompañada de ${fatText}.`;
  }

  if (proteins.length >= 2) {
    return `${capitalize(proteinText)} con ${vegetableText}, acompañado de ${fatText}.`;
  }

  if (legumes.length > 0) {
    return `${capitalize(proteinText)} con ${vegetableText}, ${legumeText} y ${fatText}.`;
  }

  if (mealType === "desayuno" && proteins.some(item => normalizeText(item).includes("huevo"))) {
    return `Huevos con ${vegetableText}, acompañados de ${fatText}.`;
  }

  if (index === 0) {
    return `${capitalize(proteinText)} con ${vegetableText}, acompañado de ${fatText}.`;
  }

  if (index === 1) {
    return `${capitalize(proteinText)} preparado con ${vegetableText} y ${fatText}.`;
  }

  return `${capitalize(proteinText)} con ${vegetableText}, usando ${fatText} como grasa saludable.`;

}

function validateMentionedFoods(params: {
  userMessage: string | undefined;
  foods: AllowedFoods;
  restrictedFoodsText?: string;
}) {

  const {
    userMessage,
    foods,
    restrictedFoodsText,
  } = params;

  if (!userMessage) return [];

  const candidates = extractFoodCandidates(
    userMessage
  );

  const restrictedFoods = [
    ...extractFoodList(restrictedFoodsText ?? ""),
    ...HIGH_GLYCEMIC_FOODS,
  ];

  const validations = candidates.map(candidate =>
    validateFood({
      candidate,
      userMessage,
      foods,
      restrictedFoods,
    })
  );

  return removeDuplicatedValidations(
    validations
  );

}

function validateFood(params: {
  candidate: string;
  userMessage: string;
  foods: AllowedFoods;
  restrictedFoods: string[];
}): FoodValidation {

  const {
    candidate,
    userMessage,
    foods,
    restrictedFoods,
  } = params;

  const normalizedCandidate = normalizeText(candidate);
  const normalizedMessage = normalizeText(userMessage);

  const conditionalPreparation = validateConditionalPreparation({
    candidate,
    userMessage,
  });

  if (conditionalPreparation) {
    return conditionalPreparation;
  }

  const restrictedMatch = restrictedFoods.find(
    food => normalizedCandidate === normalizeText(food) ||
      normalizedCandidate.includes(normalizeText(food))
  );

  if (restrictedMatch) {
    const hasIngredientContext = INGREDIENT_CONTEXT_WORDS.some(
      item => normalizedMessage.includes(normalizeText(item))
    );

    if (
      CONDITIONAL_PREPARATION_NAMES.some(
        item => normalizedCandidate.includes(normalizeText(item))
      ) &&
      hasIngredientContext
    ) {
      return {
        food: lowerFirst(candidate),
        canonicalFood: candidate,
        category: "preparación",
        isCompatible: true,
        reason: "requiere validar ingredientes antes de decidir; no bloquear solo por el nombre",
        source: "preparation",
      };
    }

    return {
      food: lowerFirst(candidate),
      canonicalFood: restrictedMatch,
      category: "carbohidrato de alta carga glucémica",
      isCompatible: false,
      reason: "eleva la carga glucémica de la comida y se restringe en esta fase",
      source: "restricted",
    };
  }

  const protocolMatch = findInAllowedFoods({
    candidate,
    foods,
  });

  if (protocolMatch) {
    return protocolMatch;
  }

  const preparationMatch = PREPARATION_WORDS.find(
    item => normalizedCandidate.includes(normalizeText(item))
  );

  if (preparationMatch) {
    return {
      food: lowerFirst(preparationMatch),
      canonicalFood: preparationMatch,
      category: "preparación",
      isCompatible: true,
      reason: "es una forma de preparación, no un alimento de alta carga glucémica",
      source: "preparation",
    };
  }

  if (matchesFlexibleList(normalizedCandidate, FLEXIBLE_PROTEINS)) {
    return {
      food: lowerFirst(candidate),
      canonicalFood: canonicalizeProtein(candidate),
      category: "proteína",
      isCompatible: true,
      reason: "aporta proteína y puede formar parte del 75% de proteínas y grasas",
      source: "clinical_classification",
    };
  }

  if (matchesFlexibleList(normalizedCandidate, FLEXIBLE_FATS)) {
    return {
      food: lowerFirst(candidate),
      canonicalFood: canonicalizeFat(candidate),
      category: "grasa saludable",
      isCompatible: true,
      reason: "puede formar parte del 75% de proteínas y grasas",
      source: "clinical_classification",
    };
  }

  if (matchesFlexibleList(normalizedCandidate, FLEXIBLE_VEGETABLES)) {
    return {
      food: lowerFirst(candidate),
      canonicalFood: canonicalizeVegetable(candidate),
      category: "vegetal bajo en carga glucémica",
      isCompatible: true,
      reason: "es vegetal bajo en carga glucémica y aporta fibra",
      source: "clinical_classification",
    };
  }

  if (matchesFlexibleList(normalizedCandidate, FLEXIBLE_LEGUMES)) {
    return {
      food: lowerFirst(candidate),
      canonicalFood: canonicalizeLegume(candidate),
      category: "leguminosa",
      isCompatible: true,
      reason: "es leguminosa y cuenta dentro del 25% del plato",
      source: "clinical_classification",
    };
  }

  if (matchesFlexibleList(normalizedCandidate, FLEXIBLE_FRUITS)) {
    return {
      food: lowerFirst(candidate),
      canonicalFood: canonicalizeFruit(candidate),
      category: "fruta",
      isCompatible: true,
      reason: "es fruta permitida, respetando horario y contexto de la fase",
      source: "clinical_classification",
    };
  }

  return {
    food: lowerFirst(candidate),
    canonicalFood: candidate,
    category: "desconocido",
    isCompatible: false,
    reason: "no se pudo clasificar con seguridad dentro de la fase",
    source: "unknown",
  };

}

function validateConditionalPreparation(params: {
  candidate: string;
  userMessage: string;
}): FoodValidation | null {

  const {
    candidate,
    userMessage,
  } = params;

  const normalizedCandidate = normalizeText(candidate);
  const normalizedMessage = normalizeText(userMessage);

  const mentionsConditionalName = CONDITIONAL_PREPARATION_NAMES.some(
    item => normalizedCandidate.includes(normalizeText(item)) ||
      normalizedMessage.includes(normalizeText(item))
  );

  if (!mentionsConditionalName) return null;

  const incompatibleIngredients = INCOMPATIBLE_PREPARATION_INGREDIENTS.filter(
    ingredient => normalizedMessage.includes(normalizeText(ingredient))
  );

  if (incompatibleIngredients.length > 0) {
    return {
      food: lowerFirst(candidate),
      canonicalFood: candidate,
      category: "carbohidrato de alta carga glucémica",
      isCompatible: false,
      reason: `la preparación contiene ingrediente(s) no compatibles: ${incompatibleIngredients.join(", ")}`,
      source: "restricted",
    };
  }

  const compatibleIngredients = COMPATIBLE_PREPARATION_INGREDIENTS.filter(
    ingredient => normalizedMessage.includes(normalizeText(ingredient))
  );

  const hasIngredientContext = INGREDIENT_CONTEXT_WORDS.some(
    item => normalizedMessage.includes(normalizeText(item))
  );

  if (
    compatibleIngredients.length > 0 &&
    hasIngredientContext
  ) {
    return {
      food: lowerFirst(candidate),
      canonicalFood: candidate,
      category: "preparación compatible condicionada",
      isCompatible: true,
      reason: `la preparación fue descrita con ingredientes compatibles: ${compatibleIngredients.join(", ")}`,
      source: "ingredient_based_preparation",
    };
  }

  return null;

}

function findInAllowedFoods(params: {
  candidate: string;
  foods: AllowedFoods;
}): FoodValidation | null {

  const {
    candidate,
    foods,
  } = params;

  const groups: Array<{
    category: FoodCategory;
    foods: string[];
    reason: string;
  }> = [
    {
      category: "proteína",
      foods: foods.proteins,
      reason: "aparece como proteína de referencia del protocolo",
    },
    {
      category: "proteína",
      foods: foods.dairy,
      reason: "aparece como lácteo natural compatible y aporta proteína",
    },
    {
      category: "grasa saludable",
      foods: foods.healthyFats,
      reason: "aparece como grasa saludable de referencia del protocolo",
    },
    {
      category: "vegetal bajo en carga glucémica",
      foods: foods.vegetables,
      reason: "aparece como vegetal sin almidón de referencia del protocolo",
    },
    {
      category: "leguminosa",
      foods: foods.legumes,
      reason: "aparece como leguminosa compatible dentro del 25% del plato",
    },
    {
      category: "fruta",
      foods: foods.fruits,
      reason: "aparece como fruta permitida en el protocolo",
    },
    {
      category: "bebida",
      foods: foods.beverages,
      reason: "aparece como bebida compatible del protocolo",
    },
  ];

  for (const group of groups) {
    const match = group.foods.find(
      food => normalizeText(candidate) === normalizeText(food) ||
        normalizeText(candidate).includes(normalizeText(food)) ||
        normalizeText(food).includes(normalizeText(candidate))
    );

    if (match) {
      return {
        food: lowerFirst(candidate),
        canonicalFood: match,
        category: group.category,
        isCompatible: true,
        reason: group.reason,
        source: "protocol_reference",
      };
    }
  }

  return null;

}

function extractFoodCandidates(
  userMessage: string
) {

  const normalizedMessage = normalizeText(userMessage);

  const candidates = new Set<string>();

  const knownTerms = [
    ...HIGH_GLYCEMIC_FOODS,
    ...CONDITIONAL_PREPARATION_NAMES,
    ...COMPATIBLE_PREPARATION_INGREDIENTS,
    ...INCOMPATIBLE_PREPARATION_INGREDIENTS,
    ...FLEXIBLE_PROTEINS,
    ...FLEXIBLE_FATS,
    ...FLEXIBLE_VEGETABLES,
    ...FLEXIBLE_LEGUMES,
    ...FLEXIBLE_FRUITS,
    ...PREPARATION_WORDS,
  ];

  knownTerms.forEach(term => {
    const normalizedTerm = normalizeText(term);

    if (normalizedMessage.includes(normalizedTerm)) {
      candidates.add(term);
    }
  });

  const patterns = [
    /recetas con ([a-záéíóúñ\s]+)/i,
    /receta con ([a-záéíóúñ\s]+)/i,
    /ideas con ([a-záéíóúñ\s]+)/i,
    /idea con ([a-záéíóúñ\s]+)/i,
    /opciones con ([a-záéíóúñ\s]+)/i,
    /opcion con ([a-záéíóúñ\s]+)/i,
    /puedo agregar ([a-záéíóúñ\s]+)/i,
    /puedo comer ([a-záéíóúñ\s]+)/i,
    /puedo cenar ([a-záéíóúñ\s]+)/i,
    /puedo desayunar ([a-záéíóúñ\s]+)/i,
    /quiero agregar ([a-záéíóúñ\s]+)/i,
    /quiero comer ([a-záéíóúñ\s]+)/i,
    /quiero cenar ([a-záéíóúñ\s]+)/i,
    /quiero desayunar ([a-záéíóúñ\s]+)/i,
    /dame algo con ([a-záéíóúñ\s]+)/i,
    /algo con ([a-záéíóúñ\s]+)/i,
    /hecho con ([a-záéíóúñ\s]+)/i,
    /hecha con ([a-záéíóúñ\s]+)/i,
    /lleva ([a-záéíóúñ\s]+)/i,
    /tiene ([a-záéíóúñ\s]+)/i,
    /contiene ([a-záéíóúñ\s]+)/i,
    /con ([a-záéíóúñ\s]+)/i,
  ];

  patterns.forEach(pattern => {
    const match = normalizedMessage.match(pattern);

    if (!match?.[1]) return;

    cleanExtractedFoods(match[1]).forEach(food => {
      candidates.add(food);
    });
  });

  return Array.from(candidates)
    .map(item => item.trim())
    .filter(Boolean);

}

function cleanExtractedFoods(
  value: string
) {

  return value
    .replace(/[¿?¡!.,]/g, "")
    .split(/\b(?:con|y|o|u|,)\b/g)
    .map(item =>
      item
        .replace(/\b(un|una|dos|tres|el|la|los|las|a|al|algún|algun|alguna|platillo|platillos|comida|cena|desayuno|poco|poquito|de|para|mi|opcion|opciones|receta|recetas|idea|ideas|hecho|hecha|lleva|tiene|contiene)\b/g, "")
        .trim()
    )
    .filter(Boolean)
    .map(item =>
      item
        .split(/\s+/)
        .slice(0, 4)
        .join(" ")
    );

}

function extractRequestedCount(
  userMessage: string | undefined
) {

  if (!userMessage) return 1;

  const normalizedMessage = normalizeText(userMessage);

  const numberMatch = normalizedMessage.match(
    /\b(\d+)\s+(receta|recetas|idea|ideas|opcion|opciones)\b/
  );

  if (numberMatch?.[1]) {
    return clampCount(
      Number(numberMatch[1])
    );
  }

  const wordCounts: Record<string, number> = {
    una: 1,
    un: 1,
    dos: 2,
    tres: 3,
  };

  const wordMatch = normalizedMessage.match(
    /\b(una|un|dos|tres)\s+(receta|recetas|idea|ideas|opcion|opciones)\b/
  );

  if (wordMatch?.[1]) {
    return clampCount(
      wordCounts[wordMatch[1]] ?? 1
    );
  }

  return 1;

}

function clampCount(value: number) {

  if (!Number.isFinite(value)) return 1;

  return Math.min(
    Math.max(value, 1),
    3
  );

}

function chooseProteinFromTemplates(
  mealType: MealType,
  foods: AllowedFoods,
  index: number
) {

  const templates = MEAL_TEMPLATES.filter(
    template => template.mealType === mealType
  );

  const template = templates[index % Math.max(templates.length, 1)];

  const preferred = template?.allowedProteins ?? [];

  const available = preferred.filter(
    item => foods.proteins.includes(item)
  );

  if (available.length > 0) {
    return available[index % available.length];
  }

  return foods.proteins[index % foods.proteins.length];

}

function buildVegetableSet(params: {
  requestedVegetables: string[];
  index: number;
  wantsSalad: boolean;
}) {

  const {
    requestedVegetables,
    index,
    wantsSalad,
  } = params;

  if (requestedVegetables.length >= 2) {
    return requestedVegetables.slice(0, 3);
  }

  if (requestedVegetables.length === 1) {
    return [
      requestedVegetables[0],
      DEFAULT_VEGETABLES[index % DEFAULT_VEGETABLES.length],
    ].filter(Boolean);
  }

  if (wantsSalad) {
    const saladSets = [
      ["lechuga", "pepino", "jitomate"],
      ["espinaca", "pepino", "pimiento"],
      ["lechuga", "jitomate", "nopal"],
    ];

    return saladSets[index % saladSets.length];
  }

  const vegetableSets = [
    ["brócoli", "calabaza"],
    ["ejotes", "champiñones"],
    ["nopal", "pimiento"],
    ["espárragos", "calabaza"],
  ];

  return vegetableSets[index % vegetableSets.length];

}

function getFoodsByCategory(
  validations: FoodValidation[],
  category: FoodCategory
) {

  return normalizeRequestedFoods(
    validations
      .filter(item => item.category === category && item.isCompatible)
      .map(item => item.canonicalFood)
  );

}

function matchesFlexibleList(
  normalizedCandidate: string,
  list: string[]
) {

  return list.some(item => {
    const normalizedItem = normalizeText(item);

    return normalizedCandidate === normalizedItem ||
      normalizedCandidate.includes(normalizedItem) ||
      normalizedItem.includes(normalizedCandidate);
  });

}

function extractFoodList(
  value: string
) {

  return value
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("-"))
    .map(line =>
      line
        .replace(/^-\s*/, "")
        .replace(/\(.*?\)/g, "")
        .trim()
    )
    .filter(Boolean);

}

function removeDuplicatedValidations(
  validations: FoodValidation[]
) {

  const seen = new Set<string>();

  return validations.filter(item => {
    const key = `${item.category}:${normalizeText(item.canonicalFood)}`;

    if (seen.has(key)) return false;

    seen.add(key);

    return true;
  });

}

function removeDuplicatedBases(
  bases: MealBase[]
) {

  const seen = new Set<string>();

  return bases.filter(base => {
    const key = normalizeText(base.title);

    if (seen.has(key)) return false;

    seen.add(key);

    return true;
  });

}

function canonicalizeProtein(value: string) {

  const normalized = normalizeText(value);

  if (normalized.includes("atun")) return "Atún";
  if (normalized.includes("sardina")) return "Sardina";
  if (normalized.includes("pulpo")) return "Pulpo";
  if (normalized.includes("huevo")) return "Huevo entero";
  if (normalized.includes("pollo")) return "Pechuga de pollo";
  if (normalized.includes("pescado")) return "Filete de pescado blanco";
  if (normalized.includes("camaron")) return "Camarón";
  if (normalized.includes("salmon")) return "Salmón";
  if (normalized.includes("tilapia")) return "Tilapia";
  if (normalized.includes("res") || normalized.includes("bistec")) return "Bistec de res";
  if (normalized.includes("cerdo")) return "Lomo de cerdo";
  if (normalized.includes("pavo")) return "Pavo";
  if (normalized.includes("queso")) return "Queso panela";
  if (normalized.includes("yogur") || normalized.includes("yogurt")) return "Yogur griego natural sin azúcar";
  if (normalized.includes("kefir")) return "Kéfir natural";
  if (normalized.includes("tofu")) return "Tofu";
  if (normalized.includes("tempeh")) return "Tempeh";

  return capitalize(value);

}

function canonicalizeFat(value: string) {

  const normalized = normalizeText(value);

  if (normalized.includes("aguacate")) return "Aguacate";
  if (normalized.includes("oliva")) return "Aceite de oliva extra virgen";
  if (normalized.includes("almendra")) return "Almendras";
  if (normalized.includes("nuez") || normalized.includes("nueces")) return "Nueces";
  if (normalized.includes("pistache")) return "Pistaches";
  if (normalized.includes("cacahuate")) return "Cacahuate natural";
  if (normalized.includes("chia")) return "Chía";
  if (normalized.includes("linaza")) return "Linaza";

  return capitalize(value);

}

function canonicalizeVegetable(value: string) {

  const normalized = normalizeText(value);

  if (normalized.includes("brocoli")) return "Brócoli";
  if (normalized.includes("esparrago")) return "Espárragos";
  if (normalized.includes("champinon")) return "Champiñones";
  if (normalized.includes("jitomate")) return "Jitomate";
  if (normalized.includes("tomate")) return "Tomate verde";
  if (normalized.includes("lechuga")) return "Lechuga romana";
  if (normalized.includes("espinaca")) return "Espinaca";
  if (normalized.includes("pepino")) return "Pepino";
  if (normalized.includes("calabaza")) return "Calabaza";
  if (normalized.includes("ejote")) return "Ejotes";
  if (normalized.includes("nopal")) return "Nopal";
  if (normalized.includes("pimiento")) return "Pimiento verde";
  if (normalized.includes("cebolla")) return "Cebolla";
  if (normalized.includes("ajo")) return "Ajo";
  if (normalized.includes("coliflor")) return "Coliflor";

  return capitalize(value);

}

function canonicalizeLegume(value: string) {

  const normalized = normalizeText(value);

  if (normalized.includes("frijol")) return "Frijol negro";
  if (normalized.includes("garbanzo")) return "Garbanzo";
  if (normalized.includes("lenteja")) return "Lenteja";
  if (normalized.includes("haba")) return "Haba";
  if (normalized.includes("soya")) return "Soya";
  if (normalized.includes("alubia")) return "Alubias";

  return capitalize(value);

}

function canonicalizeFruit(value: string) {

  const normalized = normalizeText(value);

  if (normalized.includes("fresa")) return "Fresas";
  if (normalized.includes("arandano")) return "Arándanos";
  if (normalized.includes("frambuesa")) return "Frambuesas";
  if (normalized.includes("zarzamora")) return "Zarzamoras";
  if (normalized.includes("mora")) return "Moras";
  if (normalized.includes("manzana")) return "Manzana verde";
  if (normalized.includes("toronja")) return "Toronja";

  return capitalize(value);

}

function formatList(
  items: string[]
) {

  const cleanItems = items.filter(Boolean);

  if (cleanItems.length === 0) return "";

  if (cleanItems.length === 1) return lowerFirst(cleanItems[0]);

  if (cleanItems.length === 2) {
    return `${lowerFirst(cleanItems[0])} y ${lowerFirst(cleanItems[1])}`;
  }

  return `${cleanItems
    .slice(0, -1)
    .map(lowerFirst)
    .join(", ")} y ${lowerFirst(cleanItems[cleanItems.length - 1])}`;

}

function lowerFirst(value: string) {

  if (!value) return value;

  return value.charAt(0).toLowerCase() + value.slice(1);

}

function capitalize(value: string) {

  if (!value) return value;

  return value.charAt(0).toUpperCase() + value.slice(1);

}

function sanitizeForPrompt(value: string) {

  return value
    .trim()
    .replace(/\n{3,}/g, "\n\n");

}

function normalizeText(value: string) {

  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}