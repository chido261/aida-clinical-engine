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

  const templates = MEAL_TEMPLATES.filter(
    t => t.mealType === request.mealType
  );

  const template = randomItem(templates);

  const protein = randomCompatible(
    template.allowedProteins,
    foods.proteins
  );

  const vegetable1 = randomCompatible(
    template.preferredVegetables,
    foods.vegetables
  );

  const vegetable2 = randomCompatible(
    template.preferredVegetables.filter(
      v => v !== vegetable1
    ),
    foods.vegetables
  );

  const fat = randomCompatible(
    template.preferredFats,
    foods.healthyFats
  );

  return {

    success: true,

    recommendation: buildMeal(
      template.name,
      protein,
      vegetable1,
      vegetable2,
      fat
    )

  };

}

function buildMeal(

  template: string,

  protein: string,

  vegetable1: string,

  vegetable2: string,

  fat: string

) {

  return `Te recomiendo:

**${template}**

• Proteína:
${protein}

• Vegetales:
${vegetable1}${vegetable2 ? ` y ${vegetable2}` : ""}

• Grasa saludable:
${fat}`;

}

function randomCompatible(

  preferred: string[],

  allowed: string[]

) {

  const available = preferred.filter(
    item => allowed.includes(item)
  );

  if (available.length === 0) {
    return randomItem(allowed);
  }

  return randomItem(available);

}

function randomItem<T>(array: T[]): T {

  return array[
    Math.floor(Math.random() * array.length)
  ];

}