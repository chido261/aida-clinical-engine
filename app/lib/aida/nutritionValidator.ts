// app/lib/aida/nutritionValidator.ts

import { getExcludedFoodsForProtocol } from "@/app/lib/aida/protocolFoodCatalog";

export type NutritionGeneratedOption = {
  title: string;
  mealType: string;
  ingredients: string[];
  preparation: string;
};

export type NutritionValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export function validateMealOptions(params: {
  options: NutritionGeneratedOption[];
  requestedCount: number;
  requiredFoods?: string[];
  activeProtocol: string;
  mealType?: string;
}) {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { options, requestedCount, requiredFoods = [], activeProtocol, mealType } = params;

  if (options.length !== requestedCount) {
    errors.push(`La cantidad generada no coincide. Solicitadas: ${requestedCount}. Generadas: ${options.length}.`);
  }

  const excludedFoods = getExcludedFoodsForProtocol(activeProtocol).map((food) =>
    food.toLowerCase()
  );

  const allText = options
    .flatMap((option) => [option.title, option.preparation, ...option.ingredients])
    .join(" ")
    .toLowerCase();

  for (const excluded of excludedFoods) {
    if (allText.includes(excluded)) {
      errors.push(`Se detectó alimento excluido del protocolo: ${excluded}.`);
    }
  }

  for (const food of requiredFoods) {
    const normalizedFood = food.toLowerCase();

    const found = options.some((option) =>
      [option.title, option.preparation, ...option.ingredients]
        .join(" ")
        .toLowerCase()
        .includes(normalizedFood)
    );

    if (!found) {
      errors.push(`No se incluyó el alimento solicitado o su equivalencia: ${food}.`);
    }
  }

  if (mealType) {
    const wrongMealType = options.some((option) => option.mealType !== mealType);

    if (wrongMealType) {
      errors.push(`Una o más opciones no respetan el tipo de comida solicitado: ${mealType}.`);
    }
  }

  if (mealType === "DESAYUNO") {
    const hasFruitAsBase = /fruta como base|yogurt con fruta|fresas|plátano|manzana|mango|papaya/i.test(
      allText
    );

    if (hasFruitAsBase) {
      errors.push("El desayuno no debe usar fruta como base en Protocolo 1.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  } satisfies NutritionValidationResult;
}

export function validateBeverage(params: {
  beverage: string | null;
  sugarAdded: boolean | null;
  activeProtocol: string;
}) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!params.beverage) {
    errors.push("No se detectó la bebida.");
  }

  if (params.sugarAdded === true) {
    errors.push("La bebida contiene azúcar o endulzante no permitido para este protocolo.");
  }

  if (params.sugarAdded === null) {
    warnings.push("No se confirmó si la bebida lleva azúcar.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  } satisfies NutritionValidationResult;
}