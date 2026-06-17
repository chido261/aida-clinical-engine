// app/lib/aida/mealPlanGenerator.ts

import {
  getAllowedFoodsForProtocol,
  getExcludedFoodsForProtocol,
  type FoodItem,
} from "@/app/lib/aida/protocolFoodCatalog";

export type MealType = "DESAYUNO" | "COMIDA" | "CENA" | "COLACION";

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function wantsMealPlan(text: string) {
  return /(men[uú]|plan|semana|semanal|estructura|estruct[uú]rame)/i.test(text);
}

function wantsOptions(text: string) {
  return /(dame|quiero|sugiere|recomienda|opciones|ideas|platillos)/i.test(text);
}

function requestedCountFromText(text: string) {
  const match = text.match(/\b(\d{1,2})\b/);
  const value = match ? Number(match[1]) : 3;
  if (!Number.isFinite(value)) return 3;
  return Math.min(Math.max(value, 1), 14);
}

function detectMealType(text: string): MealType {
  if (/desayuno/i.test(text)) return "DESAYUNO";
  if (/cena/i.test(text)) return "CENA";
  if (/colaci[oó]n|snack/i.test(text)) return "COLACION";
  return "COMIDA";
}

function byCategory(foods: FoodItem[], category: FoodItem["category"]) {
  return foods.filter((f) => f.category === category);
}

function rotate<T>(items: T[], offset: number) {
  if (!items.length) return [];
  const n = offset % items.length;
  return [...items.slice(n), ...items.slice(0, n)];
}

function requiredFoodFromText(text: string, allowedFoods: FoodItem[]) {
  const lower = text.toLowerCase();
  return allowedFoods.find((food) => lower.includes(food.name.toLowerCase())) ?? null;
}

function buildOption(params: {
  mealType: MealType;
  allowedFoods: FoodItem[];
  requiredFood?: FoodItem | null;
  offset: number;
}) {
  const { mealType, allowedFoods, requiredFood, offset } = params;

  const proteins = rotate(byCategory(allowedFoods, "PROTEIN"), offset);
  const fats = rotate(byCategory(allowedFoods, "HEALTHY_FAT"), offset + 2);
  const vegetables = rotate(byCategory(allowedFoods, "VEGETABLE"), offset + 4);

  const protein = proteins[0];
  const fat = fats[0];
  const veg1 = vegetables[0];
  const veg2 = vegetables[1];

  const ingredients = Array.from(
    new Set(
      [
        requiredFood?.name,
        protein?.name,
        fat?.name,
        veg1?.name,
        veg2?.name,
      ].filter(Boolean) as string[]
    )
  );

  const main = requiredFood?.name || protein?.name || "plato";
  const title = `${main} con ${veg1?.name || fat?.name || "vegetales"}`;

  const preparation =
    mealType === "DESAYUNO"
      ? `Prepara ${protein?.name || main} y acompaña con ${veg1?.name || "vegetales"} y ${fat?.name || "aguacate"}.`
      : mealType === "CENA"
        ? `Hazlo ligero: cocina ${protein?.name || main}, agrega ${veg1?.name || "vegetales"} y usa ${fat?.name || "grasa saludable"} en poca cantidad.`
        : mealType === "COLACION"
          ? `Usa una porción pequeña y acompaña con vegetales simples si hace falta.`
          : `Cocina ${protein?.name || main} a la plancha, al horno o en sartén; acompaña con ${veg1?.name || "vegetales"} y ${fat?.name || "aguacate"}.`;

  return {
    title,
    mealType,
    ingredients,
    preparation,
  };
}

function buildOptions(params: {
  text: string;
  activeProtocol: string;
}) {
  const mealType = detectMealType(params.text);
  const count = requestedCountFromText(params.text);

  const allowedFoods = getAllowedFoodsForProtocol({
    protocol: params.activeProtocol,
    mealType,
  });

  const requiredFood = requiredFoodFromText(params.text, allowedFoods);

  return Array.from({ length: count }, (_, index) =>
    buildOption({
      mealType,
      allowedFoods,
      requiredFood,
      offset: params.text.length + index,
    })
  );
}

function buildWeeklyMenu(params: {
  text: string;
  activeProtocol: string;
}) {
  const mealTypes: MealType[] = ["DESAYUNO", "COMIDA", "CENA", "COLACION"];

  return DAYS.map((day, dayIndex) => {
    const meals = mealTypes.map((mealType, mealIndex) => {
      const allowedFoods = getAllowedFoodsForProtocol({
        protocol: params.activeProtocol,
        mealType,
      });

      return buildOption({
        mealType,
        allowedFoods,
        offset: params.text.length + dayIndex + mealIndex,
      });
    });

    return { day, meals };
  });
}

export function buildGeneratedMealOptionsDirective(params: {
  text: string;
  activeProtocol: string;
}) {
  const { text, activeProtocol } = params;

  if (!wantsOptions(text) && !wantsMealPlan(text)) return null;

  const excludedFoods = getExcludedFoodsForProtocol(activeProtocol);
  const isWeeklyMenu = wantsMealPlan(text);

  if (isWeeklyMenu) {
    const weeklyMenu = buildWeeklyMenu(params);

    return `
El usuario pidió un menú semanal.

Usa SOLO este menú generado por el gestor interno.
No inventes alimentos fuera de estas opciones.
No agregues alimentos excluidos del protocolo.

Protocolo activo: ${activeProtocol}

Alimentos excluidos:
${excludedFoods.map((f) => `- ${f}`).join("\n")}

Menú generado:
${weeklyMenu
  .map(
    (day) =>
      `${day.day}
${day.meals
  .map(
    (meal) =>
      `- ${meal.mealType}: ${meal.title}
  Ingredientes: ${meal.ingredients.join(", ")}
  Preparación: ${meal.preparation}`
  )
  .join("\n")}`
  )
  .join("\n\n")}

Instrucciones:
- Organiza por día.
- Incluye desayuno, comida, cena y colación.
- Mantén el texto claro y práctico.
- No cambies ingredientes.
- No agregues pan, tortilla, arroz, avena, papa, camote, jugos ni fruta como desayuno.
`.trim();
  }

  const options = buildOptions(params);
  const count = options.length;

  return `
El usuario pidió opciones de comida.

Usa SOLO estas opciones generadas por el gestor interno.
No inventes otros platillos ni ingredientes.
No agregues alimentos fuera del protocolo.

Protocolo activo: ${activeProtocol}
Cantidad solicitada: ${count}

Alimentos excluidos:
${excludedFoods.map((f) => `- ${f}`).join("\n")}

Opciones generadas:
${options
  .map(
    (option, index) =>
      `${index + 1}. ${option.title}
Ingredientes: ${option.ingredients.join(", ")}
Preparación: ${option.preparation}`
  )
  .join("\n\n")}

Instrucciones:
- Responde con exactamente ${count} opciones.
- Usa los títulos, ingredientes y preparación del gestor.
- No cambies alimentos.
- No preguntes si quiere más opciones.
`.trim();
}