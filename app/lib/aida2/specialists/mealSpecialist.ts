// app/lib/aida2/specialists/mealSpecialist.ts

import {
  runProtocolModule,
  type ProtocolId,
} from "../modules/protocolModule";

export type MealType = "desayuno" | "comida" | "cena" | "snack";

export type MealRequest = {
  mealType: MealType;
  userMessage?: string;
  protocolId?: ProtocolId;
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

type ProtocolSections = Record<string, string>;

export type FoodCategory =
  | "proteína"
  | "grasa saludable"
  | "vegetal bajo en carga glucémica"
  | "leguminosa"
  | "fruta"
  | "bebida"
  | "carbohidrato de alta carga glucémica"
  | "carbohidrato saludable con validación"
  | "preparación"
  | "preparación compatible condicionada"
  | "desconocido";

export type FoodValidation = {
  food: string;
  canonicalFood: string;
  category: FoodCategory;
  isCompatible: boolean;
  reason: string;
  source:
    | "protocol_reference"
    | "protocol_conditional"
    | "clinical_classification"
    | "restricted"
    | "preparation"
    | "ingredient_based_preparation"
    | "unknown";
};

export type MealDecisionStatus =
  | "ALLOWED"
  | "ALLOWED_WITH_VALIDATION"
  | "NOT_ALLOWED"
  | "NEEDS_INGREDIENTS"
  | "UNKNOWN";

export type MealFoodDecision = {
  food: string;
  canonicalFood: string;
  category: FoodCategory;
  status: MealDecisionStatus;
  reason: string;
  source: FoodValidation["source"];
};

export type MealSpecialistDecision = {
  protocolId: ProtocolId;
  foods: MealFoodDecision[];
  conditionalFoods: string[];
  requestedConditionalFoodList: boolean;
  shouldMeasureGlucose: boolean;
  shouldBuildRecipes: boolean;
  shouldExplainValidation: boolean;
  hasAllowedFoods: boolean;
  hasConditionalFoods: boolean;
  hasNotAllowedFoods: boolean;
  hasUnknownFoods: boolean;
};

export type MealRecommendationResult = {
  success: true;
  recommendation: string;
  decision: MealSpecialistDecision;
};

type MealBase = {
  title: string;
  proteins: string[];
  vegetables: string[];
  fats: string[];
  legumes: string[];
  fruits: string[];
};

type PendingActionType = "BUILD_RECIPES" | "BUILD_ALTERNATIVES" | "EXPLAIN_DECISION" | "ASK_INGREDIENTS" | "CONTINUE_PREVIOUS" | "NONE";

type SpecialistInstruction = {
  expectedAction: string | null;
  pendingActionType: PendingActionType | null;
  count: number | null;
  target: string | null;
  avoid: string[];
  shouldContinuePendingAction: boolean;
};

const COMMON_FOOD_TERMS = [
  "pan blanco", "pan integral", "pan de trigo", "pan común", "pan comun",
  "tostada", "tostadas", "tortilla de maíz", "tortilla de maiz",
  "tortilla de harina", "arroz", "arroz integral", "pasta", "avena",
  "cereal", "cereales", "granola", "galleta", "galletas", "papa",
  "papas", "camote", "azúcar", "azucar", "refresco", "refrescos",
  "jugo", "jugos", "postre", "postres", "miel",
];


const CONDITIONAL_PREPARATION_NAMES = [
  "pan", "tortilla", "tortillas", "pizza", "galleta", "galletas", "base",
];

const COMPATIBLE_PREPARATION_INGREDIENTS = [
  "harina de almendra", "almendra", "almendras", "linaza", "chía", "chia",
  "huevo", "huevos", "clara", "claras", "queso", "brócoli", "brocoli",
  "coliflor", "calabaza", "nopal", "espinaca", "pollo", "atún", "atun",
  "sardina", "pulpo", "aceite de oliva", "aceite de aguacate", "aguacate",
  "leche sin azúcar", "leche sin azucar", "yogur natural sin azúcar",
  "yogurt natural sin azúcar", "kéfir natural", "kefir natural",
];

const INCOMPATIBLE_PREPARATION_INGREDIENTS = [
  "harina de trigo", "trigo", "harina blanca", "harina integral",
  "harina de maíz", "harina de maiz", "maíz", "maiz", "maseca", "avena",
  "harina de avena", "arroz", "harina de arroz", "papa", "camote",
  "azúcar", "azucar", "miel", "piloncillo", "jarabe", "fécula",
  "fecula", "maicena",
];

const FLEXIBLE_PROTEINS = [
  "huevo", "huevos", "pollo", "res", "carne", "bistec", "cerdo", "pavo",
  "pescado", "atún", "atun", "sardina", "sardinas", "salmón", "salmon",
  "tilapia", "mojarra", "camarón", "camaron", "camarones", "pulpo",
  "mariscos", "tofu", "tempeh", "queso", "yogur", "yogurt", "kéfir",
  "kefir",
];

const FLEXIBLE_FATS = [
  "aguacate", "aceite de oliva", "aceite de aguacate", "aceitunas",
  "almendras", "almendra", "nueces", "pistaches", "cacahuate",
  "cacahuates", "chía", "chia", "linaza", "semillas",
];

const FLEXIBLE_VEGETABLES = [
  "lechuga", "espinaca", "acelga", "arúgula", "arugula", "brócoli",
  "brocoli", "coliflor", "pepino", "calabaza", "ejotes", "champiñones",
  "champinon", "champiñón", "setas", "jitomate", "tomate", "tomate verde",
  "apio", "espárragos", "esparragos", "nopal", "pimiento", "pimientos",
  "chile", "cebolla", "ajo", "rábano", "rabano",
];

const FLEXIBLE_LEGUMES = [
  "frijol", "frijoles", "garbanzo", "garbanzos", "lenteja", "lentejas",
  "haba", "habas", "soya", "alubias",
];

const FLEXIBLE_FRUITS = [
  "fresa", "fresas", "arándanos", "arandanos", "frambuesas", "zarzamoras",
  "moras", "manzana verde", "toronja",
];

const DEFAULT_FATS = ["Aguacate", "Aceite de oliva extra virgen"];

const GENERIC_OPTIONS: Record<MealType, string[]> = {
  desayuno: [
    "Huevos con espinaca, champiñones y aguacate.",
    "Omelette de huevo con brócoli, pimiento y queso panela.",
    "Pollo deshebrado con nopal, jitomate y aceite de oliva extra virgen.",
    "Yogur griego natural sin azúcar con chía y nueces, si el protocolo lo permite.",
    "Bistec de res con calabaza, espinaca y aguacate.",
  ],
  comida: [
    "Pechuga de pollo a la plancha con brócoli, calabaza y aguacate.",
    "Filete de pescado con nopal asado, pepino y aceite de oliva extra virgen.",
    "Bistec de res con champiñones, pimiento y aguacate.",
    "Ensalada de atún con lechuga, pepino, jitomate y aguacate.",
    "Camarones salteados con calabaza, brócoli y aceite de oliva extra virgen.",
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
    "Almendras con pepino, si el protocolo permite esa grasa saludable.",
  ],
};

const PROTEIN_RECIPE_OPTIONS: Array<{ match: string[]; recipes: string[] }> = [
  {
    match: ["huevo", "huevos"],
    recipes: [
      "Huevos con espinaca, champiñones y aguacate.",
      "Omelette de huevo con brócoli, pimiento y queso panela.",
      "Huevos revueltos con nopal, jitomate y aceite de oliva extra virgen.",
    ],
  },
  {
    match: ["pollo"],
    recipes: [
      "Pollo a la plancha con calabaza, champiñones y aguacate.",
      "Ensalada de pollo con lechuga, pepino, jitomate y aceite de oliva extra virgen.",
      "Pollo salteado con brócoli, pimiento y ajo.",
    ],
  },
  {
    match: ["atun", "atún"],
    recipes: [
      "Ensalada de atún con pepino, jitomate, lechuga y aguacate.",
      "Atún con nopal asado, pimiento y aceite de oliva extra virgen.",
      "Atún con calabaza salteada, espinaca y champiñones.",
    ],
  },
  {
    match: ["sardina", "sardinas"],
    recipes: [
      "Ensalada de sardina con pepino, jitomate, lechuga y aguacate.",
      "Sardina guisada con nopal, pimiento y tomate verde.",
      "Sardinas con calabaza salteada, espinaca y aceite de oliva extra virgen.",
    ],
  },
  {
    match: ["pescado", "tilapia", "mojarra"],
    recipes: [
      "Filete de pescado a la plancha con calabaza, espinaca y aguacate.",
      "Pescado con nopal asado, pepino y aceite de oliva extra virgen.",
      "Pescado salteado con brócoli, champiñones y ajo.",
    ],
  },
  {
    match: ["camaron", "camarón", "camarones"],
    recipes: [
      "Camarones salteados con calabaza, pimiento y ajo.",
      "Ensalada de camarón con pepino, lechuga, jitomate y aguacate.",
      "Camarones con nopal asado, espinaca y aceite de oliva extra virgen.",
    ],
  },
  {
    match: ["res", "bistec", "carne"],
    recipes: [
      "Bistec a la plancha con nopal, pimiento y aguacate.",
      "Bistec con brócoli salteado, champiñones y aceite de oliva extra virgen.",
      "Ensalada tibia de bistec con lechuga, pepino y jitomate.",
    ],
  },
  {
    match: ["pulpo"],
    recipes: [
      "Pulpo a la plancha con nopal asado, pimiento y aguacate.",
      "Ensalada fresca de pulpo con pepino, jitomate, lechuga y aceite de oliva.",
      "Pulpo salteado con calabaza, champiñones y ajo.",
    ],
  },
];

export function generateMealRecommendation(
  request: MealRequest
): MealRecommendationResult {
  const protocol = runProtocolModule({
    protocolId: request.protocolId,
  });
  const foods = protocol.structured.allowedFoods;
  const conditionalFoods = extractConditionalFoods(protocol.sections);
  const rawMessage = request.userMessage ?? "";
  const currentUserMessage = extractCurrentUserMessage(rawMessage);
  const instruction = parseSpecialistInstruction(rawMessage);
  const avoidFoods = normalizeFoodList([
    ...instruction.avoid,
    ...extractAvoidedFoods(currentUserMessage),
  ]);

  const shouldBuildOptions = shouldBuildCompatibleOptions(currentUserMessage, instruction);
  const requestedCount =
    instruction.count ?? extractRequestedCount(currentUserMessage) ?? (shouldBuildOptions ? 3 : 1);

  const contextualUserMessage = restoreConfirmedPreparationFromHistory({
    rawMessage,
    currentUserMessage,
  });
  const messageForValidation = shouldBuildOptions
    ? removeAvoidedFoodPhrases(contextualUserMessage, avoidFoods)
    : contextualUserMessage;

  const validations = validateMentionedFoods({
    userMessage: messageForValidation,
    foods,
    restrictedFoodsText: protocol.sections.restrictedFoods,
    conditionalFoods,
    ignoreFoods: avoidFoods,
    protocolId: protocol.protocolId,
  });

  const incompatibleFoods = validations.filter(item =>
    !item.isCompatible && item.category !== "preparación"
  );

  const compatibleFoods = validations.filter(item => item.isCompatible);
  const canBuildDespiteIncompatible =
    shouldBuildOptions &&
    (instruction.pendingActionType === "BUILD_ALTERNATIVES" || avoidFoods.length > 0);

  const mealBases =
    shouldBuildOptions && (incompatibleFoods.length === 0 || canBuildDespiteIncompatible)
      ? buildCompatibleOptions({
          mealType: request.mealType,
          requestedCount,
          validations: compatibleFoods,
          avoidFoods,
        })
      : [];

  const decision = buildStructuredMealDecision({
    protocolId: protocol.protocolId,
    validations,
    conditionalFoods,
    currentUserMessage,
    shouldBuildOptions,
  });

  return {
    success: true,
    recommendation: buildProtocolGuidance({
      mealType: request.mealType,
      requestedCount,
      validations,
      incompatibleFoods,
      mealBases,
      shouldBuildOptions,
      instruction,
      avoidFoods,
      phasePurpose: protocol.sections.purpose,
      plateDistribution: protocol.sections.plateDistribution,
      generalGuidelines: protocol.sections.generalGuidelines,
      fruitGuidelines: protocol.sections.fruits,
      controlSheet: protocol.sections.controlSheet,
      conditionalFoods,
      protocolId: protocol.protocolId,
    }),
    decision,
  };
}

function buildStructuredMealDecision(params: {
  protocolId: ProtocolId;
  validations: FoodValidation[];
  conditionalFoods: string[];
  currentUserMessage: string | undefined;
  shouldBuildOptions: boolean;
}): MealSpecialistDecision {
  const {
    protocolId,
    validations,
    conditionalFoods,
    currentUserMessage,
    shouldBuildOptions,
  } = params;

  const foods = validations.map(toMealFoodDecision);

  const hasAllowedFoods = foods.some(item => item.status === "ALLOWED");
  const hasConditionalFoods = foods.some(
    item => item.status === "ALLOWED_WITH_VALIDATION"
  );
  const hasNotAllowedFoods = foods.some(
    item => item.status === "NOT_ALLOWED"
  );
  const hasUnknownFoods = foods.some(item => item.status === "UNKNOWN");

  return {
    protocolId,
    foods,
    conditionalFoods,
    requestedConditionalFoodList:
      isConditionalFoodListRequest(currentUserMessage),
    shouldMeasureGlucose: hasConditionalFoods,
    shouldBuildRecipes: shouldBuildOptions,
    shouldExplainValidation: hasConditionalFoods,
    hasAllowedFoods,
    hasConditionalFoods,
    hasNotAllowedFoods,
    hasUnknownFoods,
  };
}

function toMealFoodDecision(
  validation: FoodValidation
): MealFoodDecision {
  return {
    food: validation.food,
    canonicalFood: validation.canonicalFood,
    category: validation.category,
    status: resolveMealDecisionStatus(validation),
    reason: validation.reason,
    source: validation.source,
  };
}

function resolveMealDecisionStatus(
  validation: FoodValidation
): MealDecisionStatus {
  if (
    validation.source === "protocol_conditional" ||
    validation.category === "carbohidrato saludable con validación"
  ) {
    return "ALLOWED_WITH_VALIDATION";
  }

  if (
    validation.source === "preparation" ||
    validation.category === "preparación"
  ) {
    return "NEEDS_INGREDIENTS";
  }

  if (validation.source === "unknown" || validation.category === "desconocido") {
    return "UNKNOWN";
  }

  if (!validation.isCompatible || validation.source === "restricted") {
    return "NOT_ALLOWED";
  }

  return "ALLOWED";
}

function shouldBuildCompatibleOptions(
  currentUserMessage: string | undefined,
  instruction: SpecialistInstruction
) {
  if (isConditionalFoodListRequest(currentUserMessage)) return false;
  if (instruction.expectedAction === "BUILD_OPTIONS") return true;
  if (instruction.pendingActionType === "BUILD_ALTERNATIVES") return true;
  if (instruction.pendingActionType === "BUILD_RECIPES") return true;
  if (instruction.pendingActionType === "CONTINUE_PREVIOUS") return true;

  return isRecipeRequest(currentUserMessage);
}

function buildProtocolGuidance(params: {
  mealType: MealType;
  requestedCount: number;
  validations: FoodValidation[];
  incompatibleFoods: FoodValidation[];
  mealBases: MealBase[];
  shouldBuildOptions: boolean;
  instruction: SpecialistInstruction;
  avoidFoods: string[];
  phasePurpose?: string;
  plateDistribution?: string;
  generalGuidelines?: string;
  fruitGuidelines?: string;
  controlSheet?: string;
  conditionalFoods: string[];
  protocolId: ProtocolId;
}) {
  const {
    mealType,
    requestedCount,
    validations,
    incompatibleFoods,
    mealBases,
    shouldBuildOptions,
    instruction,
    avoidFoods,
    phasePurpose,
    plateDistribution,
    generalGuidelines,
    fruitGuidelines,
    controlSheet,
    conditionalFoods,
    protocolId,
  } = params;

  const lines: string[] = [
    "VALIDACIÓN DEL ESPECIALISTA EN COMIDA:",
    `- Tipo de comida detectado: ${mealType}.`,
    `- Opciones solicitadas como referencia: ${requestedCount}.`,
    `- Protocolo cargado: ${protocolId}.`,
    "- Fuente de verdad: contenido del protocolo activo; no aplicar prohibiciones universales externas.",
  ];

  if (instruction.expectedAction) lines.push(`- Acción esperada por Cerebro: ${instruction.expectedAction}.`);
  if (instruction.pendingActionType) lines.push(`- Acción pendiente detectada: ${instruction.pendingActionType}.`);

  if (avoidFoods.length > 0) {
    lines.push(`- Alimentos a evitar: ${formatList(avoidFoods)}.`);
    lines.push("- Esos alimentos son restricción de la respuesta, no ingredientes deseados.");
  }

  if (conditionalFoods.length > 0) {
    lines.push(
      "",
      "ALIMENTOS PERMITIDOS CON VALIDACIÓN SEGÚN EL PROTOCOLO:",
      ...conditionalFoods.map(food => `- ${food}.`)
    );
  }

  if (validations.length > 0) {
    lines.push("", "ALIMENTOS, INGREDIENTES O PREPARACIONES DETECTADAS:");
    validations.forEach(item => {
      lines.push(
        `- ${item.food}: ${item.category}; ${item.isCompatible ? "compatible" : "no recomendado"}; ${item.reason}`
      );
    });
  }

  lines.push("", "DECISIÓN NUTRICIONAL:");

  const matchedConditionalFoods = validations.filter(
    item => item.category === "carbohidrato saludable con validación"
  );

  if (incompatibleFoods.length > 0 && !shouldBuildOptions) {
    lines.push("- Hay alimento(s) no compatibles con el protocolo actual.");
    lines.push("- No recomendar esos alimentos durante esta fase.");
    lines.push("- No volverlos permitidos por combinarlos con proteína o grasa.");
  } else if (matchedConditionalFoods.length > 0) {
    lines.push("- El alimento está permitido únicamente con validación en Fase 2.");
    lines.push("- Recomendar una porción controlada y medir glucosa 2 horas después.");
    lines.push("- Si la glucosa postcomida queda entre 100 y 140 mg/dL, la porción puede considerarse tolerada.");
    lines.push("- Si supera 140 mg/dL, reducir la porción y volver a probar la siguiente semana.");
  } else {
    lines.push("- Trabajar solo con alimentos compatibles con la fase.");
    lines.push("- Priorizar proteína, grasas saludables y vegetales bajos en carga glucémica.");
  }

  if (mealBases.length > 0) {
    lines.push("", "BASES CULINARIAS COMPATIBLES:");
    lines.push(`- Entregar ${mealBases.length} opción(es) usando estas bases.`);
    lines.push("- No volver a preguntar si el usuario ya aceptó la acción pendiente.");
    mealBases.forEach((base, index) => lines.push(`${index + 1}. ${base.title}`));
  }

  lines.push("", "LÍMITES DE REDACCIÓN:");
  lines.push("- No mencionar instrucciones internas, Cerebro, módulos ni WorkPlan.");
  lines.push(
    "- La decisión sobre cada alimento debe respetar la clasificación encontrada en el protocolo activo."
  );
  lines.push(
    "- No convertir en prohibido un alimento clasificado por el protocolo como permitido o permitido con validación."
  );
  lines.push(
    "- No convertir en permitido un alimento clasificado por el protocolo como no recomendado."
  );
  lines.push("- Si la acción es BUILD_OPTIONS, entregar opciones concretas sin pedir permiso otra vez.");
  lines.push("- Si faltan ingredientes para validar una preparación especial, pedir solo esos ingredientes.");
  lines.push("- Si se habla de pan, tortilla o base con ingredientes compatibles, validar por ingredientes.");

  if (phasePurpose) lines.push("", "PROPÓSITO DE LA FASE:", sanitizeForPrompt(phasePurpose));
  if (plateDistribution) lines.push("", "DISTRIBUCIÓN DEL PLATO:", sanitizeForPrompt(plateDistribution));
  if (generalGuidelines) lines.push("", "LINEAMIENTOS GENERALES:", sanitizeForPrompt(generalGuidelines));
  if (validations.some(item => item.category === "fruta") && fruitGuidelines) {
    lines.push("", "LINEAMIENTOS DE FRUTAS:", sanitizeForPrompt(fruitGuidelines));
  }
  if (controlSheet) lines.push("", "RELACIÓN CON GLUCÓMETRO:", sanitizeForPrompt(controlSheet));

  return lines.join("\n");
}

function buildCompatibleOptions(params: {
  mealType: MealType;
  requestedCount: number;
  validations: FoodValidation[];
  avoidFoods: string[];
}) {
  const { mealType, requestedCount, validations, avoidFoods } = params;
  const requestedProteins = getFoodsByCategory(validations, "proteína");
  const requestedVegetables = getFoodsByCategory(validations, "vegetal bajo en carga glucémica");
  const requestedFats = getFoodsByCategory(validations, "grasa saludable");
  const requestedLegumes = getFoodsByCategory(validations, "leguminosa");
  const requestedFruits = getFoodsByCategory(validations, "fruta");

  const options = requestedProteins.length > 0
    ? buildProteinOptions({ requestedProteins, requestedVegetables, requestedFats, requestedLegumes, requestedFruits, requestedCount })
    : buildGenericOptions({ mealType, requestedCount, requestedVegetables, requestedFats, requestedLegumes, requestedFruits });

  return removeDuplicatedBases(
    options.filter(option => !containsFood(option.title, avoidFoods))
  ).slice(0, requestedCount);
}

function buildGenericOptions(params: {
  mealType: MealType;
  requestedCount: number;
  requestedVegetables: string[];
  requestedFats: string[];
  requestedLegumes: string[];
  requestedFruits: string[];
}) {
  const { mealType, requestedCount, requestedVegetables, requestedFats, requestedLegumes, requestedFruits } = params;

  return Array.from({ length: requestedCount }, (_, index) => {
    const recipe = GENERIC_OPTIONS[mealType][index % GENERIC_OPTIONS[mealType].length];

    return {
      title: addRequestedDetails({ recipe, requestedVegetables, requestedFats }),
      proteins: [],
      vegetables: requestedVegetables,
      fats: requestedFats.length > 0 ? requestedFats : DEFAULT_FATS,
      legumes: requestedLegumes,
      fruits: requestedFruits,
    };
  });
}

function buildProteinOptions(params: {
  requestedProteins: string[];
  requestedVegetables: string[];
  requestedFats: string[];
  requestedLegumes: string[];
  requestedFruits: string[];
  requestedCount: number;
}) {
  const { requestedProteins, requestedVegetables, requestedFats, requestedLegumes, requestedFruits, requestedCount } = params;
  const bases: MealBase[] = [];

  requestedProteins.forEach(protein => {
    const recipes = getRecipesForProtein(protein);

    for (let index = 0; index < requestedCount; index++) {
      bases.push({
        title: addRequestedDetails({
          recipe: recipes[index % recipes.length],
          requestedVegetables,
          requestedFats,
        }),
        proteins: [protein],
        vegetables: requestedVegetables,
        fats: requestedFats.length > 0 ? requestedFats : DEFAULT_FATS,
        legumes: requestedLegumes,
        fruits: requestedFruits,
      });
    }
  });

  return bases;
}

function getRecipesForProtein(protein: string) {
  const normalizedProtein = normalizeText(protein);
  const match = PROTEIN_RECIPE_OPTIONS.find(template =>
    template.match.some(item => normalizedProtein.includes(normalizeText(item)))
  );

  if (match) return match.recipes;

  return [
    `${capitalize(protein)} con brócoli, calabaza y aguacate.`,
    `${capitalize(protein)} preparado con nopal, pimiento y aceite de oliva.`,
    `Ensalada de ${lowerFirst(protein)} con lechuga, pepino y jitomate.`,
  ];
}

function addRequestedDetails(params: {
  recipe: string;
  requestedVegetables: string[];
  requestedFats: string[];
}) {
  const { recipe, requestedVegetables, requestedFats } = params;
  const details: string[] = [];

  if (requestedVegetables.length > 0) details.push(`incluyendo ${formatList(requestedVegetables)}`);
  if (requestedFats.length > 0) details.push(`usando ${formatList(requestedFats)} como grasa saludable`);
  if (details.length === 0) return recipe;

  return `${recipe.replace(/\.$/, "")}, ${details.join(" y ")}.`;
}

function validateMentionedFoods(params: {
  userMessage: string | undefined;
  foods: AllowedFoods;
  restrictedFoodsText?: string;
  conditionalFoods: string[];
  ignoreFoods?: string[];
  protocolId: ProtocolId;
}) {
  const {
    userMessage,
    foods,
    restrictedFoodsText,
    conditionalFoods,
    ignoreFoods = [],
    protocolId,
  } = params;

  if (!userMessage) return [];

  const ignored = normalizeFoodList(ignoreFoods);
  const restrictedFoods = normalizeFoodList(
    extractFoodList(restrictedFoodsText ?? "")
  );
  const protocolTerms = normalizeFoodList([
    ...flattenAllowedFoods(foods),
    ...conditionalFoods,
    ...restrictedFoods,
  ]);
  const candidates = extractFoodCandidates(userMessage, protocolTerms).filter(
    candidate => !containsFood(candidate, ignored)
  );

  return removeDuplicatedValidations(
    candidates.map(candidate =>
      validateFood({
        candidate,
        userMessage,
        foods,
        restrictedFoods,
        conditionalFoods,
        protocolId,
      })
    )
  );
}

function validateFood(params: {
  candidate: string;
  userMessage: string;
  foods: AllowedFoods;
  restrictedFoods: string[];
  conditionalFoods: string[];
  protocolId: ProtocolId;
}): FoodValidation {
  const {
    candidate,
    userMessage,
    foods,
    restrictedFoods,
    conditionalFoods,
    protocolId,
  } = params;

  const phaseConditionalFood = validateProtocolConditionalFood({
    candidate,
    conditionalFoods,
    protocolId,
  });

  if (phaseConditionalFood) return phaseConditionalFood;

  const preparationValidation = validateConditionalPreparation({
    candidate,
    userMessage,
  });

  if (preparationValidation) return preparationValidation;

  const normalizedCandidate = normalizeText(candidate);
  const restrictedMatch = restrictedFoods.find(food => {
    const normalizedFood = normalizeText(food);

    return (
      normalizedCandidate === normalizedFood ||
      normalizedCandidate.includes(normalizedFood) ||
      normalizedFood.includes(normalizedCandidate)
    );
  });

  if (restrictedMatch) {
    return {
      food: lowerFirst(candidate),
      canonicalFood: restrictedMatch,
      category: "carbohidrato de alta carga glucémica",
      isCompatible: false,
      reason: "eleva la carga glucémica y se restringe en esta fase",
      source: "restricted",
    };
  }

  const protocolMatch = findInAllowedFoods({ candidate, foods });
  if (protocolMatch) return protocolMatch;

  // La clasificación final debe provenir del protocolo activo.
  // Las listas auxiliares solo ayudan a detectar términos, no a decidir permisos.

  return {
    food: lowerFirst(candidate),
    canonicalFood: candidate,
    category: "desconocido",
    isCompatible: false,
    reason: "el protocolo activo no ofrece una clasificación explícita para este alimento",
    source: "unknown",
  };
}

function validateProtocolConditionalFood(params: {
  candidate: string;
  conditionalFoods: string[];
  protocolId: ProtocolId;
}): FoodValidation | null {
  const { candidate, conditionalFoods, protocolId } = params;
  const normalizedCandidate = normalizeText(candidate);
  const match = conditionalFoods.find(food => {
    const normalizedFood = normalizeText(food);

    return (
      normalizedCandidate === normalizedFood ||
      normalizedCandidate.includes(normalizedFood) ||
      normalizedFood.includes(normalizedCandidate)
    );
  });

  if (!match) return null;

  return {
    food: lowerFirst(candidate),
    canonicalFood: match,
    category: "carbohidrato saludable con validación",
    isCompatible: true,
    reason:
      protocolId === "FASE_2"
        ? "el protocolo lo permite en porción controlada y pide medir glucosa 2 horas después"
        : "el protocolo lo permite únicamente bajo sus reglas de validación",
    source: "protocol_conditional",
  };
}

function compatible(food: string, canonicalFood: string, category: FoodCategory, reason: string): FoodValidation {
  return {
    food: lowerFirst(food),
    canonicalFood,
    category,
    isCompatible: true,
    reason,
    source: "clinical_classification",
  };
}

function validateConditionalPreparation(params: {
  candidate: string;
  userMessage: string;
}): FoodValidation | null {
  const { candidate, userMessage } = params;
  const normalizedCandidate = normalizeText(candidate);
  const normalizedMessage = normalizeText(userMessage);
  const mentionsConditionalName = CONDITIONAL_PREPARATION_NAMES.some(item =>
    normalizedCandidate.includes(normalizeText(item)) || normalizedMessage.includes(normalizeText(item))
  );

  if (!mentionsConditionalName) return null;

  const explicitlyDescribesIngredients = /\b(?:la|lo|las|los)?\s*(?:preparo|prepar[eé]|hago|hice)\s+con\b|\b(?:hech[ao]s?|preparad[ao]s?)\s+con\b|\b(?:ingredientes?|lleva|contiene)\b/i.test(
    userMessage
  );
  const describesAlternativePreparation = /\b(?:tortilla|pan|pizza|galleta|base)\s+de\s+(?:linaza|ch[ií]a|nopal|almendra|br[oó]coli|coliflor|calabaza|espinaca|queso)\b/i.test(
    userMessage
  );

  if (!explicitlyDescribesIngredients) {
    if (!describesAlternativePreparation) return null;

    return {
      food: lowerFirst(candidate),
      canonicalFood: candidate,
      category: "preparación",
      isCompatible: true,
      reason:
        "parece una preparación alternativa, pero requiere conocer todos sus ingredientes antes de decidir",
      source: "preparation",
    };
  }

  const incompatibleIngredients = INCOMPATIBLE_PREPARATION_INGREDIENTS.filter(ingredient =>
    normalizedMessage.includes(normalizeText(ingredient))
  );

  if (incompatibleIngredients.length > 0) {
    return {
      food: lowerFirst(candidate),
      canonicalFood: candidate,
      category: "carbohidrato de alta carga glucémica",
      isCompatible: false,
      reason: `contiene ingrediente(s) no compatibles: ${formatList(incompatibleIngredients)}`,
      source: "restricted",
    };
  }

  const compatibleIngredients = COMPATIBLE_PREPARATION_INGREDIENTS.filter(ingredient =>
    normalizedMessage.includes(normalizeText(ingredient))
  );

  if (compatibleIngredients.length > 0) {
    return {
      food: lowerFirst(candidate),
      canonicalFood: candidate,
      category: "preparación compatible condicionada",
      isCompatible: true,
      reason: `fue descrita con ingredientes compatibles: ${formatList(compatibleIngredients)}`,
      source: "ingredient_based_preparation",
    };
  }

  return {
    food: lowerFirst(candidate),
    canonicalFood: candidate,
    category: "preparación",
    isCompatible: true,
    reason: "requiere validar ingredientes antes de decidir",
    source: "preparation",
  };
}

function findInAllowedFoods(params: {
  candidate: string;
  foods: AllowedFoods;
}): FoodValidation | null {
  const { candidate, foods } = params;
  const groups: Array<{ category: FoodCategory; foods: string[]; reason: string }> = [
    { category: "proteína", foods: [...foods.proteins, ...foods.dairy], reason: "aparece como proteína o lácteo natural compatible" },
    { category: "grasa saludable", foods: foods.healthyFats, reason: "aparece como grasa saludable de referencia" },
    { category: "vegetal bajo en carga glucémica", foods: foods.vegetables, reason: "aparece como vegetal sin almidón de referencia" },
    { category: "leguminosa", foods: foods.legumes, reason: "aparece como leguminosa compatible dentro del plato" },
    { category: "fruta", foods: foods.fruits, reason: "aparece como fruta permitida por el protocolo" },
    { category: "bebida", foods: foods.beverages, reason: "aparece como bebida compatible" },
  ];

  const normalizedCandidate = normalizeText(candidate);

  for (const group of groups) {
    const match = group.foods.find(food =>
      normalizedCandidate === normalizeText(food) ||
      normalizedCandidate.includes(normalizeText(food)) ||
      normalizeText(food).includes(normalizedCandidate)
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

function flattenAllowedFoods(foods: AllowedFoods) {
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

function extractConditionalFoods(sections: ProtocolSections) {
  const sources = Object.values(sections).filter(Boolean);
  const foods: string[] = [];

  sources.forEach(section => {
    const headingMatches = [
      /##\s*PERMITIDOS CON VALIDACI[ÓO]N\s*([\s\S]*?)(?=\n##\s|$)/gi,
      /PERMITIDOS CON VALIDACI[ÓO]N:\s*([\s\S]*?)(?=\n(?:EVITAR|NO RECOMENDADOS|##|#)[:\s]|$)/gi,
    ];

    headingMatches.forEach(pattern => {
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(section)) !== null) {
        foods.push(...extractFoodList(match[1] ?? ""));
      }
    });
  });

  return normalizeFoodList(foods);
}

function extractFoodCandidates(userMessage: string, protocolTerms: string[] = []) {
  const normalizedMessage = normalizeText(userMessage);
  const candidates = new Set<string>();
  const knownTerms = [
    ...protocolTerms,
    ...COMMON_FOOD_TERMS,
    ...CONDITIONAL_PREPARATION_NAMES,
    ...COMPATIBLE_PREPARATION_INGREDIENTS,
    ...INCOMPATIBLE_PREPARATION_INGREDIENTS,
    ...FLEXIBLE_PROTEINS,
    ...FLEXIBLE_FATS,
    ...FLEXIBLE_VEGETABLES,
    ...FLEXIBLE_LEGUMES,
    ...FLEXIBLE_FRUITS,
  ];

  knownTerms
    .filter(term => normalizedMessage.includes(normalizeText(term)))
    .sort((a, b) => normalizeText(b).length - normalizeText(a).length)
    .forEach(term => {
      const normalizedTerm = normalizeText(term);
      const overlapsWithExisting = Array.from(candidates).some(existing => {
        const normalizedExisting = normalizeText(existing);

        return (
          normalizedExisting.includes(normalizedTerm) ||
          normalizedTerm.includes(normalizedExisting)
        );
      });

      if (!overlapsWithExisting) {
        candidates.add(term);
      }
    });

  [
    /recetas? (?:con|de|para) ([a-záéíóúñ\s]+)/i,
    /ideas? (?:con|de|para) ([a-záéíóúñ\s]+)/i,
    /opciones? (?:con|de|para) ([a-záéíóúñ\s]+)/i,
    /puedo (?:comer|tomar|beber|desayunar|cenar|agregar) ([a-záéíóúñ\s]+)/i,
    /quiero (?:comer|tomar|beber|desayunar|cenar|agregar) ([a-záéíóúñ\s]+)/i,
    /tengo (?:antojo|ganas) de ([a-záéíóúñ\s]+)/i,
    /se me antoja ([a-záéíóúñ\s]+)/i,
    /lleva ([a-záéíóúñ\s]+)/i,
    /tiene ([a-záéíóúñ\s]+)/i,
    /hech[ao] con ([a-záéíóúñ\s]+)/i,
    /con ([a-záéíóúñ\s]+)/i,
  ].forEach(pattern => {
    const match = normalizedMessage.match(pattern);
    if (match?.[1]) cleanExtractedFoods(match[1]).forEach(food => candidates.add(food));
  });

  return Array.from(candidates).map(item => item.trim()).filter(Boolean);
}

function cleanExtractedFoods(value: string) {
  return value
    .replace(/[¿?¡!.,]/g, "")
    .split(/\b(?:con|y|o|u|,)\b/g)
    .map(item =>
      item
        .replace(/\b(un|una|dos|tres|el|la|los|las|a|al|algún|algun|alguna|platillo|platillos|comida|cena|desayuno|poco|poquito|de|para|mi|opcion|opciones|receta|recetas|idea|ideas|hecho|hecha|lleva|tiene|contiene|sin)\b/g, "")
        .trim()
    )
    .filter(Boolean)
    .map(item => item.split(/\s+/).slice(0, 4).join(" "));
}

function parseSpecialistInstruction(userMessage: string): SpecialistInstruction {
  return {
    expectedAction: extractLineValue(userMessage, "Acción esperada"),
    pendingActionType: parsePendingActionType(extractLineValue(userMessage, "Tipo")),
    count: extractCountFromInstruction(userMessage),
    target: extractLineValue(userMessage, "Objetivo/target"),
    avoid: extractAvoidFromInstruction(userMessage),
    shouldContinuePendingAction: /El usuario está continuando una acción pendiente:\s*sí/i.test(userMessage),
  };
}

function extractLineValue(text: string, label: string) {
  const pattern = new RegExp(`- ${escapeRegExp(label)}:\\s*(.+?)\\.?(?:\\n|$)`, "i");
  const match = text.match(pattern);
  const value = match?.[1]?.trim();

  if (!value || /^sin |ning[uú]n|ninguno/i.test(value)) return null;

  return value.replace(/\.$/, "");
}

function parsePendingActionType(value: string | null): PendingActionType | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();

  if (
    normalized === "BUILD_RECIPES" ||
    normalized === "BUILD_ALTERNATIVES" ||
    normalized === "EXPLAIN_DECISION" ||
    normalized === "ASK_INGREDIENTS" ||
    normalized === "CONTINUE_PREVIOUS" ||
    normalized === "NONE"
  ) return normalized;

  return null;
}

function extractCountFromInstruction(text: string) {
  const match = text.match(/- Cantidad solicitada:\s*(\d+)/i);
  return match?.[1] ? clampCount(Number(match[1])) : null;
}

function extractAvoidFromInstruction(text: string) {
  const value = extractLineValue(text, "Evitar");
  return value ? value.split(",").map(item => item.trim()).filter(Boolean) : [];
}

function extractAvoidedFoods(text: string | undefined) {
  if (!text) return [];
  const match = normalizeText(text).match(/\bsin\s+([a-záéíóúñ\s]+)/i);
  return match?.[1] ? cleanExtractedFoods(match[1]) : [];
}

function removeAvoidedFoodPhrases(text: string | undefined, avoidFoods: string[]) {
  if (!text || avoidFoods.length === 0) return text;
  let cleanText = text;

  avoidFoods.forEach(food => {
    cleanText = cleanText.replace(new RegExp(`\\bsin\\s+${escapeRegExp(food)}\\b`, "gi"), "");
  });

  return cleanText.trim();
}

function extractCurrentUserMessage(userMessage: string | undefined) {
  if (!userMessage) return userMessage;
  const match = userMessage.match(
    /MENSAJE ACTUAL DEL USUARIO:\s*([\s\S]*?)(?:\n\s*\nDIRECCIÓN DE CEREBRO PARA EL ESPECIALISTA:|$)/
  );

  return match?.[1]?.trim() ?? userMessage;
}

function restoreConfirmedPreparationFromHistory(params: {
  rawMessage: string;
  currentUserMessage: string | undefined;
}) {
  const { rawMessage, currentUserMessage } = params;
  if (!currentUserMessage) return currentUserMessage;

  const isConfirmationFollowUp =
    /\b(?:entonces|finalmente|en resumen|s[ií]\s+puedo|puedo\s+comer)\b/i.test(
      currentUserMessage
    );
  const alreadyDescribesIngredients =
    /\b(?:preparo|prepar[eé]|hago|hice|hech[ao]s?|ingredientes?|lleva|contiene)\b/i.test(
      currentUserMessage
    );

  if (!isConfirmationFollowUp || alreadyDescribesIngredients) {
    return currentUserMessage;
  }

  const ingredientMessages = [...rawMessage.matchAll(/^USER:\s*(.+)$/gim)]
    .map(match => match[1]?.trim())
    .filter((message): message is string => Boolean(message))
    .filter(message =>
      /\b(?:preparo|prepar[eé]|hago|hice|hech[ao]s?|ingredientes?|lleva|contiene)\b/i.test(
        message
      )
    );
  const latestIngredientMessage = ingredientMessages.at(-1);

  return latestIngredientMessage
    ? `${currentUserMessage}. ${latestIngredientMessage}`
    : currentUserMessage;
}

function isConditionalFoodListRequest(userMessage: string | undefined) {
  if (!userMessage) return false;

  return /\b(alimentos?|lista|cu[aá]les|dame|mu[eé]strame)\b[\s\S]*\b(permitidos?|validaci[oó]n|validar)\b/i.test(
    userMessage
  );
}

function isRecipeRequest(userMessage: string | undefined) {
  if (!userMessage) return false;

  return /\b(receta|recetas|idea|ideas|opcion|opciones|platillo|platillos|preparar|hacer|cocinar|dame|sugiere|recomienda)\b/.test(normalizeText(userMessage));
}

function extractRequestedCount(userMessage: string | undefined) {
  if (!userMessage) return null;
  const normalizedMessage = normalizeText(userMessage);
  const numberMatch = normalizedMessage.match(/\b(\d+)\s+(receta|recetas|idea|ideas|opcion|opciones|platillo|platillos)\b/);
  if (numberMatch?.[1]) return clampCount(Number(numberMatch[1]));

  const wordCounts: Record<string, number> = { una: 1, un: 1, dos: 2, tres: 3 };
  const wordMatch = normalizedMessage.match(/\b(una|un|dos|tres)\s+(receta|recetas|idea|ideas|opcion|opciones)\b/);

  return wordMatch?.[1] ? clampCount(wordCounts[wordMatch[1]] ?? 1) : null;
}

function getFoodsByCategory(validations: FoodValidation[], category: FoodCategory) {
  return normalizeFoodList(
    validations
      .filter(item => item.category === category && item.isCompatible)
      .map(item => item.canonicalFood)
  );
}

function matchesList(normalizedCandidate: string, list: string[]) {
  return list.some(item => {
    const normalizedItem = normalizeText(item);
    return normalizedCandidate === normalizedItem ||
      normalizedCandidate.includes(normalizedItem) ||
      normalizedItem.includes(normalizedCandidate);
  });
}

function extractFoodList(value: string) {
  return value
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("-"))
    .map(line => line.replace(/^-\s*/, "").replace(/\(.*?\)/g, "").trim())
    .filter(Boolean);
}

function removeDuplicatedValidations(validations: FoodValidation[]) {
  const seen = new Set<string>();

  return validations.filter(item => {
    const key = `${item.category}:${normalizeText(item.canonicalFood)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function removeDuplicatedBases(bases: MealBase[]) {
  const seen = new Set<string>();

  return bases.filter(base => {
    const key = normalizeText(base.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeFoodList(items: string[]) {
  const seen = new Set<string>();

  return items
    .flatMap(item => item.split(","))
    .map(item => item.trim())
    .filter(item => item && !/^ning[uú]n|ninguno|sin/i.test(item))
    .filter(item => {
      const key = normalizeText(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function containsFood(value: string, foods: string[]) {
  const normalizedValue = normalizeText(value);

  return foods.some(food => {
    const normalizedFood = normalizeText(food);
    return normalizedFood.length > 0 &&
      (normalizedValue.includes(normalizedFood) || normalizedFood.includes(normalizedValue));
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
  if (normalized.includes("lechuga")) return "Lechuga";
  if (normalized.includes("espinaca")) return "Espinaca";
  if (normalized.includes("pepino")) return "Pepino";
  if (normalized.includes("calabaza")) return "Calabaza";
  if (normalized.includes("ejote")) return "Ejotes";
  if (normalized.includes("nopal")) return "Nopal";
  if (normalized.includes("pimiento")) return "Pimiento";
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

function clampCount(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(value, 1), 3);
}

function formatList(items: string[]) {
  const cleanItems = items.filter(Boolean);
  if (cleanItems.length === 0) return "";
  if (cleanItems.length === 1) return lowerFirst(cleanItems[0]);
  if (cleanItems.length === 2) return `${lowerFirst(cleanItems[0])} y ${lowerFirst(cleanItems[1])}`;

  return `${cleanItems.slice(0, -1).map(lowerFirst).join(", ")} y ${lowerFirst(cleanItems[cleanItems.length - 1])}`;
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
  return value.trim().replace(/\n{3,}/g, "\n\n");
}

function normalizeText(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
