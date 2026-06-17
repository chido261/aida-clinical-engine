// app/lib/aida/mealPlanGenerator.ts

import {
  getAllowedFoodsForProtocol,
  getExcludedFoodsForProtocol,
  findFoodInCatalog,
  type FoodItem,
  type MealType,
} from "@/app/lib/aida/protocolFoodCatalog";
import { interpretNutritionRequest } from "@/app/lib/aida/nutritionRequestInterpreter";
import { validateMealOptions } from "@/app/lib/aida/nutritionValidator";

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

type GeneratedMealOption = {
  titleSeed: string;
  mealType: MealType;
  requiredIngredients: string[];
  optionalAllowedIngredients: string[];
  cookingStyle: string;
  gptTask: string;
};

function byCategory(foods: FoodItem[], category: FoodItem["category"]) {
  return foods.filter((food) => food.category === category);
}

function rotate<T>(items: T[], offset: number) {
  if (!items.length) return [];
  const n = offset % items.length;
  return [...items.slice(n), ...items.slice(0, n)];
}

function removeAvoidedFoods(foods: FoodItem[], avoidedFoods: string[]) {
  const avoided = avoidedFoods.map((food) => food.toLowerCase());

  return foods.filter((food) => !avoided.includes(food.name.toLowerCase()));
}

function getFoodByName(name: string, activeProtocol: string) {
  return findFoodInCatalog(name, activeProtocol);
}

function getSafeRequiredFoods(params: {
  requestedFoods: string[];
  excludedRequestedFoods: string[];
  userAvoidedFoods: string[];
  activeProtocol: string;
}) {
  const excluded = params.excludedRequestedFoods.map((food) => food.toLowerCase());
  const avoided = params.userAvoidedFoods.map((food) => food.toLowerCase());

  return params.requestedFoods
    .filter((food) => !excluded.includes(food.toLowerCase()))
    .filter((food) => !avoided.includes(food.toLowerCase()))
    .map((food) => getFoodByName(food, params.activeProtocol))
    .filter(Boolean) as FoodItem[];
}

function selectBaseFoods(params: {
  mealType: MealType;
  allowedFoods: FoodItem[];
  requiredFood?: FoodItem | null;
  offset: number;
}) {
  const { allowedFoods, requiredFood, offset } = params;

  const proteins = rotate(byCategory(allowedFoods, "PROTEIN"), offset);
  const fats = rotate(byCategory(allowedFoods, "HEALTHY_FAT"), offset + 2);
  const vegetables = rotate(byCategory(allowedFoods, "VEGETABLE"), offset + 4);
  const seasonings = rotate(byCategory(allowedFoods, "SEASONING"), offset + 1);

  const protein =
    requiredFood?.category === "PROTEIN"
      ? requiredFood
      : proteins.find((food) => food.name !== requiredFood?.name) ?? proteins[0];

  const fat =
    requiredFood?.category === "HEALTHY_FAT"
      ? requiredFood
      : fats.find((food) => food.name !== requiredFood?.name) ?? fats[0];

  const vegetable1 =
    requiredFood?.category === "VEGETABLE"
      ? requiredFood
      : vegetables.find((food) => food.name !== requiredFood?.name) ?? vegetables[0];

  const vegetable2 = vegetables.find((food) => food.name !== vegetable1?.name) ?? vegetables[1];
  const seasoning = seasonings[0];

  return {
    protein,
    fat,
    vegetable1,
    vegetable2,
    seasoning,
  };
}

function buildCookingStyle(mealType: MealType, protein?: FoodItem) {
  if (mealType === "DESAYUNO") {
    if (protein?.name.includes("queso")) return "asado o dorado en sartén";
    if (protein?.name === "sardina" || protein?.name === "atún") return "tipo mexicana, en frío o salteado ligero";
    return "salteado ligero, asado o en sartén";
  }

  if (mealType === "CENA") {
    return "ligero, a la plancha, al vapor o salteado suave";
  }

  if (mealType === "COLACION") {
    return "porción pequeña, sin preparación pesada";
  }

  return "a la plancha, al horno, guisado simple o salteado";
}

function buildOption(params: {
  mealType: MealType;
  allowedFoods: FoodItem[];
  requiredFood?: FoodItem | null;
  offset: number;
}) {
  const { mealType, allowedFoods, requiredFood, offset } = params;

  const { protein, fat, vegetable1, vegetable2, seasoning } = selectBaseFoods({
    mealType,
    allowedFoods,
    requiredFood,
    offset,
  });

  const requiredIngredients = Array.from(
    new Set(
      [
        protein?.name,
        fat?.name,
        vegetable1?.name,
        vegetable2?.name,
        seasoning?.name,
      ].filter(Boolean) as string[]
    )
  );

  const titleSeed = [
    protein?.name,
    vegetable1?.name ? `con ${vegetable1.name}` : null,
    fat?.name ? `y ${fat.name}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const cookingStyle = buildCookingStyle(mealType, protein);

  return {
    titleSeed: titleSeed || "platillo compatible",
    mealType,
    requiredIngredients,
    optionalAllowedIngredients: [],
    cookingStyle,
    gptTask:
      "Crea un nombre de platillo real y una preparación breve, coherente y práctica usando solo los ingredientes obligatorios.",
  } satisfies GeneratedMealOption;
}

function buildOptions(params: {
  text: string;
  activeProtocol: string;
}) {
  const request = interpretNutritionRequest(params.text);

  const mealType: MealType =
    request.mealType === "DESAYUNO" ||
    request.mealType === "COMIDA" ||
    request.mealType === "CENA" ||
    request.mealType === "COLACION"
      ? request.mealType
      : "COMIDA";

  const count = request.count ?? 3;

  const baseAllowedFoods = getAllowedFoodsForProtocol({
    protocol: params.activeProtocol,
    mealType,
  });

  const allowedFoods = removeAvoidedFoods(baseAllowedFoods, request.userAvoidedFoods);

  const safeRequiredFoods = getSafeRequiredFoods({
    requestedFoods: request.mappedFoods,
    excludedRequestedFoods: request.excludedRequestedFoods,
    userAvoidedFoods: request.userAvoidedFoods,
    activeProtocol: params.activeProtocol,
  });

  const options: GeneratedMealOption[] = [];

  for (let index = 0; index < count; index++) {
    const requiredFood =
      safeRequiredFoods[index] ??
      safeRequiredFoods[index % safeRequiredFoods.length] ??
      null;

    options.push(
      buildOption({
        mealType,
        allowedFoods,
        requiredFood,
        offset: params.text.length + index,
      })
    );
  }

  return {
    request,
    mealType,
    count,
    options,
  };
}

function buildWeeklyMenu(params: {
  text: string;
  activeProtocol: string;
}) {
  const request = interpretNutritionRequest(params.text);
  const mealTypes: MealType[] = ["DESAYUNO", "COMIDA", "CENA", "COLACION"];

  return DAYS.map((day, dayIndex) => {
    const meals = mealTypes.map((mealType, mealIndex) => {
      const baseAllowedFoods = getAllowedFoodsForProtocol({
        protocol: params.activeProtocol,
        mealType,
      });

      const allowedFoods = removeAvoidedFoods(baseAllowedFoods, request.userAvoidedFoods);

      return buildOption({
        mealType,
        allowedFoods,
        offset: params.text.length + dayIndex + mealIndex,
      });
    });

    return { day, meals };
  });
}

function buildBeverageDirective(params: {
  text: string;
  activeProtocol: string;
}) {
  const request = interpretNutritionRequest(params.text);

  if (request.requestType !== "BEVERAGE_CHECK") return null;

  const beverage = request.beverage ?? "bebida no identificada";
  const sugarLine =
    request.sugarAdded === false
      ? "El usuario indicó que es sin azúcar."
      : request.sugarAdded === true
        ? "El usuario indicó o sugirió que contiene azúcar."
        : "No está claro si contiene azúcar.";

  return `
El usuario preguntó por una bebida.

Bebida detectada: ${beverage}
${sugarLine}
Protocolo activo: ${params.activeProtocol}

Instrucciones:
- Si es sin azúcar, puede acompañar la comida.
- Si contiene azúcar, no la recomiendes.
- Si no está claro si tiene azúcar, pide confirmar solo eso.
- Responde breve y directo.
`.trim();
}

function optionToValidationShape(option: GeneratedMealOption) {
  return {
    title: option.titleSeed,
    mealType: option.mealType,
    ingredients: option.requiredIngredients,
    preparation: option.cookingStyle,
  };
}

export function buildGeneratedMealOptionsDirective(params: {
  text: string;
  activeProtocol: string;
}) {
  const { text, activeProtocol } = params;
  const request = interpretNutritionRequest(text);

  if (!request.handled) return null;

  const beverageDirective = buildBeverageDirective(params);
  if (beverageDirective) return beverageDirective;

  const excludedFoods = getExcludedFoodsForProtocol(activeProtocol);

  if (request.requestType === "WEEKLY_MENU") {
    const weeklyMenu = buildWeeklyMenu(params);

    return `
El usuario pidió un menú semanal.

Usa SOLO este menú generado por el gestor interno.
No inventes alimentos fuera de estas opciones.
No agregues alimentos excluidos del protocolo.

Protocolo activo: ${activeProtocol}

Alimentos que el usuario pidió evitar:
${request.userAvoidedFoods.length ? request.userAvoidedFoods.map((food) => `- ${food}`).join("\n") : "- ninguno"}

Alimentos excluidos:
${excludedFoods.map((food) => `- ${food}`).join("\n")}

Menú generado:
${weeklyMenu
  .map(
    (day) =>
      `${day.day}
${day.meals
  .map(
    (meal) =>
      `- ${meal.mealType}
  Base sugerida: ${meal.titleSeed}
  Ingredientes obligatorios: ${meal.requiredIngredients.join(", ")}
  Estilo de preparación: ${meal.cookingStyle}`
  )
  .join("\n")}`
  )
  .join("\n\n")}

Instrucciones:
- Organiza por día.
- Incluye desayuno, comida, cena y colación.
- Para cada comida crea un nombre real del platillo.
- Para cada comida redacta una preparación breve y coherente.
- Usa SOLO los ingredientes obligatorios de cada comida.
- No cambies ingredientes.
- No agregues pan, tortilla, arroz, avena, papa, camote, jugos ni fruta como desayuno.
- Respeta los alimentos que el usuario pidió evitar.
`.trim();
  }

  if (request.requestType !== "MEAL_OPTIONS") return null;

  const generated = buildOptions(params);

  const requiredForValidation = generated.request.mappedFoods.filter(
    (food) =>
      !generated.request.excludedRequestedFoods.includes(food) &&
      !generated.request.userAvoidedFoods.includes(food)
  );

  const validation = validateMealOptions({
    options: generated.options.map(optionToValidationShape),
    requestedCount: generated.count,
    requiredFoods: requiredForValidation,
    activeProtocol,
    mealType: generated.mealType,
  });

  const excludedRequestedLine = generated.request.excludedRequestedFoods.length
    ? `El usuario pidió estos alimentos excluidos y NO deben incluirse: ${generated.request.excludedRequestedFoods.join(", ")}. Explica breve que por ahora se reemplazan.`
    : "El usuario no pidió alimentos excluidos.";

  const avoidedFoodsLine = generated.request.userAvoidedFoods.length
    ? `El usuario pidió evitar estos alimentos y NO deben aparecer: ${generated.request.userAvoidedFoods.join(", ")}.`
    : "El usuario no pidió evitar alimentos específicos.";

  return `
El usuario pidió opciones de comida.

El gestor interno ya decidió:
- tipo de comida
- cantidad exacta
- protocolo
- alimentos permitidos
- alimentos excluidos
- ingredientes obligatorios por opción

Tu tarea NO es decidir ingredientes.
Tu tarea es redactar nombres de platillos reales y preparaciones coherentes usando SOLO los ingredientes obligatorios.

Protocolo activo: ${activeProtocol}
Tipo de comida: ${generated.mealType}
Cantidad solicitada: ${generated.count}

${excludedRequestedLine}
${avoidedFoodsLine}

Alimentos excluidos:
${excludedFoods.map((food) => `- ${food}`).join("\n")}

Validación interna:
- Válido: ${validation.valid ? "sí" : "no"}
- Errores: ${validation.errors.length ? validation.errors.join(" | ") : "ninguno"}

Opciones generadas por el motor:
${generated.options
  .map(
    (option, index) =>
      `${index + 1}.
Base sugerida: ${option.titleSeed}
Ingredientes obligatorios: ${option.requiredIngredients.join(", ")}
Estilo de preparación: ${option.cookingStyle}
Tarea GPT: ${option.gptTask}`
  )
  .join("\n\n")}

Instrucciones obligatorias:
- Responde con exactamente ${generated.count} opciones.
- Cada opción debe tener nombre de platillo real.
- Cada opción debe tener preparación breve y lógica.
- Usa SOLO los ingredientes obligatorios de esa opción.
- No agregues ingredientes nuevos.
- No cambies ingredientes.
- No agregues alimentos excluidos.
- No preguntes si quiere más opciones.
- Si hubo alimento excluido solicitado, menciona el ajuste en una sola frase.
- Si el usuario pidió evitar un alimento, respétalo sin justificar de más.
`.trim();
}