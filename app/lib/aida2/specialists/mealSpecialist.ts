// app/lib/aida2/specialists/mealSpecialist.ts

import {
  evaluateFoodWithProtocol,
  runProtocolModule,
  type ProtocolId,
} from "../modules/protocolModule";
import { PREPARATION_NAMES } from "../modules/preparationAnalyzer";
import type {
  FoodCategory,
  FoodValidation,
  MealSpecialistDecision,
} from "../modules/foodDecisionTypes";

export type {
  FoodCategory,
  FoodValidation,
  MealDecisionStatus,
  MealFoodDecision,
  MealSpecialistDecision,
} from "../modules/foodDecisionTypes";

export type MealType = "desayuno" | "comida" | "cena" | "snack";

export type MealRequest = {
  mealType: MealType;
  userMessage?: string;
  protocolId?: ProtocolId;
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

  const contextualUserMessage = restorePreparationContext({
    rawMessage,
    currentUserMessage,
  });
  const messageForValidation = shouldBuildOptions
    ? removeAvoidedFoodPhrases(contextualUserMessage, avoidFoods)
    : contextualUserMessage;

  const evaluation = evaluateFoodWithProtocol({
    protocol,
    userMessage: messageForValidation ?? "",
    shouldBuildRecipes: shouldBuildOptions,
    ignoreFoods: avoidFoods,
    requestedConditionalFoodList: isConditionalFoodListRequest(currentUserMessage),
  });
  const { validations, incompatibleFoods, compatibleFoods, conditionalFoods } = evaluation;
  const canBuildDespiteIncompatible =
    shouldBuildOptions &&
    (instruction.pendingActionType === "BUILD_ALTERNATIVES" ||
      avoidFoods.length > 0 ||
      requestsCompatiblePreparationAlternatives(currentUserMessage));

  const mealBases =
    shouldBuildOptions && (incompatibleFoods.length === 0 || canBuildDespiteIncompatible)
      ? buildCompatibleOptions({
          mealType: request.mealType,
          requestedCount,
          validations: compatibleFoods,
          avoidFoods,
          requestedText: currentUserMessage,
        })
      : [];

  const decision = evaluation.decision;

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

function requestsCompatiblePreparationAlternatives(
  userMessage: string | undefined
) {
  if (!userMessage) return false;

  return /\b(?:opciones?|recetas?|alternativas?)\b[\s\S]*\b(?:tortillas?|pan|pizza|galletas?|bases?)\b[\s\S]*\b(?:pueda|permitid[ao]s?|compatibles?|alternativas?)\b/i.test(
    userMessage
  );
}

function shouldBuildCompatibleOptions(
  currentUserMessage: string | undefined,
  instruction: SpecialistInstruction
) {
  if (isConditionalFoodListRequest(currentUserMessage)) return false;
  if (
    instruction.expectedAction === "VALIDATE_FOOD" ||
    instruction.expectedAction === "VALIDATE_PREPARATION"
  ) return false;
  if (instruction.expectedAction === "BUILD_OPTIONS") return true;
  if (isRecipeRequest(currentUserMessage)) return true;
  if (!instruction.shouldContinuePendingAction) return false;
  if (instruction.pendingActionType === "BUILD_ALTERNATIVES") return true;
  if (instruction.pendingActionType === "BUILD_RECIPES") return true;
  if (instruction.pendingActionType === "CONTINUE_PREVIOUS") return true;

  return false;
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
  requestedText?: string;
}) {
  const { mealType, requestedCount, validations, avoidFoods, requestedText } = params;

  if (/\btortillas?\b/i.test(requestedText ?? "")) {
    const tortillaOptions = [
      "Tortilla de linaza preparada con linaza molida, huevo, agua y especias.",
      "Tortilla de nopal preparada con nopal, huevo y linaza, sin harina de maíz ni trigo.",
      "Tortilla de coliflor preparada con coliflor, huevo y queso natural, sin harinas ni almidones.",
    ];

    return Array.from({ length: requestedCount }, (_, index) => ({
      title: tortillaOptions[index % tortillaOptions.length],
      proteins: [],
      vegetables: [],
      fats: [],
      legumes: [],
      fruits: [],
    }));
  }

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
  return match?.[1]
    ? match[1]
        .split(/\b(?:con|y|o|u)\b|,/g)
        .map(item => item.trim())
        .filter(Boolean)
    : [];
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

function restorePreparationContext(params: {
  rawMessage: string;
  currentUserMessage: string | undefined;
}) {
  const { rawMessage, currentUserMessage } = params;
  if (!currentUserMessage) return currentUserMessage;

  const isConfirmationFollowUp =
    /\b(?:entonces|finalmente|en resumen|s[ií]\s+puedo|puedo\s+comer)\b/i.test(
      currentUserMessage
    );
  const describesIngredients =
    /\b(?:preparo|prepar[eé]|hago|hice|hech[ao]s?|ingredientes?|lleva|contiene)\b/i.test(
      currentUserMessage
    );
  const namesPreparation = PREPARATION_NAMES.some(name =>
    normalizeText(currentUserMessage).includes(normalizeText(name))
  );

  if (describesIngredients && !namesPreparation) {
    const lastTarget = rawMessage.match(
      /- Último alimento consultado:\s*(.+?)\.(?:\n|$)/i
    )?.[1]?.trim();

    if (lastTarget && !/^ninguno|sin /i.test(lastTarget)) {
      return `${lastTarget}. ${currentUserMessage}`;
    }
  }

  if (!isConfirmationFollowUp || describesIngredients) {
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
