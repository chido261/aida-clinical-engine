import type OpenAI from "openai";

import type {
  CulinaryPlan,
  CulinaryRecipe,
  SemanticFoodInterpretation,
} from "./foodDecisionTypes";
import type { ProtocolModuleOutput } from "./protocolModule";
import { evaluateFoodWithProtocol } from "./protocolFoodEngine";
import type { Aida2TurnDirective } from "../turnUnderstanding";
import type { Aida2TurnCognition } from "../turnCognition";
import type { Aida2CulinaryMemory } from "../culinaryMemoryTypes";

const NEUTRAL_CULINARY_INGREDIENTS = [
  "agua", "sal", "pimienta", "limón", "limon", "vinagre", "ajo",
  "cebolla", "especias", "hierbas", "polvo para hornear", "levadura",
  "mostaza sin azúcar", "mostaza sin azucar", "orégano", "oregano",
  "comino", "paprika", "cilantro", "jugo de limón", "jugo de limon",
];

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function requestedRecipeCount(message: string) {
  const numeric = message.match(/\b([1-9])\s+(?:recetas?|opciones?|ideas?)\b/i)?.[1];
  const words: Record<string, number> = { una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 };
  const word = message.match(/\b(una|dos|tres|cuatro|cinco)\s+(?:recetas?|opciones?|ideas?)\b/i)?.[1]?.toLowerCase();
  return Math.min(5, Math.max(1, numeric ? Number(numeric) : words[word ?? ""] ?? 1));
}

export function requestsCulinaryPlan(message: string) {
  return /\b(receta|recetas|opci[oó]n|opciones|ideas|c[oó]mo (?:lo|la|los|las)?\s*preparo|c[oó]mo se prepara)\b/i.test(message);
}

function requestsFullRecipe(message: string) {
  return /\b(paso a paso|c[oó]mo (?:la|lo|las|los)?\s*(?:preparo|preparar|elaboro|elaborar|hago|hacer)|ingredientes? y (?:pasos|preparaci[oó]n)|receta completa)\b/i.test(message);
}

function canonicalizeCulinaryIngredient(value: string) {
  const clean = normalize(value)
    .replace(/^proteina\s+de\s+/, "")
    .replace(/\b(cocid[oa]s?|hidratad[oa]s?|texturizad[oa]s?|molid[oa]s?|rallad[oa]s?|picad[oa]s?|finamente|escurrid[oa]s?|natural(?:es)?|vegan[oa]s?|sin azucar)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean || normalize(value);
}

function isNeutralCulinaryIngredient(value: string) {
  const candidate = normalize(value);
  return NEUTRAL_CULINARY_INGREDIENTS.some(term =>
    candidate === normalize(term) || candidate.includes(normalize(term))
  );
}

function parseRecipes(output: string): Array<Omit<CulinaryRecipe, "verified" | "rejectedIngredients">> {
  try {
    const json = output.match(/\{[\s\S]*\}/)?.[0] ?? output;
    const value = JSON.parse(json) as { recipes?: unknown };
    if (!Array.isArray(value.recipes)) return [];
    return value.recipes.flatMap(recipe => {
      if (!recipe || typeof recipe !== "object") return [];
      const item = recipe as Record<string, unknown>;
      if (typeof item.title !== "string" || !Array.isArray(item.ingredients) || !Array.isArray(item.steps)) return [];
      const ingredients = item.ingredients.flatMap(ingredient => {
        if (!ingredient || typeof ingredient !== "object") return [];
        const entry = ingredient as Record<string, unknown>;
        return typeof entry.name === "string" && typeof entry.amount === "string"
          ? [{ name: entry.name.trim(), amount: entry.amount.trim() }]
          : [];
      });
      const steps = item.steps.filter((step): step is string => typeof step === "string").map(step => step.trim()).filter(Boolean);
      return ingredients.length > 0 && steps.length > 0
        ? [{ title: item.title.trim(), ingredients, steps }]
        : [];
    });
  } catch {
    return [];
  }
}

function verifyRecipe(recipe: Omit<CulinaryRecipe, "verified" | "rejectedIngredients">, protocol: ProtocolModuleOutput): CulinaryRecipe {
  const rejectedIngredients = recipe.ingredients.flatMap(({ name }) => {
    if (isNeutralCulinaryIngredient(name)) return [];
    const candidate = canonicalizeCulinaryIngredient(name);
    const evaluation = evaluateFoodWithProtocol({
      protocol,
      userMessage: candidate,
      shouldBuildRecipes: false,
      semanticInterpretation: {
        originalText: name,
        dishName: candidate,
        semanticType: "literal_food",
        baseIngredients: [candidate],
        declaredIngredients: [],
        styleReferences: [],
        isCommercialProduct: false,
        requiresClarification: false,
        clarificationReason: null,
        confidence: 1,
        source: "semantic_fallback",
      },
    });
    const decisions = evaluation.decision.foods;
    return decisions.length > 0 && decisions.every(food => food.status === "ALLOWED" || food.status === "ALLOWED_WITH_VALIDATION")
      ? []
      : [name];
  });
  return {
    ...recipe,
    verified: rejectedIngredients.length === 0,
    rejectedIngredients,
  };
}

function buildArchetypeFallback(params: {
  interpretation: SemanticFoodInterpretation;
  protocol: ProtocolModuleOutput;
  constraints: string[];
}) {
  const { interpretation, protocol, constraints } = params;
  const base = interpretation.baseIngredients[0];
  if (!base) return null;

  const isPlantBasedSubstitute =
    interpretation.semanticType === "plant_based_substitute" ||
    (constraints.includes("vegano") && interpretation.styleReferences.length > 0);

  if (isPlantBasedSubstitute) {
    const vegan = constraints.includes("vegano");
    return verifyRecipe({
      title: interpretation.dishName ?? `Preparación vegetal de ${base}`,
      ingredients: [
        { name: base, amount: "1 taza" },
        { name: "apio picado", amount: "1/4 de taza" },
        { name: "cebolla picada", amount: "2 cucharadas" },
        { name: "aguacate", amount: "1/2 pieza" },
        { name: "jugo de limón", amount: "1 cucharada" },
        { name: "sal y pimienta", amount: "al gusto" },
      ],
      steps: [
        `Prepara ${base} hasta que tenga una textura suave pero firme.`,
        "Machaca el aguacate y mézclalo con el limón para formar el aderezo.",
        "Incorpora el apio, la cebolla y la base vegetal.",
        `Sazona y mezcla hasta obtener una preparación ${vegan ? "completamente vegetal" : "uniforme"}.`,
      ],
    }, protocol);
  }

  return null;
}

function ingredientSignature(recipe: CulinaryRecipe) {
  return new Set(recipe.ingredients.map(item => canonicalizeCulinaryIngredient(item.name)));
}

function recipesAreTooSimilar(left: CulinaryRecipe, right: CulinaryRecipe) {
  const leftSet = ingredientSignature(left);
  const rightSet = ingredientSignature(right);
  const intersection = [...leftSet].filter(item => rightSet.has(item)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union > 0 && intersection / union >= 0.9;
}

export async function buildCulinaryPlan(params: {
  openai: OpenAI;
  userMessage: string;
  interpretation: SemanticFoodInterpretation;
  protocol: ProtocolModuleOutput;
  conversationHistory?: string;
  turnDirective?: Aida2TurnDirective;
  turnCognition?: Aida2TurnCognition;
  culinaryMemory?: Aida2CulinaryMemory | null;
}): Promise<CulinaryPlan> {
  const {
    openai, userMessage, interpretation, protocol, conversationHistory,
    turnDirective, turnCognition, culinaryMemory,
  } = params;
  if (!(turnDirective?.allowsCulinaryPlan ?? requestsCulinaryPlan(userMessage))) {
    return { requested: false, requestedCount: 0, optionNumberOffset: 0, presentation: "choices", constraints: [], recipes: [], rejectedIngredients: [], error: null };
  }

  const missingFromPrevious = turnCognition?.dialogueAct === "REPAIR_PREVIOUS_RESPONSE" && culinaryMemory
    ? Math.max(1, culinaryMemory.requestedCount - culinaryMemory.deliveredCount)
    : null;
  const requestedCount = missingFromPrevious ?? (turnDirective?.selectedOption
    ? 1
    : turnCognition?.responseContract.exactOptionCount ??
      turnCognition?.requestedCount ?? requestedRecipeCount(userMessage));
  const optionNumberOffset = missingFromPrevious && culinaryMemory
    ? culinaryMemory.deliveredCount
    : 0;
  const presentation = requestsFullRecipe(userMessage) ||
    turnDirective?.dialogueAct === "SELECT_RECIPE_OPTION" ||
    turnDirective?.dialogueAct === "ASK_PREPARATION"
      ? "full_recipe"
      : "choices";
  const allowed = protocol.structured.allowedFoods;
  const allowedVocabulary = Object.entries(allowed)
    .map(([category, foods]) => `${category}: ${foods.join(", ")}`)
    .join("\n");
  const constraints = [
    /\bvegano|vegana\b/i.test(userMessage) ? "vegano" : null,
    /\bsin az[uú]car\b/i.test(userMessage) ? "sin azúcar" : null,
    /\bsin l[aá]cteos\b/i.test(userMessage) ? "sin lácteos" : null,
    /\bsin gluten\b/i.test(userMessage) ? "sin gluten" : null,
  ].filter((value): value is string => Boolean(value));

  try {
    const recipes: CulinaryRecipe[] = [];
    const rejected = new Set<string>();

    // Si el usuario ya declaró una base y un estilo inequívocos (por ejemplo,
    // "atún de soya, vegano"), el arquetipo es más fiable y rápido que pedir al
    // modelo que redescubra esa misma composición. El modelo sólo completa las
    // opciones restantes.
    const groundedFallback = buildArchetypeFallback({
      interpretation,
      protocol,
      constraints,
    });
    if (groundedFallback?.verified) recipes.push(groundedFallback);

    for (let attempt = 0; attempt < 4 && recipes.length < requestedCount; attempt += 1) {
      const remaining = requestedCount - recipes.length;
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0.15,
        response_format: { type: "json_object" },
        messages: [{
          role: "system",
          content: [
            "Eres el planificador culinario de AIDA. Construye recetas reales y cocinables; no tomes decisiones clínicas.",
            "Respeta la forma culinaria solicitada. Un pan debe tener estructura de pan; una galleta, estructura de galleta; un ceviche, estructura de ceviche.",
            "Cada ingrediente debe cumplir una función culinaria. No conviertas acompañamientos en una receta falsa.",
            "Usa sólo alimentos permitidos del protocolo y condimentos neutros. Puedes moler o transformar un alimento permitido (por ejemplo, almendra a harina) sin añadir ingredientes incompatibles.",
            "Respeta restricciones del usuario. Si pide una alternativa, no incluyas la versión convencional restringida.",
            `Entrega exactamente ${remaining} receta(s) nueva(s) y distinta(s).`,
            recipes.length > 0 ? `No repitas: ${recipes.map(recipe => recipe.title).join(", ")}.` : "",
            rejected.size > 0 ? `No uses ingredientes descartados por el verificador: ${[...rejected].join(", ")}.` : "",
            "Devuelve JSON {recipes:[{title, ingredients:[{name,amount}], steps:[string]}]}.",
            `Interpretación: ${JSON.stringify(interpretation)}`,
            turnDirective ? `Directiva del turno: ${JSON.stringify(turnDirective)}` : "",
            turnCognition ? `Contrato cognitivo: ${JSON.stringify(turnCognition)}` : "",
            culinaryMemory ? `Plan culinario activo: ${JSON.stringify(culinaryMemory)}` : "",
            conversationHistory ? `Contexto reciente para resolver referencias como “la opción 2”:\n${conversationHistory}` : "",
            `Restricciones del usuario: ${constraints.join(", ") || "ninguna adicional"}`,
            `Alimentos permitidos:\n${allowedVocabulary}`,
            `Alimentos no recomendados del protocolo:\n${protocol.sections.restrictedFoods ?? ""}`,
          ].filter(Boolean).join("\n"),
        }, { role: "user", content: userMessage }],
      });
      const candidates = parseRecipes(response.choices[0]?.message?.content ?? "")
        .map(recipe => verifyRecipe(recipe, protocol));
      candidates.forEach(recipe => {
        recipe.rejectedIngredients.forEach(ingredient => rejected.add(ingredient));
        if (
          recipe.verified &&
          !recipes.some(existing =>
            normalize(existing.title) === normalize(recipe.title) ||
            recipesAreTooSimilar(existing, recipe)
          )
        ) recipes.push(recipe);
      });

      if (recipes.length < requestedCount) {
        const fallback = buildArchetypeFallback({
          interpretation,
          protocol,
          constraints,
        });
        if (
          fallback?.verified &&
          !recipes.some(existing =>
            normalize(existing.title) === normalize(fallback.title) ||
            recipesAreTooSimilar(existing, fallback)
          )
        ) recipes.push(fallback);
      }
    }

    return {
      requested: true,
      requestedCount,
      optionNumberOffset,
      presentation,
      constraints,
      recipes: recipes.slice(0, requestedCount),
      rejectedIngredients: [...rejected],
      error: recipes.length >= requestedCount ? null : "No fue posible verificar suficientes recetas compatibles.",
    };
  } catch {
    return {
      requested: true,
      requestedCount,
      optionNumberOffset,
      presentation,
      constraints,
      recipes: [],
      rejectedIngredients: [],
      error: "No fue posible construir recetas verificadas en este momento.",
    };
  }
}
