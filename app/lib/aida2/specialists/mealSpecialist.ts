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

export function generateMealRecommendation(
  request: MealRequest
) {

  const protocol = runProtocolModule();

  const foods = protocol.structured.allowedFoods;

  const requestedProtein = findRequestedProtein(
    request.userMessage,
    foods.proteins
  );

  const templates = MEAL_TEMPLATES.filter(
    t =>
      t.mealType === request.mealType &&
      (!requestedProtein || t.allowedProteins.includes(requestedProtein))
  );

  const fallbackTemplates = MEAL_TEMPLATES.filter(
    t => t.mealType === request.mealType
  );

  const template = randomItem(
    templates.length > 0 ? templates : fallbackTemplates
  );

  const protein = requestedProtein && template.allowedProteins.includes(requestedProtein)
    ? requestedProtein
    : randomCompatible(
        template.allowedProteins,
        foods.proteins
      );

  const vegetable1 = template.preferredVegetables.length > 0
    ? randomCompatible(
        template.preferredVegetables,
        foods.vegetables
      )
    : "";

  const vegetable2 = template.preferredVegetables.length > 1
    ? randomCompatible(
        template.preferredVegetables.filter(
          v => v !== vegetable1
        ),
        foods.vegetables,
        false
      )
    : "";

  const fat = randomCompatible(
    template.preferredFats,
    foods.healthyFats
  );

  return {

    success: true,

    recommendation: buildNaturalMeal({
      templateName: template.name,
      mealType: request.mealType,
      protein,
      vegetable1,
      vegetable2,
      fat,
    })

  };

}

function buildNaturalMeal(params: {
  templateName: string;
  mealType: MealType;
  protein: string;
  vegetable1: string;
  vegetable2: string;
  fat: string;
}) {

  const {
    templateName,
    mealType,
    protein,
    vegetable1,
    vegetable2,
    fat,
  } = params;

  const vegetables = formatPair(
    vegetable1,
    vegetable2
  );

  const proteinText = lowerFirst(protein);
  const vegetableText = lowerFirst(vegetables);
  const fatText = lowerFirst(fat);

  if (mealType === "snack") {
    return `${protein} con ${fatText}.`;
  }

  if (templateName === "Huevos con vegetales") {
    return `Omelette de ${proteinText} con ${vegetableText}, acompañado de ${fatText}.`;
  }

  if (templateName === "Carne asada") {
    return `${protein} asado con ${vegetableText}, acompañado de ${fatText}.`;
  }

  if (templateName === "Pollo a la plancha") {
    return `${protein} a la plancha con ${vegetableText}, acompañado de ${fatText}.`;
  }

  if (templateName === "Pescado con vegetales") {
    return `${protein} con ${vegetableText}, preparado con ${fatText}.`;
  }

  if (templateName === "Cena ligera") {
    return `Cena ligera de ${proteinText} con ${vegetableText}, acompañada de ${fatText}.`;
  }

  if (templateName === "Ensalada con proteína") {
    return `Ensalada de ${vegetableText} con ${proteinText} y ${fatText}.`;
  }

  return `${templateName} con ${proteinText}, ${vegetableText} y ${fatText}.`;

}

function findRequestedProtein(
  userMessage: string | undefined,
  allowedProteins: string[]
) {

  if (!userMessage) return null;

  const normalizedMessage = normalizeText(userMessage);

  return allowedProteins.find(
    protein => normalizedMessage.includes(
      normalizeText(protein)
    )
  ) ?? null;

}

function randomCompatible(
  preferred: string[],
  allowed: string[],
  fallbackToAllowed = true
) {

  const available = preferred.filter(
    item => allowed.includes(item)
  );

  if (available.length === 0) {
    return fallbackToAllowed ? randomItem(allowed) : "";
  }

  return randomItem(available);

}

function randomItem<T>(array: T[]): T {

  return array[
    Math.floor(Math.random() * array.length)
  ];

}

function formatPair(
  first: string,
  second: string
) {

  if (first && second) return `${first} y ${second}`;

  return first || second;

}

function lowerFirst(value: string) {

  if (!value) return value;

  return value.charAt(0).toLowerCase() + value.slice(1);

}

function normalizeText(value: string) {

  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

}
