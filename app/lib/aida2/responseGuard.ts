import type { Aida2MealModuleOutput } from "@/app/lib/aida2/moduleRunner";

function phaseLabel(protocolId: string) {
  if (protocolId === "DIAGNOSTICO_7_DIAS") return "la fase de Diagnóstico";
  if (protocolId === "FASE_1") return "la Fase 1";
  if (protocolId === "FASE_2") return "la Fase 2";
  return "tu fase actual";
}

function formatFoods(foods: string[]) {
  if (foods.length === 1) return foods[0];
  if (foods.length === 2) return `${foods[0]} y ${foods[1]}`;
  return `${foods.slice(0, -1).join(", ")} y ${foods.at(-1)}`;
}

export function enforceAida2StructuredDecision(params: {
  reply: string;
  mealModule?: Aida2MealModuleOutput;
}) {
  const { reply, mealModule } = params;
  if (!mealModule) return reply;

  const needsIngredients = mealModule.decision.foods.filter(
    (food) => food.status === "NEEDS_INGREDIENTS"
  );

  if (needsIngredients.length > 0) {
    return [
      "Esta preparación puede ser compatible, pero el nombre por sí solo no permite saberlo.",
      "Dime todos sus ingredientes —incluidas harinas, almidones o productos añadidos— y la evaluaré por su composición, no solamente por llamarse tortilla, pan o base.",
    ].join("\n\n");
  }

  const compatibleBases = extractCompatibleBases(mealModule.recommendation);

  if (mealModule.decision.shouldBuildRecipes && compatibleBases.length > 0) {
    return [
      `Estas opciones son compatibles con ${phaseLabel(
        mealModule.decision.protocolId
      )} según la validación alimentaria:`,
      ...compatibleBases.map((base, index) => `${index + 1}. ${base}`),
    ].join("\n\n");
  }

  const notAllowed = mealModule.decision.foods.filter(
    (food) => food.status === "NOT_ALLOWED"
  );

  if (notAllowed.length > 0) {
    const foods = formatFoods(notAllowed.map((food) => food.food));
    const reasons = [...new Set(notAllowed.map((food) => food.reason))];
    const allowed = mealModule.decision.foods.filter(
      (food) => food.status === "ALLOWED"
    );
    const allowedExplanation = allowed.length > 0
      ? capitalizeSentence(`${formatFoods(allowed.map((food) => food.canonicalFood))} sí ${
          allowed.length === 1 ? "es compatible" : "son compatibles"
        }: ${[...new Set(allowed.map((food) => food.reason))].join("; ")}.`)
      : null;

    return [
      allowedExplanation,
      `En ${phaseLabel(mealModule.decision.protocolId)}, el protocolo no recomienda ${foods}.`,
      reasons.length === 1
        ? `La razón es que ${reasons[0]}.`
        : `Estas son las razones: ${reasons.join("; ")}.`,
      "Por ahora no lo incluyas ni intentes validarlo con una porción pequeña. Esa validación corresponderá únicamente cuando una fase posterior del protocolo lo permita.",
      "Si quieres, dime qué comida estás preparando y te ayudo a construir una alternativa compatible con tu fase.",
    ].filter(Boolean).join("\n\n");
  }

  const ingredientBasedPreparations = mealModule.decision.foods.filter(
    (food) => food.source === "ingredient_based_preparation" && food.status === "ALLOWED"
  );

  if (ingredientBasedPreparations.length > 0) {
    const reasons = [...new Set(ingredientBasedPreparations.map((food) => food.reason))];

    return [
      `Sí. Por la composición que describiste, esta preparación es compatible con ${phaseLabel(
        mealModule.decision.protocolId
      )}.`,
      `${capitalizeSentence(reasons.join("; "))}. La decisión se basa en sus ingredientes y no en el nombre de la preparación.`,
    ].join("\n\n");
  }

  if (
    mealModule.decision.hasConditionalFoods &&
    !/2\s*horas|dos\s*horas/i.test(reply)
  ) {
    return `${reply}\n\nRecuerda medir tu glucosa 2 horas después del primer bocado para validar esa porción.`;
  }

  return reply;
}

function capitalizeSentence(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function extractCompatibleBases(recommendation: string) {
  const section = recommendation.match(
    /BASES CULINARIAS COMPATIBLES:\s*([\s\S]*?)(?:\n\s*LÍMITES DE REDACCIÓN:|$)/i
  )?.[1];

  if (!section) return [];

  return [...section.matchAll(/^\d+\.\s+(.+)$/gm)]
    .map(match => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
}
