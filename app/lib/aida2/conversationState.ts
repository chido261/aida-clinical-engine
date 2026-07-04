// app/lib/aida2/conversationState.ts

export type Aida2MealType =
  | "desayuno"
  | "comida"
  | "cena"
  | "snack";

export type Aida2FoodDecision =
  | "compatible"
  | "not_recommended"
  | "needs_ingredients"
  | null;

export type Aida2PendingActionType =
  | "BUILD_RECIPES"
  | "BUILD_ALTERNATIVES"
  | "EXPLAIN_DECISION"
  | "ASK_INGREDIENTS"
  | "CONTINUE_PREVIOUS"
  | "NONE";

export type Aida2PendingAction = {
  type: Aida2PendingActionType;
  count?: number | null;
  target?: string | null;
  avoid?: string[];
  mealType?: Aida2MealType | null;
  reason?: string | null;
};

export type Aida2ConversationState = {
  activeTopic: string | null;
  activeGoal: string | null;
  activeMealType: Aida2MealType | null;

  lastUserIntent: string | null;
  lastFoodTarget: string | null;
  lastFoodDecision: Aida2FoodDecision;
  lastFoodReason: string | null;

  pendingAction: Aida2PendingAction | null;

  rejectedFoods: string[];
  compatibleFoods: string[];

  lastAssistantPromise: string | null;
  shouldContinuePendingAction: boolean;
};

export const EMPTY_AIDA2_CONVERSATION_STATE: Aida2ConversationState = {
  activeTopic: null,
  activeGoal: null,
  activeMealType: null,

  lastUserIntent: null,
  lastFoodTarget: null,
  lastFoodDecision: null,
  lastFoodReason: null,

  pendingAction: null,

  rejectedFoods: [],
  compatibleFoods: [],

  lastAssistantPromise: null,
  shouldContinuePendingAction: false,
};

export function createEmptyAida2ConversationState(): Aida2ConversationState {
  return {
    ...EMPTY_AIDA2_CONVERSATION_STATE,
    rejectedFoods: [],
    compatibleFoods: [],
  };
}

export function buildStateFromRecentText(params: {
  history: string;
  userMessage: string;
  previousState?: Aida2ConversationState | null;
}): Aida2ConversationState {
  const { history, userMessage, previousState } = params;

  const state = cloneState(previousState ?? createEmptyAida2ConversationState());

  const text = normalize(userMessage);
  const combined = `${history}\n${userMessage}`;

  const mealType =
    inferMealTypeFromText(userMessage) ??
    inferMealTypeFromText(history) ??
    state.activeMealType;

  const requestedCount =
    extractRequestedCountFromText(userMessage) ??
    extractRequestedCountFromText(history);

  const target = extractFoodTargetFromText(userMessage) ?? state.lastFoodTarget;

  const rejectedFood =
    inferRejectedFood(combined) ??
    state.rejectedFoods[state.rejectedFoods.length - 1] ??
    null;

  const wantsFoodHelp = messageLooksFoodRelated(userMessage, history, state);

  const wantsOptions = messageRequestsRecipesOrOptions(userMessage);

  const continuesPending =
    Boolean(state.pendingAction) &&
    (isShortAcceptance(userMessage) || isPendingActionReminder(userMessage));

  state.shouldContinuePendingAction = continuesPending;

  if (mealType) {
    state.activeMealType = mealType;
  }

  if (wantsFoodHelp) {
    state.lastUserIntent = "FOOD_ADVICE";
  }

  if (target) {
    state.lastFoodTarget = target;
  }

  if (rejectedFood) {
    state.lastFoodTarget = rejectedFood;
    state.lastFoodDecision = "not_recommended";
    state.lastFoodReason =
      "El alimento fue marcado como no recomendado en la conversación reciente.";
    state.rejectedFoods = uniqueText([...state.rejectedFoods, rejectedFood]);
  }

  if (continuesPending && state.pendingAction) {
    state.activeTopic = state.activeTopic ?? "Continuar acción pendiente";
    state.activeGoal =
      state.activeGoal ??
      state.pendingAction.reason ??
      "Continuar con la acción alimentaria pendiente.";
    return state;
  }

  if (wantsOptions && rejectedFood) {
    const count = requestedCount ?? state.pendingAction?.count ?? 3;

    state.activeTopic = `Alternativas compatibles sin ${rejectedFood}`;
    state.activeGoal = `Construir ${count} opción(es) compatibles evitando ${rejectedFood}.`;
    state.pendingAction = {
      type: "BUILD_ALTERNATIVES",
      count,
      target: null,
      avoid: uniqueText([rejectedFood]),
      mealType: mealType ?? state.activeMealType,
      reason: `El usuario pidió recetas/opciones, pero ${rejectedFood} no es recomendado en esta fase.`,
    };
    state.lastAssistantPromise = `Entregar ${count} alternativa(s) compatible(s) sin ${rejectedFood}.`;

    return state;
  }

  if (wantsOptions) {
    const count = requestedCount ?? state.pendingAction?.count ?? 3;

    state.activeTopic = "Opciones alimentarias compatibles";
    state.activeGoal = `Construir ${count} opción(es) compatibles con el protocolo.`;
    state.pendingAction = {
      type: "BUILD_RECIPES",
      count,
      target,
      avoid: state.rejectedFoods,
      mealType: mealType ?? state.activeMealType,
      reason: "El usuario pidió recetas, ideas u opciones alimentarias.",
    };
    state.lastAssistantPromise = `Entregar ${count} receta(s) u opción(es) compatibles.`;

    return state;
  }

  if (wantsFoodHelp && target) {
    state.activeTopic = `Validación alimentaria: ${target}`;
    state.activeGoal = `Validar si ${target} es compatible con el protocolo.`;
    state.pendingAction = null;
  }

  return state;
}

export function isShortAcceptance(message: string) {
  const text = normalize(message);

  return /^(s[ií]|va|dale|ok|okay|sale|claro|perfecto|de acuerdo|adelante|hazlo|pues ya que|ya que|bueno|sí)$/.test(
    text
  );
}

export function isPendingActionReminder(message: string) {
  const text = normalize(message);

  return /\b(y las recetas|las recetas|y las opciones|las opciones|me las das|pasamelas|pásamelas|mandamelas|mándamelas|ahora si|ahora sí|y entonces|continua|continúa|sigue|ya)\b/i.test(
    text
  );
}

export function messageLooksFoodRelated(
  userMessage: string,
  history?: string | null,
  state?: Aida2ConversationState | null
) {
  const text = normalize(userMessage);

  if (messageRequestsRecipesOrOptions(userMessage)) return true;
  if (extractFoodTargetFromText(userMessage)) return true;

  if (
    /\b(comer|tomar|beber|desayunar|cenar|almorzar|antojo|antoja|ganas|receta|recetas|opcion|opciones|opción|opciones|idea|ideas|platillo|platillos|comida|desayuno|cena|almuerzo|ingrediente|ingredientes|preparar|armar|armame|ármame|dame)\b/i.test(
      text
    )
  ) {
    return true;
  }

  if (
    state?.pendingAction &&
    (isShortAcceptance(userMessage) || isPendingActionReminder(userMessage))
  ) {
    return true;
  }

  if (
    history &&
    /\b(comida|desayuno|cena|receta|recetas|opciones|alimento|glucosa|fase)\b/i.test(
      normalize(history)
    ) &&
    /\b(y si|con|sin|eso|esa|ese|las|los|la|el|va|dale|ok|pues ya que)\b/i.test(
      text
    )
  ) {
    return true;
  }

  return false;
}

export function messageRequestsRecipesOrOptions(message: string) {
  const text = normalize(message);

  return /\b(receta|recetas|opcion|opciones|opción|ideas|idea|platillo|platillos|men[uú]|dame|armame|ármame|armarme|hazme|preparame|prepárame)\b/i.test(
    text
  );
}

export function inferMealTypeFromText(text: string): Aida2MealType | null {
  const value = normalize(text);

  if (/\b(desayuno|desayunar|mañana|ayunas)\b/i.test(value)) {
    return "desayuno";
  }

  if (/\b(cena|cenar|noche)\b/i.test(value)) {
    return "cena";
  }

  if (/\b(snack|colaci[oó]n|colacion|botana|tentempi[eé])\b/i.test(value)) {
    return "snack";
  }

  if (/\b(comida|almuerzo|almorzar)\b/i.test(value)) {
    return "comida";
  }

  return null;
}

export function extractRequestedCountFromText(text: string): number | null {
  const value = normalize(text);

  const numericMatch = value.match(
    /\b(\d+)\s+(receta|recetas|opci[oó]n|opciones|idea|ideas|platillo|platillos)\b/i
  );

  if (numericMatch?.[1]) {
    return clampCount(Number(numericMatch[1]));
  }

  const wordCounts: Record<string, number> = {
    una: 1,
    un: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
  };

  const wordMatch = value.match(
    /\b(una|un|dos|tres|cuatro|cinco)\s+(receta|recetas|opci[oó]n|opciones|idea|ideas|platillo|platillos)\b/i
  );

  if (wordMatch?.[1]) {
    return clampCount(wordCounts[wordMatch[1]] ?? 1);
  }

  return null;
}

export function extractFoodTargetFromText(text: string): string | null {
  const value = text.trim();

  const patterns = [
    /\b(?:tengo|traigo)\s+(?:antojo|ganas)\s+de\s+(.+?)(?:,|\.|\?|$)/i,
    /\bse\s+me\s+antoj[oó]?\s+(.+?)(?:,|\.|\?|$)/i,
    /\bpuedo\s+(?:comer|tomar|beber|desayunar|cenar)\s+(.+?)(?:,|\.|\?|$)/i,
    /\bquiero\s+(?:comer|tomar|beber|desayunar|cenar)\s+(.+?)(?:,|\.|\?|$)/i,
    /\brecetas?\s+(?:con|de|para)\s+(.+?)(?:,|\.|\?|$)/i,
    /\bopciones?\s+(?:con|de|para)\s+(.+?)(?:,|\.|\?|$)/i,
    /\bideas?\s+(?:con|de|para)\s+(.+?)(?:,|\.|\?|$)/i,
    /\b(?:armar|armarme|hacerme|hazme|prepararme|prepárame)\s+(?:unas?|algunas?|\d+)?\s*(?:recetas|opciones|ideas)?\s*(?:con|de|para)\s+(.+?)(?:,|\.|\?|$)/i,
    /\b(?:con|sin)\s+(.+?)(?:,|\.|\?|$)/i,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);

    if (match?.[1]) {
      const cleaned = cleanFoodTarget(match[1]);
      return cleaned || null;
    }
  }

  return null;
}

function inferRejectedFood(text: string): string | null {
  const value = normalize(text);

  const foods =
    "(arroz integral|arroz|papa|papas|avena|pan comun|pan común|pan blanco|pan integral|tortilla de maiz|tortilla de maíz|tortilla de harina|tostada|tostadas|miel|azucar|azúcar)";

  const patterns = [
    new RegExp(
      `\\b${foods}\\b.{0,100}\\b(no es recomendable|no conviene|no recomendado|no te recomiendo|puede elevar|alta carga glucemica|alta carga glucémica)\\b`,
      "i"
    ),
    new RegExp(
      `\\b(no es recomendable|no conviene|no recomendado|no te recomiendo)\\b.{0,100}\\b${foods}\\b`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);

    if (!match) continue;

    const foodMatch = match.find((item) =>
      item
        ? /arroz|papa|avena|pan|tortilla|tostada|miel|azucar|azúcar/i.test(
            item
          )
        : false
    );

    if (foodMatch) return cleanFoodTarget(foodMatch);
  }

  return null;
}

function cleanFoodTarget(value: string) {
  return value
    .replace(/[¿?¡!.,]/g, "")
    .replace(
      /\b(me puedes|puedes|podr[ií]as|quiero|quisiera|dame|hazme|armame|ármame|armarme|preparame|prepárame)\b/gi,
      ""
    )
    .replace(/\b(unas?|algunas?|\d+)\s+(recetas|opciones|ideas|platillos)\b/gi, "")
    .replace(/\b(receta|recetas|opci[oó]n|opciones|idea|ideas|platillo|platillos)\b/gi, "")
    .replace(/\b(aunque sea|aunque sea un poco de|un poco de|poquito de|poco de)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueText(values: string[]) {
  return Array.from(
    new Set(values.map((value) => cleanFoodTarget(value)).filter(Boolean))
  );
}

function cloneState(state: Aida2ConversationState): Aida2ConversationState {
  return {
    ...state,
    rejectedFoods: [...state.rejectedFoods],
    compatibleFoods: [...state.compatibleFoods],
    pendingAction: state.pendingAction
      ? {
          ...state.pendingAction,
          avoid: [...(state.pendingAction.avoid ?? [])],
        }
      : null,
  };
}

function clampCount(value: number) {
  if (!Number.isFinite(value)) return 1;

  return Math.min(Math.max(value, 1), 5);
}

function normalize(value: string) {
  return value.toLowerCase().trim();
}