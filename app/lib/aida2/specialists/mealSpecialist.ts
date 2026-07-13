// app/lib/aida2/specialists/mealSpecialist.ts

import type {
  ProtocolFoodDecision,
  ProtocolId,
} from "../modules/protocolModule";

export type MealType = "desayuno" | "comida" | "cena" | "snack";

export type MealRequest = {
  mealType: MealType;
  userMessage?: string;
  protocolId?: ProtocolId;
  protocolDecision?: ProtocolFoodDecision;
};

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

export type FoodValidationSource =
  | "protocol_engine"
  | "unknown";

export type FoodValidation = {
  food: string;
  canonicalFood: string;
  category: FoodCategory;
  isCompatible: boolean;
  reason: string;
  source: FoodValidationSource;
};

export type MealDecisionStatus =
  | "ALLOWED"
  | "ALLOWED_WITH_CONDITION"
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
  source: FoodValidationSource;
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

type PendingActionType =
  | "BUILD_RECIPES"
  | "BUILD_ALTERNATIVES"
  | "EXPLAIN_DECISION"
  | "ASK_INGREDIENTS"
  | "CONTINUE_PREVIOUS"
  | "NONE";

type SpecialistInstruction = {
  expectedAction: string | null;
  pendingActionType: PendingActionType | null;
  count: number | null;
  target: string | null;
  avoid: string[];
  shouldContinuePendingAction: boolean;
};

type CulinaryOption = {
  title: string;
};

const DEFAULT_PROTOCOL_ID: ProtocolId = "DIAGNOSTICO_7_DIAS";
const DEFAULT_OPTION_COUNT = 3;
const MAX_OPTION_COUNT = 10;

const GENERIC_OPTIONS: Record<MealType, string[]> = {
  desayuno: [
    "Huevos con espinaca, champiñones y aguacate.",
    "Omelette con brócoli, pimiento y queso natural.",
    "Pollo deshebrado con nopal, jitomate y aceite de oliva.",
    "Yogur griego natural sin azúcar con chía y nueces.",
    "Bistec con calabacita, espinaca y aguacate.",
    "Huevos con nopales, cebolla y queso fresco.",
  ],
  comida: [
    "Pollo a la plancha con brócoli, calabacita y aguacate.",
    "Pescado con nopal asado, pepino y aceite de oliva.",
    "Bistec con champiñones, pimiento y aguacate.",
    "Ensalada de atún con lechuga, pepino, jitomate y aguacate.",
    "Camarones con calabacita, brócoli y aceite de oliva.",
    "Cerdo con coliflor, espinaca y aguacate.",
  ],
  cena: [
    "Pescado a la plancha con espinaca, champiñones y aguacate.",
    "Pollo con nopal, pimiento y aceite de oliva.",
    "Huevos con calabacita, espinaca y queso natural.",
    "Ensalada de sardina con lechuga, pepino y jitomate.",
    "Camarones con brócoli, champiñones y aceite de oliva.",
    "Tofu salteado con coliflor, pimiento y aguacate.",
  ],
  snack: [
    "Queso natural con pepino y aguacate.",
    "Yogur griego natural sin azúcar con chía.",
    "Huevo cocido con pepino y aceite de oliva.",
    "Atún con pepino y aguacate en porción pequeña.",
    "Nueces con queso natural.",
    "Apio con aguacate y semillas.",
  ],
};

const TARGET_RECIPES: Array<{
  match: string[];
  recipes: string[];
}> = [
  {
    match: ["pulpo"],
    recipes: [
      "Pulpo a la plancha con nopal asado, pimiento y aguacate.",
      "Ensalada fresca de pulpo con pepino, jitomate, lechuga y aceite de oliva.",
      "Pulpo salteado con calabacita, champiñones y ajo.",
      "Pulpo al ajillo con espárragos, brócoli y aceite de oliva.",
      "Pulpo con coliflor rostizada, espinaca y aguacate.",
      "Tacos de lechuga con pulpo, nopal, jitomate y aguacate.",
      "Pulpo al limón con apio, pepino y aceite de aguacate.",
      "Pulpo asado con ensalada de repollo, pimiento y aceitunas.",
    ],
  },
  {
    match: ["pan de harina de almendra", "harina de almendra"],
    recipes: [
      "Pan de harina de almendra con huevo, psyllium, polvo para hornear sin azúcar y aceite de oliva.",
      "Panecillos de harina de almendra con huevo, queso natural y semillas.",
      "Pan de almendra y linaza con huevo, agua y aceite de aguacate.",
      "Pan de harina de almendra con chía, huevo y yogur natural sin azúcar.",
      "Pan salado de almendra con huevo, queso y hierbas.",
      "Pan de almendra al sartén con huevo, psyllium y aceite de oliva.",
    ],
  },
  {
    match: ["huevo", "huevos"],
    recipes: [
      "Huevos con espinaca, champiñones y aguacate.",
      "Omelette con brócoli, pimiento y queso natural.",
      "Huevos revueltos con nopal, jitomate y aceite de oliva.",
      "Huevos al horno con espinaca, queso y aguacate.",
      "Ensalada de huevo con pepino, apio y aguacate.",
    ],
  },
  {
    match: ["pollo"],
    recipes: [
      "Pollo a la plancha con calabacita, champiñones y aguacate.",
      "Ensalada de pollo con lechuga, pepino, jitomate y aceite de oliva.",
      "Pollo salteado con brócoli, pimiento y ajo.",
      "Pollo con nopal, cebolla y salsa de tomate verde.",
      "Pollo al limón con espárragos y aguacate.",
    ],
  },
  {
    match: ["atun", "atún"],
    recipes: [
      "Ensalada de atún con pepino, jitomate, lechuga y aguacate.",
      "Atún con nopal asado, pimiento y aceite de oliva.",
      "Atún con calabacita, espinaca y champiñones.",
      "Tacos de lechuga con atún, pepino y aguacate.",
      "Atún con apio, aceitunas y aceite de oliva.",
    ],
  },
  {
    match: ["sardina", "sardinas"],
    recipes: [
      "Ensalada de sardina con pepino, jitomate, lechuga y aguacate.",
      "Sardina guisada con nopal, pimiento y tomate verde.",
      "Sardinas con calabacita, espinaca y aceite de oliva.",
      "Sardinas con coliflor rostizada y aguacate.",
      "Sardina con apio, pepino y aceitunas.",
    ],
  },
  {
    match: ["pescado", "tilapia", "mojarra", "salmon", "salmón"],
    recipes: [
      "Pescado a la plancha con calabacita, espinaca y aguacate.",
      "Pescado con nopal asado, pepino y aceite de oliva.",
      "Pescado salteado con brócoli, champiñones y ajo.",
      "Pescado al limón con espárragos y coliflor.",
      "Ensalada de pescado con lechuga, pepino y aguacate.",
    ],
  },
  {
    match: ["camaron", "camarón", "camarones"],
    recipes: [
      "Camarones salteados con calabacita, pimiento y ajo.",
      "Ensalada de camarón con pepino, lechuga, jitomate y aguacate.",
      "Camarones con nopal asado, espinaca y aceite de oliva.",
      "Camarones al ajillo con brócoli y coliflor.",
      "Tacos de lechuga con camarón, pepino y aguacate.",
    ],
  },
  {
    match: ["res", "bistec", "carne"],
    recipes: [
      "Bistec a la plancha con nopal, pimiento y aguacate.",
      "Bistec con brócoli, champiñones y aceite de oliva.",
      "Ensalada tibia de bistec con lechuga, pepino y jitomate.",
      "Carne con calabacita, cebolla y pimiento.",
      "Bistec con coliflor rostizada y aguacate.",
    ],
  },
];

export function generateMealRecommendation(
  request: MealRequest
): MealRecommendationResult {
  const rawMessage = request.userMessage ?? "";
  const currentUserMessage = extractCurrentUserMessage(rawMessage);
  const instruction = parseSpecialistInstruction(rawMessage);
  const protocolDecision = request.protocolDecision;

  const protocolId =
    protocolDecision?.protocolId ??
    request.protocolId ??
    DEFAULT_PROTOCOL_ID;

  const shouldBuildOptions = shouldBuildCompatibleOptions(
    currentUserMessage,
    instruction
  );

  const requestedCount =
    instruction.count ??
    extractRequestedCount(currentUserMessage) ??
    (shouldBuildOptions ? DEFAULT_OPTION_COUNT : 1);

  const avoidFoods = normalizeFoodList([
    ...instruction.avoid,
    ...extractAvoidedFoods(currentUserMessage),
  ]);

  const foodDecision = buildMealFoodDecision(protocolDecision);
  const foods = foodDecision ? [foodDecision] : [];

  const status = foodDecision?.status ?? "UNKNOWN";
  const canBuildRecipes =
    shouldBuildOptions &&
    (
      status === "ALLOWED" ||
      status === "ALLOWED_WITH_CONDITION" ||
      status === "ALLOWED_WITH_VALIDATION"
    );

  const target = resolveCulinaryTarget({
    protocolDecision,
    currentUserMessage,
    instruction,
  });

  const options = canBuildRecipes
    ? buildCulinaryOptions({
        mealType: request.mealType,
        target,
        requestedCount,
        avoidFoods,
      })
    : [];

  const decision = buildStructuredMealDecision({
    protocolId,
    foods,
    shouldBuildRecipes: canBuildRecipes,
    currentUserMessage,
  });

  return {
    success: true,
    recommendation: buildSpecialistGuidance({
      mealType: request.mealType,
      requestedCount,
      currentUserMessage,
      instruction,
      protocolDecision,
      foodDecision,
      options,
      avoidFoods,
      target,
    }),
    decision,
  };
}

function buildMealFoodDecision(
  decision?: ProtocolFoodDecision
): MealFoodDecision | null {
  if (!decision) return null;

  return {
    food: lowerFirst(decision.requestedFood),
    canonicalFood:
      decision.canonicalFood ?? decision.requestedFood,
    category: resolveFoodCategory(decision),
    status: mapProtocolStatus(decision.status),
    reason: decision.reason,
    source: "protocol_engine",
  };
}

function mapProtocolStatus(
  status: ProtocolFoodDecision["status"]
): MealDecisionStatus {
  switch (status) {
    case "ALLOWED":
      return "ALLOWED";
    case "ALLOWED_WITH_CONDITION":
      return "ALLOWED_WITH_CONDITION";
    case "ALLOWED_WITH_VALIDATION":
      return "ALLOWED_WITH_VALIDATION";
    case "RESTRICTED":
      return "NOT_ALLOWED";
    case "UNKNOWN":
      return "UNKNOWN";
  }
}

function resolveFoodCategory(
  decision: ProtocolFoodDecision
): FoodCategory {
  switch (decision.status) {
    case "RESTRICTED":
      return "carbohidrato de alta carga glucémica";
    case "ALLOWED_WITH_VALIDATION":
      return "carbohidrato saludable con validación";
    case "ALLOWED_WITH_CONDITION":
      return "preparación compatible condicionada";
    case "UNKNOWN":
      return "desconocido";
    case "ALLOWED":
      return inferCulinaryCategory(
        decision.canonicalFood ?? decision.requestedFood
      );
  }
}

function inferCulinaryCategory(value: string): FoodCategory {
  const normalized = normalizeText(value);

  if (
    /\b(pollo|res|carne|bistec|cerdo|pavo|pescado|atun|sardina|salmon|tilapia|mojarra|camaron|pulpo|mariscos|huevo|tofu|tempeh|queso|yogur|kefir)\b/.test(
      normalized
    )
  ) {
    return "proteína";
  }

  if (
    /\b(aguacate|aceite|nuez|almendra|pistache|cacahuate|chia|linaza|semilla|aceituna)\b/.test(
      normalized
    )
  ) {
    return "grasa saludable";
  }

  if (
    /\b(lechuga|espinaca|acelga|arugula|brocoli|coliflor|pepino|calabacita|champiñon|seta|jitomate|tomate|apio|esparrago|nopal|pimiento|chile|cebolla|ajo|rabano)\b/.test(
      normalized
    )
  ) {
    return "vegetal bajo en carga glucémica";
  }

  if (/\b(frijol|garbanzo|lenteja|haba|soya|alubia)\b/.test(normalized)) {
    return "leguminosa";
  }

  if (
    /\b(fresa|arandano|frambuesa|zarzamora|mora|manzana|toronja)\b/.test(
      normalized
    )
  ) {
    return "fruta";
  }

  if (/\b(agua|cafe|te|infusion)\b/.test(normalized)) {
    return "bebida";
  }

  return "preparación";
}

function buildStructuredMealDecision(params: {
  protocolId: ProtocolId;
  foods: MealFoodDecision[];
  shouldBuildRecipes: boolean;
  currentUserMessage?: string;
}): MealSpecialistDecision {
  const {
    protocolId,
    foods,
    shouldBuildRecipes,
    currentUserMessage,
  } = params;

  const hasAllowedFoods = foods.some(
    item => item.status === "ALLOWED"
  );

  const hasConditionalFoods = foods.some(
    item =>
      item.status === "ALLOWED_WITH_CONDITION" ||
      item.status === "ALLOWED_WITH_VALIDATION"
  );

  const hasNotAllowedFoods = foods.some(
    item => item.status === "NOT_ALLOWED"
  );

  const hasUnknownFoods =
    foods.length === 0 ||
    foods.some(item => item.status === "UNKNOWN");

  return {
    protocolId,
    foods,
    conditionalFoods: foods
      .filter(
        item =>
          item.status === "ALLOWED_WITH_CONDITION" ||
          item.status === "ALLOWED_WITH_VALIDATION"
      )
      .map(item => item.canonicalFood),
    requestedConditionalFoodList:
      isConditionalFoodListRequest(currentUserMessage),
    shouldMeasureGlucose: foods.some(
      item => item.status === "ALLOWED_WITH_VALIDATION"
    ),
    shouldBuildRecipes,
    shouldExplainValidation: foods.some(
      item => item.status === "ALLOWED_WITH_VALIDATION"
    ),
    hasAllowedFoods,
    hasConditionalFoods,
    hasNotAllowedFoods,
    hasUnknownFoods,
  };
}

function buildSpecialistGuidance(params: {
  mealType: MealType;
  requestedCount: number;
  currentUserMessage?: string;
  instruction: SpecialistInstruction;
  protocolDecision?: ProtocolFoodDecision;
  foodDecision: MealFoodDecision | null;
  options: CulinaryOption[];
  avoidFoods: string[];
  target: string | null;
}) {
  const {
    mealType,
    requestedCount,
    instruction,
    protocolDecision,
    foodDecision,
    options,
    avoidFoods,
    target,
  } = params;

  const lines: string[] = [
    "INSTRUCCIÓN DEL ESPECIALISTA CULINARIO:",
    `- Tipo de comida: ${mealType}.`,
    `- Cantidad solicitada: ${requestedCount}.`,
    "- El especialista no decide permisos ni restricciones.",
    "- La única autoridad alimentaria es la decisión estructurada del ProtocolModule.",
  ];

  if (instruction.expectedAction) {
    lines.push(
      `- Acción esperada por Cerebro: ${instruction.expectedAction}.`
    );
  }

  if (instruction.pendingActionType) {
    lines.push(
      `- Acción pendiente: ${instruction.pendingActionType}.`
    );
  }

  if (target) {
    lines.push(`- Objetivo culinario: ${target}.`);
  }

  if (avoidFoods.length > 0) {
    lines.push(
      `- Evitar en las opciones: ${formatList(avoidFoods)}.`
    );
  }

  lines.push("", "DECISIÓN OBLIGATORIA DEL PROTOCOLO:");

  if (!protocolDecision || !foodDecision) {
    lines.push("- Estado: UNKNOWN.");
    lines.push(
      "- No confirmar permiso ni restricción por criterio propio."
    );
    lines.push(
      "- Si se trata de una preparación, pedir los ingredientes mínimos necesarios."
    );
  } else {
    lines.push(`- Estado: ${protocolDecision.status}.`);
    lines.push(
      `- Alimento consultado: ${protocolDecision.requestedFood}.`
    );
    lines.push(
      `- Alimento canónico: ${
        protocolDecision.canonicalFood ?? "no identificado"
      }.`
    );
    lines.push(`- Motivo: ${protocolDecision.reason}.`);
    lines.push(
      `- Medición de glucosa: ${
        protocolDecision.shouldMeasureGlucose
          ? "requerida"
          : "no requerida por esta decisión"
      }.`
    );

    switch (protocolDecision.status) {
      case "RESTRICTED":
        lines.push(
          "- No generar recetas que utilicen el alimento restringido."
        );
        lines.push(
          "- Puede ofrecer alternativas solamente cuando la acción solicitada sea BUILD_ALTERNATIVES."
        );
        break;

      case "ALLOWED":
        lines.push(
          "- El alimento está permitido. No volver a cuestionarlo ni reclasificarlo."
        );
        break;

      case "ALLOWED_WITH_CONDITION":
        lines.push(
          "- El alimento está permitido con condición. Construir opciones y conservar la condición indicada."
        );
        break;

      case "ALLOWED_WITH_VALIDATION":
        lines.push(
          "- El alimento puede utilizarse con validación. Construir opciones y recordar la medición indicada."
        );
        break;

      case "UNKNOWN":
        lines.push(
          "- No asumir que está permitido ni que está restringido."
        );
        lines.push(
          "- Solicitar ingredientes cuando sea una preparación compuesta."
        );
        break;
    }
  }

  if (options.length > 0) {
    lines.push("", "OPCIONES CULINARIAS A ENTREGAR:");
    lines.push(
      `- Entregar exactamente ${options.length} opción(es).`
    );

    options.forEach((option, index) => {
      lines.push(`${index + 1}. ${option.title}`);
    });
  }

  lines.push("", "LÍMITES DE REDACCIÓN:");
  lines.push(
    "- No mencionar Cerebro, módulos, estados internos, WorkPlan ni instrucciones técnicas."
  );
  lines.push(
    "- No cambiar ALLOWED a restringido ni RESTRICTED a permitido."
  );
  lines.push(
    "- No afirmar que un alimento eleva la glucosa salvo que el motivo del protocolo lo diga."
  );
  lines.push(
    "- Cuando haya opciones culinarias, entregarlas directamente sin volver a pedir permiso."
  );
  lines.push(
    "- Mantener la respuesta práctica, clara y coherente con la fase."
  );

  return lines.join("\n");
}

function resolveCulinaryTarget(params: {
  protocolDecision?: ProtocolFoodDecision;
  currentUserMessage?: string;
  instruction: SpecialistInstruction;
}) {
  const {
    protocolDecision,
    currentUserMessage,
    instruction,
  } = params;

  if (protocolDecision?.canonicalFood) {
    return protocolDecision.canonicalFood;
  }

  if (instruction.target) {
    return instruction.target;
  }

  return extractRecipeTarget(currentUserMessage);
}

function buildCulinaryOptions(params: {
  mealType: MealType;
  target: string | null;
  requestedCount: number;
  avoidFoods: string[];
}): CulinaryOption[] {
  const {
    mealType,
    target,
    requestedCount,
    avoidFoods,
  } = params;

  const source = target
    ? getRecipesForTarget(target)
    : GENERIC_OPTIONS[mealType];

  const options: CulinaryOption[] = [];
  let index = 0;
  let attempts = 0;
  const maxAttempts = Math.max(source.length * 3, requestedCount * 3);

  while (
    options.length < requestedCount &&
    attempts < maxAttempts
  ) {
    const title = source[index % source.length];
    index += 1;
    attempts += 1;

    if (containsAnyFood(title, avoidFoods)) {
      continue;
    }

    if (
      options.some(
        option => normalizeText(option.title) === normalizeText(title)
      )
    ) {
      continue;
    }

    options.push({ title });
  }

  if (options.length < requestedCount && target) {
    while (options.length < requestedCount) {
      const number = options.length + 1;
      options.push({
        title: `${capitalize(target)} en preparación compatible ${number}, acompañada con vegetales y grasa saludable permitidos por el protocolo.`,
      });
    }
  }

  return options.slice(0, requestedCount);
}

function getRecipesForTarget(target: string) {
  const normalizedTarget = normalizeText(target);

  const matched = TARGET_RECIPES.find(entry =>
    entry.match.some(match =>
      normalizedTarget.includes(normalizeText(match))
    )
  );

  if (matched) {
    return matched.recipes;
  }

  return [
    `${capitalize(target)} a la plancha con vegetales compatibles y aguacate.`,
    `${capitalize(target)} con nopal, pimiento y aceite de oliva.`,
    `Ensalada de ${lowerFirst(target)} con lechuga, pepino y jitomate.`,
    `${capitalize(target)} salteado con brócoli, champiñones y ajo.`,
    `${capitalize(target)} con coliflor, espinaca y aceite de aguacate.`,
  ];
}

function shouldBuildCompatibleOptions(
  currentUserMessage: string | undefined,
  instruction: SpecialistInstruction
) {
  if (isConditionalFoodListRequest(currentUserMessage)) {
    return false;
  }

  if (instruction.expectedAction === "BUILD_OPTIONS") {
    return true;
  }

  if (
    instruction.pendingActionType === "BUILD_ALTERNATIVES" ||
    instruction.pendingActionType === "BUILD_RECIPES" ||
    instruction.pendingActionType === "CONTINUE_PREVIOUS"
  ) {
    return true;
  }

  return isRecipeRequest(currentUserMessage);
}

function parseSpecialistInstruction(
  userMessage: string
): SpecialistInstruction {
  return {
    expectedAction: extractLineValue(
      userMessage,
      "Acción esperada"
    ),
    pendingActionType: parsePendingActionType(
      extractLineValue(userMessage, "Tipo")
    ),
    count: extractCountFromInstruction(userMessage),
    target: extractLineValue(
      userMessage,
      "Objetivo/target"
    ),
    avoid: extractAvoidFromInstruction(userMessage),
    shouldContinuePendingAction:
      /El usuario está continuando una acción pendiente:\s*sí/i.test(
        userMessage
      ),
  };
}

function parsePendingActionType(
  value: string | null
): PendingActionType | null {
  if (!value) return null;

  const normalized = value.trim().toUpperCase();

  if (
    normalized === "BUILD_RECIPES" ||
    normalized === "BUILD_ALTERNATIVES" ||
    normalized === "EXPLAIN_DECISION" ||
    normalized === "ASK_INGREDIENTS" ||
    normalized === "CONTINUE_PREVIOUS" ||
    normalized === "NONE"
  ) {
    return normalized;
  }

  return null;
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

function extractLineValue(
  text: string,
  label: string
) {
  const pattern = new RegExp(
    `- ${escapeRegExp(label)}:\\s*(.+?)\\.?(?:\\n|$)`,
    "i"
  );

  const match = text.match(pattern);
  const value = match?.[1]?.trim();

  if (
    !value ||
    /^sin |ning[uú]n|ninguno/i.test(value)
  ) {
    return null;
  }

  return value.replace(/\.$/, "");
}

function extractCountFromInstruction(text: string) {
  const match = text.match(
    /- Cantidad solicitada:\s*(\d+)/i
  );

  return match?.[1]
    ? clampCount(Number(match[1]))
    : null;
}

function extractAvoidFromInstruction(text: string) {
  const value = extractLineValue(text, "Evitar");

  return value
    ? value
        .split(",")
        .map(item => item.trim())
        .filter(Boolean)
    : [];
}

function extractAvoidedFoods(
  text: string | undefined
) {
  if (!text) return [];

  const match = normalizeText(text).match(
    /\bsin\s+([a-záéíóúñ\s,]+)/i
  );

  if (!match?.[1]) return [];

  return match[1]
    .split(/\b(?:y|o|u)\b|,/)
    .map(item => item.trim())
    .filter(Boolean);
}

function extractRequestedCount(
  userMessage: string | undefined
) {
  if (!userMessage) return null;

  const normalized = normalizeText(userMessage);

  const numberMatch = normalized.match(
    /\b(\d+)\s+(receta|recetas|idea|ideas|opcion|opciones|platillo|platillos)\b/
  );

  if (numberMatch?.[1]) {
    return clampCount(Number(numberMatch[1]));
  }

  const wordCounts: Record<string, number> = {
    una: 1,
    un: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
  };

  const wordMatch = normalized.match(
    /\b(una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(receta|recetas|idea|ideas|opcion|opciones|platillo|platillos)\b/
  );

  return wordMatch?.[1]
    ? clampCount(wordCounts[wordMatch[1]] ?? 1)
    : null;
}

function extractRecipeTarget(
  userMessage: string | undefined
) {
  if (!userMessage) return null;

  const normalized = normalizeText(userMessage);

  const patterns = [
    /(?:recetas?|ideas?|opciones?|platillos?)\s+(?:con|de|para)\s+(.+)$/,
    /(?:preparar|hacer|cocinar)\s+(.+)$/,
    /(?:puedo\s+comer|quiero\s+comer)\s+(.+)$/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);

    if (match?.[1]) {
      return cleanupTarget(match[1]);
    }
  }

  return null;
}

function cleanupTarget(value: string) {
  return value
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(
      /\b(una?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|receta|recetas|idea|ideas|opcion|opciones|platillo|platillos|por favor)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function isRecipeRequest(
  userMessage: string | undefined
) {
  if (!userMessage) return false;

  return /\b(receta|recetas|idea|ideas|opcion|opciones|platillo|platillos|preparar|hacer|cocinar|dame|sugiere|recomienda)\b/.test(
    normalizeText(userMessage)
  );
}

function isConditionalFoodListRequest(
  userMessage: string | undefined
) {
  if (!userMessage) return false;

  return /\b(alimentos?|lista|cu[aá]les|dame|mu[eé]strame)\b[\s\S]*\b(permitidos?|validaci[oó]n|validar)\b/i.test(
    userMessage
  );
}

function normalizeFoodList(items: string[]) {
  const seen = new Set<string>();

  return items
    .map(item => item.trim())
    .filter(Boolean)
    .filter(item => {
      const key = normalizeText(item);

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
}

function containsAnyFood(
  value: string,
  foods: string[]
) {
  const normalizedValue = normalizeText(value);

  return foods.some(food => {
    const normalizedFood = normalizeText(food);

    return (
      normalizedFood.length > 0 &&
      normalizedValue.includes(normalizedFood)
    );
  });
}

function clampCount(value: number) {
  if (!Number.isFinite(value)) return 1;

  return Math.min(
    Math.max(Math.trunc(value), 1),
    MAX_OPTION_COUNT
  );
}

function formatList(items: string[]) {
  const cleanItems = items.filter(Boolean);

  if (cleanItems.length === 0) return "";
  if (cleanItems.length === 1) {
    return lowerFirst(cleanItems[0]);
  }
  if (cleanItems.length === 2) {
    return `${lowerFirst(cleanItems[0])} y ${lowerFirst(
      cleanItems[1]
    )}`;
  }

  return `${cleanItems
    .slice(0, -1)
    .map(lowerFirst)
    .join(", ")} y ${lowerFirst(
    cleanItems[cleanItems.length - 1]
  )}`;
}

function lowerFirst(value: string) {
  if (!value) return value;

  return value.charAt(0).toLowerCase() + value.slice(1);
}

function capitalize(value: string) {
  if (!value) return value;

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeRegExp(value: string) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}