import type { Aida2ConversationState } from "./conversationState";

export type Aida2DialogueAct =
  | "VALIDATE_FOOD"
  | "REQUEST_RECIPE"
  | "SELECT_RECIPE_OPTION"
  | "MODIFY_SELECTED_OPTION"
  | "ASK_PREPARATION"
  | "PAIR_FOOD_OR_DRINK"
  | "VALIDATE_PREPARATION"
  | "GENERAL_FOOD"
  | "NON_FOOD";

export type Aida2TurnDirective = {
  dialogueAct: Aida2DialogueAct;
  explicitCurrentIntent: boolean;
  requiresHistory: boolean;
  contextPolicy: "CURRENT_TURN_ONLY" | "SELECTIVE_HISTORY";
  allowsCulinaryPlan: boolean;
  selectedOption: number | null;
  targetHint: string | null;
  reason: string;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function optionNumber(text: string) {
  const numeric = text.match(/\bopcion\s*(?:numero\s*)?(\d+)\b/i)?.[1];
  if (numeric) return Number(numeric);
  const words: Record<string, number> = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 };
  const word = text.match(/\bopcion\s+(uno|una|dos|tres|cuatro|cinco)\b/i)?.[1];
  return word ? words[word] ?? null : null;
}

function foodTarget(text: string) {
  const match = text.match(/\bpuedo\s+(?:comer|tomar|beber)\s+(.+?)(?:\?|$)/i);
  return match?.[1]?.replace(/[¿?¡!.,]/g, "").trim() || null;
}

export function understandCurrentTurn(params: {
  message: string;
  conversationState?: Aida2ConversationState | null;
}): Aida2TurnDirective {
  const text = normalize(params.message);
  const selectedOption = optionNumber(text);

  // La intención explícita del turno actual siempre vence al contexto anterior.
  if (/\b(puedo|podria)\s+(comer|tomar|beber)\b|\b(esta|es)\s+permitid[oa]\b|\bme\s+conviene\b/i.test(text)) {
    return {
      dialogueAct: "VALIDATE_FOOD", explicitCurrentIntent: true, requiresHistory: false,
      contextPolicy: "CURRENT_TURN_ONLY", allowsCulinaryPlan: false, selectedOption: null,
      targetHint: foodTarget(text), reason: "El usuario pide validar directamente un alimento en el turno actual.",
    };
  }

  if (selectedOption && /\b(agrega|agregame|anade|anademe|incluye|ponle|acompan|bebida)\b/i.test(text)) {
    return {
      dialogueAct: "MODIFY_SELECTED_OPTION", explicitCurrentIntent: true, requiresHistory: true,
      contextPolicy: "SELECTIVE_HISTORY", allowsCulinaryPlan: true, selectedOption,
      targetHint: null, reason: "El usuario modifica una opción concreta del contexto reciente.",
    };
  }

  if (selectedOption && /\b(como|elabora|elaborar|prepara|preparar|receta|dame|quiero)\b/i.test(text)) {
    return {
      dialogueAct: "SELECT_RECIPE_OPTION", explicitCurrentIntent: true, requiresHistory: true,
      contextPolicy: "SELECTIVE_HISTORY", allowsCulinaryPlan: true, selectedOption,
      targetHint: null, reason: "El usuario selecciona una opción previa y solicita desarrollarla.",
    };
  }

  if (/\b(receta|recetas|opcion|opciones|ideas|menu)\b/i.test(text) && /\b(dame|quiero|quisiera|hazme|prepara|preparame|sugiere|necesito)\b/i.test(text)) {
    return {
      dialogueAct: "REQUEST_RECIPE", explicitCurrentIntent: true, requiresHistory: false,
      contextPolicy: "CURRENT_TURN_ONLY", allowsCulinaryPlan: true, selectedOption: null,
      targetHint: null, reason: "El usuario solicita explícitamente una receta u opciones nuevas.",
    };
  }

  if (/\b(con que|acompanar|acompanarlo|bebida)\b/i.test(text)) {
    return {
      dialogueAct: "PAIR_FOOD_OR_DRINK", explicitCurrentIntent: true, requiresHistory: true,
      contextPolicy: "SELECTIVE_HISTORY", allowsCulinaryPlan: true, selectedOption,
      targetHint: null, reason: "El usuario pide complementar una comida u opción previa.",
    };
  }

  if (/\b(hech[oa] con|preparad[oa] con|preparo con|preparas con|ingredientes?|lleva|contiene)\b/i.test(text)) {
    return {
      dialogueAct: "VALIDATE_PREPARATION", explicitCurrentIntent: true, requiresHistory: false,
      contextPolicy: "CURRENT_TURN_ONLY", allowsCulinaryPlan: false, selectedOption: null,
      targetHint: null, reason: "El usuario describe o consulta la composición de una preparación.",
    };
  }

  if (/\bcomo\s+(?:lo|la|los|las)?\s*(?:preparo|elaboro|hago)|\bpaso a paso\b/i.test(text)) {
    return {
      dialogueAct: "ASK_PREPARATION", explicitCurrentIntent: true, requiresHistory: true,
      contextPolicy: "SELECTIVE_HISTORY", allowsCulinaryPlan: true, selectedOption,
      targetHint: null, reason: "El usuario solicita desarrollar una preparación identificada previamente.",
    };
  }

  const foodRelated = /\b(comer|tomar|beber|receta|alimento|comida|ingrediente|desayuno|cena|soya|pan|tortilla)\b/i.test(text) ||
    params.conversationState?.lastUserIntent === "FOOD_ADVICE";
  return {
    dialogueAct: foodRelated ? "GENERAL_FOOD" : "NON_FOOD",
    explicitCurrentIntent: false,
    requiresHistory: false,
    contextPolicy: "CURRENT_TURN_ONLY",
    allowsCulinaryPlan: false,
    selectedOption: null,
    targetHint: null,
    reason: foodRelated ? "Consulta alimentaria sin una acción explícita adicional." : "El turno no es alimentario.",
  };
}
